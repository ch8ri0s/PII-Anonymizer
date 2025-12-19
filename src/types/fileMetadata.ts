/**
 * File Metadata Interface
 *
 * Represents comprehensive metadata for a file including file system stats
 * and text content statistics.
 */
export interface FileMetadata {
  /** Base filename without path (e.g., "report.docx") */
  filename: string;

  /** Absolute file path */
  filePath: string;

  /** File size in bytes */
  fileSize: number;

  /** Human-readable file size (e.g., "512 KB", "1.2 MB") */
  fileSizeFormatted: string;

  /** Last modified date (serialized as ISO 8601 string for IPC) */
  lastModified: string;

  /** Human-readable last modified date (e.g., "November 9, 2025") */
  lastModifiedFormatted: string;

  /** Total number of lines in the extracted text content */
  lineCount: number;

  /** Total number of words in the extracted text content */
  wordCount: number;

  /** Total number of characters in the extracted text content */
  charCount: number;

  /** File extension including the dot (e.g., ".docx", ".pdf") */
  extension: string;

  /** MIME type of the file (optional) */
  mimeType?: string;
}

/**
 * Error response for file metadata operations
 */
export interface FileMetadataError {
  /** User-friendly error message */
  error: string;

  /** Error code for programmatic handling */
  code: FileErrorCode;

  /** Filename if extractable */
  filename?: string;
}

/**
 * File operation error codes
 */
export type FileErrorCode =
  | 'FILE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED_TYPE'
  | 'FILE_TOO_LARGE'
  | 'CORRUPTED_FILE'
  | 'READ_ERROR'
  | 'INVALID_PATH'
  | 'UNKNOWN_ERROR';

/**
 * Type guard to check if result is an error
 */
export function isFileMetadataError(
  result: FileMetadata | FileMetadataError,
): result is FileMetadataError {
  return 'error' in result;
}
