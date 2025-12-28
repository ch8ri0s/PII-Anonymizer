/**
 * Locale Data for Validators
 *
 * Shared locale-specific data used across multiple validators.
 * Provides month names for EN, DE, FR, IT with accent variations.
 *
 * Used by:
 * - SwissAddressValidator: MONTH_NAMES Set for detecting date false positives
 * - DateValidator: MONTH_NAME_TO_NUMBER Record for parsing month names
 *
 * @module shared/pii/validators/locale-data
 */

/**
 * Month names mapped to month numbers (1-12)
 *
 * Supports English, German, French, and Italian.
 * Includes accent variations for cross-platform compatibility:
 * - février/fevrier (French February)
 * - août/aout (French August)
 * - décembre/decembre (French December)
 * - märz/maerz (German March)
 *
 * Note: Some month names are shared across languages
 * (april, august, september, november appear in both EN and DE)
 */
export const MONTH_NAME_TO_NUMBER: Readonly<Record<string, number>> = Object.freeze({
  // English (all 12 months)
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,

  // German (unique names - april, august, september, november same as English)
  januar: 1,
  februar: 2,
  märz: 3,
  maerz: 3, // ASCII alternative for ä
  mai: 5,
  juni: 6,
  juli: 7,
  oktober: 10,
  dezember: 12,

  // French (unique names + accent variations)
  janvier: 1,
  février: 2,
  fevrier: 2, // ASCII alternative for é
  mars: 3,
  avril: 4,
  juin: 6,
  juillet: 7,
  août: 8,
  aout: 8, // ASCII alternative for û
  septembre: 9,
  octobre: 10,
  novembre: 11,
  décembre: 12,
  decembre: 12, // ASCII alternative for é

  // Italian (unique names)
  gennaio: 1,
  febbraio: 2,
  marzo: 3,
  aprile: 4,
  maggio: 5,
  giugno: 6,
  luglio: 7,
  agosto: 8,
  settembre: 9,
  ottobre: 10,
  dicembre: 12,
});

/**
 * Set of all recognized month names (lowercase)
 *
 * Derived from MONTH_NAME_TO_NUMBER keys to ensure consistency.
 * Use this for quick existence checks without needing the month number.
 *
 * @example
 * ```typescript
 * if (MONTH_NAMES.has(word.toLowerCase())) {
 *   // It's a month name
 * }
 * ```
 */
export const MONTH_NAMES: ReadonlySet<string> = new Set(
  Object.keys(MONTH_NAME_TO_NUMBER),
);

/**
 * Check if a string is a recognized month name
 *
 * Case-insensitive check against all supported languages.
 *
 * @param text - Text to check
 * @returns true if text is a recognized month name
 *
 * @example
 * ```typescript
 * isMonthName('January');  // true
 * isMonthName('januar');   // true (German)
 * isMonthName('février');  // true (French)
 * isMonthName('Monday');   // false
 * ```
 */
export function isMonthName(text: string): boolean {
  return MONTH_NAMES.has(text.toLowerCase());
}

/**
 * Get month number from name
 *
 * Case-insensitive lookup supporting all languages and accent variations.
 *
 * @param text - Month name (case-insensitive)
 * @returns Month number (1-12) or undefined if not found
 *
 * @example
 * ```typescript
 * getMonthNumber('March');    // 3
 * getMonthNumber('März');     // 3
 * getMonthNumber('mars');     // 3 (French)
 * getMonthNumber('invalid');  // undefined
 * ```
 */
export function getMonthNumber(text: string): number | undefined {
  return MONTH_NAME_TO_NUMBER[text.toLowerCase()];
}

/**
 * Supported languages for locale data
 */
export const SUPPORTED_LANGUAGES = ['en', 'de', 'fr', 'it'] as const;

/**
 * Type for supported language codes
 */
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
