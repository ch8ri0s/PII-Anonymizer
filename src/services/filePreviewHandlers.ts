/**
 * File Preview IPC Handlers
 *
 * Implements IPC handlers for file preview and metadata functionality.
 * These handlers are registered in the main Electron process.
 *
 * Story 6.3: Added sender verification and Zod schema validation
 */

import { ipcMain, dialog, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import {
  validateFilePath,
  PathValidationError,
} from '../utils/pathValidator.js';
import { getFileMetadata } from '../utils/metadataExtractor.js';
import { getFilePreview } from '../utils/previewGenerator.js';
import type {
  FileMetadata,
  FileMetadataError,
  FileErrorCode,
} from '../types/fileMetadata.js';
import type { FilePreview, FilePreviewError } from '../types/filePreview.js';
import { createLogger } from '../utils/LoggerFactory.js';
import {
  verifySender,
  validateInput,
  z,
} from '../utils/ipcValidator.js';
import { sanitizeErrorMessage, logError } from '../utils/errorHandler.js';
import { PREVIEW } from '../config/constants.js';

const log = createLogger('filePreview');

// Zod schema for dialog options
const DialogOptionsSchema = z.object({
  allowMultiple: z.boolean(),
  filters: z.array(z.object({
    name: z.string(),
    extensions: z.array(z.string()),
  })),
});

/**
 * Register all file preview IPC handlers
 *
 * Call this function during Electron app initialization
 */
export function registerFilePreviewHandlers(): void {
  // Handler: file:getMetadata
  ipcMain.handle(
    'file:getMetadata',
    async (event: IpcMainInvokeEvent, filePath: unknown): Promise<FileMetadata | FileMetadataError> => {
      // ✅ SECURITY: Verify sender (Story 6.3)
      if (!verifySender(event)) {
        log.warn('file:getMetadata: Unauthorized sender rejected');
        return {
          error: 'Unauthorized request',
          code: 'PERMISSION_DENIED' as FileErrorCode,
          filename: 'unknown',
        };
      }

      // ✅ SECURITY: Validate input with Zod schema
      const validation = validateInput(filePath, z.string().min(1));
      if (!validation.success) {
        return {
          error: validation.error || 'Invalid file path',
          code: 'INVALID_PATH' as FileErrorCode,
          filename: 'unknown',
        };
      }

      const validFilePath = validation.data!;

      try {
        // 1. Validate path
        const safePath = validateFilePath(validFilePath, {
          mustExist: true,
          mustBeReadable: true,
          allowedExtensions: ['.txt', '.docx', '.doc', '.pdf', '.xlsx', '.xls', '.csv'],
        });

        // 2. Extract metadata
        const metadata = await getFileMetadata(safePath);

        return metadata;
      } catch (error: unknown) {
        // 3. Log and return error (redact full path) - Story 6.7
        const filename = path.basename(validFilePath);
        logError(error, { operation: 'file:getMetadata', fileType: path.extname(validFilePath) });

        if (error instanceof PathValidationError) {
          return {
            error: `Cannot read file ${filename}: ${sanitizeErrorMessage(error.message)}`,
            code: error.code,
            filename,
          };
        }

        const errMessage = error instanceof Error ? sanitizeErrorMessage(error.message) : 'Unknown error';
        return {
          error: `Cannot read file ${filename}: ${errMessage}`,
          code: 'UNKNOWN_ERROR' as FileErrorCode,
          filename,
        };
      }
    },
  );

  // Handler: file:getPreview
  ipcMain.handle(
    'file:getPreview',
    async (
      event: IpcMainInvokeEvent,
      filePath: unknown,
      limit: unknown,
    ): Promise<FilePreview | FilePreviewError> => {
      // ✅ SECURITY: Verify sender (Story 6.3)
      if (!verifySender(event)) {
        log.warn('file:getPreview: Unauthorized sender rejected');
        return {
          error: 'Unauthorized request',
          code: 'PERMISSION_DENIED',
          filename: 'unknown',
        };
      }

      // ✅ SECURITY: Validate inputs
      const pathValidation = validateInput(filePath, z.string().min(1));
      if (!pathValidation.success) {
        return {
          error: pathValidation.error || 'Invalid file path',
          code: 'INVALID_PATH',
          filename: 'unknown',
        };
      }

      // Story 6.8: Use centralized PREVIEW constants for defaults
      const limitSchema = z.object({
        lines: z.number().int().min(1).max(1000).optional().default(PREVIEW.DEFAULT_LINES),
        chars: z.number().int().min(1).max(100000).optional().default(PREVIEW.DEFAULT_CHARS),
      });
      const limitValidation = validateInput(limit, limitSchema);
      const validLimit = limitValidation.success
        ? limitValidation.data!
        : { lines: PREVIEW.DEFAULT_LINES, chars: PREVIEW.DEFAULT_CHARS };

      const validFilePath = pathValidation.data!;

      try {
        // 1. Validate path
        const safePath = validateFilePath(validFilePath, {
          mustExist: true,
          mustBeReadable: true,
          allowedExtensions: ['.txt', '.docx', '.doc', '.pdf', '.xlsx', '.xls', '.csv'],
        });

        // 2. Generate preview
        const preview = await getFilePreview(safePath, validLimit);

        return preview;
      } catch (error: unknown) {
        // 3. Log and return error (redact full path) - Story 6.7
        const filename = path.basename(validFilePath);
        logError(error, { operation: 'file:getPreview', fileType: path.extname(validFilePath) });

        if (error instanceof PathValidationError) {
          return {
            error: `Cannot generate preview for ${filename}: ${sanitizeErrorMessage(error.message)}`,
            code: error.code,
            filename,
          };
        }

        const errMessage = error instanceof Error ? sanitizeErrorMessage(error.message) : 'Unknown error';
        return {
          error: `Cannot generate preview for ${filename}: ${errMessage}`,
          code: 'UNKNOWN_ERROR',
          filename,
        };
      }
    },
  );

  // Handler: dialog:selectFiles
  ipcMain.handle(
    'dialog:selectFiles',
    async (
      event: IpcMainInvokeEvent,
      options: unknown,
    ): Promise<string[] | null> => {
      // ✅ SECURITY: Verify sender (Story 6.3)
      if (!verifySender(event)) {
        log.warn('dialog:selectFiles: Unauthorized sender rejected');
        return null;
      }

      // ✅ SECURITY: Validate options with Zod schema
      const validation = validateInput(options, DialogOptionsSchema);
      if (!validation.success) {
        log.warn('dialog:selectFiles: Invalid options', { error: validation.error });
        return null;
      }

      const validOptions = validation.data!;
      const win = BrowserWindow.fromWebContents(event.sender);

      if (!win) {
        return null;
      }

      const result = await dialog.showOpenDialog(win, {
        properties: validOptions.allowMultiple
          ? ['openFile', 'multiSelections']
          : ['openFile'],
        filters: validOptions.filters,
      });

      if (result.canceled) {
        return null;
      }

      return result.filePaths;
    },
  );

  log.info('File preview IPC handlers registered');
}

/**
 * Unregister all file preview IPC handlers
 *
 * Call this function during cleanup if needed
 */
export function unregisterFilePreviewHandlers(): void {
  ipcMain.removeHandler('file:getMetadata');
  ipcMain.removeHandler('file:getPreview');
  ipcMain.removeHandler('dialog:selectFiles');

  log.info('File preview IPC handlers unregistered');
}
