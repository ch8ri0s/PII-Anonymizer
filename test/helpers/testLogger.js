/**
 * Test Logger Helper - Centralized logging for Electron test files
 *
 * Provides a consistent logging strategy for test files:
 * - Default log level is 'warn' (errors and warnings only)
 * - LOG_LEVEL=debug enables verbose output for debugging
 * - Uses LoggerFactory for consistency with production code
 *
 * Story 10.8: Test File Logger Migration
 */

import { LoggerFactory } from '../../src/utils/LoggerFactory.js';

// Respect LOG_LEVEL environment variable, default to 'warn' for clean CI output
const level = process.env.LOG_LEVEL?.toLowerCase() || 'warn';
LoggerFactory.setLevel(level);

/**
 * Default test logger
 *
 * Use this for general test logging when a specific scope is not needed.
 *
 * @example
 * ```javascript
 * import { testLogger } from '../helpers/testLogger.js';
 *
 * testLogger.info('Test setup complete');
 * testLogger.debug('Processing item', { id: 123 });
 * ```
 */
export const testLogger = LoggerFactory.create('test');

/**
 * Factory for scoped test loggers
 *
 * Creates a logger with a test-prefixed scope for better organization
 * in log output. Use this when you want to identify logs from specific
 * test files or test suites.
 *
 * @param {string} scope - The test scope (e.g., 'integration', 'unit:pii', 'performance')
 * @returns {import('../../src/utils/LoggerFactory.js').Logger} A Logger instance with `test:${scope}` prefix
 *
 * @example
 * ```javascript
 * import { createTestLogger } from '../helpers/testLogger.js';
 *
 * const log = createTestLogger('integration:pipeline');
 * log.info('Running full pipeline test');
 * log.debug('Processing file', { fileName: 'test.pdf' });
 * ```
 */
export function createTestLogger(scope) {
  return LoggerFactory.create(`test:${scope}`);
}

/**
 * Helper to temporarily enable debug logging for a specific test
 *
 * Useful when you need verbose output for debugging a specific test
 * without affecting other tests. Automatically restores the original
 * log level when the function completes.
 *
 * @param {function(): T | Promise<T>} fn - The function to run with debug logging enabled
 * @returns {Promise<T>} The return value of the function
 *
 * @example
 * ```javascript
 * import { withDebugLogging, testLogger } from '../helpers/testLogger.js';
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
export async function withDebugLogging(fn) {
  const originalLevel = process.env.LOG_LEVEL;
  LoggerFactory.setLevel('debug');

  try {
    return await fn();
  } finally {
    LoggerFactory.setLevel(originalLevel || 'warn');
  }
}

/**
 * Set the test log level programmatically
 *
 * Useful for test setup/teardown hooks when you need to change
 * the log level for an entire test suite.
 *
 * @param {string} newLevel - The log level to set ('debug' | 'info' | 'warn' | 'error' | 'silent')
 *
 * @example
 * ```javascript
 * import { setTestLogLevel } from '../helpers/testLogger.js';
 *
 * before(() => {
 *   setTestLogLevel('debug'); // Enable verbose logging for this suite
 * });
 *
 * after(() => {
 *   setTestLogLevel('warn'); // Restore default
 * });
 * ```
 */
export function setTestLogLevel(newLevel) {
  LoggerFactory.setLevel(newLevel);
}
