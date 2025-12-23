/**
 * PDF Table Detector
 *
 * Core table detection class that analyzes pdf-parse text items
 * to identify table structures using position metadata.
 *
 * Key Features:
 * - Zero-dependency table detection using pdf-parse metadata
 * - Graceful degradation with fallback to text extraction
 * - Support for bordered (lattice) and borderless (stream) tables
 *
 * @module TableDetector
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
    const avgColumnGap = this.calculateAverageColumnGap(items);
    const numericRatio = this.calculateNumericCellRatio(items);

    // Heuristics:
    // 1. Large gaps (>50 pixels) between columns suggest borderless/stream tables
    // 2. High numeric content ratio (>30%) suggests financial/data tables (often stream)
    const prefersStream = avgColumnGap > 50 || numericRatio > 0.3;

    if (prefersStream) {
      return streamResult;
    }

    // Default to lattice if heuristics don't favor stream
    if (streamResult.confidence > latticeResult.confidence + 0.1) {
      return streamResult;
    }

    return latticeResult;
  }

  /**
   * Calculate average gap between columns in the text items
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
   */
  private detectLattice(items: PdfTextItem[]): DetectionResult {
    try {
      const horizontalLines = this.detectHorizontalLines(items);
      const verticalLines = this.detectVerticalLines(items);

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

      const table = this.buildTableFromGrid(items, horizontalLines, verticalLines);

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
   * Detect horizontal lines in the text layout
   */
  private detectHorizontalLines(items: PdfTextItem[]): number[] {
    const Y_TOLERANCE = 2;
    const yCoordinates = new Map<number, number>();

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

    const horizontalLines = Array.from(yCoordinates.entries())
      .filter(([, count]) => count >= 2)
      .map(([y]) => y)
      .sort((a, b) => b - a);

    return horizontalLines;
  }

  /**
   * Detect vertical lines in the text layout
   */
  private detectVerticalLines(items: PdfTextItem[]): number[] {
    const X_TOLERANCE = 3;
    const xCoordinates = new Map<number, number>();

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

    const verticalLines = Array.from(xCoordinates.entries())
      .filter(([, count]) => count >= 2)
      .map(([x]) => x)
      .sort((a, b) => a - b);

    return verticalLines;
  }

  /**
   * Build table structure from detected grid lines
   */
  private buildTableFromGrid(
    items: PdfTextItem[],
    horizontalLines: number[],
    verticalLines: number[],
  ): TableStructure {
    const Y_TOLERANCE = 2;
    const X_TOLERANCE = 3;

    const rows: TableRow[] = [];

    for (let rowIndex = 0; rowIndex < horizontalLines.length; rowIndex++) {
      const y = horizontalLines[rowIndex];
      if (y === undefined) continue;

      const cells: TableCell[] = [];

      for (let colIndex = 0; colIndex < verticalLines.length; colIndex++) {
        const x = verticalLines[colIndex];
        if (x === undefined) continue;

        const cellItems = items.filter(item =>
          Math.abs(item.y - y) <= Y_TOLERANCE &&
          Math.abs(item.x - x) <= X_TOLERANCE,
        );

        const content = cellItems.map(item => item.str).join(' ');
        const isNumeric = this.isNumericContent(content);
        const alignment: Alignment = isNumeric ? 'right' : 'left';

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

      const isHeader = rowIndex === 0 || this.isHeaderRow(items, y, Y_TOLERANCE);

      rows.push({
        cells,
        isHeader,
        y,
      });
    }

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

    const confidence = this.calculateLatticeConfidence(horizontalLines, verticalLines, rows);

    return {
      page: 1,
      rows,
      bbox: tableBbox,
      confidence,
      method: 'lattice',
    };
  }

  /**
   * Detect if table structure is actually columnar text (false positive)
   */
  private isColumnarText(table: TableStructure): boolean {
    let totalLength = 0;
    let cellCount = 0;
    let sentenceCount = 0;

    for (const row of table.rows) {
      for (const cell of row.cells) {
        totalLength += cell.content.length;
        cellCount++;

        if (cell.content.includes('.') || cell.content.includes(',')) {
          sentenceCount++;
        }
      }
    }

    const avgLength = cellCount > 0 ? totalLength / cellCount : 0;
    return avgLength > 40 && sentenceCount > cellCount * 0.5;
  }

  /**
   * Detect if a row is a header row based on font properties
   */
  private isHeaderRow(items: PdfTextItem[], y: number, tolerance: number): boolean {
    const rowItems = items.filter(item => Math.abs(item.y - y) <= tolerance);
    const boldCount = rowItems.filter(item =>
      item.fontName?.toLowerCase().includes('bold'),
    ).length;

    return boldCount > rowItems.length / 2;
  }

  /**
   * Check if content is primarily numeric
   */
  private isNumericContent(content: string): boolean {
    const cleaned = content.replace(/[$,\s]/g, '');
    const digitCount = (cleaned.match(/\d/g) || []).length;
    return digitCount > cleaned.length * 0.6;
  }

  /**
   * Calculate confidence score for lattice detection
   */
  private calculateLatticeConfidence(
    horizontalLines: number[],
    verticalLines: number[],
    rows: TableRow[],
  ): number {
    let confidence = 0.7;

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
          confidence += 0.1;
        }
      }
    }

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
          confidence += 0.1;
        }
      }
    }

    const hasHeader = rows.some(row => row.isHeader);
    if (hasHeader) {
      confidence += 0.05;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Detect borderless tables using stream detection algorithm
   */
  private detectStream(items: PdfTextItem[]): DetectionResult {
    try {
      const columnBoundaries = this.findColumnBoundaries(items);

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

      const rowGroups = this.findRowGroups(items);

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

      const table = this.buildTableFromStream(items, columnBoundaries, rowGroups);

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
   * Find column boundaries using whitespace analysis
   */
  private findColumnBoundaries(items: PdfTextItem[]): number[] {
    const X_TOLERANCE = 5;
    const xPositions = new Map<number, number>();

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

    const boundaries = Array.from(xPositions.entries())
      .filter(([, count]) => count >= 2)
      .map(([x]) => x)
      .sort((a, b) => a - b);

    return boundaries;
  }

  /**
   * Find row groupings based on y-coordinate clustering
   */
  private findRowGroups(items: PdfTextItem[]): number[] {
    const Y_TOLERANCE = 5;
    const yPositions = new Map<number, number>();

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

    const rows = Array.from(yPositions.entries())
      .filter(([, count]) => count >= 2)
      .map(([y]) => y)
      .sort((a, b) => b - a);

    return rows;
  }

  /**
   * Build table structure from stream-detected boundaries
   */
  private buildTableFromStream(
    items: PdfTextItem[],
    columnBoundaries: number[],
    rowGroups: number[],
  ): TableStructure {
    const Y_TOLERANCE = 5;
    const X_TOLERANCE = 5;

    const rows: TableRow[] = [];

    for (let rowIndex = 0; rowIndex < rowGroups.length; rowIndex++) {
      const y = rowGroups[rowIndex];
      if (y === undefined) continue;

      const cells: TableCell[] = [];
      const rowItems = items.filter(item => Math.abs(item.y - y) <= Y_TOLERANCE);

      for (let colIndex = 0; colIndex < columnBoundaries.length; colIndex++) {
        const colStart = columnBoundaries[colIndex];
        const colEnd = columnBoundaries[colIndex + 1] ?? Infinity;
        if (colStart === undefined) continue;

        const cellItems = rowItems.filter(item => {
          const itemCenter = item.x + item.width / 2;
          return Math.abs(item.x - colStart) <= X_TOLERANCE ||
            (itemCenter >= colStart && itemCenter < colEnd);
        });

        const content = cellItems
          .sort((a, b) => a.x - b.x)
          .map(item => item.str)
          .join(' ')
          .trim();

        const isNumeric = this.isNumericContent(content);
        const alignment: Alignment = isNumeric ? 'right' : 'left';

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

      const isHeader = rowIndex === 0 || this.isHeaderRow(rowItems, y, Y_TOLERANCE);

      rows.push({
        cells,
        isHeader,
        y,
      });
    }

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
   * Calculate confidence score for stream detection
   */
  private calculateStreamConfidence(
    columnBoundaries: number[],
    rowGroups: number[],
    rows: TableRow[],
  ): number {
    let confidence = 0.65;

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

        if (variance < avgWidth * 0.4) {
          confidence += 0.08;
        }
      }
    }

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

    if (rows.length >= 2) {
      const firstRowCols = rows[0]?.cells.length ?? 0;
      const consistentRows = rows.filter(row => row.cells.length === firstRowCols).length;
      if (consistentRows === rows.length) {
        confidence += 0.1;
      }
    }

    const hasHeader = rows.some(row => row.isHeader);
    if (hasHeader) {
      confidence += 0.05;
    }

    const numericCells = rows.flatMap(row => row.cells).filter(cell => cell.isNumeric).length;
    const totalCells = rows.flatMap(row => row.cells).length;
    if (totalCells > 0 && numericCells / totalCells > 0.2) {
      confidence += 0.04;
    }

    return Math.min(confidence, 1.0);
  }

  /**
   * Validate table structure meets minimum requirements
   */
  validateTable(table: TableStructure): boolean {
    if (table.rows.length < 2) {
      return false;
    }

    const firstRow = table.rows[0];
    if (!firstRow || !firstRow.cells || firstRow.cells.length < 2) {
      return false;
    }

    const columnCount = firstRow.cells.length;
    if (columnCount < 2) {
      return false;
    }

    if (table.confidence < 0.7) {
      return false;
    }

    for (const row of table.rows) {
      if (row.cells.length !== columnCount) {
        return false;
      }
    }

    return true;
  }

  /**
   * Merge tables that span multiple pages
   */
  mergeTables(tables: TableStructure[]): TableStructure[] {
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

      for (let j = i + 1; j < tables.length; j++) {
        if (processed.has(j)) {
          continue;
        }

        const nextTable = tables[j];
        if (!nextTable) {
          continue;
        }

        if (this.canMergeTables(currentTable, nextTable)) {
          mergeGroup.push(nextTable);
          processed.add(j);
        }
      }

      if (mergeGroup.length > 1) {
        merged.push(this.combineTables(mergeGroup));
      } else {
        merged.push(currentTable);
      }
    }

    return merged;
  }

  /**
   * Check if two tables can be merged
   */
  private canMergeTables(table1: TableStructure, table2: TableStructure): boolean {
    const header1 = table1.rows.find(row => row.isHeader);
    const header2 = table2.rows.find(row => row.isHeader);

    if (!header1 || !header2) {
      return false;
    }

    if (header1.cells.length !== header2.cells.length) {
      return false;
    }

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
   * Combine multiple tables into a single table
   */
  private combineTables(tables: TableStructure[]): TableStructure {
    if (tables.length === 0) {
      throw new Error('Cannot combine empty table array');
    }

    const firstTable = tables[0];
    if (!firstTable) {
      throw new Error('First table is undefined');
    }

    const header = firstTable.rows.find(row => row.isHeader);
    if (!header) {
      throw new Error('First table has no header row');
    }

    const mergedRows: TableRow[] = [header];

    for (const table of tables) {
      const dataRows = table.rows.filter(row => !row.isHeader);
      mergedRows.push(...dataRows);
    }

    const allBboxes = tables.map(t => t.bbox);
    const minX = Math.min(...allBboxes.map(b => b.x));
    const minY = Math.min(...allBboxes.map(b => b.y));
    const maxX = Math.max(...allBboxes.map(b => b.x + b.width));
    const maxY = Math.max(...allBboxes.map(b => b.y + b.height));

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
   * Create low-confidence detection result
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
      fallbackUsed: true,
    };
  }
}

export default TableDetector;
