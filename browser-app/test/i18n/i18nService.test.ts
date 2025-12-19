/**
 * i18n Service Tests
 *
 * Tests for browser-based internationalization service.
 * Covers translation loading, key lookup, and fallback logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { initWithTranslations, t, getLocale, has, isReady } from '../../src/i18n/i18nService';

describe('i18nService', () => {
  // Sample translation objects
  const englishTranslations = {
    app: {
      title: 'PII Anonymizer',
      subtitle: 'Upload documents to anonymize',
    },
    upload: {
      heading: 'Drop your file here',
      text: 'or click to browse',
    },
    messages: {
      success: 'File processed successfully',
    },
  };

  const germanTranslations = {
    app: {
      title: 'PII Anonymisierer',
      subtitle: 'Dokumente zum Anonymisieren hochladen',
    },
    upload: {
      heading: 'Datei hier ablegen',
      // Missing 'text' key - should fallback
    },
    // Missing 'messages' section - should fallback
  };

  beforeEach(() => {
    // Reset with English translations
    initWithTranslations('en', englishTranslations, null);
  });

  describe('initWithTranslations()', () => {
    it('should initialize with valid locale and translations', () => {
      initWithTranslations('en', englishTranslations, null);

      expect(getLocale()).toBe('en');
      expect(isReady()).toBe(true);
    });

    it('should default to English for invalid locale', () => {
      initWithTranslations(null, englishTranslations, null);

      expect(getLocale()).toBe('en');
    });

    it('should handle undefined translations gracefully', () => {
      initWithTranslations('en', undefined, null);

      expect(getLocale()).toBe('en');
      // Should not throw when translations are undefined
    });
  });

  describe('t() - translation lookup', () => {
    it('should return translation for valid key', () => {
      const result = t('app.title');

      expect(result).toBe('PII Anonymizer');
    });

    it('should return nested translation', () => {
      const result = t('upload.heading');

      expect(result).toBe('Drop your file here');
    });

    it('should return key if translation not found', () => {
      const result = t('nonexistent.key');

      expect(result).toBe('nonexistent.key');
    });

    it('should return empty string for invalid key', () => {
      // @ts-expect-error Testing invalid input
      const result = t(null);

      expect(result).toBe('');
    });

    it('should handle deeply nested keys', () => {
      const result = t('messages.success');

      expect(result).toBe('File processed successfully');
    });
  });

  describe('fallback behavior', () => {
    it('should use fallback when key missing in current locale', () => {
      initWithTranslations('de', germanTranslations, englishTranslations);

      // This key exists in German
      expect(t('app.title')).toBe('PII Anonymisierer');

      // This key is missing in German, should fallback to English
      expect(t('upload.text')).toBe('or click to browse');
    });

    it('should use fallback for missing sections', () => {
      initWithTranslations('de', germanTranslations, englishTranslations);

      // Entire 'messages' section is missing in German
      expect(t('messages.success')).toBe('File processed successfully');
    });

    it('should return key when missing in both locales', () => {
      initWithTranslations('de', germanTranslations, englishTranslations);

      expect(t('completely.unknown.key')).toBe('completely.unknown.key');
    });
  });

  describe('has() - key existence check', () => {
    it('should return true for existing key', () => {
      expect(has('app.title')).toBe(true);
    });

    it('should return true for nested key', () => {
      expect(has('upload.heading')).toBe(true);
    });

    it('should return false for non-existing key', () => {
      expect(has('nonexistent.key')).toBe(false);
    });

    it('should check fallback translations', () => {
      initWithTranslations('de', germanTranslations, englishTranslations);

      // Key exists in fallback
      expect(has('messages.success')).toBe(true);
    });
  });

  describe('getLocale()', () => {
    it('should return current locale', () => {
      initWithTranslations('fr', {}, null);

      expect(getLocale()).toBe('fr');
    });

    it('should update after locale change', () => {
      initWithTranslations('en', {}, null);
      expect(getLocale()).toBe('en');

      initWithTranslations('de', {}, null);
      expect(getLocale()).toBe('de');
    });
  });

  describe('isReady()', () => {
    it('should return true after initialization', () => {
      initWithTranslations('en', {}, null);

      expect(isReady()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty translation object', () => {
      initWithTranslations('en', {}, null);

      expect(t('any.key')).toBe('any.key');
    });

    it('should handle key with single segment', () => {
      const simpleTranslations = {
        title: 'Simple Title',
      };
      initWithTranslations('en', simpleTranslations, null);

      expect(t('title')).toBe('Simple Title');
    });

    it('should not return non-string values', () => {
      const mixedTranslations = {
        number: 42,
        object: { nested: 'value' },
        array: ['a', 'b'],
      };
      initWithTranslations('en', mixedTranslations as any, null);

      // Non-string values should return the key
      expect(t('number')).toBe('number');
      expect(t('object')).toBe('object');
      expect(t('array')).toBe('array');
    });

    it('should handle empty string key', () => {
      expect(t('')).toBe('');
    });
  });
});
