/**
 * Address Linker Tests (Story 2.2)
 *
 * Tests for all acceptance criteria:
 * - AC-2.2.1: Components within 50 characters are grouped as candidates
 * - AC-2.2.2: Swiss address patterns are recognized: [Street] [Number], [PostalCode] [City]
 * - AC-2.2.3: EU address patterns are recognized: [Street] [Number], [PostalCode] [City], [Country]
 * - AC-2.2.4: Alternative patterns are recognized: [PostalCode] [City], [Street] [Number]
 * - AC-2.2.5: Grouped components create a single ADDRESS entity with sub-components
 * - AC-2.2.6: Original component entities are marked as "linked" (not standalone)
 */

import { expect } from 'chai';
import { describe, it, before } from 'mocha';

describe('AddressLinker', function () {
  this.timeout(10000);

  let _AddressLinker;
  let createAddressLinker;

  before(async function () {
    const module = await import('../../../../dist/pii/AddressLinker.js');
    _AddressLinker = module.AddressLinker;
    createAddressLinker = module.createAddressLinker;
  });

  describe('AC-2.2.1: Proximity-based grouping (50-char threshold)', function () {
    it('should group components within 50 characters', function () {
      const linker = createAddressLinker();
      const text = 'Address: Bahnhofstrasse 10, 8001 Zürich';
      // Simulating components that would be detected
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 9, end: 23 },
        { type: 'STREET_NUMBER', text: '10', start: 24, end: 26 },
        { type: 'POSTAL_CODE', text: '8001', start: 28, end: 32 },
        { type: 'CITY', text: 'Zürich', start: 33, end: 39 },
      ];

      const groups = linker.groupByProximity(components, text);

      expect(groups.length).to.equal(1);
      expect(groups[0].length).to.equal(4);
    });

    it('should NOT group components more than 50 characters apart', function () {
      const linker = createAddressLinker();
      const text = 'First: Bahnhofstrasse 10' + ' '.repeat(60) + '8001 Zürich';
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 7, end: 21 },
        { type: 'STREET_NUMBER', text: '10', start: 22, end: 24 },
        { type: 'POSTAL_CODE', text: '8001', start: 85, end: 89 },
        { type: 'CITY', text: 'Zürich', start: 90, end: 96 },
      ];

      const groups = linker.groupByProximity(components, text);

      expect(groups.length).to.equal(2);
    });

    it('should expand threshold to 100 chars when newline is present', function () {
      const linker = createAddressLinker();
      const text = 'Bahnhofstrasse 10\n' + ' '.repeat(70) + '8001 Zürich';
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '10', start: 15, end: 17 },
        { type: 'POSTAL_CODE', text: '8001', start: 88, end: 92 },
        { type: 'CITY', text: 'Zürich', start: 93, end: 99 },
      ];

      const groups = linker.groupByProximity(components, text);

      // Should be grouped because newline expands threshold to 100
      expect(groups.length).to.equal(1);
    });

    it('should sort components by position before grouping', function () {
      const linker = createAddressLinker();
      const text = 'Address: Bahnhofstrasse 10, 8001 Zürich';
      // Components in random order
      const components = [
        { type: 'CITY', text: 'Zürich', start: 33, end: 39 },
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 9, end: 23 },
        { type: 'POSTAL_CODE', text: '8001', start: 28, end: 32 },
        { type: 'STREET_NUMBER', text: '10', start: 24, end: 26 },
      ];

      const groups = linker.groupByProximity(components, text);

      expect(groups.length).to.equal(1);
      // Components should be sorted by position
      expect(groups[0][0].type).to.equal('STREET_NAME');
      expect(groups[0][1].type).to.equal('STREET_NUMBER');
      expect(groups[0][2].type).to.equal('POSTAL_CODE');
      expect(groups[0][3].type).to.equal('CITY');
    });

    it('should return empty array for empty components', function () {
      const linker = createAddressLinker();
      const groups = linker.groupByProximity([], 'some text');
      expect(groups).to.deep.equal([]);
    });
  });

  describe('AC-2.2.2: Swiss address pattern recognition', function () {
    it('should recognize Swiss pattern: [Street] [Number], [PostalCode] [City]', function () {
      const linker = createAddressLinker();
      const components = [
        { type: 'STREET_NAME', text: 'Rue de Lausanne', start: 0, end: 15 },
        { type: 'STREET_NUMBER', text: '12', start: 16, end: 18 },
        { type: 'POSTAL_CODE', text: '1000', start: 20, end: 24 },
        { type: 'CITY', text: 'Lausanne', start: 25, end: 33 },
      ];

      const pattern = linker.detectPattern(components);
      expect(pattern).to.equal('SWISS');
    });

    it('should detect SWISS pattern for "Bahnhofstrasse 10, 8001 Zürich"', function () {
      const linker = createAddressLinker();
      const text = 'Bahnhofstrasse 10, 8001 Zürich';
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '10', start: 15, end: 17 },
        { type: 'POSTAL_CODE', text: '8001', start: 19, end: 23 },
        { type: 'CITY', text: 'Zürich', start: 24, end: 30 },
      ];

      const groups = linker.groupByProximity(components, text);
      const linkedGroups = linker.matchPatterns(groups);

      expect(linkedGroups.length).to.equal(1);
      expect(linkedGroups[0].pattern).to.equal('SWISS');
      expect(linkedGroups[0].isValid).to.be.true;
    });
  });

  describe('AC-2.2.3: EU address pattern recognition', function () {
    it('should recognize EU pattern: [Street] [Number], [PostalCode] [City], [Country]', function () {
      const linker = createAddressLinker();
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '1', start: 15, end: 16 },
        { type: 'POSTAL_CODE', text: '8001', start: 18, end: 22 },
        { type: 'CITY', text: 'Zürich', start: 23, end: 29 },
        { type: 'COUNTRY', text: 'Schweiz', start: 31, end: 38 },
      ];

      const pattern = linker.detectPattern(components);
      expect(pattern).to.equal('EU');
    });

    it('should detect EU pattern for full address with country', function () {
      const linker = createAddressLinker();
      const text = 'Bahnhofstrasse 1, 8001 Zürich, Schweiz';
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '1', start: 15, end: 16 },
        { type: 'POSTAL_CODE', text: '8001', start: 18, end: 22 },
        { type: 'CITY', text: 'Zürich', start: 23, end: 29 },
        { type: 'COUNTRY', text: 'Schweiz', start: 31, end: 38 },
      ];

      const groups = linker.groupByProximity(components, text);
      const linkedGroups = linker.matchPatterns(groups);

      expect(linkedGroups.length).to.equal(1);
      expect(linkedGroups[0].pattern).to.equal('EU');
      expect(linkedGroups[0].isValid).to.be.true;
    });
  });

  describe('AC-2.2.4: Alternative pattern recognition', function () {
    it('should recognize alternative pattern: [PostalCode] [City], [Street] [Number]', function () {
      const linker = createAddressLinker();
      // Components in reversed order: postal, city, street, number
      const components = [
        { type: 'POSTAL_CODE', text: '1000', start: 0, end: 4 },
        { type: 'CITY', text: 'Lausanne', start: 5, end: 13 },
        { type: 'STREET_NAME', text: 'Rue de Lausanne', start: 15, end: 30 },
        { type: 'STREET_NUMBER', text: '12', start: 31, end: 33 },
      ];

      const pattern = linker.detectPattern(components);
      expect(pattern).to.equal('ALTERNATIVE');
    });

    it('should detect ALTERNATIVE pattern for "1000 Lausanne, Rue de Lausanne 12"', function () {
      const linker = createAddressLinker();
      const text = '1000 Lausanne, Rue de Lausanne 12';
      const components = [
        { type: 'POSTAL_CODE', text: '1000', start: 0, end: 4 },
        { type: 'CITY', text: 'Lausanne', start: 5, end: 13 },
        { type: 'STREET_NAME', text: 'Rue de Lausanne', start: 15, end: 30 },
        { type: 'STREET_NUMBER', text: '12', start: 31, end: 33 },
      ];

      const groups = linker.groupByProximity(components, text);
      const linkedGroups = linker.matchPatterns(groups);

      expect(linkedGroups.length).to.equal(1);
      expect(linkedGroups[0].pattern).to.equal('ALTERNATIVE');
    });
  });

  describe('AC-2.2.5: Grouped ADDRESS entity creation', function () {
    it('should create GroupedAddress with all required fields', function () {
      const linker = createAddressLinker();
      const text = 'Bahnhofstrasse 10, 8001 Zürich';
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '10', start: 15, end: 17 },
        { type: 'POSTAL_CODE', text: '8001', start: 19, end: 23 },
        { type: 'CITY', text: 'Zürich', start: 24, end: 30 },
      ];

      const { groupedAddresses } = linker.linkAndGroup(components, text);

      expect(groupedAddresses.length).to.equal(1);
      const addr = groupedAddresses[0];

      // Verify all required fields
      expect(addr.id).to.be.a('string');
      expect(addr.type).to.equal('ADDRESS');
      expect(addr.text).to.be.a('string');
      expect(addr.start).to.equal(0);
      expect(addr.end).to.equal(30);
      expect(addr.confidence).to.be.a('number');
      expect(addr.source).to.equal('LINKED');
      expect(addr.patternMatched).to.be.a('string');
      expect(addr.validationStatus).to.be.oneOf(['valid', 'partial', 'uncertain']);
    });

    it('should include component breakdown in grouped address', function () {
      const linker = createAddressLinker();
      const text = 'Bahnhofstrasse 10, 8001 Zürich';
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '10', start: 15, end: 17 },
        { type: 'POSTAL_CODE', text: '8001', start: 19, end: 23 },
        { type: 'CITY', text: 'Zürich', start: 24, end: 30 },
      ];

      const { groupedAddresses } = linker.linkAndGroup(components, text);
      const addr = groupedAddresses[0];

      // Check components breakdown
      expect(addr.components).to.be.an('object');
      expect(addr.components.street).to.equal('Bahnhofstrasse');
      expect(addr.components.number).to.equal('10');
      expect(addr.components.postal).to.equal('8001');
      expect(addr.components.city).to.equal('Zürich');
    });

    it('should include componentEntities array', function () {
      const linker = createAddressLinker();
      const text = 'Bahnhofstrasse 10, 8001 Zürich';
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '10', start: 15, end: 17 },
        { type: 'POSTAL_CODE', text: '8001', start: 19, end: 23 },
        { type: 'CITY', text: 'Zürich', start: 24, end: 30 },
      ];

      const { groupedAddresses } = linker.linkAndGroup(components, text);
      const addr = groupedAddresses[0];

      expect(addr.componentEntities).to.be.an('array');
      expect(addr.componentEntities.length).to.equal(4);
    });

    it('should calculate confidence based on pattern and components', function () {
      const linker = createAddressLinker();
      const text = 'Bahnhofstrasse 10, 8001 Zürich';
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '10', start: 15, end: 17 },
        { type: 'POSTAL_CODE', text: '8001', start: 19, end: 23 },
        { type: 'CITY', text: 'Zürich', start: 24, end: 30 },
      ];

      const { groupedAddresses } = linker.linkAndGroup(components, text);
      const addr = groupedAddresses[0];

      // SWISS pattern with all components should have high confidence
      expect(addr.confidence).to.be.greaterThan(0.8);
    });
  });

  describe('AC-2.2.6: Component linking', function () {
    it('should mark linked components with linked=true', function () {
      const linker = createAddressLinker();
      const text = 'Bahnhofstrasse 10, 8001 Zürich';
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '10', start: 15, end: 17 },
        { type: 'POSTAL_CODE', text: '8001', start: 19, end: 23 },
        { type: 'CITY', text: 'Zürich', start: 24, end: 30 },
      ];

      const { linkedComponents } = linker.linkAndGroup(components, text);

      expect(linkedComponents.length).to.equal(4);
      linkedComponents.forEach((comp) => {
        expect(comp.linked).to.be.true;
      });
    });

    it('should set linkedToGroupId on linked components', function () {
      const linker = createAddressLinker();
      const text = 'Bahnhofstrasse 10, 8001 Zürich';
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '10', start: 15, end: 17 },
        { type: 'POSTAL_CODE', text: '8001', start: 19, end: 23 },
        { type: 'CITY', text: 'Zürich', start: 24, end: 30 },
      ];

      const { groupedAddresses } = linker.linkAndGroup(components, text);
      const addr = groupedAddresses[0];

      // All componentEntities should have linkedToGroupId set to the address id
      addr.componentEntities.forEach((comp) => {
        expect(comp.linkedToGroupId).to.equal(addr.id);
      });
    });

    it('should separate unlinked components', function () {
      const linker = createAddressLinker();
      // Two separate addresses
      const text = 'Bahnhofstrasse 10, 8001 Zürich' + ' '.repeat(100) + 'Lonely Street';
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '10', start: 15, end: 17 },
        { type: 'POSTAL_CODE', text: '8001', start: 19, end: 23 },
        { type: 'CITY', text: 'Zürich', start: 24, end: 30 },
        { type: 'STREET_NAME', text: 'Lonely Street', start: 130, end: 143 },
      ];

      const { linkedComponents, unlinkedComponents } = linker.linkAndGroup(components, text);

      expect(linkedComponents.length).to.equal(4);
      expect(unlinkedComponents.length).to.equal(1);
      expect(unlinkedComponents[0].text).to.equal('Lonely Street');
    });
  });

  describe('Pattern detection edge cases', function () {
    it('should detect PARTIAL pattern when missing city', function () {
      const linker = createAddressLinker();
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '10', start: 15, end: 17 },
        { type: 'POSTAL_CODE', text: '8001', start: 19, end: 23 },
      ];

      const pattern = linker.detectPattern(components);
      expect(pattern).to.equal('PARTIAL');
    });

    it('should detect NONE pattern for single component', function () {
      const linker = createAddressLinker();
      const components = [{ type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 }];

      const pattern = linker.detectPattern(components);
      expect(pattern).to.equal('NONE');
    });

    it('should detect PARTIAL pattern for postal + city only', function () {
      const linker = createAddressLinker();
      const components = [
        { type: 'POSTAL_CODE', text: '8001', start: 0, end: 4 },
        { type: 'CITY', text: 'Zürich', start: 5, end: 11 },
      ];

      const pattern = linker.detectPattern(components);
      expect(pattern).to.equal('PARTIAL');
    });
  });

  describe('Confidence calculation', function () {
    it('should give higher confidence to SWISS/EU patterns', function () {
      const linker = createAddressLinker();

      const swissComponents = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '10', start: 15, end: 17 },
        { type: 'POSTAL_CODE', text: '8001', start: 19, end: 23 },
        { type: 'CITY', text: 'Zürich', start: 24, end: 30 },
      ];

      const partialComponents = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'POSTAL_CODE', text: '8001', start: 19, end: 23 },
      ];

      const swissConfidence = linker.calculateConfidence('SWISS', swissComponents);
      const partialConfidence = linker.calculateConfidence('PARTIAL', partialComponents);

      expect(swissConfidence).to.be.greaterThan(partialConfidence);
    });

    it('should add bonus for complete street info', function () {
      const linker = createAddressLinker();

      const withNumber = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '10', start: 15, end: 17 },
      ];

      const withoutNumber = [{ type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 }];

      const confWithNumber = linker.calculateConfidence('PARTIAL', withNumber);
      const confWithoutNumber = linker.calculateConfidence('PARTIAL', withoutNumber);

      expect(confWithNumber).to.be.greaterThan(confWithoutNumber);
    });

    it('should cap confidence at 1.0', function () {
      const linker = createAddressLinker();

      // Many components should not exceed 1.0
      const manyComponents = [
        { type: 'STREET_NAME', text: 'Street', start: 0, end: 6 },
        { type: 'STREET_NUMBER', text: '10', start: 7, end: 9 },
        { type: 'POSTAL_CODE', text: '8001', start: 11, end: 15 },
        { type: 'CITY', text: 'City', start: 16, end: 20 },
        { type: 'COUNTRY', text: 'Country', start: 22, end: 29 },
        { type: 'REGION', text: 'Region', start: 31, end: 37 },
      ];

      const confidence = linker.calculateConfidence('EU', manyComponents);
      expect(confidence).to.be.at.most(1.0);
    });
  });

  describe('Full pipeline: linkAndGroup', function () {
    it('should process text and return all results', function () {
      const linker = createAddressLinker();
      const text = 'Bahnhofstrasse 10, 8001 Zürich';
      const components = [
        { type: 'STREET_NAME', text: 'Bahnhofstrasse', start: 0, end: 14 },
        { type: 'STREET_NUMBER', text: '10', start: 15, end: 17 },
        { type: 'POSTAL_CODE', text: '8001', start: 19, end: 23 },
        { type: 'CITY', text: 'Zürich', start: 24, end: 30 },
      ];

      const result = linker.linkAndGroup(components, text);

      expect(result.groupedAddresses).to.be.an('array');
      expect(result.linkedComponents).to.be.an('array');
      expect(result.unlinkedComponents).to.be.an('array');
    });

    it('should integrate with processText convenience method', function () {
      const linker = createAddressLinker();
      const text = 'Contact us at Bahnhofstrasse 10, 8001 Zürich for more info.';

      const result = linker.processText(text);

      expect(result.components).to.be.an('array');
      expect(result.addresses).to.be.an('array');
      expect(result.entities).to.be.an('array');
    });
  });
});
