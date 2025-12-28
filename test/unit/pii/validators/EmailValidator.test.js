/**
 * Email Validator Tests
 *
 * Tests for Story 11.6: Validator Test Coverage
 *
 * Validates email addresses using RFC 5322 simplified pattern.
 * Checks for common invalid patterns like consecutive dots.
 *
 * @module test/unit/pii/validators/EmailValidator.test
 */

import { expect } from 'chai';
import { describe, it, before } from 'mocha';

describe('EmailValidator', function () {
  this.timeout(10000);

  let EmailValidator;
  let validateEmail;
  let validateEmailFull;

  before(async function () {
    const module = await import('../../../../shared/dist/pii/validators/EmailValidator.js');
    EmailValidator = module.EmailValidator;
    validateEmail = module.validateEmail;
    validateEmailFull = module.validateEmailFull;
  });

  describe('valid emails', function () {
    const validCases = [
      { input: 'test@example.com', description: 'simple email' },
      { input: 'user.name@example.com', description: 'with dot in local part' },
      { input: 'user+tag@example.com', description: 'with plus addressing' },
      { input: 'user_name@example.com', description: 'with underscore' },
      { input: 'user-name@example.com', description: 'with hyphen' },
      { input: 'user@subdomain.example.com', description: 'with subdomain' },
      { input: 'user@sub.domain.example.com', description: 'with multiple subdomains' },
      { input: '123@example.com', description: 'numeric local part' },
      { input: 'user@example.co.uk', description: 'with country TLD' },
      { input: 'user@example.museum', description: 'with long TLD' },
      { input: "user!#$%&'*+/=?^`{|}~@example.com", description: 'with special chars' },
    ];

    validCases.forEach(({ input, description }) => {
      it(`should validate ${description}: ${input}`, function () {
        const result = validateEmailFull(input);
        expect(result.isValid).to.be.true;
        expect(result.confidence).to.be.at.least(0.8);
      });
    });
  });

  describe('invalid emails', function () {
    const invalidCases = [
      { input: 'no-at-sign.com', reason: 'missing @' },
      { input: '@example.com', reason: 'missing local part' },
      { input: 'user@', reason: 'missing domain' },
      { input: 'user@@example.com', reason: 'double @' },
      { input: 'user..name@example.com', reason: 'consecutive dots in local' },
      { input: 'user@example..com', reason: 'consecutive dots in domain' },
      { input: 'user@example', reason: 'missing TLD' },
      { input: 'user@example.c', reason: 'TLD too short (1 char)' },
      { input: 'user name@example.com', reason: 'space in local part' },
      { input: 'user@exam ple.com', reason: 'space in domain' },
      { input: '', reason: 'empty string' },
      { input: '   ', reason: 'whitespace only' },
    ];

    invalidCases.forEach(({ input, reason }) => {
      it(`should reject: "${input}" (${reason})`, function () {
        const result = validateEmailFull(input);
        expect(result.isValid).to.be.false;
        expect(result.reason).to.exist;
      });
    });
  });

  describe('consecutive dots detection', function () {
    it('should reject email with consecutive dots in local part', function () {
      const result = validateEmailFull('user..name@example.com');
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('consecutive dots');
    });

    it('should reject email with consecutive dots in domain', function () {
      const result = validateEmailFull('user@example..com');
      expect(result.isValid).to.be.false;
    });

    it('should accept single dots', function () {
      const result = validateEmailFull('user.name@example.com');
      expect(result.isValid).to.be.true;
    });
  });

  describe('TLD validation', function () {
    it('should reject TLD with only 1 character', function () {
      const result = validateEmailFull('user@example.c');
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('TLD');
    });

    it('should accept 2-character TLD', function () {
      const result = validateEmailFull('user@example.ch');
      expect(result.isValid).to.be.true;
    });

    it('should accept long TLDs', function () {
      const result = validateEmailFull('user@example.photography');
      expect(result.isValid).to.be.true;
    });
  });

  describe('edge cases', function () {
    it('should handle empty input', function () {
      const result = validateEmailFull('');
      expect(result.isValid).to.be.false;
    });

    it('should be case insensitive', function () {
      const lower = validateEmailFull('user@example.com');
      const upper = validateEmailFull('USER@EXAMPLE.COM');
      const mixed = validateEmailFull('User@Example.COM');

      expect(lower.isValid).to.be.true;
      expect(upper.isValid).to.be.true;
      expect(mixed.isValid).to.be.true;
    });

    it('should handle very long valid email', function () {
      const longLocal = 'a'.repeat(64);
      const email = `${longLocal}@example.com`;
      const result = validateEmailFull(email);
      // Valid as long as under MAX_LENGTH
      if (email.length <= 254) {
        expect(result.isValid).to.be.true;
      }
    });

    it('should reject very long inputs (ReDoS protection)', function () {
      const longInput = 'a'.repeat(300) + '@example.com';
      const result = validateEmailFull(longInput);
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('maximum length');
    });

    it('should handle unicode in local part', function () {
      // RFC 6531 allows unicode, but our validator uses simplified pattern
      const result = validateEmailFull('üser@example.com');
      // May or may not be valid depending on implementation
      expect(typeof result.isValid).to.equal('boolean');
    });

    it('should handle IDN domains', function () {
      // Internationalized domain names
      const result = validateEmailFull('user@例え.jp');
      // May not be supported by simplified pattern
      expect(typeof result.isValid).to.equal('boolean');
    });

    it('should handle email with IP address domain', function () {
      // RFC allows IP addresses but our validator may not
      const result = validateEmailFull('user@[192.168.1.1]');
      expect(typeof result.isValid).to.equal('boolean');
    });
  });

  describe('RFC 5322 special characters', function () {
    it('should accept + in local part', function () {
      const result = validateEmailFull('user+tag@example.com');
      expect(result.isValid).to.be.true;
    });

    it('should accept ! in local part', function () {
      const result = validateEmailFull('user!name@example.com');
      expect(result.isValid).to.be.true;
    });

    it('should accept # in local part', function () {
      const result = validateEmailFull('user#name@example.com');
      expect(result.isValid).to.be.true;
    });

    it('should accept $ in local part', function () {
      const result = validateEmailFull('user$name@example.com');
      expect(result.isValid).to.be.true;
    });

    it('should accept % in local part', function () {
      const result = validateEmailFull('user%name@example.com');
      expect(result.isValid).to.be.true;
    });

    it('should accept - in domain part', function () {
      const result = validateEmailFull('user@ex-ample.com');
      expect(result.isValid).to.be.true;
    });
  });

  describe('class interface', function () {
    it('should implement ValidationRule interface', function () {
      const validator = new EmailValidator();
      expect(validator.entityType).to.equal('EMAIL');
      expect(validator.name).to.equal('EmailValidator');
      expect(validator.validate).to.be.a('function');
    });

    it('should have MAX_LENGTH constant', function () {
      expect(EmailValidator.MAX_LENGTH).to.equal(254);
    });

    it('should validate via class instance', function () {
      const validator = new EmailValidator();
      const result = validator.validate({ text: 'test@example.com' });
      expect(result.isValid).to.be.true;
    });
  });

  describe('standalone functions', function () {
    it('validateEmail should return boolean', function () {
      expect(validateEmail('test@example.com')).to.be.true;
      expect(validateEmail('invalid')).to.be.false;
    });

    it('validateEmailFull should return result object', function () {
      const result = validateEmailFull('test@example.com');
      expect(result).to.have.property('isValid');
      expect(result).to.have.property('confidence');
    });
  });
});
