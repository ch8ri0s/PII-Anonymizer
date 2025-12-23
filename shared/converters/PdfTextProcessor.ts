/**
 * PDF Text Processor - Shared Logic
 *
 * Platform-agnostic text processing for PDF conversion.
 * Used by both Electron (PdfToMarkdown.ts) and browser (PdfConverter.ts) apps.
 *
 * Handles:
 * - Letter layout detection (sidebar + main content)
 * - Position-based text reconstruction with proper spacing
 * - Word spacing fixes (broken/merged words common in PDFs)
 * - Multi-column layout detection
 */

/**
 * Positioned text item from PDF parsing
 */
export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName?: string;
}

/**
 * Result of text processing
 */
export interface ProcessedTextResult {
  text: string;
  isLetter: boolean;
  hasSidebar: boolean;
  mainContent: string;
  sidebarContent: string;
}

/**
 * Column boundaries for multi-column detection
 */
interface ColumnBounds {
  start: number;
  end: number;
}

/**
 * PDF Text Processor
 *
 * Processes positioned text items from PDF.js into properly formatted text.
 */
export class PdfTextProcessor {
  /**
   * Process text items into formatted text
   * Automatically detects letter layouts and handles multi-column documents
   */
  processTextItems(items: PdfTextItem[]): ProcessedTextResult {
    if (items.length === 0) {
      return {
        text: '',
        isLetter: false,
        hasSidebar: false,
        mainContent: '',
        sidebarContent: '',
      };
    }

    // Check if this is a formal letter layout
    const isLetter = this.isLetterLayout(items);
    console.log('[PdfTextProcessor] processTextItems called, isLetter:', isLetter, 'items:', items.length);
    // Debug: Log items containing apostrophe-like characters
    const apostropheItems = items.filter(i => i.str.includes("'") || i.str.includes("'") || i.str.includes("ʼ") || i.str.includes("d") || i.str.includes("adhésion"));
    if (apostropheItems.length > 0) {
      console.log('[PdfTextProcessor] Items with d/apostrophe/adhésion:', apostropheItems.slice(0, 10).map(i => ({ str: i.str, x: Math.round(i.x) })));
    }

    if (isLetter) {
      return this.processLetterLayout(items);
    }

    // Check for multi-column layout
    const columns = this.detectColumns(items);

    if (columns.length > 1) {
      const text = this.processMultiColumnLayout(items, columns);
      return {
        text,
        isLetter: false,
        hasSidebar: false,
        mainContent: text,
        sidebarContent: '',
      };
    }

    // Single column - standard processing
    const text = this.reconstructTextRegion(items);
    return {
      text: this.fixTextSpacing(text),
      isLetter: false,
      hasSidebar: false,
      mainContent: text,
      sidebarContent: '',
    };
  }

  /**
   * Check if the PDF layout suggests a formal letter (sidebar + main content)
   */
  isLetterLayout(items: PdfTextItem[]): boolean {
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
    const hasDateMarker = items.some(
      item =>
        /\b(Date|Datum|date)\b/i.test(item.str) ||
        /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(item.str),
    );
    const hasReferenceMarker = items.some(item =>
      /\b(référence|Referenz|reference|Réf|Ref|Notre\s+référence)\b/i.test(item.str),
    );
    const hasSalutation = items.some(item =>
      /\b(Mesdames|Messieurs|Madame|Monsieur|Sehr geehrte|Dear)\b/i.test(item.str),
    );

    return isLetterLikeLayout && (hasDateMarker || hasReferenceMarker) && hasSalutation;
  }

  /**
   * Process a formal letter layout
   * Separates sidebar (contact info) from main content (letter body)
   * Returns main content first, sidebar at the end
   */
  private processLetterLayout(items: PdfTextItem[]): ProcessedTextResult {
    // Calculate layout boundaries
    const xPositions = items.map(item => item.x);
    const minX = Math.min(...xPositions);
    const maxX = Math.max(...xPositions);
    const pageWidth = maxX - minX;

    // Determine sidebar threshold (items in left 25% are sidebar)
    const sidebarThreshold = minX + pageWidth * 0.25;

    // Separate sidebar and main content items
    const sidebarItems = items.filter(item => item.x < sidebarThreshold);
    const mainItems = items.filter(item => item.x >= sidebarThreshold);

    // Process main content first (the actual letter body)
    let mainContent = this.reconstructTextRegion(mainItems);
    mainContent = this.fixTextSpacing(mainContent);

    // Process sidebar (contact info, etc.)
    let sidebarContent = this.reconstructTextRegion(sidebarItems);
    sidebarContent = this.fixTextSpacing(sidebarContent);

    // Combine: main content first, then sidebar as a separate section
    let text = mainContent;
    if (sidebarContent.trim()) {
      text += '\n\n---\n\n**Contact:**\n' + sidebarContent;
    }

    return {
      text,
      isLetter: true,
      hasSidebar: sidebarContent.trim().length > 0,
      mainContent,
      sidebarContent,
    };
  }

