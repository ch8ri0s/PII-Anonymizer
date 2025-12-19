/**
 * PDF to Markdown Converter (Browser Version)
 *
 * Uses Mozilla's pdf.js for browser-native PDF parsing.
 * Extracts text content and attempts basic structure detection.
 */

// Detect environment
const isNode = typeof process !== 'undefined' && process.versions?.node;

// Lazy-loaded pdf.js library (avoid top-level await for build compatibility)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any = null;
let pdfjsInitPromise: Promise<void> | null = null;

/**
 * Initialize pdf.js library lazily
 * Uses appropriate build based on environment (Node.js vs browser)
 */
async function initPdfJs(): Promise<void> {
  if (pdfjsLib) return;

  if (pdfjsInitPromise) {
    await pdfjsInitPromise;
    return;
  }

  pdfjsInitPromise = (async () => {
    if (isNode) {
      // Node.js environment (tests) - use legacy build
      pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    } else {
      // Browser environment - use standard build with worker
      pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();
    }
  })();

  await pdfjsInitPromise;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  dir: string;
}

export class PdfConverter {
  static readonly SUPPORTED_TYPES = ['application/pdf'];
  static readonly SUPPORTED_EXTENSIONS = ['.pdf'];

  supports(file: File): boolean {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return (
      PdfConverter.SUPPORTED_TYPES.includes(file.type) ||
      PdfConverter.SUPPORTED_EXTENSIONS.includes(ext)
    );
  }

  async convert(file: File): Promise<string> {
    // Ensure pdf.js is initialized
    await initPdfJs();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = this.processTextContent(textContent.items as TextItem[]);
      pages.push(pageText);
    }

    return pages.join('\n\n---\n\n');
  }

  private processTextContent(items: TextItem[]): string {
    if (items.length === 0) return '';

    // Filter empty items
    const validItems = items.filter(item => item.str.trim());
    if (validItems.length === 0) return '';

    // Detect columns by analyzing X position distribution
    const columns = this.detectColumns(validItems);

    if (columns.length > 1) {
      // Multi-column layout: process each column separately, then concatenate
      return this.processMultiColumnLayout(validItems, columns);
    }

    // Single column: use standard processing
    return this.processSingleColumn(validItems);
  }

  /**
   * Detect column boundaries by analyzing X position clustering
   * Designed to detect sidebar + main content layouts common in formal letters/documents
   */
  private detectColumns(items: TextItem[]): Array<{ start: number; end: number }> {
    // Get all X positions
    const xPositions = items.map(item => item.transform[4]);
    const minX = Math.min(...xPositions);
    const maxX = Math.max(...xPositions);
    const pageWidth = maxX - minX;

    // If page is narrow, assume single column
    if (pageWidth < 200) {
      return [{ start: minX - 10, end: maxX + 10 }];
    }

    // Find the most common "left edge" X position for main content
    // This helps detect sidebar layouts where sidebar items have varied X positions
    // but main content consistently starts at a specific X
    const leftEdges = new Map<number, number>();
    const edgeTolerance = 10;

    for (const item of items) {
      const x = Math.round(item.transform[4] / edgeTolerance) * edgeTolerance;
      leftEdges.set(x, (leftEdges.get(x) || 0) + 1);
    }

    // Find the dominant left edge (most items start here)
    let dominantEdge = minX;
    let maxCount = 0;
    for (const [x, count] of leftEdges) {
      if (count > maxCount && x > minX + 50) {
        // Must be at least 50px from the absolute left to be "main content"
        maxCount = count;
        dominantEdge = x;
      }
    }

    // If there are items significantly to the left of the dominant edge,
    // that's likely a sidebar
    const sidebarThreshold = dominantEdge - 20;
    const sidebarItems = items.filter(item => item.transform[4] < sidebarThreshold);
    const mainItems = items.filter(item => item.transform[4] >= sidebarThreshold);

    // Only create separate columns if sidebar has meaningful content (5+ items)
    if (sidebarItems.length >= 5 && mainItems.length >= 5) {
      const sidebarMaxX = Math.max(...sidebarItems.map(i => i.transform[4]));
      return [
        { start: minX - 10, end: sidebarMaxX + 20 },
        { start: sidebarThreshold, end: maxX + 10 }
      ];
    }

    // No clear sidebar detected, return single column
    return [{ start: minX - 10, end: maxX + 10 }];
  }

  /**
   * Process multi-column layout by handling each column separately
   */
  private processMultiColumnLayout(
    items: TextItem[],
    columns: Array<{ start: number; end: number }>
  ): string {
    const columnTexts: string[] = [];

    for (const column of columns) {
      // Get items in this column
      const columnItems = items.filter(item => {
        const x = item.transform[4];
        return x >= column.start && x < column.end;
      });

      if (columnItems.length > 0) {
        const text = this.processSingleColumn(columnItems);
        if (text.trim()) {
          columnTexts.push(text);
        }
      }
    }

    // Join columns with double newline
    return columnTexts.join('\n\n');
  }

  /**
   * Process a single column of text items
   */
  private processSingleColumn(items: TextItem[]): string {
    // Group items by their Y position (line detection)
    const lines = new Map<number, TextItem[]>();
    const yTolerance = 3; // Pixels tolerance for same-line detection

    for (const item of items) {
      if (!item.str.trim()) continue;

      const y = Math.round(item.transform[5] / yTolerance) * yTolerance;

      if (!lines.has(y)) {
        lines.set(y, []);
      }
      lines.get(y)!.push(item);
    }

    // Sort lines by Y position (descending for PDF coordinate system)
    const sortedYs = Array.from(lines.keys()).sort((a, b) => b - a);

    // Build text from lines
    const textLines: string[] = [];
    let prevY: number | null = null;

    for (const y of sortedYs) {
      const lineItems = lines.get(y)!;

      // Sort items in line by X position
      lineItems.sort((a, b) => a.transform[4] - b.transform[4]);

      // Reconstruct line with proper spacing
      let lineText = '';
      let prevX = 0;
      let prevWidth = 0;

      for (const item of lineItems) {
        const x = item.transform[4];
        const gap = x - (prevX + prevWidth);

        // Add space if there's a significant gap
        if (lineText && gap > 5) {
          lineText += ' ';
        } else if (lineText && gap > 1) {
          // Small gap, might need space
          if (!lineText.endsWith(' ')) {
            lineText += ' ';
          }
        }

        lineText += item.str;
        prevX = x;
        prevWidth = item.width;
      }

      // Detect font size for heading detection
      const fontSize = lineItems[0]?.height || 12;

      // Add paragraph break if there's a large gap between lines
      if (prevY !== null && prevY - y > 20) {
        textLines.push('');
      }

      // Detect potential headings (larger font size)
      if (fontSize > 14 && lineText.trim().length < 100) {
        const level = fontSize > 20 ? '#' : fontSize > 16 ? '##' : '###';
        textLines.push(`${level} ${lineText.trim()}`);
      } else {
        textLines.push(lineText.trim());
      }

      prevY = y;
    }

    // Clean up multiple empty lines
    return textLines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

export default PdfConverter;
