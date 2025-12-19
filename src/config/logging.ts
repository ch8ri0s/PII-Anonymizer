/**
 * Logging Configuration
 *
 * @deprecated Use LoggerFactory.ts instead. This module is kept for backward compatibility
 * and will be removed in a future version.
 *
 * Migration: import { LoggerFactory, createLogger } from './utils/LoggerFactory.js';
 *
 * Centralized configuration for electron-log v5.x
 * Provides structured logging, PII redaction, and multi-process support
 */

import path from 'path';

/**
 * Logger interface for scoped loggers
 */
interface ScopedLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  verbose: (...args: unknown[]) => void;
}

/**
 * Log message for hooks
 */
interface LogMessage {
  data: unknown[];
  [key: string]: unknown;
}

/**
 * Log transport interface
 */
interface LogTransport {
  name: string;
  level?: string;
  format?: string;
  maxSize?: number;
  archiveLog?: (oldLogFile: string) => string;
  getFile?: () => { path: string };
}

/**
 * Console logger interface
 */
interface ConsoleLogger extends ScopedLogger {
  scope: (name: string) => ScopedLogger;
  transports: {
    file: { getFile: () => { path: string } };
    console?: LogTransport;
  };
  initialize: () => void;
  hooks: Array<(message: LogMessage, transport: LogTransport) => LogMessage>;
  variables: Record<string, unknown>;
}

/**
 * Electron log instance type (simplified - uses any for compatibility with electron-log)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ElectronLog = any;

// Dynamically import electron-log and electron only when in Electron context
let log: ElectronLog | null = null;
let app: { isPackaged: boolean } | null = null;
let isElectronContext = false;
let electronInitialized = false;

// Check Electron context synchronously (safe - no imports yet)
if (typeof process !== 'undefined' && process.versions && 'electron' in process.versions) {
  isElectronContext = true;
}

/**
 * Initialize Electron logging (lazy, async)
 * Called internally when logger is first used in Electron context
 */
async function initializeElectronLogging(): Promise<void> {
  if (electronInitialized || !isElectronContext) return;
  electronInitialized = true;

  try {
    const electronLog = await import('electron-log/main.js');
    const electron = await import('electron');
    log = electronLog.default;
    app = electron.app;
  } catch {
    // Failed to load electron modules - fall back to console
    isElectronContext = false;
  }
}

// Console-based fallback logger for non-Electron environments
const consoleLogger: ConsoleLogger = {
  info: (...args: unknown[]) => console.log('[INFO]', ...args),
  warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
  error: (...args: unknown[]) => console.error('[ERROR]', ...args),
  debug: (...args: unknown[]) => console.debug('[DEBUG]', ...args),
  verbose: (...args: unknown[]) => console.log('[VERBOSE]', ...args),
  scope: (name: string): ScopedLogger => ({
    info: (...args: unknown[]) => console.log(`[INFO] [${name}]`, ...args),
    warn: (...args: unknown[]) => console.warn(`[WARN] [${name}]`, ...args),
    error: (...args: unknown[]) => console.error(`[ERROR] [${name}]`, ...args),
    debug: (...args: unknown[]) => console.debug(`[DEBUG] [${name}]`, ...args),
    verbose: (...args: unknown[]) => console.log(`[VERBOSE] [${name}]`, ...args),
  }),
  transports: {
    file: { getFile: () => ({ path: '/dev/null' }) },
  },
  initialize: () => { /* no-op */ },
  hooks: [],
  variables: {},
};

/**
 * Configure electron-log for the application
 * Call this once in main.js during app.whenReady()
 */
export async function configureLogging(): Promise<ConsoleLogger | ElectronLog> {
  // Initialize Electron logging if in Electron context
  await initializeElectronLogging();

  // Use console fallback in non-Electron environments
  if (!isElectronContext || !log || !app) {
    return consoleLogger;
  }

  // Set log levels based on environment
  const isDev = !app.isPackaged;

  if (isDev) {
    // Development: verbose logging to console and file
    log.transports.console.level = 'debug';
    log.transports.file.level = 'debug';
  } else {
    // Production: info and above, structured JSON format
    log.transports.console.level = 'warn';
    log.transports.file.level = 'info';
    log.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] [{scope}] {text}';
  }

  // Configure file transport
  log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
  log.transports.file.archiveLog = (oldLogFile: string): string => {
    // Keep up to 5 archived log files
    const info = path.parse(oldLogFile);
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    return path.join(info.dir, `${info.name}.${timestamp}${info.ext}`);
  };

  // Add custom format for better readability
  log.transports.console.format = isDev
    ? '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {scope} {text}'
    : '[{level}] {text}';

  // Configure default metadata
  log.variables['label'] = 'A5-PII-Anonymizer';
  log.variables['processType'] = (process as NodeJS.Process & { type?: string }).type ?? 'main';

  // Add hooks for sensitive data redaction
  log.hooks.push((message: LogMessage, transport: LogTransport): LogMessage => {
    if (!isDev && transport.name === 'file') {
      // Redact sensitive patterns in production file logs
      message.data = message.data.map((item: unknown) => {
        if (typeof item === 'string') {
          return redactSensitiveData(item);
        }
        return item;
      });
    }
    return message;
  });

  // Initialize IPC for renderer process logs
  log.initialize();

  log.info('Logging system initialized', {
    environment: isDev ? 'development' : 'production',
    logPath: log.transports.file.getFile?.().path ?? 'unknown',
    consoleLevel: log.transports.console.level,
    fileLevel: log.transports.file.level,
  });

  return log;
}

/**
 * Redact sensitive data from log messages
 * Removes PII patterns: emails, phone numbers, IBANs, AHV numbers, file paths
 *
 * @param text - Log message text
 * @returns Redacted text
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
    // File paths (Unix and Windows)
    .replace(/(?:\/[\w.-]+)+/g, '[PATH_REDACTED]')
    .replace(/[A-Z]:\\(?:[\w.-]+\\)+[\w.-]*/gi, '[PATH_REDACTED]');
}

/**
 * Create a scoped logger for a specific module
 *
 * @param scope - Module or component name (e.g., 'fileProcessor', 'ipc', 'security')
 * @returns Scoped logger instance
 */
export function createLogger(scope: string): ScopedLogger {
  const logger = isElectronContext && log ? log : consoleLogger;
  return logger.scope(scope);
}

/**
 * Get log file path for sharing with support
 *
 * @returns Absolute path to current log file
 */
export function getLogFilePath(): string {
  const logger = isElectronContext && log ? log : consoleLogger;
  return logger.transports.file.getFile().path;
}

// Export the appropriate logger based on context
export default isElectronContext && log ? log : consoleLogger;
