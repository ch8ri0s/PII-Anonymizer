/**
 * Unit tests for ContextWords database
 *
 * Tests for Story 8.2: Context Words Database
 * Validates context word lookups, weights, polarity, and metadata.
 */

import { expect } from 'chai';
import {
  getContextWords,
  getContextWordStrings,
  getAllContextWords,
  getPositiveContextWords,
  getNegativeContextWords,
  getMetadata,
  getSupportedEntityTypes,
  getSupportedLanguages,
  CONTEXT_WORDS,
  CONTEXT_WORDS_METADATA,
} from '../../../../shared/dist/pii/index.js';

describe('ContextWords Database', () => {
  describe('AC-8.2.1: PERSON_NAME context words for EN, FR, DE', () => {
    it('should return English PERSON_NAME context words', () => {
      const words = getContextWords('PERSON_NAME', 'en');

      expect(words).to.be.an('array').that.is.not.empty;
      expect(words.length).to.be.greaterThan(10);
    });

    it('should return French PERSON_NAME context words', () => {
      const words = getContextWords('PERSON_NAME', 'fr');

      expect(words).to.be.an('array').that.is.not.empty;
      expect(words.length).to.be.greaterThan(10);
    });

    it('should return German PERSON_NAME context words', () => {
      const words = getContextWords('PERSON_NAME', 'de');

      expect(words).to.be.an('array').that.is.not.empty;
      expect(words.length).to.be.greaterThan(10);
    });
  });

  describe('AC-8.2.2: PHONE_NUMBER context words for EN, FR, DE', () => {
    it('should return English PHONE_NUMBER context words', () => {
      const words = getContextWords('PHONE_NUMBER', 'en');

      expect(words).to.be.an('array').that.is.not.empty;
      const wordStrings = words.map((w) => w.word);
      expect(wordStrings).to.include('phone');
      expect(wordStrings).to.include('tel');
      expect(wordStrings).to.include('mobile');
    });

    it('should return French PHONE_NUMBER context words', () => {
      const words = getContextWords('PHONE_NUMBER', 'fr');

      expect(words).to.be.an('array').that.is.not.empty;
      const wordStrings = words.map((w) => w.word);
      expect(wordStrings).to.include('téléphone');
    });

    it('should return German PHONE_NUMBER context words', () => {
      const words = getContextWords('PHONE_NUMBER', 'de');

      expect(words).to.be.an('array').that.is.not.empty;
      const wordStrings = words.map((w) => w.word);
      expect(wordStrings).to.include('telefon');
      expect(wordStrings).to.include('handy');
    });
  });

  describe('AC-8.2.3: EMAIL context words', () => {
    it('should return English EMAIL context words', () => {
      const words = getContextWords('EMAIL', 'en');

      expect(words).to.be.an('array').that.is.not.empty;
      const wordStrings = words.map((w) => w.word);
      expect(wordStrings).to.include('email');
      expect(wordStrings).to.include('e-mail');
    });

    it('should return French EMAIL context words', () => {
      const words = getContextWords('EMAIL', 'fr');

      expect(words).to.be.an('array').that.is.not.empty;
      const wordStrings = words.map((w) => w.word);
      expect(wordStrings).to.include('courriel');
    });
  });

  describe('AC-8.2.4: Salutations included in PERSON_NAME', () => {
    it('should include English salutations (mr, mrs, ms)', () => {
      const words = getContextWordStrings('PERSON_NAME', 'en');

      expect(words).to.include('mr');
      expect(words).to.include('mrs');
      expect(words).to.include('ms');
      expect(words).to.include('dr');
    });

    it('should include French salutations (m., mme, mlle)', () => {
      const words = getContextWordStrings('PERSON_NAME', 'fr');

      expect(words).to.include('m.');
      expect(words).to.include('mme');
      expect(words).to.include('mlle');
    });

    it('should include German salutations (herr, frau)', () => {
      const words = getContextWordStrings('PERSON_NAME', 'de');

      expect(words).to.include('herr');
      expect(words).to.include('frau');
    });
  });

  describe('AC-8.2.5: Field labels included in context words', () => {
    it('should include English field labels (name, contact)', () => {
      const words = getContextWordStrings('PERSON_NAME', 'en');

      expect(words).to.include('name');
      expect(words).to.include('contact');
    });

    it('should include French field labels (nom, prénom)', () => {
      const words = getContextWordStrings('PERSON_NAME', 'fr');

      expect(words).to.include('nom');
      expect(words).to.include('prénom');
    });

    it('should include German field labels (name, vorname)', () => {
      const words = getContextWordStrings('PERSON_NAME', 'de');

      expect(words).to.include('name');
      expect(words).to.include('vorname');
    });
  });

  describe('AC-8.2.6: getContextWords() returns correct words', () => {
    it('should return empty array for unknown entity type', () => {
      const words = getContextWords('UNKNOWN_TYPE', 'en');

      expect(words).to.be.an('array').that.is.empty;
    });

    it('should return empty array for unknown language', () => {
      const words = getContextWords('PERSON_NAME', 'xx');

      expect(words).to.be.an('array').that.is.empty;
    });

    it('should handle case-insensitive language codes', () => {
      const wordsLower = getContextWords('PERSON_NAME', 'en');
      const wordsUpper = getContextWords('PERSON_NAME', 'EN');

      expect(wordsLower).to.deep.equal(wordsUpper);
    });

    it('should return a copy (not modify original)', () => {
      const words1 = getContextWords('PERSON_NAME', 'en');
      const words2 = getContextWords('PERSON_NAME', 'en');

      expect(words1).to.not.equal(words2);
      expect(words1).to.deep.equal(words2);
    });
  });

  describe('AC-8.2.7: Weights and polarity support', () => {
    it('should have weight between 0 and 1', () => {
      const words = getContextWords('PERSON_NAME', 'en');

      for (const word of words) {
        expect(word.weight).to.be.a('number');
        expect(word.weight).to.be.at.least(0);
        expect(word.weight).to.be.at.most(1);
      }
    });

    it('should have polarity of positive or negative', () => {
      const words = getContextWords('PERSON_NAME', 'en');

      for (const word of words) {
        expect(word.polarity).to.be.oneOf(['positive', 'negative']);
      }
    });

    it('should include positive context words (salutations)', () => {
      const positiveWords = getPositiveContextWords('PERSON_NAME', 'en');

      expect(positiveWords).to.be.an('array').that.is.not.empty;
      const wordStrings = positiveWords.map((w) => w.word);
      expect(wordStrings).to.include('mr');
      expect(wordStrings).to.include('name');
    });

    it('should include negative context words (false positive indicators)', () => {
      const negativeWords = getNegativeContextWords('PERSON_NAME', 'en');

      expect(negativeWords).to.be.an('array').that.is.not.empty;
      const wordStrings = negativeWords.map((w) => w.word);
      expect(wordStrings).to.include('example.com');
    });

    it('should have high weight for salutations', () => {
      const words = getContextWords('PERSON_NAME', 'en');
      const mrWord = words.find((w) => w.word === 'mr');

      expect(mrWord).to.exist;
      expect(mrWord.weight).to.equal(1.0);
      expect(mrWord.polarity).to.equal('positive');
    });
  });

  describe('AC-8.2.8: Metadata support', () => {
    it('should return metadata with version', () => {
      const metadata = getMetadata();

      expect(metadata).to.have.property('version');
      expect(metadata.version).to.match(/^\d+\.\d+\.\d+$/);
    });

    it('should return metadata with source', () => {
      const metadata = getMetadata();

      expect(metadata).to.have.property('source');
      expect(metadata.source).to.be.a('string').that.is.not.empty;
      expect(metadata.source).to.include('Presidio');
    });

    it('should return metadata with lastUpdated', () => {
      const metadata = getMetadata();

      expect(metadata).to.have.property('lastUpdated');
      expect(metadata.lastUpdated).to.match(/^\d{4}-\d{2}-\d{2}/);
    });

    it('should return a copy (not modify original)', () => {
      const metadata1 = getMetadata();
      const metadata2 = getMetadata();

      expect(metadata1).to.not.equal(metadata2);
      expect(metadata1).to.deep.equal(metadata2);
    });
  });

  describe('getAllContextWords()', () => {
    it('should return deduplicated words from all languages', () => {
      const allWords = getAllContextWords('EMAIL');

      expect(allWords).to.be.an('array').that.is.not.empty;

      // Check for deduplication - 'email' appears in multiple languages
      const emailCount = allWords.filter(
        (w) => w.word.toLowerCase() === 'email',
      ).length;
      expect(emailCount).to.equal(1);
    });

    it('should return empty array for unknown entity type', () => {
      const words = getAllContextWords('UNKNOWN_TYPE');

      expect(words).to.be.an('array').that.is.empty;
    });

    it('should include words from all languages', () => {
      const allWords = getAllContextWords('PHONE_NUMBER');
      const wordStrings = allWords.map((w) => w.word);

      // English
      expect(wordStrings).to.include('phone');
      // French
      expect(wordStrings).to.include('téléphone');
      // German
      expect(wordStrings).to.include('telefon');
    });
  });

  describe('getContextWordStrings() - Backward compatibility', () => {
    it('should return string array (not ContextWord objects)', () => {
      const words = getContextWordStrings('PERSON_NAME', 'en');

      expect(words).to.be.an('array');
      for (const word of words) {
        expect(word).to.be.a('string');
      }
    });

    it('should return empty array for unknown type', () => {
      const words = getContextWordStrings('UNKNOWN', 'en');

      expect(words).to.be.an('array').that.is.empty;
    });
  });

  describe('getSupportedEntityTypes()', () => {
    it('should return list of all supported entity types', () => {
      const types = getSupportedEntityTypes();

      expect(types).to.be.an('array').that.is.not.empty;
      expect(types).to.include('PERSON_NAME');
      expect(types).to.include('PHONE_NUMBER');
      expect(types).to.include('EMAIL');
      expect(types).to.include('ADDRESS');
      expect(types).to.include('IBAN');
      expect(types).to.include('SWISS_AVS');
      expect(types).to.include('DATE');
    });
  });

  describe('getSupportedLanguages()', () => {
    it('should return EN, FR, DE for PERSON_NAME', () => {
      const languages = getSupportedLanguages('PERSON_NAME');

      expect(languages).to.include('en');
      expect(languages).to.include('fr');
      expect(languages).to.include('de');
    });

    it('should return empty array for unknown entity type', () => {
      const languages = getSupportedLanguages('UNKNOWN_TYPE');

      expect(languages).to.be.an('array').that.is.empty;
    });
  });

  describe('Entity type coverage', () => {
    const requiredTypes = [
      'PERSON_NAME',
      'PHONE_NUMBER',
      'EMAIL',
      'ADDRESS',
      'IBAN',
      'SWISS_AVS',
      'SWISS_POSTAL_CODE',
      'DATE',
      'ORGANIZATION',
    ];

    for (const type of requiredTypes) {
      it(`should have context words for ${type}`, () => {
        expect(CONTEXT_WORDS).to.have.property(type);

        const words = getContextWords(type, 'en');
        expect(words).to.be.an('array').that.is.not.empty;
      });
    }
  });

  describe('Language coverage', () => {
    const languages = ['en', 'fr', 'de'];
    const entityType = 'PERSON_NAME';

    for (const lang of languages) {
      it(`should have ${lang.toUpperCase()} context words for PERSON_NAME`, () => {
        const words = getContextWords(entityType, lang);

        expect(words).to.be.an('array');
        expect(words.length).to.be.greaterThan(5);
      });
    }
  });

  describe('CONTEXT_WORDS_METADATA constant', () => {
    it('should be directly accessible', () => {
      expect(CONTEXT_WORDS_METADATA).to.have.property('version');
      expect(CONTEXT_WORDS_METADATA).to.have.property('source');
      expect(CONTEXT_WORDS_METADATA).to.have.property('lastUpdated');
    });
  });

  describe('CONTEXT_WORDS constant', () => {
    it('should be directly accessible', () => {
      expect(CONTEXT_WORDS).to.have.property('PERSON_NAME');
      expect(CONTEXT_WORDS.PERSON_NAME).to.have.property('en');
      expect(CONTEXT_WORDS.PERSON_NAME.en).to.be.an('array');
    });
  });
});
