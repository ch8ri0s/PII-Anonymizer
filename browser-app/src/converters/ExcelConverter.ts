/**
 * Excel to Markdown Converter (Browser Version)
 *
 * Uses ExcelJS which has browser support.
 * Converts spreadsheets to Markdown tables.
 */

import ExcelJS from 'exceljs';

export class ExcelConverter {
  static readonly SUPPORTED_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  static readonly SUPPORTED_EXTENSIONS = ['.xlsx', '.xls'];

  supports(file: File): boolean {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return (
      ExcelConverter.SUPPORTED_TYPES.includes(file.type) ||
      ExcelConverter.SUPPORTED_EXTENSIONS.includes(ext)
    );
  }

  async convert(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const sheets: string[] = [];

    workbook.eachSheet((worksheet) => {
      const sheetMarkdown = this.worksheetToMarkdown(worksheet);
      if (sheetMarkdown.trim()) {
        sheets.push(`## ${worksheet.name}\n\n${sheetMarkdown}`);
      }
    });

    return sheets.join('\n\n---\n\n');
  }

  private worksheetToMarkdown(worksheet: ExcelJS.Worksheet): string {
    const rows: string[][] = [];
    let maxCols = 0;

    worksheet.eachRow((row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cells.push(this.getCellValue(cell));
        maxCols = Math.max(maxCols, colNum);
      });
      rows.push(cells);
    });

    if (rows.length === 0) return '';

    // Normalize row lengths
    rows.forEach(row => {
      while (row.length < maxCols) {
        row.push('');
      }
    });

    // Build markdown table
    const header = rows[0] || [];
    const separator = header.map(() => '---');
    const dataRows = rows.slice(1);

    const lines = [
      '| ' + header.map(cell => this.escapeMarkdown(cell)).join(' | ') + ' |',
      '| ' + separator.join(' | ') + ' |',
      ...dataRows.map(row =>
        '| ' + row.map(cell => this.escapeMarkdown(cell)).join(' | ') + ' |'
      ),
    ];

    return lines.join('\n');
  }

  private getCellValue(cell: ExcelJS.Cell): string {
    if (cell.value === null || cell.value === undefined) {
      return '';
    }

    // Handle different cell value types
    if (typeof cell.value === 'object') {
      if ('richText' in cell.value) {
        // Rich text
        return cell.value.richText.map(rt => rt.text).join('');
      }
      if ('text' in cell.value) {
        // Hyperlink
        return cell.value.text as string;
      }
      if ('formula' in cell.value) {
        // Formula - return result
        return String(cell.value.result ?? '');
      }
      if ('error' in cell.value) {
        return '#ERROR';
      }
      // Date
      if (cell.value instanceof Date) {
        return cell.value.toLocaleDateString();
      }
    }

    return String(cell.value);
  }

  private escapeMarkdown(text: string): string {
    return text
      .replace(/\|/g, '\\|')
      .replace(/\n/g, ' ')
      .trim();
  }
}

export default ExcelConverter;
