/**
 * Download Module Exports
 *
 * Story 7.5: File Download & Batch Processing
 */

// FileDownloader exports
export {
  downloadAnonymizedFile,
  downloadMappingFile,
  downloadAnonymizedWithMapping,
  createAnonymizedFilename,
  createMappingFilename,
  getBaseFilename,
  generateTimestampedFilename,
  prepareDownloadResult,
  createFailedDownloadResult,
  type DownloadResult,
  type MappingFileContent,
} from './FileDownloader';

// ZipDownloader exports
export {
  createBatchZip,
  createBatchZipFromItems,
  downloadBatchZip,
  downloadBatchZipFromItems,
  getZipSize,
  countZipFiles,
  type BatchResult,
  type ZipOptions,
} from './ZipDownloader';

// Re-export base utilities from utils
export { downloadFile, downloadZip, formatFileSize } from '../utils/download';
