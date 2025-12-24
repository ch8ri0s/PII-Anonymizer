/**
 * LogAnonymizer Tests
 *
 * Story 7.8: User Correction Feedback Logging
 * AC #8: No PII is ever stored in logs - all text is anonymized before storage
 */

import { describe, it, expect } from 'vitest';
import {
  anonymizeForLog,
  hashDocumentName,
  generateId,
  getTypeMarker,
  getCurrentMonth,
  isMonthExpired,
} from '../../src/services/LogAnonymizer';

describe('LogAnonymizer', () => {
  describe('getTypeMarker', () => {
    it('should return correct marker for known entity types', () => {
      expect(getTypeMarker('PERSON')).toBe('[PERSON]');
      expect(getTypeMarker('EMAIL')).toBe('[EMAIL]');
      expect(getTypeMarker('PHONE')).toBe('[PHONE]');
      expect(getTypeMarker('IBAN')).toBe('[IBAN]');
      expect(getTypeMarker('ADDRESS')).toBe('[ADDRESS]');
      expect(getTypeMarker('ORGANIZATION')).toBe('[ORG]');
      expect(getTypeMarker('ORG')).toBe('[ORG]');
    });

    it('should handle type aliases', () => {
      expect(getTypeMarker('PERSON_NAME')).toBe('[PERSON]');
      expect(getTypeMarker('STREET_ADDRESS')).toBe('[ADDRESS]');
      expect(getTypeMarker('SWISS_AVS')).toBe('[AVS]');
      expect(getTypeMarker('AVS')).toBe('[AVS]');
    });

    it('should return [PII] for unknown types', () => {
      expect(getTypeMarker('UNKNOWN_TYPE')).toBe('[PII]');
      expect(getTypeMarker('RANDOM')).toBe('[PII]');
    });
  });

  describe('anonymizeForLog', () => {
    it('should return empty string for empty input', () => {
      expect(anonymizeForLog('', 'PERSON')).toBe('');
      expect(anonymizeForLog('', 'EMAIL', 'john@example.com')).toBe('');
    });

    it('should replace specific original text with type marker', () => {
      const text = 'Contact John Smith at the office';
      const result = anonymizeForLog(text, 'PERSON', 'John Smith');
      expect(result).toBe('Contact [PERSON] at the office');
    });

    it('should handle case-insensitive replacement', () => {
      const text = 'Contact JOHN SMITH at john smith office';
      const result = anonymizeForLog(text, 'PERSON', 'John Smith');
      expect(result).toBe('Contact [PERSON] at [PERSON] office');
    });

    it('should escape regex special characters in original text', () => {
      const text = 'Company A+B (Partners) Inc.';
      const result = anonymizeForLog(text, 'ORGANIZATION', 'A+B (Partners)');
      expect(result).toBe('Company [ORG] Inc.');
    });

    it('should anonymize email patterns in context', () => {
      const text = 'Send to john.doe@example.com and jane@test.org';
      const result = anonymizeForLog(text, 'EMAIL');
      expect(result).toBe('Send to [EMAIL] and [EMAIL]');
    });

    it('should anonymize Swiss phone numbers', () => {
      const text = 'Call +41 79 123 45 67 or 079 123 45 67';
      const result = anonymizeForLog(text, 'PHONE');
      expect(result).toBe('Call [PHONE] or [PHONE]');
    });

    it('should anonymize phone with different formats', () => {
      expect(anonymizeForLog('Phone: 0041.79.123.45.67', 'PHONE')).toContain('[PHONE]');
      expect(anonymizeForLog('Phone: 079-123-45-67', 'PHONE')).toContain('[PHONE]');
    });

    it('should anonymize IBAN numbers', () => {
      const text = 'Account: CH93 0076 2011 6238 5295 7';
      const result = anonymizeForLog(text, 'IBAN');
      expect(result).toContain('[IBAN]');
    });

    it('should handle IBAN without spaces', () => {
      const text = 'IBAN: CH9300762011623852957';
      const result = anonymizeForLog(text, 'IBAN');
      expect(result).toContain('[IBAN]');
    });

    it('should anonymize Swiss AVS numbers', () => {
      const text = 'AVS: 756.1234.5678.90';
      const result = anonymizeForLog(text, 'AVS');
      expect(result).toContain('[AVS]');
    });

    it('should handle AVS with different separators', () => {
      expect(anonymizeForLog('756-1234-5678-90', 'AVS')).toContain('[AVS]');
      expect(anonymizeForLog('756 1234 5678 90', 'AVS')).toContain('[AVS]');
    });

    it('should anonymize Swiss postal codes', () => {
      const text = 'Living in 1000 Lausanne, 8001 Zurich';
      const result = anonymizeForLog(text, 'ADDRESS');
      expect(result).toContain('[POSTAL]');
    });

    it('should handle multiple PII types in one text', () => {
      const text = 'John at john@example.com, phone +41 79 123 45 67';
      const result = anonymizeForLog(text, 'PERSON', 'John');
      expect(result).toContain('[PERSON]');
      expect(result).toContain('[EMAIL]');
      expect(result).toContain('[PHONE]');
    });

    it('should not modify text without PII patterns', () => {
      const text = 'This is a simple sentence without any PII.';
      const result = anonymizeForLog(text, 'OTHER');
      expect(result).toBe(text);
    });
  });

  describe('hashDocumentName', () => {
    it('should return a 16-character hex string', async () => {
      const hash = await hashDocumentName('document.pdf');
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should return consistent hash for same input', async () => {
      const hash1 = await hashDocumentName('invoice.pdf');
      const hash2 = await hashDocumentName('invoice.pdf');
      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different inputs', async () => {
      const hash1 = await hashDocumentName('file1.pdf');
      const hash2 = await hashDocumentName('file2.pdf');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', async () => {
      const hash = await hashDocumentName('');
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('should handle unicode characters', async () => {
      const hash = await hashDocumentName('Rückmeldung-Böhm.pdf');
      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });
  });

  describe('generateId', () => {
    it('should generate a valid UUID v4', () => {
      const id = generateId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('getCurrentMonth', () => {
    it('should return month in YYYY-MM format', () => {
      const month = getCurrentMonth();
      expect(month).toMatch(/^\d{4}-\d{2}$/);
    });

    it('should return current month', () => {
      const now = new Date();
      const expected = now.toISOString().slice(0, 7);
      expect(getCurrentMonth()).toBe(expected);
    });
  });

  describe('isMonthExpired', () => {
    it('should return false for current month', () => {
      const currentMonth = getCurrentMonth();
      expect(isMonthExpired(currentMonth, 6)).toBe(false);
    });

    it('should return false for month within retention', () => {
      const now = new Date();
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const month = threeMonthsAgo.toISOString().slice(0, 7);
      expect(isMonthExpired(month, 6)).toBe(false);
    });

    it('should return true for month older than retention', () => {
      const now = new Date();
      const eightMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 8, 1);
      const month = eightMonthsAgo.toISOString().slice(0, 7);
      expect(isMonthExpired(month, 6)).toBe(true);
    });

    it('should handle year boundaries', () => {
      // Test a date from more than a year ago
      const now = new Date();
      const thirteenMonthsAgo = new Date(now.getFullYear() - 1, now.getMonth() - 1, 1);
      const month = thirteenMonthsAgo.toISOString().slice(0, 7);
      expect(isMonthExpired(month, 6)).toBe(true);
    });

    it('should respect custom retention period', () => {
      const now = new Date();
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const month = twoMonthsAgo.toISOString().slice(0, 7);

      expect(isMonthExpired(month, 1)).toBe(true); // 1 month retention
      expect(isMonthExpired(month, 3)).toBe(false); // 3 month retention
    });
  });
});
