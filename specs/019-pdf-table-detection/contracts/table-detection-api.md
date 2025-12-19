# API Contract: PDF Table Detection

**Feature**: PDF Table Detection and Extraction
**Date**: 2025-11-16
**Source**: Derived from spec.md Functional Requirements and data-model.md

---

## Module Overview

The table detection API provides TypeScript interfaces for detecting and extracting table structures from PDF documents. Since this is an Electron desktop application, these are **module-level TypeScript contracts** rather than REST/GraphQL endpoints.

**Primary Module**: `src/utils/pdfTableDetector.ts`
**Consumer Module**: `src/converters/PdfToMarkdown.ts`

---

## Core Interfaces

### 1. TableDetector (Primary API)

**Purpose**: Main interface for table detection functionality

```typescript
/**
 * Detects tables in PDF document using pdf-parse text items with position metadata
 *
 * @param textItems - Array of text items from pdf-parse with position data
 * @param pageNumber - Page number being analyzed (1-indexed)
 * @returns Detection result with tables, confidence, and warnings
 * @throws Never throws - always returns valid DetectionResult with fallbackUsed flag
 */
export interface TableDetector {
  /**
   * Detect tables using lattice method (bordered tables)
   * FR-001: Automatic table detection
   * FR-003: Preserve table structure
   */
  detectLattice(
    textItems: PdfTextItem[],
    pageNumber: number
  ): DetectionResult;

  /**
   * Detect tables using stream method (borderless tables)
   * FR-001: Automatic table detection
   * FR-005: Column alignment detection
   */
  detectStream(
    textItems: PdfTextItem[],
    pageNumber: number
  ): DetectionResult;

  /**
   * Auto-detect using best method (tries lattice first, falls back to stream)
   * FR-008: Fallback to text extraction on low confidence
   */
  detectTables(
    textItems: PdfTextItem[],
    pageNumber: number
  ): DetectionResult;

  /**
   * Validate detected table structure
   * FR-003: Minimum 2 rows, 2 columns, consistent structure
   */
  validateTable(table: TableStructure): boolean;

  /**
   * Merge tables spanning multiple pages
   * FR-004: Multi-page table handling
   */
  mergeTables(
    tables: TableStructure[],
    pages: number[]
  ): TableStructure | null;
}
```

**Contract Guarantees**:
- **FR-008 Compliance**: Never throws exceptions, always returns valid `DetectionResult`
- **FR-009 Compatibility**: Returns `fallbackUsed: true` if detection fails, allowing caller to use existing text extraction
- **Performance**: Completes in <20% overhead vs current PDF extraction (SC-003)

---

### 2. TableToMarkdownConverter

**Purpose**: Converts detected table structures to Markdown format

```typescript
/**
 * Converts TableStructure entities to GitHub Flavored Markdown tables
 *
 * @param table - Validated table structure from detector
 * @returns Markdown table string with pipes and alignment separators
 * @throws Never throws - returns fallback text representation on error
 */
export interface TableToMarkdownConverter {
  /**
   * Convert single table to Markdown
   * FR-002: Valid Markdown table syntax
   * FR-006: Escape special characters
   * FR-007: Preserve all text content
   */
  convertTable(table: TableStructure): string;

  /**
   * Convert multiple tables to Markdown with page markers
   * FR-010: Multiple tables in single PDF
   */
  convertTables(tables: TableStructure[]): string;

  /**
   * Generate Markdown header row
   * FR-003: Preserve header rows
   */
  generateHeader(row: TableRow): string;

  /**
   * Generate alignment separator row (e.g., |:---|---:|:---:|)
   * FR-005: Apply appropriate column alignment
   */
  generateAlignmentRow(cells: TableCell[]): string;

  /**
   * Generate data row
   * FR-011: Handle empty cells
   * FR-014: Variable column widths
   */
  generateDataRow(row: TableRow): string;

  /**
   * Escape Markdown special characters in cell content
   * FR-006: Escape pipes, backslashes
   */
  escapeCell(content: string): string;
}
```

**Contract Guarantees**:
- **FR-002 Compliance**: Output always valid GitHub Flavored Markdown
- **FR-007 Compliance**: No data loss during conversion
- **SC-004 Achievement**: 90% of tables render without manual edits

---

### 3. PdfTextItem (Input Contract)

**Purpose**: Defines expected input from pdf-parse library

