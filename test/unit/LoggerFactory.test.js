/**
 * LoggerFactory Tests (Story 6.1)
 *
 * Tests the unified logging factory for:
 * - Logger creation and caching
 * - Log level configuration
 * - Console fallback behavior
 * - Scope-based logging
 * - Log level filtering
 */

import { expect } from 'chai';
import {
  LoggerFactory,
  createLogger,
  defaultLogger,
} from '../../dist/utils/LoggerFactory.js';

describe('LoggerFactory', () => {
  // Capture console output for verification
  let consoleOutput;
  let originalConsole;

  beforeEach(() => {
    // Clear logger cache before each test
    LoggerFactory.clearCache();
    // Reset to default level
    LoggerFactory.setLevel('info');

    // Capture console output
    consoleOutput = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };

    // Save original console methods
    originalConsole = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };

    // Override console methods to capture output
    console.debug = (...args) => consoleOutput.debug.push(args.join(' '));
    console.info = (...args) => consoleOutput.info.push(args.join(' '));
    console.warn = (...args) => consoleOutput.warn.push(args.join(' '));
    console.error = (...args) => consoleOutput.error.push(args.join(' '));
  });

  afterEach(() => {
    // Restore original console methods
    console.debug = originalConsole.debug;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe('createLogger()', () => {
    it('should create a logger with all required methods', () => {
      const log = createLogger('test');

      expect(log).to.have.property('debug').that.is.a('function');
      expect(log).to.have.property('info').that.is.a('function');
      expect(log).to.have.property('warn').that.is.a('function');
      expect(log).to.have.property('error').that.is.a('function');
    });

    it('should return the same logger instance for same scope (caching)', () => {
      const log1 = createLogger('test-scope');
      const log2 = createLogger('test-scope');

      expect(log1).to.equal(log2);
    });

    it('should return different logger instances for different scopes', () => {
      const log1 = createLogger('scope1');
      const log2 = createLogger('scope2');

      expect(log1).to.not.equal(log2);
    });

    it('should include scope in log output', () => {
      const log = createLogger('myScope');
      log.info('Test message');

      expect(consoleOutput.info.length).to.equal(1);
      expect(consoleOutput.info[0]).to.include('myScope');
      expect(consoleOutput.info[0]).to.include('Test message');
    });
  });

  describe('Logger methods', () => {
    it('should log debug messages when level is debug', () => {
      LoggerFactory.setLevel('debug');
      const log = createLogger('debug-test');

      log.debug('Debug message');

      expect(consoleOutput.debug.length).to.equal(1);
      expect(consoleOutput.debug[0]).to.include('Debug message');
    });

    it('should log info messages', () => {
      const log = createLogger('info-test');
      log.info('Info message');

      expect(consoleOutput.info.length).to.equal(1);
      expect(consoleOutput.info[0]).to.include('Info message');
    });

    it('should log warn messages', () => {
      const log = createLogger('warn-test');
      log.warn('Warning message');

      expect(consoleOutput.warn.length).to.equal(1);
      expect(consoleOutput.warn[0]).to.include('Warning message');
    });

    it('should log error messages', () => {
      const log = createLogger('error-test');
      log.error('Error message');

      expect(consoleOutput.error.length).to.equal(1);
      expect(consoleOutput.error[0]).to.include('Error message');
    });

    it('should include metadata in log output', () => {
      const log = createLogger('metadata-test');
      log.info('Test with metadata', { key: 'value', count: 42 });

      expect(consoleOutput.info.length).to.equal(1);
      expect(consoleOutput.info[0]).to.include('key');
      expect(consoleOutput.info[0]).to.include('value');
      expect(consoleOutput.info[0]).to.include('42');
    });
  });

  describe('Log level configuration', () => {
    it('should filter debug logs when level is info', () => {
      LoggerFactory.setLevel('info');
      const log = createLogger('level-test-1');

      log.debug('Should not appear');
      log.info('Should appear');

      expect(consoleOutput.debug.length).to.equal(0);
      expect(consoleOutput.info.length).to.equal(1);
    });

    it('should filter debug and info logs when level is warn', () => {
      LoggerFactory.setLevel('warn');
      const log = createLogger('level-test-2');

      log.debug('Debug - should not appear');
      log.info('Info - should not appear');
      log.warn('Warn - should appear');
      log.error('Error - should appear');

      expect(consoleOutput.debug.length).to.equal(0);
      expect(consoleOutput.info.length).to.equal(0);
      expect(consoleOutput.warn.length).to.equal(1);
      expect(consoleOutput.error.length).to.equal(1);
    });

    it('should only log errors when level is error', () => {
      LoggerFactory.setLevel('error');
      const log = createLogger('level-test-3');

      log.debug('Debug - should not appear');
      log.info('Info - should not appear');
      log.warn('Warn - should not appear');
      log.error('Error - should appear');

      expect(consoleOutput.debug.length).to.equal(0);
      expect(consoleOutput.info.length).to.equal(0);
      expect(consoleOutput.warn.length).to.equal(0);
      expect(consoleOutput.error.length).to.equal(1);
    });

    it('should log all levels when level is debug', () => {
      LoggerFactory.setLevel('debug');
      const log = createLogger('level-test-4');

      log.debug('Debug message');
      log.info('Info message');
      log.warn('Warn message');
      log.error('Error message');

      expect(consoleOutput.debug.length).to.equal(1);
      expect(consoleOutput.info.length).to.equal(1);
      expect(consoleOutput.warn.length).to.equal(1);
      expect(consoleOutput.error.length).to.equal(1);
    });
  });

  describe('Scope-level configuration', () => {
    it('should allow per-scope log level override', () => {
      LoggerFactory.setLevel('warn'); // Global level
      LoggerFactory.setScopeLevel('verbose-scope', 'debug'); // Override for specific scope

      const quietLog = createLogger('quiet-scope');
      const verboseLog = createLogger('verbose-scope');

      quietLog.debug('Should not appear');
      quietLog.info('Should not appear');
      verboseLog.debug('Should appear');
      verboseLog.info('Should appear');

      // Quiet scope should not log debug/info (global level is warn)
      // Verbose scope should log debug/info (override to debug)
      expect(consoleOutput.debug.length).to.equal(1);
      expect(consoleOutput.info.length).to.equal(1);
    });
  });

  describe('LoggerFactory.clearCache()', () => {
    it('should clear the logger cache', () => {
      const log1 = createLogger('cache-test');
      LoggerFactory.clearCache();
      const log2 = createLogger('cache-test');

      // After clearing cache, should get a new instance
      expect(log1).to.not.equal(log2);
    });
  });

  describe('LoggerFactory.configure()', () => {
    it('should update log level via configure()', () => {
      LoggerFactory.configure({ level: 'error' });
      const log = createLogger('config-test');

      log.info('Should not appear');
      log.error('Should appear');

      expect(consoleOutput.info.length).to.equal(0);
      expect(consoleOutput.error.length).to.equal(1);
    });

    it('should update enablePiiRedaction via configure()', () => {
      LoggerFactory.configure({ enablePiiRedaction: true });
      // PII redaction is internal - just verify configure doesn't throw
      const log = createLogger('pii-test');
      log.info('test@example.com should be redacted');

      expect(consoleOutput.info.length).to.equal(1);
    });
  });

  describe('defaultLogger', () => {
    it('should be a valid logger instance', () => {
      expect(defaultLogger).to.have.property('debug').that.is.a('function');
      expect(defaultLogger).to.have.property('info').that.is.a('function');
      expect(defaultLogger).to.have.property('warn').that.is.a('function');
      expect(defaultLogger).to.have.property('error').that.is.a('function');
    });

    it('should use "app" as default scope', () => {
      defaultLogger.info('Default logger message');

      expect(consoleOutput.info.length).to.equal(1);
      expect(consoleOutput.info[0]).to.include('app');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string message', () => {
      const log = createLogger('edge-test-1');
      log.info('');

      expect(consoleOutput.info.length).to.equal(1);
    });

    it('should handle undefined metadata', () => {
      const log = createLogger('edge-test-2');
      log.info('Test message', undefined);

      expect(consoleOutput.info.length).to.equal(1);
    });

    it('should handle empty metadata object', () => {
      const log = createLogger('edge-test-3');
      log.info('Test message', {});

      expect(consoleOutput.info.length).to.equal(1);
    });

    it('should handle special characters in scope', () => {
      const log = createLogger('converter:pdf');
      log.info('Test message');

      expect(consoleOutput.info.length).to.equal(1);
      expect(consoleOutput.info[0]).to.include('converter:pdf');
    });

    it('should handle long scope names', () => {
      const longScope = 'very-long-scope-name-for-testing-purposes';
      const log = createLogger(longScope);
      log.info('Test message');

      expect(consoleOutput.info.length).to.equal(1);
    });
  });

  describe('Timestamp formatting', () => {
    it('should include timestamp in log output', () => {
      const log = createLogger('timestamp-test');
      log.info('Test message');

      expect(consoleOutput.info.length).to.equal(1);
      // Timestamp format is HH:MM:SS.mmm
      expect(consoleOutput.info[0]).to.match(/\d{2}:\d{2}:\d{2}\.\d{3}/);
    });
  });

  describe('LoggerFactory.getLogFilePath()', () => {
    it('should return null in non-Electron environment', () => {
      const logPath = LoggerFactory.getLogFilePath();
      // In test environment (not Electron), should return null
      expect(logPath).to.be.null;
    });
  });
});
