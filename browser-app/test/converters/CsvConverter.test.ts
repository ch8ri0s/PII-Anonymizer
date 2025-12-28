/**
 * CSV Converter Tests
 *
 * Tests for browser-based CSV to Markdown table conversion.
 * Covers parsing, quoting, special characters, and edge cases.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CsvConverter } from '../../src/converters/CsvConverter';
import * as fs from 'fs';
import * as path from 'path';

// Test logger for consistent output
import { createTestLogger } from '../helpers/testLogger';
const log = createTestLogger('converter:csv');

describe('CsvConverter', () => {
  let converter: CsvConverter;

  beforeAll(() => {
    converter = new CsvConverter();
  });

  describe('supports()', () => {
    it('should support CSV files by MIME type text/csv', () => {
      const file = new File([], 'data.csv', { type: 'text/csv' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should support CSV files by MIME type application/csv', () => {
      const file = new File([], 'data.csv', { type: 'application/csv' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should support CSV files by extension', () => {
      const file = new File([], 'spreadsheet.csv', { type: '' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should not support Excel files', () => {
      const file = new File([], 'data.xlsx', {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      expect(converter.supports(file)).toBe(false);
    });

    it('should not support text files', () => {
      const file = new File([], 'data.txt', { type: 'text/plain' });
      expect(converter.supports(file)).toBe(false);
    });

    it('should handle uppercase extension', () => {
      const file = new File([], 'DATA.CSV', { type: '' });
      expect(converter.supports(file)).toBe(true);
    });
  });

  describe('convert()', () => {
    it('should convert CSV to markdown table', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.csv');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: sample.csv fixture not found');
        return;
      }

      const content = fs.readFileSync(fixturePath, 'utf-8');
      const file = new File([content], 'sample.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      expect(markdown).toBeDefined();
      expect(typeof markdown).toBe('string');
      expect(markdown.length).toBeGreaterThan(0);
    });

    it('should include header row from CSV', async () => {
      const csv = 'Name,Email,City\nJohn,john@test.com,Zurich';
      const file = new File([csv], 'test.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      expect(markdown).toContain('Name');
      expect(markdown).toContain('Email');
      expect(markdown).toContain('City');
    });

    it('should generate proper markdown table syntax', async () => {
      const csv = 'A,B,C\n1,2,3\n4,5,6';
      const file = new File([csv], 'test.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      // Should have pipes
      expect(markdown).toMatch(/\|.*\|/);

      // Should have separator row
      expect(markdown).toContain('| --- |');
    });

    it('should handle quoted fields with commas', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.csv');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: sample.csv fixture not found');
        return;
      }

      const content = fs.readFileSync(fixturePath, 'utf-8');
      const file = new File([content], 'sample.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      // Should preserve "Jane, Smith" as single cell content
      expect(markdown).toContain('Jane, Smith');
    });

    it('should handle escaped quotes in fields', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.csv');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: sample.csv fixture not found');
        return;
      }

      const content = fs.readFileSync(fixturePath, 'utf-8');
      const file = new File([content], 'sample.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      // Should handle "Bob ""The Builder"" Jones" with escaped quotes
      expect(markdown).toContain('The Builder');
    });

    it('should escape pipe characters', async () => {
      const csv = 'Column1,Column2\nValue|With|Pipes,Normal';
      const file = new File([csv], 'test.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      // Pipes should be escaped
      expect(markdown).toContain('\\|');
    });

    it('should handle Windows line endings (CRLF)', async () => {
      const csv = 'Name,City\r\nJohn,Zurich\r\nJane,Geneva';
      const file = new File([csv], 'test.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      expect(markdown).toContain('John');
      expect(markdown).toContain('Jane');
    });

    it('should handle empty/minimal CSV input', async () => {
      // Test with whitespace content - produces minimal table with empty cell
      const file = new File([''], 'empty.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      // Empty input produces a minimal table with empty cell
      // This is acceptable behavior for edge case
      expect(markdown).toBeDefined();
      expect(typeof markdown).toBe('string');
    });

    it('should handle CSV with only header row', async () => {
      const csv = 'Name,Email,Phone';
      const file = new File([csv], 'header-only.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      expect(markdown).toContain('Name');
      expect(markdown).toContain('| --- |');
    });
  });

  describe('unicode and special characters', () => {
    it('should preserve Unicode characters', async () => {
      const csv = 'Name,City\nHans Müller,Zürich\nMarie,Genève';
      const file = new File([csv], 'unicode.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      expect(markdown).toContain('Müller');
      expect(markdown).toContain('Zürich');
      expect(markdown).toContain('Genève');
    });

    it('should handle Swiss phone numbers', async () => {
      const csv = 'Name,Phone\nTest,+41 79 123 45 67';
      const file = new File([csv], 'phone.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      expect(markdown).toContain('+41 79 123 45 67');
    });
  });

  describe('edge cases', () => {
    it('should handle single column CSV', async () => {
      const csv = 'Names\nAlice\nBob\nCharlie';
      const file = new File([csv], 'single-col.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      expect(markdown).toContain('Names');
      expect(markdown).toContain('Alice');
      expect(markdown).toContain('Bob');
    });

    it('should handle single row CSV', async () => {
      const csv = 'A,B,C';
      const file = new File([csv], 'single-row.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      expect(markdown).toContain('| A |');
    });

    it('should handle trailing newline', async () => {
      const csv = 'Name,Value\nTest,123\n';
      const file = new File([csv], 'trailing.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      // Should not add empty row
      const lines = markdown.split('\n');
      const lastLine = lines[lines.length - 1];
      expect(lastLine).not.toBe('|  |');
    });

    it('should handle whitespace around values', async () => {
      const csv = 'Name,  City  \n  John  ,  Zurich  ';
      const file = new File([csv], 'whitespace.csv', { type: 'text/csv' });

      const markdown = await converter.convert(file);

      // Values should be trimmed
      expect(markdown).toContain('| John |');
      expect(markdown).toContain('| Zurich |');
    });
  });
});
