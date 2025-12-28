# Epic Technical Specification: Console-to-Logger Migration

Date: 2025-12-28
Author: Olivier
Epic ID: 10
Status: Draft

---

## Overview

Epic 10 addresses the complete migration from direct `console.*` calls to the centralized LoggerFactory pattern across the entire A5-PII-Anonymizer codebase. This epic absorbs and expands Story 6.1 (Factory Central Logger) from Epic 6, transforming it into a comprehensive logging standardization initiative.

The current codebase contains approximately 976 `console.*` calls across 125 files, with the existing LoggerFactory infrastructure already in place (`src/utils/LoggerFactory.ts`). This epic focuses on migrating all remaining console calls, extending LoggerFactory for browser-app and Web Worker contexts, implementing ESLint enforcement, and establishing CI/CD integration for sustainable logging practices.

## Objectives and Scope

### In Scope

- **ESLint Enforcement:** Add `no-console` rule to prevent regression and block new console.* usage
- **Browser-App Adaptation:** Extend LoggerFactory to work in pure browser context (Vite/PWA, no Electron)
- **Web Worker Logging:** Implement logging strategy for ML inference workers via postMessage
- **Module Migration:** Migrate all console calls in src/ directory (~45 calls in i18n, PII, utils, UI modules)
- **Test File Migration:** Migrate ~783 console calls in test/ directory with testLogger helper
- **Deprecated File Removal:** Delete `src/utils/logger.ts` and `src/config/logging.ts`
- **CI/CD Integration:** Configure LOG_LEVEL environment variable in pipelines
- **Documentation:** Create comprehensive logging guide for developers

### Out of Scope

- Creating new logging transports (file logging already handled by electron-log)
- Log aggregation or external logging services
- Real-time log streaming or monitoring dashboards
- Log analysis or parsing tools

## System Architecture Alignment

### Affected Components

| Component | Impact | Notes |
|-----------|--------|-------|
| `src/utils/LoggerFactory.ts` | Enhancement | Add browser/worker detection, environment-aware initialization |
| `browser-app/src/**` | Migration | Create browser-compatible LoggerFactory wrapper |
| `browser-app/src/workers/**` | New | Implement WorkerLoggerTransport |
| `src/i18n/**` | Migration | 25 console calls → LoggerFactory |
| `src/pii/**` | Migration | ~10 console calls → LoggerFactory with PII redaction |
| `src/utils/**` | Migration | ~10 console calls → LoggerFactory |
| `test/**` | Migration | 783 console calls → testLogger |
| `.eslintrc.js` | Enhancement | Add no-console rule |
| `.github/workflows/**` | Enhancement | Add LOG_LEVEL configuration |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           LoggerFactory                                  │
│                    (src/utils/LoggerFactory.ts)                          │
│  ┌────────────────┬────────────────┬────────────────┬────────────────┐ │
│  │  Environment   │   Log Level    │  PII Redaction │    Caching     │ │
│  │   Detection    │   Management   │   (Production) │   (Singleton)  │ │
│  └───────┬────────┴───────┬────────┴───────┬────────┴───────┬────────┘ │
└──────────┼────────────────┼────────────────┼────────────────┼──────────┘
           │                │                │                │
    ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐
    │  Electron   │  │  Browser    │  │  Web Worker │  │    Tests    │
    │   Main      │  │   App       │  │  (postMsg)  │  │  (testLog)  │
    │ (electron-  │  │  (Console)  │  │             │  │             │
    │    log)     │  │             │  │             │  │             │
    └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
           │                │                │                │
           ▼                ▼                ▼                ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ File + Con  │  │   Console   │  │  Main→Con   │  │   Console   │
    │   Output    │  │   Output    │  │   Output    │  │   Output    │
    └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs |
|--------|---------------|--------|---------|
| `LoggerFactory` | Create scoped loggers, manage levels, redact PII | scope name, config | Logger instance |
| `BrowserLoggerFactory` | Browser-app wrapper for LoggerFactory | scope name | Console-based Logger |
| `WorkerLoggerTransport` | Relay logs from Web Worker to main thread | log message | postMessage to main |
| `testLogger` | Test helper with LOG_LEVEL support | scope name | Logger with warn default |

