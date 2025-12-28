# Story 9.6: Migration & Integration Testing

## Story

As a **QA engineer and developer**,
I want **complete migration to shared components with comprehensive testing**,
So that **both apps use the unified component library with verified visual consistency and no regressions**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 9.6 |
| **Epic** | 9 - UI Harmonization (Tailwind + shadcn) |
| **Status** | ready-for-dev |
| **Created** | 2025-12-26 |

## Acceptance Criteria

### Browser-App Migration
**Given** the browser-app with existing custom components
**When** migration is complete
**Then** browser-app uses shared components from `@a5-pii/ui-components`
**And** all existing functionality works identically
**And** duplicate CSS is removed (no style conflicts)

### Electron App Migration
**Given** the Electron app with existing UI code
**When** migration is complete
**Then** Electron app uses shared components from `@a5-pii/ui-components`
**And** all existing functionality works identically

### Visual Regression Testing
**Given** the migrated applications
**When** visual regression tests run
**Then** all pages/views have baseline screenshots
**And** changes are detected and flagged for review
**And** dark mode is tested

### Accessibility Testing
**Given** the migrated applications
**When** accessibility audit runs
**Then** Lighthouse accessibility score is 100
**And** all interactive elements have proper focus states
**And** color contrast meets WCAG AA (4.5:1)

### Bundle Size Validation
**Given** the shared component library integration
**When** build completes
**Then** bundle size impact is <50KB added
**And** tree-shaking works correctly

### Test Coverage
**Given** the shared component library
**When** test suite runs
**Then** all existing tests pass
**And** new integration tests pass
**And** visual regression tests pass

## Technical Design

### Migration Checklist

#### Browser-App Components to Migrate

| Current Component | Shared Component | Notes |
|-------------------|------------------|-------|
| Custom buttons in various files | `Button` | Multiple instances |
| `.badge` classes | `Badge` | In components.css |
| `.result-card` classes | `Card` | In components.css |
| `Toast.ts` | `createToastManager()` | Full replacement |
| `ContextMenu.ts` | `Dropdown` | Keep wrapper for PII types |
| `EntitySidebar.ts` | `EntitySidebar` | Major refactor |
| `sidebar/EntityRenderer.ts` | `EntityListItem`, `EntityGroup` | Replace |
| `sidebar/EntityTypeConfig.ts` | Shared `EntityTypeConfig` | Move to shared |
| `sidebar/EntitySidebarStyles.ts` | Remove | Replaced by Tailwind |

#### Electron UI Files to Migrate

| Current File | Changes |
|--------------|---------|
| `src/ui/EntityReviewUI.ts` | Use shared entity components |
| `renderer.js` | Update component usage |

### Visual Regression Testing Setup

```typescript
// test/visual/setup.ts
import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { width: 1280, height: 720, name: 'desktop' },
  { width: 1920, height: 1080, name: 'desktop-hd' },
];

const THEMES = ['light', 'dark'];

export async function captureBaseline(page: Page, name: string) {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      await page.setViewportSize(viewport);
      if (theme === 'dark') {
        await page.evaluate(() => document.documentElement.classList.add('dark'));
      } else {
        await page.evaluate(() => document.documentElement.classList.remove('dark'));
      }

      await expect(page).toHaveScreenshot(
        `${name}-${viewport.name}-${theme}.png`,
        { maxDiffPixels: 100 }
      );
    }
  }
}
```

### Test Scenarios

```typescript
// test/visual/entity-sidebar.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Entity Sidebar Visual Tests', () => {
  test('empty state', async ({ page }) => {
    await page.goto('/');
    await captureBaseline(page, 'sidebar-empty');
  });

  test('with entities', async ({ page }) => {
    await page.goto('/');
    await loadTestDocument(page);
    await captureBaseline(page, 'sidebar-entities');
  });

  test('collapsed groups', async ({ page }) => {
    await page.goto('/');
    await loadTestDocument(page);
    await page.click('[data-entity-group="PERSON"] .collapse-toggle');
    await captureBaseline(page, 'sidebar-collapsed');
  });

  test('entity selected', async ({ page }) => {
    await page.goto('/');
    await loadTestDocument(page);
    await page.click('[data-entity-id="1"] input[type="checkbox"]');
    await captureBaseline(page, 'sidebar-selected');
  });
});
```

### Bundle Analysis

```javascript
// scripts/analyze-bundle.js
import { analyzeBundle } from 'webpack-bundle-analyzer';

const BASELINE_SIZE = {
  'browser-app': 450_000, // 450KB
  'electron': 380_000,    // 380KB
};

const MAX_INCREASE = 50_000; // 50KB

export async function validateBundleSize(app: string, bundlePath: string) {
  const stats = await analyzeBundle(bundlePath);
  const currentSize = stats.totalSize;
  const baseline = BASELINE_SIZE[app];
  const increase = currentSize - baseline;

  if (increase > MAX_INCREASE) {
    throw new Error(
      `Bundle size increased by ${(increase / 1000).toFixed(1)}KB, ` +
      `exceeding max of ${MAX_INCREASE / 1000}KB`
    );
  }

  console.log(`✓ Bundle size OK: +${(increase / 1000).toFixed(1)}KB`);
}
```

## Tasks / Subtasks

