/**
 * Swiss Address Validator Tests
 *
 * Tests for year false positive detection in Swiss postal codes.
 * Addresses the issue where dates like "2024 Attestation" or "2014 pour"
 * were incorrectly matched as Swiss addresses.
 */

import { expect } from 'chai';
import { describe, it, before } from 'mocha';

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
});
