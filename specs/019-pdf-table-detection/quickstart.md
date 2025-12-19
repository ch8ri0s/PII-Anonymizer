# Developer Quickstart: PDF Table Detection

**Feature**: PDF Table Detection and Extraction
**Branch**: `019-pdf-table-detection`
**Date**: 2025-11-16

---

## Overview

This guide helps developers get started implementing the PDF table detection feature. The implementation follows Test-Driven Development (TDD) with a phased approach focusing on basic tables first (P1), then complex tables (P2).

**Goal**: Enhance `PdfToMarkdown.ts` to detect tables in PDFs and convert them to properly formatted Markdown tables, improving conversion quality from 75% to 85%+.

---

## Prerequisites

Before starting, ensure you have:

- ✅ Node.js 18+ installed
- ✅ Project dependencies installed (`npm install`)
- ✅ TypeScript compilation working (`npm run compile`)
- ✅ Existing tests passing (`npm test`)
- ✅ Familiarity with project structure (see `/CLAUDE.md`)

**Key Files to Review**:
- `/specs/019-pdf-table-detection/spec.md` - Feature specification
- `/specs/019-pdf-table-detection/data-model.md` - Entity definitions
- `/specs/019-pdf-table-detection/contracts/table-detection-api.md` - API contracts
- `/src/converters/PdfToMarkdown.ts` - Primary file to enhance

---

## Phase 1: Setup & Types (30 minutes)

### Step 1: Create Type Definitions

Create `src/types/pdfTable.ts` with core interfaces:

```typescript
// src/types/pdfTable.ts

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Alignment = 'left' | 'right' | 'center';
export type DetectionMethod = 'lattice' | 'stream' | 'none';

export interface TableCell {
  content: string;
  alignment: Alignment;
  bbox: BoundingBox;
  isNumeric: boolean;
}

export interface TableRow {
  cells: TableCell[];
  isHeader: boolean;
  y: number;
}

export interface TableStructure {
  page: number;
  rows: TableRow[];
  bbox: BoundingBox;
  confidence: number;
  method: DetectionMethod;
}

export interface DetectionResult {
  tables: TableStructure[];
  confidence: number;
  method: DetectionMethod;
  tableCount: number;
  warnings: string[];
  fallbackUsed: boolean;
}

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
  transform?: number[];
}
```

**Verify**: `npm run compile` should complete without errors.

---

### Step 2: Update Exports

Add new types to `src/types/index.ts`:

```typescript
// src/types/index.ts

// ... existing exports ...

export type {
  BoundingBox,
  Alignment,
  DetectionMethod,
  TableCell,
  TableRow,
  TableStructure,
  DetectionResult,
  PdfTextItem
} from './pdfTable.js';
```

**Verify**: `npm run typecheck` should pass.

---

## Phase 2: Test Setup (1 hour)

### Step 3: Create Test Fixtures

Create `test/fixtures/pdfTables.js` with test data:

