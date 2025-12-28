/**
 * Validator Map Lookup Tests
 *
 * Tests for Story 11.7: Implement O(1) Validator Lookup
 *
 * Verifies that:
 * 1. getValidatorForType() uses Map-based O(1) lookup
 * 2. Returns correct validator for each entity type
 * 3. Returns undefined for unknown types
 * 4. Lazy initialization works correctly
 * 5. Same instance is returned on multiple calls (singleton behavior)
 * 6. Performance is O(1) (100k lookups in <100ms)
 *
 * @module test/unit/pii/validators/ValidatorMapLookup.test
 */

import { expect } from 'chai';
import { describe, it, before, afterEach } from 'mocha';

describe('Validator Map Lookup (Story 11.7)', function () {
  this.timeout(10000);

  // Functions to test
  let getValidatorForType;
  let getAllValidators;
  let _resetValidatorsCache;
  let _resetValidatorMap;

  before(async function () {
    const validatorsModule = await import(
      '../../../../shared/dist/pii/validators/index.js'
    );
    getValidatorForType = validatorsModule.getValidatorForType;
    getAllValidators = validatorsModule.getAllValidators;
    _resetValidatorsCache = validatorsModule._resetValidatorsCache;
    _resetValidatorMap = validatorsModule._resetValidatorMap;
  });

  afterEach(function () {
    // Reset caches after each test for isolation
    _resetValidatorsCache();
  });

  describe('Correct Validator Lookup', function () {
    it('should return correct validator for SWISS_ADDRESS type', function () {
      const validator = getValidatorForType('SWISS_ADDRESS');
      expect(validator).to.exist;
      expect(validator.entityType).to.equal('SWISS_ADDRESS');
      // Story 11.9 resolved the entityType collision - SwissPostalCodeValidator is now
      // excluded from the registry, so SwissAddressValidator is correctly returned.
      expect(validator.name).to.equal('SwissAddressValidator');
    });

    it('should return correct validator for SWISS_AVS type', function () {
      const validator = getValidatorForType('SWISS_AVS');
      expect(validator).to.exist;
      expect(validator.entityType).to.equal('SWISS_AVS');
      expect(validator.name).to.equal('SwissAvsValidator');
    });

    it('should return correct validator for IBAN type', function () {
      const validator = getValidatorForType('IBAN');
      expect(validator).to.exist;
      expect(validator.entityType).to.equal('IBAN');
      expect(validator.name).to.equal('IbanValidator');
    });

    it('should return correct validator for EMAIL type', function () {
      const validator = getValidatorForType('EMAIL');
      expect(validator).to.exist;
      expect(validator.entityType).to.equal('EMAIL');
      expect(validator.name).to.equal('EmailValidator');
    });

    it('should return correct validator for PHONE type', function () {
      const validator = getValidatorForType('PHONE');
      expect(validator).to.exist;
      expect(validator.entityType).to.equal('PHONE');
      expect(validator.name).to.equal('PhoneValidator');
    });

    it('should return correct validator for DATE type', function () {
      const validator = getValidatorForType('DATE');
      expect(validator).to.exist;
      expect(validator.entityType).to.equal('DATE');
      expect(validator.name).to.equal('DateValidator');
    });

    it('should return correct validator for VAT_NUMBER type', function () {
      const validator = getValidatorForType('VAT_NUMBER');
      expect(validator).to.exist;
      expect(validator.entityType).to.equal('VAT_NUMBER');
      expect(validator.name).to.equal('VatNumberValidator');
    });

    it('should return correct validator for all known types', function () {
      const types = [
        'SWISS_ADDRESS',
        'SWISS_AVS',
        'IBAN',
        'EMAIL',
        'PHONE',
        'DATE',
        'VAT_NUMBER',
      ];

      types.forEach((type) => {
        const validator = getValidatorForType(type);
        expect(validator, `Validator for ${type}`).to.exist;
        expect(validator.entityType, `Entity type for ${type}`).to.equal(type);
      });
    });
  });

  describe('Unknown Type Handling', function () {
    it('should return undefined for unknown type', function () {
      const validator = getValidatorForType('UNKNOWN_TYPE');
      expect(validator).to.be.undefined;
    });

    it('should return undefined for empty string', function () {
      const validator = getValidatorForType('');
      expect(validator).to.be.undefined;
    });

    it('should return undefined for null-like values', function () {
      const validator = getValidatorForType(null);
      expect(validator).to.be.undefined;
    });
  });

  describe('Singleton Behavior', function () {
    it('should return same instance on multiple calls', function () {
      const first = getValidatorForType('EMAIL');
      const second = getValidatorForType('EMAIL');
      expect(first).to.equal(second);
    });

    it('should return same instances as getAllValidators()', function () {
      const allValidators = getAllValidators();
      const emailValidator = getValidatorForType('EMAIL');
      const ibanValidator = getValidatorForType('IBAN');

      const emailFromAll = allValidators.find((v) => v.entityType === 'EMAIL');
      const ibanFromAll = allValidators.find((v) => v.entityType === 'IBAN');

      expect(emailValidator).to.equal(emailFromAll);
      expect(ibanValidator).to.equal(ibanFromAll);
    });
  });

  describe('Lazy Initialization', function () {
    it('should initialize map on first getValidatorForType call', function () {
      // Reset to ensure fresh state
      _resetValidatorsCache();

      // First call should initialize the map
      const validator = getValidatorForType('EMAIL');
      expect(validator).to.exist;

      // Subsequent calls should use cached map
      const validator2 = getValidatorForType('PHONE');
      expect(validator2).to.exist;
    });

    it('should work after map-only reset', function () {
      // Initialize map
      getValidatorForType('EMAIL');

      // Reset only the map (not validators cache)
      _resetValidatorMap();

      // Should still work - map will be rebuilt
      const validator = getValidatorForType('IBAN');
      expect(validator).to.exist;
      expect(validator.entityType).to.equal('IBAN');
    });
  });

  describe('Performance - O(1) Lookup', function () {
    it('should complete 100k lookups in under 100ms', function () {
      const types = ['EMAIL', 'PHONE', 'IBAN', 'SWISS_AVS', 'DATE', 'VAT_NUMBER', 'SWISS_ADDRESS'];

      // Warm up cache
      types.forEach((t) => getValidatorForType(t));

      const iterations = 100000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        getValidatorForType(types[i % types.length]);
      }

      const elapsed = Date.now() - start;

      // Should complete in < 100ms for 100k lookups (O(1) complexity)
      expect(elapsed).to.be.lessThan(100);
    });

    it('should complete 1 million lookups in under 500ms', function () {
      const types = ['EMAIL', 'PHONE', 'IBAN', 'SWISS_AVS'];

      // Warm up cache
      types.forEach((t) => getValidatorForType(t));

      const iterations = 1000000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        getValidatorForType(types[i % types.length]);
      }

      const elapsed = Date.now() - start;

      // Should complete in < 500ms for 1M lookups
      expect(elapsed).to.be.lessThan(500);
    });
  });

  describe('Cache Reset Functions', function () {
    it('_resetValidatorsCache should reset both caches', function () {
      // Initialize both caches
      getAllValidators();
      getValidatorForType('EMAIL');

      // Reset all
      _resetValidatorsCache();

      // Both should reinitialize
      const validator = getValidatorForType('EMAIL');
      expect(validator).to.exist;
    });

    it('_resetValidatorMap should only reset array cache, registry remains intact', function () {
      // Initialize cache
      const validators1 = getAllValidators();
      const email1 = getValidatorForType('EMAIL');

      // Reset only array cache (not registry)
      _resetValidatorMap();

      // Registry validators should be same instances
      const validators2 = getAllValidators();
      const email2 = getValidatorForType('EMAIL');

      // Array is rebuilt but underlying validators are same instances from registry
      expect(validators2).to.have.lengthOf(validators1.length);
      expect(email1).to.equal(email2); // Same validator instance from registry

      // Map should be rebuilt from same validators
      const validator = getValidatorForType('EMAIL');
      expect(validator).to.exist;
    });
  });
});
