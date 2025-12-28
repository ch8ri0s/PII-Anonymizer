/**
 * BaseRecognizer - Abstract Base Class for PII Recognizers
 *
 * Provides default implementations for common recognizer functionality.
 * Extending this class is optional - recognizers can implement the
 * Recognizer interface directly for simpler cases.
 *
 * Features:
 * - Pattern compilation (once in constructor, not per-call)
 * - Language/country filtering
 * - DenyList integration (both recognizer-specific and global)
 * - Validation function support (e.g., checksum validation)
 *
 * @module shared/pii/recognizers/BaseRecognizer
 */

import {
  Recognizer,
  RecognizerConfig,
  RecognizerMatch,
  PatternDefinition,
  DEFAULT_RECOGNIZER_CONFIG,
} from './types.js';
import { DenyList } from '../context/DenyList.js';

/**
 * Compiled pattern with pre-built RegExp for performance.
 * Patterns are compiled once in constructor to avoid repeated compilation.
 */
interface CompiledPattern extends PatternDefinition {
  /** Pre-compiled regex with 'gi' flags for global, case-insensitive matching */
  compiled: RegExp;
}

/**
 * Abstract base class for PII recognizers.
 *
 * Provides default implementations for:
 * - Pattern matching with compiled regexes
 * - Language/country support checks
 * - DenyList integration
 * - Validation function invocation
 *
 * Subclasses must provide:
 * - config property with recognizer configuration
 *
 * @example
 * ```typescript
 * class AvsRecognizer extends BaseRecognizer {
 *   readonly config: RecognizerConfig = {
 *     name: 'SwissAVS',
 *     supportedLanguages: ['de', 'fr', 'it', 'en'],
 *     supportedCountries: ['CH'],
 *     patterns: [...],
 *     priority: 70,
 *     specificity: 'country',
 *     contextWords: ['avs', 'ahv'],
 *     denyPatterns: [],
 *     useGlobalContext: true,
 *     useGlobalDenyList: true,
 *     validator: (match) => this.validateChecksum(match),
 *   };
 * }
 * ```
 */
export abstract class BaseRecognizer implements Recognizer {
  /**
   * Recognizer configuration. Must be provided by subclasses.
   */
  abstract readonly config: RecognizerConfig;

  /**
   * Pre-compiled patterns for performance.
   * Populated lazily on first analyze() call.
   */
  private _compiledPatterns: CompiledPattern[] | null = null;

  /**
   * Get compiled patterns, compiling them on first access.
   * This lazy initialization allows subclasses to define config
   * in their constructor or as a property.
   */
  protected get compiledPatterns(): CompiledPattern[] {
    if (this._compiledPatterns === null) {
      this._compiledPatterns = this.config.patterns.map((pattern) => ({
        ...pattern,
        compiled: new RegExp(pattern.regex.source, 'gi'),
      }));
    }
    return this._compiledPatterns;
  }

  /**
   * Analyze text and return all matches.
   *
   * @param text - Text to analyze
   * @param language - Optional language hint (skips analysis if not supported)
   * @returns Array of matches found
   */
  analyze(text: string, language?: string): RecognizerMatch[] {
    // Skip if language is specified but not supported
    if (language && !this.supportsLanguage(language)) {
      return [];
    }

    const matches: RecognizerMatch[] = [];

    for (const pattern of this.compiledPatterns) {
      // Reset regex lastIndex for fresh search
      pattern.compiled.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = pattern.compiled.exec(text)) !== null) {
        const matchText = match[0];

        // Skip if in deny list
        if (this.isDenied(matchText, pattern.entityType, language)) {
          continue;
        }

        // Skip if validation fails (when validator is present)
        if (this.config.validator && !this.config.validator(matchText)) {
          continue;
        }

        matches.push({
          text: matchText,
          type: pattern.entityType,
          start: match.index,
          end: match.index + matchText.length,
          confidence: pattern.score,
          source: 'RULE',
          recognizer: this.config.name,
          patternName: pattern.name,
          validationPassed: this.config.validator ? true : undefined,
        });
      }
    }

    return matches;
  }

  /**
   * Check if this recognizer supports a specific language.
   *
   * @param lang - Language code to check (e.g., 'en', 'fr', 'de')
   * @returns true if language is supported
   */
  supportsLanguage(lang: string): boolean {
    const normalizedLang = lang.toLowerCase();
    return this.config.supportedLanguages.some(
      (l) => l.toLowerCase() === normalizedLang
    );
  }

  /**
   * Check if this recognizer supports a specific country/region.
   *
   * @param country - Country code to check (e.g., 'CH', 'EU', 'US')
   * @returns true if country is supported
   */
  supportsCountry(country: string): boolean {
    const normalizedCountry = country.toUpperCase();
    return this.config.supportedCountries.some(
      (c) => c.toUpperCase() === normalizedCountry
    );
  }

  /**
   * Check if text should be denied (filtered as false positive).
   *
   * Checks both:
   * 1. Recognizer-specific deny patterns (from config.denyPatterns)
   * 2. Global DenyList (if config.useGlobalDenyList is true)
   *
   * @param text - Text to check
   * @param entityType - Entity type for context-specific deny rules
   * @param language - Optional language for language-specific deny rules
   * @returns true if text should be denied (filtered out)
   */
  protected isDenied(
    text: string,
    entityType: string,
    language?: string
  ): boolean {
    const normalizedText = text.toLowerCase().trim();

    // Check recognizer-specific deny patterns
    for (const pattern of this.config.denyPatterns) {
      if (typeof pattern === 'string') {
        if (normalizedText === pattern.toLowerCase()) {
          return true;
        }
      } else if (pattern instanceof RegExp) {
        // Reset lastIndex for RegExp with 'g' flag
        pattern.lastIndex = 0;
        if (pattern.test(text)) {
          return true;
        }
      }
    }

    // Check global DenyList if enabled
    if (this.config.useGlobalDenyList) {
      if (DenyList.isDenied(text, entityType, language)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get context words for this recognizer.
   * Can be overridden by subclasses to provide dynamic context words.
   *
   * @returns Array of context word strings
   */
  getContextWords(): string[] {
    return this.config.contextWords;
  }

  /**
   * Get the recognizer's priority for conflict resolution.
   * Higher priority recognizers are processed first.
   *
   * @returns Priority value (default: 50)
   */
  getPriority(): number {
    return this.config.priority ?? DEFAULT_RECOGNIZER_CONFIG.priority ?? 50;
  }

  /**
   * Get the recognizer's specificity level for priority tiebreaking.
   *
   * @returns Specificity level ('country' | 'region' | 'global')
   */
  getSpecificity(): 'country' | 'region' | 'global' {
    return (
      this.config.specificity ??
      DEFAULT_RECOGNIZER_CONFIG.specificity ??
      'country'
    );
  }
}
