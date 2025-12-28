/**
 * Translation Coverage Tests
 * Ensures all translation keys exist in all supported languages
 * RED phase: Tests will fail until translation files are created
 */

import { expect } from 'chai';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Test logger for consistent output
import { createTestLogger } from '../../helpers/testLogger.js';
const log = createTestLogger('unit:i18n');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LOCALES_DIR = join(__dirname, '../../../locales');

/**
 * Extract all translation keys from nested object
 * @param {Object} obj - Translation object
 * @param {string} prefix - Current key prefix
 * @returns {string[]} - Array of dot-notation keys
 */
function extractKeys(obj, prefix = '') {
  let keys = [];

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(extractKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

/**
 * Extract all translation values with their keys
 * @param {Object} obj - Translation object
 * @param {string} prefix - Current key prefix
 * @returns {Array<{key: string, value: any}>} - Array of key-value pairs
 */
function extractValues(obj, prefix = '') {
  let values = [];

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      values = values.concat(extractValues(obj[key], fullKey));
    } else {
      values.push({ key: fullKey, value: obj[key] });
    }
  }

  return values;
}

/**
 * Load translation file
 * @param {string} locale - Locale code
 * @returns {Promise<Object>} - Translation data
 */
async function loadTranslations(locale) {
  const filePath = join(LOCALES_DIR, `${locale}.json`);
  const fileContents = await readFile(filePath, 'utf-8');
  return JSON.parse(fileContents);
}

describe('Translation Coverage', () => {
  let enData, frData, deData;

  before(async () => {
    // Load all translation files
    try {
      enData = await loadTranslations('en');
      frData = await loadTranslations('fr');
      deData = await loadTranslations('de');
    } catch (error) {
      log.error('Error loading translation files', { error: error.message });
      throw error;
    }
  });

  describe('Translation Parity', () => {
    it('should have all English keys in French', () => {
      const enKeys = extractKeys(enData.translations);
      const frKeys = extractKeys(frData.translations);

      enKeys.forEach(key => {
        expect(frKeys).to.include(key, `Missing French translation for: ${key}`);
      });
    });

    it('should have all English keys in German', () => {
      const enKeys = extractKeys(enData.translations);
      const deKeys = extractKeys(deData.translations);

      enKeys.forEach(key => {
        expect(deKeys).to.include(key, `Missing German translation for: ${key}`);
      });
    });

    it('should have no extra keys in French (not in English)', () => {
      const enKeys = extractKeys(enData.translations);
      const frKeys = extractKeys(frData.translations);

      frKeys.forEach(key => {
        expect(enKeys).to.include(key, `Extra French translation not in English: ${key}`);
      });
    });

    it('should have no extra keys in German (not in English)', () => {
      const enKeys = extractKeys(enData.translations);
      const deKeys = extractKeys(deData.translations);

      deKeys.forEach(key => {
        expect(enKeys).to.include(key, `Extra German translation not in English: ${key}`);
      });
    });
  });

  describe('Translation Quality', () => {
    it('should have no empty translations in English', () => {
      const values = extractValues(enData.translations);

      values.forEach(({ key, value }) => {
        expect(value).to.be.a('string', `Non-string value for key: ${key}`);
        expect(value.trim().length).to.be.greaterThan(0, `Empty translation for key: ${key}`);
      });
    });

    it('should have no empty translations in French', () => {
      const values = extractValues(frData.translations);

      values.forEach(({ key, value }) => {
        expect(value).to.be.a('string', `Non-string value for key: ${key}`);
        expect(value.trim().length).to.be.greaterThan(0, `Empty translation for key: ${key}`);
      });
    });

    it('should have no empty translations in German', () => {
      const values = extractValues(deData.translations);

      values.forEach(({ key, value }) => {
        expect(value).to.be.a('string', `Non-string value for key: ${key}`);
        expect(value.trim().length).to.be.greaterThan(0, `Empty translation for key: ${key}`);
      });
    });
  });

  describe('Metadata Validation', () => {
    it('should have valid metadata in English file', () => {
      expect(enData.metadata).to.be.an('object');
      expect(enData.metadata.locale).to.equal('en');
      expect(enData.metadata.version).to.be.a('string');
      expect(enData.metadata.lastUpdated).to.be.a('string');
    });

    it('should have valid metadata in French file', () => {
      expect(frData.metadata).to.be.an('object');
      expect(frData.metadata.locale).to.equal('fr');
      expect(frData.metadata.version).to.be.a('string');
      expect(frData.metadata.lastUpdated).to.be.a('string');
    });

    it('should have valid metadata in German file', () => {
      expect(deData.metadata).to.be.an('object');
      expect(deData.metadata.locale).to.equal('de');
      expect(deData.metadata.version).to.be.a('string');
      expect(deData.metadata.lastUpdated).to.be.a('string');
    });

    it('should have matching versions across all locales', () => {
      expect(frData.metadata.version).to.equal(enData.metadata.version, 'French version mismatch');
      expect(deData.metadata.version).to.equal(enData.metadata.version, 'German version mismatch');
    });
  });

  describe('Structure Validation', () => {
    it('should have translations object in all files', () => {
      expect(enData.translations).to.be.an('object');
      expect(frData.translations).to.be.an('object');
      expect(deData.translations).to.be.an('object');
    });

    it('should have non-empty translations object', () => {
      expect(Object.keys(enData.translations).length).to.be.greaterThan(0);
      expect(Object.keys(frData.translations).length).to.be.greaterThan(0);
      expect(Object.keys(deData.translations).length).to.be.greaterThan(0);
    });

    it('should have consistent section structure across locales', () => {
      const enSections = Object.keys(enData.translations);
      const frSections = Object.keys(frData.translations);
      const deSections = Object.keys(deData.translations);

      expect(frSections).to.have.members(enSections, 'French sections mismatch');
      expect(deSections).to.have.members(enSections, 'German sections mismatch');
    });
  });
});
