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
 * Default retention settings
 */
export const DEFAULT_RETENTION_SETTINGS = {
    maxEvents: 10000,
    maxAgeDays: 90,
    enabled: true,
};
/**
 * Maximum context window length for privacy
 */
export const MAX_CONTEXT_LENGTH = 200;
/**
 * Mapping from legacy CorrectionAction to FeedbackAction
 */
export const LEGACY_ACTION_MAP = {
    'DISMISS': 'mark_as_not_pii',
    'ADD': 'mark_as_pii',
};
/**
 * Convert legacy correction action to feedback action
 */
export function toFeedbackAction(legacyAction) {
    return LEGACY_ACTION_MAP[legacyAction] || 'mark_as_not_pii';
}
//# sourceMappingURL=types.js.map