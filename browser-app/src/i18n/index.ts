/**
 * i18n Module Entry Point (Browser Version)
 * Re-exports all i18n functionality
 */

// Types
export type {
  SupportedLocale,
  TranslationObject,
  LocaleInfo,
  DateStyle,
  BCP47Locale,
} from './types';

export { SUPPORTED_LANGUAGES } from './types';

// Language Detection
export {
  detectLanguage,
  detectLanguageFromString,
  getLocaleInfo,
  isValidLocale,
  getStoredLanguage,
  setStoredLanguage,
} from './languageDetector';

// i18n Service
export {
  init,
  initWithTranslations,
  t,
  setLocale,
  getLocale,
  has,
  isReady,
  getAvailableLocales,
} from './i18nService';

// Locale Formatting
export {
  formatDate,
  formatTime,
  formatFileSize,
  formatNumber,
  formatDateTime,
  formatPercent,
} from './localeFormatter';
