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
| **Status** | Done |
| **Created** | 2025-12-24 |
| **Context Created** | 2025-12-27 |
| **Dev Started** | 2025-12-28 |
| **Priority** | P1 - High |

## Dev Agent Record

### Context Reference
- `docs/sprint-artifacts/stories/8-13-ml-error-recovery-with-retry-logic.context.xml`

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

- [x] `shared/pii/ml/MLRetryHandler.ts` created with retry logic
- [x] `isRetryableError` correctly classifies errors
- [x] `withRetry` implements exponential backoff
- [x] `HighRecallPass.ts` updated with retry wrapper
- [x] `BrowserHighRecallPass.ts` updated with retry wrapper
- [x] Unit tests in `test/unit/pii/ml/MLRetryHandler.test.js` (35 tests passing)
- [x] Error logging verified (no PII in logs, attempt counts included)
- [x] TypeScript compiles without errors
- [x] Configuration is documented (via JSDoc and interface)

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

## Implementation Notes (2025-12-28)

### Files Created
- `shared/pii/ml/MLRetryHandler.ts` - Core retry logic with exponential backoff

### Files Modified
- `shared/pii/ml/index.ts` - Added Story 8.13 exports
- `shared/pii/index.ts` - Added retry exports to main shared module
- `src/pii/passes/HighRecallPass.ts` - Wrapped ML inference with withRetry()
- `browser-app/src/pii/BrowserHighRecallPass.ts` - Wrapped ML inference with withRetry()

### Test Files Created
- `test/unit/pii/ml/MLRetryHandler.test.js` - 35 tests covering:
  - Error classification (retryable vs fatal)
  - Exponential backoff calculation
  - withRetry function behavior
  - MLRetryHandler class
  - Edge cases and configuration

### Key Implementation Decisions
1. **Error classification is conservative:** Unknown errors default to non-retryable to avoid masking real issues
2. **Logging excludes PII:** Only metadata (attempts, duration, textLength, error message) is logged
3. **Cross-platform consistency:** Same shared module used in Electron and Browser
4. **Default config is safe:** 3 retries, 100ms initial delay, 5s max delay, 2x backoff

### Test Results
- 35 MLRetryHandler tests passing
- 1675 total tests passing (3 pre-existing failures unrelated to this story)

---

## Senior Developer Review (AI)

### Review Details
| Field | Value |
|-------|-------|
| **Reviewer** | Olivier (AI-assisted) |
| **Date** | 2025-12-28 |
| **Outcome** | ✅ **APPROVED** |

### Summary

Story 8.13 implements a robust ML error recovery system with exponential backoff retry logic. The implementation follows best practices, uses a shared module for cross-platform consistency, and includes comprehensive test coverage. All acceptance criteria are met and all tasks verified complete.

### Acceptance Criteria Coverage

| AC# | Description | Status | Evidence |
|-----|-------------|--------|----------|
| 1 | Retry up to 3 times with exponential backoff | ✅ IMPLEMENTED | `MLRetryHandler.ts:45-51`, `MLRetryHandler.ts:152-163` |
| 2 | Retryable vs fatal errors distinguished | ✅ IMPLEMENTED | `MLRetryHandler.ts:56-101` (patterns), `MLRetryHandler.ts:117-143` (isRetryableError) |
| 3 | Retry attempts logged without PII | ✅ IMPLEMENTED | `HighRecallPass.ts:203-208`, `BrowserHighRecallPass.ts:213-218` |
| 4 | Error propagated with context after max retries | ✅ IMPLEMENTED | `MLRetryHandler.ts:246-252`, `HighRecallPass.ts:201-210` |
| 5 | Retry logic configurable | ✅ IMPLEMENTED | `MLRetryHandler.ts:13-24` (RetryConfig interface) |
| 6 | Works identically in Electron and Browser | ✅ IMPLEMENTED | Same shared module, identical config in both passes |
| 7 | Permanent errors not retried | ✅ IMPLEMENTED | `MLRetryHandler.ts:82-101` (FATAL_PATTERNS), `MLRetryHandler.ts:127-132` |

**Summary: 7 of 7 acceptance criteria fully implemented**

### Task Completion Validation

| Task | Marked | Verified | Evidence |
|------|--------|----------|----------|
| MLRetryHandler.ts created | ✅ | ✅ DONE | 302 lines with full implementation |
| isRetryableError classifies errors | ✅ | ✅ DONE | Lines 117-143, tested in 15+ test cases |
| withRetry with exponential backoff | ✅ | ✅ DONE | Lines 152-163, 200-253 |
| HighRecallPass.ts updated | ✅ | ✅ DONE | Lines 35 (import), 174-199 (wrapper) |
| BrowserHighRecallPass.ts updated | ✅ | ✅ DONE | Lines 36 (import), 190-209 (wrapper) |
| Unit tests (35 passing) | ✅ | ✅ DONE | `test/unit/pii/ml/MLRetryHandler.test.js` |
| No PII in logs | ✅ | ✅ DONE | Only metadata: attempts, duration, error.message, textLength |
| TypeScript compiles | ✅ | ✅ DONE | Compilation successful |
| Configuration documented | ✅ | ✅ DONE | JSDoc throughout, interfaces documented |

**Summary: 9 of 9 completed tasks verified, 0 questionable, 0 false completions**

### Key Findings

**Severity: None** - All implementation meets or exceeds requirements.

**Positive Observations:**
1. **Conservative error classification** - Unknown errors default to non-retryable, avoiding masking real issues
2. **Privacy-conscious logging** - Only metadata logged, no PII exposure risk
3. **Cross-platform consistency** - Same shared module ensures identical behavior
4. **Comprehensive tests** - 35 tests covering all scenarios including edge cases
5. **Clean integration** - Minimal changes to existing passes, wraps ML inference cleanly

### Test Coverage and Gaps

- ✅ Error classification: 15+ test cases for retryable vs fatal
- ✅ Exponential backoff: 4 tests including max delay cap
- ✅ withRetry behavior: 8 tests covering success, retry, failure scenarios
- ✅ Class/factory: 6 tests for OO interface
- ✅ Integration: Both passes use identical pattern

**No gaps identified.**

### Architectural Alignment

- ✅ Follows shared module pattern established in Epic 8
- ✅ Proper separation of concerns (retry logic in shared, integration in passes)
- ✅ No coupling to specific ML model implementation
- ✅ ModelManager.ts modification marked optional in story - correctly not implemented

### Security Notes

- ✅ No PII logged - only metadata (attempts, duration, error message, text length)
- ✅ No secrets or sensitive data in error messages
- ✅ Conservative defaults (3 retries, 5s max delay prevents abuse)

### Best-Practices and References

- Exponential backoff is industry standard for retry logic
- Error classification pattern follows AWS/Azure SDK patterns
- [Retry Pattern - Microsoft Azure](https://docs.microsoft.com/en-us/azure/architecture/patterns/retry)

### Action Items

**Code Changes Required:**
- None

**Advisory Notes:**
- Note: Consider adding metrics/telemetry for retry frequency in production (future enhancement)
- Note: The 3 pre-existing test failures are unrelated to this story (session isolation naming, timing flakiness)

---

### Change Log

| Date | Change |
|------|--------|
| 2025-12-28 | Senior Developer Review notes appended - APPROVED |






