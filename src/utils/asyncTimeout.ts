/**
 * Async Operation Timeout Utilities
 *
 * Story 6.5: Async Operation Timeouts
 * Provides timeout wrappers and AbortController infrastructure for async operations.
 * Story 6.8: Uses centralized TIMEOUT constants from config/constants.ts
 */

import { getErrorMessage } from '../types/errors.js';
import { TIMEOUT, PROCESSING } from '../config/constants.js';

/**
 * Processing progress information for IPC events
 */
export interface ProcessingProgress {
  /** Current processing phase */
  phase: 'converting' | 'detecting' | 'anonymizing' | 'saving';
  /** Progress percentage (0-100) */
  progress: number;
  /** Human-readable message about current operation */
  message: string;
  /** Number of entities processed so far (optional) */
  entitiesProcessed?: number;
  /** Total entities to process (optional, for percentage calculation) */
  totalEntities?: number;
}

/**
 * Timeout configuration settings
 */
export interface TimeoutConfig {
  /** File processing timeout in milliseconds */
  fileProcessing: number;
  /** File preview timeout in milliseconds */
  filePreview: number;
  /** Metadata extraction timeout in milliseconds */
  metadata: number;
  /** JSON file read timeout in milliseconds */
  jsonRead: number;
}

/**
 * Default timeout configuration values
 * Story 6.5 AC5: Default 60s, Min 10s, Max 600s (10 min)
 * Story 6.8: Uses centralized TIMEOUT constants
 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  fileProcessing: TIMEOUT.FILE_PROCESSING_MS,
  filePreview: TIMEOUT.FILE_PREVIEW_MS,
  metadata: TIMEOUT.METADATA_MS,
  jsonRead: TIMEOUT.JSON_READ_MS,
};

/** Minimum allowed timeout (AC5) - Story 6.8: from centralized TIMEOUT constants */
export const MIN_TIMEOUT_MS = TIMEOUT.MIN_MS;

/** Maximum allowed timeout (AC5) - Story 6.8: from centralized TIMEOUT constants */
export const MAX_TIMEOUT_MS = TIMEOUT.MAX_MS;

/**
 * Validates and clamps a timeout value to allowed bounds
 * Story 6.5 AC5: Timeout thresholds are configurable with min/max bounds
 *
 * @param timeoutMs - The timeout value to validate
 * @returns The clamped timeout value
 */
export function validateTimeout(timeoutMs: number): number {
  if (typeof timeoutMs !== 'number' || isNaN(timeoutMs)) {
    return DEFAULT_TIMEOUT_CONFIG.fileProcessing;
  }
  return Math.max(MIN_TIMEOUT_MS, Math.min(MAX_TIMEOUT_MS, timeoutMs));
}

/**
 * Options for the withTimeout function
 */
export interface TimeoutOptions {
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
  /** Callback when timeout occurs (before rejection) */
  onTimeout?: () => void;
  /** Cleanup function to call on abort or timeout */
  cleanup?: () => void;
}

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends Error {
  public readonly operation: string;
  public readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`${operation} timed out after ${timeoutMs}ms. The file may be too large or corrupted.`);
    this.name = 'TimeoutError';
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when an operation is aborted
 */
export class AbortError extends Error {
  public readonly operation: string;

  constructor(operation: string) {
    super(`${operation} was cancelled`);
    this.name = 'AbortError';
    this.operation = operation;
  }
}

/**
 * Type guard to check if an error is a TimeoutError
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Type guard to check if an error is an AbortError
 */
export function isAbortError(error: unknown): error is AbortError {
  return error instanceof AbortError ||
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError');
}

/**
 * Wraps a promise with timeout and cancellation support
 * Story 6.5 AC1, AC2: Timeout detection and cancellation support
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param operation - Human-readable operation name for error messages
 * @param options - Optional timeout options (signal, callbacks)
 * @returns The result of the promise or throws TimeoutError/AbortError
 *
 * @example
 * ```typescript
 * const controller = new AbortController();
 *
 * try {
 *   const result = await withTimeout(
 *     processFile(filePath),
 *     60000,
 *     'File processing',
 *     { signal: controller.signal }
 *   );
 * } catch (error) {
 *   if (isAbortError(error)) {
 *     console.log('Processing was cancelled');
 *   } else if (isTimeoutError(error)) {
 *     console.log('Processing timed out');
 *   }
 * }
 *
 * // To cancel:
 * controller.abort();
 * ```
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation = 'Operation',
  options: TimeoutOptions = {},
): Promise<T> {
  const { signal, onTimeout, cleanup } = options;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;

  // Check if already aborted
  if (signal?.aborted) {
    cleanup?.();
    throw new AbortError(operation);
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      onTimeout?.();
      reject(new TimeoutError(operation, timeoutMs));
    }, timeoutMs);
  });

  // Set up abort signal handler
  const abortPromise = signal
    ? new Promise<never>((_, reject) => {
      abortHandler = () => {
        reject(new AbortError(operation));
      };
      signal.addEventListener('abort', abortHandler);
    })
    : null;

  try {
    const racers: Promise<T | never>[] = [promise, timeoutPromise];
    if (abortPromise) {
      racers.push(abortPromise);
    }

    const result = await Promise.race(racers);
    return result;
  } catch (error: unknown) {
    // Re-throw with proper error type
    if (isTimeoutError(error) || isAbortError(error)) {
      throw error;
    }
    // Wrap other errors
    throw error;
  } finally {
    // Critical: Clean up to prevent memory leaks
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
    if (abortHandler && signal) {
      signal.removeEventListener('abort', abortHandler);
    }
    cleanup?.();
  }
}

/**
 * Calculate timeout based on file size
 * Larger files get proportionally longer timeouts, up to a maximum
 * Story 6.8: Uses PROCESSING constants for timeout calculation
 *
 * @param fileSizeBytes - File size in bytes
 * @returns Timeout in milliseconds
 */
