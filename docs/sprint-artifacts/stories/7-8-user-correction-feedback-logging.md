# Story 7.8: User Correction Feedback Logging

**Epic:** Epic 7 - Browser Migration
**Status:** done
**Created:** 2025-12-23
**Developer:** Claude Code

---

## User Story

As a **product owner analyzing detection accuracy**,
I want **user corrections (dismissed entities and manual additions) to be logged locally**,
So that **I can analyze patterns in false positives/negatives and improve detection accuracy over time**.

---

## Acceptance Criteria

**Given** a user is reviewing detected entities in the browser app
**When** user dismisses (deselects) a detected entity or adds a manual entity
**Then**:

1. **AC1:** Correction is logged to IndexedDB with anonymized context (PII replaced with type markers)
2. **AC2:** Log entry includes: action type, entity type, anonymized context, document hash, timestamp
3. **AC3:** For dismissals: original detection source (ML/RULE) and confidence score are recorded
4. **AC4:** User can enable/disable feedback logging via settings toggle
5. **AC5:** Settings preference persists in localStorage
6. **AC6:** Simple statistics are exposed: total corrections, corrections by type, corrections by action
7. **AC7:** Logs rotate monthly with configurable max retention (default: 6 months)
8. **AC8:** No PII is ever stored in logs - all text is anonymized before storage

---

## Prerequisites

- [x] Story 7.4 (entity review UI) - Completed 2025-12-22
- [ ] Story 7.7 (manual PII marking UI) - Recommended but not blocking

---

## Technical Tasks

### Task 1: IndexedDB Storage Setup (AC: #1, #7)
- [x] Create `browser-app/src/services/FeedbackStore.ts`
- [x] Define IndexedDB schema: `corrections` object store with indexes
- [x] Implement `openDatabase(): Promise<IDBDatabase>`
- [x] Implement `addEntry(entry: CorrectionEntry): Promise<string>`
- [x] Implement `getEntriesByMonth(month: string): Promise<CorrectionEntry[]>`
- [x] Implement monthly rotation: delete entries older than retention period
- [x] Handle IndexedDB errors gracefully (storage quota, private browsing)

### Task 2: Anonymization Engine (AC: #8)
- [x] Create `browser-app/src/services/LogAnonymizer.ts`
- [x] Port anonymization patterns from `src/services/feedbackLogger.ts:159-205`
- [x] Implement `anonymizeForLog(text: string, entityType: string, originalText?: string): string`
- [x] Replace emails, phones, IBANs, AVS numbers with type markers
- [x] Replace specific PII text with entity type marker
- [x] Use Web Crypto API for document hash (SHA-256)

### Task 3: Feedback Logger Service (AC: #1, #2, #3)
- [x] Create `browser-app/src/services/FeedbackLogger.ts`
- [x] Port type definitions from `src/types/feedback.ts`
- [x] Implement `logCorrection(input: LogCorrectionInput): Promise<LogResult>`
- [x] Generate UUID for entry ID (crypto.randomUUID())
- [x] Include detection source and confidence for DISMISS actions
- [x] Include position data when available
- [x] Handle async storage with proper error handling

### Task 4: Settings Management (AC: #4, #5)
- [x] Create settings object in `FeedbackLogger.ts`
- [x] Store enabled/disabled state in localStorage
- [x] Implement `isEnabled(): boolean`
- [x] Implement `setEnabled(enabled: boolean): void`
- [x] Check enabled state before logging any correction
- [x] Default to enabled (opt-out model, per Electron behavior)

### Task 5: Statistics API (AC: #6)
- [x] Implement `getStatistics(): Promise<FeedbackStatistics>`
- [x] Return: totalCorrections, byType (map), byAction (DISMISS/ADD counts)
- [x] Implement `getRecentCorrections(limit: number): Promise<CorrectionEntry[]>`
- [x] Cache statistics for performance (invalidate on new entry)

### Task 6: Integration with Entity Review (AC: #1, #2, #3)
- [x] Hook into EntitySidebar selection change events
- [x] Log DISMISS when entity is deselected (was selected → now unselected)
- [x] Log ADD when manual entity is created via context menu
- [x] Pass document filename from current file for hashing
- [x] Extract context (surrounding text) for logging

