/**
 * Metadata Extractor Utility
 *
 * Extracts comprehensive metadata from files including:
 * - File system stats (size, last modified)
 * - Text content statistics (line count, word count, character count)
 *
 * Supports multiple file formats through converter integration.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { FileMetadata } from '../types/fileMetadata.js';
import { getErrorMessage } from '../types/errors.js';

// Import converter bridge module
import * as converterBridge from '../services/converterBridge.js';

/**
 * Extract file metadata
 *
 * @param filePath Absolute path to the file (must be pre-validated)
 * @returns FileMetadata object
 * @throws Error if extraction fails
 */
export async function getFileMetadata(filePath: string): Promise<FileMetadata> {
  // 1. Get file system stats
  const stats = fs.statSync(filePath);
  const filename = path.basename(filePath);
  const extension = path.extname(filePath).toLowerCase();

  // 2. Extract text content using appropriate converter
  let textContent: string;
  try {
    textContent = await extractTextContent(filePath, extension);
  } catch (error: unknown) {
    throw new Error(`Cannot extract text from file: ${getErrorMessage(error)}`);
  }

  // 3. Calculate text statistics
  const lineCount = countLines(textContent);
  const wordCount = countWords(textContent);
  const charCount = textContent.length;

  // 4. Format file size
  const fileSizeFormatted = formatFileSize(stats.size);

  // 5. Format dates
  const lastModified = stats.mtime.toISOString();
  const lastModifiedFormatted = formatDate(stats.mtime);

  // 6. Determine MIME type
  const mimeType = getMimeType(extension);

  return {
    filename,
    filePath,
    fileSize: stats.size,
    fileSizeFormatted,
    lastModified,
    lastModifiedFormatted,
    lineCount,
    wordCount,
    charCount,
    extension,
    mimeType,
  };
}

/**
 * Extract text content from file using appropriate converter
 */
async function extractTextContent(
  filePath: string,
  extension: string,
): Promise<string> {
  try {
    // Use converter bridge for all file types
    return await converterBridge.convertToText(filePath, extension);
  } catch (error: unknown) {
    // Check if file might be corrupted
    const errorMessage = getErrorMessage(error);
    if (
      errorMessage.includes('corrupt') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('password')
    ) {
      throw new Error('File may be corrupted or password-protected');
    }
    throw error;
  }
}

/**
 * Count lines in text
 */
function countLines(text: string): number {
  if (text.length === 0) return 0;

  // Split by newlines and count
  const lines = text.split(/\r\n|\r|\n/);

  // Filter out empty trailing line
  return lines.length > 0 && lines[lines.length - 1] === ''
    ? lines.length - 1
    : lines.length;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  if (text.trim().length === 0) return 0;

  // Split by whitespace and filter empty strings
  const words = text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  return words.length;
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  // Format with appropriate precision
  const formatted =
    unitIndex === 0 ? size.toFixed(0) : size.toFixed(size < 10 ? 2 : 1);

  return `${formatted} ${units[unitIndex]}`;
}

/**
 * Format date in human-readable format
 */
function formatDate(date: Date): string {
  // Format: "November 9, 2025"
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };

  return date.toLocaleDateString('en-US', options);
}

/**
 * Get MIME type from file extension
 */
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    '.txt': 'text/plain',
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.pdf': 'application/pdf',
    '.xlsx':
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
  };

  return mimeTypes[extension] || 'application/octet-stream';
}
