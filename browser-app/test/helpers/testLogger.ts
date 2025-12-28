/**
 * Test Logger Helper - Centralized logging for browser-app test files (Vitest)
 *
 * Provides a consistent logging strategy for test files:
 * - Default log level is 'warn' (errors and warnings only)
 * - VITE_LOG_LEVEL=debug enables verbose output for debugging
 * - Uses browser-compatible LoggerFactory from src/utils/logger.ts
 *
 * Story 10.8: Test File Logger Migration
 */

import {
  LoggerFactory,
  createLogger,
  setLogLevel,
  type Logger,
  type LogLevel,
} from '../../src/utils/logger';

// Respect VITE_LOG_LEVEL environment variable, default to 'warn' for clean CI output
// In Vitest, we can also check process.env for LOG_LEVEL set in CI
const getLogLevel = (): LogLevel => {
  // Check Vite environment variable first
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_LOG_LEVEL) {
    return import.meta.env.VITE_LOG_LEVEL.toLowerCase() as LogLevel;
  }
  // Fallback to process.env for CI environments (Vitest exposes this)
  if (typeof process !== 'undefined' && process.env?.LOG_LEVEL) {
    return process.env.LOG_LEVEL.toLowerCase() as LogLevel;
  }
  // Default to 'warn' for clean test output
  return 'warn';
};

// Initialize log level
const level = getLogLevel();
setLogLevel(level);

/**
 * Default test logger
 *
 * Use this for general test logging when a specific scope is not needed.
 *
 * @example
 * ```typescript
 * import { testLogger } from '../helpers/testLogger';
 *
 * testLogger.info('Test setup complete');
 * testLogger.debug('Processing item', { id: 123 });
 * ```
 */
export const testLogger: Logger = createLogger('test');

/**
 * Factory for scoped test loggers
 *
 * Creates a logger with a test-prefixed scope for better organization
 * in log output. Use this when you want to identify logs from specific
 * test files or test suites.
 *
 * @param scope - The test scope (e.g., 'integration', 'converter:pdf', 'pii')
 * @returns A Logger instance with `test:${scope}` prefix
 *
 * @example
 * ```typescript
 * import { createTestLogger } from '../helpers/testLogger';
 *
 * const log = createTestLogger('integration:pipeline');
 * log.info('Running full pipeline test');
 * log.debug('Processing file', { fileName: 'test.pdf' });
 * ```
 */
export function createTestLogger(scope: string): Logger {
  return createLogger(`test:${scope}`);
}

/**
 * Helper to temporarily enable debug logging for a specific test
 *
 * Useful when you need verbose output for debugging a specific test
 * without affecting other tests. Automatically restores the original
 * log level when the function completes.
 *
 * @param fn - The function to run with debug logging enabled
 * @returns The return value of the function
 *
 * @example
 * ```typescript
 * import { withDebugLogging, testLogger } from '../helpers/testLogger';
 *
 * it('should process complex data', async () => {
 *   await withDebugLogging(async () => {
 *     // All debug logs will be visible during this test
 *     testLogger.debug('Starting complex processing');
 *     const result = await processComplexData();
 *     testLogger.debug('Completed', { result });
 *   });
 * });
 * ```
 */
export async function withDebugLogging<T>(
  fn: () => T | Promise<T>,
): Promise<T> {
  const originalLevel = getLogLevel();
  setLogLevel('debug');

  try {
    return await fn();
  } finally {
    setLogLevel(originalLevel);
  }
}

/**
 * Set the test log level programmatically
 *
 * Useful for test setup/teardown hooks when you need to change
 * the log level for an entire test suite.
 *
 * @param level - The log level to set
 *
 * @example
 * ```typescript
 * import { setTestLogLevel } from '../helpers/testLogger';
 *
 * beforeAll(() => {
 *   setTestLogLevel('debug'); // Enable verbose logging for this suite
 * });
 *
 * afterAll(() => {
 *   setTestLogLevel('warn'); // Restore default
 * });
 * ```
 */
export function setTestLogLevel(newLevel: LogLevel): void {
  setLogLevel(newLevel);
}

/**
 * Reset logger configuration for testing
 *
 * Clears the logger cache and resets configuration to defaults.
 * Useful in beforeEach/afterEach hooks for test isolation.
 *
 * @example
 * ```typescript
 * import { resetLoggerConfig } from '../helpers/testLogger';
 *
 * afterEach(() => {
 *   resetLoggerConfig();
 * });
 * ```
 */
export function resetLoggerConfig(): void {
  LoggerFactory.resetConfig();
}

/**
 * Re-export types for convenience
 */
export type { Logger, LogLevel };
