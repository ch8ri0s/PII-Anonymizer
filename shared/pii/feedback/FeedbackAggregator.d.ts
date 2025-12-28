/**
 * Feedback Aggregator (Story 8.9)
 *
 * Aggregates user correction events to identify patterns:
 * - Top false positive patterns (entities marked as not PII)
 * - Top missed PII patterns (entities manually added)
 * - Type change patterns (entity type corrections)
 *
 * These patterns inform DenyList updates, ContextWords additions,
 * and recognizer improvements without manual rule hunting.
 *
 * Privacy: All aggregation preserves privacy by using hashed patterns
 * and limited context windows. No raw PII is exposed.
 */
import type { FeedbackEvent, FeedbackSummary, AggregatedPattern } from './types.js';
/**
 * Options for aggregation
 */
export interface AggregationOptions {
    /** Maximum patterns to return per category (default: 20) */
    maxPatterns?: number;
    /** Minimum count to include a pattern (default: 1) */
    minCount?: number;
    /** Maximum context examples per pattern (default: 3) */
    maxContexts?: number;
    /** Whether to group by document type (default: false) */
    groupByDocumentType?: boolean;
    /** Whether to normalize patterns to lowercase (default: true) */
    normalizeCase?: boolean;
}
/**
 * Aggregates feedback events into patterns for analysis
 */
export declare class FeedbackAggregator {
    private events;
    private options;
    /**
     * Create a new FeedbackAggregator
     * @param events Array of feedback events to aggregate
     * @param options Aggregation options
     */
    constructor(events: FeedbackEvent[], options?: AggregationOptions);
    /**
     * Generate a complete summary of patterns
     */
    summarize(): FeedbackSummary;
    /**
     * Get top false positive patterns
     *
     * These are entities that were detected but marked as NOT PII by users.
     * High-frequency patterns are candidates for DenyList additions.
     */
    getFalsePositivePatterns(): AggregatedPattern[];
    /**
     * Get top missed PII patterns
     *
     * These are entities that users manually marked as PII (not detected).
     * High-frequency patterns are candidates for recognizer improvements.
     */
    getMissedPiiPatterns(): AggregatedPattern[];
    /**
     * Get type change patterns
     *
     * These are entities where users corrected the entity type.
     * Useful for understanding classification confusion.
     */
    getTypeChangePatterns(): AggregatedPattern[];
    /**
     * Aggregate events into patterns
     */
    private aggregatePatterns;
    /**
     * Normalize pattern text for consistent grouping
     */
    private normalizePattern;
    /**
     * Create a string key for the pattern bucket map
     */
    private createKeyString;
    /**
     * Get the most frequent item from a set
     */
    private getMostFrequent;
    /**
     * Static factory method to create aggregator from legacy correction entries
     */
    static fromLegacyEntries(entries: Array<{
        id: string;
        timestamp: string;
        action: string;
        entityType: string;
        context?: string;
        documentHash: string;
        originalSource?: string;
        confidence?: number;
        position?: {
            start: number;
            end: number;
        };
    }>, source?: 'desktop' | 'browser'): FeedbackAggregator;
}
/**
 * Create a FeedbackAggregator from events
 */
export declare function createAggregator(events: FeedbackEvent[], options?: AggregationOptions): FeedbackAggregator;
//# sourceMappingURL=FeedbackAggregator.d.ts.map