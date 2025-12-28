/**
 * Subword Token Merger for ML Detection (Story 8.10)
 *
 * Merges consecutive ML model tokens (B-XXX, I-XXX) into complete entities.
 * HuggingFace NER models use BIO tagging:
 * - B-XXX: Beginning of entity
 * - I-XXX: Inside/continuation of entity
 * - O: Outside (not an entity)
 *
 * Example: ["B-PER", "I-PER"] for "Hans Müller" → single PERSON_NAME entity
 *
 * @module shared/pii/ml/SubwordTokenMerger
 */

/**
 * ML model token prediction (BIO tagging scheme)
 */
export interface MLToken {
  /** Token text (may be subword) */
  word: string;
  /** Entity label: B-PER, I-PER, B-LOC, I-LOC, B-ORG, I-ORG, B-MISC, I-MISC, O */
  entity: string;
  /** Confidence score (0-1) */
  score: number;
  /** Start position in original text */
  start: number;
  /** End position in original text */
  end: number;
}

/**
 * Alternative token format (HuggingFace transformers.js format)
 * Some models return entity_group instead of entity
 */
export interface MLTokenAlt {
  word: string;
  entity_group: string;
  score: number;
  start: number;
  end: number;
}

/**
 * Merged entity result
 */
export interface MergedEntity {
  /** Full merged text from original document */
  word: string;
  /** Entity type without B-/I- prefix (PER, LOC, ORG, MISC) */
  entity: string;
  /** Averaged confidence score */
  score: number;
  /** Start position in original text */
  start: number;
  /** End position in original text */
  end: number;
  /** Number of tokens merged */
  tokenCount: number;
}

/**
 * Configuration for token merging
 */
export interface MergeConfig {
  /** Minimum entity length to keep (default: 2) */
  minLength: number;
  /** Maximum gap between tokens to merge (default: 5 characters) */
  maxGap: number;
  /** Whether to use weighted average for confidence (default: false = simple average) */
  weightedConfidence: boolean;
}

/**
 * Default merge configuration
 */
export const DEFAULT_MERGE_CONFIG: MergeConfig = {
  minLength: 2,
  maxGap: 5,
  weightedConfidence: false,
};

/**
 * Extract entity type from BIO label
 * "B-PER" → "PER", "I-LOC" → "LOC", "PER" → "PER"
 */
export function extractEntityType(label: string): string {
  return label.replace(/^[BI]-/, '');
}

/**
 * Check if label is an inside token (I-XXX)
 */
export function isInsideToken(label: string): boolean {
  return label.startsWith('I-');
}

/**
 * Check if label is a beginning token (B-XXX)
 */
export function isBeginningToken(label: string): boolean {
  return label.startsWith('B-');
}

/**
 * Normalize token to standard MLToken format
 * Handles both standard and alternative formats
 */
export function normalizeToken(token: MLToken | MLTokenAlt): MLToken {
  if ('entity_group' in token) {
    return {
      word: token.word,
      entity: token.entity_group,
      score: token.score,
      start: token.start,
      end: token.end,
    };
  }
  return token;
}

/**
 * Merge consecutive subword tokens into complete entities
 *
 * @param tokens - Raw ML model predictions (BIO-tagged)
 * @param originalText - Original document text (for accurate span extraction)
 * @param config - Merge configuration
 * @returns Merged entities with full text and averaged confidence
 */
export function mergeSubwordTokens(
  tokens: (MLToken | MLTokenAlt)[],
  originalText: string,
  config: Partial<MergeConfig> = {},
): MergedEntity[] {
  const mergeConfig: MergeConfig = { ...DEFAULT_MERGE_CONFIG, ...config };

  if (tokens.length === 0) {
    return [];
  }

  // Normalize all tokens to standard format
  const normalizedTokens = tokens.map(normalizeToken);

  // Filter out non-entity tokens (O label)
  const entityTokens = normalizedTokens.filter(
    (t) => t.entity !== 'O' && t.entity !== '',
  );

  if (entityTokens.length === 0) {
    return [];
  }

  // Sort by position
  const sorted = [...entityTokens].sort((a, b) => a.start - b.start);

  const merged: MergedEntity[] = [];
  let current: {
    entity: string;
    start: number;
    end: number;
    scores: number[];
    tokenCount: number;
  } | null = null;

  // Helper to finalize current entity
  const finalizeCurrent = (): void => {
    if (current) {
      // Calculate confidence
      let avgScore: number;
      if (mergeConfig.weightedConfidence && current.scores.length > 1) {
        // Weighted by position (later tokens slightly less weight)
        let weightSum = 0;
        let scoreSum = 0;
        current.scores.forEach((score, idx) => {
          const weight = 1 / (idx + 1);
          scoreSum += score * weight;
          weightSum += weight;
        });
        avgScore = scoreSum / weightSum;
      } else {
        // Simple average
        avgScore =
          current.scores.reduce((a, b) => a + b, 0) / current.scores.length;
      }

      // Extract text from original document
      const word = originalText.substring(current.start, current.end);

      merged.push({
        word,
        entity: current.entity,
        score: avgScore,
        start: current.start,
        end: current.end,
        tokenCount: current.tokenCount,
      });
    }
  };

  for (const token of sorted) {
    const entityType = extractEntityType(token.entity);
    const isInside = isInsideToken(token.entity);

    // Check if this token should be merged with current
    const shouldMerge =
      current !== null &&
      isInside &&
      current.entity === entityType &&
      token.start - current.end <= mergeConfig.maxGap;

    if (shouldMerge && current) {
      // Extend current entity
      current.end = token.end;
      current.scores.push(token.score);
      current.tokenCount++;
    } else {
      // Finalize previous entity (if any) and start new one
      finalizeCurrent();
      current = {
        entity: entityType,
        start: token.start,
        end: token.end,
        scores: [token.score],
        tokenCount: 1,
      };
    }
  }

  // Don't forget the last entity
  finalizeCurrent();

  // Filter by minimum length
  return merged.filter((e) => e.word.length >= mergeConfig.minLength);
}

/**
 * Convenience function with default config
 */
export function mergeTokens(
  tokens: (MLToken | MLTokenAlt)[],
  originalText: string,
  minLength: number = 2,
): MergedEntity[] {
  return mergeSubwordTokens(tokens, originalText, { minLength });
}

/**
 * Create a token merger with pre-configured settings
 */
export class SubwordTokenMerger {
  private config: MergeConfig;

  constructor(config: Partial<MergeConfig> = {}) {
    this.config = { ...DEFAULT_MERGE_CONFIG, ...config };
  }

  /**
   * Merge tokens using configured settings
   */
  merge(tokens: (MLToken | MLTokenAlt)[], originalText: string): MergedEntity[] {
    return mergeSubwordTokens(tokens, originalText, this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): MergeConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  configure(config: Partial<MergeConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a configured SubwordTokenMerger instance
 */
export function createSubwordTokenMerger(
  config?: Partial<MergeConfig>,
): SubwordTokenMerger {
  return new SubwordTokenMerger(config);
}
