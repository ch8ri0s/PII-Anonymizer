# Story 10.3: Web Worker Logger Implementation

## Story

As a **developer debugging ML inference issues**,
I want **LoggerFactory to work inside Web Workers**,
So that **ML model loading and inference can be logged consistently**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 10.3 |
| **Epic** | 10 - Console-to-Logger Migration |
| **Status** | ready-for-dev |
| **Created** | 2025-12-28 |
| **Priority** | Medium (align with Epic 7 Browser Migration) |
| **Estimate** | M |
| **Dependencies** | Story 10.2 (Browser LoggerFactory works) |

## Acceptance Criteria

### AC-1: Worker Logger Creation
**Given** code running in a Web Worker (e.g., `pii.worker.ts` for ML inference)
**When** `WorkerLogger.create('ml:worker')` is called
**Then** logger instance is created successfully with debug/info/warn/error methods

### AC-2: postMessage Log Relay
**Given** a WorkerLogger instance in Web Worker context
**When** log methods are called
**Then** log messages are posted to main thread via `postMessage`
**And** messages include level, scope, message, metadata, and timestamp

### AC-3: Main Thread Receiver
**Given** a Web Worker that uses WorkerLogger
**When** the main thread receives log messages
**Then** main thread LoggerFactory routes worker logs through standard formatting
**And** worker logs appear in DevTools console

### AC-4: Worker Prefix
**Given** logs originating from a Web Worker
**When** displayed in DevTools
**Then** messages include `[Worker]` prefix to distinguish from main thread logs

### AC-5: Log Level Synchronization
**Given** global log level set via `setLogLevel()`
**When** worker sends logs
**Then** log level filtering is applied (debug filtered in production)
**And** level filtering works same as main thread

### AC-6: PII Redaction in Worker
**Given** worker logs containing PII patterns (emails, phones, IBAN, AHV)
**When** logs are processed by main thread
**Then** PII values are automatically redacted
**And** redaction uses same patterns as browser LoggerFactory

### AC-7: No Performance Impact
**Given** ML inference running in Web Worker
**When** logging is active
**Then** logging is async and non-blocking
**And** inference latency not affected by logging overhead (<10ms relay latency)

## Technical Design

### Worker-Side Logger

```typescript
// browser-app/src/utils/WorkerLogger.ts
export interface WorkerLogMessage {
  type: 'log';
  level: 'debug' | 'info' | 'warn' | 'error';
  scope: string;
  message: string;
  data?: unknown;
  timestamp: number;
}

class WorkerLoggerTransport {
  private buffer: WorkerLogMessage[] = [];
  private flushTimeout: number | null = null;
  private readonly BATCH_DELAY = 100; // ms

  log(level: string, scope: string, message: string, data?: unknown): void {
    this.buffer.push({
      type: 'log',
      level: level as WorkerLogMessage['level'],
      scope,
      message,
      data,
      timestamp: Date.now()
    });

    if (!this.flushTimeout) {
      this.flushTimeout = setTimeout(() => this.flush(), this.BATCH_DELAY);
    }
  }

  private flush(): void {
    if (this.buffer.length > 0) {
      self.postMessage({ type: 'worker-logs', logs: this.buffer });
      this.buffer = [];
    }
    this.flushTimeout = null;
  }
}
```

### Main Thread Receiver

```typescript
// Integration in worker instantiation code
worker.onmessage = (event) => {
  if (event.data.type === 'worker-logs') {
    const logs: WorkerLogMessage[] = event.data.logs;
    logs.forEach(logEntry => {
      const logger = createLogger(`worker:${logEntry.scope}`);
      logger[logEntry.level](`[Worker] ${logEntry.message}`, logEntry.data);
    });
  }
};
```

### Environment Detection Extension

