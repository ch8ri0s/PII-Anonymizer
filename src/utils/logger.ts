/**
 * TypeScript Logger Wrapper
 *
 * @deprecated Use LoggerFactory.ts instead. This module is kept for backward compatibility
 * and will be removed in a future version.
 *
 * Migration: import { createLogger } from './LoggerFactory.js';
 *
 * Provides typed logging interfaces for TypeScript files using electron-log.
 * This wrapper ensures type safety and consistent logging patterns across the codebase.
 * Falls back to console logging when not in Electron context (e.g., tests).
 */

/**
 * Logger interface with structured logging methods
 */
export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

// Check if we're in an Electron context
const isElectronContext = !!(process.versions && process.versions.electron);

/**
 * Dynamic electron-log module - uses 'any' because:
 * 1. Type definitions not available when running outside Electron
 * 2. Dynamic require() loses type information
 * 3. Only accessed at runtime in Electron context
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let electronLog: any = null;

// Only import electron-log if we're in Electron context
if (isElectronContext) {
  try {
    // Dynamic import to avoid breaking non-Electron environments
    // eslint-disable-next-line no-undef
    electronLog = require('electron-log/main');
  } catch {
    // Fallback to null - console will be used
  }
}

/**
 * Console-based fallback logger for non-Electron environments
 */
function createConsoleLogger(scope: string): Logger {
  const formatMessage = (_level: string, message: string, metadata?: Record<string, unknown>): string => {
    const timestamp = new Date().toISOString().substring(11, 23);
    const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    return `${timestamp} (${scope}) ${' '.repeat(Math.max(0, 12 - scope.length))}› ${message}${metaStr}`;
  };

  return {
    debug(message: string, metadata?: Record<string, unknown>): void {
      console.debug(formatMessage('debug', message, metadata));
    },
    info(message: string, metadata?: Record<string, unknown>): void {
      console.info(formatMessage('info', message, metadata));
    },
    warn(message: string, metadata?: Record<string, unknown>): void {
      console.warn(formatMessage('warn', message, metadata));
    },
    error(message: string, metadata?: Record<string, unknown>): void {
      console.error(formatMessage('error', message, metadata));
    },
  };
}

/**
 * Create a scoped logger for a specific module
 *
 * @param scope - The module or service name (e.g., 'filePreview', 'converter', 'security')
 * @returns A scoped logger instance with structured logging methods
 *
 * @example
 * ```typescript
 * import { createLogger } from './utils/logger';
 *
 * const log = createLogger('filePreview');
 * log.info('Processing file', { fileName: 'example.pdf', size: 1024 });
 * log.error('Failed to process', { error: err.message });
 * ```
 */
export function createLogger(scope: string): Logger {
  // Use console fallback if not in Electron context
  if (!electronLog) {
    return createConsoleLogger(scope);
  }

  const scopedLog = electronLog.scope(scope);

  return {
    debug(message: string, metadata?: Record<string, unknown>): void {
      if (metadata) {
        scopedLog.debug(message, metadata);
      } else {
        scopedLog.debug(message);
      }
    },

    info(message: string, metadata?: Record<string, unknown>): void {
      if (metadata) {
        scopedLog.info(message, metadata);
      } else {
        scopedLog.info(message);
      }
    },

    warn(message: string, metadata?: Record<string, unknown>): void {
      if (metadata) {
        scopedLog.warn(message, metadata);
      } else {
        scopedLog.warn(message);
      }
    },

    error(message: string, metadata?: Record<string, unknown>): void {
      if (metadata) {
        scopedLog.error(message, metadata);
      } else {
        scopedLog.error(message);
      }
    },
  };
}

/**
 * Default logger instance for general use
 */
export const defaultLogger = createLogger('app');
