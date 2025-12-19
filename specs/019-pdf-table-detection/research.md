# Phase 0: Research & Technology Decisions

**Feature**: PDF Table Detection and Extraction
**Date**: 2025-11-16
**Status**: Complete

## Unknown Resolved: Table Detection Library

### Decision: pdf-parse + Custom Heuristic Detection (Phase 1) → Evaluate tabula-js (Phase 2)

**Rationale**:
1. **Incremental Risk Mitigation**: Start with custom heuristics using existing pdf-parse data structures (text positions, spacing) to achieve P1 goals (simple bordered tables). This leverages existing dependencies and minimizes risk.
2. **Zero New Dependencies Initially**: Custom detection can be implemented using pdf-parse's text extraction metadata without adding new libraries, reducing security audit surface area and maintaining "no network calls" guarantee.
3. **Performance Baseline**: Establish performance benchmarks with heuristic approach before evaluating heavier libraries.
4. **Upgrade Path**: If custom heuristics achieve 80%+ accuracy for simple tables but struggle with P2 goals (borderless tables), evaluate tabula-js for Phase 2 enhancement.

**Alternatives Considered**:

#### Option A: tabula-js
- **Pros**:
  - Purpose-built for PDF table extraction
  - Battle-tested on complex tables
  - Handles borderless tables well
- **Cons**:
  - Heavy dependency (~2MB+)
  - Requires Java runtime (JVM) - **BLOCKER** for Electron desktop app (unacceptable user experience)
  - Complex installation and cross-platform distribution
- **Rejected Because**: JVM requirement incompatible with lightweight Electron app distribution. Would require users to install Java, violating "easy setup" principle.

#### Option B: pdf.js
- **Pros**:
  - Mozilla-maintained, widely used
  - Rich text positioning data
  - No external runtime dependencies
- **Cons**:
  - Large library size (~600KB minified)
  - Primarily designed for rendering, not table extraction
  - Would need custom table detection logic on top
  - Duplicate functionality with existing pdf-parse
- **Rejected Because**: Adds 600KB+ for functionality we can achieve with existing pdf-parse metadata. Custom heuristics needed either way.

#### Option C: pdf-lib
- **Pros**:
  - Modern TypeScript API
  - Good PDF manipulation capabilities
  - Active maintenance
- **Cons**:
  - Focused on PDF creation/editing, not parsing
  - Less detailed text extraction than pdf-parse
  - Would need to replace existing pdf-parse dependency
- **Rejected Because**: Not optimized for text extraction use case. Switching from pdf-parse would risk existing PDF conversion quality.

#### Option D: Custom Heuristics with pdf-parse (CHOSEN)
- **Pros**:
  - Zero new dependencies
  - Full control over detection algorithm
  - Leverages existing pdf-parse text positioning data
  - Can iterate quickly without library constraints
  - Maintains security audit surface area
- **Cons**:
  - Requires algorithm development effort
  - May not handle complex tables as well as specialized libraries
  - Borderless table detection challenging
- **Chosen Because**: Best risk/reward ratio for P1 goals. Can achieve 95% accuracy for simple bordered tables using spacing and alignment heuristics from pdf-parse metadata. If P2 goals require more sophistication, we can evaluate adding tabula-java via child process in future iteration.

### Implementation Approach

**Phase 1 (P1 - Basic Tables)**:
1. Use pdf-parse `textContent` items with position metadata (x, y, width, height)
2. Detect table boundaries using horizontal/vertical line detection or consistent spacing
3. Cluster text items into rows/columns using y-position (rows) and x-position (columns)
4. Build table structure from clustered cells
5. Convert to Markdown table format with alignment detection

**Phase 2 (P2 - Complex Tables)** - Future iteration if needed:
1. Evaluate tabula-java integration via Node child_process for complex documents
2. Implement hybrid approach: heuristics first, fallback to tabula for low-confidence detection
3. Add user preference toggle for tabula usage (optional heavy dependency)

---

## Technology Stack Confirmation

### Core Dependencies (Existing)
- **pdf-parse**: Text and metadata extraction from PDFs (MIT license)
- **marked**: Markdown validation (MIT license)

### New Dependencies (Phase 1)
- **None** - Using custom heuristic detection with existing pdf-parse data

### Testing Approach
- **Unit Tests**: Test table detection algorithm with synthetic PDF metadata
- **Integration Tests**: Test end-to-end conversion with real PDF samples
- **Test Data**: Create corpus of PDF samples (simple tables, complex tables, borderless tables, false positives)
- **Coverage Target**: 80%+ for new table detection code

### Performance Benchmarks
- **Baseline**: Current pdf-parse extraction time
- **Target**: <20% overhead with table detection enabled
- **Measurement**: Track processing time for 10 sample PDFs (5-50 pages each)

---

## Best Practices Research

### PDF Table Detection Patterns

**Industry Standard Heuristics** (used by tabula, camelot, pdfplumber):

1. **Lattice Detection** (for bordered tables):
   - Detect horizontal/vertical lines in PDF graphics streams
   - Build grid from line intersections
   - Map text items to grid cells

