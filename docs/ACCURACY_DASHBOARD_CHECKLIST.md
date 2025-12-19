# Accuracy Dashboard Refactoring Checklist

**Story:** 5.3 - Accuracy Statistics Dashboard  
**Status:** Ready for Refactoring  
**Estimated Time:** 4-6 hours (Phase 1 only)

---

## Phase 1: Critical Fixes (MUST DO Before Merge)

### [ ] Task 1.1: Resolve Duplicate UI Files (2 hours)

- [ ] Choose implementation to keep (recommended: TypeScript)
- [ ] Delete duplicate file: `rm accuracyDashboard.js`
- [ ] Update renderer.js import to use `dist/ui/AccuracyDashboardUI.js`
- [ ] Remove old script tag from index.html (if exists)
- [ ] Compile TypeScript: `npm run compile`
- [ ] Test in dev mode: `npm run dev`
- [ ] Verify dashboard opens correctly
- [ ] Verify all buttons work (close, refresh, export, trend toggle)
- [ ] Check browser console for errors
- [ ] Commit: "refactor: remove duplicate accuracy dashboard file"

**Success:** Only ONE UI file exists, no functionality regression

---

### [ ] Task 1.2: Extract Duplicate Trend Calculation (1.5 hours)

- [ ] Open `src/services/accuracyStats.ts`
- [ ] Add generic `calculateTrends()` method with Strategy pattern
- [ ] Simplify `calculateWeeklyTrends()` to use generic method
- [ ] Simplify `calculateMonthlyTrends()` to use generic method
- [ ] Run tests: `npm test`
- [ ] Verify weekly trends produce same results
- [ ] Verify monthly trends produce same results
- [ ] Check code diff: should remove ~100 lines
- [ ] Commit: "refactor: deduplicate trend calculation using Strategy pattern"

**Success:** 100 lines removed, all tests passing, identical results

---

### [ ] Task 1.3: Add Error Factory Pattern (1.5 hours)

- [ ] Create `src/errors/accuracyErrors.ts`
- [ ] Define `AccuracyError` base class
- [ ] Define error types: `ValidationError`, `DataLoadError`, `ExportCancelledError`, `ExportError`
- [ ] Create `AccuracyErrors` factory object
- [ ] Update `src/services/accuracyHandlers.ts` to use factory
- [ ] Update `src/ui/AccuracyDashboardUI.ts` error handling
- [ ] Compile: `npm run compile`
- [ ] Test error scenarios (invalid input, export cancel, network error)
- [ ] Verify error messages display correctly in UI
- [ ] Commit: "feat: add error factory pattern for accuracy feature"

**Success:** Consistent error handling, type-safe error creation

---

### [ ] Task 1.4: Fix Dependency Injection (1 hour)

- [ ] Update `registerAccuracyHandlers()` signature with default parameter
- [ ] Add early validation for null `mainWindow`
- [ ] Remove try-catch around `getAccuracyStats()` call
- [ ] Update `AccuracyStats` constructor to accept optional `logDir`
- [ ] Update singleton factory `getAccuracyStats()` signature
- [ ] Update `src/main.ts` handler registration (if needed)
- [ ] Create `test/unit/services/accuracyHandlers.test.ts`
- [ ] Write test for dependency injection
- [ ] Run tests: `npm test`
- [ ] Verify no runtime errors: `npm run dev`
- [ ] Commit: "refactor: add dependency injection to accuracy handlers"

**Success:** Testable handlers, backward compatible, no runtime errors

---

## Pre-Merge Verification

### [ ] Code Quality Checks

- [ ] Run linter: `npm run lint`
- [ ] Fix any linting errors: `npm run lint:fix`
- [ ] Type-check: `npm run typecheck`
- [ ] Run all tests: `npm test`
- [ ] Check test coverage: `npm run test:coverage` (if available)

---

### [ ] Functional Testing

- [ ] Start app: `npm run dev`
- [ ] Process a document with PII corrections
- [ ] Open Accuracy Dashboard
- [ ] Verify summary stats display correctly
- [ ] Verify entity breakdown table displays
- [ ] Toggle weekly/monthly trend view
- [ ] Verify chart renders correctly
- [ ] Click Export button
- [ ] Save CSV to desktop
- [ ] Open CSV in Excel/Notepad
- [ ] Verify CSV format is correct
- [ ] Cancel export (verify no error)
- [ ] Click Refresh button
- [ ] Close dashboard (ESC key and close button)

---

### [ ] Code Review

- [ ] Review diff of all changes
- [ ] Verify no regressions introduced
- [ ] Check for any TODO comments left behind
- [ ] Verify all console.log statements removed (use logger instead)
- [ ] Check for commented-out code (remove)
- [ ] Verify JSDoc/TSDoc comments are updated

---

### [ ] Documentation

- [ ] Update CLAUDE.md if needed
- [ ] Add/update code comments for complex logic
- [ ] Document any breaking changes (should be none)
- [ ] Create migration notes if API changed

---

## Commit & Push

- [ ] Final commit: "refactor(epic-5): complete Phase 1 accuracy dashboard refactoring"
- [ ] Push to branch: `git push origin 019-pdf-table-detection` (or create new branch)
- [ ] Create PR with link to code review document
- [ ] Request code review from team
- [ ] Wait for approval before merge

---

## Metrics Checklist

**Before Refactoring:**
- [x] Total lines: 1,804
- [x] Duplicate code: 600 lines (33%)
- [x] Longest method: 95 lines
- [x] Test coverage: 0%

**After Phase 1 (Verify):**
- [ ] Total lines: ~1,200 (33% reduction achieved?)
- [ ] Duplicate code: <100 lines (8% or less?)
- [ ] Longest method: <50 lines (verified?)
- [ ] Test coverage: 50%+ (check with coverage report)

---

## Post-Merge Tasks (Phase 2/3 - Optional)

These can be done in follow-up PRs:

### Phase 2: Important Improvements
- [ ] Extract CSV formatting to separate class (Issue 3.4)
- [ ] Extract chart rendering to TrendChartRenderer class (Issue 4.2)
- [ ] Create NotificationService singleton (Issue 4.4)

### Phase 3: Nice-to-Have
- [ ] Replace string templating with DOM builders (Issue 4.3)
- [ ] Extract magic numbers to constants (Issue 4.5)

---

## Troubleshooting

### Issue: TypeScript compilation errors after refactoring
**Fix:** 
```bash
npm run compile
# Check errors, fix type mismatches
# Verify all imports use correct paths
```

### Issue: Tests failing after refactoring
**Fix:**
```bash
npm test -- --grep "accuracy"
# Identify failing test
# Update test to match new implementation
# Verify test data is correct
```

### Issue: Dashboard not opening after removing duplicate file
**Fix:**
```bash
# Check browser console for errors
# Verify import path in renderer.js
# Verify compiled JS exists in dist/ui/
# Rebuild: npm run compile
```

### Issue: Export button not working
**Fix:**
```bash
# Check error factory imports
# Verify ExportResult type handling
# Check file dialog permissions
# Test with different file paths
```

---

## Sign-Off

**Phase 1 Completed By:** _________________  
**Date:** _________________  
**Code Review Approved By:** _________________  
**Date:** _________________  
**Merged to Main:** _________________  

---

**Reference Documents:**
- `CODE_REVIEW_ACCURACY_DASHBOARD.md` - Full analysis
- `ACCURACY_DASHBOARD_REFACTORING_PLAN.md` - Detailed implementation guide
