/**
 * Excel to Markdown Converter
 * Converts Excel files to Markdown tables (multi-sheet support)
 */

import ExcelJS from 'exceljs';
import path from 'path';
import { MarkdownConverter, MarkdownConverterOptions } from './MarkdownConverter.js';
import { createLogger } from '../utils/LoggerFactory.js';

export interface ExcelConverterOptions extends MarkdownConverterOptions {
  maxRowsPerSheet?: number;
}

const log = createLogger('converter:excel');

export class ExcelToMarkdown extends MarkdownConverter {
  private maxRowsPerSheet: number;

  constructor(options: ExcelConverterOptions = {}) {
    super(options);
    this.maxRowsPerSheet = options.maxRowsPerSheet || 1000;
  }

  override async convert(filePath: string): Promise<string> {
    const filename = path.basename(filePath);
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.readFile(filePath);

      // Generate frontmatter
      const frontmatter = this.generateFrontmatter({
        filename: this.sanitizeFilename(filename),
        format: 'xlsx',
        timestamp: new Date().toISOString(),
        sheetCount: workbook.worksheets.length,
      });

      const title = filename.replace(/\.xlsx?$/i, '');
      let markdown = this.normalizeHeading(title, 1);

      // Process each worksheet
      for (const worksheet of workbook.worksheets) {
        markdown += this.convertWorksheet(worksheet);
      }

      return frontmatter + markdown;

    } catch (error) {
      log.error('Error converting Excel', { filename, error: (error as Error).message });
      throw new Error(`Failed to convert Excel: ${(error as Error).message}`);
    }
  }

  private convertWorksheet(worksheet: ExcelJS.Worksheet): string {
    const sheetName = worksheet.name;
    let markdown = this.normalizeHeading(sheetName, 2);

    // Get actual data range (skip empty rows/columns)
    const rowCount = worksheet.actualRowCount;
    const colCount = worksheet.actualColumnCount;

    if (rowCount === 0 || colCount === 0) {
      return markdown + '_(Empty sheet)_\n\n';
    }

    // Check if truncation needed
    const truncated = rowCount > this.maxRowsPerSheet + 1; // +1 for header
    const displayRows = truncated ? this.maxRowsPerSheet : rowCount - 1;

    if (truncated) {
      markdown += this.createBlockquote(
        `Note: Showing first ${displayRows} of ${rowCount - 1} data rows`,
      );
    }

    // Extract data
    const headers: string[] = [];
    const rows: string[][] = [];

    // Get headers (first row)
    const headerRow = worksheet.getRow(1);
    for (let col = 1; col <= colCount; col++) {
      const cell = headerRow.getCell(col);
      headers.push(this.getCellValue(cell));
    }

    // Get data rows
    for (let row = 2; row <= Math.min(displayRows + 1, rowCount); row++) {
      const rowData: string[] = [];
      const excelRow = worksheet.getRow(row);

      for (let col = 1; col <= colCount; col++) {
        const cell = excelRow.getCell(col);
        rowData.push(this.getCellValue(cell));
      }

      rows.push(rowData);
    }

    // Create Markdown table
    markdown += this.createTable(headers, rows);
    markdown += '\n';

    return markdown;
  }

  private getCellValue(cell: ExcelJS.Cell): string {
    // Handle different cell types
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
      return this.createLink(text, link);
    }

    // Handle booleans
    if (cell.type === ExcelJS.ValueType.Boolean) {
      return (cell.value as boolean) ? 'TRUE' : 'FALSE';
    }

    // Default: convert to string
    return String(cell.value);
  }
}

export default ExcelToMarkdown;
