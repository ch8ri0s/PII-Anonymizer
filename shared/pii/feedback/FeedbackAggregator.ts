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

import type {
  FeedbackEvent,
  FeedbackAction,
  FeedbackSummary,
  AggregatedPattern,
} from './types.js';

/**
 * Key for grouping similar patterns
 */
interface PatternKey {
  /** Normalized pattern text */
  pattern: string;
  /** Entity type */
  entityType: string;
  /** Document type (optional grouping) */
  documentType?: string;
}

/**
 * Internal aggregation bucket
 */
interface PatternBucket {
  key: PatternKey;
  count: number;
  confidenceSum: number;
  sources: Set<string>;
  languages: Set<string>;
  documentTypes: Set<string>;
  firstSeen: string;
  lastSeen: string;
  contexts: string[];
}

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

const DEFAULT_OPTIONS: Required<AggregationOptions> = {
  maxPatterns: 20,
  minCount: 1,
  maxContexts: 3,
  groupByDocumentType: false,
  normalizeCase: true,
};

/**
 * Aggregates feedback events into patterns for analysis
 */
export class FeedbackAggregator {
  private events: FeedbackEvent[];
  private options: Required<AggregationOptions>;

  /**
   * Create a new FeedbackAggregator
   * @param events Array of feedback events to aggregate
   * @param options Aggregation options
   */
  constructor(events: FeedbackEvent[], options: AggregationOptions = {}) {
    this.events = events;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate a complete summary of patterns
   */
  summarize(): FeedbackSummary {
    const falsePositives = this.getFalsePositivePatterns();
    const missedPii = this.getMissedPiiPatterns();
    const typeChanges = this.getTypeChangePatterns();

    // Calculate date range
    const timestamps = this.events.map(e => e.timestamp).sort();
    const dateRange = {
      start: timestamps[0] || new Date().toISOString(),
      end: timestamps[timestamps.length - 1] || new Date().toISOString(),
    };

    // Count by source
    const bySource = { desktop: 0, browser: 0 };
    for (const event of this.events) {
      if (event.source === 'desktop') {
        bySource.desktop++;
      } else {
        bySource.browser++;
      }
    }

    // Count by action
    const byAction: Record<FeedbackAction, number> = {
      mark_as_not_pii: 0,
      mark_as_pii: 0,
      change_entity_type: 0,
      adjust_confidence: 0,
    };
    for (const event of this.events) {
      byAction[event.action]++;
    }

    return {
      falsePositives,
      missedPii,
      typeChanges: typeChanges.length > 0 ? typeChanges : undefined,
      totalEvents: this.events.length,
      dateRange,
      bySource,
      byAction,
    };
  }

  /**
   * Get top false positive patterns
   *
   * These are entities that were detected but marked as NOT PII by users.
   * High-frequency patterns are candidates for DenyList additions.
   */
  getFalsePositivePatterns(): AggregatedPattern[] {
    const fpEvents = this.events.filter(e => e.action === 'mark_as_not_pii');
    return this.aggregatePatterns(fpEvents, 'originalEntity');
  }

  /**
   * Get top missed PII patterns
   *
   * These are entities that users manually marked as PII (not detected).
   * High-frequency patterns are candidates for recognizer improvements.
   */
  getMissedPiiPatterns(): AggregatedPattern[] {
    const missedEvents = this.events.filter(e => e.action === 'mark_as_pii');
    return this.aggregatePatterns(missedEvents, 'updatedEntity');
  }

  /**
   * Get type change patterns
   *
   * These are entities where users corrected the entity type.
   * Useful for understanding classification confusion.
   */
  getTypeChangePatterns(): AggregatedPattern[] {
    const changeEvents = this.events.filter(e => e.action === 'change_entity_type');
    return this.aggregatePatterns(changeEvents, 'originalEntity');
  }

  /**
   * Aggregate events into patterns
   */
  private aggregatePatterns(
    events: FeedbackEvent[],
    entityField: 'originalEntity' | 'updatedEntity',
  ): AggregatedPattern[] {
    const buckets = new Map<string, PatternBucket>();

    for (const event of events) {
      const entity = event[entityField];
      if (!entity) continue;

      // Create pattern key
      const pattern = this.normalizePattern(entity.text);
      const keyString = this.createKeyString(pattern, entity.type, event.documentType);

      // Get or create bucket
      let bucket = buckets.get(keyString);
      if (!bucket) {
        bucket = {
          key: {
            pattern,
            entityType: entity.type,
            documentType: this.options.groupByDocumentType ? event.documentType : undefined,
          },
          count: 0,
          confidenceSum: 0,
          sources: new Set(),
          languages: new Set(),
          documentTypes: new Set(),
          firstSeen: event.timestamp,
          lastSeen: event.timestamp,
          contexts: [],
        };
        buckets.set(keyString, bucket);
      }

      // Update bucket
      bucket.count++;
      if (entity.confidence !== undefined) {
        bucket.confidenceSum += entity.confidence;
      }
      if (entity.source) {
        bucket.sources.add(entity.source);
      }
      if (event.language) {
        bucket.languages.add(event.language);
      }
      if (event.documentType) {
        bucket.documentTypes.add(event.documentType);
      }

      // Track timestamps
      if (event.timestamp < bucket.firstSeen) {
        bucket.firstSeen = event.timestamp;
      }
      if (event.timestamp > bucket.lastSeen) {
        bucket.lastSeen = event.timestamp;
      }

      // Add context (limited)
      if (event.contextWindow && bucket.contexts.length < this.options.maxContexts) {
        bucket.contexts.push(event.contextWindow);
      }
    }

    // Convert buckets to patterns and sort by count
    const patterns: AggregatedPattern[] = [];
    for (const bucket of buckets.values()) {
      if (bucket.count >= this.options.minCount) {
        patterns.push({
          pattern: bucket.key.pattern,
          entityType: bucket.key.entityType,
          documentType: this.getMostFrequent(bucket.documentTypes),
          language: this.getMostFrequent(bucket.languages),
          count: bucket.count,
          avgConfidence: bucket.confidenceSum > 0
            ? bucket.confidenceSum / bucket.count
            : undefined,
          sources: bucket.sources.size > 0 ? Array.from(bucket.sources) : undefined,
          lastSeen: bucket.lastSeen,
          firstSeen: bucket.firstSeen,
          exampleContexts: bucket.contexts.length > 0 ? bucket.contexts : undefined,
        });
      }
    }

    // Sort by count (descending) and limit
    patterns.sort((a, b) => b.count - a.count);
    return patterns.slice(0, this.options.maxPatterns);
  }

  /**
   * Normalize pattern text for consistent grouping
   */
  private normalizePattern(text: string): string {
    let normalized = text.trim();

    if (this.options.normalizeCase) {
      normalized = normalized.toLowerCase();
    }

    // Collapse multiple spaces
    normalized = normalized.replace(/\s+/g, ' ');

    return normalized;
  }

  /**
   * Create a string key for the pattern bucket map
   */
  private createKeyString(
    pattern: string,
    entityType: string,
    documentType?: string,
  ): string {
    if (this.options.groupByDocumentType && documentType) {
      return `${pattern}|${entityType}|${documentType}`;
    }
    return `${pattern}|${entityType}`;
  }

  /**
   * Get the most frequent item from a set
   */
  private getMostFrequent(items: Set<string>): string | undefined {
    if (items.size === 0) return undefined;
    if (items.size === 1) return items.values().next().value;

    // For multiple items, just return the first one (stable ordering)
    return Array.from(items)[0];
  }

  /**
   * Static factory method to create aggregator from legacy correction entries
   */
  static fromLegacyEntries(
    entries: Array<{
      id: string;
      timestamp: string;
      action: string;
      entityType: string;
      context?: string;
      documentHash: string;
      originalSource?: string;
      confidence?: number;
      position?: { start: number; end: number };
    }>,
    source: 'desktop' | 'browser' = 'desktop',
  ): FeedbackAggregator {
    const events: FeedbackEvent[] = entries.map(entry => {
      // Map legacy action to feedback action
      const action: FeedbackAction = entry.action === 'DISMISS'
        ? 'mark_as_not_pii'
        : entry.action === 'ADD'
          ? 'mark_as_pii'
          : 'mark_as_not_pii';

      // Build entity from legacy format
      const entity = {
        text: entry.context || '', // Context was the anonymized text
        type: entry.entityType,
        start: entry.position?.start ?? 0,
        end: entry.position?.end ?? 0,
        confidence: entry.confidence,
        source: entry.originalSource,
      };

      return {
        id: entry.id,
        timestamp: entry.timestamp,
        source,
        documentId: entry.documentHash,
        action,
        originalEntity: action === 'mark_as_not_pii' ? entity : undefined,
        updatedEntity: action === 'mark_as_pii' ? entity : undefined,
        contextWindow: entry.context,
      };
    });

    return new FeedbackAggregator(events);
  }
}

/**
 * Create a FeedbackAggregator from events
 */
export function createAggregator(
  events: FeedbackEvent[],
  options?: AggregationOptions,
): FeedbackAggregator {
  return new FeedbackAggregator(events, options);
}
