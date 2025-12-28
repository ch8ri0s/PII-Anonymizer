/**
 * VAT Number Validator (Shared)
 *
 * Validates Swiss (CHE) and EU VAT numbers.
 * Swiss format: CHE-XXX.XXX.XXX
 * Swiss UID checksum: weighted sum mod 11
 *
 * @module shared/pii/validators/VatNumberValidator
 */

import type {
  ValidatorEntity,
  ValidationResult,
  ValidationRule,
  ValidatorEntityType,
} from './types.js';

/**
 * Validate Swiss UID checksum (weighted sum mod 11)
 */
function validateSwissUID(digits: string): boolean {
  const weights = [5, 4, 3, 2, 7, 6, 5, 4];
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    const digitChar = digits[i];
    const weight = weights[i];
    if (digitChar !== undefined && weight !== undefined) {
      sum += parseInt(digitChar, 10) * weight;
    }
  }

  const checksum = 11 - (sum % 11);
  const expected = checksum === 11 ? 0 : checksum;

  const lastDigit = digits[8];
  return lastDigit !== undefined && parseInt(lastDigit, 10) === expected;
}

/**
 * EU VAT pattern (basic validation)
 */
const EU_VAT_PATTERN = /^(DE|FR|IT|AT)\d{8,11}$/;

/**
 * VAT Number Validator
 *
 * Validates Swiss CHE and EU VAT numbers.
 */
export class VatNumberValidator implements ValidationRule {
  entityType: ValidatorEntityType = 'VAT_NUMBER';
  name = 'VatNumberValidator';

  validate(entity: ValidatorEntity): ValidationResult {
    const text = entity.text.toUpperCase();

    // Swiss VAT: CHE-XXX.XXX.XXX
    if (text.startsWith('CHE')) {
      const digits = text.replace(/\D/g, '');
      if (digits.length !== 9) {
        return {
          isValid: false,
          confidence: 0.4,
          reason: `Invalid Swiss VAT length: ${digits.length} digits`,
        };
      }

      // UID checksum validation
      if (!validateSwissUID(digits)) {
        return {
          isValid: false,
          confidence: 0.5,
          reason: 'Swiss UID checksum failed',
        };
      }

      return {
        isValid: true,
        confidence: 0.9,
      };
    }

    // EU VAT formats (basic validation)
    if (EU_VAT_PATTERN.test(text.replace(/\s/g, ''))) {
      return {
        isValid: true,
        confidence: 0.75,
      };
    }

    return {
      isValid: false,
      confidence: 0.4,
      reason: 'Unrecognized VAT format',
    };
  }
}

/**
 * Validate VAT number (standalone function)
 */
export function validateVatNumber(text: string): boolean {
  const validator = new VatNumberValidator();
  return validator.validate({ text }).isValid;
}

/**
 * Validate VAT number with full result
 */
export function validateVatNumberFull(text: string): ValidationResult {
  const validator = new VatNumberValidator();
  return validator.validate({ text });
}

export default VatNumberValidator;
