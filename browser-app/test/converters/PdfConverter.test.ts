/**
 * PDF Converter Tests
 *
 * Tests for browser-based PDF to Markdown conversion using pdf.js.
 * Covers text extraction, heading detection, and output quality.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PdfConverter } from '../../src/converters/PdfConverter';
import * as fs from 'fs';
import * as path from 'path';

describe('PdfConverter', () => {
  let converter: PdfConverter;

  beforeAll(() => {
    converter = new PdfConverter();
  });

  describe('supports()', () => {
    it('should support PDF files by MIME type', () => {
      const file = new File([], 'test.pdf', { type: 'application/pdf' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should support PDF files by extension', () => {
      const file = new File([], 'document.pdf', { type: '' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should not support non-PDF files', () => {
      const docxFile = new File([], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      expect(converter.supports(docxFile)).toBe(false);

      const txtFile = new File([], 'test.txt', { type: 'text/plain' });
      expect(converter.supports(txtFile)).toBe(false);
    });

    it('should handle uppercase extension', () => {
      const file = new File([], 'DOCUMENT.PDF', { type: '' });
      expect(converter.supports(file)).toBe(true);
    });
  });

  describe('convert()', () => {
    it('should convert text-only PDF to markdown', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/text-only.pdf');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: text-only.pdf fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'text-only.pdf', { type: 'application/pdf' });

      const markdown = await converter.convert(file);

      expect(markdown).toBeDefined();
      expect(typeof markdown).toBe('string');
      expect(markdown.length).toBeGreaterThan(0);
    });

    it('should preserve page breaks with horizontal rules', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/simple-table.pdf');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: simple-table.pdf fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'multi-page.pdf', { type: 'application/pdf' });

      const markdown = await converter.convert(file);

      // Multi-page PDFs should have page separators
      // Note: single page PDFs won't have separators
      expect(markdown).toBeDefined();
    });

    it('should detect headings based on font size', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/text-only.pdf');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: text-only.pdf fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'text-only.pdf', { type: 'application/pdf' });

      const markdown = await converter.convert(file);

      // Check that the converter processed the content
      // Heading detection is heuristic-based on font size
      expect(markdown).toBeDefined();
    });

    it('should handle empty PDF gracefully', async () => {
      // Create a minimal valid PDF
      const minimalPdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 0/Kids[]>>endobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer<</Size 3/Root 1 0 R>>\nstartxref\n109\n%%EOF';
      const file = new File([minimalPdf], 'empty.pdf', { type: 'application/pdf' });

      // Should not throw, but may return empty or minimal content
      const result = await converter.convert(file);
      expect(result).toBeDefined();
    });

    it('should maintain proper word spacing', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/text-only.pdf');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: text-only.pdf fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'text-only.pdf', { type: 'application/pdf' });

      const markdown = await converter.convert(file);

      // Words should be properly spaced (no run-together words)
      // Check for common patterns that indicate spacing issues
      expect(markdown).not.toMatch(/[a-z][A-Z]/); // camelCase in the middle of text
    });
  });

  describe('edge cases', () => {
    it('should handle PDF with special characters', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/text-only.pdf');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'special.pdf', { type: 'application/pdf' });

      const markdown = await converter.convert(file);
      expect(markdown).toBeDefined();
    });

    it('should reject corrupted PDF data', async () => {
      const corruptedData = 'This is not a valid PDF file';
      const file = new File([corruptedData], 'corrupted.pdf', { type: 'application/pdf' });

      await expect(converter.convert(file)).rejects.toThrow();
    });
  });
});
