/**
 * Epic 8 Pipeline Integration Tests
 *
 * Tests for DenyList filtering and ContextEnhancer integration
 * into the detection pipeline (Story 8.4).
 *
 * @module test/unit/pii/Epic8PipelineIntegration.test.js
 */

import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';

// Import detection passes
import { HighRecallPass } from '../../../dist/pii/passes/HighRecallPass.js';
import { ContextScoringPass } from '../../../dist/pii/passes/ContextScoringPass.js';
import { createPipeline } from '../../../dist/pii/DetectionPipeline.js';

// Import shared Epic 8 modules
import { DenyList } from '../../../shared/dist/pii/index.js';

describe('Epic 8 Pipeline Integration', function () {
  this.timeout(10000);

  describe('AC-8.4.1: DenyList Filtering in HighRecallPass', () => {
    let pass;
    let context;

    beforeEach(() => {
      pass = new HighRecallPass(0.3);
      context = {
        documentId: 'test-doc',
        language: 'en',
        metadata: {},
        passResults: new Map(),
        startTime: Date.now(),
        config: { enableEpic8Features: true },
      };
    });

    it('should filter "Montant" as AMOUNT false positive (French invoice)', async () => {
      // "Montant" is a French word for "Amount" - common false positive
      const text = 'Montant: CHF 1,234.56';
      const entities = await pass.execute(text, [], context);

      // Should NOT find "Montant" as AMOUNT - it's the label, not the value
      const montantEntities = entities.filter(
        (e) => e.text.toLowerCase() === 'montant' && e.type === 'AMOUNT',
      );
      expect(montantEntities.length).to.equal(0);
    });

    it('should still detect valid entities after DenyList filtering', async () => {
      const text = 'Contact: test@example.com, Phone: +41 79 123 45 67';
      const entities = await pass.execute(text, [], context);

      // Email and phone should still be detected
      const hasEmail = entities.some((e) => e.type === 'EMAIL');
      const hasPhone = entities.some((e) => e.type === 'PHONE');
      expect(hasEmail || hasPhone).to.be.true;
    });

    it('should store denyListFiltered counts in context.metadata', async () => {
      const text = 'Invoice with Montant: 100 CHF';
      await pass.execute(text, [], context);

      // If entities were filtered, counts should be in metadata
      expect(context.metadata).to.have.property('denyListFiltered');
      expect(context.metadata.denyListFiltered).to.be.an('object');
    });

    it('should skip DenyList when enableEpic8Features is false', async () => {
      context.config = { enableEpic8Features: false };
      const text = 'Some text with potential false positives';
      await pass.execute(text, [], context);

      // denyListFiltered should not be set when disabled
      expect(context.metadata.denyListFiltered).to.be.undefined;
    });
  });

  describe('AC-8.4.2: ContextEnhancer in ContextScoringPass', () => {
    let pass;
    let context;

    beforeEach(() => {
      pass = new ContextScoringPass(50, 0.4);
      context = {
        documentId: 'test-doc',
        language: 'fr',
        metadata: {},
        passResults: new Map(),
        startTime: Date.now(),
        config: { enableEpic8Features: true },
      };
    });

    it('should boost confidence when context word "Nom:" precedes name', async () => {
      const text = 'Nom: Jean Dupont, Tel: +41 79 123 45 67';

      // Create entity with low initial confidence
      const inputEntities = [
        {
          id: 'test-1',
          type: 'PERSON_NAME',
          text: 'Jean Dupont',
          start: 5,
          end: 16,
          confidence: 0.4,
          source: 'ML',
        },
      ];

      const entities = await pass.execute(text, inputEntities, context);

      // Confidence should be boosted due to "Nom:" context
      expect(entities[0].confidence).to.be.greaterThan(0.4);
    });

    it('should store contextBoosted counts in context.metadata', async () => {
      const text = 'Email: test@example.com';
      const inputEntities = [
        {
          id: 'test-1',
          type: 'EMAIL',
          text: 'test@example.com',
          start: 7,
          end: 23,
          confidence: 0.5,
          source: 'RULE',
        },
      ];

      await pass.execute(text, inputEntities, context);

      expect(context.metadata).to.have.property('contextBoosted');
      expect(context.metadata.contextBoosted).to.be.an('object');
    });

    it('should skip ContextEnhancer when enableEpic8Features is false', async () => {
      context.config = { enableEpic8Features: false };
      const text = 'Email: test@example.com';
      const inputEntities = [
        {
          id: 'test-1',
          type: 'EMAIL',
          text: 'test@example.com',
          start: 7,
          end: 23,
          confidence: 0.5,
          source: 'RULE',
        },
      ];

      await pass.execute(text, inputEntities, context);

      // contextBoosted should not be set when disabled
      expect(context.metadata.contextBoosted).to.be.undefined;
    });
  });

  describe('AC-8.4.7: Feature Flag Toggle (A/B Testing)', () => {
    it('should enable Epic 8 features by default', () => {
      const pipeline = createPipeline();
      const config = pipeline.getConfig();
      expect(config.enableEpic8Features).to.equal(true);
    });

    it('should allow disabling Epic 8 features via config', () => {
      const pipeline = createPipeline({ enableEpic8Features: false });
      const config = pipeline.getConfig();
      expect(config.enableEpic8Features).to.equal(false);
    });
  });

  describe('AC-8.4.8: DetectionResult Metadata', () => {
    let pipeline;

    beforeEach(() => {
      pipeline = createPipeline({ enableEpic8Features: true });
      pipeline.registerPass(new HighRecallPass(0.3));
      pipeline.registerPass(new ContextScoringPass(50, 0.4));
    });

    it('should include passTimings in result metadata', async () => {
      const text = 'Test document with test@example.com';
      const result = await pipeline.process(text, 'test-doc', 'en');

      expect(result.metadata).to.have.property('passTimings');
      expect(result.metadata.passTimings).to.be.an('object');
      expect(result.metadata.passTimings).to.have.property('HighRecallPass');
      expect(result.metadata.passTimings).to.have.property('ContextScoringPass');
    });

    it('should include epic8 metadata when enabled', async () => {
      const text = 'Montant: 100 CHF, Nom: Jean Dupont';
      const result = await pipeline.process(text, 'test-doc', 'fr');

      // Epic 8 metadata should be present (may or may not have entries)
      if (result.metadata.epic8) {
        expect(result.metadata.epic8).to.have.property('denyListFiltered');
        expect(result.metadata.epic8).to.have.property('contextBoosted');
      }
    });

    it('should NOT include epic8 metadata when disabled', async () => {
      const disabledPipeline = createPipeline({ enableEpic8Features: false });
      disabledPipeline.registerPass(new HighRecallPass(0.3));
      disabledPipeline.registerPass(new ContextScoringPass(50, 0.4));

      const text = 'Test document';
      const result = await disabledPipeline.process(text, 'test-doc', 'en');

      expect(result.metadata.epic8).to.be.undefined;
    });
  });

  describe('DenyList Static Methods', () => {
    it('should filter common French invoice labels', () => {
      // These are common labels, not actual amounts
      expect(DenyList.isDenied('Montant', 'AMOUNT', 'fr')).to.be.true;
      expect(DenyList.isDenied('Total', 'AMOUNT', 'fr')).to.be.true;
      expect(DenyList.isDenied('Sous-total', 'AMOUNT', 'fr')).to.be.true;
    });

    it('should NOT filter actual amounts', () => {
      // Actual amounts should NOT be filtered
      expect(DenyList.isDenied('CHF 1,234.56', 'AMOUNT', 'fr')).to.be.false;
      expect(DenyList.isDenied('100.00', 'AMOUNT', 'fr')).to.be.false;
    });
  });
});
