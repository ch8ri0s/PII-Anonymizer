/**
 * Unit tests for DenyList - False Positive Filtering System
 *
 * Tests cover:
 * - Global pattern matching (string and regex)
 * - Entity-type specific patterns
 * - Language-specific patterns
 * - Case-insensitivity
 * - Dynamic pattern addition
 * - Config file loading
 *
 * @module test/unit/pii/context/DenyList.test
 */

import { expect } from 'chai';
import { DenyList, parseDenyListConfigFile } from '../../../../shared/dist/pii/index.js';

describe('DenyList', function () {
  beforeEach(function () {
    // Reset to default configuration before each test
    DenyList.reset();
  });

  describe('isDenied() - Global Patterns', function () {
    it('should deny "Montant" as PERSON_NAME (AC-8.1.1)', function () {
      expect(DenyList.isDenied('Montant', 'PERSON_NAME')).to.be.true;
    });

    it('should deny "Description" as PERSON_NAME (AC-8.1.2)', function () {
      expect(DenyList.isDenied('Description', 'PERSON_NAME')).to.be.true;
    });

    it('should deny common French table headers', function () {
      const frenchHeaders = ['Total', 'Prix', 'Quantité', 'TVA', 'Libellé'];
      for (const header of frenchHeaders) {
        expect(DenyList.isDenied(header, 'PERSON_NAME'), `${header} should be denied`).to.be.true;
      }
    });

    it('should deny common German table headers', function () {
      const germanHeaders = ['Betrag', 'Menge', 'Preis', 'Summe', 'MwSt'];
      for (const header of germanHeaders) {
        expect(DenyList.isDenied(header, 'PERSON_NAME'), `${header} should be denied`).to.be.true;
      }
    });

    it('should deny common English table headers', function () {
      const englishHeaders = ['Amount', 'Quantity', 'Price', 'Subtotal', 'Tax'];
      for (const header of englishHeaders) {
        expect(DenyList.isDenied(header, 'PERSON_NAME'), `${header} should be denied`).to.be.true;
      }
    });

    it('should NOT deny valid person names like "Jean Dupont" (AC-8.1.8)', function () {
      expect(DenyList.isDenied('Jean Dupont', 'PERSON_NAME')).to.be.false;
    });

    it('should NOT deny valid person names like "Marie-Claire"', function () {
      expect(DenyList.isDenied('Marie-Claire', 'PERSON_NAME')).to.be.false;
    });

    it('should NOT deny valid person names like "Hans Müller"', function () {
      expect(DenyList.isDenied('Hans Müller', 'PERSON_NAME')).to.be.false;
    });
  });

  describe('isDenied() - Case Insensitivity (AC-8.1.5)', function () {
    it('should deny "montant" (lowercase)', function () {
      expect(DenyList.isDenied('montant', 'PERSON_NAME')).to.be.true;
    });

    it('should deny "MONTANT" (uppercase)', function () {
      expect(DenyList.isDenied('MONTANT', 'PERSON_NAME')).to.be.true;
    });

    it('should deny "Montant" (mixed case)', function () {
      expect(DenyList.isDenied('Montant', 'PERSON_NAME')).to.be.true;
    });

    it('should deny "MoNtAnT" (random case)', function () {
      expect(DenyList.isDenied('MoNtAnT', 'PERSON_NAME')).to.be.true;
    });

    it('should handle whitespace correctly', function () {
      expect(DenyList.isDenied('  Montant  ', 'PERSON_NAME')).to.be.true;
    });
  });

  describe('isDenied() - Entity-Type Specific Patterns (AC-8.1.6)', function () {
    it('should deny 2-letter acronyms like "TV" for PERSON_NAME', function () {
      expect(DenyList.isDenied('TV', 'PERSON_NAME')).to.be.true;
    });

    it('should deny 3-letter acronyms like "TVA" for PERSON_NAME', function () {
      expect(DenyList.isDenied('TVA', 'PERSON_NAME')).to.be.true;
    });

    it('should deny 4-letter acronyms like "IBAN" for PERSON_NAME', function () {
      expect(DenyList.isDenied('IBAN', 'PERSON_NAME')).to.be.true;
    });

    it('should NOT deny 5-letter uppercase words for PERSON_NAME', function () {
      // 5 letters is beyond our 2-4 letter acronym regex
      expect(DenyList.isDenied('MONDE', 'PERSON_NAME')).to.be.false;
    });

    it('should deny pure numbers for PERSON_NAME', function () {
      expect(DenyList.isDenied('12345', 'PERSON_NAME')).to.be.true;
    });

    it('should deny month abbreviations for PERSON_NAME', function () {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      for (const month of months) {
        expect(DenyList.isDenied(month, 'PERSON_NAME'), `${month} should be denied`).to.be.true;
      }
    });

    it('should deny day abbreviations for PERSON_NAME', function () {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      for (const day of days) {
        expect(DenyList.isDenied(day, 'PERSON_NAME'), `${day} should be denied`).to.be.true;
      }
    });

    it('should NOT deny acronyms for ORGANIZATION type (entity-type isolation)', function () {
      // ORGANIZATION doesn't have the acronym regex in its patterns
      expect(DenyList.isDenied('ABC', 'ORGANIZATION')).to.be.false;
    });
  });

  describe('isDenied() - Language-Specific Patterns (AC-8.1.7)', function () {
    beforeEach(function () {
      // Add some test language-specific patterns
      DenyList.addLanguagePattern('Bonjour', 'fr');
      DenyList.addLanguagePattern('Guten Tag', 'de');
    });

    it('should deny language-specific pattern when language matches', function () {
      expect(DenyList.isDenied('Bonjour', 'PERSON_NAME', 'fr')).to.be.true;
    });

    it('should NOT deny language-specific pattern when language does not match', function () {
      expect(DenyList.isDenied('Bonjour', 'PERSON_NAME', 'de')).to.be.false;
    });

    it('should NOT deny language-specific pattern when no language specified', function () {
      expect(DenyList.isDenied('Bonjour', 'PERSON_NAME')).to.be.false;
    });

    it('should still check global patterns even with language specified', function () {
      expect(DenyList.isDenied('Montant', 'PERSON_NAME', 'fr')).to.be.true;
    });
  });

  describe('isDenied() - Unknown Entity Types (AC-8.1.10)', function () {
    it('should fall back to global patterns for unknown entity types', function () {
      expect(DenyList.isDenied('Montant', 'UNKNOWN_TYPE')).to.be.true;
    });

    it('should not match entity-specific patterns for unknown types', function () {
      // "ABC" is only denied for PERSON_NAME due to acronym regex
      expect(DenyList.isDenied('ABC', 'UNKNOWN_TYPE')).to.be.false;
    });
  });

  describe('addPattern() - Dynamic Pattern Addition', function () {
    it('should add global string pattern dynamically', function () {
      expect(DenyList.isDenied('CustomPattern', 'PERSON_NAME')).to.be.false;
      DenyList.addPattern('CustomPattern', 'global');
      expect(DenyList.isDenied('CustomPattern', 'PERSON_NAME')).to.be.true;
    });

    it('should add global regex pattern dynamically', function () {
      expect(DenyList.isDenied('TEST123', 'PERSON_NAME')).to.be.false;
      DenyList.addPattern(/^TEST\d+$/, 'global');
      expect(DenyList.isDenied('TEST123', 'PERSON_NAME')).to.be.true;
    });

    it('should add entity-type specific pattern dynamically', function () {
      expect(DenyList.isDenied('SpecialOrg', 'ORGANIZATION')).to.be.false;
      DenyList.addPattern('SpecialOrg', 'ORGANIZATION');
      expect(DenyList.isDenied('SpecialOrg', 'ORGANIZATION')).to.be.true;
    });

    it('should create new entity type category if not exists', function () {
      expect(DenyList.isDenied('NewPattern', 'NEW_TYPE')).to.be.false;
      DenyList.addPattern('NewPattern', 'NEW_TYPE');
      expect(DenyList.isDenied('NewPattern', 'NEW_TYPE')).to.be.true;
    });
  });

  describe('getPatterns()', function () {
    it('should return global patterns when no arguments', function () {
      const patterns = DenyList.getPatterns();
      expect(patterns).to.be.an('array');
      expect(patterns.some(p => p === 'Montant')).to.be.true;
    });

    it('should return combined patterns for entity type', function () {
      const patterns = DenyList.getPatterns('PERSON_NAME');
      expect(patterns).to.be.an('array');
      // Should include global + PERSON_NAME patterns
      expect(patterns.some(p => p === 'Montant')).to.be.true;
      expect(patterns.some(p => p instanceof RegExp)).to.be.true;
    });

    it('should include language patterns when specified', function () {
      DenyList.addLanguagePattern('FrenchOnly', 'fr');
      const patterns = DenyList.getPatterns('PERSON_NAME', 'fr');
      expect(patterns.some(p => p === 'FrenchOnly')).to.be.true;
    });
  });

  describe('getGlobalPatterns()', function () {
    it('should return only global patterns', function () {
      const patterns = DenyList.getGlobalPatterns();
      expect(patterns).to.be.an('array');
      expect(patterns.some(p => p === 'Montant')).to.be.true;
    });
  });

  describe('getEntityTypePatterns()', function () {
    it('should return patterns for existing entity type', function () {
      const patterns = DenyList.getEntityTypePatterns('PERSON_NAME');
      expect(patterns).to.be.an('array');
      expect(patterns.some(p => p instanceof RegExp)).to.be.true;
    });

    it('should return empty array for non-existent entity type', function () {
      const patterns = DenyList.getEntityTypePatterns('NON_EXISTENT');
      expect(patterns).to.be.an('array');
      expect(patterns).to.have.lengthOf(0);
    });
  });

  describe('getLanguagePatterns()', function () {
    it('should return empty array for language with no patterns', function () {
      const patterns = DenyList.getLanguagePatterns('fr');
      expect(patterns).to.be.an('array');
      expect(patterns).to.have.lengthOf(0);
    });

    it('should return patterns after adding', function () {
      DenyList.addLanguagePattern('FrenchTest', 'fr');
      const patterns = DenyList.getLanguagePatterns('fr');
      expect(patterns).to.have.lengthOf(1);
      expect(patterns[0]).to.equal('FrenchTest');
    });
  });

  describe('reset()', function () {
    it('should restore default configuration', function () {
      DenyList.addPattern('CustomAdded', 'global');
      expect(DenyList.isDenied('CustomAdded', 'PERSON_NAME')).to.be.true;

      DenyList.reset();

      expect(DenyList.isDenied('CustomAdded', 'PERSON_NAME')).to.be.false;
      expect(DenyList.isDenied('Montant', 'PERSON_NAME')).to.be.true;
    });
  });

  describe('clear()', function () {
    it('should remove all patterns', function () {
      expect(DenyList.isDenied('Montant', 'PERSON_NAME')).to.be.true;

      DenyList.clear();

      expect(DenyList.isDenied('Montant', 'PERSON_NAME')).to.be.false;
      expect(DenyList.getGlobalPatterns()).to.have.lengthOf(0);
    });
  });

  describe('parseDenyListConfigFile()', function () {
    it('should parse JSON config with string patterns (AC-8.1.3)', function () {
      const configFile = {
        version: '1.0',
        global: ['Pattern1', 'Pattern2'],
        byEntityType: { PERSON_NAME: ['NamePattern'] },
        byLanguage: { fr: ['FrenchPattern'] },
      };

      const config = parseDenyListConfigFile(configFile);

      expect(config.global).to.deep.equal(['Pattern1', 'Pattern2']);
      expect(config.byEntityType.PERSON_NAME).to.deep.equal(['NamePattern']);
      expect(config.byLanguage.fr).to.deep.equal(['FrenchPattern']);
    });

    it('should parse JSON config with regex patterns (AC-8.1.4)', function () {
      const configFile = {
        version: '1.0',
        global: [
          { pattern: '^TEST$', type: 'regex' },
          { pattern: 'case', type: 'regex', flags: 'i' },
        ],
        byEntityType: {},
        byLanguage: {},
      };

      const config = parseDenyListConfigFile(configFile);

      expect(config.global[0]).to.be.instanceOf(RegExp);
      expect(config.global[0].test('TEST')).to.be.true;
      expect(config.global[1]).to.be.instanceOf(RegExp);
      expect(config.global[1].test('CASE')).to.be.true; // case insensitive
    });

    it('should parse mixed string and regex patterns', function () {
      const configFile = {
        version: '1.0',
        global: [
          'SimpleString',
          { pattern: '^Regex\\d+$', type: 'regex' },
        ],
        byEntityType: {},
        byLanguage: {},
      };

      const config = parseDenyListConfigFile(configFile);

      expect(config.global[0]).to.equal('SimpleString');
      expect(config.global[1]).to.be.instanceOf(RegExp);
    });
  });

  describe('loadFromConfig()', function () {
    it('should load config from parsed JSON file (AC-8.1.9)', function () {
      const configFile = {
        version: '1.0',
        global: ['TestGlobal'],
        byEntityType: { TEST_TYPE: ['TestEntity'] },
        byLanguage: { test: ['TestLang'] },
      };

      DenyList.loadFromConfig(configFile);

      expect(DenyList.isDenied('TestGlobal', 'PERSON_NAME')).to.be.true;
      expect(DenyList.isDenied('TestEntity', 'TEST_TYPE')).to.be.true;
      expect(DenyList.isDenied('TestLang', 'PERSON_NAME', 'test')).to.be.true;
    });

    it('should replace existing configuration when loading', function () {
      DenyList.reset();
      expect(DenyList.isDenied('Montant', 'PERSON_NAME')).to.be.true;

      const configFile = {
        version: '1.0',
        global: ['OnlyThisPattern'],
        byEntityType: {},
        byLanguage: {},
      };

      DenyList.loadFromConfig(configFile);

      expect(DenyList.isDenied('Montant', 'PERSON_NAME')).to.be.false;
      expect(DenyList.isDenied('OnlyThisPattern', 'PERSON_NAME')).to.be.true;
    });
  });

  describe('Performance', function () {
    it('should check patterns in under 1ms per entity', function () {
      const iterations = 1000;
      const testTexts = ['Montant', 'Jean Dupont', 'ABC', '12345', 'Description'];

      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        for (const text of testTexts) {
          DenyList.isDenied(text, 'PERSON_NAME');
        }
      }
      const end = performance.now();

      const totalChecks = iterations * testTexts.length;
      const avgTimePerCheck = (end - start) / totalChecks;

      expect(avgTimePerCheck).to.be.lessThan(1); // Less than 1ms per check
    });
  });

  describe('Integration Scenarios', function () {
    it('should correctly filter invoice table headers', function () {
      const invoiceHeaders = [
        'Montant', 'Description', 'Quantité', 'Prix', 'Total', 'TVA',
        'Betrag', 'Menge', 'Preis', 'Amount', 'Quantity', 'Price',
      ];

      for (const header of invoiceHeaders) {
        expect(DenyList.isDenied(header, 'PERSON_NAME'), `${header} should be denied`).to.be.true;
      }
    });

    it('should allow valid Swiss names through', function () {
      const validNames = [
        'Jean-Pierre Müller',
        'Marie-Claire Dubois',
        'Hans Rudolf',
        'François Blanc',
        'Giuseppe Rossi',
      ];

      for (const name of validNames) {
        expect(DenyList.isDenied(name, 'PERSON_NAME'), `${name} should NOT be denied`).to.be.false;
      }
    });

    it('should deny acronyms but allow organization names', function () {
      // Short acronyms denied for PERSON_NAME
      expect(DenyList.isDenied('UBS', 'PERSON_NAME')).to.be.true;
      expect(DenyList.isDenied('IBM', 'PERSON_NAME')).to.be.true;

      // Same acronyms allowed for ORGANIZATION
      expect(DenyList.isDenied('UBS', 'ORGANIZATION')).to.be.false;
      expect(DenyList.isDenied('IBM', 'ORGANIZATION')).to.be.false;
    });
  });
});