```javascript
// test/fixtures/pdfTables.js

/**
 * Simple 3x3 bordered table fixture
 * Used for testing SC-001 (95% accuracy for simple tables)
 */
export const simpleBorderedTable = {
  // Mock pdf-parse text items with position data
  textItems: [
    // Header row
    { str: 'Name', x: 50, y: 100, width: 80, height: 12 },
    { str: 'Age', x: 150, y: 100, width: 50, height: 12 },
    { str: 'City', x: 220, y: 100, width: 80, height: 12 },
    // Data row 1
    { str: 'John Doe', x: 50, y: 120, width: 80, height: 12 },
    { str: '30', x: 150, y: 120, width: 50, height: 12 },
    { str: 'NYC', x: 220, y: 120, width: 80, height: 12 },
    // Data row 2
    { str: 'Jane Smith', x: 50, y: 140, width: 80, height: 12 },
    { str: '25', x: 150, y: 140, width: 50, height: 12 },
    { str: 'LA', x: 220, y: 140, width: 80, height: 12 },
  ],

  // Expected detection result
  expected: {
    tableCount: 1,
    confidence: 0.95, // High confidence for bordered table
    method: 'lattice',
    tables: [
      {
        page: 1,
        rows: [
          {
            cells: [
              { content: 'Name', alignment: 'left', isNumeric: false },
              { content: 'Age', alignment: 'left', isNumeric: false },
              { content: 'City', alignment: 'left', isNumeric: false },
            ],
            isHeader: true,
          },
          {
            cells: [
              { content: 'John Doe', alignment: 'left', isNumeric: false },
              { content: '30', alignment: 'right', isNumeric: true },
              { content: 'NYC', alignment: 'left', isNumeric: false },
            ],
            isHeader: false,
          },
          {
            cells: [
              { content: 'Jane Smith', alignment: 'left', isNumeric: false },
              { content: '25', alignment: 'right', isNumeric: true },
              { content: 'LA', alignment: 'left', isNumeric: false },
            ],
            isHeader: false,
          },
        ],
      },
    ],
  },

  // Expected Markdown output
  expectedMarkdown: `| Name | Age | City |
|:---|---:|:---|
| John Doe | 30 | NYC |
| Jane Smith | 25 | LA |`,
};

/**
 * Borderless table fixture
 * Used for testing SC-005 (80% accuracy for borderless tables)
 */
export const borderlessTable = {
  textItems: [
    // Similar structure but no visible borders
    // Column detection based on consistent x-positions
  ],
  expected: {
    tableCount: 1,
    confidence: 0.82, // Lower confidence for borderless
    method: 'stream',
  },
};

/**
 * Non-table text that might be confused for a table
 * Used for testing false positive prevention
 */
export const columnarText = {
  textItems: [
    // Two-column layout text (not a table)
  ],
  expected: {
    tableCount: 0,
    confidence: 0.3, // Low confidence, below threshold
    fallbackUsed: true,
  },
};
```

---

### Step 4: Create First Test

Create `test/unit/pdfTableDetector.test.js`:

```javascript
// test/unit/pdfTableDetector.test.js

import { expect } from 'chai';
import { simpleBorderedTable, borderlessTable, columnarText } from '../fixtures/pdfTables.js';

describe('TableDetector', () => {
  describe('detectLattice()', () => {
    it('should detect simple bordered 3x3 table with 95%+ confidence', () => {
      // RED: This test will fail initially
      const detector = new TableDetector();
      const result = detector.detectLattice(simpleBorderedTable.textItems, 1);

      expect(result.tables).to.have.length(1);
      expect(result.confidence).to.be.at.least(0.95); // SC-001
      expect(result.method).to.equal('lattice');
      expect(result.fallbackUsed).to.be.false;
    });

    it('should validate table structure (min 2 rows, 2 columns)', () => {
      // FR-003: Structure preservation
      const detector = new TableDetector();
      const result = detector.detectLattice(simpleBorderedTable.textItems, 1);

      const table = result.tables[0];
      expect(table.rows.length).to.be.at.least(2);
      expect(table.rows[0].cells.length).to.be.at.least(2);

      // All rows must have same column count
      const columnCount = table.rows[0].cells.length;
      table.rows.forEach(row => {
        expect(row.cells.length).to.equal(columnCount);
      });
    });
  });

  describe('detectStream()', () => {
    it('should detect borderless table with 80%+ confidence', () => {
      // SC-005: Borderless table detection
      const detector = new TableDetector();
      const result = detector.detectStream(borderlessTable.textItems, 1);

      expect(result.confidence).to.be.at.least(0.80);
      expect(result.method).to.equal('stream');
    });
  });

  describe('validateTable()', () => {
    it('should reject tables with < 2 rows', () => {
      // FR-003 validation
      const detector = new TableDetector();
      const invalidTable = {
        rows: [{ cells: [], isHeader: true, y: 100 }],
        // ... other fields
      };

      expect(detector.validateTable(invalidTable)).to.be.false;
    });

    it('should reject tables with confidence < 0.7', () => {
      // Confidence threshold check
      const detector = new TableDetector();
      const lowConfidenceTable = {
        rows: [/*...*/],
        confidence: 0.5,
        // ... other fields
      };

      expect(detector.validateTable(lowConfidenceTable)).to.be.false;
    });
  });

  describe('detectTables() - auto detection', () => {
    it('should try lattice first, fall back to stream', () => {
      // FR-008: Fallback behavior
      const detector = new TableDetector();
      const result = detector.detectTables(borderlessTable.textItems, 1);

      // Should fall back to stream for borderless tables
      expect(result.method).to.equal('stream');
    });

    it('should never throw exception, even on invalid input', () => {
      // SC-008: 100% graceful degradation
      const detector = new TableDetector();

      expect(() => {
        detector.detectTables([], 1);
      }).to.not.throw();

      expect(() => {
        detector.detectTables(null, 1);
      }).to.not.throw();
    });

    it('should set fallbackUsed: true for non-table content', () => {
      // FR-008: Fallback to text extraction
      const detector = new TableDetector();
      const result = detector.detectTables(columnarText.textItems, 1);

      expect(result.fallbackUsed).to.be.true;
      expect(result.tableCount).to.equal(0);
    });
  });
});
```

