/**
 * PDF to Markdown Converter (Browser Version)
 *
 * Uses Mozilla's pdf.js for browser-native PDF parsing.
 * Uses shared PdfTextProcessor for text processing logic.
 */

import { PdfTextProcessor, type PdfTextItem } from '../../../shared/converters';

// Detect environment
const isNode = typeof process !== 'undefined' && process.versions?.node;

// Lazy-loaded pdf.js library (avoid top-level await for build compatibility)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any = null;
let pdfjsInitPromise: Promise<void> | null = null;

/**
 * Initialize pdf.js library lazily
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
        import.meta.url,
      ).toString();
    }
  })();

  await pdfjsInitPromise;
}

interface PdfJsTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  dir: string;
}

export class PdfConverter {
  static readonly SUPPORTED_TYPES = ['application/pdf'];
  static readonly SUPPORTED_EXTENSIONS = ['.pdf'];

  private textProcessor: PdfTextProcessor;

  constructor() {
    this.textProcessor = new PdfTextProcessor();
  }

  supports(file: File): boolean {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return (
      PdfConverter.SUPPORTED_TYPES.includes(file.type) ||
      PdfConverter.SUPPORTED_EXTENSIONS.includes(ext)
    );
  }

  async convert(file: File): Promise<string> {
    await initPdfJs();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const allTextItems: PdfTextItem[] = [];
    const pages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const items = textContent.items as PdfJsTextItem[];

      // Collect positioned text items for the processor
      const pageItems = this.extractTextItems(items);
      allTextItems.push(...pageItems);

      // Also store raw page text for fallback
      pages.push(this.extractRawText(items));
    }

    // Use shared processor for proper text reconstruction
    if (allTextItems.length > 0) {
      const result = this.textProcessor.processTextItems(allTextItems);
      return result.text;
    }

    // Fallback to simple concatenation
    return pages.join('\n\n---\n\n');
  }

  /**
   * Extract positioned text items from pdf.js output
   */
  private extractTextItems(items: PdfJsTextItem[]): PdfTextItem[] {
    return items
      .filter(item => item.str.trim())
      .map(item => ({
        str: item.str,
        x: item.transform[4] ?? 0,
        y: item.transform[5] ?? 0,
        width: item.width || 0,
        height: item.height || (item.transform[3] ?? 12),
      }));
  }

  /**
   * Extract raw text as fallback
   */
  private extractRawText(items: PdfJsTextItem[]): string {
    let text = '';
    let lastY: number | undefined;

    for (const item of items) {
      const y = item.transform[5];
      if (lastY === y || lastY === undefined) {
        text += item.str;
      } else {
        text += '\n' + item.str;
      }
      lastY = y;
    }

    return text;
  }
}

export default PdfConverter;
