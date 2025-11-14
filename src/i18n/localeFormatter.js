/**
 * Locale Formatter Module
 * Formats dates, times, and numbers according to locale conventions
 * Uses native JavaScript Intl API
 */

/**
 * Format date according to locale
 * @param {Date} date - Date object to format
 * @param {string} locale - Locale code ('en', 'fr', 'de')
 * @param {string} style - Format style ('short', 'medium', 'long')
 * @returns {string} - Formatted date string
 */
export function formatDate(date, locale = 'en', style = 'short') {
  if (!(date instanceof Date) || isNaN(date)) {
    return '';
  }

  // Map locale to BCP 47 format
  const localeMap = {
    'en': 'en-US',
    'fr': 'fr-FR',
    'de': 'de-DE'
  };

  const bcp47Locale = localeMap[locale] || 'en-US';

  // Format options by style
  const formatOptions = {
    short: { year: 'numeric', month: '2-digit', day: '2-digit' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' }
  };

  const options = formatOptions[style] || formatOptions.short;

  try {
    return new Intl.DateTimeFormat(bcp47Locale, options).format(date);
  } catch (error) {
    console.error('Date formatting error:', error);
    return date.toLocaleDateString();
  }
}

/**
 * Format time according to locale
 * @param {Date} date - Date object to format
 * @param {string} locale - Locale code ('en', 'fr', 'de')
 * @returns {string} - Formatted time string
 */
export function formatTime(date, locale = 'en') {
  if (!(date instanceof Date) || isNaN(date)) {
    return '';
  }

  // Map locale to BCP 47 format
  const localeMap = {
    'en': 'en-US',
    'fr': 'fr-FR',
    'de': 'de-DE'
  };

  const bcp47Locale = localeMap[locale] || 'en-US';

  // English uses 12-hour format, French and German use 24-hour format
  const options = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: locale === 'en'
  };

  try {
    return new Intl.DateTimeFormat(bcp47Locale, options).format(date);
  } catch (error) {
    console.error('Time formatting error:', error);
    return date.toLocaleTimeString();
  }
}

/**
 * Format file size with locale-specific number formatting
 * @param {number} bytes - File size in bytes
 * @param {string} locale - Locale code ('en', 'fr', 'de')
 * @returns {string} - Formatted file size string
 */
export function formatFileSize(bytes, locale = 'en') {
  if (typeof bytes !== 'number' || bytes < 0) {
    return '0 B';
  }

  // Map locale to BCP 47 format
  const localeMap = {
    'en': 'en-US',
    'fr': 'fr-FR',
    'de': 'de-DE'
  };

  const bcp47Locale = localeMap[locale] || 'en-US';

  const kb = bytes / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;

  const numberFormatter = new Intl.NumberFormat(bcp47Locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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
    console.error('File size formatting error:', error);
    return `${bytes} B`;
  }
}

/**
 * Format number according to locale
 * @param {number} number - Number to format
 * @param {string} locale - Locale code ('en', 'fr', 'de')
 * @param {Object} options - Intl.NumberFormat options
 * @returns {string} - Formatted number string
 */
export function formatNumber(number, locale = 'en', options = {}) {
  if (typeof number !== 'number') {
    return String(number);
  }

  // Map locale to BCP 47 format
  const localeMap = {
    'en': 'en-US',
    'fr': 'fr-FR',
    'de': 'de-DE'
  };

  const bcp47Locale = localeMap[locale] || 'en-US';

  try {
    return new Intl.NumberFormat(bcp47Locale, options).format(number);
  } catch (error) {
    console.error('Number formatting error:', error);
    return String(number);
  }
}

/**
 * Format date and time together
 * @param {Date} date - Date object to format
 * @param {string} locale - Locale code ('en', 'fr', 'de')
 * @returns {string} - Formatted date and time string
 */
export function formatDateTime(date, locale = 'en') {
  const dateStr = formatDate(date, locale);
  const timeStr = formatTime(date, locale);
  return `${dateStr} ${timeStr}`;
}
