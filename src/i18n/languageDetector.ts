/**
 * Language Detector Module
 * Detects user's language preference from OS locale
 */

/**
 * Supported language codes
 */
export type SupportedLocale = 'en' | 'fr' | 'de';

/**
 * Locale information with fallback details
 */
export interface LocaleInfo {
  systemLocale: string;
  language: SupportedLocale;
  supported: boolean;
  fallback?: SupportedLocale;
}

/**
 * List of supported languages
 */
const SUPPORTED_LANGUAGES: readonly SupportedLocale[] = ['en', 'fr', 'de'];

/**
 * Detect language from OS locale string
 * @param systemLocale - Full locale from app.getLocale() (e.g., 'fr-FR', 'de-CH')
 * @returns Two-letter language code ('en', 'fr', or 'de')
 */
export function detectLanguage(systemLocale: string | null | undefined): SupportedLocale {
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
 * @param systemLocale - Full locale from app.getLocale()
 * @returns Locale information object
 */
export function getLocaleInfo(systemLocale: string | null | undefined): LocaleInfo {
  if (!systemLocale || typeof systemLocale !== 'string') {
    return {
      systemLocale: systemLocale ?? '',
      language: 'en',
      supported: true,
    };
  }

  // Extract original language before fallback
  const originalLanguage = systemLocale.substring(0, 2).toLowerCase();
  const isSupported = SUPPORTED_LANGUAGES.includes(originalLanguage as SupportedLocale);

  // Use detectLanguage to get the final language (with fallback)
  const detectedLanguage = detectLanguage(systemLocale);

  return {
    systemLocale,
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
