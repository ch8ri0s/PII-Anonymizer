/**
 * Unit tests for ContextEnhancer
 *
 * Tests for Story 8.3: Context Enhancement System
 * Validates context-based confidence boosting with direction awareness,
 * negative context support, and DenyList safety guard.
 */

import { expect } from 'chai';
import {
  ContextEnhancer,
  createContextEnhancer,
  DEFAULT_CONTEXT_ENHANCER_CONFIG,
  DenyList,
} from '../../../../shared/dist/pii/index.js';

describe('ContextEnhancer', () => {
  // Reset DenyList before each test to ensure clean state
  beforeEach(() => {
    DenyList.reset();
  });

  describe('AC-8.3.1: Basic context word detection and boost', () => {
    it('should boost confidence when context word found within window', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Jean Dupont',
        type: 'PERSON_NAME',
        start: 10,
        end: 21,
        confidence: 0.5,
      };
      const fullText = '   Nom:   Jean Dupont, Contact: test@example.com';
      const contextWords = [
        { word: 'nom', weight: 1.0, polarity: 'positive' },
        { word: 'name', weight: 1.0, polarity: 'positive' },
      ];

      const result = enhancer.enhance(entity, fullText, contextWords);

      expect(result.confidence).to.be.greaterThan(0.5);
      expect(result.confidence).to.be.at.most(1.0);
    });

    it('should apply Presidio similarityFactor (0.35) as max boost', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Test Entity',
        type: 'PERSON_NAME',
        start: 20,
        end: 31,
        confidence: 0.5,
      };
      const fullText = 'Mr Test Entity contact address phone email';
      const contextWords = [
        { word: 'mr', weight: 1.0, polarity: 'positive' },
        { word: 'contact', weight: 1.0, polarity: 'positive' },
        { word: 'address', weight: 1.0, polarity: 'positive' },
        { word: 'phone', weight: 1.0, polarity: 'positive' },
        { word: 'email', weight: 1.0, polarity: 'positive' },
      ];

      const result = enhancer.enhanceWithDetails(
        entity,
        fullText,
        contextWords,
      );

      // Boost should be capped at similarityFactor (0.35)
      expect(result.boostApplied).to.be.at.most(0.35);
    });

    it('should keep original confidence when no context words found', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Random Text',
        type: 'PERSON_NAME',
        start: 0,
        end: 11,
        confidence: 0.5,
      };
      const fullText = 'Random Text without any context';
      const contextWords = [
        { word: 'nom', weight: 1.0, polarity: 'positive' },
        { word: 'name', weight: 1.0, polarity: 'positive' },
      ];

      const result = enhancer.enhance(entity, fullText, contextWords);

      expect(result.confidence).to.equal(0.5);
    });

    it('should return original entity when context words array is empty', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Jean Dupont',
        type: 'PERSON_NAME',
        start: 5,
        end: 16,
        confidence: 0.6,
      };
      const fullText = 'Nom: Jean Dupont, Contact: test';

      const result = enhancer.enhance(entity, fullText, []);

      expect(result.confidence).to.equal(0.6);
    });
  });

  describe('AC-8.3.2: Minimum confidence with context (Presidio floor)', () => {
    it('should enforce minScoreWithContext (0.4) when context found', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Test',
        type: 'PERSON_NAME',
        start: 10,
        end: 14,
        confidence: 0.2, // Very low base confidence
      };
      const fullText = '    Name: Test is here';
      const contextWords = [{ word: 'name', weight: 1.0, polarity: 'positive' }];

      const result = enhancer.enhance(entity, fullText, contextWords);

      // Should be at least minScoreWithContext (0.4)
      expect(result.confidence).to.be.at.least(0.4);
    });

    it('should not apply minScoreWithContext when only negative context found', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'test@example.com',
        type: 'EMAIL',
        start: 0,
        end: 16,
        confidence: 0.5,
      };
      const fullText = 'test@example.com placeholder';
      const contextWords = [
        { word: 'placeholder', weight: 0.8, polarity: 'negative' },
      ];

      const result = enhancer.enhance(entity, fullText, contextWords);

      // Should be reduced, not raised to minScoreWithContext
      expect(result.confidence).to.be.lessThan(0.5);
    });
  });

  describe('AC-8.3.3: Configurable window size', () => {
    it('should use default window size of 100 characters', () => {
      const enhancer = new ContextEnhancer();
      const config = enhancer.getConfig();

      expect(config.windowSize).to.equal(100);
    });

    it('should respect custom window size', () => {
      const enhancer = new ContextEnhancer({ windowSize: 50 });
      const entity = {
        text: 'Test',
        type: 'UNKNOWN',
        start: 100,
        end: 104,
        confidence: 0.5,
      };
      // Context word at position 40 (60 chars before entity start)
      const fullText = ' '.repeat(40) + 'name' + ' '.repeat(56) + 'Test';
      const contextWords = [{ word: 'name', weight: 1.0, polarity: 'positive' }];

      const result = enhancer.enhance(entity, fullText, contextWords);

      // Context word is outside 50-char window, should not boost
      expect(result.confidence).to.equal(0.5);
    });

    it('should find context words inside configured window', () => {
      const enhancer = new ContextEnhancer({ windowSize: 50 });
      const entity = {
        text: 'Test',
        type: 'UNKNOWN',
        start: 60,
        end: 64,
        confidence: 0.5,
      };
      // Context word at position 30 (30 chars before entity start)
      const fullText = ' '.repeat(30) + 'name' + ' '.repeat(26) + 'Test';
      const contextWords = [{ word: 'name', weight: 1.0, polarity: 'positive' }];

      const result = enhancer.enhance(entity, fullText, contextWords);

      // Context word is inside 50-char window, should boost
      expect(result.confidence).to.be.greaterThan(0.5);
    });
  });

  describe('AC-8.3.4: Per-entity-type configuration overrides', () => {
    it('should use 150-char window for PERSON_NAME by default', () => {
      const enhancer = new ContextEnhancer();

      expect(enhancer.getWindowSize('PERSON_NAME')).to.equal(150);
    });

    it('should use 40-char window for IBAN by default', () => {
      const enhancer = new ContextEnhancer();

      expect(enhancer.getWindowSize('IBAN')).to.equal(40);
    });

    it('should use 50-char window for EMAIL by default', () => {
      const enhancer = new ContextEnhancer();

      expect(enhancer.getWindowSize('EMAIL')).to.equal(50);
    });

    it('should use default window for unknown entity types', () => {
      const enhancer = new ContextEnhancer();

      expect(enhancer.getWindowSize('UNKNOWN_TYPE')).to.equal(100);
    });

    it('should allow custom per-entity-type overrides', () => {
      const enhancer = new ContextEnhancer({
        perEntityType: {
          CUSTOM_TYPE: { windowSize: 200 },
        },
      });

      expect(enhancer.getWindowSize('CUSTOM_TYPE')).to.equal(200);
    });
  });

  describe('AC-8.3.5: Direction-aware context search', () => {
    it('should weight preceding context higher by default (1.2x)', () => {
      const enhancer = new ContextEnhancer();
      const config = enhancer.getConfig();

      expect(config.precedingWeight).to.equal(1.2);
      expect(config.followingWeight).to.equal(0.8);
    });

    it('should apply higher boost for preceding context', () => {
      const enhancer = new ContextEnhancer();

      // Entity with context BEFORE
      const entityBefore = {
        text: 'Test',
        type: 'UNKNOWN',
        start: 10,
        end: 14,
        confidence: 0.5,
      };
      const textBefore = '    name  Test';

      // Entity with context AFTER
      const entityAfter = {
        text: 'Test',
        type: 'UNKNOWN',
        start: 0,
        end: 4,
        confidence: 0.5,
      };
      const textAfter = 'Test      name';

      const contextWords = [{ word: 'name', weight: 1.0, polarity: 'positive' }];

      const resultBefore = enhancer.enhanceWithDetails(
        entityBefore,
        textBefore,
        contextWords,
      );
      const resultAfter = enhancer.enhanceWithDetails(
        entityAfter,
        textAfter,
        contextWords,
      );

      // Preceding context should give higher boost
      expect(resultBefore.boostApplied).to.be.greaterThan(
        resultAfter.boostApplied,
      );
    });

    it('should allow custom direction weights', () => {
      const enhancer = new ContextEnhancer({
        precedingWeight: 1.0,
        followingWeight: 1.0,
      });

      const entityBefore = {
        text: 'Test',
        type: 'UNKNOWN',
        start: 10,
        end: 14,
        confidence: 0.5,
      };
      const textBefore = '    name  Test';

      const entityAfter = {
        text: 'Test',
        type: 'UNKNOWN',
        start: 0,
        end: 4,
        confidence: 0.5,
      };
      const textAfter = 'Test      name';

      const contextWords = [{ word: 'name', weight: 1.0, polarity: 'positive' }];

      const resultBefore = enhancer.enhanceWithDetails(
        entityBefore,
        textBefore,
        contextWords,
      );
      const resultAfter = enhancer.enhanceWithDetails(
        entityAfter,
        textAfter,
        contextWords,
      );

      // With equal weights, boost should be similar
      expect(resultBefore.boostApplied).to.be.closeTo(
        resultAfter.boostApplied,
        0.01,
      );
    });
  });

  describe('AC-8.3.6: Negative context words support', () => {
    it('should reduce confidence when negative context found', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'test@example.com',
        type: 'EMAIL',
        start: 0,
        end: 16,
        confidence: 0.7,
      };
      const fullText = 'test@example.com is a placeholder email';
      const contextWords = [
        { word: 'placeholder', weight: 0.8, polarity: 'negative' },
      ];

      const result = enhancer.enhanceWithDetails(
        entity,
        fullText,
        contextWords,
      );

      expect(result.entity.confidence).to.be.lessThan(0.7);
      expect(result.boostApplied).to.be.lessThan(0);
    });

    it('should net positive and negative context', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'John Smith',
        type: 'PERSON_NAME',
        start: 10,
        end: 20,
        confidence: 0.5,
      };
      const fullText = '    Name: John Smith example.com';
      const contextWords = [
        { word: 'name', weight: 1.0, polarity: 'positive' },
        { word: 'example.com', weight: 0.9, polarity: 'negative' },
      ];

      const result = enhancer.enhanceWithDetails(
        entity,
        fullText,
        contextWords,
      );

      // Found both positive and negative, should be less than max boost
      expect(result.contextFound).to.include('name');
      expect(result.contextFound).to.include('example.com');
    });
  });

  describe('AC-8.3.7: DenyList safety guard', () => {
    it('should not enhance entities that are denied by DenyList', () => {
      DenyList.reset();
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Montant', // French table header, denied by default
        type: 'PERSON_NAME',
        start: 0,
        end: 7,
        confidence: 0.5,
      };
      const fullText = 'Montant is in a table with Name context';
      const contextWords = [{ word: 'name', weight: 1.0, polarity: 'positive' }];

      const result = enhancer.enhanceWithDetails(
        entity,
        fullText,
        contextWords,
      );

      expect(result.skipped).to.be.true;
      expect(result.skipReason).to.include('DenyList');
      expect(result.entity.confidence).to.equal(0.5); // Unchanged
    });

    it('should enhance entities that are not denied', () => {
      DenyList.reset();
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Jean Dupont',
        type: 'PERSON_NAME',
        start: 10,
        end: 21,
        confidence: 0.5,
      };
      const fullText = '    Name: Jean Dupont';
      const contextWords = [{ word: 'name', weight: 1.0, polarity: 'positive' }];

      const result = enhancer.enhanceWithDetails(
        entity,
        fullText,
        contextWords,
      );

      expect(result.skipped).to.be.false;
      expect(result.entity.confidence).to.be.greaterThan(0.5);
    });
  });

  describe('AC-8.3.8: Confidence capping and floor', () => {
    it('should cap confidence at 1.0', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Test',
        type: 'PERSON_NAME',
        start: 10,
        end: 14,
        confidence: 0.9, // High base confidence
      };
      const fullText = '    Name: Test with contact info';
      const contextWords = [
        { word: 'name', weight: 1.0, polarity: 'positive' },
        { word: 'contact', weight: 1.0, polarity: 'positive' },
      ];

      const result = enhancer.enhance(entity, fullText, contextWords);

      expect(result.confidence).to.equal(1.0);
    });

    it('should floor confidence at 0.0', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'test@example.com',
        type: 'EMAIL',
        start: 0,
        end: 16,
        confidence: 0.1, // Low base confidence
      };
      const fullText = 'test@example.com placeholder test fake sample';
      const contextWords = [
        { word: 'placeholder', weight: 1.0, polarity: 'negative' },
        { word: 'test', weight: 1.0, polarity: 'negative' },
        { word: 'fake', weight: 1.0, polarity: 'negative' },
        { word: 'sample', weight: 1.0, polarity: 'negative' },
      ];

      const result = enhancer.enhance(entity, fullText, contextWords);

      expect(result.confidence).to.be.at.least(0);
    });
  });

  describe('Case-insensitive matching', () => {
    it('should match context words case-insensitively', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Test',
        type: 'PERSON_NAME',
        start: 10,
        end: 14,
        confidence: 0.5,
      };
      const fullText = '    NAME: Test';
      const contextWords = [{ word: 'name', weight: 1.0, polarity: 'positive' }];

      const result = enhancer.enhance(entity, fullText, contextWords);

      expect(result.confidence).to.be.greaterThan(0.5);
    });

    it('should match mixed case context words', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Test',
        type: 'PERSON_NAME',
        start: 10,
        end: 14,
        confidence: 0.5,
      };
      const fullText = '    NaMe: Test';
      const contextWords = [{ word: 'NAME', weight: 1.0, polarity: 'positive' }];

      const result = enhancer.enhance(entity, fullText, contextWords);

      expect(result.confidence).to.be.greaterThan(0.5);
    });
  });

  describe('enhanceWithDetails() result structure', () => {
    it('should return complete EnhancementResult structure', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Jean Dupont',
        type: 'PERSON_NAME',
        start: 10,
        end: 21,
        confidence: 0.5,
      };
      const fullText = '    Nom:  Jean Dupont';
      const contextWords = [{ word: 'nom', weight: 1.0, polarity: 'positive' }];

      const result = enhancer.enhanceWithDetails(
        entity,
        fullText,
        contextWords,
      );

      expect(result).to.have.property('entity');
      expect(result).to.have.property('contextFound');
      expect(result).to.have.property('boostApplied');
      expect(result).to.have.property('originalConfidence');
      expect(result).to.have.property('skipped');
      expect(result.contextFound).to.include('nom');
      expect(result.originalConfidence).to.equal(0.5);
    });
  });

  describe('enhanceAll() batch processing', () => {
    it('should enhance multiple entities in a document', () => {
      const enhancer = new ContextEnhancer();
      const entities = [
        { text: 'Jean', type: 'PERSON_NAME', start: 10, end: 14, confidence: 0.5 },
        { text: 'Dupont', type: 'PERSON_NAME', start: 15, end: 21, confidence: 0.5 },
      ];
      const fullText = '    Nom:  Jean Dupont';
      const contextWords = [{ word: 'nom', weight: 1.0, polarity: 'positive' }];

      const results = enhancer.enhanceAll(entities, fullText, contextWords);

      expect(results).to.have.length(2);
      expect(results[0].confidence).to.be.greaterThan(0.5);
      expect(results[1].confidence).to.be.greaterThan(0.5);
    });
  });

  describe('createContextEnhancer() factory function', () => {
    it('should create enhancer with default config', () => {
      const enhancer = createContextEnhancer();

      expect(enhancer).to.be.instanceOf(ContextEnhancer);
      expect(enhancer.getConfig().windowSize).to.equal(100);
    });

    it('should create enhancer with custom config', () => {
      const enhancer = createContextEnhancer({ windowSize: 200 });

      expect(enhancer.getConfig().windowSize).to.equal(200);
    });
  });

  describe('DEFAULT_CONTEXT_ENHANCER_CONFIG export', () => {
    it('should export default configuration', () => {
      expect(DEFAULT_CONTEXT_ENHANCER_CONFIG).to.have.property('windowSize', 100);
      expect(DEFAULT_CONTEXT_ENHANCER_CONFIG).to.have.property(
        'similarityFactor',
        0.35,
      );
      expect(DEFAULT_CONTEXT_ENHANCER_CONFIG).to.have.property(
        'minScoreWithContext',
        0.4,
      );
    });

    it('should be frozen (immutable)', () => {
      expect(Object.isFrozen(DEFAULT_CONTEXT_ENHANCER_CONFIG)).to.be.true;
    });
  });

  describe('Edge cases', () => {
    it('should handle entity at start of text', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Test',
        type: 'PERSON_NAME',
        start: 0,
        end: 4,
        confidence: 0.5,
      };
      const fullText = 'Test with name context after';
      const contextWords = [{ word: 'name', weight: 1.0, polarity: 'positive' }];

      const result = enhancer.enhance(entity, fullText, contextWords);

      expect(result.confidence).to.be.greaterThan(0.5);
    });

    it('should handle entity at end of text', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Test',
        type: 'PERSON_NAME',
        start: 16,
        end: 20,
        confidence: 0.5,
      };
      const fullText = '    Name before Test';
      const contextWords = [{ word: 'name', weight: 1.0, polarity: 'positive' }];

      const result = enhancer.enhance(entity, fullText, contextWords);

      expect(result.confidence).to.be.greaterThan(0.5);
    });

    it('should handle very short text', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'X',
        type: 'PERSON_NAME',
        start: 0,
        end: 1,
        confidence: 0.5,
      };
      const fullText = 'X';
      const contextWords = [{ word: 'name', weight: 1.0, polarity: 'positive' }];

      const result = enhancer.enhance(entity, fullText, contextWords);

      expect(result.confidence).to.equal(0.5); // No context found
    });

    it('should handle null/undefined gracefully', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Test',
        type: 'PERSON_NAME',
        start: 0,
        end: 4,
        confidence: 0.5,
      };

      const result = enhancer.enhance(entity, 'Test', null);

      expect(result.confidence).to.equal(0.5);
    });

    it('should preserve entity source property', () => {
      const enhancer = new ContextEnhancer();
      const entity = {
        text: 'Test',
        type: 'PERSON_NAME',
        start: 5,
        end: 9,
        confidence: 0.5,
        source: 'ML',
      };
      const fullText = 'Name Test';
      const contextWords = [{ word: 'name', weight: 1.0, polarity: 'positive' }];

      const result = enhancer.enhance(entity, fullText, contextWords);

      expect(result.source).to.equal('ML');
    });
  });

  describe('Weight handling', () => {
    it('should apply context word weights', () => {
      const enhancer = new ContextEnhancer();

      // Entity with high-weight context word
      const entityHigh = {
        text: 'Test',
        type: 'UNKNOWN',
        start: 10,
        end: 14,
        confidence: 0.5,
      };
      const textHigh = '    name  Test';

      // Entity with low-weight context word
      const entityLow = {
        text: 'Test',
        type: 'UNKNOWN',
        start: 10,
        end: 14,
        confidence: 0.5,
      };
      const textLow = '    from  Test';

      const contextWordsHigh = [
        { word: 'name', weight: 1.0, polarity: 'positive' },
      ];
      const contextWordsLow = [
        { word: 'from', weight: 0.3, polarity: 'positive' },
      ];

      const resultHigh = enhancer.enhanceWithDetails(
        entityHigh,
        textHigh,
        contextWordsHigh,
      );
      const resultLow = enhancer.enhanceWithDetails(
        entityLow,
        textLow,
        contextWordsLow,
      );

      // Higher weight should give higher boost
      expect(resultHigh.boostApplied).to.be.greaterThan(resultLow.boostApplied);
    });
  });
});
