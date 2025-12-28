# Story 10.5: PII Detection Module Logger Migration

Status: done

## Story

As a **developer debugging PII detection issues**,
I want **all PII detection modules to use LoggerFactory with 'pii' scope**,
So that **detection logging is filterable, PII is automatically redacted, and debugging is consistent across Electron and browser-app**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 10.5 |
| **Epic** | 10 - Console-to-Logger Migration |
| **Status** | done |
| **Created** | 2025-12-28 |
| **Priority** | Medium (post 10.4 i18n migration) |
| **Estimate** | M |
| **Dependencies** | Story 10.2 (browser LoggerFactory - DONE), Story 10.4 (i18n migration establishes patterns) |

## Acceptance Criteria

### AC-1: Electron PII Module Migration
**Given** the PII detection modules in `src/pii/`
**When** migration is complete
**Then** all console.* calls are replaced with LoggerFactory usage:

| File | Console Calls | Logger Scope |
|------|---------------|--------------|
| `src/pii/DetectionPipeline.ts` | 2 | `pii:pipeline` |
| `src/pii/RuleEngine.ts` | 2 | `pii:rules` |
| `src/pii/passes/HighRecallPass.ts` | 5 | `pii:pass:recall` |
| `src/pii/passes/DocumentTypePass.ts` | 1 | `pii:pass:doctype` |

### AC-2: Browser-App PII Module Migration
**Given** the PII detection modules in `browser-app/src/pii/`
**When** migration is complete
**Then** all console.* calls are replaced with browser LoggerFactory:

| File | Console Calls | Logger Scope |
|------|---------------|--------------|
| `browser-app/src/pii/BrowserHighRecallPass.ts` | 9 | `pii:pass:recall` |
| `browser-app/src/pii/BrowserDocumentTypePass.ts` | 1 | `pii:pass:doctype` |
| `browser-app/src/pii/BrowserSwissPostalDatabase.ts` | 1 | `pii:postal` |

### AC-3: Shared PII Module Migration
**Given** the shared PII modules in `shared/pii/`
**When** migration is complete
**Then** all console.* calls are replaced:

| File | Console Calls | Logger Scope |
|------|---------------|--------------|
| `shared/pii/recognizers/Registry.ts` | 1 | `pii:recognizers` |

### AC-4: PII Redaction in Logs
**Given** PII detection logs in production mode
**When** log messages contain entity text or detected values
**Then** PII values are automatically redacted by LoggerFactory
**And** only metadata (entity count, type, position) is logged in plain text

### AC-5: Log Level Appropriateness
**Given** migrated PII modules
**When** logging is active
**Then** log levels are correctly assigned:
  - Detection metrics (count, duration) -> `log.info()`
  - Pattern match details -> `log.debug()` (disabled in production)
  - Validation failures/warnings -> `log.warn()`
  - Detection errors -> `log.error()`

### AC-6: ESLint Compliance
**Given** all migrated PII modules
**When** `npm run lint` is executed
**Then** no console violations are reported in migrated files
**And** all console uses are replaced with LoggerFactory

### AC-7: Test Suite Passing
**Given** all migrated PII modules
**When** accuracy and integration tests are run
**Then** all existing PII detection tests pass
**And** detection behavior is unchanged

## Technical Design

### Console Calls Inventory

**Electron `src/pii/` (10 calls):**
```
src/pii/DetectionPipeline.ts:175 - console.error (pass error)
src/pii/DetectionPipeline.ts:363 - console.log (debug message)
src/pii/RuleEngine.ts:182 - console.log (config loaded)
src/pii/RuleEngine.ts:187 - console.warn (config load failed)
src/pii/passes/HighRecallPass.ts:133 - console.log (ML detection debug)
src/pii/passes/HighRecallPass.ts:161 - console.warn (validation failed)
src/pii/passes/HighRecallPass.ts:174 - console.warn (input warning)
src/pii/passes/HighRecallPass.ts:210 - console.error (ML failed after retries)
src/pii/passes/HighRecallPass.ts:237 - console.warn (succeeded after retry)
src/pii/passes/DocumentTypePass.ts:88 - console.log (classification debug)
```

