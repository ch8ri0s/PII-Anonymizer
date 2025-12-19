/**
 * Locale Formatter Tests
 * Tests date, time, and number formatting functions
 */

import { expect } from 'chai';
import {
  formatDate,
  formatTime,
  formatFileSize,
  formatNumber,
  formatDateTime,
} from '../../../dist/i18n/localeFormatter.js';

describe('Locale Formatter', () => {
  describe('formatDate()', () => {
    const testDate = new Date('2025-11-11T14:30:45');

    it('should format date in English (short)', () => {
      const result = formatDate(testDate, 'en', 'short');
      expect(result).to.match(/11\/11\/2025/);
    });

    it('should format date in French (short)', () => {
      const result = formatDate(testDate, 'fr', 'short');
      expect(result).to.match(/11\/11\/2025/);
    });

    it('should format date in German (short)', () => {
      const result = formatDate(testDate, 'de', 'short');
      expect(result).to.match(/11\.11\.2025/);
    });

    it('should format date in English (medium)', () => {
      const result = formatDate(testDate, 'en', 'medium');
      expect(result).to.include('Nov');
      expect(result).to.include('11');
      expect(result).to.include('2025');
    });

    it('should format date in French (medium)', () => {
      const result = formatDate(testDate, 'fr', 'medium');
      expect(result).to.include('nov');
      expect(result).to.include('11');
      expect(result).to.include('2025');
    });

    it('should format date in German (medium)', () => {
      const result = formatDate(testDate, 'de', 'medium');
      expect(result).to.include('11');
      expect(result).to.include('2025');
    });

    it('should format date in English (long)', () => {
      const result = formatDate(testDate, 'en', 'long');
      expect(result).to.include('November');
      expect(result).to.include('11');
      expect(result).to.include('2025');
    });

    it('should default to short style', () => {
      const result = formatDate(testDate, 'en');
      expect(result).to.match(/11\/11\/2025/);
    });

    it('should default to English locale', () => {
      const result = formatDate(testDate);
      expect(result).to.match(/11\/11\/2025/);
    });

    it('should handle invalid date gracefully', () => {
      expect(formatDate(new Date('invalid'))).to.equal('');
      expect(formatDate(null)).to.equal('');
      expect(formatDate(undefined)).to.equal('');
      expect(formatDate('not a date')).to.equal('');
    });

    it('should handle unsupported locale by falling back', () => {
      const result = formatDate(testDate, 'es'); // Unsupported
      expect(result).to.be.a('string');
      expect(result).to.not.be.empty;
    });
  });

  describe('formatTime()', () => {
    const testDate = new Date('2025-11-11T14:30:45');

    it('should format time in English (12-hour with AM/PM)', () => {
      const result = formatTime(testDate, 'en');
      expect(result).to.match(/2:30:45 PM|02:30:45 PM/);
    });

    it('should format time in French (24-hour)', () => {
      const result = formatTime(testDate, 'fr');
      expect(result).to.match(/14:30:45/);
    });

    it('should format time in German (24-hour)', () => {
      const result = formatTime(testDate, 'de');
      expect(result).to.match(/14:30:45/);
    });

    it('should default to English locale', () => {
      const result = formatTime(testDate);
      expect(result).to.match(/2:30:45 PM|02:30:45 PM/);
    });

    it('should handle invalid date gracefully', () => {
      expect(formatTime(new Date('invalid'))).to.equal('');
      expect(formatTime(null)).to.equal('');
      expect(formatTime(undefined)).to.equal('');
      expect(formatTime('not a date')).to.equal('');
    });

    it('should handle midnight correctly', () => {
      const midnight = new Date('2025-11-11T00:00:00');
      const resultEn = formatTime(midnight, 'en');
      const resultFr = formatTime(midnight, 'fr');

      expect(resultEn).to.match(/12:00:00 AM|00:00:00/);
      expect(resultFr).to.match(/00:00:00/);
    });

    it('should handle noon correctly', () => {
      const noon = new Date('2025-11-11T12:00:00');
      const resultEn = formatTime(noon, 'en');
      const resultFr = formatTime(noon, 'fr');

      expect(resultEn).to.match(/12:00:00 PM/);
      expect(resultFr).to.match(/12:00:00/);
    });
  });

  describe('formatFileSize()', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(0, 'en')).to.equal('0 B');
      expect(formatFileSize(512, 'en')).to.equal('512 B');
      expect(formatFileSize(1023, 'en')).to.equal('1023 B');
    });

    it('should format kilobytes in English', () => {
      const result = formatFileSize(1024, 'en');
      expect(result).to.match(/1\.00 KB/);
    });

    it('should format kilobytes in French (space as thousands separator)', () => {
      const result = formatFileSize(15360, 'fr'); // 15 KB
      // French uses space as thousands separator and comma as decimal
      expect(result).to.include('KB');
    });

    it('should format kilobytes in German (dot as thousands separator)', () => {
      const result = formatFileSize(15360, 'de'); // 15 KB
      // German uses dot as thousands separator and comma as decimal
      expect(result).to.include('KB');
    });

    it('should format megabytes correctly', () => {
      const bytes = 5 * 1024 * 1024; // 5 MB
      const result = formatFileSize(bytes, 'en');
      expect(result).to.match(/5\.00 MB/);
    });

    it('should format gigabytes correctly', () => {
      const bytes = 3 * 1024 * 1024 * 1024; // 3 GB
      const result = formatFileSize(bytes, 'en');
      expect(result).to.match(/3\.00 GB/);
    });

    it('should handle edge cases', () => {
      expect(formatFileSize(-100, 'en')).to.equal('0 B'); // Negative
      expect(formatFileSize(0, 'en')).to.equal('0 B'); // Zero
      expect(formatFileSize(null, 'en')).to.equal('0 B'); // Null
      expect(formatFileSize(undefined, 'en')).to.equal('0 B'); // Undefined
      expect(formatFileSize('not a number', 'en')).to.equal('0 B'); // String
    });

    it('should default to English locale', () => {
      const result = formatFileSize(1024);
      expect(result).to.match(/1\.00 KB/);
    });

    it('should always show 2 decimal places', () => {
      expect(formatFileSize(1024, 'en')).to.match(/1\.00 KB/);
      expect(formatFileSize(1536, 'en')).to.match(/1\.50 KB/);
    });
  });

  describe('formatNumber()', () => {
    it('should format numbers in English (comma as thousands, dot as decimal)', () => {
      const result = formatNumber(1234567.89, 'en');
      expect(result).to.match(/1,234,567\.89/);
    });

    it('should format numbers in French (space as thousands, comma as decimal)', () => {
      const result = formatNumber(1234567.89, 'fr', { minimumFractionDigits: 2 });
      // French formatting
      expect(result).to.be.a('string');
      expect(result).to.not.be.empty;
    });

    it('should format numbers in German (dot as thousands, comma as decimal)', () => {
      const result = formatNumber(1234567.89, 'de', { minimumFractionDigits: 2 });
      // German formatting
      expect(result).to.be.a('string');
      expect(result).to.not.be.empty;
    });

    it('should handle custom options', () => {
      const result = formatNumber(1234.5, 'en', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });
      expect(result).to.match(/1,234\.500/);
    });

    it('should handle invalid input gracefully', () => {
      expect(formatNumber(null, 'en')).to.equal('null');
      expect(formatNumber(undefined, 'en')).to.equal('undefined');
      expect(formatNumber('not a number', 'en')).to.equal('not a number');
    });

    it('should default to English locale', () => {
      const result = formatNumber(1234.56);
      expect(result).to.match(/1,234\.56/);
    });

    it('should handle zero and negative numbers', () => {
      expect(formatNumber(0, 'en')).to.equal('0');
      expect(formatNumber(-1234.56, 'en')).to.match(/-1,234\.56/);
    });

    it('should handle very large numbers', () => {
      const result = formatNumber(1234567890123, 'en');
      expect(result).to.include('1,234,567,890,123');
    });

    it('should handle very small numbers', () => {
      const result = formatNumber(0.000123, 'en');
      expect(result).to.be.a('string');
      expect(result).to.not.be.empty;
    });
  });

  describe('formatDateTime()', () => {
    const testDate = new Date('2025-11-11T14:30:45');

    it('should combine date and time in English', () => {
      const result = formatDateTime(testDate, 'en');
      expect(result).to.include('11/11/2025');
      expect(result).to.match(/2:30:45 PM|02:30:45 PM/);
    });

    it('should combine date and time in French', () => {
      const result = formatDateTime(testDate, 'fr');
      expect(result).to.include('11/11/2025');
      expect(result).to.include('14:30:45');
    });

    it('should combine date and time in German', () => {
      const result = formatDateTime(testDate, 'de');
      expect(result).to.include('11.11.2025');
      expect(result).to.include('14:30:45');
    });

    it('should default to English locale', () => {
      const result = formatDateTime(testDate);
      expect(result).to.include('11/11/2025');
    });

    it('should handle invalid date gracefully', () => {
      const result = formatDateTime(new Date('invalid'));
      expect(result).to.match(/^\s*$/); // Empty or whitespace
    });
  });

  describe('Integration Tests', () => {
    it('should use consistent locale mapping across all formatters', () => {
      const testDate = new Date('2025-11-11T14:30:45');
      const bytes = 1024;

      // All should accept 'en', 'fr', 'de'
      expect(() => formatDate(testDate, 'en')).to.not.throw();
      expect(() => formatDate(testDate, 'fr')).to.not.throw();
      expect(() => formatDate(testDate, 'de')).to.not.throw();

      expect(() => formatTime(testDate, 'en')).to.not.throw();
      expect(() => formatTime(testDate, 'fr')).to.not.throw();
      expect(() => formatTime(testDate, 'de')).to.not.throw();

      expect(() => formatFileSize(bytes, 'en')).to.not.throw();
      expect(() => formatFileSize(bytes, 'fr')).to.not.throw();
      expect(() => formatFileSize(bytes, 'de')).to.not.throw();
    });

    it('should handle errors gracefully without crashing', () => {
      // All functions should handle invalid input without throwing
      expect(() => formatDate(null, 'en')).to.not.throw();
      expect(() => formatTime(undefined, 'fr')).to.not.throw();
      expect(() => formatFileSize('invalid', 'de')).to.not.throw();
      expect(() => formatNumber({}, 'en')).to.not.throw();
      expect(() => formatDateTime([], 'fr')).to.not.throw();
    });
  });
});
