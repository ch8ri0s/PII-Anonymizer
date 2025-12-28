/**
 * Lightweight Lemmatizer for Context Word Matching
 *
 * Provides simple suffix-stripping lemmatization for EN/FR/DE languages
 * without requiring heavy NLP library dependencies. Follows the Presidio
 * LemmaContextAwareEnhancer pattern.
 *
 * @module shared/pii/preprocessing/Lemmatizer
 */
/**
 * Lemmatizer interface for word normalization
 */
export interface Lemmatizer {
    /**
     * Reduce word to base form (e.g., "addresses" → "address")
     * @param word - Word to lemmatize
     * @param language - Optional language code ('en', 'fr', 'de')
     */
    lemmatize(word: string, language?: string): string;
}
/**
 * Supported languages
 */
export declare const SUPPORTED_LEMMATIZER_LANGUAGES: readonly ["en", "fr", "de"];
export type LemmatizerLanguage = (typeof SUPPORTED_LEMMATIZER_LANGUAGES)[number];
/**
 * Simple suffix-stripping lemmatizer
 *
 * Implements a lightweight lemmatization approach without external NLP dependencies.
 * This follows the Presidio LemmaContextAwareEnhancer pattern for improving
 * context word matching.
 */
export declare class SimpleLemmatizer implements Lemmatizer {
    private defaultLanguage;
    private cache;
    private cacheLimit;
    constructor(defaultLanguage?: LemmatizerLanguage);
    /**
     * Lemmatize a word to its base form
     *
     * @param word - Word to lemmatize
     * @param language - Language code ('en', 'fr', 'de')
     * @returns Lemmatized word
     */
    lemmatize(word: string, language?: string): string;
    /**
     * Apply suffix rules for a given language
     */
    private applyRules;
    /**
     * Preserve the case pattern of the original word
     */
    private preserveCase;
    /**
     * Normalize language code
     */
    private normalizeLanguage;
    /**
     * Clear the internal cache
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        size: number;
        limit: number;
    };
}
/**
 * Create a new lemmatizer instance
 * @param language - Default language for lemmatization
 */
export declare function createLemmatizer(language?: LemmatizerLanguage): SimpleLemmatizer;
/**
 * Default lemmatizer instance (English)
 */
export declare const defaultLemmatizer: SimpleLemmatizer;
//# sourceMappingURL=Lemmatizer.d.ts.map