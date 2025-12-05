/**
 * PDF to Markdown Converter
 * Converts PDF files to Markdown using structure detection heuristics
 * Enhanced with table detection and conversion (FR-001)
 */

// @ts-ignore - No type definitions available for pdf-parse
import pdfParse from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';
import { MarkdownConverter, type DocumentMetadata } from './MarkdownConverter.js';
import { createLogger } from '../utils/logger.js';
import { TableDetector, TableToMarkdownConverter } from '../utils/pdfTableDetector.js';
import type { TableStructure, PdfTextItem } from '../types/index.js';

const log = createLogger('converter:pdf');

/**
 * Interface for pdf.js text content item
 * @see https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html
 */
interface PdfJsTextItem {
  str: string;
  transform: number[]; // [scaleX, skewX, skewY, scaleY, x, y]
  width: number;
  height: number;
  fontName?: string;
}

export class PdfToMarkdown extends MarkdownConverter {
  // Table detection infrastructure (T040)
  private tableDetector: TableDetector;
  private tableConverter: TableToMarkdownConverter;

  // Collected text items across all pages for table detection
  private collectedTextItems: PdfTextItem[] = [];
  private currentPageNumber = 0;

  constructor() {
    super();
    this.tableDetector = new TableDetector();
    this.tableConverter = new TableToMarkdownConverter();
  }

