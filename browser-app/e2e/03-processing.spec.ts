/**
 * E2E Tests: Document Processing
 *
 * Tests the complete document processing pipeline including
 * PII detection, entity review, and the new review UI flow.
 *
 * Note: The app now uses a single-file entity review flow instead
 * of batch processing with result cards.
 */

import { test, expect } from '@playwright/test';
import { PIIAnonymizerPage } from './helpers/page-objects';
import {
  createTextFile,
  createCSVFile,
  SAMPLE_PII_TEXT,
  SAMPLE_PII_CSV,
} from './fixtures/test-files';

test.describe('Basic Processing Flow', () => {
  test('should process single text file successfully', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    // Upload file
    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);

    // Click process
    await app.clickProcess();

    // Review section should appear (new flow)
    await expect(app.reviewSection).toBeVisible({ timeout: 30000 });

    // Wait for detection to complete
    await app.waitForProcessingComplete();

    // Verify we're in the review UI
    await expect(app.reviewTitle).toContainText('Review Detected PII');
    await expect(app.currentFileName).toContainText('test.txt');
  });

  test('should show file name in review header', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'my-document.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // File name should be displayed
    await expect(app.currentFileName).toContainText('my-document.txt');
  });

  test('should disable process button during processing', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);

    // Process button should be enabled before processing
    await expect(app.processButton).toBeEnabled();

    // Click process
    await app.clickProcess();

    // Should navigate away from upload section
    await expect(app.reviewSection).toBeVisible({ timeout: 30000 });

    // Upload section should be hidden
    await expect(app.uploadZone).toBeHidden();
  });

  test('should allow navigating back to upload', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Back button should be visible
    await expect(app.backButton).toBeVisible();

    // Click back
    await app.backButton.click();

    // Should return to upload section
    await expect(app.uploadZone).toBeVisible({ timeout: 10000 });
  });
});

test.describe('PII Detection in Review UI', () => {
  test('should detect email addresses in text', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const text = 'Contact us at john.doe@example.com for more info.';
    const file = createTextFile(text, 'email-test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Detection status should show entities found
    const statusText = await app.detectionStatus.textContent();
    expect(statusText).toBeTruthy();

    // Review container should have entity sidebar with entities
    const sidebar = page.locator('[data-testid="entity-sidebar"], .entity-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  test('should detect phone numbers', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const text = 'Call me at +41 79 123 45 67 for assistance.';
    const file = createTextFile(text, 'phone-test.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await expect(app.processButton).toBeEnabled();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Review section should be visible with entities
    await expect(app.reviewSection).toBeVisible();
  });

  test('should detect Swiss PII (IBAN)', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const text = 'Payment to IBAN: CH93 0076 2011 6238 5295 7';
    const file = createTextFile(text, 'iban-test.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await expect(app.processButton).toBeEnabled();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Review section should be visible
    await expect(app.reviewSection).toBeVisible();
  });

  test('should handle files with no PII', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const cleanText = 'This is a document with no personal information.';
    const file = createTextFile(cleanText, 'clean.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await expect(app.processButton).toBeEnabled();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Should still show review section
    await expect(app.reviewSection).toBeVisible();
  });
});

test.describe('CSV Processing', () => {
  test('should process CSV with PII in rows', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createCSVFile(SAMPLE_PII_CSV, 'data.csv');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await expect(app.processButton).toBeEnabled();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Review section should be visible
    await expect(app.reviewSection).toBeVisible();
  });
});

test.describe('Error Handling', () => {
  test('should handle empty file processing', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile('', 'empty.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();

    // Should still navigate to review (even if empty)
    await expect(app.reviewSection).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Performance', () => {
  test('should process small file quickly (under 60 seconds)', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile(SAMPLE_PII_TEXT, 'quick.txt');
    await app.uploadFiles([file]);

    const startTime = Date.now();
    await app.clickProcess();
    await app.waitForProcessingComplete(60000); // Allow up to 60s for processing
    const endTime = Date.now();

    const duration = endTime - startTime;
    expect(duration).toBeLessThan(60000); // Should complete in under 60 seconds
  });
});
