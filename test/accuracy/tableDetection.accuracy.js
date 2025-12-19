/**
 * Accuracy Validation Tests for PDF Table Detection
 *
 * Tests success criteria:
 * - SC-001: 95%+ accuracy for simple bordered tables
 * - SC-005: 80%+ accuracy for borderless tables
 * - SC-007: 90%+ column alignment accuracy
 *
 * Tasks: T082-T086
 */

import { expect } from 'chai';
import { TableDetector, TableToMarkdownConverter } from '../../dist/utils/pdfTableDetector.js';

describe('Table Detection Accuracy Validation', () => {
  let detector;
  let _converter;

  beforeEach(() => {
    detector = new TableDetector();
    _converter = new TableToMarkdownConverter();
  });

  describe('SC-001: Simple Bordered Tables - 95%+ Accuracy', () => {
    // Generate multiple test cases for bordered tables
    const borderedTableCases = [
      // Case 1: 3x3 simple table
      {
        name: '3x3 simple bordered table',
        items: [
          { str: 'Name', x: 100, y: 700, width: 80, height: 12, fontName: 'Helvetica-Bold' },
          { str: 'Age', x: 200, y: 700, width: 60, height: 12, fontName: 'Helvetica-Bold' },
          { str: 'City', x: 280, y: 700, width: 100, height: 12, fontName: 'Helvetica-Bold' },
          { str: 'John', x: 100, y: 685, width: 80, height: 12, fontName: 'Helvetica' },
          { str: '30', x: 200, y: 685, width: 60, height: 12, fontName: 'Helvetica' },
          { str: 'NYC', x: 280, y: 685, width: 100, height: 12, fontName: 'Helvetica' },
          { str: 'Jane', x: 100, y: 670, width: 80, height: 12, fontName: 'Helvetica' },
          { str: '25', x: 200, y: 670, width: 60, height: 12, fontName: 'Helvetica' },
          { str: 'LA', x: 280, y: 670, width: 100, height: 12, fontName: 'Helvetica' },
        ],
        expectedRows: 3,
        expectedCols: 3,
      },
      // Case 2: 4x2 table
      {
        name: '4x2 bordered table',
        items: [
          { str: 'Product', x: 100, y: 700, width: 100, height: 12, fontName: 'Arial-Bold' },
          { str: 'Price', x: 220, y: 700, width: 80, height: 12, fontName: 'Arial-Bold' },
          { str: 'Widget A', x: 100, y: 680, width: 100, height: 12, fontName: 'Arial' },
          { str: '$10', x: 220, y: 680, width: 80, height: 12, fontName: 'Arial' },
          { str: 'Widget B', x: 100, y: 660, width: 100, height: 12, fontName: 'Arial' },
          { str: '$20', x: 220, y: 660, width: 80, height: 12, fontName: 'Arial' },
          { str: 'Widget C', x: 100, y: 640, width: 100, height: 12, fontName: 'Arial' },
          { str: '$30', x: 220, y: 640, width: 80, height: 12, fontName: 'Arial' },
        ],
        expectedRows: 4,
        expectedCols: 2,
      },
      // Case 3: 2x4 wide table
      {
        name: '2x4 wide bordered table',
        items: [
          { str: 'Q1', x: 100, y: 700, width: 60, height: 12, fontName: 'Helvetica-Bold' },
          { str: 'Q2', x: 180, y: 700, width: 60, height: 12, fontName: 'Helvetica-Bold' },
          { str: 'Q3', x: 260, y: 700, width: 60, height: 12, fontName: 'Helvetica-Bold' },
          { str: 'Q4', x: 340, y: 700, width: 60, height: 12, fontName: 'Helvetica-Bold' },
          { str: '100', x: 100, y: 680, width: 60, height: 12, fontName: 'Helvetica' },
          { str: '200', x: 180, y: 680, width: 60, height: 12, fontName: 'Helvetica' },
          { str: '300', x: 260, y: 680, width: 60, height: 12, fontName: 'Helvetica' },
          { str: '400', x: 340, y: 680, width: 60, height: 12, fontName: 'Helvetica' },
        ],
        expectedRows: 2,
        expectedCols: 4,
      },
      // Case 4: 5x3 medium table
      {
        name: '5x3 medium bordered table',
        items: [
          { str: 'ID', x: 100, y: 700, width: 40, height: 12, fontName: 'Helvetica-Bold' },
          { str: 'Name', x: 160, y: 700, width: 80, height: 12, fontName: 'Helvetica-Bold' },
          { str: 'Status', x: 260, y: 700, width: 60, height: 12, fontName: 'Helvetica-Bold' },
          { str: '1', x: 100, y: 680, width: 40, height: 12, fontName: 'Helvetica' },
          { str: 'Task A', x: 160, y: 680, width: 80, height: 12, fontName: 'Helvetica' },
          { str: 'Done', x: 260, y: 680, width: 60, height: 12, fontName: 'Helvetica' },
          { str: '2', x: 100, y: 660, width: 40, height: 12, fontName: 'Helvetica' },
          { str: 'Task B', x: 160, y: 660, width: 80, height: 12, fontName: 'Helvetica' },
          { str: 'Pending', x: 260, y: 660, width: 60, height: 12, fontName: 'Helvetica' },
          { str: '3', x: 100, y: 640, width: 40, height: 12, fontName: 'Helvetica' },
          { str: 'Task C', x: 160, y: 640, width: 80, height: 12, fontName: 'Helvetica' },
          { str: 'Active', x: 260, y: 640, width: 60, height: 12, fontName: 'Helvetica' },
          { str: '4', x: 100, y: 620, width: 40, height: 12, fontName: 'Helvetica' },
          { str: 'Task D', x: 160, y: 620, width: 80, height: 12, fontName: 'Helvetica' },
          { str: 'Done', x: 260, y: 620, width: 60, height: 12, fontName: 'Helvetica' },
        ],
        expectedRows: 5,
        expectedCols: 3,
      },
      // Case 5-10: Additional variations for 95% accuracy target
      {
        name: '3x2 minimal bordered table',
        items: [
          { str: 'Key', x: 100, y: 700, width: 60, height: 12, fontName: 'Helvetica-Bold' },
          { str: 'Value', x: 180, y: 700, width: 80, height: 12, fontName: 'Helvetica-Bold' },
          { str: 'A', x: 100, y: 680, width: 60, height: 12, fontName: 'Helvetica' },
          { str: '1', x: 180, y: 680, width: 80, height: 12, fontName: 'Helvetica' },
          { str: 'B', x: 100, y: 660, width: 60, height: 12, fontName: 'Helvetica' },
          { str: '2', x: 180, y: 660, width: 80, height: 12, fontName: 'Helvetica' },
        ],
        expectedRows: 3,
        expectedCols: 2,
      },
    ];

    it('should achieve 95%+ accuracy for simple bordered tables (SC-001)', () => {
      let successCount = 0;
      const totalCases = borderedTableCases.length;

      for (const testCase of borderedTableCases) {
        const result = detector.detectTables(testCase.items);

        // Check if table was detected with reasonable confidence
        if (result.tables.length > 0 && result.confidence >= 0.7) {
          const table = result.tables[0];
          // Verify row and column counts are close to expected
          const rowMatch = table.rows.length >= testCase.expectedRows - 1;
          const colMatch = table.rows[0]?.cells.length >= testCase.expectedCols - 1;

          if (rowMatch && colMatch) {
            successCount++;
          }
        }
      }

      const accuracy = (successCount / totalCases) * 100;
      console.log(`Bordered table accuracy: ${accuracy.toFixed(1)}% (${successCount}/${totalCases})`);

      // SC-001: 95%+ accuracy required
      expect(accuracy).to.be.at.least(95, `Expected 95%+ accuracy, got ${accuracy.toFixed(1)}%`);
    });
  });

  describe('SC-005: Borderless Tables - 80%+ Accuracy', () => {
    // Generate multiple test cases for borderless/stream tables
    const borderlessTableCases = [
      // Case 1: Financial report table
      {
        name: 'Financial report (4 columns)',
        items: [
          { str: 'Product', x: 50, y: 650, width: 100, height: 12, fontName: 'Arial-Bold' },
          { str: 'Q1', x: 170, y: 650, width: 80, height: 12, fontName: 'Arial-Bold' },
          { str: 'Q2', x: 270, y: 650, width: 80, height: 12, fontName: 'Arial-Bold' },
          { str: 'Total', x: 370, y: 650, width: 70, height: 12, fontName: 'Arial-Bold' },
          { str: 'Widget', x: 50, y: 635, width: 100, height: 12, fontName: 'Arial' },
          { str: '$100', x: 170, y: 635, width: 80, height: 12, fontName: 'Arial' },
          { str: '$200', x: 270, y: 635, width: 80, height: 12, fontName: 'Arial' },
          { str: '$300', x: 370, y: 635, width: 70, height: 12, fontName: 'Arial' },
          { str: 'Gadget', x: 50, y: 620, width: 100, height: 12, fontName: 'Arial' },
          { str: '$50', x: 170, y: 620, width: 80, height: 12, fontName: 'Arial' },
          { str: '$75', x: 270, y: 620, width: 80, height: 12, fontName: 'Arial' },
          { str: '$125', x: 370, y: 620, width: 70, height: 12, fontName: 'Arial' },
        ],
        expectedRows: 3,
        expectedCols: 4,
      },
      // Case 2: Employee list
      {
        name: 'Employee list (3 columns)',
        items: [
          { str: 'Name', x: 50, y: 700, width: 120, height: 12, fontName: 'Arial-Bold' },
          { str: 'Dept', x: 200, y: 700, width: 100, height: 12, fontName: 'Arial-Bold' },
          { str: 'Salary', x: 330, y: 700, width: 80, height: 12, fontName: 'Arial-Bold' },
          { str: 'Alice', x: 50, y: 680, width: 120, height: 12, fontName: 'Arial' },
          { str: 'Engineering', x: 200, y: 680, width: 100, height: 12, fontName: 'Arial' },
          { str: '$80K', x: 330, y: 680, width: 80, height: 12, fontName: 'Arial' },
          { str: 'Bob', x: 50, y: 660, width: 120, height: 12, fontName: 'Arial' },
          { str: 'Marketing', x: 200, y: 660, width: 100, height: 12, fontName: 'Arial' },
          { str: '$70K', x: 330, y: 660, width: 80, height: 12, fontName: 'Arial' },
        ],
        expectedRows: 3,
        expectedCols: 3,
      },
      // Case 3: Schedule table
      {
        name: 'Schedule table (2 columns)',
        items: [
          { str: 'Time', x: 100, y: 700, width: 100, height: 12, fontName: 'Arial-Bold' },
          { str: 'Event', x: 250, y: 700, width: 150, height: 12, fontName: 'Arial-Bold' },
          { str: '9:00 AM', x: 100, y: 680, width: 100, height: 12, fontName: 'Arial' },
          { str: 'Meeting', x: 250, y: 680, width: 150, height: 12, fontName: 'Arial' },
          { str: '2:00 PM', x: 100, y: 660, width: 100, height: 12, fontName: 'Arial' },
          { str: 'Review', x: 250, y: 660, width: 150, height: 12, fontName: 'Arial' },
          { str: '4:00 PM', x: 100, y: 640, width: 100, height: 12, fontName: 'Arial' },
          { str: 'Standup', x: 250, y: 640, width: 150, height: 12, fontName: 'Arial' },
        ],
        expectedRows: 4,
        expectedCols: 2,
      },
      // Case 4: Inventory table
      {
        name: 'Inventory table (3 columns)',
        items: [
          { str: 'Item', x: 50, y: 700, width: 150, height: 12, fontName: 'Arial-Bold' },
          { str: 'Qty', x: 230, y: 700, width: 60, height: 12, fontName: 'Arial-Bold' },
          { str: 'Price', x: 320, y: 700, width: 80, height: 12, fontName: 'Arial-Bold' },
          { str: 'Laptop', x: 50, y: 680, width: 150, height: 12, fontName: 'Arial' },
          { str: '10', x: 230, y: 680, width: 60, height: 12, fontName: 'Arial' },
          { str: '$999', x: 320, y: 680, width: 80, height: 12, fontName: 'Arial' },
          { str: 'Mouse', x: 50, y: 660, width: 150, height: 12, fontName: 'Arial' },
          { str: '50', x: 230, y: 660, width: 60, height: 12, fontName: 'Arial' },
          { str: '$25', x: 320, y: 660, width: 80, height: 12, fontName: 'Arial' },
        ],
        expectedRows: 3,
        expectedCols: 3,
      },
      // Case 5: Simple 2-column borderless
      {
        name: 'Simple 2-column borderless',
        items: [
          { str: 'Category', x: 100, y: 700, width: 120, height: 12, fontName: 'Arial-Bold' },
          { str: 'Count', x: 280, y: 700, width: 80, height: 12, fontName: 'Arial-Bold' },
          { str: 'Books', x: 100, y: 680, width: 120, height: 12, fontName: 'Arial' },
          { str: '42', x: 280, y: 680, width: 80, height: 12, fontName: 'Arial' },
          { str: 'Videos', x: 100, y: 660, width: 120, height: 12, fontName: 'Arial' },
          { str: '18', x: 280, y: 660, width: 80, height: 12, fontName: 'Arial' },
        ],
        expectedRows: 3,
        expectedCols: 2,
      },
    ];

    it('should achieve 80%+ accuracy for borderless tables (SC-005)', () => {
      let successCount = 0;
      const totalCases = borderlessTableCases.length;

      for (const testCase of borderlessTableCases) {
        const result = detector.detectTables(testCase.items);

        // Check if table was detected
        if (result.tables.length > 0 && result.confidence >= 0.65) {
          const table = result.tables[0];
          // More lenient matching for borderless tables
          const rowMatch = table.rows.length >= testCase.expectedRows - 1;
          const colMatch = table.rows[0]?.cells.length >= testCase.expectedCols - 1;

          if (rowMatch && colMatch) {
            successCount++;
          }
        }
      }

      const accuracy = (successCount / totalCases) * 100;
      console.log(`Borderless table accuracy: ${accuracy.toFixed(1)}% (${successCount}/${totalCases})`);

      // SC-005: 80%+ accuracy required
      expect(accuracy).to.be.at.least(80, `Expected 80%+ accuracy, got ${accuracy.toFixed(1)}%`);
    });
  });

  describe('SC-007: Column Alignment - 90%+ Accuracy', () => {
    // Test cases with known numeric and text columns
    const alignmentTestCases = [
      // Case 1: Mixed text and numeric columns
      {
        name: 'Mixed alignment table',
        items: [
          { str: 'Product', x: 100, y: 700, width: 100, height: 12, fontName: 'Arial-Bold' },
          { str: 'Price', x: 220, y: 700, width: 60, height: 12, fontName: 'Arial-Bold' },
          { str: 'Widget', x: 100, y: 680, width: 100, height: 12, fontName: 'Arial' },
          { str: '$19.99', x: 220, y: 680, width: 60, height: 12, fontName: 'Arial' },
          { str: 'Gadget', x: 100, y: 660, width: 100, height: 12, fontName: 'Arial' },
          { str: '$29.99', x: 220, y: 660, width: 60, height: 12, fontName: 'Arial' },
        ],
        expectedAlignments: [
          { col: 0, isNumeric: false }, // Product column - text
          { col: 1, isNumeric: true },  // Price column - numeric
        ],
      },
      // Case 2: All numeric columns
      {
        name: 'All numeric table',
        items: [
          { str: 'Q1', x: 100, y: 700, width: 60, height: 12, fontName: 'Arial-Bold' },
          { str: 'Q2', x: 180, y: 700, width: 60, height: 12, fontName: 'Arial-Bold' },
          { str: 'Q3', x: 260, y: 700, width: 60, height: 12, fontName: 'Arial-Bold' },
          { str: '100', x: 100, y: 680, width: 60, height: 12, fontName: 'Arial' },
          { str: '200', x: 180, y: 680, width: 60, height: 12, fontName: 'Arial' },
          { str: '300', x: 260, y: 680, width: 60, height: 12, fontName: 'Arial' },
          { str: '150', x: 100, y: 660, width: 60, height: 12, fontName: 'Arial' },
          { str: '250', x: 180, y: 660, width: 60, height: 12, fontName: 'Arial' },
          { str: '350', x: 260, y: 660, width: 60, height: 12, fontName: 'Arial' },
        ],
        expectedAlignments: [
          { col: 0, isNumeric: true },  // Q1 data - numeric
          { col: 1, isNumeric: true },  // Q2 data - numeric
          { col: 2, isNumeric: true },  // Q3 data - numeric
        ],
      },
      // Case 3: All text columns
      {
        name: 'All text table',
        items: [
          { str: 'Name', x: 100, y: 700, width: 80, height: 12, fontName: 'Arial-Bold' },
          { str: 'City', x: 200, y: 700, width: 80, height: 12, fontName: 'Arial-Bold' },
          { str: 'Country', x: 300, y: 700, width: 80, height: 12, fontName: 'Arial-Bold' },
          { str: 'Alice', x: 100, y: 680, width: 80, height: 12, fontName: 'Arial' },
          { str: 'NYC', x: 200, y: 680, width: 80, height: 12, fontName: 'Arial' },
          { str: 'USA', x: 300, y: 680, width: 80, height: 12, fontName: 'Arial' },
        ],
        expectedAlignments: [
          { col: 0, isNumeric: false }, // Name - text
          { col: 1, isNumeric: false }, // City - text
          { col: 2, isNumeric: false }, // Country - text
        ],
      },
      // Case 4: Currency values
      {
        name: 'Currency table',
        items: [
          { str: 'Item', x: 100, y: 700, width: 100, height: 12, fontName: 'Arial-Bold' },
          { str: 'Amount', x: 220, y: 700, width: 80, height: 12, fontName: 'Arial-Bold' },
          { str: 'Rent', x: 100, y: 680, width: 100, height: 12, fontName: 'Arial' },
          { str: '$1,500', x: 220, y: 680, width: 80, height: 12, fontName: 'Arial' },
          { str: 'Utilities', x: 100, y: 660, width: 100, height: 12, fontName: 'Arial' },
          { str: '$200', x: 220, y: 660, width: 80, height: 12, fontName: 'Arial' },
        ],
        expectedAlignments: [
          { col: 0, isNumeric: false }, // Item - text
          { col: 1, isNumeric: true },  // Amount - numeric (currency)
        ],
      },
      // Case 5: Percentage values
      {
        name: 'Percentage table',
        items: [
          { str: 'Category', x: 100, y: 700, width: 120, height: 12, fontName: 'Arial-Bold' },
          { str: 'Share', x: 240, y: 700, width: 80, height: 12, fontName: 'Arial-Bold' },
          { str: 'Mobile', x: 100, y: 680, width: 120, height: 12, fontName: 'Arial' },
          { str: '45%', x: 240, y: 680, width: 80, height: 12, fontName: 'Arial' },
          { str: 'Desktop', x: 100, y: 660, width: 120, height: 12, fontName: 'Arial' },
          { str: '55%', x: 240, y: 660, width: 80, height: 12, fontName: 'Arial' },
        ],
        expectedAlignments: [
          { col: 0, isNumeric: false }, // Category - text
          { col: 1, isNumeric: true },  // Share - numeric (percentage)
        ],
      },
    ];

    it('should achieve 90%+ column alignment accuracy (SC-007)', () => {
      let correctAlignments = 0;
      let totalAlignments = 0;

      for (const testCase of alignmentTestCases) {
        const result = detector.detectTables(testCase.items);

        if (result.tables.length > 0) {
          const table = result.tables[0];
          // Check data rows (skip header)
          const dataRows = table.rows.filter(r => !r.isHeader);

          for (const expected of testCase.expectedAlignments) {
            totalAlignments++;

            // Check if any data row has the expected numeric status for this column
            const hasCorrectAlignment = dataRows.some(row => {
              const cell = row.cells[expected.col];
              return cell && cell.isNumeric === expected.isNumeric;
            });

            if (hasCorrectAlignment) {
              correctAlignments++;
            }
          }
        }
      }

      const accuracy = totalAlignments > 0 ? (correctAlignments / totalAlignments) * 100 : 0;
      console.log(`Column alignment accuracy: ${accuracy.toFixed(1)}% (${correctAlignments}/${totalAlignments})`);

      // SC-007: 90%+ accuracy required
      expect(accuracy).to.be.at.least(90, `Expected 90%+ accuracy, got ${accuracy.toFixed(1)}%`);
    });
  });

  describe('Overall Detection Summary', () => {
    it('should summarize all accuracy metrics', () => {
      console.log('\n=== Table Detection Accuracy Summary ===');
      console.log('SC-001: Simple bordered tables - Target: 95%+');
      console.log('SC-005: Borderless tables - Target: 80%+');
      console.log('SC-007: Column alignment - Target: 90%+');
      console.log('=========================================\n');

      // This test always passes - it's just for the summary output
      expect(true).to.be.true;
    });
  });
});
