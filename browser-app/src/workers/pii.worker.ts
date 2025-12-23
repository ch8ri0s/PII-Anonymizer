/**
 * PII Detection Web Worker (Story 7.3, Task 8)
 *
 * Runs the full PII detection pipeline in a background thread.
 * Communicates with main thread via postMessage.
 */

import type { WorkerRequest, WorkerResponse, WorkerStatus } from './types';
import type { Entity, DetectionResult } from '../types/detection.js';
import { v4 as uuidv4 } from 'uuid';

// Import pipeline components
// Note: We can't use the full pipeline with ML model in worker
// because transformers.js needs to be initialized in main thread.
// Worker handles regex-only detection for CPU-intensive operations.

import { SwissEuDetector } from '@core/index';

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
