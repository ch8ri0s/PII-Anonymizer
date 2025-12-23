/**
 * DOCX to Markdown Converter (Platform-Agnostic)
 *
 * Converts Word documents to Markdown using mammoth + turndown.
 * Works in both Node.js and browser environments.
 */

import mammoth from 'mammoth';
// @ts-ignore - No type definitions available for turndown
import TurndownService from 'turndown';
import { MarkdownUtils, DEFAULT_MARKDOWN_OPTIONS } from './MarkdownUtils.js';
import type {
  ConverterInput,
  ConversionResult,
  MarkdownOptions,
  DocumentConverter,
} from './types.js';

// Detect environment for mammoth API selection
const isNode = typeof process !== 'undefined' && process.versions?.node;

/**
 * Platform-agnostic DOCX converter
 * Implements DocumentConverter interface for use in both Electron and browser
 */
export class DocxConverter implements DocumentConverter {
  static readonly supportedTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  static readonly supportedExtensions = ['.docx'];

  readonly supportedTypes = DocxConverter.supportedTypes;
  readonly supportedExtensions = DocxConverter.supportedExtensions;

  private turndown: TurndownService;
  private markdownUtils: MarkdownUtils;

  constructor(options: MarkdownOptions = {}) {
    this.markdownUtils = new MarkdownUtils(options);

    // Configure Turndown for optimal Markdown conversion
    this.turndown = new TurndownService({
      headingStyle: 'atx',        // Use # style headings
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced',   // Use ``` for code blocks
      emDelimiter: '_',
      strongDelimiter: '**',
    });

    this.configureTurndown();
  }

  /**
   * Check if this converter supports the given input
   */
  supports(input: ConverterInput): boolean {
    // Check MIME type
    if (input.mimeType && DocxConverter.supportedTypes.includes(input.mimeType)) {
      return true;
    }

    // Check file extension
    const ext = this.markdownUtils.getExtension(input.filename);
    return DocxConverter.supportedExtensions.includes(ext);
  }

  /**
   * Configure Turndown with custom rules
   */
  private configureTurndown(): void {
    // Handle images - describe embedded images instead of including base64
    this.turndown.addRule('images', {
      filter: 'img',
      replacement: (_content: string, node: unknown) => {
        // Use type assertion for DOM-like node (works in both browser and turndown's jsdom)
        const imgNode = node as { getAttribute(name: string): string | null };
        const alt = imgNode.getAttribute('alt') || 'Image';
        const src = imgNode.getAttribute('src') || '';

        // For embedded images, just describe them
        if (src.startsWith('data:')) {
          return `\n\n![${alt}: Embedded image]\n\n`;
        }

        return `\n\n![${alt}](${src})\n\n`;
      },
    });

    // Preserve line breaks
    this.turndown.addRule('lineBreaks', {
      filter: 'br',
      replacement: () => '  \n',
    });

    // Handle strikethrough
    this.turndown.addRule('strikethrough', {
      filter: ['del', 's'],
      replacement: (content: string) => `~~${content}~~`,
    });
  }

  /**
   * Convert DOCX to Markdown
   * @param input - The input data with ArrayBuffer
   * @param options - Optional conversion options
   */
  async convert(input: ConverterInput, options?: MarkdownOptions): Promise<ConversionResult> {
    const warnings: string[] = [];

    try {
      // Prepare mammoth options based on environment
      // mammoth Node.js API uses 'buffer', browser API uses 'arrayBuffer'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let mammothOptions: any;

      if (isNode) {
        // Node.js: convert ArrayBuffer to Buffer
        mammothOptions = {
          buffer: Buffer.from(input.data),
          // mammoth.images is available at runtime - type definitions incomplete
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          convertImage: (mammoth as any).images.imgElement((image: { read: (format: string) => Promise<string> }) => {
            return image.read('base64').then((imageBuffer: string) => {
              return {
                src: `data:image/png;base64,${imageBuffer.substring(0, 100)}...`,
                alt: 'Embedded image from DOCX',
              };
            });
          }),
        };
      } else {
        // Browser: use arrayBuffer directly
        mammothOptions = { arrayBuffer: input.data };
      }

      // Extract DOCX as HTML
      const result = await mammoth.convertToHtml(mammothOptions);

      // Collect conversion warnings
      if (result.messages.length > 0) {
        for (const msg of result.messages) {
          warnings.push(`mammoth: ${msg.message || String(msg)}`);
        }
      }

      // Convert HTML to Markdown
      let markdown = this.turndown.turndown(result.value);

      // Clean up excessive whitespace
      markdown = markdown
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Generate frontmatter if enabled
      const mergedOptions = { ...DEFAULT_MARKDOWN_OPTIONS, ...options };
      let output = '';

      if (mergedOptions.includeFrontmatter) {
        output = this.markdownUtils.generateFrontmatter(input.filename, 'docx', {
          format: 'docx',
          conversionWarnings: warnings.length,
        });
      }

      // Add title if not present
      if (!markdown.startsWith('#')) {
        const title = input.filename.replace(/\.docx$/i, '');
        output += this.markdownUtils.normalizeHeading(title, 1);
      }

      output += markdown;

      return {
        markdown: output,
        warnings: warnings.length > 0 ? warnings : undefined,
        metadata: {
          format: 'docx',
          conversionWarnings: warnings.length,
        },
      };

    } catch (error) {
      throw new Error(`Failed to convert DOCX: ${(error as Error).message}`);
    }
  }
}

export default DocxConverter;
