/**
 * Browser LoggerFactory - Browser-compatible logging for browser-app
 *
 * Provides the same API as the Electron LoggerFactory but uses console-based
 * output suitable for pure browser context (no Electron, no Node.js).
 *
 * Features:
 * - Factory pattern: createLogger('scope') returns Logger
 * - Configurable log levels via import.meta.env.VITE_LOG_LEVEL
 * - PII redaction in production mode
 * - Environment detection (isElectron, isBrowser, isWorker)
 * - Singleton pattern with cached logger instances
 *
 * Story 10.2: LoggerFactory Browser-App Adaptation
 */

/**
 * Log levels in ascending order of severity
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger interface with structured logging methods
 */
export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Configuration options for LoggerFactory
 */
export interface LoggerConfig {
  /** Global log level (default: 'info' in production, 'debug' in development) */
  level?: LogLevel;
  /** Per-scope level overrides */
  scopeLevels?: Record<string, LogLevel>;
  /** Enable PII redaction in logs (default: true in production) */
  redactPII?: boolean;
}

// Log level priority (lower = more verbose)
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Cached logger instances (singleton per scope)
const loggerCache = new Map<string, Logger>();

// Configuration
let globalConfig: LoggerConfig = {
  level: undefined, // Will be determined at runtime
  scopeLevels: {},
  redactPII: true,
};

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Check if running in an Electron context
 *
 * Detects Electron by checking for window.process.type which is set by Electron's
 * contextBridge or legacy nodeIntegration.
 *
 * @returns true if running in Electron (main or renderer process)
 */
export function isElectron(): boolean {
  // Check for Electron-specific globals
  if (typeof window !== 'undefined') {
    // Modern Electron with contextIsolation
    const win = window as Window & {
      process?: { type?: string; versions?: { electron?: string } };
    };
    if (win.process?.versions?.electron) {
      return true;
    }
    // Legacy nodeIntegration
    if (win.process?.type) {
      return true;
    }
  }
  // Node.js environment check (for Electron main process)
  // In browser context, 'process' is not defined, so we need to check globalThis
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globalObj = globalThis as any;
  if (globalObj.process?.versions?.electron) {
    return true;
  }
  return false;
}

/**
 * Check if running in a browser context (not Electron)
 *
 * @returns true if running in a standard browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && !isElectron();
}

/**
 * Check if running in a Web Worker context
 *
 * @returns true if running in a Web Worker (SharedWorker, ServiceWorker, or dedicated Worker)
 */
export function isWorker(): boolean {
  return (
    typeof self !== 'undefined' &&
    typeof window === 'undefined' &&
    typeof self.postMessage === 'function'
  );
}

/**
 * Check if running in development mode
 *
 * Uses Vite's import.meta.env.DEV for detection.
 *
 * @returns true if in development mode
 */
export function isDevelopment(): boolean {
  // Vite provides import.meta.env.DEV
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env.DEV === true;
  }
  // Fallback for non-Vite environments (e.g., tests)
  return true;
}

// ============================================================================
// PII Redaction
// ============================================================================

/**
 * Redact sensitive data from log messages
 *
 * Removes PII patterns: emails, phone numbers, IBANs, AHV numbers
 * Same patterns as Electron LoggerFactory for consistency.
 *
 * @param text - The text to redact
 * @returns The text with PII patterns replaced with [TYPE_REDACTED]
 */
export function redactSensitiveData(text: string): string {
  return (
    text
      // Email addresses
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        '[EMAIL_REDACTED]',
      )
      // IBAN (Swiss and EU) - must come before phone to avoid partial matches
      .replace(
        /\b[A-Z]{2}\d{2}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{0,4}\b/g,
        '[IBAN_REDACTED]',
      )
      // Swiss AHV number (756.XXXX.XXXX.XX) - must come before phone to avoid partial matches
      .replace(/756\.\d{4}\.\d{4}\.\d{2}/g, '[AHV_REDACTED]')
      // Phone numbers (international format) - after IBAN and AHV to avoid clobbering
      .replace(
        /\+?\d{1,4}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g,
        '[PHONE_REDACTED]',
      )
  );
}

// ============================================================================
// Log Level Management
// ============================================================================

/**
 * Get the configured log level from environment
 *
 * @returns The log level from VITE_LOG_LEVEL or default based on environment
 */
function getEnvLogLevel(): LogLevel | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const envLevel = import.meta.env.VITE_LOG_LEVEL?.toLowerCase() as
      | LogLevel
      | undefined;
    if (envLevel && LOG_LEVEL_PRIORITY[envLevel] !== undefined) {
      return envLevel;
    }
  }
  return undefined;
}

