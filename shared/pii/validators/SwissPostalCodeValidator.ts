/**
 * Swiss Postal Code Validator (Shared)
 *
 * Validates Swiss postal codes (NPA/PLZ).
 * Valid range: 1000-9699
 *
 * @internal This validator is NOT included in the getAllValidators() registry.
 * It shares entityType 'SWISS_ADDRESS' with SwissAddressValidator, which is the
 * primary registered validator for address entities. This validator is exported
 * for direct use only (e.g., standalone postal code validation) and should not
 * be used via getValidatorForType().
 *
 * @see SwissAddressValidator - The registered validator for SWISS_ADDRESS entities
 * @module shared/pii/validators/SwissPostalCodeValidator
 */

import type {
  ValidatorEntity,
  ValidationResult,
  ValidationRule,
  ValidatorEntityType,
} from './types.js';
import { CONFIDENCE } from './confidence.js';

/**
 * Swiss Postal Code Validator
 *
 * Validates Swiss postal codes are within valid ranges.
 *
 * @internal Not included in getAllValidators() registry to avoid entityType
 * collision with SwissAddressValidator. Use directly for standalone postal
 * code validation, or use SwissAddressValidator for full address validation.
 *
 * @example
 * ```typescript
 * // Direct use (correct)
 * import { SwissPostalCodeValidator } from 'shared/pii/validators';
 * const validator = new SwissPostalCodeValidator();
 * const result = validator.validate({ text: '1000' });
 *
 * // Or use standalone function
 * import { validateSwissPostalCode } from 'shared/pii/validators';
 * const isValid = validateSwissPostalCode('1000');
 * ```
 */
export class SwissPostalCodeValidator implements ValidationRule {
  /** Maximum postal code input length (postal code + city) */
  static readonly MAX_LENGTH = 100;

  entityType: ValidatorEntityType = 'SWISS_ADDRESS';
  name = 'SwissPostalCodeValidator';

  validate(entity: ValidatorEntity): ValidationResult {
    // SECURITY: Check length before processing to prevent ReDoS
    if (entity.text.length > SwissPostalCodeValidator.MAX_LENGTH) {
      return {
        isValid: false,
        confidence: CONFIDENCE.FAILED,
        reason: `Input exceeds maximum length (${SwissPostalCodeValidator.MAX_LENGTH})`,
      };
    }

    // Extract postal code (4 digits)
    const postalMatch = entity.text.match(/\b([1-9]\d{3})\b/);

    if (!postalMatch) {
      return {
        isValid: false,
        confidence: CONFIDENCE.INVALID_FORMAT,
        reason: 'No valid postal code found',
      };
    }

    const postalCodeStr = postalMatch[1];
    if (!postalCodeStr) {
      return {
        isValid: false,
        confidence: CONFIDENCE.INVALID_FORMAT,
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
        confidence: CONFIDENCE.WEAK,
        reason: `Postal code ${postalCode} outside Swiss range`,
      };
    }

    return {
      isValid: true,
      confidence: CONFIDENCE.STANDARD,
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
