/**
 * Base Markdown Converter Class
 *
 * Provides common utilities for converting various document formats
 * to LLM-ready Markdown with proper structure preservation.
 */

import { marked } from 'marked';

export class MarkdownConverter {
  constructor(options = {}) {
    this.options = {
      includeFrontmatter: options.includeFrontmatter !== false,
      includeMetadata: options.includeMetadata !== false,
      modelName: options.modelName || 'betterdataai/PII_DETECTION_MODEL',
      ...options
    };
  }

  /**
   * Generate YAML frontmatter with metadata
   */
  generateFrontmatter(metadata) {
    if (!this.options.includeFrontmatter) return '';

    const yaml = [
      '---',
      `source: ${metadata.filename}`,
      `sourceFormat: ${metadata.format}`,
      `processed: ${metadata.timestamp}`,
      `anonymised: true`,
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

    yaml.push('---', '');

    return yaml.join('\n');
  }

  /**
   * Validate generated Markdown syntax
   */
  async validateMarkdown(markdown) {
    try {
      marked.parse(markdown);
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Create Markdown table from 2D array
   * Supports alignment options
   */
  createTable(headers, rows, options = {}) {
    if (!headers || headers.length === 0) {
      return '';
    }

    const alignment = options.alignment || headers.map(() => 'left');

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
  escapeTableCell(text) {
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
  normalizeHeading(text, level) {
    const normalizedLevel = Math.max(1, Math.min(6, level));
    const prefix = '#'.repeat(normalizedLevel);
    return `${prefix} ${text}\n\n`;
  }

  /**
   * Convert text to title case for headings
   */
  toTitleCase(text) {
    return text.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  }

  /**
   * Sanitize filename for use in frontmatter
   */
  sanitizeFilename(filename) {
    // Remove or escape characters that could break YAML
    return filename.replace(/[:"]/g, '');
  }

  /**
   * Create a horizontal rule
   */
  createHorizontalRule() {
    return '\n---\n\n';
  }

  /**
   * Create a blockquote
   */
  createBlockquote(text) {
    return text.split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
  }

  /**
   * Create a code block
   */
  createCodeBlock(code, language = '') {
    return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
  }

  /**
   * Create inline code
   */
  createInlineCode(text) {
    return `\`${text}\``;
  }

  /**
   * Create a link
   */
  createLink(text, url) {
    return `[${text}](${url})`;
  }

  /**
   * Create emphasis (italic)
   */
  createEmphasis(text) {
    return `_${text}_`;
  }

  /**
   * Create strong (bold)
   */
  createStrong(text) {
    return `**${text}**`;
  }

  /**
   * Create an unordered list
   */
  createUnorderedList(items) {
    return items.map(item => `- ${item}`).join('\n') + '\n\n';
  }

  /**
   * Create an ordered list
   */
  createOrderedList(items) {
    return items.map((item, index) => `${index + 1}. ${item}`).join('\n') + '\n\n';
  }

  /**
   * Detect if text looks like a code block
   */
  looksLikeCode(text) {
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
  async convert(filePath) {
    throw new Error('convert() must be implemented by subclass');
  }
}

export default MarkdownConverter;
