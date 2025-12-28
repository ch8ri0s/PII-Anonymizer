# Story 10.2: LoggerFactory Browser-App Adaptation

## Story

As a **developer working on the browser-app**,
I want **LoggerFactory to work correctly in pure browser context (no Electron)**,
So that **browser-app can use the same logging patterns as Electron app**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 10.2 |
| **Epic** | 10 - Console-to-Logger Migration |
| **Status** | ready-for-dev |
| **Created** | 2025-12-28 |
| **Priority** | Medium (foundation for browser logging) |
| **Estimate** | M |
| **Dependencies** | None |

## Acceptance Criteria

### AC-1: Browser Context Logger Creation
**Given** code running in browser-app (Vite/PWA, no Electron)
**When** `LoggerFactory.create('scope')` is called
**Then** logger instance is created successfully without errors

### AC-2: DevTools Console Output
**Given** a logger instance in browser context
**When** log methods (debug, info, warn, error) are called
**Then** log messages appear in browser DevTools console with proper formatting
**And** formatting matches Electron log output style (scope prefix, timestamps)

### AC-3: Log Level Filtering
**Given** browser-app running with default configuration
**When** log methods are called at various levels
**Then** log levels are respected (debug filtered in production)
**And** `LoggerFactory.setLevel()` changes the active log level

### AC-4: PII Redaction in Browser
**Given** browser-app in production mode
**When** log messages contain PII patterns (emails, phones, IBAN, AHV)
**Then** PII values are automatically redacted in output
**And** redaction uses the same patterns as Electron LoggerFactory

### AC-5: No electron-log Errors
**Given** browser-app bundled with Vite
**When** application loads and initializes LoggerFactory
**Then** no errors about missing `electron-log` module
**And** no Node.js API errors (process, fs, path)

### AC-6: Environment Detection
**Given** LoggerFactory in various contexts
**When** detection methods are called
**Then** `isElectron()` returns false in browser-app
**And** `isBrowser()` returns true in browser-app
**And** `isElectron()` returns true in Electron main/renderer

### AC-7: Console-Only Output
**Given** browser-app context
**When** logs are generated
**Then** output goes to console only (no file persistence)
**And** this is acceptable per requirements (no IndexedDB logging needed)

## Technical Design

### Current Implementation Analysis

The existing LoggerFactory (`src/utils/LoggerFactory.ts`) has:
- Node.js imports: `import path from 'path'` (line 14)
- Electron detection: `process.versions.electron` (lines 54-58)
- Dynamic electron-log import: `await import('electron-log')` (line ~249)
- PII redaction: `redactSensitiveData()` function (lines 88-102)

### Browser Adaptation Approach

**Option A (Recommended): Create browser-specific wrapper**
```typescript
// browser-app/src/utils/logger.ts
import { Logger, LogLevel } from './LoggerTypes';

// Browser-compatible implementation
export function createLogger(scope: string): Logger { ... }
export function setLogLevel(level: LogLevel): void { ... }
```

### Key Implementation Details

1. **Environment Detection:**
```typescript
function isElectron(): boolean {
  return typeof window !== 'undefined' &&
         typeof window.process !== 'undefined' &&
         window.process.type !== undefined;
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && !isElectron();
}
```

