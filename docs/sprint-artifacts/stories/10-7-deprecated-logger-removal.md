# Story 10.7: Deprecated Logger Files Removal

Status: ready-for-dev

## Story

As a **developer maintaining the codebase**,
I want **deprecated logging files removed**,
So that **there's only one way to log (LoggerFactory) and no confusion**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 10.7 |
| **Epic** | 10 - Console-to-Logger Migration |
| **Status** | ready-for-dev |
| **Created** | 2025-12-28 |
| **Priority** | Medium (cleanup after src/ migrations complete) |
| **Estimate** | XS |
| **Dependencies** | Stories 10.4-10.6 (all src/ migrations complete - DONE) |

## Acceptance Criteria

### AC-1: Delete Deprecated src/utils/logger.ts
**Given** the deprecated file `src/utils/logger.ts`
**When** removal is complete
**Then** the file is deleted from the repository
**And** no imports of `src/utils/logger.ts` exist anywhere in `src/`

### AC-2: Delete Deprecated src/config/logging.ts
**Given** the deprecated file `src/config/logging.ts`
**When** removal is complete
**Then** the file is deleted from the repository
**And** no imports of `src/config/logging.ts` exist anywhere in `src/`

### AC-3: Update Any Remaining Imports
**Given** any remaining imports of the deprecated files
**When** imports are updated
**Then** all `createLogger` imports point to `LoggerFactory.create()`
**And** all `configureLogging` calls are removed or replaced with `LoggerFactory.initialize()`

### AC-4: TypeScript Compilation Success
**Given** the deprecated files are removed
**When** `npm run typecheck` is executed
**Then** TypeScript compilation succeeds with no errors

### AC-5: ESLint Compliance
**Given** the deprecated files are removed
**When** `npm run lint` is executed
**Then** ESLint passes with no errors related to missing modules

### AC-6: All Tests Pass
**Given** the deprecated files are removed
**When** `npm test` is executed
**Then** all tests pass (1747+ tests)
**And** no test failures due to missing logger/logging imports

### AC-7: Runtime Verification
**Given** the deprecated files are removed
**When** the Electron app is started
**Then** the app starts successfully without runtime errors
**And** logging functionality works correctly through LoggerFactory

## Technical Design

### Files to Delete

| File | Status | Notes |
|------|--------|-------|
| `src/utils/logger.ts` | TO DELETE | ~135 lines, marked @deprecated |
| `src/config/logging.ts` | TO DELETE | ~235 lines, marked @deprecated |

### Current Import Analysis

**Files importing from deprecated modules (Electron src/):**
- None found in `src/` directory (already migrated in Stories 10.4-10.6)

**Self-references within deprecated files:**
- `src/utils/logger.ts:81` - JSDoc example (will be deleted with file)

**Note:** The browser-app uses its own `browser-app/src/utils/logger.ts` which is NOT deprecated and provides the browser-compatible LoggerFactory wrapper. This file must NOT be deleted.

### Migration Pattern Reference

```typescript
// BEFORE (deprecated pattern)
import { createLogger } from '../utils/logger';
import { configureLogging } from '../config/logging';

const log = createLogger('my-module');

// AFTER (current pattern)
import { LoggerFactory } from '../utils/LoggerFactory';

const log = LoggerFactory.create('my-module');
```

### Verification Commands

```bash
# Step 1: Verify no imports exist before deletion
grep -r "from.*\/logger'" src/ --include="*.ts" --include="*.js"
grep -r "from.*\/logging'" src/ --include="*.ts" --include="*.js"

# Step 2: Delete files
rm src/utils/logger.ts
rm src/config/logging.ts

# Step 3: Verify compilation and tests
npm run typecheck
npm run lint
npm test
npm run dev  # Manual smoke test
```

## Tasks / Subtasks

