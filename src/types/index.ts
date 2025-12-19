/**
 * Central type exports for the PII Anonymiser application
 */

// File Metadata types
export type {
  FileMetadata,
  FileMetadataError,
  FileErrorCode,
} from './fileMetadata.js';
export { isFileMetadataError } from './fileMetadata.js';

// File Preview types
export type {
  FilePreview,
  FilePreviewError,
  PreviewOptions,
  PreviewFormatType,
} from './filePreview.js';
export { isFilePreviewError } from './filePreview.js';

// Batch Queue types
export type {
  BatchQueueItem,
  BatchFileStatus,
  BatchQueueState,
  BatchProgress,
} from './batchQueue.js';

// IPC types
export type { ElectronAPI, FileDialogOptions } from './ipc.js';

// PDF Table Detection types
export type {
  BoundingBox,
  Alignment,
  DetectionMethod,
  TableCell,
  TableRow,
  TableStructure,
  DetectionResult as PdfTableDetectionResult,
  PdfTextItem,
} from './pdfTable.js';

// PII Detection Pipeline types (Epic 1)
export type {
  EntitySource,
  EntityType,
  ValidationStatus,
  AddressComponentType,
  AddressComponent,
  Entity,
  ContextFactor,
  DetectionPass,
  PipelineContext,
  PassResult,
  DocumentType,
  PipelineConfig,
  DetectionResult as PiiDetectionResult,
  ValidationRule,
  ValidationResult,
  ContextRule,
  MappingEntry,
  MappingFile,
} from './detection.js';

// Feedback and Correction Logging types (Epic 5)
export type {
  CorrectionAction,
  CorrectionEntry,
  CorrectionLogFile,
  LogResult,
  LogCorrectionInput,
  FeedbackSettings,
} from './feedback.js';
export { DEFAULT_FEEDBACK_SETTINGS } from './feedback.js';

// Error handling types (Story 6.7)
export {
  ErrorCode,
  ALL_ERROR_CODES,
  isErrorCode,
  getErrorCategory,
  isError,
  isNodeError,
  ProcessingError,
  isProcessingError,
  getErrorMessage,
  getErrorCode,
  getErrorStack,
} from './errors.js';

// Error handler utilities (Story 6.7)
export type { ErrorContext, ErrorDisplay } from '../utils/errorHandler.js';
export {
  REDACTED_PATH,
  isDevelopment,
  sanitizeErrorMessage,
  sanitizeError,
  logError,
  getErrorI18nKey,
  toUserMessage,
  getDefaultErrorMessage,
  formatErrorForDisplay,
  createProcessingError,
  withErrorHandling,
} from '../utils/errorHandler.js';

// Re-export async timeout types (Story 6.5)
export type {
  ProcessingProgress,
  TimeoutConfig,
  TimeoutOptions,
  PartialResult,
} from '../utils/asyncTimeout.js';
export {
  DEFAULT_TIMEOUT_CONFIG,
  MIN_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  validateTimeout,
  withTimeout,
  calculateFileTimeout,
  createProcessingContext,
  createPartialResult,
  TimeoutError,
  AbortError,
  isTimeoutError,
  isAbortError,
  ProgressReporter,
} from '../utils/asyncTimeout.js';