### Data Models and Contracts

```typescript
// Logger Interface (existing - no changes)
export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

// Log Level (existing - no changes)
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Worker Log Message (new)
export interface WorkerLogMessage {
  type: 'log';
  level: LogLevel;
  scope: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

// Logger Config (existing - no changes)
export interface LoggerConfig {
  level?: LogLevel;
  scopeLevels?: Record<string, LogLevel>;
  redactPII?: boolean;
  format?: string;
}
```

### APIs and Interfaces

```typescript
// LoggerFactory API (existing, extended)
class LoggerFactory {
  static async initialize(config?: LoggerConfig): Promise<void>;
  static create(scope: string): Logger;
  static configure(config: LoggerConfig): void;
  static setLevel(level: LogLevel): void;
  static setScopeLevel(scope: string, level: LogLevel): void;
  static getLogFilePath(): string | null;
  static isDevelopment(): boolean;
  static clearCache(): void;

  // New methods for Epic 10
  static isElectron(): boolean;      // Story 10.2
  static isBrowser(): boolean;       // Story 10.2
  static isWorker(): boolean;        // Story 10.3
}

// Browser-App Wrapper (new - Story 10.2)
// browser-app/src/utils/logger.ts
export function createLogger(scope: string): Logger;
export function setLogLevel(level: LogLevel): void;

// Test Helper (new - Story 10.8)
// test/helpers/testLogger.ts
export const testLogger: Logger;
export function createTestLogger(scope: string): Logger;
```

### Workflows and Sequencing

#### Story Dependency Flow

```
Story 10.1 (ESLint Rule) ────────────────────────────────────────┐
                                                                  │
Story 10.2 (Browser Adaptation) ──► Story 10.3 (Web Worker)      │
         │                                                        │
         ▼                                                        │
Story 10.4 (i18n) ──► Story 10.5 (PII) ──► Story 10.6 (Utils)   │
                                                    │             │
                                                    ▼             │
                                          Story 10.7 (Deprecate)  │
                                                    │             │
                                                    ▼             │
                                          Story 10.8 (Tests) ◄────┘
                                                    │
                                                    ▼
                                          Story 10.9 (CI/CD)
                                                    │
                                                    ▼
                                          Story 10.10 (Docs)
```

#### Web Worker Logging Flow

```
┌───────────────────────────────────────────────────────────────────┐
│                        Web Worker                                  │
│                                                                    │
│  const log = WorkerLogger.create('ml:inference');                 │
│  log.info('Model loaded', { size: '129MB' });                     │
│         │                                                          │
│         ▼                                                          │
│  ┌─────────────────┐                                              │
│  │ WorkerLogger    │──► postMessage({ type: 'log', ... })        │
│  │ (formats msg)   │                                              │
│  └─────────────────┘                                              │
└───────────────────────────────────────────────────────────────────┘
                              │
                              ▼ postMessage
┌───────────────────────────────────────────────────────────────────┐
│                        Main Thread                                 │
│                                                                    │
│  worker.onmessage = (e) => {                                      │
│    if (e.data.type === 'log') {                                   │
│      const mainLog = LoggerFactory.create(e.data.scope);          │
│      mainLog[e.data.level](e.data.message, e.data.metadata);      │
│    }                                                               │
│  };                                                                │
└───────────────────────────────────────────────────────────────────┘
```

## Non-Functional Requirements

### Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| Log formatting overhead | <0.1ms per call | No perceptible impact on processing |
| Worker log relay latency | <10ms | Async, non-blocking logging |
| Memory for log caching | <1MB | Singleton logger instances |
| PII redaction overhead | <1ms per log | Regex-based, pre-compiled patterns |

### Security

