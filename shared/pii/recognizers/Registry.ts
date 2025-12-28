/**
 * Recognizer Registry
 *
 * Central registry for all PII recognizers. Manages registration,
 * lookup, and analysis orchestration across multiple recognizers.
 *
 * Features:
 * - Priority-based sorting with specificity tiebreaker
 * - Error isolation (one failing recognizer doesn't break others)
 * - Browser compatibility (explicit initialization check)
 * - Filtering by country, language, entity type
 * - lowConfidenceMultiplier support for weak patterns
 *
 * @module shared/pii/recognizers/Registry
 */

import {
  Recognizer,
  RecognizerMatch,
  RecognizerFilter,
  RegistryAnalysisResult,
  RegistryGlobalConfig,
  DEFAULT_REGISTRY_CONFIG,
  RecognizerSpecificity,
} from './types.js';

/**
 * Specificity order for priority tiebreaking.
 * Country-specific recognizers are preferred over regional, then global.
 */
const SPECIFICITY_ORDER: Record<RecognizerSpecificity, number> = {
  country: 3,
  region: 2,
  global: 1,
};

/**
 * Internal registry state.
 */
let registry: Map<string, Recognizer> = new Map();
let globalConfig: RegistryGlobalConfig = { ...DEFAULT_REGISTRY_CONFIG };
let initialized = false;

/**
 * RecognizerRegistry - Static class for managing PII recognizers.
 *
 * @example
 * ```typescript
 * // Register recognizers
 * RecognizerRegistry.register(new AvsRecognizer());
 * RecognizerRegistry.register(new IbanRecognizer());
 *
 * // Analyze text
 * const results = RecognizerRegistry.analyze(text, { country: 'CH' });
 *
 * // Get specific recognizers
 * const swissRecognizers = RecognizerRegistry.getByCountry('CH');
 * ```
 */
export class RecognizerRegistry {
  /**
   * Register a recognizer in the registry.
   *
   * @param recognizer - Recognizer to register
   * @throws Error if a recognizer with the same name is already registered
   */
  static register(recognizer: Recognizer): void {
    const name = recognizer.config.name;
    if (registry.has(name)) {
      throw new Error(
        `Recognizer "${name}" is already registered. Use a unique name.`
      );
    }
    registry.set(name, recognizer);
    initialized = true;
  }

  /**
   * Unregister a recognizer by name.
   *
   * @param name - Name of the recognizer to unregister
   * @returns true if recognizer was found and removed
   */
  static unregister(name: string): boolean {
    return registry.delete(name);
  }

  /**
   * Get a recognizer by name.
   *
   * @param name - Recognizer name
   * @returns Recognizer or undefined if not found
   */
  static get(name: string): Recognizer | undefined {
    return registry.get(name);
  }

  /**
   * Get all registered recognizers.
   *
   * @returns Array of all recognizers, sorted by priority
   */
  static getAll(): Recognizer[] {
    return this.sortByPriority(Array.from(registry.values()));
  }

  /**
   * Get recognizers that support a specific country.
   *
   * @param country - Country code (e.g., 'CH', 'US')
   * @returns Array of matching recognizers, sorted by priority
   */
  static getByCountry(country: string): Recognizer[] {
    this.ensureInitialized();
    const matching = Array.from(registry.values()).filter((r) =>
      r.supportsCountry(country)
    );
    return this.sortByPriority(matching);
  }

  /**
   * Get recognizers that support a specific language.
   *
   * @param language - Language code (e.g., 'en', 'fr', 'de')
   * @returns Array of matching recognizers, sorted by priority
   */
  static getByLanguage(language: string): Recognizer[] {
    this.ensureInitialized();
    const matching = Array.from(registry.values()).filter((r) =>
      r.supportsLanguage(language)
    );
    return this.sortByPriority(matching);
  }

  /**
   * Get recognizers that detect a specific entity type.
   *
   * @param entityType - Entity type (e.g., 'SWISS_AVS', 'IBAN')
   * @returns Array of matching recognizers, sorted by priority
   */
  static getByEntityType(entityType: string): Recognizer[] {
    this.ensureInitialized();
    const matching = Array.from(registry.values()).filter((r) =>
      r.config.patterns.some((p) => p.entityType === entityType)
    );
    return this.sortByPriority(matching);
  }

  /**
   * Get recognizers matching filter criteria.
   *
   * @param filter - Filter options
   * @returns Array of matching recognizers, sorted by priority
   */
  static getFiltered(filter: RecognizerFilter): Recognizer[] {
    this.ensureInitialized();

    let recognizers = Array.from(registry.values());

    if (filter.country) {
      recognizers = recognizers.filter((r) =>
        r.supportsCountry(filter.country!)
      );
    }

    if (filter.language) {
      recognizers = recognizers.filter((r) =>
        r.supportsLanguage(filter.language!)
      );
    }

    if (filter.entityType) {
      recognizers = recognizers.filter((r) =>
        r.config.patterns.some((p) => p.entityType === filter.entityType)
      );
    }

    // Apply global config filters
    if (globalConfig.enabledCountries.length > 0) {
      recognizers = recognizers.filter((r) =>
        r.config.supportedCountries.some((c) =>
          globalConfig.enabledCountries.includes(c)
        )
      );
    }

    if (globalConfig.enabledLanguages.length > 0) {
      recognizers = recognizers.filter((r) =>
        r.config.supportedLanguages.some((l) =>
          globalConfig.enabledLanguages.includes(l)
        )
      );
    }

    if (globalConfig.enabledRecognizers.length > 0) {
      recognizers = recognizers.filter((r) =>
        globalConfig.enabledRecognizers.includes(r.config.name)
      );
    }

    return this.sortByPriority(recognizers);
  }

