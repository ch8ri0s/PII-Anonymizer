# Story 8.9: User Feedback → Learning Loop

## Story

As a **PII system owner**,  
I want **user corrections from the Entity Review UI to feed into measurable quality improvements**,  
So that **false positives and false negatives decrease over time without manual rule hunting**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.9 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Done |
| **Created** | 2025-12-24 |
| **Context Created** | 2025-12-27 |
| **Implemented** | 2025-12-27 |
| **Reviewed** | 2025-12-27 |

## Acceptance Criteria

**Given** users correct entities in the Entity Sidebar (mark PII / unmark PII / change type),  
**When** feedback is logged and aggregated,  
**Then** I can see:

- Top **false positive patterns** (text, type, context) by frequency.  
- Top **missed PII patterns** (user‑added entities) by frequency.  
- Exportable datasets suitable for:
  - Updating DenyList / ContextWords / recognizers, and
  - Fine‑tuning the ML model offline.

**And** all feedback data is **local‑only** by default (no network calls).  
**And** enabling any export is a **conscious, explicit user action**.
**And** feedback data has retention limits (max N events or timeframe) to prevent unbounded growth
**And** export script supports both raw mode (for internal training) and anonymised mode (for sharing patterns)
**And** top false positive patterns are reviewed monthly and used to propose DenyList/recognizer updates (operational workflow)

## Technical Design

### Existing Components

- `src/ui/EntitySidebar.ts` – user review & correction UI.  
- `src/services/feedbackLogger.ts` – initial logging service (Epic 5).  
- `src/ui/AccuracyDashboard.ts` – dashboard for aggregated stats.

### Files to Extend / Create

1. Extend: `src/services/feedbackLogger.ts` (desktop)  
2. Extend: `browser-app/src/services/feedbackLogger.ts` (browser, if present / create mirror)  
3. New: `shared/pii/feedback/FeedbackAggregator.ts`  
4. New export script (Node‑only): `scripts/export-feedback-dataset.mjs`

### Data Model

```typescript
// shared/pii/feedback/types.ts

export type FeedbackAction =
  | 'mark_as_pii'
  | 'mark_as_not_pii'
  | 'change_entity_type'
  | 'adjust_confidence';

export interface FeedbackEvent {
  id: string;                // UUID
  timestamp: string;         // ISO8601
  source: 'desktop' | 'browser';
  documentId: string;        // hash or local identifier
  documentType?: string;     // INVOICE, LETTER, etc.
  language?: string;         // en, fr, de

  originalEntity?: {
    text: string;
    type: string;
    start: number;
    end: number;
    confidence: number;
  };

  updatedEntity?: {
    text: string;
    type: string;
    start: number;
    end: number;
    confidence?: number;
  };

  action: FeedbackAction;
}
```

### Feedback Aggregator

```typescript
// shared/pii/feedback/FeedbackAggregator.ts

import { FeedbackEvent } from './types';

export interface AggregatedPattern {
  text: string;
  entityType: string;
  language?: string;
  documentType?: string;
  count: number;
}

export interface FeedbackSummary {
  falsePositives: AggregatedPattern[];
  missedPii: AggregatedPattern[];
}

export class FeedbackAggregator {
  constructor(events: FeedbackEvent[]);

  summarize(): FeedbackSummary;

  /** Grouped by (text, type, language, documentType) where user marked "not PII" */
  getFalsePositivePatterns(): AggregatedPattern[];

  /** Grouped by (text, type, language, documentType) where user added PII */
  getMissedPiiPatterns(): AggregatedPattern[];
}
```

### Storage & Privacy

- Store raw `FeedbackEvent[]` in **local storage**:
  - Desktop: app data folder (e.g. `app.getPath('userData')/feedback.jsonl`).  
  - Browser: IndexedDB or localStorage under a dedicated key (`pii-feedback-v1`).
- **No network writes**; all data remains on the user's machine.
- **Retention policy**:
  - Default: Max 10,000 events OR 90 days (whichever comes first)
  - Configurable via settings: `feedbackRetentionLimit` (number of events), `feedbackRetentionDays` (number of days)
  - Oldest events are automatically pruned when limit exceeded
- Provide a **"Delete Feedback Data"** action in settings to wipe local feedback.
- **Privacy guarantee**: Raw PII text is never logged; only entity metadata (type, position, confidence) and context window (max 200 chars) are stored.

### Export Script

- Node script `scripts/export-feedback-dataset.mjs`:
  - Reads local feedback file(s) (desktop case).  
  - Runs `FeedbackAggregator.summarize()`.  
  - **Two export modes**:
    - **Raw mode** (`--mode=raw`): Full events with context windows (for internal training only)
    - **Anonymised mode** (`--mode=anonymised`, default): 
      - Replace actual entity text with hashed IDs
      - Keep only pattern structure (e.g. "EMAIL pattern", "PERSON_NAME pattern")
      - Safe for sharing patterns without leaking PII
  - Outputs:
    - `feedback-summary.json` – aggregated counts (top false positives, top missed PII).  
    - `feedback-events.jsonl` – events in chosen mode.
  - Intended to be run **manually** by the maintainer, never automatically.
  
**Operational Workflow:**
1. Monthly: Run export script → Review `feedback-summary.json`
2. Identify top 10 false positive patterns → Propose DenyList additions
3. Identify top 10 missed PII patterns → Propose ContextWords/recognizer updates
4. Test proposed changes → Merge if quality improves

## Integration Points

