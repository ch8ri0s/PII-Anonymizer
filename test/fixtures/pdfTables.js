/**
 * Test fixtures for PDF table detection
 *
 * These fixtures simulate pdf-parse output with PdfTextItem objects
 * containing position metadata for testing table detection algorithms.
 */

/**
 * Simple 3x3 bordered table with clear grid structure
 * Represents a typical table with visible borders and aligned cells
 */
export const simpleBorderedTable = {
  /**
   * Array of text items from pdf-parse with position metadata
   * Simulates a table with headers (Name, Age, City) and 2 data rows
   */
  items: [
    // Header row (y=700)
    { str: 'Name', x: 100, y: 700, width: 80, height: 12, fontName: 'Helvetica-Bold' },
    { str: 'Age', x: 200, y: 700, width: 60, height: 12, fontName: 'Helvetica-Bold' },
    { str: 'City', x: 280, y: 700, width: 100, height: 12, fontName: 'Helvetica-Bold' },

    // Data row 1 (y=685)
    { str: 'John Doe', x: 100, y: 685, width: 80, height: 12, fontName: 'Helvetica' },
    { str: '30', x: 200, y: 685, width: 60, height: 12, fontName: 'Helvetica' },
    { str: 'New York', x: 280, y: 685, width: 100, height: 12, fontName: 'Helvetica' },

    // Data row 2 (y=670)
    { str: 'Jane Smith', x: 100, y: 670, width: 80, height: 12, fontName: 'Helvetica' },
    { str: '25', x: 200, y: 670, width: 60, height: 12, fontName: 'Helvetica' },
    { str: 'London', x: 280, y: 670, width: 100, height: 12, fontName: 'Helvetica' },
  ],

  /**
   * Expected detection result for this fixture
   */
  expected: {
    method: 'lattice',
    tableCount: 1,
    confidence: 0.95,
    rows: 3,
    columns: 3,
    hasHeader: true,
  },
};

/**
 * Borderless table with whitespace-based alignment
 * Represents a table without visible borders, relying on spacing for structure
 */
export const borderlessTable = {
  /**
   * Array of text items with consistent spacing but no borders
   * Simulates a financial report table with aligned columns
   */
  items: [
    // Header row (y=650)
    { str: 'Product', x: 50, y: 650, width: 100, height: 12, fontName: 'Arial-Bold' },
    { str: 'Q1 Sales', x: 170, y: 650, width: 80, height: 12, fontName: 'Arial-Bold' },
    { str: 'Q2 Sales', x: 270, y: 650, width: 80, height: 12, fontName: 'Arial-Bold' },
    { str: 'Total', x: 370, y: 650, width: 70, height: 12, fontName: 'Arial-Bold' },

    // Data row 1 (y=635)
    { str: 'Widget A', x: 50, y: 635, width: 100, height: 12, fontName: 'Arial' },
    { str: '$12,500', x: 170, y: 635, width: 80, height: 12, fontName: 'Arial' },
    { str: '$15,300', x: 270, y: 635, width: 80, height: 12, fontName: 'Arial' },
    { str: '$27,800', x: 370, y: 635, width: 70, height: 12, fontName: 'Arial' },

    // Data row 2 (y=620)
    { str: 'Widget B', x: 50, y: 620, width: 100, height: 12, fontName: 'Arial' },
    { str: '$8,200', x: 170, y: 620, width: 80, height: 12, fontName: 'Arial' },
    { str: '$9,450', x: 270, y: 620, width: 80, height: 12, fontName: 'Arial' },
    { str: '$17,650', x: 370, y: 620, width: 70, height: 12, fontName: 'Arial' },

    // Data row 3 (y=605)
    { str: 'Widget C', x: 50, y: 605, width: 100, height: 12, fontName: 'Arial' },
    { str: '$20,100', x: 170, y: 605, width: 80, height: 12, fontName: 'Arial' },
    { str: '$18,900', x: 270, y: 605, width: 80, height: 12, fontName: 'Arial' },
    { str: '$39,000', x: 370, y: 605, width: 70, height: 12, fontName: 'Arial' },
  ],

  /**
   * Expected detection result for this fixture
   */
  expected: {
    method: 'stream',
    tableCount: 1,
    confidence: 0.85,
    rows: 4,
    columns: 4,
    hasHeader: true,
  },
};

