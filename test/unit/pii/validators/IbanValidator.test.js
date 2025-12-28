/**
 * IBAN Validator Tests
 *
 * Tests for Story 11.6: Validator Test Coverage
 *
 * Validates International Bank Account Numbers using ISO 7064 Mod 97-10.
 * Supports Swiss and EU country codes with country-specific length validation.
 *
 * @module test/unit/pii/validators/IbanValidator.test
 */

import { expect } from 'chai';
import { describe, it, before } from 'mocha';

describe('IbanValidator', function () {
  this.timeout(10000);

  let IbanValidator;
  let validateIban;
  let validateIbanFull;

  before(async function () {
    const module = await import('../../../../shared/dist/pii/validators/IbanValidator.js');
    IbanValidator = module.IbanValidator;
    validateIban = module.validateIban;
    validateIbanFull = module.validateIbanFull;
  });

  describe('valid Swiss IBANs', function () {
    const validSwissIbans = [
      { input: 'CH9300762011623852957', description: 'standard format' },
      { input: 'CH93 0076 2011 6238 5295 7', description: 'with spaces' },
      { input: 'ch9300762011623852957', description: 'lowercase' },
    ];

    validSwissIbans.forEach(({ input, description }) => {
      it(`should validate Swiss IBAN ${description}: ${input}`, function () {
        const result = validateIbanFull(input);
        expect(result.isValid).to.be.true;
        expect(result.confidence).to.be.at.least(0.9);
      });
    });
  });

  describe('valid EU IBANs', function () {
    const validEuIbans = [
      { input: 'DE89370400440532013000', description: 'German IBAN (22 chars)', country: 'DE' },
      { input: 'FR7630006000011234567890189', description: 'French IBAN (27 chars)', country: 'FR' },
      { input: 'IT60X0542811101000000123456', description: 'Italian IBAN (27 chars)', country: 'IT' },
      { input: 'AT611904300234573201', description: 'Austrian IBAN (20 chars)', country: 'AT' },
      { input: 'BE68539007547034', description: 'Belgian IBAN (16 chars)', country: 'BE' },
      { input: 'NL91ABNA0417164300', description: 'Dutch IBAN (18 chars)', country: 'NL' },
      { input: 'ES9121000418450200051332', description: 'Spanish IBAN (24 chars)', country: 'ES' },
      { input: 'LU280019400644750000', description: 'Luxembourg IBAN (20 chars)', country: 'LU' },
      { input: 'LI21088100002324013AA', description: 'Liechtenstein IBAN (21 chars)', country: 'LI' },
    ];

    validEuIbans.forEach(({ input, description, country }) => {
      it(`should validate ${country} IBAN ${description}`, function () {
        const result = validateIbanFull(input);
        expect(result.isValid).to.be.true;
      });
    });
  });

  describe('invalid inputs', function () {
    const invalidCases = [
      { input: 'CH9300762011623852958', reason: 'wrong checksum (last digit)' },
      { input: 'CH9300762011623852', reason: 'too short for Swiss (18 vs 21)' },
      { input: 'CH930076201162385295712345', reason: 'too long for Swiss' },
      { input: 'DE8937040044053201300', reason: 'wrong length for German (21 vs 22)' },
      { input: 'XX9300762011623852957', reason: 'unknown country code' },
      { input: 'CHAB00762011623852957', reason: 'invalid check digits (not numeric)' },
      { input: '123456789012345', reason: 'no country code' },
    ];

    invalidCases.forEach(({ input, reason }) => {
      it(`should reject: ${input} (${reason})`, function () {
        const result = validateIbanFull(input);
        expect(result.isValid).to.be.false;
        expect(result.reason).to.exist;
      });
    });
  });

  describe('Mod 97-10 checksum validation', function () {
    it('should validate correct checksum', function () {
      // CH93 - checksum is 93, validate with mod 97-10
      const result = validateIbanFull('CH9300762011623852957');
      expect(result.isValid).to.be.true;
    });

    it('should reject wrong checksum', function () {
      // Change checksum from 93 to 94
      const result = validateIbanFull('CH9400762011623852957');
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('Checksum');
    });

    it('should detect transposed digits', function () {
      // Swap two digits - checksum will fail
      const result = validateIbanFull('CH9300672011623852957');
      expect(result.isValid).to.be.false;
    });

    it('should handle the checksum algorithm edge cases', function () {
      // The mod 97-10 should return 1 for valid IBAN
      // Test with a known valid IBAN
      const result = validateIbanFull('GB82WEST12345698765432');
      expect(result.isValid).to.be.true;
    });
  });

  describe('country-specific length validation', function () {
    it('should validate Swiss IBAN is exactly 21 chars', function () {
      // Valid 21-char Swiss IBAN
      const valid = validateIbanFull('CH9300762011623852957');
      expect(valid.isValid).to.be.true;

      // Wrong length - should still fail checksum/length
      const tooShort = validateIbanFull('CH93007620116238529');
      expect(tooShort.isValid).to.be.false;
    });

    it('should validate German IBAN is exactly 22 chars', function () {
      const result = validateIbanFull('DE89370400440532013000');
      expect(result.isValid).to.be.true;
    });

    it('should validate French IBAN is exactly 27 chars', function () {
      const result = validateIbanFull('FR7630006000011234567890189');
      expect(result.isValid).to.be.true;
    });

    it('should reject country-length mismatch', function () {
      // German IBAN should be 22, this is 21
      const result = validateIbanFull('DE8937040044053201300');
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('length');
    });
  });

  describe('edge cases', function () {
    it('should handle empty input', function () {
      const result = validateIbanFull('');
      expect(result.isValid).to.be.false;
    });

    it('should handle whitespace only', function () {
      const result = validateIbanFull('   ');
      expect(result.isValid).to.be.false;
    });

    it('should handle too short input', function () {
      const result = validateIbanFull('CH93');
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('short');
    });

    it('should normalize spaces before validation', function () {
      // With excessive spaces
      const result = validateIbanFull('CH93  0076  2011  6238  5295  7');
      expect(result.isValid).to.be.true;
    });

    it('should be case insensitive', function () {
      const upper = validateIbanFull('CH9300762011623852957');
      const lower = validateIbanFull('ch9300762011623852957');
      const mixed = validateIbanFull('Ch9300762011623852957');

      expect(upper.isValid).to.equal(lower.isValid);
      expect(upper.isValid).to.equal(mixed.isValid);
    });

    it('should reject very long inputs (ReDoS protection)', function () {
      const longInput = 'CH' + '9'.repeat(100);
      const result = validateIbanFull(longInput);
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('maximum length');
    });

    it('should handle special characters', function () {
      const result = validateIbanFull('CH93-0076-2011-6238-5295-7');
      // Dashes are not valid in IBAN, only spaces
      expect(result.isValid).to.be.false;
    });
  });

  describe('class interface', function () {
    it('should implement ValidationRule interface', function () {
      const validator = new IbanValidator();
      expect(validator.entityType).to.equal('IBAN');
      expect(validator.name).to.equal('IbanValidator');
      expect(validator.validate).to.be.a('function');
    });

    it('should have MAX_LENGTH constant', function () {
      expect(IbanValidator.MAX_LENGTH).to.equal(34);
    });
  });

  describe('standalone functions', function () {
    it('validateIban should return boolean', function () {
      expect(validateIban('CH9300762011623852957')).to.be.true;
      expect(validateIban('CH9300762011623852958')).to.be.false;
    });
  });
});
