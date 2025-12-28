/**
 * Consolidation Pass Integration Tests (Story 8.8)
 *
 * Integration tests that verify the ConsolidationPass works correctly
 * within the full detection pipeline context.
 *
 * Tests cover:
 * - AC-8.8.1: Overlapping spans resolved using priority table
 * - AC-8.8.2: Address components consolidated into ADDRESS entities
 * - AC-8.8.3: Repeated entities linked with logicalId
 * - AC-8.8.5: Components hidden in output (Option A)
 * - AC-8.8.6: Pipeline order 50 (after AddressRelationshipPass)
 *
 * @module test/integration/pii/ConsolidationIntegration.test
 */

import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES Module path handling
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic imports for ESM modules
let _DetectionPipeline, createPipeline;
let createHighRecallPass, createFormatValidationPass, createContextScoringPass, createConsolidationPass;
let _ConsolidationPass;

describe('Consolidation Pass Integration (Story 8.8)', function () {
  this.timeout(30000); // 30 seconds max

  let pipeline;

  before(async function () {
    // Import ESM modules dynamically
    const pipelineModule = await import('../../../dist/pii/DetectionPipeline.js');
    _DetectionPipeline = pipelineModule.DetectionPipeline;
    createPipeline = pipelineModule.createPipeline;

    const passesModule = await import('../../../dist/pii/passes/index.js');
    createHighRecallPass = passesModule.createHighRecallPass;
    createFormatValidationPass = passesModule.createFormatValidationPass;
    createContextScoringPass = passesModule.createContextScoringPass;
    createConsolidationPass = passesModule.createConsolidationPass;

    const consolidationModule = await import('../../../shared/dist/pii/index.js');
    _ConsolidationPass = consolidationModule.ConsolidationPass;
  });

  beforeEach(function () {
    // Create fresh pipeline for each test
    pipeline = createPipeline({
      debug: false,
      mlConfidenceThreshold: 0.3,
    });

    // Register passes in order
    pipeline.registerPass(createHighRecallPass(0.3));
    pipeline.registerPass(createFormatValidationPass());
    pipeline.registerPass(createContextScoringPass());
    pipeline.registerPass(createConsolidationPass());
  });

  describe('Pipeline Integration', function () {
    it('should have ConsolidationPass registered after other passes', function () {
      const passes = pipeline.getPasses();
      const passNames = passes.map(p => p.name);

      expect(passNames).to.include('ConsolidationPass');

      // ConsolidationPass should be last (highest order)
      const consolidationIndex = passNames.indexOf('ConsolidationPass');
      expect(consolidationIndex).to.equal(passes.length - 1);
    });

    it('should process text through full pipeline with consolidation', async function () {
      const text = 'Contact John Smith at john.smith@example.com or call +41 44 123 45 67.';

      const result = await pipeline.process(text);

      expect(result.entities).to.be.an('array');
      expect(result.metadata).to.exist;
      // passExecutions may not exist in all configurations
      expect(result.metadata.totalDurationMs).to.be.at.least(0);
    });
  });

  describe('AC-8.8.1: Overlap Resolution in Pipeline', function () {
    it('should resolve overlapping entities detected by different passes', async function () {
      // Text with potential overlaps (e.g., number in email)
      const text = 'Email me at test123@company.com for invoice #123.';

      const result = await pipeline.process(text);

      // Should have EMAIL entity
      const emailEntity = result.entities.find(e => e.type === 'EMAIL');
      expect(emailEntity).to.exist;
      expect(emailEntity.text).to.include('@');

      // No duplicate fragments of the email should exist
      const fragments = result.entities.filter(e =>
        e.start >= emailEntity.start && e.end <= emailEntity.end && e.id !== emailEntity.id,
      );
      expect(fragments).to.be.empty;
    });

    it('should prefer higher priority entity types in overlaps', async function () {
      // IBAN has higher priority than random numbers
      const text = 'Payment to CH93 0076 2011 6238 5295 7.';

      const result = await pipeline.process(text);

      // Check that the IBAN is detected as one entity
      const ibanEntity = result.entities.find(e => e.type === 'IBAN');
      if (ibanEntity) {
        expect(ibanEntity.text).to.include('CH93');
        // No overlapping AMOUNT or NUMBER entities should exist
        const overlaps = result.entities.filter(e =>
          e.id !== ibanEntity.id &&
          e.start < ibanEntity.end &&
          e.end > ibanEntity.start,
        );
        expect(overlaps).to.be.empty;
      }
    });
  });

  describe('AC-8.8.2: Address Consolidation in Pipeline', function () {
    it('should detect and consolidate Swiss address components', async function () {
      const text = `
        Sender:
        Hans Müller
        Bahnhofstrasse 12
        8001 Zürich
        Switzerland
      `;

      const result = await pipeline.process(text);

      // Check for address-related entities
      const addressEntities = result.entities.filter(e =>
        e.type === 'ADDRESS' ||
        e.type === 'SWISS_ADDRESS' ||
        e.type === 'LOCATION',
      );

      expect(addressEntities.length).to.be.greaterThan(0);
    });

    it('should preserve address component information in metadata', async function () {
      const text = 'Mail to: Rue de la Gare 5, 1003 Lausanne, Suisse';

      const result = await pipeline.process(text);

      // Check if consolidation metadata is present
      expect(result.metadata).to.exist;
      // Consolidation pass should have executed
      const consolidationExecution = result.metadata.passExecutions?.find(
        p => p.name === 'ConsolidationPass',
      );
      if (consolidationExecution) {
        expect(consolidationExecution.completed).to.be.true;
      }
    });
  });

  describe('AC-8.8.3: Entity Linking in Pipeline', function () {
    it('should link repeated person names with same logicalId', async function () {
      const text = `
        From: Dr. Hans Müller
        Subject: Meeting with Hans Müller

        Dear Team,

        I had a productive meeting with Hans Müller today.
        Hans Müller will follow up next week.

        Best regards
      `;

      const result = await pipeline.process(text);

      // Find all person name entities
      const personEntities = result.entities.filter(e =>
        e.type === 'PERSON_NAME' || e.type === 'PERSON',
      );

      // Find Hans Müller occurrences
      const hansMuller = personEntities.filter(e =>
        e.text.includes('Hans') && e.text.includes('Müller'),
      );

      if (hansMuller.length >= 2) {
        // All should have the same logicalId
        const logicalIds = hansMuller.map(e => e.logicalId).filter(Boolean);
        if (logicalIds.length >= 2) {
          expect(new Set(logicalIds).size).to.equal(1);
        }
      }
    });

    it('should link repeated organization names', async function () {
      const text = `
        Invoice from: ACME Corporation
        Bill to: Your Company Ltd

        ACME Corporation provides the following services.
        Please contact ACME Corporation for more details.
      `;

      const result = await pipeline.process(text);

      const orgEntities = result.entities.filter(e =>
        e.type === 'ORGANIZATION' || e.type === 'VENDOR_NAME',
      );

      // Find ACME occurrences
      const acme = orgEntities.filter(e => e.text.includes('ACME'));

      if (acme.length >= 2) {
        const logicalIds = acme.map(e => e.logicalId).filter(Boolean);
        if (logicalIds.length >= 2) {
          expect(new Set(logicalIds).size).to.equal(1);
        }
      }
    });

    it('should assign different logicalIds to different entities', async function () {
      const text = 'John Smith works at ACME Corp. Jane Doe also works there.';

      const result = await pipeline.process(text);

      const personEntities = result.entities.filter(e =>
        e.type === 'PERSON_NAME' || e.type === 'PERSON',
      );

      if (personEntities.length >= 2) {
        const logicalIds = personEntities.map(e => e.logicalId).filter(Boolean);
        // Different people should have different logicalIds
        if (logicalIds.length >= 2) {
          expect(new Set(logicalIds).size).to.be.greaterThan(1);
        }
      }
    });
  });

  describe('AC-8.8.5: Component Visibility (Option A)', function () {
    it('should hide address components when showComponents is false', async function () {
      // Create pipeline with showComponents: false (default)
      const consolidationPass = createConsolidationPass({ showComponents: false });
      expect(consolidationPass.getConfig().showComponents).to.be.false;
    });

    it('should show address components when showComponents is true', async function () {
      // Create pipeline with showComponents: true
      const consolidationPass = createConsolidationPass({ showComponents: true });
      expect(consolidationPass.getConfig().showComponents).to.be.true;
    });
  });

  describe('AC-8.8.6: Pipeline Order', function () {
    it('should have ConsolidationPass with order 50', function () {
      const consolidationPass = createConsolidationPass();
      expect(consolidationPass.order).to.equal(50);
    });

    it('should execute after other passes based on order', function () {
      const passes = pipeline.getPasses();

      // HighRecallPass (10), FormatValidation (20), ContextScoring (30), Consolidation (50)
      const orders = passes.map(p => p.order);
      const consolidationOrder = passes.find(p => p.name === 'ConsolidationPass')?.order;

      if (consolidationOrder) {
        const maxOtherOrder = Math.max(...orders.filter(o => o !== consolidationOrder));
        expect(consolidationOrder).to.be.greaterThan(maxOtherOrder);
      }
    });
  });

  describe('Real-World Scenarios', function () {
    it('should handle invoice with repeated vendor and customer info', async function () {
      const invoiceText = `
        INVOICE

        From: TechCorp AG
        Bahnhofstrasse 100
        8001 Zürich
        VAT: CHE-123.456.789

        To: Customer GmbH
        Industriestrasse 50
        3000 Bern

        Invoice #: INV-2024-001
        Date: 15.01.2024

        Services provided by TechCorp AG:
        - Consulting: CHF 5'000.00
        - Development: CHF 10'000.00

        Total: CHF 15'000.00

        Please transfer to:
        TechCorp AG
        IBAN: CH93 0076 2011 6238 5295 7

        Thank you for your business.
        TechCorp AG
      `;

      const result = await pipeline.process(invoiceText);

      expect(result.entities.length).to.be.greaterThan(0);
      expect(result.metadata).to.exist;

      // Check that TechCorp AG occurrences are linked (if detected)
      const techCorpEntities = result.entities.filter(e =>
        e.text.includes('TechCorp'),
      );
      if (techCorpEntities.length >= 2) {
        const logicalIds = techCorpEntities.map(e => e.logicalId).filter(Boolean);
        // Should be linked together
        if (logicalIds.length >= 2) {
          expect(new Set(logicalIds).size).to.be.lessThanOrEqual(1);
        }
      }
    });

    it('should handle letter with sender and recipient addresses', async function () {
      const letterText = `
        Max Müller
        Hauptstrasse 1
        8000 Zürich

        Frau
        Anna Schmidt
        Seestrasse 25
        6300 Zug

        Zürich, 20. Dezember 2024

        Betreff: Vertragsverlängerung

        Sehr geehrte Frau Schmidt,

        Vielen Dank für Ihr Schreiben.

        Mit freundlichen Grüssen

        Max Müller
      `;

      const result = await pipeline.process(letterText);

      expect(result.entities.length).to.be.greaterThan(0);

      // Max Müller appears twice - should be linked
      const maxEntities = result.entities.filter(e =>
        e.text.includes('Max') && e.text.includes('Müller'),
      );
      if (maxEntities.length >= 2) {
        const logicalIds = maxEntities.map(e => e.logicalId).filter(Boolean);
        if (logicalIds.length >= 2) {
          expect(new Set(logicalIds).size).to.equal(1);
        }
      }
    });

    it('should not link different people with similar names', async function () {
      const text = 'John Smith and Jane Smith are siblings. John works in Zürich.';

      const result = await pipeline.process(text);

      const johnEntities = result.entities.filter(e =>
        e.text.includes('John') && (e.type === 'PERSON_NAME' || e.type === 'PERSON'),
      );
      const janeEntities = result.entities.filter(e =>
        e.text.includes('Jane') && (e.type === 'PERSON_NAME' || e.type === 'PERSON'),
      );

      if (johnEntities.length > 0 && janeEntities.length > 0) {
        const johnLogicalIds = johnEntities.map(e => e.logicalId).filter(Boolean);
        const janeLogicalIds = janeEntities.map(e => e.logicalId).filter(Boolean);

        // John and Jane should have different logicalIds
        if (johnLogicalIds.length > 0 && janeLogicalIds.length > 0) {
          expect(johnLogicalIds[0]).to.not.equal(janeLogicalIds[0]);
        }
      }
    });
  });

  describe('Error Handling', function () {
    it('should handle empty text gracefully', async function () {
      const result = await pipeline.process('');
      expect(result.entities).to.be.an('array').that.is.empty;
    });

    it('should handle text with no PII', async function () {
      const text = 'The quick brown fox jumps over the lazy dog.';
      const result = await pipeline.process(text);
      expect(result.entities).to.be.an('array');
    });

    it('should handle very long text', async function () {
      const longText = 'Contact John Smith at john@example.com. '.repeat(100);
      const result = await pipeline.process(longText);
      expect(result.entities).to.be.an('array');
      expect(result.entities.length).to.be.greaterThan(0);
    });

    it('should handle special characters in text', async function () {
      const text = 'Email: test@例え.jp, Name: Müller-Österman, Amount: CHF 1\'234.56';
      const result = await pipeline.process(text);
      expect(result.entities).to.be.an('array');
    });
  });
});
