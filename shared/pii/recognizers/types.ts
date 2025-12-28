/**
 * Recognizer Type Definitions
 *
 * Core interfaces for the country-specific recognizer architecture.
 * Following Microsoft Presidio patterns for extensible PII detection.
 *
 * @module shared/pii/recognizers/types
 */

/**
 * Pattern definition for recognizers.
 * Each pattern maps a regex to an entity type with a base confidence score.
 */
export interface PatternDefinition {
  /** Regex pattern to match - should be without flags (flags added at runtime) */
  regex: RegExp;

  /** Base confidence score (0.3-0.7 per Presidio guidelines, never 1.0) */
  score: number;

  /** Entity type this pattern detects (e.g., 'SWISS_AVS', 'IBAN', 'PHONE') */
  entityType: string;

  /** Optional name for debugging and logging */
  name?: string;

  /**
   * Mark as weak pattern - applies lowConfidenceMultiplier.
   * Use for patterns that are prone to false positives without context
   * (e.g., 5-digit zip codes, 4-digit numbers)
   */
  isWeakPattern?: boolean;
}

/**
 * Specificity level for priority tiebreaking.
 * When two recognizers have the same priority, specificity determines order.
 */
export type RecognizerSpecificity = 'country' | 'region' | 'global';

/**
 * Recognizer configuration.
 * Defines a complete recognizer with its patterns, context, and behavior.
 */
export interface RecognizerConfig {
  /** Unique recognizer name (e.g., 'SwissAVS', 'USPhoneNumber') */
  name: string;

  /** Supported language codes (e.g., ['en', 'fr', 'de']) */
  supportedLanguages: string[];

  /** Supported country/region codes (e.g., ['CH'], ['EU'], ['US']) */
  supportedCountries: string[];

  /** Detection patterns with their base scores */
  patterns: PatternDefinition[];

  /** Priority for conflict resolution (higher = processed first, default: 50) */
  priority: number;

  /**
   * Specificity level for priority tiebreaking.
   * Order: country > region > global
   */
  specificity: RecognizerSpecificity;

  /** Context words for confidence boost (recognizer-specific) */
  contextWords: string[];

  /** Deny patterns for false positive filtering (recognizer-specific) */
  denyPatterns: (string | RegExp)[];

  /** Optional validation function (e.g., checksum validation) */
  validator?: (match: string) => boolean;

  /** Whether to also check global ContextWords (default: true) */
  useGlobalContext: boolean;

  /** Whether to also check global DenyList (default: true) */
  useGlobalDenyList: boolean;
}

/**
 * Detection result from a recognizer.
 * Represents a single PII match with its metadata.
 */
export interface RecognizerMatch {
  /** The matched text */
  text: string;

  /** Entity type (e.g., 'SWISS_AVS', 'PHONE', 'EMAIL') */
  type: string;

  /** Start position in the source text (0-indexed) */
  start: number;

  /** End position in the source text (exclusive) */
  end: number;

  /** Confidence score (0.0 - 1.0) */
  confidence: number;

  /** Detection source ('RULE' for regex-based recognizers) */
  source: 'RULE' | 'ML' | 'HYBRID';

  /** Name of the recognizer that produced this match */
  recognizer: string;

  /** Pattern name that matched (for debugging) */
  patternName?: string;

  /** Whether validation passed (if validator was present) */
  validationPassed?: boolean;
}

/**
 * Global configuration for the recognizer registry.
 * Controls system-wide behavior and enabled recognizers.
 */
export interface RegistryGlobalConfig {
  /**
   * Multiplier for weak patterns (Presidio default: 0.4).
   * Applied to patterns marked with isWeakPattern: true
   */
  lowConfidenceMultiplier: number;

  /**
   * Entity types that are always treated as weak.
   * Their base scores are multiplied by lowConfidenceMultiplier.
   */
  lowScoreEntityNames: string[];

  /** Countries to enable (if empty, all registered countries are enabled) */
  enabledCountries: string[];

  /** Languages to enable (if empty, all registered languages are enabled) */
  enabledLanguages: string[];

  /** Specific recognizers to enable (if empty, all registered recognizers are enabled) */
  enabledRecognizers: string[];
}

/**
 * Contract interface for all recognizers (interface-first design).
 * Recognizers can implement this interface directly or extend BaseRecognizer.
 */
export interface Recognizer {
  /** Recognizer configuration */
  readonly config: RecognizerConfig;

  /**
   * Analyze text and return matches.
   * @param text - Text to analyze
   * @param language - Optional language hint for filtering
   * @returns Array of matches found
   */
  analyze(text: string, language?: string): RecognizerMatch[];

  /**
   * Check if recognizer supports a specific language.
   * @param lang - Language code to check
   */
  supportsLanguage(lang: string): boolean;

  /**
   * Check if recognizer supports a specific country/region.
   * @param country - Country code to check
   */
  supportsCountry(country: string): boolean;
}

/**
 * Registry filter options for querying recognizers.
 */
export interface RecognizerFilter {
  /** Filter by country code */
  country?: string;

  /** Filter by language code */
  language?: string;

  /** Filter by entity type */
  entityType?: string;
}

/**
 * Result from registry analysis with all recognizer matches.
 */
export interface RegistryAnalysisResult {
  /** All matches from all recognizers */
  matches: RecognizerMatch[];

  /** Names of recognizers that were used */
  recognizersUsed: string[];

  /** Names of recognizers that failed (with error messages) */
  recognizerErrors: Array<{ name: string; error: string }>;

  /** Total analysis time in milliseconds */
  analysisTimeMs: number;
}

/**
 * Default values for RecognizerConfig fields.
 */
export const DEFAULT_RECOGNIZER_CONFIG: Partial<RecognizerConfig> = {
  priority: 50,
  specificity: 'country',
  contextWords: [],
  denyPatterns: [],
  useGlobalContext: true,
  useGlobalDenyList: true,
};

/**
 * Default values for RegistryGlobalConfig.
 */
export const DEFAULT_REGISTRY_CONFIG: RegistryGlobalConfig = {
  lowConfidenceMultiplier: 0.4,
  lowScoreEntityNames: [],
  enabledCountries: [],
  enabledLanguages: [],
  enabledRecognizers: [],
};
