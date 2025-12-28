/**
 * PII Detection Web Worker (Story 7.3, Task 8; Story 8.15; Story 10.3)
 *
 * Runs the full PII detection pipeline in a background thread.
 * Communicates with main thread via postMessage.
 *
 * Story 8.15: Added ML inference capability using @huggingface/transformers v3.
 * ML inference now runs in the worker to keep the UI thread responsive.
 *
 * Story 10.3: Added WorkerLogger for structured logging via postMessage.
 */

import type { WorkerRequest, WorkerResponse, WorkerStatus, MLPrediction } from './types';
import type { Entity, DetectionResult } from '../types/detection.js';
import { v4 as uuidv4 } from 'uuid';

// Import pipeline components
import { SwissEuDetector } from '@core/index';

// Story 10.3: Import WorkerLogger for structured logging
import { WorkerLogger } from '../utils/WorkerLogger';

// Create scoped logger for this worker
const log = WorkerLogger.create('pii:worker');

// Story 8.15: ML model pipeline (lazily loaded)
let mlPipeline: ((text: string) => Promise<MLPrediction[]>) | null = null;
let mlModelLoading = false;
let mlModelReady = false;
let mlModelError: string | null = null;

/**
 * Worker state
 */
let isReady = false;
let isProcessing = false;
let currentRequestId: string | null = null;
let requestsProcessed = 0;
let totalProcessingTime = 0;
let detector: SwissEuDetector | null = null;

/**
 * Initialize worker
 */
function initialize(): void {
  detector = new SwissEuDetector();
  isReady = true;
  sendResponse({
    id: 'init',
    type: 'ready',
    payload: { status: getStatus() },
  });
}

/**
 * Get worker status
 */
function getStatus(): WorkerStatus {
  return {
    ready: isReady,
    processing: isProcessing,
    currentRequestId: currentRequestId ?? undefined,
    requestsProcessed,
    avgProcessingTimeMs: requestsProcessed > 0
      ? Math.round(totalProcessingTime / requestsProcessed)
      : undefined,
  };
}

/**
 * Send response to main thread
 */
function sendResponse(response: WorkerResponse): void {
  self.postMessage(response);
}

/**
 * Send progress update
 */
function sendProgress(id: string, progress: number, stage: string): void {
  sendResponse({
    id,
    type: 'progress',
    payload: { progress, stage },
  });
}

/**
 * Process detection request
 */
