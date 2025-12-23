# E2E Testing Quick Start Guide

Get started with end-to-end testing in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- Terminal access
- Internet connection (for first-time browser download)

## Step 1: Install Browsers (First Time Only)

```bash
cd browser-app
npm run playwright:install
```

This downloads Chromium, Firefox, and WebKit (~500MB total).

## Step 2: Run Your First Test

```bash
npm run test:e2e:chromium
```

You should see output like:

```
Running 130 tests using 1 worker

  ✓ 01-initial-load.spec.ts:6:3 › Application Initial Load › should load the application
  ✓ 02-file-upload.spec.ts:10:3 › File Upload via Input › should upload single text file
  ...

  130 passed (2m)
```

## Step 3: View Results Interactively

```bash
npm run test:e2e:ui
```

This opens Playwright's UI where you can:
- See all tests
- Run individual tests
- Watch tests execute
- Debug failures

## Step 4: Debug a Failing Test

If a test fails:

```bash
npm run test:e2e:report
```

This opens an HTML report with:
- Screenshots of failures
- Video recordings
- Step-by-step traces
- Error details

## Common Commands

### Run all tests (all browsers)
```bash
npm run test:e2e
```

### Run specific browser
```bash
npm run test:e2e:chromium   # Chrome/Edge
npm run test:e2e:firefox    # Firefox
npm run test:e2e:webkit     # Safari
```

### Watch browser during test
```bash
npm run test:e2e:headed
```

### Debug step-by-step
```bash
npm run test:e2e:debug
```

### Run specific test file
```bash
npx playwright test e2e/02-file-upload.spec.ts
```

### Run tests matching pattern
```bash
npx playwright test -g "file upload"
```

## Understanding Test Output

### Pass (✓)
```
✓ should upload single text file (2s)
```
Test passed in 2 seconds.

### Fail (✗)
```
✗ should detect email addresses (3s)
```
Test failed. Run `npm run test:e2e:report` to see why.

### Skip (○)
```
○ should handle large files
```
Test was skipped (usually with `.skip()`).

## Test Structure

Tests are organized by functionality:

- `01-initial-load.spec.ts` - App startup & model loading
- `02-file-upload.spec.ts` - File upload workflows
- `03-processing.spec.ts` - Document processing & PII detection
- `04-results-download.spec.ts` - Results & downloads
- `05-edge-cases.spec.ts` - Error scenarios
- `06-accessibility.spec.ts` - Accessibility & responsive design

## Troubleshooting

### "Executable doesn't exist"

Run:
```bash
npm run playwright:install
```

### Tests timeout

Increase timeout in `playwright.config.ts`:
```typescript
timeout: 120000  // 2 minutes
```

### Model loading fails

Tests handle model loading gracefully. Check:
- Internet connection
- Disk space
- Browser console in headed mode

### Port already in use

Stop other development servers on port 5173:
```bash
lsof -ti:5173 | xargs kill -9
```

## Writing Your First Test

Create `e2e/my-test.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { PIIAnonymizerPage } from './helpers/page-objects';
import { createTextFile } from './fixtures/test-files';

test('my first test', async ({ page }) => {
  const app = new PIIAnonymizerPage(page);

  // Navigate to app
  await app.goto();
  await app.waitForModelReady();

  // Upload a file
  const file = createTextFile('test@example.com', 'test.txt');
  await app.uploadFiles([file]);

  // Process it
  await app.clickProcess();
  await app.waitForProcessingComplete();

  // Verify results
  const resultCount = await app.getResultCount();
  expect(resultCount).toBe(1);
});
```

Run it:
```bash
npx playwright test e2e/my-test.spec.ts
```

## CI/CD Integration

Tests automatically run on:
- Push to main/develop branches
- Pull requests
- Browser app changes

View results in GitHub Actions.

## Performance Tips

### Run faster
```bash
# Skip WebKit (slowest)
npm run test:e2e:chromium
```

### Run in parallel
Configure workers in `playwright.config.ts`:
```typescript
workers: 4  // Run 4 tests simultaneously
```

### Use headed mode sparingly
Headless mode is faster. Use headed only for debugging.

## Next Steps

1. Read full guide: `e2e/README.md`
2. Explore Page Objects: `e2e/helpers/page-objects.ts`
3. Check test fixtures: `e2e/fixtures/test-files.ts`
4. Review config: `playwright.config.ts`

## Getting Help

- Playwright Docs: https://playwright.dev
- Test failures: Check `playwright-report/`
- UI debugging: `npm run test:e2e:ui`
- Interactive debugger: `npm run test:e2e:debug`

---

**Quick Reference Card**

| Task | Command |
|------|---------|
| Install browsers | `npm run playwright:install` |
| Run all tests | `npm run test:e2e` |
| Run Chrome only | `npm run test:e2e:chromium` |
| Interactive UI | `npm run test:e2e:ui` |
| Watch execution | `npm run test:e2e:headed` |
| Debug failures | `npm run test:e2e:debug` |
| View report | `npm run test:e2e:report` |
| Run specific test | `npx playwright test <file>` |
| Run by name | `npx playwright test -g "<name>"` |

Happy Testing! 🎭
