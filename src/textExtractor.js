/**
 * Enhanced Text Extractor for PII Anonymization
 * Preserves formatting, spacing, and document structure for accurate PII detection
 *
 * Design Goals:
 * - 99%+ extraction accuracy
 * - Preserve line breaks, paragraphs, and spacing
 * - Maintain word boundaries and context
 * - Handle tables, lists, and complex layouts
 * - Comprehensive error handling
 */

import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

export class TextExtractor {
  constructor(options = {}) {
    this.options = {
      preserveWhitespace: true,
      preserveParagraphs: true,
      preserveTables: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB default
      ...options
    };

    this.supportedFormats = ['.txt', '.csv', '.xlsx', '.xls', '.docx', '.doc', '.pdf'];
  }

  /**
   * Main extraction method - routes to appropriate handler based on file type
   * @param {string} filePath - Path to file
   * @returns {Promise<ExtractionResult>}
   */
  async extractText(filePath) {
    // Validate file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Check file size
    const stats = fs.statSync(filePath);
    if (stats.size > this.options.maxFileSize) {
      throw new Error(`File too large: ${stats.size} bytes (max: ${this.options.maxFileSize})`);
    }

    const format = this.detectFormat(filePath);
    const startTime = Date.now();

    let result;
    try {
      switch (format) {
        case 'txt':
          result = await this.extractFromTxt(filePath);
          break;
        case 'csv':
          result = await this.extractFromCsv(filePath);
          break;
        case 'xlsx':
        case 'xls':
          result = await this.extractFromExcel(filePath);
          break;
        case 'docx':
        case 'doc':
          result = await this.extractFromDocx(filePath);
          break;
        case 'pdf':
          result = await this.extractFromPdf(filePath);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      result.format = format;
      result.filePath = filePath;
      result.extractionTime = Date.now() - startTime;
      result.preservesWhitespace = this.options.preserveWhitespace;

      return result;
    } catch (error) {
      return {
        format,
        filePath,
        text: '',
        error: error.message,
        extractionTime: Date.now() - startTime,
        success: false
      };
    }
  }

  /**
   * Detect file format from extension
   * @param {string} filePath
   * @returns {string} format
   */
  detectFormat(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (!this.supportedFormats.includes(ext)) {
      throw new Error(`Unsupported file format: ${ext}`);
    }
    return ext.substring(1); // Remove leading dot
  }

  /**
   * Extract text from plain text files
   * Preserves exact formatting including all whitespace
   */
  async extractFromTxt(filePath) {
    const text = fs.readFileSync(filePath, 'utf8');

    return {
      text,
      metadata: {
        encoding: 'utf8',
        lines: text.split('\n').length,
        characters: text.length,
        paragraphs: text.split(/\n\s*\n/).length
      },
      success: true
    };
  }

  /**
   * Extract text from CSV files
   * Preserves tabular structure for better context
   */
  async extractFromCsv(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    // Parse CSV manually to preserve structure
    const rows = lines.map(line => {
      // Simple CSV parsing (handles basic cases)
      return line.split(',').map(cell => cell.trim());
    });

    // Format as aligned table for better PII context
    const formattedLines = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (i === 0) {
        // Header row
        formattedLines.push(row.join(' | '));
        formattedLines.push('-'.repeat(row.join(' | ').length));
      } else {
        // Data rows
        formattedLines.push(row.join(' | '));
      }
    }

    const text = formattedLines.join('\n');

    return {
      text,
      metadata: {
        rows: rows.length - 1, // Excluding header
        columns: rows[0]?.length || 0,
        headers: rows[0] || []
      },
      success: true
    };
  }

  /**
   * Extract text from Excel files
   * Preserves sheet structure, cell relationships, and formulas as values
   */
  async extractFromExcel(filePath) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sections = [];
    let totalCells = 0;

