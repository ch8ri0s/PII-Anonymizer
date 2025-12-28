/**
 * i18n Service Core Module
 * Manages translation loading, key lookup, and fallback logic
 */

import type { SupportedLocale } from './languageDetector.js';
import { LoggerFactory } from '../utils/LoggerFactory.js';

const log = LoggerFactory.create('i18n:service');

/**
 * Translation object type - nested JSON structure
 */
export type TranslationObject = Record<string, unknown>;

/**
 * Module state
 */
let currentLocale: SupportedLocale = 'en';
let translations: TranslationObject = {};
let fallbackTranslations: TranslationObject = {};

/**
 * Initialize i18n service with locale and translations
 * @param locale - Two-letter language code ('en', 'fr', 'de')
 * @param localeTranslations - Translation object for the locale
 * @param fallback - Optional fallback translations (defaults to English)
 */
export function init(
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
    fallbackTranslations = {}; // Reset fallback if not provided
  }
}

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
 * Get translation for a key using dot notation
 * @param key - Translation key with dot notation (e.g., 'upload.title')
 * @param locale - Optional locale override
 * @returns Translated string or key if not found
 */
export function t(key: string, locale: string | null = null): string {
  if (!key || typeof key !== 'string') {
    log.warn('Invalid translation key', { key });
    return '';
  }

  const targetLocale = locale ?? currentLocale;

  // Try to get translation from current locale
  const translation = lookup(key, translations);
  if (translation) {
    return translation;
  }

  // Fallback to English if not the current locale
  if (targetLocale !== 'en' && Object.keys(fallbackTranslations).length > 0) {
    const fallback = lookup(key, fallbackTranslations);
    if (fallback) {
      log.warn('Translation missing, using fallback', { key, locale: targetLocale });
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
 * @param localeTranslations - Translation object for the new locale
 */
export function setLocale(
  locale: string | null | undefined,
  localeTranslations: TranslationObject | null | undefined,
): void {
  if (!locale || typeof locale !== 'string') {
    log.warn('Invalid locale provided to setLocale');
    return;
  }

  currentLocale = locale as SupportedLocale;

  if (localeTranslations && typeof localeTranslations === 'object') {
    translations = localeTranslations;
  } else {
    log.warn('Invalid translations provided to setLocale');
    translations = {};
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
 * Set fallback translations (typically English)
 * @param fallback - Fallback translation object
 */
export function setFallback(fallback: TranslationObject | null | undefined): void {
  if (fallback && typeof fallback === 'object') {
    fallbackTranslations = fallback;
  } else {
    log.warn('Invalid fallback translations provided');
    fallbackTranslations = {};
  }
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
