/**
 * Model Module Entry Point
 * Re-exports all model loading functionality
 */

// Type exports (interfaces and type aliases)
export type {
  ModelStatus,
  DownloadProgress,
  LoadResult,
  ModelManagerConfig,
  ProgressCallback,
} from './types';

// Value exports (constants)
export {
  MODEL_NAME,
  MODEL_SIZE_BYTES,
  DEFAULT_MODEL_CONFIG,
} from './types';

// Function exports
export {
  getModelStatus,
  isModelReady,
  isFallbackMode,
  getPipeline,
  loadModel,
  cancelLoading,
  reset,
  runInference,
  getModelDisplayName,
} from './ModelManager';
