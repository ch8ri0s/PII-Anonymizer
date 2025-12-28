/**
 * Swiss Postal Code Validator Tests
 *
 * Tests for Story 11.6: Validator Test Coverage
 *
 * Validates Swiss postal codes (NPA/PLZ).
 * Valid range: 1000-9699
 * Regional codes:
 * - 1xxx: Romandie (Vaud, Valais, Geneva)
 * - 2xxx: Jura, Neuchâtel
 * - 3xxx: Bern
 * - 4xxx: Basel
 * - 5xxx: Aargau, Solothurn
 * - 6xxx: Central Switzerland
 * - 7xxx: Graubünden
 * - 8xxx: Zürich
 * - 9xxx: Eastern Switzerland
 *
 * @module test/unit/pii/validators/SwissPostalCodeValidator.test
 */

import { expect } from 'chai';
import { describe, it, before } from 'mocha';

describe('SwissPostalCodeValidator', function () {
  this.timeout(10000);

  let SwissPostalCodeValidator;
  let validateSwissPostalCode;
  let validateSwissPostalCodeFull;

  before(async function () {
    const module = await import('../../../../shared/dist/pii/validators/SwissPostalCodeValidator.js');
    SwissPostalCodeValidator = module.SwissPostalCodeValidator;
    validateSwissPostalCode = module.validateSwissPostalCode;
    validateSwissPostalCodeFull = module.validateSwissPostalCodeFull;
  });

  describe('valid Swiss postal codes', function () {
    const validCodes = [
      { input: '1000', description: 'Lausanne (boundary)' },
      { input: '1700', description: 'Fribourg' },
      { input: '1200', description: 'Geneva' },
      { input: '2000', description: 'Neuchâtel' },
      { input: '3000', description: 'Bern' },
      { input: '4000', description: 'Basel' },
      { input: '5000', description: 'Aarau' },
      { input: '6000', description: 'Lucerne' },
      { input: '7000', description: 'Chur' },
      { input: '8000', description: 'Zürich' },
      { input: '9000', description: 'St. Gallen' },
      { input: '9699', description: 'upper boundary' },
    ];

    validCodes.forEach(({ input, description }) => {
      it(`should validate ${description}: ${input}`, function () {
        const result = validateSwissPostalCodeFull(input);
        expect(result.isValid).to.be.true;
        expect(result.confidence).to.be.at.least(0.8);
      });
    });
  });

  describe('postal codes with city names', function () {
    const withCities = [
      { input: '1700 Fribourg', description: 'Fribourg' },
      { input: '8000 Zürich', description: 'Zürich' },
      { input: '3000 Bern', description: 'Bern' },
      { input: '1200 Genève', description: 'Geneva (French)' },
      { input: '6003 Luzern', description: 'Lucerne' },
      { input: '4051 Basel', description: 'Basel' },
      { input: '2000 Neuchâtel', description: 'Neuchâtel' },
    ];

    withCities.forEach(({ input, description }) => {
      it(`should validate ${description}: ${input}`, function () {
        const result = validateSwissPostalCodeFull(input);
        expect(result.isValid).to.be.true;
      });
    });
  });

  describe('invalid postal codes', function () {
    const invalidCases = [
      { input: '0999', reason: 'below 1000' },
      { input: '999', reason: '3 digits only' },
      { input: '10000', reason: '5 digits' },
      { input: '9700', reason: 'above 9699' },
      { input: '9999', reason: 'above valid range' },
      { input: 'ABCD', reason: 'non-numeric' },
      { input: '', reason: 'empty string' },
      { input: '   ', reason: 'whitespace only' },
    ];

    invalidCases.forEach(({ input, reason }) => {
      it(`should reject: "${input}" (${reason})`, function () {
        const result = validateSwissPostalCodeFull(input);
        expect(result.isValid).to.be.false;
        expect(result.reason).to.exist;
      });
    });
  });

  describe('boundary validation', function () {
    it('should accept 1000 (lower boundary)', function () {
      const result = validateSwissPostalCodeFull('1000');
      expect(result.isValid).to.be.true;
    });

    it('should accept 9699 (upper boundary)', function () {
      const result = validateSwissPostalCodeFull('9699');
      expect(result.isValid).to.be.true;
    });

    it('should reject 999 (below range)', function () {
      const result = validateSwissPostalCodeFull('999');
      expect(result.isValid).to.be.false;
    });

    it('should reject 9700 (above range)', function () {
      const result = validateSwissPostalCodeFull('9700');
      expect(result.isValid).to.be.false;
    });
  });

  describe('regional codes', function () {
    const regions = [
      { prefix: '1', region: 'Romandie', example: '1003' },
      { prefix: '2', region: 'Jura/Neuchâtel', example: '2300' },
      { prefix: '3', region: 'Bern', example: '3011' },
      { prefix: '4', region: 'Basel', example: '4056' },
      { prefix: '5', region: 'Aargau/Solothurn', example: '5400' },
      { prefix: '6', region: 'Central Switzerland', example: '6004' },
      { prefix: '7', region: 'Graubünden', example: '7000' },
      { prefix: '8', region: 'Zürich', example: '8001' },
      { prefix: '9', region: 'Eastern Switzerland', example: '9000' },
    ];

    regions.forEach(({ prefix, region, example }) => {
      it(`should validate ${region} region (${prefix}xxx): ${example}`, function () {
        const result = validateSwissPostalCodeFull(example);
        expect(result.isValid).to.be.true;
      });
    });
  });

  describe('edge cases', function () {
    it('should handle empty input', function () {
      const result = validateSwissPostalCodeFull('');
      expect(result.isValid).to.be.false;
    });

    it('should handle whitespace only', function () {
      const result = validateSwissPostalCodeFull('   ');
      expect(result.isValid).to.be.false;
    });

    it('should extract postal code from longer text', function () {
      const result = validateSwissPostalCodeFull('CH-1700 Fribourg, Switzerland');
      expect(result.isValid).to.be.true;
    });

    it('should handle postal code with leading zeros (not valid Swiss)', function () {
      const result = validateSwissPostalCodeFull('0100');
      expect(result.isValid).to.be.false;
    });

    it('should handle unicode characters in city name', function () {
      const result = validateSwissPostalCodeFull('2000 Neuchâtel');
      expect(result.isValid).to.be.true;
    });

    it('should reject very long inputs (ReDoS protection)', function () {
      const longInput = '1700 ' + 'A'.repeat(150);
      const result = validateSwissPostalCodeFull(longInput);
      expect(result.isValid).to.be.false;
      expect(result.reason).to.include('maximum length');
    });

    it('should handle multiple postal codes in text (takes first)', function () {
      const result = validateSwissPostalCodeFull('1700 or 8000');
      expect(result.isValid).to.be.true;
    });
  });

  describe('special postal codes', function () {
    it('should validate Liechtenstein-adjacent codes (9xxx)', function () {
      const result = validateSwissPostalCodeFull('9485');
      expect(result.isValid).to.be.true;
    });

    it('should validate high-altitude codes', function () {
      // Jungfraujoch has 3801
      const result = validateSwissPostalCodeFull('3801');
      expect(result.isValid).to.be.true;
    });
  });

  describe('class interface', function () {
    it('should implement ValidationRule interface', function () {
      const validator = new SwissPostalCodeValidator();
      expect(validator.entityType).to.equal('SWISS_ADDRESS');
      expect(validator.name).to.equal('SwissPostalCodeValidator');
      expect(validator.validate).to.be.a('function');
    });

    it('should have MAX_LENGTH constant', function () {
      expect(SwissPostalCodeValidator.MAX_LENGTH).to.equal(100);
    });

    it('should validate via class instance', function () {
      const validator = new SwissPostalCodeValidator();
      const result = validator.validate({ text: '1700' });
      expect(result.isValid).to.be.true;
    });
  });

  describe('standalone functions', function () {
    it('validateSwissPostalCode should return boolean', function () {
      expect(validateSwissPostalCode('1700')).to.be.true;
      expect(validateSwissPostalCode('0000')).to.be.false;
    });

    it('validateSwissPostalCodeFull should return result object', function () {
      const result = validateSwissPostalCodeFull('1700');
      expect(result).to.have.property('isValid');
      expect(result).to.have.property('confidence');
    });
  });

  describe('Registry exclusion (Story 11.9)', function () {
    let getAllValidators;
    let getValidatorForType;
    let _resetValidatorsCache;

    before(async function () {
      const indexModule = await import('../../../../shared/dist/pii/validators/index.js');
      getAllValidators = indexModule.getAllValidators;
      getValidatorForType = indexModule.getValidatorForType;
      _resetValidatorsCache = indexModule._resetValidatorsCache;
    });

    beforeEach(function () {
      _resetValidatorsCache();
    });

    afterEach(function () {
      _resetValidatorsCache();
    });

    it('should NOT be included in getAllValidators() registry', function () {
      const validators = getAllValidators();
      const names = validators.map(v => v.name);
      expect(names).to.not.include('SwissPostalCodeValidator');
    });

    it('should still be importable for direct use', function () {
      expect(SwissPostalCodeValidator).to.exist;
      expect(typeof SwissPostalCodeValidator).to.equal('function');
    });

    it('should still function correctly when instantiated directly', function () {
      const validator = new SwissPostalCodeValidator();
      const result = validator.validate({ text: '1000' });
      expect(result.isValid).to.be.true;
      expect(result.confidence).to.be.at.least(0.8);
    });

    it('should have SwissAddressValidator as the registry validator for SWISS_ADDRESS', function () {
      const validator = getValidatorForType('SWISS_ADDRESS');
      expect(validator).to.exist;
      expect(validator.name).to.equal('SwissAddressValidator');
      expect(validator.name).to.not.equal('SwissPostalCodeValidator');
    });

    it('should avoid entityType collision with SwissAddressValidator', function () {
      // Both validators have entityType 'SWISS_ADDRESS' but only SwissAddressValidator
      // should be in the registry to avoid Map key collision
      const validators = getAllValidators();
      const swissAddressValidators = validators.filter(v => v.entityType === 'SWISS_ADDRESS');

      // Should only have ONE validator with entityType 'SWISS_ADDRESS' in registry
      expect(swissAddressValidators).to.have.lengthOf(1);
      expect(swissAddressValidators[0].name).to.equal('SwissAddressValidator');
    });
  });
});
