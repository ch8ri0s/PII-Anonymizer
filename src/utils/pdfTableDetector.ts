/**
 * PDF Table Detection and Markdown Conversion
 *
 * This module provides functionality for detecting tables in PDF documents
 * and converting them to GitHub Flavored Markdown format.
 *
 * Key Features:
 * - Zero-dependency table detection using pdf-parse metadata
 * - Graceful degradation with fallback to text extraction
 * - Support for bordered (lattice) and borderless (stream) tables
 * - Proper Markdown formatting with alignment and escaping
 *
 * @module pdfTableDetector
 */

import type {
  PdfTextItem,
  PdfTableDetectionResult as DetectionResult,
  TableStructure,
  TableRow,
  TableCell,
  BoundingBox,
  Alignment,
} from '../types/index.js';

/**
 * TableDetector: Core table detection class
 *
 * Analyzes pdf-parse text items to identify table structures using
 * position metadata (x, y coordinates and dimensions).
 */
export class TableDetector {
  /**
   * Detect tables in PDF text items
   *
   * Main entry point for table detection. Implements graceful fallback:
   * 1. Try lattice detection (bordered tables)
   * 2. Fall back to stream detection (borderless tables)
   * 3. Fall back to text extraction if neither works
   *
   * @param items - Array of PdfTextItem objects from pdf-parse
   * @returns DetectionResult with detected tables or fallback state
   * @throws Never throws - implements comprehensive error handling
   */
  detectTables(items: PdfTextItem[]): DetectionResult {
    try {
      // Input validation: handle null, undefined, or empty arrays gracefully
      if (!items || items.length === 0) {
        return this.createFallbackResult('No text items provided for analysis');
      }

      // Phase 1: Try lattice detection (bordered tables)
      const latticeResult = this.detectLattice(items);

      // Phase 2: Try stream detection (borderless tables)
      const streamResult = this.detectStream(items);

      // Choose the best detection method based on heuristics
      const bestResult = this.chooseBestDetectionMethod(items, latticeResult, streamResult);

      // If a valid result was found with high confidence, return it
      if (bestResult.tables.length > 0 && bestResult.confidence >= 0.7) {
        return bestResult;
      }

      // T066: Check for low-confidence detections (0.5-0.7 range)
      // Add warning for borderline cases where detection may be unreliable
      if (bestResult.tables.length > 0 && bestResult.confidence >= 0.5 && bestResult.confidence < 0.7) {
        return this.createLowConfidenceResult(bestResult);
      }

      // Phase 3: No tables detected - fall back to text extraction
      return this.createFallbackResult('No table structures detected with sufficient confidence');
    } catch (error) {
      // Graceful error handling: never throw, always return fallback
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error during table detection';
      return this.createFallbackResult(`Detection error: ${errorMessage}`);
    }
  }

  /**
   * Choose the best detection method between lattice and stream
   *
   * Uses heuristics to determine whether a table is bordered (lattice)
   * or borderless (stream):
   * - Larger gaps between columns favor stream detection
   * - Tight, regular spacing favors lattice detection
   * - Presence of numeric data with currency symbols favors stream
   *
   * @param items - Original text items
   * @param latticeResult - Result from lattice detection
   * @param streamResult - Result from stream detection
   * @returns The most appropriate detection result
   * @private
   */
  private chooseBestDetectionMethod(
    items: PdfTextItem[],
    latticeResult: DetectionResult,
    streamResult: DetectionResult,
  ): DetectionResult {
    const latticeValid = latticeResult.tables.length > 0 && latticeResult.confidence >= 0.7;
    const streamValid = streamResult.tables.length > 0 && streamResult.confidence >= 0.7;

    // If only one method succeeded, use it
    if (latticeValid && !streamValid) {
      return latticeResult;
    }
    if (streamValid && !latticeValid) {
      return streamResult;
    }
    if (!latticeValid && !streamValid) {
      return latticeResult; // Return lattice for consistent warnings
    }

    // Both methods found valid tables - use heuristics to choose
    // Calculate average gap between columns
    const avgColumnGap = this.calculateAverageColumnGap(items);

    // Calculate percentage of cells with currency/numeric content
    const numericRatio = this.calculateNumericCellRatio(items);

    // Heuristics:
    // 1. Large gaps (>50 pixels) between columns suggest borderless/stream tables
    // 2. High numeric content ratio (>30%) suggests financial/data tables (often stream)
    // 3. Stream detection is preferred when data appears to use whitespace for alignment

    const prefersStream = avgColumnGap > 50 || numericRatio > 0.3;

    if (prefersStream) {
      return streamResult;
    }

    // Default to lattice if heuristics don't favor stream
    // But compare confidence scores if close
    if (streamResult.confidence > latticeResult.confidence + 0.1) {
      return streamResult;
    }

    return latticeResult;
  }

