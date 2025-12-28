# Story 10.6: Utility & UI Module Logger Migration

Status: done

## Story

As a **developer maintaining utility code and UI components**,
I want **all utility and UI modules to use LoggerFactory with appropriate scopes**,
So that **utility logging is consistent, filterable, and follows the same patterns as the rest of the codebase**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 10.6 |
| **Epic** | 10 - Console-to-Logger Migration |
| **Status** | done |
| **Created** | 2025-12-28 |
| **Priority** | Medium (after 10.5 PII migration) |
| **Estimate** | S |
| **Dependencies** | Story 10.2 (browser LoggerFactory - DONE), Story 10.5 (PII migration - establishes patterns) |

## Acceptance Criteria

### AC-1: Electron Utils Module Migration
**Given** the utility modules in `src/utils/`
**When** migration is complete
**Then** all non-logger console.* calls are replaced with LoggerFactory:

| File | Console Calls | Logger Scope |
|------|---------------|--------------|
| `src/utils/asyncTimeout.ts` | 1 (error) | `utils:timeout` |

**And** `src/utils/logger.ts` and `src/utils/LoggerFactory.ts` internal console calls are preserved (logger bootstrap requires direct console access)

### AC-2: Electron UI Module Migration
**Given** the UI modules in `src/ui/`
**When** migration is complete
**Then** all console.* calls are replaced with LoggerFactory:

| File | Console Calls | Logger Scope |
|------|---------------|--------------|
| `src/ui/EntityReviewUI.ts` | 1 (error) | `ui:review` |

### AC-3: Browser-App Components Migration
**Given** the component modules in `browser-app/src/components/`
**When** migration is complete
**Then** all console.* calls are replaced with browser LoggerFactory:

| File | Console Calls | Logger Scope |
|------|---------------|--------------|
| `browser-app/src/components/PreviewPanel.ts` | 3 | `ui:preview` |
| `browser-app/src/components/utils/offsetMapper.ts` | 1 | `utils:offset` |

### AC-4: Browser-App Processing Migration
**Given** the processing modules in `browser-app/src/processing/`
**When** migration is complete
**Then** all console.* calls are replaced with browser LoggerFactory:

| File | Console Calls | Logger Scope |
|------|---------------|--------------|
| `browser-app/src/processing/FileProcessor.ts` | 1 (error) | `processing:file` |
| `browser-app/src/processing/PIIDetector.ts` | 3 | `processing:pii` |

### AC-5: Browser-App Model Migration
**Given** the model modules in `browser-app/src/model/`
**When** migration is complete
**Then** all console.* calls are replaced with browser LoggerFactory:

| File | Console Calls | Logger Scope |
|------|---------------|--------------|
| `browser-app/src/model/ModelManager.ts` | 4 | `model:manager` |

### AC-6: Log Level Appropriateness
**Given** migrated utility and UI modules
**When** logging is active
**Then** log levels are correctly assigned:
  - Error conditions -> `log.error()`
  - Debug/trace messages -> `log.debug()` (disabled in production)
  - Success notifications -> `log.info()`
  - Warnings/fallbacks -> `log.warn()`

### AC-7: ESLint Compliance
**Given** all migrated utility and UI modules
**When** `npm run lint` is executed
**Then** no console violations are reported in migrated files
**And** only logger implementation files have eslint-disable comments for console

### AC-8: Test Suite Passing
**Given** all migrated utility and UI modules
**When** tests are run
**Then** all existing utility and UI tests pass
**And** functionality is unchanged

## Technical Design

### Console Calls Inventory

**Electron `src/utils/` (1 active call + logger internals):**
```
src/utils/asyncTimeout.ts:366 - console.error (progress reporter error)
src/utils/logger.ts:59,62,65,68 - console.* (logger implementation - keep)
src/utils/LoggerFactory.ts:157,162,167,172 - console.* (logger implementation - keep)
```

**Electron `src/ui/` (1 call):**
```
src/ui/EntityReviewUI.ts:72 - console.error (container not found)
```