- **PII Redaction:** LoggerFactory already implements redaction for emails, phones, IBANs, AHV numbers, and file paths (lines 88-102 of LoggerFactory.ts)
- **Production Mode:** PII redaction enabled by default when `!isDevelopment`
- **No PII in Metadata:** Structured logging pattern (`log.info('Entity', { type, position })`) prevents accidental PII in logs
- **Worker Isolation:** Web Worker logs serialized via postMessage, no shared memory access
- **CI/CD Secrets:** LOG_LEVEL is non-sensitive; no credentials in log configuration

### Reliability/Availability

- **Graceful Fallback:** If electron-log fails to load, falls back to console logging (lines 278-281)
- **Initialization Guard:** `isInitialized` flag prevents duplicate initialization
- **Cache Management:** `clearCache()` method for testing and configuration changes
- **Error Handling:** Logger creation never throws; returns console-based fallback

### Observability

| Signal | Implementation | Story |
|--------|---------------|-------|
| Log Levels | `LOG_LEVEL` env var, per-scope overrides | 10.2, 10.9 |
| Scope Prefixes | `[scope]` in all log messages | Existing |
| Timestamps | ISO format with milliseconds | Existing |
| Process Type | `processType` metadata in Electron logs | Existing |
| Worker Prefix | `[Worker]` prefix for worker-originated logs | 10.3 |

## Dependencies and Integrations

### Existing Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `electron-log` | ^5.4.3 | File and console logging in Electron |
| `electron` | ^39.1.1 | Desktop framework with main/renderer IPC |

### New Dependencies

None required. Browser-app logging uses native `console.*` with formatting.

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `eslint` | ^9.39.1 | Existing - add no-console rule |

### Integration Points

1. **Electron Main Process:** electron-log with file transport
2. **Electron Renderer:** electron-log IPC to main process
3. **Browser-App:** Console-only with structured formatting
4. **Web Workers:** postMessage relay to main thread
5. **Vitest (browser-app tests):** Console logging with LOG_LEVEL
6. **Mocha (Electron tests):** testLogger helper with LOG_LEVEL

## Acceptance Criteria (Authoritative)

### AC-10.1: ESLint Console Restriction
1. ESLint rule `no-console: error` is active in `.eslintrc.js`
2. Running `npm run lint` on src/ files with console.* shows errors
3. Test files initially excluded from rule
4. Build fails if console.* added to src/

### AC-10.2: Browser-App LoggerFactory
1. `LoggerFactory.create()` works in browser-app without errors
2. `isElectron()` returns false, `isBrowser()` returns true in browser context
3. Log messages appear in browser DevTools with proper formatting
4. No errors about missing electron-log module
5. PII redaction works in browser context

### AC-10.3: Web Worker Logger
1. `WorkerLogger.create()` works inside Web Workers
2. Log messages posted to main thread via postMessage
3. Main thread routes worker logs through LoggerFactory
4. Worker logs appear with `[Worker]` prefix
5. Log levels synchronized across worker/main

### AC-10.4: i18n Module Migration
1. All 25 console calls in src/i18n/ replaced with LoggerFactory
2. Scopes follow pattern: `i18n:renderer`, `i18n:service`, etc.
3. Existing i18n tests pass
4. ESLint passes with no console violations

### AC-10.5: PII Detection Migration
1. All console calls in src/pii/ replaced with LoggerFactory
2. PII values auto-redacted in production logs
3. Detection metrics logged at info level
4. Pattern details logged at debug level
5. Accuracy tests pass

### AC-10.6: Utility/UI Migration
1. All console calls in src/utils/ and src/ui/ migrated
2. Error handler uses `log.error()` with stack traces
3. LoggerFactory internal errors use console as last resort

### AC-10.7: Deprecated File Removal
1. `src/utils/logger.ts` deleted
2. `src/config/logging.ts` deleted
3. All imports updated to LoggerFactory
4. TypeScript compiles successfully
5. All tests pass

### AC-10.8: Test File Migration
1. `test/helpers/testLogger.ts` created
2. Default log level is `warn` (errors and warnings only)
3. `LOG_LEVEL=debug` enables verbose output
4. ESLint test file exclusion removed
5. CI runs with `LOG_LEVEL=error`