/**
 * Columnar text that should NOT be detected as a table
 * Represents a multi-column document layout (like newspaper columns)
 */
export const columnarText = {
  /**
   * Text items arranged in columns but with varying vertical positions
   * This simulates flowing paragraph text in a 2-column layout
   */
  items: [
    // Left column - paragraph text with varying y-coordinates
    { str: 'This is the first line of text in the left column.', x: 50, y: 750, width: 200, height: 12, fontName: 'Times' },
    { str: 'It continues with more text on the next line,', x: 50, y: 735, width: 200, height: 12, fontName: 'Times' },
    { str: 'providing information about the document topic.', x: 50, y: 720, width: 200, height: 12, fontName: 'Times' },
    { str: 'The text flows naturally down the page with', x: 50, y: 705, width: 200, height: 12, fontName: 'Times' },
    { str: 'standard paragraph formatting and spacing.', x: 50, y: 690, width: 200, height: 12, fontName: 'Times' },

    // Right column - independent paragraph text
    { str: 'The right column contains additional content', x: 300, y: 750, width: 200, height: 12, fontName: 'Times' },
    { str: 'that is related but formatted separately.', x: 300, y: 735, width: 200, height: 12, fontName: 'Times' },
    { str: 'This multi-column layout is common in', x: 300, y: 720, width: 200, height: 12, fontName: 'Times' },
    { str: 'academic papers and newsletters, but it', x: 300, y: 705, width: 200, height: 12, fontName: 'Times' },
    { str: 'should not be detected as a table.', x: 300, y: 690, width: 200, height: 12, fontName: 'Times' },
  ],

  /**
   * Expected detection result for this fixture (no table detected)
   */
  expected: {
    method: 'none',
    tableCount: 0,
    confidence: 0,
    fallbackUsed: true,
  },
};

/**
 * Table with merged cells (spanning multiple columns)
 * Represents a table with a header that spans 2 columns
 */
export const mergedCellsTable = {
  /**
   * Array of text items including a merged header cell
   */
  items: [
    // Title row - merged cell spanning columns 1-2 (y=700)
    { str: 'Employee Information', x: 100, y: 700, width: 200, height: 12, fontName: 'Helvetica-Bold' },
    { str: 'Contact', x: 320, y: 700, width: 100, height: 12, fontName: 'Helvetica-Bold' },

    // Sub-header row (y=685)
    { str: 'Name', x: 100, y: 685, width: 80, height: 12, fontName: 'Helvetica-Bold' },
    { str: 'Department', x: 200, y: 685, width: 100, height: 12, fontName: 'Helvetica-Bold' },
    { str: 'Email', x: 320, y: 685, width: 100, height: 12, fontName: 'Helvetica-Bold' },

    // Data row 1 (y=670)
    { str: 'John Doe', x: 100, y: 670, width: 80, height: 12, fontName: 'Helvetica' },
    { str: 'Engineering', x: 200, y: 670, width: 100, height: 12, fontName: 'Helvetica' },
    { str: 'john@example.com', x: 320, y: 670, width: 100, height: 12, fontName: 'Helvetica' },

    // Data row 2 (y=655)
    { str: 'Jane Smith', x: 100, y: 655, width: 80, height: 12, fontName: 'Helvetica' },
    { str: 'Marketing', x: 200, y: 655, width: 100, height: 12, fontName: 'Helvetica' },
    { str: 'jane@example.com', x: 320, y: 655, width: 100, height: 12, fontName: 'Helvetica' },
  ],

  /**
   * Expected detection result for this fixture
   */
  expected: {
    method: 'lattice',
    tableCount: 1,
    confidence: 0.75,
    rows: 4,
    columns: 3,
    hasHeader: true,
    hasMergedCells: true,
  },
};

