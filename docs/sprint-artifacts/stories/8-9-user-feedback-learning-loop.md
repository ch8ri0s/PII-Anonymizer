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
| **Status** | Backlog |
| **Created** | 2025-12-24 |

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

- [ ] `FeedbackEvent` type defined and used consistently in both desktop and browser code paths.  
- [ ] `FeedbackAggregator` implemented with unit tests.  
- [ ] `feedbackLogger` extended to persist events locally and expose a read API.  
- [ ] Retention policy implemented (max events/days, automatic pruning)
- [ ] Export script implemented with raw/anonymised modes
- [ ] Export script documented in `docs/accuracyDashboard.md` or similar with operational workflow
- [ ] Accuracy Dashboard updated (optional but preferred) to show top patterns from aggregated feedback.  
- [ ] Privacy guarantee: No raw PII text logged, only metadata + limited context window
- [ ] No network calls are introduced; privacy guarantees remain intact.  
- [ ] TypeScript compiles without errors in both projects.
- [ ] Monthly review workflow documented for maintainers


