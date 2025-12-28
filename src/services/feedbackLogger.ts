/**
 * Feedback Logger Service (Epic 5, Story 5.2 + Story 8.9)
 *
 * Logs user corrections (dismissals and manual PII additions) for accuracy analysis.
 * Extended in Story 8.9 with:
 * - Retention policy (max events/days, automatic pruning)
 * - Aggregation API for pattern analysis
 * - All entries read API for export
 * - Delete all feedback data action
 *
 * Security: All logged data is anonymized - actual PII is replaced with type markers.
 * Privacy: User can opt-out of logging via settings.
 * Storage: Logs stored locally in app userData directory, never transmitted.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app } from 'electron';
import { createLogger } from '../utils/LoggerFactory.js';
import type {
  CorrectionEntry,
  CorrectionLogFile,
  LogResult,
  LogCorrectionInput,
  FeedbackSettings,
} from '../types/feedback.js';
import { DEFAULT_FEEDBACK_SETTINGS } from '../types/feedback.js';
// Shared feedback types and utilities (Story 8.9)
// Note: Desktop uses explicit relative imports to shared/dist/ as Node16 module
// resolution doesn't support path aliases without additional tooling.
// Browser-app uses @shared/feedback path alias via Vite.
import type {
  FeedbackEvent,
  FeedbackSummary,
  RetentionSettings,
  IFeedbackLogger,
} from '../../shared/dist/pii/feedback/types.js';
import {
  DEFAULT_RETENTION_SETTINGS,
  MAX_CONTEXT_LENGTH,
  toFeedbackAction,
} from '../../shared/dist/pii/feedback/types.js';
import { FeedbackAggregator } from '../../shared/dist/pii/feedback/FeedbackAggregator.js';

const log = createLogger('feedback-logger');

/** Current log file format version */
const LOG_VERSION = '1.0';

/** Settings file name */
const SETTINGS_FILE = 'feedback-settings.json';

/** Retention settings file name */
const RETENTION_FILE = 'feedback-retention.json';

/** Log file pattern for finding all log files */
const LOG_FILE_PATTERN = /^corrections-\d{4}-\d{2}\.json$/;

/**
 * Entity type patterns for anonymization
 * Maps entity types to their replacement markers
 */
const ENTITY_TYPE_MARKERS: Record<string, string> = {
  PERSON: '[PERSON]',
  ORGANIZATION: '[ORG]',
  LOCATION: '[LOCATION]',
  ADDRESS: '[ADDRESS]',
  SWISS_ADDRESS: '[ADDRESS]',
  EU_ADDRESS: '[ADDRESS]',
  SWISS_AVS: '[AVS]',
  IBAN: '[IBAN]',
  PHONE: '[PHONE]',
  EMAIL: '[EMAIL]',
  DATE: '[DATE]',
  AMOUNT: '[AMOUNT]',
  VAT_NUMBER: '[VAT]',
  INVOICE_NUMBER: '[INVOICE_NUM]',
  PAYMENT_REF: '[PAYMENT_REF]',
  QR_REFERENCE: '[QR_REF]',
  SENDER: '[PERSON]',
  RECIPIENT: '[PERSON]',
  SALUTATION_NAME: '[PERSON]',
  SIGNATURE: '[PERSON]',
  LETTER_DATE: '[DATE]',
  REFERENCE_LINE: '[REF]',
  PARTY: '[PARTY]',
  AUTHOR: '[PERSON]',
  VENDOR_NAME: '[ORG]',
  UNKNOWN: '[UNKNOWN]',
};

/**
 * FeedbackLogger class for logging user corrections
 *
 * Implements IFeedbackLogger interface for API consistency with browser version.
 */
export class FeedbackLogger implements IFeedbackLogger {
  private logDir: string;
  private settingsPath: string;
  private retentionPath: string;
  private settings: FeedbackSettings;
  private retentionSettings: RetentionSettings;

  constructor() {
    // Use userData directory for logs
    this.logDir = app.getPath('userData');
    this.settingsPath = path.join(this.logDir, SETTINGS_FILE);
    this.retentionPath = path.join(this.logDir, RETENTION_FILE);
    this.settings = this.loadSettings();
    this.retentionSettings = this.loadRetentionSettings();
    log.info('FeedbackLogger initialized', {
      logDir: this.logDir,
      enabled: this.settings.enabled,
      retention: this.retentionSettings,
    });
  }

