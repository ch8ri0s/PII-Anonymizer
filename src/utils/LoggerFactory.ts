/**
 * LoggerFactory - Centralized Logging Factory
 *
 * Consolidates logging across the application with:
 * - Factory pattern: LoggerFactory.create('scope') returns Logger
 * - Configurable log levels via LOG_LEVEL env or per-scope overrides
 * - Multi-process support (Electron main, renderer, tests)
 * - PII redaction in production logs
 * - Singleton pattern with cached logger instances
 *
 * Story 6.1: Factory Central Logger
 */

import path from 'path';

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
  /** Custom format for console output */
  format?: string;
}

// Log level priority (lower = more verbose)
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Check if we're in an Electron context
const isElectronContext = !!(
  typeof process !== 'undefined' &&
  process.versions &&
  process.versions.electron
);

/**
 * Module-level state for dynamically imported Electron modules.
 * Uses 'any' because:
 * 1. electron-log types not available at compile time when running outside Electron
 * 2. Dynamic imports lose type information at runtime
 * 3. These modules are only accessed at runtime in Electron context
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let electronLog: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let electronApp: any = null;
let isInitialized = false;
let isDevelopment = true;

// Cached logger instances (singleton per scope)
const loggerCache = new Map<string, Logger>();

// Configuration
let globalConfig: LoggerConfig = {
  level: undefined, // Will be determined at runtime
  scopeLevels: {},
  redactPII: true,
};

/**
 * Redact sensitive data from log messages
 * Removes PII patterns: emails, phone numbers, IBANs, AHV numbers, file paths
 */
function redactSensitiveData(text: string): string {
  return text
    // Email addresses
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
    // Phone numbers (international format)
    .replace(/\+?\d{1,4}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g, '[PHONE_REDACTED]')
    // IBAN (Swiss and EU)
    .replace(/\b[A-Z]{2}\d{2}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{0,4}\b/g, '[IBAN_REDACTED]')
    // Swiss AHV number (756.XXXX.XXXX.XX)
    .replace(/756\.\d{4}\.\d{4}\.\d{2}/g, '[AHV_REDACTED]')
    // File paths (Unix) - be careful not to over-match
    .replace(/(?:\/(?:Users|home|var|tmp)\/[\w.-]+(?:\/[\w.-]+)*)/g, '[PATH_REDACTED]')
    // File paths (Windows)
    .replace(/[A-Z]:\\(?:Users|Documents|[\w.-]+)(?:\\[\w.-]+)*/gi, '[PATH_REDACTED]');
}

/**
 * Get effective log level for a scope
 */
function getEffectiveLevel(scope: string): LogLevel {
  // 1. Check per-scope override
  if (globalConfig.scopeLevels?.[scope]) {
    return globalConfig.scopeLevels[scope];
  }

  // 2. Check LOG_LEVEL environment variable
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (envLevel && LOG_LEVEL_PRIORITY[envLevel] !== undefined) {
    return envLevel;
  }

  // 3. Check global config
  if (globalConfig.level) {
    return globalConfig.level;
  }

  // 4. Default based on environment
  return isDevelopment ? 'debug' : 'info';
}

/**
 * Check if a message at given level should be logged
 */
function shouldLog(messageLevel: LogLevel, scope: string): boolean {
  const effectiveLevel = getEffectiveLevel(scope);
  return LOG_LEVEL_PRIORITY[messageLevel] >= LOG_LEVEL_PRIORITY[effectiveLevel];
}

/**
 * Format a log message with timestamp and scope
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
 * Create a console-based logger (for non-Electron or test environments)
 */
function createConsoleLogger(scope: string): Logger {
  return {
    debug(message: string, metadata?: Record<string, unknown>): void {
      if (shouldLog('debug', scope)) {
        // eslint-disable-next-line no-console
        console.debug(formatMessage(scope, message, metadata));
      }
    },
    info(message: string, metadata?: Record<string, unknown>): void {
      if (shouldLog('info', scope)) {
        // eslint-disable-next-line no-console
        console.info(formatMessage(scope, message, metadata));
      }
    },
    warn(message: string, metadata?: Record<string, unknown>): void {
      if (shouldLog('warn', scope)) {
        // eslint-disable-next-line no-console
        console.warn(formatMessage(scope, message, metadata));
      }
    },
    error(message: string, metadata?: Record<string, unknown>): void {
      if (shouldLog('error', scope)) {
        // eslint-disable-next-line no-console
        console.error(formatMessage(scope, message, metadata));
      }
    },
  };
}

/**
 * Create an electron-log based logger
 */
