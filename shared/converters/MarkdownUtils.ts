/**
 * Markdown Utilities
 *
 * Platform-agnostic utilities for generating Markdown content.
 * Used by all document converters in both Electron and browser apps.
 */

import type { ConversionMetadata, MarkdownOptions, TableAlignment } from './types.js';

/**
 * Default options for Markdown generation
 */
export const DEFAULT_MARKDOWN_OPTIONS: Required<MarkdownOptions> = {
  includeFrontmatter: true,
  includeMetadata: true,
  modelName: 'betterdataai/PII_DETECTION_MODEL',
  maxRowsPerSheet: 1000,
};

/**
 * Markdown utility functions for document conversion
 */
export class MarkdownUtils {
  private options: Required<MarkdownOptions>;

  constructor(options: MarkdownOptions = {}) {
    this.options = { ...DEFAULT_MARKDOWN_OPTIONS, ...options };
  }

  /**
   * Generate YAML frontmatter with metadata
   */
  generateFrontmatter(filename: string, format: string, metadata?: ConversionMetadata): string {
    if (!this.options.includeFrontmatter) return '';

    const yaml: string[] = [
      '---',
      `source: ${this.sanitizeFilename(filename)}`,
      `sourceFormat: ${format}`,
      `processed: ${new Date().toISOString()}`,
      'anonymised: true',
      `piiModel: ${this.options.modelName}`,
    ];

    if (metadata) {
      if (metadata.pageCount !== undefined) {
        yaml.push(`pageCount: ${metadata.pageCount}`);
      }
      if (metadata.sheetCount !== undefined) {
        yaml.push(`sheetCount: ${metadata.sheetCount}`);
      }
      if (metadata.rowCount !== undefined) {
        yaml.push(`rowCount: ${metadata.rowCount}`);
      }
      if (metadata.tablesDetected !== undefined) {
        yaml.push(`tablesDetected: ${metadata.tablesDetected}`);
      }
      if (metadata.tableCount !== undefined) {
        yaml.push(`tableCount: ${metadata.tableCount}`);
      }
      if (metadata.detectionMethod !== undefined) {
        yaml.push(`detectionMethod: ${metadata.detectionMethod}`);
      }
      if (metadata.confidence !== undefined && typeof metadata.confidence === 'number') {
        yaml.push(`confidence: ${metadata.confidence.toFixed(2)}`);
      }
    }

    yaml.push('---', '');
    return yaml.join('\n');
  }

  /**
   * Create Markdown table from 2D array
   */
  createTable(headers: string[], rows: string[][], options: TableAlignment = {}): string {
    if (!headers || headers.length === 0) {
      return '';
    }

    const alignment = options.alignment || headers.map(() => 'left' as const);

    // Escape headers
    const escapedHeaders = headers.map(h => this.escapeTableCell(h));

    // Header row
    let table = '| ' + escapedHeaders.join(' | ') + ' |\n';

    // Separator row
    const separators = alignment.map(align => {
      if (align === 'center') return ':---:';
      if (align === 'right') return '---:';
      return '---';
    });
    table += '| ' + separators.join(' | ') + ' |\n';

    // Data rows
    for (const row of rows) {
      const escapedRow = row.map(cell => this.escapeTableCell(cell));
      table += '| ' + escapedRow.join(' | ') + ' |\n';
    }

    return table;
  }

  /**
   * Escape pipe characters and newlines in table cells
   */
  escapeTableCell(text: unknown): string {
    if (text === null || text === undefined) {
      return '';
    }

    return String(text)
      .replace(/\|/g, '\\|')
      .replace(/\n/g, '<br>')
      .trim();
  }

  /**
   * Normalize heading levels (h1-h6)
   */
  normalizeHeading(text: string, level: number): string {
    const normalizedLevel = Math.max(1, Math.min(6, level));
    const prefix = '#'.repeat(normalizedLevel);
    return `${prefix} ${text}\n\n`;
  }

  /**
   * Convert text to title case
   */
  toTitleCase(text: string): string {
    return text.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase();
    });
  }

  /**
   * Sanitize filename for use in frontmatter
   */
  sanitizeFilename(filename: string): string {
    return filename.replace(/[:"]/g, '');
  }

  /**
   * Create a horizontal rule
   */
  createHorizontalRule(): string {
    return '\n---\n\n';
  }

  /**
   * Create a blockquote
   */
  createBlockquote(text: string): string {
    return text.split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
  }

  /**
   * Create a code block
   */
  createCodeBlock(code: string, language = ''): string {
    return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
  }

  /**
   * Create inline code
   */
  createInlineCode(text: string): string {
    return `\`${text}\``;
  }

  /**
   * Create a link
   */
  createLink(text: string, url: string): string {
    return `[${text}](${url})`;
  }

  /**
   * Create emphasis (italic)
   */
  createEmphasis(text: string): string {
    return `_${text}_`;
  }

  /**
   * Create strong (bold)
   */
  createStrong(text: string): string {
    return `**${text}**`;
  }

  /**
   * Create an unordered list
   */
  createUnorderedList(items: string[]): string {
    return items.map(item => `- ${item}`).join('\n') + '\n\n';
  }

  /**
   * Create an ordered list
   */
  createOrderedList(items: string[]): string {
    return items.map((item, index) => `${index + 1}. ${item}`).join('\n') + '\n\n';
  }

  /**
   * Detect if text looks like code
   */
  looksLikeCode(text: string): boolean {
    const codeIndicators = [
      /function\s+\w+\s*\(/,
      /class\s+\w+/,
      /import\s+.+from/,
      /const\s+\w+\s*=/,
      /let\s+\w+\s*=/,
      /var\s+\w+\s*=/,
      /{[\s\S]*}/,
      /\[\s*\]/,
    ];

    return codeIndicators.some(pattern => pattern.test(text));
  }

  /**
   * Clean up excessive whitespace in Markdown
   */
  cleanWhitespace(markdown: string): string {
    return markdown
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Get the file extension from a filename
   */
  getExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? '.' + parts.pop()?.toLowerCase() : '';
  }
}

export default MarkdownUtils;
