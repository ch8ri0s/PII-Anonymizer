# Story 7.8: User Correction Feedback Logging

**Epic:** Epic 7 - Browser Migration
**Status:** drafted
**Created:** 2025-12-23
**Developer:** TBD

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
- [ ] Create `browser-app/src/services/FeedbackStore.ts`
- [ ] Define IndexedDB schema: `corrections` object store with indexes
- [ ] Implement `openDatabase(): Promise<IDBDatabase>`
- [ ] Implement `addEntry(entry: CorrectionEntry): Promise<string>`
- [ ] Implement `getEntriesByMonth(month: string): Promise<CorrectionEntry[]>`
- [ ] Implement monthly rotation: delete entries older than retention period
- [ ] Handle IndexedDB errors gracefully (storage quota, private browsing)

### Task 2: Anonymization Engine (AC: #8)
- [ ] Create `browser-app/src/services/LogAnonymizer.ts`
- [ ] Port anonymization patterns from `src/services/feedbackLogger.ts:159-205`
- [ ] Implement `anonymizeForLog(text: string, entityType: string, originalText?: string): string`
- [ ] Replace emails, phones, IBANs, AVS numbers with type markers
- [ ] Replace specific PII text with entity type marker
- [ ] Use Web Crypto API for document hash (SHA-256)

### Task 3: Feedback Logger Service (AC: #1, #2, #3)
- [ ] Create `browser-app/src/services/FeedbackLogger.ts`
- [ ] Port type definitions from `src/types/feedback.ts`
- [ ] Implement `logCorrection(input: LogCorrectionInput): Promise<LogResult>`
- [ ] Generate UUID for entry ID (crypto.randomUUID())
- [ ] Include detection source and confidence for DISMISS actions
- [ ] Include position data when available
- [ ] Handle async storage with proper error handling

### Task 4: Settings Management (AC: #4, #5)
- [ ] Create settings object in `FeedbackLogger.ts`
- [ ] Store enabled/disabled state in localStorage
- [ ] Implement `isEnabled(): boolean`
- [ ] Implement `setEnabled(enabled: boolean): void`
- [ ] Check enabled state before logging any correction
- [ ] Default to enabled (opt-out model, per Electron behavior)

### Task 5: Statistics API (AC: #6)
- [ ] Implement `getStatistics(): Promise<FeedbackStatistics>`
- [ ] Return: totalCorrections, byType (map), byAction (DISMISS/ADD counts)
- [ ] Implement `getRecentCorrections(limit: number): Promise<CorrectionEntry[]>`
- [ ] Cache statistics for performance (invalidate on new entry)

### Task 6: Integration with Entity Review (AC: #1, #2, #3)
- [ ] Hook into EntitySidebar selection change events
- [ ] Log DISMISS when entity is deselected (was selected → now unselected)
- [ ] Log ADD when manual entity is created via context menu
- [ ] Pass document filename from current file for hashing
- [ ] Extract context (surrounding text) for logging

### Task 7: UI for Settings (AC: #4)
- [ ] Add "Feedback Logging" toggle to settings panel/modal
- [ ] Show current state (enabled/disabled) with description
- [ ] Add tooltip explaining what is logged and privacy guarantees
- [ ] Optional: Show correction count in settings

### Task 8: Testing (AC: #1-8)
- [ ] Create `browser-app/test/services/FeedbackStore.test.ts`
- [ ] Create `browser-app/test/services/LogAnonymizer.test.ts`
- [ ] Create `browser-app/test/services/FeedbackLogger.test.ts`
- [ ] Test IndexedDB operations with fake-indexeddb
- [ ] Test anonymization patterns remove all PII
- [ ] Test settings persistence
- [ ] Test statistics calculation
- [ ] Test monthly rotation
- [ ] Target: 40+ new tests

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

- [ ] Corrections logged to IndexedDB on entity deselection
- [ ] Corrections logged to IndexedDB on manual entity addition
- [ ] All logged text is anonymized (no PII in storage)
- [ ] Settings toggle enables/disables logging
- [ ] Settings persist across sessions
- [ ] Statistics API returns correction counts
- [ ] Monthly rotation prevents unbounded growth
- [ ] All tests passing (target: 40+ new tests)
- [ ] Works in Chrome, Firefox, Safari, Edge
- [ ] Works in private/incognito mode (graceful degradation)

---

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2025-12-23 | 1.0.0 | Story drafted via correct-course workflow |
