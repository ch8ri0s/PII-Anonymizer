/**
 * Centralized Error Handler Utility
 * Story 6.7 - Error Handling Standardization
 *
 * Provides consistent error handling across the codebase:
 * - Path sanitization to prevent information leakage
 * - Structured error logging via LoggerFactory
 * - Environment-aware error formatting
 * - Localized user-facing error messages
 */

import { LoggerFactory, type Logger } from './LoggerFactory.js';
import {
  ErrorCode,
  isErrorCode,
  getErrorMessage,
  getErrorCode,
  getErrorStack,
  isError,
} from '../types/errors.js';

// Create a logger for this module
const log: Logger = LoggerFactory.create('errorHandler');

/**
 * Regex patterns for path sanitization
 * Matches common filesystem paths on Unix and Windows
 */
const PATH_PATTERNS = {
  // Unix absolute paths: /Users/..., /home/..., /var/..., /tmp/...
  unix: /(?:\/(?:Users|home|var|tmp|opt|usr|etc|private)\/[\w./-]+)/g,
  // Windows paths: C:\Users\..., D:\Documents\...
  windows: /[A-Z]:\\(?:Users|Documents|Program Files|[\w.-]+)(?:\\[\w.-]+)*/gi,
  // Generic Unix paths starting with /
  genericUnix: /\/[\w./+-]+/g,
};

/**
 * Placeholder for redacted paths
 */
export const REDACTED_PATH = '[REDACTED_PATH]';

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
  code?: string;
  /** Stack trace (only in development) */
  stack?: string;
  /** Whether this is a development build */
  isDevelopment: boolean;
}

/**
 * i18n key mapping for error codes
 */
const ERROR_CODE_TO_I18N_KEY: Record<ErrorCode, string> = {
  // File errors
  [ErrorCode.FILE_NOT_FOUND]: 'errors.FILE_NOT_FOUND',
  [ErrorCode.FILE_READ_ERROR]: 'errors.FILE_READ_ERROR',
  [ErrorCode.FILE_WRITE_ERROR]: 'errors.FILE_WRITE_ERROR',
  [ErrorCode.INVALID_FILE_TYPE]: 'errors.INVALID_FILE_TYPE',
  [ErrorCode.INVALID_PATH]: 'errors.INVALID_PATH',
  [ErrorCode.FILE_TOO_LARGE]: 'errors.FILE_TOO_LARGE',
  // Conversion errors
  [ErrorCode.CONVERSION_FAILED]: 'errors.CONVERSION_FAILED',
  [ErrorCode.PDF_PARSE_ERROR]: 'errors.PDF_PARSE_ERROR',
  [ErrorCode.DOCX_PARSE_ERROR]: 'errors.DOCX_PARSE_ERROR',
  [ErrorCode.EXCEL_PARSE_ERROR]: 'errors.EXCEL_PARSE_ERROR',
  [ErrorCode.CSV_PARSE_ERROR]: 'errors.CSV_PARSE_ERROR',
  // PII errors
  [ErrorCode.PII_DETECTION_FAILED]: 'errors.PII_DETECTION_FAILED',
  [ErrorCode.MODEL_LOAD_ERROR]: 'errors.MODEL_LOAD_ERROR',
  [ErrorCode.MODEL_DOWNLOAD_ERROR]: 'errors.MODEL_DOWNLOAD_ERROR',
  [ErrorCode.ANONYMIZATION_FAILED]: 'errors.ANONYMIZATION_FAILED',
  // IPC errors
  [ErrorCode.IPC_VALIDATION_FAILED]: 'errors.IPC_VALIDATION_FAILED',
  [ErrorCode.IPC_TIMEOUT]: 'errors.IPC_TIMEOUT',
  [ErrorCode.IPC_CHANNEL_ERROR]: 'errors.IPC_CHANNEL_ERROR',
  // System errors
  [ErrorCode.UNKNOWN_ERROR]: 'errors.UNKNOWN_ERROR',
  [ErrorCode.OPERATION_CANCELLED]: 'errors.OPERATION_CANCELLED',
  [ErrorCode.TIMEOUT]: 'errors.TIMEOUT',
  [ErrorCode.OUT_OF_MEMORY]: 'errors.OUT_OF_MEMORY',
};

/**
 * Default error messages (fallback when i18n not available)
 */
const DEFAULT_ERROR_MESSAGES: Record<ErrorCode, string> = {
  // File errors
  [ErrorCode.FILE_NOT_FOUND]: 'The file could not be found.',
  [ErrorCode.FILE_READ_ERROR]: 'Unable to read the file. Please check permissions.',
  [ErrorCode.FILE_WRITE_ERROR]: 'Unable to write to the file. Please check permissions.',
  [ErrorCode.INVALID_FILE_TYPE]: 'This file type is not supported.',
  [ErrorCode.INVALID_PATH]: 'The file path is invalid.',
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
  // IPC errors
  [ErrorCode.IPC_VALIDATION_FAILED]: 'Invalid request parameters.',
  [ErrorCode.IPC_TIMEOUT]: 'The operation timed out. Please try again.',
  [ErrorCode.IPC_CHANNEL_ERROR]: 'Communication error. Please restart the application.',
  // System errors
  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred.',
  [ErrorCode.OPERATION_CANCELLED]: 'Operation was cancelled.',
  [ErrorCode.TIMEOUT]: 'The operation timed out.',
  [ErrorCode.OUT_OF_MEMORY]: 'Not enough memory. Please close other applications.',
};

/**
 * Check if the application is running in development mode
 * @returns True if NODE_ENV is 'development' or not set
 */
