/**
 * Locale Formatter Tests
 *
 * Tests for locale-aware formatting of dates, times, numbers, and file sizes.
 */

import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatTime,
  formatFileSize,
  formatNumber,
  formatDateTime,
  formatPercent,
} from '../../src/i18n/localeFormatter';

describe('localeFormatter', () => {
  describe('formatDate()', () => {
    const testDate = new Date('2025-12-18T10:30:00Z');

    it('should format date in short style for English', () => {
      const result = formatDate(testDate, 'en', 'short');
      // Should be MM/DD/YYYY format
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should format date in short style for German', () => {
      const result = formatDate(testDate, 'de', 'short');
      // Should be DD.MM.YYYY format
      expect(result).toMatch(/\d{2}\.\d{2}\.\d{4}/);
    });

    it('should format date in short style for French', () => {
      const result = formatDate(testDate, 'fr', 'short');
      // Should be DD/MM/YYYY format
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should format date in medium style', () => {
      const result = formatDate(testDate, 'en', 'medium');
      // Should include month abbreviation
      expect(result).toMatch(/Dec/);
    });

    it('should format date in long style', () => {
      const result = formatDate(testDate, 'en', 'long');
      // Should include full month name
      expect(result).toMatch(/December/);
    });

    it('should return empty string for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(formatDate(invalidDate, 'en')).toBe('');
    });

    it('should default to short style', () => {
      const result = formatDate(testDate, 'en');
      expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('should default to English locale', () => {
      const result = formatDate(testDate);
      expect(result).toMatch(/\//); // US format uses slashes
    });
  });

  describe('formatTime()', () => {
    const testDate = new Date('2025-12-18T14:30:45Z');

    it('should format time in 12-hour format for English', () => {
      const result = formatTime(testDate, 'en');
      // Should include AM/PM
      expect(result.toLowerCase()).toMatch(/[ap]m/);
    });

    it('should format time in 24-hour format for German', () => {
      const result = formatTime(testDate, 'de');
      // German uses 24-hour format, no AM/PM
      expect(result.toLowerCase()).not.toMatch(/[ap]m/);
    });

    it('should format time in 24-hour format for French', () => {
      const result = formatTime(testDate, 'fr');
      // French uses 24-hour format
      expect(result.toLowerCase()).not.toMatch(/[ap]m/);
    });

    it('should return empty string for invalid date', () => {
      const invalidDate = new Date('invalid');
      expect(formatTime(invalidDate, 'en')).toBe('');
    });
  });

  describe('formatFileSize()', () => {
    it('should format bytes', () => {
      expect(formatFileSize(500, 'en')).toBe('500 B');
    });

    it('should format kilobytes', () => {
      const result = formatFileSize(1536, 'en');
      expect(result).toContain('KB');
    });

    it('should format megabytes', () => {
      const result = formatFileSize(1048576 * 2.5, 'en');
      expect(result).toContain('MB');
    });

    it('should format gigabytes', () => {
      const result = formatFileSize(1073741824 * 1.5, 'en');
      expect(result).toContain('GB');
    });

    it('should use locale-specific number format for German', () => {
      const result = formatFileSize(1536, 'de');
      // German uses comma as decimal separator
      expect(result).toContain(',');
    });

    it('should handle zero bytes', () => {
      expect(formatFileSize(0, 'en')).toBe('0 B');
    });

    it('should handle negative bytes', () => {
      expect(formatFileSize(-100, 'en')).toBe('0 B');
    });

    it('should handle invalid input', () => {
      // @ts-expect-error Testing invalid input
      expect(formatFileSize('not a number', 'en')).toBe('0 B');
    });
  });

  describe('formatNumber()', () => {
    it('should format number for English locale', () => {
      const result = formatNumber(1234567.89, 'en');
      // English uses comma as thousands separator
      expect(result).toContain(',');
    });

    it('should format number for German locale', () => {
      const result = formatNumber(1234567.89, 'de');
      // German uses period as thousands separator
      expect(result).toContain('.');
    });

    it('should format number for French locale', () => {
      const result = formatNumber(1234567.89, 'fr');
      // French uses space as thousands separator (may be non-breaking)
      expect(result.replace(/\s/g, ' ')).toMatch(/1\s?234\s?567/);
    });

    it('should respect custom options', () => {
      const result = formatNumber(0.5, 'en', { style: 'percent' });
      expect(result).toContain('%');
    });

    it('should handle non-number input', () => {
      // @ts-expect-error Testing invalid input
      expect(formatNumber('abc', 'en')).toBe('abc');
    });
  });

  describe('formatDateTime()', () => {
    const testDate = new Date('2025-12-18T14:30:00Z');

    it('should combine date and time', () => {
      const result = formatDateTime(testDate, 'en');
      // Should contain both date and time parts
      expect(result).toMatch(/\d/);
      expect(result).toContain(' ');
    });

    it('should use locale-appropriate formatting', () => {
      const enResult = formatDateTime(testDate, 'en');
      const deResult = formatDateTime(testDate, 'de');

      // Results should differ
      expect(enResult).not.toBe(deResult);
    });
  });

  describe('formatPercent()', () => {
    it('should format decimal as percentage', () => {
      const result = formatPercent(0.75, 'en');
      expect(result).toBe('75%');
    });

    it('should format value greater than 1 as percentage', () => {
      // Values > 1 are treated as already being percentages
      const result = formatPercent(75, 'en');
      expect(result).toBe('75%');
    });

    it('should handle decimal places', () => {
      const result = formatPercent(0.7543, 'en', 2);
      expect(result).toBe('75.43%');
    });

    it('should use locale-appropriate formatting for German', () => {
      const result = formatPercent(0.7543, 'de', 2);
      // German uses comma for decimals and different percent symbol placement
      expect(result).toMatch(/75,43\s?%/);
    });

    it('should handle zero', () => {
      expect(formatPercent(0, 'en')).toBe('0%');
    });

    it('should handle invalid input', () => {
      // @ts-expect-error Testing invalid input
      expect(formatPercent('abc', 'en')).toBe('0%');
    });
  });

  describe('unknown locale handling', () => {
    it('should fallback to English for unknown locale in formatDate', () => {
      const testDate = new Date('2025-12-18T10:30:00Z');
      const result = formatDate(testDate, 'zz');
      // Should not throw, should use fallback
      expect(result).toBeDefined();
    });

    it('should fallback to English for unknown locale in formatNumber', () => {
      const result = formatNumber(1234.56, 'zz');
      expect(result).toBeDefined();
    });
  });
});
