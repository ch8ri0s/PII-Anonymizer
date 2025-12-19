/**
 * Model Download Types
 *
 * TypeScript interfaces for the lazy-loading model download system.
 */

/**
 * Status of the model on the local filesystem
 */
export interface ModelStatus {
  /** Whether the model exists and is ready to use */
  exists: boolean;
  /** Whether all required files are present and valid */
  valid: boolean;
  /** Path to the model directory */
  path: string;
  /** Total size of the model in bytes (if exists) */
  size?: number;
  /** List of files that are missing */
  missingFiles: string[];
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
 * Result of a model download operation
 */
export interface DownloadResult {
  /** Whether the download was successful */
  success: boolean;
  /** Path where the model was downloaded */
  modelPath?: string;
  /** Error message if download failed */
  error?: string;
}

/**
 * Configuration for the ModelManager
 */
export interface ModelManagerConfig {
  /** Name of the model on HuggingFace */
  modelName: string;
  /** Base path for storing models */
  basePath: string;
  /** Whether to verify checksums after download */
  verifyChecksums: boolean;
}

/**
 * Required files for a valid model installation
 */
export const REQUIRED_MODEL_FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'onnx/model_quantized.onnx',
] as const;

/**
 * Model name used for PII detection
 */
export const MODEL_NAME = 'Xenova/distilbert-base-multilingual-cased-ner-hrl';

/**
 * Approximate size of the model in bytes (for UI display)
 */
export const MODEL_SIZE_BYTES = 135_000_000; // ~129MB model + tokenizer files
