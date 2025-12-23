/**
 * PDF Table Detection Type Definitions (Platform-Agnostic)
 *
 * This module defines types for detecting and converting tables in PDF documents.
 * All types support local processing with zero external dependencies.
 *
 * @module pdfTable
 */

// Re-export PdfTextItem from PdfTextProcessor for consistency
export { PdfTextItem } from '../converters/PdfTextProcessor.js';

/**
 * Bounding box coordinates for tables, cells, or text items
 */
export interface BoundingBox {
  /** X-coordinate of top-left corner */
  x: number;
  /** Y-coordinate of top-left corner */
  y: number;
  /** Width of bounding box */
  width: number;
  /** Height of bounding box */
  height: number;
}

/**
 * Column alignment types for Markdown table formatting
 */
export type Alignment = 'left' | 'right' | 'center';

/**
 * Detection method used to identify tables
 */
export type DetectionMethod = 'lattice' | 'stream' | 'none';

/**
 * Individual table cell with content and formatting
 */
export interface TableCell {
  /** Text content of the cell (may be empty string) */
  content: string;
  /** Column alignment hint */
  alignment: Alignment;
  /** Cell bounding box coordinates */
  bbox: BoundingBox;
  /** Whether content is purely numeric */
  isNumeric: boolean;
}

/**
 * Single row within a table
 */
export interface TableRow {
  /** Array of cells in this row */
  cells: TableCell[];
  /** Whether this row is a header row */
  isHeader: boolean;
  /** Y-coordinate of row on the page */
  y: number;
}

/**
 * Complete table structure detected in a PDF
 */
export interface TableStructure {
  /** Page number where table is located (1-indexed) */
  page: number;
  /** Array of table rows including header and data rows */
  rows: TableRow[];
  /** Bounding box coordinates for the entire table */
  bbox: BoundingBox;
  /** Detection confidence score (0-1) */
  confidence: number;
  /** Detection method used ('lattice' for bordered, 'stream' for borderless) */
  method: DetectionMethod;
}

/**
 * Result of table detection for a PDF document
 * This interface guarantees graceful degradation (never throws exceptions)
 */
export interface PdfTableDetectionResult {
  /** Array of detected tables */
  tables: TableStructure[];
  /** Overall detection confidence (0-1) */
  confidence: number;
  /** Primary detection method used */
  method: DetectionMethod;
  /** Number of tables detected */
  tableCount: number;
  /** Detection warnings or notes */
  warnings: string[];
  /** Whether text extraction fallback was used */
  fallbackUsed: boolean;
}
