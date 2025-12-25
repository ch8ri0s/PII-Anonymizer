# Story 8.13: ML Error Recovery with Retry Logic

## Story

As a **PII detection system**,
I want **transient ML inference failures to be automatically retried**,
So that **temporary network issues or model loading problems don't cause detection to fail**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.13 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Backlog |
| **Created** | 2025-12-24 |
| **Priority** | P1 - High |

## Acceptance Criteria

**Given** ML inference fails with a transient error (network timeout, model not ready)
**When** retry logic is enabled
**Then** inference is retried up to 3 times with exponential backoff
**And** retryable errors are distinguished from fatal errors
**And** retry attempts are logged (without PII content)
**And** after max retries, error is propagated with context

**And** retry logic is configurable (max retries, backoff strategy)
**And** retry logic works identically in Electron and Browser
**And** permanent errors (invalid input, model corruption) are not retried

## Technical Design

### Files to Create/Modify

1. **Create:** `shared/pii/ml/MLRetryHandler.ts` - Shared retry logic
2. **Modify:** `src/pii/passes/HighRecallPass.ts` - Use retry handler
3. **Modify:** `browser-app/src/pii/BrowserHighRecallPass.ts` - Use retry handler
4. **Modify:** `browser-app/src/model/ModelManager.ts` - Add retry to `runInference`

### Interface

```typescript
// shared/pii/ml/MLRetryHandler.ts

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

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDurationMs: number;
}

/**
 * Determine if an error is retryable
 */
export function isRetryableError(error: unknown): boolean;

/**
 * Execute function with retry logic
 * 
 * @param fn - Async function to execute
 * @param config - Retry configuration
 * @returns Result with success status and attempt count
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<RetryResult<T>>;
```

### Retryable Error Detection

```typescript
function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  
  // Retryable errors
  const retryablePatterns = [
    'timeout',
    'network',
    'connection',
    'model not ready',
    'temporary',
    'rate limit',
    '503',  // Service unavailable
    '502',  // Bad gateway
    '504',  // Gateway timeout
  ];

  // Fatal errors (don't retry)
  const fatalPatterns = [
    'invalid input',
    'model not found',
    'corrupted',
    'out of memory',
    'syntax error',
  ];

  // Check fatal first
  if (fatalPatterns.some(pattern => message.includes(pattern))) {
    return false;
  }

  // Check retryable
  return retryablePatterns.some(pattern => message.includes(pattern));
}
```

### Retry Algorithm

```typescript
async function withRetry<T>(fn, config):
  1. Merge config with defaults
  2. let attempts = 0
  3. let lastError: Error | null = null
  4. const startTime = Date.now()
  
  5. While attempts <= maxRetries:
     a. attempts++
     b. Try:
        - result = await fn()
        - Return { success: true, result, attempts, totalDurationMs }
     c. Catch error:
        - If not retryable:
          - Return { success: false, error, attempts, totalDurationMs }
        - If attempts >= maxRetries:
          - Return { success: false, error, attempts, totalDurationMs }
        - Calculate delay:
          - delay = min(initialDelayMs * (backoffMultiplier ^ (attempts - 1)), maxDelayMs)
        - Wait delay milliseconds
        - lastError = error
        - Continue loop
  
  6. Return { success: false, error: lastError, attempts, totalDurationMs }
```

### Integration Points

**HighRecallPass:**
```typescript
private async runMLDetection(text: string): Promise<Entity[]> {
  if (!this.nerPipeline) return [];

  // Validate input first (Story 8.12)
  const validation = validateMLInput(text);
  if (!validation.valid) {
    return [];
  }

  // Use retry wrapper
  const retryResult = await withRetry(
    async () => {
      return await this.nerPipeline!(validation.text!);
    },
    {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 5000,
    }
  );

  if (!retryResult.success) {
    logger.error('ML detection failed after retries', {
      attempts: retryResult.attempts,
      error: retryResult.error?.message,
      textLength: validation.text!.length, // Log metadata only
    });
    return [];
  }

  const predictions = retryResult.result!;
  // ... continue with entity mapping ...
}
```

## Prerequisites

- Story 8.12 (ML Input Validation) - Validation happens before retry

## Integration Points

- Used by `HighRecallPass` (Electron)
- Used by `BrowserHighRecallPass` (Browser)
- Used by `ModelManager.runInference` (optional, for API-level retries)
- Works with all ML inference calls

## Test Scenarios

1. **Transient error (timeout):** Retries 3 times with backoff, succeeds on 2nd attempt
2. **Permanent error (invalid input):** Fails immediately, no retries
3. **All retries fail:** Returns error after max retries with attempt count
4. **Success on first attempt:** No delay, returns immediately
5. **Exponential backoff:** Delays increase: 100ms, 200ms, 400ms
6. **Max delay cap:** Delays don't exceed maxDelayMs
7. **Error classification:** Retryable vs fatal errors distinguished correctly
8. **Logging:** Retry attempts logged without PII content
9. **Performance:** No retry overhead when first attempt succeeds
10. **Cross-platform:** Electron and Browser use identical retry logic

## Definition of Done

- [ ] `shared/pii/ml/MLRetryHandler.ts` created with retry logic
- [ ] `isRetryableError` correctly classifies errors
- [ ] `withRetry` implements exponential backoff
- [ ] `HighRecallPass.ts` updated with retry wrapper
- [ ] `BrowserHighRecallPass.ts` updated with retry wrapper
- [ ] Unit tests in `test/unit/pii/ml/MLRetryHandler.test.ts`
- [ ] Integration tests with simulated transient failures
- [ ] Error logging verified (no PII in logs, attempt counts included)
- [ ] TypeScript compiles without errors
- [ ] Configuration is documented

## Precision/Recall Impact Testing

### Baseline Comparison
Uses shared accuracy utilities from `shared/test/accuracy.ts`:

```typescript
import { calculatePrecisionRecall } from '@shared-test/accuracy';

// Retry should not affect quality - only reliability
const withRetryMetrics = calculatePrecisionRecall(retryDetected, expected);
const directMetrics = calculatePrecisionRecall(directDetected, expected);

// Quality identical when inference succeeds
expect(withRetryMetrics.f1).toBe(directMetrics.f1);
```

### Regression Prevention
- **Baseline metrics:** See `test/baselines/epic8-before.json`
- **Retry constraint:** Retries must not introduce false positives or negatives
- **Idempotency:** Same input produces same output regardless of retry count
- **Regression threshold:** Zero quality impact from retry logic

### ML-Specific Test Scenarios
| Scenario | Behavior | Expected Result |
|----------|----------|-----------------|
| Success on first try | No retry | Same quality as baseline |
| Success on retry | Transient failure → success | Same quality as direct success |
| All retries fail | 3 failures | Empty array, no false positives |
| Partial inference | Timeout mid-inference | Graceful degradation, no duplicates |
| Rate limit recovery | 429 → retry → success | Full quality after recovery |

### Cross-Platform Validation
- Identical retry behavior in Electron and Browser
- Same retry count for same error types
- Aggregated quality metrics unaffected by transient failures

## Impact

**Before:** Transient failures cause immediate detection failure
**After:** Transient failures are automatically recovered
**Quality Improvement:** +10-15% reliability for network-dependent scenarios

