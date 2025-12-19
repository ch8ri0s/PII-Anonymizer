# Story 6.8: Constants and Magic Numbers

Status: done

## Story

As a **developer maintaining the codebase**,
I want **all magic numbers replaced with named constants**,
So that **values are documented and easy to change**.

## Acceptance Criteria

1. **AC1: Named Constants for Numeric Literals**
   - All non-trivial numeric literals are replaced with named constants
   - Constants have JSDoc comments explaining their purpose
   - Trivially obvious values (0, 1, empty string) are allowed inline

2. **AC2: Constants Configuration File**
   - Constants are grouped in `src/config/constants.ts`
   - Constants are organized by category: PREVIEW, PROCESSING, SECURITY, UI
   - All constants are exported with TypeScript types

3. **AC3: UI-Related Constants**
   - Preview limits (lines, chars) are configurable constants
   - File size limits are defined as constants
   - Timeout values are defined as constants

4. **AC4: Regex Quantifier Documentation**
   - Regex quantifiers have documented reasoning
   - Fuzzy match gap tolerance is a named constant
   - Pattern-specific limits are explained

5. **AC5: Tests Pass**
   - All existing tests continue to pass
   - New tests verify constants are correctly used
   - TypeScript compilation succeeds with zero errors

## Tasks / Subtasks

- [x] Task 1: Create Constants Configuration File (AC: 2)
  - [x] 1.1: Create `src/config/constants.ts` with category structure
  - [x] 1.2: Define PREVIEW constants (line limits, char limits)
  - [x] 1.3: Define PROCESSING constants (timeout, chunk size)
  - [x] 1.4: Define SECURITY constants (max file size, path limits)
  - [x] 1.5: Define UI constants (panel sizes, animation durations)
  - [x] 1.6: Add JSDoc comments for all constants

- [x] Task 2: Replace Magic Numbers in renderer.js (AC: 1, 3)
  - [x] 2.1: Replace `lines: 20, chars: 1000` with PREVIEW.LINE_LIMIT, PREVIEW.CHAR_LIMIT
  - [x] 2.2: Replace other preview-related magic numbers
  - [x] 2.3: Replace timeout values with named constants via TIMEOUT_CONFIG
  - [x] 2.4: Import constants via preload bridge (window.constants)

- [x] Task 3: Replace Magic Numbers in fileProcessor.js (AC: 1, 4)
  - [x] 3.1: Replace `{0,2}` with PROCESSING.FUZZY_MATCH_GAP_TOLERANCE
  - [x] 3.2: Document regex quantifier reasoning with comments
  - [x] 3.3: Replace MAX_ENTITY_LENGTH, MIN_ENTITY_LENGTH with constants
  - [x] 3.4: Import PROCESSING constants module from dist/

- [x] Task 4: Replace Magic Numbers in TypeScript Files (AC: 1, 3)
  - [x] 4.1: Updated src/services/filePreviewHandlers.ts - use PREVIEW constants
  - [x] 4.2: Updated src/services/accuracyStats.ts - use LOGGING constants
  - [x] 4.3: Updated src/utils/previewGenerator.ts - use PREVIEW constants
  - [x] 4.4: Constants exported from src/config/constants.ts

- [x] Task 5: Update Existing Constants (AC: 2)
  - [x] 5.1: Updated src/utils/asyncTimeout.ts - use TIMEOUT and PROCESSING constants
  - [x] 5.2: Updated src/utils/ipcValidator.ts - use SECURITY constants
  - [x] 5.3: All constants consolidated into src/config/constants.ts
  - [x] 5.4: Updated imports across all affected files

- [x] Task 6: Verification (AC: 5)
  - [x] 6.1: Run `npm run compile` - zero TypeScript errors
  - [x] 6.2: Run `npm test` - 1006 tests passing
  - [x] 6.3: Run `npm run lint:check` - no new lint warnings
  - [x] 6.4: Created test/unit/constants.test.js - 41 tests for constants

## Dev Notes

### Current Implementation Analysis

**Identified Magic Numbers (from CODE_REVIEW.md):**
- `renderer.js:227`: `lines: 20, chars: 1000` - preview limits
- `fileProcessor.js:123`: `{0,3}` - fuzzy match gap tolerance
- Various timeout values across codebase
- File size limits in validation

