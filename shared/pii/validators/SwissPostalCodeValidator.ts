/**
 * Swiss Postal Code Validator (Shared)
 *
 * Validates Swiss postal codes (NPA/PLZ).
 * Valid range: 1000-9699
 *
 * @module shared/pii/validators/SwissPostalCodeValidator
 */

import type {
  ValidatorEntity,
  ValidationResult,
  ValidationRule,
  ValidatorEntityType,
} from './types.js';

/**
 * Swiss Postal Code Validator
 *
 * Validates Swiss postal codes are within valid ranges.
 */
export class SwissPostalCodeValidator implements ValidationRule {
  entityType: ValidatorEntityType = 'SWISS_ADDRESS';
  name = 'SwissPostalCodeValidator';

  validate(entity: ValidatorEntity): ValidationResult {
    // Extract postal code (4 digits)
    const postalMatch = entity.text.match(/\b([1-9]\d{3})\b/);

    if (!postalMatch) {
      return {
        isValid: false,
        confidence: 0.4,
        reason: 'No valid postal code found',
      };
    }

    const postalCodeStr = postalMatch[1];
    if (!postalCodeStr) {
      return {
        isValid: false,
        confidence: 0.4,
        reason: 'No valid postal code found',
      };
    }
    const postalCode = parseInt(postalCodeStr, 10);

    // Swiss postal codes: 1000-9999
    // Main ranges:
    // 1xxx - Romandie (Vaud, Valais, Geneva)
    // 2xxx - Jura, Neuchâtel
    // 3xxx - Bern
    // 4xxx - Basel
    // 5xxx - Aargau, Solothurn
    // 6xxx - Central Switzerland
    // 7xxx - Graubünden
    // 8xxx - Zürich
    // 9xxx - Eastern Switzerland
    if (postalCode < 1000 || postalCode > 9699) {
      return {
        isValid: false,
        confidence: 0.5,
        reason: `Postal code ${postalCode} outside Swiss range`,
      };
    }

    return {
      isValid: true,
      confidence: 0.85,
    };
  }
}

/**
 * Validate Swiss postal code (standalone function)
 */
export function validateSwissPostalCode(text: string): boolean {
  const validator = new SwissPostalCodeValidator();
  return validator.validate({ text }).isValid;
}

/**
 * Validate Swiss postal code with full result
 */
export function validateSwissPostalCodeFull(text: string): ValidationResult {
  const validator = new SwissPostalCodeValidator();
  return validator.validate({ text });
}

export default SwissPostalCodeValidator;
