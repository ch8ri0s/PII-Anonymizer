/**
 * CSV to Markdown Converter (Browser Version)
 *
 * Re-exports the shared CsvConverter with a File-based wrapper for browser use.
 */

import { CsvConverter as SharedCsvConverter } from '../../../shared/dist/converters/index.js';
import type { ConverterInput } from '../../../shared/dist/converters/index.js';

// Re-export the shared converter for direct use
export { SharedCsvConverter };

/**
 * Browser-specific wrapper that accepts File objects
 */
export class CsvConverter {
  static readonly SUPPORTED_TYPES = SharedCsvConverter.supportedTypes;
  static readonly SUPPORTED_EXTENSIONS = SharedCsvConverter.supportedExtensions;

  private sharedConverter: SharedCsvConverter;

  constructor() {
    this.sharedConverter = new SharedCsvConverter();
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

export default CsvConverter;
