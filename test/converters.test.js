/**
 * Comprehensive test suite for file converters
 * Tests all supported file formats: PDF, DOCX, Excel, CSV, TXT
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { access } from 'fs/promises';
import { constants } from 'fs';

// Test logger for consistent output
import { createTestLogger } from './helpers/testLogger.js';
const log = createTestLogger('converters');

// Import converters (from dist/ - TypeScript compiled output)
import { PdfToMarkdown } from '../dist/converters/PdfToMarkdown.js';
import { DocxToMarkdown } from '../dist/converters/DocxToMarkdown.js';
import { ExcelToMarkdown } from '../dist/converters/ExcelToMarkdown.js';
import { CsvToMarkdown } from '../dist/converters/CsvToMarkdown.js';
import { TextToMarkdown } from '../dist/converters/TextToMarkdown.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, 'data');

describe('File Format Converters', () => {
  describe('PDF Converter', () => {
    it('should convert PDF to markdown', async function() {
      this.timeout(10000); // PDF parsing can take time

      const pdfPath = join(dataDir, 'sample-w3c.pdf');
      const converter = new PdfToMarkdown();

      try {
        await access(pdfPath, constants.R_OK);
        const markdown = await converter.convert(pdfPath);

        // Verify markdown output
        expect(markdown).to.be.a('string');
        expect(markdown.length).to.be.greaterThan(0);

        // Check for frontmatter
        expect(markdown).to.match(/^---\n/);
        expect(markdown).to.include('source:');
        expect(markdown).to.include('sourceFormat: pdf');
        expect(markdown).to.include('anonymised: true');

      } catch (error) {
        if (error.code === 'ENOENT') {
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it('should validate generated markdown', async function() {
      this.timeout(10000);

      const pdfPath = join(dataDir, 'sample-w3c.pdf');
      const converter = new PdfToMarkdown();

      try {
        await access(pdfPath, constants.R_OK);
        const markdown = await converter.convert(pdfPath);
        const validation = await converter.validateMarkdown(markdown);

        expect(validation.valid).to.be.true;
      } catch (error) {
        if (error.code === 'ENOENT') {
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it('should correctly extract text content from PDF', async function() {
      this.timeout(10000);

      const pdfPath = join(dataDir, 'sample-w3c.pdf');
      const converter = new PdfToMarkdown();

      try {
        await access(pdfPath, constants.R_OK);
        const markdown = await converter.convert(pdfPath);

        // Verify content extraction - W3C dummy PDF has "Dummy PDF file"
        expect(markdown).to.be.a('string');
        expect(markdown.length).to.be.greaterThan(0);
        expect(markdown).to.include('Dummy PDF');
      } catch (error) {
        if (error.code === 'ENOENT') {
          this.skip();
        } else {
          throw error;
        }
      }
    });
  });

  describe('Text Converter', () => {
    it('should convert TXT to markdown', async function() {
      this.timeout(5000);

      const txtPath = join(dataDir, 'sample.txt');
      const converter = new TextToMarkdown();

      try {
        await access(txtPath, constants.R_OK);
        const markdown = await converter.convert(txtPath);

        // Verify markdown output
        expect(markdown).to.be.a('string');
        expect(markdown.length).to.be.greaterThan(0);

        // Check for frontmatter
        expect(markdown).to.match(/^---\n/);
        expect(markdown).to.include('source:');
        expect(markdown).to.include('sourceFormat: txt');

        // Check content is preserved
        expect(markdown).to.include('Sample Text Document');

      } catch (error) {
        if (error.code === 'ENOENT') {
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it('should preserve line breaks and structure', async function() {
      this.timeout(5000);

      const txtPath = join(dataDir, 'sample.txt');
      const converter = new TextToMarkdown();

      try {
        await access(txtPath, constants.R_OK);
        const markdown = await converter.convert(txtPath);

        // Check structure preservation
        expect(markdown).to.include('Contact Information:');
        expect(markdown).to.include('Additional Information:');

      } catch (error) {
        if (error.code === 'ENOENT') {
          this.skip();
        } else {
          throw error;
        }
      }
    });
  });

  describe('CSV Converter', () => {
    it('should convert CSV to markdown table', async function() {
      this.timeout(5000);

      const csvPath = join(dataDir, 'sample.csv');
      const converter = new CsvToMarkdown();

      try {
        await access(csvPath, constants.R_OK);
        const markdown = await converter.convert(csvPath);

        // Verify markdown output
        expect(markdown).to.be.a('string');
        expect(markdown.length).to.be.greaterThan(0);

        // Check for frontmatter
        expect(markdown).to.match(/^---\n/);
        expect(markdown).to.include('sourceFormat: csv');

        // Check for markdown table
        expect(markdown).to.include('|');
        expect(markdown).to.include('Name');
        expect(markdown).to.include('Email');

      } catch (error) {
        if (error.code === 'ENOENT') {
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it('should include all rows from CSV', async function() {
      this.timeout(5000);

      const csvPath = join(dataDir, 'sample.csv');
      const converter = new CsvToMarkdown();

      try {
        await access(csvPath, constants.R_OK);
        const markdown = await converter.convert(csvPath);

        // Check for data rows
        expect(markdown).to.include('John Doe');
        expect(markdown).to.include('Jane Smith');
        expect(markdown).to.include('Bob Johnson');

      } catch (error) {
        if (error.code === 'ENOENT') {
          this.skip();
        } else {
          throw error;
        }
      }
    });
  });

  describe('Excel Converter', () => {
    it('should convert Excel to markdown', async function() {
      this.timeout(10000);

      const excelPath = join(dataDir, 'sample.xlsx');
      const converter = new ExcelToMarkdown();

      try {
        await access(excelPath, constants.R_OK);
        const markdown = await converter.convert(excelPath);

        // Verify markdown output
        expect(markdown).to.be.a('string');
        expect(markdown.length).to.be.greaterThan(0);

        // Check for frontmatter
        expect(markdown).to.match(/^---\n/);
        expect(markdown).to.include('sourceFormat: xlsx');

        // Check for markdown table
        expect(markdown).to.include('|');

      } catch (error) {
        if (error.code === 'ENOENT') {
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it('should handle multiple sheets', async function() {
      this.timeout(10000);

      const excelPath = join(dataDir, 'sample.xlsx');
      const converter = new ExcelToMarkdown();

      try {
        await access(excelPath, constants.R_OK);
        const markdown = await converter.convert(excelPath);

        // Check for sheet metadata
        expect(markdown).to.include('sheetCount:');

      } catch (error) {
        if (error.code === 'ENOENT') {
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it('should correctly extract data from Excel', async function() {
      this.timeout(10000);

      const excelPath = join(dataDir, 'sample.xlsx');
      const converter = new ExcelToMarkdown();

      try {
        await access(excelPath, constants.R_OK);
        const markdown = await converter.convert(excelPath);

        // Verify content extraction
        expect(markdown).to.include('Name');
        expect(markdown).to.include('Email');
        expect(markdown).to.include('Phone');
        expect(markdown).to.include('Address');
        expect(markdown).to.include('John Doe');
        expect(markdown).to.include('Jane Smith');
        expect(markdown).to.include('Bob Johnson');
        expect(markdown).to.include('john.doe@example.com');
      } catch (error) {
        if (error.code === 'ENOENT') {
          this.skip();
        } else {
          throw error;
        }
      }
    });
  });

  describe('DOCX Converter', () => {
    it('should convert DOCX to markdown', async function() {
      this.timeout(10000);

      const docxPath = join(dataDir, 'sample.docx');
      const converter = new DocxToMarkdown();

      try {
        await access(docxPath, constants.R_OK);
        const markdown = await converter.convert(docxPath);

        // Verify markdown output
        expect(markdown).to.be.a('string');
        expect(markdown.length).to.be.greaterThan(0);

        // Check for frontmatter
        expect(markdown).to.match(/^---\n/);
        expect(markdown).to.include('sourceFormat: docx');

      } catch (error) {
        if (error.code === 'ENOENT') {
          log.debug('DOCX test file not found - create sample.docx to enable this test');
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it('should correctly extract content from DOCX', async function() {
      this.timeout(10000);

      const docxPath = join(dataDir, 'sample.docx');
      const converter = new DocxToMarkdown();

      try {
        await access(docxPath, constants.R_OK);
        const markdown = await converter.convert(docxPath);

        // Verify content extraction
        expect(markdown).to.include('Sample Document');
        expect(markdown).to.include('Contact Information');
        expect(markdown).to.include('John Doe');
        expect(markdown).to.include('john.doe@example.com');
        expect(markdown).to.include('+41 79 123 45 67');
        expect(markdown).to.include('Personal Information');
        expect(markdown).to.include('756.1234.5678.90');
      } catch (error) {
        if (error.code === 'ENOENT') {
          this.skip();
        } else {
          throw error;
        }
      }
    });
  });

  describe('Markdown Validation', () => {
    it('should validate well-formed markdown', async function() {
      const converter = new TextToMarkdown();
      const markdown = '# Heading\n\nSome **bold** text and _italic_ text.\n\n- List item 1\n- List item 2';

      const validation = await converter.validateMarkdown(markdown);
      expect(validation.valid).to.be.true;
    });

    it('should handle frontmatter in validation', async function() {
      const converter = new TextToMarkdown();
      const markdown = '---\nsource: test.txt\n---\n\n# Content';

      const validation = await converter.validateMarkdown(markdown);
      expect(validation.valid).to.be.true;
    });
  });

  describe('Common Converter Features', () => {
    it('should include metadata in frontmatter', async function() {
      const txtPath = join(dataDir, 'sample.txt');
      const converter = new TextToMarkdown();

      try {
        await access(txtPath, constants.R_OK);
        const markdown = await converter.convert(txtPath);

        expect(markdown).to.include('processed:');
        expect(markdown).to.include('piiModel:');

      } catch (error) {
        if (error.code === 'ENOENT') {
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it('should sanitize filenames in frontmatter', async function() {
      const converter = new TextToMarkdown();
      const sanitized = converter.sanitizeFilename('test:file"name.txt');

      expect(sanitized).to.not.include(':');
      expect(sanitized).to.not.include('"');
    });

    it('should create proper markdown tables', async function() {
      const converter = new TextToMarkdown();
      const headers = ['Name', 'Age', 'City'];
      const rows = [
        ['Alice', '30', 'Zurich'],
        ['Bob', '25', 'Geneva'],
      ];

      const table = converter.createTable(headers, rows);

      expect(table).to.include('| Name | Age | City |');
      expect(table).to.include('| --- | --- | --- |');
      expect(table).to.include('| Alice | 30 | Zurich |');
    });

    it('should escape special characters in table cells', async function() {
      const converter = new TextToMarkdown();
      const escaped = converter.escapeTableCell('Text | with | pipes');

      expect(escaped).to.include('\\|');
      expect(escaped).to.not.match(/[^\\]\|/);
    });

    it('should create proper headings', async function() {
      const converter = new TextToMarkdown();

      const h1 = converter.normalizeHeading('Title', 1);
      const h2 = converter.normalizeHeading('Subtitle', 2);

      expect(h1).to.equal('# Title\n\n');
      expect(h2).to.equal('## Subtitle\n\n');
    });

    it('should handle various markdown elements', async function() {
      const converter = new TextToMarkdown();

      expect(converter.createCodeBlock('const x = 1', 'js')).to.include('```js');
      expect(converter.createInlineCode('code')).to.equal('`code`');
      expect(converter.createStrong('bold')).to.equal('**bold**');
      expect(converter.createEmphasis('italic')).to.equal('_italic_');
      expect(converter.createLink('text', 'url')).to.equal('[text](url)');
    });
  });
});
