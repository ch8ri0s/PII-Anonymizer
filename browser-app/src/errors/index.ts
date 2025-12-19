/**
 * Error Handling Module Entry Point
 * Re-exports all error handling functionality
 */

// Types and classes
export {
  ErrorCode,
  ALL_ERROR_CODES,
  isErrorCode,
  getErrorCategory,
  isError,
  AppError,
  isAppError,
  getErrorMessage,
  getErrorCode,
  getErrorStack,
} from './types';

export type { ErrorContext, ErrorDisplay } from './errorHandler';

// Error handler functions
export {
  isDevelopment,
  logError,
  getErrorI18nKey,
  toUserMessage,
  getDefaultErrorMessage,
  formatErrorForDisplay,
  createAppError,
  withErrorHandling,
  createConversionError,
} from './errorHandler';
