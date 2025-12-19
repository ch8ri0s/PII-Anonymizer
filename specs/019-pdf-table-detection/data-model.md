# Data Model: PDF Table Detection

**Feature**: PDF Table Detection and Extraction
**Date**: 2025-11-16
**Source**: Derived from spec.md Key Entities and research.md

---

## Entity Definitions

### 1. Table Structure

**Purpose**: Represents a detected table in a PDF document

**Fields**:
- `page` (number): Page number where table is located (1-indexed)
- `rows` (TableRow[]): Array of table rows including header and data rows
- `bbox` (BoundingBox): Bounding box coordinates for the entire table
- `confidence` (number): Detection confidence score (0-1)
- `method` ('lattice' | 'stream'): Detection method used

**Validation Rules** (from FR-003):
- Must have at least 2 rows (header + 1 data row minimum)
- Must have at least 2 columns
- All rows must have same column count (consistent structure)
- Confidence must be >= 0.7 (70%) to be considered valid table

**Relationships**:
- Contains multiple TableRow entities
- Has one BoundingBox
- Referenced by Detection Result

**State Transitions**:
```
Candidate → Detected (confidence >= 0.7)
Candidate → Rejected (confidence < 0.7, falls back to text extraction)
Detected → Validated (structure checks pass)
Validated → Converted (transformed to Markdown)
```

---

### 2. Table Row

**Purpose**: Represents a single row within a table

**Fields**:
- `cells` (TableCell[]): Array of cells in this row
- `isHeader` (boolean): Whether this row is a header row
- `y` (number): Y-coordinate of row on the page

**Validation Rules**:
- Cell count must match table column count
- Header rows typically appear first in table
- Y-coordinates should be monotonically increasing within a table (except multi-page spanning)

**Relationships**:
- Belongs to one Table Structure
- Contains multiple Table Cell entities

---

### 3. Table Cell

**Purpose**: Represents individual cell content within a table

**Fields**:
- `content` (string): Text content of the cell (may be empty string)
- `alignment` ('left' | 'right' | 'center'): Column alignment hint
- `bbox` (BoundingBox): Cell bounding box coordinates
- `isNumeric` (boolean): Whether content is purely numeric

**Validation Rules** (from FR-006, FR-011):
- Content must be escaped for Markdown (pipes `|` → `\|`)
- Empty cells represented as empty string `""` not null
- Newlines in content must be converted to `<br>` or stripped

**Relationships**:
- Belongs to one Table Row
- Has one BoundingBox

**Business Logic**:
- Alignment determination:
  - If `isNumeric === true` → alignment = 'right'
  - If header cell → alignment = 'left' (default)
  - Otherwise → alignment = 'left'

---

### 4. Bounding Box

**Purpose**: Defines rectangular coordinates for tables, cells, or text items

**Fields**:
- `x` (number): X-coordinate of top-left corner
- `y` (number): Y-coordinate of top-left corner
- `width` (number): Width of bounding box
- `height` (number): Height of bounding box

**Validation Rules**:
- All coordinates must be non-negative
- Width and height must be positive (> 0)

**Relationships**:
- Used by Table Structure, Table Cell entities

---

### 5. Detection Result

**Purpose**: Outcome of table detection for a PDF document

**Fields**:
- `tables` (TableStructure[]): Array of detected tables
- `confidence` (number): Overall detection confidence (0-1)
- `method` ('lattice' | 'stream' | 'none'): Primary detection method used
- `tableCount` (number): Number of tables detected
- `warnings` (string[]): Detection warnings or notes
- `fallbackUsed` (boolean): Whether text extraction fallback was used

**Validation Rules** (from FR-008, FR-012):
- Must always succeed (no exceptions thrown)
- If detection fails, tableCount = 0 and fallbackUsed = true
- Warnings must be non-empty array if confidence < 0.8 or partial detection occurred

**Relationships**:
- Contains multiple Table Structure entities
- Referenced in PDF conversion metadata (frontmatter)

**State Tracking**:
```
Initial → Detecting (analysis in progress)
Detecting → Complete (tables found, confidence >= 0.7)
Detecting → Fallback (no tables found or confidence < 0.7)
Complete → Metadata Added (frontmatter updated)
```

---

## Data Flow

### Table Detection Pipeline

```
PDF Document (pdf-parse output)
    ↓
Text Items with Position Data (x, y, width, height, text)
    ↓
Table Detection Algorithm
    ├─ Lattice Detection (check for lines/borders)
    ├─ Stream Detection (analyze spacing patterns)
    └─ Confidence Scoring
    ↓
Detection Result
    ├─ tables: TableStructure[]
    ├─ confidence: number
    └─ method: string
    ↓
Table Structure Validation
    ├─ Check row count (>= 2)
    ├─ Check column consistency
    └─ Check confidence threshold (>= 0.7)
    ↓
Markdown Table Conversion
    ├─ Generate header row
    ├─ Generate alignment separators
    ├─ Generate data rows
    └─ Escape special characters
    ↓
Markdown Output with Metadata
    └─ Frontmatter: tablesDetected, tableCount, detectionMethod
```

