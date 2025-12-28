/**
 * Text Preprocessing Module for PII Detection
 *
 * Provides text normalization and lemmatization for improved PII detection.
 * Used by both Electron and browser detection pipelines.
 *
 * @module shared/pii/preprocessing
 */

export {
  type NormalizationResult,
  type TextNormalizerOptions,
  TextNormalizer,
  createTextNormalizer,
  defaultNormalizer,
} from './TextNormalizer.js';

export {
  type Lemmatizer,
  type LemmatizerLanguage,
  SimpleLemmatizer,
  createLemmatizer,
  defaultLemmatizer,
  SUPPORTED_LEMMATIZER_LANGUAGES,
} from './Lemmatizer.js';
