# Story 5.2: User Correction Logging

Status: done

## Story

As a **system improving accuracy**,
I want **to log user corrections (dismissals and manual additions)**,
so that **patterns can be analyzed for future improvements**.

## Acceptance Criteria

| AC ID | Criterion |
|-------|-----------|
| AC-5.2.1 | Given user dismisses a false positive, when correction is made, then correction is logged with entity data, action type (DISMISS), and document context |
| AC-5.2.2 | Given user marks new PII manually, when correction is made, then correction is logged with marked text, action type (ADD), user-assigned type, and context |
| AC-5.2.3 | Logs are stored locally in app data directory as JSON files (corrections-YYYY-MM.json) |
| AC-5.2.4 | Logged data is anonymized - no actual PII stored, only patterns and type markers |
| AC-5.2.5 | User can opt-out of logging via settings toggle |

## Tasks / Subtasks

- [x] **Task 1: Create FeedbackLogger service** (AC: 5.2.1, 5.2.2, 5.2.3)
  - [x] Create `src/services/feedbackLogger.ts` with TypeScript
  - [x] Define `CorrectionEntry` interface with fields: id, timestamp, action, entityType, context, documentHash
  - [x] Implement `logCorrection(entry: CorrectionEntry): Promise<void>` method
  - [x] Implement `getLogFilePath(): string` using Electron's app.getPath('userData')
  - [x] Implement monthly file rotation (corrections-YYYY-MM.json format)

- [x] **Task 2: Implement PII anonymization for logs** (AC: 5.2.4)
  - [x] Create `anonymizeForLog(text: string, entityType: string): string` function
  - [x] Replace actual PII values with type markers: `[PERSON]`, `[EMAIL]`, `[PHONE]`, etc.
  - [x] Preserve context structure while removing sensitive content
  - [x] Add unit tests for anonymization logic

- [x] **Task 3: Add IPC handlers for logging** (AC: 5.2.1, 5.2.2)
  - [x] Add `feedback:log-correction` IPC channel in main.js
  - [x] Expose `logCorrection` method via preload.cjs contextBridge
  - [x] Add input validation for correction entries

- [x] **Task 4: Integrate with entity selection changes** (AC: 5.2.1)
  - [x] Hook into entity checkbox toggle in renderer.js (DISMISS action)
  - [x] Call `electronAPI.logCorrection()` when entity is deselected
  - [x] Include surrounding context (50 chars before/after) in log entry
  - [x] Handle entity re-selection (potential UNDO action)

- [x] **Task 5: Integrate with manual PII marking** (AC: 5.2.2)
  - [x] Hook into manual entity creation in renderer.js (ADD action)
  - [x] Log manual additions with user-selected entity type
  - [x] Include context and position information

- [x] **Task 6: Add privacy opt-out setting** (AC: 5.2.5)
  - [x] Add `feedbackLoggingEnabled` setting to app settings
  - [x] Add toggle UI in Entity Review panel header
  - [x] Check setting before logging any corrections
  - Note: i18n strings deferred (toggle uses tooltip)

- [x] **Task 7: Add unit tests for FeedbackLogger** (AC: all)
  - [x] Test correction logging creates file with correct structure
  - [x] Test anonymization removes PII but preserves context
  - [x] Test monthly file rotation
  - [x] Test opt-out setting prevents logging
  - [x] Test IPC handler validation

- [x] **Task 8: Run test suite and verify no regression** (AC: all)
  - [x] Run full test suite (679 tests passing)
  - [x] Run lint check (0 warnings)
  - [x] Verify TypeScript compilation

## Dev Notes

### Architecture Alignment

Story 5.2 continues Epic 5 (Confidence Scoring & Feedback) by implementing the feedback logging infrastructure. This builds on:
- Story 5.1: Confidence display (entities now show source, confidence, warnings)
- Story 4.3: Selective anonymization (entity selection/deselection triggers corrections)
- Story 4.4: Manual PII marking (manual additions are logged)

```
Epic 5 Flow:
Confidence Display (5.1) ✅ -> Correction Logging (5.2) -> Accuracy Dashboard (5.3)
                                      ^
                                      |
                         Triggers from Epic 4:
                         - Entity deselection (4.3)
                         - Manual PII marking (4.4)
```

### Learnings from Previous Story (5-1)

**From Story 5-1-confidence-score-display (Status: done)**

- **New Functions Created**: `getConfidenceClass()` at `renderer.js:997-1001`, `getSourceClass()` at `renderer.js:1008-1016` - can reference for consistent styling
- **Entity Rendering**: `renderEntityItem()` at `renderer.js:1018-1051` now includes confidence badge, source badge, warning indicator
- **Test Patterns**: Story 5.1 tests in `test/unit/entityReview.test.js` - follow same structure for FeedbackLogger tests
- **CSS Classes**: Source badges (`.entity-source-ml/rule/both/manual`) for consistent visual language

