/**
 * Feedback Learning Loop Types (Story 8.9)
 *
 * Shared type definitions for user feedback and learning loop:
 * - FeedbackEvent: Extended event format for aggregation
 * - AggregatedPattern: Grouped pattern with frequency counts
 * - FeedbackSummary: Top false positives and missed PII patterns
 * - RetentionSettings: Configuration for automatic pruning
 *
 * Privacy: Raw PII text is never stored - only metadata and limited context.
 * Storage: All data stays local (IndexedDB for browser, JSONL for desktop).
 */

/**
 * Action types for feedback events
 */
export type FeedbackAction =
  | 'mark_as_pii'       // User manually marked text as PII (false negative)
  | 'mark_as_not_pii'   // User dismissed a detection (false positive)
  | 'change_entity_type'// User changed the entity type
  | 'adjust_confidence';// User adjusted confidence (future use)

/**
 * Source of the feedback event
 */
export type FeedbackSource = 'desktop' | 'browser';

/**
 * Entity position in document
 */
export interface EntityPosition {
  start: number;
  end: number;
}

/**
 * Entity information for feedback events
 */
export interface FeedbackEntity {
  /** Entity text (limited to max context length for privacy) */
  text: string;
  /** Entity type (PERSON_NAME, EMAIL, IBAN, etc.) */
  type: string;
  /** Start position in document */
  start: number;
  /** End position in document */
  end: number;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Detection source (REGEX, ML, PATTERN, etc.) */
  source?: string;
}

/**
 * Extended feedback event for aggregation and analysis
 *
 * This extends the existing CorrectionEntry with additional context
 * needed for pattern analysis and learning loop functionality.
 */
export interface FeedbackEvent {
  /** Unique identifier (UUID v4) */
  id: string;

  /** ISO 8601 timestamp when correction was made */
  timestamp: string;

  /** Source application (desktop or browser) */
  source: FeedbackSource;

  /** Hashed document identifier for privacy */
  documentId: string;

  /** Document type classification (INVOICE, LETTER, HR, etc.) */
  documentType?: string;

  /** Document language (en, fr, de, it) */
  language?: string;

  /** The original entity that was detected (for mark_as_not_pii, change_entity_type) */
  originalEntity?: FeedbackEntity;

  /** The updated/new entity (for mark_as_pii, change_entity_type) */
  updatedEntity?: FeedbackEntity;

  /** The feedback action performed */
  action: FeedbackAction;

  /** Limited context window around the entity (max 200 chars, anonymized) */
  contextWindow?: string;
}

/**
 * Aggregated pattern from multiple feedback events
 *
 * Groups similar corrections to identify frequent issues.
 */
export interface AggregatedPattern {
  /** Normalized text pattern (or hash for privacy) */
  pattern: string;

  /** Entity type (PERSON_NAME, EMAIL, etc.) */
  entityType: string;

  /** Document type where pattern appears most often */
  documentType?: string;

  /** Primary language of documents with this pattern */
  language?: string;

  /** Number of times this pattern was corrected */
  count: number;

  /** Average confidence score of original detections */
  avgConfidence?: number;

  /** Detection sources that produced this pattern */
  sources?: string[];

  /** Most recent occurrence timestamp */
  lastSeen: string;

  /** First occurrence timestamp */
  firstSeen: string;

  /** Example context windows (limited for privacy) */
  exampleContexts?: string[];
}

/**
 * Summary of aggregated feedback patterns
 */
export interface FeedbackSummary {
  /** Patterns that were marked as not PII (false positives) */
  falsePositives: AggregatedPattern[];

  /** Patterns that were manually added (missed PII) */
  missedPii: AggregatedPattern[];

  /** Patterns where entity type was changed */
  typeChanges?: AggregatedPattern[];

  /** Total events analyzed */
  totalEvents: number;

  /** Date range of events analyzed */
  dateRange: {
    start: string;
    end: string;
  };

  /** Events by source */
  bySource: {
    desktop: number;
    browser: number;
  };

  /** Events by action type */
  byAction: Record<FeedbackAction, number>;
}

/**
 * Retention settings for feedback data
 */
export interface RetentionSettings {
  /** Maximum number of events to retain (default: 10000) */
  maxEvents: number;