    for (const worksheet of workbook.worksheets) {
      const sheetLines = [];
      sheetLines.push(`\n=== Sheet: ${worksheet.name} ===\n`);

      // Get actual dimensions
      const actualRows = [];
      worksheet.eachRow((row, rowNumber) => {
        const cells = [];
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          // Get cell value (formula results, not formulas)
          let cellValue = cell.value;

          // Handle different cell value types
          if (cellValue && typeof cellValue === 'object') {
            if (cellValue.formula) {
              cellValue = cellValue.result || cellValue.formula;
            } else if (cellValue.richText) {
              cellValue = cellValue.richText.map(rt => rt.text).join('');
            } else if (cellValue.text) {
              cellValue = cellValue.text;
            }
          }

          if (cellValue !== null && cellValue !== undefined) {
            const cellStr = String(cellValue).trim();
            if (cellStr) {
              cells.push({
                col: colNumber,
                value: cellStr
              });
              totalCells++;
            }
          }
        });

        if (cells.length > 0) {
          actualRows.push({ row: rowNumber, cells });
        }
      });

      // Format rows with alignment
      for (const rowData of actualRows) {
        const cellValues = rowData.cells.map(c => c.value).join(' | ');
        sheetLines.push(cellValues);
      }

      sections.push(sheetLines.join('\n'));
    }

    const text = sections.join('\n\n');

    return {
      text,
      metadata: {
        sheets: workbook.worksheets.length,
        totalCells,
        sheetNames: workbook.worksheets.map(ws => ws.name)
      },
      success: true
    };
  }

  /**
   * Extract text from Word documents
   * Uses mammoth with enhanced options to preserve structure
   */
  async extractFromDocx(filePath) {
    // Try both raw and formatted extraction
    const rawResult = await mammoth.extractRawText({ path: filePath });

    // Also get HTML to understand structure better
    const htmlResult = await mammoth.convertToHtml(
      { path: filePath },
      {
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh"
        ]
      }
    );

    // Convert HTML to structured text while preserving paragraphs
    let text = rawResult.value;

    // Mammoth sometimes loses double line breaks, try to restore them
    // by analyzing HTML structure
    if (htmlResult.value) {
      // Count paragraphs in HTML
      const htmlParagraphs = (htmlResult.value.match(/<\/p>/g) || []).length;
      const textParagraphs = (text.match(/\n\n/g) || []).length;

      // If HTML has more paragraphs, it means we lost some breaks
      if (htmlParagraphs > textParagraphs + 1) {
        // Attempt to restore paragraph structure
        // This is a heuristic: add double breaks after sentences followed by capital letters
        text = text.replace(/\.\s+([A-Z])/g, '.\n\n$1');
      }
    }

    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    const words = text.split(/\s+/).filter(w => w.trim());

    return {
      text,
      metadata: {
        paragraphs: paragraphs.length,
        words: words.length,
        characters: text.length,
        warnings: rawResult.messages || []
      },
      success: true
    };
  }

  /**
   * Extract text from PDF files
   * Preserves layout and paragraph structure
   */
  async extractFromPdf(filePath) {
    const dataBuffer = fs.readFileSync(filePath);

    // Enhanced PDF parsing options (v2 API)
    const pdfParser = new PDFParse({
      data: dataBuffer,
      verbosity: 0 // Suppress console logs
    });

    const result = await pdfParser.getText();
    let text = result.text;

    // Post-process PDF text to improve quality
    // PDFs often have issues with line breaks and spacing

    // 1. Fix common PDF extraction issues
    // Remove hyphenation at line breaks
    text = text.replace(/(\w)-\n(\w)/g, '$1$2');

    // 2. Normalize line breaks
    // Convert multiple spaces to single space (except at line start)
    text = text.replace(/([^\n])  +/g, '$1 ');

    // 3. Preserve paragraph breaks
    // PDF often has single \n where double \n\n should be
    // Heuristic: if line doesn't end with punctuation and next starts with capital, it's continuation
    // Otherwise, it's a new paragraph
    const lines = text.split('\n');
    const processedLines = [];
    let currentParagraph = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        // Empty line - paragraph break
        if (currentParagraph.length > 0) {
          processedLines.push(currentParagraph.join(' '));
          currentParagraph = [];
          processedLines.push(''); // Empty line
        }
        continue;
      }

      currentParagraph.push(line);

      // Check if this line ends a paragraph
      const endsWithTerminator = /[.!?:]\s*$/.test(line);
      const nextLine = lines[i + 1]?.trim();
      const nextStartsWithCapital = nextLine && /^[A-Z]/.test(nextLine);

      if (endsWithTerminator && nextStartsWithCapital) {
        // Likely paragraph end
        processedLines.push(currentParagraph.join(' '));
        currentParagraph = [];
        processedLines.push(''); // Paragraph break
      } else if (i === lines.length - 1) {
        // Last line
        processedLines.push(currentParagraph.join(' '));
      }
    }

    text = processedLines.join('\n');

    return {
      text,
      metadata: {
        pages: result.total || result.pages?.length || 1,
        info: result.info || {},
        characters: text.length,
        lines: text.split('\n').length
      },
      success: true
    };
  }

  /**
   * Batch extract from multiple files
   * @param {string[]} filePaths
   * @returns {Promise<ExtractionResult[]>}
   */
  async extractBatch(filePaths) {
    const results = [];
    for (const filePath of filePaths) {
      try {
        const result = await this.extractText(filePath);
        results.push(result);
      } catch (error) {
        results.push({
          filePath,
          text: '',
          error: error.message,
          success: false
        });
      }
    }
    return results;
  }

  /**
   * Get extraction statistics
   * @param {ExtractionResult} result
   * @returns {Object} statistics
   */
  getStatistics(result) {
    return {
      format: result.format,
      success: result.success,
      textLength: result.text.length,
      lineCount: result.text.split('\n').length,
      wordCount: result.text.split(/\s+/).filter(w => w.trim()).length,
      paragraphCount: result.text.split(/\n\s*\n/).filter(p => p.trim()).length,
      extractionTime: result.extractionTime,
      hasError: !!result.error
    };
  }
}

/**
 * @typedef {Object} ExtractionResult
 * @property {string} text - Extracted text with preserved formatting
 * @property {string} format - File format (txt, pdf, docx, etc.)
 * @property {string} filePath - Original file path
 * @property {Object} metadata - Format-specific metadata
 * @property {number} extractionTime - Time taken in milliseconds
 * @property {boolean} success - Whether extraction was successful
 * @property {string} [error] - Error message if extraction failed
 * @property {boolean} preservesWhitespace - Whether whitespace was preserved
 */

export default TextExtractor;
