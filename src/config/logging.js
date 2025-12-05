/**
 * Logging Configuration
 *
 * Centralized configuration for electron-log v5.x
 * Provides structured logging, PII redaction, and multi-process support
 */

import path from 'path';

// Dynamically import electron-log and electron only when in Electron context
let log = null;
let app = null;
let isElectronContext = false;

try {
  // Check if we're in an Electron context
  if (process.versions && process.versions.electron) {
    isElectronContext = true;
    // Dynamic import workaround for ESM - these will be available synchronously after first load
    const electronLog = await import('electron-log/main.js');
    const electron = await import('electron');
    log = electronLog.default;
    app = electron.app;
  }
} catch {
  // Not in Electron context - use console fallback
  isElectronContext = false;
}

// Console-based fallback logger for non-Electron environments
const consoleLogger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => console.debug('[DEBUG]', ...args),
  verbose: (...args) => console.log('[VERBOSE]', ...args),
  scope: (name) => ({
    info: (...args) => console.log(`[INFO] [${name}]`, ...args),
    warn: (...args) => console.warn(`[WARN] [${name}]`, ...args),
    error: (...args) => console.error(`[ERROR] [${name}]`, ...args),
    debug: (...args) => console.debug(`[DEBUG] [${name}]`, ...args),
    verbose: (...args) => console.log(`[VERBOSE] [${name}]`, ...args),
  }),
  transports: {
    file: { getFile: () => ({ path: '/dev/null' }) }
  },
  initialize: () => {},
  hooks: [],
  variables: {},
};

/**
 * Configure electron-log for the application
 * Call this once in main.js during app.whenReady()
 */
export function configureLogging() {
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
  log.transports.file.archiveLog = (oldLogFile) => {
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
  log.variables.label = 'A5-PII-Anonymizer';
  log.variables.processType = process.type || 'main';

  // Add hooks for sensitive data redaction
  log.hooks.push((message, transport) => {
    if (!isDev && transport.name === 'file') {
      // Redact sensitive patterns in production file logs
      message.data = message.data.map(item => {
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

  log.info('✓ Logging system initialized', {
    environment: isDev ? 'development' : 'production',
    logPath: log.transports.file.getFile().path,
    consoleLevel: log.transports.console.level,
    fileLevel: log.transports.file.level,
  });

  return log;
}

/**
 * Redact sensitive data from log messages
 * Removes PII patterns: emails, phone numbers, IBANs, AHV numbers, file paths
 *
 * @param {string} text - Log message text
 * @returns {string} - Redacted text
 */
function redactSensitiveData(text) {
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
 * @param {string} scope - Module or component name (e.g., 'fileProcessor', 'ipc', 'security')
 * @returns {Object} - Scoped logger instance
 */
export function createLogger(scope) {
  const logger = isElectronContext && log ? log : consoleLogger;
  return logger.scope(scope);
}

/**
 * Get log file path for sharing with support
 *
 * @returns {string} - Absolute path to current log file
 */
export function getLogFilePath() {
  const logger = isElectronContext && log ? log : consoleLogger;
  return logger.transports.file.getFile().path;
}

// Export the appropriate logger based on context
export default isElectronContext && log ? log : consoleLogger;
