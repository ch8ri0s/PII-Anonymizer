/**
 * Error Type Definitions (Browser Version)
 * Type guards and error classes for safe error handling
 */

/**
 * Standardized error codes for the application
 * Organized by category: FILE, CONVERSION, PII, SYSTEM
 */
export enum ErrorCode {
  // FILE ERRORS
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',

  // CONVERSION ERRORS
  CONVERSION_FAILED = 'CONVERSION_FAILED',
  PDF_PARSE_ERROR = 'PDF_PARSE_ERROR',
  DOCX_PARSE_ERROR = 'DOCX_PARSE_ERROR',
  EXCEL_PARSE_ERROR = 'EXCEL_PARSE_ERROR',
  CSV_PARSE_ERROR = 'CSV_PARSE_ERROR',

  // PII ERRORS
  PII_DETECTION_FAILED = 'PII_DETECTION_FAILED',
  MODEL_LOAD_ERROR = 'MODEL_LOAD_ERROR',
  MODEL_DOWNLOAD_ERROR = 'MODEL_DOWNLOAD_ERROR',
  ANONYMIZATION_FAILED = 'ANONYMIZATION_FAILED',

  // SYSTEM ERRORS
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
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
 * @returns The category name: 'FILE', 'CONVERSION', 'PII', or 'SYSTEM'
 */
export function getErrorCategory(
  code: ErrorCode,
): 'FILE' | 'CONVERSION' | 'PII' | 'SYSTEM' {
  if (
    code === ErrorCode.FILE_NOT_FOUND ||
    code === ErrorCode.FILE_READ_ERROR ||
    code === ErrorCode.INVALID_FILE_TYPE ||
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
 * Custom application error with additional context
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.context = context;

    // Maintains proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

/**
 * Type guard to check if an error is an AppError
 * @param error - Unknown value caught in a catch block
 * @returns True if error is an AppError instance
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
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
export function getErrorCode(error: unknown): ErrorCode | undefined {
  if (isAppError(error)) {
    return error.code;
  }
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (isErrorCode(code)) {
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