```typescript
/**
 * Text item with position metadata from pdf-parse
 * This is the input contract from the existing pdf-parse dependency
 */
export interface PdfTextItem {
  /**
   * Text content of the item
   */
  str: string;

  /**
   * X-coordinate of item on page (PDF points, origin bottom-left)
   */
  x: number;

  /**
   * Y-coordinate of item on page (PDF points, origin bottom-left)
   */
  y: number;

  /**
   * Width of text item bounding box
   */
  width: number;

  /**
   * Height of text item bounding box
   */
  height: number;

  /**
   * Font name (optional, used for styling detection)
   */
  fontName?: string;

  /**
   * Transform matrix (optional, used for rotation detection)
   */
  transform?: number[];
}
```

**Source**: Existing pdf-parse library API
**Stability**: Stable external dependency, no breaking changes expected

---

### 4. MetadataEnhancer

**Purpose**: Adds table detection metadata to PDF frontmatter

```typescript
/**
 * Enhances PDF conversion metadata with table detection results
 *
 * @param metadata - Existing PDF metadata object
 * @param result - Detection result from TableDetector
 * @returns Enhanced metadata with table information
 */
export interface MetadataEnhancer {
  /**
   * Add table detection metadata to frontmatter
   * FR-012: Include metadata in frontmatter
   */
  addTableMetadata(
    metadata: PdfMetadata,
    result: DetectionResult
  ): PdfMetadata;
}

/**
 * Enhanced PDF metadata with table detection fields
 */
export interface PdfMetadata {
  source: string;
  sourceFormat: 'pdf';
  processed: string;
  anonymised: boolean;
  piiModel: string;
  pageCount: number;
  conversionWarnings: number;

  // NEW: Table detection metadata (FR-012)
  tablesDetected: boolean;
  tableCount: number;
  tableDetectionMethod: DetectionMethod;
  tableDetectionConfidence: number;
}
```

**Contract Guarantees**:
- **FR-009 Compliance**: Backward compatible - new fields optional
- **FR-012 Compliance**: Always includes table detection metadata

---

## Error Handling Contracts

### 1. Graceful Degradation (FR-008)

**Contract**: All table detection methods MUST return valid `DetectionResult` and NEVER throw exceptions

```typescript
/**
 * Error handling contract for table detection
 */
export interface ErrorHandling {
  /**
   * Handle detection failure gracefully
   *
   * @param error - Error that occurred during detection
   * @param context - Context information (page number, method, etc.)
   * @returns DetectionResult with fallbackUsed: true
   */
  handleDetectionFailure(
    error: Error,
    context: DetectionContext
  ): DetectionResult;
}

export interface DetectionContext {
  pageNumber: number;
  method: DetectionMethod;
  textItemCount: number;
}

/**
 * Example fallback result
 */
const fallbackResult: DetectionResult = {
  tables: [],
  confidence: 0,
  method: 'none',
  tableCount: 0,
  warnings: ['Table detection failed, using text extraction'],
  fallbackUsed: true
};
```

**Success Criteria Mapping**: SC-008 - 100% graceful degradation

---

### 2. Validation Failures

**Contract**: Invalid tables are rejected silently with warnings, not errors

```typescript
/**
 * Validation contract for table structures
 */
export interface ValidationContract {
  /**
   * Validate table meets minimum requirements
   *
   * Requirements from FR-003:
   * - Minimum 2 rows
   * - Minimum 2 columns
   * - All rows have same column count
   * - Confidence >= 0.7
   *
   * @param table - Table structure to validate
   * @returns Validation result with warnings
   */
  validate(table: TableStructure): ValidationResult;
}

export interface ValidationResult {
  valid: boolean;
  warnings: string[];
  failedChecks: ValidationCheck[];
}

export type ValidationCheck =
  | 'MIN_ROW_COUNT'
  | 'MIN_COLUMN_COUNT'
  | 'COLUMN_CONSISTENCY'
  | 'CONFIDENCE_THRESHOLD';
```

---

## Performance Contracts

### 1. Processing Time (SC-003)

**Contract**: Table detection adds <20% overhead to current PDF extraction time

```typescript
/**
 * Performance monitoring contract
 */
export interface PerformanceContract {
  /**
   * Start performance timer
   */
  startTimer(): PerformanceTimer;

  /**
   * Check if processing is within acceptable overhead
   *
   * @param baselineMs - Baseline PDF extraction time without table detection
   * @param detectionMs - Time spent on table detection
   * @returns True if overhead < 20%
   */
  isWithinOverhead(baselineMs: number, detectionMs: number): boolean;
}

export interface PerformanceTimer {
  stop(): number; // Returns elapsed milliseconds
}

/**
 * Performance SLA
 */
const PERFORMANCE_SLA = {
  maxOverheadPercent: 20,
  maxProcessingTimeMs: 120000, // 2 minutes for 50MB PDFs
};
```

