/**
 * Unit tests for error handler utility
 * Story 6.7 - Error Handling Standardization
 */

import { expect } from 'chai';

// Import the functions we're testing
import {
  sanitizeErrorMessage,
  sanitizeError,
  isDevelopment,
  formatErrorForDisplay,
  toUserMessage,
  getErrorI18nKey,
  getDefaultErrorMessage,
  REDACTED_PATH,
} from '../../dist/utils/errorHandler.js';

import {
  ErrorCode,
  ALL_ERROR_CODES,
  isErrorCode,
  getErrorCategory,
  ProcessingError,
  isProcessingError,
  getErrorMessage,
  getErrorCode,
} from '../../dist/types/errors.js';

describe('Error Handler Utility', function () {
  describe('sanitizeErrorMessage', function () {
    it('should redact Unix absolute paths', function () {
      const message = 'Failed to read /Users/john/Documents/secret.pdf';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).to.equal(`Failed to read ${REDACTED_PATH}`);
      expect(sanitized).to.not.include('/Users/');
    });

    it('should redact /home paths', function () {
      const message = 'Error at /home/user/project/file.txt';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).to.include(REDACTED_PATH);
      expect(sanitized).to.not.include('/home/');
    });

    it('should redact /var paths', function () {
      const message = 'Cannot write to /var/log/app.log';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).to.include(REDACTED_PATH);
      expect(sanitized).to.not.include('/var/');
    });

    it('should redact /tmp paths', function () {
      const message = 'Temp file at /tmp/upload-123.pdf failed';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).to.include(REDACTED_PATH);
      expect(sanitized).to.not.include('/tmp/');
    });

    it('should redact Windows paths', function () {
      const message = 'Failed to read C:\\Users\\John\\Documents\\file.docx';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).to.include(REDACTED_PATH);
      expect(sanitized).to.not.include('C:\\Users\\');
    });

    it('should redact Windows paths with different drives', function () {
      const message = 'Error at D:\\Documents\\Work\\report.xlsx';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).to.include(REDACTED_PATH);
      expect(sanitized).to.not.include('D:\\');
    });

    it('should preserve non-path content', function () {
      const message = 'Invalid JSON format in configuration';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).to.equal('Invalid JSON format in configuration');
    });

    it('should handle messages with multiple paths', function () {
      const message =
        'Cannot copy from /Users/src/file.txt to /Users/dest/file.txt';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).to.not.include('/Users/');
      // Should contain redacted paths
      expect(sanitized).to.include(REDACTED_PATH);
    });

    it('should handle empty strings', function () {
      expect(sanitizeErrorMessage('')).to.equal('');
    });

    it('should handle null/undefined gracefully', function () {
      expect(sanitizeErrorMessage(null)).to.equal(null);
      expect(sanitizeErrorMessage(undefined)).to.equal(undefined);
    });

    it('should preserve error codes and technical details', function () {
      const message = 'ENOENT: no such file or directory at /Users/test/missing.txt';
      const sanitized = sanitizeErrorMessage(message);
      expect(sanitized).to.include('ENOENT');
      expect(sanitized).to.include('no such file or directory');
      expect(sanitized).to.not.include('/Users/');
    });
  });

  describe('sanitizeError', function () {
    it('should sanitize Error objects', function () {
      const error = new Error('Failed to read /Users/john/file.pdf');
      const sanitized = sanitizeError(error);
      expect(sanitized).to.include(REDACTED_PATH);
      expect(sanitized).to.not.include('/Users/');
    });

    it('should sanitize string errors', function () {
      const error = 'Error at /home/user/file.txt';
      const sanitized = sanitizeError(error);
      expect(sanitized).to.include(REDACTED_PATH);
    });

    it('should handle ProcessingError objects', function () {
      const error = new ProcessingError(
        'File not found at /Users/test/doc.pdf',
        'FILE_NOT_FOUND',
      );
      const sanitized = sanitizeError(error);
      expect(sanitized).to.include(REDACTED_PATH);
      expect(sanitized).to.not.include('/Users/');
    });

    it('should handle unknown error types', function () {
      const error = { message: 'Some error with /tmp/path' };
      const sanitized = sanitizeError(error);
      expect(sanitized).to.include(REDACTED_PATH);
    });

    it('should return generic message for objects without message', function () {
      const error = { code: 123 };
      const sanitized = sanitizeError(error);
      expect(sanitized).to.be.a('string');
    });
  });

  describe('ErrorCode enum', function () {
    it('should have all expected file error codes', function () {
      expect(ErrorCode.FILE_NOT_FOUND).to.equal('FILE_NOT_FOUND');
      expect(ErrorCode.FILE_READ_ERROR).to.equal('FILE_READ_ERROR');
      expect(ErrorCode.FILE_WRITE_ERROR).to.equal('FILE_WRITE_ERROR');
      expect(ErrorCode.INVALID_FILE_TYPE).to.equal('INVALID_FILE_TYPE');
      expect(ErrorCode.INVALID_PATH).to.equal('INVALID_PATH');
      expect(ErrorCode.FILE_TOO_LARGE).to.equal('FILE_TOO_LARGE');
    });

    it('should have all expected conversion error codes', function () {
      expect(ErrorCode.CONVERSION_FAILED).to.equal('CONVERSION_FAILED');
      expect(ErrorCode.PDF_PARSE_ERROR).to.equal('PDF_PARSE_ERROR');
      expect(ErrorCode.DOCX_PARSE_ERROR).to.equal('DOCX_PARSE_ERROR');
      expect(ErrorCode.EXCEL_PARSE_ERROR).to.equal('EXCEL_PARSE_ERROR');
      expect(ErrorCode.CSV_PARSE_ERROR).to.equal('CSV_PARSE_ERROR');
    });

    it('should have all expected PII error codes', function () {
      expect(ErrorCode.PII_DETECTION_FAILED).to.equal('PII_DETECTION_FAILED');
      expect(ErrorCode.MODEL_LOAD_ERROR).to.equal('MODEL_LOAD_ERROR');
      expect(ErrorCode.MODEL_DOWNLOAD_ERROR).to.equal('MODEL_DOWNLOAD_ERROR');
      expect(ErrorCode.ANONYMIZATION_FAILED).to.equal('ANONYMIZATION_FAILED');
    });

    it('should have all expected IPC error codes', function () {
      expect(ErrorCode.IPC_VALIDATION_FAILED).to.equal('IPC_VALIDATION_FAILED');
      expect(ErrorCode.IPC_TIMEOUT).to.equal('IPC_TIMEOUT');
      expect(ErrorCode.IPC_CHANNEL_ERROR).to.equal('IPC_CHANNEL_ERROR');
    });

    it('should have all expected system error codes', function () {
      expect(ErrorCode.UNKNOWN_ERROR).to.equal('UNKNOWN_ERROR');
      expect(ErrorCode.OPERATION_CANCELLED).to.equal('OPERATION_CANCELLED');
      expect(ErrorCode.TIMEOUT).to.equal('TIMEOUT');
      expect(ErrorCode.OUT_OF_MEMORY).to.equal('OUT_OF_MEMORY');
    });
  });

  describe('isErrorCode', function () {
    it('should return true for valid error codes', function () {
      expect(isErrorCode('FILE_NOT_FOUND')).to.be.true;
      expect(isErrorCode('CONVERSION_FAILED')).to.be.true;
      expect(isErrorCode('UNKNOWN_ERROR')).to.be.true;
    });

    it('should return false for invalid error codes', function () {
      expect(isErrorCode('INVALID_CODE')).to.be.false;
      expect(isErrorCode('')).to.be.false;
      expect(isErrorCode(null)).to.be.false;
      expect(isErrorCode(undefined)).to.be.false;
      expect(isErrorCode(123)).to.be.false;
    });

    it('should validate all error codes from ALL_ERROR_CODES', function () {
      for (const code of ALL_ERROR_CODES) {
        expect(isErrorCode(code)).to.be.true;
      }
    });
  });

  describe('getErrorCategory', function () {
    it('should categorize file errors correctly', function () {
      expect(getErrorCategory(ErrorCode.FILE_NOT_FOUND)).to.equal('FILE');
      expect(getErrorCategory(ErrorCode.FILE_READ_ERROR)).to.equal('FILE');
      expect(getErrorCategory(ErrorCode.INVALID_PATH)).to.equal('FILE');
    });

    it('should categorize conversion errors correctly', function () {
      expect(getErrorCategory(ErrorCode.CONVERSION_FAILED)).to.equal('CONVERSION');
      expect(getErrorCategory(ErrorCode.PDF_PARSE_ERROR)).to.equal('CONVERSION');
      expect(getErrorCategory(ErrorCode.DOCX_PARSE_ERROR)).to.equal('CONVERSION');
    });

    it('should categorize PII errors correctly', function () {
      expect(getErrorCategory(ErrorCode.PII_DETECTION_FAILED)).to.equal('PII');
      expect(getErrorCategory(ErrorCode.MODEL_LOAD_ERROR)).to.equal('PII');
    });

    it('should categorize IPC errors correctly', function () {
      expect(getErrorCategory(ErrorCode.IPC_VALIDATION_FAILED)).to.equal('IPC');
      expect(getErrorCategory(ErrorCode.IPC_TIMEOUT)).to.equal('IPC');
    });

    it('should categorize system errors correctly', function () {
      expect(getErrorCategory(ErrorCode.UNKNOWN_ERROR)).to.equal('SYSTEM');
      expect(getErrorCategory(ErrorCode.TIMEOUT)).to.equal('SYSTEM');
      expect(getErrorCategory(ErrorCode.OUT_OF_MEMORY)).to.equal('SYSTEM');
    });
  });

  describe('toUserMessage', function () {
    it('should return i18n key and fallback for known error codes', function () {
      const error = new ProcessingError('Test', ErrorCode.FILE_NOT_FOUND);
      const result = toUserMessage(error);

      expect(result).to.have.property('i18nKey');
      expect(result).to.have.property('fallback');
      expect(result.i18nKey).to.equal('errors.FILE_NOT_FOUND');
      expect(result.fallback).to.be.a('string');
      expect(result.fallback.length).to.be.greaterThan(0);
    });

    it('should return generic message for unknown errors', function () {
      const error = new Error('Some random error');
      const result = toUserMessage(error);

      expect(result.i18nKey).to.equal('errors.UNKNOWN_ERROR');
      expect(result.fallback).to.include('unexpected');
    });

    it('should handle ProcessingError with all error codes', function () {
      for (const code of ALL_ERROR_CODES) {
        const error = new ProcessingError('Test', code);
        const result = toUserMessage(error);

        expect(result.i18nKey).to.include('errors.');
        expect(result.fallback).to.be.a('string');
      }
    });
  });

  describe('getErrorI18nKey', function () {
    it('should return correct i18n key for all error codes', function () {
      expect(getErrorI18nKey(ErrorCode.FILE_NOT_FOUND)).to.equal(
        'errors.FILE_NOT_FOUND',
      );
      expect(getErrorI18nKey(ErrorCode.CONVERSION_FAILED)).to.equal(
        'errors.CONVERSION_FAILED',
      );
      expect(getErrorI18nKey(ErrorCode.PII_DETECTION_FAILED)).to.equal(
        'errors.PII_DETECTION_FAILED',
      );
    });

    it('should return UNKNOWN_ERROR key for invalid codes', function () {
      expect(getErrorI18nKey('INVALID_CODE')).to.equal('errors.UNKNOWN_ERROR');
    });
  });

  describe('getDefaultErrorMessage', function () {
    it('should return a message for each error code', function () {
      for (const code of ALL_ERROR_CODES) {
        const message = getDefaultErrorMessage(code);
        expect(message).to.be.a('string');
        expect(message.length).to.be.greaterThan(0);
      }
    });

    it('should return generic message for invalid codes', function () {
      const message = getDefaultErrorMessage('INVALID_CODE');
      expect(message).to.include('unexpected');
    });
  });

  describe('formatErrorForDisplay', function () {
    it('should return sanitized message', function () {
      const error = new Error('Error at /Users/test/file.txt');
      const display = formatErrorForDisplay(error);

      expect(display.message).to.include(REDACTED_PATH);
      expect(display.message).to.not.include('/Users/');
    });

    it('should include error code if available', function () {
      const error = new ProcessingError('Test', ErrorCode.FILE_NOT_FOUND);
      const display = formatErrorForDisplay(error);

      expect(display.code).to.equal(ErrorCode.FILE_NOT_FOUND);
    });

    it('should have isDevelopment flag', function () {
      const error = new Error('Test');
      const display = formatErrorForDisplay(error);

      expect(display).to.have.property('isDevelopment');
      expect(typeof display.isDevelopment).to.equal('boolean');
    });

    it('should include stack trace in development mode', function () {
      // In test environment, NODE_ENV may not be 'production'
      const error = new Error('Test error');
      const display = formatErrorForDisplay(error);

      if (display.isDevelopment) {
        expect(display.stack).to.be.a('string');
      }
    });
  });

  describe('isDevelopment', function () {
    it('should return a boolean', function () {
      const result = isDevelopment();
      expect(typeof result).to.equal('boolean');
    });

    it('should return true when NODE_ENV is not production', function () {
      // In test environment, typically not production
      const result = isDevelopment();
      // This test assumes tests run in non-production mode
      expect(result).to.be.true;
    });
  });

  describe('ProcessingError', function () {
    it('should create error with message and code', function () {
      const error = new ProcessingError('Test message', ErrorCode.FILE_NOT_FOUND);

      expect(error.message).to.equal('Test message');
      expect(error.code).to.equal(ErrorCode.FILE_NOT_FOUND);
      expect(error.name).to.equal('ProcessingError');
    });

    it('should have default code if not provided', function () {
      const error = new ProcessingError('Test');
      expect(error.code).to.equal('PROCESSING_ERROR');
    });

    it('should include context if provided', function () {
      const context = {
        fileName: 'test.pdf',
        operation: 'read',
      };
      const error = new ProcessingError('Test', ErrorCode.FILE_READ_ERROR, context);

      expect(error.context).to.deep.equal({
        fileName: 'test.pdf',
        operation: 'read',
      });
    });

    it('should be instanceof Error', function () {
      const error = new ProcessingError('Test');
      expect(error).to.be.instanceOf(Error);
    });

    it('should have stack trace', function () {
      const error = new ProcessingError('Test');
      expect(error.stack).to.be.a('string');
    });
  });

  describe('isProcessingError', function () {
    it('should return true for ProcessingError instances', function () {
      const error = new ProcessingError('Test');
      expect(isProcessingError(error)).to.be.true;
    });

    it('should return false for regular Error instances', function () {
      const error = new Error('Test');
      expect(isProcessingError(error)).to.be.false;
    });

    it('should return false for non-errors', function () {
      expect(isProcessingError('error')).to.be.false;
      expect(isProcessingError(null)).to.be.false;
      expect(isProcessingError({})).to.be.false;
    });
  });

  describe('getErrorMessage', function () {
    it('should extract message from Error', function () {
      const error = new Error('Test message');
      expect(getErrorMessage(error)).to.equal('Test message');
    });

    it('should return string errors as-is', function () {
      expect(getErrorMessage('String error')).to.equal('String error');
    });

    it('should extract message from objects with message property', function () {
      const error = { message: 'Object error' };
      expect(getErrorMessage(error)).to.equal('Object error');
    });

    it('should return default message for unknown types', function () {
      expect(getErrorMessage(null)).to.equal('An unknown error occurred');
      expect(getErrorMessage(123)).to.equal('An unknown error occurred');
    });
  });

  describe('getErrorCode', function () {
    it('should extract code from ProcessingError', function () {
      const error = new ProcessingError('Test', ErrorCode.FILE_NOT_FOUND);
      expect(getErrorCode(error)).to.equal(ErrorCode.FILE_NOT_FOUND);
    });

    it('should extract code from objects with code property', function () {
      const error = { code: 'CUSTOM_CODE', message: 'Test' };
      expect(getErrorCode(error)).to.equal('CUSTOM_CODE');
    });

    it('should return undefined for errors without code', function () {
      const error = new Error('Test');
      expect(getErrorCode(error)).to.be.undefined;
    });
  });
});
