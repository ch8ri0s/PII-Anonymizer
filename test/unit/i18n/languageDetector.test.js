/**
 * Language Detector Tests
 * Tests language detection and validation functions
 */

import { expect } from 'chai';
import { detectLanguage, getLocaleInfo, isValidLocale } from '../../../dist/i18n/languageDetector.js';

describe('Language Detector', () => {
  describe('detectLanguage()', () => {
    it('should detect English from en-US', () => {
      expect(detectLanguage('en-US')).to.equal('en');
    });

    it('should detect English from en-GB', () => {
      expect(detectLanguage('en-GB')).to.equal('en');
    });

    it('should detect French from fr-FR', () => {
      expect(detectLanguage('fr-FR')).to.equal('fr');
    });

    it('should detect French from fr-CA', () => {
      expect(detectLanguage('fr-CA')).to.equal('fr');
    });

    it('should detect French from fr-CH', () => {
      expect(detectLanguage('fr-CH')).to.equal('fr');
    });

    it('should detect German from de-DE', () => {
      expect(detectLanguage('de-DE')).to.equal('de');
    });

    it('should detect German from de-AT', () => {
      expect(detectLanguage('de-AT')).to.equal('de');
    });

    it('should detect German from de-CH', () => {
      expect(detectLanguage('de-CH')).to.equal('de');
    });

    it('should handle lowercase locale codes', () => {
      expect(detectLanguage('en-us')).to.equal('en');
      expect(detectLanguage('fr-fr')).to.equal('fr');
      expect(detectLanguage('de-de')).to.equal('de');
    });

    it('should handle uppercase locale codes', () => {
      expect(detectLanguage('EN-US')).to.equal('en');
      expect(detectLanguage('FR-FR')).to.equal('fr');
      expect(detectLanguage('DE-DE')).to.equal('de');
    });

    it('should handle mixed case locale codes', () => {
      expect(detectLanguage('En-Us')).to.equal('en');
      expect(detectLanguage('Fr-Fr')).to.equal('fr');
      expect(detectLanguage('De-De')).to.equal('de');
    });

    it('should fallback to English for unsupported languages', () => {
      expect(detectLanguage('es-ES')).to.equal('en'); // Spanish
      expect(detectLanguage('it-IT')).to.equal('en'); // Italian
      expect(detectLanguage('ja-JP')).to.equal('en'); // Japanese
      expect(detectLanguage('zh-CN')).to.equal('en'); // Chinese
    });

    it('should fallback to English for invalid input', () => {
      expect(detectLanguage(null)).to.equal('en');
      expect(detectLanguage(undefined)).to.equal('en');
      expect(detectLanguage('')).to.equal('en');
      expect(detectLanguage(123)).to.equal('en');
      expect(detectLanguage({})).to.equal('en');
    });

    it('should handle short locale codes (2 characters)', () => {
      expect(detectLanguage('en')).to.equal('en');
      expect(detectLanguage('fr')).to.equal('fr');
      expect(detectLanguage('de')).to.equal('de');
    });

    it('should handle single character input', () => {
      expect(detectLanguage('e')).to.equal('en'); // Too short, fallback
    });
  });

  describe('getLocaleInfo()', () => {
    it('should return full locale info for English', () => {
      const info = getLocaleInfo('en-US');

      expect(info).to.be.an('object');
      expect(info.systemLocale).to.equal('en-US');
      expect(info.language).to.equal('en');
      expect(info.supported).to.be.true;
      expect(info.fallback).to.be.undefined;
    });

    it('should return full locale info for French', () => {
      const info = getLocaleInfo('fr-FR');

      expect(info).to.be.an('object');
      expect(info.systemLocale).to.equal('fr-FR');
      expect(info.language).to.equal('fr');
      expect(info.supported).to.be.true;
      expect(info.fallback).to.be.undefined;
    });

    it('should return full locale info for German', () => {
      const info = getLocaleInfo('de-DE');

      expect(info).to.be.an('object');
      expect(info.systemLocale).to.equal('de-DE');
      expect(info.language).to.equal('de');
      expect(info.supported).to.be.true;
      expect(info.fallback).to.be.undefined;
    });

    it('should include fallback info for unsupported languages', () => {
      const info = getLocaleInfo('es-ES');

      expect(info).to.be.an('object');
      expect(info.systemLocale).to.equal('es-ES');
      expect(info.language).to.equal('en');
      expect(info.supported).to.be.false;
      expect(info.fallback).to.equal('en');
    });

    it('should handle invalid input gracefully', () => {
      const info = getLocaleInfo(null);

      expect(info).to.be.an('object');
      expect(info.language).to.equal('en');
      expect(info.supported).to.be.true;
    });

    it('should handle regional variants correctly', () => {
      const frCH = getLocaleInfo('fr-CH'); // Swiss French
      expect(frCH.language).to.equal('fr');
      expect(frCH.supported).to.be.true;

      const deAT = getLocaleInfo('de-AT'); // Austrian German
      expect(deAT.language).to.equal('de');
      expect(deAT.supported).to.be.true;
    });
  });

  describe('isValidLocale()', () => {
    it('should return true for supported locales', () => {
      expect(isValidLocale('en')).to.be.true;
      expect(isValidLocale('fr')).to.be.true;
      expect(isValidLocale('de')).to.be.true;
    });

    it('should return false for unsupported locales', () => {
      expect(isValidLocale('es')).to.be.false;
      expect(isValidLocale('it')).to.be.false;
      expect(isValidLocale('ja')).to.be.false;
      expect(isValidLocale('zh')).to.be.false;
    });

    it('should return false for invalid input', () => {
      expect(isValidLocale(null)).to.be.false;
      expect(isValidLocale(undefined)).to.be.false;
      expect(isValidLocale('')).to.be.false;
      expect(isValidLocale(123)).to.be.false;
      expect(isValidLocale({})).to.be.false;
    });

    it('should be case-sensitive (lowercase only)', () => {
      expect(isValidLocale('EN')).to.be.false;
      expect(isValidLocale('Fr')).to.be.false;
      expect(isValidLocale('DE')).to.be.false;
    });

    it('should not accept locale with region codes', () => {
      expect(isValidLocale('en-US')).to.be.false;
      expect(isValidLocale('fr-FR')).to.be.false;
      expect(isValidLocale('de-DE')).to.be.false;
    });
  });

  describe('Integration Tests', () => {
    it('should handle typical detection workflow', () => {
      const systemLocale = 'fr-FR';
      const language = detectLanguage(systemLocale);

      expect(language).to.equal('fr');
      expect(isValidLocale(language)).to.be.true;
    });

    it('should handle unsupported language workflow', () => {
      const systemLocale = 'es-ES';
      const language = detectLanguage(systemLocale);

      expect(language).to.equal('en'); // Fallback
      expect(isValidLocale(language)).to.be.true;
    });

    it('should provide consistent results between detectLanguage and getLocaleInfo', () => {
      const testCases = ['en-US', 'fr-FR', 'de-DE', 'es-ES'];

      testCases.forEach(systemLocale => {
        const language = detectLanguage(systemLocale);
        const info = getLocaleInfo(systemLocale);

        expect(info.language).to.equal(language);
      });
    });
  });
});
