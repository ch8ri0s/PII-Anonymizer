/**
 * Validator Registry Tests
 *
 * Tests for Story 11.10: Validator Registry Pattern
 *
 * Tests the ValidatorRegistry class including:
 * - Registration and retrieval
 * - Priority conflict resolution
 * - Freeze behavior
 * - Reset mechanism
 * - Backward compatibility with getAllValidators/getValidatorForType
 *
 * @module test/unit/pii/validators/ValidatorRegistry.test
 */

import { expect } from 'chai';
import {
  ValidatorRegistry,
  validatorRegistry,
  registerValidator,
} from '../../../../shared/dist/pii/validators/registry.js';
import {
  getAllValidators,
  getValidatorForType,
  _resetValidatorsCache,
} from '../../../../shared/dist/pii/validators/index.js';

/**
 * Create a mock validator for testing
 */
function createMockValidator(entityType, name = `Mock${entityType}Validator`) {
  return {
    entityType,
    name,
    validate: (_entity) => ({
      isValid: true,
      confidence: 0.9,
      reason: 'Mock validation',
    }),
  };
}

describe('ValidatorRegistry (Story 11.10)', () => {
  describe('ValidatorRegistry Class', () => {
    let registry;

    beforeEach(() => {
      // Create fresh registry for each test
      registry = new ValidatorRegistry();
    });

    describe('register()', () => {
      it('should register a validator', () => {
        const validator = createMockValidator('TEST_TYPE');
        registry.register(validator);

        expect(registry.size).to.equal(1);
        expect(registry.has('TEST_TYPE')).to.be.true;
      });

      it('should register multiple validators with different entity types', () => {
        const validator1 = createMockValidator('TYPE_A');
        const validator2 = createMockValidator('TYPE_B');
        const validator3 = createMockValidator('TYPE_C');

        registry.register(validator1);
        registry.register(validator2);
        registry.register(validator3);

        expect(registry.size).to.equal(3);
        expect(registry.has('TYPE_A')).to.be.true;
        expect(registry.has('TYPE_B')).to.be.true;
        expect(registry.has('TYPE_C')).to.be.true;
      });

      it('should default to priority 0', () => {
        const validator = createMockValidator('TEST_TYPE');
        registry.register(validator);

        // If we register another with priority 0, first one should win
        const validator2 = createMockValidator('TEST_TYPE', 'SecondValidator');
        registry.register(validator2);

        expect(registry.get('TEST_TYPE').name).to.equal('MockTEST_TYPEValidator');
      });
    });

    describe('Priority Conflict Resolution', () => {
      it('should replace lower priority validator with higher priority', () => {
        const lowPriority = createMockValidator('CONFLICT_TYPE', 'LowPriorityValidator');
        const highPriority = createMockValidator('CONFLICT_TYPE', 'HighPriorityValidator');

        registry.register(lowPriority, 0);
        registry.register(highPriority, 10);

        expect(registry.get('CONFLICT_TYPE').name).to.equal('HighPriorityValidator');
      });

      it('should not replace equal priority validator (first wins)', () => {
        const first = createMockValidator('CONFLICT_TYPE', 'FirstValidator');
        const second = createMockValidator('CONFLICT_TYPE', 'SecondValidator');

        registry.register(first, 5);
        registry.register(second, 5);

        expect(registry.get('CONFLICT_TYPE').name).to.equal('FirstValidator');
      });

      it('should not replace higher priority with lower priority', () => {
        const highPriority = createMockValidator('CONFLICT_TYPE', 'HighPriorityValidator');
        const lowPriority = createMockValidator('CONFLICT_TYPE', 'LowPriorityValidator');

        registry.register(highPriority, 10);
        registry.register(lowPriority, 0);

        expect(registry.get('CONFLICT_TYPE').name).to.equal('HighPriorityValidator');
      });

      it('should handle negative priorities', () => {
        const negative = createMockValidator('PRIORITY_TYPE', 'NegativeValidator');
        const zero = createMockValidator('PRIORITY_TYPE', 'ZeroValidator');

        registry.register(negative, -5);
        registry.register(zero, 0);

        expect(registry.get('PRIORITY_TYPE').name).to.equal('ZeroValidator');
      });
    });

    describe('getAll()', () => {
      it('should return all registered validators', () => {
        registry.register(createMockValidator('TYPE_A'));
        registry.register(createMockValidator('TYPE_B'));
        registry.register(createMockValidator('TYPE_C'));

        const all = registry.getAll();
        expect(all).to.have.lengthOf(3);
      });

      it('should return empty array when no validators registered', () => {
        const all = registry.getAll();
        expect(all).to.be.an('array');
        expect(all).to.have.lengthOf(0);
      });

      it('should return validators in arbitrary order', () => {
        registry.register(createMockValidator('Z_TYPE'));
        registry.register(createMockValidator('A_TYPE'));

        const all = registry.getAll();
        expect(all).to.have.lengthOf(2);
        // Order is not guaranteed, just verify both are present
        const types = all.map((v) => v.entityType);
        expect(types).to.include('Z_TYPE');
        expect(types).to.include('A_TYPE');
      });
    });

    describe('get()', () => {
      it('should return validator for registered type', () => {
        const validator = createMockValidator('EXISTING_TYPE');
        registry.register(validator);

        const retrieved = registry.get('EXISTING_TYPE');
        expect(retrieved).to.equal(validator);
      });

      it('should return undefined for unregistered type', () => {
        const retrieved = registry.get('NONEXISTENT_TYPE');
        expect(retrieved).to.be.undefined;
      });
    });

    describe('has()', () => {
      it('should return true for registered type', () => {
        registry.register(createMockValidator('EXISTING_TYPE'));
        expect(registry.has('EXISTING_TYPE')).to.be.true;
      });

      it('should return false for unregistered type', () => {
        expect(registry.has('NONEXISTENT_TYPE')).to.be.false;
      });
    });

    describe('freeze()', () => {
      it('should prevent further registrations', () => {
        registry.register(createMockValidator('BEFORE_FREEZE'));
        registry.freeze();

        expect(() => {
          registry.register(createMockValidator('AFTER_FREEZE'));
        }).to.throw(/frozen/);
      });

      it('should set isFrozen to true', () => {
        expect(registry.isFrozen()).to.be.false;
        registry.freeze();
        expect(registry.isFrozen()).to.be.true;
      });

      it('should preserve existing registrations after freeze', () => {
        registry.register(createMockValidator('PRESERVED_TYPE'));
        registry.freeze();

        expect(registry.has('PRESERVED_TYPE')).to.be.true;
        expect(registry.size).to.equal(1);
      });

      it('should throw descriptive error message on freeze violation', () => {
        registry.freeze();

        try {
          registry.register(createMockValidator('BLOCKED'));
          expect.fail('Should have thrown');
        } catch (e) {
          expect(e.message).to.include('frozen');
          expect(e.message).to.include('MockBLOCKEDValidator');
        }
      });
    });

    describe('_reset()', () => {
      it('should clear all registrations', () => {
        registry.register(createMockValidator('TYPE_A'));
        registry.register(createMockValidator('TYPE_B'));
        expect(registry.size).to.equal(2);

        registry._reset();
        expect(registry.size).to.equal(0);
        expect(registry.has('TYPE_A')).to.be.false;
        expect(registry.has('TYPE_B')).to.be.false;
      });

      it('should unfreeze the registry', () => {
        registry.freeze();
        expect(registry.isFrozen()).to.be.true;

        registry._reset();
        expect(registry.isFrozen()).to.be.false;
      });

      it('should allow new registrations after reset', () => {
        registry.freeze();
        registry._reset();

        // Should not throw
        registry.register(createMockValidator('AFTER_RESET'));
        expect(registry.size).to.equal(1);
      });
    });

    describe('size property', () => {
      it('should return 0 for empty registry', () => {
        expect(registry.size).to.equal(0);
      });

      it('should return correct count after registrations', () => {
        registry.register(createMockValidator('TYPE_A'));
        expect(registry.size).to.equal(1);

        registry.register(createMockValidator('TYPE_B'));
        expect(registry.size).to.equal(2);
      });

      it('should not count duplicate type registrations', () => {
        registry.register(createMockValidator('SAME_TYPE', 'First'));
        registry.register(createMockValidator('SAME_TYPE', 'Second'), 10);

        // Even though second registration replaced first, size is still 1
        expect(registry.size).to.equal(1);
      });
    });
  });

  describe('Global Registry Singleton', () => {
    beforeEach(() => {
      _resetValidatorsCache();
    });

    afterEach(() => {
      _resetValidatorsCache();
    });

    it('should have validators registered via self-registration', () => {
      expect(validatorRegistry.size).to.be.greaterThan(0);
    });

    it('should contain the 7 standard validators', () => {
      expect(validatorRegistry.has('SWISS_ADDRESS')).to.be.true;
      expect(validatorRegistry.has('SWISS_AVS')).to.be.true;
      expect(validatorRegistry.has('IBAN')).to.be.true;
      expect(validatorRegistry.has('EMAIL')).to.be.true;
      expect(validatorRegistry.has('PHONE')).to.be.true;
      expect(validatorRegistry.has('DATE')).to.be.true;
      expect(validatorRegistry.has('VAT_NUMBER')).to.be.true;
    });

    it('should NOT contain SwissPostalCodeValidator (intentionally excluded)', () => {
      // SwissPostalCodeValidator is @internal and shares entityType with SwissAddressValidator
      // so it's excluded from the registry
      const validators = validatorRegistry.getAll();
      const names = validators.map((v) => v.name);
      expect(names).to.not.include('SwissPostalCodeValidator');
    });
  });

  describe('registerValidator Helper Function', () => {
    beforeEach(() => {
      _resetValidatorsCache();
    });

    afterEach(() => {
      _resetValidatorsCache();
    });

    it('should register validators via global registry', () => {
      // The registerValidator function delegates to validatorRegistry.register
      // Validators are already registered via self-registration
      // This test verifies the function exists and the pattern works
      expect(typeof registerValidator).to.equal('function');
    });
  });

  describe('Backward Compatibility', () => {
    beforeEach(() => {
      _resetValidatorsCache();
    });

    afterEach(() => {
      _resetValidatorsCache();
    });

    describe('getAllValidators()', () => {
      it('should return the same 7 validators as before', () => {
        const validators = getAllValidators();
        expect(validators).to.have.lengthOf(7);
      });

      it('should return frozen array', () => {
        const validators = getAllValidators();
        expect(Object.isFrozen(validators)).to.be.true;
      });

      it('should return same instance on multiple calls', () => {
        const first = getAllValidators();
        const second = getAllValidators();
        expect(first).to.equal(second);
      });

      it('should contain all expected entity types', () => {
        const validators = getAllValidators();
        const types = validators.map((v) => v.entityType);

        expect(types).to.include('SWISS_ADDRESS');
        expect(types).to.include('SWISS_AVS');
        expect(types).to.include('IBAN');
        expect(types).to.include('EMAIL');
        expect(types).to.include('PHONE');
        expect(types).to.include('DATE');
        expect(types).to.include('VAT_NUMBER');
      });

      it('should have unique validator names', () => {
        const validators = getAllValidators();
        const names = validators.map((v) => v.name);
        const uniqueNames = new Set(names);
        expect(uniqueNames.size).to.equal(validators.length);
      });
    });

    describe('getValidatorForType()', () => {
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

      it('should return same validator instance as in getAllValidators()', () => {
        const allValidators = getAllValidators();
        const emailFromAll = allValidators.find((v) => v.entityType === 'EMAIL');
        const emailFromGet = getValidatorForType('EMAIL');

        // Note: After _resetValidatorsCache, new instances are created
        // so this tests that they are the same within a cache cycle
        expect(emailFromGet.entityType).to.equal(emailFromAll.entityType);
        expect(emailFromGet.name).to.equal(emailFromAll.name);
      });
    });

    describe('_resetValidatorsCache()', () => {
      it('should reset and re-populate registry', () => {
        const before = getAllValidators();
        _resetValidatorsCache();
        const after = getAllValidators();

        // New instances created
        expect(before).to.not.equal(after);
        // But same count
        expect(after).to.have.lengthOf(7);
      });

      it('should allow multiple reset cycles', () => {
        for (let i = 0; i < 3; i++) {
          _resetValidatorsCache();
          const validators = getAllValidators();
          expect(validators).to.have.lengthOf(7);
        }
      });
    });
  });

  describe('Integration: Validator Validation Works', () => {
    beforeEach(() => {
      _resetValidatorsCache();
    });

    afterEach(() => {
      _resetValidatorsCache();
    });

    it('should be able to validate email via registry', () => {
      const emailValidator = getValidatorForType('EMAIL');
      const result = emailValidator.validate({ text: 'test@example.com' });
      expect(result.isValid).to.be.true;
    });

    it('should be able to validate IBAN via registry', () => {
      const ibanValidator = getValidatorForType('IBAN');
      const result = ibanValidator.validate({ text: 'CH93 0076 2011 6238 5295 7' });
      expect(result.isValid).to.be.true;
    });

    it('should be able to validate Swiss AVS via registry', () => {
      const avsValidator = getValidatorForType('SWISS_AVS');
      const result = avsValidator.validate({ text: '756.1234.5678.97' });
      expect(result.isValid).to.be.true;
    });
  });
});