function createElectronLogger(scope: string): Logger {
  const scopedLog = electronLog.scope(scope);

  // Helper to process message with optional redaction
  const processMessage = (msg: string, meta?: Record<string, unknown>): [string, Record<string, unknown> | undefined] => {
    if (globalConfig.redactPII && !isDevelopment) {
      const redactedMsg = redactSensitiveData(msg);
      const redactedMeta = meta ? JSON.parse(redactSensitiveData(JSON.stringify(meta))) : undefined;
      return [redactedMsg, redactedMeta];
    }
    return [msg, meta];
  };

  return {
    debug(message: string, metadata?: Record<string, unknown>): void {
      if (shouldLog('debug', scope)) {
        const [msg, meta] = processMessage(message, metadata);
        if (meta) {
          scopedLog.debug(msg, meta);
        } else {
          scopedLog.debug(msg);
        }
      }
    },
    info(message: string, metadata?: Record<string, unknown>): void {
      if (shouldLog('info', scope)) {
        const [msg, meta] = processMessage(message, metadata);
        if (meta) {
          scopedLog.info(msg, meta);
        } else {
          scopedLog.info(msg);
        }
      }
    },
    warn(message: string, metadata?: Record<string, unknown>): void {
      if (shouldLog('warn', scope)) {
        const [msg, meta] = processMessage(message, metadata);
        if (meta) {
          scopedLog.warn(msg, meta);
        } else {
          scopedLog.warn(msg);
        }
      }
    },
    error(message: string, metadata?: Record<string, unknown>): void {
      if (shouldLog('error', scope)) {
        const [msg, meta] = processMessage(message, metadata);
        if (meta) {
          scopedLog.error(msg, meta);
        } else {
          scopedLog.error(msg);
        }
      }
    },
  };
}

/**
 * LoggerFactory - Central factory for creating scoped loggers
 *
 * @example
 * ```typescript
 * import { LoggerFactory } from './utils/LoggerFactory';
 *
 * const log = LoggerFactory.create('myModule');
 * log.info('Processing started', { itemCount: 10 });
 * log.error('Processing failed', { error: err.message });
 * ```
 */
export class LoggerFactory {
  /**
   * Initialize the LoggerFactory with electron-log (call once in main process)
   *
   * @param config - Optional configuration overrides
   * @returns Promise resolving when initialization is complete
   */
  static async initialize(config?: LoggerConfig): Promise<void> {
    if (isInitialized) return;

    // Merge config
    if (config) {
      globalConfig = { ...globalConfig, ...config };
    }

    // Try to initialize electron-log in Electron context
    if (isElectronContext) {
      try {
        const electronLogModule = await import('electron-log/main.js');
        const electronModule = await import('electron');
        electronLog = electronLogModule.default;
        electronApp = electronModule.app;
        isDevelopment = !electronApp.isPackaged;

        // Configure electron-log
        LoggerFactory.configureElectronLog();

        isInitialized = true;
      } catch {
        // Fall back to console logging
        isInitialized = true;
      }
    } else {
      // Non-Electron environment (tests, etc.)
      isDevelopment = process.env.NODE_ENV !== 'production';
      isInitialized = true;
    }
  }

  /**
   * Configure electron-log transports and settings
   */
  private static configureElectronLog(): void {
    if (!electronLog) return;

    // Set log levels based on environment
    if (isDevelopment) {
      electronLog.transports.console.level = 'debug';
      electronLog.transports.file.level = 'debug';
    } else {
      electronLog.transports.console.level = 'warn';
      electronLog.transports.file.level = 'info';
      electronLog.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] [{scope}] {text}';
    }

    // Configure file transport
    electronLog.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
    electronLog.transports.file.archiveLog = (oldLogFile: string) => {
      const info = path.parse(oldLogFile);
      const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
      return path.join(info.dir, `${info.name}.${timestamp}${info.ext}`);
    };

    // Add custom format for better readability
    electronLog.transports.console.format = isDevelopment
      ? '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope} {text}'
      : '[{level}] {text}';

    // Configure default metadata
    electronLog.variables.label = 'A5-PII-Anonymizer';
    electronLog.variables.processType = process.type || 'main';

    // Initialize IPC for renderer process logs
    electronLog.initialize();
  }

  /**
   * Create a scoped logger instance
   *
   * @param scope - The module or service name (e.g., 'fileProcessor', 'pii', 'security')
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

    // Create appropriate logger
    let logger: Logger;

    if (isElectronContext && electronLog) {
      logger = createElectronLogger(scope);
    } else {
      logger = createConsoleLogger(scope);
    }

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
   * Get the log file path (for support/debugging)
   *
   * @returns The path to the current log file, or null if not using file logging
   */
  static getLogFilePath(): string | null {
    if (electronLog?.transports?.file?.getFile) {
      return electronLog.transports.file.getFile().path;
    }
    return null;
  }

  /**
   * Check if running in development mode
   */
  static isDevelopment(): boolean {
    return isDevelopment;
  }

  /**
   * Clear the logger cache (useful for testing)
   */
  static clearCache(): void {
    loggerCache.clear();
  }
}

/**
 * Convenience function to create a logger (backward compatible)
 *
 * @param scope - The module or service name
 * @returns A Logger instance
 *
 * @example
 * ```typescript
 * import { createLogger } from './utils/LoggerFactory';
 * const log = createLogger('myModule');
 * ```
 */
export function createLogger(scope: string): Logger {
  return LoggerFactory.create(scope);
}

/**
 * Default logger instance for general use
 */
export const defaultLogger = LoggerFactory.create('app');