**Existing Constants Locations:**
- `src/utils/asyncTimeout.ts` - DEFAULT_TIMEOUT_CONFIG, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS
- `src/utils/ipcValidator.ts` - validation limits
- `src/utils/errorHandler.ts` - REDACTED_PATH constant

### Technical Approach

1. **Constants File Structure:**
   ```typescript
   // src/config/constants.ts

   /** Preview configuration */
   export const PREVIEW = {
     /** Maximum lines shown in file preview */
     LINE_LIMIT: 20,
     /** Maximum characters shown in file preview */
     CHAR_LIMIT: 1000,
     /** Maximum preview file size in bytes */
     MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
   } as const;

   /** Processing configuration */
   export const PROCESSING = {
     /** Gap tolerance for fuzzy regex matching */
     FUZZY_MATCH_GAP_TOLERANCE: 3,
     /** Default processing timeout in ms */
     DEFAULT_TIMEOUT_MS: 60000,
     /** Chunk size for large file processing */
     CHUNK_SIZE_BYTES: 1024 * 1024, // 1MB
   } as const;

   /** Security limits */
   export const SECURITY = {
     /** Maximum file size allowed for processing */
     MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
     /** Maximum path length */
     MAX_PATH_LENGTH: 4096,
   } as const;
   ```

2. **JavaScript Module Access:**
   - For renderer.js: Use preload bridge to expose constants
   - For fileProcessor.js: Import compiled constants from dist/

### Project Structure Notes

- New file: `src/config/constants.ts`
- Modify: `renderer.js`, `fileProcessor.js`, `main.js`
- Modify: TypeScript files in `src/services/` and `src/utils/`
- Update: `preload.cjs` to expose constants to renderer

### References

