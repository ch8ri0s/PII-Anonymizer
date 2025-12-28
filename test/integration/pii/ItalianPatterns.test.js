/**
 * Italian Address Pattern Integration Tests (Story 8.19)
 *
 * Validates that Italian address patterns (Via, Viale, Piazza, etc.)
 * and Italian postal codes are correctly detected.
 *
 * @module test/integration/pii/ItalianPatterns.test
 */

import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Test logger for consistent output
import { createTestLogger } from '../../helpers/testLogger.js';
const log = createTestLogger('integration:italian');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test paths
const FIXTURES_DIR = path.join(__dirname, '../../fixtures/realistic');
const GROUND_TRUTH_PATH = path.join(__dirname, '../../fixtures/piiAnnotated/realistic-ground-truth.json');

// Dynamic imports
let _DetectionPipeline, createPipeline;
let createHighRecallPass, createFormatValidationPass, createContextScoringPass;
let calculatePrecisionRecall;

describe('Italian Address Pattern Detection (Story 8.19)', function () {
  this.timeout(30000);

  let pipeline;
  let groundTruth;
  let italianInvoice;

  before(async function () {
    // Import ESM modules
    const pipelineModule = await import('../../../dist/pii/DetectionPipeline.js');
    _DetectionPipeline = pipelineModule.DetectionPipeline;
    createPipeline = pipelineModule.createPipeline;

    const passesModule = await import('../../../dist/pii/passes/index.js');
    createHighRecallPass = passesModule.createHighRecallPass;
    createFormatValidationPass = passesModule.createFormatValidationPass;
    createContextScoringPass = passesModule.createContextScoringPass;

    const accuracyModule = await import('../../../shared/dist/test/accuracy.js');
    calculatePrecisionRecall = accuracyModule.calculatePrecisionRecall;

    // Create and configure pipeline
    pipeline = createPipeline({
      debug: false,
      enableEpic8Features: true,
    });
    pipeline.registerPass(createHighRecallPass());
    pipeline.registerPass(createFormatValidationPass());
    pipeline.registerPass(createContextScoringPass());

    // Load ground truth and Italian invoice
    groundTruth = JSON.parse(fs.readFileSync(GROUND_TRUTH_PATH, 'utf-8'));

    const invoiceItPath = path.join(FIXTURES_DIR, 'invoice-it.txt');
    if (fs.existsSync(invoiceItPath)) {
      italianInvoice = {
        filename: 'invoice-it.txt',
        text: fs.readFileSync(invoiceItPath, 'utf-8'),
        ...groundTruth.documents['invoice-it.txt'],
      };
    }
  });

  describe('Italian Street Patterns (Via, Viale, Piazza)', function () {
    it('should detect "Via Nassa 19" as ADDRESS', async function () {
      if (!italianInvoice) this.skip();

      const result = await pipeline.process(italianInvoice.text);
      const addresses = result.entities.filter(e => e.type === 'ADDRESS');

      const viaNassa = addresses.find(e => e.text.includes('Via Nassa'));
      expect(viaNassa, 'Should detect Via Nassa 19').to.exist;
    });

    it('should detect "Viale Roma 42" as ADDRESS', async function () {
      if (!italianInvoice) this.skip();

      const result = await pipeline.process(italianInvoice.text);
      const addresses = result.entities.filter(e => e.type === 'ADDRESS');

      const vialeRoma = addresses.find(e => e.text.includes('Viale Roma'));
      expect(vialeRoma, 'Should detect Viale Roma 42').to.exist;
    });

    it('should detect Italian street patterns with prepositions', async function () {
      const testCases = [
        'Via del Corso 15',
        'Via della Repubblica 8',
        'Piazza dei Miracoli 1',
        'Viale delle Rose 42',
        'Corso di Porta Nuova 3',
      ];

      for (const testCase of testCases) {
        const result = await pipeline.process(testCase);
        const addresses = result.entities.filter(e => e.type === 'ADDRESS');

        expect(
          addresses.length,
          `Should detect "${testCase}" as ADDRESS`,
        ).to.be.at.least(1);
      }
    });

    it('should detect Piazza patterns', async function () {
      const testText = 'Piazza Dante 3, 20121 Milano';
      const result = await pipeline.process(testText);
      const addresses = result.entities.filter(e => e.type === 'ADDRESS');

      expect(addresses.length).to.be.at.least(1);
    });

    it('should detect Corso patterns', async function () {
      const testText = 'Corso Italia 15, 00187 Roma';
      const result = await pipeline.process(testText);
      const addresses = result.entities.filter(e => e.type === 'ADDRESS');

      expect(addresses.length).to.be.at.least(1);
    });
  });

  describe('Italian Postal Code Patterns', function () {
    it('should detect "6900 Lugano" as ADDRESS', async function () {
      if (!italianInvoice) this.skip();

      const result = await pipeline.process(italianInvoice.text);
      const addresses = result.entities.filter(e =>
        e.type === 'ADDRESS' ||
        e.type === 'SWISS_ADDRESS' ||
        e.type === 'EU_ADDRESS',
      );

      const lugano = addresses.find(e => e.text.includes('Lugano'));
      expect(lugano, 'Should detect 6900 Lugano').to.exist;
    });

    it('should detect "20121 Milano" as ADDRESS', async function () {
      if (!italianInvoice) this.skip();

      const result = await pipeline.process(italianInvoice.text);
      const addresses = result.entities.filter(e =>
        e.type === 'ADDRESS' ||
        e.type === 'SWISS_ADDRESS' ||
        e.type === 'EU_ADDRESS',
      );

      const milano = addresses.find(e => e.text.includes('Milano'));
      expect(milano, 'Should detect 20121 Milano').to.exist;
    });

    it('should detect various Italian postal code formats', async function () {
      const testCases = [
        { text: '00187 Roma', expected: 'Roma' },
        { text: '50123 Firenze', expected: 'Firenze' },
        { text: '80121 Napoli', expected: 'Napoli' },
        { text: '10121 Torino', expected: 'Torino' },
      ];

      for (const testCase of testCases) {
        const result = await pipeline.process(testCase.text);
        const addresses = result.entities.filter(e =>
          e.type === 'ADDRESS' ||
          e.type === 'EU_ADDRESS',
        );

        expect(
          addresses.some(a => a.text.includes(testCase.expected)),
          `Should detect "${testCase.text}"`,
        ).to.be.true;
      }
    });
  });

  describe('Italian Invoice Full Detection', function () {
    it('should detect all expected entities in Italian invoice', async function () {
      if (!italianInvoice) this.skip();

      const result = await pipeline.process(italianInvoice.text);
      const _expected = italianInvoice.entities;

      // Check key entity types are detected
      const detectedTypes = new Set(result.entities.map(e => e.type));

      expect(detectedTypes.has('ADDRESS') || detectedTypes.has('EU_ADDRESS'),
        'Should detect ADDRESS entities').to.be.true;
      expect(detectedTypes.has('EMAIL'), 'Should detect EMAIL').to.be.true;
      expect(detectedTypes.has('PHONE') || detectedTypes.has('PHONE_NUMBER'),
        'Should detect PHONE').to.be.true;
      expect(detectedTypes.has('IBAN'), 'Should detect IBAN').to.be.true;
    });

    it('should achieve high recall on Italian invoice', async function () {
      if (!italianInvoice) this.skip();

      const result = await pipeline.process(italianInvoice.text);
      const detected = result.entities.map(e => ({
        text: e.text,
        type: e.type,
        start: e.start,
        end: e.end,
        confidence: e.confidence,
      }));

      const metrics = calculatePrecisionRecall(detected, italianInvoice.entities);

      log.info('Italian Invoice metrics', {
        recall: `${(metrics.recall * 100).toFixed(1)}%`,
        precision: `${(metrics.precision * 100).toFixed(1)}%`,
      });

      // Italian invoice should achieve at least 70% recall
      // (Current: 75%, targets will improve with ML model)
      expect(
        metrics.recall,
        `Italian invoice recall ${(metrics.recall * 100).toFixed(1)}% should be >= 70%`,
      ).to.be.at.least(0.70);
    });

    it('should not produce false positives on table headers', async function () {
      if (!italianInvoice) this.skip();

      const result = await pipeline.process(italianInvoice.text);

      // These Italian/mixed words should NOT be detected as person names
      const falsePositiveTerms = ['DESCRIZIONE', 'IMPORTO', 'Totale', 'Servizi', 'Licenza'];
      const personNames = result.entities.filter(e => e.type === 'PERSON_NAME');

      for (const term of falsePositiveTerms) {
        const fp = personNames.find(n => n.text.includes(term));
        expect(fp, `"${term}" should not be detected as PERSON_NAME`).to.be.undefined;
      }
    });
  });

  describe('Cross-Language Italian Addresses', function () {
    it('should detect Italian addresses in German documents', async function () {
      // From hr-de.txt which has "Via Nassa 19, 6900 Lugano"
      const testText = 'Adresse: Via Nassa 19, 6900 Lugano';
      const result = await pipeline.process(testText);
      const addresses = result.entities.filter(e =>
        e.type === 'ADDRESS' ||
        e.type === 'SWISS_ADDRESS' ||
        e.type === 'EU_ADDRESS',
      );

      expect(addresses.length).to.be.at.least(1);
    });

    it('should detect Italian addresses in French documents', async function () {
      // invoice-fr.txt has "Via Nassa 19, 6900 Lugano"
      const testText = 'Adresse du client: Via Nassa 19, 6900 Lugano';
      const result = await pipeline.process(testText);
      const addresses = result.entities.filter(e =>
        e.type === 'ADDRESS' ||
        e.type === 'SWISS_ADDRESS' ||
        e.type === 'EU_ADDRESS',
      );

      expect(addresses.length).to.be.at.least(1);
    });
  });

  describe('Edge Cases', function () {
    it('should not detect "Via" alone without street name', async function () {
      const testText = 'Via email or via phone';
      const result = await pipeline.process(testText);
      const addresses = result.entities.filter(e => e.type === 'ADDRESS');

      // Should not detect these as addresses
      expect(addresses.length).to.equal(0);
    });

    it('should require minimum 3-char city name after postal code', async function () {
      // "6900 Lu" should not match (too short city name)
      const testText = 'Code: 6900 Lu (invalid)';
      const result = await pipeline.process(testText);
      const addresses = result.entities.filter(e =>
        e.type === 'ADDRESS' ||
        e.type === 'SWISS_ADDRESS' ||
        e.type === 'EU_ADDRESS',
      );

      // Should not detect this as an address
      expect(
        addresses.some(a => a.text.includes('6900 Lu')),
        'Should not detect "6900 Lu" with 2-char city',
      ).to.be.false;
    });
  });
});
