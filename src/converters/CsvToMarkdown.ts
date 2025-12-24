/**
 * CSV to Markdown Converter (Electron/Node.js Version)
 *
 * File-path based wrapper around the shared CsvConverter.
 * Converts CSV files to Markdown tables.
 */

import fs from 'fs/promises';
import path from 'path';
import { CsvConverter as SharedCsvConverter } from '../../shared/dist/converters/index.js';
import type { ConverterInput, CsvConverterOptions } from '../../shared/dist/converters/index.js';
import { MarkdownConverter, MarkdownConverterOptions } from './MarkdownConverter.js';

// Re-export options type for backwards compatibility
export type { CsvConverterOptions };

/**
 * Electron-specific wrapper that accepts file paths
 * Extends MarkdownConverter for backwards compatibility with existing code
 */
export class CsvToMarkdown extends MarkdownConverter {
  private sharedConverter: SharedCsvConverter;

  constructor(options: MarkdownConverterOptions & CsvConverterOptions = {}) {
    super(options);
    this.sharedConverter = new SharedCsvConverter(options);
  }

  override async convert(filePath: string): Promise<string> {
    const filename = path.basename(filePath);

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
    return result.markdown;
  }
}

export default CsvToMarkdown;
