/**
 * Page Object Model for E2E Tests
 *
 * Encapsulates UI interactions and selectors for maintainable tests.
 * Follows the Page Object pattern for clean test code.
 *
 * Uses shared TEST_IDS constants for consistency with UI components.
 */

import { Page, Locator, expect } from '@playwright/test';
import { TestFile } from '../fixtures/test-files';
import {
  TEST_IDS,
  testIdSelector,
  HEADER_TEST_IDS,
  MODEL_TEST_IDS,
  UPLOAD_TEST_IDS,
  PROCESSING_TEST_IDS,
  RESULTS_TEST_IDS,
  REVIEW_TEST_IDS,
} from '@shared/ui-components';

/**
 * Main application page object
 */
export class PIIAnonymizerPage {
  readonly page: Page;

  // Header elements
  readonly heading: Locator;
  readonly privacyBadge: Locator;

  // Model loading elements
  readonly modelStatus: Locator;
  readonly modelProgress: Locator;
  readonly modelProgressText: Locator;

  // Upload zone elements
  readonly uploadZone: Locator;
  readonly fileInput: Locator;

  // File list elements
  readonly fileList: Locator;
  readonly filesContainer: Locator;
  readonly processButton: Locator;

  // Processing elements
  readonly processingStatus: Locator;
  readonly processingContainer: Locator;

  // Results elements (legacy batch mode)
  readonly resultsSection: Locator;
  readonly resultsContainer: Locator;
  readonly downloadAllButton: Locator;

  // PII summary elements
  readonly piiSummary: Locator;
  readonly piiStats: Locator;

  // Review section elements (new entity review flow)
  readonly reviewSection: Locator;
  readonly reviewContainer: Locator;
  readonly reviewTitle: Locator;
  readonly currentFileName: Locator;
  readonly detectionStatus: Locator;
  readonly backButton: Locator;
  readonly downloadButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Header - use shared test ID constants
    this.heading = page.locator(testIdSelector(HEADER_TEST_IDS.APP_TITLE));
    this.privacyBadge = page.locator(testIdSelector(HEADER_TEST_IDS.PRIVACY_BADGE));

    // Model loading
    this.modelStatus = page.locator(testIdSelector(MODEL_TEST_IDS.STATUS));
    this.modelProgress = page.locator(testIdSelector(MODEL_TEST_IDS.PROGRESS));
    this.modelProgressText = page.locator(testIdSelector(MODEL_TEST_IDS.PROGRESS_TEXT));

    // Upload zone
    this.uploadZone = page.locator(testIdSelector(UPLOAD_TEST_IDS.ZONE));
    this.fileInput = page.locator(testIdSelector(UPLOAD_TEST_IDS.FILE_INPUT));

    // File list
    this.fileList = page.locator(testIdSelector(UPLOAD_TEST_IDS.FILE_LIST));
    this.filesContainer = page.locator(testIdSelector(UPLOAD_TEST_IDS.FILES_CONTAINER));
    this.processButton = page.locator(testIdSelector(TEST_IDS.BUTTON.PROCESS));

    // Processing
    this.processingStatus = page.locator(testIdSelector(PROCESSING_TEST_IDS.STATUS));
    this.processingContainer = page.locator(testIdSelector(PROCESSING_TEST_IDS.CONTAINER));

    // Results
    this.resultsSection = page.locator(testIdSelector(RESULTS_TEST_IDS.SECTION));
    this.resultsContainer = page.locator(testIdSelector(RESULTS_TEST_IDS.CONTAINER));
    this.downloadAllButton = page.locator(testIdSelector(RESULTS_TEST_IDS.DOWNLOAD_ALL_BTN));

    // PII summary
    this.piiSummary = page.locator(testIdSelector(RESULTS_TEST_IDS.PII_SUMMARY));
    this.piiStats = page.locator(testIdSelector(RESULTS_TEST_IDS.PII_STATS));

