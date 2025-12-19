/**
 * DOCX to Markdown Converter (Browser Version)
 *
 * Uses mammoth.js which has native browser support.
 * Converts Word documents to clean Markdown.
 */

import mammoth from 'mammoth';
import TurndownService from 'turndown';

// Detect environment
const isNode = typeof process !== 'undefined' && process.versions?.node;

export class DocxConverter {
  static readonly SUPPORTED_TYPES = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  static readonly SUPPORTED_EXTENSIONS = ['.docx'];

  private turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });

    // Add rules for better markdown conversion
    this.turndown.addRule('strikethrough', {
      filter: ['del', 's'],
      replacement: (content) => `~~${content}~~`,
    });
  }

  supports(file: File): boolean {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return (
      DocxConverter.SUPPORTED_TYPES.includes(file.type) ||
      DocxConverter.SUPPORTED_EXTENSIONS.includes(ext)
    );
  }

  async convert(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();

    // mammoth Node.js API uses 'buffer', browser API uses 'arrayBuffer'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let options: any;
    if (isNode) {
      // Node.js: convert ArrayBuffer to Buffer
      options = { buffer: Buffer.from(arrayBuffer) };
    } else {
      // Browser: use arrayBuffer directly
      options = { arrayBuffer };
    }

    const result = await mammoth.convertToHtml(options);

    if (result.messages.length > 0) {
      console.warn('DOCX conversion warnings:', result.messages);
    }

    // Convert HTML to Markdown
    const markdown = this.turndown.turndown(result.value);

    // Clean up excessive whitespace
    return markdown
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

export default DocxConverter;