---

### 2. Accuracy Contracts (Success Criteria)

**Contract**: Detection achieves specified accuracy targets

```typescript
/**
 * Accuracy measurement contract for testing
 */
export interface AccuracyContract {
  /**
   * Measure detection accuracy against ground truth
   *
   * @param detected - Detected tables
   * @param groundTruth - Known correct tables
   * @returns Accuracy metrics
   */
  measureAccuracy(
    detected: TableStructure[],
    groundTruth: TableStructure[]
  ): AccuracyMetrics;
}

export interface AccuracyMetrics {
  detectionRate: number;      // SC-001: 95% for simple bordered tables
  borderlessRate: number;      // SC-005: 80% for borderless tables
  alignmentAccuracy: number;   // SC-007: 90% column alignment accuracy
  renderQuality: number;       // SC-004: 90% render without edits
}

/**
 * Success criteria targets
 */
const ACCURACY_TARGETS = {
  simpleBorderedTables: 0.95,  // SC-001
  borderlessTables: 0.80,      // SC-005
  columnAlignment: 0.90,       // SC-007
  renderQuality: 0.90,         // SC-004
};
```

---

## Integration Contracts

### 1. PdfToMarkdown Integration

**Contract**: How PdfToMarkdown.ts consumes the table detection API

```typescript
/**
 * Integration contract for PdfToMarkdown converter
 */
export interface PdfToMarkdownIntegration {
  /**
   * Enhanced conversion method with table detection
   *
   * @param pdfBuffer - PDF file buffer
   * @param options - Conversion options
   * @returns Markdown content with tables
   */
  convertToMarkdown(
    pdfBuffer: Buffer,
    options: ConversionOptions
  ): Promise<ConversionResult>;
}

export interface ConversionOptions {
  /**
   * Enable/disable table detection
   * Default: true
   */
  detectTables?: boolean;

  /**
   * Minimum confidence threshold for table detection
   * Default: 0.7
   */
  confidenceThreshold?: number;

  /**
   * Maximum processing time per page (ms)
   * Default: 10000
   */
  maxProcessingTimePerPage?: number;
}

export interface ConversionResult {
  markdown: string;
  metadata: PdfMetadata;
  warnings: string[];
  processingTime: number;
}
```

**Usage Example**:
```typescript
// In PdfToMarkdown.ts
import { TableDetector, TableToMarkdownConverter } from '../utils/pdfTableDetector';

async convertToMarkdown(pdfBuffer: Buffer): Promise<ConversionResult> {
  const pdfData = await pdfParse(pdfBuffer);
  const detector = new TableDetector();
  const converter = new TableToMarkdownConverter();

  let allMarkdown = '';
  const allTables: TableStructure[] = [];

  for (const page of pdfData.pages) {
    // FR-001: Automatic table detection
    const result = detector.detectTables(page.textItems, page.pageNumber);

    if (result.tables.length > 0 && !result.fallbackUsed) {
      // FR-002: Convert to Markdown tables
      allMarkdown += converter.convertTables(result.tables);
      allTables.push(...result.tables);
    } else {
      // FR-008: Fallback to existing text extraction
      allMarkdown += this.extractText(page.textItems);
    }
  }

  // FR-012: Add metadata
  const metadata = this.metadataEnhancer.addTableMetadata(
    this.baseMetadata,
    { tables: allTables, ... }
  );

  return { markdown: allMarkdown, metadata, warnings: [] };
}
```

---

## Testing Contracts

### 1. Unit Test Interface

**Contract**: How unit tests interact with the API

```typescript
/**
 * Testing contract for table detector
 */
export interface TableDetectorTestContract {
  /**
   * Test data factory for creating mock PdfTextItems
   */
  createMockTextItems(layout: TableLayout): PdfTextItem[];

  /**
   * Test data factory for creating expected TableStructure
   */
  createExpectedTable(layout: TableLayout): TableStructure;

  /**
   * Assertion helper for comparing detected vs expected tables
   */
  assertTablesEqual(
    detected: TableStructure,
    expected: TableStructure,
    tolerance?: number
  ): void;
}

export interface TableLayout {
  rows: number;
  columns: number;
  cellContents: string[][];
  hasBorders: boolean;
  pageNumber: number;
}
```

