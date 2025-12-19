# Story 5.3: Accuracy Dashboard

Status: ready-for-dev

## Story

As a **power user monitoring detection quality**,
I want **to see accuracy statistics over time**,
so that **I can assess whether the system is improving**.

## Acceptance Criteria

| AC ID | Criterion |
|-------|-----------|
| AC-5.3.1 | Given accumulated correction logs, when user opens accuracy dashboard (Settings > Accuracy), then dashboard shows total documents processed |
| AC-5.3.2 | Dashboard displays false positive rate (dismissals / total detections) |
| AC-5.3.3 | Dashboard displays false negative estimate (manual additions / total detections) |
| AC-5.3.4 | Dashboard includes per-type accuracy breakdown showing dismissals and additions per entity type |
| AC-5.3.5 | Dashboard shows trend chart (weekly/monthly) visualizing correction rates over time |
| AC-5.3.6 | Dashboard data is derived from local logs only (corrections-YYYY-MM.json files) |
| AC-5.3.7 | "Export Report" button generates CSV summary of all statistics |

## Tasks / Subtasks

- [ ] **Task 1: Create AccuracyDashboard UI component** (AC: 5.3.1)
  - [ ] Add "Accuracy" tab/section to Settings panel in index.html
  - [ ] Create dashboard layout with card-based statistics display
  - [ ] Add i18n strings for dashboard labels (en.json, fr.json, de.json)

- [ ] **Task 2: Implement statistics aggregation service** (AC: 5.3.1, 5.3.2, 5.3.3, 5.3.4, 5.3.6)
  - [ ] Create `src/services/accuracyStats.ts` for stats calculation
  - [ ] Implement `loadAllCorrectionLogs()` to read all corrections-YYYY-MM.json files
  - [ ] Implement `calculateStatistics()` returning DocumentStats, FalsePositiveRate, FalseNegativeEstimate, PerTypeBreakdown
  - [ ] Add IPC handler `accuracy:get-stats` in main process

- [ ] **Task 3: Add IPC handlers for dashboard data** (AC: 5.3.6)
  - [ ] Create `src/services/accuracyHandlers.ts` with IPC handlers
  - [ ] Add `accuracy:get-stats` handler to return aggregated statistics
  - [ ] Add `accuracy:get-trends` handler to return time-series data
  - [ ] Expose via preload.cjs contextBridge

- [ ] **Task 4: Implement per-type breakdown display** (AC: 5.3.4)
  - [ ] Create entity type breakdown table in dashboard
  - [ ] Show for each type: total detections, dismissals, manual additions, accuracy %
  - [ ] Sort by entity type with highlighting for low-accuracy types

- [ ] **Task 5: Implement trend chart** (AC: 5.3.5)
  - [ ] Add simple chart library (consider vanilla JS canvas or Chart.js)
  - [ ] Create weekly/monthly aggregation from correction timestamps
  - [ ] Display line chart showing false positive rate trend over time
  - [ ] Add toggle between weekly and monthly view

- [ ] **Task 6: Implement CSV export** (AC: 5.3.7)
  - [ ] Add "Export Report" button to dashboard
  - [ ] Generate CSV with columns: Date, TotalDetections, Dismissals, Additions, FPRate, FNEstimate
  - [ ] Include per-type breakdown in CSV
  - [ ] Use Electron dialog.showSaveDialog for file location

- [ ] **Task 7: Add unit tests** (AC: all)
  - [ ] Test statistics calculation with mock correction logs
  - [ ] Test trend aggregation (weekly/monthly grouping)
  - [ ] Test CSV export format
  - [ ] Test IPC handler input validation

- [ ] **Task 8: Run test suite and verify no regression** (AC: all)
  - [ ] Run full test suite (expect 679+ tests passing)
  - [ ] Run lint check (0 warnings)
  - [ ] Verify TypeScript compilation

## Dev Notes

### Architecture Alignment

Story 5.3 completes Epic 5 (Confidence Scoring & Feedback) by providing the user-facing accuracy dashboard. This builds on:
- Story 5.1: Confidence display (entities show source, confidence, warnings)
- Story 5.2: User correction logging (corrections stored in corrections-YYYY-MM.json files)

```
Epic 5 Flow:
Confidence Display (5.1) ✅ -> Correction Logging (5.2) ✅ -> Accuracy Dashboard (5.3) <- YOU ARE HERE
                                      |
                                      v
                              FeedbackLogger writes to:
                              corrections-YYYY-MM.json files
                                      |
                                      v
                              AccuracyStats reads from these files
```