export function calculateFileTimeout(fileSizeBytes: number): number {
  const fileSizeMB = fileSizeBytes / (1024 * 1024);
  const calculatedTimeout =
    PROCESSING.BASE_TIMEOUT_MS + (fileSizeMB * PROCESSING.PER_MB_TIMEOUT_MS);

  return validateTimeout(calculatedTimeout);
}

/**
 * Creates a cancellable processing context
 * Story 6.5 AC2: AbortController pattern for cancellation
 *
 * @param operation - Human-readable operation name
 * @returns Object with controller, signal, and utility methods
 *
 * @example
 * ```typescript
 * const ctx = createProcessingContext('File processing');
 *
 * // Check if cancelled
 * if (ctx.isCancelled()) return;
 *
 * // Throw if cancelled
 * ctx.throwIfCancelled();
 *
 * // Cancel the operation
 * ctx.cancel();
 * ```
 */
export function createProcessingContext(operation: string): {
  controller: AbortController;
  signal: AbortSignal;
  isCancelled: () => boolean;
  throwIfCancelled: () => void;
  cancel: () => void;
} {
  const controller = new AbortController();

  return {
    controller,
    signal: controller.signal,
    isCancelled: () => controller.signal.aborted,
    throwIfCancelled: () => {
      if (controller.signal.aborted) {
        throw new AbortError(operation);
      }
    },
    cancel: () => controller.abort(),
  };
}

/**
 * Progress reporter for file processing operations
 * Story 6.5 AC4: Progress reporting with throttling
 */
export class ProgressReporter {
  private readonly operation: string;
  private readonly onProgress: (progress: ProcessingProgress) => void;
  private readonly throttleMs: number;
  private lastEmitTime = 0;
  private pendingProgress: ProcessingProgress | null = null;
  private throttleTimeout: ReturnType<typeof setTimeout> | null = null;

  /**
   * Creates a new progress reporter
   *
   * @param operation - Operation name
   * @param onProgress - Callback to emit progress updates
   * @param throttleMs - Minimum time between progress updates (default: 100ms)
   */
  constructor(
    operation: string,
    onProgress: (progress: ProcessingProgress) => void,
    throttleMs = 100,
  ) {
    this.operation = operation;
    this.onProgress = onProgress;
    this.throttleMs = throttleMs;
  }

  /**
   * Reports progress (throttled to prevent IPC flooding)
   * Story 6.5 AC4: Progress updates at reasonable intervals
   */
  report(progress: ProcessingProgress): void {
    const now = Date.now();
    const timeSinceLastEmit = now - this.lastEmitTime;

    if (timeSinceLastEmit >= this.throttleMs) {
      // Emit immediately
      this.emitProgress(progress);
    } else {
      // Store and schedule delayed emit
      this.pendingProgress = progress;
      if (!this.throttleTimeout) {
        this.throttleTimeout = setTimeout(() => {
          this.throttleTimeout = null;
          if (this.pendingProgress) {
            this.emitProgress(this.pendingProgress);
            this.pendingProgress = null;
          }
        }, this.throttleMs - timeSinceLastEmit);
      }
    }
  }

  /**
   * Forces immediate progress emit (for final/important updates)
   */
  reportImmediate(progress: ProcessingProgress): void {
    if (this.throttleTimeout) {
      clearTimeout(this.throttleTimeout);
      this.throttleTimeout = null;
    }
    this.pendingProgress = null;
    this.emitProgress(progress);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.throttleTimeout) {
      clearTimeout(this.throttleTimeout);
      this.throttleTimeout = null;
    }
    this.pendingProgress = null;
  }

  private emitProgress(progress: ProcessingProgress): void {
    this.lastEmitTime = Date.now();
    try {
      this.onProgress(progress);
    } catch (error: unknown) {
      // Don't let progress errors break processing
      console.error(`Progress reporter error for ${this.operation}:`, getErrorMessage(error));
    }
  }
}

/**
 * Partial result information when processing is cancelled
 * Story 6.5 AC3: Partial result preservation
 */
export interface PartialResult<T> {
  /** Whether processing was fully completed */
  completed: boolean;
  /** Partial data available (if any) */
  data: T | null;
  /** Number of items successfully processed */
  processedCount: number;
  /** Total items that needed processing */
  totalCount: number;
  /** Error that caused early termination (if any) */
  error?: Error;
  /** Human-readable summary message */
  message: string;
}

/**
 * Creates a partial result object
 * Story 6.5 AC3: Partial results preserved on timeout/cancel
 */
export function createPartialResult<T>(
  data: T | null,
  processedCount: number,
  totalCount: number,
  error?: Error,
): PartialResult<T> {
  const completed = processedCount >= totalCount && !error;
  let message: string;

  if (completed) {
    message = `Processing complete: ${processedCount} items processed`;
  } else if (error) {
    if (isAbortError(error)) {
      message = `Processing cancelled: ${processedCount} of ${totalCount} items processed`;
    } else if (isTimeoutError(error)) {
      message = `Processing timed out: ${processedCount} of ${totalCount} items processed`;
    } else {
      message = `Processing failed: ${processedCount} of ${totalCount} items processed`;
    }
  } else {
    message = `Processing incomplete: ${processedCount} of ${totalCount} items processed`;
  }

  return {
    completed,
    data,
    processedCount,
    totalCount,
    error,
    message,
  };
}
