/**
 * Feedback IPC Handlers (Epic 5, Story 5.2)
 *
 * Provides secure IPC handlers for feedback logging operations.
 *
 * Security: Validates all inputs before processing.
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { createLogger } from '../utils/LoggerFactory.js';
import { getFeedbackLogger } from './feedbackLogger.js';
import { verifySender } from '../utils/ipcValidator.js';
import type { LogResult, LogCorrectionInput, FeedbackSettings } from '../types/feedback.js';

const log = createLogger('feedback-handlers');

/**
 * Validate LogCorrectionInput structure
 */
function validateCorrectionInput(input: unknown): input is LogCorrectionInput {
  if (!input || typeof input !== 'object') return false;

  const obj = input as Record<string, unknown>;

  // Required fields
  if (typeof obj.action !== 'string' || !['DISMISS', 'ADD'].includes(obj.action)) {
    return false;
  }
  if (typeof obj.entityType !== 'string' || obj.entityType.length === 0) {
    return false;
  }
  if (typeof obj.documentName !== 'string' || obj.documentName.length === 0) {
    return false;
  }

  // Optional fields validation
  if (obj.originalText !== undefined && typeof obj.originalText !== 'string') {
    return false;
  }
  if (obj.contextText !== undefined && typeof obj.contextText !== 'string') {
    return false;
  }
  if (obj.confidence !== undefined && typeof obj.confidence !== 'number') {
    return false;
  }
  if (obj.originalSource !== undefined) {
    if (typeof obj.originalSource !== 'string' ||
        !['ML', 'RULE', 'BOTH', 'MANUAL'].includes(obj.originalSource)) {
      return false;
    }
  }
  if (obj.position !== undefined && obj.position !== null) {
    const pos = obj.position as Record<string, unknown>;
    if (typeof pos !== 'object' || pos === null) {
      return false;
    }
    // Position fields are optional - only validate if present
    if (pos.start !== undefined && pos.start !== null && typeof pos.start !== 'number') {
      return false;
    }
    if (pos.end !== undefined && pos.end !== null && typeof pos.end !== 'number') {
      return false;
    }
  }

  return true;
}

/**
 * Register all feedback-related IPC handlers
 * Call this from main.js during app initialization
 */
export function registerFeedbackHandlers(): void {
  log.info('Registering feedback IPC handlers...');

  let feedbackLogger;
  try {
    feedbackLogger = getFeedbackLogger();
    log.debug('FeedbackLogger instance obtained');
  } catch (error) {
    log.error('Failed to initialize FeedbackLogger', { error: (error as Error).message, stack: (error as Error).stack });
    return;
  }

  // Handler: Log a correction
  ipcMain.handle('feedback:log-correction', async (event: IpcMainInvokeEvent, input: unknown): Promise<LogResult> => {
    // ✅ SECURITY: Verify sender (Story 6.3)
    if (!verifySender(event)) {
      log.warn('feedback:log-correction: Unauthorized sender rejected');
      return { success: false, error: 'Unauthorized request' };
    }

    log.debug('Received correction log request');

    if (!validateCorrectionInput(input)) {
      log.warn('Invalid correction input rejected');
      return { success: false, error: 'Invalid input format' };
    }

    return await feedbackLogger.logCorrection(input);
  });

  // Handler: Get feedback logging enabled status
  ipcMain.handle('feedback:is-enabled', async (event: IpcMainInvokeEvent): Promise<boolean> => {
    // ✅ SECURITY: Verify sender (Story 6.3)
    if (!verifySender(event)) {
      log.warn('feedback:is-enabled: Unauthorized sender rejected');
      return false;
    }

    return feedbackLogger.isEnabled();
  });

  // Handler: Set feedback logging enabled status
  ipcMain.handle('feedback:set-enabled', async (event: IpcMainInvokeEvent, enabled: unknown): Promise<{ success: boolean }> => {
    // ✅ SECURITY: Verify sender (Story 6.3)
    if (!verifySender(event)) {
      log.warn('feedback:set-enabled: Unauthorized sender rejected');
      return { success: false };
    }

    if (typeof enabled !== 'boolean') {
      log.warn('Invalid enabled value rejected');
      return { success: false };
    }

    feedbackLogger.setEnabled(enabled);
    return { success: true };
  });

  // Handler: Get feedback settings
  ipcMain.handle('feedback:get-settings', async (event: IpcMainInvokeEvent): Promise<FeedbackSettings> => {
    // ✅ SECURITY: Verify sender (Story 6.3)
    if (!verifySender(event)) {
      log.warn('feedback:get-settings: Unauthorized sender rejected');
      return { enabled: false };
    }

    return {
      enabled: feedbackLogger.isEnabled(),
    };
  });

  // Handler: Get correction count for current month
  ipcMain.handle('feedback:get-count', async (event: IpcMainInvokeEvent): Promise<number> => {
    // ✅ SECURITY: Verify sender (Story 6.3)
    if (!verifySender(event)) {
      log.warn('feedback:get-count: Unauthorized sender rejected');
      return 0;
    }

    return await feedbackLogger.getEntryCount();
  });

  log.info('Feedback IPC handlers registered');
}

/**
 * Unregister all feedback IPC handlers
 * Call during app cleanup if needed
 */
export function unregisterFeedbackHandlers(): void {
  ipcMain.removeHandler('feedback:log-correction');
  ipcMain.removeHandler('feedback:is-enabled');
  ipcMain.removeHandler('feedback:set-enabled');
  ipcMain.removeHandler('feedback:get-settings');
  ipcMain.removeHandler('feedback:get-count');
  log.info('Feedback IPC handlers unregistered');
}