**Run**: `npm test test/unit/pdfTableDetector.test.js`
**Expected**: All tests should **FAIL** (RED phase) because implementation doesn't exist yet.

---

## Phase 3: Implement Core Detection (4-6 hours)

### Step 5: Create TableDetector Class

Create `src/utils/pdfTableDetector.ts`:

```typescript
// src/utils/pdfTableDetector.ts

import type {
  PdfTextItem,
  DetectionResult,
  TableStructure,
  TableRow,
  TableCell,
  BoundingBox,
  DetectionMethod,
} from '../types/pdfTable.js';

export class TableDetector {
  private readonly confidenceThreshold = 0.7;

  /**
   * Auto-detect tables using best method
   * FR-001: Automatic table detection
   */
  detectTables(textItems: PdfTextItem[], pageNumber: number): DetectionResult {
    try {
      // Try lattice detection first (faster for bordered tables)
      const latticeResult = this.detectLattice(textItems, pageNumber);
      if (latticeResult.confidence >= this.confidenceThreshold) {
        return latticeResult;
      }

      // Fall back to stream detection
      const streamResult = this.detectStream(textItems, pageNumber);
      if (streamResult.confidence >= this.confidenceThreshold) {
        return streamResult;
      }

      // FR-008: Graceful fallback
      return this.createFallbackResult();
    } catch (error) {
      // SC-008: Never throw, always return valid result
      return this.createFallbackResult([`Detection error: ${error.message}`]);
    }
  }

  /**
   * Detect bordered tables using lattice method
   * FR-003: Preserve table structure
   */
  detectLattice(textItems: PdfTextItem[], pageNumber: number): DetectionResult {
    // TODO: Implement lattice detection algorithm
    // 1. Detect horizontal/vertical lines in text positions
    // 2. Build grid from line intersections
    // 3. Map text items to grid cells
    // 4. Build TableStructure from grid

    throw new Error('Not implemented');
  }

  /**
   * Detect borderless tables using stream method
   * FR-005: Column alignment detection
   */
  detectStream(textItems: PdfTextItem[], pageNumber: number): DetectionResult {
    // TODO: Implement stream detection algorithm
    // 1. Analyze text spacing patterns
    // 2. Detect column boundaries using consistent x-positions (DBSCAN)
    // 3. Group rows by y-position clustering
    // 4. Build TableStructure from clusters

    throw new Error('Not implemented');
  }

  /**
   * Validate table structure
   * FR-003: Minimum requirements
   */
  validateTable(table: TableStructure): boolean {
    if (table.rows.length < 2) return false;
    if (table.rows[0].cells.length < 2) return false;
    if (table.confidence < this.confidenceThreshold) return false;

    // Check column consistency
    const columnCount = table.rows[0].cells.length;
    for (const row of table.rows) {
      if (row.cells.length !== columnCount) return false;
    }

    return true;
  }

  /**
   * Create fallback result when detection fails
   * FR-008: Graceful degradation
   */
  private createFallbackResult(warnings: string[] = []): DetectionResult {
    return {
      tables: [],
      confidence: 0,
      method: 'none',
      tableCount: 0,
      warnings: warnings.length > 0 ? warnings : ['No tables detected'],
      fallbackUsed: true,
    };
  }
}
```

