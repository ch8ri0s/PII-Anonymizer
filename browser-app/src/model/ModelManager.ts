/**
 * Model Manager (Browser Version)
 *
 * Handles loading of the AI model in the browser environment.
 * Uses @xenova/transformers with browser caching via IndexedDB.
 *
 * Features:
 * - Progress reporting during download
 * - IndexedDB caching for offline use
 * - Fallback to regex-only detection
 * - Cancellation support
 */

import {
  ModelStatus,
  DownloadProgress,
  LoadResult,
  ModelManagerConfig,
  ProgressCallback,
  MODEL_NAME,
  DEFAULT_MODEL_CONFIG,
} from './types';
import type { WorkerRequest, WorkerResponse, MLPrediction } from '../workers/types';
import { v4 as uuidv4 } from 'uuid';

// Story 10.3: Worker log handling, Story 10.6: Logger for model management
import { handleWorkerLogs, createLogger } from '../utils/logger';

// Logger for model management
const log = createLogger('model:manager');

// Pipeline instance for inference
let pipelineInstance: unknown = null;
let loadingPromise: Promise<LoadResult> | null = null;
let abortController: AbortController | null = null;

// Current status
let currentStatus: ModelStatus = {
  exists: false,
  loading: false,
  ready: false,
  fallbackMode: false,
};

// Story 8.15: Web Worker state
let mlWorker: Worker | null = null;
let workerReady = false;
let useWorkerInference = DEFAULT_MODEL_CONFIG.useWorker;
const pendingRequests = new Map<string, {
  resolve: (value: MLPrediction[]) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: number, stage: string) => void;
}>();

/**
 * Get the current model status
 */
export function getModelStatus(): ModelStatus {
  return { ...currentStatus };
}

/**
 * Check if the model is ready for inference
 */
export function isModelReady(): boolean {
  return currentStatus.ready;
}

/**
 * Check if fallback mode is active
 */
export function isFallbackMode(): boolean {
  return currentStatus.fallbackMode;
}

/**
 * Get the pipeline instance for inference
 * Returns null if model not loaded
 */
export function getPipeline(): unknown {
  return pipelineInstance;
}

/**
 * Load the ML model
 *
 * Downloads from HuggingFace CDN if not cached.
 * Uses IndexedDB for browser caching.
 *
 * @param progressCallback - Optional callback for progress updates
 * @param config - Configuration options
 * @returns Promise resolving to load result
 */
export async function loadModel(
  progressCallback?: ProgressCallback,
  config: Partial<ModelManagerConfig> = {},
): Promise<LoadResult> {
  // If already loading, return the existing promise
  if (loadingPromise) {
    return loadingPromise;
  }

  // If already loaded, return success
  if (currentStatus.ready && pipelineInstance) {
    return { success: true, fallbackMode: false };
  }

  // Merge config with defaults
  const finalConfig = { ...DEFAULT_MODEL_CONFIG, ...config };

  // Create abort controller for cancellation
  abortController = new AbortController();

  // Start loading
  loadingPromise = doLoadModel(progressCallback, finalConfig);

  try {
    const result = await loadingPromise;
    return result;
  } finally {
    loadingPromise = null;
    abortController = null;
  }
}

/**
 * Internal model loading logic
 */
async function doLoadModel(
  progressCallback?: ProgressCallback,
  config: ModelManagerConfig = DEFAULT_MODEL_CONFIG,
): Promise<LoadResult> {
  currentStatus = {
    exists: false,
    loading: true,
    ready: false,
    fallbackMode: false,
  };

  // Send initial progress
  progressCallback?.({
    status: 'initiate',
    file: 'Initializing model...',
    progress: 0,
  });

  try {
    // Dynamic import of transformers.js v3 (@huggingface/transformers)
    log.info('Loading @huggingface/transformers v3...');

    const { pipeline, env } = await import('@huggingface/transformers');

    // Configure for browser environment
    // v3 has better defaults for browser, but we can still customize
    env.allowRemoteModels = true;
    env.allowLocalModels = false; // Browser - use remote only

    // Log environment info for debugging
    log.info('transformers.js v3 loaded successfully');
    log.debug('Environment config', { allowRemoteModels: env.allowRemoteModels, allowLocalModels: env.allowLocalModels });

    // Create timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Model loading timed out after ${config.loadTimeout}ms`));
      }, config.loadTimeout);
    });

    // Create abort promise
    const abortPromise = new Promise<never>((_, reject) => {
      abortController?.signal.addEventListener('abort', () => {
        reject(new Error('Model loading cancelled'));
      });
    });

    // Load the pipeline with progress tracking
    const loadPromise = pipeline(
      'token-classification',
      MODEL_NAME,
      {
        progress_callback: (progressInfo: DownloadProgress) => {
          // Map transformers.js progress to our format
          const progress: DownloadProgress = {
            status: progressInfo.status || 'progress',
            file: progressInfo.file,
            progress: progressInfo.progress,
            loaded: progressInfo.loaded,
            total: progressInfo.total,
          };
          progressCallback?.(progress);
        },
      },
    );

    // Race between load, timeout, and abort
    pipelineInstance = await Promise.race([loadPromise, timeoutPromise, abortPromise]);

    // Update status
    currentStatus = {
      exists: true,
      loading: false,
      ready: true,
      fallbackMode: false,
    };

    // Send completion progress
    progressCallback?.({
      status: 'ready',
      progress: 100,
      file: 'Model ready!',
    });

    return {
      success: true,
      fallbackMode: false,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Send error progress
    progressCallback?.({
      status: 'error',
      error: errorMessage,
    });

    // If fallback allowed, enable regex-only mode
    if (config.allowFallback) {
      currentStatus = {
        exists: false,
        loading: false,
        ready: false,
        fallbackMode: true,
        error: errorMessage,
      };

      return {
        success: false,
        fallbackMode: true,
        error: errorMessage,
      };
    }

    // Otherwise, report failure
    currentStatus = {
      exists: false,
      loading: false,
      ready: false,
      fallbackMode: false,
      error: errorMessage,
    };

    return {
      success: false,
      fallbackMode: false,
      error: errorMessage,
    };
  }
}

