/**
 * DOCX to Markdown Converter (Electron/Node.js Version)
 *
 * File-path based wrapper around the shared DocxConverter.
 * Converts Word documents to Markdown using mammoth + turndown.
 */

import fs from 'fs/promises';
import path from 'path';
import { DocxConverter as SharedDocxConverter } from '../../shared/dist/converters/index.js';
import type { ConverterInput } from '../../shared/dist/converters/index.js';
import { MarkdownConverter } from './MarkdownConverter.js';
import { createLogger } from '../utils/LoggerFactory.js';

const log = createLogger('converter:docx');

/**
 * Electron-specific wrapper that accepts file paths
 * Extends MarkdownConverter for backwards compatibility with existing code
 */
export class DocxToMarkdown extends MarkdownConverter {
  private sharedConverter: SharedDocxConverter;

  constructor(options = {}) {
    super(options);
    this.sharedConverter = new SharedDocxConverter(options);
  }

  override async convert(filePath: string): Promise<string> {
    const filename = path.basename(filePath);

    try {
      // Read file as ArrayBuffer
      const buffer = await fs.readFile(filePath);
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );

      const input: ConverterInput = {
        filename,
        data: arrayBuffer,
      };

      const result = await this.sharedConverter.convert(input, this.options);

      // Log any conversion warnings
      if (result.warnings && result.warnings.length > 0) {
        log.warn('DOCX conversion warnings', {
          filename,
          warningCount: result.warnings.length,
          warnings: result.warnings,
        });
      }

      return result.markdown;

    } catch (error) {
      log.error('Error converting DOCX', { filename, error: (error as Error).message });
      throw new Error(`Failed to convert DOCX: ${(error as Error).message}`);
    }
  }
}

export default DocxToMarkdown;
