/**
 * Context Enhancement System for PII Detection
 *
 * Boosts entity confidence when relevant context words appear nearby.
 * For example: "Jean Dupont" preceded by "Nom:" gets higher confidence
 * than standalone "Jean".
 *
 * Based on Microsoft Presidio patterns with direction-aware context search.
 * Story 8.7: Supports optional lemmatization for better context word matching.
 *
 * @module shared/pii/context/ContextEnhancer
 */

import { type ContextWord } from './ContextWords.js';
import { DenyList } from './DenyList.js';
import {
  type Lemmatizer,
  type LemmatizerLanguage,
  SimpleLemmatizer,
} from '../preprocessing/index.js';

/**
 * Configuration for context enhancement
 * Based on Microsoft Presidio patterns
 */
export interface ContextEnhancerConfig {
  /** Characters to check before/after entity (default: 100) */
  windowSize: number;
  /** Confidence boost when context found (Presidio: 0.35) */
  similarityFactor: number;
  /** Minimum confidence when context present (Presidio: 0.4) */
  minScoreWithContext: number;
  /** Weight for preceding context (default: 1.2 - labels before values) */
  precedingWeight: number;
  /** Weight for following context (default: 0.8) */
  followingWeight: number;
  /** Per-entity-type overrides */
  perEntityType?: Record<string, Partial<ContextEnhancerConfig>>;
  /**
   * Enable lemmatization for context word matching (Story 8.7)
   * When enabled, context words are matched against lemmatized forms
   * e.g., "addresses" matches "address", "téléphones" matches "téléphone"
   * Default: true
   */
  enableLemmatization?: boolean;
  /** Default language for lemmatization (default: 'en') */
  lemmatizationLanguage?: LemmatizerLanguage;
}

/**
 * Entity with position information for context analysis
 */
export interface PositionedEntity {
  /** The entity text */
  text: string;
  /** Entity type (e.g., 'PERSON_NAME', 'EMAIL') */
  type: string;
  /** Start position in document */
  start: number;
  /** End position in document */
  end: number;
  /** Base confidence score (0.0-1.0) */
  confidence: number;
  /** Optional source identifier */
  source?: string;
}

/**
 * Detailed result of context enhancement
 */
export interface EnhancementResult {
  /** Enhanced entity with adjusted confidence */
  entity: PositionedEntity;
  /** Context words that were found */
  contextFound: string[];
  /** Total boost applied (can be negative) */
  boostApplied: number;
  /** Original confidence before enhancement */
  originalConfidence: number;
  /** Whether enhancement was skipped (e.g., DenyList) */
  skipped: boolean;
  /** Reason for skipping (if applicable) */
  skipReason?: string;
}

/**
 * Default configuration based on Presidio defaults
 */
const DEFAULT_CONFIG: ContextEnhancerConfig = {
  windowSize: 100,
  similarityFactor: 0.35,
  minScoreWithContext: 0.4,
  precedingWeight: 1.2,
  followingWeight: 0.8,
  perEntityType: {
    PERSON_NAME: { windowSize: 150 },
    IBAN: { windowSize: 40 },
    EMAIL: { windowSize: 50 },
    PHONE_NUMBER: { windowSize: 60 },
    SWISS_AVS: { windowSize: 60 },
  },
  // Story 8.7: Enable lemmatization by default
  enableLemmatization: true,
  lemmatizationLanguage: 'en',
};

/**
 * Context Enhancer for confidence boosting based on nearby context words
 *
 * Implements Presidio-inspired context analysis:
 * - Direction-aware search (preceding context weighted higher)
 * - Positive and negative context word support
 * - Per-entity-type configuration overrides
 * - DenyList safety guard (never enhance denied entities)
 * - Story 8.7: Optional lemmatization for improved context word matching
 */
export class ContextEnhancer {
  private config: ContextEnhancerConfig;
  private lemmatizer: Lemmatizer | null = null;

  /**
   * Create a new ContextEnhancer with optional configuration
   *
   * @param config - Partial configuration (defaults merged)
   */
  constructor(config?: Partial<ContextEnhancerConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      perEntityType: {
        ...DEFAULT_CONFIG.perEntityType,
        ...config?.perEntityType,
      },
    };

