/**
 * Swiss AVS Validator Tests
 *
 * Tests for Story 11.6: Validator Test Coverage
 *
 * Validates Swiss AVS/AHV social security numbers.
 * Format: 756.XXXX.XXXX.XX (13 digits)
 * Checksum: EAN-13 mod 10
 *
 * @module test/unit/pii/validators/SwissAvsValidator.test
 */

import { expect } from 'chai';
import { describe, it, before } from 'mocha';

describe('SwissAvsValidator', function () {
  this.timeout(10000);

  let SwissAvsValidator;
  let validateSwissAvs;
  let validateSwissAvsFull;

  before(async function () {
    const module = await import('../../../../shared/dist/pii/validators/SwissAvsValidator.js');
    SwissAvsValidator = module.SwissAvsValidator;
    validateSwissAvs = module.validateSwissAvs;
    validateSwissAvsFull = module.validateSwissAvsFull;
  });

  describe('valid inputs', function () {
    const validCases = [
      { input: '7561234567897', description: 'continuous digits' },
      { input: '756.1234.5678.97', description: 'with dots' },
      { input: '756 1234 5678 97', description: 'with spaces' },
      { input: '756-1234-5678-97', description: 'with dashes' },
    ];

    validCases.forEach(({ input, description }) => {
      it(`should validate ${description}: ${input}`, function () {
        // Calculate valid checksum for 756123456789X
        // EAN-13: positions 1,3,5,7,9,11 × 1, positions 2,4,6,8,10,12 × 3
        // 7×1 + 5×3 + 6×1 + 1×3 + 2×1 + 3×3 + 4×1 + 5×3 + 6×1 + 7×3 + 8×1 + 9×3
        // = 7 + 15 + 6 + 3 + 2 + 9 + 4 + 15 + 6 + 21 + 8 + 27 = 123
        // Checksum = (10 - (123 mod 10)) mod 10 = (10 - 3) mod 10 = 7
        const result = validateSwissAvsFull(input);
        expect(result.isValid).to.be.true;
        expect(result.confidence).to.be.at.least(0.9);
      });
    });

    it('should validate a known valid AVS number', function () {
      // 756.1234.5678.97 - valid checksum
      const result = validateSwissAvsFull('756.1234.5678.97');
      expect(result.isValid).to.be.true;
    });
  });

  describe('invalid inputs', function () {
    const invalidCases = [
      { input: '756.1234.5678.98', reason: 'wrong checksum' },
      { input: '756.1234.5678.00', reason: 'wrong checksum' },
      { input: '757.1234.5678.97', reason: 'wrong country prefix' },
      { input: '123.4567.8901.23', reason: 'not starting with 756' },
      { input: '756.123.456.78', reason: 'wrong length (10 digits)' },
      { input: '756.12345.67890.12', reason: 'too many digits (14)' },
      { input: '756.1234', reason: 'too few digits' },
    ];

    invalidCases.forEach(({ input, reason }) => {
      it(`should reject: ${input} (${reason})`, function () {
        const result = validateSwissAvsFull(input);
        expect(result.isValid).to.be.false;
        expect(result.reason).to.exist;
      });
    });
  });

  describe('checksum validation (EAN-13)', function () {
    it('should detect invalid checksum digit', function () {
      // Valid: 756.1234.5678.97, change last digit
      const result = validateSwissAvsFull('756.1234.5678.98');
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('Checksum');
    });

    it('should calculate EAN-13 checksum correctly', function () {
      // Test with known valid AVS
      // For 756123456789X, the checksum is 7
      const result = validateSwissAvsFull('7561234567897');
      expect(result.isValid).to.be.true;
    });

    it('should reject when checksum is off by one', function () {
      // 756.1234.5678.96 - checksum should be 7, not 6
      const result = validateSwissAvsFull('756.1234.5678.96');
      expect(result.isValid).to.be.false;
    });
  });

  describe('format validation', function () {
    it('should reject numbers not starting with 756', function () {
      const result = validateSwissAvsFull('757.1234.5678.97');
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('756');
    });

    it('should reject wrong digit count', function () {
      const result = validateSwissAvsFull('756.12345.6789.012');
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('length');
    });

    it('should accept any separator pattern', function () {
      // All these represent the same AVS
      const variants = [
        '7561234567897',
        '756.1234.5678.97',
        '756-1234-5678-97',
        '756 1234 5678 97',
        '756.12.34.56.78.97',
      ];

      for (const variant of variants) {
        const result = validateSwissAvsFull(variant);
        expect(result.isValid).to.be.true;
      }
    });
  });

  describe('edge cases', function () {
    it('should handle empty input', function () {
      const result = validateSwissAvsFull('');
      expect(result.isValid).to.be.false;
    });

    it('should handle whitespace only', function () {
      const result = validateSwissAvsFull('   ');
      expect(result.isValid).to.be.false;
    });

    it('should handle unicode characters', function () {
      const result = validateSwissAvsFull('756.①②③④.⑤⑥⑦⑧.⑨⑦');
      expect(result.isValid).to.be.false;
    });

    it('should handle letters mixed with digits', function () {
      const result = validateSwissAvsFull('756.1234.5678.AB');
      expect(result.isValid).to.be.false;
    });

    it('should reject very long inputs (ReDoS protection)', function () {
      const longInput = '756.' + '1'.repeat(100);
      const result = validateSwissAvsFull(longInput);
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('maximum length');
    });
  });

  describe('class interface', function () {
    it('should implement ValidationRule interface', function () {
      const validator = new SwissAvsValidator();
      expect(validator.entityType).to.equal('SWISS_AVS');
      expect(validator.name).to.equal('SwissAvsValidator');
      expect(validator.validate).to.be.a('function');
    });

    it('should have MAX_LENGTH constant', function () {
      expect(SwissAvsValidator.MAX_LENGTH).to.equal(20);
    });
  });

  describe('standalone function', function () {
    it('validateSwissAvs should return boolean', function () {
      expect(validateSwissAvs('756.1234.5678.97')).to.be.true;
      expect(validateSwissAvs('756.1234.5678.98')).to.be.false;
    });
  });
});
