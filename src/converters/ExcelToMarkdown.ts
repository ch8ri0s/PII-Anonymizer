/**
 * Excel to Markdown Converter (Electron/Node.js Version)
 *
 * File-path based wrapper around the shared ExcelConverter.
 * Converts Excel files to Markdown tables with multi-sheet support.
 */

import fs from 'fs/promises';
import path from 'path';
import { ExcelConverter as SharedExcelConverter } from '../../shared/dist/converters/index.js';
import type { ConverterInput, ExcelConverterOptions } from '../../shared/dist/converters/index.js';
import { MarkdownConverter, MarkdownConverterOptions } from './MarkdownConverter.js';
import { createLogger } from '../utils/LoggerFactory.js';

const log = createLogger('converter:excel');

// Re-export options type for backwards compatibility
export type { ExcelConverterOptions };

/**
 * Electron-specific wrapper that accepts file paths
 * Extends MarkdownConverter for backwards compatibility with existing code
 */
export class ExcelToMarkdown extends MarkdownConverter {
  private sharedConverter: SharedExcelConverter;

  constructor(options: MarkdownConverterOptions & ExcelConverterOptions = {}) {
    super(options);
    this.sharedConverter = new SharedExcelConverter(options);
  }

  override async convert(filePath: string): Promise<string> {
    const filename = path.basename(filePath);

    try {
      // Read file as ArrayBuffer
      const buffer = await fs.readFile(filePath);
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      );

      const input: ConverterInput = {
        filename,
        data: arrayBuffer,
      };

      const result = await this.sharedConverter.convert(input, this.options);

      // Log any conversion warnings
      if (result.warnings && result.warnings.length > 0) {
        log.warn('Excel conversion warnings', {
          filename,
          warningCount: result.warnings.length,
          warnings: result.warnings,
        });
      }

      return result.markdown;

    } catch (error) {
      log.error('Error converting Excel', { filename, error: (error as Error).message });
      throw new Error(`Failed to convert Excel: ${(error as Error).message}`);
    }
  }
}

export default ExcelToMarkdown;
