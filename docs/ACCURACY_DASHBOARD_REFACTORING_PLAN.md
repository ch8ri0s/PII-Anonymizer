# Accuracy Dashboard Refactoring Plan

**Date:** 2025-12-13  
**Epic:** 5 - Feedback & Accuracy Tracking  
**Story:** 5.3 - Accuracy Statistics Dashboard  
**Status:** Code Review Complete - Ready for Refactoring

## Executive Summary

Code review identified **19 issues** across 5 files. This plan provides step-by-step refactoring tasks organized by priority.

**Review Document:** See `CODE_REVIEW_ACCURACY_DASHBOARD.md` for detailed analysis.

---

## Phase 1: Critical Fixes (MUST DO Before Merge)

**Estimated Time:** 4-6 hours  
**Blocking:** Yes - Must complete before merging Story 5.3

### Task 1.1: Resolve Duplicate UI Files (Issue 4.1)

**Priority:** CRITICAL  
**Estimated Time:** 2 hours

**Problem:**
- 95% code duplication between `accuracyDashboard.js` (583 lines) and `AccuracyDashboardUI.ts` (649 lines)
- Unclear which file is canonical
- Maintenance nightmare

**Action Steps:**

1. **Choose implementation to keep:**
   ```bash
   # Recommended: Keep TypeScript version (better type safety)
   # Delete: accuracyDashboard.js
   rm /Users/olivier/Projects/A5-PII-Anonymizer/accuracyDashboard.js
   ```

2. **Update renderer.js import:**
   ```javascript
   // OLD (delete this):
   // import { initAccuracyDashboard } from './accuracyDashboard.js';
   
   // NEW:
   import { initAccuracyDashboard } from './dist/ui/AccuracyDashboardUI.js';
   
   // Initialize on DOMContentLoaded
   document.addEventListener('DOMContentLoaded', () => {
     const dashboard = initAccuracyDashboard('accuracy-dashboard-modal');
     window.accuracyDashboard = dashboard; // Expose for button handlers
   });
   ```

3. **Update index.html (if needed):**
   ```html
   <!-- Remove any old script tag for accuracyDashboard.js -->
   <!-- TypeScript compilation handles module loading -->
   ```

4. **Test UI:**
   ```bash
   npm run compile
   npm run dev
   # Verify: Open app, click "Accuracy Dashboard" button
   # Expected: Dashboard opens, shows stats, export works
   ```

**Success Criteria:**
- ✅ Only ONE UI file exists (AccuracyDashboardUI.ts)
- ✅ Dashboard opens and displays correctly
- ✅ All buttons work (close, refresh, export, trend toggle)
- ✅ No console errors

---

### Task 1.2: Extract Duplicate Trend Calculation (Issue 3.2)

**Priority:** HIGH  
**Estimated Time:** 1.5 hours

**Problem:**
- `calculateWeeklyTrends()` and `calculateMonthlyTrends()` are 90% identical
- 100+ lines of duplicate code

**Action Steps:**

1. **Create generic trend calculation method:**

Open `src/services/accuracyStats.ts` and add:

```typescript
/**
 * Generic trend calculation using Strategy pattern
 */
private calculateTrends(
  entries: CorrectionEntry[],
  periodLabeler: (date: Date) => string
): TrendPoint[] {
  const periodMap = new Map<string, { dismissals: number; additions: number }>();

  // Aggregate by period
  for (const entry of entries) {
    const date = new Date(entry.timestamp);
    const periodLabel = periodLabeler(date);

    if (!periodMap.has(periodLabel)) {
      periodMap.set(periodLabel, { dismissals: 0, additions: 0 });
    }

    const stats = periodMap.get(periodLabel)!;
    if (entry.action === 'DISMISS') {
      stats.dismissals++;
    } else {
      stats.additions++;
    }
  }

  // Convert to TrendPoint array
  const result: TrendPoint[] = [];
  for (const [period, stats] of periodMap) {
    const total = stats.dismissals + stats.additions;
    result.push({
      period,
      dismissals: stats.dismissals,
      additions: stats.additions,
      total,
      fpRate: total > 0 ? stats.dismissals / total : 0,
      fnEstimate: total > 0 ? stats.additions / total : 0,
    });
  }

  // Sort by period ascending
  return result.sort((a, b) => a.period.localeCompare(b.period));
}
```

2. **Simplify weekly/monthly methods:**

Replace existing methods:

