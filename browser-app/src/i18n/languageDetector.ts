/**
 * Language Detector Module (Browser Version)
 * Detects user's language preference from browser settings
 */

import { SupportedLocale, LocaleInfo, SUPPORTED_LANGUAGES } from './types';

/**
 * Detect language from browser navigator
 * @returns Two-letter language code ('en', 'fr', or 'de')
 */
export function detectLanguage(): SupportedLocale {
  // Try navigator.language first (e.g., 'fr-FR', 'de-CH')
  const browserLocale = navigator.language || navigator.languages?.[0] || 'en';

  return detectLanguageFromString(browserLocale);
}

/**
 * Detect language from locale string
 * @param systemLocale - Full locale string (e.g., 'fr-FR', 'de-CH')
 * @returns Two-letter language code ('en', 'fr', or 'de')
 */
export function detectLanguageFromString(systemLocale: string | null | undefined): SupportedLocale {
  if (!systemLocale || typeof systemLocale !== 'string') {
    console.warn('Invalid system locale, defaulting to English');
    return 'en';
  }

  // Extract first two characters (language code)
  const language = systemLocale.substring(0, 2).toLowerCase();

  // Return language if supported, otherwise default to English
  if (SUPPORTED_LANGUAGES.includes(language as SupportedLocale)) {
    return language as SupportedLocale;
  }

  console.log(`Unsupported language detected: ${language}, falling back to English`);
  return 'en';
}

/**
 * Get full locale info with fallback
 * @returns Locale information object
 */
export function getLocaleInfo(): LocaleInfo {
  const browserLocale = navigator.language || '';

  // Extract original language before fallback
  const originalLanguage = browserLocale.substring(0, 2).toLowerCase();
  const isSupported = SUPPORTED_LANGUAGES.includes(originalLanguage as SupportedLocale);

  // Use detectLanguage to get the final language (with fallback)
  const detectedLanguage = detectLanguage();

  return {
    systemLocale: browserLocale,
    language: detectedLanguage,
    supported: isSupported,
    ...(isSupported ? {} : { fallback: 'en' as SupportedLocale }),
  };
}

/**
 * Validate locale string
 * @param locale - Locale to validate
 * @returns True if valid supported locale
 */
export function isValidLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LANGUAGES.includes(locale as SupportedLocale);
}

/**
 * Get stored language preference from localStorage
 * @returns Stored locale or null if not set
 */
export function getStoredLanguage(): SupportedLocale | null {
  try {
    const stored = localStorage.getItem('pii-anonymizer-locale');
    if (stored && isValidLocale(stored)) {
      return stored;
    }
  } catch (e) {
    // localStorage may not be available
    console.warn('Could not access localStorage for language preference');
  }
  return null;
}

/**
 * Store language preference in localStorage
 * @param locale - Locale to store
 */
export function setStoredLanguage(locale: SupportedLocale): void {
  try {
    localStorage.setItem('pii-anonymizer-locale', locale);
  } catch (e) {
    console.warn('Could not store language preference in localStorage');
  }
}
