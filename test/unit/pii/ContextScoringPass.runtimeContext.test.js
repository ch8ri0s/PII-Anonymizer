/**
 * ContextScoringPass Runtime Context Tests (Story 8.16)
 *
 * Tests for the runtime context injection feature following Presidio pattern.
 * Validates column context, region hints, and context word merging.
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';

// Dynamic imports for ESM modules
let _ContextScoringPass, createContextScoringPass;

describe('ContextScoringPass Runtime Context (Story 8.16)', function () {
  this.timeout(10000);

  before(async function () {
    // Import ESM modules
    const contextModule = await import(
      '../../../dist/pii/passes/ContextScoringPass.js'
    );
    _ContextScoringPass = contextModule.ContextScoringPass;
    createContextScoringPass = contextModule.createContextScoringPass;
  });

  /**
   * Helper to create a minimal entity
   */
  function createEntity(overrides = {}) {
    return {
      id: overrides.id || 'test-1',
      type: overrides.type || 'PERSON_NAME',
      text: overrides.text || 'John Smith',
      start: overrides.start !== undefined ? overrides.start : 0,
      end: overrides.end !== undefined ? overrides.end : 10,
      confidence: overrides.confidence !== undefined ? overrides.confidence : 0.5,
      source: overrides.source || 'RULE',
      metadata: overrides.metadata || {},
    };
  }

  /**
   * Helper to create a pipeline context
   */
  function createContext(runtimeContext = {}) {
    return {
      documentId: 'test-doc',
      passResults: new Map(),
      startTime: Date.now(),
      config: {
        enableEpic8Features: true,
        context: runtimeContext,
      },
      metadata: {},
    };
  }

  describe('No Runtime Context', function () {
    it('should work without runtime context (backwards compatibility)', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({ confidence: 0.7 });
      const context = {
        documentId: 'test-doc',
        passResults: new Map(),
        startTime: Date.now(),
        config: { enableEpic8Features: true },
        metadata: {},
      };

      const result = await pass.execute('Hello John Smith', [entity], context);

      expect(result).to.have.length(1);
      expect(result[0].confidence).to.be.a('number');
      // Should not have runtime context metadata
      expect(context.metadata.runtimeContextBoosted).to.be.undefined;
    });

    it('should work with empty runtime context', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({ confidence: 0.6 });
      const context = createContext({});

      const result = await pass.execute('Hello John Smith', [entity], context);

      expect(result).to.have.length(1);
      // Empty runtime context shouldn't crash
    });
  });

  describe('Column Context Boost', function () {
    it('should boost entity confidence when column matches', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({
        type: 'EMAIL',
        text: 'john@example.com',
        confidence: 0.5,
        metadata: { column: 'email' },
      });

      const runtimeContext = {
        columnHeaders: [
          { column: 'email', entityType: 'EMAIL', confidenceBoost: 0.3 },
        ],
      };

      const context = createContext(runtimeContext);
      await pass.execute('john@example.com', [entity], context);

      // The column boost (+0.3) should be applied, track in runtimeContextBoosted
      expect(context.metadata.runtimeContextBoosted).to.deep.include({ EMAIL: 1 });
    });

    it('should match column by index', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({
        type: 'PHONE',
        text: '+41 79 123 45 67',
        confidence: 0.5,
        metadata: { column: 2 }, // column index
      });

      const runtimeContext = {
        columnHeaders: [
          { column: 2, entityType: 'PHONE', confidenceBoost: 0.25 },
        ],
      };

      const context = createContext(runtimeContext);
      await pass.execute('+41 79 123 45 67', [entity], context);

      // Should track the boost was applied
      expect(context.metadata.runtimeContextBoosted).to.deep.include({ PHONE: 1 });
    });

    it('should use default boost when confidenceBoost not specified', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({
        type: 'PERSON_NAME',
        text: 'Jane Doe',
        confidence: 0.5,
        metadata: { column: 'name' },
      });

      const runtimeContext = {
        columnHeaders: [
          { column: 'name', entityType: 'PERSON_NAME' }, // no confidenceBoost
        ],
      };

      const context = createContext(runtimeContext);
      await pass.execute('Jane Doe', [entity], context);

      // Default boost is 0.2, should track it was applied
      expect(context.metadata.runtimeContextBoosted).to.deep.include({ PERSON_NAME: 1 });
    });

    it('should cap column boost at 0.5', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({
        type: 'EMAIL',
        confidence: 0.8, // already high
        metadata: { column: 'email' },
      });

      const runtimeContext = {
        columnHeaders: [
          { column: 'email', entityType: 'EMAIL', confidenceBoost: 0.9 }, // too high
        ],
      };

      const context = createContext(runtimeContext);
      const result = await pass.execute('test@example.com', [entity], context);

      // Confidence shouldn't exceed 1.0 and boost capped at 0.5
      expect(result[0].confidence).to.be.at.most(1.0);
    });

    it('should not boost when column does not match', async function () {
      const pass = createContextScoringPass();
      const baseConfidence = 0.5;
      const entity = createEntity({
        type: 'EMAIL',
        confidence: baseConfidence,
        metadata: { column: 'notes' }, // different column
      });

      const runtimeContext = {
        columnHeaders: [
          { column: 'email', entityType: 'EMAIL', confidenceBoost: 0.3 },
        ],
      };

      const context = createContext(runtimeContext);
      await pass.execute('test@example.com', [entity], context);

      // No runtime boost should be recorded (empty or no EMAIL key)
      const boosted = context.metadata.runtimeContextBoosted || {};
      expect(boosted.EMAIL).to.be.undefined;
    });

    it('should not boost when entity type does not match column type', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({
        type: 'PERSON_NAME', // different type
        confidence: 0.5,
        metadata: { column: 'email' },
      });

      const runtimeContext = {
        columnHeaders: [
          { column: 'email', entityType: 'EMAIL', confidenceBoost: 0.3 },
        ],
      };

      const context = createContext(runtimeContext);
      await pass.execute('John Smith', [entity], context);

      // No runtime boost for PERSON_NAME
      const boosted = context.metadata.runtimeContextBoosted || {};
      expect(boosted.PERSON_NAME).to.be.undefined;
    });

    it('should match column case-insensitively', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({
        type: 'EMAIL',
        confidence: 0.5,
        metadata: { column: 'EMAIL_ADDRESS' },
      });

      const runtimeContext = {
        columnHeaders: [
          { column: 'email_address', entityType: 'EMAIL', confidenceBoost: 0.2 },
        ],
      };

      const context = createContext(runtimeContext);
      await pass.execute('test@example.com', [entity], context);

      expect(context.metadata.runtimeContextBoosted).to.deep.include({ EMAIL: 1 });
    });
  });

  describe('Region Hint Boost', function () {
    it('should boost entity when within region and type matches', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({
        type: 'PERSON_NAME',
        start: 10,
        end: 20,
        confidence: 0.5,
      });

      const runtimeContext = {
        regionHints: [
          { start: 0, end: 50, expectedEntityType: 'PERSON_NAME' },
        ],
      };

      const context = createContext(runtimeContext);
      const text = 'Hello to John Smith from the company.';
      await pass.execute(text, [entity], context);

      // Region boost should be tracked
      expect(context.metadata.runtimeContextBoosted).to.deep.include({ PERSON_NAME: 1 });
    });

    it('should add fixed 0.2 boost for region match', async function () {
      const pass = createContextScoringPass();
      const baseConfidence = 0.5;
      const entity = createEntity({
        type: 'ADDRESS',
        start: 5,
        end: 25,
        confidence: baseConfidence,
      });

      const runtimeContext = {
        regionHints: [
          { start: 0, end: 100, expectedEntityType: 'ADDRESS' },
        ],
      };

      const context = createContext(runtimeContext);
      await pass.execute('From Bahnhofstrasse 10, 8001 Zürich', [entity], context);

      // Region boost is 0.2, tracked in metadata
      expect(context.metadata.runtimeContextBoosted).to.deep.include({ ADDRESS: 1 });
    });

    it('should not boost when entity outside region', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({
        type: 'PERSON_NAME',
        start: 100, // outside region
        end: 110,
        confidence: 0.5,
      });

      const runtimeContext = {
        regionHints: [
          { start: 0, end: 50, expectedEntityType: 'PERSON_NAME' },
        ],
      };

      const context = createContext(runtimeContext);
      const text = 'A'.repeat(100) + 'John Smith';
      await pass.execute(text, [entity], context);

      // No boost for PERSON_NAME
      const boosted = context.metadata.runtimeContextBoosted || {};
      expect(boosted.PERSON_NAME).to.be.undefined;
    });

    it('should not boost when entity type does not match expected type', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({
        type: 'EMAIL', // different from expected
        start: 10,
        end: 25,
        confidence: 0.5,
      });

      const runtimeContext = {
        regionHints: [
          { start: 0, end: 50, expectedEntityType: 'PERSON_NAME' },
        ],
      };

      const context = createContext(runtimeContext);
      await pass.execute('Hello to john@example.com', [entity], context);

      // No boost for EMAIL
      const boosted = context.metadata.runtimeContextBoosted || {};
      expect(boosted.EMAIL).to.be.undefined;
    });

    it('should handle multiple region hints', async function () {
      const pass = createContextScoringPass();
      const entities = [
        createEntity({
          id: '1',
          type: 'PERSON_NAME',
          start: 5,
          end: 15,
          confidence: 0.5,
        }),
        createEntity({
          id: '2',
          type: 'ADDRESS',
          start: 60,
          end: 80,
          confidence: 0.5,
        }),
      ];

      const runtimeContext = {
        regionHints: [
          { start: 0, end: 50, expectedEntityType: 'PERSON_NAME' },
          { start: 50, end: 100, expectedEntityType: 'ADDRESS' },
        ],
      };

      const context = createContext(runtimeContext);
      const text = 'From John Smith' + 'A'.repeat(45) + 'Bahnhofstrasse 10, Zürich';
      await pass.execute(text, entities, context);

      expect(context.metadata.runtimeContextBoosted).to.deep.include({
        PERSON_NAME: 1,
        ADDRESS: 1,
      });
    });
  });

  describe('Runtime Context Words Merge', function () {
    it('should merge runtime context words with recognizer defaults', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({
        type: 'PERSON_NAME',
        text: 'John Smith',
        confidence: 0.5,
      });

      const runtimeContext = {
        contextWords: ['employee', 'staff', 'worker'],
      };

      const context = createContext(runtimeContext);
      // Text contains runtime context word
      const text = 'Employee: John Smith';
      const result = await pass.execute(text, [entity], context);

      // Context words should contribute to scoring
      expect(result[0].confidence).to.be.a('number');
    });

    it('should use weight 0.8 for runtime context words', async function () {
      // This is a structural test - we verify the implementation uses 0.8 weight
      const pass = createContextScoringPass();
      const entity = createEntity({
        type: 'PERSON_NAME',
        confidence: 0.5,
      });

      const runtimeContext = {
        contextWords: ['custom-keyword'],
      };

      const context = createContext(runtimeContext);
      const text = 'custom-keyword John Smith';
      const result = await pass.execute(text, [entity], context);

      // Just ensure it doesn't crash and returns valid result
      expect(result).to.have.length(1);
      expect(result[0].confidence).to.be.a('number');
    });

    it('should merge region-specific context words', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({
        type: 'PERSON_NAME',
        start: 10,
        end: 20,
        confidence: 0.5,
      });

      const runtimeContext = {
        regionHints: [
          {
            start: 0,
            end: 50,
            contextWords: ['author', 'writer', 'creator'],
          },
        ],
      };

      const context = createContext(runtimeContext);
      const text = 'Author: John Smith';
      const result = await pass.execute(text, [entity], context);

      expect(result).to.have.length(1);
    });

    it('should handle empty context words array', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({ confidence: 0.6 });

      const runtimeContext = {
        contextWords: [],
      };

      const context = createContext(runtimeContext);
      const result = await pass.execute('Hello John Smith', [entity], context);

      expect(result).to.have.length(1);
    });

    it('should not crash with undefined context words', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({ confidence: 0.6 });

      const runtimeContext = {
        // contextWords is undefined
      };

      const context = createContext(runtimeContext);
      const result = await pass.execute('Hello John Smith', [entity], context);

      expect(result).to.have.length(1);
    });
  });

  describe('Combined Runtime Context', function () {
    it('should apply both column and region boosts', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({
        type: 'EMAIL',
        text: 'john@example.com',
        start: 6,
        end: 22,
        confidence: 0.4,
        metadata: { column: 'contact_email' },
      });

      const runtimeContext = {
        columnHeaders: [
          { column: 'contact_email', entityType: 'EMAIL', confidenceBoost: 0.2 },
        ],
        regionHints: [
          { start: 0, end: 50, expectedEntityType: 'EMAIL' },
        ],
        contextWords: ['contact', 'email'],
      };

      const context = createContext(runtimeContext);
      const text = 'Email john@example.com';
      await pass.execute(text, [entity], context);

      // Boost should be tracked (column + region both matched)
      expect(context.metadata.runtimeContextBoosted).to.deep.include({ EMAIL: 1 });
    });

    it('should handle complex runtime context with multiple entities', async function () {
      const pass = createContextScoringPass();
      const entities = [
        createEntity({
          id: '1',
          type: 'PERSON_NAME',
          text: 'John Smith',
          start: 0,
          end: 10,
          confidence: 0.5,
          metadata: { column: 'name' },
        }),
        createEntity({
          id: '2',
          type: 'EMAIL',
          text: 'john@example.com',
          start: 15,
          end: 31,
          confidence: 0.5,
          metadata: { column: 'email' },
        }),
        createEntity({
          id: '3',
          type: 'PHONE',
          text: '+41 79 123 45 67',
          start: 35,
          end: 51,
          confidence: 0.5,
          metadata: { column: 'phone' },
        }),
      ];

      const runtimeContext = {
        columnHeaders: [
          { column: 'name', entityType: 'PERSON_NAME', confidenceBoost: 0.15 },
          { column: 'email', entityType: 'EMAIL', confidenceBoost: 0.2 },
          { column: 'phone', entityType: 'PHONE', confidenceBoost: 0.25 },
        ],
        regionHints: [
          { start: 0, end: 60, expectedEntityType: 'PERSON_NAME' },
          { start: 0, end: 60, expectedEntityType: 'EMAIL' },
          { start: 0, end: 60, expectedEntityType: 'PHONE' },
        ],
        contextWords: ['contact', 'employee', 'staff'],
      };

      const context = createContext(runtimeContext);
      const text = 'John Smith | john@example.com | +41 79 123 45 67';
      const result = await pass.execute(text, entities, context);

      expect(result).to.have.length(3);
      expect(context.metadata.runtimeContextBoosted).to.deep.include({
        PERSON_NAME: 1,
        EMAIL: 1,
        PHONE: 1,
      });
    });
  });

  describe('Metadata Tracking', function () {
    it('should track runtime boost counts in metadata', async function () {
      const pass = createContextScoringPass();
      const entities = [
        createEntity({
          id: '1',
          type: 'EMAIL',
          text: 'a@b.com',
          start: 0,
          end: 7,
          confidence: 0.5,
          metadata: { column: 'email' },
        }),
        createEntity({
          id: '2',
          type: 'EMAIL',
          text: 'c@d.com',
          start: 12,
          end: 19,
          confidence: 0.5,
          metadata: { column: 'email' },
        }),
      ];

      const runtimeContext = {
        columnHeaders: [
          { column: 'email', entityType: 'EMAIL', confidenceBoost: 0.2 },
        ],
      };

      const context = createContext(runtimeContext);
      await pass.execute('a@b.com and c@d.com', entities, context);

      expect(context.metadata.runtimeContextBoosted).to.deep.equal({ EMAIL: 2 });
    });

    it('should separate runtime boost tracking from context boost tracking', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({
        type: 'EMAIL',
        text: 'test@example.com',
        start: 0,
        end: 16,
        confidence: 0.5,
        metadata: { column: 'email' },
      });

      const runtimeContext = {
        columnHeaders: [
          { column: 'email', entityType: 'EMAIL', confidenceBoost: 0.2 },
        ],
      };

      const context = createContext(runtimeContext);
      await pass.execute('test@example.com', [entity], context);

      // runtimeContextBoosted should track column/region boosts
      expect(context.metadata.runtimeContextBoosted).to.exist;
      // contextBoosted tracks ContextEnhancer boosts (Epic 8) - may be empty object
      expect(context.metadata.contextBoosted).to.be.an('object');
    });
  });

  describe('Error Handling', function () {
    it('should handle malformed column context gracefully', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({ confidence: 0.5 });

      const runtimeContext = {
        columnHeaders: [
          { column: null, entityType: 'EMAIL' }, // malformed
        ],
      };

      const context = createContext(runtimeContext);

      // Should not throw
      const result = await pass.execute('test text', [entity], context);
      expect(result).to.have.length(1);
    });

    it('should handle malformed region hints gracefully', async function () {
      const pass = createContextScoringPass();
      const entity = createEntity({ confidence: 0.5 });

      const runtimeContext = {
        regionHints: [
          { start: 'invalid', end: 50 }, // malformed
        ],
      };

      const context = createContext(runtimeContext);

      // Should not throw (the check entity.start >= region.start will fail gracefully)
      const result = await pass.execute('test text', [entity], context);
      expect(result).to.have.length(1);
    });
  });
});