  /**
   * Detect column boundaries by analyzing X position clustering
   */
  private detectColumns(items: PdfTextItem[]): ColumnBounds[] {
    const xPositions = items.map(item => item.x);
    const minX = Math.min(...xPositions);
    const maxX = Math.max(...xPositions);
    const pageWidth = maxX - minX;

    // If page is narrow, assume single column
    if (pageWidth < 200) {
      return [{ start: minX - 10, end: maxX + 10 }];
    }

    // Find the most common "left edge" X position for main content
    const leftEdges = new Map<number, number>();
    const edgeTolerance = 10;

    for (const item of items) {
      const x = Math.round(item.x / edgeTolerance) * edgeTolerance;
      leftEdges.set(x, (leftEdges.get(x) || 0) + 1);
    }

    // Find the dominant left edge (most items start here)
    let dominantEdge = minX;
    let maxCount = 0;
    for (const [x, count] of leftEdges) {
      if (count > maxCount && x > minX + 50) {
        maxCount = count;
        dominantEdge = x;
      }
    }

    // If there are items significantly to the left of the dominant edge,
    // that's likely a sidebar
    const sidebarThreshold = dominantEdge - 20;
    const sidebarItems = items.filter(item => item.x < sidebarThreshold);
    const mainItems = items.filter(item => item.x >= sidebarThreshold);

    // Only create separate columns if sidebar has meaningful content
    if (sidebarItems.length >= 5 && mainItems.length >= 5) {
      const sidebarMaxX = Math.max(...sidebarItems.map(i => i.x));
      return [
        { start: minX - 10, end: sidebarMaxX + 20 },
        { start: sidebarThreshold, end: maxX + 10 },
      ];
    }

    return [{ start: minX - 10, end: maxX + 10 }];
  }

  /**
   * Process multi-column layout
   * For formal letters (sidebar + main), outputs main content first
   */
  private processMultiColumnLayout(items: PdfTextItem[], columns: ColumnBounds[]): string {
    // For 2-column layout (sidebar + main), prioritize main content
    if (columns.length === 2) {
      const leftColumn = columns[0];
      const rightColumn = columns[1];

      const leftItems = items.filter(item => item.x >= leftColumn.start && item.x < leftColumn.end);
      const rightItems = items.filter(
        item => item.x >= rightColumn.start && item.x < rightColumn.end,
      );

      const leftText = leftItems.length > 0 ? this.reconstructTextRegion(leftItems) : '';
      const rightText = rightItems.length > 0 ? this.reconstructTextRegion(rightItems) : '';

      const leftAvgLineLength = this.getAverageLineLength(leftText);
      const rightAvgLineLength = this.getAverageLineLength(rightText);

      // If right column has longer lines (body text), treat left as sidebar
      if (rightAvgLineLength > leftAvgLineLength * 1.3 && rightItems.length >= 5) {
        const parts: string[] = [];

        if (rightText.trim()) {
          parts.push(this.fixTextSpacing(rightText));
        }

        if (leftText.trim() && leftItems.length >= 3) {
          parts.push('---\n\n**Sender Information:**\n' + this.fixTextSpacing(leftText));
        }

        return parts.join('\n\n');
      }
    }

    // Default: process columns left to right
    const columnTexts: string[] = [];

    for (const column of columns) {
      const columnItems = items.filter(item => item.x >= column.start && item.x < column.end);

      if (columnItems.length > 0) {
        const text = this.reconstructTextRegion(columnItems);
        if (text.trim()) {
          columnTexts.push(this.fixTextSpacing(text));
        }
      }
    }

    return columnTexts.join('\n\n');
  }

