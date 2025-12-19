/**
 * Unit Tests for PDF Table Detection
 *
 * Tests for TableDetector and TableToMarkdownConverter classes.
 * Following TDD red-green-refactor cycle.
 *
 * Test Coverage:
 * - Basic table detection (lattice method)
 * - Table validation (minimum 2x2, confidence thresholds)
 * - Error handling and graceful fallback
 * - Markdown conversion with proper formatting
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { TableDetector, TableToMarkdownConverter } from '../../dist/utils/pdfTableDetector.js';
import pdfTableFixtures from '../fixtures/pdfTables.js';

describe('TableDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new TableDetector();
  });

  describe('detectTables()', () => {
    // T020: Test simple bordered table detection (SC-001: 95%+ confidence)
    it('should detect simple bordered 3x3 table with 95%+ confidence', () => {
      const { items, expected } = pdfTableFixtures.simpleBorderedTable;
      const result = detector.detectTables(items);

      // Should detect exactly 1 table
      expect(result.tableCount).to.equal(expected.tableCount);
      expect(result.tables).to.have.lengthOf(expected.tableCount);

      // Should use lattice method
      expect(result.method).to.equal(expected.method);

      // Should have high confidence (SC-001)
      expect(result.confidence).to.be.at.least(0.95);

      // Should not fall back to text extraction
      expect(result.fallbackUsed).to.be.false;

      // Table structure validation
      const table = result.tables[0];
      expect(table.rows).to.have.lengthOf(expected.rows);
      expect(table.rows[0].cells).to.have.lengthOf(expected.columns);
    });

    // T021: Test table structure validation (FR-003)
    it('should validate table structure (min 2 rows, 2 columns)', () => {
      const { items } = pdfTableFixtures.simpleBorderedTable;
      const result = detector.detectTables(items);

      expect(result.tables).to.have.lengthOf.at.least(1);
      const table = result.tables[0];

      // Minimum 2 rows (FR-003)
      expect(table.rows.length).to.be.at.least(2);

      // Minimum 2 columns (FR-003)
      expect(table.rows[0].cells.length).to.be.at.least(2);

      // Confidence threshold (FR-003)
      expect(table.confidence).to.be.at.least(0.7);
    });

    // T022: Test graceful error handling (SC-008)
    it('should never throw exception, even on invalid input', () => {
      // Test with null input
      expect(() => detector.detectTables(null)).to.not.throw();
      const nullResult = detector.detectTables(null);
      expect(nullResult.fallbackUsed).to.be.true;

      // Test with undefined input
      expect(() => detector.detectTables(undefined)).to.not.throw();
      const undefinedResult = detector.detectTables(undefined);
      expect(undefinedResult.fallbackUsed).to.be.true;

      // Test with empty array
      expect(() => detector.detectTables([])).to.not.throw();
      const emptyResult = detector.detectTables([]);
      expect(emptyResult.fallbackUsed).to.be.true;

      // All should return valid DetectionResult objects
      expect(nullResult).to.have.property('tables');
      expect(nullResult).to.have.property('confidence');
      expect(nullResult).to.have.property('method');
      expect(nullResult).to.have.property('tableCount');
      expect(nullResult).to.have.property('warnings');
      expect(nullResult).to.have.property('fallbackUsed');
    });

    // T023: Test fallback for non-table content (FR-008)
    it('should set fallbackUsed: true for non-table content', () => {
      const { items, expected } = pdfTableFixtures.columnarText;
      const result = detector.detectTables(items);

      // Should detect no tables
      expect(result.tableCount).to.equal(expected.tableCount);
      expect(result.tables).to.have.lengthOf(0);

      // Should fall back to text extraction (FR-008)
      expect(result.fallbackUsed).to.equal(expected.fallbackUsed);

      // Should have warnings explaining why fallback was used
      expect(result.warnings).to.be.an('array').with.length.at.least(1);

      // Method should be 'none' when no detection method succeeded
      expect(result.method).to.equal(expected.method);
    });
  });

  describe('validateTable()', () => {
    it('should reject tables with < 2 rows', () => {
      const invalidTable = {
        page: 1,
        rows: [
          {
            cells: [
              { content: 'A', alignment: 'left', bbox: { x: 0, y: 0, width: 10, height: 10 }, isNumeric: false },
              { content: 'B', alignment: 'left', bbox: { x: 10, y: 0, width: 10, height: 10 }, isNumeric: false },
            ],
            isHeader: true,
            y: 100,
          },
        ],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        confidence: 0.9,
        method: 'lattice',
      };

      expect(detector.validateTable(invalidTable)).to.be.false;
    });

    it('should reject tables with < 2 columns', () => {
      const invalidTable = {
        page: 1,
        rows: [
          {
            cells: [{ content: 'A', alignment: 'left', bbox: { x: 0, y: 0, width: 10, height: 10 }, isNumeric: false }],
            isHeader: true,
            y: 100,
          },
          {
            cells: [{ content: 'B', alignment: 'left', bbox: { x: 0, y: 10, width: 10, height: 10 }, isNumeric: false }],
            isHeader: false,
            y: 90,
          },
        ],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        confidence: 0.9,
        method: 'lattice',
      };

      expect(detector.validateTable(invalidTable)).to.be.false;
    });

    it('should reject tables with confidence < 0.7', () => {
      const invalidTable = {
        page: 1,
        rows: [
          {
            cells: [
              { content: 'A', alignment: 'left', bbox: { x: 0, y: 0, width: 10, height: 10 }, isNumeric: false },
              { content: 'B', alignment: 'left', bbox: { x: 10, y: 0, width: 10, height: 10 }, isNumeric: false },
            ],
            isHeader: true,
            y: 100,
          },
          {
            cells: [
              { content: 'C', alignment: 'left', bbox: { x: 0, y: 10, width: 10, height: 10 }, isNumeric: false },
              { content: 'D', alignment: 'left', bbox: { x: 10, y: 10, width: 10, height: 10 }, isNumeric: false },
            ],
            isHeader: false,
            y: 90,
          },
        ],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        confidence: 0.6, // Below threshold
        method: 'lattice',
      };

      expect(detector.validateTable(invalidTable)).to.be.false;
    });

    it('should reject tables with inconsistent column counts', () => {
      const invalidTable = {
        page: 1,
        rows: [
          {
            cells: [
              { content: 'A', alignment: 'left', bbox: { x: 0, y: 0, width: 10, height: 10 }, isNumeric: false },
              { content: 'B', alignment: 'left', bbox: { x: 10, y: 0, width: 10, height: 10 }, isNumeric: false },
            ],
            isHeader: true,
            y: 100,
          },
          {
            cells: [
              { content: 'C', alignment: 'left', bbox: { x: 0, y: 10, width: 10, height: 10 }, isNumeric: false },
              { content: 'D', alignment: 'left', bbox: { x: 10, y: 10, width: 10, height: 10 }, isNumeric: false },
              { content: 'E', alignment: 'left', bbox: { x: 20, y: 10, width: 10, height: 10 }, isNumeric: false },
            ],
            isHeader: false,
            y: 90,
          },
        ],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        confidence: 0.9,
        method: 'lattice',
      };

      expect(detector.validateTable(invalidTable)).to.be.false;
    });

    it('should accept valid tables meeting all requirements', () => {
      const validTable = {
        page: 1,
        rows: [
          {
            cells: [
              { content: 'A', alignment: 'left', bbox: { x: 0, y: 0, width: 10, height: 10 }, isNumeric: false },
              { content: 'B', alignment: 'left', bbox: { x: 10, y: 0, width: 10, height: 10 }, isNumeric: false },
            ],
            isHeader: true,
            y: 100,
          },
          {
            cells: [
              { content: 'C', alignment: 'left', bbox: { x: 0, y: 10, width: 10, height: 10 }, isNumeric: false },
              { content: 'D', alignment: 'left', bbox: { x: 10, y: 10, width: 10, height: 10 }, isNumeric: false },
            ],
            isHeader: false,
            y: 90,
          },
        ],
        bbox: { x: 0, y: 0, width: 100, height: 100 },
        confidence: 0.95,
        method: 'lattice',
      };

      expect(detector.validateTable(validTable)).to.be.true;
    });
  });
});

describe('TableToMarkdownConverter', () => {
  let converter;

  beforeEach(() => {
    converter = new TableToMarkdownConverter();
  });

  describe('escapeCell() - T031', () => {
    it('should escape pipe characters', () => {
      const result = converter.escapeCell('A | B');
      expect(result).to.equal('A \\| B');
    });

    it('should escape backslashes before pipes', () => {
      const result = converter.escapeCell('A\\|B');
      expect(result).to.equal('A\\\\\\|B');
    });

    it('should replace newlines with spaces', () => {
      const result = converter.escapeCell('Line 1\nLine 2');
      expect(result).to.equal('Line 1 Line 2');
    });

    it('should trim whitespace', () => {
      const result = converter.escapeCell('  Content  ');
      expect(result).to.equal('Content');
    });

    it('should handle empty strings', () => {
      const result = converter.escapeCell('');
      expect(result).to.equal('');
    });

    it('should handle multiple special characters', () => {
      const result = converter.escapeCell('Path: C:\\folder | File\nNew line');
      expect(result).to.equal('Path: C:\\\\folder \\| File New line');
    });
  });

  describe('generateAlignmentRow() - T032', () => {
    it('should generate left alignment', () => {
      const cells = [
        { content: 'Text', alignment: 'left', bbox: { x: 0, y: 0, width: 50, height: 12 }, isNumeric: false },
      ];
      const result = converter.generateAlignmentRow(cells);
      expect(result).to.equal('| :--- |');
    });

    it('should generate right alignment for numeric columns', () => {
      const cells = [
        { content: '123', alignment: 'right', bbox: { x: 0, y: 0, width: 30, height: 12 }, isNumeric: true },
      ];
      const result = converter.generateAlignmentRow(cells);
      expect(result).to.equal('| ---: |');
    });

    it('should generate center alignment', () => {
      const cells = [
        { content: 'Center', alignment: 'center', bbox: { x: 0, y: 0, width: 50, height: 12 }, isNumeric: false },
      ];
      const result = converter.generateAlignmentRow(cells);
      expect(result).to.equal('| :---: |');
    });

    it('should generate mixed alignments (T033)', () => {
      const cells = [
        { content: 'Name', alignment: 'left', bbox: { x: 0, y: 0, width: 80, height: 12 }, isNumeric: false },
        { content: 'Age', alignment: 'right', bbox: { x: 100, y: 0, width: 60, height: 12 }, isNumeric: true },
        { content: 'Status', alignment: 'center', bbox: { x: 180, y: 0, width: 100, height: 12 }, isNumeric: false },
      ];
      const result = converter.generateAlignmentRow(cells);
      expect(result).to.equal('| :--- | ---: | :---: |');
    });
  });

  describe('generateHeader() - T032', () => {
    it('should generate header row with proper formatting', () => {
      const row = {
        cells: [
          { content: 'Name', alignment: 'left', bbox: { x: 0, y: 0, width: 80, height: 12 }, isNumeric: false },
          { content: 'Age', alignment: 'right', bbox: { x: 100, y: 0, width: 60, height: 12 }, isNumeric: true },
          { content: 'City', alignment: 'left', bbox: { x: 180, y: 0, width: 100, height: 12 }, isNumeric: false },
        ],
        isHeader: true,
        y: 700,
      };
      const result = converter.generateHeader(row);
      expect(result).to.equal('| Name | Age | City |');
    });

    it('should escape special characters in header', () => {
      const row = {
        cells: [
          { content: 'Name | Surname', alignment: 'left', bbox: { x: 0, y: 0, width: 80, height: 12 }, isNumeric: false },
        ],
        isHeader: true,
        y: 700,
      };
      const result = converter.generateHeader(row);
      expect(result).to.equal('| Name \\| Surname |');
    });
  });

  describe('generateDataRow() - T032', () => {
    it('should generate data row with proper formatting', () => {
      const row = {
        cells: [
          { content: 'John Doe', alignment: 'left', bbox: { x: 0, y: 0, width: 80, height: 12 }, isNumeric: false },
          { content: '30', alignment: 'right', bbox: { x: 100, y: 0, width: 60, height: 12 }, isNumeric: true },
          { content: 'New York', alignment: 'left', bbox: { x: 180, y: 0, width: 100, height: 12 }, isNumeric: false },
        ],
        isHeader: false,
        y: 685,
      };
      const result = converter.generateDataRow(row);
      expect(result).to.equal('| John Doe | 30 | New York |');
    });

    it('should handle empty cells with single space', () => {
      const row = {
        cells: [
          { content: 'A', alignment: 'left', bbox: { x: 0, y: 0, width: 50, height: 12 }, isNumeric: false },
          { content: '', alignment: 'left', bbox: { x: 60, y: 0, width: 30, height: 12 }, isNumeric: false },
          { content: 'C', alignment: 'left', bbox: { x: 100, y: 0, width: 50, height: 12 }, isNumeric: false },
        ],
        isHeader: false,
        y: 685,
      };
      const result = converter.generateDataRow(row);
      expect(result).to.equal('| A |   | C |');
    });

    it('should escape special characters in data cells', () => {
      const row = {
        cells: [
          { content: 'Price: $50 | Discount: 10%', alignment: 'left', bbox: { x: 0, y: 0, width: 200, height: 12 }, isNumeric: false },
        ],
        isHeader: false,
        y: 685,
      };
      const result = converter.generateDataRow(row);
      expect(result).to.equal('| Price: $50 \\| Discount: 10% |');
    });
  });

  describe('convertTable() - T033, T034, T035', () => {
    it('should convert complete table to GitHub Flavored Markdown (T033)', () => {
      const table = {
        page: 1,
        rows: [
          {
            cells: [
              { content: 'Name', alignment: 'left', bbox: { x: 100, y: 700, width: 80, height: 12 }, isNumeric: false },
              { content: 'Age', alignment: 'right', bbox: { x: 200, y: 700, width: 60, height: 12 }, isNumeric: true },
              { content: 'City', alignment: 'left', bbox: { x: 280, y: 700, width: 100, height: 12 }, isNumeric: false },
            ],
            isHeader: true,
            y: 700,
          },
          {
            cells: [
              { content: 'John Doe', alignment: 'left', bbox: { x: 100, y: 685, width: 80, height: 12 }, isNumeric: false },
              { content: '30', alignment: 'right', bbox: { x: 200, y: 685, width: 60, height: 12 }, isNumeric: true },
              { content: 'New York', alignment: 'left', bbox: { x: 280, y: 685, width: 100, height: 12 }, isNumeric: false },
            ],
            isHeader: false,
            y: 685,
          },
          {
            cells: [
              { content: 'Jane Smith', alignment: 'left', bbox: { x: 100, y: 670, width: 80, height: 12 }, isNumeric: false },
              { content: '25', alignment: 'right', bbox: { x: 200, y: 670, width: 60, height: 12 }, isNumeric: true },
              { content: 'London', alignment: 'left', bbox: { x: 280, y: 670, width: 100, height: 12 }, isNumeric: false },
            ],
            isHeader: false,
            y: 670,
          },
        ],
        bbox: { x: 100, y: 670, width: 280, height: 30 },
        confidence: 0.95,
        method: 'lattice',
      };

      const result = converter.convertTable(table);
      const lines = result.split('\n');

      expect(lines).to.have.lengthOf(4); // Header + alignment + 2 data rows
      expect(lines[0]).to.equal('| Name | Age | City |');
      expect(lines[1]).to.equal('| :--- | ---: | :--- |');
      expect(lines[2]).to.equal('| John Doe | 30 | New York |');
      expect(lines[3]).to.equal('| Jane Smith | 25 | London |');
    });

    it('should use first row as header if no header row marked (T034)', () => {
      const table = {
        page: 1,
        rows: [
          {
            cells: [
              { content: 'Name', alignment: 'left', bbox: { x: 100, y: 700, width: 80, height: 12 }, isNumeric: false },
              { content: 'Age', alignment: 'right', bbox: { x: 200, y: 700, width: 60, height: 12 }, isNumeric: true },
            ],
            isHeader: false, // No header marked
            y: 700,
          },
          {
            cells: [
              { content: 'John', alignment: 'left', bbox: { x: 100, y: 685, width: 80, height: 12 }, isNumeric: false },
              { content: '30', alignment: 'right', bbox: { x: 200, y: 685, width: 60, height: 12 }, isNumeric: true },
            ],
            isHeader: false,
            y: 685,
          },
        ],
        bbox: { x: 100, y: 685, width: 160, height: 15 },
        confidence: 0.8,
        method: 'stream',
      };

      const result = converter.convertTable(table);
      const lines = result.split('\n');

      expect(lines).to.have.lengthOf(3); // First row used as header + alignment + 1 data row
      expect(lines[0]).to.equal('| Name | Age |');
      expect(lines[1]).to.equal('| :--- | ---: |');
      expect(lines[2]).to.equal('| John | 30 |');
    });

    it('should handle tables with escaped content (T035)', () => {
      const table = {
        page: 1,
        rows: [
          {
            cells: [
              { content: 'File | Path', alignment: 'left', bbox: { x: 0, y: 0, width: 100, height: 12 }, isNumeric: false },
              { content: 'Size', alignment: 'right', bbox: { x: 120, y: 0, width: 60, height: 12 }, isNumeric: false },
            ],
            isHeader: true,
            y: 700,
          },
          {
            cells: [
              { content: 'C:\\Users\\Documents', alignment: 'left', bbox: { x: 0, y: 0, width: 100, height: 12 }, isNumeric: false },
              { content: '1.5 MB', alignment: 'right', bbox: { x: 120, y: 0, width: 60, height: 12 }, isNumeric: false },
            ],
            isHeader: false,
            y: 685,
          },
        ],
        bbox: { x: 0, y: 685, width: 180, height: 15 },
        confidence: 0.85,
        method: 'lattice',
      };

      const result = converter.convertTable(table);
      const lines = result.split('\n');

      expect(lines[0]).to.equal('| File \\| Path | Size |');
      expect(lines[2]).to.equal('| C:\\\\Users\\\\Documents | 1.5 MB |');
    });
  });

  describe('mergeTables() - T036, T037, T038', () => {
    let detector;

    beforeEach(() => {
      detector = new TableDetector();
    });

    it('should merge multi-page tables with repeated headers (T038)', () => {
      // Table on page 1 (header + 2 data rows)
      const table1 = {
        page: 1,
        rows: [
          {
            cells: [
              { content: 'Name', alignment: 'left', bbox: { x: 100, y: 700, width: 80, height: 12 }, isNumeric: false },
              { content: 'Age', alignment: 'right', bbox: { x: 200, y: 700, width: 60, height: 12 }, isNumeric: true },
              { content: 'City', alignment: 'left', bbox: { x: 280, y: 700, width: 100, height: 12 }, isNumeric: false },
            ],
            isHeader: true,
            y: 700,
          },
          {
            cells: [
              { content: 'Alice', alignment: 'left', bbox: { x: 100, y: 685, width: 80, height: 12 }, isNumeric: false },
              { content: '30', alignment: 'right', bbox: { x: 200, y: 685, width: 60, height: 12 }, isNumeric: true },
              { content: 'Paris', alignment: 'left', bbox: { x: 280, y: 685, width: 100, height: 12 }, isNumeric: false },
            ],
            isHeader: false,
            y: 685,
          },
          {
            cells: [
              { content: 'Bob', alignment: 'left', bbox: { x: 100, y: 670, width: 80, height: 12 }, isNumeric: false },
              { content: '25', alignment: 'right', bbox: { x: 200, y: 670, width: 60, height: 12 }, isNumeric: true },
              { content: 'London', alignment: 'left', bbox: { x: 280, y: 670, width: 100, height: 12 }, isNumeric: false },
            ],
            isHeader: false,
            y: 670,
          },
        ],
        bbox: { x: 100, y: 670, width: 280, height: 30 },
        confidence: 0.95,
        method: 'lattice',
      };

      // Table on page 2 (repeated header + 2 more data rows)
      const table2 = {
        page: 2,
        rows: [
          {
            cells: [
              { content: 'Name', alignment: 'left', bbox: { x: 100, y: 700, width: 80, height: 12 }, isNumeric: false },
              { content: 'Age', alignment: 'right', bbox: { x: 200, y: 700, width: 60, height: 12 }, isNumeric: true },
              { content: 'City', alignment: 'left', bbox: { x: 280, y: 700, width: 100, height: 12 }, isNumeric: false },
            ],
            isHeader: true,
            y: 700,
          },
          {
            cells: [
              { content: 'Charlie', alignment: 'left', bbox: { x: 100, y: 685, width: 80, height: 12 }, isNumeric: false },
              { content: '35', alignment: 'right', bbox: { x: 200, y: 685, width: 60, height: 12 }, isNumeric: true },
              { content: 'Berlin', alignment: 'left', bbox: { x: 280, y: 685, width: 100, height: 12 }, isNumeric: false },
            ],
            isHeader: false,
            y: 685,
          },
          {
            cells: [
              { content: 'Diana', alignment: 'left', bbox: { x: 100, y: 670, width: 80, height: 12 }, isNumeric: false },
              { content: '28', alignment: 'right', bbox: { x: 200, y: 670, width: 60, height: 12 }, isNumeric: true },
              { content: 'Rome', alignment: 'left', bbox: { x: 280, y: 670, width: 100, height: 12 }, isNumeric: false },
            ],
            isHeader: false,
            y: 670,
          },
        ],
        bbox: { x: 100, y: 670, width: 280, height: 30 },
        confidence: 0.95,
        method: 'lattice',
      };

      const merged = detector.mergeTables([table1, table2]);

      // Should return single table
      expect(merged).to.have.lengthOf(1);

      // Merged table should have 1 header row + 4 data rows (2 from each page)
      expect(merged[0].rows).to.have.lengthOf(5);
      expect(merged[0].rows[0].isHeader).to.be.true;
      expect(merged[0].rows[0].cells[0].content).to.equal('Name');

      // Check all data rows are present
      const dataRows = merged[0].rows.filter(row => !row.isHeader);
      expect(dataRows).to.have.lengthOf(4);
      expect(dataRows[0].cells[0].content).to.equal('Alice');
      expect(dataRows[1].cells[0].content).to.equal('Bob');
      expect(dataRows[2].cells[0].content).to.equal('Charlie');
      expect(dataRows[3].cells[0].content).to.equal('Diana');
    });

    it('should not merge tables with different column structures', () => {
      const table1 = {
        page: 1,
        rows: [
          {
            cells: [
              { content: 'Name', alignment: 'left', bbox: { x: 100, y: 700, width: 80, height: 12 }, isNumeric: false },
              { content: 'Age', alignment: 'right', bbox: { x: 200, y: 700, width: 60, height: 12 }, isNumeric: true },
            ],
            isHeader: true,
            y: 700,
          },
        ],
        bbox: { x: 100, y: 700, width: 160, height: 12 },
        confidence: 0.9,
        method: 'lattice',
      };

      const table2 = {
        page: 2,
        rows: [
          {
            cells: [
              { content: 'Product', alignment: 'left', bbox: { x: 100, y: 700, width: 100, height: 12 }, isNumeric: false },
              { content: 'Price', alignment: 'right', bbox: { x: 220, y: 700, width: 60, height: 12 }, isNumeric: true },
              { content: 'Stock', alignment: 'right', bbox: { x: 300, y: 700, width: 60, height: 12 }, isNumeric: true },
            ],
            isHeader: true,
            y: 700,
          },
        ],
        bbox: { x: 100, y: 700, width: 260, height: 12 },
        confidence: 0.9,
        method: 'lattice',
      };

      const merged = detector.mergeTables([table1, table2]);

      // Should return both tables unmerged (different column counts)
      expect(merged).to.have.lengthOf(2);
      expect(merged[0]).to.deep.equal(table1);
      expect(merged[1]).to.deep.equal(table2);
    });

    it('should handle empty tables array', () => {
      const merged = detector.mergeTables([]);
      expect(merged).to.be.an('array').that.is.empty;
    });

    it('should handle single table (no merging needed)', () => {
      const table = {
        page: 1,
        rows: [
          {
            cells: [
              { content: 'Name', alignment: 'left', bbox: { x: 100, y: 700, width: 80, height: 12 }, isNumeric: false },
            ],
            isHeader: true,
            y: 700,
          },
        ],
        bbox: { x: 100, y: 700, width: 80, height: 12 },
        confidence: 0.9,
        method: 'lattice',
      };

      const merged = detector.mergeTables([table]);
      expect(merged).to.have.lengthOf(1);
      expect(merged[0]).to.deep.equal(table);
    });
  });
});

// Phase 4 (User Story 2): Borderless Tables and Merged Cells
describe('TableDetector - Phase 4: Complex Table Handling', () => {
  let detector;

  beforeEach(() => {
    detector = new TableDetector();
  });

  describe('Stream Detection (Borderless Tables) - T051-T059', () => {
    // T052: Borderless table detection with 80%+ confidence (SC-002)
    it('should detect borderless table with 80%+ confidence using stream method', () => {
      const { items, expected } = pdfTableFixtures.borderlessTable;
      const result = detector.detectTables(items);

      // Should detect exactly 1 table
      expect(result.tableCount).to.equal(expected.tableCount);
      expect(result.tables).to.have.lengthOf(expected.tableCount);

      // Should use stream method for borderless tables (FR-002)
      expect(result.method).to.equal(expected.method);

      // Should have at least 80% confidence (SC-002)
      expect(result.confidence).to.be.at.least(0.80);

      // Should not fall back to text extraction
      expect(result.fallbackUsed).to.be.false;

      // Table structure validation
      const table = result.tables[0];
      expect(table.rows).to.have.lengthOf(expected.rows);
      expect(table.rows[0].cells).to.have.lengthOf(expected.columns);
    });

    // T054: Stream detection should identify column boundaries from whitespace
    it('should identify column boundaries from consistent whitespace patterns', () => {
      const { items } = pdfTableFixtures.borderlessTable;
      const result = detector.detectTables(items);

      expect(result.tables).to.have.lengthOf(1);
      const table = result.tables[0];

      // Each row should have same number of columns
      const columnCount = table.rows[0].cells.length;
      for (const row of table.rows) {
        expect(row.cells.length).to.equal(columnCount);
      }
    });

    // T055: Stream detection should handle numeric alignment
    it('should detect numeric columns and apply right alignment', () => {
      const { items } = pdfTableFixtures.borderlessTable;
      const result = detector.detectTables(items);

      const table = result.tables[0];

      // Q1 Sales, Q2 Sales, Total columns should be numeric (columns 1, 2, 3)
      // First column (Product) should not be numeric
      // Only check data rows (not header row - headers contain text labels)
      const dataRows = table.rows.filter(row => !row.isHeader);
      expect(dataRows.length).to.be.at.least(1, 'Should have at least one data row');

      for (const row of dataRows) {
        expect(row.cells[0].isNumeric).to.be.false; // Product names are text
        // At least some numeric columns detected in data rows
        const numericColumns = row.cells.filter(c => c.isNumeric).length;
        expect(numericColumns).to.be.at.least(1, 'Data rows should have numeric currency columns');
      }
    });

    // T056: Should distinguish between table and columnar text
    it('should NOT detect columnar text as a table', () => {
      const { items, expected } = pdfTableFixtures.columnarText;
      const result = detector.detectTables(items);

      // Should detect no tables
      expect(result.tableCount).to.equal(expected.tableCount);
      expect(result.tables).to.have.lengthOf(0);

      // Should fall back to text extraction
      expect(result.fallbackUsed).to.be.true;
    });

    // T057: Stream detection with varying row heights
    it('should handle tables with inconsistent row heights', () => {
      const { items, expected } = pdfTableFixtures.inconsistentRowHeights;
      const result = detector.detectTables(items);

      // Should still detect the table
      expect(result.tableCount).to.equal(expected.tableCount);
      expect(result.tables).to.have.lengthOf(expected.tableCount);

      // Confidence should meet threshold
      expect(result.confidence).to.be.at.least(0.70);

      // Table structure should be valid
      const table = result.tables[0];
      expect(table.rows).to.have.lengthOf(expected.rows);
    });
  });

  describe('Merged Cells Handling - T060-T064', () => {
    // T060: Detect tables with merged cells
    it('should detect tables with merged cells spanning columns', () => {
      const { items, expected } = pdfTableFixtures.mergedCellsTable;
      const result = detector.detectTables(items);

      // Should detect the table
      expect(result.tableCount).to.equal(expected.tableCount);
      expect(result.tables).to.have.lengthOf(expected.tableCount);

      // Should have reasonable confidence even with merged cells
      expect(result.confidence).to.be.at.least(0.70);
    });

    // T061: Handle merged cells by normalizing to consistent column count
    it('should normalize tables with merged cells to consistent column count', () => {
      const { items, expected } = pdfTableFixtures.mergedCellsTable;
      const result = detector.detectTables(items);

      const table = result.tables[0];

      // All rows should have the same number of columns after normalization
      const columnCount = expected.columns;
      for (let i = 1; i < table.rows.length; i++) {
        // Allow header rows to have different count (they may have merged cells)
        if (!table.rows[i].isHeader) {
          expect(table.rows[i].cells.length).to.equal(columnCount);
        }
      }
    });

    // T062: Markdown output should handle merged cells with empty columns
    it('should convert merged cell tables to valid Markdown', () => {
      const { items } = pdfTableFixtures.mergedCellsTable;
      const result = detector.detectTables(items);

      if (result.tables.length > 0) {
        const converter = new TableToMarkdownConverter();
        const markdown = converter.convertTable(result.tables[0]);

        // Should produce valid markdown (all rows have same pipe count)
        const lines = markdown.split('\n').filter(l => l.trim());
        const pipeCount = lines[0].split('|').length;

        for (const line of lines) {
          expect(line.split('|').length).to.equal(pipeCount);
        }
      }
    });
  });

  describe('Fallback and Error Recovery - FR-008, FR-009', () => {
    // FR-008: Graceful degradation for undetectable tables
    it('should gracefully fall back when confidence is too low', () => {
      // Create items that might look like a table but with very poor alignment
      const poorlyAlignedItems = [
        { str: 'Name', x: 100, y: 700, width: 40, height: 12, fontName: 'Helvetica' },
        { str: 'Age', x: 250, y: 700, width: 30, height: 12, fontName: 'Helvetica' },
        { str: 'John', x: 50, y: 680, width: 50, height: 12, fontName: 'Helvetica' }, // Misaligned
        { str: '30', x: 300, y: 680, width: 20, height: 12, fontName: 'Helvetica' }, // Misaligned
      ];

      const result = detector.detectTables(poorlyAlignedItems);

      // Should either detect no tables or fallback
      // The important thing is it doesn't crash and returns valid result
      expect(result).to.have.property('tables');
      expect(result).to.have.property('fallbackUsed');
      expect(result).to.have.property('confidence');
    });

    // FR-009: Preserve original text when table detection fails
    it('should preserve text content in warnings when fallback is used', () => {
      const { items } = pdfTableFixtures.columnarText;
      const result = detector.detectTables(items);

      // Should have warnings explaining the fallback
      expect(result.warnings).to.be.an('array');
      expect(result.warnings.length).to.be.at.least(1);
    });
  });
});

/**
 * Phase 5: User Story 3 - Fallback & Error Handling Tests
 * T065-T077: Confidence scoring, warnings, partial detection, and error messages
 */