  /** Maximum age in days to retain events (default: 90) */
  maxAgeDays: number;

  /** Whether automatic pruning is enabled */
  enabled: boolean;

  /** Last pruning timestamp */
  lastPruned?: string;
}

/**
 * Default retention settings
 */
export const DEFAULT_RETENTION_SETTINGS: RetentionSettings = {
  maxEvents: 10000,
  maxAgeDays: 90,
  enabled: true,
};

/**
 * Maximum context window length for privacy
 */
export const MAX_CONTEXT_LENGTH = 200;

/**
 * Export modes for the export script
 */
export type ExportMode = 'raw' | 'anonymised';

/**
 * Export options for the export script
 */
export interface ExportOptions {
  /** Export mode: raw (internal) or anonymised (shareable) */
  mode: ExportMode;

  /** Output directory for exported files */
  outputDir: string;

  /** Minimum pattern count to include in summary */
  minPatternCount?: number;

  /** Maximum patterns per category in summary */
  maxPatterns?: number;

  /** Include example contexts in export */
  includeContexts?: boolean;
}

/**
 * Result of pattern aggregation
 */
export interface AggregationResult {
  /** Summary of aggregated patterns */
  summary: FeedbackSummary;

  /** Raw events (for raw export mode only) */
  events?: FeedbackEvent[];

  /** Export metadata */
  metadata: {
    exportedAt: string;
    mode: ExportMode;
    version: string;
    eventCount: number;
  };
}

/**
 * Mapping from legacy CorrectionAction to FeedbackAction
 */
export const LEGACY_ACTION_MAP: Record<string, FeedbackAction> = {
  'DISMISS': 'mark_as_not_pii',
  'ADD': 'mark_as_pii',
};

/**
 * Convert legacy correction action to feedback action
 */
export function toFeedbackAction(legacyAction: string): FeedbackAction {
  return LEGACY_ACTION_MAP[legacyAction] || 'mark_as_not_pii';
}

// ============================================================================
// Shared Interface for Platform Implementations (Story 8.9)
// ============================================================================

/**
 * Input for logging a correction
 */
export interface LogCorrectionInput {
  /** Action type: 'DISMISS' (false positive) or 'ADD' (missed PII) */
  action: 'DISMISS' | 'ADD';
  /** Entity type (PERSON_NAME, EMAIL, etc.) */
  entityType: string;
  /** Document filename for hashing */
  documentName: string;
  /** Context text around the entity (will be truncated and anonymized) */
  contextText?: string;
  /** Original PII text to replace in context */
  originalText?: string;
  /** Original detection source (REGEX, ML, etc.) - for DISMISS */
  originalSource?: string;
  /** Original confidence score - for DISMISS */
  confidence?: number;
  /** Entity position in document */
  position?: EntityPosition;
}

/**
 * Result of a log operation
 */
export interface LogResult {
  success: boolean;
  entryId?: string;
  error?: string;
}

/**
 * Shared interface for feedback logger implementations
 *
 * Both desktop (Electron) and browser implementations should conform to this
 * interface to ensure API consistency across platforms.
 */
export interface IFeedbackLogger {
  /**
   * Check if feedback logging is enabled
   */
  isEnabled(): boolean;

  /**
   * Enable or disable feedback logging
   */
  setEnabled(enabled: boolean): void;

  /**
   * Log a user correction
   * @param input Correction input data
   * @returns Result of the logging operation
   */
  logCorrection(input: LogCorrectionInput): Promise<LogResult>;

  /**
   * Get all feedback events
   * @returns Array of all feedback events
   */
  getAllFeedbackEvents(): Promise<FeedbackEvent[]>;

  /**
   * Get aggregated feedback summary
   * @returns Summary of false positives and missed PII patterns
   */
  getAggregatedSummary(): Promise<FeedbackSummary>;

  /**
   * Apply retention policy to prune old/excess events
   * @param settings Optional retention settings override
   * @returns Number of entries deleted
   */
  applyRetentionPolicy(settings?: Partial<RetentionSettings>): Promise<number>;

  /**
   * Delete all feedback data
   * @returns Number of entries deleted
   */
  deleteAllFeedbackData(): Promise<number>;

  /**
   * Get total entry count
   * @returns Number of feedback entries
   */
  getTotalEntryCount(): Promise<number>;
}