    // Review section (new entity review flow)
    this.reviewSection = page.locator(testIdSelector(REVIEW_TEST_IDS.SECTION));
    this.reviewContainer = page.locator(testIdSelector(REVIEW_TEST_IDS.CONTAINER));
    this.reviewTitle = page.locator(testIdSelector(REVIEW_TEST_IDS.TITLE));
    this.currentFileName = page.locator(testIdSelector(REVIEW_TEST_IDS.CURRENT_FILE_NAME));
    this.detectionStatus = page.locator(testIdSelector(REVIEW_TEST_IDS.DETECTION_STATUS));
    this.backButton = page.locator(testIdSelector(REVIEW_TEST_IDS.BACK_BTN));
    this.downloadButton = page.locator(testIdSelector(REVIEW_TEST_IDS.DOWNLOAD_BTN));
  }

  /**
   * Navigate to the application
   */
  async goto() {
    await this.page.goto('/');
    await expect(this.heading).toBeVisible();
  }

  /**
   * Wait for model to finish loading (success or fallback)
   */
  async waitForModelReady(timeout: number = 30000) {
    // Wait for either success or fallback mode
    await this.page.waitForFunction(
      () => {
        const statusDiv = document.getElementById('model-status');
        if (!statusDiv) return false;

        // Check if hidden (success) or shows fallback message
        return statusDiv.classList.contains('hidden') ||
               statusDiv.textContent?.includes('regex-only') ||
               statusDiv.textContent?.includes('Fallback');
      },
      { timeout },
    );
  }

  /**
   * Upload files using file input
   */
  async uploadFiles(files: TestFile[]) {
    await this.fileInput.setInputFiles(files);
  }

  /**
   * Upload files using drag and drop
   * Note: This simulates drag and drop by creating files in browser context
   */
  async dragAndDropFiles(files: TestFile[]) {
    // For drag and drop, we need to create files in the browser context
    const fileData = files.map(f => ({
      name: f.name,
      mimeType: f.mimeType,
      content: f.buffer.toString('base64'),
    }));

    await this.page.evaluate(async (data) => {
      const dt = new DataTransfer();
      for (const file of data) {
        const binary = atob(file.content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: file.mimeType });
        const f = new File([blob], file.name, { type: file.mimeType });
        dt.items.add(f);
      }

      const uploadZone = document.getElementById('upload-zone');
      if (uploadZone) {
        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer: dt,
        });
        uploadZone.dispatchEvent(dropEvent);
      }
    }, fileData);
  }

  /**
   * Click upload zone to trigger file picker
   */
  async clickUploadZone() {
    await this.uploadZone.click();
  }

  /**
   * Get number of files in the file list
   */
  async getFileCount(): Promise<number> {
    const items = await this.filesContainer.locator(testIdSelector(UPLOAD_TEST_IDS.FILE_ITEM)).count();
    return items;
  }

  /**
   * Remove a file by index
   */
  async removeFile(index: number) {
    const removeButton = this.filesContainer
      .locator(testIdSelector(UPLOAD_TEST_IDS.FILE_ITEM))
      .nth(index)
      .locator(testIdSelector(UPLOAD_TEST_IDS.FILE_ITEM_REMOVE));
    await removeButton.click();
  }

  /**
   * Click process button
   */
  async clickProcess() {
    await this.processButton.click();
  }

  /**
   * Wait for processing to complete (new entity review flow)
   * Waits for either the review section or results section to be visible
   */
  async waitForProcessingComplete(timeout: number = 60000) {
    // In the new flow, processing navigates to review section
    // Wait for review section to be visible and detection to complete
    await expect(this.reviewSection).toBeVisible({ timeout });

    // Wait for detection status to show "complete" or for entities to load
    await this.page.waitForFunction(
      (selector) => {
        const statusEl = document.querySelector(selector);
        if (!statusEl) return false;

        const text = statusEl.textContent || '';
        // Detection is complete when status shows entities found or Done
        return text.includes('found') ||
               text.includes('Done') ||
               text.includes('Complete') ||
               statusEl.classList.contains('complete');
      },
      testIdSelector(REVIEW_TEST_IDS.DETECTION_STATUS),
      { timeout },
    );
  }

  /**
   * Wait for legacy batch processing to complete
   * @deprecated Use waitForProcessingComplete for new entity review flow
   */
  async waitForBatchProcessingComplete(timeout: number = 60000) {
    // Wait for results section to be visible
    await expect(this.resultsSection).toBeVisible({ timeout });

    // Ensure processing status is hidden or all items show "Done"
    await this.page.waitForFunction(
      () => {
        const processingDiv = document.getElementById('processing-status');
        if (!processingDiv) return false;

        const statusTexts = Array.from(
          processingDiv.querySelectorAll('.status-text'),
        ).map(el => el.textContent || '');

        return statusTexts.every(text =>
          text.includes('Done') || text.includes('Error'),
        );
      },
      { timeout },
    );
  }

  /**
   * Get processing status for a file
   */
  async getProcessingStatus(index: number): Promise<string> {
    const statusText = this.processingContainer
      .locator('.status-text')
      .nth(index);
    return await statusText.textContent() || '';
  }

  /**
   * Get number of result cards
   */
  async getResultCount(): Promise<number> {
    return await this.resultsContainer.locator('.result-card').count();
  }

  /**
   * Download markdown for a result
   */
  async downloadMarkdown(index: number) {
    const downloadBtn = this.resultsContainer
      .locator('.result-card')
      .nth(index)
      .locator('.download-md');

    const downloadPromise = this.page.waitForEvent('download');
    await downloadBtn.click();
    return await downloadPromise;
  }

  /**
   * Download mapping for a result
   */
  async downloadMapping(index: number) {
    const downloadBtn = this.resultsContainer
      .locator('.result-card')
      .nth(index)
      .locator('.download-mapping');

    const downloadPromise = this.page.waitForEvent('download');
    await downloadBtn.click();
    return await downloadPromise;
  }

  /**
   * Click download all (ZIP)
   */
  async downloadAll() {
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadAllButton.click();
    return await downloadPromise;
  }

  /**
   * Expand preview for a result
   */
  async expandPreview(index: number) {
    const summary = this.resultsContainer
      .locator('.result-card')
      .nth(index)
      .locator('details summary');
    await summary.click();
  }

  /**
   * Get preview content for a result
   */
  async getPreviewContent(index: number): Promise<string> {
    const pre = this.resultsContainer
      .locator('.result-card')
      .nth(index)
      .locator('pre');
    return await pre.textContent() || '';
  }

  /**
   * Get PII stats from a result card
   */
  async getResultPIIStats(index: number): Promise<Record<string, number>> {
    const card = this.resultsContainer.locator('.result-card').nth(index);
    const badges = await card.locator('.bg-amber-100').allTextContents();

    const stats: Record<string, number> = {};
    for (const badge of badges) {
      const match = badge.match(/^(.+?):\s*(\d+)$/);
      if (match) {
        stats[match[1].trim()] = parseInt(match[2], 10);
      }
    }
    return stats;
  }

  /**
   * Get total PII stats from summary
   */
  async getTotalPIIStats(): Promise<Record<string, number>> {
    const visible = await this.piiSummary.isVisible();
    if (!visible) return {};

    const statElements = await this.piiStats.locator('> div').all();
    const stats: Record<string, number> = {};

    for (const element of statElements) {
      const count = await element.locator('.text-lg').textContent();
      const type = await element.locator('.text-xs').textContent();

      if (count && type) {
        stats[type.trim()] = parseInt(count.trim(), 10);
      }
    }

    return stats;
  }

  /**
   * Check if process button is disabled
   */
  async isProcessButtonDisabled(): Promise<boolean> {
    return await this.processButton.isDisabled();
  }

  /**
   * Wait for element to be hidden
   */
  async waitForHidden(locator: Locator, timeout: number = 5000) {
    await expect(locator).toBeHidden({ timeout });
  }

  /**
   * Wait for element to be visible
   */
  async waitForVisible(locator: Locator, timeout: number = 5000) {
    await expect(locator).toBeVisible({ timeout });
  }

  /**
   * Get all console errors
   */
  async getConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    return errors;
  }
}

// Re-export TEST_IDS for use in individual test files
export { TEST_IDS, testIdSelector };
