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
import { type Logger, type LogLevel } from '../../src/utils/LoggerFactory.js';
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
export declare const testLogger: Logger;
/**
 * Factory for scoped test loggers
 *
 * Creates a logger with a test-prefixed scope for better organization
 * in log output. Use this when you want to identify logs from specific
 * test files or test suites.
 *
 * @param scope - The test scope (e.g., 'integration', 'unit:pii', 'performance')
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
export declare function createTestLogger(scope: string): Logger;
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
export declare function withDebugLogging<T>(fn: () => T | Promise<T>): Promise<T>;
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
 * before(() => {
 *   setTestLogLevel('debug'); // Enable verbose logging for this suite
 * });
 *
 * after(() => {
 *   setTestLogLevel('warn'); // Restore default
 * });
 * ```
 */
export declare function setTestLogLevel(newLevel: LogLevel): void;
/**
 * Re-export types for convenience
 */
export type { Logger, LogLevel };
