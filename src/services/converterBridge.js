/**
 * Converter Bridge Module
 *
 * Provides a CommonJS-compatible interface to the ES6 converter modules.
 * This bridge allows TypeScript utilities (compiled to CommonJS) to use
 * the existing ES6 converter classes.
 */

import { DocxToMarkdown } from '../converters/DocxToMarkdown.js';
import { PdfToMarkdown } from '../converters/PdfToMarkdown.js';
import { ExcelToMarkdown } from '../converters/ExcelToMarkdown.js';
import { CsvToMarkdown } from '../converters/CsvToMarkdown.js';
import { TextToMarkdown } from '../converters/TextToMarkdown.js';

// Initialize converter instances
const converters = {
  docx: new DocxToMarkdown(),
  pdf: new PdfToMarkdown(),
  excel: new ExcelToMarkdown(),
  csv: new CsvToMarkdown(),
  txt: new TextToMarkdown(),
};

/**
 * Extract text content from a DOCX file
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<string>} - Extracted text content
 */
export async function convertDocxToText(filePath) {
  const markdown = await converters.docx.convert(filePath);
  return stripMarkdownFormatting(markdown);
}

/**
 * Extract text content from a PDF file
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<string>} - Extracted text content
 */
export async function convertPdfToText(filePath) {
  const markdown = await converters.pdf.convert(filePath);
  return stripMarkdownFormatting(markdown);
}

/**
 * Extract text content from an Excel file
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<string>} - Extracted text content
 */
export async function convertExcelToText(filePath) {
  const markdown = await converters.excel.convert(filePath);
  return stripMarkdownFormatting(markdown);
}

/**
 * Extract text content from a CSV file
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<string>} - Extracted text content
 */
export async function convertCsvToText(filePath) {
  const markdown = await converters.csv.convert(filePath);
  return stripMarkdownFormatting(markdown);
}

/**
 * Extract text content from a plain text file
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<string>} - Extracted text content
 */
export async function convertTxtToText(filePath) {
  const markdown = await converters.txt.convert(filePath);
  return stripMarkdownFormatting(markdown);
}

/**
 * Strip markdown formatting to get plain text
 * Removes frontmatter, headers, tables, and formatting
 * @param {string} markdown - Markdown content
 * @returns {string} - Plain text
 */
function stripMarkdownFormatting(markdown) {
  let text = markdown;

  // Remove frontmatter (--- ... ---)
  text = text.replace(/^---\n[\s\S]*?\n---\n/m, '');

  // Remove markdown headers (#, ##, etc.)
  text = text.replace(/^#{1,6}\s+(.*)$/gm, '$1');

  // Remove bold and italic
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');

  // Remove inline code
  text = text.replace(/`([^`]+)`/g, '$1');

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');

  // Remove links but keep text [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // Remove images ![alt](url)
  text = text.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '');

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}$/gm, '');

  // Remove table formatting
  text = text.replace(/\|/g, ' ');
  text = text.replace(/^[-:| ]+$/gm, '');

  // Remove list markers
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  // Remove blockquotes
  text = text.replace(/^>\s+/gm, '');

  // Normalize whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

/**
 * Convert file to text based on extension
 * @param {string} filePath - Absolute path to the file
 * @param {string} extension - File extension (e.g., '.docx', '.pdf')
 * @returns {Promise<string>} - Extracted text content
 */
export async function convertToText(filePath, extension) {
  const ext = extension.toLowerCase();

  switch (ext) {
    case '.txt':
      return await convertTxtToText(filePath);
    case '.docx':
    case '.doc':
      return await convertDocxToText(filePath);
    case '.pdf':
      return await convertPdfToText(filePath);
    case '.xlsx':
    case '.xls':
      return await convertExcelToText(filePath);
    case '.csv':
      return await convertCsvToText(filePath);
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
}

// Functions already exported individually above