export function isDevelopment(): boolean {
  // Check Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV !== 'production';
  }
  // Default to development mode if we can't determine
  return true;
}

/**
 * Sanitize an error message by redacting sensitive filesystem paths
 *
 * @param message - The error message to sanitize
 * @returns The sanitized message with paths replaced by [REDACTED_PATH]
 *
 * @example
 * sanitizeErrorMessage('Failed to read /Users/john/Documents/secret.pdf')
 * // Returns: 'Failed to read [REDACTED_PATH]'
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    return message;
  }

  let sanitized = message;

  // Apply path patterns in order of specificity
  sanitized = sanitized.replace(PATH_PATTERNS.unix, REDACTED_PATH);
  sanitized = sanitized.replace(PATH_PATTERNS.windows, REDACTED_PATH);

  // Clean up multiple consecutive redactions
  sanitized = sanitized.replace(/(\[REDACTED_PATH\]\s*)+/g, REDACTED_PATH + ' ');

  return sanitized.trim();
}

/**
 * Sanitize an error by extracting and redacting its message
 *
 * @param error - The error to sanitize (unknown type for catch blocks)
 * @returns A sanitized error message string
 *
 * @example
 * try {
 *   // ... code that throws
 * } catch (error) {
 *   const safeMessage = sanitizeError(error);
 *   console.log(safeMessage); // No paths exposed
 * }
 */
export function sanitizeError(error: unknown): string {
  const message = getErrorMessage(error);
  return sanitizeErrorMessage(message);
}

/**
 * Log an error with consistent format and context
 *
 * @param error - The error to log (unknown type for catch blocks)
 * @param context - Additional context about the operation
 *
 * @example
 * try {
 *   await processFile(path);
 * } catch (error) {
 *   logError(error, {
 *     operation: 'processFile',
 *     fileType: 'pdf',
 *     metadata: { path: sanitizeErrorMessage(path) }
 *   });
 * }
 */
export function logError(error: unknown, context: ErrorContext): void {
  const sanitizedMessage = sanitizeError(error);
  const errorCode = getErrorCode(error) ?? ErrorCode.UNKNOWN_ERROR;
  const stack = isDevelopment() ? getErrorStack(error) : undefined;

  log.error(sanitizedMessage, {
    code: errorCode,
    operation: context.operation,
    fileType: context.fileType,
    ...context.metadata,
    // Only include stack in development
    ...(stack && { stack: sanitizeErrorMessage(stack) }),
  });
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
 * This function returns an i18n key that should be resolved by the UI layer.
 * If the error has a known error code, returns the corresponding i18n key.
 * Otherwise returns a generic error key.
 *
 * @param error - The error to convert (unknown type for catch blocks)
 * @returns An object with the i18n key and fallback message
 *
 * @example
 * const { i18nKey, fallback } = toUserMessage(error);
 * const message = i18n.t(i18nKey) || fallback;
 */
export function toUserMessage(error: unknown): { i18nKey: string; fallback: string } {
  const code = getErrorCode(error);

  if (code && isErrorCode(code)) {
    return {
      i18nKey: ERROR_CODE_TO_I18N_KEY[code],
      fallback: DEFAULT_ERROR_MESSAGES[code],
    };
  }

  // For unknown errors, use a generic message
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
 * In development mode, includes stack trace and full error details.
 * In production mode, only includes sanitized message and code.
 *
 * @param error - The error to format (unknown type for catch blocks)
 * @returns Formatted error information appropriate for the environment
 *
 * @example
 * const display = formatErrorForDisplay(error);
 * if (display.isDevelopment) {
 *   console.error(display.stack); // Show stack in DevTools
 * }
 * showErrorDialog(display.message);
 */
export function formatErrorForDisplay(error: unknown): ErrorDisplay {
  const dev = isDevelopment();
  const sanitizedMessage = sanitizeError(error);
  const code = getErrorCode(error);

  return {
    message: sanitizedMessage,
    code: code ?? undefined,
    stack: dev ? getErrorStack(error) : undefined,
    isDevelopment: dev,
  };
}

/**
 * Create a ProcessingError with proper sanitization
 *
 * @param message - The error message (will be sanitized)
 * @param code - The error code
 * @param context - Additional error context
 * @returns A new ProcessingError instance
 */
export function createProcessingError(
  message: string,
  code: ErrorCode = ErrorCode.UNKNOWN_ERROR,
  context?: Record<string, unknown>,
): Error {
  // Import ProcessingError dynamically to avoid circular dependency
  // Using a plain Error with code property instead
  const error = new Error(sanitizeErrorMessage(message));
  (error as Error & { code: string }).code = code;
  if (context) {
    (error as Error & { context: Record<string, unknown> }).context = context;
  }
  return error;
}

/**
 * Wrap an async function with standardized error handling
 *
 * @param fn - The async function to wrap
 * @param context - Error context for logging
 * @returns A wrapped function that logs and sanitizes errors
 *
 * @example
 * const safeProcess = withErrorHandling(processFile, {
 *   operation: 'processFile',
 *   fileType: 'pdf'
 * });
 * const result = await safeProcess(filePath);
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
      // Re-throw with sanitized message
      if (isError(error)) {
        const sanitizedError = new Error(sanitizeError(error));
        sanitizedError.name = error.name;
        const code = getErrorCode(error);
        if (code) {
          (sanitizedError as Error & { code: string }).code = code;
        }
        throw sanitizedError;
      }
      throw new Error(sanitizeError(error));
    }
  };
}
