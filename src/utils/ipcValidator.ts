/**
 * IPC Input Validation Utilities
 *
 * Provides centralized, type-safe validation for Electron IPC handlers
 * using Zod for schema validation.
 *
 * Security principles:
 * - All inputs from renderer must be validated before use
 * - Sender verification prevents unauthorized IPC calls
 * - Path validation prevents directory traversal attacks
 * - Size limits prevent OOM attacks
 *
 * Story 6.3: IPC Input Validation Layer
 */

import { z, ZodSchema, ZodError } from 'zod';
import { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import path from 'path';
import fs from 'fs';
import { createLogger } from './LoggerFactory.js';
import { SECURITY } from '../config/constants.js';

const log = createLogger('ipcValidator');

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Result of IPC validation
 */
export interface IpcValidationResult<T> {
  /** Whether validation passed */
  success: boolean;
  /** Validated and typed data (only if success=true) */
  data?: T;
  /** Error message (only if success=false) */
  error?: string;
  /** Detailed validation errors (for debugging) */
  details?: string[];
}

/**
 * Options for IPC validation
 */
export interface IpcValidationOptions {
  /** Skip sender verification (not recommended) */
  skipSenderVerification?: boolean;
  /** Custom error message prefix */
  errorPrefix?: string;
  /** Log validation failures (default: true) */
  logFailures?: boolean;
}

/**
 * Options for path validation within IPC context
 */
export interface IpcPathValidationOptions {
  /** Require path to exist */
  mustExist?: boolean;
  /** Allowed file extensions (with dots) */
  allowedExtensions?: string[];
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Allow directory paths */
  allowDirectory?: boolean;
  /** Block path traversal patterns */
  blockTraversal?: boolean;
}

/**
 * Configuration for size limits
 */
export interface SizeLimitsConfig {
  /** Maximum file size in bytes (default: 100MB) */
  maxFileSize: number;
  /** Maximum string length in payload (default: 1MB) */
  maxStringLength: number;
  /** Maximum array items (default: 10000) */
  maxArrayItems: number;
  /** Maximum object depth (default: 10) */
  maxObjectDepth: number;
}

// ============================================================================
// Default Configuration
// ============================================================================

/** Default size limits - Story 6.8: Use centralized SECURITY constants */
export const DEFAULT_SIZE_LIMITS: SizeLimitsConfig = {
  maxFileSize: SECURITY.MAX_FILE_SIZE_BYTES,
  maxStringLength: SECURITY.MAX_STRING_LENGTH,
  maxArrayItems: SECURITY.MAX_ARRAY_ITEMS,
  maxObjectDepth: SECURITY.MAX_OBJECT_DEPTH,
};

/** Supported file extensions for document processing */
export const SUPPORTED_DOCUMENT_EXTENSIONS = [
  '.txt',
  '.csv',
  '.docx',
  '.xlsx',
  '.xls',
  '.pdf',
];

/** Supported extensions for JSON files */
export const SUPPORTED_JSON_EXTENSIONS = ['.json'];

// ============================================================================
// Common Zod Schemas
// ============================================================================

/**
 * Schema for non-empty trimmed string
 */
export const nonEmptyString = z
  .string()
  .min(1, 'Cannot be empty')
  .transform((s) => s.trim())
  .refine((s) => s.length > 0, 'Cannot be empty after trimming');

/**
 * Schema for file path (basic string validation)
 */
// Story 6.8: Use centralized SECURITY.MAX_PATH_LENGTH
export const filePathSchema = z
  .string()
  .min(1, 'File path cannot be empty')
  .max(SECURITY.MAX_PATH_LENGTH, 'File path too long')
  .refine((p) => !p.includes('\0'), 'Path contains null byte');

/**
 * Schema for optional output directory
 */
export const optionalDirSchema = z
  .string()
  .max(SECURITY.MAX_PATH_LENGTH, 'Directory path too long')
  .optional()
  .nullable();

/**
 * Schema for process-file IPC input
 */
export const ProcessFileInputSchema = z.object({
  filePath: filePathSchema,
  outputDir: optionalDirSchema,
});

export type ProcessFileInput = z.infer<typeof ProcessFileInputSchema>;

/**
 * Schema for file:readJson IPC input
 */
export const ReadJsonInputSchema = z.object({
  filePath: filePathSchema,
});

export type ReadJsonInput = z.infer<typeof ReadJsonInputSchema>;

/**
 * Schema for open-folder IPC input
 */
export const OpenFolderInputSchema = z.object({
  folderPath: filePathSchema,
});

export type OpenFolderInput = z.infer<typeof OpenFolderInputSchema>;

/**
 * Schema for locale string (language code)
 */
export const localeSchema = z
  .string()
  .min(2, 'Locale must be at least 2 characters')
  .max(10, 'Locale too long')
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid locale format');

/**
 * Schema for boolean toggle
 */
export const booleanToggleSchema = z.boolean();

/**
 * Schema for file preview request
 */
export const FilePreviewRequestSchema = z.object({
  filePath: filePathSchema,
  lines: z.number().int().min(1).max(1000).optional(),
  chars: z.number().int().min(1).max(100000).optional(),
});

export type FilePreviewRequest = z.infer<typeof FilePreviewRequestSchema>;

/**
 * Schema for file metadata request
 */
export const FileMetadataRequestSchema = z.object({
  filePath: filePathSchema,
});

export type FileMetadataRequest = z.infer<typeof FileMetadataRequestSchema>;

/**
 * Schema for accuracy stats options
 */
export const AccuracyStatsOptionsSchema = z
  .object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    entityTypes: z.array(z.string()).max(50).optional(),
  })
  .optional();