  /**
   * Analyze text using filtered recognizers with error isolation.
   *
   * One failing recognizer will not break the entire analysis.
   * Errors are captured and reported in the result.
   *
   * @param text - Text to analyze
   * @param filter - Optional filter for recognizer selection
   * @returns Analysis result with matches and error information
   */
  static analyze(
    text: string,
    filter: RecognizerFilter = {}
  ): RegistryAnalysisResult {
    const startTime = performance.now();
    const matches: RecognizerMatch[] = [];
    const recognizersUsed: string[] = [];
    const recognizerErrors: Array<{ name: string; error: string }> = [];

    const recognizers = this.getFiltered(filter);

    for (const recognizer of recognizers) {
      try {
        const recognizerMatches = recognizer.analyze(text, filter.language);

        // Apply lowConfidenceMultiplier if needed
        const adjustedMatches = recognizerMatches.map((match) =>
          this.applyConfidenceAdjustments(match, recognizer)
        );

        matches.push(...adjustedMatches);
        recognizersUsed.push(recognizer.config.name);
      } catch (error) {
        // Error isolation: log error but continue with other recognizers
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        recognizerErrors.push({
          name: recognizer.config.name,
          error: errorMessage,
        });
        // eslint-disable-next-line no-console -- Shared module: use console for environment-agnostic error logging
        console.error(`[pii:recognizers] Recognizer failed`, {
          recognizer: recognizer.config.name,
          error: errorMessage,
        });
      }
    }

    const analysisTimeMs = performance.now() - startTime;

    return {
      matches,
      recognizersUsed,
      recognizerErrors,
      analysisTimeMs,
    };
  }

  /**
   * Apply confidence adjustments based on global config.
   * Reduces confidence for weak patterns and low-score entity types.
   */
  private static applyConfidenceAdjustments(
    match: RecognizerMatch,
    recognizer: Recognizer
  ): RecognizerMatch {
    let confidence = match.confidence;

    // Find the pattern that produced this match
    const pattern = recognizer.config.patterns.find(
      (p) => p.name === match.patternName || p.entityType === match.type
    );

    // Apply lowConfidenceMultiplier for weak patterns
    if (pattern?.isWeakPattern) {
      confidence *= globalConfig.lowConfidenceMultiplier;
    }

    // Apply lowConfidenceMultiplier for low-score entity types
    if (globalConfig.lowScoreEntityNames.includes(match.type)) {
      confidence *= globalConfig.lowConfidenceMultiplier;
    }

    // Clamp confidence to [0, 1]
    confidence = Math.max(0, Math.min(1, confidence));

    return {
      ...match,
      confidence,
    };
  }

  /**
   * Sort recognizers by priority (descending) with specificity as tiebreaker.
   */
  private static sortByPriority(recognizers: Recognizer[]): Recognizer[] {
    return recognizers.sort((a, b) => {
      // Primary sort: priority (higher first)
      const priorityDiff = b.config.priority - a.config.priority;
      if (priorityDiff !== 0) return priorityDiff;

      // Secondary sort: specificity (country > region > global)
      const specA = SPECIFICITY_ORDER[a.config.specificity] || 1;
      const specB = SPECIFICITY_ORDER[b.config.specificity] || 1;
      const specDiff = specB - specA;
      if (specDiff !== 0) return specDiff;

      // Tertiary sort: name (alphabetical for stability)
      return a.config.name.localeCompare(b.config.name);
    });
  }

  /**
   * Ensure the registry is initialized (has at least one recognizer).
   * Throws an error if no recognizers are registered.
   * This catches missing registration in browser environments.
   */
  private static ensureInitialized(): void {
    if (!initialized || registry.size === 0) {
      throw new Error(
        'RecognizerRegistry is not initialized. ' +
          'Call RecognizerRegistry.register() to add recognizers before using the registry. ' +
          'In browser environments, ensure recognizers are explicitly registered in your entry point.'
      );
    }
  }

  /**
   * Check if the registry is empty.
   *
   * @returns true if no recognizers are registered
   */
  static isEmpty(): boolean {
    return registry.size === 0;
  }

  /**
   * Get the number of registered recognizers.
   *
   * @returns Number of registered recognizers
   */
  static size(): number {
    return registry.size;
  }

  /**
   * Get the current global configuration.
   *
   * @returns Copy of the global configuration
   */
  static getConfig(): RegistryGlobalConfig {
    return { ...globalConfig };
  }

  /**
   * Update the global configuration.
   * Merges with existing configuration.
   *
   * @param config - Partial configuration to merge
   */
  static configure(config: Partial<RegistryGlobalConfig>): void {
    globalConfig = { ...globalConfig, ...config };
  }

  /**
   * Reset the global configuration to defaults.
   */
  static resetConfig(): void {
    globalConfig = { ...DEFAULT_REGISTRY_CONFIG };
  }

  /**
   * Clear all registered recognizers.
   * Useful for testing.
   */
  static clear(): void {
    registry.clear();
    initialized = false;
  }

  /**
   * Reset the registry to initial state.
   * Clears all recognizers and resets configuration.
   */
  static reset(): void {
    this.clear();
    this.resetConfig();
  }

  /**
   * Get names of all registered recognizers.
   *
   * @returns Array of recognizer names
   */
  static getRegisteredNames(): string[] {
    return Array.from(registry.keys());
  }
}
