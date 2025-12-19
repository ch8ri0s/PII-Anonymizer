/**
 * Error type definitions and type guards for safe error handling
 * Story 6.4 - TypeScript Strict Mode Migration
 * Story 6.7 - Error Handling Standardization (ErrorCode enum)
 */

/**
 * Standardized error codes for the application
 * Organized by category: FILE, CONVERSION, PII, IPC, SYSTEM
 *
 * @description Each error code represents a specific error condition
 * that can occur during application operation. Use these codes for
 * consistent error handling and localized error messages.
 */
export enum ErrorCode {
  // ============================================
  // FILE ERRORS - File system and I/O operations
  // ============================================

  /**
   * The specified file could not be found at the given path.
   * @resolution Verify the file path is correct and the file exists.
   */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  /**
   * Failed to read the file contents.
   * @resolution Check file permissions and ensure the file is not locked.
   */
  FILE_READ_ERROR = 'FILE_READ_ERROR',

  /**
   * Failed to write to the file or directory.
   * @resolution Check write permissions and available disk space.
   */
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',

  /**
   * The file type is not supported for processing.
   * @resolution Use a supported format: PDF, DOCX, XLSX, CSV, TXT.
   */
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',

  /**
   * The file path is invalid or attempts directory traversal.
   * @resolution Use a valid file path within allowed directories.
   */
  INVALID_PATH = 'INVALID_PATH',

  /**
   * The file exceeds the maximum allowed size.
   * @resolution Use a smaller file or split into multiple files.
   */
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',

  // ============================================
  // CONVERSION ERRORS - Document conversion
  // ============================================

  /**
   * Document conversion to Markdown failed.
   * @resolution Try a different file format or check file integrity.
   */
  CONVERSION_FAILED = 'CONVERSION_FAILED',

  /**
   * Failed to parse PDF document.
   * @resolution Ensure the PDF is not corrupted or password-protected.
   */
  PDF_PARSE_ERROR = 'PDF_PARSE_ERROR',

  /**
   * Failed to parse Word document.
   * @resolution Ensure the DOCX file is valid and not corrupted.
   */
  DOCX_PARSE_ERROR = 'DOCX_PARSE_ERROR',

  /**
   * Failed to parse Excel spreadsheet.
   * @resolution Ensure the Excel file is valid and not corrupted.
   */
  EXCEL_PARSE_ERROR = 'EXCEL_PARSE_ERROR',

  /**
   * Failed to parse CSV file.
   * @resolution Check CSV formatting and encoding.
   */
  CSV_PARSE_ERROR = 'CSV_PARSE_ERROR',

  // ============================================
  // PII ERRORS - PII detection and anonymization
  // ============================================

  /**
   * PII detection process failed.
   * @resolution Check model availability and try again.
   */
  PII_DETECTION_FAILED = 'PII_DETECTION_FAILED',

  /**
   * Failed to load the ML model for PII detection.
   * @resolution Ensure model files are downloaded and accessible.
   */
  MODEL_LOAD_ERROR = 'MODEL_LOAD_ERROR',

  /**
   * Failed to download the ML model.
   * @resolution Check internet connection and try again.
   */
  MODEL_DOWNLOAD_ERROR = 'MODEL_DOWNLOAD_ERROR',

  /**
   * Anonymization of detected PII failed.
   * @resolution Try processing the file again.
   */
  ANONYMIZATION_FAILED = 'ANONYMIZATION_FAILED',

  // ============================================
  // IPC ERRORS - Inter-process communication
  // ============================================

  /**
   * IPC input validation failed.
   * @resolution Ensure input parameters are valid.
   */
  IPC_VALIDATION_FAILED = 'IPC_VALIDATION_FAILED',

  /**
   * IPC operation timed out.
   * @resolution Try the operation again or use a smaller file.
   */
  IPC_TIMEOUT = 'IPC_TIMEOUT',

  /**
   * IPC channel not available or closed.
   * @resolution Restart the application.
   */
  IPC_CHANNEL_ERROR = 'IPC_CHANNEL_ERROR',

  // ============================================
  // SYSTEM ERRORS - General system errors
  // ============================================

  /**
   * An unexpected error occurred.
   * @resolution Try the operation again or restart the application.
   */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',

  /**
   * Operation was cancelled by the user.
   * @resolution No action needed - user initiated cancellation.
   */
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',