export type AccuracyStatsOptions = z.infer<typeof AccuracyStatsOptionsSchema>;

// ============================================================================
// Sender Verification
// ============================================================================

// Reference to main window (set during app initialization)
let _mainWindow: BrowserWindow | null = null;

/**
 * Set the main window reference for sender verification
 */
export function setMainWindow(window: BrowserWindow | null): void {
  _mainWindow = window;
}

/**
 * Get the main window reference
 */
export function getMainWindow(): BrowserWindow | null {
  return _mainWindow;
}

/**
 * Verify IPC sender is from the main application window
 *
 * @param event - IPC event containing sender info
 * @returns true if sender is authorized, false otherwise
 */
export function verifySender(event: IpcMainInvokeEvent): boolean {
  if (!_mainWindow) {
    log.warn('Sender verification failed: main window not set');
    return false;
  }

  const senderWindow = BrowserWindow.fromWebContents(event.sender);

  if (!senderWindow) {
    log.warn('Sender verification failed: sender window not found', {
      senderId: event.sender.id,
    });
    return false;
  }

  if (senderWindow !== _mainWindow) {
    log.warn('Sender verification failed: sender is not main window', {
      senderId: event.sender.id,
      mainWindowId: _mainWindow.id,
    });
    return false;
  }

  return true;
}

// ============================================================================
// Path Validation
// ============================================================================

/**
 * Validate a file path for IPC operations
 *
 * @param filePath - Path to validate
 * @param options - Validation options
 * @returns Validation result with normalized path or error
 */
