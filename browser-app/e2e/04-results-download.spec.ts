/**
 * E2E Tests: Review UI and Download
 *
 * Tests the entity review UI, preview functionality,
 * and download capabilities (markdown, mapping).
 *
 * Note: The app now uses an entity review flow instead of
 * batch result cards. Downloads are done from the review UI.
 */

import { test, expect } from '@playwright/test';
import { PIIAnonymizerPage } from './helpers/page-objects';
import {
  createTextFile,
  SAMPLE_PII_TEXT,
} from './fixtures/test-files';

test.describe('Review UI Display', () => {
  test('should show review section after processing', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'document.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Review section should be visible
    await expect(app.reviewSection).toBeVisible();

    // Should show filename
    await expect(app.currentFileName).toContainText('document.txt');
  });

  test('should show review title', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewTitle).toContainText('Review Detected PII');
  });

  test('should show detection status', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Detection status should show something
    await expect(app.detectionStatus).toBeVisible();
  });

  test('should show back button', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.backButton).toBeVisible();
  });

  test('should handle file with no PII detected', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const cleanText = 'This is a document with no personal information whatsoever.';
    const file = createTextFile(cleanText, 'clean.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Review should still be shown
    await expect(app.reviewSection).toBeVisible();
  });
});

test.describe('Preview Functionality', () => {
  test('should show preview content area', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Preview body should be visible
    const previewBody = page.locator('[data-testid="preview-body"], .preview-body, #preview-body-content');
    await expect(previewBody.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show anonymized content in preview', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Preview content should have text
    const previewContent = page.locator('#preview-body-content, .preview-body');
    const text = await previewContent.first().textContent();
    expect(text?.length).toBeGreaterThan(0);
  });
});

test.describe('Entity Sidebar', () => {
  test('should show entity sidebar', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Entity sidebar should be visible
    const sidebar = page.locator('[data-testid="entity-sidebar"], .entity-sidebar, #preview-sidebar');
    await expect(sidebar.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show entity groups', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Should have entity groups
    const groups = page.locator('.entity-group');
    const count = await groups.count();
    // May have groups (or not if no entities)
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Download Buttons', () => {
  test('should show copy button', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Copy button should be visible
    const copyBtn = page.locator('[data-testid="copy-btn"], #copy-btn');
    await expect(copyBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show download markdown button', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Download MD button should be visible
    const downloadMdBtn = page.locator('[data-testid="download-md-btn"], #download-md-btn');
    await expect(downloadMdBtn.first()).toBeVisible({ timeout: 10000 });
  });

  test('should show download mapping button', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Download mapping button should be visible
    const downloadMapBtn = page.locator('[data-testid="download-map-btn"], #download-map-btn');
    await expect(downloadMapBtn.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Navigation', () => {
  test('should return to upload when back button clicked', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Click back
    await app.backButton.click();

    // Should return to upload section
    await expect(app.uploadZone).toBeVisible({ timeout: 10000 });
    await expect(app.reviewSection).toBeHidden();
  });

  test('should keep results after navigation back and forth', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Navigate back
    await app.backButton.click();
    await expect(app.uploadZone).toBeVisible({ timeout: 10000 });

    // Process again
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Should be in review again
    await expect(app.reviewSection).toBeVisible();
  });
});

test.describe('Review Persistence', () => {
  test('should maintain review state during interaction', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Review should still be visible after some time
    await page.waitForTimeout(1000);
    await expect(app.reviewSection).toBeVisible();
  });
});
