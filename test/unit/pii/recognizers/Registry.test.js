/**
 * Unit tests for RecognizerRegistry
 *
 * Tests cover:
 * - Registration and lookup
 * - Priority-based sorting
 * - Specificity tiebreaker
 * - Error isolation
 * - Browser compatibility (empty registry check)
 * - Filtering by country/language/entity type
 *
 * @module test/unit/pii/recognizers/Registry.test
 */

import { expect } from 'chai';
import {
  RecognizerRegistry,
  BaseRecognizer,
} from '../../../../shared/dist/pii/index.js';

/**
 * Test recognizer factory.
 */
function createTestRecognizer(options) {
  class TestRecognizer extends BaseRecognizer {
    config = {
      name: options.name || 'TestRecognizer',
      supportedLanguages: options.languages || ['en'],
      supportedCountries: options.countries || ['US'],
      patterns: options.patterns || [
        {
          regex: /TEST-\d{4}/,
          score: 0.7,
          entityType: options.entityType || 'TEST_ENTITY',
          name: 'Test pattern',
          isWeakPattern: options.isWeakPattern || false,
        },
      ],
      priority: options.priority ?? 50,
      specificity: options.specificity || 'country',
      contextWords: options.contextWords || [],
      denyPatterns: options.denyPatterns || [],
      useGlobalContext: options.useGlobalContext ?? true,
      useGlobalDenyList: options.useGlobalDenyList ?? true,
    };
  }
  return new TestRecognizer();
}

/**
 * Failing recognizer for error isolation tests.
 */
class FailingRecognizer extends BaseRecognizer {
  config = {
    name: 'FailingRecognizer',
    supportedLanguages: ['en'],
    supportedCountries: ['US'],
    patterns: [],
    priority: 50,
    specificity: 'country',
    contextWords: [],
    denyPatterns: [],
    useGlobalContext: false,
    useGlobalDenyList: false,
  };

  analyze() {
    throw new Error('Intentional failure for testing');
  }
}

