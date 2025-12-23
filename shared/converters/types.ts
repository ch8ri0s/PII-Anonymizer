/**
 * Shared Converter Types
 *
 * Platform-agnostic type definitions for document converters.
 * These interfaces work with both Electron (Node.js) and browser environments.
 */

/**
 * Input data for converters - works in both Node.js and browser
 */
export interface ConverterInput {
  /** File name (for metadata and type detection) */
  filename: string;
  /** Raw file data as ArrayBuffer (universal format) */
  data: ArrayBuffer;
  /** Optional MIME type if known */
  mimeType?: string;
}

/**
 * Result from document conversion
 */
export interface ConversionResult {
  /** The converted Markdown content */
  markdown: string;
  /** Any warnings during conversion */
  warnings?: string[];
  /** Metadata about the conversion */
  metadata?: ConversionMetadata;
}

/**
 * Metadata from conversion process
 */
export interface ConversionMetadata {
  /** Source format detected */
  format: string;
  /** Number of pages (for PDFs) */
  pageCount?: number;
  /** Number of sheets (for Excel) */
  sheetCount?: number;
  /** Number of rows (for CSV/Excel) */
  rowCount?: number;
  /** Table detection info (for PDFs) */
  tablesDetected?: boolean;
  tableCount?: number;
  detectionMethod?: string;
  confidence?: number;
  /** Additional format-specific metadata */
  [key: string]: unknown;
}

/**
 * Options for Markdown generation
 */
export interface MarkdownOptions {
  /** Include YAML frontmatter */
  includeFrontmatter?: boolean;
  /** Include metadata in output */
  includeMetadata?: boolean;
  /** Model name for PII detection */
  modelName?: string;
  /** Maximum rows per sheet for Excel/CSV */
  maxRowsPerSheet?: number;
}

/**
 * Table alignment options for Markdown tables
 */
export interface TableAlignment {
  alignment?: ('left' | 'center' | 'right')[];
}

/**
 * Interface for format detection
 */
export interface FormatDetector {
  /** Check if this converter supports the given input */
  supports(input: ConverterInput): boolean;
  /** Supported MIME types */
  readonly supportedTypes: string[];
  /** Supported file extensions (with dot, e.g., '.pdf') */
  readonly supportedExtensions: string[];
}

/**
 * Base converter interface
 * All converters should implement this interface
 */
export interface DocumentConverter extends FormatDetector {
  /**
   * Convert document data to Markdown
   * @param input - The input data and metadata
   * @param options - Conversion options
   * @returns Conversion result with Markdown and metadata
   */
  convert(input: ConverterInput, options?: MarkdownOptions): Promise<ConversionResult>;
}
