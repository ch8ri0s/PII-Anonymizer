/**
 * Text to Markdown Converter (Platform-Agnostic)
 *
 * Handles .txt and .md files with minimal transformation.
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
 * Platform-agnostic Text/Markdown converter
 * Implements DocumentConverter interface for use in both Electron and browser
 */
export class TextConverter implements DocumentConverter {
  static readonly supportedTypes = [
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'application/x-markdown',
  ];
  static readonly supportedExtensions = ['.txt', '.md', '.markdown'];

  readonly supportedTypes = TextConverter.supportedTypes;
  readonly supportedExtensions = TextConverter.supportedExtensions;

  private markdownUtils: MarkdownUtils;

  constructor(options: MarkdownOptions = {}) {
    this.markdownUtils = new MarkdownUtils(options);
  }

  /**
   * Check if this converter supports the given input
   */
  supports(input: ConverterInput): boolean {
    // Check MIME type
    if (input.mimeType && TextConverter.supportedTypes.includes(input.mimeType)) {
      return true;
    }

    // Check file extension
    const ext = this.markdownUtils.getExtension(input.filename);
    return TextConverter.supportedExtensions.includes(ext);
  }

  /**
   * Convert text to Markdown
   * @param input - The input data with ArrayBuffer
   * @param options - Optional conversion options
   */
  async convert(input: ConverterInput, options?: MarkdownOptions): Promise<ConversionResult> {
    try {
      // Decode ArrayBuffer to string (UTF-8)
      const decoder = new TextDecoder('utf-8');
      const content = decoder.decode(input.data);

      const mergedOptions = { ...DEFAULT_MARKDOWN_OPTIONS, ...options };
      const ext = this.markdownUtils.getExtension(input.filename);
      const isMarkdownFile = ext === '.md' || ext === '.markdown';

      // For markdown files, return content as-is (pass-through)
      if (isMarkdownFile) {
        return {
          markdown: content,
          metadata: {
            format: 'markdown',
          },
        };
      }

      // For text files, add structure
      let output = '';

      // Generate frontmatter if enabled
      if (mergedOptions.includeFrontmatter) {
        output = this.markdownUtils.generateFrontmatter(input.filename, 'txt', {
          format: 'txt',
        });
      }

      // Detect if content already has markdown structure
      const hasMarkdownHeadings = /^#{1,6}\s/m.test(content);
      const hasCodeBlocks = content.includes('```');

      let markdown = content;

      // Add title if plain text without structure
      if (!hasMarkdownHeadings && !hasCodeBlocks) {
        const title = input.filename.replace(/\.txt$/i, '');
        markdown = this.markdownUtils.normalizeHeading(title, 1) + content;
      }

      output += markdown;

      return {
        markdown: output,
        metadata: {
          format: 'txt',
        },
      };

    } catch (error) {
      throw new Error(`Failed to convert text: ${(error as Error).message}`);
    }
  }
}

export default TextConverter;
