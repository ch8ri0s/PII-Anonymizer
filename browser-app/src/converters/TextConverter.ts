/**
 * Text/Markdown Converter (Browser Version)
 *
 * Simple pass-through for plain text and markdown files.
 * 100% browser compatible - no external dependencies.
 */

export class TextConverter {
  static readonly SUPPORTED_TYPES = [
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'application/x-markdown',
  ];

  static readonly SUPPORTED_EXTENSIONS = ['.txt', '.md', '.markdown'];

  supports(file: File): boolean {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return (
      TextConverter.SUPPORTED_TYPES.includes(file.type) ||
      TextConverter.SUPPORTED_EXTENSIONS.includes(ext)
    );
  }

  async convert(file: File): Promise<string> {
    return await file.text();
  }
}

export default TextConverter;
