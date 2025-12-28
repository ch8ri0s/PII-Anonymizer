/**
 * Worker Logger - Web Worker compatible logging via postMessage
 *
 * Provides logging for Web Worker contexts by relaying log messages to the
 * main thread via postMessage. The main thread then routes them through
 * the standard LoggerFactory for formatting, filtering, and PII redaction.
 *
 * Features:
 * - 100ms batching to reduce postMessage overhead
 * - Async/non-blocking logging
 * - Compatible with Logger interface from logger.ts
 * - Automatic timestamp for each log entry
 *
 * Story 10.3: Web Worker Logger Implementation
 */

import type { Logger, LogLevel } from './logger';

// Re-export types for convenience
export type { Logger, LogLevel };

/**
 * Log message structure for postMessage relay
 *
 * This is the payload sent from worker to main thread
 */
export interface WorkerLogMessage {
  /** Message type identifier */
  type: 'log';
  /** Log level */
  level: LogLevel;
  /** Logger scope (e.g., 'ml:inference') */
  scope: string;
  /** Log message content */
  message: string;
  /** Optional structured metadata */
  data?: Record<string, unknown>;
  /** Timestamp when log was created (ms since epoch) */
  timestamp: number;
}

/**
 * Batch of log messages sent to main thread
 */
export interface WorkerLogBatch {
  /** Message type for worker response handling */
  type: 'worker-logs';
  /** Array of log messages */
  logs: WorkerLogMessage[];
}

/**
 * Worker Logger Transport
 *
 * Batches log messages and sends them to the main thread via postMessage.
 * Uses 100ms debounce to reduce message overhead during rapid logging.
 */
class WorkerLoggerTransport {
  private buffer: WorkerLogMessage[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly BATCH_DELAY_MS = 100;

  /**
   * Add a log message to the buffer
   *
   * @param level - Log level
   * @param scope - Logger scope
   * @param message - Log message
   * @param data - Optional metadata
   */
  log(
    level: LogLevel,
    scope: string,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    this.buffer.push({
      type: 'log',
      level,
      scope,
      message,
      data,
      timestamp: Date.now(),
    });

    // Schedule flush if not already scheduled
    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), this.BATCH_DELAY_MS);
    }
  }

  /**
   * Flush buffered messages to main thread
   */
  private flush(): void {
    if (this.buffer.length > 0) {
      const batch: WorkerLogBatch = {
        type: 'worker-logs',
        logs: [...this.buffer],
      };
      self.postMessage(batch);
      this.buffer = [];
    }
    this.flushTimeout = null;
  }

  /**
   * Force immediate flush (useful for errors or shutdown)
   */
  flushNow(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
    this.flush();
  }

  /**
   * Get current buffer size (for testing)
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
}

// Singleton transport instance
let transport: WorkerLoggerTransport | null = null;

/**
 * Get or create the transport instance
 */
function getTransport(): WorkerLoggerTransport {
  if (!transport) {
    transport = new WorkerLoggerTransport();
  }
  return transport;
}

/**
 * Create a logger instance for use in Web Workers
 *
 * @param scope - The logger scope (e.g., 'ml:inference', 'pii:detection')
 * @returns A Logger instance that relays logs to main thread
 *
 * @example
 * ```typescript
 * // In a Web Worker
 * import { createWorkerLogger } from '../utils/WorkerLogger';
 *
 * const log = createWorkerLogger('ml:inference');
 * log.info('Model loaded', { size: '129MB' });
 * log.error('Inference failed', { error: err.message });
 * ```
 */
export function createWorkerLogger(scope: string): Logger {
  const t = getTransport();

  return {
    debug(message: string, metadata?: Record<string, unknown>): void {
      t.log('debug', scope, message, metadata);
    },
    info(message: string, metadata?: Record<string, unknown>): void {
      t.log('info', scope, message, metadata);
    },
    warn(message: string, metadata?: Record<string, unknown>): void {
      t.log('warn', scope, message, metadata);
    },
    error(message: string, metadata?: Record<string, unknown>): void {
      t.log('error', scope, message, metadata);
      // Flush immediately for errors to ensure visibility
      t.flushNow();
    },
  };
}

/**
 * WorkerLogger - Factory class for creating worker loggers
 *
 * Provides the same API pattern as LoggerFactory for consistency.
 *
 * @example
 * ```typescript
 * import { WorkerLogger } from '../utils/WorkerLogger';
 *
 * const log = WorkerLogger.create('ml:worker');
 * log.info('Processing started');
 * ```
 */
export class WorkerLogger {
  /**
   * Create a scoped logger for Web Worker context
   *
   * @param scope - The module or service name
   * @returns A Logger instance that relays to main thread
   */
  static create(scope: string): Logger {
    return createWorkerLogger(scope);
  }

  /**
   * Force flush all pending log messages
   *
   * Call this before worker termination to ensure all logs are sent.
   */
  static flush(): void {
    if (transport) {
      transport.flushNow();
    }
  }

  /**
   * Get current buffer size (for testing/debugging)
   */
  static getBufferSize(): number {
    return transport?.getBufferSize() ?? 0;
  }

  /**
   * Reset transport (for testing)
   */
  static reset(): void {
    if (transport) {
      transport.flushNow();
    }
    transport = null;
  }
}

// Default export for convenience
export default WorkerLogger;
