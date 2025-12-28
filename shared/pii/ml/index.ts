/**
 * ML Detection Utilities (Epic 8 - Phase 2)
 *
 * Shared utilities for ML-based PII detection across Electron and Browser.
 *
 * @module shared/pii/ml
 */

// Story 8.10: Subword Token Merging
export {
  // Types
  type MLToken,
  type MLTokenAlt,
  type MergedEntity,
  type MergeConfig,
  // Functions
  mergeSubwordTokens,
  mergeTokens,
  extractEntityType,
  isInsideToken,
  isBeginningToken,
  normalizeToken,
  // Class
  SubwordTokenMerger,
  createSubwordTokenMerger,
  // Constants
  DEFAULT_MERGE_CONFIG,
} from './SubwordTokenMerger.js';

// Story 8.11: Document Chunking
export {
  // Types
  type ChunkConfig,
  type TextChunk,
  type ChunkPrediction,
  // Functions
  chunkText,
  mergeChunkPredictions,
  needsChunking,
  estimateTokenCount,
  splitIntoSentences,
  // Class
  TextChunker,
  createTextChunker,
  // Constants
  DEFAULT_CHUNK_CONFIG,
} from './TextChunker.js';

// Story 8.12: ML Input Validation
export {
  // Types
  type ValidationConfig,
  type ValidationResult,
  // Functions
  validateMLInput,
  isValidMLInput,
  getValidationError,
  // Class
  MLInputValidator,
  createMLInputValidator,
  // Constants
  DEFAULT_VALIDATION_CONFIG,
} from './MLInputValidator.js';

// Story 8.13: ML Error Recovery with Retry Logic
export {
  // Types
  type RetryConfig,
  type RetryResult,
  // Functions
  withRetry,
  isRetryableError,
  calculateDelay,
  // Class
  MLRetryHandler,
  createMLRetryHandler,
  // Constants
  DEFAULT_RETRY_CONFIG,
} from './MLRetryHandler.js';

// Story 8.14: ML Performance Monitoring
export {
  // Types
  type MLInferenceMetrics,
  type AggregatedMetrics,
  type MetricsConfig,
  // Functions
  recordMLMetrics,
  getAggregatedMetrics,
  exportMetrics,
  clearMetrics,
  getMetricsCount,
  aggregateMetrics,
  createInferenceMetrics,
  getGlobalCollector,
  // Class
  MLMetricsCollector,
  createMLMetricsCollector,
  // Constants
  DEFAULT_METRICS_CONFIG,
} from './MLMetrics.js';
