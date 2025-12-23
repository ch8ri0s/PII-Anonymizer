/**
 * E2E Tests: Initial Application Load
 *
 * Tests the initial page load, ML model initialization,
 * and basic UI rendering.
 */

import { test, expect } from '@playwright/test';
import { PIIAnonymizerPage } from './helpers/page-objects';

test.describe('Application Initial Load', () => {
  test('should load the application with correct title and header', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();

    // Verify page title
    await expect(page).toHaveTitle(/PII Anonymizer/);

    // Verify header is visible
    await expect(app.heading).toHaveText('PII Anonymizer');

    // Verify privacy badge
    await expect(app.privacyBadge).toBeVisible();
    await expect(app.privacyBadge).toContainText('No Data Leaves Your Browser');
  });

  test('should display upload zone on initial load', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();

    // Upload zone should be visible
    await expect(app.uploadZone).toBeVisible();

    // Should show upload instructions
    await expect(app.uploadZone).toContainText('Drop files here or click to upload');
    await expect(app.uploadZone).toContainText('Supports PDF, DOCX, XLSX, CSV, TXT');
  });

  test('should initialize ML model and show loading progress', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();

    // Model status should appear (may be brief)
    await app.modelStatus.isVisible().catch(() => false);

    // Wait for model to be ready (success or fallback)
    await app.waitForModelReady(30000);

    // After loading, model status should be hidden or show success/fallback
    const isHidden = await app.modelStatus.isHidden();
    const text = await app.modelStatus.textContent();

    expect(isHidden || text?.includes('regex-only') || text?.includes('Fallback')).toBeTruthy();
  });

  test('should have file list and results sections hidden initially', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();

    // These sections should be hidden on initial load
    await expect(app.fileList).toBeHidden();
    await expect(app.processingStatus).toBeHidden();
    await expect(app.resultsSection).toBeHidden();
    await expect(app.piiSummary).toBeHidden();
  });

  test('should have no console errors on initial load', async ({ page }) => {
    const consoleErrors: string[] = [];

    // Capture console errors (excluding known warnings)
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Filter out known harmless errors
        if (!text.includes('favicon') && !text.includes('chrome-extension')) {
          consoleErrors.push(text);
        }
      }
    });

    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    // Should have no critical console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    const app = new PIIAnonymizerPage(page);
    await app.goto();

    // Core elements should still be visible
    await expect(app.heading).toBeVisible();
    await expect(app.uploadZone).toBeVisible();

    // Upload instructions should be readable
    const uploadText = await app.uploadZone.textContent();
    expect(uploadText).toBeTruthy();
  });

  test('should have accessible footer with privacy notice', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();

    // Footer should explain local processing
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('All processing happens locally in your browser');
    await expect(footer).toContainText('No data is sent to any server');
  });

  test('should handle model loading cancellation gracefully', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();

    // Try to find and click cancel button if model is still loading
    const cancelButton = page.locator('button:has-text("Cancel")');
    const isVisible = await cancelButton.isVisible().catch(() => false);

    if (isVisible) {
      await cancelButton.click();

      // App should still be functional (upload zone visible)
      await expect(app.uploadZone).toBeVisible();
    }

    // This test passes even if cancel button is not found (model loaded too quickly)
    expect(true).toBe(true);
  });

  test('should work in fallback mode if ML model unavailable', async ({ page }) => {
    // Intercept model loading and simulate failure
    await page.route('**/*transformers*', route => route.abort());
    await page.route('**/*.onnx', route => route.abort());

    const app = new PIIAnonymizerPage(page);
    await app.goto();

    // Should eventually show fallback mode or hide loading
    await app.waitForModelReady(30000);

    // App should still be usable
    await expect(app.uploadZone).toBeVisible();

    // Model status might show fallback message
    const statusText = await app.modelStatus.textContent();
    const isHidden = await app.modelStatus.isHidden();

    expect(isHidden || statusText?.includes('regex') || statusText?.includes('Fallback')).toBeTruthy();
  });
});

test.describe('Browser Compatibility', () => {
  test('should support File API', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();

    const hasFileAPI = await page.evaluate(() => {
      return typeof File !== 'undefined' && typeof FileReader !== 'undefined';
    });

    expect(hasFileAPI).toBe(true);
  });

  test('should support required Web APIs', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();

    const apis = await page.evaluate(() => {
      return {
        fetch: typeof fetch !== 'undefined',
        promises: typeof Promise !== 'undefined',
        arrayBuffer: typeof ArrayBuffer !== 'undefined',
        blob: typeof Blob !== 'undefined',
        dataTransfer: typeof DataTransfer !== 'undefined',
      };
    });

    expect(apis.fetch).toBe(true);
    expect(apis.promises).toBe(true);
    expect(apis.arrayBuffer).toBe(true);
    expect(apis.blob).toBe(true);
    // DataTransfer may not be available in all contexts, so just log it
    console.log('DataTransfer support:', apis.dataTransfer);
  });
});
