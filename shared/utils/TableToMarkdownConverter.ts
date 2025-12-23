/**
 * Table to Markdown Converter
 *
 * Converts detected table structures to GitHub Flavored Markdown format.
 * Handles proper escaping, alignment, and formatting.
 *
 * @module TableToMarkdownConverter
 */

import type { TableStructure, TableRow, TableCell } from '../types/index.js';

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

export default TableToMarkdownConverter;
