/**
 * WorkerLogger Tests
 *
 * Story 10.3: Web Worker Logger Implementation
 * Tests for worker-side logging with postMessage relay.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  WorkerLogger,
  createWorkerLogger,
  type WorkerLogMessage,
  type WorkerLogBatch,
} from '../../src/utils/WorkerLogger';
import {
  handleWorkerLogs,
  createWorkerMessageHandler,
  LoggerFactory,
} from '../../src/utils/logger';

describe('WorkerLogger', () => {
  // Mock self.postMessage for worker context simulation
  const postMessageMock = vi.fn();

  beforeEach(() => {
    // Reset WorkerLogger state
    WorkerLogger.reset();

    // Mock self.postMessage
    vi.stubGlobal('self', {
      postMessage: postMessageMock,
    });

    // Reset LoggerFactory for receiver tests
    LoggerFactory.resetConfig();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  // ==========================================================================
  // AC-1: Worker Logger Creation
  // ==========================================================================

  describe('Worker Logger Creation (AC-1)', () => {
    it('should create a logger with WorkerLogger.create()', () => {
      const logger = WorkerLogger.create('ml:inference');

      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should create a logger with createWorkerLogger()', () => {
      const logger = createWorkerLogger('ml:worker');

      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('should create multiple loggers with different scopes', () => {
      const logger1 = WorkerLogger.create('ml:inference');
      const logger2 = WorkerLogger.create('pii:detection');

      expect(logger1).toBeDefined();
      expect(logger2).toBeDefined();
    });
  });

  // ==========================================================================
  // AC-2: postMessage Log Relay
  // ==========================================================================

  describe('postMessage Log Relay (AC-2)', () => {
    it('should call postMessage when log is flushed', async () => {
      const logger = WorkerLogger.create('test');
      logger.info('Test message');

      // Force immediate flush
      WorkerLogger.flush();

      expect(postMessageMock).toHaveBeenCalledTimes(1);
    });

    it('should send WorkerLogBatch format', () => {
      const logger = WorkerLogger.create('test');
      logger.info('Test message');
      WorkerLogger.flush();

      const batch = postMessageMock.mock.calls[0][0] as WorkerLogBatch;
      expect(batch.type).toBe('worker-logs');
      expect(Array.isArray(batch.logs)).toBe(true);
      expect(batch.logs.length).toBe(1);
    });

    it('should include all required fields in log message', () => {
      const logger = WorkerLogger.create('test-scope');
      logger.info('Test message', { key: 'value' });
      WorkerLogger.flush();

      const batch = postMessageMock.mock.calls[0][0] as WorkerLogBatch;
      const logEntry = batch.logs[0] as WorkerLogMessage;

      expect(logEntry.type).toBe('log');
      expect(logEntry.level).toBe('info');
      expect(logEntry.scope).toBe('test-scope');
      expect(logEntry.message).toBe('Test message');
      expect(logEntry.data).toEqual({ key: 'value' });
      expect(typeof logEntry.timestamp).toBe('number');
      expect(logEntry.timestamp).toBeGreaterThan(0);
    });

    it('should include timestamp in each message', () => {
      const beforeTime = Date.now();
      const logger = WorkerLogger.create('timestamp-test');
      logger.info('Test');
      WorkerLogger.flush();
      const afterTime = Date.now();

      const batch = postMessageMock.mock.calls[0][0] as WorkerLogBatch;
      const timestamp = batch.logs[0]?.timestamp ?? 0;

      expect(timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should batch multiple logs into single postMessage', () => {
      const logger = WorkerLogger.create('batch-test');
      logger.info('Message 1');
      logger.info('Message 2');
      logger.info('Message 3');
      logger.warn('Message 4');
      logger.debug('Message 5');

      WorkerLogger.flush();

      // Should be single postMessage call
      expect(postMessageMock).toHaveBeenCalledTimes(1);

      // With all 5 messages
      const batch = postMessageMock.mock.calls[0][0] as WorkerLogBatch;
      expect(batch.logs.length).toBe(5);
    });

    it('should handle metadata correctly', () => {
      const logger = WorkerLogger.create('meta-test');
      const metadata = { count: 10, status: 'ok', nested: { a: 1 } };
      logger.info('With metadata', metadata);
      WorkerLogger.flush();

      const batch = postMessageMock.mock.calls[0][0] as WorkerLogBatch;
      expect(batch.logs[0]?.data).toEqual(metadata);
    });

    it('should handle messages without metadata', () => {
      const logger = WorkerLogger.create('no-meta');
      logger.info('No metadata');
      WorkerLogger.flush();

      const batch = postMessageMock.mock.calls[0][0] as WorkerLogBatch;
      expect(batch.logs[0]?.data).toBeUndefined();
    });

    it('should flush immediately on error level', () => {
      const logger = WorkerLogger.create('error-test');
      logger.error('Critical error');

      // Error should trigger immediate flush
      expect(postMessageMock).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // AC-7: Performance - Batching
  // ==========================================================================

  describe('Log Batching (AC-7)', () => {
    it('should buffer logs before flush', () => {
      const logger = WorkerLogger.create('buffer-test');
      logger.info('Message 1');
      logger.info('Message 2');

      // Before flush, postMessage should not be called (batching)
      expect(WorkerLogger.getBufferSize()).toBe(2);
    });

    it('should clear buffer after flush', () => {
      const logger = WorkerLogger.create('clear-test');
      logger.info('Message');
      expect(WorkerLogger.getBufferSize()).toBe(1);

      WorkerLogger.flush();
      expect(WorkerLogger.getBufferSize()).toBe(0);
    });

    it('should not call postMessage for empty buffer', () => {
      WorkerLogger.flush();
      expect(postMessageMock).not.toHaveBeenCalled();
    });

    it('should use 100ms batching delay', async () => {
      vi.useFakeTimers();

      const logger = WorkerLogger.create('delay-test');
      logger.info('Delayed message');

      // Before timeout
      expect(postMessageMock).not.toHaveBeenCalled();

      // Advance time by 100ms
      await vi.advanceTimersByTimeAsync(100);

      // After timeout
      expect(postMessageMock).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // AC-3 & AC-4: Main Thread Receiver
  // ==========================================================================

  describe('Main Thread Log Receiver (AC-3, AC-4)', () => {
    // Mock console methods for receiver tests
    const consoleMocks = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    beforeEach(() => {
      vi.spyOn(console, 'debug').mockImplementation(consoleMocks.debug);
      vi.spyOn(console, 'info').mockImplementation(consoleMocks.info);
      vi.spyOn(console, 'warn').mockImplementation(consoleMocks.warn);
      vi.spyOn(console, 'error').mockImplementation(consoleMocks.error);
    });

    it('should handle worker-logs message type', () => {
      const event = {
        data: {
          type: 'worker-logs',
          logs: [
            {
              type: 'log',
              level: 'info',
              scope: 'test',
              message: 'Worker message',
              timestamp: Date.now(),
            },
          ],
        },
      } as MessageEvent;

      const result = handleWorkerLogs(event);
      expect(result).toBe(true);
    });

    it('should return false for non-log messages', () => {
      const event = {
        data: {
          type: 'result',
          payload: {},
        },
      } as MessageEvent;

      const result = handleWorkerLogs(event);
      expect(result).toBe(false);
    });

    it('should prepend [Worker] prefix to messages (AC-4)', () => {
      const event = {
        data: {
          type: 'worker-logs',
          logs: [
            {
              type: 'log',
              level: 'info',
              scope: 'ml:inference',
              message: 'Model loaded',
              timestamp: Date.now(),
            },
          ],
        },
      } as MessageEvent;

      handleWorkerLogs(event);

      expect(consoleMocks.info).toHaveBeenCalled();
      const logOutput = consoleMocks.info.mock.calls[0][0] as string;
      expect(logOutput).toContain('[Worker]');
      expect(logOutput).toContain('Model loaded');
    });

    it('should add worker: prefix to scope', () => {
      const event = {
        data: {
          type: 'worker-logs',
          logs: [
            {
              type: 'log',
              level: 'info',
              scope: 'ml:inference',
              message: 'Test',
              timestamp: Date.now(),
            },
          ],
        },
      } as MessageEvent;

      handleWorkerLogs(event);

      const logOutput = consoleMocks.info.mock.calls[0][0] as string;
      expect(logOutput).toContain('worker:ml:inference');
    });

    it('should route debug level correctly', () => {
      const event = {
        data: {
          type: 'worker-logs',
          logs: [
            {
              type: 'log',
              level: 'debug',
              scope: 'test',
              message: 'Debug message',
              timestamp: Date.now(),
            },
          ],
        },
      } as MessageEvent;

      handleWorkerLogs(event);
      expect(consoleMocks.debug).toHaveBeenCalled();
    });

    it('should route warn level correctly', () => {
      const event = {
        data: {
          type: 'worker-logs',
          logs: [
            {
              type: 'log',
              level: 'warn',
              scope: 'test',
              message: 'Warning message',
              timestamp: Date.now(),
            },
          ],
        },
      } as MessageEvent;

      handleWorkerLogs(event);
      expect(consoleMocks.warn).toHaveBeenCalled();
    });

    it('should route error level correctly', () => {
      const event = {
        data: {
          type: 'worker-logs',
          logs: [
            {
              type: 'log',
              level: 'error',
              scope: 'test',
              message: 'Error message',
              timestamp: Date.now(),
            },
          ],
        },
      } as MessageEvent;

      handleWorkerLogs(event);
      expect(consoleMocks.error).toHaveBeenCalled();
    });

    it('should handle multiple logs in batch', () => {
      const event = {
        data: {
          type: 'worker-logs',
          logs: [
            { type: 'log', level: 'info', scope: 'a', message: 'Msg 1', timestamp: Date.now() },
            { type: 'log', level: 'warn', scope: 'b', message: 'Msg 2', timestamp: Date.now() },
            { type: 'log', level: 'error', scope: 'c', message: 'Msg 3', timestamp: Date.now() },
          ],
        },
      } as MessageEvent;

      handleWorkerLogs(event);

      expect(consoleMocks.info).toHaveBeenCalledTimes(1);
      expect(consoleMocks.warn).toHaveBeenCalledTimes(1);
      expect(consoleMocks.error).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // AC-5: Log Level Filtering
  // ==========================================================================

  describe('Log Level Filtering (AC-5)', () => {
    const consoleMocks = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    beforeEach(() => {
      vi.spyOn(console, 'debug').mockImplementation(consoleMocks.debug);
      vi.spyOn(console, 'info').mockImplementation(consoleMocks.info);
      vi.spyOn(console, 'warn').mockImplementation(consoleMocks.warn);
      vi.spyOn(console, 'error').mockImplementation(consoleMocks.error);
    });

    it('should filter debug when level is info', () => {
      LoggerFactory.setLevel('info');

      const event = {
        data: {
          type: 'worker-logs',
          logs: [
            { type: 'log', level: 'debug', scope: 'test', message: 'Debug', timestamp: Date.now() },
            { type: 'log', level: 'info', scope: 'test', message: 'Info', timestamp: Date.now() },
          ],
        },
      } as MessageEvent;

      handleWorkerLogs(event);

      expect(consoleMocks.debug).not.toHaveBeenCalled();
      expect(consoleMocks.info).toHaveBeenCalled();
    });

    it('should filter debug and info when level is warn', () => {
      LoggerFactory.setLevel('warn');

      const event = {
        data: {
          type: 'worker-logs',
          logs: [
            { type: 'log', level: 'debug', scope: 'test', message: 'Debug', timestamp: Date.now() },
            { type: 'log', level: 'info', scope: 'test', message: 'Info', timestamp: Date.now() },
            { type: 'log', level: 'warn', scope: 'test', message: 'Warn', timestamp: Date.now() },
          ],
        },
      } as MessageEvent;

      handleWorkerLogs(event);

      expect(consoleMocks.debug).not.toHaveBeenCalled();
      expect(consoleMocks.info).not.toHaveBeenCalled();
      expect(consoleMocks.warn).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // createWorkerMessageHandler utility
  // ==========================================================================

  describe('createWorkerMessageHandler', () => {
    it('should handle worker-logs and pass other messages to handler', () => {
      const customHandler = vi.fn();
      const combinedHandler = createWorkerMessageHandler(customHandler);

      // Log message - should be handled by worker log handler
      const logEvent = {
        data: {
          type: 'worker-logs',
          logs: [{ type: 'log', level: 'info', scope: 'test', message: 'Log', timestamp: Date.now() }],
        },
      } as MessageEvent;

      combinedHandler(logEvent);
      expect(customHandler).not.toHaveBeenCalled();

      // Non-log message - should be passed to custom handler
      const resultEvent = {
        data: { type: 'result', payload: { data: 'test' } },
      } as MessageEvent;

      combinedHandler(resultEvent);
      expect(customHandler).toHaveBeenCalledWith(resultEvent);
    });
  });

  // ==========================================================================
  // isWorker detection (AC-1, already in logger.ts)
  // ==========================================================================

  describe('isWorker detection (AC-1)', () => {
    it('should return false in happy-dom test environment', async () => {
      const { isWorker } = await import('../../src/utils/logger');
      // In happy-dom, window is defined so isWorker should return false
      expect(isWorker()).toBe(false);
    });
  });
});
