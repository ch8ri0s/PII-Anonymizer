/**
 * Base Markdown Converter Class
 *
 * Provides common utilities for converting various document formats
 * to LLM-ready Markdown with proper structure preservation.
 */

import { marked } from 'marked';

export interface MarkdownConverterOptions {
  includeFrontmatter?: boolean;
  includeMetadata?: boolean;
  modelName?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface DocumentMetadata {
  filename: string;
  format: string;
  timestamp: string;
  pageCount?: number;
  sheetCount?: number;
  rowCount?: number;
  conversionWarnings?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface TableAlignment {
  alignment?: ('left' | 'center' | 'right')[];
}

export class MarkdownConverter {
  protected options: MarkdownConverterOptions;

  constructor(options: MarkdownConverterOptions = {}) {
    this.options = {
      includeFrontmatter: options.includeFrontmatter !== false,
      includeMetadata: options.includeMetadata !== false,
      modelName: options.modelName || 'betterdataai/PII_DETECTION_MODEL',
      ...options,
    };
  }

  /**
   * Generate YAML frontmatter with metadata
   */
  generateFrontmatter(metadata: DocumentMetadata): string {
    if (!this.options.includeFrontmatter) return '';

    const yaml: string[] = [
      '---',
      `source: ${metadata.filename}`,
      `sourceFormat: ${metadata.format}`,
      `processed: ${metadata.timestamp}`,
      'anonymised: true',
      `piiModel: ${this.options.modelName}`,
    ];

    // Add optional metadata
    if (metadata.pageCount) {
      yaml.push(`pageCount: ${metadata.pageCount}`);
    }
    if (metadata.sheetCount) {
      yaml.push(`sheetCount: ${metadata.sheetCount}`);
    }
    if (metadata.rowCount) {
      yaml.push(`rowCount: ${metadata.rowCount}`);
    }
    if (metadata.conversionWarnings) {
      yaml.push(`conversionWarnings: ${metadata.conversionWarnings}`);
    }

    // Table detection metadata (T044)
    if ('tablesDetected' in metadata) {
      yaml.push(`tablesDetected: ${metadata.tablesDetected}`);
    }
    if ('tableCount' in metadata) {
      yaml.push(`tableCount: ${metadata.tableCount}`);
    }
    if ('detectionMethod' in metadata) {
      yaml.push(`detectionMethod: ${metadata.detectionMethod}`);
    }
    if ('confidence' in metadata && typeof metadata.confidence === 'number') {
      yaml.push(`confidence: ${metadata.confidence.toFixed(2)}`);
    }

    yaml.push('---', '');

    return yaml.join('\n');
  }

  /**
   * Validate generated Markdown syntax
   */
  async validateMarkdown(markdown: string): Promise<{ valid: boolean; error?: string }> {
    try {
      await marked.parse(markdown);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: (error as Error).message };
    }
  }

  /**
   * Create Markdown table from 2D array
   * Supports alignment options
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  escapeTableCell(text: any): string {
    if (text === null || text === undefined) {
      return '';
    }

    return String(text)
      .replace(/\|/g, '\\|')  // Escape pipes
      .replace(/\n/g, '<br>') // Convert newlines to HTML breaks
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
   * Convert text to title case for headings
   */
  toTitleCase(text: string): string {
    return text.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }

  /**
   * Sanitize filename for use in frontmatter
   */
  sanitizeFilename(filename: string): string {
    // Remove or escape characters that could break YAML
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
  createCodeBlock(code: string, language: string = ''): string {
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
   * Detect if text looks like a code block
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
   * Must be implemented by subclasses
   */
  async convert(_filePath: string): Promise<string> {
    throw new Error('convert() must be implemented by subclass');
  }
}

export default MarkdownConverter;
