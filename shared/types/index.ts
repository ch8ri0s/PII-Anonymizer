/**
 * Shared Types Module
 *
 * Platform-agnostic type definitions used across Electron and browser apps.
 */

// PDF Table Detection Types
export type {
  BoundingBox,
  Alignment,
  DetectionMethod,
  TableCell,
  TableRow,
  TableStructure,
  PdfTableDetectionResult,
} from './pdfTable.js';

// Re-export PdfTextItem from converters for convenience
export type { PdfTextItem } from '../converters/PdfTextProcessor.js';