  /**
   * Calculate average gap between columns in the text items
   *
   * @param items - Array of PdfTextItem objects
   * @returns Average horizontal gap between adjacent text items in same row
   * @private
   */
  private calculateAverageColumnGap(items: PdfTextItem[]): number {
    const Y_TOLERANCE = 5;

    // Group items by row
    const rowMap = new Map<number, PdfTextItem[]>();
    for (const item of items) {
      let foundRow = false;
      for (const [y, rowItems] of rowMap.entries()) {
        if (Math.abs(item.y - y) <= Y_TOLERANCE) {
          rowItems.push(item);
          foundRow = true;
          break;
        }
      }
      if (!foundRow) {
        rowMap.set(item.y, [item]);
      }
    }

    // Calculate gaps between adjacent items in each row
    const gaps: number[] = [];
    for (const rowItems of rowMap.values()) {
      if (rowItems.length < 2) continue;

      // Sort by x-coordinate
      const sorted = rowItems.sort((a, b) => a.x - b.x);

      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (prev && curr) {
          const gap = curr.x - (prev.x + prev.width);
          if (gap > 0) {
            gaps.push(gap);
          }
        }
      }
    }

    if (gaps.length === 0) {
      return 0;
    }

    return gaps.reduce((a, b) => a + b, 0) / gaps.length;
  }

  /**
   * Calculate the ratio of numeric/currency cells in the data
   *
   * @param items - Array of PdfTextItem objects
   * @returns Ratio of numeric cells (0-1)
   * @private
   */
  private calculateNumericCellRatio(items: PdfTextItem[]): number {
    let numericCount = 0;
    let totalCount = 0;

    for (const item of items) {
      if (item.str.trim().length > 0) {
        totalCount++;
        if (this.isNumericContent(item.str)) {
          numericCount++;
        }
      }
    }

    if (totalCount === 0) {
      return 0;
    }

    return numericCount / totalCount;
  }

  /**
   * Detect bordered tables using lattice detection algorithm
   *
   * Lattice detection works by identifying consistent horizontal and vertical
   * lines in the text layout, then clustering text items into grid cells.
   *
   * @param items - Array of PdfTextItem objects
   * @returns DetectionResult with lattice-detected tables
   * @private
   */
  private detectLattice(items: PdfTextItem[]): DetectionResult {
    try {
      // T024: Detect horizontal lines (y-coordinates with multiple items)
      const horizontalLines = this.detectHorizontalLines(items);

      // T025: Detect vertical lines (x-coordinates with consistent spacing)
      const verticalLines = this.detectVerticalLines(items);

      // Need at least 2 horizontal and 2 vertical lines for a table
      if (horizontalLines.length < 2 || verticalLines.length < 2) {
        return {
          tables: [],
          confidence: 0,
          method: 'lattice',
          tableCount: 0,
          warnings: ['Insufficient grid structure detected for lattice method'],
          fallbackUsed: false,
        };
      }

      // T026: Cluster text items into grid cells
      const table = this.buildTableFromGrid(items, horizontalLines, verticalLines);

      // Additional check: Reject if cells contain long flowing text (likely columnar layout, not table)
      if (this.isColumnarText(table)) {
        return {
          tables: [],
          confidence: 0,
          method: 'lattice',
          tableCount: 0,
          warnings: ['Detected structure appears to be columnar text, not a table'],
          fallbackUsed: false,
        };
      }

      // T030: Validate the detected table
      if (!this.validateTable(table)) {
        return {
          tables: [],
          confidence: 0,
          method: 'lattice',
          tableCount: 0,
          warnings: ['Detected structure failed table validation'],
          fallbackUsed: false,
        };
      }

      return {
        tables: [table],
        confidence: table.confidence,
        method: 'lattice',
        tableCount: 1,
        warnings: [],
        fallbackUsed: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error in lattice detection';
      return {
        tables: [],
        confidence: 0,
        method: 'lattice',
        tableCount: 0,
        warnings: [errorMessage],
        fallbackUsed: false,
      };
    }
  }

  /**
   * Detect horizontal lines in the text layout (T024)
   *
   * Identifies y-coordinates where multiple text items are aligned,
   * indicating potential table rows.
   *
   * @param items - Array of PdfTextItem objects
   * @returns Array of y-coordinates representing horizontal lines
   * @private
   */
  private detectHorizontalLines(items: PdfTextItem[]): number[] {
    const Y_TOLERANCE = 2; // Allow 2 pixel variance for alignment
    const yCoordinates = new Map<number, number>(); // y -> count

    // Count items at each y-coordinate (with tolerance)
    for (const item of items) {
      let found = false;
      for (const [y, count] of yCoordinates.entries()) {
        if (Math.abs(item.y - y) <= Y_TOLERANCE) {
          yCoordinates.set(y, count + 1);
          found = true;
          break;
        }
      }
      if (!found) {
        yCoordinates.set(item.y, 1);
      }
    }

    // Filter to only y-coordinates with multiple items (likely row boundaries)
    const horizontalLines = Array.from(yCoordinates.entries())
      .filter(([, count]) => count >= 2) // At least 2 items = row
      .map(([y]) => y)
      .sort((a, b) => b - a); // Sort descending (PDF y increases downward)

    return horizontalLines;
  }

  /**
   * Detect vertical lines in the text layout (T025)
   *
   * Identifies x-coordinates where text items are consistently aligned,
   * indicating potential table columns.
   *
   * @param items - Array of PdfTextItem objects
   * @returns Array of x-coordinates representing vertical lines
   * @private
   */
  private detectVerticalLines(items: PdfTextItem[]): number[] {
    const X_TOLERANCE = 3; // Allow 3 pixel variance for alignment
    const xCoordinates = new Map<number, number>(); // x -> count

    // Count items at each x-coordinate (with tolerance)
    for (const item of items) {
      let found = false;
      for (const [x, count] of xCoordinates.entries()) {
        if (Math.abs(item.x - x) <= X_TOLERANCE) {
          xCoordinates.set(x, count + 1);
          found = true;
          break;
        }
      }
      if (!found) {
        xCoordinates.set(item.x, 1);
      }
    }

    // Filter to only x-coordinates with multiple items (likely column boundaries)
    const verticalLines = Array.from(xCoordinates.entries())
      .filter(([, count]) => count >= 2) // At least 2 items = column
      .map(([x]) => x)
      .sort((a, b) => a - b); // Sort ascending (left to right)

    return verticalLines;
  }

  /**
   * Build table structure from detected grid lines (T026-T030)
   *
   * Clusters text items into cells based on horizontal and vertical lines,
   * identifies headers, calculates confidence, and validates structure.
   *
   * @param items - Array of PdfTextItem objects
   * @param horizontalLines - Y-coordinates of horizontal grid lines
   * @param verticalLines - X-coordinates of vertical grid lines
   * @returns TableStructure with detected table
   * @private
   */
  private buildTableFromGrid(
    items: PdfTextItem[],
    horizontalLines: number[],
    verticalLines: number[],
  ): TableStructure {
    const Y_TOLERANCE = 2;
    const X_TOLERANCE = 3;

    // Initialize empty grid
    const rows: TableRow[] = [];

    // T026: Cluster items into grid cells
    for (let rowIndex = 0; rowIndex < horizontalLines.length; rowIndex++) {
      const y = horizontalLines[rowIndex];
      if (y === undefined) continue; // Skip undefined rows

      const cells: TableCell[] = [];

      // For each column, find items in this row
      for (let colIndex = 0; colIndex < verticalLines.length; colIndex++) {
        const x = verticalLines[colIndex];
        if (x === undefined) continue; // Skip undefined columns

        // Find all items that belong to this cell
        const cellItems = items.filter(item =>
          Math.abs(item.y - y) <= Y_TOLERANCE &&
          Math.abs(item.x - x) <= X_TOLERANCE,
        );

        // Combine text content from all items in this cell
        const content = cellItems.map(item => item.str).join(' ');

        // T029: Detect numeric content for alignment
        const isNumeric = this.isNumericContent(content);
        const alignment: Alignment = isNumeric ? 'right' : 'left';

        // Calculate cell bounding box
        const cellBbox: BoundingBox = cellItems.length > 0
          ? {
            x: Math.min(...cellItems.map(i => i.x)),
            y: Math.min(...cellItems.map(i => i.y)),
            width: Math.max(...cellItems.map(i => i.x + i.width)) - Math.min(...cellItems.map(i => i.x)),
            height: Math.max(...cellItems.map(i => i.y + i.height)) - Math.min(...cellItems.map(i => i.y)),
          }
          : { x, y, width: 0, height: 0 };

        cells.push({
          content,
          alignment,
          bbox: cellBbox,
          isNumeric,
        });
      }

      // T028: Detect header row (first row or bold font)
      const isHeader = rowIndex === 0 || this.isHeaderRow(items, y, Y_TOLERANCE);

      rows.push({
        cells,
        isHeader,
        y,
      });
    }

    // T027: Calculate overall table bounding box
    const allX = items.map(i => i.x);
    const allY = items.map(i => i.y);
    const allWidths = items.map(i => i.x + i.width);
    const allHeights = items.map(i => i.y + i.height);

    const tableBbox: BoundingBox = {
      x: Math.min(...allX),
      y: Math.min(...allY),
      width: Math.max(...allWidths) - Math.min(...allX),
      height: Math.max(...allHeights) - Math.min(...allY),
    };

    // T029: Calculate confidence score based on grid regularity
    const confidence = this.calculateLatticeConfidence(horizontalLines, verticalLines, rows);

    return {
      page: 1, // TODO: Extract from pdf-parse metadata when available
      rows,
      bbox: tableBbox,
      confidence,
      method: 'lattice',
    };
  }

  /**
   * Detect if table structure is actually columnar text (false positive)
   *
   * Columnar text characteristics:
   * - Very long cell content (>50 characters on average)
   * - Mostly text (not numeric or short labels)
   * - Sentence-like content with punctuation
   *
   * @param table - TableStructure to check
   * @returns true if structure appears to be columnar text, not a table
   * @private
   */
  private isColumnarText(table: TableStructure): boolean {
    // Calculate average cell content length
    let totalLength = 0;
    let cellCount = 0;
    let sentenceCount = 0;

    for (const row of table.rows) {
      for (const cell of row.cells) {
        totalLength += cell.content.length;
        cellCount++;

        // Check for sentence-like content (ends with period, contains commas)
        if (cell.content.includes('.') || cell.content.includes(',')) {
          sentenceCount++;
        }
      }
    }

    const avgLength = cellCount > 0 ? totalLength / cellCount : 0;

    // If average cell length > 40 characters and > 50% cells contain punctuation,
    // this is likely columnar text, not a table
    return avgLength > 40 && sentenceCount > cellCount * 0.5;
  }

  /**
   * Detect if a row is a header row based on font properties (T028)
   *
   * @param items - All text items
   * @param y - Y-coordinate of the row
   * @param tolerance - Y-coordinate tolerance
   * @returns true if row appears to be a header
   * @private
   */
  private isHeaderRow(items: PdfTextItem[], y: number, tolerance: number): boolean {
    const rowItems = items.filter(item => Math.abs(item.y - y) <= tolerance);

    // Check if majority of items have "Bold" in font name
    const boldCount = rowItems.filter(item =>
      item.fontName?.toLowerCase().includes('bold'),
    ).length;

    return boldCount > rowItems.length / 2;
  }

  /**
   * Check if content is primarily numeric (T029)
   *
   * @param content - Cell content string
   * @returns true if content is numeric (for right-alignment)
   * @private
   */
  private isNumericContent(content: string): boolean {
    // Remove common formatting characters
    const cleaned = content.replace(/[$,\s]/g, '');

    // Check if remaining content is mostly digits
    const digitCount = (cleaned.match(/\d/g) || []).length;
    return digitCount > cleaned.length * 0.6;
  }

  /**
   * Calculate confidence score for lattice detection (T029)
   *
   * Higher confidence for:
   * - Regular grid spacing
   * - Consistent row/column counts
   * - Clear header detection
   *
   * @param horizontalLines - Detected horizontal lines
   * @param verticalLines - Detected vertical lines
   * @param rows - Detected table rows
   * @returns Confidence score (0-1)
   * @private
   */
  private calculateLatticeConfidence(
    horizontalLines: number[],
    verticalLines: number[],
    rows: TableRow[],
  ): number {
    let confidence = 0.7; // Base confidence for lattice detection

    // Bonus for regular horizontal spacing
    if (horizontalLines.length >= 3) {
      const spacings: number[] = [];
      for (let i = 1; i < horizontalLines.length; i++) {
        const curr = horizontalLines[i];
        const prev = horizontalLines[i - 1];
        if (curr !== undefined && prev !== undefined) {
          spacings.push(Math.abs(curr - prev));
        }
      }
      if (spacings.length > 0) {
        const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
        const variance = spacings.reduce((sum, s) => sum + Math.abs(s - avgSpacing), 0) / spacings.length;

        if (variance < avgSpacing * 0.2) {
          confidence += 0.1; // Regular spacing bonus
        }
      }
    }

    // Bonus for regular vertical spacing
    if (verticalLines.length >= 3) {
      const spacings: number[] = [];
      for (let i = 1; i < verticalLines.length; i++) {
        const curr = verticalLines[i];
        const prev = verticalLines[i - 1];
        if (curr !== undefined && prev !== undefined) {
          spacings.push(Math.abs(curr - prev));
        }
      }
      if (spacings.length > 0) {
        const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
        const variance = spacings.reduce((sum, s) => sum + Math.abs(s - avgSpacing), 0) / spacings.length;

        if (variance < avgSpacing * 0.2) {
          confidence += 0.1; // Regular spacing bonus
        }
      }
    }

    // Bonus for detected header row
    const hasHeader = rows.some(row => row.isHeader);
    if (hasHeader) {
      confidence += 0.05;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Detect borderless tables using stream detection algorithm (T054-T058)
   *
   * Stream detection works by identifying consistent spacing patterns in
   * the text layout. Unlike lattice detection which looks for grid lines,
   * stream detection uses:
   * 1. Consistent x-coordinate clustering to find column boundaries
   * 2. Consistent y-coordinate gaps to find row boundaries
   * 3. Whitespace analysis between text items
   *
   * @param items - Array of PdfTextItem objects
   * @returns DetectionResult with stream-detected tables
   * @private
   */
  private detectStream(items: PdfTextItem[]): DetectionResult {
    try {
      // T054: Identify column boundaries from whitespace patterns
      const columnBoundaries = this.findColumnBoundaries(items);

      // Need at least 2 columns for a valid table
      if (columnBoundaries.length < 2) {
        return {
          tables: [],
          confidence: 0,
          method: 'stream',
          tableCount: 0,
          warnings: ['Insufficient column boundaries detected for stream method'],
          fallbackUsed: false,
        };
      }

      // T055: Find row groupings based on y-coordinate clustering
      const rowGroups = this.findRowGroups(items);

      // Need at least 2 rows for a valid table
      if (rowGroups.length < 2) {
        return {
          tables: [],
          confidence: 0,
          method: 'stream',
          tableCount: 0,
          warnings: ['Insufficient row groups detected for stream method'],
          fallbackUsed: false,
        };
      }

      // T056: Build table structure from stream-detected boundaries
      const table = this.buildTableFromStream(items, columnBoundaries, rowGroups);

      // Check for columnar text (false positive)
      if (this.isColumnarText(table)) {
        return {
          tables: [],
          confidence: 0,
          method: 'stream',
          tableCount: 0,
          warnings: ['Detected structure appears to be columnar text, not a table'],
          fallbackUsed: false,
        };
      }

      // T057: Validate the detected table
      if (!this.validateTable(table)) {
        return {
          tables: [],
          confidence: 0,
          method: 'stream',
          tableCount: 0,
          warnings: ['Detected structure failed table validation'],
          fallbackUsed: false,
        };
      }

      return {
        tables: [table],
        confidence: table.confidence,
        method: 'stream',
        tableCount: 1,
        warnings: [],
        fallbackUsed: false,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error in stream detection';
      return {
        tables: [],
        confidence: 0,
        method: 'stream',
        tableCount: 0,
        warnings: [errorMessage],
        fallbackUsed: false,
      };
    }
  }

  /**
   * Find column boundaries using whitespace analysis (T054)
   *
   * Uses gap analysis between text items to identify column separations.
   * Column boundaries are defined by consistent large gaps between items
   * across multiple rows.
   *
   * @param items - Array of PdfTextItem objects
   * @returns Array of x-coordinates representing column start positions
   * @private
   */
  private findColumnBoundaries(items: PdfTextItem[]): number[] {
    const X_TOLERANCE = 5; // Tolerance for clustering x-coordinates

    // Collect all unique x-coordinate start positions
    const xPositions = new Map<number, number>(); // x -> count

    for (const item of items) {
      let found = false;
      for (const [x, count] of xPositions.entries()) {
        if (Math.abs(item.x - x) <= X_TOLERANCE) {
          xPositions.set(x, count + 1);
          found = true;
          break;
        }
      }
      if (!found) {
        xPositions.set(item.x, 1);
      }
    }

    // Sort and filter to get consistent column positions
    // Require at least 2 items at each position (multiple rows)
    const boundaries = Array.from(xPositions.entries())
      .filter(([, count]) => count >= 2)
      .map(([x]) => x)
      .sort((a, b) => a - b);

    return boundaries;
  }

  /**
   * Find row groupings based on y-coordinate clustering (T055)
   *
   * Groups text items into rows based on similar y-coordinates.
   * Handles varying row heights by using a tolerance value.
   *
   * @param items - Array of PdfTextItem objects
   * @returns Array of y-coordinates representing row positions
   * @private
   */
  private findRowGroups(items: PdfTextItem[]): number[] {
    const Y_TOLERANCE = 5; // Larger tolerance for row detection in stream mode

    // Collect all unique y-coordinates
    const yPositions = new Map<number, number>(); // y -> count

    for (const item of items) {
      let found = false;
      for (const [y, count] of yPositions.entries()) {
        if (Math.abs(item.y - y) <= Y_TOLERANCE) {
          yPositions.set(y, count + 1);
          found = true;
          break;
        }
      }
      if (!found) {
        yPositions.set(item.y, 1);
      }
    }

    // Sort descending (PDF y increases downward, top rows have higher y)
    // Require at least 2 items per row for table detection
    const rows = Array.from(yPositions.entries())
      .filter(([, count]) => count >= 2)
      .map(([y]) => y)
      .sort((a, b) => b - a);

    return rows;
  }

  /**
   * Build table structure from stream-detected boundaries (T056, T057)
   *
   * @param items - Array of PdfTextItem objects
   * @param columnBoundaries - X-coordinates of column start positions
   * @param rowGroups - Y-coordinates of row positions
   * @returns TableStructure with stream-detected table
   * @private
   */
  private buildTableFromStream(
    items: PdfTextItem[],
    columnBoundaries: number[],
    rowGroups: number[],
  ): TableStructure {
    const Y_TOLERANCE = 5;
    const X_TOLERANCE = 5;

    const rows: TableRow[] = [];

    // Process each row
    for (let rowIndex = 0; rowIndex < rowGroups.length; rowIndex++) {
      const y = rowGroups[rowIndex];
      if (y === undefined) continue;

      const cells: TableCell[] = [];

      // Get items in this row
      const rowItems = items.filter(item => Math.abs(item.y - y) <= Y_TOLERANCE);

      // Assign items to columns based on column boundaries
      for (let colIndex = 0; colIndex < columnBoundaries.length; colIndex++) {
        const colStart = columnBoundaries[colIndex];
        const colEnd = columnBoundaries[colIndex + 1] ?? Infinity;
        if (colStart === undefined) continue;

        // Find items belonging to this column
        const cellItems = rowItems.filter(item => {
          const itemCenter = item.x + item.width / 2;
          // Item belongs to column if its start is within tolerance of column start
          // OR its center falls between this column's start and next column's start
          return Math.abs(item.x - colStart) <= X_TOLERANCE ||
            (itemCenter >= colStart && itemCenter < colEnd);
        });

        // Combine text content
        const content = cellItems
          .sort((a, b) => a.x - b.x) // Sort left to right
          .map(item => item.str)
          .join(' ')
          .trim();

        // Detect numeric content for alignment
        const isNumeric = this.isNumericContent(content);
        const alignment: Alignment = isNumeric ? 'right' : 'left';

        // Calculate cell bounding box
        const cellBbox: BoundingBox = cellItems.length > 0
          ? {
            x: Math.min(...cellItems.map(i => i.x)),
            y: Math.min(...cellItems.map(i => i.y)),
            width: Math.max(...cellItems.map(i => i.x + i.width)) - Math.min(...cellItems.map(i => i.x)),
            height: Math.max(...cellItems.map(i => i.y + i.height)) - Math.min(...cellItems.map(i => i.y)),
          }
          : { x: colStart, y, width: 0, height: 0 };

        cells.push({
          content,
          alignment,
          bbox: cellBbox,
          isNumeric,
        });
      }

      // Detect header row (first row or bold font)
      const isHeader = rowIndex === 0 || this.isHeaderRow(rowItems, y, Y_TOLERANCE);

      rows.push({
        cells,
        isHeader,
        y,
      });
    }

    // Calculate overall table bounding box
    const allX = items.map(i => i.x);
    const allY = items.map(i => i.y);
    const allWidths = items.map(i => i.x + i.width);
    const allHeights = items.map(i => i.y + i.height);

    const tableBbox: BoundingBox = {
      x: Math.min(...allX),
      y: Math.min(...allY),
      width: Math.max(...allWidths) - Math.min(...allX),
      height: Math.max(...allHeights) - Math.min(...allY),
    };

    // Calculate confidence for stream detection
    const confidence = this.calculateStreamConfidence(columnBoundaries, rowGroups, rows);

    return {
      page: 1,
      rows,
      bbox: tableBbox,
      confidence,
      method: 'stream',
    };
  }

  /**
   * Calculate confidence score for stream detection (T058)
   *
   * Stream detection typically has lower confidence than lattice
   * due to the absence of visible borders. Factors:
   * - Consistent column widths
   * - Regular row spacing
   * - Column count consistency across rows
   * - Presence of numeric data patterns
   *
   * @param columnBoundaries - Detected column boundaries
   * @param rowGroups - Detected row groups
   * @param rows - Detected table rows
   * @returns Confidence score (0-1)
   * @private
   */
  private calculateStreamConfidence(
    columnBoundaries: number[],
    rowGroups: number[],
    rows: TableRow[],
  ): number {
    let confidence = 0.65; // Base confidence for stream detection (lower than lattice)

    // Bonus for consistent column widths
    if (columnBoundaries.length >= 3) {
      const widths: number[] = [];
      for (let i = 1; i < columnBoundaries.length; i++) {
        const curr = columnBoundaries[i];
        const prev = columnBoundaries[i - 1];
        if (curr !== undefined && prev !== undefined) {
          widths.push(curr - prev);
        }
      }
      if (widths.length > 0) {
        const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;
        const variance = widths.reduce((sum, w) => sum + Math.abs(w - avgWidth), 0) / widths.length;

        // More lenient variance for stream (column widths vary more)
        if (variance < avgWidth * 0.4) {
          confidence += 0.08;
        }
      }
    }

    // Bonus for regular row spacing
    if (rowGroups.length >= 3) {
      const spacings: number[] = [];
      for (let i = 1; i < rowGroups.length; i++) {
        const curr = rowGroups[i];
        const prev = rowGroups[i - 1];
        if (curr !== undefined && prev !== undefined) {
          spacings.push(Math.abs(curr - prev));
        }
      }
      if (spacings.length > 0) {
        const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length;
        const variance = spacings.reduce((sum, s) => sum + Math.abs(s - avgSpacing), 0) / spacings.length;

        if (variance < avgSpacing * 0.3) {
          confidence += 0.08;
        }
      }
    }

    // Bonus for consistent column count across rows
    if (rows.length >= 2) {
      const firstRowCols = rows[0]?.cells.length ?? 0;
      const consistentRows = rows.filter(row => row.cells.length === firstRowCols).length;
      if (consistentRows === rows.length) {
        confidence += 0.1;
      }
    }

    // Bonus for detected header row
    const hasHeader = rows.some(row => row.isHeader);
    if (hasHeader) {
      confidence += 0.05;
    }

    // Bonus for presence of numeric data (common in tables)
    const numericCells = rows.flatMap(row => row.cells).filter(cell => cell.isNumeric).length;
    const totalCells = rows.flatMap(row => row.cells).length;
    if (totalCells > 0 && numericCells / totalCells > 0.2) {
      confidence += 0.04;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Validate table structure meets minimum requirements
   *
   * Checks that detected tables are valid according to FR-003:
   * - At least 2 rows (including header)
   * - At least 2 columns
   * - Confidence score >= 0.7
   * - All rows have consistent column count
   *
   * @param table - TableStructure to validate
   * @returns true if valid, false otherwise
   */
  validateTable(table: TableStructure): boolean {
    // Minimum 2 rows (FR-003)
    if (table.rows.length < 2) {
      return false;
    }

    // At least one row should have cells
    const firstRow = table.rows[0];
    if (!firstRow || !firstRow.cells || firstRow.cells.length < 2) {
      return false;
    }

    // Minimum 2 columns (FR-003)
    const columnCount = firstRow.cells.length;
    if (columnCount < 2) {
      return false;
    }

    // Confidence threshold (FR-003)
    if (table.confidence < 0.7) {
      return false;
    }

    // Column consistency check: all rows should have same column count
    for (const row of table.rows) {
      if (row.cells.length !== columnCount) {
        return false;
      }
    }

    return true;
  }

  /**
   * Merge tables that span multiple pages (T036, T037)
   *
   * Combines tables across pages when they have:
   * - Same column count
   * - Matching header structure (detected via content similarity)
   * - Sequential page numbers
   *
   * FR-004: Multi-page table support
   *
   * @param tables - Array of TableStructure objects to merge
   * @returns Array of merged tables (unmerged tables returned as-is)
   */
  mergeTables(tables: TableStructure[]): TableStructure[] {
    // Handle edge cases
    if (tables.length === 0) {
      return [];
    }
    if (tables.length === 1) {
      return tables;
    }

    const merged: TableStructure[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < tables.length; i++) {
      if (processed.has(i)) {
        continue;
      }

      const currentTable = tables[i];
      if (!currentTable) {
        continue;
      }

      const mergeGroup: TableStructure[] = [currentTable];
      processed.add(i);

      // Look for subsequent tables that can be merged
      for (let j = i + 1; j < tables.length; j++) {
        if (processed.has(j)) {
          continue;
        }

        const nextTable = tables[j];
        if (!nextTable) {
          continue;
        }

        // Check if tables can be merged (T037)
        if (this.canMergeTables(currentTable, nextTable)) {
          mergeGroup.push(nextTable);
          processed.add(j);
        }
      }

      // If we found tables to merge, combine them
      if (mergeGroup.length > 1) {
        merged.push(this.combineTables(mergeGroup));
      } else {
        merged.push(currentTable);
      }
    }

    return merged;
  }

  /**
   * Check if two tables can be merged (T037)
   *
   * Tables can merge if they have:
   * - Same column count
   * - Matching header structure (same content in header cells)
   *
   * @param table1 - First table
   * @param table2 - Second table
   * @returns true if tables can be merged
   * @private
   */
  private canMergeTables(table1: TableStructure, table2: TableStructure): boolean {
    // Check column count match
    const header1 = table1.rows.find(row => row.isHeader);
    const header2 = table2.rows.find(row => row.isHeader);

    if (!header1 || !header2) {
      return false;
    }

    if (header1.cells.length !== header2.cells.length) {
      return false;
    }

    // Check header content match (case-insensitive, trimmed)
    for (let i = 0; i < header1.cells.length; i++) {
      const cell1 = header1.cells[i]?.content.trim().toLowerCase();
      const cell2 = header2.cells[i]?.content.trim().toLowerCase();

      if (cell1 !== cell2) {
        return false;
      }
    }

    return true;
  }

  /**
   * Combine multiple tables into a single table (T037)
   *
   * Takes the header from the first table and combines all data rows
   * from all tables in the group.
   *
   * @param tables - Array of tables to combine
   * @returns Single merged table
   * @private
   */
  private combineTables(tables: TableStructure[]): TableStructure {
    if (tables.length === 0) {
      throw new Error('Cannot combine empty table array');
    }

    const firstTable = tables[0];
    if (!firstTable) {
      throw new Error('First table is undefined');
    }

    // Start with the header from the first table
    const header = firstTable.rows.find(row => row.isHeader);
    if (!header) {
      throw new Error('First table has no header row');
    }

    const mergedRows: TableRow[] = [header];

    // Collect all data rows from all tables
    for (const table of tables) {
      const dataRows = table.rows.filter(row => !row.isHeader);
      mergedRows.push(...dataRows);
    }

    // Calculate merged bounding box
    const allBboxes = tables.map(t => t.bbox);
    const minX = Math.min(...allBboxes.map(b => b.x));
    const minY = Math.min(...allBboxes.map(b => b.y));
    const maxX = Math.max(...allBboxes.map(b => b.x + b.width));
    const maxY = Math.max(...allBboxes.map(b => b.y + b.height));

    // Use average confidence
    const avgConfidence = tables.reduce((sum, t) => sum + t.confidence, 0) / tables.length;

    return {
      page: firstTable.page,
      rows: mergedRows,
      bbox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
      confidence: avgConfidence,
      method: firstTable.method,
    };
  }

  /**
   * Create fallback detection result
   *
   * Returns a DetectionResult indicating that table detection failed
   * and text extraction fallback should be used (FR-008 compliance).
   *
   * @param reason - Human-readable reason for fallback
   * @returns DetectionResult with fallbackUsed: true
   * @private
   */
  private createFallbackResult(reason: string): DetectionResult {
    return {
      tables: [],
      confidence: 0,
      method: 'none',
      tableCount: 0,
      warnings: [reason],
      fallbackUsed: true,
    };
  }

  /**
   * Create low-confidence detection result (T066)
   *
   * Returns a DetectionResult for tables detected with borderline confidence
   * (0.5-0.7 range). Includes the detected tables but adds a warning that
   * the detection may be unreliable and fallback text is recommended for review.
   *
   * @param result - Original detection result with low confidence
   * @returns DetectionResult with low confidence warning and fallbackUsed: true
   * @private
   */
  private createLowConfidenceResult(result: DetectionResult): DetectionResult {
    const confidencePercent = Math.round(result.confidence * 100);
    const warning = `Low confidence table detection (${confidencePercent}%). Results may be unreliable. Consider using text extraction fallback.`;

    return {
      tables: result.tables,
      confidence: result.confidence,
      method: result.method,
      tableCount: result.tableCount,
      warnings: [...result.warnings, warning],
      fallbackUsed: true, // Mark as fallback since confidence is low
    };
  }
}

/**
 * TableToMarkdownConverter: Converts detected tables to Markdown format
 *
 * Handles GitHub Flavored Markdown table generation with proper:
 * - Pipe character escaping
 * - Column alignment (left/right/center)
 * - Header row formatting
 * - Empty cell handling
 */
export class TableToMarkdownConverter {
  /**
   * Convert TableStructure to GitHub Flavored Markdown
   *
   * Orchestrates the conversion process:
   * 1. Generate header row with escaping
   * 2. Generate alignment row based on cell alignment hints
   * 3. Generate data rows with empty cell handling
   *
   * @param table - TableStructure to convert
   * @returns Markdown-formatted table string
   */
  convertTable(table: TableStructure): string {
    const lines: string[] = [];

    // Find header row (first row marked as isHeader)
    const headerRow = table.rows.find((row) => row.isHeader);
    if (!headerRow) {
      // No header row found - use first row as header
      const firstRow = table.rows[0];
      if (firstRow) {
        lines.push(this.generateHeader(firstRow));
        lines.push(this.generateAlignmentRow(firstRow.cells));
      }

      // Generate data rows (skip first row since it was used as header)
      const dataRows = table.rows.slice(1);
      for (const row of dataRows) {
        lines.push(this.generateDataRow(row));
      }
    } else {
      // Generate header row
      lines.push(this.generateHeader(headerRow));
      lines.push(this.generateAlignmentRow(headerRow.cells));

      // Generate data rows (excluding header)
      const dataRows = table.rows.filter((row) => !row.isHeader);
      for (const row of dataRows) {
        lines.push(this.generateDataRow(row));
      }
    }

    return lines.join('\n');
  }

  /**
   * Escape special Markdown characters in cell content
   *
   * Handles FR-006 compliance by escaping:
   * - Pipe characters (|) → \|
   * - Backslashes (\) → \\
   * - Newlines (\n) → <br> or space (Markdown table compatibility)
   *
   * @param content - Raw cell content
   * @returns Escaped cell content safe for Markdown
   */
  escapeCell(content: string): string {
    return (
      content
        // Escape backslashes first (must be done before escaping pipes)
        .replace(/\\/g, '\\\\')
        // Escape pipe characters
        .replace(/\|/g, '\\|')
        // Replace newlines with space (Markdown tables don't support newlines)
        .replace(/\n/g, ' ')
        // Trim whitespace for cleaner output
        .trim()
    );
  }

  /**
   * Generate alignment row (second row in Markdown table)
   *
   * Creates alignment separators based on cell alignment hints (FR-005):
   * - Left-aligned: :---
   * - Right-aligned: ---:
   * - Center-aligned: :---:
   *
   * @param cells - Array of TableCell objects with alignment hints
   * @returns Markdown alignment row string (e.g., "| :--- | ---: | :---: |")
   */
  generateAlignmentRow(cells: TableCell[]): string {
    const separators = cells.map((cell) => {
      switch (cell.alignment) {
        case 'left':
          return ':---';
        case 'right':
          return '---:';
        case 'center':
          return ':---:';
        default:
          return ':---'; // Default to left alignment
      }
    });

    return `| ${separators.join(' | ')} |`;
  }

  /**
   * Generate header row (first row in Markdown table)
   *
   * Creates the table header using escapeCell() for each cell.
   *
   * @param row - TableRow representing the header
   * @returns Markdown header row string (e.g., "| Name | Age | City |")
   */
  generateHeader(row: TableRow): string {
    const escapedCells = row.cells.map((cell) => this.escapeCell(cell.content));
    return `| ${escapedCells.join(' | ')} |`;
  }

  /**
   * Generate data row (body rows in Markdown table)
   *
   * Creates table data rows with empty cell handling (FR-011):
   * - Empty cells are rendered as a single space to maintain table structure
   * - All content is escaped using escapeCell()
   *
   * @param row - TableRow representing a data row
   * @returns Markdown data row string
   */
  generateDataRow(row: TableRow): string {
    const escapedCells = row.cells.map((cell) => {
      const escaped = this.escapeCell(cell.content);
      // Handle empty cells (FR-011): use single space to preserve table structure
      return escaped.length > 0 ? escaped : ' ';
    });
    return `| ${escapedCells.join(' | ')} |`;
  }
}
