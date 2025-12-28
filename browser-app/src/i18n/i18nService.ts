/**
 * i18n Service Core Module (Browser Version)
 * Manages translation loading, key lookup, and fallback logic
 */

import type { SupportedLocale, TranslationObject } from './types';
import { detectLanguage, getStoredLanguage, setStoredLanguage } from './languageDetector';
import { LoggerFactory } from '../utils/logger';

const log = LoggerFactory.create('i18n:service');

/**
 * Module state
 */
let currentLocale: SupportedLocale = 'en';
let translations: TranslationObject = {};
let fallbackTranslations: TranslationObject = {};
let isInitialized = false;

/**
 * Lookup translation value by dot-notation key
 * @param key - Dot-notation key (e.g., 'upload.title')
 * @param translationObj - Translation object to search
 * @returns Translation value or null if not found
 */
function lookup(key: string, translationObj: TranslationObject): string | null {
  if (!key || !translationObj) {
    return null;
  }

  const keys = key.split('.');
  let value: unknown = translationObj;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in (value as Record<string, unknown>)) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return null;
    }
  }

  return typeof value === 'string' ? value : null;
}

/**
 * Load translations from JSON file
 * @param locale - Locale to load
 * @returns Translation object
 */
async function loadTranslations(locale: SupportedLocale): Promise<TranslationObject> {
  try {
    const response = await fetch(`/locales/${locale}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load ${locale} translations: ${response.status}`);
    }
    const data = await response.json();
    return data.translations || data;
  } catch (error) {
    log.error('Error loading translations', { locale, error: error instanceof Error ? error.message : String(error) });
    return {};
  }
}

/**
 * Initialize i18n service
 * Auto-detects language and loads translations
 */
export async function init(): Promise<void> {
  // Check for stored preference first, then detect from browser
  const storedLocale = getStoredLanguage();
  currentLocale = storedLocale || detectLanguage();

  // Load current locale translations
  translations = await loadTranslations(currentLocale);

  // Load English as fallback if not already English
  if (currentLocale !== 'en') {
    fallbackTranslations = await loadTranslations('en');
  }

  isInitialized = true;
}

/**
 * Initialize with specific locale and translations (for testing)
 * @param locale - Two-letter language code ('en', 'fr', 'de')
 * @param localeTranslations - Translation object for the locale
 * @param fallback - Optional fallback translations (defaults to English)
 */
export function initWithTranslations(
  locale: string | null | undefined,
  localeTranslations: TranslationObject | null | undefined,
  fallback: TranslationObject | null = null,
): void {
  if (!locale || typeof locale !== 'string') {
    log.warn('Invalid locale provided to init, defaulting to English');
    currentLocale = 'en';
  } else {
    currentLocale = locale as SupportedLocale;
  }

  if (!localeTranslations || typeof localeTranslations !== 'object') {
    log.warn('Invalid translations provided to init');
    translations = {};
  } else {
    translations = localeTranslations;
  }

  if (fallback && typeof fallback === 'object') {
    fallbackTranslations = fallback;
  } else {
    fallbackTranslations = {};
  }

  isInitialized = true;
}

/**
 * Get translation for a key using dot notation
 * @param key - Translation key with dot notation (e.g., 'upload.title')
 * @param _locale - Optional locale override (unused, for compatibility)
 * @returns Translated string or key if not found
 */
export function t(key: string, _locale: string | null = null): string {
  if (!key || typeof key !== 'string') {
    log.warn('Invalid translation key', { key });
    return '';
  }

  // Try to get translation from current locale
  const translation = lookup(key, translations);
  if (translation) {
    return translation;
  }

  // Fallback to English if not the current locale
  if (currentLocale !== 'en' && Object.keys(fallbackTranslations).length > 0) {
    const fallback = lookup(key, fallbackTranslations);
    if (fallback) {
      log.warn('Translation missing, using English fallback', { key, locale: currentLocale });
      return fallback;
    }
  }

  // Last resort: return the key itself
  log.warn('Translation not found', { key });
  return key;
}

/**
 * Set locale and update translations
 * @param locale - Two-letter language code
 */
export async function setLocale(locale: SupportedLocale): Promise<void> {
  if (!locale || typeof locale !== 'string') {
    log.warn('Invalid locale provided to setLocale');
    return;
  }

  currentLocale = locale;
  setStoredLanguage(locale);

  // Load new translations
  translations = await loadTranslations(locale);

  // Update fallback if switching away from English
  if (locale !== 'en' && Object.keys(fallbackTranslations).length === 0) {
    fallbackTranslations = await loadTranslations('en');
  }
}

/**
 * Get current locale
 * @returns Current two-letter language code
 */
export function getLocale(): SupportedLocale {
  return currentLocale;
}

/**
 * Check if a translation key exists
 * @param key - Translation key to check
 * @returns True if key exists in current locale or fallback
 */
export function has(key: string): boolean {
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

/**
 * Check if i18n is initialized
 * @returns True if initialized
 */
export function isReady(): boolean {
  return isInitialized;
}

/**
 * Get all available locales
 * @returns Array of supported locale codes
 */
export function getAvailableLocales(): SupportedLocale[] {
  return ['en', 'fr', 'de'];
}