  /**
   * Custom page render function to extract positioned text items (T041)
   * This replaces the default pdf-parse render to capture text positions
   * for table detection while still returning text for fallback.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createPageRenderer(): (pageData: any) => Promise<string> {
     
    const self = this;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async function(pageData: any): Promise<string> {
      self.currentPageNumber++;

      const renderOptions = {
        normalizeWhitespace: false,
        disableCombineTextItems: false,
      };

      try {
        const textContent = await pageData.getTextContent(renderOptions);
        let lastY: number | undefined;
        let text = '';

        // Process each text item - extract positions for table detection
        for (const item of textContent.items as PdfJsTextItem[]) {
          // Extract position from transform matrix: [scaleX, skewX, skewY, scaleY, x, y]
          const x = item.transform[4] ?? 0;
          const y = item.transform[5] ?? 0;

          // Collect positioned text item for table detection
          const textItem: PdfTextItem = {
            str: item.str,
            x: x,
            y: y,
            width: item.width || 0,
            height: item.height || (item.transform[3] ?? 12), // Use scaleY as fallback height
            fontName: item.fontName,
          };
          self.collectedTextItems.push(textItem);

          // Build text output (same logic as default pdf-parse)
          if (lastY === y || lastY === undefined) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = y;
        }

        return text;
      } catch (error) {
        log.warn('Error extracting text from page', {
          page: self.currentPageNumber,
          error: (error as Error).message,
        });
        return '';
      }
    };
  }

  override async convert(filePath: string): Promise<string> {
    const filename = path.basename(filePath);
    const dataBuffer = await fs.readFile(filePath);

    // Reset state for new conversion
    this.collectedTextItems = [];
    this.currentPageNumber = 0;

    try {
      // Use custom page renderer to extract positioned text items (T041)
      const data = await pdfParse(dataBuffer, {
        pagerender: this.createPageRenderer(),
      });

      // Table detection using collected positioned text items (T041, T042)
      let detectedTables: TableStructure[] = [];
      let tableMarkdown = '';
      let tableDetectionUsed = false;

      // Check if this is a letter layout (sidebar + main content) - skip table detection
      const isLetter = this.collectedTextItems.length > 0 && this.isLetterLayout(this.collectedTextItems);

      if (this.collectedTextItems.length > 0 && !isLetter) {
        log.debug('Attempting table detection', {
          filename,
          textItemCount: this.collectedTextItems.length,
        });

        const detectionResult = this.tableDetector.detectTables(this.collectedTextItems);

        if (!detectionResult.fallbackUsed && detectionResult.tables.length > 0) {
          tableDetectionUsed = true;
          detectedTables = this.tableDetector.mergeTables(detectionResult.tables);

          // Convert detected tables to Markdown
          tableMarkdown = detectedTables
            .map(table => this.tableConverter.convertTable(table))
            .join('\n\n');

          log.info('Tables detected and converted', {
            filename,
            tableCount: detectedTables.length,
            method: detectionResult.method,
            confidence: detectionResult.confidence,
          });
        } else {
          log.debug('No tables detected, using text fallback', {
            filename,
            warnings: detectionResult.warnings,
          });
        }
      } else if (isLetter) {
        log.debug('Letter layout detected, skipping table detection', { filename });
      } else {
        log.debug('No positioned text items collected, using text fallback', {
          filename,
        });
      }

      const baseMetadata: DocumentMetadata = {
        filename: this.sanitizeFilename(filename),
        format: 'pdf',
        timestamp: new Date().toISOString(),
        pageCount: data.numpages,
        pdfInfo: data.info,
      };

      // Enhance metadata with table detection info (T043, T044)
      const metadata = this.addTableMetadata(baseMetadata, detectedTables, tableDetectionUsed);
      const frontmatter = this.generateFrontmatter(metadata);

      // Extract text - use position-based reconstruction for letters
      let text: string;
      if (isLetter && this.collectedTextItems.length > 0) {
        // For letters, reconstruct text from positioned items with proper spacing
        text = this.reconstructTextFromItems();
        log.debug('Using position-based text reconstruction for letter');
      } else {
        // Use default pdf-parse text with fixes
        text = data.text;
        // Fix broken word spacing (pdf-parse sometimes inserts spaces incorrectly)
        text = this.fixBrokenSpacing(text);
        // Fix merged words (common PDF encoding issue)
        text = this.fixMergedWords(text);
      }

      // Apply basic structure detection
      let markdown = this.detectStructure(text, data.numpages);

      // Add title
      const title = data.info?.Title || filename.replace(/\.pdf$/i, '');
      markdown = this.normalizeHeading(title, 1) + markdown;

      // Prepend table markdown if tables were detected
      if (tableMarkdown) {
        markdown = tableMarkdown + '\n\n' + markdown;
      }

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

    // Too short to be a heading (likely just a name or label)
    if (line.length < 10) return false;

    // Skip common non-heading patterns
    // Email addresses
    if (line.includes('@')) return false;
    // Phone numbers
    if (/\+?\d{2,}[\s.-]?\d{2,}/.test(line)) return false;
    // Dates
    if (/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(line)) return false;
    // Horizontal rules
    if (/^[-=_*]{3,}$/.test(line)) return false;
    // Postal codes / addresses
    if (/^\d{4,5}\s+[A-Z]/.test(line)) return false;
    // Name signatures (First Last pattern with 2-3 words)
    if (/^[A-Z][a-zà-ÿ]+\s+[A-Z][a-zà-ÿ]+(\s+[A-Z][a-zà-ÿ]+)?$/.test(line)) return false;
    // Contact labels
    if (/^(Contact|Visiteurs|Tél|www\.)/.test(line)) return false;

    // Check if ALL CAPS (and has at least 2 words)
    const isAllCaps = line === line.toUpperCase() && /[A-Z]/.test(line) && line.split(/\s+/).length >= 2;

    // Check if it's a numbered heading (e.g., "1. Introduction")
    const isNumberedHeading = /^\d+\.?\s+[A-Z]/.test(line);

    // Check if followed by blank line
    const followedByBlank = !nextLine || nextLine === '';

    return (isAllCaps || isNumberedHeading) && followedByBlank;
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
   * Enhance metadata with table detection information (T043)
   */
  private addTableMetadata(
    baseMetadata: DocumentMetadata,
    detectedTables: TableStructure[],
    tableDetectionUsed: boolean,
  ): DocumentMetadata {
    return {
      ...baseMetadata,
      tablesDetected: tableDetectionUsed,
      tableCount: detectedTables.length,
      detectionMethod: detectedTables.length > 0 ? detectedTables[0]?.method : 'none',
      confidence: detectedTables.length > 0
        ? detectedTables.reduce((sum, t) => sum + t.confidence, 0) / detectedTables.length
        : 0,
    };
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

    // Fix common merged compound words in French/German business documents
    // Postal code + city (e.g., "8085Zurich" → "8085 Zurich")
    text = text.replace(/(\d{4,5})([A-ZÀ-Ÿ][a-zà-ÿ]+)/g, '$1 $2');

    // Street/place name + number (e.g., "Mongevon25" → "Mongevon 25")
    text = text.replace(/([A-Za-zà-ÿ])(\d{1,4})(\s|$)/g, '$1 $2$3');

    // Common merged labels (French)
    text = text.replace(/\bNotreréférence\b/g, 'Notre référence');
    text = text.replace(/\bCasepostale\b/g, 'Case postale');
    text = text.replace(/\bAssurancesvie\b/g, 'Assurances vie');
    text = text.replace(/\bCheminde\b/g, 'Chemin de');
    text = text.replace(/\bFondationcollective\b/g, 'Fondation collective');
    text = text.replace(/\bTél\.direct\b/g, 'Tél. direct');

    // Format Swiss phone numbers (e.g., "+41216274137" → "+41 21 627 41 37")
    text = text.replace(/\+41(\d{2})(\d{3})(\d{2})(\d{2})/g, '+41 $1 $2 $3 $4');

    // Fix spaced punctuation in URLs/emails
    text = text.replace(/www\.\s+/g, 'www.');
    text = text.replace(/\.\s+ch\b/g, '.ch');
    text = text.replace(/\.\s+com\b/g, '.com');
    text = text.replace(/\s+@/g, '@');
    text = text.replace(/@\s+/g, '@');

    // Remove multiple consecutive spaces
    text = text.replace(/  +/g, ' ');

    const outputSample = text.substring(0, 100);
    log.debug('fixMergedWords output:', { sample: outputSample });

    return text;
  }

