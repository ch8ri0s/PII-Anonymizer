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
    console.log('[ModelManager] Loading @huggingface/transformers v3...');

    const { pipeline, env } = await import('@huggingface/transformers');

    // Configure for browser environment
    // v3 has better defaults for browser, but we can still customize
    env.allowRemoteModels = true;
    env.allowLocalModels = false; // Browser - use remote only

    // Log environment info for debugging
    console.log('[ModelManager] transformers.js v3 loaded successfully');
    console.log('[ModelManager] env:', env);

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