- [ ] **Task 1: Complete browser-app component migration** (AC: Browser-App Migration)
  - [ ] Replace button styles with `Button` component
  - [ ] Replace badge styles with `Badge` component
  - [ ] Replace card styles with `Card` component
  - [ ] Replace input styles with `Input` component
  - [ ] Replace Toast with shared Toast
  - [ ] Replace ContextMenu with shared Dropdown wrapper
  - [ ] Verify all functionality works

- [ ] **Task 2: Complete Electron component migration** (AC: Electron Migration)
  - [ ] Update EntityReviewUI to use shared components
  - [ ] Update any button/badge/card usage
  - [ ] Verify IPC integration still works

- [ ] **Task 3: Remove duplicate CSS** (AC: duplicate CSS removed)
  - [ ] Remove `browser-app/src/styles/components.css` (replaced by Tailwind)
  - [ ] Remove `browser-app/src/components/sidebar/EntitySidebarStyles.ts`
  - [ ] Remove inline CSS injection in Toast.ts, ContextMenu.ts
  - [ ] Verify no style conflicts

- [ ] **Task 4: Setup Playwright for visual testing** (AC: Visual Regression)
  - [ ] Install `@playwright/test`
  - [ ] Configure screenshot comparison
  - [ ] Create baseline screenshots for browser-app
  - [ ] Create baseline screenshots for Electron (if feasible)

- [ ] **Task 5: Write visual regression tests** (AC: Visual Regression)
  - [ ] Create `test/visual/` directory
  - [ ] Write tests for main views (upload, processing, results)
  - [ ] Write tests for entity sidebar states
  - [ ] Write tests for dark mode
  - [ ] Add to CI pipeline

- [ ] **Task 6: Run accessibility audit** (AC: Accessibility)
  - [ ] Run Lighthouse accessibility audit
  - [ ] Fix any issues found
  - [ ] Verify score is 100
  - [ ] Test keyboard navigation
  - [ ] Test screen reader compatibility

- [ ] **Task 7: Validate bundle size** (AC: Bundle Size)
  - [ ] Measure baseline bundle sizes
  - [ ] Build with shared components
  - [ ] Compare and validate <50KB increase
  - [ ] Verify tree-shaking works
  - [ ] Add bundle size check to CI

- [ ] **Task 8: Run full test suite** (AC: Test Coverage)
  - [ ] Run all existing unit tests
  - [ ] Run all existing integration tests
  - [ ] Fix any failures
  - [ ] Run visual regression tests
  - [ ] Verify 100% pass rate

- [ ] **Task 9: Dark mode verification** (AC: dark mode works)
  - [ ] Test dark mode toggle in browser-app
  - [ ] Test dark mode toggle in Electron
  - [ ] Verify all components render correctly
  - [ ] Verify entity colors are visible in dark mode

- [ ] **Task 10: Documentation update** (AC: all)
  - [ ] Update CLAUDE.md with shared component info
  - [ ] Document component usage patterns
  - [ ] Add migration notes for future reference

## Dev Notes

### Migration Order

1. **Phase 1: Infrastructure** (Stories 9.1-9.2)
   - Tailwind preset, CSS variables
   - Component library setup, cn() utility

2. **Phase 2: Components** (Stories 9.3-9.5)
   - Primitives (Button, Badge, Card, Input)
   - Composites (Modal, Toast, Dropdown, Tooltip)
   - Entity components (EntityBadge, EntitySidebar)

3. **Phase 3: Migration** (This Story)
   - Browser-app migration
   - Electron migration
   - Testing and validation

### Files to Remove After Migration

```
browser-app/src/styles/components.css  # Replaced by Tailwind
browser-app/src/components/sidebar/EntitySidebarStyles.ts  # Replaced by Tailwind
```

### Files to Keep (App-Specific Logic)

```
browser-app/src/components/sidebar/EntityStateManager.ts  # App state
browser-app/src/components/sidebar/EntityFilters.ts  # Uses shared Badge
browser-app/src/components/EntityReviewController.ts  # Business logic
```

### Visual Regression Thresholds

| Metric | Threshold |
|--------|-----------|
| Max diff pixels | 100 |
| Max diff percentage | 0.1% |
| Animations disabled | Yes |

### CI Integration

```yaml
# .github/workflows/visual-tests.yml
visual-regression:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npx playwright install --with-deps
    - run: npm run test:visual
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: visual-diff
        path: test/visual/results/
```

### Prerequisites

- All previous Epic 9 stories (9.1-9.5) must be complete

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-9.md#Migration-Integration]
- [Source: docs/epics.md#Story-9.6]
- Playwright Visual Comparisons: https://playwright.dev/docs/test-snapshots
- Lighthouse CI: https://github.com/GoogleChrome/lighthouse-ci

## Definition of Done

- [ ] Browser-app fully migrated to shared components
- [ ] Electron app fully migrated to shared components
- [ ] Duplicate CSS removed (no components.css, no inline styles)
- [ ] Visual regression test suite created
- [ ] All visual regression tests pass
- [ ] Lighthouse accessibility score is 100
- [ ] Bundle size increase is <50KB
- [ ] All existing tests pass (unit, integration)
- [ ] Dark mode works in both apps
- [ ] Documentation updated
- [ ] No style conflicts or regressions

## Dev Agent Record

### Context Reference

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