- [ ] **Task 1: Verify No Remaining Imports** (AC: #3)
  - [ ] Search for any remaining imports of `src/utils/logger.ts` in src/
  - [ ] Search for any remaining imports of `src/config/logging.ts` in src/
  - [ ] Update any discovered imports (none expected based on analysis)

- [ ] **Task 2: Delete Deprecated Files** (AC: #1, #2)
  - [ ] Delete `src/utils/logger.ts`
  - [ ] Delete `src/config/logging.ts`

- [ ] **Task 3: Verify TypeScript Compilation** (AC: #4)
  - [ ] Run `npm run typecheck`
  - [ ] Verify no compilation errors

- [ ] **Task 4: Verify ESLint** (AC: #5)
  - [ ] Run `npm run lint`
  - [ ] Verify no linting errors

- [ ] **Task 5: Verify Tests Pass** (AC: #6)
  - [ ] Run `npm test`
  - [ ] Verify all tests pass (1747+ tests)
  - [ ] Check for any test failures related to logging

- [ ] **Task 6: Runtime Smoke Test** (AC: #7)
  - [ ] Run `npm run dev`
  - [ ] Verify Electron app starts without errors
  - [ ] Verify logging works correctly in app console

- [ ] **Task 7: Commit Changes** (AC: All)
  - [ ] Create single atomic commit with clear message about deprecation removal
  - [ ] Commit message: "chore: remove deprecated logger.ts and logging.ts"

## Dev Notes

### Architecture Alignment

This story completes the deprecated file removal as part of Epic 10's console-to-logger migration. With Stories 10.4-10.6 complete, all `src/` modules now use LoggerFactory exclusively. This cleanup removes legacy code that could cause confusion and reduces maintenance burden.

[Source: docs/sprint-artifacts/tech-spec-epic-10.md#AC-10.7]

### Important Distinction: Electron vs Browser-App

| Location | File | Status |
|----------|------|--------|
| `src/utils/logger.ts` | Deprecated, TO DELETE | Old Electron-only logger |
| `src/config/logging.ts` | Deprecated, TO DELETE | Old logging configuration |
| `src/utils/LoggerFactory.ts` | KEEP | Current unified logging factory |
| `browser-app/src/utils/logger.ts` | KEEP | Browser-compatible LoggerFactory wrapper |

**Critical:** Do NOT confuse `src/utils/logger.ts` (deprecated Electron logger) with `browser-app/src/utils/logger.ts` (current browser logger). Only the src/ files are being deleted.

### Project Structure Notes

After deletion, logging architecture will be:
- `src/utils/LoggerFactory.ts` - Single source of truth for Electron logging
- `browser-app/src/utils/logger.ts` - Browser-compatible wrapper (created in Story 10.2)
- `browser-app/src/utils/WorkerLogger.ts` - Web Worker logging (created in Story 10.3)

### Learnings from Previous Story

**From Story 10.6 (Status: done)**

- **Migration Complete:** All 14 console calls in utility/UI modules migrated
- **Scopes Established:** `utils:*`, `ui:*`, `processing:*`, `model:*`
- **Logger Sources Confirmed:**
  - Electron uses `src/utils/LoggerFactory.ts`
  - Browser-app uses `browser-app/src/utils/logger.ts`
- **Bootstrap Pattern:** Logger implementation files retain internal console calls for bootstrap
- **All Tests Passing:** 1747 tests passing after Story 10.6

[Source: stories/10-6-utility-ui-logger-migration.md#Dev-Agent-Record]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-10.md#AC-10.7]
- [Source: docs/epics.md#Story-10.7]
- [Source: stories/10-6-utility-ui-logger-migration.md] - Previous story patterns
- [Source: docs/architecture.md#Logging-Strategy] - Logging architecture

## Definition of Done

- [ ] No imports of deprecated files exist in src/
- [ ] `src/utils/logger.ts` deleted
- [ ] `src/config/logging.ts` deleted
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes (1747+ tests)
- [ ] Electron app starts and logs work
- [ ] Single atomic commit created

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
| 2025-12-28 | 1.0 | Story drafted with deprecation removal details |
