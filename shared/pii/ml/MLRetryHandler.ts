/**
 * ML Error Recovery with Retry Logic (Story 8.13)
 *
 * Provides retry logic for transient ML inference failures.
 * Implements exponential backoff with configurable parameters.
 *
 * @module shared/pii/ml/MLRetryHandler
 */

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in milliseconds (default: 100) */
  initialDelayMs: number;
  /** Maximum delay in milliseconds (default: 5000) */
  maxDelayMs: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier: number;
  /** Whether to use exponential backoff (default: true) */
  useExponentialBackoff: boolean;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;
  /** The result if successful */
  result?: T;
  /** The error if failed */
  error?: Error;
  /** Number of attempts made (1 = no retries) */
  attempts: number;
  /** Total time spent including delays (ms) */
  totalDurationMs: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  useExponentialBackoff: true,
};

/**
 * Error message patterns that indicate retryable (transient) errors
 */
const RETRYABLE_PATTERNS = [
  'timeout',
  'timed out',
  'network',
  'connection',
  'econnrefused',
  'econnreset',
  'enotfound',
  'model not ready',
  'model loading',
  'temporary',
  'temporarily',
  'rate limit',
  'too many requests',
  '429', // Too Many Requests
  '502', // Bad Gateway
  '503', // Service Unavailable
  '504', // Gateway Timeout
  'service unavailable',
  'bad gateway',
  'gateway timeout',
];

/**
 * Error message patterns that indicate fatal (non-retryable) errors
 */
const FATAL_PATTERNS = [
  'invalid input',
  'model not found',
  'model corrupted',
  'corrupted',
  'out of memory',
  'oom',
  'syntax error',
  'type error',
  'reference error',
  'invalid configuration',
  'missing required',
  'unsupported',
  '400', // Bad Request (client error)
  '401', // Unauthorized
  '403', // Forbidden
  '404', // Not Found
  '405', // Method Not Allowed
  '422', // Unprocessable Entity
];

/**
 * Determine if an error is retryable (transient)
 *
 * @param error - The error to classify
 * @returns True if the error is retryable, false otherwise
 *
 * @example
 * ```typescript
 * const err = new Error('Network timeout');
 * if (isRetryableError(err)) {
 *   // Retry the operation
 * }
 * ```
 */
export function isRetryableError(error: unknown): boolean {
  // Not an error object - don't retry
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();
  const combined = `${name}: ${message}`;

  // Check for fatal errors first (they take precedence)
  for (const pattern of FATAL_PATTERNS) {
    if (combined.includes(pattern.toLowerCase())) {
      return false;
    }
  }

  // Check for retryable patterns
  for (const pattern of RETRYABLE_PATTERNS) {
    if (combined.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // Unknown error type - default to not retryable for safety
  return false;
}

/**
 * Calculate the delay for a given attempt number
 *
 * @param attempt - The current attempt number (1-based)
 * @param config - The retry configuration
 * @returns Delay in milliseconds
 */
export function calculateDelay(
  attempt: number,
  config: RetryConfig,
): number {
  if (!config.useExponentialBackoff) {
    return Math.min(config.initialDelayMs, config.maxDelayMs);
  }

  // Exponential backoff: delay = initialDelayMs * (multiplier ^ (attempt - 1))
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Sleep for a specified duration
 *
 * @param ms - Duration in milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an async function with retry logic
 *
 * Implements exponential backoff for transient errors while
 * failing immediately for fatal errors.
 *
 * @param fn - The async function to execute
 * @param config - Optional retry configuration
 * @returns Result with success status, result/error, and attempt metadata
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => await runInference(text),
 *   { maxRetries: 3, initialDelayMs: 100 }
 * );
 *
 * if (result.success) {
 *   console.log('Succeeded after', result.attempts, 'attempts');
 *   return result.result;
 * } else {
 *   console.error('Failed after', result.attempts, 'attempts:', result.error);
 *   return [];
 * }
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>,
): Promise<RetryResult<T>> {
  const cfg: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: Error | undefined;
  let attempts = 0;

  while (attempts <= cfg.maxRetries) {
    attempts++;

    try {
      const result = await fn();
      return {
        success: true,
        result,
        attempts,
        totalDurationMs: Date.now() - startTime,
      };
    } catch (error) {
      // Ensure error is an Error object
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isRetryableError(lastError)) {
        // Fatal error - fail immediately
        return {
          success: false,
          error: lastError,
          attempts,
          totalDurationMs: Date.now() - startTime,
        };
      }

      // Check if we've exhausted retries
      if (attempts > cfg.maxRetries) {
        break;
      }

      // Calculate and apply delay before next attempt
      const delay = calculateDelay(attempts, cfg);
      await sleep(delay);
    }
  }

  // All retries exhausted
  return {
    success: false,
    error: lastError ?? new Error('Max retries exceeded'),
    attempts,
    totalDurationMs: Date.now() - startTime,
  };
}

/**
 * MLRetryHandler class for object-oriented usage
 */
export class MLRetryHandler {
  private config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Execute function with retry logic
   */
  async execute<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    return withRetry(fn, this.config);
  }

  /**
   * Check if an error is retryable
   */
  isRetryable(error: unknown): boolean {
    return isRetryableError(error);
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<RetryConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  configure(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a configured MLRetryHandler instance
 */
export function createMLRetryHandler(
  config?: Partial<RetryConfig>,
): MLRetryHandler {
  return new MLRetryHandler(config);
}