```typescript
/**
 * Calculate weekly trend data
 */
private calculateWeeklyTrends(entries: CorrectionEntry[]): TrendPoint[] {
  return this.calculateTrends(entries, getWeekLabel);
}

/**
 * Calculate monthly trend data
 */
private calculateMonthlyTrends(entries: CorrectionEntry[]): TrendPoint[] {
  return this.calculateTrends(entries, getMonthLabel);
}
```

3. **Test:**
   ```bash
   npm test -- test/unit/services/accuracyStats.test.ts
   # Verify: All trend calculation tests pass
   ```

**Success Criteria:**
- ✅ Weekly trends produce identical results as before
- ✅ Monthly trends produce identical results as before
- ✅ Code reduction: ~100 lines removed
- ✅ All tests passing

---

### Task 1.3: Add Error Factory Pattern (Issue 2.2)

**Priority:** HIGH  
**Estimated Time:** 1.5 hours

**Problem:**
- Inconsistent error handling (3 different patterns)
- No type-safe error creation

**Action Steps:**

1. **Create error types file:**

Create `src/errors/accuracyErrors.ts`:

```typescript
/**
 * Base class for accuracy-related errors
 */
export abstract class AccuracyError extends Error {
  abstract readonly code: string;
  abstract readonly recoverable: boolean;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Validation error (client sent invalid data)
 */
export class ValidationError extends AccuracyError {
  readonly code = 'VALIDATION_ERROR';
  readonly recoverable = false;
}

/**
 * Data loading error (failed to read logs)
 */
export class DataLoadError extends AccuracyError {
  readonly code = 'DATA_LOAD_ERROR';
  readonly recoverable = true;
}

/**
 * Export cancelled by user
 */
export class ExportCancelledError extends AccuracyError {
  readonly code = 'EXPORT_CANCELLED';
  readonly recoverable = true;
}

/**
 * Export failed (file system error)
 */
export class ExportError extends AccuracyError {
  readonly code = 'EXPORT_ERROR';
  readonly recoverable = true;
}

/**
 * Error factory for consistent error creation
 */
export const AccuracyErrors = {
  invalidOptions: () => new ValidationError('Invalid options format'),
  dataLoadFailed: (reason: string) => new DataLoadError(`Failed to load correction logs: ${reason}`),
  exportCancelled: () => new ExportCancelledError('Export cancelled by user'),
  exportFailed: (reason: string) => new ExportError(`Export failed: ${reason}`),
} as const;
```

2. **Update handlers to use error factory:**

In `src/services/accuracyHandlers.ts`:

```typescript
import { AccuracyErrors, ValidationError, ExportCancelledError } from '../errors/accuracyErrors.js';

// Handler validation
if (!validateGetStatsOptions(options)) {
  log.warn('Invalid options rejected');
  throw AccuracyErrors.invalidOptions(); // Use factory
}

// Export handler
if (result.canceled || !result.filePath) {
  log.debug('CSV export cancelled by user');
  throw AccuracyErrors.exportCancelled(); // Use factory
}
```

3. **Update UI error handling:**

In `src/ui/AccuracyDashboardUI.ts`:

```typescript
import { AccuracyError } from '../errors/accuracyErrors.js';

async loadStats(): Promise<void> {
  try {
    const stats = await window.accuracyAPI.getStats();
    this.currentStats = stats;
    this.render();
  } catch (error) {
    const err = error as AccuracyError;
    
    if (err.recoverable) {
      this.showError(this.t('accuracy.error.retryable', 'Failed to load. Click refresh to retry.'));
    } else {
      this.showError(this.t('accuracy.error.fatal', 'An error occurred.'));
    }
    
    dashboardLog.error('Failed to load stats', { error: err.message, code: err.code });
  }
}
```

4. **Test:**
   ```bash
   npm run compile
   npm run dev
   # Test invalid input rejection
   # Test export cancellation
   # Verify error messages display correctly
   ```

**Success Criteria:**
- ✅ All errors use factory pattern
- ✅ Error types are consistent across feature
- ✅ UI displays appropriate error messages
- ✅ No regressions in error handling behavior

---

### Task 1.4: Fix Dependency Injection (Issue 2.1)

**Priority:** HIGH  
**Estimated Time:** 1 hour

**Problem:**
- Hard-coded singleton dependencies make testing impossible
- Violates Dependency Inversion Principle

**Action Steps:**

1. **Update handler registration signature:**