### Learnings from Previous Story (5-2)

**From Story 5-2-user-correction-logging (Status: done)**

- **Log File Location**: `app.getPath('userData')` stores corrections-YYYY-MM.json files
- **Log File Schema**: `CorrectionLogFile` interface in `src/types/feedback.ts`:
  - `entries: CorrectionEntry[]` - Array of correction entries
  - Each entry has: id, timestamp, action (DISMISS/ADD), entityType, context, documentHash
- **Key Functions**: `FeedbackLogger` class at `src/services/feedbackLogger.ts`
  - `getLogFilePath()` - Returns path to current month's log file
  - `isEnabled()` - Check if logging is enabled (respect user preference)
- **IPC Pattern**: `src/services/feedbackHandlers.ts` - Follow same pattern for accuracy handlers

[Source: docs/sprint-artifacts/stories/5-2-user-correction-logging.md#Dev-Agent-Record]

### Component Location

**New Files:**
- `src/services/accuracyStats.ts` - Statistics calculation service
- `src/services/accuracyHandlers.ts` - IPC handlers for accuracy data
- `src/types/accuracy.ts` - TypeScript interfaces for stats (or add to index.ts)
- `test/unit/accuracyStats.test.js` - Unit tests

**Modified Files:**
- `src/main.ts` - Register accuracy handlers (import + call `registerAccuracyHandlers()`)
- `preload.cjs` - Expose `accuracyAPI` via contextBridge
- `index.html` - Add Accuracy tab to Settings panel
- `renderer.js` - Add dashboard rendering logic
- `locales/en.json`, `locales/fr.json`, `locales/de.json` - Add i18n strings

### Statistics Calculation Schema

```typescript
interface AccuracyStatistics {
  period: {
    start: string;  // ISO 8601
    end: string;    // ISO 8601
  };
  summary: {
    documentsProcessed: number;      // Unique document hashes
    totalDetections: number;         // Sum of all corrections
    dismissals: number;              // Count of DISMISS actions
    manualAdditions: number;         // Count of ADD actions
    falsePositiveRate: number;       // dismissals / totalDetections (0-1)
    falseNegativeEstimate: number;   // manualAdditions / totalDetections (0-1)
  };
  byEntityType: {
    [entityType: string]: {
      detections: number;
      dismissals: number;
      additions: number;
      accuracy: number;  // 1 - (dismissals / detections)
    };
  };
  trends: {
    weekly: TrendPoint[];   // { date, fpRate, fnEstimate }
    monthly: TrendPoint[];
  };
}

interface TrendPoint {
  date: string;           // Week/month start date
  detections: number;
  dismissals: number;
  additions: number;
  fpRate: number;
  fnEstimate: number;
}
```

### CSV Export Format

```csv
Date,Period,TotalDetections,Dismissals,Additions,FPRate,FNEstimate
2025-12,Monthly,150,12,5,0.08,0.033
2025-11,Monthly,200,18,8,0.09,0.04
```

Per-type section:
```csv

EntityType,Detections,Dismissals,Additions,Accuracy
PERSON,50,3,2,0.94
EMAIL,40,2,0,0.95
PHONE,30,5,1,0.83
ADDRESS,20,1,2,0.95
```

### Chart Implementation Options

1. **Vanilla Canvas (Preferred)** - No additional dependencies
   - Simple line chart rendering
   - ~100 lines of code
   - Full control over styling

2. **Chart.js (Alternative)** - If more complex charts needed
   - Already used in similar Electron apps
   - Rich interactivity
   - ~300KB bundle size

### Testing Standards

Follow patterns from `test/unit/feedbackLogger.test.js`:
- Use Mocha + Chai
- Mock file system with temporary directories
- Test edge cases (empty logs, corrupt files, single entry)
- Test date range filtering for trends

### References

- [Source: docs/epics.md#Story-5.3-Accuracy-Dashboard]
- [Source: docs/architecture.md#Epic-5-Confidence-Feedback]
- [Source: docs/architecture.md#src/ui/AccuracyDashboard.ts]
- [Source: docs/sprint-artifacts/stories/5-2-user-correction-logging.md]
- Dependencies: Story 5.2 (Correction Logging) - provides the log files to aggregate

---

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/5-3-accuracy-dashboard.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-13 | SM Agent (Opus 4.5) | Initial story creation from epics.md via create-story workflow |