2. **Browser Formatter:**
```typescript
// Match electron-log output format for consistency
function browserFormat(level: string, scope: string, message: string, data?: object): void {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${scope}]`;

  if (data) {
    console[level](prefix, message, data);
  } else {
    console[level](prefix, message);
  }
}
```

3. **PII Redaction (reuse patterns from Electron LoggerFactory):**
```typescript
function redactSensitiveData(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
    .replace(/\+?\d{1,4}[\s.-]?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,9}/g, '[PHONE_REDACTED]')
    .replace(/\b[A-Z]{2}\d{2}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{4}[\s]?[\dA-Z]{0,4}\b/g, '[IBAN_REDACTED]')
    .replace(/756\.\d{4}\.\d{4}\.\d{2}/g, '[AHV_REDACTED]');
}
```

### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `browser-app/src/utils/logger.ts` | Create | Browser-compatible LoggerFactory |
| `browser-app/src/utils/LoggerTypes.ts` | Create | Shared type definitions |
| `browser-app/test/utils/logger.test.ts` | Create | Unit tests for browser logger |

## Tasks / Subtasks

- [ ] **Task 1: Analyze current LoggerFactory dependencies** (AC: #5)
  - [ ] List all Node.js-specific imports in `src/utils/LoggerFactory.ts`
  - [ ] Identify electron-log usage patterns
  - [ ] Document what must be replaced vs reused

- [ ] **Task 2: Create browser LoggerFactory wrapper** (AC: #1, #2)
  - [ ] Create `browser-app/src/utils/logger.ts`
  - [ ] Implement `createLogger(scope: string): Logger`
  - [ ] Implement console output with proper formatting
  - [ ] Export Logger and LogLevel types

- [ ] **Task 3: Implement environment detection** (AC: #6)
  - [ ] Add `isElectron()` function
  - [ ] Add `isBrowser()` function
  - [ ] Add `isWorker()` stub for Story 10.3

- [ ] **Task 4: Implement log level management** (AC: #3)
  - [ ] Add global log level configuration
  - [ ] Implement `setLevel()` function
  - [ ] Implement per-scope level overrides
  - [ ] Respect LOG_LEVEL via `import.meta.env.VITE_LOG_LEVEL`

- [ ] **Task 5: Implement PII redaction** (AC: #4)
  - [ ] Port `redactSensitiveData()` to browser module
  - [ ] Apply redaction when not in development mode
  - [ ] Test with Swiss AHV, IBAN, email, phone patterns

- [ ] **Task 6: Write unit tests** (AC: all)
  - [ ] Test logger creation and method calls
  - [ ] Test log level filtering
  - [ ] Test PII redaction patterns
  - [ ] Test environment detection functions
  - [ ] Test no errors in jsdom/browser environment

- [ ] **Task 7: Integration verification** (AC: #5, #7)
  - [ ] Verify Vite build succeeds without Node.js errors
  - [ ] Test in browser dev server
  - [ ] Test in production build
  - [ ] Verify DevTools console output

## Dev Notes

### Architecture Alignment

This story creates the foundation for browser-app logging. The browser logger must:
1. Match the Electron LoggerFactory API as closely as possible
2. Work in Vitest jsdom environment for testing
3. Be compatible with future Web Worker logging (Story 10.3)

[Source: docs/sprint-artifacts/tech-spec-epic-10.md#AC-10.2]

### Project Structure Notes

| Path | Purpose |
|------|---------|
| `browser-app/src/utils/` | Utility modules for browser-app |
| `browser-app/src/workers/` | Web Worker files (Story 10.3 will add logging) |
| `src/utils/LoggerFactory.ts` | Reference Electron implementation |

### Vite Considerations

- Use `import.meta.env.DEV` for development detection
- Use `import.meta.env.VITE_LOG_LEVEL` for log level override
- Vite tree-shakes unused Node.js code automatically

### Existing Browser-App Logging

Current console calls in browser-app (`~148 calls`) will be migrated in Stories 10.4-10.6. This story provides the infrastructure.

### References

- [Source: docs/epics.md#Story-10.2]
- [Source: docs/sprint-artifacts/tech-spec-epic-10.md#AC-10.2]
- [Source: src/utils/LoggerFactory.ts] - Reference Electron implementation
- [Source: docs/architecture.md] - Browser-app architecture

## Definition of Done

- [ ] `LoggerFactory.create()` (or `createLogger()`) works in browser-app without errors
- [ ] `isElectron()` returns false, `isBrowser()` returns true in browser context
- [ ] Log messages appear in browser DevTools with proper formatting
- [ ] No errors about missing electron-log module
- [ ] PII redaction works in browser context
- [ ] Console-only output (no file persistence in browser)
- [ ] Unit tests pass in Vitest environment
- [ ] Vite production build succeeds
- [ ] Manual testing in Chrome, Firefox, Safari

## Learnings from Previous Story

Story 10.1 (ESLint Console Restriction) is "ready-for-dev" with context created. Key insight:
- `browser-app/**` was in global ESLint ignores - being moved to proper override blocks
- This story should ensure the new logger module is linted properly under new config

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/10-2-loggerfactory-browser-adaptation.context.xml

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
