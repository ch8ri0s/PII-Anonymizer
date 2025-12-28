/**
 * Validator Singleton Pattern Tests
 *
 * Tests for Story 11.3: Implement Singleton Pattern for Validators
 *
 * @module test/unit/pii/validators/ValidatorSingleton.test
 */

import { expect } from 'chai';
import {
  getAllValidators,
  getValidatorForType,
  _resetValidatorsCache,
} from '../../../../dist/pii/validators/index.js';

describe('Validator Singleton Pattern (Story 11.3)', () => {
  beforeEach(() => {
    // Reset cache before each test for isolation
    _resetValidatorsCache();
  });

  afterEach(() => {
    // Clean up after each test
    _resetValidatorsCache();
  });

  describe('getAllValidators', () => {
    it('should return same array instance on multiple calls', () => {
      const first = getAllValidators();
      const second = getAllValidators();
      const third = getAllValidators();

      expect(first).to.equal(second); // Same reference
      expect(second).to.equal(third); // Same reference
    });

    it('should return frozen array', () => {
      const validators = getAllValidators();
      expect(Object.isFrozen(validators)).to.be.true;
    });

    it('should prevent array modifications', () => {
      const validators = getAllValidators();

      // Attempting to modify should throw in strict mode or fail silently
      expect(() => {
        validators.push({});
      }).to.throw();
    });

    it('should contain all 7 registered validator types', () => {
      // Note: SwissPostalCodeValidator is intentionally NOT in the registry
      // (Story 11.9) - it shares entityType 'SWISS_ADDRESS' with SwissAddressValidator
      const validators = getAllValidators();
      expect(validators).to.have.lengthOf(7);

      const types = validators.map((v) => v.entityType);
      expect(types).to.include('SWISS_ADDRESS');
      expect(types).to.include('SWISS_AVS');
      expect(types).to.include('IBAN');
      expect(types).to.include('EMAIL');
      expect(types).to.include('PHONE');
      expect(types).to.include('DATE');
      expect(types).to.include('VAT_NUMBER');
    });

    it('should NOT include SwissPostalCodeValidator in registry (Story 11.9)', () => {
      // SwissPostalCodeValidator is @internal and excluded from registry
      // to avoid entityType collision with SwissAddressValidator
      const validators = getAllValidators();
      const names = validators.map((v) => v.name);
      expect(names).to.not.include('SwissPostalCodeValidator');
    });

    it('should have unique validator names', () => {
      const validators = getAllValidators();
      const names = validators.map((v) => v.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).to.equal(validators.length);
    });

    it('should return validators with validate method', () => {
      const validators = getAllValidators();
      for (const validator of validators) {
        expect(validator.validate).to.be.a('function');
        expect(validator.name).to.be.a('string');
        expect(validator.entityType).to.be.a('string');
      }
    });
  });

  describe('_resetValidatorsCache', () => {
    it('should reset cache when called', () => {
      const first = getAllValidators();
      _resetValidatorsCache();
      const second = getAllValidators();

      expect(first).to.not.equal(second); // Different reference after reset
    });

    it('should allow multiple reset cycles', () => {
      const first = getAllValidators();
      _resetValidatorsCache();

      const second = getAllValidators();
      _resetValidatorsCache();

      const third = getAllValidators();

      expect(first).to.not.equal(second);
      expect(second).to.not.equal(third);
      expect(first).to.not.equal(third);
    });
  });

  describe('getValidatorForType', () => {
    it('should return correct validator for each type', () => {
      const types = [
        'SWISS_ADDRESS',
        'SWISS_AVS',
        'IBAN',
        'EMAIL',
        'PHONE',
        'DATE',
        'VAT_NUMBER',
      ];

      for (const type of types) {
        const validator = getValidatorForType(type);
        expect(validator).to.exist;
        expect(validator.entityType).to.equal(type);
      }
    });

    it('should return undefined for unknown type', () => {
      const validator = getValidatorForType('UNKNOWN_TYPE');
      expect(validator).to.be.undefined;
    });

    it('should use cached validators', () => {
      // First call populates cache
      const first = getValidatorForType('EMAIL');

      // Get all validators to verify cache
      const validators = getAllValidators();

      // Find the EMAIL validator in cached array
      const cachedEmail = validators.find((v) => v.entityType === 'EMAIL');

      // Should be the same instance
      expect(first).to.equal(cachedEmail);
    });
  });

  describe('Memory efficiency', () => {
    it('should not increase memory on repeated calls', function () {
      // Skip in environments without process.memoryUsage
      if (typeof process === 'undefined' || !process.memoryUsage) {
        this.skip();
        return;
      }

      _resetValidatorsCache();

      // Warm up and force GC if available
      getAllValidators();
      if (global.gc) global.gc();

      const initial = process.memoryUsage().heapUsed;

      // Make 10,000 calls
      for (let i = 0; i < 10000; i++) {
        getAllValidators();
      }

      if (global.gc) global.gc();
      const final = process.memoryUsage().heapUsed;
      const increase = final - initial;

      // Allow small variance, but no significant increase
      // With singleton, heap should not grow significantly
      expect(increase).to.be.lessThan(100000); // < 100KB
    });

    it('should maintain same instance across many calls', () => {
      const instances = new Set();

      for (let i = 0; i < 1000; i++) {
        instances.add(getAllValidators());
      }

      // Should only have 1 unique array instance
      expect(instances.size).to.equal(1);
    });
  });

  describe('Backward compatibility', () => {
    it('should work with existing validate calls', () => {
      const validators = getAllValidators();
      const emailValidator = validators.find((v) => v.entityType === 'EMAIL');

      // Should be able to validate entities
      const result = emailValidator.validate({ text: 'test@example.com' });
      expect(result).to.have.property('isValid');
      expect(result).to.have.property('confidence');
      expect(result.isValid).to.be.true;
    });

    it('should work with getValidatorForType', () => {
      const ibanValidator = getValidatorForType('IBAN');
      expect(ibanValidator).to.exist;

      // Valid Swiss IBAN
      const result = ibanValidator.validate({
        text: 'CH93 0076 2011 6238 5295 7',
      });
      expect(result).to.have.property('isValid');
    });
  });
});