- **UI**:
  - `EntitySidebar` already emits actions; ensure every correction sends a structured `FeedbackEvent` to `feedbackLogger`.
  - Add a small “Feedback captured locally” hint in the Accuracy Dashboard when data exists.
- **Accuracy Dashboard**:
  - Optional: surface top N false‑positive & missed‑PII patterns by text and type, to guide rule updates.

## Test Scenarios

1. Correcting a false positive (unmark PII) logs a `FeedbackEvent` with `action = 'mark_as_not_pii'`.  
2. Adding a missing entity logs a `FeedbackEvent` with `action = 'mark_as_pii'` and populated `updatedEntity`.  
3. Aggregator groups multiple corrections of the same pattern into a single `AggregatedPattern` with increasing `count`.  
4. Desktop feedback is stored in app data and survives restarts; browser feedback is stored in IndexedDB/localStorage.  
5. “Delete feedback data” wipes all stored events.  
6. Export script produces `feedback-summary.json` and `feedback-events.jsonl` in the expected format.  
7. No network calls are made as part of logging, aggregation, or export.

## Definition of Done

- [x] `FeedbackEvent` type defined and used consistently in both desktop and browser code paths.
- [x] `FeedbackAggregator` implemented with unit tests.
- [x] `feedbackLogger` extended to persist events locally and expose a read API.
- [x] Retention policy implemented (max events/days, automatic pruning)
- [x] Export script implemented with raw/anonymised modes
- [x] Export script documented in `docs/feedback-learning-loop.md` with operational workflow
- [ ] Accuracy Dashboard updated (optional but preferred) to show top patterns from aggregated feedback.
- [x] Privacy guarantee: No raw PII text logged, only metadata + limited context window
- [x] No network calls are introduced; privacy guarantees remain intact.
- [x] TypeScript compiles without errors in both projects.
- [x] Monthly review workflow documented for maintainers

## Tasks/Subtasks

- [x] T1: Extend src/services/feedbackLogger.ts for desktop (retention, aggregation API)
- [x] T2: Extend browser-app/src/services/FeedbackLogger.ts (aggregation API)
- [x] T3: Create shared/pii/feedback/FeedbackAggregator.ts
- [x] T4: Create shared/pii/feedback/types.ts (FeedbackEvent, AggregatedPattern)
- [x] T5: Create scripts/export-feedback-dataset.mjs (raw/anonymised modes)
- [x] T6: Add retention policy (max events/days, automatic pruning)
- [x] T7: Add "Delete Feedback Data" action
- [ ] T8: Update Accuracy Dashboard to show top patterns (optional - skipped)
- [x] T9: Write unit tests for FeedbackAggregator (20 tests)
- [x] T10: Document operational workflow

## File List

### New Files
- `shared/pii/feedback/types.ts` - Type definitions for FeedbackEvent, AggregatedPattern, RetentionSettings
- `shared/pii/feedback/FeedbackAggregator.ts` - Pattern aggregation class
- `shared/pii/feedback/index.ts` - Module exports
- `scripts/export-feedback-dataset.mjs` - Export script with raw/anonymised modes
- `test/unit/pii/feedback/FeedbackAggregator.test.js` - 20 unit tests
- `docs/feedback-learning-loop.md` - Operational workflow documentation

### Modified Files
- `src/services/feedbackLogger.ts` - Added retention policy, aggregation API, delete all
- `browser-app/src/services/FeedbackLogger.ts` - Added aggregation API, delete all
- `shared/pii/index.ts` - Added feedback module exports

## Dev Agent Record

### Debug Log
- 2025-12-27: Started implementation
- Created shared feedback types and FeedbackAggregator
- Extended desktop feedbackLogger with retention, aggregation, delete API
- Extended browser FeedbackLogger with same API
- Created export script with raw/anonymised modes
- Wrote 20 unit tests for FeedbackAggregator
- Documented monthly operational workflow

### Completion Notes
Story 8.9 implemented with all core functionality:
- FeedbackEvent type with full entity metadata
- FeedbackAggregator groups patterns by frequency
- Retention policy: max 10,000 events OR 90 days
- Export script: node scripts/export-feedback-dataset.mjs
- Privacy: No raw PII, max 200 char context, document hashing
- 20 tests passing, 1520 total tests passing
- T8 (Accuracy Dashboard) skipped as optional

### Code Review Improvements (2025-12-27)
Post-review improvements addressing security auditor and config-safety recommendations:

1. **Browser retention now enforces event count limit**
   - Added `deleteOldestEntries()` function to FeedbackStore.ts
   - `applyRetentionPolicy()` now actually deletes excess events

2. **Export script path validation**
   - Added `validateOutputPath()` function with security checks
   - Prevents path traversal (only allows CWD, home, or temp directories)
   - Added proper error handling for file operations
   - Raw mode warning displayed for sensitive exports

3. **Context truncation at log time**
   - Context now truncated to MAX_CONTEXT_LENGTH (200 chars) before storage
   - Applied in both desktop and browser implementations
   - Ensures privacy guarantee regardless of retrieval path

4. **Shared IFeedbackLogger interface**
   - Defined in shared/pii/feedback/types.ts
   - Desktop FeedbackLogger class implements interface
   - Ensures API consistency across platforms

5. **Browser path aliases**
   - Added @shared/feedback path alias to browser-app tsconfig
   - Cleaner imports in browser FeedbackLogger

## Change Log

| Date | Change |
|------|--------|
| 2025-12-27 | Story implemented with all required tasks |
| 2025-12-27 | Post-review: Added browser retention enforcement, path validation, context truncation, IFeedbackLogger interface |


