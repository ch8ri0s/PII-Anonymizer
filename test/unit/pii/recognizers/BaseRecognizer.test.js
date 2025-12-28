/**
 * Unit tests for BaseRecognizer
 *
 * Tests cover:
 * - Pattern matching
 * - Language/country support checks
 * - DenyList integration
 * - Validation function invocation
 *
 * @module test/unit/pii/recognizers/BaseRecognizer.test
 */

import { expect } from 'chai';
import {
  BaseRecognizer,
  DenyList,
} from '../../../../shared/dist/pii/index.js';

/**
 * Test recognizer for testing BaseRecognizer functionality.
 */
class TestRecognizer extends BaseRecognizer {
  config = {
    name: 'TestRecognizer',
    supportedLanguages: ['en', 'fr', 'de'],
    supportedCountries: ['CH', 'US'],
    patterns: [
      {
        regex: /TEST-\d{4}/,
        score: 0.7,
        entityType: 'TEST_ENTITY',
        name: 'Test pattern',
      },
      {
        regex: /WEAK-\d{2}/,
        score: 0.5,
        entityType: 'WEAK_ENTITY',
        name: 'Weak pattern',
        isWeakPattern: true,
      },
    ],
    priority: 50,
    specificity: 'country',
    contextWords: ['test', 'example'],
    denyPatterns: ['TEST-0000'],
    useGlobalContext: true,
    useGlobalDenyList: true,
  };
}

/**
 * Recognizer with validator function.
 */
class ValidatingRecognizer extends BaseRecognizer {
  config = {
    name: 'ValidatingRecognizer',
    supportedLanguages: ['en'],
    supportedCountries: ['US'],
    patterns: [
      {
        regex: /CODE-\d{4}/,
        score: 0.8,
        entityType: 'VALIDATED_ENTITY',
        name: 'Validated pattern',
      },
    ],
    priority: 60,
    specificity: 'country',
    contextWords: [],
    denyPatterns: [],
    useGlobalContext: false,
    useGlobalDenyList: false,
    validator: (match) => {
      // Only allow codes where last digit equals sum of first 3 % 10
      const digits = match.replace(/\D/g, '');
      const sum = parseInt(digits[0]) + parseInt(digits[1]) + parseInt(digits[2]);
      return parseInt(digits[3]) === (sum % 10);
    },
  };
}