### Task 7: UI for Settings (AC: #4)
- [x] Add "Feedback Logging" toggle to settings panel/modal
- [x] Show current state (enabled/disabled) with description
- [x] Add tooltip explaining what is logged and privacy guarantees
- [x] Optional: Show correction count in settings

### Task 8: Testing (AC: #1-8)
- [x] Create `browser-app/test/services/FeedbackStore.test.ts` (25 tests)
- [x] Create `browser-app/test/services/LogAnonymizer.test.ts` (31 tests)
- [x] Create `browser-app/test/services/FeedbackLogger.test.ts` (30 tests)
- [x] Create `browser-app/test/services/FeedbackIntegration.test.ts` (27 tests)
- [x] Test IndexedDB operations with fake-indexeddb
- [x] Test anonymization patterns remove all PII
- [x] Test settings persistence
- [x] Test statistics calculation
- [x] Test monthly rotation
- [x] Target: 40+ new tests (**Achieved: 113 tests**)

---

## Dev Notes

### Learnings from Previous Stories

**From Story 7-5-file-download-batch-processing (Status: done)**

- **Singleton Pattern**: Use for shared services like FeedbackLogger
- **Async Error Handling**: Wrap IndexedDB operations in try-catch with fallbacks
- **Test Pattern**: Use vitest + happy-dom, mock browser APIs

**From Story 5-2-user-correction-logging (Electron - Status: done)**

- **Privacy-First Design**: Never log actual PII, only anonymized context
- **Opt-Out Model**: Default enabled, user can disable
- **Monthly Rotation**: Prevent unbounded storage growth

### Electron Implementation Reference

| Electron File | Browser Equivalent | Notes |
|---------------|-------------------|-------|
| `src/services/feedbackLogger.ts` | `browser-app/src/services/FeedbackLogger.ts` | Port logic, change storage |
| `src/types/feedback.ts` | `browser-app/src/types/feedback.ts` | Direct copy with adjustments |
| `fs` file storage | IndexedDB | Browser-native storage |
| `crypto` (Node) | Web Crypto API | Browser-native crypto |
| `app.getPath('userData')` | IndexedDB database | No file system access |

### IndexedDB Schema

```typescript
// Database: 'pii-anonymizer-feedback'
// Version: 1

interface CorrectionEntry {
  id: string;              // UUID, primary key
  timestamp: string;       // ISO 8601, indexed for rotation
  month: string;           // YYYY-MM, indexed for queries
  action: 'DISMISS' | 'ADD';
  entityType: string;
  context: string;         // Anonymized text
  documentHash: string;    // SHA-256 hash of filename
  originalSource?: 'ML' | 'REGEX' | 'BOTH';
  confidence?: number;
  position?: { start: number; end: number };
}

// Indexes:
// - 'by-month': month field for monthly queries
// - 'by-timestamp': timestamp field for rotation
// - 'by-type': entityType field for statistics
```

### Anonymization Patterns (from Electron)

```typescript
const ENTITY_TYPE_MARKERS: Record<string, string> = {
  PERSON: '[PERSON]',
  ORGANIZATION: '[ORG]',
  ADDRESS: '[ADDRESS]',
  SWISS_AVS: '[AVS]',
  IBAN: '[IBAN]',
  PHONE: '[PHONE]',
  EMAIL: '[EMAIL]',
  DATE: '[DATE]',
  // ... more types
};

// Regex patterns for additional anonymization:
// - Email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g → '[EMAIL]'
// - Swiss phone: /(\+41|0041|0)[\s.-]?[0-9]{2}[\s.-]?[0-9]{3}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}/g → '[PHONE]'
// - IBAN: /[A-Z]{2}[0-9]{2}[\s]?[A-Z0-9]{4}[\s]?[0-9]{4}[\s]?[0-9]{4}[\s]?[0-9]{4}[\s]?[0-9]{4}[\s]?[0-9]{0,2}/gi → '[IBAN]'
// - Swiss AVS: /756[.\s-]?\d{4}[.\s-]?\d{4}[.\s-]?\d{2}/g → '[AVS]'
```

### Web Crypto API Usage

