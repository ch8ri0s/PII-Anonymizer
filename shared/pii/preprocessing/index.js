/**
 * Text Preprocessing Module for PII Detection
 *
 * Provides text normalization and lemmatization for improved PII detection.
 * Used by both Electron and browser detection pipelines.
 *
 * @module shared/pii/preprocessing
 */
export { TextNormalizer, createTextNormalizer, defaultNormalizer, } from './TextNormalizer.js';
export { SimpleLemmatizer, createLemmatizer, defaultLemmatizer, SUPPORTED_LEMMATIZER_LANGUAGES, } from './Lemmatizer.js';
//# sourceMappingURL=index.js.map