**Next**: Implement `detectLattice()` and `detectStream()` following TDD cycle:
1. Run tests → RED (fails)
2. Implement minimal code → GREEN (passes)
3. Refactor → Keep GREEN

---

### Step 6: Implement Markdown Converter

Create Markdown conversion in same file:

```typescript
// src/utils/pdfTableDetector.ts (continued)

export class TableToMarkdownConverter {
  /**
   * Convert table to Markdown
   * FR-002: Valid Markdown syntax
   * FR-007: No data loss
   */
  convertTable(table: TableStructure): string {
    if (table.rows.length === 0) return '';

    const lines: string[] = [];

    // Generate header row (first row)
    const headerRow = table.rows.find(r => r.isHeader) || table.rows[0];
    lines.push(this.generateHeader(headerRow));

    // Generate alignment row
    lines.push(this.generateAlignmentRow(headerRow.cells));

    // Generate data rows
    const dataRows = table.rows.filter(r => !r.isHeader);
    for (const row of dataRows) {
      lines.push(this.generateDataRow(row));
    }

    return lines.join('\n');
  }

  /**
   * Generate header row
   * FR-003: Preserve headers
   */
  generateHeader(row: TableRow): string {
    const cells = row.cells.map(cell => this.escapeCell(cell.content));
    return `| ${cells.join(' | ')} |`;
  }

  /**
   * Generate alignment separator
   * FR-005: Column alignment
   */
  generateAlignmentRow(cells: TableCell[]): string {
    const alignments = cells.map(cell => {
      switch (cell.alignment) {
        case 'right': return '---:';
        case 'center': return ':---:';
        default: return ':---';
      }
    });
    return `|${alignments.join('|')}|`;
  }

  /**
   * Generate data row
   * FR-011: Handle empty cells
   */
  generateDataRow(row: TableRow): string {
    const cells = row.cells.map(cell =>
      cell.content === '' ? '' : this.escapeCell(cell.content)
    );
    return `| ${cells.join(' | ')} |`;
  }

  /**
   * Escape Markdown special characters
   * FR-006: Escape pipes, backslashes
   */
  escapeCell(content: string): string {
    return content
      .replace(/\\/g, '\\\\')   // Escape backslashes
      .replace(/\|/g, '\\|')    // Escape pipes
      .replace(/\n/g, '<br>');  // Convert newlines
  }
}
```

**Test**: Create `test/unit/tableToMarkdown.test.js` following same TDD pattern.

---

## Phase 4: Integration (2-3 hours)

### Step 7: Enhance PdfToMarkdown

Update `src/converters/PdfToMarkdown.ts`:

