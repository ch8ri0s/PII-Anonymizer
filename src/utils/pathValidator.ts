/**
 * Path Validation Utility
 *
 * Provides secure path validation for file operations to prevent
 * directory traversal attacks and ensure files are within allowed directories.
 *
 * Security principles:
 * - All paths must be absolute
 * - Reject paths with null bytes
 * - Normalize paths to resolve . and ..
 * - Verify file exists and is readable
 * - Check file extension against whitelist
 */

import * as path from 'path';
import * as fs from 'fs';
import type { FileErrorCode } from '../types/fileMetadata.js';

/**
 * Validation options
 */
export interface PathValidationOptions {
  /** Require file to exist */
  mustExist?: boolean;

  /** Require file to be readable */
  mustBeReadable?: boolean;

  /** Allowed file extensions (with dots, e.g., ['.txt', '.pdf']) */
  allowedExtensions?: string[];

  /** Maximum file size in bytes (default: 1GB) */
  maxFileSize?: number;
}

/**
 * Path validation error
 */
export class PathValidationError extends Error {
  constructor(
    message: string,
    public readonly code: FileErrorCode,
  ) {
    super(message);
    this.name = 'PathValidationError';
  }
}

/**
 * Default allowed file extensions
 */
const DEFAULT_ALLOWED_EXTENSIONS = [
  '.txt',
  '.docx',
  '.doc',
  '.pdf',
  '.xlsx',
  '.xls',
  '.csv',
];

/**
 * Default maximum file size (1GB)
 */
const DEFAULT_MAX_FILE_SIZE = 1024 * 1024 * 1024;

/**
 * Validate and normalize a file path
 *
 * @param filePath Path to validate
 * @param options Validation options
 * @returns Normalized absolute path
 * @throws PathValidationError if validation fails
 */
export function validateFilePath(
  filePath: string,
  options: PathValidationOptions = {},
): string {
  const {
    mustExist = true,
    mustBeReadable = true,
    allowedExtensions = DEFAULT_ALLOWED_EXTENSIONS,
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
  } = options;

  // 1. Check for null bytes (path injection attempt)
  if (filePath.includes('\0')) {
    throw new PathValidationError(
      'Invalid path: contains null byte',
      'INVALID_PATH',
    );
  }

  // 2. Normalize and resolve to absolute path
  const absolutePath = path.resolve(filePath);

  // 3. Check if path is actually absolute (security check)
  if (!path.isAbsolute(absolutePath)) {
    throw new PathValidationError(
      'Path must be absolute',
      'INVALID_PATH',
    );
  }

  // 4. Check file extension
  const extension = path.extname(absolutePath).toLowerCase();
  if (allowedExtensions.length > 0 && !allowedExtensions.includes(extension)) {
    throw new PathValidationError(
      `File type not supported. Accepted formats: ${allowedExtensions.join(', ')}`,
      'UNSUPPORTED_TYPE',
    );
  }

  // 5. Check if file exists (if required)
  if (mustExist && !fs.existsSync(absolutePath)) {
    throw new PathValidationError(
      'File not found',
      'FILE_NOT_FOUND',
    );
  }

  // 6. Check if file is readable (if required)
  if (mustBeReadable) {
    try {
      fs.accessSync(absolutePath, fs.constants.R_OK);
    } catch {
      throw new PathValidationError(
        'Permission denied',
        'PERMISSION_DENIED',
      );
    }
  }

  // 7. Check file size
  if (mustExist) {
    try {
      const stats = fs.statSync(absolutePath);

      // Verify it's a file (not directory)
      if (!stats.isFile()) {
        throw new PathValidationError(
          'Path is not a file',
          'INVALID_PATH',
        );
      }

      // Check size limit
      if (stats.size > maxFileSize) {
        throw new PathValidationError(
          `File too large (max ${formatFileSize(maxFileSize)})`,
          'FILE_TOO_LARGE',
        );
      }
    } catch (error) {
      if (error instanceof PathValidationError) {
        throw error;
      }
      throw new PathValidationError(
        'Cannot access file',
        'READ_ERROR',
      );
    }
  }

  return absolutePath;
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Batch validate multiple file paths
 *
 * @param filePaths Array of paths to validate
 * @param options Validation options
 * @returns Array of validation results
 */
export function validateFilePaths(
  filePaths: string[],
  options: PathValidationOptions = {},
): Array<{ path: string; valid: boolean; error?: string; code?: FileErrorCode }> {
  return filePaths.map((filePath) => {
    try {
      const validPath = validateFilePath(filePath, options);
      return { path: validPath, valid: true };
    } catch (error) {
      if (error instanceof PathValidationError) {
        return {
          path: filePath,
          valid: false,
          error: error.message,
          code: error.code,
        };
      }
      return {
        path: filePath,
        valid: false,
        error: 'Unknown validation error',
        code: 'UNKNOWN_ERROR' as FileErrorCode,
      };
    }
  });
}
