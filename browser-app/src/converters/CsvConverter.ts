/**
 * CSV to Markdown Converter (Browser Version)
 *
 * Converts CSV files to GitHub Flavored Markdown tables.
 * 100% browser compatible - no external dependencies.
 */

export class CsvConverter {
  static readonly SUPPORTED_TYPES = ['text/csv', 'application/csv'];
  static readonly SUPPORTED_EXTENSIONS = ['.csv'];

  supports(file: File): boolean {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return (
      CsvConverter.SUPPORTED_TYPES.includes(file.type) ||
      CsvConverter.SUPPORTED_EXTENSIONS.includes(ext)
    );
  }

  async convert(file: File): Promise<string> {
    const text = await file.text();
    return this.csvToMarkdown(text);
  }

  private csvToMarkdown(csv: string): string {
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length === 0) return '';

    const rows = lines.map(line => this.parseCSVLine(line));
    if (rows.length === 0) return '';

    // Build markdown table
    const header = rows[0];
    const separator = header.map(() => '---');
    const dataRows = rows.slice(1);

    const mdLines = [
      '| ' + header.map(cell => this.escapeMarkdown(cell)).join(' | ') + ' |',
      '| ' + separator.join(' | ') + ' |',
      ...dataRows.map(row =>
        '| ' + row.map(cell => this.escapeMarkdown(cell)).join(' | ') + ' |'
      ),
    ];

    return mdLines.join('\n');
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }

    result.push(current.trim());
    return result;
  }

  private escapeMarkdown(text: string): string {
    // Escape pipe characters in markdown table cells
    return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
  }
}

export default CsvConverter;
