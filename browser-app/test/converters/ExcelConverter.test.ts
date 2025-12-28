/**
 * Excel Converter Tests
 *
 * Tests for browser-based Excel to Markdown conversion using ExcelJS.
 * Covers table generation, multiple sheets, formulas, and special characters.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { ExcelConverter } from '../../src/converters/ExcelConverter';
import * as fs from 'fs';
import * as path from 'path';

// Test logger for consistent output
import { createTestLogger } from '../helpers/testLogger';
const log = createTestLogger('converter:excel');

describe('ExcelConverter', () => {
  let converter: ExcelConverter;

  beforeAll(() => {
    converter = new ExcelConverter();
  });

  describe('supports()', () => {
    it('should support XLSX files by MIME type', () => {
      const file = new File([], 'test.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      expect(converter.supports(file)).toBe(true);
    });

    it('should support XLS files by MIME type', () => {
      const file = new File([], 'test.xls', {
        type: 'application/vnd.ms-excel',
      });
      expect(converter.supports(file)).toBe(true);
    });

    it('should support XLSX files by extension', () => {
      const file = new File([], 'spreadsheet.xlsx', { type: '' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should support XLS files by extension', () => {
      const file = new File([], 'spreadsheet.xls', { type: '' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should not support CSV files', () => {
      const file = new File([], 'data.csv', { type: 'text/csv' });
      expect(converter.supports(file)).toBe(false);
    });

    it('should not support other file types', () => {
      const pdfFile = new File([], 'test.pdf', { type: 'application/pdf' });
      expect(converter.supports(pdfFile)).toBe(false);

      const docxFile = new File([], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      expect(converter.supports(docxFile)).toBe(false);
    });

    it('should handle uppercase extension', () => {
      const file = new File([], 'SPREADSHEET.XLSX', { type: '' });
      expect(converter.supports(file)).toBe(true);
    });
  });

  describe('convert()', () => {
    it('should convert Excel to markdown table', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.xlsx');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: sample.xlsx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'sample.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const markdown = await converter.convert(file);

      expect(markdown).toBeDefined();
      expect(typeof markdown).toBe('string');
      expect(markdown.length).toBeGreaterThan(0);
    });

    it('should include sheet name as heading', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.xlsx');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: sample.xlsx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'sample.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const markdown = await converter.convert(file);

      // Should have h2 heading with sheet name
      expect(markdown).toMatch(/^## /m);
      expect(markdown).toContain('Contacts');
    });

    it('should generate valid markdown table syntax', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.xlsx');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: sample.xlsx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'sample.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const markdown = await converter.convert(file);

      // Should have table header and separator rows
      expect(markdown).toMatch(/\|.*\|/); // Has pipe characters
      expect(markdown).toMatch(/\| --- \|/); // Has separator row
    });

    it('should preserve cell content', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.xlsx');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: sample.xlsx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'sample.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const markdown = await converter.convert(file);

      // Check for expected data from sample.xlsx
      expect(markdown).toContain('Hans Müller');
      expect(markdown).toContain('hans@example.ch');
      expect(markdown).toContain('Zürich');
    });

    it('should handle multiple worksheets', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/multi-sheet.xlsx');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: multi-sheet.xlsx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'multi-sheet.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const markdown = await converter.convert(file);

      // Should have multiple sheet headings
      expect(markdown).toContain('## Data');
      expect(markdown).toContain('## Summary');

      // Should have separator between sheets
      expect(markdown).toContain('---');
    });

    it('should handle formulas (show result)', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/formulas.xlsx');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: formulas.xlsx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'formulas.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const markdown = await converter.convert(file);

      // Should show formula results, not formulas
      expect(markdown).toContain('30');
      expect(markdown).toContain('40');
    });

    it('should escape pipe characters in content', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/special-chars.xlsx');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: special-chars.xlsx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'special-chars.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const markdown = await converter.convert(file);

      // Pipe characters in content should be escaped
      expect(markdown).toContain('\\|');
    });

    it('should preserve special characters', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/special-chars.xlsx');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: special-chars.xlsx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'special-chars.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const markdown = await converter.convert(file);

      // Check German and French special characters
      expect(markdown).toContain('Größe');
      expect(markdown).toContain('Café');
    });
  });

  describe('edge cases', () => {
    it('should reject corrupted Excel data', async () => {
      const corruptedData = 'This is not a valid Excel file';
      const file = new File([corruptedData], 'corrupted.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      await expect(converter.convert(file)).rejects.toThrow();
    });

    it('should handle empty file name gracefully', () => {
      const file = new File([], '', { type: '' });
      expect(converter.supports(file)).toBe(false);
    });

    it('should handle file with empty sheets', async () => {
      // Create an empty workbook in memory
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.default.Workbook();
      workbook.addWorksheet('Empty');

      const buffer = await workbook.xlsx.writeBuffer();
      const file = new File([buffer], 'empty.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const markdown = await converter.convert(file);

      // Should not throw, may return empty or minimal content
      expect(markdown).toBeDefined();
    });
  });

  describe('markdown table format', () => {
    it('should create header row with column names', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.xlsx');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: sample.xlsx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'sample.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const markdown = await converter.convert(file);

      // Should have header columns
      expect(markdown).toContain('Name');
      expect(markdown).toContain('Email');
      expect(markdown).toContain('Phone');
      expect(markdown).toContain('City');
    });

    it('should have proper separator row after header', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.xlsx');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: sample.xlsx fixture not found');
        return;
      }

      const buffer = fs.readFileSync(fixturePath);
      const file = new File([buffer], 'sample.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const markdown = await converter.convert(file);

      // Should have separator row
      const lines = markdown.split('\n');
      const tableLines = lines.filter(line => line.includes('|'));

      // Second row (after header) should be separator
      expect(tableLines.length).toBeGreaterThan(1);
      expect(tableLines[1]).toMatch(/^\| --- \|/);
    });
  });
});