/**
 * Get effective log level for a scope
 *
 * Priority order:
 * 1. Per-scope override
 * 2. VITE_LOG_LEVEL environment variable
 * 3. Global config level
 * 4. Default based on development mode
 *
 * @param scope - The logger scope
 * @returns The effective log level
 */
function getEffectiveLevel(scope: string): LogLevel {
  // 1. Check per-scope override
  if (globalConfig.scopeLevels?.[scope]) {
    return globalConfig.scopeLevels[scope];
  }

  // 2. Check VITE_LOG_LEVEL environment variable
  const envLevel = getEnvLogLevel();
  if (envLevel) {
    return envLevel;
  }

  // 3. Check global config
  if (globalConfig.level) {
    return globalConfig.level;
  }

  // 4. Default based on environment
  return isDevelopment() ? 'debug' : 'info';
}

/**
 * Check if a message at given level should be logged
 *
 * @param messageLevel - The level of the message
 * @param scope - The logger scope
 * @returns true if the message should be logged
 */
function shouldLog(messageLevel: LogLevel, scope: string): boolean {
  const effectiveLevel = getEffectiveLevel(scope);
  return LOG_LEVEL_PRIORITY[messageLevel] >= LOG_LEVEL_PRIORITY[effectiveLevel];
}

// ============================================================================
// Message Formatting
// ============================================================================

/**
 * Format a log message with timestamp and scope
 *
 * Matches Electron LoggerFactory format for consistency.
 *
 * @param scope - The logger scope
 * @param message - The log message
 * @param metadata - Optional metadata object
 * @returns Formatted message string
 */
function formatMessage(
  scope: string,
  message: string,
  metadata?: Record<string, unknown>,
): string {
  const timestamp = new Date().toISOString().substring(11, 23);
  const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
  const paddedScope = scope.padEnd(16);
  return `${timestamp} [${paddedScope}] ${message}${metaStr}`;
}

/**
 * Process message with optional PII redaction
 *
 * @param message - The log message
 * @param metadata - Optional metadata
 * @returns Tuple of [redacted message, redacted metadata]
 */
function processMessage(
  message: string,
  metadata?: Record<string, unknown>,
): [string, Record<string, unknown> | undefined] {
  // Only redact in production mode
  if (globalConfig.redactPII && !isDevelopment()) {
    const redactedMsg = redactSensitiveData(message);
    const redactedMeta = metadata
      ? (JSON.parse(
        redactSensitiveData(JSON.stringify(metadata)),
      ) as Record<string, unknown>)
      : undefined;
    return [redactedMsg, redactedMeta];
  }
  return [message, metadata];
}

// ============================================================================
// Logger Creation
// ============================================================================

/**
 * Create a console-based logger for browser context
 *
 * @param scope - The logger scope (e.g., 'fileProcessor', 'pii')
 * @returns A Logger instance
 */
function createConsoleLogger(scope: string): Logger {
  return {
    debug(message: string, metadata?: Record<string, unknown>): void {
      if (shouldLog('debug', scope)) {
        const [msg, meta] = processMessage(message, metadata);
         
        console.debug(formatMessage(scope, msg, meta));
      }
    },
    info(message: string, metadata?: Record<string, unknown>): void {
      if (shouldLog('info', scope)) {
        const [msg, meta] = processMessage(message, metadata);
         
        console.info(formatMessage(scope, msg, meta));
      }
    },
    warn(message: string, metadata?: Record<string, unknown>): void {
      if (shouldLog('warn', scope)) {
        const [msg, meta] = processMessage(message, metadata);
         
        console.warn(formatMessage(scope, msg, meta));
      }
    },
    error(message: string, metadata?: Record<string, unknown>): void {
      if (shouldLog('error', scope)) {
        const [msg, meta] = processMessage(message, metadata);
         
        console.error(formatMessage(scope, msg, meta));
      }
    },
  };
}

// ============================================================================
// LoggerFactory Class
// ============================================================================

/**
 * LoggerFactory - Central factory for creating scoped loggers in browser-app
 *
 * @example
 * ```typescript
 * import { LoggerFactory } from './utils/logger';
 *
 * const log = LoggerFactory.create('myModule');
 * log.info('Processing started', { itemCount: 10 });
 * log.error('Processing failed', { error: err.message });
 * ```
 */
export class LoggerFactory {
  /**
   * Create a scoped logger instance
   *
   * @param scope - The module or service name (e.g., 'fileProcessor', 'pii', 'ui')
   * @returns A Logger instance with debug, info, warn, error methods
   *
   * @example
   * ```typescript
   * const log = LoggerFactory.create('filePreview');
   * log.info('Loading preview', { fileName: 'example.pdf' });
   * ```
   */
  static create(scope: string): Logger {
    // Check cache first (singleton pattern)
    const cached = loggerCache.get(scope);
    if (cached) {
      return cached;
    }

    // Create console-based logger (browser always uses console)
    const logger = createConsoleLogger(scope);

    // Cache and return
    loggerCache.set(scope, logger);
    return logger;
  }