```typescript
// src/converters/PdfToMarkdown.ts

import { TableDetector, TableToMarkdownConverter } from '../utils/pdfTableDetector.js';
import type { DetectionResult, TableStructure } from '../types/pdfTable.js';

export class PdfToMarkdown implements MarkdownConverter {
  private tableDetector: TableDetector;
  private tableConverter: TableToMarkdownConverter;

  constructor() {
    this.tableDetector = new TableDetector();
    this.tableConverter = new TableToMarkdownConverter();
  }

  async convert(buffer: Buffer): Promise<string> {
    const pdfData = await pdfParse(buffer);
    let markdown = this.generateFrontmatter(pdfData);

    const allTables: TableStructure[] = [];

    // Process each page
    for (let i = 0; i < pdfData.numpages; i++) {
      const pageNumber = i + 1;
      const pageData = this.extractPageData(pdfData, pageNumber);

      // FR-001: Automatic table detection
      const detectionResult = this.tableDetector.detectTables(
        pageData.textItems,
        pageNumber
      );

      if (detectionResult.tables.length > 0 && !detectionResult.fallbackUsed) {
        // FR-002: Convert to Markdown tables
        for (const table of detectionResult.tables) {
          markdown += '\n\n' + this.tableConverter.convertTable(table);
          allTables.push(table);
        }
      } else {
        // FR-008: Fallback to existing text extraction
        markdown += '\n\n' + this.extractPageText(pageData);
      }
    }

    // FR-012: Add table metadata to frontmatter
    markdown = this.addTableMetadata(markdown, allTables);

    return markdown;
  }

  /**
   * Add table detection metadata to frontmatter
   * FR-012: Include metadata
   */
  private addTableMetadata(markdown: string, tables: TableStructure[]): string {
    const metadataLines = [
      `tablesDetected: ${tables.length > 0}`,
      `tableCount: ${tables.length}`,
    ];

    if (tables.length > 0) {
      const method = tables[0].method;
      const avgConfidence = tables.reduce((sum, t) => sum + t.confidence, 0) / tables.length;
      metadataLines.push(`tableDetectionMethod: ${method}`);
      metadataLines.push(`tableDetectionConfidence: ${avgConfidence.toFixed(2)}`);
    }

    // Insert after existing frontmatter
    return markdown.replace(/^---\n/, `---\n${metadataLines.join('\n')}\n`);
  }

  // ... existing methods ...
}
```

**Test**: Create `test/integration/pdfTableConversion.test.js` for end-to-end tests.

---

## Phase 5: Testing & Validation (2 hours)

### Step 8: Run Test Suite

```bash
# Run all tests
npm test

# Run table-specific tests
npm test test/unit/pdfTableDetector.test.js
npm test test/unit/tableToMarkdown.test.js
npm test test/integration/pdfTableConversion.test.js

# Check coverage
npm run test:coverage
```

**Success Criteria**:
- All tests passing (GREEN)
- 80%+ code coverage for new files
- No TypeScript errors (`npm run typecheck`)
- No ESLint errors (`npm run lint`)

---

### Step 9: Manual Testing

Test with real PDF files:

1. Create `test-pdfs/` directory
2. Add sample PDFs (simple tables, borderless tables, complex tables)
3. Run conversion:

```bash
npm run dev
# Upload test PDFs through UI
# Verify Markdown output contains properly formatted tables
```

**Verify**:
- Tables detected and converted
- Frontmatter includes `tablesDetected: true`
- Markdown renders correctly in preview

---

## Phase 6: Performance & Accuracy (1-2 hours)

### Step 10: Measure Performance

Create `test/performance/tableDetection.perf.js`:

```javascript
// test/performance/tableDetection.perf.js

describe('Performance Tests', () => {
  it('should add <20% overhead vs baseline PDF extraction', async () => {
    // SC-003: Performance constraint
    const testPdf = loadTestPdf('sample-10mb.pdf');

    // Baseline: extraction without table detection
    const baselineStart = Date.now();
    await convertWithoutTables(testPdf);
    const baselineTime = Date.now() - baselineStart;

    // With table detection
    const detectionStart = Date.now();
    await convertWithTables(testPdf);
    const detectionTime = Date.now() - detectionStart;

    const overhead = (detectionTime - baselineTime) / baselineTime;
    expect(overhead).to.be.lessThan(0.20); // <20% overhead
  });
});
```

