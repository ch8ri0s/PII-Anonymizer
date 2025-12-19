/**
 * i18n Type Definitions
 * Shared types for internationalization system
 */

/**
 * Supported language codes
 */
export type SupportedLocale = 'en' | 'fr' | 'de';

/**
 * Translation object type - nested JSON structure
 */
export type TranslationObject = Record<string, unknown>;

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
 * Date format style options
 */
export type DateStyle = 'short' | 'medium' | 'long';

/**
 * BCP 47 locale mapping type
 */
export type BCP47Locale = 'en-US' | 'fr-FR' | 'de-DE';

/**
 * List of supported languages
 */
export const SUPPORTED_LANGUAGES: readonly SupportedLocale[] = ['en', 'fr', 'de'];
