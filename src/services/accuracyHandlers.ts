/**
 * Accuracy IPC Handlers (Epic 5, Story 5.3)
 *
 * Provides secure IPC handlers for accuracy dashboard operations.
 *
 * Security: Validates all inputs before processing.
 *
 * Story 6.3: Added sender verification
 */

import { ipcMain, dialog, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import * as fs from 'fs';
import { createLogger } from '../utils/LoggerFactory.js';
import { getAccuracyStats } from './accuracyStats.js';
import type { AccuracyStatistics, ExportResult, GetStatsOptions } from '../types/accuracy.js';
import { verifySender } from '../utils/ipcValidator.js';

const log = createLogger('accuracy-handlers');

/**
 * Validate GetStatsOptions structure
 */
function validateGetStatsOptions(input: unknown): input is GetStatsOptions {
  if (!input) return true; // Options are optional

  if (typeof input !== 'object') return false;

  const obj = input as Record<string, unknown>;

  // Validate optional date strings
  if (obj.startDate !== undefined && typeof obj.startDate !== 'string') {
    return false;
  }
  if (obj.endDate !== undefined && typeof obj.endDate !== 'string') {
    return false;
  }

  return true;
}

/**
 * Register all accuracy-related IPC handlers
 * Call this from main.ts during app initialization
 */
export function registerAccuracyHandlers(mainWindow: BrowserWindow | null): void {
  log.info('Registering accuracy IPC handlers...');

  let accuracyStats;
  try {
    accuracyStats = getAccuracyStats();
    log.debug('AccuracyStats instance obtained');
  } catch (error) {
    log.error('Failed to initialize AccuracyStats', { error: (error as Error).message });
    return;
  }

  // Handler: Get accuracy statistics
  ipcMain.handle('accuracy:get-stats', async (event: IpcMainInvokeEvent, options?: unknown): Promise<AccuracyStatistics> => {
    // ✅ SECURITY: Verify sender (Story 6.3)
    if (!verifySender(event)) {
      log.warn('accuracy:get-stats: Unauthorized sender rejected');
      throw new Error('Unauthorized request');
    }

    log.debug('Received accuracy stats request');

    if (!validateGetStatsOptions(options)) {
      log.warn('Invalid options rejected');
      throw new Error('Invalid options format');
    }

    return await accuracyStats.calculateStatistics(options as GetStatsOptions);
  });

  // Handler: Get monthly trend data
  ipcMain.handle('accuracy:get-trends', async (event: IpcMainInvokeEvent, view: unknown): Promise<AccuracyStatistics['trends']> => {
    // ✅ SECURITY: Verify sender (Story 6.3)
    if (!verifySender(event)) {
      log.warn('accuracy:get-trends: Unauthorized sender rejected');
      throw new Error('Unauthorized request');
    }

    log.debug('Received accuracy trends request', { view });

    const stats = await accuracyStats.calculateStatistics();
    return stats.trends;
  });

  // Handler: Export CSV report
  ipcMain.handle('accuracy:export-csv', async (event: IpcMainInvokeEvent): Promise<ExportResult> => {
    // ✅ SECURITY: Verify sender (Story 6.3)
    if (!verifySender(event)) {
      log.warn('accuracy:export-csv: Unauthorized sender rejected');
      return { success: false, error: 'Unauthorized request' };
    }

    log.debug('Received CSV export request');

    try {
      // Calculate current statistics
      const stats = await accuracyStats.calculateStatistics();
      const csvContent = accuracyStats.generateCsvReport(stats);

      // Generate default filename with date
      const date = new Date().toISOString().slice(0, 10);
      const defaultFilename = `accuracy-report-${date}.csv`;

      // Show save dialog
      const result = await dialog.showSaveDialog(mainWindow!, {
        title: 'Export Accuracy Report',
        defaultPath: defaultFilename,
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result.canceled || !result.filePath) {
        log.debug('CSV export cancelled by user');
        return { success: false, error: 'Export cancelled' };
      }

      // Write file
      fs.writeFileSync(result.filePath, csvContent, 'utf-8');
      log.info('CSV report exported', { filePath: result.filePath });

      return { success: true, filePath: result.filePath };
    } catch (error) {
      const errorMessage = (error as Error).message;
      log.error('Failed to export CSV', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  });

  log.info('Accuracy IPC handlers registered');
}

/**
 * Unregister all accuracy IPC handlers
 * Call during app cleanup if needed
 */
export function unregisterAccuracyHandlers(): void {
  ipcMain.removeHandler('accuracy:get-stats');
  ipcMain.removeHandler('accuracy:get-trends');
  ipcMain.removeHandler('accuracy:export-csv');
  log.info('Accuracy IPC handlers unregistered');
}