  /**
   * Operation timed out.
   * @resolution Try again with a smaller file or increase timeout.
   */
  TIMEOUT = 'TIMEOUT',

  /**
   * Not enough memory to complete the operation.
   * @resolution Close other applications and try again.
   */
  OUT_OF_MEMORY = 'OUT_OF_MEMORY',
}

/**
 * Array of all valid error codes for validation
 */
export const ALL_ERROR_CODES = Object.values(ErrorCode);

/**
 * Type guard to check if a string is a valid ErrorCode
 * @param code - String to check
 * @returns True if code is a valid ErrorCode
 */
export function isErrorCode(code: unknown): code is ErrorCode {
  return typeof code === 'string' && ALL_ERROR_CODES.includes(code as ErrorCode);
}

/**
 * Get the error category from an ErrorCode
 * @param code - The error code to categorize
 * @returns The category name: 'FILE', 'CONVERSION', 'PII', 'IPC', or 'SYSTEM'
 */
export function getErrorCategory(
  code: ErrorCode,
): 'FILE' | 'CONVERSION' | 'PII' | 'IPC' | 'SYSTEM' {
  if (
    code === ErrorCode.FILE_NOT_FOUND ||
    code === ErrorCode.FILE_READ_ERROR ||
    code === ErrorCode.FILE_WRITE_ERROR ||
    code === ErrorCode.INVALID_FILE_TYPE ||
    code === ErrorCode.INVALID_PATH ||
    code === ErrorCode.FILE_TOO_LARGE
  ) {
    return 'FILE';
  }
  if (
    code === ErrorCode.CONVERSION_FAILED ||
    code === ErrorCode.PDF_PARSE_ERROR ||
    code === ErrorCode.DOCX_PARSE_ERROR ||
    code === ErrorCode.EXCEL_PARSE_ERROR ||
    code === ErrorCode.CSV_PARSE_ERROR
  ) {
    return 'CONVERSION';
  }
  if (
    code === ErrorCode.PII_DETECTION_FAILED ||
    code === ErrorCode.MODEL_LOAD_ERROR ||
    code === ErrorCode.MODEL_DOWNLOAD_ERROR ||
    code === ErrorCode.ANONYMIZATION_FAILED
  ) {
    return 'PII';
  }
  if (
    code === ErrorCode.IPC_VALIDATION_FAILED ||
    code === ErrorCode.IPC_TIMEOUT ||
    code === ErrorCode.IPC_CHANNEL_ERROR
  ) {
    return 'IPC';
  }
  return 'SYSTEM';
}

/**
 * Type guard to check if an unknown error is an Error instance
 * @param error - Unknown value caught in a catch block
 * @returns True if error is an Error instance
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Node.js error with code property
 */
interface ErrorWithCode extends Error {
  code: string;
}

/**
 * Type guard to check if an error has a specific error code
 * @param error - Unknown value caught in a catch block
 * @returns True if error is an Error with a code property
 */
export function isNodeError(error: unknown): error is ErrorWithCode {
  return isError(error) && 'code' in error;
}

/**
 * Custom processing error with additional context
 */
export class ProcessingError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code = 'PROCESSING_ERROR',
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ProcessingError';
    this.code = code;
    this.context = context;

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProcessingError);
    }
  }
}

/**
 * Type guard to check if an error is a ProcessingError
 * @param error - Unknown value caught in a catch block
 * @returns True if error is a ProcessingError instance
 */
export function isProcessingError(error: unknown): error is ProcessingError {
  return error instanceof ProcessingError;
}

/**
 * Safely extract an error message from an unknown error value
 * @param error - Unknown value caught in a catch block
 * @returns A string error message
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error !== null && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  return 'An unknown error occurred';
}

/**
 * Safely extract an error code from an unknown error value
 * @param error - Unknown value caught in a catch block
 * @returns A string error code or undefined
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isProcessingError(error) || isNodeError(error)) {
    return error.code;
  }
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') {
      return code;
    }
  }
  return undefined;
}

/**
 * Safely extract an error stack trace from an unknown error value
 * @param error - Unknown value caught in a catch block
 * @returns The stack trace string or undefined
 */
export function getErrorStack(error: unknown): string | undefined {
  if (isError(error)) {
    return error.stack;
  }
  return undefined;
}
