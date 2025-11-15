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
