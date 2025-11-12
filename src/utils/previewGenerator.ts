/**
 * Preview Generator Utility
 *
 * Generates truncated content previews for files to display before processing.
 * Uses streaming approach to efficiently handle large files.
 *
 * Preview limits:
 * - First 20 lines OR 1000 characters (whichever comes first)
 * - Memory efficient (doesn't load entire file)
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import type { FilePreview, PreviewOptions } from '../types/filePreview.js';

// Import converter bridge module
import * as converterBridge from '../services/converterBridge.js';

/**
 * Default preview limits
 */
const DEFAULT_PREVIEW_OPTIONS: PreviewOptions = {
  lines: 20,
  chars: 1000,
};

/**
 * Generate content preview for a file
 *
 * @param filePath Absolute path to the file (must be pre-validated)
 * @param options Preview generation options
 * @returns FilePreview object
 * @throws Error if preview generation fails
 */
export async function getFilePreview(
  filePath: string,
  options: Partial<PreviewOptions> = {}
): Promise<FilePreview> {
  const { lines: maxLines, chars: maxChars } = {
    ...DEFAULT_PREVIEW_OPTIONS,
    ...options,
  };

  const extension = path.extname(filePath).toLowerCase();

  try {
    // Extract full text content first (using existing converters)
    const fullText = await extractTextForPreview(filePath, extension);

    // Generate truncated preview
    const preview = truncateContent(fullText, maxLines, maxChars);

    return {
      content: preview.content,
      isTruncated: preview.isTruncated,
      previewLineCount: preview.lineCount,
      previewCharCount: preview.charCount,
      formatType: 'text',
    };
  } catch (error: any) {
    return {
      content: '',
      isTruncated: false,
      previewLineCount: 0,
      previewCharCount: 0,
      formatType: 'error',
      error: error.message || 'Cannot generate preview',
    };
  }
}

/**
 * Extract text content for preview
 */
async function extractTextForPreview(
  filePath: string,
  extension: string
): Promise<string> {
  // For plain text files, use streaming for better performance
  if (extension === '.txt') {
    return await streamTextPreview(filePath);
  }

  // For other formats, use converter bridge
  return await converterBridge.convertToText(filePath, extension);
}

/**
 * Stream text file preview (efficient for large files)
 */
async function streamTextPreview(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    let totalChars = 0;
    const maxChars = 2000; // Read slightly more to ensure we have enough

    const stream = fs.createReadStream(filePath, {
      encoding: 'utf-8',
      highWaterMark: 1024, // 1KB chunks
    });

    stream.on('data', (chunk: string | Buffer) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
      chunks.push(text);
      totalChars += text.length;

      // Stop reading if we have enough
      if (totalChars >= maxChars) {
        stream.destroy();
      }
    });

    stream.on('end', () => {
      resolve(chunks.join(''));
    });

    stream.on('close', () => {
      resolve(chunks.join(''));
    });

    stream.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Truncate content to specified limits
 */
function truncateContent(
  text: string,
  maxLines: number,
  maxChars: number
): {
  content: string;
  isTruncated: boolean;
  lineCount: number;
  charCount: number;
} {
  // Handle empty content
  if (text.length === 0) {
    return {
      content: '(File is empty)',
      isTruncated: false,
      lineCount: 0,
      charCount: 0,
    };
  }

  // Split into lines
  const lines = text.split(/\r\n|\r|\n/);

  // Apply line limit
  let truncatedByLines = false;
  let selectedLines = lines;
  if (lines.length > maxLines) {
    selectedLines = lines.slice(0, maxLines);
    truncatedByLines = true;
  }

  // Rejoin and check character limit
  let content = selectedLines.join('\n');
  let truncatedByChars = false;

  if (content.length > maxChars) {
    content = content.substring(0, maxChars);
    truncatedByChars = true;
  }

  // Count actual lines in truncated content
  const actualLineCount = content.split(/\r\n|\r|\n/).length;

  // Determine if truncated
  const isTruncated =
    truncatedByLines || truncatedByChars || text.length > content.length;

  // Add truncation indicator if needed
  if (isTruncated) {
    content += '\n\n... (preview truncated)';
  }

  return {
    content,
    isTruncated,
    lineCount: actualLineCount,
    charCount: content.length,
  };
}

/**
 * Stream-based preview for very large files
 * Reads line by line until limits are reached
 */
export async function streamFilePreview(
  filePath: string,
  options: Partial<PreviewOptions> = {}
): Promise<FilePreview> {
  const { lines: maxLines, chars: maxChars } = {
    ...DEFAULT_PREVIEW_OPTIONS,
    ...options,
  };

  return new Promise((resolve) => {
    const lineArray: string[] = [];
    let totalChars = 0;
    let lineCount = 0;
    let stopped = false;

    const rl = readline.createInterface({
      input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
      crlfDelay: Infinity,
    });

    rl.on('line', (line: string) => {
      if (stopped) return;

      // Check if adding this line would exceed limits
      const newTotalChars = totalChars + line.length + 1; // +1 for newline

      if (lineCount >= maxLines || newTotalChars > maxChars) {
        stopped = true;
        rl.close();
        return;
      }

      lineArray.push(line);
      totalChars = newTotalChars;
      lineCount++;
    });

    rl.on('close', () => {
      const content = lineArray.join('\n');
      const isTruncated = stopped;

      resolve({
        content: isTruncated ? content + '\n\n... (preview truncated)' : content,
        isTruncated,
        previewLineCount: lineArray.length,
        previewCharCount: content.length,
        formatType: 'text',
      });
    });

    rl.on('error', (error) => {
      resolve({
        content: '',
        isTruncated: false,
        previewLineCount: 0,
        previewCharCount: 0,
        formatType: 'error',
        error: error.message,
      });
    });
  });
}