  /**
   * Configure global settings
   *
   * @param config - Configuration options
   */
  static configure(config: LoggerConfig): void {
    globalConfig = { ...globalConfig, ...config };
    // Clear cache to apply new settings
    loggerCache.clear();
  }

  /**
   * Set global log level
   *
   * @param level - The minimum log level to output
   */
  static setLevel(level: LogLevel): void {
    globalConfig.level = level;
    loggerCache.clear();
  }

  /**
   * Set log level for a specific scope
   *
   * @param scope - The scope name
   * @param level - The minimum log level for this scope
   */
  static setScopeLevel(scope: string, level: LogLevel): void {
    if (!globalConfig.scopeLevels) {
      globalConfig.scopeLevels = {};
    }
    globalConfig.scopeLevels[scope] = level;

    // Clear cached logger for this scope
    loggerCache.delete(scope);
  }

  /**
   * Check if running in development mode
   *
   * @returns true if in development mode
   */
  static isDevelopment(): boolean {
    return isDevelopment();
  }

  /**
   * Clear the logger cache (useful for testing)
   */
  static clearCache(): void {
    loggerCache.clear();
  }

  /**
   * Reset configuration to defaults (useful for testing)
   */
  static resetConfig(): void {
    globalConfig = {
      level: undefined,
      scopeLevels: {},
      redactPII: true,
    };
    loggerCache.clear();
  }
}

// ============================================================================
// Worker Log Receiver (Story 10.3)
// ============================================================================

/**
 * Worker log message structure (matches WorkerLogger.ts)
 */
export interface WorkerLogMessage {
  type: 'log';
  level: LogLevel;
  scope: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Batch of log messages from worker
 */
export interface WorkerLogBatch {
  type: 'worker-logs';
  logs: WorkerLogMessage[];
}

/**
 * Handle log messages from a Web Worker
 *
 * This function should be called in the worker's onmessage handler
 * when receiving 'worker-logs' type messages.
 *
 * @param event - The MessageEvent from the worker
 * @returns true if the event was a worker-logs message, false otherwise
 *
 * @example
 * ```typescript
 * worker.onmessage = (event) => {
 *   if (handleWorkerLogs(event)) {
 *     return; // Log message handled
 *   }
 *   // Handle other message types...
 * };
 * ```
 */
export function handleWorkerLogs(event: MessageEvent): boolean {
  const data = event.data as WorkerLogBatch | undefined;

  if (data?.type !== 'worker-logs' || !Array.isArray(data.logs)) {
    return false;
  }

  for (const logEntry of data.logs) {
    // Create logger with worker: prefix for clarity
    const workerScope = `worker:${logEntry.scope}`;
    const logger = LoggerFactory.create(workerScope);

    // Prepend [Worker] to message for visual distinction in DevTools
    const workerMessage = `[Worker] ${logEntry.message}`;

    // Route through the appropriate log level
    // PII redaction and level filtering happen in the logger
    switch (logEntry.level) {
      case 'debug':
        logger.debug(workerMessage, logEntry.data);
        break;
      case 'info':
        logger.info(workerMessage, logEntry.data);
        break;
      case 'warn':
        logger.warn(workerMessage, logEntry.data);
        break;
      case 'error':
        logger.error(workerMessage, logEntry.data);
        break;
    }
  }

  return true;
}

/**
 * Create a message handler that includes worker log handling
 *
 * Utility function to simplify worker message handling setup.
 *
 * @param handler - Handler for non-log messages
 * @returns Combined message handler
 *
 * @example
 * ```typescript
 * worker.onmessage = createWorkerMessageHandler((event) => {
 *   // Handle non-log messages here
 *   if (event.data.type === 'result') {
 *     // process result...
 *   }
 * });
 * ```
 */
export function createWorkerMessageHandler(
  handler: (event: MessageEvent) => void,
): (event: MessageEvent) => void {
  return (event: MessageEvent) => {
    // Try to handle as worker logs first
    if (handleWorkerLogs(event)) {
      return;
    }
    // Otherwise, pass to the provided handler
    handler(event);
  };
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Convenience function to create a logger (backward compatible)
 *
 * @param scope - The module or service name
 * @returns A Logger instance
 *
 * @example
 * ```typescript
 * import { createLogger } from './utils/logger';
 * const log = createLogger('myModule');
 * ```
 */
export function createLogger(scope: string): Logger {
  return LoggerFactory.create(scope);
}

/**
 * Set global log level
 *
 * @param level - The minimum log level to output
 */
export function setLogLevel(level: LogLevel): void {
  LoggerFactory.setLevel(level);
}
