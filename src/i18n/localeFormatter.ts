/**
 * Locale Formatter Module
 * Formats dates, times, and numbers according to locale conventions
 * Uses native JavaScript Intl API
 */

import type { SupportedLocale } from './languageDetector.js';
import { LoggerFactory } from '../utils/LoggerFactory.js';

const log = LoggerFactory.create('i18n:formatter');

/**
 * Date format style options
 */
export type DateStyle = 'short' | 'medium' | 'long';

/**
 * BCP 47 locale mapping type
 */
type BCP47Locale = 'en-US' | 'fr-FR' | 'de-DE';

/**
 * Map locale codes to BCP 47 format
 */
const LOCALE_MAP: Record<SupportedLocale, BCP47Locale> = {
  'en': 'en-US',
  'fr': 'fr-FR',
  'de': 'de-DE',
};

/**
 * Format options by style
 */
const DATE_FORMAT_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { year: 'numeric', month: '2-digit', day: '2-digit' },
  medium: { year: 'numeric', month: 'short', day: 'numeric' },
  long: { year: 'numeric', month: 'long', day: 'numeric' },
};

/**
 * Get BCP 47 locale from supported locale code
 */
function getBCP47Locale(locale: string): BCP47Locale {
  return LOCALE_MAP[locale as SupportedLocale] ?? 'en-US';
}

/**
 * Check if a value is a valid Date
 */
function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Format date according to locale
 * @param date - Date object to format
 * @param locale - Locale code ('en', 'fr', 'de')
 * @param style - Format style ('short', 'medium', 'long')
 * @returns Formatted date string
 */
export function formatDate(date: Date, locale: string = 'en', style: DateStyle = 'short'): string {
  if (!isValidDate(date)) {
    return '';
  }

  const bcp47Locale = getBCP47Locale(locale);
  const options = DATE_FORMAT_OPTIONS[style] ?? DATE_FORMAT_OPTIONS.short;

  try {
    return new Intl.DateTimeFormat(bcp47Locale, options).format(date);
  } catch (error) {
    log.error('Date formatting error', { locale, error: error instanceof Error ? error.message : String(error) });
    return date.toLocaleDateString();
  }
}

/**
 * Format time according to locale
 * @param date - Date object to format
 * @param locale - Locale code ('en', 'fr', 'de')
 * @returns Formatted time string
 */
export function formatTime(date: Date, locale: string = 'en'): string {
  if (!isValidDate(date)) {
    return '';
  }

  const bcp47Locale = getBCP47Locale(locale);

  // English uses 12-hour format, French and German use 24-hour format
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: locale === 'en',
  };

  try {
    return new Intl.DateTimeFormat(bcp47Locale, options).format(date);
  } catch (error) {
    log.error('Time formatting error', { locale, error: error instanceof Error ? error.message : String(error) });
    return date.toLocaleTimeString();
  }
}

/**
 * Format file size with locale-specific number formatting
 * @param bytes - File size in bytes
 * @param locale - Locale code ('en', 'fr', 'de')
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number, locale: string = 'en'): string {
  if (typeof bytes !== 'number' || bytes < 0) {
    return '0 B';
  }

  const bcp47Locale = getBCP47Locale(locale);

  const kb = bytes / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;

  const numberFormatter = new Intl.NumberFormat(bcp47Locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  try {
    if (gb >= 1) {
      return `${numberFormatter.format(gb)} GB`;
    } else if (mb >= 1) {
      return `${numberFormatter.format(mb)} MB`;
    } else if (kb >= 1) {
      return `${numberFormatter.format(kb)} KB`;
    } else {
      return `${bytes} B`;
    }
  } catch (error) {
    log.error('File size formatting error', { locale, bytes, error: error instanceof Error ? error.message : String(error) });
    return `${bytes} B`;
  }
}

/**
 * Format number according to locale
 * @param number - Number to format
 * @param locale - Locale code ('en', 'fr', 'de')
 * @param options - Intl.NumberFormat options
 * @returns Formatted number string
 */
export function formatNumber(
  number: number,
  locale: string = 'en',
  options: Intl.NumberFormatOptions = {},
): string {
  if (typeof number !== 'number') {
    return String(number);
  }

  const bcp47Locale = getBCP47Locale(locale);

  try {
    return new Intl.NumberFormat(bcp47Locale, options).format(number);
  } catch (error) {
    log.error('Number formatting error', { locale, number, error: error instanceof Error ? error.message : String(error) });
    return String(number);
  }
}

/**
 * Format date and time together
 * @param date - Date object to format
 * @param locale - Locale code ('en', 'fr', 'de')
 * @returns Formatted date and time string
 */
export function formatDateTime(date: Date, locale: string = 'en'): string {
  const dateStr = formatDate(date, locale);
  const timeStr = formatTime(date, locale);
  return `${dateStr} ${timeStr}`;
}