[Source: docs/sprint-artifacts/stories/5-1-confidence-score-display.md#Dev-Agent-Record]

### Component Location

**New Files:**
- `src/services/feedbackLogger.ts` - Core logging service
- `src/types/feedback.ts` - TypeScript interfaces for corrections (if not added to index.ts)
- `test/unit/feedbackLogger.test.js` - Unit tests

**Modified Files:**
- `main.js` - Add IPC handler for `feedback:log-correction`
- `preload.cjs` - Expose `logCorrection` via contextBridge
- `renderer.js` - Hook logging into entity selection and manual marking
- `locales/en.json`, `locales/fr.json`, `locales/de.json` - Add i18n strings for opt-out setting

### Log Entry Schema

```typescript
interface CorrectionEntry {
  id: string;                    // UUID
  timestamp: string;             // ISO 8601
  action: 'DISMISS' | 'ADD';     // Correction type
  entityType: string;            // PERSON, EMAIL, PHONE, etc.
  originalSource?: 'ML' | 'RULE' | 'BOTH';  // For DISMISS only
  confidence?: number;           // For DISMISS only
  context: string;               // Anonymized surrounding text
  documentHash: string;          // SHA-256 of document name (not content)
  position?: { start: number; end: number };
}
```

### Log File Location

```javascript
// Electron app data directory
const logDir = app.getPath('userData');
// Example: /Users/olivier/Library/Application Support/A5-PII-Anonymizer/corrections-2025-12.json
```

### Privacy Considerations

1. **No actual PII stored**: Replace "Bruno Figueiredo" with `[PERSON]`
2. **Document hash only**: SHA-256 hash of filename, not content
3. **Local storage only**: Never transmitted, stays in app data
4. **User control**: Opt-out toggle respects user preference
5. **Pattern focus**: Log structure focuses on detection patterns, not content

### Testing Standards

Follow existing patterns from `test/unit/entityReview.test.js`:
- Use Mocha + Chai
- Mock file system operations
- Test async operations with timeouts
- Cover edge cases (empty logs, corrupt files, etc.)

### References

- [Source: docs/epics.md#Story-5.2-User-Correction-Logging]
- [Source: docs/architecture.md#Epic-5-Confidence-Feedback]
- [Source: docs/architecture.md#src/services/feedbackLogger.ts]
- [Source: docs/sprint-artifacts/stories/5-1-confidence-score-display.md]
- Dependencies: Stories 4.3, 4.4 (User corrections infrastructure), Story 5.1 (Confidence display)

---

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/5-2-user-correction-logging.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

**Implementation completed 2025-12-12**

- Created complete feedback logging infrastructure with privacy-first design
- All corrections logged locally only, with PII anonymization
- Log files stored in app userData directory with monthly rotation
- User can opt-out via toggle in Entity Review panel header (defaults to enabled)
- 32 new unit tests added covering all acceptance criteria
- Full test suite: 679 tests passing, 0 lint warnings

### File List

**New Files Created:**
- `src/types/feedback.ts` - TypeScript interfaces for CorrectionEntry, LogCorrectionInput, FeedbackSettings
- `src/services/feedbackLogger.ts` - Core FeedbackLogger class with anonymization, hashing, file rotation
- `src/services/feedbackHandlers.ts` - IPC handlers for feedback operations
- `test/unit/feedbackLogger.test.js` - 32 unit tests for feedback logging

**Modified Files:**
- `src/types/index.ts` - Added exports for feedback types
- `main.js` - Added import and registration of feedbackHandlers
- `preload.cjs` - Added feedbackAPI contextBridge exposure
- `index.html` - Added feedback toggle button in Entity Review header
- `renderer.js` - Added logging integration:
  - `logEntityDismissal()` function at line 1648
  - `logManualPiiAddition()` function at line 1679
  - `extractEntityContext()` function at line 1712
  - `initFeedbackToggle()` function at line 1813
  - `updateFeedbackToggleUI()` function at line 1843
  - Integration in `handleEntitySelectionToggle()` and `handleManualPiiMark()`

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-11 | SM Agent (Opus 4.5) | Initial story creation from epics.md via create-story workflow |
| 2025-12-13 | Senior Dev Review (Opus 4.5) | Senior Developer Review notes appended, status → done |

---

## Senior Developer Review (AI)

### Reviewer
Olivier

### Date
2025-12-13

### Outcome
**✅ APPROVE** - All acceptance criteria fully implemented with evidence. All tasks verified complete.

### Summary
Story 5.2 (User Correction Logging) has been fully implemented with all acceptance criteria satisfied and all tasks completed. The implementation follows architectural patterns, includes proper privacy anonymization, and has comprehensive test coverage (36 tests passing).

### Key Findings

**HIGH Severity:** None

**MEDIUM Severity:** None

**LOW Severity:** None

### Acceptance Criteria Coverage

| AC ID | Description | Status | Evidence |
|-------|-------------|--------|----------|
| AC-5.2.1 | Log dismissals with entity data, action type (DISMISS), and document context | ✅ IMPLEMENTED | `renderer.js:1205` calls `logEntityDismissal()`, `feedbackLogger.ts:250-304` logs with action='DISMISS' |
| AC-5.2.2 | Log manual additions with marked text, action type (ADD), user-assigned type, and context | ✅ IMPLEMENTED | `renderer.js:1642` calls `logManualPiiAddition()`, input at `renderer.js:1686-1694` |
| AC-5.2.3 | Logs stored locally in app data directory as JSON files (corrections-YYYY-MM.json) | ✅ IMPLEMENTED | `feedbackLogger.ts:76` uses `app.getPath('userData')`, path generation at line 131-135 |
| AC-5.2.4 | Logged data is anonymized - no actual PII stored, only patterns and type markers | ✅ IMPLEMENTED | `feedbackLogger.ts:159-205` implements `anonymizeForLog()` with pattern-based replacement |
| AC-5.2.5 | User can opt-out of logging via settings toggle | ✅ IMPLEMENTED | `index.html:310` toggle button, `renderer.js:1813-1855` toggle logic, `feedbackLogger.ts:252-255` checks setting |

**Summary: 5 of 5 acceptance criteria fully implemented**

### Task Completion Validation

| Task | Marked As | Verified As | Evidence |
|------|-----------|-------------|----------|
| Task 1: Create FeedbackLogger service | ✅ Complete | ✅ VERIFIED | `src/services/feedbackLogger.ts` with class, types in `src/types/feedback.ts:20-50` |
| Task 2: Implement PII anonymization | ✅ Complete | ✅ VERIFIED | `anonymizeForLog()` at `feedbackLogger.ts:159-205`, tests at `feedbackLogger.test.js:91-143` |
| Task 3: Add IPC handlers | ✅ Complete | ✅ VERIFIED | `feedbackHandlers.ts:67-119`, `preload.cjs:277-332`, `main.ts:16,144` |
| Task 4: Integrate with entity selection (DISMISS) | ✅ Complete | ✅ VERIFIED | `renderer.js:1203-1206` calls `logEntityDismissal()` |
| Task 5: Integrate with manual PII marking (ADD) | ✅ Complete | ✅ VERIFIED | `renderer.js:1642` calls `logManualPiiAddition()` |
| Task 6: Add privacy opt-out setting | ✅ Complete | ✅ VERIFIED | Toggle at `index.html:310`, `initFeedbackToggle()` at `renderer.js:1813-1836` |
| Task 7: Add unit tests | ✅ Complete | ✅ VERIFIED | `test/unit/feedbackLogger.test.js` (480 lines, 32 tests) |
| Task 8: Run test suite | ✅ Complete | ✅ VERIFIED | 36 feedback tests pass |

**Summary: 8 of 8 completed tasks verified, 0 questionable, 0 falsely marked complete**

### Test Coverage and Gaps

**Tests Present:**
- ✅ DISMISS/ADD action entry structure
- ✅ Monthly log file rotation
- ✅ PII anonymization (EMAIL, PHONE, IBAN, AVS)
- ✅ Opt-out setting behavior
- ✅ Entry validation, UUID generation, context extraction

**Minor Gaps:**
- E2E test for full UI flow not present (acceptable - unit tests cover components)

### Architectural Alignment

- ✅ Uses `app.getPath('userData')` for storage
- ✅ TypeScript service with strict types
- ✅ IPC uses contextBridge with validation
- ✅ Follows existing patterns from `modelHandlers.ts`

### Security Notes

- ✅ All PII anonymized before logging (AC-5.2.4)
- ✅ Document name hashed with SHA-256
- ✅ Input validation in IPC handlers
- ✅ Silent failure in renderer (doesn't disrupt user workflow)

### Best-Practices and References

- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- Pattern-based anonymization follows GDPR pseudonymization principles

### Action Items

**Code Changes Required:**
- None required

**Advisory Notes:**
- Note: Consider adding E2E test for feedback toggle workflow in future sprint
- Note: i18n strings for toggle tooltip deferred (acceptable for this story)