```typescript
// In browser-app/src/utils/logger.ts (from Story 10.2)
export function isWorker(): boolean {
  return typeof self !== 'undefined' &&
         typeof Window === 'undefined' &&
         typeof self.postMessage === 'function';
}
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `browser-app/src/utils/WorkerLogger.ts` | Create | Worker-side logger with postMessage transport |
| `browser-app/src/utils/logger.ts` | Modify | Add `isWorker()` detection, log receiver helper |
| `browser-app/src/workers/pii.worker.ts` | Modify | Integrate WorkerLogger for ML inference logs |
| `browser-app/test/utils/WorkerLogger.test.ts` | Create | Unit tests for worker logger |

## Tasks / Subtasks

- [ ] **Task 1: Create WorkerLoggerTransport** (AC: #1, #2)
  - [ ] Create `browser-app/src/utils/WorkerLogger.ts`
  - [ ] Implement WorkerLogMessage interface
  - [ ] Implement WorkerLoggerTransport class with 100ms batching
  - [ ] Export `WorkerLogger.create(scope: string)` factory function

- [ ] **Task 2: Implement main thread log receiver** (AC: #3, #4)
  - [ ] Add `handleWorkerLogs()` helper in `logger.ts`
  - [ ] Prepend `[Worker]` prefix to worker-originated logs
  - [ ] Route through standard LoggerFactory formatting
  - [ ] Document integration pattern for worker instantiation

- [ ] **Task 3: Add worker environment detection** (AC: #1)
  - [ ] Implement `isWorker()` function in `logger.ts`
  - [ ] Ensure works in happy-dom test environment
  - [ ] Test returns false in main thread context

- [ ] **Task 4: Implement log level synchronization** (AC: #5)
  - [ ] Worker respects global log level
  - [ ] Main thread filters worker logs by level
  - [ ] Consider postMessage for level sync (optional)

- [ ] **Task 5: Ensure PII redaction** (AC: #6)
  - [ ] PII redaction happens on main thread (after postMessage)
  - [ ] Uses same redaction patterns as browser logger
  - [ ] Test with email, phone, IBAN, AHV patterns

- [ ] **Task 6: Performance validation** (AC: #7)
  - [ ] Verify async/non-blocking behavior
  - [ ] Test 100ms batching reduces message overhead
  - [ ] Measure no impact on ML inference latency

- [ ] **Task 7: Write unit tests** (AC: all)
  - [ ] Test WorkerLogger.create() returns logger with all methods
  - [ ] Test postMessage called with correct format
  - [ ] Test log batching (multiple logs, single postMessage)
  - [ ] Test isWorker() detection
  - [ ] Test main thread receiver formats correctly

- [ ] **Task 8: Integration with ML worker** (AC: all)
  - [ ] Integrate WorkerLogger into `pii.worker.ts`
  - [ ] Add receiver in worker instantiation code
  - [ ] Verify logs appear in DevTools with [Worker] prefix
  - [ ] Test with actual ML model loading

## Dev Notes

### Architecture Alignment

This story extends the browser LoggerFactory (Story 10.2) to support Web Worker contexts. The design follows the architecture diagram in tech-spec-epic-10.md:

```
Web Worker → postMessage → Main Thread → LoggerFactory → Console
```

Key design decisions:
1. **Batching:** 100ms debounce prevents message overhead during rapid logging
2. **Main-thread redaction:** PII redaction on main thread avoids duplicating regex patterns in worker
3. **Scope prefix:** Worker scopes prefixed with `worker:` for clarity (e.g., `worker:ml:inference`)

[Source: docs/sprint-artifacts/tech-spec-epic-10.md#AC-10.3]

### Project Structure Notes

| Path | Purpose |
|------|---------|
| `browser-app/src/utils/WorkerLogger.ts` | Worker-side logger (NEW) |
| `browser-app/src/utils/logger.ts` | Browser logger from 10.2 (extend with isWorker) |
| `browser-app/src/workers/pii.worker.ts` | ML inference worker (integrate logger) |
| `browser-app/src/workers/piiBatchWorker.ts` | Batch processing worker (integrate logger) |

### Related Epic 7 Work

Story 7.3 (PII Detection Pipeline Browser Port) established Web Worker infrastructure for ML inference. Story 8.15 (Web Worker ML Inference) completed the worker implementation. This story adds proper logging to that existing infrastructure.

[Source: docs/sprint-artifacts/sprint-status.yaml - 8-15-web-worker-ml-inference: done]

### Performance Considerations

- 100ms batching prevents message overhead from impacting inference performance
- Worker logs are eventually consistent (may appear slightly delayed in DevTools)
- Async logging ensures no blocking of ML operations
- Target: <10ms relay latency per tech-spec

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-10.md#AC-10.3]
- [Source: docs/epics.md#Story-10.3]
- [Source: docs/architecture.md] - Web Worker architecture
- [Source: browser-app/src/workers/] - Existing worker files

## Learnings from Previous Story

**From Story 10.2 (Status: ready-for-dev)**

Story 10.2 is ready-for-dev but not yet implemented. Key preparations for this story:

- **Environment Detection:** 10.2 will add `isElectron()` and `isBrowser()` - this story adds `isWorker()`
- **Logger Interface:** Reuse same `Logger` interface from 10.2 for consistency
- **PII Redaction:** Reuse `redactSensitiveData()` function from 10.2
- **Vite Patterns:** Follow `import.meta.env` patterns established in 10.2

**Dependency:** Wait for 10.2 completion before implementing to ensure browser logger foundation is stable.

[Source: stories/10-2-loggerfactory-browser-adaptation.md]

## Definition of Done

- [ ] WorkerLoggerTransport implemented with 100ms batching
- [ ] Main thread log receiver implemented with `[Worker]` prefix
- [ ] `isWorker()` detection function added
- [ ] Worker logs appear in DevTools with proper formatting
- [ ] Log level filtering works in worker context
- [ ] PII redaction works via main thread processing
- [ ] Performance validated: no impact on ML inference latency
- [ ] Integration test with actual ML worker (`pii.worker.ts`)
- [ ] Unit tests pass in Vitest environment
- [ ] Documentation added to logger JSDoc

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/10-3-web-worker-logger.context.xml

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

