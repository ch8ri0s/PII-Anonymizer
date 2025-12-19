/**
 * Tests for error type guards and utilities
 * Story 6.4 - TypeScript Strict Mode Migration
 */
import { expect } from 'chai';
import { describe, it } from 'mocha';

// Import compiled JavaScript from dist
import {
  isError,
  isNodeError,
  isProcessingError,
  ProcessingError,
  getErrorMessage,
  getErrorCode,
  getErrorStack,
} from '../../dist/types/errors.js';

describe('Error Type Guards and Utilities', function() {
  describe('isError()', function() {
    it('should return true for Error instances', function() {
      expect(isError(new Error('test'))).to.be.true;
    });

    it('should return true for Error subclasses', function() {
      expect(isError(new TypeError('test'))).to.be.true;
      expect(isError(new RangeError('test'))).to.be.true;
      expect(isError(new SyntaxError('test'))).to.be.true;
    });

    it('should return false for strings', function() {
      expect(isError('test error')).to.be.false;
    });

    it('should return false for objects with message property', function() {
      expect(isError({ message: 'test' })).to.be.false;
    });

    it('should return false for null', function() {
      expect(isError(null)).to.be.false;
    });

    it('should return false for undefined', function() {
      expect(isError(undefined)).to.be.false;
    });

    it('should return false for numbers', function() {
      expect(isError(42)).to.be.false;
    });
  });

  describe('isNodeError()', function() {
    it('should return true for Error with code property', function() {
      const error = new Error('ENOENT');
      error.code = 'ENOENT';
      expect(isNodeError(error)).to.be.true;
    });

    it('should return false for Error without code', function() {
      expect(isNodeError(new Error('test'))).to.be.false;
    });

    it('should return false for plain objects with code', function() {
      expect(isNodeError({ code: 'ENOENT', message: 'test' })).to.be.false;
    });
  });

  describe('ProcessingError', function() {
    it('should create error with default code', function() {
      const error = new ProcessingError('test message');
      expect(error.message).to.equal('test message');
      expect(error.code).to.equal('PROCESSING_ERROR');
      expect(error.name).to.equal('ProcessingError');
    });

    it('should create error with custom code', function() {
      const error = new ProcessingError('test', 'CUSTOM_CODE');
      expect(error.code).to.equal('CUSTOM_CODE');
    });

    it('should create error with context', function() {
      const context = { filePath: '/test/file.txt', size: 1024 };
      const error = new ProcessingError('test', 'TEST_CODE', context);
      expect(error.context).to.deep.equal(context);
    });

    it('should be an instance of Error', function() {
      const error = new ProcessingError('test');
      expect(error instanceof Error).to.be.true;
    });

    it('should have a stack trace', function() {
      const error = new ProcessingError('test');
      expect(error.stack).to.be.a('string');
      expect(error.stack).to.include('ProcessingError');
    });
  });

  describe('isProcessingError()', function() {
    it('should return true for ProcessingError instances', function() {
      expect(isProcessingError(new ProcessingError('test'))).to.be.true;
    });

    it('should return false for regular Error', function() {
      expect(isProcessingError(new Error('test'))).to.be.false;
    });

    it('should return false for objects with similar structure', function() {
      expect(isProcessingError({ message: 'test', code: 'TEST', name: 'ProcessingError' })).to.be.false;
    });
  });

  describe('getErrorMessage()', function() {
    it('should extract message from Error', function() {
      expect(getErrorMessage(new Error('test error'))).to.equal('test error');
    });

    it('should extract message from ProcessingError', function() {
      expect(getErrorMessage(new ProcessingError('processing failed'))).to.equal('processing failed');
    });

    it('should return string as-is', function() {
      expect(getErrorMessage('string error')).to.equal('string error');
    });

    it('should extract message from error-like objects', function() {
      expect(getErrorMessage({ message: 'object error' })).to.equal('object error');
    });

    it('should return default message for null', function() {
      expect(getErrorMessage(null)).to.equal('An unknown error occurred');
    });

    it('should return default message for undefined', function() {
      expect(getErrorMessage(undefined)).to.equal('An unknown error occurred');
    });

    it('should return default message for numbers', function() {
      expect(getErrorMessage(42)).to.equal('An unknown error occurred');
    });

    it('should return default message for objects without message', function() {
      expect(getErrorMessage({ error: 'something' })).to.equal('An unknown error occurred');
    });

    it('should return default message for objects with non-string message', function() {
      expect(getErrorMessage({ message: 123 })).to.equal('An unknown error occurred');
    });
  });

  describe('getErrorCode()', function() {
    it('should extract code from ProcessingError', function() {
      expect(getErrorCode(new ProcessingError('test', 'PROC_ERR'))).to.equal('PROC_ERR');
    });

    it('should extract code from Node.js error', function() {
      const error = new Error('ENOENT');
      error.code = 'ENOENT';
      expect(getErrorCode(error)).to.equal('ENOENT');
    });

    it('should extract code from error-like objects', function() {
      expect(getErrorCode({ code: 'CUSTOM_CODE' })).to.equal('CUSTOM_CODE');
    });

    it('should return undefined for Error without code', function() {
      expect(getErrorCode(new Error('test'))).to.be.undefined;
    });

    it('should return undefined for null', function() {
      expect(getErrorCode(null)).to.be.undefined;
    });

    it('should return undefined for strings', function() {
      expect(getErrorCode('string error')).to.be.undefined;
    });

    it('should return undefined for objects with non-string code', function() {
      expect(getErrorCode({ code: 123 })).to.be.undefined;
    });
  });

  describe('getErrorStack()', function() {
    it('should extract stack from Error', function() {
      const error = new Error('test');
      expect(getErrorStack(error)).to.be.a('string');
      expect(getErrorStack(error)).to.include('Error: test');
    });

    it('should extract stack from ProcessingError', function() {
      const error = new ProcessingError('test');
      expect(getErrorStack(error)).to.be.a('string');
      expect(getErrorStack(error)).to.include('ProcessingError');
    });

    it('should return undefined for strings', function() {
      expect(getErrorStack('string error')).to.be.undefined;
    });

    it('should return undefined for objects', function() {
      expect(getErrorStack({ stack: 'fake stack' })).to.be.undefined;
    });

    it('should return undefined for null', function() {
      expect(getErrorStack(null)).to.be.undefined;
    });
  });
});