In `src/services/accuracyHandlers.ts`:

```typescript
/**
 * Register all accuracy-related IPC handlers
 * @param mainWindow - Browser window for dialogs
 * @param accuracyStats - Injected AccuracyStats instance (for testability)
 */
export function registerAccuracyHandlers(
  mainWindow: BrowserWindow | null,
  accuracyStats: AccuracyStats = getAccuracyStats() // Default for backward compatibility
): void {
  // Early validation
  if (!mainWindow) {
    log.error('Cannot register handlers: mainWindow is null');
    throw new Error('mainWindow is required for accuracy handlers');
  }

  log.info('Registering accuracy IPC handlers...');

  // Use injected instance (no try-catch needed)
  ipcMain.handle('accuracy:get-stats', async (_event, options?: unknown): Promise<AccuracyStatistics> => {
    if (!validateGetStatsOptions(options)) {
      throw AccuracyErrors.invalidOptions();
    }
    return await accuracyStats.calculateStatistics(options as GetStatsOptions);
  });

  // ... rest of handlers using injected accuracyStats
}
```

2. **Update AccuracyStats constructor:**

In `src/services/accuracyStats.ts`:

```typescript
export class AccuracyStats {
  private logDir: string;

  constructor(logDir?: string) {
    this.logDir = logDir ?? app.getPath('userData');
    log.info('AccuracyStats initialized', { logDir: this.logDir });
  }
  
  // ... rest of class
}

// Update singleton factory
let accuracyStatsInstance: AccuracyStats | null = null;

export function getAccuracyStats(logDir?: string): AccuracyStats {
  if (!accuracyStatsInstance) {
    accuracyStatsInstance = new AccuracyStats(logDir);
  }
  return accuracyStatsInstance;
}
```

3. **Update main.ts registration:**

In `src/main.ts`:

```typescript
import { registerAccuracyHandlers } from './services/accuracyHandlers.js';
import { getAccuracyStats } from './services/accuracyStats.js';

// ... after mainWindow creation

// Register handlers with dependency injection
const accuracyStats = getAccuracyStats(); // Can pass custom logDir for testing
registerAccuracyHandlers(mainWindow, accuracyStats);
```

4. **Write tests:**

Create `test/unit/services/accuracyHandlers.test.ts`:

```typescript
import { describe, it, expect } from 'mocha';
import { AccuracyStats } from '../../../src/services/accuracyStats.js';
import { registerAccuracyHandlers } from '../../../src/services/accuracyHandlers.js';

describe('accuracyHandlers', () => {
  it('should accept injected AccuracyStats instance', () => {
    const mockStats = new AccuracyStats('/tmp/test-logs');
    const mockWindow = { /* mock BrowserWindow */ };
    
    expect(() => {
      registerAccuracyHandlers(mockWindow as any, mockStats);
    }).to.not.throw();
  });
});
```

**Success Criteria:**
- ✅ Handlers accept injected dependencies
- ✅ Default parameters maintain backward compatibility
- ✅ Unit tests pass with mocked dependencies
- ✅ No runtime errors in production

---

## Phase 2: Important Improvements (Post-Merge)

**Estimated Time:** 3-4 hours  
**Blocking:** No - Can be done in follow-up PR

### Task 2.1: Extract CSV Formatting (Issue 3.4)

**Priority:** MEDIUM  
**Estimated Time:** 1.5 hours

**Action:** Create `src/services/accuracyReportFormatter.ts` with Strategy pattern

See detailed implementation in `CODE_REVIEW_ACCURACY_DASHBOARD.md` Issue 3.4.

**Benefits:**
- Prepare for JSON/Excel export formats
- Separate statistics calculation from report formatting
- Follows Single Responsibility Principle

---

### Task 2.2: Extract Chart Rendering (Issue 4.2)

**Priority:** MEDIUM  
**Estimated Time:** 2 hours

**Action:** Create `src/ui/charts/TrendChartRenderer.ts` class

See detailed implementation in `CODE_REVIEW_ACCURACY_DASHBOARD.md` Issue 4.2.

**Benefits:**
- Reduce method complexity from 95 lines to 20 lines
- Testable chart rendering logic
- Reusable across application

---

### Task 2.3: Create Notification Service (Issue 4.4)

**Priority:** MEDIUM  
**Estimated Time:** 1 hour

**Action:** Create `src/ui/services/NotificationService.ts` singleton