### AC-10.9: CI/CD Integration
1. `LOG_LEVEL=error` set in CI workflow files
2. Debug mode available via workflow dispatch
3. Documentation in CI config with comments

### AC-10.10: Documentation Complete
1. Logging section added to CLAUDE.md
2. Quick start example in documentation
3. Scope naming convention documented
4. Log level usage guide documented
5. Context-specific guidance (Electron/Browser/Worker/Test)

## Traceability Mapping

| AC | Spec Section | Component(s) | Test Idea |
|----|--------------|--------------|-----------|
| AC-10.1 | ESLint Configuration | `.eslintrc.js` | Add console.log to src/, verify lint fails |
| AC-10.2 | Browser Adaptation | `LoggerFactory.ts`, `browser-app/src/utils/logger.ts` | Create logger in browser-app, verify no errors |
| AC-10.3 | Worker Logging | `WorkerLoggerTransport.ts` | Post log from worker, verify appears in DevTools |
| AC-10.4 | i18n Migration | `src/i18n/*.ts` | Run i18n tests, verify logs with correct scope |
| AC-10.5 | PII Migration | `src/pii/*.ts` | Log message with email, verify redacted in production |
| AC-10.6 | Utils Migration | `src/utils/*.ts`, `src/ui/*.ts` | Trigger error, verify logged with stack trace |
| AC-10.7 | Deprecation | `src/utils/logger.ts`, `src/config/logging.ts` | Verify files deleted, compilation succeeds |
| AC-10.8 | Test Migration | `test/**/*.test.js` | Run tests with LOG_LEVEL=debug, verify verbose output |
| AC-10.9 | CI/CD | `.github/workflows/*.yml` | Check workflow logs show minimal output |
| AC-10.10 | Documentation | `CLAUDE.md`, `docs/LOGGING.md` | Review docs for completeness |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Large migration scope (976 calls) | High | Medium | Incremental stories, prioritize src/ first |
| Breaking existing logging behavior | Medium | Low | Preserve LoggerFactory API, add tests |
| Web Worker message overhead | Low | Low | Async logging, batching if needed |
| ESLint rule disrupts development | Medium | Medium | Clear error messages, documentation |

### Assumptions

1. **LoggerFactory is stable:** The existing LoggerFactory.ts implementation is production-ready
2. **electron-log works correctly:** No issues with the current electron-log integration
3. **Browser-app tests use Vitest:** Browser-app has jsdom/browser test environment
4. **No external log aggregation needed:** Local console/file logging is sufficient

### Open Questions

1. **Q:** Should we implement log rotation for browser-app IndexedDB persistence?
   **A:** Out of scope for Epic 10; console-only is acceptable per requirements

2. **Q:** Should worker logs be batched to reduce postMessage overhead?
   **A:** Start without batching; add if performance impact measured

3. **Q:** Should deprecated files be kept with deprecation warnings instead of deleted?
   **A:** Delete completely; no gradual deprecation period needed

## Test Strategy Summary

### Test Levels

| Level | Focus | Framework |
|-------|-------|-----------|
| Unit | LoggerFactory methods, redaction, level management | Mocha/Chai |
| Integration | Worker↔Main log relay, browser-app initialization | Mocha/Vitest |
| E2E | Log output verification in running app | Manual verification |

### Key Test Cases

1. **LoggerFactory.create()** returns Logger with all methods
2. **Log level filtering** respects global and per-scope settings
3. **PII redaction** removes emails, phones, IBANs, AHV, paths
4. **Browser detection** correctly identifies non-Electron context
5. **Worker relay** delivers logs from worker to main thread
6. **ESLint rule** blocks console.* in src/ files
7. **testLogger** respects LOG_LEVEL environment variable

### Coverage Targets

- LoggerFactory.ts: 90%+ branch coverage
- Migration: 100% of console.* calls replaced
- ESLint: Zero console violations in src/

---

*Generated by BMAD epic-tech-context workflow*
*Date: 2025-12-28*
