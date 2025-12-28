/**
 * Text Normalizer for PII Detection
 *
 * Performs text-level normalization before PII detection:
 * - Unicode normalization (NFKC)
 * - Whitespace normalization (zero-width, non-breaking spaces)
 * - Email de-obfuscation (at, dot, arobase patterns)
 * - Phone de-obfuscation (spaces, dashes, (0) removal)
 *
 * Maintains position mapping from normalized text back to original indices
 * for accurate anonymization and mapping file generation.
 *
 * @module shared/pii/preprocessing/TextNormalizer
 */
/**
 * Result of text normalization
 */
export interface NormalizationResult {
    /** Normalized text used by downstream passes */
    normalizedText: string;
    /**
     * Map from normalized index to original index.
     * indexMap[normalizedIndex] = originalIndex
     * For indices that result from collapsing characters,
     * map to the nearest original index.
     */
    indexMap: number[];
}
/**
 * Configuration options for TextNormalizer
 */
export interface TextNormalizerOptions {
    /** Enable/disable email de-obfuscation (default: true) */
    handleEmails?: boolean;
    /** Enable/disable phone de-obfuscation (default: true) */
    handlePhones?: boolean;
    /** Enable/disable Unicode normalization (default: true) */
    normalizeUnicode?: boolean;
    /** Enable/disable whitespace normalization (default: true) */
    normalizeWhitespace?: boolean;
    /** Target Unicode normalization form (default: 'NFKC') */
    normalizationForm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
    /** Supported locales for obfuscation patterns (default: ['en', 'fr', 'de']) */
    supportedLocales?: string[];
}
/**
 * Text Normalizer
 *
 * Performs text-level normalization while maintaining position mapping
 * for accurate offset repair after PII detection.
 */
export declare class TextNormalizer {
    private options;
    constructor(options?: TextNormalizerOptions);
    /**
     * Normalize input text for PII detection
     *
     * @param input - Original document text
     * @returns Normalized text with position mapping
     */
    normalize(input: string): NormalizationResult;
    /**
     * Map an entity span from normalized text back to original text
     *
     * @param start - Start index in normalized text
     * @param end - End index in normalized text
     * @param indexMap - Position mapping from normalize()
     * @returns Span in original text coordinates
     */
    mapSpan(start: number, end: number, indexMap: number[]): {
        start: number;
        end: number;
    };
    /**
     * Get current options
     */
    getOptions(): Required<TextNormalizerOptions>;
    /**
     * Apply Unicode normalization
     */
    private applyUnicodeNormalization;
    /**
     * Apply whitespace normalization
     */
    private applyWhitespaceNormalization;
    /**
     * Apply replacement patterns while maintaining position mapping
     */
    private applyPatterns;
    /**
     * Create an identity map (each index maps to itself)
     */
    private createIdentityMap;
}
/**
 * Create a new TextNormalizer instance
 * @param options - Configuration options
 */
export declare function createTextNormalizer(options?: TextNormalizerOptions): TextNormalizer;
/**
 * Default normalizer with all options enabled
 */
export declare const defaultNormalizer: TextNormalizer;
//# sourceMappingURL=TextNormalizer.d.ts.map