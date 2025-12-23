/**
 * CSV to Markdown Converter (Platform-Agnostic)
 *
 * Converts CSV files to Markdown tables.
 * Works in both Node.js and browser environments.
 * 100% platform-agnostic - no external dependencies.
 */

import { MarkdownUtils, DEFAULT_MARKDOWN_OPTIONS } from './MarkdownUtils.js';
import type {
  ConverterInput,
  ConversionResult,
  MarkdownOptions,
  DocumentConverter,
} from './types.js';

/**
 * Extended options for CSV conversion
 */
export interface CsvConverterOptions extends MarkdownOptions {
  maxRows?: number;
}

/**
 * Platform-agnostic CSV converter
 * Implements DocumentConverter interface for use in both Electron and browser
 */
export class CsvConverter implements DocumentConverter {
  static readonly supportedTypes = ['text/csv', 'application/csv'];
  static readonly supportedExtensions = ['.csv'];

  readonly supportedTypes = CsvConverter.supportedTypes;
  readonly supportedExtensions = CsvConverter.supportedExtensions;

  private markdownUtils: MarkdownUtils;
  private maxRows: number;

  constructor(options: CsvConverterOptions = {}) {
    this.markdownUtils = new MarkdownUtils(options);
    this.maxRows = options.maxRows || DEFAULT_MARKDOWN_OPTIONS.maxRowsPerSheet;
  }

  /**
   * Check if this converter supports the given input
   */
  supports(input: ConverterInput): boolean {
    // Check MIME type
    if (input.mimeType && CsvConverter.supportedTypes.includes(input.mimeType)) {
      return true;
    }

    // Check file extension
    const ext = this.markdownUtils.getExtension(input.filename);
    return CsvConverter.supportedExtensions.includes(ext);
  }

  /**
   * Convert CSV to Markdown
   * @param input - The input data with ArrayBuffer
   * @param options - Optional conversion options
   */
  async convert(input: ConverterInput, options?: CsvConverterOptions): Promise<ConversionResult> {
    const warnings: string[] = [];

    try {
      // Decode ArrayBuffer to string (UTF-8)
      const decoder = new TextDecoder('utf-8');
      const content = decoder.decode(input.data);

      const mergedOptions = { ...DEFAULT_MARKDOWN_OPTIONS, ...options };
      const maxRows = options?.maxRows || this.maxRows;

      // Parse CSV
      const lines = content.trim().split(/\r?\n/);
      if (lines.length === 0) {
        return {
          markdown: `# ${input.filename}\n\n(Empty CSV file)`,
          metadata: { format: 'csv', rowCount: 0 },
        };
      }

      // First line is header
      const headers = this.parseCsvLine(lines[0] || '');

      // Remaining lines are data
      const dataLines = lines.slice(1);
      const totalRows = dataLines.length;
      const truncated = totalRows > maxRows;
      const displayLines = truncated ? dataLines.slice(0, maxRows) : dataLines;

      if (truncated) {
        warnings.push(`Showing first ${maxRows} of ${totalRows} rows`);
      }

      const rows = displayLines.map(line => this.parseCsvLine(line));

      // Generate output
      let output = '';

      // Generate frontmatter if enabled
      if (mergedOptions.includeFrontmatter) {
        output = this.markdownUtils.generateFrontmatter(input.filename, 'csv', {
          format: 'csv',
          rowCount: totalRows,
        });
      }

      // Add title
      const title = input.filename.replace(/\.csv$/i, '');
      output += this.markdownUtils.normalizeHeading(title, 1);

      if (truncated) {
        output += this.markdownUtils.createBlockquote(
          `Note: Showing first ${maxRows} of ${totalRows} rows`
        );
      }

      // Create table using shared utility
      output += this.markdownUtils.createTable(headers, rows);

      return {
        markdown: output,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          format: 'csv',
          rowCount: totalRows,
        },
      };

    } catch (error) {
      throw new Error(`Failed to convert CSV: ${(error as Error).message}`);
    }
  }

  /**
   * Parse a CSV line handling quoted fields
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else if (char === '"') {
          // End of quoted field
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          // Start of quoted field
          inQuotes = true;
        } else if (char === ',') {
          // Field separator
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }

    // Add last field
    result.push(current.trim());

    return result;
  }
}

export default CsvConverter;
