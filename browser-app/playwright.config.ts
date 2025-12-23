/**
 * Playwright E2E Test Configuration
 *
 * Comprehensive end-to-end testing setup for browser-based PII Anonymizer.
 * Tests critical user workflows across multiple browsers.
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Output directory for test artifacts (screenshots, videos, traces)
  outputDir: 'test-results',

  // Clean up test results before running - only keep failures
  preserveOutput: 'failures-only',

  // Global teardown to clean up after all tests
  globalTeardown: './e2e/global-teardown.ts',

  // Test timeout (increased for ML model loading scenarios)
  timeout: 60000,

  // Expect timeout for assertions
  expect: {
    timeout: 10000,
  },

  // Fail fast on CI
  fullyParallel: true,

  // Retry on CI, not locally
  retries: process.env.CI ? 2 : 0,

  // Limit parallel workers
  workers: process.env.CI ? 1 : undefined,

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  // Shared settings for all projects
  use: {
    // Base URL for the app
    baseURL: 'http://localhost:5173',

    // Collect trace on failure
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Browser context options
    viewport: { width: 1280, height: 720 },

    // Ignore HTTPS errors (for local dev)
    ignoreHTTPSErrors: true,

    // Permissions
    permissions: ['clipboard-read', 'clipboard-write'],
  },

  // Projects for different browsers
  // Default: Only Chromium. To run other browsers:
  //   1. Install: npx playwright install firefox webkit
  //   2. Run: npx playwright test --project=firefox
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Uncomment below to enable multi-browser testing (install browsers first)
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'mobile-safari',
    //   use: { ...devices['iPhone 13'] },
    // },
  ],

  // Development server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
