/**
 * Model Types (Browser Version)
 *
 * TypeScript interfaces for the ML model loading system.
 * Adapted from Electron version for browser compatibility.
 */

/**
 * Status of the model in browser storage
 */
export interface ModelStatus {
  /** Whether the model exists and is ready to use */
  exists: boolean;
  /** Whether the model is currently loading */
  loading: boolean;
  /** Whether the model is ready for inference */
  ready: boolean;
  /** Error message if loading failed */
  error?: string;
  /** Whether using fallback (regex-only) mode */
  fallbackMode: boolean;
}

/**
 * Progress information during model download
 */
export interface DownloadProgress {
  /** Current status of the download */
  status: 'initiate' | 'download' | 'progress' | 'done' | 'ready' | 'error';
  /** Name of the file currently being downloaded */
  file?: string;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Bytes loaded so far */
  loaded?: number;
  /** Total bytes to download */
  total?: number;
  /** Error message if status is 'error' */
  error?: string;
}

/**
 * Result of a model load operation
 */
export interface LoadResult {
  /** Whether the load was successful */
  success: boolean;
  /** Whether fallback mode is active */
  fallbackMode: boolean;
  /** Error message if load failed */
  error?: string;
}

/**
 * Configuration for the ModelManager
 */
export interface ModelManagerConfig {
  /** Whether to enable browser caching (IndexedDB) */
  useBrowserCache: boolean;
  /** Whether to allow fallback to regex-only detection */
  allowFallback: boolean;
  /** Timeout for model loading in milliseconds */
  loadTimeout: number;
}

/**
 * Progress callback type
 */
export type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Model name used for PII detection
 */
export const MODEL_NAME = 'Xenova/distilbert-base-multilingual-cased-ner-hrl';

/**
 * Approximate size of the model in bytes (for UI display)
 */
export const MODEL_SIZE_BYTES = 135_000_000; // ~129MB model + tokenizer files

/**
 * Default configuration
 */
export const DEFAULT_MODEL_CONFIG: ModelManagerConfig = {
  useBrowserCache: true,
  allowFallback: true,
  loadTimeout: 120_000, // 2 minutes
};