**Browser-app `browser-app/src/components/` (4 calls):**
```
browser-app/src/components/PreviewPanel.ts:278 - console.log (copy success)
browser-app/src/components/PreviewPanel.ts:279 - console.error (copy error)
browser-app/src/components/PreviewPanel.ts:424 - console.log (text selection debug)
browser-app/src/components/utils/offsetMapper.ts:17 - console.log (debug)
```

**Browser-app `browser-app/src/processing/` (4 calls):**
```
browser-app/src/processing/FileProcessor.ts:91 - console.error (processing error)
browser-app/src/processing/PIIDetector.ts:150 - console.error (worker error)
browser-app/src/processing/PIIDetector.ts:161 - console.warn (worker init failed)
browser-app/src/processing/PIIDetector.ts:410 - console.warn (ML detection failed)
```

**Browser-app `browser-app/src/model/` (4 calls):**
```
browser-app/src/model/ModelManager.ts:146 - console.log (loading transformers)
browser-app/src/model/ModelManager.ts:156 - console.log (transformers loaded)
browser-app/src/model/ModelManager.ts:157 - console.log (env debug)
browser-app/src/model/ModelManager.ts:351 - console.error (worker error)
```

**Total: ~14 console calls to migrate** (excluding logger implementation files)

### Logger Scope Naming Convention

Following the pattern established in Stories 10.4-10.5:
- `utils:timeout` - Async timeout utilities
- `ui:review` - Entity review UI (Electron)
- `ui:preview` - Preview panel (browser-app)
- `utils:offset` - Offset mapper utilities
- `processing:file` - File processing (browser-app)
- `processing:pii` - PII detection processing (browser-app)
- `model:manager` - ML model management (browser-app)

### Log Level Guidelines

| Scenario | Level | Example |
|----------|-------|---------|
| Container not found | error | `log.error('Container not found', { containerId })` |
| Worker error | error | `log.error('Worker error', { message: event.message })` |
| Worker init failed | warn | `log.warn('Worker init failed, using fallback', { error })` |
| ML fallback | warn | `log.warn('ML detection failed, using regex-only')` |
| Copy success | debug | `log.debug('Copied to clipboard')` |
| Text selection | debug | `log.debug('Text selected', { start, end })` |
| Model loading | info | `log.info('Loading transformers...', { version })` |
| Model loaded | info | `log.info('Transformers loaded successfully')` |

### Files to Modify

| File | Action | Logger Import Source |
|------|--------|---------------------|
| `src/utils/asyncTimeout.ts` | Migrate | `./LoggerFactory` |
| `src/ui/EntityReviewUI.ts` | Migrate | `../utils/LoggerFactory` |
| `browser-app/src/components/PreviewPanel.ts` | Migrate | `../utils/logger` |
| `browser-app/src/components/utils/offsetMapper.ts` | Migrate | `../../utils/logger` |
| `browser-app/src/processing/FileProcessor.ts` | Migrate | `../utils/logger` |
| `browser-app/src/processing/PIIDetector.ts` | Migrate | `../utils/logger` |
| `browser-app/src/model/ModelManager.ts` | Migrate | `../utils/logger` |

## Tasks / Subtasks

