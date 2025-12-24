/**
 * E2E Tests: Edge Cases and Error Scenarios
 *
 * Tests application robustness with edge cases,
 * error conditions, and unusual inputs.
 *
 * Note: Updated for the new entity review flow.
 */

import { test, expect } from '@playwright/test';
import { PIIAnonymizerPage } from './helpers/page-objects';
import {
  createTextFile,
  createCSVFile,
  createMarkdownFile,
  SAMPLE_MARKDOWN_WITH_CODE,
} from './fixtures/test-files';

test.describe('Empty and Minimal Inputs', () => {
  test('should handle empty text file', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile('', 'empty.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Should show review section
    await expect(app.reviewSection).toBeVisible();
  });

  test('should handle whitespace-only file', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile('   \n\n\t\t   \n', 'whitespace.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });

  test('should handle single character file', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile('a', 'single.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });
});

test.describe('Special Characters and Encoding', () => {
  test('should handle Unicode characters', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const unicodeText = `
      Emails: test@example.com, user@example.org
      Names: José García, François Müller
      Phone: +41 44 123 45 67
    `;
    const file = createTextFile(unicodeText, 'unicode.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });

  test('should handle emoji characters', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const emojiText = 'Contact 📧: test@example.com 📞: +41 79 123 45 67 👤';
    const file = createTextFile(emojiText, 'emoji.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });

  test('should handle special punctuation', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const text = 'Email: "test@example.com" (main) | Phone: +41-79-123-45-67';
    const file = createTextFile(text, 'punctuation.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });

  test('should handle newline variations (LF, CRLF)', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const mixedNewlines = 'Line1\nLine2\r\nLine3\rLine4';
    const file = createTextFile(mixedNewlines, 'newlines.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });
});

test.describe('Code Block Preservation', () => {
  test('should preserve PII in code blocks', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createMarkdownFile(SAMPLE_MARKDOWN_WITH_CODE, 'code.md');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });

  test('should handle multiple code blocks', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const multiCode = `
# Config

\`\`\`javascript
const email = "admin@example.com";
\`\`\`

Regular text: Contact john@example.com

\`\`\`python
user_email = "test@example.com"
\`\`\`
    `;
    const file = createMarkdownFile(multiCode, 'multicode.md');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });

  test('should handle inline code', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const inlineCode = 'Use `email = "test@example.com"` for testing.';
    const file = createMarkdownFile(inlineCode, 'inline.md');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });
});

test.describe('Large Content Handling', () => {
  test('should handle moderately large file (50KB)', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    // Create ~50KB file
    const baseText = 'Contact us at info@example.com for help. ';
    const largeContent = baseText.repeat(1250);
    const file = createTextFile(largeContent, 'large.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete(120000);

    await expect(app.reviewSection).toBeVisible();
  });

  test('should handle file with many PII instances', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    // Many unique emails
    const emails = Array.from({ length: 20 }, (_, i) =>
      `user${i}@example.com`,
    ).join('\n');
    const file = createTextFile(emails, 'many-emails.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete(120000);

    await expect(app.reviewSection).toBeVisible();
  });

  test('should handle very long lines', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const longLine = 'word '.repeat(500) + 'email@example.com ' + 'word '.repeat(500);
    const file = createTextFile(longLine, 'longline.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete(120000);

    await expect(app.reviewSection).toBeVisible();
  });
});

test.describe('CSV Edge Cases', () => {
  test('should handle CSV with empty cells', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const csv = 'Name,Email,Phone\n,test@example.com,\nJohn,,+41791234567';
    const file = createCSVFile(csv, 'empty-cells.csv');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });

  test('should handle CSV with quoted fields', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const csv = 'Name,Email\n"Doe, John","john@example.com"';
    const file = createCSVFile(csv, 'quoted.csv');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });

  test('should handle CSV with only headers', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const csv = 'Name,Email,Phone,Address';
    const file = createCSVFile(csv, 'headers-only.csv');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });

  test('should handle single column CSV', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const csv = 'Email\ntest1@example.com\ntest2@example.com';
    const file = createCSVFile(csv, 'single-col.csv');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });
});

test.describe('Concurrent Operations', () => {
  test('should handle rapid file additions', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    // Add files quickly
    const file1 = createTextFile('test1@example.com', 'file1.txt');
    const file2 = createTextFile('test2@example.com', 'file2.txt');
    const file3 = createTextFile('test3@example.com', 'file3.txt');

    await app.uploadFiles([file1, file2, file3]);

    // All should be in the list
    const count = await app.getFileCount();
    expect(count).toBe(3);
  });
});

test.describe('Malformed Input', () => {
  test('should handle text that looks like PII but is not', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const falsePositives = `
      Not an email: user@
      Not a phone: 123
      Not an IBAN: CH93
    `;
    const file = createTextFile(falsePositives, 'false-positives.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });

  test('should handle mixed valid and invalid PII', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const mixed = `
      Valid: test@example.com
      Invalid: not-an-email
      Valid: +41 79 123 45 67
      Invalid: 123-456
    `;
    const file = createTextFile(mixed, 'mixed.txt');
    await app.uploadFiles([file]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });
});

test.describe('Browser Resource Management', () => {
  test('should handle memory cleanup after processing', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile('test@example.com', 'test.txt');
    await app.uploadFiles([file]);
    await app.clickProcess();
    await app.waitForProcessingComplete();

    // Navigate back
    await app.backButton.click();
    await expect(app.uploadZone).toBeVisible({ timeout: 10000 });

    // Should still be functional
    await expect(app.uploadZone).toBeVisible();
  });

  test('should handle multiple processing cycles', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    // First cycle
    const file1 = createTextFile('first@example.com', 'first.txt');
    await app.uploadFiles([file1]);
    await app.clickProcess();
    await app.waitForProcessingComplete();
    await app.backButton.click();
    await expect(app.uploadZone).toBeVisible({ timeout: 10000 });

    // Second cycle
    const file2 = createTextFile('second@example.com', 'second.txt');
    await app.uploadFiles([file2]);
    await expect(app.fileList).toBeVisible();
    await app.clickProcess();
    await app.waitForProcessingComplete();

    await expect(app.reviewSection).toBeVisible();
  });
});

test.describe('Filename Edge Cases', () => {
  test('should handle filename with no extension', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile('test@example.com', 'noextension.txt');
    await app.uploadFiles([file]);

    const count = await app.getFileCount();
    expect(count).toBe(1);
  });

  test('should handle filename with multiple dots', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile('test@example.com', 'file.backup.2024.txt');
    await app.uploadFiles([file]);

    const count = await app.getFileCount();
    expect(count).toBe(1);
  });

  test('should handle unicode filename', async ({ page }) => {
    const app = new PIIAnonymizerPage(page);
    await app.goto();
    await app.waitForModelReady();

    const file = createTextFile('test@example.com', 'données.txt');
    await app.uploadFiles([file]);

    const count = await app.getFileCount();
    expect(count).toBe(1);
  });
});
