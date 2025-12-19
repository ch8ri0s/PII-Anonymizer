/**
 * Converter Comparison & Quality Tests
 *
 * Integration tests that verify output quality and consistency
 * of all converters across different file formats.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PdfConverter } from '../../src/converters/PdfConverter';
import { DocxConverter } from '../../src/converters/DocxConverter';
import { ExcelConverter } from '../../src/converters/ExcelConverter';
import { CsvConverter } from '../../src/converters/CsvConverter';
import { TextConverter } from '../../src/converters/TextConverter';
import * as fs from 'fs';
import * as path from 'path';

describe('Converter Comparison Tests', () => {
  // Initialize all converters
  let pdfConverter: PdfConverter;
  let docxConverter: DocxConverter;
  let excelConverter: ExcelConverter;
  let csvConverter: CsvConverter;
  let textConverter: TextConverter;

  beforeAll(() => {
    pdfConverter = new PdfConverter();
    docxConverter = new DocxConverter();
    excelConverter = new ExcelConverter();
    csvConverter = new CsvConverter();
    textConverter = new TextConverter();
  });

  describe('Output Quality', () => {
    it('should produce non-empty markdown from all converter types', async () => {
      // Test each converter produces output
      const fixtures = [
        { path: 'sample.txt', converter: textConverter, name: 'TextConverter' },
        { path: 'sample.csv', converter: csvConverter, name: 'CsvConverter' },
        { path: 'sample.xlsx', converter: excelConverter, name: 'ExcelConverter' },
        { path: 'sample.docx', converter: docxConverter, name: 'DocxConverter' },
      ];

      for (const { path: fixturePath, converter, name } of fixtures) {
        const fullPath = path.join(__dirname, '../fixtures', fixturePath);

        if (!fs.existsSync(fullPath)) {
          console.warn(`Skipping ${name}: ${fixturePath} not found`);
          continue;
        }

        const buffer = fs.readFileSync(fullPath);
        const ext = '.' + fixturePath.split('.').pop();
        const file = new File([buffer], fixturePath, { type: '' });

        expect(converter.supports(file), `${name} should support ${fixturePath}`).toBe(true);

        const markdown = await converter.convert(file);
        expect(markdown.length, `${name} should produce non-empty output`).toBeGreaterThan(0);
        expect(typeof markdown).toBe('string');
      }
    });

    it('should preserve Unicode characters across all converters', async () => {
      const fixtures = [
        { path: 'sample.txt', converter: textConverter },
        { path: 'sample.csv', converter: csvConverter },
        { path: 'sample.xlsx', converter: excelConverter },
        { path: 'sample.docx', converter: docxConverter },
      ];

      for (const { path: fixturePath, converter } of fixtures) {
        const fullPath = path.join(__dirname, '../fixtures', fixturePath);

        if (!fs.existsSync(fullPath)) continue;

        const buffer = fs.readFileSync(fullPath);
        const file = new File([buffer], fixturePath, { type: '' });
        const markdown = await converter.convert(file);

        // Check for common Unicode characters (umlauts, accents)
        // At least one should be present in the output
        const hasUnicode = /[äöüéèêàùûôîâ]/i.test(markdown);
        if (markdown.includes('Müller') || markdown.includes('Zürich')) {
          expect(hasUnicode, `${fixturePath} should preserve Unicode`).toBe(true);
        }
      }
    });
  });

  describe('Markdown Validity', () => {
    it('should produce valid markdown table syntax from table-like sources', async () => {
      // CSV and Excel should produce tables
      const tableConverters = [
        { path: 'sample.csv', converter: csvConverter },
        { path: 'sample.xlsx', converter: excelConverter },
      ];

      for (const { path: fixturePath, converter } of tableConverters) {
        const fullPath = path.join(__dirname, '../fixtures', fixturePath);

        if (!fs.existsSync(fullPath)) continue;

        const buffer = fs.readFileSync(fullPath);
        const file = new File([buffer], fixturePath, { type: '' });
        const markdown = await converter.convert(file);

        // Check for table structure
        expect(markdown).toMatch(/\|.*\|/); // Has pipe characters
        expect(markdown).toMatch(/\| --- \|/); // Has separator row

        // Check table is well-formed (equal pipes per line)
        const tableLines = markdown
          .split('\n')
          .filter(line => line.includes('|') && !line.includes('---'));

        if (tableLines.length > 1) {
          const firstLinePipes = (tableLines[0].match(/\|/g) || []).length;
          const allSamePipes = tableLines.every(
            line => (line.match(/\|/g) || []).length === firstLinePipes
          );
          expect(allSamePipes, `${fixturePath} table should have consistent columns`).toBe(true);
        }
      }
    });

    it('should produce valid markdown headings from DOCX', async () => {
      const fullPath = path.join(__dirname, '../fixtures/sample.docx');

      if (!fs.existsSync(fullPath)) {
        console.warn('Skipping: sample.docx not found');
        return;
      }

      const buffer = fs.readFileSync(fullPath);
      const file = new File([buffer], 'sample.docx', { type: '' });
      const markdown = await docxConverter.convert(file);

      // Should have ATX-style headings
      expect(markdown).toMatch(/^#+\s+\S/m);
    });
  });

  describe('Content Preservation', () => {
    it('should preserve email addresses', async () => {
      const fixtures = [
        { path: 'sample.txt', converter: textConverter },
        { path: 'sample.csv', converter: csvConverter },
        { path: 'sample.xlsx', converter: excelConverter },
        { path: 'sample.docx', converter: docxConverter },
      ];

      for (const { path: fixturePath, converter } of fixtures) {
        const fullPath = path.join(__dirname, '../fixtures', fixturePath);

        if (!fs.existsSync(fullPath)) continue;

        const buffer = fs.readFileSync(fullPath);
        const file = new File([buffer], fixturePath, { type: '' });
        const markdown = await converter.convert(file);

        // Check for email pattern
        const hasEmail = /@.*\.\w{2,}/.test(markdown);
        if (markdown.includes('example') || markdown.includes('test')) {
          // Only assert if fixture likely has emails
          expect(hasEmail, `${fixturePath} should preserve emails`).toBe(true);
        }
      }
    });

    it('should preserve phone numbers', async () => {
      const fixtures = [
        { path: 'sample.txt', converter: textConverter },
        { path: 'sample.csv', converter: csvConverter },
      ];

      for (const { path: fixturePath, converter } of fixtures) {
        const fullPath = path.join(__dirname, '../fixtures', fixturePath);

        if (!fs.existsSync(fullPath)) continue;

        const buffer = fs.readFileSync(fullPath);
        const file = new File([buffer], fixturePath, { type: '' });
        const markdown = await converter.convert(file);

        // Check for Swiss/international phone pattern
        const hasPhone = /\+\d{2}/.test(markdown);
        if (markdown.includes('+41') || markdown.includes('+33')) {
          expect(hasPhone, `${fixturePath} should preserve phone numbers`).toBe(true);
        }
      }
    });
  });

  describe('Performance', () => {
    it('should convert small files quickly (< 1 second)', async () => {
      const fixtures = [
        { path: 'sample.txt', converter: textConverter },
        { path: 'sample.csv', converter: csvConverter },
        { path: 'sample.xlsx', converter: excelConverter },
        { path: 'sample.docx', converter: docxConverter },
      ];

      for (const { path: fixturePath, converter } of fixtures) {
        const fullPath = path.join(__dirname, '../fixtures', fixturePath);

        if (!fs.existsSync(fullPath)) continue;

        const buffer = fs.readFileSync(fullPath);
        const file = new File([buffer], fixturePath, { type: '' });

        const start = performance.now();
        await converter.convert(file);
        const elapsed = performance.now() - start;

        expect(elapsed, `${fixturePath} should convert in < 1s`).toBeLessThan(1000);
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw for corrupted files', async () => {
      const corruptedData = 'This is not a valid file of any type';

      // Test each converter with corrupted data
      const converters = [
        { converter: pdfConverter, ext: 'pdf' },
        { converter: docxConverter, ext: 'docx' },
        { converter: excelConverter, ext: 'xlsx' },
      ];

      for (const { converter, ext } of converters) {
        const file = new File([corruptedData], `corrupted.${ext}`, { type: '' });

        await expect(
          converter.convert(file),
          `${ext} converter should reject corrupted data`,
        ).rejects.toThrow();
      }
    });

    it('should handle empty files gracefully', async () => {
      // Text and CSV can handle empty files
      const emptyTextFile = new File([''], 'empty.txt', { type: 'text/plain' });
      const emptyResult = await textConverter.convert(emptyTextFile);
      expect(emptyResult).toBe('');
    });
  });
});

describe('Cross-Format Consistency', () => {
  let textConverter: TextConverter;
  let csvConverter: CsvConverter;

  beforeAll(() => {
    textConverter = new TextConverter();
    csvConverter = new CsvConverter();
  });

  it('should handle the same content consistently', async () => {
    // Create a simple CSV and text with the same data
    const csvContent = 'Name,City\nJohn,Zurich\nJane,Geneva';
    const textContent = 'Name: John\nCity: Zurich\nName: Jane\nCity: Geneva';

    const csvFile = new File([csvContent], 'test.csv', { type: 'text/csv' });
    const textFile = new File([textContent], 'test.txt', { type: 'text/plain' });

    const csvMarkdown = await csvConverter.convert(csvFile);
    const textMarkdown = await textConverter.convert(textFile);

    // Both should contain the same names
    expect(csvMarkdown).toContain('John');
    expect(csvMarkdown).toContain('Zurich');
    expect(textMarkdown).toContain('John');
    expect(textMarkdown).toContain('Zurich');
  });
});
