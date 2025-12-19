/**
 * Model Download IPC Handlers
 *
 * Provides secure IPC handlers for model status checking and downloading.
 *
 * Security: Downloads only from HuggingFace, stores in userData directory.
 */

import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { createLogger } from '../utils/LoggerFactory.js';
import {
  checkModelExists,
  downloadModel,
  cleanupModelFiles,
  getModelPath,
  getModelBasePath,
} from './modelManager.js';
import { verifySender } from '../utils/ipcValidator.js';
import type { ModelStatus, DownloadResult } from '../types/modelDownload.js';

const log = createLogger('model-handlers');

// Store reference to main window for sending progress events
let mainWindowRef: BrowserWindow | null = null;

/**
 * Register all model-related IPC handlers
 * Call this from main.ts during app initialization
 */
export function registerModelHandlers(mainWindow: BrowserWindow | null): void {
  mainWindowRef = mainWindow;

  // Handler: Check if model exists and is valid
  ipcMain.handle('model:check', async (event: IpcMainInvokeEvent): Promise<ModelStatus> => {
    // ✅ SECURITY: Verify sender (Story 6.3)
    if (!verifySender(event)) {
      log.warn('model:check: Unauthorized sender rejected');
      return {
        exists: false,
        valid: false,
        path: getModelPath(),
        missingFiles: ['unauthorized'],
      };
    }

    log.info('Checking model status');
    try {
      const status = await checkModelExists();
      log.info('Model status check complete', {
        exists: status.exists,
        valid: status.valid,
        missingFiles: status.missingFiles.length,
      });
      return status;
    } catch (error) {
      log.error('Error checking model status', { error: (error as Error).message });
      return {
        exists: false,
        valid: false,
        path: getModelPath(),
        missingFiles: ['unknown'],
      };
    }
  });

  // Handler: Download the model from HuggingFace
  ipcMain.handle('model:download', async (event: IpcMainInvokeEvent): Promise<DownloadResult> => {
    // ✅ SECURITY: Verify sender (Story 6.3)
    if (!verifySender(event)) {
      log.warn('model:download: Unauthorized sender rejected');
      return { success: false, error: 'Unauthorized request' };
    }

    log.info('Starting model download via IPC');
    try {
      const result = await downloadModel(undefined, mainWindowRef);
      log.info('Model download IPC complete', { success: result.success });
      return result;
    } catch (error) {
      const errorMessage = (error as Error).message;
      log.error('Error in model download IPC', { error: errorMessage });
      return {
        success: false,
        error: errorMessage,
      };
    }
  });

  // Handler: Clean up model files (for retry after corruption)
  ipcMain.handle('model:cleanup', async (event: IpcMainInvokeEvent): Promise<{ success: boolean; error?: string }> => {
    // ✅ SECURITY: Verify sender (Story 6.3)
    if (!verifySender(event)) {
      log.warn('model:cleanup: Unauthorized sender rejected');
      return { success: false, error: 'Unauthorized request' };
    }

    log.info('Cleaning up model files via IPC');
    try {
      await cleanupModelFiles();
      return { success: true };
    } catch (error) {
      const errorMessage = (error as Error).message;
      log.error('Error cleaning up model files', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  // Handler: Get model paths for debugging
  ipcMain.handle('model:getPaths', async (event: IpcMainInvokeEvent): Promise<{ basePath: string; modelPath: string }> => {
    // ✅ SECURITY: Verify sender (Story 6.3)
    if (!verifySender(event)) {
      log.warn('model:getPaths: Unauthorized sender rejected');
      return { basePath: '', modelPath: '' };
    }

    return {
      basePath: getModelBasePath(),
      modelPath: getModelPath(),
    };
  });

  log.info('Model IPC handlers registered');
}

/**
 * Unregister all model IPC handlers
 * Call during app cleanup if needed
 */
export function unregisterModelHandlers(): void {
  ipcMain.removeHandler('model:check');
  ipcMain.removeHandler('model:download');
  ipcMain.removeHandler('model:cleanup');
  ipcMain.removeHandler('model:getPaths');
  mainWindowRef = null;
  log.info('Model IPC handlers unregistered');
}

/**
 * Update the main window reference
 * Call if the main window is recreated
 */
export function updateMainWindowRef(mainWindow: BrowserWindow | null): void {
  mainWindowRef = mainWindow;
}
