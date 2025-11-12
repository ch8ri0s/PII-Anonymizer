/**
 * Central type exports for the PII Anonymiser application
 */

// File Metadata types
export type {
  FileMetadata,
  FileMetadataError,
  FileErrorCode,
} from './fileMetadata';
export { isFileMetadataError } from './fileMetadata';

// File Preview types
export type {
  FilePreview,
  FilePreviewError,
  PreviewOptions,
  PreviewFormatType,
} from './filePreview';
export { isFilePreviewError } from './filePreview';

// Batch Queue types
export type {
  BatchQueueItem,
  BatchFileStatus,
  BatchQueueState,
  BatchProgress,
} from './batchQueue';

// IPC types
export type { ElectronAPI, FileDialogOptions } from './ipc';
