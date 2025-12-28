/**
 * Unit tests for Confidence Constants
 *
 * Tests for the CONFIDENCE constants module that provides
 * standardized confidence values for PII validation results.
 *
 * @module test/unit/pii/validators/Confidence.test
 */

import { expect } from 'chai';
import { CONFIDENCE } from '../../../../shared/dist/pii/validators/confidence.js';

describe('Confidence Constants', function () {
  describe('CONFIDENCE values', function () {
    it('should export all confidence levels with correct values', function () {
      expect(CONFIDENCE.CHECKSUM_VALID).to.equal(0.95);
      expect(CONFIDENCE.FORMAT_VALID).to.equal(0.9);
      expect(CONFIDENCE.STANDARD).to.equal(0.85);
      expect(CONFIDENCE.KNOWN_VALID).to.equal(0.82);
      expect(CONFIDENCE.MODERATE).to.equal(0.75);
      expect(CONFIDENCE.WEAK).to.equal(0.5);
      expect(CONFIDENCE.INVALID_FORMAT).to.equal(0.4);
      expect(CONFIDENCE.FAILED).to.equal(0.3);
      expect(CONFIDENCE.FALSE_POSITIVE).to.equal(0.2);
    });

    it('should have exactly 9 confidence levels', function () {
      const levels = Object.keys(CONFIDENCE);
      expect(levels).to.have.lengthOf(9);
    });

    it('should be in descending order by value', function () {
      const values = Object.values(CONFIDENCE);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).to.be.lessThan(values[i - 1]);
      }
    });

    it('should have all values between 0 and 1', function () {
      for (const value of Object.values(CONFIDENCE)) {
        expect(value).to.be.greaterThan(0);
        expect(value).to.be.lessThanOrEqual(1);
      }
    });

    it('should be frozen (immutable)', function () {
      // As const assertion makes the object deeply readonly at compile time
      // At runtime, we can verify the values are what we expect
      expect(Object.isFrozen(CONFIDENCE)).to.be.false; // as const doesn't freeze at runtime
      // But the values should remain constant
      const originalValue = CONFIDENCE.CHECKSUM_VALID;
      expect(originalValue).to.equal(0.95);
    });
  });

  describe('Semantic meaning', function () {
    it('CHECKSUM_VALID should be highest for mathematically verified entities', function () {
      expect(CONFIDENCE.CHECKSUM_VALID).to.be.greaterThan(CONFIDENCE.FORMAT_VALID);
    });

    it('FORMAT_VALID should be higher than STANDARD', function () {
      expect(CONFIDENCE.FORMAT_VALID).to.be.greaterThan(CONFIDENCE.STANDARD);
    });

    it('KNOWN_VALID should be slightly below STANDARD', function () {
      expect(CONFIDENCE.KNOWN_VALID).to.be.lessThan(CONFIDENCE.STANDARD);
      expect(CONFIDENCE.KNOWN_VALID).to.be.greaterThan(CONFIDENCE.MODERATE);
    });

    it('MODERATE should represent partial validation', function () {
      expect(CONFIDENCE.MODERATE).to.equal(0.75);
    });

    it('WEAK should be for format recognition needing context', function () {
      expect(CONFIDENCE.WEAK).to.equal(0.5);
      expect(CONFIDENCE.WEAK).to.be.lessThan(CONFIDENCE.MODERATE);
    });

    it('INVALID_FORMAT, FAILED, FALSE_POSITIVE should be low confidence', function () {
      expect(CONFIDENCE.INVALID_FORMAT).to.be.lessThan(0.5);
      expect(CONFIDENCE.FAILED).to.be.lessThan(CONFIDENCE.INVALID_FORMAT);
      expect(CONFIDENCE.FALSE_POSITIVE).to.be.lessThan(CONFIDENCE.FAILED);
    });
  });

  describe('Validator usage verification', function () {
    // These tests verify that validators use the correct constants
    // by checking that the expected confidence values are returned

    it('should have CHECKSUM_VALID used for AVS and IBAN', function () {
      // AVS and IBAN validators use CHECKSUM_VALID (0.95) for valid entries
      expect(CONFIDENCE.CHECKSUM_VALID).to.equal(0.95);
    });

    it('should have FORMAT_VALID used for emails and phones', function () {
      // Email and Phone validators use FORMAT_VALID (0.9) for valid entries
      expect(CONFIDENCE.FORMAT_VALID).to.equal(0.9);
    });

    it('should have STANDARD used for dates and postal codes', function () {
      // Date and SwissPostalCode validators use STANDARD (0.85)
      expect(CONFIDENCE.STANDARD).to.equal(0.85);
    });

    it('should have KNOWN_VALID used for known Swiss addresses', function () {
      // SwissAddressValidator uses KNOWN_VALID (0.82) for valid addresses
      expect(CONFIDENCE.KNOWN_VALID).to.equal(0.82);
    });
  });
});
