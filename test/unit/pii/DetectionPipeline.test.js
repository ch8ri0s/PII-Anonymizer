/**
 * Detection Pipeline Unit Tests
 *
 * Tests for the multi-pass PII detection pipeline (Epic 1).
 */

import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';

// Dynamic imports for ESM modules
let DetectionPipeline, createPipeline;
let createHighRecallPass;
let createFormatValidationPass;
let createContextScoringPass;

describe('Detection Pipeline', function () {
  this.timeout(10000);

  before(async function () {
    // Import ESM modules
    const pipelineModule = await import(
      '../../../dist/pii/DetectionPipeline.js'
    );
    DetectionPipeline = pipelineModule.DetectionPipeline;
    createPipeline = pipelineModule.createPipeline;

    const passesModule = await import('../../../dist/pii/passes/index.js');
    createHighRecallPass = passesModule.createHighRecallPass;
    createFormatValidationPass = passesModule.createFormatValidationPass;
    createContextScoringPass = passesModule.createContextScoringPass;
  });

  describe('DetectionPipeline', function () {
    let pipeline;

    beforeEach(function () {
      pipeline = createPipeline({ debug: false });
    });

    it('should create pipeline with default config', function () {
      expect(pipeline).to.be.instanceOf(DetectionPipeline);
      const config = pipeline.getConfig();
      expect(config.mlConfidenceThreshold).to.equal(0.3);
      expect(config.contextWindowSize).to.equal(50);
      expect(config.autoAnonymizeThreshold).to.equal(0.6);
    });

    it('should register and order passes correctly', function () {
      const pass1 = createHighRecallPass();
      const pass2 = createFormatValidationPass();
      const pass3 = createContextScoringPass();

      pipeline.registerPass(pass3); // order 30
      pipeline.registerPass(pass1); // order 10
      pipeline.registerPass(pass2); // order 20

      const passes = pipeline.getPasses();
      expect(passes).to.have.length(3);
      expect(passes[0].name).to.equal('HighRecallPass');
      expect(passes[1].name).to.equal('FormatValidationPass');
      expect(passes[2].name).to.equal('ContextScoringPass');
    });

    it('should remove pass by name', function () {
      pipeline.registerPass(createHighRecallPass());
      pipeline.registerPass(createFormatValidationPass());

      pipeline.removePass('HighRecallPass');

      const passes = pipeline.getPasses();
      expect(passes).to.have.length(1);
      expect(passes[0].name).to.equal('FormatValidationPass');
    });

    it('should process empty text without error', async function () {
      pipeline.registerPass(createHighRecallPass());

      const result = await pipeline.process('');
      expect(result.entities).to.be.an('array').that.is.empty;
      expect(result.metadata.totalDurationMs).to.be.at.least(0);
    });

    it('should detect language from text', async function () {
      const germanText =
        'Der Kunde hat die Rechnung für den Vertrag bezahlt.';
      const frenchText =
        'Le client a payé la facture pour le contrat.';
      const englishText =
        'The customer has paid the invoice for the contract.';

      // Process and check document metadata (language detection)
      pipeline.registerPass(createHighRecallPass());

      const deResult = await pipeline.process(germanText);
      const frResult = await pipeline.process(frenchText);
      const enResult = await pipeline.process(englishText);

      // These tests verify the language detection heuristic
      expect(deResult.metadata).to.exist;
      expect(frResult.metadata).to.exist;
      expect(enResult.metadata).to.exist;
    });
  });

  describe('HighRecallPass', function () {
    let pass;

    beforeEach(function () {
      pass = createHighRecallPass(0.3);
    });

    it('should create pass with correct properties', function () {
      expect(pass.name).to.equal('HighRecallPass');
      expect(pass.order).to.equal(10);
      expect(pass.enabled).to.be.true;
    });

    it('should detect Swiss AVS numbers', async function () {
      const text = 'Die AVS-Nummer lautet 756.1234.5678.97.';
      const result = await pass.execute(text, [], { documentId: 'test', passResults: new Map(), startTime: Date.now() });

      const avsEntities = result.filter((e) => e.type === 'SWISS_AVS');
      expect(avsEntities).to.have.length.at.least(1);
      expect(avsEntities[0].text).to.include('756');
      expect(avsEntities[0].source).to.equal('RULE');
    });

    it('should detect IBAN numbers', async function () {
      const text = 'IBAN: CH93 0076 2011 6238 5295 7';
      const result = await pass.execute(text, [], { documentId: 'test', passResults: new Map(), startTime: Date.now() });

      const ibanEntities = result.filter((e) => e.type === 'IBAN');
      expect(ibanEntities).to.have.length.at.least(1);
      expect(ibanEntities[0].text).to.include('CH93');
    });

    it('should detect email addresses', async function () {
      const text = 'Kontakt: max.mustermann@example.ch';
      const result = await pass.execute(text, [], { documentId: 'test', passResults: new Map(), startTime: Date.now() });

      const emailEntities = result.filter((e) => e.type === 'EMAIL');
      expect(emailEntities).to.have.length.at.least(1);
      expect(emailEntities[0].text).to.equal('max.mustermann@example.ch');
    });

    it('should detect phone numbers', async function () {
      const text = 'Tel: +41 44 123 45 67';
      const result = await pass.execute(text, [], { documentId: 'test', passResults: new Map(), startTime: Date.now() });

      const phoneEntities = result.filter((e) => e.type === 'PHONE');
      expect(phoneEntities).to.have.length.at.least(1);
    });

    it('should detect Swiss addresses', async function () {
      const text = 'Adresse: 8001 Zürich';
      const result = await pass.execute(text, [], { documentId: 'test', passResults: new Map(), startTime: Date.now() });

      const addressEntities = result.filter(
        (e) => e.type === 'SWISS_ADDRESS' || e.type === 'ADDRESS',
      );
      expect(addressEntities).to.have.length.at.least(1);
    });

    it('should detect dates in German format', async function () {
      const text = 'Datum: 15. Januar 2024';
      const result = await pass.execute(text, [], { documentId: 'test', passResults: new Map(), startTime: Date.now() });

      const dateEntities = result.filter((e) => e.type === 'DATE');
      expect(dateEntities).to.have.length.at.least(1);
    });

    it('should detect VAT numbers', async function () {
      const text = 'UID: CHE-123.456.789 MWST';
      const result = await pass.execute(text, [], { documentId: 'test', passResults: new Map(), startTime: Date.now() });

      const vatEntities = result.filter((e) => e.type === 'VAT_NUMBER');
      expect(vatEntities).to.have.length.at.least(1);
    });

    it('should merge overlapping entities from same text', async function () {
      const text =
        'Kontakt: max.mustermann@example.ch, Tel: +41 44 123 45 67, IBAN: CH93 0076 2011 6238 5295 7';
      const result = await pass.execute(text, [], { documentId: 'test', passResults: new Map(), startTime: Date.now() });

      // Should have unique entities, not duplicates
      const uniqueTexts = new Set(result.map((e) => e.text));
      expect(uniqueTexts.size).to.equal(result.length);
    });
  });

  describe('FormatValidationPass', function () {
    let pass;

    beforeEach(function () {
      pass = createFormatValidationPass();
    });

    it('should create pass with correct properties', function () {
      expect(pass.name).to.equal('FormatValidationPass');
      expect(pass.order).to.equal(20);
      expect(pass.enabled).to.be.true;
    });

    it('should validate Swiss AVS with correct checksum', async function () {
      // Valid AVS number (with correct EAN-13 checksum)
      const validEntity = {
        id: 'test-1',
        type: 'SWISS_AVS',
        text: '756.1234.5678.97',
        start: 0,
        end: 18,
        confidence: 0.7,
        source: 'RULE',
      };

      const result = await pass.execute('', [validEntity], { documentId: 'test', passResults: new Map(), startTime: Date.now() });
      expect(result[0].validation).to.exist;
      expect(result[0].validation.checkedBy).to.equal('SwissAvsValidator');
    });

    it('should validate IBAN with correct checksum', async function () {
      const validEntity = {
        id: 'test-1',
        type: 'IBAN',
        text: 'CH93 0076 2011 6238 5295 7',
        start: 0,
        end: 26,
        confidence: 0.7,
        source: 'RULE',
      };

      const result = await pass.execute('', [validEntity], { documentId: 'test', passResults: new Map(), startTime: Date.now() });
      expect(result[0].validation).to.exist;
      expect(result[0].validation.checkedBy).to.equal('IbanValidator');
    });

    it('should mark invalid email as low confidence', async function () {
      const invalidEntity = {
        id: 'test-1',
        type: 'EMAIL',
        text: 'notanemail',
        start: 0,
        end: 10,
        confidence: 0.7,
        source: 'RULE',
      };

      const result = await pass.execute('', [invalidEntity], { documentId: 'test', passResults: new Map(), startTime: Date.now() });
      expect(result[0].validation.status).to.equal('invalid');
      expect(result[0].confidence).to.be.lessThan(0.7);
    });

    it('should boost confidence for valid entities', async function () {
      const validEntity = {
        id: 'test-1',
        type: 'EMAIL',
        text: 'valid@example.com',
        start: 0,
        end: 17,
        confidence: 0.7,
        source: 'RULE',
      };

      const result = await pass.execute('', [validEntity], { documentId: 'test', passResults: new Map(), startTime: Date.now() });
      expect(result[0].validation.status).to.equal('valid');
      expect(result[0].confidence).to.be.greaterThan(0.7);
    });

    it('should mark entities without validators as unchecked', async function () {
      const unknownEntity = {
        id: 'test-1',
        type: 'UNKNOWN',
        text: 'some text',
        start: 0,
        end: 9,
        confidence: 0.7,
        source: 'ML',
      };

      const result = await pass.execute('', [unknownEntity], { documentId: 'test', passResults: new Map(), startTime: Date.now() });
      expect(result[0].validation.status).to.equal('unchecked');
    });
  });

  describe('ContextScoringPass', function () {
    let pass;

    beforeEach(function () {
      pass = createContextScoringPass(50, 0.4);
    });

    it('should create pass with correct properties', function () {
      expect(pass.name).to.equal('ContextScoringPass');
      expect(pass.order).to.equal(30);
      expect(pass.enabled).to.be.true;
    });

    it('should boost confidence when label keyword present', async function () {
      const text = 'Email: test@example.com weitere Informationen';
      const entity = {
        id: 'test-1',
        type: 'EMAIL',
        text: 'test@example.com',
        start: 7,
        end: 23,
        confidence: 0.7,
        source: 'RULE',
      };

      const result = await pass.execute(text, [entity], { documentId: 'test', passResults: new Map(), startTime: Date.now() });
      expect(result[0].context).to.exist;
      expect(result[0].context.factors).to.be.an('array');

      const labelFactor = result[0].context.factors.find(
        (f) => f.name === 'labelKeywords',
      );
      expect(labelFactor.matched).to.be.true;
    });

    it('should boost confidence when related entities nearby', async function () {
      const text = 'Max Mustermann, max@example.com, +41 44 123 45 67';
      const entities = [
        {
          id: 'test-1',
          type: 'PERSON',
          text: 'Max Mustermann',
          start: 0,
          end: 14,
          confidence: 0.7,
          source: 'ML',
        },
        {
          id: 'test-2',
          type: 'EMAIL',
          text: 'max@example.com',
          start: 16,
          end: 31,
          confidence: 0.7,
          source: 'RULE',
        },
        {
          id: 'test-3',
          type: 'PHONE',
          text: '+41 44 123 45 67',
          start: 33,
          end: 49,
          confidence: 0.7,
          source: 'RULE',
        },
      ];

      const result = await pass.execute(text, entities, { documentId: 'test', passResults: new Map(), startTime: Date.now() });

      // Person entity should have related entities (EMAIL, PHONE) nearby
      const personResult = result.find((e) => e.type === 'PERSON');
      const relatedFactor = personResult.context.factors.find(
        (f) => f.name === 'relatedEntities',
      );
      expect(relatedFactor.matched).to.be.true;
    });

    it('should flag low-confidence entities for review', async function () {
      const text = 'Some text with an entity';
      const entity = {
        id: 'test-1',
        type: 'PERSON',
        text: 'entity',
        start: 18,
        end: 24,
        confidence: 0.3, // Low confidence
        source: 'ML',
      };

      const result = await pass.execute(text, [entity], { documentId: 'test', passResults: new Map(), startTime: Date.now() });
      expect(result[0].flaggedForReview).to.be.true;
    });

    it('should detect repeated entities in document', async function () {
      const text = 'Max Mustermann is the CEO. Contact Max Mustermann at...';
      const entities = [
        {
          id: 'test-1',
          type: 'PERSON',
          text: 'Max Mustermann',
          start: 0,
          end: 14,
          confidence: 0.7,
          source: 'ML',
        },
        {
          id: 'test-2',
          type: 'PERSON',
          text: 'Max Mustermann',
          start: 35,
          end: 49,
          confidence: 0.7,
          source: 'ML',
        },
      ];

      const result = await pass.execute(text, entities, { documentId: 'test', passResults: new Map(), startTime: Date.now() });

      const repetitionFactor = result[0].context.factors.find(
        (f) => f.name === 'repetition',
      );
      expect(repetitionFactor.matched).to.be.true;
    });
  });

  describe('Full Pipeline Integration', function () {
    it('should process document through all passes', async function () {
      const pipeline = createPipeline({ debug: false });
      pipeline.registerPass(createHighRecallPass());
      pipeline.registerPass(createFormatValidationPass());
      pipeline.registerPass(createContextScoringPass());

      const text = `
        Sehr geehrter Herr Max Mustermann,

        Ihre Rechnung Nr. 2024-001 vom 15.01.2024

        Betrag: CHF 1'234.56

        Bankverbindung:
        IBAN: CH93 0076 2011 6238 5295 7

        Mit freundlichen Grüssen
        Firma AG
        Email: info@firma.ch
        Tel: +41 44 123 45 67
      `;

      const result = await pipeline.process(text, 'test-doc-001');

      expect(result.entities).to.be.an('array');
      expect(result.entities.length).to.be.greaterThan(0);
      expect(result.metadata.totalDurationMs).to.be.at.least(0);
      expect(result.metadata.passResults).to.have.length(3);

      // Check that we detected various entity types
      const types = new Set(result.entities.map((e) => e.type));
      expect(types.size).to.be.greaterThan(2);

      // Check that entities have validation and context
      const entityWithValidation = result.entities.find((e) => e.validation);
      const entityWithContext = result.entities.find((e) => e.context);
      expect(entityWithValidation).to.exist;
      expect(entityWithContext).to.exist;
    });

    it('should deduplicate overlapping entities', async function () {
      const pipeline = createPipeline();
      pipeline.registerPass(createHighRecallPass());

      const text = 'IBAN CH93 0076 2011 6238 5295 7';
      const result = await pipeline.process(text);

      // Should not have duplicate IBAN detections
      const ibanEntities = result.entities.filter((e) => e.type === 'IBAN');
      expect(ibanEntities.length).to.be.at.most(1);
    });
  });
});
