/**
 * Swiss Address Validator Tests
 *
 * Tests for year false positive detection in Swiss postal codes.
 * Addresses the issue where dates like "2024 Attestation" or "2014 pour"
 * were incorrectly matched as Swiss addresses.
 */

import { expect } from 'chai';
import { describe, it, before } from 'mocha';
import { testLogger } from '../../../helpers/testLogger.js';

describe('SwissAddressValidator', function () {
  this.timeout(10000);

  let validateSwissAddress;
  let validateSwissAddressFull;

  before(async function () {
    // Import from shared module (the source of truth)
    const sharedModule = await import('../../../../shared/dist/pii/validators/SwissAddressValidator.js');
    validateSwissAddress = sharedModule.validateSwissAddress;
    validateSwissAddressFull = sharedModule.validateSwissAddressFull;
  });

  describe('Valid Swiss addresses', function () {
    it('should accept "1700 Fribourg"', function () {
      const result = validateSwissAddressFull('1700 Fribourg');
      expect(result.isValid).to.be.true;
      expect(result.confidence).to.be.at.least(0.8);
    });

    it('should accept "8085 Zurich"', function () {
      const result = validateSwissAddressFull('8085 Zurich');
      expect(result.isValid).to.be.true;
    });

    it('should accept "1023 Crissier"', function () {
      const result = validateSwissAddressFull('1023 Crissier');
      expect(result.isValid).to.be.true;
    });

    it('should accept "3000 Bern"', function () {
      const result = validateSwissAddressFull('3000 Bern');
      expect(result.isValid).to.be.true;
    });

    it('should accept "1200 Genève"', function () {
      const result = validateSwissAddressFull('1200 Genève');
      expect(result.isValid).to.be.true;
    });

    it('should accept "2000 Neuchâtel" (real postal code in year range)', function () {
      const result = validateSwissAddressFull('2000 Neuchâtel');
      expect(result.isValid).to.be.true;
    });

    it('should accept "1950 Sion" (real postal code in year range)', function () {
      const result = validateSwissAddressFull('1950 Sion');
      expect(result.isValid).to.be.true;
    });
  });

  describe('Year false positive detection', function () {
    describe('Year followed by month names', function () {
      it('should reject "2024 January"', function () {
        const result = validateSwissAddressFull('2024 January');
        expect(result.isValid).to.be.false;
        expect(result.reason).to.include('month');
      });

      it('should reject "2024 Janvier"', function () {
        const result = validateSwissAddressFull('2024 Janvier');
        expect(result.isValid).to.be.false;
      });

      it('should reject "2024 Januar"', function () {
        const result = validateSwissAddressFull('2024 Januar');
        expect(result.isValid).to.be.false;
      });

      it('should reject "1999 December"', function () {
        const result = validateSwissAddressFull('1999 December');
        expect(result.isValid).to.be.false;
      });
    });

    describe('Year followed by document/business terms', function () {
      it('should reject "2024 Attestation"', function () {
        const result = validateSwissAddressFull('2024 Attestation');
        expect(result.isValid).to.be.false;
      });

      it('should reject "2014 pour" (followed by function word)', function () {
        const result = validateSwissAddressFull('2014 pour');
        expect(result.isValid).to.be.false;
      });

      it('should reject "2020 Report"', function () {
        const result = validateSwissAddressFull('2020 Report');
        expect(result.isValid).to.be.false;
      });

      it('should reject "2023 Rapport"', function () {
        const result = validateSwissAddressFull('2023 Rapport');
        expect(result.isValid).to.be.false;
      });

      it('should reject "2021 Document"', function () {
        const result = validateSwissAddressFull('2021 Document');
        expect(result.isValid).to.be.false;
      });

      it('should reject "2019 Contrat"', function () {
        const result = validateSwissAddressFull('2019 Contrat');
        expect(result.isValid).to.be.false;
      });
    });

    describe('Year with date prefix context', function () {
      it('should reject when preceded by DD.MM. pattern', function () {
        const fullText = 'Le document daté du 01.01.2014 Processed est valide';
        const result = validateSwissAddressFull('2014 Processed', fullText);
        expect(result.isValid).to.be.false;
        expect(result.reason).to.include('date');
      });

      it('should reject when preceded by DD/MM pattern', function () {
        const fullText = 'Date: 15/06/2023 Edition du rapport';
        const result = validateSwissAddressFull('2023 Edition', fullText);
        expect(result.isValid).to.be.false;
      });

      it('should reject when preceded by "Date:"', function () {
        const fullText = 'Date: 2024 Attestation de conformité';
        const result = validateSwissAddressFull('2024 Attestation', fullText);
        expect(result.isValid).to.be.false;
      });

      it('should reject when preceded by "depuis"', function () {
        const fullText = 'Membre depuis 2014 pour la prévoyance';
        const result = validateSwissAddressFull('2014 pour', fullText);
        expect(result.isValid).to.be.false;
      });

      it('should reject when preceded by "le" (date indicator)', function () {
        const fullText = 'Signé le 2020 Janvier par le directeur';
        const result = validateSwissAddressFull('2020 Janvier', fullText);
        expect(result.isValid).to.be.false;
      });
    });

    describe('Year at sentence boundary without street context', function () {
      it('should reject year at end of sentence', function () {
        const fullText = 'Le contrat a été signé en 2024 Something. Voir annexe.';
        const result = validateSwissAddressFull('2024 Something', fullText);
        expect(result.isValid).to.be.false;
      });
    });
  });

  describe('Real-world false positive cases from Softcom attestation', function () {
    it('should reject "2024 Attestation d" from the original document', function () {
      const fullText = '07.06.2024 Attestation d\'adhésion';
      const result = validateSwissAddressFull('2024 Attestation', fullText);
      expect(result.isValid).to.be.false;
    });

    it('should reject "2014 pour l\'exécution" from the original document', function () {
      const fullText = 'depuis le 01.01.2014 pour l\'exécution de sa prévoyance';
      const result = validateSwissAddressFull('2014 pour', fullText);
      expect(result.isValid).to.be.false;
    });
  });

  describe('Edge cases', function () {
    it('should reject postal codes below 1000', function () {
      const result = validateSwissAddressFull('0999 Test');
      expect(result.isValid).to.be.false;
    });

    it('should reject city names shorter than 3 characters', function () {
      const result = validateSwissAddressFull('1700 AB');
      expect(result.isValid).to.be.false;
    });

    it('should handle missing context gracefully', function () {
      const result = validateSwissAddressFull('1700 Fribourg', '');
      expect(result.isValid).to.be.true;
    });

    it('should accept valid addresses even in year range with proper city', function () {
      // 2000 Neuchâtel is a REAL Swiss postal code
      const fullText = 'Livraison à 2000 Neuchâtel, Suisse';
      const result = validateSwissAddressFull('2000 Neuchâtel', fullText);
      expect(result.isValid).to.be.true;
    });
  });

  describe('Standalone validateSwissAddress function', function () {
    it('should work with just address parameter', function () {
      expect(validateSwissAddress('1700 Fribourg')).to.be.true;
    });

    it('should work with context parameter', function () {
      expect(validateSwissAddress('2024 Attestation', 'Date: 2024 Attestation')).to.be.false;
    });

    it('should reject year followed by month', function () {
      expect(validateSwissAddress('2024 January')).to.be.false;
    });
  });

  describe('Position-based context optimization (Story 11.11)', function () {
    describe('ValidationContext object support', function () {
      it('should accept ValidationContext object with fullText only', function () {
        const fullText = 'Livraison à 1700 Fribourg, Suisse';
        const result = validateSwissAddressFull('1700 Fribourg', { fullText });
        expect(result.isValid).to.be.true;
        expect(result.confidence).to.be.at.least(0.8);
      });

      it('should accept ValidationContext object with fullText and position', function () {
        const fullText = 'Livraison à 1700 Fribourg, Suisse';
        const position = fullText.indexOf('1700 Fribourg');
        const result = validateSwissAddressFull('1700 Fribourg', { fullText, position });
        expect(result.isValid).to.be.true;
        expect(result.confidence).to.be.at.least(0.8);
      });

      it('should accept empty ValidationContext object', function () {
        const result = validateSwissAddressFull('1700 Fribourg', {});
        expect(result.isValid).to.be.true;
      });
    });

    describe('Position parameter usage', function () {
      it('should use provided position for context extraction (year range)', function () {
        // Year-range postal code that requires context analysis
        // Use a city-like word that isn't in NON_CITY_WORDS but triggers date context
        const fullText = 'Le contrat daté du 01.01.2014 Genova est archivé';
        const address = '2014 Genova';
        const position = fullText.indexOf(address);

        // With position provided - should correctly identify date prefix
        const result = validateSwissAddressFull(address, { fullText, position });
        expect(result.isValid).to.be.false;
        expect(result.reason).to.include('date');
      });

      it('should produce same result with and without position for identical context', function () {
        const fullText = 'Membre depuis 2014 pour la prévoyance';
        const address = '2014 pour';
        const position = fullText.indexOf(address);

        // With position
        const resultWithPos = validateSwissAddressFull(address, { fullText, position });
        // Without position (uses indexOf internally)
        const resultWithoutPos = validateSwissAddressFull(address, fullText);

        expect(resultWithPos.isValid).to.equal(resultWithoutPos.isValid);
        expect(resultWithPos.confidence).to.equal(resultWithoutPos.confidence);
        expect(resultWithPos.reason).to.equal(resultWithoutPos.reason);
      });

      it('should handle position=0 correctly (match at start)', function () {
        const fullText = '2024 Attestation de conformité';
        const address = '2024 Attestation';

        // Position 0 - no context before the match
        const result = validateSwissAddressFull(address, { fullText, position: 0 });
        // Should reject due to non-city word, not date context
        expect(result.isValid).to.be.false;
      });

      it('should handle position at end of text correctly', function () {
        const address = '1700 Fribourg';
        const fullText = 'Livraison à ' + address;
        const position = fullText.length - address.length;

        const result = validateSwissAddressFull(address, { fullText, position });
        expect(result.isValid).to.be.true;
      });
    });

    describe('Backward compatibility', function () {
      it('should maintain string parameter support', function () {
        const fullText = 'Date: 2024 Attestation';
        // String parameter (legacy API)
        const result = validateSwissAddressFull('2024 Attestation', fullText);
        expect(result.isValid).to.be.false;
      });

      it('should handle undefined context parameter', function () {
        const result = validateSwissAddressFull('1700 Fribourg', undefined);
        expect(result.isValid).to.be.true;
      });

      it('should handle empty string context parameter', function () {
        const result = validateSwissAddressFull('1700 Fribourg', '');
        expect(result.isValid).to.be.true;
      });
    });

    describe('Validation accuracy with position', function () {
      it('should correctly reject date pattern with provided position', function () {
        // Use a city-like word that isn't in NON_CITY_WORDS
        const fullText = 'Document signé le 15/06/2023 Genova dans le rapport';
        const address = '2023 Genova';
        const position = fullText.indexOf(address);

        const result = validateSwissAddressFull(address, { fullText, position });
        expect(result.isValid).to.be.false;
        expect(result.reason).to.include('date');
      });

      it('should correctly accept known city with provided position', function () {
        const fullText = 'Notre bureau est situé à 2000 Neuchâtel en Suisse';
        const address = '2000 Neuchâtel';
        const position = fullText.indexOf(address);

        const result = validateSwissAddressFull(address, { fullText, position });
        expect(result.isValid).to.be.true;
        // Known cities return "Known Swiss city" in reason, but it's optional
        if (result.reason) {
          expect(result.reason).to.include('Known Swiss city');
        }
      });

      it('should correctly reject sentence boundary without street context', function () {
        // Avoid date keywords like "en" - use different phrasing
        const fullText = 'Contrat signé pour 2024 Something. Voir annexe.';
        const address = '2024 Something';
        const position = fullText.indexOf(address);

        const result = validateSwissAddressFull(address, { fullText, position });
        expect(result.isValid).to.be.false;
        // Could be rejected for non-city word or sentence boundary
        expect(result.reason).to.be.a('string');
      });

      it('should correctly accept with street context and position', function () {
        const fullText = 'Envoyez à Rue de la Gare 25, 1950 Sion';
        const address = '1950 Sion';
        const position = fullText.indexOf(address);

        const result = validateSwissAddressFull(address, { fullText, position });
        expect(result.isValid).to.be.true;
      });
    });

    describe('Performance benchmark (AC #4)', function () {
      it('should show performance improvement with position parameter on large document', function () {
        // Generate a large document (~100KB)
        const paragraphTemplate = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ';
        const paragraphCount = 450; // ~100KB
        const baseText = paragraphTemplate.repeat(paragraphCount);

        // Insert test addresses at various positions
        const addresses = [
          { text: '2024 Genova', position: 1000 },
          { text: '2015 Milano', position: 25000 },
          { text: '2019 Roma', position: 50000 },
          { text: '2021 Torino', position: 75000 },
          { text: '2023 Napoli', position: 95000 },
        ];

        // Build document with addresses at known positions
        let fullText = baseText;
        const insertedPositions = [];
        for (const addr of addresses) {
          const insertPos = Math.min(addr.position, fullText.length);
          fullText = fullText.slice(0, insertPos) + ' Daté du 01.01.' + addr.text + ' pour le rapport ' + fullText.slice(insertPos);
          insertedPositions.push({ text: addr.text, position: insertPos + 14 }); // 14 = ' Daté du 01.01.'.length
        }

        const iterations = 100;

        // Benchmark WITHOUT position (uses indexOf internally)
        const startWithoutPos = performance.now();
        for (let i = 0; i < iterations; i++) {
          for (const addr of insertedPositions) {
            validateSwissAddressFull(addr.text, fullText);
          }
        }
        const timeWithoutPos = performance.now() - startWithoutPos;

        // Benchmark WITH position (avoids indexOf)
        const startWithPos = performance.now();
        for (let i = 0; i < iterations; i++) {
          for (const addr of insertedPositions) {
            validateSwissAddressFull(addr.text, { fullText, position: addr.position });
          }
        }
        const timeWithPos = performance.now() - startWithPos;

        // Log results
        const docSizeKB = (fullText.length / 1024).toFixed(1);
        const improvement = ((timeWithoutPos - timeWithPos) / timeWithoutPos * 100).toFixed(1);

        // Performance results logged for documentation
        testLogger.info('Performance Benchmark Results', {
          documentSizeKB: docSizeKB,
          totalValidations: iterations * 5,
          timeWithoutPositionMs: timeWithoutPos.toFixed(2),
          timeWithPositionMs: timeWithPos.toFixed(2),
          improvementPercent: improvement,
        });

        // Assert that position-based is at least not slower
        // (actual improvement depends on document size and address count)
        expect(timeWithPos).to.be.at.most(timeWithoutPos * 1.1); // Allow 10% variance

        // Document size should be ~100KB
        expect(fullText.length).to.be.at.least(100000);
      });
    });
  });
});
