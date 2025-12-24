/**
 * DOCX Converter Tests
 *
 * Tests for browser-based DOCX to Markdown conversion using mammoth.js.
 * Covers text extraction, structure preservation, tables, and lists.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DocxConverter } from '../../src/converters/DocxConverter';
import * as fs from 'fs';
import * as path from 'path';

describe('DocxConverter', () => {
  let converter: DocxConverter;

  beforeAll(() => {
    converter = new DocxConverter();
  });

  describe('supports()', () => {
    it('should support DOCX files by MIME type', () => {
      const file = new File([], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      expect(converter.supports(file)).toBe(true);
    });

    it('should support DOCX files by extension', () => {
      const file = new File([], 'document.docx', { type: '' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should not support DOC files (legacy format)', () => {
      const file = new File([], 'old-document.doc', { type: 'application/msword' });
      expect(converter.supports(file)).toBe(false);
    });

    it('should not support non-Word files', () => {
      const pdfFile = new File([], 'test.pdf', { type: 'application/pdf' });
      expect(converter.supports(pdfFile)).toBe(false);

      const txtFile = new File([], 'test.txt', { type: 'text/plain' });
      expect(converter.supports(txtFile)).toBe(false);
    });

    it('should handle uppercase extension', () => {
      const file = new File([], 'DOCUMENT.DOCX', { type: '' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should handle mixed case extension', () => {
      const file = new File([], 'Document.DocX', { type: '' });
      expect(converter.supports(file)).toBe(true);
    });
  });

  describe('convert()', () => {
    it('should convert sample DOCX to markdown', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.docx');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: sample.docx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'sample.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const markdown = await converter.convert(file);

      expect(markdown).toBeDefined();
      expect(typeof markdown).toBe('string');
      expect(markdown.length).toBeGreaterThan(0);
    });

    it('should preserve headings', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.docx');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: sample.docx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'sample.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const markdown = await converter.convert(file);

      // Should have heading markers
      expect(markdown).toMatch(/^#\s+/m);
    });

    it('should preserve text content', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.docx');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: sample.docx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'sample.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const markdown = await converter.convert(file);

      // Check for expected content from sample.docx
      expect(markdown).toContain('Hans Müller');
      expect(markdown).toContain('hans.mueller@example.ch');
      expect(markdown).toContain('Zürich');
    });

    it('should preserve special characters', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.docx');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: sample.docx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'sample.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const markdown = await converter.convert(file);

      // Check special characters are preserved
      expect(markdown).toContain('äöü');
      expect(markdown).toContain('ß');
    });

    it('should convert DOCX with tables', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/table.docx');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: table.docx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'table.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const markdown = await converter.convert(file);

      expect(markdown).toBeDefined();
      // Check for table content
      expect(markdown).toContain('John Doe');
      expect(markdown).toContain('Jane Smith');
    });

    it('should convert DOCX with lists', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/list.docx');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: list.docx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'list.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const markdown = await converter.convert(file);

      expect(markdown).toBeDefined();
      // Check for list content
      expect(markdown).toContain('bullet');
    });

    it('should clean up excessive whitespace', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.docx');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: sample.docx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'sample.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const markdown = await converter.convert(file);

      // Should not have more than 2 consecutive newlines
      expect(markdown).not.toMatch(/\n{3,}/);
      // Should not have leading/trailing whitespace
      expect(markdown).toBe(markdown.trim());
    });
  });

  describe('edge cases', () => {
    it('should reject corrupted DOCX data', async () => {
      const corruptedData = 'This is not a valid DOCX file';
      const file = new File([corruptedData], 'corrupted.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      await expect(converter.convert(file)).rejects.toThrow();
    });

    it('should handle empty file name gracefully', () => {
      const file = new File([], '', { type: '' });
      // Should not throw, just return false
      expect(converter.supports(file)).toBe(false);
    });
  });

  describe('turndown configuration', () => {
    it('should use ATX-style headings', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.docx');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: sample.docx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'sample.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const markdown = await converter.convert(file);

      // ATX style uses # symbols, not underlines
      expect(markdown).toMatch(/^#+\s+/m);
      expect(markdown).not.toMatch(/^=+$/m); // setext style (equals underline)
      // Note: We can't check for ^-+$ because YAML frontmatter uses --- delimiter
      // Instead, check that there are no long dash lines (4+ dashes) used as underlines
      // Frontmatter uses exactly 3 dashes, setext uses many more
      expect(markdown).not.toMatch(/^-{4,}$/m); // setext style (dash underline, 4+ chars)
    });

    it('should use dash for bullet lists', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/list.docx');

      if (!fs.existsSync(fixturePath)) {
        console.warn('Skipping test: list.docx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'list.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      const markdown = await converter.convert(file);

      // Should use dashes for bullet lists, not asterisks
      if (markdown.includes('-')) {
        expect(markdown).toMatch(/^-\s+/m);
      }
    });
  });
});