**Browser-App `browser-app/src/pii/` (11 calls):**
```
browser-app/src/pii/BrowserHighRecallPass.ts:103 - console.log (frontmatter debug)
browser-app/src/pii/BrowserHighRecallPass.ts:104 - console.log (merged entities)
browser-app/src/pii/BrowserHighRecallPass.ts:108 - console.log (address entities)
browser-app/src/pii/BrowserHighRecallPass.ts:111 - console.log (frontmatter removal)
browser-app/src/pii/BrowserHighRecallPass.ts:139 - console.log (ML detection debug)
browser-app/src/pii/BrowserHighRecallPass.ts:185 - console.warn (validation failed)
browser-app/src/pii/BrowserHighRecallPass.ts:198 - console.warn (input warning)
browser-app/src/pii/BrowserHighRecallPass.ts:234 - console.error (ML failed after retries)
browser-app/src/pii/BrowserHighRecallPass.ts:261 - console.warn (succeeded after retry)
browser-app/src/pii/BrowserDocumentTypePass.ts:88 - console.log (classification debug)
browser-app/src/pii/BrowserSwissPostalDatabase.ts:78 - console.warn (load failed)
```

**Shared `shared/pii/` (1 call):**
```
shared/pii/recognizers/Registry.ts:244 - console.error (recognizer error)
```

**Total: 22 console calls to migrate**

### Logger Scope Naming Convention

Following the pattern established in Story 10.4:
- `pii:pipeline` - Detection pipeline orchestration
- `pii:pass:recall` - High-recall detection pass
- `pii:pass:doctype` - Document type detection pass
- `pii:rules` - Rule engine configuration
- `pii:recognizers` - Recognizer registry (shared)
- `pii:postal` - Swiss postal database (browser)

### Log Level Guidelines

| Scenario | Level | Example |
|----------|-------|---------|
| Pass execution start | debug | `log.debug('Starting high-recall pass', { textLength })` |
| Entity detection count | info | `log.info('Detection complete', { entityCount, durationMs })` |
| ML validation failed | warn | `log.warn('ML input validation failed', { reason })` |
| ML retry succeeded | warn | `log.warn('ML detection succeeded after retry', { attempts })` |
| Detection error | error | `log.error('Detection failed', { error: error.message })` |
| Config loaded | debug | `log.debug('Configuration loaded', { path })` |
| Config load failed | warn | `log.warn('Config load failed, using defaults', { path })` |

### PII-Safe Logging Pattern

```typescript
// BEFORE (unsafe - logs PII)
console.log('[HighRecallPass] Detected entity:', entity.text);

// AFTER (safe - redacted by LoggerFactory, only metadata)
log.debug('Entity detected', {
  type: entity.type,
  start: entity.start,
  end: entity.end,
  confidence: entity.confidence,
  source: entity.source
});
// PII text is NOT included in structured logging
```

### Files to Modify

| File | Action | Logger Import Source |
|------|--------|---------------------|
| `src/pii/DetectionPipeline.ts` | Migrate | `../utils/LoggerFactory` |
| `src/pii/RuleEngine.ts` | Migrate | `../utils/LoggerFactory` |
| `src/pii/passes/HighRecallPass.ts` | Migrate | `../../utils/LoggerFactory` |
| `src/pii/passes/DocumentTypePass.ts` | Migrate | `../../utils/LoggerFactory` |
| `browser-app/src/pii/BrowserHighRecallPass.ts` | Migrate | `../utils/logger` |
| `browser-app/src/pii/BrowserDocumentTypePass.ts` | Migrate | `../utils/logger` |
| `browser-app/src/pii/BrowserSwissPostalDatabase.ts` | Migrate | `../utils/logger` |
| `shared/pii/recognizers/Registry.ts` | Migrate | Environment-aware import |

## Tasks / Subtasks