    // Story 8.7: Initialize lemmatizer if enabled
    if (this.config.enableLemmatization !== false) {
      this.lemmatizer = new SimpleLemmatizer(
        this.config.lemmatizationLanguage || 'en',
      );
    }
  }

  /**
   * Get effective configuration for a specific entity type
   * Merges base config with per-entity-type overrides
   */
  private getEffectiveConfig(entityType: string): ContextEnhancerConfig {
    const override = this.config.perEntityType?.[entityType];
    if (!override) {
      return this.config;
    }
    return {
      ...this.config,
      ...override,
      perEntityType: this.config.perEntityType,
    };
  }

  /**
   * Enhance entity confidence based on context
   *
   * @param entity - Entity with position and base confidence
   * @param fullText - Full document text
   * @param contextWords - Words that can boost or reduce confidence
   * @returns Entity with adjusted confidence score
   */
  enhance(
    entity: PositionedEntity,
    fullText: string,
    contextWords: ContextWord[],
  ): PositionedEntity {
    const result = this.enhanceWithDetails(entity, fullText, contextWords);
    return result.entity;
  }

  /**
   * Enhance entity confidence with detailed result information
   *
   * @param entity - Entity with position and base confidence
   * @param fullText - Full document text
   * @param contextWords - Words that can boost or reduce confidence
   * @returns Detailed enhancement result
   */
  enhanceWithDetails(
    entity: PositionedEntity,
    fullText: string,
    contextWords: ContextWord[],
  ): EnhancementResult {
    const originalConfidence = entity.confidence;

    // Safety guard: Check DenyList before enhancement
    if (DenyList.isDenied(entity.text, entity.type)) {
      return {
        entity: { ...entity },
        contextFound: [],
        boostApplied: 0,
        originalConfidence,
        skipped: true,
        skipReason: 'Entity denied by DenyList',
      };
    }

    // Early return for empty context words
    if (!contextWords || contextWords.length === 0) {
      return {
        entity: { ...entity },
        contextFound: [],
        boostApplied: 0,
        originalConfidence,
        skipped: false,
      };
    }

    // Get effective config for this entity type
    const effectiveConfig = this.getEffectiveConfig(entity.type);
    const windowSize = effectiveConfig.windowSize;

    // Extract context windows
    const precedingStart = Math.max(0, entity.start - windowSize);
    const followingEnd = Math.min(fullText.length, entity.end + windowSize);

    const precedingText = fullText
      .slice(precedingStart, entity.start)
      .toLowerCase();
    const followingText = fullText
      .slice(entity.end, followingEnd)
      .toLowerCase();

    // Story 8.7: Pre-lemmatize context text words for matching
    // Split text into words and lemmatize them for comparison
    const language = this.config.lemmatizationLanguage || 'en';
    const precedingLemmas = this.lemmatizer
      ? this.extractLemmas(precedingText, language)
      : new Set<string>();
    const followingLemmas = this.lemmatizer
      ? this.extractLemmas(followingText, language)
      : new Set<string>();

    // Search for context words with direction awareness
    const foundWords: string[] = [];
    let totalPositiveBoost = 0;
    let totalNegativeBoost = 0;

    for (const contextWord of contextWords) {
      const wordLower = contextWord.word.toLowerCase();
      const weight = contextWord.weight;
      const isPositive = contextWord.polarity === 'positive';

      // Story 8.7: Also get lemma of the context word for matching
      const wordLemma = this.lemmatizer
        ? this.lemmatizer.lemmatize(wordLower, language)
        : wordLower;

      // Check preceding context (weighted higher by default)
      // Match either exact word or lemmatized form
      const foundInPreceding =
        precedingText.includes(wordLower) ||
        (this.lemmatizer && precedingLemmas.has(wordLemma));
      // Check following context
      const foundInFollowing =
        followingText.includes(wordLower) ||
        (this.lemmatizer && followingLemmas.has(wordLemma));

      if (foundInPreceding || foundInFollowing) {
        foundWords.push(contextWord.word);

        // Calculate direction-weighted contribution
        let contribution = 0;
        if (foundInPreceding) {
          contribution += weight * effectiveConfig.precedingWeight;
        }
        if (foundInFollowing) {
          contribution += weight * effectiveConfig.followingWeight;
        }

        // Cap contribution per word to avoid double-counting
        contribution = Math.min(contribution, weight * 2);

        if (isPositive) {
          totalPositiveBoost += contribution;
        } else {
          totalNegativeBoost += contribution;
        }
      }
    }

    // Calculate net boost
    // Normalize boosts by direction weights to get a reasonable factor
    const maxDirectionWeight = Math.max(
      effectiveConfig.precedingWeight,
      effectiveConfig.followingWeight,
    );
    const normalizedPositive =
      totalPositiveBoost > 0
        ? (totalPositiveBoost / maxDirectionWeight) *
          effectiveConfig.similarityFactor
        : 0;
    const normalizedNegative =
      totalNegativeBoost > 0
        ? (totalNegativeBoost / maxDirectionWeight) *
          effectiveConfig.similarityFactor
        : 0;

    // Cap each side at similarityFactor
    const cappedPositive = Math.min(
      normalizedPositive,
      effectiveConfig.similarityFactor,
    );
    const cappedNegative = Math.min(
      normalizedNegative,
      effectiveConfig.similarityFactor,
    );

    const netBoost = cappedPositive - cappedNegative;

    // Calculate new confidence
    let newConfidence = entity.confidence + netBoost;

    // Apply minimum score with context (only if positive context was found)
    if (cappedPositive > 0 && netBoost > 0) {
      newConfidence = Math.max(
        newConfidence,
        effectiveConfig.minScoreWithContext,
      );
    }

    // Cap at 1.0 and floor at 0.0
    newConfidence = Math.max(0, Math.min(1.0, newConfidence));

    return {
      entity: {
        ...entity,
        confidence: newConfidence,
      },
      contextFound: foundWords,
      boostApplied: newConfidence - originalConfidence,
      originalConfidence,
      skipped: false,
    };
  }

  /**
   * Enhance multiple entities in a document
   *
   * @param entities - Array of entities to enhance
   * @param fullText - Full document text
   * @param contextWords - Context words to search for
   * @returns Array of enhanced entities
   */
  enhanceAll(
    entities: PositionedEntity[],
    fullText: string,
    contextWords: ContextWord[],
  ): PositionedEntity[] {
    return entities.map((entity) =>
      this.enhance(entity, fullText, contextWords),
    );
  }

  /**
   * Enhance multiple entities with detailed results
   *
   * @param entities - Array of entities to enhance
   * @param fullText - Full document text
   * @param contextWords - Context words to search for
   * @returns Array of detailed enhancement results
   */
  enhanceAllWithDetails(
    entities: PositionedEntity[],
    fullText: string,
    contextWords: ContextWord[],
  ): EnhancementResult[] {
    return entities.map((entity) =>
      this.enhanceWithDetails(entity, fullText, contextWords),
    );
  }

  /**
   * Get the current configuration
   */
  getConfig(): ContextEnhancerConfig {
    return { ...this.config };
  }

  /**
   * Get effective window size for an entity type
   */
  getWindowSize(entityType: string): number {
    return this.getEffectiveConfig(entityType).windowSize;
  }

  /**
   * Story 8.7: Extract lemmatized word set from text
   * Used for efficient lemma-based context word matching
   *
   * @param text - Lowercased text to extract lemmas from
   * @param language - Language code for lemmatization
   * @returns Set of lemmatized words
   */
  private extractLemmas(text: string, language: string): Set<string> {
    if (!this.lemmatizer) {
      return new Set<string>();
    }

    // Split text into words (basic word boundary detection)
    const words = text.match(/\b\w+\b/g) || [];
    const lemmas = new Set<string>();

    for (const word of words) {
      const lemma = this.lemmatizer.lemmatize(word, language);
      lemmas.add(lemma);
    }

    return lemmas;
  }

  /**
   * Story 8.7: Set the language for lemmatization
   * Useful when processing documents in different languages
   */
  setLemmatizationLanguage(language: LemmatizerLanguage): void {
    this.config.lemmatizationLanguage = language;
    if (this.config.enableLemmatization !== false) {
      this.lemmatizer = new SimpleLemmatizer(language);
    }
  }
}

/**
 * Create a ContextEnhancer with default configuration
 */
export function createContextEnhancer(
  config?: Partial<ContextEnhancerConfig>,
): ContextEnhancer {
  return new ContextEnhancer(config);
}

/**
 * Default configuration export for reference
 */
export const DEFAULT_CONTEXT_ENHANCER_CONFIG: Readonly<ContextEnhancerConfig> =
  Object.freeze({ ...DEFAULT_CONFIG });
