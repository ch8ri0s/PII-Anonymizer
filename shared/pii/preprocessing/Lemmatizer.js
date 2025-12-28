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
 * English suffix rules (conservative)
 * Order matters - longer suffixes first
 */
const ENGLISH_RULES = [
    // Plurals and verb forms
    { suffix: 'resses', replacement: 'ress', minLength: 4 }, // addresses → address
    { suffix: 'nesses', replacement: 'ness', minLength: 4 },
    { suffix: 'ations', replacement: 'ation', minLength: 5 },
    { suffix: 'ements', replacement: 'ement', minLength: 5 },
    { suffix: 'ments', replacement: 'ment', minLength: 4 },
    { suffix: 'ings', replacement: 'ing', minLength: 4 },
    { suffix: 'tion', replacement: 'te', minLength: 4 }, // location stays location
    { suffix: 'sses', replacement: 'ss', minLength: 3 }, // addresses
    { suffix: 'ies', replacement: 'y', minLength: 3 }, // entries → entry
    { suffix: 'ves', replacement: 'f', minLength: 3 }, // lives → life
    { suffix: 'es', replacement: '', minLength: 3 }, // matches → match, but keep 'es' if too short
    { suffix: 'ed', replacement: '', minLength: 3 }, // emailed → email
    { suffix: 's', replacement: '', minLength: 3 }, // phones → phone
];
/**
 * French suffix rules
 */
const FRENCH_RULES = [
    { suffix: 'ations', replacement: 'ation', minLength: 5 },
    { suffix: 'ements', replacement: 'ement', minLength: 5 },
    { suffix: 'ments', replacement: 'ment', minLength: 4 },
    { suffix: 'euses', replacement: 'euse', minLength: 4 },
    { suffix: 'eurs', replacement: 'eur', minLength: 4 },
    { suffix: 'eaux', replacement: 'eau', minLength: 4 }, // bureaux → bureau
    { suffix: 'aux', replacement: 'al', minLength: 3 }, // journaux → journal
    { suffix: 'es', replacement: '', minLength: 3 }, // adresses → adresse
    { suffix: 's', replacement: '', minLength: 3 }, // téléphones → téléphone
];
/**
 * German suffix rules
 */
const GERMAN_RULES = [
    { suffix: 'ungen', replacement: 'ung', minLength: 4 }, // Rechnungen → Rechnung
    { suffix: 'heiten', replacement: 'heit', minLength: 4 },
    { suffix: 'keiten', replacement: 'keit', minLength: 4 },
    { suffix: 'ungen', replacement: 'ung', minLength: 4 },
    { suffix: 'ieren', replacement: 'ieren', minLength: 5 }, // keep verbs
    { suffix: 'nummern', replacement: 'nummer', minLength: 6 }, // Telefonnummern → Telefonnummer
    { suffix: 'ssen', replacement: 'ss', minLength: 4 }, // Adressen → Adresse
    { suffix: 'en', replacement: '', minLength: 3 }, // Adressen → Adress (then 'e' rule)
    { suffix: 'er', replacement: '', minLength: 3 }, // Mitarbeiter
    { suffix: 'e', replacement: '', minLength: 3 }, // Adresse → Adress
    { suffix: 'n', replacement: '', minLength: 3 }, // Namen → Name
    { suffix: 's', replacement: '', minLength: 3 }, // rarely used in German
];
/**
 * Language-specific rule sets
 */
const RULES_BY_LANGUAGE = {
    en: ENGLISH_RULES,
    fr: FRENCH_RULES,
    de: GERMAN_RULES,
};
/**
 * Default language for lemmatization
 */
const DEFAULT_LANGUAGE = 'en';
/**
 * Supported languages
 */
export const SUPPORTED_LEMMATIZER_LANGUAGES = ['en', 'fr', 'de'];
/**
 * Simple suffix-stripping lemmatizer
 *
 * Implements a lightweight lemmatization approach without external NLP dependencies.
 * This follows the Presidio LemmaContextAwareEnhancer pattern for improving
 * context word matching.
 */
export class SimpleLemmatizer {
    defaultLanguage;
    cache = new Map();
    cacheLimit = 1000;
    constructor(defaultLanguage = 'en') {
        this.defaultLanguage = defaultLanguage;
    }
    /**
     * Lemmatize a word to its base form
     *
     * @param word - Word to lemmatize
     * @param language - Language code ('en', 'fr', 'de')
     * @returns Lemmatized word
     */
    lemmatize(word, language) {
        if (!word || word.length < 3) {
            return word;
        }
        const lang = this.normalizeLanguage(language);
        const cacheKey = `${lang}:${word.toLowerCase()}`;
        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        const result = this.applyRules(word, lang);
        // Update cache (with limit)
        if (this.cache.size >= this.cacheLimit) {
            // Clear oldest entries (simple FIFO)
            const keysToDelete = Array.from(this.cache.keys()).slice(0, Math.floor(this.cacheLimit / 4));
            keysToDelete.forEach((key) => this.cache.delete(key));
        }
        this.cache.set(cacheKey, result);
        return result;
    }
    /**
     * Apply suffix rules for a given language
     */
    applyRules(word, language) {
        const rules = RULES_BY_LANGUAGE[language] || RULES_BY_LANGUAGE[DEFAULT_LANGUAGE];
        const lowerWord = word.toLowerCase();
        for (const rule of rules) {
            if (lowerWord.endsWith(rule.suffix)) {
                const stem = lowerWord.slice(0, lowerWord.length - rule.suffix.length) + rule.replacement;
                if (stem.length >= rule.minLength) {
                    // Preserve original case pattern if possible
                    return this.preserveCase(word, stem);
                }
            }
        }
        return word;
    }
    /**
     * Preserve the case pattern of the original word
     */
    preserveCase(original, lemma) {
        if (original === original.toUpperCase()) {
            return lemma.toUpperCase();
        }
        if (original[0] === original[0].toUpperCase()) {
            return lemma.charAt(0).toUpperCase() + lemma.slice(1);
        }
        return lemma;
    }
    /**
     * Normalize language code
     */
    normalizeLanguage(language) {
        if (!language) {
            return this.defaultLanguage;
        }
        const lang = language.toLowerCase().slice(0, 2);
        return SUPPORTED_LEMMATIZER_LANGUAGES.includes(lang)
            ? lang
            : this.defaultLanguage;
    }
    /**
     * Clear the internal cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return { size: this.cache.size, limit: this.cacheLimit };
    }
}
/**
 * Create a new lemmatizer instance
 * @param language - Default language for lemmatization
 */
export function createLemmatizer(language) {
    return new SimpleLemmatizer(language);
}
/**
 * Default lemmatizer instance (English)
 */
export const defaultLemmatizer = new SimpleLemmatizer('en');
//# sourceMappingURL=Lemmatizer.js.map