- [Source: docs/CODE_REVIEW.md#Issue-19 - Magic Numbers]
- [Source: docs/epics.md#Story-6.8]
- [Source: src/utils/asyncTimeout.ts - Existing timeout constants]
- [Source: src/utils/errorHandler.ts - REDACTED_PATH constant example]

### Learnings from Previous Story

**From Story 6-7-error-handling-standardization (Status: done)**

- **Pattern Established**: Constants should be exported with JSDoc documentation (see `REDACTED_PATH` in errorHandler.ts:41)
- **Type Safety**: Use `as const` for constant objects to get literal types
- **Export Pattern**: Export constants from `src/types/index.ts` for easy access
- **File Created**: `src/utils/errorHandler.ts` demonstrates good constant patterns
- **Test Coverage**: Constants should have tests verifying their usage

[Source: stories/6-7-error-handling-standardization.md#Dev-Agent-Record]

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-18 | Claude | Story drafted from epics.md |
| 2025-12-18 | Claude | Implementation completed - all tasks done |
| 2025-12-18 | Claude | Senior Developer Review: APPROVED - all ACs verified |

## Dev Agent Record

### Context Reference

- [docs/sprint-artifacts/stories/6-8-constants-magic-numbers.context.xml](./6-8-constants-magic-numbers.context.xml)

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Implementation proceeded without errors

### Completion Notes List

1. **Central Constants File Created** (`src/config/constants.ts`):
   - PREVIEW: LINE_LIMIT (20), CHAR_LIMIT (1000), DEFAULT_LINES (100), DEFAULT_CHARS (10000)
   - PROCESSING: FUZZY_MATCH_GAP_TOLERANCE (2), MAX_ENTITY_LENGTH (50), MIN_ENTITY_LENGTH (3), etc.
   - SECURITY: MAX_FILE_SIZE_BYTES (100MB), MAX_STRING_LENGTH (1MB), MAX_PATH_LENGTH (4096), etc.
   - TIMEOUT: FILE_PROCESSING_MS (60s), FILE_PREVIEW_MS (30s), MIN_MS (10s), MAX_MS (600s)
   - LOGGING: MAX_LOG_FILES (60), MAX_ENTRIES_PER_FILE (10000), MAX_TOTAL_ENTRIES (100000)
   - UI: ANIMATION_DURATION_MS (200), SEARCH_DEBOUNCE_MS (300), TOAST_DURATION_MS (3000)

2. **Preload Bridge Integration** (`preload.cjs`):
   - Added `window.constants` API exposing PREVIEW, TIMEOUT, PROCESSING, UI constants
   - Enables renderer.js to access TypeScript-defined constants safely

3. **Existing Constants Consolidated**:
   - asyncTimeout.ts now uses TIMEOUT and PROCESSING constants
   - ipcValidator.ts now uses SECURITY constants
   - accuracyStats.ts now uses LOGGING constants
   - previewGenerator.ts now uses PREVIEW constants

4. **Test Suite** (`test/unit/constants.test.js`):
   - 41 unit tests verifying all constant values and structure
   - Value consistency checks (MIN < MAX relationships, timeout ordering)

### File List

**New Files:**
- `src/config/constants.ts` - Central constants configuration (293 lines)
- `test/unit/constants.test.js` - Constants unit tests (233 lines)

**Modified Files:**
- `renderer.js` - Use TIMEOUT and PREVIEW from preload bridge
- `fileProcessor.js` - Use PROCESSING constants for entity limits and regex
- `preload.cjs` - Expose constants via window.constants API
- `src/services/filePreviewHandlers.ts` - Use PREVIEW constants for defaults
- `src/services/accuracyStats.ts` - Use LOGGING constants for limits
- `src/utils/previewGenerator.ts` - Use PREVIEW constants for defaults
- `src/utils/asyncTimeout.ts` - Use TIMEOUT and PROCESSING constants
- `src/utils/ipcValidator.ts` - Use SECURITY constants for validation limits

---

## Senior Developer Review (AI)

### Reviewer
Olivier

### Date
2025-12-18

### Outcome
**APPROVE** - All acceptance criteria fully implemented with comprehensive evidence. All tasks verified complete.

### Summary
Excellent implementation of a centralized constants configuration system. The code is well-organized, thoroughly documented with JSDoc, properly typed with TypeScript, and includes comprehensive tests. Magic numbers have been successfully replaced across 8 files with references to the new central constants module.

### Key Findings

**No HIGH severity issues found.**

**No MEDIUM severity issues found.**

**LOW severity (Advisory):**
- Note: The story's Dev Notes section (lines 96-126) shows an outdated example with `FUZZY_MATCH_GAP_TOLERANCE: 3` but the actual implementation correctly uses `2` - this is just documentation that wasn't updated, not a code issue.

### Acceptance Criteria Coverage

| AC# | Description | Status | Evidence |
|-----|-------------|--------|----------|
| AC1 | Named Constants for Numeric Literals | ✅ IMPLEMENTED | `src/config/constants.ts:23-253` - All constants have JSDoc comments explaining their purpose |
| AC2 | Constants Configuration File | ✅ IMPLEMENTED | `src/config/constants.ts` created with 6 categories: PREVIEW, PROCESSING, SECURITY, TIMEOUT, LOGGING, UI. All exported with TypeScript types (lines 259-275) |
| AC3 | UI-Related Constants | ✅ IMPLEMENTED | Preview limits: `constants.ts:23-47`, File size: `constants.ts:119`, Timeout: `constants.ts:158-197` |
| AC4 | Regex Quantifier Documentation | ✅ IMPLEMENTED | `constants.ts:57-104` with detailed JSDoc including `@example` and `@security` tags. `fileProcessor.js:391-393` documents regex pattern usage |
| AC5 | Tests Pass | ✅ IMPLEMENTED | `test/unit/constants.test.js:1-233` with 41 tests. TypeScript compiles with 0 errors, npm test shows 1006 passing tests |

**Summary: 5 of 5 acceptance criteria fully implemented**

### Task Completion Validation

| Task | Marked As | Verified As | Evidence |
|------|-----------|-------------|----------|
| 1.1: Create constants.ts with category structure | [x] | ✅ VERIFIED | `src/config/constants.ts` exists with 6 categories |
| 1.2: Define PREVIEW constants | [x] | ✅ VERIFIED | `constants.ts:23-47` - LINE_LIMIT, CHAR_LIMIT, DEFAULT_LINES, DEFAULT_CHARS |
| 1.3: Define PROCESSING constants | [x] | ✅ VERIFIED | `constants.ts:57-104` - 7 constants including FUZZY_MATCH_GAP_TOLERANCE |
| 1.4: Define SECURITY constants | [x] | ✅ VERIFIED | `constants.ts:114-144` - MAX_FILE_SIZE_BYTES, MAX_STRING_LENGTH, etc. |
| 1.5: Define UI constants | [x] | ✅ VERIFIED | `constants.ts:235-253` - ANIMATION_DURATION_MS, SEARCH_DEBOUNCE_MS, TOAST_DURATION_MS |
| 1.6: Add JSDoc comments | [x] | ✅ VERIFIED | All constants have `@description`, some have `@example`, `@security` tags |
| 2.1: Replace lines/chars in renderer.js | [x] | ✅ VERIFIED | `renderer.js:507-508` uses `PREVIEW.LINE_LIMIT`, `PREVIEW.CHAR_LIMIT` |
| 2.2: Replace other preview numbers | [x] | ✅ VERIFIED | N/A - No other preview numbers identified |
| 2.3: Replace timeout values | [x] | ✅ VERIFIED | `renderer.js:45-50` uses `TIMEOUT.*` constants |
| 2.4: Import via preload bridge | [x] | ✅ VERIFIED | `renderer.js:43`, `preload.cjs:341-350` |
| 3.1: Replace regex quantifier | [x] | ✅ VERIFIED | `fileProcessor.js:393` uses `PROCESSING.FUZZY_MATCH_GAP_TOLERANCE` |
| 3.2: Document regex reasoning | [x] | ✅ VERIFIED | `fileProcessor.js:390-392` comments explain the pattern |
| 3.3: Replace entity length limits | [x] | ✅ VERIFIED | `fileProcessor.js:350,360,366` uses PROCESSING constants |
| 3.4: Import constants module | [x] | ✅ VERIFIED | `fileProcessor.js:11` |
| 4.1: Update filePreviewHandlers.ts | [x] | ✅ VERIFIED | `filePreviewHandlers.ts:31,141-147` |
| 4.2: Update accuracyStats.ts | [x] | ✅ VERIFIED | `accuracyStats.ts:22,148-192` |
| 4.3: Update previewGenerator.ts | [x] | ✅ VERIFIED | `previewGenerator.ts:17,26-27` |
| 4.4: Export from constants.ts | [x] | ✅ VERIFIED | `constants.ts:259-293` |
| 5.1: Update asyncTimeout.ts | [x] | ✅ VERIFIED | `asyncTimeout.ts:10,48-58,234` |
| 5.2: Update ipcValidator.ts | [x] | ✅ VERIFIED | `ipcValidator.ts:21,91-94,130,138` |
| 5.3: Consolidate constants | [x] | ✅ VERIFIED | All constants now in `src/config/constants.ts` |
| 5.4: Update imports | [x] | ✅ VERIFIED | 8 files updated with imports |
| 6.1: TypeScript compiles | [x] | ✅ VERIFIED | `npm run compile` exits with 0 errors |
| 6.2: All tests pass | [x] | ✅ VERIFIED | 1006 tests passing |
| 6.3: No new lint warnings | [x] | ✅ VERIFIED | No warnings in constants.ts (existing warnings in other files unchanged) |
| 6.4: Constants tests created | [x] | ✅ VERIFIED | `test/unit/constants.test.js` with 41 tests |

**Summary: 26 of 26 completed tasks verified, 0 questionable, 0 falsely marked complete**

### Test Coverage and Gaps

**Tests Present:**
- `test/unit/constants.test.js` - 41 comprehensive unit tests covering:
  - All constant values verification
  - Structure/key validation for each category
  - Value consistency checks (MIN < MAX relationships)
  - Timeout ordering validation

**No gaps identified.** Test coverage is comprehensive for constants validation.

### Architectural Alignment

✅ **Constants pattern follows established patterns**:
- Uses `as const` for TypeScript literal types (matching errorHandler.ts pattern)
- JSDoc documentation on all exports
- Grouped by functional category
- Preload bridge integration for renderer process access

✅ **Module boundaries respected**:
- Central constants in `src/config/constants.ts`
- TypeScript files import from source
- JavaScript files import from `dist/`
- Renderer accesses via `window.constants`

### Security Notes

✅ **No security issues introduced.** The implementation correctly:
- Exposes only PREVIEW, TIMEOUT, PROCESSING, UI constants to renderer (not SECURITY or LOGGING)
- Security constants remain in main process only
- No new IPC channels added

### Best-Practices and References

- [TypeScript const assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#literal-types) - used correctly with `as const`
- [Electron contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge) - proper isolation maintained
- [JSDoc documentation](https://jsdoc.app/) - comprehensive documentation on all constants

### Action Items

**Code Changes Required:**
None - implementation is complete and correct.

**Advisory Notes:**
- Note: Consider adding a CLAUDE.md entry about the constants configuration pattern for future developers
- Note: The Dev Notes section example in the story file shows outdated values (no action required, just informational)