describe('BaseRecognizer', function () {
  beforeEach(function () {
    DenyList.reset();
  });

  describe('analyze() - Pattern Matching', function () {
    it('should detect pattern matches (AC-8.5.2)', function () {
      const recognizer = new TestRecognizer();
      const matches = recognizer.analyze('My code is TEST-1234');

      expect(matches).to.have.lengthOf(1);
      expect(matches[0].text).to.equal('TEST-1234');
      expect(matches[0].type).to.equal('TEST_ENTITY');
      expect(matches[0].confidence).to.equal(0.7);
    });

    it('should detect multiple pattern matches', function () {
      const recognizer = new TestRecognizer();
      const matches = recognizer.analyze('Codes: TEST-1234 and TEST-5678');

      expect(matches).to.have.lengthOf(2);
      expect(matches[0].text).to.equal('TEST-1234');
      expect(matches[1].text).to.equal('TEST-5678');
    });

    it('should return empty array for no matches', function () {
      const recognizer = new TestRecognizer();
      const matches = recognizer.analyze('No patterns here');

      expect(matches).to.be.an('array').that.is.empty;
    });

    it('should set correct start and end positions', function () {
      const recognizer = new TestRecognizer();
      const text = 'Prefix TEST-1234 suffix';
      const matches = recognizer.analyze(text);

      expect(matches[0].start).to.equal(7);
      expect(matches[0].end).to.equal(16);
      expect(text.substring(matches[0].start, matches[0].end)).to.equal('TEST-1234');
    });

    it('should set source as RULE', function () {
      const recognizer = new TestRecognizer();
      const matches = recognizer.analyze('TEST-1234');

      expect(matches[0].source).to.equal('RULE');
    });

    it('should set recognizer name', function () {
      const recognizer = new TestRecognizer();
      const matches = recognizer.analyze('TEST-1234');

      expect(matches[0].recognizer).to.equal('TestRecognizer');
    });

    it('should set pattern name when available', function () {
      const recognizer = new TestRecognizer();
      const matches = recognizer.analyze('TEST-1234');

      expect(matches[0].patternName).to.equal('Test pattern');
    });
  });

  describe('supportsLanguage() (AC-8.5.3)', function () {
    it('should return true for supported languages', function () {
      const recognizer = new TestRecognizer();

      expect(recognizer.supportsLanguage('en')).to.be.true;
      expect(recognizer.supportsLanguage('fr')).to.be.true;
      expect(recognizer.supportsLanguage('de')).to.be.true;
    });

    it('should return false for unsupported languages', function () {
      const recognizer = new TestRecognizer();

      expect(recognizer.supportsLanguage('es')).to.be.false;
      expect(recognizer.supportsLanguage('it')).to.be.false;
    });

    it('should be case-insensitive', function () {
      const recognizer = new TestRecognizer();

      expect(recognizer.supportsLanguage('EN')).to.be.true;
      expect(recognizer.supportsLanguage('Fr')).to.be.true;
    });
  });

  describe('supportsCountry() (AC-8.5.3)', function () {
    it('should return true for supported countries', function () {
      const recognizer = new TestRecognizer();

      expect(recognizer.supportsCountry('CH')).to.be.true;
      expect(recognizer.supportsCountry('US')).to.be.true;
    });

    it('should return false for unsupported countries', function () {
      const recognizer = new TestRecognizer();

      expect(recognizer.supportsCountry('DE')).to.be.false;
      expect(recognizer.supportsCountry('FR')).to.be.false;
    });

    it('should be case-insensitive', function () {
      const recognizer = new TestRecognizer();

      expect(recognizer.supportsCountry('ch')).to.be.true;
      expect(recognizer.supportsCountry('us')).to.be.true;
    });
  });

  describe('analyze() with language filter', function () {
    it('should skip analysis for unsupported language', function () {
      const recognizer = new TestRecognizer();
      const matches = recognizer.analyze('TEST-1234', 'es');

      expect(matches).to.be.empty;
    });

    it('should analyze for supported language', function () {
      const recognizer = new TestRecognizer();
      const matches = recognizer.analyze('TEST-1234', 'en');

      expect(matches).to.have.lengthOf(1);
    });
  });

  describe('isDenied() - Recognizer Deny Patterns (AC-8.5.4)', function () {
    it('should filter out matches in recognizer deny list', function () {
      const recognizer = new TestRecognizer();
      const matches = recognizer.analyze('TEST-0000 and TEST-1234');

      expect(matches).to.have.lengthOf(1);
      expect(matches[0].text).to.equal('TEST-1234');
    });

    it('should be case-insensitive for string patterns', function () {
      const recognizer = new TestRecognizer();
      const matches = recognizer.analyze('test-0000');

      expect(matches).to.be.empty;
    });
  });

  describe('isDenied() - Global DenyList Integration (AC-8.5.8)', function () {
    it('should check global DenyList when useGlobalDenyList is true', function () {
      DenyList.addPattern('TEST-9999', 'global');

      const recognizer = new TestRecognizer();
      const matches = recognizer.analyze('TEST-9999 and TEST-1234');

      expect(matches).to.have.lengthOf(1);
      expect(matches[0].text).to.equal('TEST-1234');
    });
  });

  describe('validator function (AC-8.5.5)', function () {
    it('should filter matches that fail validation', function () {
      const recognizer = new ValidatingRecognizer();
      // CODE-1234: 1+2+3=6, last digit=4 ≠ 6 → invalid
      const matches = recognizer.analyze('CODE-1234');

      expect(matches).to.be.empty;
    });

    it('should include matches that pass validation', function () {
      const recognizer = new ValidatingRecognizer();
      // CODE-1236: 1+2+3=6, last digit=6 → valid
      const matches = recognizer.analyze('CODE-1236');

      expect(matches).to.have.lengthOf(1);
      expect(matches[0].validationPassed).to.be.true;
    });
  });

  describe('getContextWords() (AC-8.5.4)', function () {
    it('should return recognizer context words', function () {
      const recognizer = new TestRecognizer();
      const words = recognizer.getContextWords();

      expect(words).to.deep.equal(['test', 'example']);
    });
  });

  describe('getPriority() (AC-8.5.6)', function () {
    it('should return recognizer priority', function () {
      const recognizer = new TestRecognizer();
      expect(recognizer.getPriority()).to.equal(50);
    });
  });

  describe('getSpecificity()', function () {
    it('should return recognizer specificity', function () {
      const recognizer = new TestRecognizer();
      expect(recognizer.getSpecificity()).to.equal('country');
    });
  });
});
