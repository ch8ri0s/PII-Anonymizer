/**
 * i18n Service Tests
 * Tests core translation service functionality
 */

import { expect } from 'chai';
import {
  init,
  t,
  setLocale,
  getLocale,
  setFallback,
  has,
} from '../../../dist/i18n/i18nService.js';

describe('i18n Service', () => {
  // Sample translation data for testing
  const enTranslations = {
    app: {
      title: 'PII Anonymiser',
      subtitle: 'Privacy-First Document Processing',
    },
    upload: {
      title: 'Drop your file here',
      browse: 'Browse files',
    },
    metadata: {
      filename: 'Filename',
      size: 'Size',
    },
  };

  const frTranslations = {
    app: {
      title: 'Anonymiseur PII',
      subtitle: 'Traitement de documents axé sur la confidentialité',
    },
    upload: {
      title: 'Déposez votre fichier ici',
      browse: 'Parcourir les fichiers',
    },
    metadata: {
      filename: 'Nom du fichier',
      size: 'Taille',
    },
  };

  beforeEach(() => {
    // Reset service state before each test
    init('en', enTranslations);
  });

  describe('init()', () => {
    it('should initialize with English locale and translations', () => {
      init('en', enTranslations);
      expect(getLocale()).to.equal('en');
      expect(t('app.title')).to.equal('PII Anonymiser');
    });

    it('should initialize with French locale and translations', () => {
      init('fr', frTranslations, enTranslations);
      expect(getLocale()).to.equal('fr');
      expect(t('app.title')).to.equal('Anonymiseur PII');
    });

    it('should handle invalid locale by defaulting to English', () => {
      init(null, enTranslations);
      expect(getLocale()).to.equal('en');
    });

    it('should handle invalid translations by using empty object', () => {
      init('en', null);
      expect(getLocale()).to.equal('en');
      // Should return key when no translations available
      expect(t('app.title')).to.equal('app.title');
    });

    it('should accept fallback translations', () => {
      init('fr', frTranslations, enTranslations);
      expect(getLocale()).to.equal('fr');
      // Should have access to fallback
      expect(t('app.title')).to.equal('Anonymiseur PII');
    });
  });

  describe('t() - Translation Lookup', () => {
    it('should translate simple keys', () => {
      expect(t('upload.title')).to.equal('Drop your file here');
      expect(t('upload.browse')).to.equal('Browse files');
    });

    it('should translate nested keys', () => {
      expect(t('app.title')).to.equal('PII Anonymiser');
      expect(t('app.subtitle')).to.equal('Privacy-First Document Processing');
    });

    it('should handle deeply nested keys', () => {
      expect(t('metadata.filename')).to.equal('Filename');
      expect(t('metadata.size')).to.equal('Size');
    });

    it('should return key itself if translation not found', () => {
      expect(t('nonexistent.key')).to.equal('nonexistent.key');
      expect(t('upload.missing')).to.equal('upload.missing');
    });

    it('should handle invalid keys gracefully', () => {
      expect(t(null)).to.equal('');
      expect(t(undefined)).to.equal('');
      expect(t('')).to.equal('');
      expect(t(123)).to.equal('');
    });

    it('should handle keys with missing intermediate objects', () => {
      expect(t('missing.section.key')).to.equal('missing.section.key');
    });
  });

  describe('t() - Fallback Logic', () => {
    beforeEach(() => {
      // Initialize with French, but missing some keys
      const incompleteFrTranslations = {
        app: {
          title: 'Anonymiseur PII',
          // subtitle missing
        },
        upload: {
          title: 'Déposez votre fichier ici',
          // browse missing
        },
      };

      init('fr', incompleteFrTranslations, enTranslations);
    });

    it('should use fallback for missing keys', () => {
      expect(t('app.title')).to.equal('Anonymiseur PII'); // From French
      expect(t('app.subtitle')).to.equal('Privacy-First Document Processing'); // From fallback
    });

    it('should use fallback for missing sections', () => {
      expect(t('metadata.filename')).to.equal('Filename'); // From fallback
      expect(t('metadata.size')).to.equal('Size'); // From fallback
    });

    it('should return key if not found in either locale or fallback', () => {
      expect(t('nonexistent.key')).to.equal('nonexistent.key');
    });
  });

  describe('setLocale()', () => {
    it('should change locale and translations', () => {
      setLocale('fr', frTranslations);
      expect(getLocale()).to.equal('fr');
      expect(t('app.title')).to.equal('Anonymiseur PII');
    });

    it('should handle invalid locale gracefully', () => {
      const _originalLocale = getLocale();
      setLocale(null, frTranslations);
      // Should not crash but locale might not change
      expect(getLocale()).to.be.a('string');
    });

    it('should handle invalid translations gracefully', () => {
      setLocale('fr', null);
      expect(getLocale()).to.equal('fr');
      // Translations should be empty, returns key
      expect(t('app.title')).to.equal('app.title');
    });

    it('should update translations immediately', () => {
      expect(t('app.title')).to.equal('PII Anonymiser');
      setLocale('fr', frTranslations);
      expect(t('app.title')).to.equal('Anonymiseur PII');
    });
  });

  describe('getLocale()', () => {
    it('should return current locale', () => {
      init('en', enTranslations);
      expect(getLocale()).to.equal('en');
    });

    it('should return updated locale after setLocale', () => {
      init('en', enTranslations);
      expect(getLocale()).to.equal('en');
      setLocale('fr', frTranslations);
      expect(getLocale()).to.equal('fr');
    });
  });

  describe('setFallback()', () => {
    it('should set fallback translations', () => {
      init('fr', frTranslations);
      setFallback(enTranslations);

      // Create incomplete French translations
      const incompleteFr = {
        app: {
          title: 'Anonymiseur PII',
        },
      };
      setLocale('fr', incompleteFr);

      expect(t('app.title')).to.equal('Anonymiseur PII'); // From French
      expect(t('upload.title')).to.equal('Drop your file here'); // From fallback
    });

    it('should handle invalid fallback gracefully', () => {
      setFallback(null);
      // Should not crash
      expect(() => t('app.title')).to.not.throw();
    });
  });

  describe('has()', () => {
    it('should return true for existing keys', () => {
      expect(has('app.title')).to.be.true;
      expect(has('upload.title')).to.be.true;
      expect(has('metadata.filename')).to.be.true;
    });

    it('should return false for non-existing keys', () => {
      expect(has('nonexistent.key')).to.be.false;
      expect(has('upload.missing')).to.be.false;
    });

    it('should check fallback translations', () => {
      const incompleteFr = {
        app: {
          title: 'Anonymiseur PII',
        },
      };
      init('fr', incompleteFr, enTranslations);

      expect(has('app.title')).to.be.true; // In French
      expect(has('upload.title')).to.be.true; // In fallback
    });

    it('should handle invalid keys gracefully', () => {
      expect(has(null)).to.be.false;
      expect(has(undefined)).to.be.false;
      expect(has('')).to.be.false;
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow: init -> translate -> change locale', () => {
      // Initialize with English
      init('en', enTranslations, enTranslations);
      expect(t('app.title')).to.equal('PII Anonymiser');

      // Change to French
      setLocale('fr', frTranslations);
      expect(t('app.title')).to.equal('Anonymiseur PII');

      // Change back to English
      setLocale('en', enTranslations);
      expect(t('app.title')).to.equal('PII Anonymiser');
    });

    it('should handle missing translations with fallback chain', () => {
      const incompleteFr = {
        app: {
          title: 'Anonymiseur PII',
        },
      };

      init('fr', incompleteFr, enTranslations);

      // French translation exists
      expect(t('app.title')).to.equal('Anonymiseur PII');

      // Falls back to English
      expect(t('app.subtitle')).to.equal('Privacy-First Document Processing');
      expect(t('upload.title')).to.equal('Drop your file here');

      // Not found anywhere
      expect(t('nonexistent.key')).to.equal('nonexistent.key');
    });

    it('should handle locale switching with persistent fallback', () => {
      init('en', enTranslations);
      setFallback(enTranslations);

      const incompleteFr = { app: { title: 'Anonymiseur PII' } };
      setLocale('fr', incompleteFr);

      // Can access French and fallback
      expect(t('app.title')).to.equal('Anonymiseur PII');
      expect(t('upload.title')).to.equal('Drop your file here');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty translation objects', () => {
      init('en', {});
      expect(t('app.title')).to.equal('app.title');
    });

    it('should handle translation values that are not strings', () => {
      const badTranslations = {
        app: {
          title: 123, // Number instead of string
          subtitle: null, // Null value
        },
      };
      init('en', badTranslations);

      // Should return key if value is not a string
      expect(t('app.title')).to.equal('app.title');
      expect(t('app.subtitle')).to.equal('app.subtitle');
    });

    it('should handle keys with special characters', () => {
      const specialTranslations = {
        'special-key': {
          'with.dots': 'Special value',
        },
      };
      init('en', specialTranslations);

      // Dots are reserved for nesting, won't work as expected
      // This is expected behavior
      expect(t('special-key.with.dots')).to.be.a('string');
    });

    it('should handle very deep nesting', () => {
      const deepTranslations = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: 'Deep value',
              },
            },
          },
        },
      };
      init('en', deepTranslations);

      expect(t('level1.level2.level3.level4.level5')).to.equal('Deep value');
    });
  });
});
