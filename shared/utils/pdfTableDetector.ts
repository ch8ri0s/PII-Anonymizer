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

// Re-export from modular files
export { TableDetector } from './TableDetector.js';
export { TableToMarkdownConverter } from './TableToMarkdownConverter.js';

// Re-export types for convenience
export type {
  PdfTextItem,
  BoundingBox,
  Alignment,
  DetectionMethod,
  TableCell,
  TableRow,
  TableStructure,
  PdfTableDetectionResult,
} from '../types/index.js';
