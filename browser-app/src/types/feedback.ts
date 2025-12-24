/**
 * Feedback and Correction Logging Types (Epic 7, Story 7.8)
 *
 * Browser-app port of src/types/feedback.ts for IndexedDB-based storage.
 * Type definitions for user correction logging including:
 * - Correction entries for DISMISS and ADD actions
 * - Statistics for pattern analysis
 * - Settings for opt-out
 */

/**
 * Entity source types
 */
export type EntitySource = 'ML' | 'REGEX' | 'BOTH' | 'MANUAL';

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

  /** Month in YYYY-MM format for rotation queries */
  month: string;

  /** Type of correction action */
  action: CorrectionAction;

  /** Entity type (PERSON, EMAIL, PHONE, etc.) */
  entityType: string;

  /** Anonymized context (surrounding text with PII replaced by type markers) */
  context: string;

  /** SHA-256 hash of the document filename (not content) for pattern analysis */
  documentHash: string;

  /** Original detection source (for DISMISS) or 'MANUAL' for ADD actions */
  originalSource?: EntitySource;

  /** Confidence score at time of dismissal (for DISMISS only) */
  confidence?: number;

  /** Position in document (optional) */
  position?: {
    start: number;
    end: number;
  };
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
 * Input for logging a correction
 */
export interface LogCorrectionInput {
  /** Type of action */
  action: CorrectionAction;

  /** Entity type */
  entityType: string;

  /** Original text (will be anonymized) */
  originalText: string;

  /** Context text (will be anonymized) */
  contextText: string;

  /** Document filename (will be hashed) */
  documentName: string;

  /** Original detection source (for DISMISS) or 'MANUAL' for ADD actions */
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

  /** When settings were last updated */
  updatedAt?: string;
}

/**
 * Statistics about corrections
 */
export interface FeedbackStatistics {
  /** Total number of corrections */
  totalCorrections: number;

  /** Corrections by action type */
  byAction: {
    DISMISS: number;
    ADD: number;
  };

  /** Corrections by entity type */
  byType: Record<string, number>;

  /** ISO timestamp of oldest entry */
  oldestEntry?: string;

  /** ISO timestamp of newest entry */
  newestEntry?: string;
}

/**
 * Default feedback settings (opt-out model - enabled by default)
 */
export const DEFAULT_FEEDBACK_SETTINGS: FeedbackSettings = {
  enabled: true,
};

/**
 * Default retention period in months
 */
export const DEFAULT_RETENTION_MONTHS = 6;

/**
 * IndexedDB database name
 */
export const FEEDBACK_DB_NAME = 'pii-anonymizer-feedback';

/**
 * IndexedDB database version
 */
export const FEEDBACK_DB_VERSION = 1;

/**
 * IndexedDB object store name
 */
export const CORRECTIONS_STORE_NAME = 'corrections';

/**
 * localStorage key for settings
 */
export const FEEDBACK_SETTINGS_KEY = 'pii-anonymizer-feedback-settings';