  /**
   * Load settings from file or return defaults
   */
  private loadSettings(): FeedbackSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf-8');
        const parsed = JSON.parse(data) as FeedbackSettings;
        return { ...DEFAULT_FEEDBACK_SETTINGS, ...parsed };
      }
    } catch (error) {
      log.warn('Failed to load feedback settings, using defaults', { error: (error as Error).message });
    }
    return { ...DEFAULT_FEEDBACK_SETTINGS };
  }

  /**
   * Save settings to file
   */
  private saveSettings(): void {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2), 'utf-8');
      log.debug('Feedback settings saved');
    } catch (error) {
      log.error('Failed to save feedback settings', { error: (error as Error).message });
    }
  }

  /**
   * Load retention settings from file or return defaults
   */
  private loadRetentionSettings(): RetentionSettings {
    try {
      if (fs.existsSync(this.retentionPath)) {
        const data = fs.readFileSync(this.retentionPath, 'utf-8');
        const parsed = JSON.parse(data) as RetentionSettings;
        return { ...DEFAULT_RETENTION_SETTINGS, ...parsed };
      }
    } catch (error) {
      log.warn('Failed to load retention settings, using defaults', { error: (error as Error).message });
    }
    return { ...DEFAULT_RETENTION_SETTINGS };
  }

  /**
   * Save retention settings to file
   */
  private saveRetentionSettings(): void {
    try {
      fs.writeFileSync(this.retentionPath, JSON.stringify(this.retentionSettings, null, 2), 'utf-8');
      log.debug('Retention settings saved');
    } catch (error) {
      log.error('Failed to save retention settings', { error: (error as Error).message });
    }
  }

  /**
   * Get current retention settings
   */
  getRetentionSettings(): RetentionSettings {
    return { ...this.retentionSettings };
  }

  /**
   * Update retention settings
   */
  setRetentionSettings(settings: Partial<RetentionSettings>): void {
    this.retentionSettings = { ...this.retentionSettings, ...settings };
    this.saveRetentionSettings();
    log.info('Retention settings updated', { settings: this.retentionSettings });
  }

  /**
   * Check if feedback logging is enabled
   */
  isEnabled(): boolean {
    return this.settings.enabled;
  }

  /**
   * Enable or disable feedback logging
   */
  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    this.settings.updatedAt = new Date().toISOString();
    this.saveSettings();
    log.info('Feedback logging setting updated', { enabled });
  }

  /**
   * Get current log file path (monthly rotation)
   * Format: corrections-YYYY-MM.json
   */
  getLogFilePath(): string {
    const now = new Date();
    const month = now.toISOString().slice(0, 7); // YYYY-MM
    return path.join(this.logDir, `corrections-${month}.json`);
  }

  /**
   * Generate SHA-256 hash of document filename for privacy
   */
  private hashDocumentName(filename: string): string {
    return crypto.createHash('sha256').update(filename).digest('hex').slice(0, 16);
  }

  /**
   * Generate a UUID v4 for entry IDs
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Anonymize text by replacing PII with type markers
   * This preserves the structure of the text while removing sensitive content.
   *
   * @param text - Text to anonymize
   * @param entityType - Type of the primary entity (used for context)
   * @param originalText - Optional original PII text to specifically replace
   */
  anonymizeForLog(text: string, entityType: string, originalText?: string): string {
    if (!text) return '';

    let anonymized = text;

    // If we have the original text, replace it specifically
    if (originalText && originalText.length > 0) {
      const marker = ENTITY_TYPE_MARKERS[entityType] || '[PII]';
      // Escape special regex characters in originalText
      const escaped = originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      anonymized = anonymized.replace(new RegExp(escaped, 'gi'), marker);
    }

    // Additional pattern-based anonymization for common PII formats

    // Email pattern
    anonymized = anonymized.replace(
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      '[EMAIL]',
    );

    // Phone patterns (Swiss and international)
    anonymized = anonymized.replace(
      /(\+41|0041|0)[\s.-]?[0-9]{2}[\s.-]?[0-9]{3}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}/g,
      '[PHONE]',
    );

    // IBAN pattern
    anonymized = anonymized.replace(
      /[A-Z]{2}[0-9]{2}[\s]?[A-Z0-9]{4}[\s]?[0-9]{4}[\s]?[0-9]{4}[\s]?[0-9]{4}[\s]?[0-9]{4}[\s]?[0-9]{0,2}/gi,
      '[IBAN]',
    );

    // Swiss AVS pattern (756.XXXX.XXXX.XX)
    anonymized = anonymized.replace(
      /756[.\s-]?\d{4}[.\s-]?\d{4}[.\s-]?\d{2}/g,
      '[AVS]',
    );

    // Swiss postal codes followed by city names (simple version)
    anonymized = anonymized.replace(
      /\b[1-9][0-9]{3}\b/g,
      '[POSTAL]',
    );

    return anonymized;
  }

  /**
   * Load existing log file or create new structure
   */
  private loadLogFile(filePath: string): CorrectionLogFile {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(data) as CorrectionLogFile;
        // Validate structure
        if (parsed.version && parsed.entries && Array.isArray(parsed.entries)) {
          return parsed;
        }
        log.warn('Corrupted log file, creating new one');
      }
    } catch (error) {
      log.warn('Failed to load log file, creating new one', { error: (error as Error).message });
    }

    // Create new log file structure
    const now = new Date();
    return {
      version: LOG_VERSION,
      month: now.toISOString().slice(0, 7),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      entries: [],
    };
  }

  /**
   * Save log file
   */
  private saveLogFile(filePath: string, logFile: CorrectionLogFile): void {
    logFile.updatedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(logFile, null, 2), 'utf-8');
  }

  /**
   * Log a correction entry
   *
   * @param input - The correction input from renderer
   * @returns Result of the logging operation
   */
  async logCorrection(input: LogCorrectionInput): Promise<LogResult> {
    // Check if logging is enabled
    if (!this.settings.enabled) {
      log.debug('Feedback logging disabled, skipping');
      return { success: true, error: 'Logging disabled' };
    }

    try {
      // Validate input
      if (!input.action || !input.entityType || !input.documentName) {
        return { success: false, error: 'Invalid input: missing required fields' };
      }

      // Truncate context at log time for privacy (max 200 chars)
      const truncatedContext = input.contextText?.slice(0, MAX_CONTEXT_LENGTH) || '';

      // Create the correction entry with anonymized data
      const entry: CorrectionEntry = {
        id: this.generateId(),
        timestamp: new Date().toISOString(),
        action: input.action,
        entityType: input.entityType,
        context: this.anonymizeForLog(truncatedContext, input.entityType, input.originalText),
        documentHash: this.hashDocumentName(input.documentName),
      };

      // Add optional fields for DISMISS action
      if (input.action === 'DISMISS') {
        if (input.originalSource) {
          entry.originalSource = input.originalSource;
        }
        if (input.confidence !== undefined) {
          entry.confidence = input.confidence;
        }
      }

      // Add position if provided
      if (input.position) {
        entry.position = input.position;
      }

      // Get log file path and load/create log file
      const logFilePath = this.getLogFilePath();
      const logFile = this.loadLogFile(logFilePath);

      // Add entry and save
      logFile.entries.push(entry);
      this.saveLogFile(logFilePath, logFile);

      log.debug('Correction logged', { id: entry.id, action: entry.action, entityType: entry.entityType });

      return { success: true, entryId: entry.id };
    } catch (error) {
      const errorMessage = (error as Error).message;
      log.error('Failed to log correction', { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get all entries from current month's log
   */
  async getEntries(): Promise<CorrectionEntry[]> {
    try {
      const logFilePath = this.getLogFilePath();
      const logFile = this.loadLogFile(logFilePath);
      return logFile.entries;
    } catch (error) {
      log.error('Failed to get entries', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Get entry count for current month
   */
  async getEntryCount(): Promise<number> {
    const entries = await this.getEntries();
    return entries.length;
  }

  /**
   * Get all log file paths
   */
  private getAllLogFilePaths(): string[] {
    try {
      const files = fs.readdirSync(this.logDir);
      return files
        .filter(f => LOG_FILE_PATTERN.test(f))
        .map(f => path.join(this.logDir, f))
        .sort(); // Chronological order
    } catch (error) {
      log.error('Failed to list log files', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Get all entries from all log files
   * Used for aggregation and export
   */
  async getAllEntries(): Promise<CorrectionEntry[]> {
    const allEntries: CorrectionEntry[] = [];
    const logFiles = this.getAllLogFilePaths();

    for (const filePath of logFiles) {
      try {
        const logFile = this.loadLogFile(filePath);
        allEntries.push(...logFile.entries);
      } catch (error) {
        log.warn('Failed to load log file', { filePath, error: (error as Error).message });
      }
    }

    // Sort by timestamp
    allEntries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return allEntries;
  }

  /**
   * Get total entry count across all log files
   */
  async getTotalEntryCount(): Promise<number> {
    const entries = await this.getAllEntries();
    return entries.length;
  }

  /**
   * Convert legacy CorrectionEntry to FeedbackEvent
   */
  private toFeedbackEvent(entry: CorrectionEntry): FeedbackEvent {
    const action = toFeedbackAction(entry.action);

    // Build entity from legacy format
    const entity = {
      text: entry.context?.slice(0, MAX_CONTEXT_LENGTH) || '',
      type: entry.entityType,
      start: entry.position?.start ?? 0,
      end: entry.position?.end ?? 0,
      confidence: entry.confidence,
      source: entry.originalSource,
    };

    return {
      id: entry.id,
      timestamp: entry.timestamp,
      source: 'desktop',
      documentId: entry.documentHash,
      action,
      originalEntity: action === 'mark_as_not_pii' ? entity : undefined,
      updatedEntity: action === 'mark_as_pii' ? entity : undefined,
      contextWindow: entry.context?.slice(0, MAX_CONTEXT_LENGTH),
    };
  }

  /**
   * Get all entries as FeedbackEvents
   * Used for aggregation with FeedbackAggregator
   */
  async getAllFeedbackEvents(): Promise<FeedbackEvent[]> {
    const entries = await this.getAllEntries();
    return entries.map(e => this.toFeedbackEvent(e));
  }

  /**
   * Get aggregated feedback summary
   * Uses FeedbackAggregator to identify top patterns
   */
  async getAggregatedSummary(): Promise<FeedbackSummary> {
    const events = await this.getAllFeedbackEvents();
    const aggregator = new FeedbackAggregator(events);
    return aggregator.summarize();
  }

  /**
   * Apply retention policy to prune old entries
   * Returns number of entries deleted
   */
  async applyRetentionPolicy(): Promise<number> {
    if (!this.retentionSettings.enabled) {
      log.debug('Retention policy disabled, skipping');
      return 0;
    }

    let deletedCount = 0;
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (this.retentionSettings.maxAgeDays * 24 * 60 * 60 * 1000));
    const cutoffTimestamp = cutoffDate.toISOString();

    // Get all entries to check total count
    const allEntries = await this.getAllEntries();
    const totalCount = allEntries.length;

    // Check if we need to prune by count
    const countOverage = totalCount - this.retentionSettings.maxEvents;

    // Process each log file
    const logFiles = this.getAllLogFilePaths();
    for (const filePath of logFiles) {
      try {
        const logFile = this.loadLogFile(filePath);
        const originalCount = logFile.entries.length;

        // Filter by age
        logFile.entries = logFile.entries.filter(e => e.timestamp >= cutoffTimestamp);

        // If still over count limit, remove oldest entries
        if (countOverage > 0 && deletedCount < countOverage) {
          const toRemove = Math.min(countOverage - deletedCount, logFile.entries.length);
          if (toRemove > 0) {
            logFile.entries = logFile.entries.slice(toRemove);
          }
        }

        const newCount = logFile.entries.length;
        const fileDeleted = originalCount - newCount;
        deletedCount += fileDeleted;

        // Save or delete empty file
        if (newCount === 0) {
          fs.unlinkSync(filePath);
          log.debug('Deleted empty log file', { filePath });
        } else if (fileDeleted > 0) {
          this.saveLogFile(filePath, logFile);
          log.debug('Pruned entries from log file', { filePath, deleted: fileDeleted });
        }
      } catch (error) {
        log.warn('Failed to prune log file', { filePath, error: (error as Error).message });
      }
    }

    // Update last pruned timestamp
    this.retentionSettings.lastPruned = now.toISOString();
    this.saveRetentionSettings();

    log.info('Retention policy applied', { deletedCount });
    return deletedCount;
  }

  /**
   * Delete all feedback data
   * Returns number of entries deleted
   */
  async deleteAllFeedbackData(): Promise<number> {
    let deletedCount = 0;
    const logFiles = this.getAllLogFilePaths();

    for (const filePath of logFiles) {
      try {
        const logFile = this.loadLogFile(filePath);
        deletedCount += logFile.entries.length;
        fs.unlinkSync(filePath);
        log.debug('Deleted log file', { filePath, entries: logFile.entries.length });
      } catch (error) {
        log.warn('Failed to delete log file', { filePath, error: (error as Error).message });
      }
    }

    log.info('All feedback data deleted', { deletedCount });
    return deletedCount;
  }

  /**
   * Get the log directory path
   * Used by export script
   */
  getLogDirectory(): string {
    return this.logDir;
  }
}

// Singleton instance
let feedbackLoggerInstance: FeedbackLogger | null = null;

/**
 * Get the singleton FeedbackLogger instance
 */
export function getFeedbackLogger(): FeedbackLogger {
  if (!feedbackLoggerInstance) {
    feedbackLoggerInstance = new FeedbackLogger();
  }
  return feedbackLoggerInstance;
}

/**
 * Initialize the FeedbackLogger (call from main process during app init)
 */
export function initFeedbackLogger(): FeedbackLogger {
  return getFeedbackLogger();
}
