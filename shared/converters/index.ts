/**
 * Shared Converters Module
 *
 * Platform-agnostic converter logic shared between Electron and browser apps.
 */

// PDF text processing
export { PdfTextProcessor } from './PdfTextProcessor.js';
export type { PdfTextItem, ProcessedTextResult } from './PdfTextProcessor.js';

// Markdown utilities
export { MarkdownUtils, DEFAULT_MARKDOWN_OPTIONS } from './MarkdownUtils.js';

// Document converters
export { DocxConverter } from './DocxConverter.js';
export { ExcelConverter } from './ExcelConverter.js';
export type { ExcelConverterOptions } from './ExcelConverter.js';
export { CsvConverter } from './CsvConverter.js';
export type { CsvConverterOptions } from './CsvConverter.js';
export { TextConverter } from './TextConverter.js';

// Type definitions
export type {
  ConverterInput,
  ConversionResult,
  ConversionMetadata,
  MarkdownOptions,
  TableAlignment,
  FormatDetector,
  DocumentConverter,
} from './types.js';
