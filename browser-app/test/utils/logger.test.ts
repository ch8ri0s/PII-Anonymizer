/**
 * Browser Logger Tests
 *
 * Story 10.2: LoggerFactory Browser-App Adaptation
 * Tests for browser-compatible logging functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LoggerFactory,
  createLogger,
  setLogLevel,
  isElectron,
  isBrowser,
  isWorker,
  isDevelopment,
  redactSensitiveData,
  type Logger,
  type LogLevel,
} from '../../src/utils/logger';

describe('Browser Logger', () => {
  // Mock console methods before each test
  const consoleMocks = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    // Reset LoggerFactory state
    LoggerFactory.resetConfig();

    // Mock console methods
    vi.spyOn(console, 'debug').mockImplementation(consoleMocks.debug);
    vi.spyOn(console, 'info').mockImplementation(consoleMocks.info);
    vi.spyOn(console, 'warn').mockImplementation(consoleMocks.warn);
    vi.spyOn(console, 'error').mockImplementation(consoleMocks.error);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // AC-1: Browser Context Logger Creation
  // ==========================================================================

  describe('Logger Creation (AC-1)', () => {
    it('should create a logger instance with createLogger()', () => {
      const logger = createLogger('testScope');

      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should create a logger instance with LoggerFactory.create()', () => {
      const logger = LoggerFactory.create('testScope');

      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should return cached logger for same scope', () => {
      const logger1 = LoggerFactory.create('cachedScope');
      const logger2 = LoggerFactory.create('cachedScope');

      expect(logger1).toBe(logger2);
    });

    it('should return different loggers for different scopes', () => {
      const logger1 = LoggerFactory.create('scope1');
      const logger2 = LoggerFactory.create('scope2');

      expect(logger1).not.toBe(logger2);
    });
  });

  // ==========================================================================
  // AC-2: DevTools Console Output
  // ==========================================================================

  describe('Console Output Format (AC-2)', () => {
    it('should output debug messages to console.debug', () => {
      const logger = createLogger('debug-test');
      logger.debug('Test debug message');

      expect(consoleMocks.debug).toHaveBeenCalled();
    });

    it('should output info messages to console.info', () => {
      const logger = createLogger('info-test');
      logger.info('Test info message');

      expect(consoleMocks.info).toHaveBeenCalled();
    });

    it('should output warn messages to console.warn', () => {
      const logger = createLogger('warn-test');
      logger.warn('Test warn message');

      expect(consoleMocks.warn).toHaveBeenCalled();
    });

    it('should output error messages to console.error', () => {
      const logger = createLogger('error-test');
      logger.error('Test error message');

      expect(consoleMocks.error).toHaveBeenCalled();
    });

    it('should include timestamp in formatted output', () => {
      const logger = createLogger('format-test');
      logger.info('Formatted message');

      const output = consoleMocks.info.mock.calls[0][0] as string;
      // Timestamp format: HH:MM:SS.mmm
      expect(output).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3}/);
    });

    it('should include scope prefix in formatted output', () => {
      const logger = createLogger('my-scope');
      logger.info('Scoped message');

      const output = consoleMocks.info.mock.calls[0][0] as string;
      expect(output).toContain('[my-scope');
    });

    it('should include message in formatted output', () => {
      const logger = createLogger('message-test');
      logger.info('My specific message');

      const output = consoleMocks.info.mock.calls[0][0] as string;
      expect(output).toContain('My specific message');
    });

    it('should include metadata as JSON in formatted output', () => {
      const logger = createLogger('meta-test');
      logger.info('Message with meta', { count: 5, status: 'ok' });

      const output = consoleMocks.info.mock.calls[0][0] as string;
      expect(output).toContain('{"count":5,"status":"ok"}');
    });

    it('should handle messages without metadata', () => {
      const logger = createLogger('no-meta');
      logger.info('Simple message');

      const output = consoleMocks.info.mock.calls[0][0] as string;
      expect(output).toContain('Simple message');
      expect(output).not.toContain('{}');
    });
  });

  // ==========================================================================
  // AC-3: Log Level Filtering
  // ==========================================================================

  describe('Log Level Filtering (AC-3)', () => {
    it('should log all levels when level is debug', () => {
      LoggerFactory.setLevel('debug');
      const logger = createLogger('level-debug');

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(consoleMocks.debug).toHaveBeenCalled();
      expect(consoleMocks.info).toHaveBeenCalled();
      expect(consoleMocks.warn).toHaveBeenCalled();
      expect(consoleMocks.error).toHaveBeenCalled();
    });

    it('should filter debug when level is info', () => {
      LoggerFactory.setLevel('info');
      const logger = createLogger('level-info');

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(consoleMocks.debug).not.toHaveBeenCalled();
      expect(consoleMocks.info).toHaveBeenCalled();
      expect(consoleMocks.warn).toHaveBeenCalled();
      expect(consoleMocks.error).toHaveBeenCalled();
    });

    it('should filter debug and info when level is warn', () => {
      LoggerFactory.setLevel('warn');
      const logger = createLogger('level-warn');

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(consoleMocks.debug).not.toHaveBeenCalled();
      expect(consoleMocks.info).not.toHaveBeenCalled();
      expect(consoleMocks.warn).toHaveBeenCalled();
      expect(consoleMocks.error).toHaveBeenCalled();
    });

    it('should only log errors when level is error', () => {
      LoggerFactory.setLevel('error');
      const logger = createLogger('level-error');

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      expect(consoleMocks.debug).not.toHaveBeenCalled();
      expect(consoleMocks.info).not.toHaveBeenCalled();
      expect(consoleMocks.warn).not.toHaveBeenCalled();
      expect(consoleMocks.error).toHaveBeenCalled();
    });

    it('should support setLogLevel convenience function', () => {
      setLogLevel('error');
      const logger = createLogger('convenience');

      logger.info('Info');
      logger.error('Error');

      expect(consoleMocks.info).not.toHaveBeenCalled();
      expect(consoleMocks.error).toHaveBeenCalled();
    });

    it('should support per-scope level overrides', () => {
      LoggerFactory.setLevel('error'); // Global: error only
      LoggerFactory.setScopeLevel('verbose-scope', 'debug'); // Override: all

      const globalLogger = createLogger('global-scope');
      const verboseLogger = createLogger('verbose-scope');

      globalLogger.info('Global info');
      verboseLogger.info('Verbose info');

      expect(consoleMocks.info).toHaveBeenCalledTimes(1);
      expect(consoleMocks.info.mock.calls[0][0]).toContain('verbose-scope');
    });

    it('should clear cache when log level changes', () => {
      const logger1 = createLogger('cache-scope');
      LoggerFactory.setLevel('error');
      const logger2 = createLogger('cache-scope');

      // Should be different instances after level change
      expect(logger1).not.toBe(logger2);
    });
  });

  // ==========================================================================
  // AC-4: PII Redaction
  // ==========================================================================

  describe('PII Redaction (AC-4)', () => {
    describe('redactSensitiveData function', () => {
      it('should redact email addresses', () => {
        const text = 'Contact john.doe@example.com for info';
        const result = redactSensitiveData(text);

        expect(result).toBe('Contact [EMAIL_REDACTED] for info');
        expect(result).not.toContain('john.doe@example.com');
      });

      it('should redact multiple email addresses', () => {
        const text = 'Email john@test.com or jane@example.org';
        const result = redactSensitiveData(text);

        expect(result).toBe('Email [EMAIL_REDACTED] or [EMAIL_REDACTED]');
      });

      it('should redact Swiss phone numbers (+41)', () => {
        const text = 'Call +41 79 123 45 67';
        const result = redactSensitiveData(text);

        expect(result).toContain('[PHONE_REDACTED]');
        expect(result).not.toContain('79 123');
      });

      it('should redact local Swiss phone numbers', () => {
        const text = 'Phone: 079 123 45 67';
        const result = redactSensitiveData(text);

        expect(result).toContain('[PHONE_REDACTED]');
      });

      it('should redact IBAN numbers', () => {
        const text = 'IBAN: CH9300762011623852957';
        const result = redactSensitiveData(text);

        expect(result).toContain('[IBAN_REDACTED]');
        expect(result).not.toContain('CH93');
      });

      it('should redact IBAN with spaces', () => {
        const text = 'Account: CH93 0076 2011 6238 5295 7';
        const result = redactSensitiveData(text);

        expect(result).toContain('[IBAN_REDACTED]');
      });

      it('should redact Swiss AHV numbers', () => {
        const text = 'AVS: 756.1234.5678.90';
        const result = redactSensitiveData(text);

        expect(result).toContain('[AHV_REDACTED]');
        expect(result).not.toContain('756.1234');
      });

      it('should handle text without PII', () => {
        const text = 'This is a simple message without PII.';
        const result = redactSensitiveData(text);

        expect(result).toBe(text);
      });

      it('should redact multiple PII types in one text', () => {
        const text = 'Contact john@test.com at +41 79 123 45 67, AVS: 756.1234.5678.90';
        const result = redactSensitiveData(text);

        expect(result).toContain('[EMAIL_REDACTED]');
        expect(result).toContain('[PHONE_REDACTED]');
        expect(result).toContain('[AHV_REDACTED]');
      });
    });
  });

  // ==========================================================================
  // AC-5: No electron-log Errors
  // ==========================================================================

  describe('No Node.js/Electron Errors (AC-5)', () => {
    it('should create logger without importing electron-log', () => {
      // This test passes if no errors are thrown
      expect(() => createLogger('electron-free')).not.toThrow();
    });

    it('should log messages without Node.js APIs', () => {
      const logger = createLogger('node-free');

      // These should work without any Node.js dependencies
      expect(() => logger.debug('Debug')).not.toThrow();
      expect(() => logger.info('Info')).not.toThrow();
      expect(() => logger.warn('Warn')).not.toThrow();
      expect(() => logger.error('Error')).not.toThrow();
    });

    it('should configure logger without errors', () => {
      expect(() =>
        LoggerFactory.configure({
          level: 'info',
          redactPII: true,
        }),
      ).not.toThrow();
    });
  });

  // ==========================================================================
  // AC-6: Environment Detection
  // ==========================================================================

  describe('Environment Detection (AC-6)', () => {
    it('should return false for isElectron() in browser', () => {
      expect(isElectron()).toBe(false);
    });

    it('should return true for isBrowser() in happy-dom', () => {
      expect(isBrowser()).toBe(true);
    });

    it('should return false for isWorker() in main thread', () => {
      expect(isWorker()).toBe(false);
    });

    it('should return consistent environment detection', () => {
      // In browser: isElectron false, isBrowser true
      expect(isElectron()).toBe(false);
      expect(isBrowser()).toBe(true);

      // They should be mutually exclusive (for browser context)
      expect(isElectron() && isBrowser()).toBe(false);
    });

    it('should expose isDevelopment() via LoggerFactory', () => {
      expect(typeof LoggerFactory.isDevelopment()).toBe('boolean');
    });

    it('should expose isDevelopment() as module function', () => {
      expect(typeof isDevelopment()).toBe('boolean');
    });
  });

  // ==========================================================================
  // AC-7: Console-Only Output
  // ==========================================================================

  describe('Console-Only Output (AC-7)', () => {
    it('should only use console methods for output', () => {
      const logger = createLogger('console-only');

      logger.debug('Debug');
      logger.info('Info');
      logger.warn('Warn');
      logger.error('Error');

      // All output should go through console
      expect(consoleMocks.debug).toHaveBeenCalled();
      expect(consoleMocks.info).toHaveBeenCalled();
      expect(consoleMocks.warn).toHaveBeenCalled();
      expect(consoleMocks.error).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Additional Tests
  // ==========================================================================

  describe('Configuration', () => {
    it('should configure with LoggerFactory.configure()', () => {
      LoggerFactory.configure({
        level: 'warn',
        scopeLevels: { special: 'debug' },
        redactPII: false,
      });

      const normalLogger = createLogger('normal');
      const specialLogger = createLogger('special');

      normalLogger.info('Normal info');
      specialLogger.info('Special info');

      // Normal should be filtered (warn level)
      expect(consoleMocks.info).toHaveBeenCalledTimes(1);
      expect(consoleMocks.info.mock.calls[0][0]).toContain('special');
    });

    it('should reset configuration with resetConfig()', () => {
      LoggerFactory.setLevel('error');
      LoggerFactory.resetConfig();

      // After reset, default level should be debug (in dev mode)
      const logger = createLogger('reset-test');
      logger.debug('Debug after reset');

      expect(consoleMocks.debug).toHaveBeenCalled();
    });

    it('should clear cache with clearCache()', () => {
      const logger1 = createLogger('clear-test');
      LoggerFactory.clearCache();
      const logger2 = createLogger('clear-test');

      expect(logger1).not.toBe(logger2);
    });
  });

  describe('Type Exports', () => {
    it('should export Logger type', () => {
      const logger: Logger = createLogger('type-test');
      expect(logger).toBeDefined();
    });

    it('should export LogLevel type', () => {
      const level: LogLevel = 'info';
      expect(['debug', 'info', 'warn', 'error']).toContain(level);
    });
  });
});
