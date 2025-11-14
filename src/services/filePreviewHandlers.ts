/**
 * File Preview IPC Handlers
 *
 * Implements IPC handlers for file preview and metadata functionality.
 * These handlers are registered in the main Electron process.
 */

import { ipcMain, dialog, BrowserWindow } from 'electron';
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

/**
 * Register all file preview IPC handlers
 *
 * Call this function during Electron app initialization
 */
export function registerFilePreviewHandlers(): void {
  // Handler: file:getMetadata
  ipcMain.handle(
    'file:getMetadata',
    async (event, filePath: string): Promise<FileMetadata | FileMetadataError> => {
      try {
        // 1. Validate path
        const safePath = validateFilePath(filePath, {
          mustExist: true,
          mustBeReadable: true,
          allowedExtensions: ['.txt', '.docx', '.doc', '.pdf', '.xlsx', '.xls', '.csv'],
        });

        // 2. Extract metadata
        const metadata = await getFileMetadata(safePath);

        return metadata;
      } catch (error: any) {
        // 3. Return error (redact full path)
        const filename = path.basename(filePath);

        if (error instanceof PathValidationError) {
          return {
            error: `Cannot read file ${filename}: ${error.message}`,
            code: error.code,
            filename,
          };
        }

        return {
          error: `Cannot read file ${filename}: ${error.message || 'Unknown error'}`,
          code: 'UNKNOWN_ERROR' as FileErrorCode,
          filename,
        };
      }
    }
  );

  // Handler: file:getPreview
  ipcMain.handle(
    'file:getPreview',
    async (
      event,
      filePath: string,
      limit: { lines: number; chars: number }
    ): Promise<FilePreview | FilePreviewError> => {
      try {
        // 1. Validate path
        const safePath = validateFilePath(filePath, {
          mustExist: true,
          mustBeReadable: true,
          allowedExtensions: ['.txt', '.docx', '.doc', '.pdf', '.xlsx', '.xls', '.csv'],
        });

        // 2. Generate preview
        const preview = await getFilePreview(safePath, limit);

        return preview;
      } catch (error: any) {
        // 3. Return error (redact full path)
        const filename = path.basename(filePath);

        if (error instanceof PathValidationError) {
          return {
            error: `Cannot generate preview for ${filename}: ${error.message}`,
            code: error.code,
            filename,
          };
        }

        return {
          error: `Cannot generate preview for ${filename}: ${error.message || 'Unknown error'}`,
          code: 'UNKNOWN_ERROR',
          filename,
        };
      }
    }
  );

  // Handler: dialog:selectFiles
  ipcMain.handle(
    'dialog:selectFiles',
    async (
      event,
      options: {
        allowMultiple: boolean;
        filters: Array<{ name: string; extensions: string[] }>;
      }
    ): Promise<string[] | null> => {
      const win = BrowserWindow.fromWebContents(event.sender);

      if (!win) {
        return null;
      }

      const result = await dialog.showOpenDialog(win, {
        properties: options.allowMultiple
          ? ['openFile', 'multiSelections']
          : ['openFile'],
        filters: options.filters,
      });

      if (result.canceled) {
        return null;
      }

      return result.filePaths;
    }
  );

  console.log('[FilePreview] IPC handlers registered successfully');
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

  console.log('[FilePreview] IPC handlers unregistered');
}