**Usage Example**:
```typescript
// In test/unit/pdfTableDetector.test.js
describe('TableDetector', () => {
  it('should detect simple 3x3 bordered table', () => {
    const layout: TableLayout = {
      rows: 3,
      columns: 3,
      cellContents: [
        ['Name', 'Age', 'City'],
        ['John', '30', 'NYC'],
        ['Jane', '25', 'LA']
      ],
      hasBorders: true,
      pageNumber: 1
    };

    const textItems = createMockTextItems(layout);
    const detector = new TableDetector();

    const result = detector.detectLattice(textItems, 1);

    expect(result.tables).to.have.length(1);
    expect(result.confidence).to.be.at.least(0.95); // SC-001
    expect(result.method).to.equal('lattice');
  });
});
```

---

## Backward Compatibility Contract

**Contract**: Ensure existing PDF conversion continues to work unchanged

```typescript
/**
 * Backward compatibility contract
 * FR-009: Maintain backward compatibility
 */
export interface BackwardCompatibility {
  /**
   * Convert PDF without table detection (legacy mode)
   * This method exists to ensure no breaking changes to existing code
   */
  convertWithoutTableDetection(pdfBuffer: Buffer): Promise<ConversionResult>;

  /**
   * Check if conversion result is compatible with previous version
   */
  isCompatibleWithV1(result: ConversionResult): boolean;
}

/**
 * Compatibility guarantees:
 * - If no tables detected, output identical to v1 (pre-table detection)
 * - New frontmatter fields are optional, won't break v1 parsers
 * - All existing API signatures unchanged
 */
```

---

## Configuration Contract

**Contract**: Configurable behavior for table detection

```typescript
/**
 * Configuration contract for table detection behavior
 */
export interface TableDetectionConfig {
  /**
   * Enable/disable table detection globally
   * Default: true
   */
  enabled: boolean;

  /**
   * Minimum confidence threshold for accepting detected tables
   * Default: 0.7 (70%)
   */
  confidenceThreshold: number;

  /**
   * Preferred detection method
   * Default: 'auto' (tries lattice first, falls back to stream)
   */
  preferredMethod: 'auto' | 'lattice' | 'stream';

  /**
   * Maximum table size to process (rows × columns)
   * Default: 1000 (e.g., 50 rows × 20 columns)
   */
  maxTableSize: number;

  /**
   * Enable multi-page table merging
   * Default: true
   */
  enableMultiPageMerge: boolean;

  /**
   * Maximum pages to merge into single table
   * Default: 5
   */
  maxPageSpan: number;
}

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: TableDetectionConfig = {
  enabled: true,
  confidenceThreshold: 0.7,
  preferredMethod: 'auto',
  maxTableSize: 1000,
  enableMultiPageMerge: true,
  maxPageSpan: 5
};
```

---

## Summary of Contract Mappings

| Functional Requirement | Contract Method | Success Criteria |
|------------------------|-----------------|------------------|
| FR-001: Automatic detection | `detectTables()` | SC-001, SC-005 |
| FR-002: Markdown syntax | `convertTable()` | SC-004 |
| FR-003: Preserve structure | `validateTable()` | SC-001 |
| FR-004: Multi-page tables | `mergeTables()` | SC-006 |
| FR-005: Column alignment | `generateAlignmentRow()` | SC-007 |
| FR-006: Escape characters | `escapeCell()` | SC-004 |
| FR-007: No data loss | `convertTable()` | SC-004 |
| FR-008: Fallback handling | `handleDetectionFailure()` | SC-008 |
| FR-009: Backward compat | `isCompatibleWithV1()` | N/A |
| FR-010: Multiple tables | `convertTables()` | SC-001 |
| FR-011: Empty cells | `generateDataRow()` | SC-004 |
| FR-012: Metadata | `addTableMetadata()` | N/A |
| FR-013: Local processing | N/A (architectural) | N/A |
| FR-014: Variable widths | `generateDataRow()` | SC-004 |

---

## Next Steps

1. Implement contracts in `src/types/pdfTable.ts` (TypeScript interfaces)
2. Implement `TableDetector` in `src/utils/pdfTableDetector.ts`
3. Implement `TableToMarkdownConverter` in `src/utils/pdfTableDetector.ts`
4. Enhance `PdfToMarkdown.ts` to consume table detection API
5. Write unit tests following `TableDetectorTestContract`
6. Write integration tests for end-to-end conversion
