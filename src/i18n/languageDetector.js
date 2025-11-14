/**
 * Language Detector Module
 * Detects user's language preference from OS locale
 */

/**
 * Detect language from OS locale string
 * @param {string} systemLocale - Full locale from app.getLocale() (e.g., 'fr-FR', 'de-CH')
 * @returns {string} - Two-letter language code ('en', 'fr', or 'de')
 */
export function detectLanguage(systemLocale) {
  if (!systemLocale || typeof systemLocale !== 'string') {
    console.warn('Invalid system locale, defaulting to English');
    return 'en';
  }

  // Extract first two characters (language code)
  const language = systemLocale.substring(0, 2).toLowerCase();

  // List of supported languages
  const supported = ['en', 'fr', 'de'];

  // Return language if supported, otherwise default to English
  if (supported.includes(language)) {
    return language;
  }

  console.log(`Unsupported language detected: ${language}, falling back to English`);
  return 'en';
}

/**
 * Get full locale info with fallback
 * @param {string} systemLocale - Full locale from app.getLocale()
 * @returns {Object} - { locale, language, supported, fallback? }
 */
export function getLocaleInfo(systemLocale) {
  if (!systemLocale || typeof systemLocale !== 'string') {
    return {
      systemLocale: systemLocale || '',
      language: 'en',
      supported: true
    };
  }

  // Extract original language before fallback
  const originalLanguage = systemLocale.substring(0, 2).toLowerCase();
  const supported = ['en', 'fr', 'de'];
  const isSupported = supported.includes(originalLanguage);

  // Use detectLanguage to get the final language (with fallback)
  const detectedLanguage = detectLanguage(systemLocale);

  return {
    systemLocale,
    language: detectedLanguage,
    supported: isSupported,
    ...(isSupported ? {} : { fallback: 'en' })
  };
}

/**
 * Validate locale string
 * @param {string} locale - Locale to validate
 * @returns {boolean} - True if valid supported locale
 */
export function isValidLocale(locale) {
  const supported = ['en', 'fr', 'de'];
  return supported.includes(locale);
}
