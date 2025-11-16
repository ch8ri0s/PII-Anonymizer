/**
 * PDF to Markdown Converter
 * Converts PDF files to Markdown using structure detection heuristics
 */

// @ts-ignore - No type definitions available for pdf-parse
import pdfParse from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';
import { MarkdownConverter } from './MarkdownConverter.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('converter:pdf');

export class PdfToMarkdown extends MarkdownConverter {
  override async convert(filePath: string): Promise<string> {
    const filename = path.basename(filePath);
    const dataBuffer = await fs.readFile(filePath);

    try {
      const data = await pdfParse(dataBuffer);

      const metadata = {
        filename: this.sanitizeFilename(filename),
        format: 'pdf',
        timestamp: new Date().toISOString(),
        pageCount: data.numpages,
        pdfInfo: data.info,
      };

      const frontmatter = this.generateFrontmatter(metadata);

      // Extract text
      let text = data.text;

      // Fix broken word spacing (pdf-parse sometimes inserts spaces incorrectly)
      text = this.fixBrokenSpacing(text);

      // Fix merged words (common PDF encoding issue)
      text = this.fixMergedWords(text);

      // Apply basic structure detection
      let markdown = this.detectStructure(text, data.numpages);

      // Add title
      const title = data.info?.Title || filename.replace(/\.pdf$/i, '');
      markdown = this.normalizeHeading(title, 1) + markdown;

      return frontmatter + markdown;

    } catch (error) {
      log.error('Error converting PDF', { filename, error: (error as Error).message });
      throw new Error(`Failed to convert PDF: ${(error as Error).message}`);
    }
  }

  private detectStructure(text: string, pageCount: number): string {
    // Split into lines
    const lines = text.split('\n');
    let markdown = '';
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]?.trim() || '';

      if (!line) {
        markdown += '\n';
        continue;
      }

      const nextLine = i < lines.length - 1 ? lines[i + 1]?.trim() || '' : '';

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
      (word[0] && word[0] === word[0].toUpperCase()),
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

