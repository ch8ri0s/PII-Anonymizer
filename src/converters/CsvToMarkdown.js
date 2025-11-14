/**
 * CSV to Markdown Converter
 * Converts CSV files to Markdown tables
 */

import fs from 'fs/promises';
import path from 'path';
import { MarkdownConverter } from './MarkdownConverter.js';

export class CsvToMarkdown extends MarkdownConverter {
  constructor(options = {}) {
    super(options);
    this.maxRows = options.maxRows || 1000;
  }

  async convert(filePath) {
    const content = await fs.readFile(filePath, 'utf8');
    const filename = path.basename(filePath);

    // Parse CSV
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
      return `# ${filename}\n\n(Empty CSV file)`;
    }

    // First line is header
    const headers = this.parseCsvLine(lines[0]);

    // Remaining lines are data
    const dataLines = lines.slice(1);
    const totalRows = dataLines.length;
    const truncated = totalRows > this.maxRows;
    const displayLines = truncated ? dataLines.slice(0, this.maxRows) : dataLines;

    const rows = displayLines.map(line => this.parseCsvLine(line));

    // Generate frontmatter
    const frontmatter = this.generateFrontmatter({
      filename: this.sanitizeFilename(filename),
      format: 'csv',
      timestamp: new Date().toISOString(),
      rowCount: totalRows,
      truncated
    });

    // Create title
    const title = filename.replace(/\.csv$/i, '');
    let markdown = this.normalizeHeading(title, 1);

    if (truncated) {
      markdown += this.createBlockquote(
        `Note: Showing first ${this.maxRows} of ${totalRows} rows`
      );
    }

    // Create table
    markdown += this.createTable(headers, rows);

    return frontmatter + markdown;
  }

  /**
   * Simple CSV parser - handles quoted fields
   * For production, consider using a library like papaparse
   */
  parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current.trim());

    return result;
  }
}

export default CsvToMarkdown;
