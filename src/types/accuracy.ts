/**
 * Accuracy Statistics Types (Epic 5, Story 5.3)
 *
 * Type definitions for accuracy dashboard statistics including:
 * - Summary statistics (FP rate, FN estimate, document counts)
 * - Per-entity-type breakdown
 * - Trend data for charts
 */

/**
 * Summary statistics for all correction logs
 */
export interface AccuracySummary {
  /** Total unique document hashes processed */
  documentsProcessed: number;

  /** Total number of corrections (DISMISS + ADD) */
  totalCorrections: number;

  /** Number of DISMISS actions (false positives) */
  dismissals: number;

  /** Number of ADD actions (false negatives) */
  manualAdditions: number;

  /** False positive rate: dismissals / totalCorrections (0-1) */
  falsePositiveRate: number;

  /** False negative estimate: manualAdditions / totalCorrections (0-1) */
  falseNegativeEstimate: number;
}

/**
 * Statistics breakdown for a single entity type
 */
export interface EntityTypeStats {
  /** Entity type name (PERSON, EMAIL, etc.) */
  entityType: string;

  /** Number of dismissals for this type */
  dismissals: number;

  /** Number of manual additions for this type */
  additions: number;

  /** Total corrections for this type */
  total: number;
}

/**
 * A single data point for trend charts
 */
export interface TrendPoint {
  /** Period label (YYYY-MM for monthly, YYYY-Www for weekly) */
  period: string;

  /** Number of dismissals in this period */
  dismissals: number;

  /** Number of additions in this period */
  additions: number;

  /** Total corrections in this period */
  total: number;

  /** False positive rate for this period */
  fpRate: number;

  /** False negative estimate for this period */
  fnEstimate: number;
}

/**
 * Complete accuracy statistics returned by the service
 */
export interface AccuracyStatistics {
  /** Time period covered by statistics */
  period: {
    /** ISO 8601 start date */
    start: string;
    /** ISO 8601 end date */
    end: string;
  };

  /** Overall summary statistics */
  summary: AccuracySummary;

  /** Per-entity-type breakdown */
  byEntityType: EntityTypeStats[];

  /** Trend data for charts */
  trends: {
    /** Weekly trend points */
    weekly: TrendPoint[];
    /** Monthly trend points */
    monthly: TrendPoint[];
  };
}

/**
 * Result of CSV export operation
 */
export interface ExportResult {
  /** Whether export succeeded */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Path where file was saved (if successful) */
  filePath?: string;
}

/**
 * Options for fetching statistics
 */
export interface GetStatsOptions {
  /** Start date filter (ISO 8601) */
  startDate?: string;

  /** End date filter (ISO 8601) */
  endDate?: string;
}
