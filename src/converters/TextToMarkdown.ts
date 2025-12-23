/**
 * Text to Markdown Converter (Electron/Node.js Version)
 *
 * File-path based wrapper around the shared TextConverter.
 * Handles .txt and .md files with minimal transformation.
 */

import fs from 'fs/promises';
import path from 'path';
import { TextConverter as SharedTextConverter } from '../../shared/dist/converters/index.js';
import type { ConverterInput } from '../../shared/dist/converters/index.js';
import { MarkdownConverter } from './MarkdownConverter.js';

/**
 * Electron-specific wrapper that accepts file paths
 * Extends MarkdownConverter for backwards compatibility with existing code
 */
export class TextToMarkdown extends MarkdownConverter {
  private sharedConverter: SharedTextConverter;

  constructor(options = {}) {
    super(options);
    this.sharedConverter = new SharedTextConverter(options);
  }

  override async convert(filePath: string): Promise<string> {
    const filename = path.basename(filePath);

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
    return result.markdown;
  }
}

export default TextToMarkdown;
