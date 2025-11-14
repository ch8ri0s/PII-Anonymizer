/**
 * DOCX to Markdown Converter
 * Converts Word documents to Markdown using mammoth + turndown
 */

import mammoth from 'mammoth';
import TurndownService from 'turndown';
import path from 'path';
import { MarkdownConverter } from './MarkdownConverter.js';

export class DocxToMarkdown extends MarkdownConverter {
  constructor(options = {}) {
    super(options);

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

  configureTurndown() {
    // Handle images
    this.turndown.addRule('images', {
      filter: 'img',
      replacement: (content, node) => {
        const alt = node.getAttribute('alt') || 'Image';
        const src = node.getAttribute('src') || '';

        // For embedded images, just describe them
        if (src.startsWith('data:')) {
          return `\n\n![${alt}: Embedded image]\n\n`;
        }

        return `\n\n![${alt}](${src})\n\n`;
      }
    });

    // Preserve line breaks
    this.turndown.addRule('lineBreaks', {
      filter: 'br',
      replacement: () => '  \n'
    });
  }

  async convert(filePath) {
    const filename = path.basename(filePath);

    try {
      // Extract DOCX as HTML
      const result = await mammoth.convertToHtml({
        path: filePath,
        convertImage: mammoth.images.imgElement((image) => {
          return image.read('base64').then((imageBuffer) => {
            // Describe image instead of embedding
            return {
              src: `data:image/png;base64,${imageBuffer.substring(0, 100)}...`,
              alt: 'Embedded image from DOCX'
            };
          });
        })
      });

      const html = result.value;
      const messages = result.messages;

      // Log any conversion warnings
      if (messages.length > 0) {
        console.warn(`DOCX conversion warnings for ${filename}:`, messages);
      }

      // Convert HTML to Markdown
      let markdown = this.turndown.turndown(html);

      // Generate frontmatter
      const frontmatter = this.generateFrontmatter({
        filename: this.sanitizeFilename(filename),
        format: 'docx',
        timestamp: new Date().toISOString(),
        conversionWarnings: messages.length
      });

      // Add title if not present
      if (!markdown.startsWith('#')) {
        const title = filename.replace(/\.docx$/i, '');
        markdown = this.normalizeHeading(title, 1) + markdown;
      }

      return frontmatter + markdown;

    } catch (error) {
      console.error(`Error converting DOCX ${filename}:`, error);
      throw new Error(`Failed to convert DOCX: ${error.message}`);
    }
  }
}

export default DocxToMarkdown;