/**
 * Table with inconsistent row heights
 * Some rows have more content causing varying heights
 */
export const inconsistentRowHeights = {
  /**
   * Array of text items with varying y-spacing between rows
   */
  items: [
    // Header row (y=700)
    { str: 'Task', x: 100, y: 700, width: 150, height: 12, fontName: 'Helvetica-Bold' },
    { str: 'Status', x: 270, y: 700, width: 80, height: 12, fontName: 'Helvetica-Bold' },

    // Data row 1 - single line (y=680)
    { str: 'Fix bug #123', x: 100, y: 680, width: 150, height: 12, fontName: 'Helvetica' },
    { str: 'Done', x: 270, y: 680, width: 80, height: 12, fontName: 'Helvetica' },

    // Data row 2 - taller due to more content (y=655, larger gap)
    { str: 'Implement feature', x: 100, y: 655, width: 150, height: 12, fontName: 'Helvetica' },
    { str: 'In Progress', x: 270, y: 655, width: 80, height: 12, fontName: 'Helvetica' },

    // Data row 3 - normal height (y=635)
    { str: 'Review PR', x: 100, y: 635, width: 150, height: 12, fontName: 'Helvetica' },
    { str: 'Pending', x: 270, y: 635, width: 80, height: 12, fontName: 'Helvetica' },
  ],

  /**
   * Expected detection result for this fixture
   */
  expected: {
    method: 'stream',
    tableCount: 1,
    confidence: 0.80,
    rows: 4,
    columns: 2,
    hasHeader: true,
  },
};

/**
 * Low-confidence ambiguous structure (borderline 0.5-0.7 range)
 * This fixture simulates a structure that could be a table but has
 * irregular patterns that make detection unreliable.
 */
export const lowConfidenceTable = {
  /**
   * Array of text items with ambiguous structure - only 2 items per row,
   * no bold headers, and minimal grid regularity (fewer alignment cues)
   */
  items: [
    // Two sparse rows with minimal structure
    { str: 'Item', x: 100, y: 700, width: 50, height: 12, fontName: 'Arial' },
    { str: 'Value', x: 300, y: 700, width: 50, height: 12, fontName: 'Arial' },

    // Only 2 data rows (borderline minimum)
    { str: 'A', x: 100, y: 680, width: 30, height: 12, fontName: 'Arial' },
    { str: '1', x: 300, y: 680, width: 20, height: 12, fontName: 'Arial' },
  ],

  /**
   * Expected detection result - low confidence due to sparse data
   * Note: Detection algorithms may not reliably detect this as a table
   */
  expected: {
    method: 'stream',
    tableCount: 1,
    confidence: 0.65, // Expected low confidence (0.5-0.7 range)
    rows: 2,
    columns: 2,
    hasHeader: false,
    hasWarnings: true,
  },
};

/**
 * Very low confidence structure (below 0.5 threshold)
 * This should trigger complete fallback, not low-confidence warning
 */
export const veryLowConfidenceData = {
  /**
   * Single row with single item - definitely not a table
   */
  items: [
    { str: 'Just some text', x: 100, y: 700, width: 200, height: 12, fontName: 'Arial' },
  ],

  expected: {
    method: 'none',
    tableCount: 0,
    confidence: 0,
    fallbackUsed: true,
  },
};

/**
 * Export all fixtures as a convenience object
 */
export default {
  simpleBorderedTable,
  borderlessTable,
  columnarText,
  mergedCellsTable,
  inconsistentRowHeights,
  lowConfidenceTable,
  veryLowConfidenceData,
};
