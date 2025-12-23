/**
 * Excel to Markdown Converter (Platform-Agnostic)
 *
 * Converts Excel files to Markdown tables with multi-sheet support.
 * Works in both Node.js and browser environments using ExcelJS.
 */

import ExcelJS from 'exceljs';
import { MarkdownUtils, DEFAULT_MARKDOWN_OPTIONS } from './MarkdownUtils.js';
import type {
  ConverterInput,
  ConversionResult,
  MarkdownOptions,
  DocumentConverter,
} from './types.js';

/**
 * Extended options for Excel conversion
 */
export interface ExcelConverterOptions extends MarkdownOptions {
  maxRowsPerSheet?: number;
}

/**
 * Platform-agnostic Excel converter
 * Implements DocumentConverter interface for use in both Electron and browser
 */
export class ExcelConverter implements DocumentConverter {
  static readonly supportedTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  static readonly supportedExtensions = ['.xlsx', '.xls'];

  readonly supportedTypes = ExcelConverter.supportedTypes;
  readonly supportedExtensions = ExcelConverter.supportedExtensions;

  private markdownUtils: MarkdownUtils;
  private maxRowsPerSheet: number;

  constructor(options: ExcelConverterOptions = {}) {
    this.markdownUtils = new MarkdownUtils(options);
    this.maxRowsPerSheet = options.maxRowsPerSheet || DEFAULT_MARKDOWN_OPTIONS.maxRowsPerSheet;
  }

  /**
   * Check if this converter supports the given input
   */
  supports(input: ConverterInput): boolean {
    // Check MIME type
    if (input.mimeType && ExcelConverter.supportedTypes.includes(input.mimeType)) {
      return true;
    }

    // Check file extension
    const ext = this.markdownUtils.getExtension(input.filename);
    return ExcelConverter.supportedExtensions.includes(ext);
  }

  /**
   * Convert Excel to Markdown
   * @param input - The input data with ArrayBuffer
   * @param options - Optional conversion options
   */
  async convert(input: ConverterInput, options?: ExcelConverterOptions): Promise<ConversionResult> {
    const warnings: string[] = [];
    const workbook = new ExcelJS.Workbook();

    try {
      // Load workbook from ArrayBuffer
      await workbook.xlsx.load(input.data);

      const mergedOptions = { ...DEFAULT_MARKDOWN_OPTIONS, ...options };
      const maxRows = options?.maxRowsPerSheet || this.maxRowsPerSheet;

      // Generate frontmatter if enabled
      let output = '';
      if (mergedOptions.includeFrontmatter) {
        output = this.markdownUtils.generateFrontmatter(input.filename, 'xlsx', {
          format: 'xlsx',
          sheetCount: workbook.worksheets.length,
        });
      }

      // Add title
      const title = input.filename.replace(/\.xlsx?$/i, '');
      output += this.markdownUtils.normalizeHeading(title, 1);

      // Process each worksheet
      let totalRows = 0;
      for (const worksheet of workbook.worksheets) {
        const { markdown, rowCount, truncated } = this.convertWorksheet(worksheet, maxRows);
        output += markdown;
        totalRows += rowCount;

        if (truncated) {
          warnings.push(`Sheet "${worksheet.name}": Showing first ${maxRows} of ${rowCount} data rows`);
        }
      }

      return {
        markdown: output,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          format: 'xlsx',
          sheetCount: workbook.worksheets.length,
          rowCount: totalRows,
        },
      };

    } catch (error) {
      throw new Error(`Failed to convert Excel: ${(error as Error).message}`);
    }
  }

  /**
   * Convert a worksheet to Markdown
   */
  private convertWorksheet(
    worksheet: ExcelJS.Worksheet,
    maxRows: number
  ): { markdown: string; rowCount: number; truncated: boolean } {
    const sheetName = worksheet.name;
    let markdown = this.markdownUtils.normalizeHeading(sheetName, 2);

    // Get actual data range
    const rowCount = worksheet.actualRowCount;
    const colCount = worksheet.actualColumnCount;

    if (rowCount === 0 || colCount === 0) {
      return {
        markdown: markdown + '_(Empty sheet)_\n\n',
        rowCount: 0,
        truncated: false,
      };
    }

    // Check if truncation needed
    const dataRowCount = rowCount - 1; // Exclude header row
    const truncated = dataRowCount > maxRows;
    const displayRows = truncated ? maxRows : dataRowCount;

    if (truncated) {
      markdown += this.markdownUtils.createBlockquote(
        `Note: Showing first ${displayRows} of ${dataRowCount} data rows`
      );
    }

    // Extract headers (first row)
    const headers: string[] = [];
    const headerRow = worksheet.getRow(1);
    for (let col = 1; col <= colCount; col++) {
      const cell = headerRow.getCell(col);
      headers.push(this.getCellValue(cell));
    }

    // Extract data rows
    const rows: string[][] = [];
    for (let row = 2; row <= Math.min(displayRows + 1, rowCount); row++) {
      const rowData: string[] = [];
      const excelRow = worksheet.getRow(row);

      for (let col = 1; col <= colCount; col++) {
        const cell = excelRow.getCell(col);
        rowData.push(this.getCellValue(cell));
      }

      rows.push(rowData);
    }

    // Create Markdown table using shared utility
    markdown += this.markdownUtils.createTable(headers, rows);
    markdown += '\n';

    return {
      markdown,
      rowCount: dataRowCount,
      truncated,
    };
  }

  /**
   * Extract cell value handling all ExcelJS cell types
   */
  private getCellValue(cell: ExcelJS.Cell): string {
    if (!cell || cell.value === null || cell.value === undefined) {
      return '';
    }

    // Handle formulas - show result
    if (cell.type === ExcelJS.ValueType.Formula) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return String((cell.value as any).result || '');
    }

    // Handle rich text
    if (cell.type === ExcelJS.ValueType.RichText) {
      return (cell.value as ExcelJS.CellRichTextValue).richText.map(t => t.text).join('');
    }

    // Handle dates
    if (cell.type === ExcelJS.ValueType.Date) {
      const dateValue = cell.value as Date | undefined;
      const safeDate = dateValue || new Date();
      return safeDate.toISOString().split('T')[0] || '';
    }

    // Handle hyperlinks
    if (cell.type === ExcelJS.ValueType.Hyperlink) {
      const hyperlinkValue = cell.value as ExcelJS.CellHyperlinkValue;
      const text = hyperlinkValue.text || hyperlinkValue.hyperlink || '';
      const link = hyperlinkValue.hyperlink || '';
      return this.markdownUtils.createLink(text, link);
    }

    // Handle booleans
    if (cell.type === ExcelJS.ValueType.Boolean) {
      return (cell.value as boolean) ? 'TRUE' : 'FALSE';
    }

    // Handle errors
    if (cell.type === ExcelJS.ValueType.Error) {
      return '#ERROR';
    }

    // Default: convert to string
    return String(cell.value);
  }
}

export default ExcelConverter;
