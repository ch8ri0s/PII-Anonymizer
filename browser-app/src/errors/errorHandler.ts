/**
 * Centralized Error Handler (Browser Version)
 * Provides consistent error handling across the browser application
 */

import {
  ErrorCode,
  isErrorCode,
  getErrorMessage,
  getErrorCode,
  getErrorStack,
  AppError,
} from './types';

/**
 * Context information for error logging
 */
export interface ErrorContext {
  /** The operation being performed when the error occurred */
  operation: string;
  /** File type being processed (optional) */
  fileType?: string;
  /** Additional metadata for debugging */
  metadata?: Record<string, unknown>;
}

/**
 * Formatted error information for display
 */
export interface ErrorDisplay {
  /** User-friendly error message */
  message: string;
  /** Error code if available */
  code?: ErrorCode;
  /** Stack trace (only in development) */
  stack?: string;
  /** Whether this is a development build */
  isDevelopment: boolean;
}

/**
 * Default error messages (fallback when i18n not available)
 */
const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
  // File errors
  [ErrorCode.FILE_NOT_FOUND]: 'The file could not be found.',
  [ErrorCode.FILE_READ_ERROR]: 'Unable to read the file.',
  [ErrorCode.INVALID_FILE_TYPE]: 'This file type is not supported.',
  [ErrorCode.FILE_TOO_LARGE]: 'The file is too large to process.',
  // Conversion errors
  [ErrorCode.CONVERSION_FAILED]: 'File conversion failed. Try a different format.',
  [ErrorCode.PDF_PARSE_ERROR]: 'Unable to read the PDF file.',
  [ErrorCode.DOCX_PARSE_ERROR]: 'Unable to read the Word document.',
  [ErrorCode.EXCEL_PARSE_ERROR]: 'Unable to read the Excel file.',
  [ErrorCode.CSV_PARSE_ERROR]: 'Unable to read the CSV file.',
  // PII errors
  [ErrorCode.PII_DETECTION_FAILED]: 'PII detection failed. Please try again.',
  [ErrorCode.MODEL_LOAD_ERROR]: 'Failed to load the detection model.',
  [ErrorCode.MODEL_DOWNLOAD_ERROR]: 'Model download failed. Check your internet connection.',
  [ErrorCode.ANONYMIZATION_FAILED]: 'Anonymization failed. Please try again.',
  // System errors
  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred.',
  [ErrorCode.OPERATION_CANCELLED]: 'Operation was cancelled.',
  [ErrorCode.TIMEOUT]: 'The operation timed out.',
  [ErrorCode.NETWORK_ERROR]: 'Network error. Please check your connection.',
};

/**
 * i18n key mapping for error codes
 */
const ERROR_CODE_TO_I18N_KEY: Record<ErrorCode, string> = {
  [ErrorCode.FILE_NOT_FOUND]: 'errors.FILE_NOT_FOUND',
  [ErrorCode.FILE_READ_ERROR]: 'errors.FILE_READ_ERROR',
  [ErrorCode.INVALID_FILE_TYPE]: 'errors.INVALID_FILE_TYPE',
  [ErrorCode.FILE_TOO_LARGE]: 'errors.FILE_TOO_LARGE',
  [ErrorCode.CONVERSION_FAILED]: 'errors.CONVERSION_FAILED',
  [ErrorCode.PDF_PARSE_ERROR]: 'errors.PDF_PARSE_ERROR',
  [ErrorCode.DOCX_PARSE_ERROR]: 'errors.DOCX_PARSE_ERROR',
  [ErrorCode.EXCEL_PARSE_ERROR]: 'errors.EXCEL_PARSE_ERROR',
  [ErrorCode.CSV_PARSE_ERROR]: 'errors.CSV_PARSE_ERROR',
  [ErrorCode.PII_DETECTION_FAILED]: 'errors.PII_DETECTION_FAILED',
  [ErrorCode.MODEL_LOAD_ERROR]: 'errors.MODEL_LOAD_ERROR',
  [ErrorCode.MODEL_DOWNLOAD_ERROR]: 'errors.MODEL_DOWNLOAD_ERROR',
  [ErrorCode.ANONYMIZATION_FAILED]: 'errors.ANONYMIZATION_FAILED',
  [ErrorCode.UNKNOWN_ERROR]: 'errors.UNKNOWN_ERROR',
  [ErrorCode.OPERATION_CANCELLED]: 'errors.OPERATION_CANCELLED',
  [ErrorCode.TIMEOUT]: 'errors.TIMEOUT',
  [ErrorCode.NETWORK_ERROR]: 'errors.NETWORK_ERROR',
};

/**
 * Check if the application is running in development mode
 * @returns True if in development mode
 */