  /**
   * Reconstruct text from positioned items with proper line grouping and spacing
   */
  reconstructTextRegion(items: PdfTextItem[]): string {
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

        // Add space if there's a significant gap (> 2-3 pixels typically indicates word break)
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
   * Calculate average line length for a text block
   */
  private getAverageLineLength(text: string): number {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return 0;
    const totalLength = lines.reduce((sum, line) => sum + line.trim().length, 0);
    return totalLength / lines.length;
  }

  /**
   * Apply all text spacing fixes
   */
  fixTextSpacing(text: string): string {
    console.log('[PdfTextProcessor] fixTextSpacing INPUT:', JSON.stringify(text.substring(0, 300)));
    text = this.fixBrokenSpacing(text);
    text = this.fixMergedWords(text);
    console.log('[PdfTextProcessor] fixTextSpacing OUTPUT:', JSON.stringify(text.substring(0, 300)));
    return text;
  }

  /**
   * Fix broken word spacing where pdf-parse incorrectly inserts spaces within words
   * Handles: "mes dames" → "mesdames", "Conform ément" → "Conformément"
   */
  fixBrokenSpacing(text: string): string {
    console.log('[PdfTextProcessor] fixBrokenSpacing called, text length:', text.length);
    // Check for any apostrophe pattern in input - log first 500 chars
    console.log('[PdfTextProcessor] INPUT text sample:', JSON.stringify(text.substring(0, 500)));
    // Check for apostrophe patterns specifically
    const apostropheIdx = text.search(/[dlnc]\s+['ʼ']\s+/i);
    if (apostropheIdx >= 0) {
      console.log('[PdfTextProcessor] Found apostrophe pattern at:', apostropheIdx, text.substring(apostropheIdx, apostropheIdx + 20));
    }
    // Known broken words (specific fixes)
    const knownBrokenWords: { [key: string]: string } = {
      'mes dames': 'mesdames',
      'mes sie urs': 'messieurs',
      'da mes': 'dames',
      'sie urs': 'sieurs',
    };

    // Apply known fixes (case-insensitive)
    for (const [broken, fixed] of Object.entries(knownBrokenWords)) {
      const regex = new RegExp(broken.replace(/\s/g, '\\s+'), 'gi');
      text = text.replace(regex, fixed);
    }

    // Pattern 1: Fix broken accented words
    // "conform ément" → "conformément", "pr ésente" → "présente"
    text = text.replace(/([a-zà-öø-ÿ])\s+([éèêëàâäùûüôöïî][a-zà-öø-ÿ]+)/gi, '$1$2');

    // Pattern 2: Fix apostrophe spacing in French elisions
    // Handle: "d ' adhésion" → "d'adhésion", "l ' entreprise" → "l'entreprise"
    // Handle: "n ' est" → "n'est", "N ' hésitez" → "N'hésitez"
    // Match various apostrophe characters:
    // ' U+0027 (straight apostrophe), ' U+2019 (right single quote), ʼ U+02BC (modifier)
    // Single letter elisions (d', l', n', c', m', t', s', j', q')
    const beforeApostrophe = text;
    text = text.replace(/\b([dlncmtsqjDLNCMTSQJ])\s*['\u2019\u02BC]\s*([a-zA-Zà-öø-ÿÀ-ÖØ-Ÿ])/g, "$1'$2");
    // Two-letter elisions (qu')
    text = text.replace(/\b(qu|Qu|QU)\s*['\u2019\u02BC]\s*([a-zA-Zà-öø-ÿÀ-ÖØ-Ÿ])/g, "$1'$2");
    if (beforeApostrophe !== text) {
      console.log('[PdfTextProcessor] Apostrophe fix applied');
      // Find what was changed
      const idx = beforeApostrophe.indexOf("d '");
      if (idx >= 0) {
        console.log('[PdfTextProcessor] BEFORE:', beforeApostrophe.substring(idx, idx + 30));
        console.log('[PdfTextProcessor] AFTER:', text.substring(idx, idx + 30));
      }
    } else if (beforeApostrophe.includes("d '") || beforeApostrophe.includes("l '") || beforeApostrophe.includes("n '")) {
      console.log('[PdfTextProcessor] WARNING: Apostrophe pattern found but not fixed!');
      console.log('[PdfTextProcessor] Sample:', beforeApostrophe.substring(0, 200));
    }

    // Pattern 3: Fix broken words that end with common suffixes
    text = text.replace(/\b([a-zà-öø-ÿ]{2,})\s+([a-zà-öø-ÿ]{1,5})\b/g, (match, part1, part2) => {
      const merged = part1 + part2;
      const commonEndings = [
        'ment',
        'tion',
        'sion',
        'eurs',
        'ieurs',
        'teur',
        'trice',
        'ance',
        'ence',
        'elle',
        'esse',
        'ante',
        'ente',
        'able',
        'ible',
      ];

      if (commonEndings.some(ending => merged.toLowerCase().endsWith(ending))) {
        return merged;
      }
      return match;
    });

    // Pattern 4: Fix broken two-part words (but preserve common words)
    text = text.replace(/\b([a-zà-öø-ÿ]{2,4})\s+([a-zà-öø-ÿ]{2,4})\b/g, (match, part1, part2) => {
      const commonWords = [
        'le',
        'la',
        'de',
        'du',
        'un',
        'et',
        'ou',
        'en',
        'au',
        'à',
        'ne',
        'se',
        'ce',
        'me',
        'te',
        'es',
        'je',
        'tu',
        'il',
        'par',
        'sur',
        'pour',
        'dans',
        'avec',
        'sans',
        'sous',
        'vous',
        'nous',
        'elle',
        'pas',
        'est',
        'sont',
        'der',
        'die',
        'das',
        'den',
        'dem',
        'des',
        'ein',
        'und',
        'von',
        'mit',
        'für',
        'bei',
        'aus',
      ];

      if (commonWords.includes(part1.toLowerCase()) || commonWords.includes(part2.toLowerCase())) {
        return match;
      }

      return part1 + part2;
    });

    return text;
  }

  /**
   * Fix merged words in PDF text (common encoding issue)
   * Handles: "Mesdames,Messieurs" → "Mesdames, Messieurs"
   */
  fixMergedWords(text: string): string {
    // Fix punctuation spacing
    text = text.replace(/([,.:;])([A-ZÀ-Ÿa-zà-ÿ])/g, '$1 $2');

    // Add space after closing quotes/parentheses if followed by letter
    text = text.replace(/(['")\]])([A-ZÀ-Ÿa-zà-ÿ])/g, '$1 $2');

    // Add space before opening quotes/parentheses if preceded by letter
    text = text.replace(/([A-ZÀ-Ÿa-zà-ÿ])(['"([[])/g, '$1 $2');

    // Split merged words at lowercase-to-uppercase transitions
    // "SoftcomTechnologiesSA" → "Softcom Technologies SA"
    text = text.replace(/([a-zà-ÿ])([A-ZÀ-ÖØ-Þ])/g, '$1 $2');

    // Fix merged French preposition "à"
    text = text.replace(/([a-zà-ÿ]{2,})à(\s|[A-ZÀ-ÖØ-Þ])/g, '$1 à$2');
    text = text.replace(/(\s|^)à([a-zà-ÿ]{2,})/g, '$1à $2');

    // Fix common abbreviations (French apostrophes)
    text = text.replace(/\bl'([a-zà-ÿ])/gi, "l'$1");
    text = text.replace(/\bd'([a-zà-ÿ])/gi, "d'$1");
    text = text.replace(/\bqu'([a-zà-ÿ])/gi, "qu'$1");
    text = text.replace(/\bn'([a-zà-ÿ])/gi, "n'$1");
    text = text.replace(/\bc'([a-zà-ÿ])/gi, "c'$1");

    // Fix postal code + city (e.g., "8085Zurich" → "8085 Zurich")
    text = text.replace(/(\d{4,5})([A-ZÀ-Ÿ][a-zà-ÿ]+)/g, '$1 $2');

    // Fix street name + number (e.g., "Mongevon25" → "Mongevon 25")
    text = text.replace(/([A-Za-zà-ÿ])(\d{1,4})(\s|$)/g, '$1 $2$3');

    // Common merged labels (French)
    text = text.replace(/\bNotreréférence\b/g, 'Notre référence');
    text = text.replace(/\bCasepostale\b/g, 'Case postale');
    text = text.replace(/\bAssurancesvie\b/g, 'Assurances vie');
    text = text.replace(/\bCheminde\b/g, 'Chemin de');
    text = text.replace(/\bFondationcollective\b/g, 'Fondation collective');
    text = text.replace(/\bTél\.direct\b/g, 'Tél. direct');
    text = text.replace(/\badhésionno\b/gi, 'adhésion no');
    text = text.replace(/\bContratno\b/gi, 'Contrat no');

    // Format Swiss phone numbers ("+41216274137" → "+41 21 627 41 37")
    text = text.replace(/\+41(\d{2})(\d{3})(\d{2})(\d{2})/g, '+41 $1 $2 $3 $4');

    // Fix spaced punctuation in URLs/emails
    text = text.replace(/www\.\s+/g, 'www.');
    text = text.replace(/\.\s+ch\b/g, '.ch');
    text = text.replace(/\.\s+com\b/g, '.com');
    text = text.replace(/\s+@/g, '@');
    text = text.replace(/@\s+/g, '@');

    // Remove multiple consecutive spaces
    text = text.replace(/  +/g, ' ');

    return text;
  }
}

export default PdfTextProcessor;