- [x] **Task 1: Migrate Electron asyncTimeout.ts** (AC: #1, #6) ✅
  - [x] Add LoggerFactory import to `src/utils/asyncTimeout.ts`
  - [x] Create logger with scope `utils:timeout`
  - [x] Replace `console.error` (line 366) with `log.error()` for progress reporter error
  - [x] Preserve error context in structured logging

- [x] **Task 2: Migrate Electron EntityReviewUI.ts** (AC: #2, #6) ✅
  - [x] Add LoggerFactory import to `src/ui/EntityReviewUI.ts`
  - [x] Create logger with scope `ui:review`
  - [x] Replace `console.error` (line 72) with `log.error()` for container not found
  - [x] Include containerId in structured metadata

- [x] **Task 3: Migrate Browser PreviewPanel.ts** (AC: #3, #6) ✅
  - [x] Add browser logger import to `browser-app/src/components/PreviewPanel.ts`
  - [x] Create logger with scope `ui:preview`
  - [x] Replace `console.log` (line 278) with `log.debug()` for copy success
  - [x] Replace `console.error` (line 279) with `log.error()` for copy error
  - [x] Replace `console.log` (line 424) with `log.debug()` for text selection

- [x] **Task 4: Migrate Browser offsetMapper.ts** (AC: #3, #6) ✅
  - [x] Add browser logger import to `browser-app/src/components/utils/offsetMapper.ts`
  - [x] Create logger with scope `utils:offset`
  - [x] Replace `console.log` (line 17) with `log.debug()` for debug output
  - [x] Replaced custom debug function with logger-based implementation

- [x] **Task 5: Migrate Browser FileProcessor.ts** (AC: #4, #6) ✅
  - [x] Add browser logger import to `browser-app/src/processing/FileProcessor.ts`
  - [x] Create logger with scope `processing:file`
  - [x] Replace `console.error` (line 91) with `log.error()` for processing errors
  - [x] Include file name in structured metadata (no PII)

- [x] **Task 6: Migrate Browser PIIDetector.ts** (AC: #4, #6) ✅
  - [x] Add browser logger import to `browser-app/src/processing/PIIDetector.ts`
  - [x] Create logger with scope `processing:pii`
  - [x] Replace `console.error` (line 150) with `log.error()` for worker error
  - [x] Replace `console.warn` (line 161) with `log.warn()` for worker init failure
  - [x] Replace `console.warn` (line 410) with `log.warn()` for ML fallback

- [x] **Task 7: Migrate Browser ModelManager.ts** (AC: #5, #6) ✅
  - [x] Add browser logger import to `browser-app/src/model/ModelManager.ts`
  - [x] Create logger with scope `model:manager`
  - [x] Replace `console.log` (line 146) with `log.info()` for loading message
  - [x] Replace `console.log` (line 156) with `log.info()` for success message
  - [x] Replace `console.log` (line 157) with `log.debug()` for env debug
  - [x] Replace `console.error` (line 351) with `log.error()` for worker error

- [x] **Task 8: Verify ESLint compliance** (AC: #7) ✅
  - [x] Run `npm run lint` on all modified Electron files
  - [x] Run linting in browser-app for modified browser files
  - [x] Verify no console violations in migrated modules
  - [x] Only logger implementation files have console calls (expected)

- [x] **Task 9: Run tests and verify** (AC: #8) ✅
  - [x] Run `npm test` for Electron tests - 1747 passing
  - [x] Type-check browser-app - passed
  - [x] Verify utility and UI functionality unchanged
  - [x] Confirm no regressions in file processing or model loading

## Dev Notes

### Architecture Alignment

This story completes the utility and UI module migration as part of Epic 10's comprehensive console-to-logger migration. It follows patterns established in Stories 10.2 (browser LoggerFactory), 10.4 (i18n migration), and 10.5 (PII migration).

Key architectural considerations:
1. **Electron modules** use `src/utils/LoggerFactory.ts` directly
2. **Browser-app modules** use `browser-app/src/utils/logger.ts` (created in Story 10.2)
3. **Logger implementation files** (`logger.ts`, `LoggerFactory.ts`) retain internal console calls for bootstrap

[Source: docs/sprint-artifacts/tech-spec-epic-10.md#AC-10.6]

### Project Structure Notes

| Path | Logger Source |
|------|---------------|
| `src/utils/` | `./LoggerFactory` or relative path |
| `src/ui/` | `../utils/LoggerFactory` |
| `browser-app/src/components/` | `../utils/logger` or `../../utils/logger` |
| `browser-app/src/processing/` | `../utils/logger` |
| `browser-app/src/model/` | `../utils/logger` |

### Learnings from Previous Story

**From Story 10.5 (Status: ready-for-dev - pattern reference)**

Based on Story 10.5's technical design and patterns from Story 10.2:

- **New Service Created**: `browser-app/src/utils/logger.ts` - Browser-compatible LoggerFactory
- **Key API**: `createLogger(scope: string): Logger` - same interface as Electron LoggerFactory
- **Scope Naming**: `module:submodule` pattern (e.g., `processing:file`, `ui:preview`)
- **Log Levels**: debug for verbose/trace, info for significant events, warn for issues/fallbacks, error for failures
- **PII Redaction**: Patterns ordered IBAN -> AHV -> Phone to avoid partial clobbering
- **ESLint**: Use `// eslint-disable-next-line no-console` only in logger implementation itself
- **Vite Integration**: `import.meta.env.DEV` for development mode detection in browser-app

[Source: stories/10-5-pii-detection-logger-migration.md#Learnings-from-Previous-Story]

### Special Considerations

1. **Logger Bootstrap Problem**: The files `src/utils/logger.ts` and `src/utils/LoggerFactory.ts` need direct console access for their internal implementation. These should NOT be migrated - they ARE the logger infrastructure.

2. **Debug vs Info for UI Actions**: Copy success and text selection events should be `debug` level since they're verbose trace information. Model loading progress is `info` because it's a significant user-visible event.

3. **Worker Errors**: Both Electron and browser-app have worker-related errors. These should include the error message in structured metadata but NOT expose internal details to prevent information leakage.

4. **Model Loading Messages**: The ModelManager loading messages are informational for users watching progress. Use `info` level so they appear in normal operation but can be silenced if needed.

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-10.md#AC-10.6]
- [Source: docs/epics.md#Story-10.6]
- [Source: stories/10-2-loggerfactory-browser-adaptation.md] - Browser logger patterns
- [Source: stories/10-5-pii-detection-logger-migration.md] - PII migration patterns
- [Source: docs/architecture.md#Logging-Strategy] - Logging architecture

## Definition of Done

- [x] All ~14 console.* calls in utility/UI modules replaced with LoggerFactory ✅
- [x] Scopes follow convention: `utils:*`, `ui:*`, `processing:*`, `model:*` ✅
- [x] Log levels appropriately assigned per message type ✅
- [x] Logger implementation files (`logger.ts`, `LoggerFactory.ts`) retain internal console calls ✅
- [x] `npm run lint` passes (no console violations in migrated files) ✅
- [x] `npm test` passes (Electron test suite) - 1747 passing ✅
- [x] Browser-app type-check passes ✅
- [x] Utility and UI functionality unchanged ✅

## Dev Agent Record

### Context Reference

N/A - Context-free implementation

### Agent Model Used

Claude Opus 4.5

### Debug Log References

N/A

### Completion Notes List

- Migrated 14 console calls across 7 files to LoggerFactory
- Electron files: asyncTimeout.ts, EntityReviewUI.ts
- Browser-app files: PreviewPanel.ts, offsetMapper.ts, FileProcessor.ts, PIIDetector.ts, ModelManager.ts
- offsetMapper.ts: Replaced custom DEBUG flag with logger debug level
- All scopes follow established patterns: utils:*, ui:*, processing:*, model:*
- Log levels correctly assigned: error for failures, warn for fallbacks, info for significant events, debug for trace

### File List

**Modified:**
- `src/utils/asyncTimeout.ts` - Added LoggerFactory, scope `utils:timeout`
- `src/ui/EntityReviewUI.ts` - Added LoggerFactory, scope `ui:review`
- `browser-app/src/components/PreviewPanel.ts` - Added logger, scope `ui:preview`
- `browser-app/src/components/utils/offsetMapper.ts` - Added logger, scope `utils:offset`
- `browser-app/src/processing/FileProcessor.ts` - Added logger, scope `processing:file`
- `browser-app/src/processing/PIIDetector.ts` - Added logger, scope `processing:pii`
- `browser-app/src/model/ModelManager.ts` - Added logger, scope `model:manager`

## Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2025-12-28 | 1.0 | Story drafted with comprehensive console call inventory |
| 2025-12-28 | 2.0 | Implementation complete - all 14 console calls migrated |