export function isDevelopment(): boolean {
  // Check for Vite's import.meta.env (cast to avoid TS errors in non-Vite builds)
  const meta = import.meta as { env?: { DEV?: boolean } };
  if (meta.env && typeof meta.env.DEV === 'boolean') {
    return meta.env.DEV;
  }
  // Fallback: check location for localhost
  if (typeof window !== 'undefined' && window.location) {
    return (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
  }
  return true;
}

/**
 * Log an error with consistent format and context
 *
 * @param error - The error to log (unknown type for catch blocks)
 * @param context - Additional context about the operation
 */
export function logError(error: unknown, context: ErrorContext): void {
  const message = getErrorMessage(error);
  const errorCode = getErrorCode(error) ?? ErrorCode.UNKNOWN_ERROR;
  const stack = isDevelopment() ? getErrorStack(error) : undefined;

  const logData = {
    code: errorCode,
    operation: context.operation,
    fileType: context.fileType,
    ...context.metadata,
    ...(stack && { stack }),
  };

  console.error(`[${errorCode}] ${context.operation}: ${message}`, logData);
}

/**
 * Get the i18n key for an error code
 *
 * @param code - The error code
 * @returns The i18n key for translation lookup
 */
export function getErrorI18nKey(code: ErrorCode | string): string {
  if (isErrorCode(code)) {
    return ERROR_CODE_TO_I18N_KEY[code];
  }
  return ERROR_CODE_TO_I18N_KEY[ErrorCode.UNKNOWN_ERROR];
}

/**
 * Convert an error to a user-friendly message
 *
 * @param error - The error to convert (unknown type for catch blocks)
 * @returns An object with the i18n key and fallback message
 */
export function toUserMessage(error: unknown): { i18nKey: string; fallback: string } {
  const code = getErrorCode(error);

  if (code && isErrorCode(code)) {
    return {
      i18nKey: ERROR_CODE_TO_I18N_KEY[code],
      fallback: DEFAULT_ERROR_MESSAGES[code],
    };
  }

  return {
    i18nKey: ERROR_CODE_TO_I18N_KEY[ErrorCode.UNKNOWN_ERROR],
    fallback: DEFAULT_ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR],
  };
}

/**
 * Get the default (fallback) error message for a code
 *
 * @param code - The error code
 * @returns The default English error message
 */
export function getDefaultErrorMessage(code: ErrorCode | string): string {
  if (isErrorCode(code)) {
    return DEFAULT_ERROR_MESSAGES[code];
  }
  return DEFAULT_ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
}

/**
 * Format an error for display in the UI
 *
 * @param error - The error to format (unknown type for catch blocks)
 * @returns Formatted error information appropriate for the environment
 */
export function formatErrorForDisplay(error: unknown): ErrorDisplay {
  const dev = isDevelopment();
  const message = getErrorMessage(error);
  const code = getErrorCode(error);

  return {
    message,
    code: code ?? undefined,
    stack: dev ? getErrorStack(error) : undefined,
    isDevelopment: dev,
  };
}

/**
 * Create an AppError with proper typing
 *
 * @param message - The error message
 * @param code - The error code
 * @param context - Additional error context
 * @returns A new AppError instance
 */
export function createAppError(
  message: string,
  code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
  context?: Record<string, unknown>,
): AppError {
  return new AppError(message, code, context);
}

/**
 * Wrap an async function with standardized error handling
 *
 * @param fn - The async function to wrap
 * @param context - Error context for logging
 * @returns A wrapped function that logs and re-throws errors
 */
export function withErrorHandling<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context: ErrorContext,
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error: unknown) {
      logError(error, context);
      throw error;
    }
  };
}

/**
 * Create an error from a file conversion failure
 *
 * @param fileType - The type of file that failed to convert
 * @param originalError - The original error that occurred
 * @returns An AppError with appropriate code
 */
export function createConversionError(
  fileType: string,
  originalError?: unknown,
): AppError {
  const lowerType = fileType.toLowerCase();

  let code: ErrorCode;
  if (lowerType.includes('pdf')) {
    code = ErrorCode.PDF_PARSE_ERROR;
  } else if (lowerType.includes('doc')) {
    code = ErrorCode.DOCX_PARSE_ERROR;
  } else if (lowerType.includes('xls') || lowerType.includes('excel')) {
    code = ErrorCode.EXCEL_PARSE_ERROR;
  } else if (lowerType.includes('csv')) {
    code = ErrorCode.CSV_PARSE_ERROR;
  } else {
    code = ErrorCode.CONVERSION_FAILED;
  }

  const originalMessage = originalError ? getErrorMessage(originalError) : '';
  const message = `Failed to convert ${fileType} file${originalMessage ? `: ${originalMessage}` : ''}`;

  return new AppError(message, code, { fileType, originalError });
}