  /**
   * Reconstruct text from positioned text items with proper spacing
   * For letter layouts, separates sidebar from main content
   * Uses X-coordinate gaps to determine word boundaries
   */
  private reconstructTextFromItems(): string {
    if (this.collectedTextItems.length === 0) return '';

    // Calculate layout boundaries
    const xPositions = this.collectedTextItems.map(item => item.x);
    const minX = Math.min(...xPositions);
    const maxX = Math.max(...xPositions);
    const pageWidth = maxX - minX;

    // Determine sidebar threshold (items in left 25% are sidebar)
    const sidebarThreshold = minX + pageWidth * 0.25;

    // Separate sidebar and main content items
    const sidebarItems = this.collectedTextItems.filter(item => item.x < sidebarThreshold);
    const mainItems = this.collectedTextItems.filter(item => item.x >= sidebarThreshold);

    log.debug('Letter content separation', {
      sidebarThreshold,
      sidebarItemCount: sidebarItems.length,
      mainItemCount: mainItems.length,
    });

    // Process main content first (the actual letter body)
    const mainContent = this.reconstructTextRegion(mainItems);

    // Process sidebar (contact info, etc.) - will be appended at the end
    let sidebarContent = this.reconstructTextRegion(sidebarItems);

    // Apply merged word fixes to sidebar (which often has tighter kerning)
    sidebarContent = this.fixMergedWords(sidebarContent);

    // Combine: main content first, then sidebar as a separate section
    let result = mainContent;
    if (sidebarContent.trim()) {
      result += '\n\n---\n\n**Contact:**\n' + sidebarContent;
    }

    return result;
  }

  /**
   * Reconstruct text from a specific region of text items
   */
  private reconstructTextRegion(items: PdfTextItem[]): string {
    if (items.length === 0) return '';

    // Sort items by Y (descending - top to bottom) then X (ascending - left to right)
    const sortedItems = [...items].sort((a, b) => {
      const yDiff = b.y - a.y;
      if (Math.abs(yDiff) > 5) return yDiff;
      return a.x - b.x;
    });

    const lines: string[] = [];
    let currentLine: PdfTextItem[] = [];
    let currentY: number | null = null;

    for (const item of sortedItems) {
      if (currentY === null || Math.abs(item.y - currentY) > 5) {
        // New line - process previous line
        if (currentLine.length > 0) {
          lines.push(this.processLineItems(currentLine));
        }
        currentLine = [item];
        currentY = item.y;
      } else {
        currentLine.push(item);
      }
    }

    // Process last line
    if (currentLine.length > 0) {
      lines.push(this.processLineItems(currentLine));
    }

    return lines.join('\n');
  }

  /**
   * Process a line of text items into a properly spaced string
   */
  private processLineItems(items: PdfTextItem[]): string {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0]?.str ?? '';

    // Sort by X position
    items.sort((a, b) => a.x - b.x);

    let result = '';
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;

      if (i === 0) {
        result = item.str;
      } else {
        const prevItem = items[i - 1];
        if (!prevItem) {
          result += item.str;
          continue;
        }

        const gap = item.x - (prevItem.x + prevItem.width);

        // Add space if there's a significant gap (> 3 pixels typically indicates word break)
        // Smaller threshold for this PDF which has tight kerning
        if (gap > 2) {
          result += ' ' + item.str;
        } else {
          result += item.str;
        }
      }
    }

    return result;
  }

  /**
   * Check if the PDF layout suggests a formal letter (sidebar + main content)
   * Returns true if table detection should be skipped
   */
  private isLetterLayout(items: PdfTextItem[]): boolean {
    if (items.length < 20) return false;

    // Analyze X-position distribution
    const xPositions = items.map(item => item.x);
    const minX = Math.min(...xPositions);
    const maxX = Math.max(...xPositions);
    const pageWidth = maxX - minX;

    if (pageWidth < 200) return false;

    // Count items in left quarter (sidebar region)
    const leftThreshold = minX + pageWidth * 0.25;
    const leftItems = items.filter(item => item.x < leftThreshold).length;

    // Letter layout typically has sidebar (10-30% of items) and main content (70-90%)
    const leftRatio = leftItems / items.length;
    const isLetterLikeLayout = leftRatio > 0.1 && leftRatio < 0.35;

    // Check for typical letter structure markers
    const hasDateMarker = items.some(item =>
      /\b(Date|Datum|date)\b/i.test(item.str) ||
      /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(item.str),
    );
    const hasReferenceMarker = items.some(item =>
      /\b(référence|Referenz|reference|Réf|Ref)\b/i.test(item.str),
    );
    const hasSalutation = items.some(item =>
      /\b(Mesdames|Messieurs|Madame|Monsieur|Sehr geehrte|Dear)\b/i.test(item.str),
    );

    log.debug('Letter layout detection', {
      leftRatio: leftRatio.toFixed(2),
      isLetterLikeLayout,
      hasDateMarker,
      hasReferenceMarker,
      hasSalutation,
    });

    return isLetterLikeLayout && (hasDateMarker || hasReferenceMarker) && hasSalutation;
  }
}

export default PdfToMarkdown;
