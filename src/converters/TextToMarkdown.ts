/**
 * Text to Markdown Converter
 * Handles .txt files with minimal transformation
 */

import fs from 'fs/promises';
import path from 'path';
import { MarkdownConverter } from './MarkdownConverter.js';

export class TextToMarkdown extends MarkdownConverter {
  override async convert(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath, 'utf8');
    const filename = path.basename(filePath);

    // Generate frontmatter
    const frontmatter = this.generateFrontmatter({
      filename: this.sanitizeFilename(filename),
      format: 'txt',
      timestamp: new Date().toISOString(),
    });

    // Detect if content already has structure
    const hasMarkdownHeadings = /^#{1,6}\s/.test(content);
    const hasCodeBlocks = content.includes('```');

    let markdown = content;

    // Add title if plain text without structure
    if (!hasMarkdownHeadings && !hasCodeBlocks) {
      const title = filename.replace(/\.txt$/i, '');
      markdown = this.normalizeHeading(title, 1) + content;
    }

    return frontmatter + markdown;
  }
}

export default TextToMarkdown;
