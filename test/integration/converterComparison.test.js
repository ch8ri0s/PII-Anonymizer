/**
 * Converter Comparison & Quality Tests (Electron)
 *
 * Integration tests that verify output quality and consistency
 * of all converters across different file formats.
 *
 * Harmonized with browser-app/test/integration/converterComparison.test.ts
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Test logger for consistent output
import { createTestLogger } from '../helpers/testLogger.js';
const log = createTestLogger('integration:converter');

// Import converters
import PdfToMarkdown from '../../dist/converters/PdfToMarkdown.js';
import DocxToMarkdown from '../../dist/converters/DocxToMarkdown.js';
import ExcelToMarkdown from '../../dist/converters/ExcelToMarkdown.js';
import CsvToMarkdown from '../../dist/converters/CsvToMarkdown.js';
import TextToMarkdown from '../../dist/converters/TextToMarkdown.js';

// Import expected results from shared test utilities
import {
  TEST_DOCUMENTS,
  getExpectedResults as _getExpectedResults,
} from '../../shared/dist/test/expectedResults.js';
import { PERFORMANCE_THRESHOLDS } from '../../shared/dist/test/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_FILES_DIR = path.join(__dirname, '../.files');
const _FIXTURES_DIR = path.join(__dirname, '../fixtures');

function getAvailableTestFiles() {
  if (!fs.existsSync(TEST_FILES_DIR)) {
    return [];
  }
  return fs.readdirSync(TEST_FILES_DIR).filter(f => !f.startsWith('.'));
}

describe('Converter Comparison Tests (Electron)', function () {
  this.timeout(30000);

  let pdfConverter;
  let docxConverter;
  let excelConverter;
  let _csvConverter;
  let _textConverter;

  const testFiles = getAvailableTestFiles();

  before(function () {
    pdfConverter = new PdfToMarkdown();
    docxConverter = new DocxToMarkdown();
    excelConverter = new ExcelToMarkdown();
    _csvConverter = new CsvToMarkdown();
    _textConverter = new TextToMarkdown();

    if (testFiles.length === 0) {
      log.warn('No test files found in test/.files/ - some tests will be skipped');
    }
  });

  describe('Output Quality', function () {
    it('should produce non-empty markdown from all converter types', async function () {
      const fixtures = [
        { file: testFiles.find(f => f.endsWith('.pdf')), converter: pdfConverter, name: 'PdfToMarkdown' },
        { file: testFiles.find(f => f.endsWith('.docx')), converter: docxConverter, name: 'DocxToMarkdown' },
        { file: testFiles.find(f => f.endsWith('.xlsx')), converter: excelConverter, name: 'ExcelToMarkdown' },
      ];

      for (const { file, converter, name } of fixtures) {
        if (!file) {
          log.debug('Skipping converter - no test file found', { converter: name });
          continue;
        }

        const filePath = path.join(TEST_FILES_DIR, file);
        const markdown = await converter.convert(filePath);

        expect(markdown, `${name} should produce output`).to.be.a('string');
        expect(markdown.length, `${name} should produce non-empty output`).to.be.greaterThan(0);

        log.debug('Converter produced output', { converter: name, file, chars: markdown.length });
      }
    });

    it('should preserve Unicode characters across all converters', async function () {
      const fixtures = [
        { file: testFiles.find(f => f.endsWith('.pdf')), converter: pdfConverter },
        { file: testFiles.find(f => f.endsWith('.docx')), converter: docxConverter },
        { file: testFiles.find(f => f.endsWith('.xlsx')), converter: excelConverter },
      ];

      for (const { file, converter } of fixtures) {
        if (!file) continue;

        const filePath = path.join(TEST_FILES_DIR, file);
        const markdown = await converter.convert(filePath);

        // Check for common French/German Unicode characters
        const hasUnicode = /[äöüéèêàùûôîâç]/i.test(markdown);
        if (markdown.includes('Fribourg') || markdown.includes('Zürich')) {
          expect(hasUnicode, `${file} should preserve Unicode`).to.be.true;
        }
      }
    });
  });

  describe('Markdown Validity', function () {
    it('should produce valid markdown table syntax from Excel', async function () {
      const xlsxFile = testFiles.find(f => f.endsWith('.xlsx'));
      if (!xlsxFile) {
        this.skip();
        return;
      }

      const filePath = path.join(TEST_FILES_DIR, xlsxFile);
      const markdown = await excelConverter.convert(filePath);

      // Check for table structure
      expect(markdown).to.match(/\|.*\|/);
      expect(markdown).to.match(/\|[\s-]+\|/); // Separator row

      // Check table is well-formed
      const tableLines = markdown
        .split('\n')
        .filter(line => line.includes('|') && !line.includes('---'));

      if (tableLines.length > 1) {
        const firstLinePipes = (tableLines[0].match(/\|/g) || []).length;
        const allSamePipes = tableLines.every(
          line => (line.match(/\|/g) || []).length === firstLinePipes,
        );
        expect(allSamePipes, 'Table should have consistent columns').to.be.true;
      }

      log.debug('Valid table structure', { file: xlsxFile });
    });

    it('should produce valid markdown from DOCX', async function () {
      const docxFile = testFiles.find(f => f.endsWith('.docx'));
      if (!docxFile) {
        this.skip();
        return;
      }

      const filePath = path.join(TEST_FILES_DIR, docxFile);
      const markdown = await docxConverter.convert(filePath);

      // Should not contain raw HTML or XML
      expect(markdown).to.not.include('<html>');
      expect(markdown).to.not.include('<?xml');

      log.debug('Valid markdown (no raw HTML/XML)', { file: docxFile });
    });
  });

  describe('Content Preservation', function () {
    it('should preserve addresses in documents', async function () {
      const pdfFile = testFiles.find(f => f.includes('invoice') && f.endsWith('.pdf'));
      if (!pdfFile) {
        this.skip();
        return;
      }

      const filePath = path.join(TEST_FILES_DIR, pdfFile);
      const markdown = await pdfConverter.convert(filePath);

      // Should contain Swiss address patterns
      const hasAddress = /\d{4}\s+[A-Za-zÀ-ÿ]+/.test(markdown); // Swiss postal code pattern
      expect(hasAddress, `${pdfFile} should preserve address patterns`).to.be.true;

      log.debug('Addresses preserved', { file: pdfFile });
    });

    it('should preserve phone numbers in documents', async function () {
      const pdfFile = testFiles.find(f => f.endsWith('.pdf'));
      if (!pdfFile) {
        this.skip();
        return;
      }

      const filePath = path.join(TEST_FILES_DIR, pdfFile);
      const markdown = await pdfConverter.convert(filePath);

      // Check for Swiss phone pattern
      const hasPhone = /\+41\s*\d{2}\s*\d{3}\s*\d{2}\s*\d{2}/.test(markdown);
      if (markdown.includes('+41')) {
        expect(hasPhone, `${pdfFile} should preserve phone numbers`).to.be.true;
        log.debug('Phone numbers preserved', { file: pdfFile });
      }
    });

    it('should preserve dates in documents', async function () {
      const pdfFile = testFiles.find(f => f.endsWith('.pdf'));
      if (!pdfFile) {
        this.skip();
        return;
      }

      const filePath = path.join(TEST_FILES_DIR, pdfFile);
      const markdown = await pdfConverter.convert(filePath);

      // Check for date patterns (DD.MM.YYYY or similar)
      const hasDate = /\d{2}[./-]\d{2}[./-]\d{4}/.test(markdown);
      expect(hasDate, `${pdfFile} should preserve dates`).to.be.true;

      log.debug('Dates preserved', { file: pdfFile });
    });
  });

  describe('Performance', function () {
    it('should convert files within acceptable time', async function () {
      const fixtures = [
        { file: testFiles.find(f => f.endsWith('.pdf')), converter: pdfConverter, name: 'PDF' },
        { file: testFiles.find(f => f.endsWith('.docx')), converter: docxConverter, name: 'DOCX' },
        { file: testFiles.find(f => f.endsWith('.xlsx')), converter: excelConverter, name: 'Excel' },
      ];

      for (const { file, converter, name } of fixtures) {
        if (!file) continue;

        const filePath = path.join(TEST_FILES_DIR, file);
        const start = Date.now();
        await converter.convert(filePath);
        const elapsed = Date.now() - start;

        const fileSize = fs.statSync(filePath).size / 1024;

        log.debug('Converter performance', { converter: name, file, sizeKB: fileSize.toFixed(1), elapsedMs: elapsed });

        expect(elapsed, `${name} should convert in < 10s`).to.be.lessThan(
          PERFORMANCE_THRESHOLDS.maxProcessingTimeMs,
        );
      }
    });
  });

  describe('Error Handling', function () {
    it('should throw for corrupted files', async function () {
      const corruptedData = 'This is not a valid file of any type';

      // Test PDF converter
      const tempPdf = path.join(__dirname, 'temp-corrupted.pdf');
      fs.writeFileSync(tempPdf, corruptedData);

      try {
        await pdfConverter.convert(tempPdf);
        expect.fail('Should have thrown for corrupted PDF');
      } catch (error) {
        expect(error).to.be.an('error');
      } finally {
        fs.unlinkSync(tempPdf);
      }
    });
  });

  describe('Expected Results Verification', function () {
    it('should match expected document characteristics', async function () {
      for (const [filename, expected] of Object.entries(TEST_DOCUMENTS)) {
        if (!testFiles.includes(filename)) continue;

        const filePath = path.join(TEST_FILES_DIR, filename);
        let converter;

        if (filename.endsWith('.pdf')) {
          converter = pdfConverter;
        } else if (filename.endsWith('.docx')) {
          converter = docxConverter;
        } else if (filename.endsWith('.xlsx')) {
          converter = excelConverter;
        } else {
          continue;
        }

        const markdown = await converter.convert(filePath);

        log.debug('Document characteristics', {
          filename,
          language: expected.language,
          category: expected.category,
          markdownLength: markdown.length,
        });

        expect(markdown.length, `${filename} should produce substantial markdown`).to.be.greaterThan(100);
      }
    });
  });
});

describe('Cross-Format Consistency', function () {
  this.timeout(15000);

  let csvConverter;
  let textConverter;

  before(function () {
    csvConverter = new CsvToMarkdown();
    textConverter = new TextToMarkdown();
  });

  it('should handle the same content consistently', async function () {
    // Create test content
    const csvContent = 'Name,City\nJohn,Zurich\nJane,Geneva';
    const textContent = 'Name: John\nCity: Zurich\nName: Jane\nCity: Geneva';

    const tempCsv = path.join(__dirname, 'temp-test.csv');
    const tempTxt = path.join(__dirname, 'temp-test.txt');

    fs.writeFileSync(tempCsv, csvContent);
    fs.writeFileSync(tempTxt, textContent);

    try {
      const csvMarkdown = await csvConverter.convert(tempCsv);
      const textMarkdown = await textConverter.convert(tempTxt);

      // Both should contain the same names
      expect(csvMarkdown).to.include('John');
      expect(csvMarkdown).to.include('Zurich');
      expect(textMarkdown).to.include('John');
      expect(textMarkdown).to.include('Zurich');
    } finally {
      fs.unlinkSync(tempCsv);
      fs.unlinkSync(tempTxt);
    }
  });
});
