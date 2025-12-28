/**
 * ReDoS Protection Tests
 *
 * Tests for Story 11.2: Add ReDoS Protection to Validators
 *
 * Verifies that all validators:
 * 1. Have MAX_LENGTH constants
 * 2. Reject inputs exceeding MAX_LENGTH
 * 3. Accept inputs at/below MAX_LENGTH (for other validation reasons)
 * 4. Complete validation of malicious inputs in <100ms
 *
 * @module test/unit/pii/validators/ReDoSProtection.test
 */

import { expect } from 'chai';
import { describe, it, before } from 'mocha';

describe('ReDoS Protection (Story 11.2)', function () {
  this.timeout(10000);

  // Validator classes
  let EmailValidator;
  let PhoneValidator;
  let IbanValidator;
  let SwissAvsValidator;
  let SwissAddressValidator;
  let VatNumberValidator;
  let DateValidator;
  let SwissPostalCodeValidator;

  // Validation functions
  let validateEmailFull;
  let validatePhoneFull;
  let validateIbanFull;
  let validateSwissAvsFull;
  let validateSwissAddressFull;
  let validateVatNumberFull;
  let validateDateFull;
  let validateSwissPostalCodeFull;

  before(async function () {
    // Import from shared/dist module (compiled TypeScript)
    const emailModule = await import('../../../../shared/dist/pii/validators/EmailValidator.js');
    EmailValidator = emailModule.EmailValidator;
    validateEmailFull = emailModule.validateEmailFull;

    const phoneModule = await import('../../../../shared/dist/pii/validators/PhoneValidator.js');
    PhoneValidator = phoneModule.PhoneValidator;
    validatePhoneFull = phoneModule.validatePhoneFull;

    const ibanModule = await import('../../../../shared/dist/pii/validators/IbanValidator.js');
    IbanValidator = ibanModule.IbanValidator;
    validateIbanFull = ibanModule.validateIbanFull;

    const avsModule = await import('../../../../shared/dist/pii/validators/SwissAvsValidator.js');
    SwissAvsValidator = avsModule.SwissAvsValidator;
    validateSwissAvsFull = avsModule.validateSwissAvsFull;

    const addressModule = await import('../../../../shared/dist/pii/validators/SwissAddressValidator.js');
    SwissAddressValidator = addressModule.SwissAddressValidator;
    validateSwissAddressFull = addressModule.validateSwissAddressFull;

    const vatModule = await import('../../../../shared/dist/pii/validators/VatNumberValidator.js');
    VatNumberValidator = vatModule.VatNumberValidator;
    validateVatNumberFull = vatModule.validateVatNumberFull;

    const dateModule = await import('../../../../shared/dist/pii/validators/DateValidator.js');
    DateValidator = dateModule.DateValidator;
    validateDateFull = dateModule.validateDateFull;

    const postalModule = await import('../../../../shared/dist/pii/validators/SwissPostalCodeValidator.js');
    SwissPostalCodeValidator = postalModule.SwissPostalCodeValidator;
    validateSwissPostalCodeFull = postalModule.validateSwissPostalCodeFull;
  });

  describe('MAX_LENGTH Constants', function () {
    it('EmailValidator has MAX_LENGTH = 254 (RFC 5321)', function () {
      expect(EmailValidator.MAX_LENGTH).to.equal(254);
    });

    it('PhoneValidator has MAX_LENGTH = 20 (E.164 + formatting)', function () {
      expect(PhoneValidator.MAX_LENGTH).to.equal(20);
    });

    it('IbanValidator has MAX_LENGTH = 34 (Malta longest)', function () {
      expect(IbanValidator.MAX_LENGTH).to.equal(34);
    });

    it('SwissAvsValidator has MAX_LENGTH = 20 (13 digits + separators)', function () {
      expect(SwissAvsValidator.MAX_LENGTH).to.equal(20);
    });

    it('SwissAddressValidator has MAX_LENGTH = 200 (reasonable address)', function () {
      expect(SwissAddressValidator.MAX_LENGTH).to.equal(200);
    });

    it('VatNumberValidator has MAX_LENGTH = 20 (EU VAT max)', function () {
      expect(VatNumberValidator.MAX_LENGTH).to.equal(20);
    });

    it('DateValidator has MAX_LENGTH = 50 (longest date format)', function () {
      expect(DateValidator.MAX_LENGTH).to.equal(50);
    });

    it('SwissPostalCodeValidator has MAX_LENGTH = 100 (postal + city)', function () {
      expect(SwissPostalCodeValidator.MAX_LENGTH).to.equal(100);
    });
  });

  describe('Length Limit Enforcement', function () {
    describe('EmailValidator', function () {
      it('should reject inputs exceeding MAX_LENGTH', function () {
        const longInput = 'a'.repeat(300) + '@example.com';
        const result = validateEmailFull(longInput);
        expect(result.isValid).to.be.false;
        expect(result.reason).to.include('maximum length');
        expect(result.confidence).to.equal(0.3);
      });

      it('should not reject inputs at MAX_LENGTH for length reasons', function () {
        // Create input exactly at MAX_LENGTH (may fail for other reasons)
        const maxInput = 'a'.repeat(240) + '@example.com'; // 252 chars
        const result = validateEmailFull(maxInput);
        // Should not fail due to length
        if (!result.isValid) {
          expect(result.reason).to.not.include('maximum length');
        }
      });

      it('should process valid emails normally', function () {
        const result = validateEmailFull('test@example.com');
        expect(result.isValid).to.be.true;
      });
    });

    describe('PhoneValidator', function () {
      it('should reject inputs exceeding MAX_LENGTH', function () {
        const longInput = '+' + '1'.repeat(100);
        const result = validatePhoneFull(longInput);
        expect(result.isValid).to.be.false;
        expect(result.reason).to.include('maximum length');
      });

      it('should not reject inputs at MAX_LENGTH for length reasons', function () {
        const maxInput = '+41 79 123 45 67'; // 16 chars
        const result = validatePhoneFull(maxInput);
        if (!result.isValid) {
          expect(result.reason).to.not.include('maximum length');
        }
      });

      it('should process valid phones normally', function () {
        const result = validatePhoneFull('+41791234567');
        expect(result.isValid).to.be.true;
      });
    });

    describe('IbanValidator', function () {
      it('should reject inputs exceeding MAX_LENGTH', function () {
        const longInput = 'CH' + '9'.repeat(100);
        const result = validateIbanFull(longInput);
        expect(result.isValid).to.be.false;
        expect(result.reason).to.include('maximum length');
      });

      it('should not reject inputs at MAX_LENGTH for length reasons', function () {
        const maxInput = 'CH9300762011623852957'; // 21 chars (Swiss IBAN)
        const result = validateIbanFull(maxInput);
        if (!result.isValid) {
          expect(result.reason).to.not.include('maximum length');
        }
      });

      it('should process valid IBANs normally', function () {
        // Valid Swiss IBAN
        const result = validateIbanFull('CH9300762011623852957');
        expect(result.isValid).to.be.true;
      });
    });

    describe('SwissAvsValidator', function () {
      it('should reject inputs exceeding MAX_LENGTH', function () {
        const longInput = '756.' + '1'.repeat(50);
        const result = validateSwissAvsFull(longInput);
        expect(result.isValid).to.be.false;
        expect(result.reason).to.include('maximum length');
      });

      it('should not reject inputs at MAX_LENGTH for length reasons', function () {
        const maxInput = '756.1234.5678.97'; // 16 chars
        const result = validateSwissAvsFull(maxInput);
        if (!result.isValid) {
          expect(result.reason).to.not.include('maximum length');
        }
      });
    });

    describe('SwissAddressValidator', function () {
      it('should reject inputs exceeding MAX_LENGTH', function () {
        const longInput = '1700 ' + 'A'.repeat(250);
        const validator = new SwissAddressValidator();
        const result = validator.validate({ text: longInput });
        expect(result.isValid).to.be.false;
        expect(result.reason).to.include('maximum length');
      });

      it('should not reject inputs at MAX_LENGTH for length reasons', function () {
        const maxInput = '1700 Fribourg';
        const validator = new SwissAddressValidator();
        const result = validator.validate({ text: maxInput });
        if (!result.isValid) {
          expect(result.reason).to.not.include('maximum length');
        }
      });

      it('should process valid addresses normally', function () {
        const result = validateSwissAddressFull('1700 Fribourg');
        expect(result.isValid).to.be.true;
      });
    });

    describe('VatNumberValidator', function () {
      it('should reject inputs exceeding MAX_LENGTH', function () {
        const longInput = 'CHE-' + '1'.repeat(50);
        const result = validateVatNumberFull(longInput);
        expect(result.isValid).to.be.false;
        expect(result.reason).to.include('maximum length');
      });

      it('should not reject inputs at MAX_LENGTH for length reasons', function () {
        const maxInput = 'CHE-123.456.789'; // 15 chars
        const result = validateVatNumberFull(maxInput);
        if (!result.isValid) {
          expect(result.reason).to.not.include('maximum length');
        }
      });
    });

    describe('DateValidator', function () {
      it('should reject inputs exceeding MAX_LENGTH', function () {
        const longInput = '01.01.2025 ' + 'x'.repeat(100);
        const result = validateDateFull(longInput);
        expect(result.isValid).to.be.false;
        expect(result.reason).to.include('maximum length');
      });

      it('should not reject inputs at MAX_LENGTH for length reasons', function () {
        const maxInput = '25. December 2025';
        const result = validateDateFull(maxInput);
        if (!result.isValid) {
          expect(result.reason).to.not.include('maximum length');
        }
      });

      it('should process valid dates normally', function () {
        const result = validateDateFull('01.01.2025');
        expect(result.isValid).to.be.true;
      });
    });

    describe('SwissPostalCodeValidator', function () {
      it('should reject inputs exceeding MAX_LENGTH', function () {
        const longInput = '1700 ' + 'A'.repeat(150);
        const result = validateSwissPostalCodeFull(longInput);
        expect(result.isValid).to.be.false;
        expect(result.reason).to.include('maximum length');
      });

      it('should not reject inputs at MAX_LENGTH for length reasons', function () {
        const maxInput = '1700 Fribourg';
        const result = validateSwissPostalCodeFull(maxInput);
        if (!result.isValid) {
          expect(result.reason).to.not.include('maximum length');
        }
      });

      it('should process valid postal codes normally', function () {
        const result = validateSwissPostalCodeFull('1700');
        expect(result.isValid).to.be.true;
      });
    });
  });

  describe('Performance - ReDoS Prevention', function () {
    // These tests verify that malicious inputs complete quickly
    // due to the length check occurring BEFORE regex matching

    it('EmailValidator: malicious input validates in <100ms', function () {
      // This pattern would cause catastrophic backtracking without length check
      const maliciousInput = 'a@' + 'a.'.repeat(1000) + '!';
      const start = Date.now();
      validateEmailFull(maliciousInput);
      const elapsed = Date.now() - start;
      expect(elapsed).to.be.lessThan(100);
    });

    it('PhoneValidator: malicious input validates in <100ms', function () {
      const maliciousInput = '+' + '1'.repeat(1000);
      const start = Date.now();
      validatePhoneFull(maliciousInput);
      const elapsed = Date.now() - start;
      expect(elapsed).to.be.lessThan(100);
    });

    it('IbanValidator: malicious input validates in <100ms', function () {
      const maliciousInput = 'CH' + '9'.repeat(1000);
      const start = Date.now();
      validateIbanFull(maliciousInput);
      const elapsed = Date.now() - start;
      expect(elapsed).to.be.lessThan(100);
    });

    it('SwissAvsValidator: malicious input validates in <100ms', function () {
      const maliciousInput = '756' + '.1'.repeat(500);
      const start = Date.now();
      validateSwissAvsFull(maliciousInput);
      const elapsed = Date.now() - start;
      expect(elapsed).to.be.lessThan(100);
    });

    it('SwissAddressValidator: malicious input validates in <100ms', function () {
      const maliciousInput = '1700 ' + 'A'.repeat(1000);
      const validator = new SwissAddressValidator();
      const start = Date.now();
      validator.validate({ text: maliciousInput });
      const elapsed = Date.now() - start;
      expect(elapsed).to.be.lessThan(100);
    });

    it('VatNumberValidator: malicious input validates in <100ms', function () {
      const maliciousInput = 'CHE-' + '1.'.repeat(500);
      const start = Date.now();
      validateVatNumberFull(maliciousInput);
      const elapsed = Date.now() - start;
      expect(elapsed).to.be.lessThan(100);
    });

    it('DateValidator: malicious input validates in <100ms', function () {
      const maliciousInput = '01.'.repeat(500) + '2025';
      const start = Date.now();
      validateDateFull(maliciousInput);
      const elapsed = Date.now() - start;
      expect(elapsed).to.be.lessThan(100);
    });

    it('SwissPostalCodeValidator: malicious input validates in <100ms', function () {
      const maliciousInput = '1700 ' + 'Zürich '.repeat(200);
      const start = Date.now();
      validateSwissPostalCodeFull(maliciousInput);
      const elapsed = Date.now() - start;
      expect(elapsed).to.be.lessThan(100);
    });
  });

  describe('Edge Cases', function () {
    it('Empty string should not trigger length error', function () {
      const emailResult = validateEmailFull('');
      expect(emailResult.reason).to.not.include('maximum length');
    });

    it('Exactly at MAX_LENGTH boundary - EmailValidator', function () {
      // Create string exactly at MAX_LENGTH
      const exactLength = 'a'.repeat(EmailValidator.MAX_LENGTH - 12) + '@example.com';
      expect(exactLength.length).to.be.at.most(EmailValidator.MAX_LENGTH);
      const result = validateEmailFull(exactLength);
      // Should not fail due to length
      if (!result.isValid) {
        expect(result.reason).to.not.include('maximum length');
      }
    });

    it('One character over MAX_LENGTH - EmailValidator', function () {
      const overLength = 'a'.repeat(EmailValidator.MAX_LENGTH - 11) + '@example.com';
      expect(overLength.length).to.be.greaterThan(EmailValidator.MAX_LENGTH);
      const result = validateEmailFull(overLength);
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('maximum length');
    });

    it('Unicode characters count correctly', function () {
      // Test with multi-byte characters
      const unicodeInput = 'ü'.repeat(300) + '@example.com';
      const result = validateEmailFull(unicodeInput);
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('maximum length');
    });
  });
});
