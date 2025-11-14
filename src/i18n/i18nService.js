/**
 * i18n Service Core Module
 * Manages translation loading, key lookup, and fallback logic
 */

let currentLocale = 'en';
let translations = {};
let fallbackTranslations = {};

/**
 * Initialize i18n service with locale and translations
 * @param {string} locale - Two-letter language code ('en', 'fr', 'de')
 * @param {Object} localeTranslations - Translation object for the locale
 * @param {Object} fallback - Optional fallback translations (defaults to English)
 */
export function init(locale, localeTranslations, fallback = null) {
  if (!locale || typeof locale !== 'string') {
    console.warn('Invalid locale provided to init, defaulting to English');
    currentLocale = 'en';
  } else {
    currentLocale = locale;
  }

  if (!localeTranslations || typeof localeTranslations !== 'object') {
    console.warn('Invalid translations provided to init');
    translations = {};
  } else {
    translations = localeTranslations;
  }

  if (fallback && typeof fallback === 'object') {
    fallbackTranslations = fallback;
  } else {
    fallbackTranslations = {}; // Reset fallback if not provided
  }
}

/**
 * Get translation for a key using dot notation
 * @param {string} key - Translation key with dot notation (e.g., 'upload.title')
 * @param {string} locale - Optional locale override
 * @returns {string} - Translated string or key if not found
 */
export function t(key, locale = null) {
  if (!key || typeof key !== 'string') {
    console.warn('Invalid translation key:', key);
    return '';
  }

  const targetLocale = locale || currentLocale;

  // Try to get translation from current locale
  const translation = lookup(key, translations);
  if (translation) {
    return translation;
  }

  // Fallback to English if not the current locale
  if (targetLocale !== 'en' && Object.keys(fallbackTranslations).length > 0) {
    const fallback = lookup(key, fallbackTranslations);
    if (fallback) {
      console.warn(`Translation missing for key '${key}' in locale '${targetLocale}', using English fallback`);
      return fallback;
    }
  }

  // Last resort: return the key itself
  console.warn(`Translation not found for key: ${key}`);
  return key;
}

/**
 * Lookup translation value by dot-notation key
 * @param {string} key - Dot-notation key (e.g., 'upload.title')
 * @param {Object} translationObj - Translation object to search
 * @returns {string|null} - Translation value or null if not found
 */
function lookup(key, translationObj) {
  if (!key || !translationObj) {
    return null;
  }

  const keys = key.split('.');
  let value = translationObj;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return null;
    }
  }

  return typeof value === 'string' ? value : null;
}

/**
 * Set locale and update translations
 * @param {string} locale - Two-letter language code
 * @param {Object} localeTranslations - Translation object for the new locale
 */
export function setLocale(locale, localeTranslations) {
  if (!locale || typeof locale !== 'string') {
    console.warn('Invalid locale provided to setLocale');
    return;
  }

  currentLocale = locale;

  if (localeTranslations && typeof localeTranslations === 'object') {
    translations = localeTranslations;
  } else {
    console.warn('Invalid translations provided to setLocale');
    translations = {};
  }
}

/**
 * Get current locale
 * @returns {string} - Current two-letter language code
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Set fallback translations (typically English)
 * @param {Object} fallback - Fallback translation object
 */
export function setFallback(fallback) {
  if (fallback && typeof fallback === 'object') {
    fallbackTranslations = fallback;
  } else {
    console.warn('Invalid fallback translations provided');
    fallbackTranslations = {};
  }
}

/**
 * Check if a translation key exists
 * @param {string} key - Translation key to check
 * @returns {boolean} - True if key exists in current locale or fallback
 */
export function has(key) {
  const translation = lookup(key, translations);
  if (translation) {
    return true;
  }

  if (Object.keys(fallbackTranslations).length > 0) {
    const fallback = lookup(key, fallbackTranslations);
    return !!fallback;
  }

  return false;
}