/**
 * Cancel ongoing model loading
 */
export function cancelLoading(): void {
  if (abortController && currentStatus.loading) {
    abortController.abort();
    currentStatus = {
      exists: false,
      loading: false,
      ready: false,
      fallbackMode: true,
      error: 'Loading cancelled by user',
    };
  }
}

/**
 * Reset the model manager to initial state
 * Useful for testing or when switching modes
 */
export function reset(): void {
  pipelineInstance = null;
  loadingPromise = null;
  abortController = null;
  currentStatus = {
    exists: false,
    loading: false,
    ready: false,
    fallbackMode: false,
  };
  // Story 8.15: Also reset worker state
  terminateWorker();
}

// ============================================================================
// Story 8.15: Web Worker ML Inference
// ============================================================================

/**
 * Initialize the ML inference Web Worker
 * Worker is reused across multiple inference calls.
 */
export function initWorker(): Worker {
  if (mlWorker) return mlWorker;

  mlWorker = new Worker(
    new URL('../workers/pii.worker.ts', import.meta.url),
    { type: 'module' },
  );

  mlWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    // Story 10.3: Handle worker logs first
    if (handleWorkerLogs(event)) {
      return;
    }

    const { id, type, payload } = event.data;

    // Handle progress updates
    if (type === 'progress' && payload?.progress !== undefined) {
      const pending = pendingRequests.get(id);
      if (pending?.onProgress) {
        pending.onProgress(payload.progress, payload.stage || '');
      }
      return;
    }

    // Handle ML inference results
    if (type === 'ml_result' && payload?.predictions) {
      const pending = pendingRequests.get(id);
      if (pending) {
        pending.resolve(payload.predictions);
        pendingRequests.delete(id);
      }
      return;
    }

    // Handle errors
    if (type === 'error') {
      const pending = pendingRequests.get(id);
      if (pending) {
        pending.reject(new Error(payload?.error || 'Unknown worker error'));
        pendingRequests.delete(id);
      }
      return;
    }

    // Handle ready signal
    if (type === 'ready') {
      workerReady = true;
    }
  };

  mlWorker.onerror = (event) => {
    log.error('Worker error', { message: event.message });
    // Reject all pending requests
    for (const [id, pending] of pendingRequests) {
      pending.reject(new Error(`Worker error: ${event.message}`));
      pendingRequests.delete(id);
    }
  };

  return mlWorker;
}

/**
 * Terminate the ML inference worker
 * Call this when the worker is no longer needed.
 */
export function terminateWorker(): void {
  if (mlWorker) {
    mlWorker.terminate();
    mlWorker = null;
    workerReady = false;
    // Reject pending requests
    for (const [id, pending] of pendingRequests) {
      pending.reject(new Error('Worker terminated'));
      pendingRequests.delete(id);
    }
  }
}

/**
 * Check if the worker is ready
 */
export function isWorkerReady(): boolean {
  return workerReady && mlWorker !== null;
}

/**
 * Configure whether to use worker for inference
 */
export function setUseWorker(use: boolean): void {
  useWorkerInference = use;
}

/**
 * Get whether worker inference is enabled
 */
export function getUseWorker(): boolean {
  return useWorkerInference;
}

/**
 * Run ML inference using Web Worker
 * Returns predictions from the NER model.
 *
 * @param text - Text to analyze
 * @param onProgress - Optional progress callback
 * @returns Promise resolving to ML predictions
 */
export async function runInferenceInWorker(
  text: string,
  onProgress?: (progress: number, stage: string) => void,
): Promise<MLPrediction[]> {
  // Initialize worker if needed
  if (!mlWorker) {
    initWorker();
  }

  const id = uuidv4();

  const promise = new Promise<MLPrediction[]>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, onProgress });
  });

  const request: WorkerRequest = {
    id,
    type: 'ml_inference',
    payload: { text },
  };

  if (!mlWorker) {
    throw new Error('ML worker failed to initialize');
  }
  mlWorker.postMessage(request);

  return promise;
}

/**
 * Run inference on text using the loaded model
 *
 * @param text - Text to analyze
 * @returns Promise resolving to entity predictions
 */
export async function runInference(text: string): Promise<Array<{
  word: string;
  entity: string;
  score: number;
  start: number;
  end: number;
}>> {
  if (!pipelineInstance) {
    if (currentStatus.fallbackMode) {
      // In fallback mode, return empty (regex-only detection will be used)
      return [];
    }
    throw new Error('Model not loaded. Call loadModel() first.');
  }

  // Type assertion for the pipeline
  const pipeline = pipelineInstance as (text: string) => Promise<Array<{
    word: string;
    entity: string;
    score: number;
    start: number;
    end: number;
  }>>;

  return pipeline(text);
}

/**
 * Get model name for display
 */
export function getModelDisplayName(): string {
  return MODEL_NAME.split('/').pop() || MODEL_NAME;
}
