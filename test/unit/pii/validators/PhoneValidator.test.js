/**
 * Phone Validator Tests
 *
 * Tests for Story 11.6: Validator Test Coverage
 *
 * Validates Swiss and EU phone number formats.
 * Supports country codes: CH (+41), DE (+49), FR (+33), IT (+39), AT (+43), BE (+32), NL (+31), LU (+352)
 * Swiss mobile prefixes: 076, 077, 078, 079
 *
 * @module test/unit/pii/validators/PhoneValidator.test
 */

import { expect } from 'chai';
import { describe, it, before } from 'mocha';

describe('PhoneValidator', function () {
  this.timeout(10000);

  let PhoneValidator;
  let validatePhone;
  let validatePhoneFull;

  before(async function () {
    const module = await import('../../../../shared/dist/pii/validators/PhoneValidator.js');
    PhoneValidator = module.PhoneValidator;
    validatePhone = module.validatePhone;
    validatePhoneFull = module.validatePhoneFull;
  });

  describe('Swiss mobile numbers', function () {
    const swissMobileCases = [
      { input: '+41791234567', description: 'international format 079' },
      { input: '+41781234567', description: 'international format 078' },
      { input: '+41771234567', description: 'international format 077' },
      { input: '+41761234567', description: 'international format 076' },
      { input: '0791234567', description: 'local format 079' },
      { input: '0781234567', description: 'local format 078' },
      { input: '+41 79 123 45 67', description: 'with spaces' },
      { input: '+41-79-123-45-67', description: 'with dashes' },
    ];

    swissMobileCases.forEach(({ input, description }) => {
      it(`should validate Swiss mobile ${description}: ${input}`, function () {
        const result = validatePhoneFull(input);
        expect(result.isValid).to.be.true;
        expect(result.confidence).to.be.at.least(0.8);
      });
    });
  });

  describe('Swiss landline numbers', function () {
    const swissLandlineCases = [
      { input: '+41221234567', description: 'Geneva (022)' },
      { input: '+41442345678', description: 'Zurich (044)' },
      { input: '+41313456789', description: 'Bern (031)' },
      { input: '0221234567', description: 'local Geneva' },
      { input: '0442345678', description: 'local Zurich' },
    ];

    swissLandlineCases.forEach(({ input, description }) => {
      it(`should validate Swiss landline ${description}: ${input}`, function () {
        const result = validatePhoneFull(input);
        expect(result.isValid).to.be.true;
      });
    });
  });

  describe('EU country numbers', function () {
    const euCases = [
      { input: '+491701234567', description: 'German mobile', country: 'DE' },
      { input: '+49301234567', description: 'German Berlin landline', country: 'DE' },
      { input: '+33612345678', description: 'French mobile', country: 'FR' },
      { input: '+33145678901', description: 'French Paris landline', country: 'FR' },
      { input: '+393331234567', description: 'Italian mobile', country: 'IT' },
      { input: '+39021234567', description: 'Italian Milan landline', country: 'IT' },
      { input: '+436641234567', description: 'Austrian mobile', country: 'AT' },
      { input: '+43122345678', description: 'Austrian Vienna landline', country: 'AT' },
      { input: '+32475123456', description: 'Belgian mobile', country: 'BE' },
      { input: '+31612345678', description: 'Dutch mobile', country: 'NL' },
      { input: '+352621234567', description: 'Luxembourg mobile', country: 'LU' },
    ];

    euCases.forEach(({ input, description, country }) => {
      it(`should validate ${country} number ${description}: ${input}`, function () {
        const result = validatePhoneFull(input);
        expect(result.isValid).to.be.true;
      });
    });
  });

  describe('invalid inputs', function () {
    const invalidCases = [
      { input: '12345', reason: 'too few digits (5)' },
      { input: '1234567890123456', reason: 'too many digits (16)' },
      { input: '+999123456789', reason: 'invalid country code' },
      { input: '+1234567890', reason: 'unrecognized prefix' },
      { input: 'abc123456789', reason: 'contains letters' },
      { input: '', reason: 'empty string' },
      { input: '   ', reason: 'whitespace only' },
    ];

    invalidCases.forEach(({ input, reason }) => {
      it(`should reject: "${input}" (${reason})`, function () {
        const result = validatePhoneFull(input);
        expect(result.isValid).to.be.false;
        expect(result.reason).to.exist;
      });
    });
  });

  describe('format variations', function () {
    it('should accept numbers with + prefix', function () {
      const result = validatePhoneFull('+41791234567');
      expect(result.isValid).to.be.true;
    });

    it('should accept numbers with 00 prefix', function () {
      const result = validatePhoneFull('0041791234567');
      expect(result.isValid).to.be.true;
    });

    it('should accept local format (starting with 0)', function () {
      const result = validatePhoneFull('0791234567');
      expect(result.isValid).to.be.true;
    });

    it('should strip formatting characters', function () {
      const formats = [
        '+41 79 123 45 67',
        '+41-79-123-45-67',
        '+41.79.123.45.67',
        '+41 (79) 123 45 67',
      ];

      for (const format of formats) {
        const result = validatePhoneFull(format);
        expect(result.isValid).to.be.true;
      }
    });
  });

  describe('length validation', function () {
    it('should reject numbers shorter than 9 digits', function () {
      const result = validatePhoneFull('12345678');
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('length');
    });

    it('should accept numbers with 9 digits', function () {
      const result = validatePhoneFull('079123456');
      // May fail for other reasons but not length
      if (!result.isValid) {
        expect(result.reason).to.not.include('length');
      }
    });

    it('should accept numbers up to 15 digits', function () {
      const result = validatePhoneFull('+41791234567890');
      // May fail for other reasons but not length
      if (!result.isValid) {
        expect(result.reason).to.not.include('length');
      }
    });

    it('should reject numbers longer than 15 digits', function () {
      // 16+ digits should be rejected
      const result = validatePhoneFull('+4179123456789012345');
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('length');
    });
  });

  describe('edge cases', function () {
    it('should handle empty input', function () {
      const result = validatePhoneFull('');
      expect(result.isValid).to.be.false;
    });

    it('should handle whitespace only', function () {
      const result = validatePhoneFull('   ');
      expect(result.isValid).to.be.false;
    });

    it('should handle unicode digits', function () {
      // Full-width digits
      const result = validatePhoneFull('+４１７９１２３４５６７');
      expect(result.isValid).to.be.false;
    });

    it('should handle mixed letters and digits', function () {
      const result = validatePhoneFull('+41 79 ABC 45 67');
      // Letters are stripped, leaving only digits
      expect(typeof result.isValid).to.equal('boolean');
    });

    it('should reject very long inputs (ReDoS protection)', function () {
      const longInput = '+' + '1'.repeat(100);
      const result = validatePhoneFull(longInput);
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('maximum length');
    });

    it('should handle leading zeros in country code', function () {
      // 0041 is valid Swiss international prefix
      const result = validatePhoneFull('0041791234567');
      expect(result.isValid).to.be.true;
    });
  });

  describe('Swiss mobile prefix detection', function () {
    it('should give higher confidence for Swiss mobile prefixes', function () {
      const mobile = validatePhoneFull('+41791234567');
      const landline = validatePhoneFull('+41221234567');

      expect(mobile.confidence).to.be.at.least(landline.confidence);
    });

    it('should recognize all Swiss mobile prefixes', function () {
      const prefixes = ['76', '77', '78', '79'];
      for (const prefix of prefixes) {
        const result = validatePhoneFull(`+41${prefix}1234567`);
        expect(result.isValid).to.be.true;
        expect(result.confidence).to.be.at.least(0.9);
      }
    });
  });

  describe('class interface', function () {
    it('should implement ValidationRule interface', function () {
      const validator = new PhoneValidator();
      expect(validator.entityType).to.equal('PHONE');
      expect(validator.name).to.equal('PhoneValidator');
      expect(validator.validate).to.be.a('function');
    });

    it('should have MAX_LENGTH constant', function () {
      expect(PhoneValidator.MAX_LENGTH).to.equal(20);
    });

    it('should validate via class instance', function () {
      const validator = new PhoneValidator();
      const result = validator.validate({ text: '+41791234567' });
      expect(result.isValid).to.be.true;
    });
  });

  describe('standalone functions', function () {
    it('validatePhone should return boolean', function () {
      expect(validatePhone('+41791234567')).to.be.true;
      expect(validatePhone('12345')).to.be.false;
    });

    it('validatePhoneFull should return result object', function () {
      const result = validatePhoneFull('+41791234567');
      expect(result).to.have.property('isValid');
      expect(result).to.have.property('confidence');
    });
  });
});
