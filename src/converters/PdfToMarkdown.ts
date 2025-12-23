/**
 * PDF to Markdown Converter
 * Converts PDF files to Markdown using structure detection heuristics
 * Enhanced with table detection and conversion (FR-001)
 *
 * Uses shared PdfTextProcessor for text spacing and letter layout detection.
 */

// @ts-ignore - No type definitions available for pdf-parse
import pdfParse from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';
import { MarkdownConverter, type DocumentMetadata } from './MarkdownConverter.js';
import { createLogger } from '../utils/LoggerFactory.js';
import { TableDetector, TableToMarkdownConverter } from '../utils/pdfTableDetector.js';
import type { TableStructure, PdfTextItem } from '../types/pdfTable.js';
import { PdfTextProcessor } from '../../shared/dist/converters/index.js';

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

  // Shared text processor for spacing fixes and letter layout detection
  private textProcessor: PdfTextProcessor;

  // Collected text items across all pages for table detection
  private collectedTextItems: PdfTextItem[] = [];
  private currentPageNumber = 0;

  constructor(options: import('./MarkdownConverter.js').MarkdownConverterOptions = {}) {
    super(options);
    this.tableDetector = new TableDetector();
    this.tableConverter = new TableToMarkdownConverter();
    this.textProcessor = new PdfTextProcessor();
  }

  /**
   * Custom page render function to extract positioned text items (T041)
   * This replaces the default pdf-parse render to capture text positions
   * for table detection while still returning text for fallback.
   *
   * pageData is pdf-parse internal structure (pdf.js based) with no published types.
   * Using interface inline to document the structure we rely on.
   */
  private createPageRenderer(): (pageData: {
    getTextContent(options: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }): Promise<{ items: PdfJsTextItem[] }>;
  }) => Promise<string> {

    const self = this;

    return async function(pageData: {
      getTextContent(options: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }): Promise<{ items: PdfJsTextItem[] }>;
    }): Promise<string> {
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
      const isLetter = this.collectedTextItems.length > 0 && this.textProcessor.isLetterLayout(this.collectedTextItems);

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
        // For letters, use shared text processor for position-based reconstruction
        const result = this.textProcessor.processTextItems(this.collectedTextItems);
        text = result.text;
        log.debug('Using position-based text reconstruction for letter', {
          isLetter: result.isLetter,
          hasSidebar: result.hasSidebar,
        });
      } else {
        // Use default pdf-parse text with fixes from shared processor
        text = data.text;
        text = this.textProcessor.fixTextSpacing(text);
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

  // Note: The following methods have been moved to shared/converters/PdfTextProcessor.ts:
  // - fixBrokenSpacing()
  // - fixMergedWords()
  // - isLetterLayout()
  // - reconstructTextFromItems()
  // - reconstructTextRegion()
  // - processLineItems()
  // These are now available via this.textProcessor
}

export default PdfToMarkdown;