2. **Stream Detection** (for borderless tables):
   - Analyze text spacing patterns
   - Detect column boundaries using consistent x-positions across rows
   - Group rows by y-position clustering
   - Requires minimum spacing threshold tuning

3. **Hybrid Approach** (recommended):
   - Try lattice detection first (faster, more accurate for bordered tables)
   - Fall back to stream detection for borderless tables
   - Confidence scoring based on detection method

**Key Algorithms**:
- **DBSCAN clustering**: Group text items by spatial proximity
- **K-means clustering**: Detect column boundaries from x-position distribution
- **Whitespace analysis**: Identify consistent gaps indicating column separators

**Edge Case Handling**:
- **Merged cells**: Detect by absence of vertical lines or single text item spanning multiple column positions
- **Multi-page tables**: Track y-position resets and header repetition patterns
- **Rotated tables**: Check text rotation metadata from pdf-parse

### Markdown Table Generation Best Practices

1. **Alignment Detection**:
   - Check cell content: all numeric → right-align
   - Header cells typically left-align by default
   - Mixed content → left-align

2. **Special Character Escaping**:
   - Pipe characters `|` → `\|` or use HTML entity `&#124;`
   - Backslashes `\` → `\\`
   - Newlines within cells → replace with `<br>` or strip

3. **Empty Cell Handling**:
   - Represent as empty string between pipes: `| |`
   - Avoid null/undefined to prevent table break

4. **Table Width Optimization**:
   - GitHub Flavored Markdown supports variable column widths
   - Column width determined by content, not explicitly set
   - Use consistent spacing for readability in plain text

---

## Integration Patterns

### Converter Architecture

**Current Flow**:
```
PDF File → pdf-parse → text extraction → heuristic structure detection → Markdown
```

**Enhanced Flow**:
```
PDF File → pdf-parse → text + position metadata →
  ↓
  ├─ Table Detection (NEW)
  │   ├─ Lattice detection (bordered tables)
  │   ├─ Stream detection (borderless tables)
  │   └─ Confidence scoring
  ↓
  ├─ If tables detected:
  │   └─ Extract table structures → Markdown tables
  │
  └─ Non-table content:
      └─ Existing heuristic detection → Markdown text
```

**Interface Design**:
```typescript
interface TableDetectionResult {
  tables: DetectedTable[];
  confidence: number;
  method: 'lattice' | 'stream' | 'none';
}

interface DetectedTable {
  page: number;
  rows: TableRow[];
  bbox: { x: number; y: number; width: number; height: number };
}

interface TableRow {
  cells: TableCell[];
  isHeader: boolean;
}

interface TableCell {
  content: string;
  alignment: 'left' | 'right' | 'center';
  bbox: { x: number; y: number; width: number; height: number };
}
```

### Error Handling Strategy

1. **Detection Failures**:
   - Log warning with confidence score
   - Fall back to existing text extraction
   - Include note in Markdown output: `<!-- Table detection confidence: XX% -->`

2. **Partial Detection**:
   - Extract detected rows, mark incomplete with comment
   - Include remaining content as text below table

3. **False Positives**:
   - Minimum confidence threshold (e.g., 70%)
   - Validate table structure: minimum 2 rows, 2 columns
   - Check for consistent column count across rows

---

## Success Metrics

### Detection Accuracy Targets (from spec.md)
- **SC-001**: 95% accuracy for simple bordered tables
- **SC-005**: 80% accuracy for borderless tables
- **SC-007**: 90% accuracy for column alignment detection

### Quality Improvements
- **SC-002**: PDF conversion quality 75% → 85%+
- **SC-004**: 90% of generated tables render correctly without manual edits

### Performance Constraints
- **SC-003**: <20% processing time overhead
- **SC-008**: 100% graceful degradation (no crashes)

### Testing Corpus Requirements
- Minimum 20 test PDFs covering:
  - Simple bordered tables (5 PDFs)
  - Borderless tables (5 PDFs)
  - Multi-page tables (3 PDFs)
  - Complex tables with merged cells (3 PDFs)
  - False positive scenarios (4 PDFs - columnar text, lists, forms)

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Custom heuristics underperform (<80% accuracy) | High - doesn't meet success criteria | Medium | Phased approach allows pivot to tabula-java in Phase 2 |
| Performance overhead exceeds 20% | Medium - impacts user experience | Low | Optimize hot paths, add caching, parallelize if needed |
| False positives on columnar text | Medium - incorrect table generation | Medium | Strict confidence thresholds, validation rules (min 2x2 grid) |
| Edge cases (rotated tables, merged cells) | Low - affects minority of PDFs | High | Document limitations, provide fallback to text extraction |

---

## Next Steps (Phase 1)

1. ✅ Research complete - custom heuristics chosen
2. Create data model (data-model.md) defining table structures
3. Define API contracts (contracts/) for table detection interface
4. Generate quickstart guide for developers
5. Begin TDD implementation with table detection tests