describe('TableDetector - Phase 5: Fallback & Error Handling', () => {
  let detector;

  beforeEach(() => {
    detector = new TableDetector();
  });

  describe('Confidence Scoring & Warnings - T065-T068', () => {
    // T067: Test for confidence score in ambiguous table output
    it('should include confidence score warning for ambiguous tables (0.5-0.7 range)', () => {
      const { items } = pdfTableFixtures.lowConfidenceTable;
      const result = detector.detectTables(items);

      // If detection occurs but confidence is in 0.5-0.7 range, should have warning
      if (result.confidence >= 0.5 && result.confidence < 0.7) {
        expect(result.warnings).to.be.an('array');
        expect(result.warnings.some(w => w.includes('Low confidence'))).to.be.true;
        expect(result.warnings.some(w => w.includes('%'))).to.be.true; // Contains percentage
      }
    });

    // T068: Test for fallback when confidence < 0.7
    it('should set fallbackUsed: true for confidence below 0.7 threshold', () => {
      const { items } = pdfTableFixtures.lowConfidenceTable;
      const result = detector.detectTables(items);

      // Low confidence tables should trigger fallback flag
      if (result.confidence < 0.7) {
        expect(result.fallbackUsed).to.be.true;
      }
    });

    it('should return clean result for high confidence tables (>=0.7)', () => {
      const { items } = pdfTableFixtures.simpleBorderedTable;
      const result = detector.detectTables(items);

      // High confidence tables should not trigger fallback
      expect(result.confidence).to.be.at.least(0.7);
      expect(result.fallbackUsed).to.be.false;
    });

    it('should completely fall back for very low confidence data', () => {
      const { items, expected } = pdfTableFixtures.veryLowConfidenceData;
      const result = detector.detectTables(items);

      // Should completely fall back, no tables
      expect(result.tableCount).to.equal(expected.tableCount);
      expect(result.fallbackUsed).to.be.true;
      expect(result.method).to.equal('none');
    });
  });

  describe('Partial Detection Handling - T069-T072', () => {
    // T069: Partial detection should be flagged in warnings
    it('should handle partial detection with appropriate warnings', () => {
      // Create a structure that might only partially match
      const partialItems = [
        { str: 'Header 1', x: 100, y: 700, width: 80, height: 12, fontName: 'Arial-Bold' },
        { str: 'Header 2', x: 200, y: 700, width: 80, height: 12, fontName: 'Arial-Bold' },
        { str: 'Data 1', x: 100, y: 680, width: 80, height: 12, fontName: 'Arial' },
        { str: 'Data 2', x: 200, y: 680, width: 80, height: 12, fontName: 'Arial' },
        // Missing row - incomplete structure
      ];

      const result = detector.detectTables(partialItems);

      // Should not crash and return a valid result
      expect(result).to.have.property('tables');
      expect(result).to.have.property('warnings');
      expect(result).to.have.property('confidence');
    });

    // T070: Verify no crashes on malformed table structures
    it('should never throw exceptions on malformed table structures (SC-008)', () => {
      const malformedCases = [
        // Empty arrays
        [],
        // Single item
        [{ str: 'Single', x: 0, y: 0, width: 10, height: 10, fontName: 'Arial' }],
        // Items with missing properties
        [{ str: 'Partial' }],
        // Items with invalid values
        [{ str: 'Invalid', x: 'bad', y: null, width: -1, height: undefined, fontName: 123 }],
        // Null/undefined
        null,
        undefined,
      ];

      for (const items of malformedCases) {
        expect(() => {
          const result = detector.detectTables(items);
          expect(result).to.have.property('fallbackUsed');
        }).to.not.throw();
      }
    });

    // T071: Integration test for partial detection with both table and text output
    it('should include fallback info when detection is uncertain', () => {
      const { items } = pdfTableFixtures.columnarText;
      const result = detector.detectTables(items);

      // Columnar text should not be detected as table
      expect(result.fallbackUsed).to.be.true;
      expect(result.warnings.length).to.be.at.least(1);
    });
  });

  describe('Error Messages & User Feedback - T073-T077', () => {
    // T073: Descriptive error messages for specific error types
    it('should provide descriptive error messages for detection failures', () => {
      const { items } = pdfTableFixtures.columnarText;
      const result = detector.detectTables(items);

      // Should have at least one warning message
      expect(result.warnings).to.be.an('array');
      expect(result.warnings.length).to.be.at.least(1);

      // Warning should be descriptive (not empty or generic)
      expect(result.warnings[0].length).to.be.greaterThan(10);
    });

    // T074: User-friendly error messages for common failure scenarios
    it('should provide user-friendly messages for common failures', () => {
      // Test with empty input
      const result = detector.detectTables([]);

      expect(result.warnings).to.be.an('array');
      expect(result.warnings.length).to.be.at.least(1);
      expect(result.warnings[0]).to.include('No text items');
    });

    // T076: Clear error message for complex/unsupported structures
    it('should provide clear error message for unsupported complex structures', () => {
      // Very sparse data that doesn't form a table
      const complexItems = [
        { str: 'A', x: 10, y: 800, width: 10, height: 10, fontName: 'Arial' },
        { str: 'B', x: 500, y: 100, width: 10, height: 10, fontName: 'Arial' },
      ];

      const result = detector.detectTables(complexItems);

      // Should not detect as table and provide informative warning
      expect(result.fallbackUsed).to.be.true;
      expect(result.warnings.length).to.be.at.least(1);
    });

    // T077: Graceful degradation - all tests should complete without errors
    it('should gracefully degrade without crashing (100% graceful degradation - SC-008)', () => {
      // Run through all fixtures and ensure no crashes
      const allFixtures = [
        pdfTableFixtures.simpleBorderedTable.items,
        pdfTableFixtures.borderlessTable.items,
        pdfTableFixtures.columnarText.items,
        pdfTableFixtures.mergedCellsTable.items,
        pdfTableFixtures.inconsistentRowHeights.items,
        pdfTableFixtures.lowConfidenceTable.items,
        pdfTableFixtures.veryLowConfidenceData.items,
      ];

      for (const items of allFixtures) {
        const result = detector.detectTables(items);

        // Every result should have these properties
        expect(result).to.have.property('tables');
        expect(result).to.have.property('confidence');
        expect(result).to.have.property('method');
        expect(result).to.have.property('tableCount');
        expect(result).to.have.property('warnings');
        expect(result).to.have.property('fallbackUsed');
      }
    });
  });
});
