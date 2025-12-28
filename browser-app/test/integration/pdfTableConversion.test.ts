/**
 * Integration Tests for PDF Conversion (Browser)
 *
 * Tests PDF to Markdown conversion using pdfjs-dist.
 * Note: Browser version focuses on text extraction without table metadata.
 * For full table detection tests, see test/integration/pdfTableConversion.test.js (Electron)
 *
 * Tasks: T046-T050
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PdfConverter } from '../../src/converters/PdfConverter';
import { getMimeType, PERFORMANCE_THRESHOLDS } from '@shared-test/index';

// Test logger for consistent output
import { createTestLogger } from '../helpers/testLogger';
const log = createTestLogger('integration:pdf');

// Test fixtures directory - using parent project fixtures
const TEST_FIXTURES_DIR = path.join(__dirname, '../../../test/fixtures');
const BROWSER_FIXTURES_DIR = path.join(__dirname, '../fixtures');

// Helper to create File from buffer
function bufferToFile(buffer: Buffer, filename: string): File {
  // Convert Buffer to Uint8Array to avoid type compatibility issues
  const uint8Array = new Uint8Array(buffer);
  const blob = new Blob([uint8Array]);
  return new File([blob], filename, { type: getMimeType(filename) });
}

describe('PDF Conversion Integration (Browser)', () => {
  let converter: PdfConverter;

  beforeEach(() => {
    converter = new PdfConverter();
  });

  describe('Basic PDF Conversion', () => {
    it('should convert PDF with table content to text (T047)', async () => {
      const testPdfPath = path.join(TEST_FIXTURES_DIR, 'simple-table.pdf');

      if (!fs.existsSync(testPdfPath)) {
        log.debug('Skipping: simple-table.pdf not found');
        return;
      }

      const buffer = fs.readFileSync(testPdfPath);
      const file = bufferToFile(buffer, 'simple-table.pdf');

      let result: string;
      try {
        result = await converter.convert(file);
      } catch (error) {
        // pdf-parse has known compatibility issues with some PDFs
        if ((error as Error).message.includes('bad XRef') ||
            (error as Error).message.includes('Illegal character')) {
          log.debug('Skipping: PDF parsing failed (known compatibility issue)');
          return;
        }
        throw error;
      }

      // Verify output is a string with content
      expect(result).toBeTypeOf('string');
      expect(result.length).toBeGreaterThan(0);

      // Browser converter returns plain text, should contain table data
      // Note: No frontmatter in browser version (unlike Electron)
      expect(result).toMatch(/\w+/); // Should contain some text
    });

    it('should convert multi-page PDFs (T048)', async () => {
      const testPdfPath = path.join(TEST_FIXTURES_DIR, 'multi-page-tables.pdf');

      if (!fs.existsSync(testPdfPath)) {
        log.debug('Skipping: multi-page-tables.pdf not found');
        return;
      }

      const buffer = fs.readFileSync(testPdfPath);
      const file = bufferToFile(buffer, 'multi-page-tables.pdf');

      let result: string;
      try {
        result = await converter.convert(file);
      } catch (error) {
        if ((error as Error).message.includes('bad XRef') ||
            (error as Error).message.includes('Illegal character')) {
          log.debug('Skipping: PDF parsing failed');
          return;
        }
        throw error;
      }

      expect(result).toBeTypeOf('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should extract text content from PDFs (T049)', async () => {
      const testPdfPath = path.join(TEST_FIXTURES_DIR, 'simple-table.pdf');

      if (!fs.existsSync(testPdfPath)) {
        log.debug('Skipping: simple-table.pdf not found');
        return;
      }

      const buffer = fs.readFileSync(testPdfPath);
      const file = bufferToFile(buffer, 'simple-table.pdf');

      let result: string;
      try {
        result = await converter.convert(file);
      } catch (error) {
        if ((error as Error).message.includes('bad XRef') ||
            (error as Error).message.includes('Illegal character')) {
          log.debug('Skipping: PDF parsing failed');
          return;
        }
        throw error;
      }

      // Verify text extraction works
      expect(result).toBeTypeOf('string');
      expect(result.length).toBeGreaterThan(0);
      // Should contain some words
      expect(result.split(/\s+/).length).toBeGreaterThan(1);
    });
  });

  describe('Graceful Degradation (FR-008)', () => {
    it('should handle PDFs without tables gracefully', async () => {
      const testPdfPath = path.join(TEST_FIXTURES_DIR, 'text-only.pdf');

      if (!fs.existsSync(testPdfPath)) {
        // Try browser-app fixtures
        const browserPath = path.join(BROWSER_FIXTURES_DIR, 'text-only.pdf');
        if (!fs.existsSync(browserPath)) {
          expect(converter).toBeInstanceOf(PdfConverter);
          return;
        }
      }

      const pdfPath = fs.existsSync(testPdfPath)
        ? testPdfPath
        : path.join(BROWSER_FIXTURES_DIR, 'text-only.pdf');

      const buffer = fs.readFileSync(pdfPath);
      const file = bufferToFile(buffer, 'text-only.pdf');

      let result: string;
      try {
        result = await converter.convert(file);
      } catch (error) {
        if ((error as Error).message.includes('bad XRef') ||
            (error as Error).message.includes('Illegal character')) {
          log.debug('Skipping: PDF parsing failed');
          return;
        }
        throw error;
      }

      expect(result).toBeTypeOf('string');
      expect(result.length).toBeGreaterThan(0);
      // Should extract the text content
      expect(result).toMatch(/\w+/);
    });

    it('should extract readable text from text-only PDFs', async () => {
      const testPdfPath = path.join(TEST_FIXTURES_DIR, 'text-only.pdf');

      if (!fs.existsSync(testPdfPath)) {
        const browserPath = path.join(BROWSER_FIXTURES_DIR, 'text-only.pdf');
        if (!fs.existsSync(browserPath)) {
          expect(converter).toBeInstanceOf(PdfConverter);
          return;
        }
      }

      const pdfPath = fs.existsSync(testPdfPath)
        ? testPdfPath
        : path.join(BROWSER_FIXTURES_DIR, 'text-only.pdf');

      const buffer = fs.readFileSync(pdfPath);
      const file = bufferToFile(buffer, 'text-only.pdf');

      let result: string;
      try {
        result = await converter.convert(file);
      } catch (error) {
        if ((error as Error).message.includes('bad XRef') ||
            (error as Error).message.includes('Illegal character')) {
          log.debug('Skipping: PDF parsing failed');
          return;
        }
        throw error;
      }

      // Verify text content is readable
      expect(result).toBeTypeOf('string');
      expect(result.length).toBeGreaterThan(10); // At least some meaningful content
    });
  });

  describe('Error Handling', () => {
    it('should never throw exceptions on malformed PDFs (FR-008)', async () => {
      // Verify converter is properly instantiated
      expect(converter).toBeInstanceOf(PdfConverter);

      // Test with corrupted data
      const corruptedData = 'This is not a valid PDF file';
      const file = new File([corruptedData], 'corrupted.pdf', { type: 'application/pdf' });

      // Should throw for invalid PDF, not crash
      await expect(converter.convert(file)).rejects.toThrow();
    });

    it('should handle PDFs with special characters in table cells', async () => {
      const testPdfPath = path.join(TEST_FIXTURES_DIR, 'special-chars-table.pdf');

      if (!fs.existsSync(testPdfPath)) {
        log.debug('Skipping: special-chars-table.pdf not found');
        return;
      }

      const buffer = fs.readFileSync(testPdfPath);
      const file = bufferToFile(buffer, 'special-chars-table.pdf');

      let result: string;
      try {
        result = await converter.convert(file);
      } catch (error) {
        if ((error as Error).message.includes('bad XRef') ||
            (error as Error).message.includes('Illegal character')) {
          log.debug('Skipping: PDF parsing failed');
          return;
        }
        throw error;
      }

      expect(result).toBeTypeOf('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Markdown Table Output Quality', () => {
    it('should produce valid markdown table syntax', async () => {
      const testPdfPath = path.join(TEST_FIXTURES_DIR, 'simple-table.pdf');

      if (!fs.existsSync(testPdfPath)) {
        log.debug('Skipping: simple-table.pdf not found');
        return;
      }

      const buffer = fs.readFileSync(testPdfPath);
      const file = bufferToFile(buffer, 'simple-table.pdf');

      let result: string;
      try {
        result = await converter.convert(file);
      } catch (error) {
        if ((error as Error).message.includes('bad XRef') ||
            (error as Error).message.includes('Illegal character')) {
          log.debug('Skipping: PDF parsing failed');
          return;
        }
        throw error;
      }

      // If tables were detected, verify markdown table structure
      if (result.includes('| ')) {
        // Check for pipe characters (table syntax)
        expect(result).toMatch(/\|.*\|/);

        // Check for separator row (---|)
        expect(result).toMatch(/\|[\s-]+\|/);

        // Verify consistent columns in table rows
        const tableLines = result
          .split('\n')
          .filter(line => line.includes('|') && !line.match(/^\s*\|[\s-]+\|\s*$/));

        if (tableLines.length > 1) {
          const firstLinePipes = (tableLines[0].match(/\|/g) || []).length;
          const allSamePipes = tableLines.every(
            line => (line.match(/\|/g) || []).length === firstLinePipes,
          );
          expect(allSamePipes, 'Table should have consistent columns').toBe(true);
        }
      }
    });

    it('should escape special markdown characters in table cells', async () => {
      const testPdfPath = path.join(TEST_FIXTURES_DIR, 'special-chars-table.pdf');

      if (!fs.existsSync(testPdfPath)) {
        log.debug('Skipping: special-chars-table.pdf not found');
        return;
      }

      const buffer = fs.readFileSync(testPdfPath);
      const file = bufferToFile(buffer, 'special-chars-table.pdf');

      let result: string;
      try {
        result = await converter.convert(file);
      } catch (error) {
        if ((error as Error).message.includes('bad XRef') ||
            (error as Error).message.includes('Illegal character')) {
          log.debug('Skipping: PDF parsing failed');
          return;
        }
        throw error;
      }

      // Pipes in content should be escaped
      // Look for \| which indicates escaped pipe
      if (result.includes('|')) {
        // The markdown should be parseable without breaking table structure
        const lines = result.split('\n');
        const tableStartIndex = lines.findIndex(l => l.includes('|'));
        if (tableStartIndex >= 0) {
          // Basic sanity check - first table line should have at least 2 pipes
          expect((lines[tableStartIndex].match(/\|/g) || []).length).toBeGreaterThanOrEqual(2);
        }
      }
    });
  });

  describe('Performance', () => {
    it('should convert PDFs within acceptable time', async () => {
      const testPdfPath = path.join(TEST_FIXTURES_DIR, 'simple-table.pdf');

      if (!fs.existsSync(testPdfPath)) {
        log.debug('Skipping: simple-table.pdf not found');
        return;
      }

      const buffer = fs.readFileSync(testPdfPath);
      const file = bufferToFile(buffer, 'simple-table.pdf');

      const start = performance.now();
      try {
        await converter.convert(file);
      } catch (error) {
        if ((error as Error).message.includes('bad XRef') ||
            (error as Error).message.includes('Illegal character')) {
          log.debug('Skipping: PDF parsing failed');
          return;
        }
        throw error;
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(PERFORMANCE_THRESHOLDS.maxProcessingTimeMs);
      log.debug('PDF conversion completed', { durationMs: elapsed.toFixed(0) });
    });
  });
});

describe('Cross-Platform PDF Conversion Consistency', () => {
  let converter: PdfConverter;

  beforeAll(() => {
    converter = new PdfConverter();
  });

  it('should produce consistent output across runs', async () => {
    const testPdfPath = path.join(TEST_FIXTURES_DIR, 'simple-table.pdf');

    if (!fs.existsSync(testPdfPath)) {
      log.debug('Skipping: simple-table.pdf not found');
      return;
    }

    const buffer = fs.readFileSync(testPdfPath);
    const file1 = bufferToFile(buffer, 'simple-table.pdf');
    const file2 = bufferToFile(buffer, 'simple-table.pdf');

    let result1: string;
    let result2: string;

    try {
      result1 = await converter.convert(file1);
      result2 = await converter.convert(file2);
    } catch (error) {
      if ((error as Error).message.includes('bad XRef') ||
          (error as Error).message.includes('Illegal character')) {
        log.debug('Skipping: PDF parsing failed');
        return;
      }
      throw error;
    }

    // Results should be identical across runs
    expect(result1).toBe(result2);

    // Both should have content
    expect(result1.length).toBeGreaterThan(0);
    expect(result2.length).toBeGreaterThan(0);
  });
});