  /**
   * Fix broken word spacing where pdf-parse incorrectly inserts spaces within words
   * This handles text like "mes dames" → "mesdames", "Conform ément" → "Conformément"
   */
  private fixBrokenSpacing(text: string): string {
    const originalText = text.substring(0, 100);
    log.debug('fixBrokenSpacing input:', { sample: originalText });

    // Known broken words (specific fixes for this PDF's issues)
    const knownBrokenWords: { [key: string]: string } = {
      'mes dames': 'mesdames',
      'mes sie urs': 'messieurs',
      'da mes': 'dames',
      'sie urs': 'sieurs',
    };

    // Apply known fixes first (case-insensitive)
    for (const [broken, fixed] of Object.entries(knownBrokenWords)) {
      const regex = new RegExp(broken.replace(/\s/g, '\\s+'), 'gi');
      const beforeCount = (text.match(regex) || []).length;
      text = text.replace(regex, fixed);
      if (beforeCount > 0) {
        log.debug(`Fixed "${broken}" -> "${fixed}" (${beforeCount} instances)`);
      }
    }

    const outputSample = text.substring(0, 100);
    log.debug('fixBrokenSpacing output:', { sample: outputSample });

    // Pattern 1: Fix broken accented words (most reliable pattern)
    // "conform ément" → "conformément", "pr ésente" → "présente", "r éf érence" → "référence"
    text = text.replace(/([a-zà-öø-ÿ])\s+([éèêëàâäùûüôöïî][a-zà-öø-ÿ]+)/gi, '$1$2');

    // Pattern 2: Fix apostrophe spacing issues
    // "l ' entreprise" → "l'entreprise", "qu ' entreprise" → "qu'entreprise", "n ' est" → "n'est"
    text = text.replace(/\b([dlncmtsqj])\s+'\s*/gi, "$1'");
    text = text.replace(/\b(qu|ne|de|le|ce|me|te|se)\s+'\s*/gi, "$1'");
    text = text.replace(/([a-zà-öø-ÿ])\s+'\s+/gi, "$1' ");

    // Pattern 3: Fix broken words that end with common suffixes
    // "conform ément" → "conformément", "mes sie urs" → "messieurs"
    text = text.replace(/\b([a-zà-öø-ÿ]{2,})\s+([a-zà-öø-ÿ]{1,5})\b/g, (match, part1, part2) => {
      const merged = part1 + part2;
      const commonEndings = ['ment', 'tion', 'sion', 'eurs', 'ieurs', 'teur', 'trice', 'ance', 'ence', 'elle', 'esse', 'ante', 'ente', 'able', 'ible'];

      // If the merged result ends with a common suffix, it's likely a broken word
      if (commonEndings.some(ending => merged.toLowerCase().endsWith(ending))) {
        return merged;
      }
      return match;
    });

    // Pattern 4: Fix broken two-part words (aggressive merging for very short fragments)
    // But preserve common French/German words
    text = text.replace(/\b([a-zà-öø-ÿ]{2,4})\s+([a-zà-öø-ÿ]{2,4})\b/g, (match, part1, part2) => {
      // Common words to NOT merge (including articles, prepositions, pronouns)
      const commonWords = [
        'le', 'la', 'de', 'du', 'un', 'et', 'ou', 'en', 'au', 'à', 'ne', 'se', 'ce', 'me', 'te', 'es', 'je', 'tu', 'il',
        'par', 'sur', 'pour', 'dans', 'avec', 'sans', 'sous', 'vous', 'nous', 'elle', 'pas', 'est', 'sont',
        'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'und', 'von', 'mit', 'für', 'bei', 'aus',
      ];

      // If either part is a common word, don't merge
      if (commonWords.includes(part1.toLowerCase()) || commonWords.includes(part2.toLowerCase())) {
        return match;
      }

      // Merge them
      return part1 + part2;
    });

    return text;
  }

  /**
   * Fix merged words in PDF text (common encoding issue)
   * This handles text like "Mesdames,Messieurs,Conformémentà" → "Mesdames, Messieurs, Conformément à"
   */
  private fixMergedWords(text: string): string {
    const inputSample = text.substring(0, 100);
    log.debug('fixMergedWords input:', { sample: inputSample });

    // DISABLED: These patterns were incorrectly splitting compound words like "Conformément" → "Conform ément"
    // The word boundary \b isn't sufficient to prevent matching inside compound words
    // Instead, we'll rely on the lowercase-to-uppercase transition pattern below

    // // Add space after common words (lowercase only - case-sensitive to avoid breaking compound words)
    // for (const word of allWords) {
    //   // Match word followed by a letter (not space/punctuation)
    //   // Must be lowercase to avoid matching inside compound words like "Mesdames"
    //   const regex = new RegExp(`\\b${word}([A-ZÀ-Ÿa-zà-ÿ])`, 'g');
    //   text = text.replace(regex, `${word} $1`);
    // }

    // // Add space before common words when preceded by a letter (lowercase only)
    // for (const word of allWords) {
    //   const regex = new RegExp(`([A-ZÀ-Ÿa-zà-ÿ])\\b${word}\\b`, 'g');
    //   text = text.replace(regex, `$1 ${word}`);
    // }

    // Fix punctuation spacing
    // Add space after commas, periods, colons, semicolons if followed by letter
    text = text.replace(/([,.:;])([A-ZÀ-Ÿa-zà-ÿ])/g, '$1 $2');

    // Add space after closing quotes/parentheses if followed by letter
    text = text.replace(/(['")\]])([A-ZÀ-Ÿa-zà-ÿ])/g, '$1 $2');

    // Add space before opening quotes/parentheses if preceded by letter
    text = text.replace(/([A-ZÀ-Ÿa-zà-ÿ])(['"([[])/g, '$1 $2');

    // Split merged words at lowercase-to-uppercase transitions (except for acronyms)
    // E.g., "parlaprésente" → needs manual handling, but "attestonsparla" can be split
    // This helps with: "SoftcomTechnologiesSA" → "Softcom Technologies SA"
    // NOTE: Only match true uppercase letters [A-ZÀ-ÖØ-Þ], not lowercase accented chars
    text = text.replace(/([a-zà-ÿ])([A-ZÀ-ÖØ-Þ])/g, '$1 $2');

    // Fix merged French preposition "à" (very common in French text)
    // "Conformémentà" → "Conformément à", "àla" → "à la"
    text = text.replace(/([a-zà-ÿ]{2,})à(\s|[A-ZÀ-ÖØ-Þ])/g, '$1 à$2');
    text = text.replace(/(\s|^)à([a-zà-ÿ]{2,})/g, '$1à $2');

    // Fix common abbreviations (French)
    text = text.replace(/\bl'([a-zà-ÿ])/gi, "l'$1"); // l'art → l'art (keep apostrophe)
    text = text.replace(/\bd'([a-zà-ÿ])/gi, "d'$1"); // d'adhésion → d'adhésion
    text = text.replace(/\bqu'([a-zà-ÿ])/gi, "qu'$1"); // qu'entreprise → qu'entreprise
    text = text.replace(/\bn'([a-zà-ÿ])/gi, "n'$1"); // n'est → n'est
    text = text.replace(/\bc'([a-zà-ÿ])/gi, "c'$1"); // c'est → c'est

    // Remove multiple consecutive spaces
    text = text.replace(/  +/g, ' ');

    const outputSample = text.substring(0, 100);
    log.debug('fixMergedWords output:', { sample: outputSample });

    return text;
  }
}

export default PdfToMarkdown;