export function validatePath(
  filePath: string,
  options: IpcPathValidationOptions = {},
): IpcValidationResult<string> {
  const {
    mustExist = true,
    allowedExtensions,
    maxFileSize = DEFAULT_SIZE_LIMITS.maxFileSize,
    allowDirectory = false,
    blockTraversal = true,
  } = options;

  // Check for null bytes (injection attack)
  if (filePath.includes('\0')) {
    log.warn('Path validation failed: null byte detected');
    return { success: false, error: 'Invalid path: contains null byte' };
  }

  // Normalize path
  const normalizedPath = path.normalize(filePath);

  // Block path traversal if enabled
  if (blockTraversal && normalizedPath.includes('..')) {
    log.warn('Path traversal attempt blocked', {
      path: filePath.substring(0, 50),
    });
    return { success: false, error: 'Invalid path: traversal not allowed' };
  }

  // Ensure absolute path
  if (!path.isAbsolute(normalizedPath)) {
    return { success: false, error: 'Path must be absolute' };
  }

  // Check existence if required
  if (mustExist) {
    if (!fs.existsSync(normalizedPath)) {
      return { success: false, error: 'Path does not exist' };
    }

    // Check if it's a file or directory
    const stats = fs.statSync(normalizedPath);

    if (stats.isDirectory()) {
      if (!allowDirectory) {
        return { success: false, error: 'Path is a directory, expected file' };
      }
    } else if (stats.isFile()) {
      // Check file size
      if (stats.size > maxFileSize) {
        const maxMB = Math.round(maxFileSize / (1024 * 1024));
        return { success: false, error: `File too large (max ${maxMB}MB)` };
      }

      // Check extension if specified
      if (allowedExtensions && allowedExtensions.length > 0) {
        const ext = path.extname(normalizedPath).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
          return {
            success: false,
            error: `Unsupported file type: ${ext}. Allowed: ${allowedExtensions.join(', ')}`,
          };
        }
      }
    } else {
      return { success: false, error: 'Path is not a file or directory' };
    }
  }

  return { success: true, data: normalizedPath };
}

// ============================================================================
// Core Validation Functions
// ============================================================================

/**
 * Validate IPC input against a Zod schema
 *
 * @param data - Input data to validate
 * @param schema - Zod schema to validate against
 * @param options - Validation options
 * @returns Validation result with typed data or error
 */
export function validateInput<T>(
  data: unknown,
  schema: ZodSchema<T>,
  options: IpcValidationOptions = {},
): IpcValidationResult<T> {
  const { errorPrefix = 'Validation failed', logFailures = true } = options;

  try {
    const parsed = schema.parse(data);
    return { success: true, data: parsed };
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.errors.map(
        (e) => `${e.path.join('.')}: ${e.message}`,
      );
      const errorMessage = `${errorPrefix}: ${details[0]}`;

      if (logFailures) {
        log.warn('IPC validation failed', { details, data: summarizeData(data) });
      }

      return {
        success: false,
        error: errorMessage,
        details,
      };
    }

    if (logFailures) {
      log.error('Unexpected validation error', { error });
    }

    return { success: false, error: `${errorPrefix}: Unknown error` };
  }
}

/**
 * Validate IPC input with sender verification
 *
 * @param event - IPC event
 * @param data - Input data to validate
 * @param schema - Zod schema to validate against
 * @param options - Validation options
 * @returns Validation result with typed data or error
 */