---

### Step 11: Measure Accuracy

Create accuracy test script:

```javascript
// test/accuracy/tableDetection.accuracy.js

describe('Accuracy Tests', () => {
  it('should achieve 95%+ accuracy for simple bordered tables', () => {
    // SC-001: Detection accuracy
    const testCases = loadGroundTruthData('simple-bordered-tables.json');
    let correctDetections = 0;

    for (const testCase of testCases) {
      const result = detectTables(testCase.pdf);
      if (matchesGroundTruth(result, testCase.expected)) {
        correctDetections++;
      }
    }

    const accuracy = correctDetections / testCases.length;
    expect(accuracy).to.be.at.least(0.95);
  });

  it('should achieve 80%+ accuracy for borderless tables', () => {
    // SC-005: Borderless table accuracy
    // Similar test with borderless table dataset
  });
});
```

---

## Common Pitfalls & Solutions

### Pitfall 1: pdf-parse Text Item Coordinates

**Problem**: pdf-parse uses bottom-left origin (PostScript standard), not top-left
**Solution**: Convert y-coordinates: `adjustedY = pageHeight - item.y`

### Pitfall 2: Merged Cells

**Problem**: Single text item spans multiple columns
**Solution**: Detect by width > 1.5× average cell width, duplicate content or add warning

### Pitfall 3: False Positives

**Problem**: Two-column text layout detected as table
**Solution**: Strict validation - require minimum 2 rows AND 2 columns AND confidence >= 0.7

### Pitfall 4: Multi-Page Tables

**Problem**: Table split across pages, headers repeated
**Solution**: Detect header repetition pattern, merge based on column structure match

---

## Debug Tips

### Enable Verbose Logging

```typescript
// In pdfTableDetector.ts
const DEBUG = process.env.DEBUG_TABLE_DETECTION === 'true';

if (DEBUG) {
  console.log('Text items:', textItems);
  console.log('Detected tables:', result);
}
```

Run with: `DEBUG_TABLE_DETECTION=true npm run dev`

### Visualize Detection

Add debug output to see bounding boxes:

```typescript
private debugVisualize(table: TableStructure) {
  console.log(`Table on page ${table.page}:`);
  console.log(`  Bounding box: x=${table.bbox.x}, y=${table.bbox.y}`);
  console.log(`  Rows: ${table.rows.length}, Confidence: ${table.confidence}`);

  table.rows.forEach((row, i) => {
    console.log(`  Row ${i}: ${row.cells.map(c => c.content).join(' | ')}`);
  });
}
```

---

## Next Steps After Quickstart

1. **Implement P1 (Basic Tables)**:
   - Simple bordered tables (lattice detection)
   - 95%+ accuracy target (SC-001)
   - Multi-page merging (FR-004)

2. **Implement P2 (Complex Tables)**:
   - Borderless tables (stream detection)
   - 80%+ accuracy target (SC-005)
   - Merged cell handling

3. **Polish**:
   - Error handling improvements
   - Performance optimization
   - Documentation updates

---

## Resources

- **Specification**: `/specs/019-pdf-table-detection/spec.md`
- **Data Model**: `/specs/019-pdf-table-detection/data-model.md`
- **API Contracts**: `/specs/019-pdf-table-detection/contracts/table-detection-api.md`
- **Research**: `/specs/019-pdf-table-detection/research.md`
- **Project Guidelines**: `/CLAUDE.md`
- **pdf-parse Docs**: https://www.npmjs.com/package/pdf-parse

---

## Support

- Check existing tests in `test/unit/converters/` for patterns
- Review `PdfToMarkdown.ts` for current PDF handling
- Consult `TROUBLESHOOTING.md` for common issues
- Ask team for help with algorithm design

---

**Ready to Start?** → Begin with Phase 2, Step 3 (Create Test Fixtures) and follow TDD Red-Green-Refactor cycle!
