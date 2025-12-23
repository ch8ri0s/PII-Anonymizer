/**
 * Error Handler Tests
 *
 * Tests for browser-based error handling utilities.
 * Covers error creation, formatting, and logging.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ErrorCode,
  isErrorCode,
  getErrorCategory,
  isError,
  AppError,
  isAppError,
  getErrorMessage,
  getErrorCode,
  getErrorStack,
  logError,
  toUserMessage,
  getDefaultErrorMessage,
  formatErrorForDisplay,
  createAppError,
  createConversionError,
  getErrorI18nKey,
} from '../../src/errors';

describe('Error Types', () => {
  describe('ErrorCode', () => {
    it('should have all expected error codes', () => {
      expect(ErrorCode.FILE_NOT_FOUND).toBe('FILE_NOT_FOUND');
      expect(ErrorCode.CONVERSION_FAILED).toBe('CONVERSION_FAILED');
      expect(ErrorCode.PII_DETECTION_FAILED).toBe('PII_DETECTION_FAILED');
      expect(ErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });
  });

  describe('isErrorCode()', () => {
    it('should return true for valid error codes', () => {
      expect(isErrorCode('FILE_NOT_FOUND')).toBe(true);
      expect(isErrorCode('UNKNOWN_ERROR')).toBe(true);
    });

    it('should return false for invalid error codes', () => {
      expect(isErrorCode('INVALID_CODE')).toBe(false);
      expect(isErrorCode('')).toBe(false);
      expect(isErrorCode(null)).toBe(false);
      expect(isErrorCode(123)).toBe(false);
    });
  });

  describe('getErrorCategory()', () => {
    it('should categorize file errors', () => {
      expect(getErrorCategory(ErrorCode.FILE_NOT_FOUND)).toBe('FILE');
      expect(getErrorCategory(ErrorCode.FILE_READ_ERROR)).toBe('FILE');
      expect(getErrorCategory(ErrorCode.FILE_TOO_LARGE)).toBe('FILE');
    });

    it('should categorize conversion errors', () => {
      expect(getErrorCategory(ErrorCode.CONVERSION_FAILED)).toBe('CONVERSION');
      expect(getErrorCategory(ErrorCode.PDF_PARSE_ERROR)).toBe('CONVERSION');
      expect(getErrorCategory(ErrorCode.DOCX_PARSE_ERROR)).toBe('CONVERSION');
    });

    it('should categorize PII errors', () => {
      expect(getErrorCategory(ErrorCode.PII_DETECTION_FAILED)).toBe('PII');
      expect(getErrorCategory(ErrorCode.MODEL_LOAD_ERROR)).toBe('PII');
    });

    it('should categorize system errors', () => {
      expect(getErrorCategory(ErrorCode.UNKNOWN_ERROR)).toBe('SYSTEM');
      expect(getErrorCategory(ErrorCode.TIMEOUT)).toBe('SYSTEM');
    });
  });

  describe('isError()', () => {
    it('should return true for Error instances', () => {
      expect(isError(new Error('test'))).toBe(true);
      expect(isError(new TypeError('test'))).toBe(true);
    });

    it('should return false for non-Error values', () => {
      expect(isError('error string')).toBe(false);
      expect(isError({ message: 'error' })).toBe(false);
      expect(isError(null)).toBe(false);
    });
  });

  describe('AppError', () => {
    it('should create error with code', () => {
      const error = new AppError('Test error', ErrorCode.FILE_NOT_FOUND);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(error.name).toBe('AppError');
    });

    it('should create error with context', () => {
      const error = new AppError('Test', ErrorCode.UNKNOWN_ERROR, { file: 'test.pdf' });

      expect(error.context).toEqual({ file: 'test.pdf' });
    });

    it('should default to UNKNOWN_ERROR code', () => {
      const error = new AppError('Test');

      expect(error.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('isAppError()', () => {
    it('should return true for AppError instances', () => {
      expect(isAppError(new AppError('test'))).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      expect(isAppError(new Error('test'))).toBe(false);
    });
  });
});

describe('Error Message Extraction', () => {
  describe('getErrorMessage()', () => {
    it('should extract message from Error', () => {
      expect(getErrorMessage(new Error('Test message'))).toBe('Test message');
    });

    it('should return string errors as-is', () => {
      expect(getErrorMessage('String error')).toBe('String error');
    });

    it('should extract message from object with message property', () => {
      expect(getErrorMessage({ message: 'Object error' })).toBe('Object error');
    });

    it('should return default for unknown errors', () => {
      expect(getErrorMessage(null)).toBe('An unknown error occurred');
      expect(getErrorMessage(undefined)).toBe('An unknown error occurred');
      expect(getErrorMessage({})).toBe('An unknown error occurred');
    });
  });

  describe('getErrorCode()', () => {
    it('should extract code from AppError', () => {
      const error = new AppError('test', ErrorCode.FILE_NOT_FOUND);
      expect(getErrorCode(error)).toBe(ErrorCode.FILE_NOT_FOUND);
    });

    it('should extract code from object with code property', () => {
      expect(getErrorCode({ code: ErrorCode.TIMEOUT })).toBe(ErrorCode.TIMEOUT);
    });

    it('should return undefined for errors without code', () => {
      expect(getErrorCode(new Error('test'))).toBeUndefined();
      expect(getErrorCode('string error')).toBeUndefined();
    });

    it('should return undefined for invalid codes', () => {
      expect(getErrorCode({ code: 'INVALID' })).toBeUndefined();
    });
  });

  describe('getErrorStack()', () => {
    it('should extract stack from Error', () => {
      const error = new Error('test');
      expect(getErrorStack(error)).toContain('Error: test');
    });

    it('should return undefined for non-Error', () => {
      expect(getErrorStack('string error')).toBeUndefined();
    });
  });
});

describe('Error Formatting', () => {
  describe('toUserMessage()', () => {
    it('should return i18n key and fallback for known error', () => {
      const error = new AppError('test', ErrorCode.FILE_NOT_FOUND);
      const result = toUserMessage(error);

      expect(result.i18nKey).toBe('errors.FILE_NOT_FOUND');
      expect(result.fallback).toBe('The file could not be found.');
    });

    it('should return unknown error for errors without code', () => {
      const result = toUserMessage(new Error('test'));

      expect(result.i18nKey).toBe('errors.UNKNOWN_ERROR');
      expect(result.fallback).toBe('An unexpected error occurred.');
    });
  });

  describe('getDefaultErrorMessage()', () => {
    it('should return default message for known code', () => {
      expect(getDefaultErrorMessage(ErrorCode.PDF_PARSE_ERROR)).toBe(
        'Unable to read the PDF file.',
      );
    });

    it('should return unknown error message for invalid code', () => {
      expect(getDefaultErrorMessage('INVALID')).toBe(
        'An unexpected error occurred.',
      );
    });
  });

  describe('getErrorI18nKey()', () => {
    it('should return correct i18n key', () => {
      expect(getErrorI18nKey(ErrorCode.CONVERSION_FAILED)).toBe(
        'errors.CONVERSION_FAILED',
      );
    });

    it('should return unknown error key for invalid code', () => {
      expect(getErrorI18nKey('INVALID')).toBe('errors.UNKNOWN_ERROR');
    });
  });

  describe('formatErrorForDisplay()', () => {
    it('should format error with message and code', () => {
      const error = new AppError('Test error', ErrorCode.FILE_NOT_FOUND);
      const result = formatErrorForDisplay(error);

      expect(result.message).toBe('Test error');
      expect(result.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(result.isDevelopment).toBeDefined();
    });

    it('should handle regular errors', () => {
      const result = formatErrorForDisplay(new Error('Regular error'));

      expect(result.message).toBe('Regular error');
      expect(result.code).toBeUndefined();
    });
  });
});

describe('Error Creation', () => {
  describe('createAppError()', () => {
    it('should create AppError with all parameters', () => {
      const error = createAppError('Test', ErrorCode.TIMEOUT, { attempt: 1 });

      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test');
      expect(error.code).toBe(ErrorCode.TIMEOUT);
      expect(error.context).toEqual({ attempt: 1 });
    });
  });

  describe('createConversionError()', () => {
    it('should create PDF error for PDF file type', () => {
      const error = createConversionError('PDF');

      expect(error.code).toBe(ErrorCode.PDF_PARSE_ERROR);
      expect(error.message).toContain('PDF');
    });

    it('should create DOCX error for Word file type', () => {
      const error = createConversionError('DOCX');

      expect(error.code).toBe(ErrorCode.DOCX_PARSE_ERROR);
    });

    it('should create Excel error for Excel file type', () => {
      const error = createConversionError('Excel');

      expect(error.code).toBe(ErrorCode.EXCEL_PARSE_ERROR);
    });

    it('should create CSV error for CSV file type', () => {
      const error = createConversionError('CSV');

      expect(error.code).toBe(ErrorCode.CSV_PARSE_ERROR);
    });

    it('should create generic conversion error for unknown type', () => {
      const error = createConversionError('Unknown');

      expect(error.code).toBe(ErrorCode.CONVERSION_FAILED);
    });

    it('should include original error message', () => {
      const original = new Error('Parse failed');
      const error = createConversionError('PDF', original);

      expect(error.message).toContain('Parse failed');
    });
  });
});

describe('Error Logging', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('logError()', () => {
    it('should log error with context', () => {
      const error = new AppError('Test', ErrorCode.FILE_NOT_FOUND);

      logError(error, { operation: 'readFile', fileType: 'pdf' });

      expect(consoleSpy).toHaveBeenCalled();
      const logArgs = consoleSpy.mock.calls[0];
      expect(logArgs[0]).toContain('FILE_NOT_FOUND');
      expect(logArgs[0]).toContain('readFile');
    });

    it('should handle regular errors', () => {
      logError(new Error('Regular'), { operation: 'test' });

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should include metadata in log', () => {
      logError(new Error('test'), {
        operation: 'process',
        metadata: { fileSize: 1024 },
      });

      expect(consoleSpy).toHaveBeenCalled();
      const logData = consoleSpy.mock.calls[0][1] as Record<string, unknown>;
      expect(logData.fileSize).toBe(1024);
    });
  });
});