export function validateIpcRequest<T>(
  event: IpcMainInvokeEvent,
  data: unknown,
  schema: ZodSchema<T>,
  options: IpcValidationOptions = {},
): IpcValidationResult<T> {
  const { skipSenderVerification = false } = options;

  // Step 1: Verify sender
  if (!skipSenderVerification && !verifySender(event)) {
    return { success: false, error: 'Unauthorized request' };
  }

  // Step 2: Validate input schema
  return validateInput(data, schema, options);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Summarize data for safe logging (redact sensitive info)
 */
function summarizeData(data: unknown): Record<string, unknown> {
  if (data === null || data === undefined) {
    return { type: 'null/undefined' };
  }

  if (typeof data !== 'object') {
    return { type: typeof data, preview: String(data).substring(0, 50) };
  }

  const obj = data as Record<string, unknown>;
  const summary: Record<string, unknown> = {};

  for (const key of Object.keys(obj).slice(0, 10)) {
    const value = obj[key];
    if (typeof value === 'string') {
      // Redact potential file paths
      if (value.includes('/') || value.includes('\\')) {
        summary[key] = '[PATH_REDACTED]';
      } else {
        summary[key] = value.substring(0, 30);
      }
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      summary[key] = value;
    } else {
      summary[key] = typeof value;
    }
  }

  return summary;
}

/**
 * Format Zod errors for user display
 */
export function formatValidationError(error: ZodError): string {
  const firstError = error.errors[0];
  if (!firstError) return 'Unknown validation error';

  const field = firstError.path.join('.');
  return field ? `${field}: ${firstError.message}` : firstError.message;
}

/**
 * Create a validation wrapper for IPC handlers
 *
 * @param schema - Zod schema for input validation
 * @param handler - Handler function to wrap
 * @param options - Validation options
 * @returns Wrapped handler with validation
 */
export function createValidatedHandler<TInput, TOutput>(
  schema: ZodSchema<TInput>,
  handler: (data: TInput, event: IpcMainInvokeEvent) => Promise<TOutput>,
  options: IpcValidationOptions = {},
): (event: IpcMainInvokeEvent, data: unknown) => Promise<TOutput | { success: false; error: string }> {
  return async (event: IpcMainInvokeEvent, data: unknown) => {
    const validation = validateIpcRequest(event, data, schema, options);

    if (!validation.success) {
      return { success: false, error: validation.error || 'Validation failed' };
    }

    return handler(validation.data!, event);
  };
}

// ============================================================================
// Pre-configured Validators for Common Operations
// ============================================================================

/**
 * Validate process-file input
 */
export function validateProcessFileInput(
  event: IpcMainInvokeEvent,
  data: unknown,
): IpcValidationResult<ProcessFileInput> {
  const result = validateIpcRequest(event, data, ProcessFileInputSchema);
  if (!result.success) return result;

  // Additional path validation for filePath
  const pathResult = validatePath(result.data!.filePath, {
    mustExist: true,
    allowedExtensions: SUPPORTED_DOCUMENT_EXTENSIONS,
    maxFileSize: DEFAULT_SIZE_LIMITS.maxFileSize,
  });

  if (!pathResult.success) {
    return { success: false, error: pathResult.error };
  }

  // Update with normalized path
  return {
    success: true,
    data: {
      ...result.data!,
      filePath: pathResult.data!,
    },
  };
}

/**
 * Validate file:readJson input
 */
export function validateReadJsonInput(
  event: IpcMainInvokeEvent,
  data: unknown,
): IpcValidationResult<string> {
  // Allow both object with filePath and direct string
  let filePath: string;

  if (typeof data === 'string') {
    filePath = data;
  } else if (data && typeof data === 'object' && 'filePath' in data) {
    filePath = (data as { filePath: unknown }).filePath as string;
  } else {
    return { success: false, error: 'Invalid input: expected string or object with filePath' };
  }

  // Sender verification
  if (!verifySender(event)) {
    return { success: false, error: 'Unauthorized request' };
  }

  // Path validation
  return validatePath(filePath, {
    mustExist: true,
    allowedExtensions: SUPPORTED_JSON_EXTENSIONS,
    maxFileSize: 50 * 1024 * 1024, // 50MB for JSON files
  });
}

/**
 * Validate open-folder input
 */
export function validateOpenFolderInput(
  event: IpcMainInvokeEvent,
  data: unknown,
): IpcValidationResult<string> {
  // Allow both object with folderPath and direct string
  let folderPath: string;

  if (typeof data === 'string') {
    folderPath = data;
  } else if (data && typeof data === 'object' && 'folderPath' in data) {
    folderPath = (data as { folderPath: unknown }).folderPath as string;
  } else {
    return { success: false, error: 'Invalid input: expected string or object with folderPath' };
  }

  // Sender verification
  if (!verifySender(event)) {
    return { success: false, error: 'Unauthorized request' };
  }

  // Path validation for directory
  return validatePath(folderPath, {
    mustExist: true,
    allowDirectory: true,
  });
}

// ============================================================================
// Exports
// ============================================================================

export {
  z,
  ZodSchema,
  ZodError,
};
