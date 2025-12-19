/**
 * Feedback and Correction Logging Types (Epic 5)
 *
 * Type definitions for user correction logging including:
 * - Correction entries for DISMISS and ADD actions
 * - Log file structure
 * - Settings for opt-out
 */

import type { EntityType, EntitySource } from './detection.js';

/**
 * Type of correction action
 */
export type CorrectionAction = 'DISMISS' | 'ADD';

/**
 * A single correction entry logged when user dismisses or adds PII
 */
export interface CorrectionEntry {
  /** Unique identifier (UUID v4) */
  id: string;

  /** ISO 8601 timestamp when correction was made */
  timestamp: string;

  /** Type of correction action */
  action: CorrectionAction;

  /** Entity type (PERSON, EMAIL, PHONE, etc.) */
  entityType: EntityType | string;

  /** Original detection source (for DISMISS only) */
  originalSource?: EntitySource;

  /** Confidence score at time of dismissal (for DISMISS only) */
  confidence?: number;

  /** Anonymized context (surrounding text with PII replaced by type markers) */
  context: string;

  /** SHA-256 hash of the document filename (not content) for pattern analysis */
  documentHash: string;

  /** Position in document (optional) */
  position?: {
    start: number;
    end: number;
  };
}

/**
 * Structure of a correction log file
 */
export interface CorrectionLogFile {
  /** Log file format version */
  version: string;

  /** Month this log covers (YYYY-MM) */
  month: string;

  /** When the file was created */
  createdAt: string;

  /** When the file was last updated */
  updatedAt: string;

  /** Array of correction entries */
  entries: CorrectionEntry[];
}

/**
 * Result of a logging operation
 */
export interface LogResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Entry ID if successful */
  entryId?: string;
}

/**
 * Input for logging a correction from renderer
 */
export interface LogCorrectionInput {
  /** Type of action */
  action: CorrectionAction;

  /** Entity type */
  entityType: EntityType | string;

  /** Original text (will be anonymized) */
  originalText: string;

  /** Context text (will be anonymized) */
  contextText: string;

  /** Document filename (will be hashed) */
  documentName: string;

  /** Original detection source (for DISMISS) */
  originalSource?: EntitySource;

  /** Confidence score (for DISMISS) */
  confidence?: number;

  /** Position in document */
  position?: {
    start: number;
    end: number;
  };
}

/**
 * Feedback logging settings
 */
export interface FeedbackSettings {
  /** Whether feedback logging is enabled */
  enabled: boolean;

  /** Last updated timestamp */
  updatedAt?: string;
}

/**
 * Default feedback settings
 */
export const DEFAULT_FEEDBACK_SETTINGS: FeedbackSettings = {
  enabled: true,
};