- [ ] **Task 1: Migrate Electron DetectionPipeline** (AC: #1, #5)
  - [ ] Add LoggerFactory import to `src/pii/DetectionPipeline.ts`
  - [ ] Create logger with scope `pii:pipeline`
  - [ ] Replace `console.error` (line 175) with `log.error()`
  - [ ] Replace `console.log` (line 363) with `log.debug()`

- [ ] **Task 2: Migrate Electron RuleEngine** (AC: #1, #5)
  - [ ] Add LoggerFactory import to `src/pii/RuleEngine.ts`
  - [ ] Create logger with scope `pii:rules`
  - [ ] Replace `console.log` (line 182) with `log.debug()` for config loaded
  - [ ] Replace `console.warn` (line 187) with `log.warn()` for config fail

- [ ] **Task 3: Migrate Electron HighRecallPass** (AC: #1, #4, #5)
  - [ ] Add LoggerFactory import to `src/pii/passes/HighRecallPass.ts`
  - [ ] Create logger with scope `pii:pass:recall`
  - [ ] Replace `console.log` (line 133) with `log.debug()` - ML detection details
  - [ ] Replace `console.warn` (line 161) with `log.warn()` - validation failed
  - [ ] Replace `console.warn` (line 174) with `log.warn()` - input warning
  - [ ] Replace `console.error` (line 210) with `log.error()` - ML failed
  - [ ] Replace `console.warn` (line 237) with `log.warn()` - retry succeeded
  - [ ] Ensure entity text is NOT logged (PII safety)

- [ ] **Task 4: Migrate Electron DocumentTypePass** (AC: #1, #5)
  - [ ] Add LoggerFactory import to `src/pii/passes/DocumentTypePass.ts`
  - [ ] Create logger with scope `pii:pass:doctype`
  - [ ] Replace `console.log` (line 88) with `log.debug()` - classification

- [ ] **Task 5: Migrate Browser BrowserHighRecallPass** (AC: #2, #4, #5)
  - [ ] Add browser logger import to `browser-app/src/pii/BrowserHighRecallPass.ts`
  - [ ] Create logger with scope `pii:pass:recall`
  - [ ] Replace all 9 console calls with appropriate log levels:
    - Lines 103, 104, 108, 111, 139: `log.debug()` (verbose debugging)
    - Lines 185, 198, 261: `log.warn()` (validation/retry warnings)
    - Line 234: `log.error()` (ML failure)
  - [ ] Remove entity text from log messages (PII safety)

- [ ] **Task 6: Migrate Browser BrowserDocumentTypePass** (AC: #2, #5)
  - [ ] Add browser logger import to `browser-app/src/pii/BrowserDocumentTypePass.ts`
  - [ ] Create logger with scope `pii:pass:doctype`
  - [ ] Replace `console.log` (line 88) with `log.debug()` - classification

- [ ] **Task 7: Migrate Browser BrowserSwissPostalDatabase** (AC: #2, #5)
  - [ ] Add browser logger import to `browser-app/src/pii/BrowserSwissPostalDatabase.ts`
  - [ ] Create logger with scope `pii:postal`
  - [ ] Replace `console.warn` (line 78) with `log.warn()` - load failed

- [ ] **Task 8: Migrate Shared Registry** (AC: #3, #5)
  - [ ] Add appropriate logger import to `shared/pii/recognizers/Registry.ts`
  - [ ] Create logger with scope `pii:recognizers`
  - [ ] Replace `console.error` (line 244) with `log.error()`
  - [ ] Handle environment: shared module used in both Electron and browser

- [ ] **Task 9: Verify ESLint compliance** (AC: #6)
  - [ ] Run `npm run lint` on all modified files
  - [ ] Verify no console violations in PII modules
  - [ ] Fix any linting errors

- [ ] **Task 10: Run tests and verify** (AC: #7)
  - [ ] Run `npm test` for Electron tests
  - [ ] Run `npm run test` in browser-app for browser tests
  - [ ] Verify accuracy tests pass
  - [ ] Verify integration tests pass
  - [ ] Confirm detection behavior unchanged

## Dev Notes

### Architecture Alignment

This story migrates PII detection modules to LoggerFactory, following patterns established in Story 10.2 (browser LoggerFactory) and 10.4 (i18n migration).

Key architectural considerations:
1. **Electron modules** use `src/utils/LoggerFactory.ts` directly
2. **Browser-app modules** use `browser-app/src/utils/logger.ts` (created in 10.2)
3. **Shared modules** need environment-aware imports (may need conditional logic)

[Source: docs/sprint-artifacts/tech-spec-epic-10.md#AC-10.5]

### Project Structure Notes

| Path | Logger Source |
|------|---------------|
| `src/pii/` | `../utils/LoggerFactory` or `../../utils/LoggerFactory` |
| `browser-app/src/pii/` | `../utils/logger` |
| `shared/pii/` | Environment-aware (needs investigation) |

### Learnings from Previous Story

**From Story 10.2 (Status: done)**

- **New Service Created**: `browser-app/src/utils/logger.ts` - Browser-compatible LoggerFactory
- **Key API**: `createLogger(scope: string): Logger` - same interface as Electron LoggerFactory
- **PII Redaction**: Patterns ordered IBAN -> AHV -> Phone to avoid partial clobbering
- **ESLint**: Use `// eslint-disable-next-line no-console` only in logger implementation itself
- **Vite Integration**: `import.meta.env.DEV` for development mode detection
- **Files Created**:
  - `browser-app/src/utils/logger.ts` (469 lines) - createLogger(), setLogLevel(), isElectron(), isBrowser(), isWorker(), isDevelopment(), redactSensitiveData()
  - `browser-app/src/vite-env.d.ts` - TypeScript declarations
  - `browser-app/test/utils/logger.test.ts` - 44 unit tests

**From Story 10.4 (Status: drafted - pattern reference)**

- **Scope Naming**: `module:submodule` pattern (e.g., `i18n:renderer`, `i18n:service`)
- **Log Levels**: debug for details, info for success, warn for issues, error for failures
- **Batch Logging**: Group initialization logs into single summary to reduce noise

[Source: stories/10-2-loggerfactory-browser-adaptation.md#Completion-Notes]

### PII Safety Critical

**NEVER log entity text directly.** Only log:
- Entity type (PERSON, ORG, ADDRESS, etc.)
- Position (start, end offsets)
- Confidence score
- Detection source (ML, RULE, BOTH)
- Count of entities

**Example:**
```typescript
// WRONG - leaks PII
log.info('Detected', { text: entity.text });

// CORRECT - safe metadata only
log.info('Detected', { type: entity.type, start: entity.start, end: entity.end });
```

### Shared Module Environment Detection

The `shared/pii/recognizers/Registry.ts` module is used by both Electron and browser-app. Options:

1. **Option A (Recommended)**: Use console with ESLint ignore comment as last resort
2. **Option B**: Conditional dynamic import based on environment
3. **Option C**: Accept logger as dependency injection

Recommend Option A for simplicity since it's only 1 call and is an error case.

### Performance Logging Pattern

```typescript
const log = LoggerFactory.create('pii:pipeline');

async function runDetection(text: string): Promise<Entity[]> {
  const start = Date.now();
  log.info('Starting detection', { docLength: text.length });

  try {
    const entities = await detectEntities(text);
    log.info('Detection complete', {
      entityCount: entities.length,
      duration: Date.now() - start
    });
    return entities;
  } catch (error) {
    log.error('Detection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start
    });
    throw error;
  }
}
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-10.md#AC-10.5]
- [Source: docs/epics.md#Story-10.5]
- [Source: stories/10-2-loggerfactory-browser-adaptation.md] - Browser logger patterns
- [Source: stories/10-4-i18n-logger-migration.md] - Migration patterns

## Definition of Done

- [ ] All 22 console.* calls in PII modules replaced with LoggerFactory
- [ ] Scopes follow convention: `pii:pipeline`, `pii:pass:recall`, etc.
- [ ] Log levels appropriately assigned per message type
- [ ] PII values NOT logged directly (only metadata)
- [ ] `npm run lint` passes (no console violations in these files)
- [ ] `npm test` passes (Electron test suite)
- [ ] `npm run test` in browser-app passes
- [ ] Accuracy tests pass (detection behavior unchanged)
- [ ] Verbose mode works: `LoggerFactory.setScopeLevel('pii', 'debug')`

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2025-12-28 | 1.0 | Story created and drafted |