---

## Metadata Schema (Frontmatter)

**Enhanced PDF frontmatter** (from FR-012):

```yaml
---
source: document.pdf
sourceFormat: pdf
processed: 2025-11-16T14:30:00Z
anonymised: true
piiModel: Xenova/distilbert-base-multilingual-cased-ner-hrl
pageCount: 5
conversionWarnings: 0
tablesDetected: true          # NEW
tableCount: 3                 # NEW
tableDetectionMethod: lattice # NEW
tableDetectionConfidence: 0.92 # NEW
---
```

---

## Constraints & Invariants

### From Functional Requirements

**FR-003**: Table structure preservation
- `TableStructure.rows.length >= 2` (minimum 2 rows)
- All `TableRow.cells.length` must be equal (consistent column count)

**FR-004**: Multi-page table handling
- Tables spanning pages must be merged into single `TableStructure`
- Page span tracked in metadata: `pageStart`, `pageEnd` fields

**FR-007**: No data loss
- All cell content must be preserved in `TableCell.content`
- Empty cells represented as `""` not null or undefined

**FR-011**: Empty cell handling
- `TableCell.content === ""` is valid
- Empty cells render as `| |` in Markdown

**FR-014**: Variable column widths
- `TableCell.bbox.width` may vary across cells in same column
- Column alignment based on content type, not width

---

## Success Criteria Mapping

| Success Criteria | Data Model Validation |
|------------------|----------------------|
| SC-001: 95% detection accuracy (simple tables) | `DetectionResult.confidence >= 0.95` for bordered tables |
| SC-005: 80% detection accuracy (borderless) | `DetectionResult.confidence >= 0.80` for stream-detected tables |
| SC-007: 90% alignment accuracy | `TableCell.alignment` matches content type in 90% of cells |
| SC-008: 100% graceful degradation | `DetectionResult` always returns (never throws), `fallbackUsed: true` on failures |

---

## Type Definitions (TypeScript)

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
```

---

## Edge Cases & Handling

### Merged Cells (from spec.md Edge Cases)
- **Detection**: Single text item spanning multiple column positions
- **Handling**: Duplicate cell content across merged columns with note in warnings
- **Data Model**: `TableCell` may have `mergedColumnSpan?: number` field (optional)

### Pipe Characters in Content (from Edge Cases)
- **Detection**: Content contains `|` character
- **Handling**: Escape as `\|` during Markdown generation
- **Validation**: Pre-conversion check for pipes in `TableCell.content`

### Rotated Tables (from Edge Cases)
- **Detection**: Text rotation metadata from pdf-parse
- **Handling**: Skip rotation detection in Phase 1 (document limitation)
- **Data Model**: `TableStructure.rotated?: boolean` field for future use

### Nested Tables (from Edge Cases)
- **Detection**: Table bbox entirely within another table bbox
- **Handling**: Reject nested tables, keep outer table only
- **Validation**: Check bbox containment during structure validation

---

## Testing Data Requirements

### Unit Test Fixtures

**Simple Bordered Table** (for SC-001):
```typescript
const simpleBorderedTable: TableStructure = {
  page: 1,
  rows: [
    {
      cells: [
        { content: 'Name', alignment: 'left', bbox: {...}, isNumeric: false },
        { content: 'Age', alignment: 'left', bbox: {...}, isNumeric: false },
      ],
      isHeader: true,
      y: 100
    },
    {
      cells: [
        { content: 'John Doe', alignment: 'left', bbox: {...}, isNumeric: false },
        { content: '30', alignment: 'right', bbox: {...}, isNumeric: true },
      ],
      isHeader: false,
      y: 120
    }
  ],
  bbox: { x: 50, y: 100, width: 200, height: 40 },
  confidence: 0.98,
  method: 'lattice'
};
```

**Borderless Table** (for SC-005):
```typescript
const borderlessTable: TableStructure = {
  page: 1,
  rows: [
    // Similar structure but method: 'stream'
  ],
  bbox: {...},
  confidence: 0.85,
  method: 'stream'
};
```

---

## Migration & Compatibility

**Backward Compatibility** (from FR-009):
- Existing PDF conversion without tables continues to work
- If no tables detected: `tablesDetected: false`, `tableCount: 0`
- Non-table content processed through existing heuristic detection
- All existing frontmatter fields preserved

**Forward Compatibility**:
- New frontmatter fields optional and ignored by older parsers
- Detection Result structure versioned for future enhancements
- Table detection can be disabled via configuration flag (future feature)
