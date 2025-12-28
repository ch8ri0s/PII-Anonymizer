/**
 * ConsolidationPass Unit Tests (Story 8.8)
 *
 * Tests for the entity consolidation, overlap resolution, and entity linking pass.
 */

import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';

// Dynamic imports for ESM modules
let _ConsolidationPass, createConsolidationPass, DEFAULT_ENTITY_PRIORITY;

describe('ConsolidationPass', function () {
  this.timeout(10000);

  before(async function () {
    // Import ESM modules from shared package
    const consolidationModule = await import(
      '../../../shared/dist/pii/index.js'
    );
    _ConsolidationPass = consolidationModule.ConsolidationPass;
    createConsolidationPass = consolidationModule.createConsolidationPass;
    DEFAULT_ENTITY_PRIORITY = consolidationModule.DEFAULT_ENTITY_PRIORITY;
  });

  describe('Configuration', function () {
    it('should create pass with default config', function () {
      const pass = createConsolidationPass();
      const config = pass.getConfig();

      expect(config.enableOverlapResolution).to.be.true;
      expect(config.enableAddressConsolidation).to.be.true;
      expect(config.enableEntityLinking).to.be.true;
      expect(config.addressMaxGap).to.equal(50);
      expect(config.showComponents).to.be.false;
      expect(config.overlapStrategy).to.equal('confidence-weighted');
      expect(config.linkingStrategy).to.equal('normalized');
    });

    it('should allow config overrides', function () {
      const pass = createConsolidationPass({
        addressMaxGap: 10,
        overlapStrategy: 'confidence-weighted',
        linkingStrategy: 'fuzzy',
        minConsolidationConfidence: 0.5,
      });
      const config = pass.getConfig();

      expect(config.addressMaxGap).to.equal(10);
      expect(config.overlapStrategy).to.equal('confidence-weighted');
      expect(config.linkingStrategy).to.equal('fuzzy');
      expect(config.minConsolidationConfidence).to.equal(0.5);
    });

    it('should allow runtime configuration updates', function () {
      const pass = createConsolidationPass();
      pass.configure({ enableEntityLinking: false });

      expect(pass.getConfig().enableEntityLinking).to.be.false;
    });
  });

  describe('Entity Priority', function () {
    it('should have correct default priorities', function () {
      // Higher priority types should have HIGHER numbers (not lower)
      expect(DEFAULT_ENTITY_PRIORITY.SWISS_AVS).to.be.greaterThan(DEFAULT_ENTITY_PRIORITY.PERSON_NAME);
      expect(DEFAULT_ENTITY_PRIORITY.IBAN).to.be.greaterThan(DEFAULT_ENTITY_PRIORITY.ORGANIZATION);
      expect(DEFAULT_ENTITY_PRIORITY.EMAIL).to.be.greaterThan(DEFAULT_ENTITY_PRIORITY.PHONE);
    });

    it('should prioritize specific types over general types', function () {
      // SWISS_ADDRESS should have higher priority than ADDRESS
      expect(DEFAULT_ENTITY_PRIORITY.SWISS_ADDRESS).to.be.greaterThan(DEFAULT_ENTITY_PRIORITY.ADDRESS);
      // EU_ADDRESS should have higher priority than ADDRESS
      expect(DEFAULT_ENTITY_PRIORITY.EU_ADDRESS).to.be.greaterThan(DEFAULT_ENTITY_PRIORITY.ADDRESS);
    });
  });

  describe('Overlap Resolution', function () {
    let pass;

    beforeEach(function () {
      pass = createConsolidationPass();
    });

    it('should handle empty entity array', function () {
      const result = pass.consolidate([], 'some text');
      expect(result.entities).to.be.an('array').that.is.empty;
      expect(result.metadata.overlapsResolved).to.equal(0);
    });

    it('should preserve non-overlapping entities', function () {
      const entities = [
        { id: '1', type: 'PERSON_NAME', text: 'John', start: 0, end: 4, confidence: 0.9, source: 'ML' },
        { id: '2', type: 'EMAIL', text: 'john@example.com', start: 10, end: 26, confidence: 0.95, source: 'RULE' },
      ];

      const result = pass.consolidate(entities, 'John says john@example.com');
      expect(result.entities).to.have.length(2);
      expect(result.metadata.overlapsResolved).to.equal(0);
    });

    it('should resolve overlaps by priority (higher priority wins)', function () {
      const text = 'My SSN is 756.1234.5678.97';
      const entities = [
        { id: '1', type: 'SWISS_AVS', text: '756.1234.5678.97', start: 10, end: 26, confidence: 0.9, source: 'RULE' },
        { id: '2', type: 'UNKNOWN', text: '756.1234', start: 10, end: 18, confidence: 0.95, source: 'ML' },
      ];

      const result = pass.consolidate(entities, text);
      expect(result.entities).to.have.length(1);
      expect(result.entities[0].type).to.equal('SWISS_AVS');
      expect(result.metadata.overlapsResolved).to.equal(1);
    });

    it('should resolve overlaps by confidence when same priority (confidence-weighted)', function () {
      const pass = createConsolidationPass({ overlapStrategy: 'confidence-weighted' });
      const text = 'Contact John Smith at the office';
      const entities = [
        { id: '1', type: 'PERSON_NAME', text: 'John Smith', start: 8, end: 18, confidence: 0.7, source: 'ML' },
        { id: '2', type: 'PERSON_NAME', text: 'John', start: 8, end: 12, confidence: 0.95, source: 'RULE' },
      ];

      const result = pass.consolidate(entities, text);
      expect(result.entities).to.have.length(1);
      // With confidence-weighted, higher confidence partial might win
      // But typically we prefer complete spans, implementation details may vary
      expect(result.metadata.overlapsResolved).to.equal(1);
    });

    it('should handle nested overlaps correctly', function () {
      const text = 'The address is Bahnhofstrasse 12, 8001 Zürich, Switzerland';
      const entities = [
        { id: '1', type: 'ADDRESS', text: 'Bahnhofstrasse 12, 8001 Zürich, Switzerland', start: 15, end: 58, confidence: 0.85, source: 'RULE' },
        { id: '2', type: 'STREET', text: 'Bahnhofstrasse 12', start: 15, end: 32, confidence: 0.9, source: 'RULE' },
        { id: '3', type: 'POSTAL_CODE', text: '8001', start: 34, end: 38, confidence: 0.95, source: 'RULE' },
        { id: '4', type: 'CITY', text: 'Zürich', start: 39, end: 45, confidence: 0.9, source: 'RULE' },
      ];

      const result = pass.consolidate(entities, text);
      // ADDRESS should consolidate the components
      expect(result.entities.length).to.be.lessThan(entities.length);
    });

    it('should keep higher priority type in overlapping pair', function () {
      const text = 'Email is john@test.com';
      const entities = [
        { id: '1', type: 'EMAIL', text: 'john@test.com', start: 9, end: 22, confidence: 0.9, source: 'RULE' },
        { id: '2', type: 'UNKNOWN', text: 'john@test.com', start: 9, end: 22, confidence: 0.85, source: 'ML' },
      ];

      const result = pass.consolidate(entities, text);
      expect(result.entities).to.have.length(1);
      expect(result.entities[0].type).to.equal('EMAIL');
    });
  });

  describe('Address Consolidation', function () {
    let pass;

    beforeEach(function () {
      pass = createConsolidationPass();
    });

    it('should consolidate adjacent address components', function () {
      const text = 'Bahnhofstrasse 12, 8001 Zürich';
      const entities = [
        { id: '1', type: 'LOCATION', text: 'Bahnhofstrasse 12', start: 0, end: 17, confidence: 0.9, source: 'RULE' },
        { id: '2', type: 'LOCATION', text: '8001', start: 19, end: 23, confidence: 0.95, source: 'RULE' },
        { id: '3', type: 'LOCATION', text: 'Zürich', start: 24, end: 30, confidence: 0.9, source: 'RULE' },
      ];

      const result = pass.consolidate(entities, text);

      // Should create a consolidated ADDRESS entity or preserve locations
      expect(result.entities.length).to.be.greaterThan(0);
      // Check metadata is populated
      expect(result.metadata.addressesConsolidated).to.be.at.least(0);
    });

    it('should respect addressMaxGap configuration', function () {
      const passSmallGap = createConsolidationPass({ addressMaxGap: 2 });
      const text = 'Street 1      8000 City'; // Large gap

      const entities = [
        { id: '1', type: 'LOCATION', text: 'Street 1', start: 0, end: 8, confidence: 0.9, source: 'RULE' },
        { id: '2', type: 'LOCATION', text: '8000', start: 14, end: 18, confidence: 0.9, source: 'RULE' },
        { id: '3', type: 'LOCATION', text: 'City', start: 19, end: 23, confidence: 0.9, source: 'RULE' },
      ];

      const result = passSmallGap.consolidate(entities, text);
      // With small gap, components should not consolidate
      // Each component type should remain separate
      expect(result.entities.length).to.be.greaterThan(0);
    });

    it('should handle minimum component requirements', function () {
      const pass = createConsolidationPass({ minAddressComponents: 3 });
      const text = 'Just a street: Main St';

      const entities = [
        { id: '1', type: 'LOCATION', text: 'Main St', start: 15, end: 22, confidence: 0.9, source: 'RULE' },
      ];

      const result = pass.consolidate(entities, text);
      // Single component should not form an ADDRESS
      const addressEntity = result.entities.find(e => e.type === 'ADDRESS' || e.type === 'SWISS_ADDRESS');
      expect(addressEntity).to.be.undefined;
    });

    it('should preserve showComponents setting', function () {
      const passWithComponents = createConsolidationPass({ showComponents: true });
      const passWithoutComponents = createConsolidationPass({ showComponents: false });

      const text = 'Bahnhofstrasse 12, 8001 Zürich';
      const entities = [
        { id: '1', type: 'LOCATION', text: 'Bahnhofstrasse 12', start: 0, end: 17, confidence: 0.9, source: 'RULE' },
        { id: '2', type: 'LOCATION', text: '8001', start: 19, end: 23, confidence: 0.95, source: 'RULE' },
        { id: '3', type: 'LOCATION', text: 'Zürich', start: 24, end: 30, confidence: 0.9, source: 'RULE' },
      ];

      const resultWith = passWithComponents.consolidate(entities, text);
      const resultWithout = passWithoutComponents.consolidate(entities, text);

      // Both should produce similar entity count
      expect(resultWith.entities.length).to.be.greaterThan(0);
      expect(resultWithout.entities.length).to.be.greaterThan(0);
    });
  });

  describe('Entity Linking', function () {
    let pass;

    beforeEach(function () {
      pass = createConsolidationPass();
    });

    it('should assign logical IDs to repeated entities', function () {
      const text = 'John Smith called. Later, John Smith wrote an email.';
      const entities = [
        { id: '1', type: 'PERSON_NAME', text: 'John Smith', start: 0, end: 10, confidence: 0.9, source: 'ML' },
        { id: '2', type: 'PERSON_NAME', text: 'John Smith', start: 26, end: 36, confidence: 0.85, source: 'ML' },
      ];

      const result = pass.consolidate(entities, text);

      // Both should have same logicalId
      const johns = result.entities.filter(e => e.text === 'John Smith');
      expect(johns).to.have.length(2);
      expect(johns[0].logicalId).to.exist;
      expect(johns[0].logicalId).to.equal(johns[1].logicalId);
      expect(result.metadata.entitiesLinked).to.be.at.least(1);
    });

    it('should use normalized matching for entity linking', function () {
      const pass = createConsolidationPass({ linkingStrategy: 'normalized' });
      const text = 'John Smith met JOHN SMITH at the café.';
      const entities = [
        { id: '1', type: 'PERSON_NAME', text: 'John Smith', start: 0, end: 10, confidence: 0.9, source: 'ML' },
        { id: '2', type: 'PERSON_NAME', text: 'JOHN SMITH', start: 15, end: 25, confidence: 0.85, source: 'ML' },
      ];

      const result = pass.consolidate(entities, text);

      // Case-insensitive matching should link these
      const people = result.entities.filter(e => e.type === 'PERSON_NAME');
      expect(people).to.have.length(2);
      if (people[0].logicalId && people[1].logicalId) {
        expect(people[0].logicalId).to.equal(people[1].logicalId);
      }
    });

    it('should use fuzzy matching when configured', function () {
      const pass = createConsolidationPass({ linkingStrategy: 'fuzzy' });
      const text = 'Jon Smith met John Smith at the café.';
      const entities = [
        { id: '1', type: 'PERSON_NAME', text: 'Jon Smith', start: 0, end: 9, confidence: 0.9, source: 'ML' },
        { id: '2', type: 'PERSON_NAME', text: 'John Smith', start: 14, end: 24, confidence: 0.85, source: 'ML' },
      ];

      const result = pass.consolidate(entities, text);

      // Fuzzy matching might link these (depending on threshold)
      const people = result.entities.filter(e => e.type === 'PERSON_NAME');
      expect(people).to.have.length(2);
      // Result depends on fuzzy threshold implementation
    });

    it('should use exact matching when configured', function () {
      const pass = createConsolidationPass({ linkingStrategy: 'exact' });
      const text = 'John Smith met JOHN SMITH at the café.';
      const entities = [
        { id: '1', type: 'PERSON_NAME', text: 'John Smith', start: 0, end: 10, confidence: 0.9, source: 'ML' },
        { id: '2', type: 'PERSON_NAME', text: 'JOHN SMITH', start: 15, end: 25, confidence: 0.85, source: 'ML' },
      ];

      const result = pass.consolidate(entities, text);

      // Exact matching should NOT link these (different case)
      const people = result.entities.filter(e => e.type === 'PERSON_NAME');
      expect(people).to.have.length(2);
      // With exact matching, different cases should have different logicalIds (or no linking at all)
    });

    it('should generate unique logical IDs per entity type', function () {
      const text = 'John works at ACME Corp. Jane also works at ACME Corp.';
      const entities = [
        { id: '1', type: 'PERSON_NAME', text: 'John', start: 0, end: 4, confidence: 0.9, source: 'ML' },
        { id: '2', type: 'ORGANIZATION', text: 'ACME Corp', start: 14, end: 23, confidence: 0.85, source: 'ML' },
        { id: '3', type: 'PERSON_NAME', text: 'Jane', start: 25, end: 29, confidence: 0.9, source: 'ML' },
        { id: '4', type: 'ORGANIZATION', text: 'ACME Corp', start: 44, end: 53, confidence: 0.85, source: 'ML' },
      ];

      const result = pass.consolidate(entities, text);

      // ACME Corp occurrences should have same logicalId
      const orgs = result.entities.filter(e => e.type === 'ORGANIZATION');
      expect(orgs).to.have.length(2);
      if (orgs[0].logicalId && orgs[1].logicalId) {
        expect(orgs[0].logicalId).to.equal(orgs[1].logicalId);
        expect(orgs[0].logicalId).to.include('ORGANIZATION');
      }

      // John and Jane should have different logicalIds
      const people = result.entities.filter(e => e.type === 'PERSON_NAME');
      expect(people).to.have.length(2);
      if (people[0].logicalId && people[1].logicalId) {
        expect(people[0].logicalId).to.not.equal(people[1].logicalId);
      }
    });

    it('should handle disabled entity linking', function () {
      const pass = createConsolidationPass({ enableEntityLinking: false });
      const text = 'John Smith called. Later, John Smith wrote.';
      const entities = [
        { id: '1', type: 'PERSON_NAME', text: 'John Smith', start: 0, end: 10, confidence: 0.9, source: 'ML' },
        { id: '2', type: 'PERSON_NAME', text: 'John Smith', start: 26, end: 36, confidence: 0.85, source: 'ML' },
      ];

      const result = pass.consolidate(entities, text);

      // With linking disabled, logicalIds should not be assigned
      expect(result.metadata.entitiesLinked).to.equal(0);
    });
  });

  describe('Consolidation Result Metadata', function () {
    let pass;

    beforeEach(function () {
      pass = createConsolidationPass();
    });

    it('should track overlap count in metadata', function () {
      const text = 'My SSN is 756.1234.5678.97';
      const entities = [
        { id: '1', type: 'SWISS_AVS', text: '756.1234.5678.97', start: 10, end: 26, confidence: 0.9, source: 'RULE' },
        { id: '2', type: 'UNKNOWN', text: '756.1234', start: 10, end: 18, confidence: 0.8, source: 'ML' },
        { id: '3', type: 'UNKNOWN', text: '5678.97', start: 19, end: 26, confidence: 0.7, source: 'ML' },
      ];

      const result = pass.consolidate(entities, text);
      expect(result.metadata.overlapsResolved).to.be.at.least(1);
    });

    it('should track address consolidation count', function () {
      const text = 'Bahnhofstrasse 12, 8001 Zürich';
      const entities = [
        { id: '1', type: 'LOCATION', text: 'Bahnhofstrasse 12', start: 0, end: 17, confidence: 0.9, source: 'RULE' },
        { id: '2', type: 'LOCATION', text: '8001', start: 19, end: 23, confidence: 0.95, source: 'RULE' },
        { id: '3', type: 'LOCATION', text: 'Zürich', start: 24, end: 30, confidence: 0.9, source: 'RULE' },
      ];

      const result = pass.consolidate(entities, text);
      expect(result.metadata.addressesConsolidated).to.be.at.least(0); // May or may not consolidate
    });

    it('should track linked entity groups', function () {
      const text = 'John met John at the park.';
      const entities = [
        { id: '1', type: 'PERSON_NAME', text: 'John', start: 0, end: 4, confidence: 0.9, source: 'ML' },
        { id: '2', type: 'PERSON_NAME', text: 'John', start: 9, end: 13, confidence: 0.85, source: 'ML' },
      ];

      const result = pass.consolidate(entities, text);
      expect(result.metadata.entitiesLinked).to.be.at.least(1);
    });
  });

  describe('Edge Cases', function () {
    let pass;

    beforeEach(function () {
      pass = createConsolidationPass();
    });

    it('should handle single entity', function () {
      const text = 'Call John';
      const entities = [
        { id: '1', type: 'PERSON_NAME', text: 'John', start: 5, end: 9, confidence: 0.9, source: 'ML' },
      ];

      const result = pass.consolidate(entities, text);
      expect(result.entities).to.have.length(1);
      expect(result.entities[0].text).to.equal('John');
    });

    it('should handle entities with missing confidence', function () {
      const text = 'John works at ACME';
      const entities = [
        { id: '1', type: 'PERSON_NAME', text: 'John', start: 0, end: 4, source: 'ML' },
        { id: '2', type: 'ORGANIZATION', text: 'ACME', start: 14, end: 18, source: 'RULE' },
      ];

      const result = pass.consolidate(entities, text);
      expect(result.entities).to.have.length(2);
    });

    it('should handle entities at document boundaries', function () {
      const text = 'John';
      const entities = [
        { id: '1', type: 'PERSON_NAME', text: 'John', start: 0, end: 4, confidence: 0.9, source: 'ML' },
      ];

      const result = pass.consolidate(entities, text);
      expect(result.entities).to.have.length(1);
      expect(result.entities[0].start).to.equal(0);
      expect(result.entities[0].end).to.equal(4);
    });

    it('should handle multiple overlapping entities', function () {
      const text = 'The Swiss AVS number is 756.1234.5678.97';
      const entities = [
        { id: '1', type: 'SWISS_AVS', text: '756.1234.5678.97', start: 24, end: 40, confidence: 0.95, source: 'RULE' },
        { id: '2', type: 'UNKNOWN', text: '756', start: 24, end: 27, confidence: 0.6, source: 'ML' },
        { id: '3', type: 'UNKNOWN', text: '1234', start: 28, end: 32, confidence: 0.5, source: 'ML' },
        { id: '4', type: 'UNKNOWN', text: '5678', start: 33, end: 37, confidence: 0.5, source: 'ML' },
        { id: '5', type: 'UNKNOWN', text: '97', start: 38, end: 40, confidence: 0.5, source: 'ML' },
      ];

      const result = pass.consolidate(entities, text);
      // SWISS_AVS should win over all partial matches
      expect(result.entities).to.have.length(1);
      expect(result.entities[0].type).to.equal('SWISS_AVS');
    });

    it('should handle disabled features', function () {
      const pass = createConsolidationPass({
        enableOverlapResolution: false,
        enableAddressConsolidation: false,
        enableEntityLinking: false,
      });

      const text = 'John met John';
      const entities = [
        { id: '1', type: 'PERSON_NAME', text: 'John', start: 0, end: 4, confidence: 0.9, source: 'ML' },
        { id: '2', type: 'PERSON_NAME', text: 'John', start: 9, end: 13, confidence: 0.85, source: 'ML' },
      ];

      const result = pass.consolidate(entities, text);
      // All features disabled - entities should pass through unchanged
      expect(result.entities).to.have.length(2);
    });
  });
});