describe('RecognizerRegistry', function () {
  beforeEach(function () {
    RecognizerRegistry.reset();
  });

  describe('register()', function () {
    it('should register a recognizer (AC-8.5.7)', function () {
      const recognizer = createTestRecognizer({ name: 'TestReg1' });
      RecognizerRegistry.register(recognizer);

      expect(RecognizerRegistry.size()).to.equal(1);
      expect(RecognizerRegistry.get('TestReg1')).to.equal(recognizer);
    });

    it('should throw if recognizer name is already registered', function () {
      const recognizer1 = createTestRecognizer({ name: 'Duplicate' });
      const recognizer2 = createTestRecognizer({ name: 'Duplicate' });

      RecognizerRegistry.register(recognizer1);
      expect(() => RecognizerRegistry.register(recognizer2)).to.throw(
        /already registered/,
      );
    });
  });

  describe('unregister()', function () {
    it('should remove a registered recognizer', function () {
      const recognizer = createTestRecognizer({ name: 'ToRemove' });
      RecognizerRegistry.register(recognizer);

      expect(RecognizerRegistry.unregister('ToRemove')).to.be.true;
      expect(RecognizerRegistry.size()).to.equal(0);
    });

    it('should return false for non-existent recognizer', function () {
      expect(RecognizerRegistry.unregister('NonExistent')).to.be.false;
    });
  });

  describe('getByCountry() (AC-8.5.1)', function () {
    beforeEach(function () {
      RecognizerRegistry.register(createTestRecognizer({ name: 'Swiss1', countries: ['CH'] }));
      RecognizerRegistry.register(createTestRecognizer({ name: 'US1', countries: ['US'] }));
      RecognizerRegistry.register(createTestRecognizer({ name: 'Both', countries: ['CH', 'US'] }));
    });

    it('should return recognizers for specific country', function () {
      const swissRecognizers = RecognizerRegistry.getByCountry('CH');
      const names = swissRecognizers.map((r) => r.config.name);

      expect(names).to.include('Swiss1');
      expect(names).to.include('Both');
      expect(names).to.not.include('US1');
    });

    it('should be case-insensitive', function () {
      const recognizers = RecognizerRegistry.getByCountry('ch');
      expect(recognizers.length).to.be.at.least(1);
    });
  });

  describe('getByLanguage()', function () {
    beforeEach(function () {
      RecognizerRegistry.register(createTestRecognizer({ name: 'English', languages: ['en'] }));
      RecognizerRegistry.register(createTestRecognizer({ name: 'French', languages: ['fr'] }));
      RecognizerRegistry.register(createTestRecognizer({ name: 'Multi', languages: ['en', 'fr', 'de'] }));
    });

    it('should return recognizers for specific language', function () {
      const frenchRecognizers = RecognizerRegistry.getByLanguage('fr');
      const names = frenchRecognizers.map((r) => r.config.name);

      expect(names).to.include('French');
      expect(names).to.include('Multi');
      expect(names).to.not.include('English');
    });
  });

  describe('getByEntityType()', function () {
    beforeEach(function () {
      RecognizerRegistry.register(createTestRecognizer({ name: 'AVS', entityType: 'SWISS_AVS' }));
      RecognizerRegistry.register(createTestRecognizer({ name: 'Phone', entityType: 'PHONE' }));
    });

    it('should return recognizers for specific entity type', function () {
      const avsRecognizers = RecognizerRegistry.getByEntityType('SWISS_AVS');
      expect(avsRecognizers).to.have.lengthOf(1);
      expect(avsRecognizers[0].config.name).to.equal('AVS');
    });
  });

  describe('Priority sorting (AC-8.5.6)', function () {
    beforeEach(function () {
      RecognizerRegistry.register(createTestRecognizer({ name: 'Low', priority: 30 }));
      RecognizerRegistry.register(createTestRecognizer({ name: 'High', priority: 80 }));
      RecognizerRegistry.register(createTestRecognizer({ name: 'Medium', priority: 50 }));
    });

    it('should sort by priority descending', function () {
      const all = RecognizerRegistry.getAll();
      const names = all.map((r) => r.config.name);

      expect(names).to.deep.equal(['High', 'Medium', 'Low']);
    });
  });

  describe('Specificity tiebreaker (pre-mortem)', function () {
    beforeEach(function () {
      RecognizerRegistry.register(createTestRecognizer({ name: 'Global', priority: 50, specificity: 'global' }));
      RecognizerRegistry.register(createTestRecognizer({ name: 'Country', priority: 50, specificity: 'country' }));
      RecognizerRegistry.register(createTestRecognizer({ name: 'Region', priority: 50, specificity: 'region' }));
    });

    it('should use specificity as tiebreaker (country > region > global)', function () {
      const all = RecognizerRegistry.getAll();
      const names = all.map((r) => r.config.name);

      expect(names).to.deep.equal(['Country', 'Region', 'Global']);
    });
  });

  describe('isEmpty() and Browser compatibility (pre-mortem)', function () {
    it('should return true when registry is empty', function () {
      expect(RecognizerRegistry.isEmpty()).to.be.true;
    });

    it('should return false when registry has recognizers', function () {
      RecognizerRegistry.register(createTestRecognizer({ name: 'Test' }));
      expect(RecognizerRegistry.isEmpty()).to.be.false;
    });

    it('should throw on getByCountry when registry is empty (browser safety)', function () {
      expect(() => RecognizerRegistry.getByCountry('CH')).to.throw(
        /not initialized/,
      );
    });
  });

  describe('analyze() with error isolation (pre-mortem)', function () {
    beforeEach(function () {
      RecognizerRegistry.register(createTestRecognizer({ name: 'Working', countries: ['US'] }));
      RecognizerRegistry.register(new FailingRecognizer());
    });

    it('should continue when one recognizer fails', function () {
      const result = RecognizerRegistry.analyze('TEST-1234', { country: 'US' });

      // Should have matches from working recognizer
      expect(result.matches.length).to.be.at.least(1);

      // Should record error from failing recognizer
      expect(result.recognizerErrors).to.have.lengthOf(1);
      expect(result.recognizerErrors[0].name).to.equal('FailingRecognizer');
    });

    it('should include analysis time', function () {
      const result = RecognizerRegistry.analyze('TEST-1234', { country: 'US' });
      expect(result.analysisTimeMs).to.be.a('number');
      expect(result.analysisTimeMs).to.be.at.least(0);
    });
  });

  describe('configure() with lowConfidenceMultiplier (AC-8.5.9)', function () {
    beforeEach(function () {
      RecognizerRegistry.register(createTestRecognizer({
        name: 'WeakPattern',
        countries: ['US'],
        isWeakPattern: true,
      }));
    });

    it('should apply lowConfidenceMultiplier to weak patterns', function () {
      RecognizerRegistry.configure({ lowConfidenceMultiplier: 0.4 });

      const result = RecognizerRegistry.analyze('TEST-1234', { country: 'US' });
      const match = result.matches.find((m) => m.recognizer === 'WeakPattern');

      // Original score was 0.7, multiplied by 0.4 = 0.28
      expect(match.confidence).to.be.closeTo(0.28, 0.01);
    });
  });

  describe('configure() with lowScoreEntityNames', function () {
    beforeEach(function () {
      RecognizerRegistry.register(createTestRecognizer({
        name: 'ZipCode',
        countries: ['US'],
        entityType: 'ZIP_CODE',
        isWeakPattern: false, // Not marked as weak
      }));
    });

    it('should apply lowConfidenceMultiplier to configured entity types', function () {
      RecognizerRegistry.configure({
        lowConfidenceMultiplier: 0.4,
        lowScoreEntityNames: ['ZIP_CODE'],
      });

      const result = RecognizerRegistry.analyze('TEST-1234', { country: 'US' });
      const match = result.matches.find((m) => m.type === 'ZIP_CODE');

      // Original score was 0.7, multiplied by 0.4 = 0.28
      expect(match.confidence).to.be.closeTo(0.28, 0.01);
    });
  });

  describe('getRegisteredNames()', function () {
    it('should return all registered recognizer names', function () {
      RecognizerRegistry.register(createTestRecognizer({ name: 'A' }));
      RecognizerRegistry.register(createTestRecognizer({ name: 'B' }));
      RecognizerRegistry.register(createTestRecognizer({ name: 'C' }));

      const names = RecognizerRegistry.getRegisteredNames();
      expect(names).to.have.members(['A', 'B', 'C']);
    });
  });

  describe('reset()', function () {
    it('should clear all recognizers and reset config', function () {
      RecognizerRegistry.register(createTestRecognizer({ name: 'Test' }));
      RecognizerRegistry.configure({ lowConfidenceMultiplier: 0.2 });

      RecognizerRegistry.reset();

      expect(RecognizerRegistry.isEmpty()).to.be.true;
      expect(RecognizerRegistry.getConfig().lowConfidenceMultiplier).to.equal(0.4);
    });
  });
});