See detailed implementation in `CODE_REVIEW_ACCURACY_DASHBOARD.md` Issue 4.4.

**Benefits:**
- Reusable toast notifications across app
- Centralized notification configuration
- Remove duplicate notification code

---

## Phase 3: Nice-to-Have Improvements (Optional)

**Estimated Time:** 1-2 hours  
**Blocking:** No - Low priority

### Task 3.1: Replace String Templating with DOM Builders (Issue 4.3)

**Priority:** LOW  
**Estimated Time:** 1 hour

**Action:** Create `src/ui/components/StatCard.ts` factory

See detailed implementation in `CODE_REVIEW_ACCURACY_DASHBOARD.md` Issue 4.3.

**Benefits:**
- Type-safe component creation
- Automatic XSS protection
- Better testability

---

### Task 3.2: Extract Magic Numbers to Constants (Issue 4.5)

**Priority:** LOW  
**Estimated Time:** 15 minutes

**Action:** Create `CHART_CONFIG` constant object

See detailed implementation in `CODE_REVIEW_ACCURACY_DASHBOARD.md` Issue 4.5.

**Benefits:**
- Self-documenting code
- Easy global adjustments

---

## Testing Strategy

### Unit Tests (Required)

Create test files:

```bash
test/unit/services/accuracyStats.test.ts
test/unit/services/accuracyHandlers.test.ts
test/unit/ui/AccuracyDashboardUI.test.ts
test/unit/errors/accuracyErrors.test.ts
```

**Coverage Target:** 80%+

**Key Test Cases:**
- Empty data handling
- Single data point
- Date filtering edge cases
- Weekly/monthly aggregation correctness
- Error factory behavior
- UI rendering with various data shapes

### Integration Tests (Optional)

```bash
test/integration/accuracyDashboard.e2e.test.ts
```

**Key Test Cases:**
- Full workflow: open dashboard → load data → export CSV
- Trend view toggle
- Error recovery scenarios

---

## Success Metrics

### Before Refactoring
- Total lines: 1,804
- Duplicate code: 600 lines (33%)
- Longest method: 95 lines
- Test coverage: 0%
- Cyclomatic complexity: 20+ (chart rendering)

### After Phase 1 (Target)
- Total lines: ~1,200 (33% reduction)
- Duplicate code: <100 lines (8%)
- Longest method: <50 lines
- Test coverage: 50%+
- Cyclomatic complexity: <15

### After All Phases (Target)
- Total lines: ~1,100 (39% reduction)
- Duplicate code: <50 lines (5%)
- Longest method: <30 lines
- Test coverage: 80%+
- Cyclomatic complexity: <10

---

## Rollout Plan

### Step 1: Phase 1 Refactoring (4-6 hours)
- Complete all CRITICAL/HIGH priority tasks
- Write unit tests
- Code review with team

### Step 2: Merge to Main (After approval)
- Merge Story 5.3 with Phase 1 refactoring
- Deploy to staging for QA testing

### Step 3: Phase 2 Refactoring (Follow-up PR)
- Extract CSV formatter
- Extract chart renderer
- Create notification service

### Step 4: Phase 3 Polish (Optional)
- DOM builder components
- Extract magic numbers
- Additional test coverage

---

## Risk Assessment

### Low Risk
- Error factory pattern (isolated change)
- Magic number extraction (cosmetic)

### Medium Risk
- Duplicate file deletion (test thoroughly)
- Trend calculation refactor (verify results match)

### High Risk
- Dependency injection changes (integration testing required)
- Chart rendering extraction (visual regression testing needed)

**Mitigation:** Complete Phase 1 only before merge. Phase 2/3 can be incremental.

---

## Conclusion

This refactoring plan addresses all critical code quality issues while maintaining backward compatibility. **Phase 1 MUST be completed before merging Story 5.3** to prevent technical debt accumulation.

**Estimated Total Effort:** 8-12 hours across all phases  
**Minimum Viable Refactoring:** Phase 1 (4-6 hours)

**Next Steps:**
1. Review this plan with team
2. Schedule Phase 1 refactoring session
3. Execute tasks in order
4. Create follow-up PR for Phase 2/3

---

**Created by:** Claude Code (Refactoring Specialist)  
**Date:** 2025-12-13  
**Related Documents:**
- `CODE_REVIEW_ACCURACY_DASHBOARD.md` - Detailed issue analysis
- `docs/sprint-artifacts/stories/story-5-3-accuracy-dashboard.md` - Original story
