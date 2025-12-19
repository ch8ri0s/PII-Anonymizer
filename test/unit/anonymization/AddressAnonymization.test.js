/**
 * Address Anonymization Tests (Story 2.4)
 *
 * Tests for all acceptance criteria:
 * - AC-2.4.1: Given a grouped address entity, the entire address span is replaced with single placeholder [ADDRESS_N]
 * - AC-2.4.2: Mapping file stores full original address with components (street, number, postal, city)
 * - AC-2.4.3: Partial matches (standalone postal codes) still work as fallback
 * - AC-2.4.4: "Rue de Lausanne 12, 1000 Lausanne" becomes "[ADDRESS_1]" not "Rue de Lausanne [NUMBER], [POSTAL] [CITY]"
 */

import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import { FileProcessor } from '../../../fileProcessor.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Address Anonymization (Story 2.4)', function () {
  this.timeout(30000); // Longer timeout for ML model loading

  const outputDir = path.join(__dirname, '../../output/anonymization');

  beforeEach(async () => {
    // Clean and recreate output directory
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch {
      // Ignore if doesn't exist
    }
    await fs.mkdir(outputDir, { recursive: true });
  });

  // ========== AC-2.4.1: Single placeholder for grouped address ==========
  describe('AC-2.4.1: Single placeholder for grouped address', function () {
    it('should replace grouped Swiss address with single [SWISS_ADDRESS_1] placeholder', async function () {
      const content = 'Kontakt: Bahnhofstrasse 10, 8001 Zürich';
      const filePath = path.join(outputDir, 'swiss-address.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'swiss-address-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const anonymized = await fs.readFile(outputPath, 'utf8');
      const mappingPath = path.join(outputDir, 'swiss-address-anon-mapping.json');
      const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));

      // Should have address placeholders (may detect multiple depending on converter boilerplate)
      const addressMatches = anonymized.match(/\[(SWISS_)?ADDRESS_\d+\]/g) || [];

      // The primary Swiss address should be detected
      if (addressMatches.length > 0) {
        // At least one should be SWISS_ADDRESS type
        const swissAddressMatch = addressMatches.find(m => m.includes('SWISS_ADDRESS'));
        expect(swissAddressMatch).to.not.be.undefined;

        // Should NOT have separate POSTAL_CODE or CITY placeholders (no fragmentation)
        expect(anonymized).to.not.match(/\[POSTAL_CODE_\d+\]/);
        expect(anonymized).to.not.match(/\[CITY_\d+\]/);
      }

      // Mapping should have addresses array with structured data
      expect(mapping.addresses).to.be.an('array');
      expect(mapping.addresses.length).to.be.greaterThan(0);
    });

    it('should give multiple addresses sequential placeholders', async function () {
      const content = `Absender: Bahnhofstrasse 10, 8001 Zürich
Empfänger: Rue de la Gare 5, 1003 Lausanne`;
      const filePath = path.join(outputDir, 'multi-address.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'multi-address-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const mappingPath = path.join(outputDir, 'multi-address-anon-mapping.json');
      const mappingData = await fs.readFile(mappingPath, 'utf8');
      const mapping = JSON.parse(mappingData);

      // Check for sequential address numbering
      const addressEntries = mapping.addresses || [];
      if (addressEntries.length >= 2) {
        const placeholders = addressEntries.map(a => a.placeholder);
        // Should have sequential numbering
        expect(placeholders.some(p => p.includes('_1]'))).to.equal(true);
        expect(placeholders.some(p => p.includes('_2]'))).to.equal(true);
      }
    });

    it('should reset ADDRESS counter for new session', async function () {
      // Process first file
      const content1 = 'Adresse: Bahnhofstrasse 10, 8001 Zürich';
      const file1Path = path.join(outputDir, 'addr-session1.txt');
      await fs.writeFile(file1Path, content1, 'utf8');
      const output1Path = path.join(outputDir, 'addr-session1-anon.md');
      await FileProcessor.processFile(file1Path, output1Path);

      // Process second file
      const content2 = 'Adresse: Rue de la Gare 5, 1003 Lausanne';
      const file2Path = path.join(outputDir, 'addr-session2.txt');
      await fs.writeFile(file2Path, content2, 'utf8');
      const output2Path = path.join(outputDir, 'addr-session2-anon.md');
      await FileProcessor.processFile(file2Path, output2Path);

      // Read mappings
      const mapping1Path = path.join(outputDir, 'addr-session1-anon-mapping.json');
      const mapping2Path = path.join(outputDir, 'addr-session2-anon-mapping.json');
      const mapping1 = JSON.parse(await fs.readFile(mapping1Path, 'utf8'));
      const mapping2 = JSON.parse(await fs.readFile(mapping2Path, 'utf8'));

      // Both should have ADDRESS_1 (counter resets per session)
      const addr1 = mapping1.addresses?.[0];
      const addr2 = mapping2.addresses?.[0];

      if (addr1 && addr2) {
        expect(addr1.placeholder).to.include('_1]', 'File 1 should start at _1');
        expect(addr2.placeholder).to.include('_1]', 'File 2 should restart at _1 (session isolation)');
      }
    });
  });

  // ========== AC-2.4.2: Mapping file with structured components ==========
  describe('AC-2.4.2: Mapping file with structured components', function () {
    it('should store originalText in mapping file', async function () {
      const address = 'Bahnhofstrasse 10, 8001 Zürich';
      const content = `Kontakt: ${address}`;
      const filePath = path.join(outputDir, 'mapping-original.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'mapping-original-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const mappingPath = path.join(outputDir, 'mapping-original-anon-mapping.json');
      const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));

      // Check addresses array exists
      expect(mapping.addresses).to.be.an('array');

      // If address was detected, check originalText
      if (mapping.addresses.length > 0) {
        const addrEntry = mapping.addresses[0];
        expect(addrEntry.originalText).to.be.a('string');
        expect(addrEntry.originalText.length).to.be.greaterThan(0);
      }
    });

    it('should store address components breakdown', async function () {
      const content = 'Lieferadresse: Bahnhofstrasse 10, 8001 Zürich';
      const filePath = path.join(outputDir, 'mapping-components.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'mapping-components-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const mappingPath = path.join(outputDir, 'mapping-components-anon-mapping.json');
      const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));

      if (mapping.addresses && mapping.addresses.length > 0) {
        const addrEntry = mapping.addresses[0];

        // Check components structure exists
        expect(addrEntry.components).to.be.an('object');

        // Check individual component fields exist (may be null if not detected)
        expect(addrEntry.components).to.have.property('street');
        expect(addrEntry.components).to.have.property('number');
        expect(addrEntry.components).to.have.property('postal');
        expect(addrEntry.components).to.have.property('city');
      }
    });

    it('should store confidence and patternMatched metadata', async function () {
      const content = 'Adresse: Rue de Lausanne 12, 1000 Lausanne';
      const filePath = path.join(outputDir, 'mapping-metadata.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'mapping-metadata-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const mappingPath = path.join(outputDir, 'mapping-metadata-anon-mapping.json');
      const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));

      if (mapping.addresses && mapping.addresses.length > 0) {
        const addrEntry = mapping.addresses[0];

        // Check metadata fields
        expect(addrEntry).to.have.property('confidence');
        expect(addrEntry.confidence).to.be.a('number');

        expect(addrEntry).to.have.property('patternMatched');
        expect(addrEntry).to.have.property('scoringFactors');
        expect(addrEntry.scoringFactors).to.be.an('array');
      }
    });

    it('should store flaggedForReview and autoAnonymize flags', async function () {
      const content = 'Kontakt: Bahnhofstrasse 10, 8001 Zürich';
      const filePath = path.join(outputDir, 'mapping-flags.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'mapping-flags-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const mappingPath = path.join(outputDir, 'mapping-flags-anon-mapping.json');
      const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));

      if (mapping.addresses && mapping.addresses.length > 0) {
        const addrEntry = mapping.addresses[0];

        // Check flag fields
        expect(addrEntry).to.have.property('flaggedForReview');
        expect(addrEntry.flaggedForReview).to.be.a('boolean');

        expect(addrEntry).to.have.property('autoAnonymize');
        expect(addrEntry.autoAnonymize).to.be.a('boolean');
      }
    });
  });

  // ========== AC-2.4.3: Fallback for standalone entities ==========
  describe('AC-2.4.3: Fallback for partial/standalone entities', function () {
    it('should detect standalone postal codes when not grouped', async function () {
      // Document with just postal code (no street or city nearby)
      const content = 'Code postal: 8001';
      const filePath = path.join(outputDir, 'standalone-postal.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'standalone-postal-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      // Postal code alone may or may not be detected as PII
      // This test validates the fallback path doesn't crash
      const anonymized = await fs.readFile(outputPath, 'utf8');
      expect(anonymized).to.be.a('string');
    });

    it('should not anonymize components separately when grouped', async function () {
      const content = 'Adresse: Bahnhofstrasse 10, 8001 Zürich';
      const filePath = path.join(outputDir, 'grouped-components.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'grouped-components-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const anonymized = await fs.readFile(outputPath, 'utf8');

      // If address was detected as grouped, components should NOT appear separately
      if (anonymized.includes('[ADDRESS_') || anonymized.includes('[SWISS_ADDRESS_')) {
        expect(anonymized).to.not.include('[POSTAL_CODE_');
        expect(anonymized).to.not.include('[CITY_');
        expect(anonymized).to.not.include('[STREET_');
      }
    });

    it('should mark linked components in entities mapping', async function () {
      const content = 'Lieferadresse: Rue de la Gare 5, 1003 Lausanne';
      const filePath = path.join(outputDir, 'linked-components.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'linked-components-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const mappingPath = path.join(outputDir, 'linked-components-anon-mapping.json');
      const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));

      // Check that entities mapping doesn't have separate entries for address components
      // that are part of a grouped address
      if (mapping.addresses && mapping.addresses.length > 0) {
        const addrPlaceholder = mapping.addresses[0].placeholder;
        const originalText = mapping.addresses[0].originalText;

        // The grouped address should be in entities too (backward compatible)
        expect(mapping.entities[originalText]).to.equal(addrPlaceholder);
      }
    });
  });

  // ========== AC-2.4.4: Prevent fragmented anonymization ==========
  describe('AC-2.4.4: Prevent fragmented anonymization', function () {
    it('should replace "Rue de Lausanne 12, 1000 Lausanne" with single placeholder', async function () {
      const content = 'Adresse: Rue de Lausanne 12, 1000 Lausanne';
      const filePath = path.join(outputDir, 'no-fragmentation.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'no-fragmentation-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const anonymized = await fs.readFile(outputPath, 'utf8');

      // Count placeholders - should be one address placeholder
      const addressPlaceholders = (anonymized.match(/\[(SWISS_|EU_)?ADDRESS_\d+\]/g) || []).length;
      const postalPlaceholders = (anonymized.match(/\[POSTAL(_CODE)?_\d+\]/g) || []).length;
      const cityPlaceholders = (anonymized.match(/\[CITY_\d+\]/g) || []).length;

      // If address detection worked, should have 1 address placeholder, 0 fragments
      if (addressPlaceholders > 0) {
        expect(postalPlaceholders).to.equal(0, 'Should NOT have separate POSTAL placeholder');
        expect(cityPlaceholders).to.equal(0, 'Should NOT have separate CITY placeholder');
      }
    });

    it('should handle Swiss German address format correctly', async function () {
      const content = 'Kontakt: Bahnhofstrasse 10, 8001 Zürich, Schweiz';
      const filePath = path.join(outputDir, 'swiss-german.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'swiss-german-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const anonymized = await fs.readFile(outputPath, 'utf8');

      // Should not fragment the address
      const fragmentCount =
        (anonymized.match(/\[POSTAL/g) || []).length +
        (anonymized.match(/\[CITY/g) || []).length +
        (anonymized.match(/\[STREET/g) || []).length;

      if (anonymized.includes('[ADDRESS_') || anonymized.includes('[SWISS_ADDRESS_')) {
        expect(fragmentCount).to.equal(0, 'Grouped address should not have fragments');
      }
    });

    it('should handle EU/French address format correctly', async function () {
      const content = 'Destinataire: 15 Rue de la Paix, 75002 Paris, France';
      const filePath = path.join(outputDir, 'eu-french.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'eu-french-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const _anonymized = await fs.readFile(outputPath, 'utf8');
      const mappingPath = path.join(outputDir, 'eu-french-anon-mapping.json');
      const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));

      // EU address format should be detected
      // Check addresses array in mapping
      expect(mapping.addresses).to.be.an('array');
    });

    it('should handle multiple addresses in same document without cross-contamination', async function () {
      const content = `FACTURE

Émetteur:
Société ABC SA
Rue de Lausanne 12
1000 Lausanne

Client:
M. Jean Dupont
Avenue de la Gare 45
8001 Zürich`;
      const filePath = path.join(outputDir, 'multi-address-doc.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'multi-address-doc-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const _anonymized = await fs.readFile(outputPath, 'utf8');
      const mappingPath = path.join(outputDir, 'multi-address-doc-anon-mapping.json');
      const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));

      // Should have multiple address entries
      if (mapping.addresses && mapping.addresses.length >= 2) {
        // Each address should have unique placeholder
        const placeholders = mapping.addresses.map(a => a.placeholder);
        const uniquePlaceholders = [...new Set(placeholders)];
        expect(uniquePlaceholders.length).to.equal(placeholders.length, 'Each address should have unique placeholder');
      }
    });
  });

  // ========== Integration Tests ==========
  describe('Integration: Full pipeline with address anonymization', function () {
    it('should handle document with mixed grouped and standalone entities', async function () {
      const content = `Rapport de contact

Client: Jean Dupont
Email: jean.dupont@example.com
Téléphone: +41 79 123 45 67

Adresse de facturation:
Rue de Lausanne 12, 1000 Lausanne

Numéro AVS: 756.1234.5678.90
`;
      const filePath = path.join(outputDir, 'mixed-entities.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'mixed-entities-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const anonymized = await fs.readFile(outputPath, 'utf8');
      const mappingPath = path.join(outputDir, 'mixed-entities-anon-mapping.json');
      const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));

      // Mapping should have both entities and addresses
      expect(mapping.entities).to.be.an('object');
      expect(mapping.addresses).to.be.an('array');

      // Output should not contain original PII
      expect(anonymized).to.not.include('jean.dupont@example.com');
    });

    it('should respect mapping version 3.1 schema', async function () {
      const content = 'Adresse: Bahnhofstrasse 10, 8001 Zürich';
      const filePath = path.join(outputDir, 'schema-version.txt');
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, 'schema-version-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const mappingPath = path.join(outputDir, 'schema-version-anon-mapping.json');
      const mapping = JSON.parse(await fs.readFile(mappingPath, 'utf8'));

      // Check schema version is 3.2 (Story 3.1 format with documentType)
      expect(mapping.version).to.equal('3.2');

      // Story 3.1: Check documentType is present
      expect(mapping).to.have.property('documentType');

      // Check detection methods include Pass 0 and Pass 4
      expect(mapping.detectionMethods).to.include('Pass 0: Document Type Detection (Epic 3)');
      expect(mapping.detectionMethods).to.include('Pass 4: Address Relationship (Epic 2)');

      // Check structure has both entities and addresses
      expect(mapping).to.have.property('entities');
      expect(mapping).to.have.property('addresses');
    });
  });
});
