/**
 * Unit tests for YamlLoader
 *
 * Tests cover:
 * - YAML/JSON parsing
 * - Recognizer creation from config
 * - Schema validation
 * - Registration of loaded recognizers
 *
 * @module test/unit/pii/recognizers/YamlLoader.test
 */

import { expect } from 'chai';
import {
  parseYamlConfig,
  yamlDefToConfig,
  createRecognizersFromConfig,
  loadRecognizersFromYaml,
  validateYamlConfig,
  GenericRecognizer,
  RecognizerRegistry,
} from '../../../../shared/dist/pii/index.js';

describe('YamlLoader', function () {
  beforeEach(function () {
    RecognizerRegistry.reset();
  });

  describe('parseYamlConfig()', function () {
    it('should parse valid JSON config (AC-8.5.10)', function () {
      const config = JSON.stringify({
        version: '1.0',
        recognizers: [
          {
            name: 'TestRecognizer',
            supportedLanguages: ['en'],
            supportedCountries: ['US'],
            patterns: [
              {
                regex: '\\\\bTEST-\\\\d{4}\\\\b',
                score: 0.7,
                entityType: 'TEST_ENTITY',
              },
            ],
          },
        ],
      });

      const result = parseYamlConfig(config);

      expect(result.recognizers).to.have.lengthOf(1);
      expect(result.recognizers[0].name).to.equal('TestRecognizer');
    });

    it('should throw for invalid JSON', function () {
      expect(() => parseYamlConfig('not valid json')).to.throw();
    });

    it('should throw for missing required fields', function () {
      const config = JSON.stringify({
        recognizers: [
          {
            name: 'Incomplete',
            // Missing supportedLanguages, supportedCountries, patterns
          },
        ],
      });

      expect(() => parseYamlConfig(config)).to.throw();
    });
  });

  describe('yamlDefToConfig()', function () {
    it('should convert YAML definition to RecognizerConfig', function () {
      const def = {
        name: 'YamlRecognizer',
        supportedLanguages: ['en', 'fr'],
        supportedCountries: ['US', 'EU'],
        patterns: [
          {
            regex: 'YAML-\\d+',
            score: 0.6,
            entityType: 'YAML_ENTITY',
            name: 'Test pattern',
            isWeakPattern: true,
          },
        ],
        priority: 60,
        specificity: 'region',
        contextWords: ['yaml', 'config'],
        denyPatterns: ['YAML-0000'],
        useGlobalContext: false,
        useGlobalDenyList: false,
      };

      const config = yamlDefToConfig(def);

      expect(config.name).to.equal('YamlRecognizer');
      expect(config.supportedLanguages).to.deep.equal(['en', 'fr']);
      expect(config.supportedCountries).to.deep.equal(['US', 'EU']);
      expect(config.patterns).to.have.lengthOf(1);
      expect(config.patterns[0].regex).to.be.instanceof(RegExp);
      expect(config.patterns[0].isWeakPattern).to.be.true;
      expect(config.priority).to.equal(60);
      expect(config.specificity).to.equal('region');
      expect(config.contextWords).to.deep.equal(['yaml', 'config']);
      expect(config.denyPatterns).to.deep.equal(['YAML-0000']);
      expect(config.useGlobalContext).to.be.false;
      expect(config.useGlobalDenyList).to.be.false;
    });

    it('should use defaults for optional fields', function () {
      const def = {
        name: 'MinimalRecognizer',
        supportedLanguages: ['en'],
        supportedCountries: ['US'],
        patterns: [
          {
            regex: 'MIN-\\d+',
            score: 0.5,
            entityType: 'MIN_ENTITY',
          },
        ],
      };

      const config = yamlDefToConfig(def);

      expect(config.priority).to.equal(50); // Default
      expect(config.specificity).to.equal('country'); // Default
      expect(config.contextWords).to.deep.equal([]);
      expect(config.denyPatterns).to.deep.equal([]);
      expect(config.useGlobalContext).to.be.true;
      expect(config.useGlobalDenyList).to.be.true;
    });
  });

  describe('createRecognizersFromConfig()', function () {
    it('should create GenericRecognizer instances', function () {
      const config = {
        version: '1.0',
        recognizers: [
          {
            name: 'Recognizer1',
            supportedLanguages: ['en'],
            supportedCountries: ['US'],
            patterns: [
              { regex: 'R1-\\d+', score: 0.7, entityType: 'R1' },
            ],
          },
          {
            name: 'Recognizer2',
            supportedLanguages: ['fr'],
            supportedCountries: ['FR'],
            patterns: [
              { regex: 'R2-\\d+', score: 0.6, entityType: 'R2' },
            ],
          },
        ],
      };

      const recognizers = createRecognizersFromConfig(config);

      expect(recognizers).to.have.lengthOf(2);
      expect(recognizers[0]).to.be.instanceof(GenericRecognizer);
      expect(recognizers[1]).to.be.instanceof(GenericRecognizer);
      expect(recognizers[0].config.name).to.equal('Recognizer1');
      expect(recognizers[1].config.name).to.equal('Recognizer2');
    });
  });

  describe('loadRecognizersFromYaml()', function () {
    it('should load and register recognizers from JSON (AC-8.5.10)', function () {
      const config = JSON.stringify({
        version: '1.0',
        recognizers: [
          {
            name: 'LoadedRecognizer',
            supportedLanguages: ['en'],
            supportedCountries: ['US'],
            patterns: [
              { regex: 'LOADED-\\d+', score: 0.8, entityType: 'LOADED' },
            ],
          },
        ],
      });

      const names = loadRecognizersFromYaml(config);

      expect(names).to.deep.equal(['LoadedRecognizer']);
      expect(RecognizerRegistry.size()).to.equal(1);
      expect(RecognizerRegistry.get('LoadedRecognizer')).to.exist;
    });

    it('should load multiple recognizers', function () {
      const config = JSON.stringify({
        recognizers: [
          {
            name: 'Multi1',
            supportedLanguages: ['en'],
            supportedCountries: ['US'],
            patterns: [{ regex: 'M1-\\d+', score: 0.5, entityType: 'M1' }],
          },
          {
            name: 'Multi2',
            supportedLanguages: ['fr'],
            supportedCountries: ['FR'],
            patterns: [{ regex: 'M2-\\d+', score: 0.5, entityType: 'M2' }],
          },
        ],
      });

      const names = loadRecognizersFromYaml(config);

      expect(names).to.have.lengthOf(2);
      expect(RecognizerRegistry.size()).to.equal(2);
    });
  });

  describe('validateYamlConfig()', function () {
    it('should return valid: true for valid config', function () {
      const config = JSON.stringify({
        recognizers: [
          {
            name: 'Valid',
            supportedLanguages: ['en'],
            supportedCountries: ['US'],
            patterns: [{ regex: 'V-\\d+', score: 0.5, entityType: 'V' }],
          },
        ],
      });

      const result = validateYamlConfig(config);

      expect(result.valid).to.be.true;
      expect(result.errors).to.be.empty;
      expect(result.recognizerCount).to.equal(1);
    });

    it('should return valid: false for invalid config', function () {
      const config = JSON.stringify({
        recognizers: [
          {
            name: 'Invalid',
            // Missing required fields
          },
        ],
      });

      const result = validateYamlConfig(config);

      expect(result.valid).to.be.false;
      expect(result.errors).to.have.lengthOf.at.least(1);
      expect(result.recognizerCount).to.equal(0);
    });

    it('should handle malformed JSON', function () {
      const result = validateYamlConfig('not json at all');

      expect(result.valid).to.be.false;
      expect(result.errors).to.have.lengthOf(1);
    });
  });

  describe('GenericRecognizer', function () {
    it('should work like BaseRecognizer', function () {
      const config = {
        name: 'GenericTest',
        supportedLanguages: ['en', 'de'],
        supportedCountries: ['CH'],
        patterns: [
          {
            regex: /GEN-\d{4}/,
            score: 0.75,
            entityType: 'GENERIC_ENTITY',
            name: 'Generic pattern',
          },
        ],
        priority: 55,
        specificity: 'country',
        contextWords: ['generic'],
        denyPatterns: [],
        useGlobalContext: true,
        useGlobalDenyList: true,
      };

      const recognizer = new GenericRecognizer(config);

      expect(recognizer.supportsLanguage('en')).to.be.true;
      expect(recognizer.supportsCountry('CH')).to.be.true;

      const matches = recognizer.analyze('Code: GEN-1234');
      expect(matches).to.have.lengthOf(1);
      expect(matches[0].type).to.equal('GENERIC_ENTITY');
      expect(matches[0].confidence).to.equal(0.75);
    });
  });
});
