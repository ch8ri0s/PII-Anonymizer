/**
 * SubwordTokenMerger Tests (Story 8.10)
 *
 * Tests for the shared subword token merging utility that handles
 * BIO-tagged NER model output (B-XXX, I-XXX tokens).
 */

import { expect } from 'chai';
import {
  mergeSubwordTokens,
  mergeTokens,
  extractEntityType,
  isInsideToken,
  isBeginningToken,
  normalizeToken,
  SubwordTokenMerger,
  createSubwordTokenMerger,
  DEFAULT_MERGE_CONFIG,
} from '../../../../shared/dist/pii/ml/SubwordTokenMerger.js';

describe('SubwordTokenMerger (Story 8.10)', function () {
  describe('extractEntityType', function () {
    it('should remove B- prefix', function () {
      expect(extractEntityType('B-PER')).to.equal('PER');
      expect(extractEntityType('B-LOC')).to.equal('LOC');
      expect(extractEntityType('B-ORG')).to.equal('ORG');
    });

    it('should remove I- prefix', function () {
      expect(extractEntityType('I-PER')).to.equal('PER');
      expect(extractEntityType('I-LOC')).to.equal('LOC');
    });

    it('should preserve labels without B-/I- prefix', function () {
      expect(extractEntityType('PER')).to.equal('PER');
      expect(extractEntityType('PERSON')).to.equal('PERSON');
      expect(extractEntityType('O')).to.equal('O');
    });
  });

  describe('isInsideToken', function () {
    it('should return true for I- prefixed labels', function () {
      expect(isInsideToken('I-PER')).to.be.true;
      expect(isInsideToken('I-LOC')).to.be.true;
      expect(isInsideToken('I-ORG')).to.be.true;
    });

    it('should return false for non-I- labels', function () {
      expect(isInsideToken('B-PER')).to.be.false;
      expect(isInsideToken('PER')).to.be.false;
      expect(isInsideToken('O')).to.be.false;
    });
  });

  describe('isBeginningToken', function () {
    it('should return true for B- prefixed labels', function () {
      expect(isBeginningToken('B-PER')).to.be.true;
      expect(isBeginningToken('B-LOC')).to.be.true;
    });

    it('should return false for non-B- labels', function () {
      expect(isBeginningToken('I-PER')).to.be.false;
      expect(isBeginningToken('PER')).to.be.false;
    });
  });

  describe('normalizeToken', function () {
    it('should pass through standard MLToken format', function () {
      const token = { word: 'Hans', entity: 'B-PER', score: 0.95, start: 0, end: 4 };
      const normalized = normalizeToken(token);
      expect(normalized).to.deep.equal(token);
    });

    it('should convert entity_group format to entity', function () {
      const token = { word: 'Hans', entity_group: 'PER', score: 0.95, start: 0, end: 4 };
      const normalized = normalizeToken(token);
      expect(normalized.entity).to.equal('PER');
      expect(normalized.word).to.equal('Hans');
    });
  });

  describe('mergeSubwordTokens', function () {
    const sampleText = 'Hans Müller works at ABB Ltd in Zürich.';

    it('should return empty array for empty input', function () {
      const result = mergeSubwordTokens([], sampleText);
      expect(result).to.deep.equal([]);
    });

    it('should return empty array when all tokens are O (non-entity)', function () {
      const tokens = [
        { word: 'works', entity: 'O', score: 0.99, start: 12, end: 17 },
        { word: 'at', entity: 'O', score: 0.99, start: 18, end: 20 },
      ];
      const result = mergeSubwordTokens(tokens, sampleText);
      expect(result).to.deep.equal([]);
    });

    it('should merge consecutive B-PER and I-PER tokens', function () {
      const tokens = [
        { word: 'Hans', entity: 'B-PER', score: 0.95, start: 0, end: 4 },
        { word: 'Müller', entity: 'I-PER', score: 0.92, start: 5, end: 11 },
      ];
      const result = mergeSubwordTokens(tokens, sampleText);

      expect(result).to.have.length(1);
      expect(result[0].word).to.equal('Hans Müller');
      expect(result[0].entity).to.equal('PER');
      expect(result[0].start).to.equal(0);
      expect(result[0].end).to.equal(11);
      expect(result[0].tokenCount).to.equal(2);
    });

    it('should calculate average confidence score', function () {
      const tokens = [
        { word: 'Hans', entity: 'B-PER', score: 1.0, start: 0, end: 4 },
        { word: 'Müller', entity: 'I-PER', score: 0.8, start: 5, end: 11 },
      ];
      const result = mergeSubwordTokens(tokens, sampleText);

      expect(result[0].score).to.equal(0.9); // Average of 1.0 and 0.8
    });

    it('should not merge tokens of different entity types', function () {
      const tokens = [
        { word: 'Hans', entity: 'B-PER', score: 0.95, start: 0, end: 4 },
        { word: 'Zürich', entity: 'B-LOC', score: 0.90, start: 32, end: 38 },
      ];
      const result = mergeSubwordTokens(tokens, sampleText);

      expect(result).to.have.length(2);
      expect(result[0].entity).to.equal('PER');
      expect(result[1].entity).to.equal('LOC');
    });

    it('should not merge B-XXX followed by I-YYY (different types)', function () {
      const tokens = [
        { word: 'Hans', entity: 'B-PER', score: 0.95, start: 0, end: 4 },
        { word: 'Müller', entity: 'I-ORG', score: 0.80, start: 5, end: 11 },
      ];
      const result = mergeSubwordTokens(tokens, sampleText);

      // Should create separate entities because I-ORG doesn't continue B-PER
      expect(result).to.have.length(2);
    });

    it('should handle tokens without B-/I- prefix', function () {
      const tokens = [
        { word: 'Hans Müller', entity: 'PER', score: 0.95, start: 0, end: 11 },
      ];
      const result = mergeSubwordTokens(tokens, sampleText);

      expect(result).to.have.length(1);
      expect(result[0].entity).to.equal('PER');
      expect(result[0].word).to.equal('Hans Müller');
    });

    it('should handle entity_group format (HuggingFace alt format)', function () {
      const tokens = [
        { word: 'Hans', entity_group: 'B-PER', score: 0.95, start: 0, end: 4 },
        { word: 'Müller', entity_group: 'I-PER', score: 0.92, start: 5, end: 11 },
      ];
      const result = mergeSubwordTokens(tokens, sampleText);

      expect(result).to.have.length(1);
      expect(result[0].word).to.equal('Hans Müller');
    });

    it('should respect maxGap configuration', function () {
      // Test that tokens far apart are NOT merged when gap exceeds maxGap
      const text = 'Hans                                                        Müller';
      const tokens = [
        { word: 'Hans', entity: 'B-PER', score: 0.95, start: 0, end: 4 },
        { word: 'Müller', entity: 'I-PER', score: 0.92, start: 60, end: 66 }, // Far away (56 char gap)
      ];
      // Default maxGap is 5 characters, gap here is 56
      const result = mergeSubwordTokens(tokens, text, { maxGap: 5 });

      expect(result).to.have.length(2); // Not merged due to gap > maxGap
      expect(result[0].word).to.equal('Hans');
      expect(result[1].word).to.equal('Müller');
    });

    it('should merge tokens within maxGap', function () {
      const text = 'Dr. Hans Müller';
      const tokens = [
        { word: 'Dr', entity: 'B-PER', score: 0.70, start: 0, end: 2 },
        { word: 'Hans', entity: 'I-PER', score: 0.95, start: 4, end: 8 },
        { word: 'Müller', entity: 'I-PER', score: 0.92, start: 9, end: 15 },
      ];
      const result = mergeSubwordTokens(tokens, text, { maxGap: 5 });

      expect(result).to.have.length(1);
      expect(result[0].word).to.equal('Dr. Hans Müller');
      expect(result[0].tokenCount).to.equal(3);
    });

    it('should filter by minimum length', function () {
      const tokens = [
        { word: 'H', entity: 'B-PER', score: 0.95, start: 0, end: 1 },
      ];
      const result = mergeSubwordTokens(tokens, 'H works here', { minLength: 2 });

      expect(result).to.have.length(0);
    });

    it('should sort tokens by position before merging', function () {
      const tokens = [
        { word: 'Müller', entity: 'I-PER', score: 0.92, start: 5, end: 11 },
        { word: 'Hans', entity: 'B-PER', score: 0.95, start: 0, end: 4 },
      ];
      const result = mergeSubwordTokens(tokens, sampleText);

      expect(result).to.have.length(1);
      expect(result[0].word).to.equal('Hans Müller');
    });
  });

  describe('mergeTokens (convenience function)', function () {
    it('should work with default minLength', function () {
      const text = 'Hans Müller';
      const tokens = [
        { word: 'Hans', entity: 'B-PER', score: 0.95, start: 0, end: 4 },
        { word: 'Müller', entity: 'I-PER', score: 0.92, start: 5, end: 11 },
      ];
      const result = mergeTokens(tokens, text);

      expect(result).to.have.length(1);
      expect(result[0].word).to.equal('Hans Müller');
    });

    it('should accept custom minLength', function () {
      const text = 'AB';
      const tokens = [
        { word: 'AB', entity: 'B-ORG', score: 0.80, start: 0, end: 2 },
      ];
      const result = mergeTokens(tokens, text, 3);

      expect(result).to.have.length(0); // Filtered by minLength=3
    });
  });

  describe('SubwordTokenMerger class', function () {
    it('should create with default config', function () {
      const merger = new SubwordTokenMerger();
      const config = merger.getConfig();

      expect(config).to.deep.equal(DEFAULT_MERGE_CONFIG);
    });

    it('should create with custom config', function () {
      const merger = new SubwordTokenMerger({ minLength: 3, maxGap: 10 });
      const config = merger.getConfig();

      expect(config.minLength).to.equal(3);
      expect(config.maxGap).to.equal(10);
    });

    it('should merge tokens using configured settings', function () {
      const merger = new SubwordTokenMerger({ minLength: 2 });
      const text = 'Hans Müller';
      const tokens = [
        { word: 'Hans', entity: 'B-PER', score: 0.95, start: 0, end: 4 },
        { word: 'Müller', entity: 'I-PER', score: 0.92, start: 5, end: 11 },
      ];
      const result = merger.merge(tokens, text);

      expect(result).to.have.length(1);
      expect(result[0].word).to.equal('Hans Müller');
    });

    it('should update configuration', function () {
      const merger = new SubwordTokenMerger();
      merger.configure({ minLength: 5 });
      const config = merger.getConfig();

      expect(config.minLength).to.equal(5);
    });
  });

  describe('createSubwordTokenMerger factory', function () {
    it('should create a configured merger', function () {
      const merger = createSubwordTokenMerger({ minLength: 4 });
      expect(merger).to.be.instanceOf(SubwordTokenMerger);
      expect(merger.getConfig().minLength).to.equal(4);
    });
  });

  describe('weightedConfidence option', function () {
    it('should use simple average by default', function () {
      const text = 'Hans Müller Person';
      const tokens = [
        { word: 'Hans', entity: 'B-PER', score: 1.0, start: 0, end: 4 },
        { word: 'Müller', entity: 'I-PER', score: 0.8, start: 5, end: 11 },
        { word: 'Person', entity: 'I-PER', score: 0.6, start: 12, end: 18 },
      ];
      const result = mergeSubwordTokens(tokens, text, { weightedConfidence: false });

      // Simple average: (1.0 + 0.8 + 0.6) / 3 = 0.8
      expect(result[0].score).to.be.closeTo(0.8, 0.001);
    });

    it('should use weighted average when enabled', function () {
      const text = 'Hans Müller Person';
      const tokens = [
        { word: 'Hans', entity: 'B-PER', score: 1.0, start: 0, end: 4 },
        { word: 'Müller', entity: 'I-PER', score: 0.8, start: 5, end: 11 },
        { word: 'Person', entity: 'I-PER', score: 0.6, start: 12, end: 18 },
      ];
      const result = mergeSubwordTokens(tokens, text, { weightedConfidence: true });

      // Weighted: weights = [1, 0.5, 0.333]
      // Score = (1.0*1 + 0.8*0.5 + 0.6*0.333) / (1 + 0.5 + 0.333)
      // Earlier tokens have more weight
      expect(result[0].score).to.be.greaterThan(0.8); // Biased toward first token
    });
  });

  describe('Real-world scenarios', function () {
    it('should handle German compound names', function () {
      const text = 'Dr. med. Hans-Peter von Mustermannshausen';
      const tokens = [
        { word: 'Dr', entity: 'B-PER', score: 0.70, start: 0, end: 2 },
        { word: 'med', entity: 'I-PER', score: 0.65, start: 4, end: 7 },
        { word: 'Hans', entity: 'I-PER', score: 0.95, start: 9, end: 13 },
        { word: '-', entity: 'I-PER', score: 0.80, start: 13, end: 14 },
        { word: 'Peter', entity: 'I-PER', score: 0.92, start: 14, end: 19 },
        { word: 'von', entity: 'I-PER', score: 0.75, start: 20, end: 23 },
        { word: 'Mustermannshausen', entity: 'I-PER', score: 0.88, start: 24, end: 41 },
      ];
      const result = mergeSubwordTokens(tokens, text);

      expect(result).to.have.length(1);
      expect(result[0].word).to.equal('Dr. med. Hans-Peter von Mustermannshausen');
      expect(result[0].tokenCount).to.equal(7);
    });

    it('should handle multiple entities in one sentence', function () {
      const text = 'Hans Müller from ABB Ltd visited Zürich.';
      const tokens = [
        { word: 'Hans', entity: 'B-PER', score: 0.95, start: 0, end: 4 },
        { word: 'Müller', entity: 'I-PER', score: 0.92, start: 5, end: 11 },
        { word: 'ABB', entity: 'B-ORG', score: 0.88, start: 17, end: 20 },
        { word: 'Ltd', entity: 'I-ORG', score: 0.85, start: 21, end: 24 },
        { word: 'Zürich', entity: 'B-LOC', score: 0.90, start: 33, end: 39 },
      ];
      const result = mergeSubwordTokens(tokens, text);

      expect(result).to.have.length(3);
      expect(result[0].entity).to.equal('PER');
      expect(result[0].word).to.equal('Hans Müller');
      expect(result[1].entity).to.equal('ORG');
      expect(result[1].word).to.equal('ABB Ltd');
      expect(result[2].entity).to.equal('LOC');
      expect(result[2].word).to.equal('Zürich');
    });

    it('should handle subword tokenization (wordpiece)', function () {
      const text = 'Mustermannshausen';
      const tokens = [
        { word: 'Muster', entity: 'B-PER', score: 0.90, start: 0, end: 6 },
        { word: '##manns', entity: 'I-PER', score: 0.85, start: 6, end: 11 },
        { word: '##hausen', entity: 'I-PER', score: 0.88, start: 11, end: 17 },
      ];
      const result = mergeSubwordTokens(tokens, text);

      expect(result).to.have.length(1);
      expect(result[0].word).to.equal('Mustermannshausen');
    });

    it('should handle Swiss addresses', function () {
      const text = 'Bahnhofstrasse 42, 8001 Zürich';
      const tokens = [
        { word: 'Bahnhofstrasse', entity: 'B-LOC', score: 0.85, start: 0, end: 14 },
        { word: '42', entity: 'I-LOC', score: 0.75, start: 15, end: 17 },
        { word: '8001', entity: 'I-LOC', score: 0.80, start: 19, end: 23 },
        { word: 'Zürich', entity: 'I-LOC', score: 0.92, start: 24, end: 30 },
      ];
      const result = mergeSubwordTokens(tokens, text);

      expect(result).to.have.length(1);
      expect(result[0].word).to.equal('Bahnhofstrasse 42, 8001 Zürich');
      expect(result[0].entity).to.equal('LOC');
    });
  });

  describe('Edge cases', function () {
    it('should handle single token entity', function () {
      const text = 'Zürich';
      const tokens = [
        { word: 'Zürich', entity: 'B-LOC', score: 0.90, start: 0, end: 6 },
      ];
      const result = mergeSubwordTokens(tokens, text);

      expect(result).to.have.length(1);
      expect(result[0].tokenCount).to.equal(1);
    });

    it('should handle empty entity labels', function () {
      const text = 'Hans works here';
      const tokens = [
        { word: 'Hans', entity: 'B-PER', score: 0.95, start: 0, end: 4 },
        { word: 'works', entity: '', score: 0.99, start: 5, end: 10 },
      ];
      const result = mergeSubwordTokens(tokens, text);

      expect(result).to.have.length(1);
      expect(result[0].word).to.equal('Hans');
    });

    it('should handle unicode text correctly', function () {
      const text = 'François Müller-Böhm';
      const tokens = [
        { word: 'François', entity: 'B-PER', score: 0.95, start: 0, end: 8 },
        { word: 'Müller', entity: 'I-PER', score: 0.92, start: 9, end: 15 },
        { word: '-', entity: 'I-PER', score: 0.80, start: 15, end: 16 },
        { word: 'Böhm', entity: 'I-PER', score: 0.90, start: 16, end: 20 },
      ];
      const result = mergeSubwordTokens(tokens, text);

      expect(result).to.have.length(1);
      expect(result[0].word).to.equal('François Müller-Böhm');
    });
  });
});