async function processDetection(request: WorkerRequest): Promise<void> {
  const { id, payload } = request;
  const text = payload?.text || '';
  const startTime = performance.now();

  if (!detector) {
    sendResponse({
      id,
      type: 'error',
      payload: { error: 'Worker not initialized' },
    });
    return;
  }

  if (!text) {
    sendResponse({
      id,
      type: 'error',
      payload: { error: 'No text provided' },
    });
    return;
  }

  isProcessing = true;
  currentRequestId = id;

  try {
    // Phase 1: Regex detection (0-50%)
    sendProgress(id, 10, 'Running regex detection');

    const matches = detector.detect(text);

    sendProgress(id, 50, 'Processing matches');

    // Convert matches to entities
    const entities: Entity[] = matches.map(match => ({
      id: uuidv4(),
      type: match.type as Entity['type'],
      text: match.text,
      start: match.start,
      end: match.end,
      confidence: (match as { confidence?: number }).confidence ?? 0.7,
      source: 'RULE' as const,
      metadata: {
        source: match.source,
      },
    }));

    sendProgress(id, 80, 'Finalizing results');

    // Build result
    const result: DetectionResult = {
      entities,
      documentType: 'UNKNOWN',
      metadata: {
        totalDurationMs: Math.round(performance.now() - startTime),
        passResults: [{
          passName: 'RegexPass',
          entitiesAdded: entities.length,
          entitiesModified: 0,
          entitiesRemoved: 0,
          durationMs: Math.round(performance.now() - startTime),
        }],
        entityCounts: countByType(entities),
        flaggedCount: 0,
      },
    };

    sendProgress(id, 100, 'Complete');

    // Update stats
    const processingTime = performance.now() - startTime;
    totalProcessingTime += processingTime;
    requestsProcessed++;

    // Send result
    sendResponse({
      id,
      type: 'result',
      payload: {
        result,
        entities,
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    sendResponse({
      id,
      type: 'error',
      payload: {
        error: errorMessage,
        stack,
      },
    });
  } finally {
    isProcessing = false;
    currentRequestId = null;
  }
}

/**
 * Count entities by type
 */
function countByType(entities: Entity[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entity of entities) {
    counts[entity.type] = (counts[entity.type] || 0) + 1;
  }
  return counts;
}

/**
 * Handle cancel request
 */
function handleCancel(request: WorkerRequest): void {
  if (currentRequestId === request.payload?.documentId) {
    // Note: Can't truly cancel sync operations, but we can acknowledge
    sendResponse({
      id: request.id,
      type: 'cancelled',
      payload: {},
    });
  }
}

/**
 * Handle status request
 */
function handleStatus(request: WorkerRequest): void {
  sendResponse({
    id: request.id,
    type: 'status',
    payload: { status: getStatus() },
  });
}

/**
 * Story 8.15: Load ML model in worker
 * Uses @huggingface/transformers v3 which supports Web Workers.
 */
async function loadMLModel(): Promise<void> {
  if (mlModelReady || mlModelLoading) return;

  mlModelLoading = true;
  mlModelError = null;

  try {
    log.info('Loading @huggingface/transformers v3...');

    // Dynamic import of transformers.js v3
    const { pipeline, env } = await import('@huggingface/transformers');

    // Configure for browser/worker environment
    env.allowRemoteModels = true;
    env.allowLocalModels = false;

    log.info('Creating token-classification pipeline...');

    // Create the NER pipeline
    const nerPipeline = await pipeline(
      'token-classification',
      'Xenova/distilbert-base-multilingual-cased-ner-hrl',
    );

    // Type-safe wrapper
    mlPipeline = async (text: string): Promise<MLPrediction[]> => {
      const results = await nerPipeline(text);
      return results as MLPrediction[];
    };

    mlModelReady = true;
    log.info('ML model loaded successfully');
  } catch (error) {
    mlModelError = error instanceof Error ? error.message : String(error);
    log.error('Failed to load ML model', { error: mlModelError });
  } finally {
    mlModelLoading = false;
  }
}

/**
 * Story 8.15: Handle ML inference request
 */
async function handleMLInference(request: WorkerRequest): Promise<void> {
  const { id, payload } = request;
  const text = payload?.text || '';
  const startTime = performance.now();

  if (!text) {
    sendResponse({
      id,
      type: 'error',
      payload: { error: 'No text provided for ML inference' },
    });
    return;
  }

  isProcessing = true;
  currentRequestId = id;

  try {
    // Load model if not ready
    if (!mlModelReady && !mlModelLoading) {
      sendProgress(id, 10, 'Loading ML model...');
      await loadMLModel();
    }

    // Wait for model if still loading
    while (mlModelLoading) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Check for model errors
    if (mlModelError || !mlPipeline) {
      sendResponse({
        id,
        type: 'error',
        payload: { error: mlModelError || 'ML model not available' },
      });
      return;
    }

    sendProgress(id, 30, 'Running ML inference...');

    // Run inference
    const predictions = await mlPipeline(text);

    sendProgress(id, 90, 'Processing results...');

    const processingTime = performance.now() - startTime;
    totalProcessingTime += processingTime;
    requestsProcessed++;

    sendProgress(id, 100, 'Complete');

    // Send ML result
    sendResponse({
      id,
      type: 'ml_result',
      payload: { predictions },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    sendResponse({
      id,
      type: 'error',
      payload: { error: errorMessage, stack },
    });
  } finally {
    isProcessing = false;
    currentRequestId = null;
  }
}

/**
 * Message handler
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  switch (request.type) {
    case 'init':
      initialize();
      break;

    case 'detect':
      await processDetection(request);
      break;

    case 'ml_inference':
      // Story 8.15: Handle ML inference in worker
      await handleMLInference(request);
      break;

    case 'cancel':
      handleCancel(request);
      break;

    case 'status':
      handleStatus(request);
      break;

    default:
      sendResponse({
        id: request.id,
        type: 'error',
        payload: { error: `Unknown request type: ${request.type}` },
      });
  }
};

// Auto-initialize
initialize();
