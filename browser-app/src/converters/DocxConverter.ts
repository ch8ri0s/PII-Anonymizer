/**
 * DOCX to Markdown Converter (Browser Version)
 *
 * Re-exports the shared DocxConverter with a File-based wrapper for browser use.
 */

import { DocxConverter as SharedDocxConverter } from '../../../shared/dist/converters/index.js';
import type { ConverterInput } from '../../../shared/dist/converters/index.js';

// Re-export the shared converter for direct use
export { SharedDocxConverter };

/**
 * Browser-specific wrapper that accepts File objects
 */
export class DocxConverter {
  static readonly SUPPORTED_TYPES = SharedDocxConverter.supportedTypes;
  static readonly SUPPORTED_EXTENSIONS = SharedDocxConverter.supportedExtensions;

  private sharedConverter: SharedDocxConverter;

  constructor() {
    this.sharedConverter = new SharedDocxConverter();
  }

  supports(file: File): boolean {
    const input: ConverterInput = {
      filename: file.name,
      data: new ArrayBuffer(0), // Not used for supports() check
      mimeType: file.type,
    };
    return this.sharedConverter.supports(input);
  }

  async convert(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();

    const input: ConverterInput = {
      filename: file.name,
      data: arrayBuffer,
      mimeType: file.type,
    };

    const result = await this.sharedConverter.convert(input);
    return result.markdown;
  }
}

export default DocxConverter;
