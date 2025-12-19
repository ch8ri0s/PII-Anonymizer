/**
 * Feedback Logger Service (Epic 5, Story 5.2)
 *
 * Logs user corrections (dismissals and manual PII additions) for accuracy analysis.
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

const log = createLogger('feedback-logger');

/** Current log file format version */
const LOG_VERSION = '1.0';

/** Settings file name */
const SETTINGS_FILE = 'feedback-settings.json';

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
 */
export class FeedbackLogger {
  private logDir: string;
  private settingsPath: string;
  private settings: FeedbackSettings;

  constructor() {
    // Use userData directory for logs
    this.logDir = app.getPath('userData');
    this.settingsPath = path.join(this.logDir, SETTINGS_FILE);
    this.settings = this.loadSettings();
    log.info('FeedbackLogger initialized', { logDir: this.logDir, enabled: this.settings.enabled });
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

      // Create the correction entry with anonymized data
      const entry: CorrectionEntry = {
        id: this.generateId(),
        timestamp: new Date().toISOString(),
        action: input.action,
        entityType: input.entityType,
        context: this.anonymizeForLog(input.contextText, input.entityType, input.originalText),
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