```typescript
// Document hash using Web Crypto
async function hashDocumentName(filename: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(filename);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex.slice(0, 16); // First 16 chars
}

// UUID generation
const entryId = crypto.randomUUID();
```

### Statistics Interface

```typescript
interface FeedbackStatistics {
  totalCorrections: number;
  byAction: {
    DISMISS: number;
    ADD: number;
  };
  byType: Record<string, number>;
  oldestEntry?: string;  // ISO timestamp
  newestEntry?: string;  // ISO timestamp
}
```

### References

- [Source: src/services/feedbackLogger.ts] - Electron implementation to port
- [Source: src/types/feedback.ts] - Type definitions
- [Source: docs/sprint-artifacts/stories/5-2-user-correction-logging.md] - Original Electron story
- [MDN IndexedDB Guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [MDN Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

---

## Definition of Done

- [x] Corrections logged to IndexedDB on entity deselection
- [x] Corrections logged to IndexedDB on manual entity addition
- [x] All logged text is anonymized (no PII in storage)
- [x] Settings toggle enables/disables logging
- [x] Settings persist across sessions
- [x] Statistics API returns correction counts
- [x] Monthly rotation prevents unbounded growth
- [x] All tests passing (target: 40+ new tests) - **113 tests passing**
- [x] Works in Chrome, Firefox, Safari, Edge
- [x] Works in private/incognito mode (graceful degradation)

---

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/7-8-user-correction-feedback-logging.context.xml

### Agent Model Used

Claude Opus 4.5

### Debug Log References

- N/A

### Completion Notes List

1. Implemented complete feedback logging system for browser using IndexedDB
2. All 8 acceptance criteria met
3. Created 113 tests (target was 40+)
4. Key decisions:
   - Chose fake-indexeddb for test mocking (works well with vitest)
   - Pattern-based anonymization applied before name replacement to avoid disrupting structured PII
   - IBAN pattern split into spaced and compact variants for accurate matching
   - Database cleanup uses deleteAllEntries instead of deleteDatabase to avoid connection blocking in tests

### File List

**New Files:**
- `browser-app/src/types/feedback.ts` - Type definitions for feedback system
- `browser-app/src/services/FeedbackStore.ts` - IndexedDB operations
- `browser-app/src/services/LogAnonymizer.ts` - PII anonymization engine
- `browser-app/src/services/FeedbackLogger.ts` - Main logging service
- `browser-app/src/services/FeedbackIntegration.ts` - Integration hooks for UI
- `browser-app/src/components/FeedbackSettingsPanel.ts` - Settings UI component
- `browser-app/test/services/FeedbackStore.test.ts` - 25 tests
- `browser-app/test/services/LogAnonymizer.test.ts` - 31 tests
- `browser-app/test/services/FeedbackLogger.test.ts` - 30 tests
- `browser-app/test/services/FeedbackIntegration.test.ts` - 27 tests

**Modified Files:**
- `browser-app/src/services/index.ts` - Added feedback exports
- `browser-app/src/components/index.ts` - Added FeedbackSettingsPanel export
- `browser-app/src/components/PreviewPanel.ts` - Integrated feedback hooks

---

## Senior Developer Review

### Review Date
2025-12-24

### Reviewer
Claude Opus 4.5 (Senior Developer Code Review)

### Review Status
**APPROVED** ✅

### Acceptance Criteria Verification

| AC | Requirement | Status | Evidence |
|----|-------------|--------|----------|
| AC1 | Correction logged to IndexedDB with anonymized context | ✅ PASS | `FeedbackStore.ts:122-139` - `addEntry()` stores entries; `FeedbackLogger.ts:166-170` - anonymizes before storage |
| AC2 | Log entry includes: action type, entity type, anonymized context, document hash, timestamp | ✅ PASS | `FeedbackLogger.ts:174-182` - `CorrectionEntry` contains all required fields; Tests: `FeedbackStore.test.ts:84-109` |
| AC3 | For dismissals: original detection source and confidence score recorded | ✅ PASS | `FeedbackLogger.ts:185-192` - conditional fields for DISMISS action only; Tests: `FeedbackLogger.test.ts:217-231` |
| AC4 | User can enable/disable feedback logging via settings toggle | ✅ PASS | `FeedbackSettingsPanel.ts:241-248` - toggle UI; `FeedbackLogger.ts:112-116` - `setEnabled()` function |
| AC5 | Settings preference persists in localStorage | ✅ PASS | `FeedbackLogger.ts:77-86` - `saveSettings()` uses localStorage; Tests: `FeedbackLogger.test.ts:64-72` |
| AC6 | Simple statistics exposed: total corrections, by type, by action | ✅ PASS | `FeedbackLogger.ts:221-280` - `getStatistics()` returns `FeedbackStatistics`; Tests: `FeedbackLogger.test.ts:248-329` |
| AC7 | Logs rotate monthly with configurable max retention | ✅ PASS | `FeedbackStore.ts:250-285` - `deleteEntriesOlderThan()`; `FeedbackLogger.ts:309-326` - `runRotation()`; Tests: `FeedbackStore.test.ts:206-263` |
| AC8 | No PII ever stored in logs - all text anonymized | ✅ PASS | `LogAnonymizer.ts:113-156` - `anonymizeForLog()` applies pattern and name replacement; Tests: `LogAnonymizer.test.ts:43-126` (31 tests) |

### Technical Tasks Verification

All 8 tasks marked complete and verified:

1. **IndexedDB Storage Setup** ✅ - `FeedbackStore.ts` (363 lines) with proper schema, indexes, and rotation
2. **Anonymization Engine** ✅ - `LogAnonymizer.ts` (237 lines) with IBAN/AVS/email/phone patterns
3. **Feedback Logger Service** ✅ - `FeedbackLogger.ts` (356 lines) with singleton pattern, settings, statistics
4. **Settings Management** ✅ - localStorage persistence, opt-out model (default enabled)
5. **Statistics API** ✅ - Cached statistics with 60-second TTL, counts by action and type
6. **Integration with Entity Review** ✅ - `FeedbackIntegration.ts` hooks into `PreviewPanel.ts:305-389`
7. **UI for Settings** ✅ - `FeedbackSettingsPanel.ts` (363 lines) with toggle, stats display, privacy info
8. **Testing** ✅ - 113 tests (target: 40+) across 4 test files

### Code Quality Assessment

**Strengths:**
- Clean separation of concerns: Store, Logger, Anonymizer, Integration layers
- Comprehensive test coverage (113 tests vs 40+ target)
- Proper TypeScript types defined in `src/types/feedback.ts`
- Good error handling with graceful degradation for private browsing
- Pattern ordering in anonymization prevents partial matches (IBAN before phone/postal)
- Module-level singleton pattern with reset functions for testability

**Architecture:**
- IndexedDB with 4 indexes (by-month, by-timestamp, by-type, by-action)
- Statistics caching prevents repeated DB reads
- Selection tracking via Map for efficient DISMISS detection
- Web Crypto API for SHA-256 hashing with fallback for testing

**Security:**
- No PII stored - verified by 31 anonymization tests
- Document names hashed (16-char truncated SHA-256)
- Pattern-based anonymization applied before name replacement
- Monthly rotation prevents unbounded storage growth

### Test Coverage Summary

| Test File | Tests | Focus |
|-----------|-------|-------|
| FeedbackStore.test.ts | 25 | IndexedDB operations, rotation |
| LogAnonymizer.test.ts | 31 | PII patterns, hashing, UUID |
| FeedbackLogger.test.ts | 30 | Logging, settings, statistics |
| FeedbackIntegration.test.ts | 27 | Selection tracking, context extraction |
| **Total** | **113** | All acceptance criteria covered |

### Recommendations for Future Stories

1. Consider adding export functionality for correction logs (CSV/JSON)
2. Statistics dashboard UI could be added as enhancement
3. Batch log analysis could provide detection improvement insights

### Approval

This story meets all acceptance criteria with comprehensive test coverage. The implementation follows existing project patterns, maintains privacy guarantees, and integrates cleanly with the entity review UI. **APPROVED** for completion.

---

## Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2025-12-23 | 1.0.0 | Story drafted via correct-course workflow |
| 2025-12-24 | 2.0.0 | Implementation completed: 113 tests, all ACs met |
| 2025-12-24 | 2.1.0 | Senior Developer Review: APPROVED |
