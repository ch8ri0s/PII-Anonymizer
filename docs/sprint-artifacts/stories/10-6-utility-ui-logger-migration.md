# Story 10.6: Utility & UI Module Logger Migration

## Story

As a **developer maintaining utility code**,
I want **all utility and UI modules to use LoggerFactory with appropriate scopes**,
So that **utility logging is consistent and filterable**.

## Status

- **Epic:** 10 - Console-to-Logger Migration
- **Priority:** Medium (post Epic 8)
- **Estimate:** XS
- **Dependencies:** Story 10.5 (migration pattern established)

## Acceptance Criteria

**Given** the utility and UI modules with console usage
**When** migration is complete
**Then** all console.* calls are replaced:

| File | Logger Scope | Notes |
|------|--------------|-------|
| `src/utils/asyncTimeout.ts` | `utils:timeout` | 3 calls |
| `src/utils/errorHandler.ts` | `utils:error` | 2 calls |
| `src/utils/LoggerFactory.ts` | `logger:internal` | 4 calls (meta-logging) |
| `src/ui/EntityReviewUI.ts` | `ui:review` | 1 call |

**And** error handler uses `log.error()` with full stack traces
**And** timeout warnings include duration: `log.warn('Operation timed out', { timeout: ms })`
**And** UI interactions use debug level (minimal noise)
**And** LoggerFactory internal errors go to console as last resort (bootstrap problem)

## Technical Notes

- errorHandler.ts: Ensure errors are properly serialized (Error objects don't stringify well)
- LoggerFactory.ts: Keep 1-2 console.error for bootstrap failures (can't log if logger broken)
- asyncTimeout.ts: Include operation name in timeout logs for debugging

## Implementation Guidance

### Error Serialization Pattern

```typescript
// src/utils/errorHandler.ts
import { LoggerFactory } from './LoggerFactory';

const log = LoggerFactory.create('utils:error');

function handleError(error: unknown, context?: string): void {
  const errorInfo = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context
  };

  log.error('Unhandled error', errorInfo);
}
```

### Timeout Warning Pattern

```typescript
// src/utils/asyncTimeout.ts
import { LoggerFactory } from './LoggerFactory';

const log = LoggerFactory.create('utils:timeout');

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      log.warn('Operation timed out', {
        operation: operationName,
        timeout: timeoutMs
      });
      reject(new Error(`Operation '${operationName}' timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([operation, timeoutPromise]);
}
```

### LoggerFactory Bootstrap Exception

```typescript
// src/utils/LoggerFactory.ts
// EXCEPTION: These console calls are intentional for bootstrap failures
// LoggerFactory cannot log to itself if it fails to initialize

try {
  // Initialize logger
} catch (error) {
  // eslint-disable-next-line no-console -- Bootstrap failure, can't use LoggerFactory
  console.error('[LoggerFactory] Failed to initialize:', error);
}
```

## Definition of Done

- [ ] All console.* calls in utility modules replaced with LoggerFactory
- [ ] Error serialization includes message, stack, and context
- [ ] Timeout logs include operation name and duration
- [ ] UI logs use debug level
- [ ] LoggerFactory bootstrap errors have eslint-disable comments
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Manual testing: Verify error handling and timeouts work correctly

## Files to Modify

1. `src/utils/asyncTimeout.ts` - 3 console calls
2. `src/utils/errorHandler.ts` - 2 console calls
3. `src/utils/LoggerFactory.ts` - 4 console calls (keep 1-2 for bootstrap)
4. `src/ui/EntityReviewUI.ts` - 1 console call

## Notes

- This is a small story (XS) - can be combined with other work if needed
- LoggerFactory bootstrap exception is intentional - document with comments
