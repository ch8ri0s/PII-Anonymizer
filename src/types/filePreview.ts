/**
 * File Preview Interface
 *
 * Represents a truncated preview of file content with metadata about truncation.
 */
export interface FilePreview {
  /** Preview text content (first N lines or M characters) */
  content: string;

  /** Whether the preview was truncated (more content exists) */
  isTruncated: boolean;

  /** Actual number of lines in the preview */
  previewLineCount: number;

  /** Actual number of characters in the preview */
  previewCharCount: number;

  /** Format type of the preview content */
  formatType: PreviewFormatType;

  /** Error message if preview generation failed */
  error?: string;
}

/**
 * Preview format types
 */
export type PreviewFormatType = 'text' | 'structured' | 'error';

/**
 * Preview generation options
 */
export interface PreviewOptions {
  /** Maximum number of lines to include (default: 20) */
  lines: number;

  /** Maximum number of characters to include (default: 1000) */
  chars: number;
}

/**
 * Error response for file preview operations
 */
export interface FilePreviewError {
  /** User-friendly error message */
  error: string;

  /** Error code for programmatic handling */
  code: string;

  /** Filename if extractable */
  filename?: string;
}

/**
 * Type guard to check if result is an error
 */
export function isFilePreviewError(
  result: FilePreview | FilePreviewError,
): result is FilePreviewError {
  return 'error' in result && !('content' in result);
}
