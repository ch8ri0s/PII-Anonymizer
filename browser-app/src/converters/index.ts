/**
 * Unified Converter Interface (Browser Version)
 *
 * Provides a single entry point for all file conversions.
 */

import { TextConverter } from './TextConverter';
import { CsvConverter } from './CsvConverter';
import { PdfConverter } from './PdfConverter';
import { DocxConverter } from './DocxConverter';
import { ExcelConverter } from './ExcelConverter';

export { TextConverter, CsvConverter, PdfConverter, DocxConverter, ExcelConverter };

const converters = [
  new TextConverter(),
  new CsvConverter(),
  new PdfConverter(),
  new DocxConverter(),
  new ExcelConverter(),
];

/**
 * Convert a file to Markdown
 */
export async function convertToMarkdown(file: File): Promise<string> {
  const converter = converters.find(c => c.supports(file));

  if (!converter) {
    throw new Error(`Unsupported file type: ${file.type || file.name}`);
  }

  return await converter.convert(file);
}

/**
 * Check if a file type is supported
 */
export function isSupported(file: File): boolean {
  return converters.some(c => c.supports(file));
}

/**
 * Get list of supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return [
    ...TextConverter.SUPPORTED_EXTENSIONS,
    ...CsvConverter.SUPPORTED_EXTENSIONS,
    ...PdfConverter.SUPPORTED_EXTENSIONS,
    ...DocxConverter.SUPPORTED_EXTENSIONS,
    ...ExcelConverter.SUPPORTED_EXTENSIONS,
  ];
}
