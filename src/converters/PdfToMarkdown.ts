/**
 * PDF to Markdown Converter
 * Converts PDF files to Markdown using structure detection heuristics
 */

// @ts-ignore - No type definitions available for pdf-parse
import pdfParse from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';
import { MarkdownConverter } from './MarkdownConverter.js';

export class PdfToMarkdown extends MarkdownConverter {
  async convert(filePath: string): Promise<string> {
    const filename = path.basename(filePath);
    const dataBuffer = await fs.readFile(filePath);

    try {
      const data = await pdfParse(dataBuffer);

      const metadata = {
        filename: this.sanitizeFilename(filename),
        format: 'pdf',
        timestamp: new Date().toISOString(),
        pageCount: data.numpages,
        pdfInfo: data.info
      };

      const frontmatter = this.generateFrontmatter(metadata);

      // Extract text
      let text = data.text;

      // Apply basic structure detection
      let markdown = this.detectStructure(text, data.numpages);

      // Add title
      const title = data.info?.Title || filename.replace(/\.pdf$/i, '');
      markdown = this.normalizeHeading(title, 1) + markdown;

      return frontmatter + markdown;

    } catch (error) {
      console.error(`Error converting PDF ${filename}:`, error);
      throw new Error(`Failed to convert PDF: ${(error as Error).message}`);
    }
  }

  private detectStructure(text: string, pageCount: number): string {
    // Split into lines
    const lines = text.split('\n');
    let markdown = '';
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) {
        markdown += '\n';
        continue;
      }

      const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';

      // Heuristic: detect headings
      if (this.looksLikeHeading(line, nextLine)) {
        markdown += this.normalizeHeading(line, 2);
      }
      // Detect lists (lines starting with - or numbers)
      else if (line.match(/^[-•*]\s+/) || line.match(/^\d+\.\s+/)) {
        markdown += `${line}\n`;
      }
      // Detect potential code blocks
      else if (this.looksLikeCode(line)) {
        if (!inCodeBlock) {
          markdown += '```\n';
          inCodeBlock = true;
        }
        markdown += `${line}\n`;
      } else {
        if (inCodeBlock) {
          markdown += '```\n\n';
          inCodeBlock = false;
        }
        // Regular paragraph
        markdown += `${line}\n`;
      }
    }

    // Close code block if still open
    if (inCodeBlock) {
      markdown += '```\n\n';
    }

    // Add page breaks as horizontal rules (if multi-page)
    if (pageCount > 1) {
      markdown = this.addPageMarkers(markdown, pageCount);
    }

    return markdown;
  }

  private looksLikeHeading(line: string, nextLine: string): boolean {
    // Too long to be a heading
    if (line.length > 100) return false;

    // Check if ALL CAPS
    const isAllCaps = line === line.toUpperCase() && /[A-Z]/.test(line);

    // Check if Title Case
    const words = line.split(/\s+/);
    const isTitleCase = words.length > 0 && words.every(word =>
      word.length === 0 ||
      word[0] === word[0].toUpperCase()
    );

    // Check if followed by blank line
    const followedByBlank = !nextLine || nextLine === '';

    // Check if it's a numbered heading (e.g., "1. Introduction")
    const isNumberedHeading = /^\d+\.?\s+[A-Z]/.test(line);

    return (isAllCaps || isTitleCase || isNumberedHeading) && followedByBlank;
  }

  private addPageMarkers(markdown: string, pageCount: number): string {
    // Simple heuristic: divide text evenly by pages
    // Note: This is approximate - perfect page detection requires PDF parsing
    const lines = markdown.split('\n');
    const linesPerPage = Math.floor(lines.length / pageCount);

    if (linesPerPage < 10) {
      // Too few lines per page, don't add markers
      return markdown;
    }

    for (let page = 1; page < pageCount; page++) {
      const insertAt = page * linesPerPage;
      if (insertAt < lines.length) {
        lines.splice(insertAt, 0, `\n${this.createHorizontalRule()}_Page ${page + 1}_\n`);
      }
    }

    return lines.join('\n');
  }
}

export default PdfToMarkdown;
