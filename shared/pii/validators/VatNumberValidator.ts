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
import { CONFIDENCE } from './confidence.js';

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
  /** Maximum VAT input length (EU VAT max) */
  static readonly MAX_LENGTH = 20;

  entityType: ValidatorEntityType = 'VAT_NUMBER';
  name = 'VatNumberValidator';

  validate(entity: ValidatorEntity): ValidationResult {
    // SECURITY: Check length before processing to prevent ReDoS
    if (entity.text.length > VatNumberValidator.MAX_LENGTH) {
      return {
        isValid: false,
        confidence: CONFIDENCE.FAILED,
        reason: `Input exceeds maximum length (${VatNumberValidator.MAX_LENGTH})`,
      };
    }

    const text = entity.text.toUpperCase();

    // Swiss VAT: CHE-XXX.XXX.XXX
    if (text.startsWith('CHE')) {
      const digits = text.replace(/\D/g, '');
      if (digits.length !== 9) {
        return {
          isValid: false,
          confidence: CONFIDENCE.INVALID_FORMAT,
          reason: `Invalid Swiss VAT length: ${digits.length} digits`,
        };
      }

      // UID checksum validation
      if (!validateSwissUID(digits)) {
        return {
          isValid: false,
          confidence: CONFIDENCE.WEAK,
          reason: 'Swiss UID checksum failed',
        };
      }

      return {
        isValid: true,
        confidence: CONFIDENCE.FORMAT_VALID,
      };
    }

    // EU VAT formats (basic validation)
    if (EU_VAT_PATTERN.test(text.replace(/\s/g, ''))) {
      return {
        isValid: true,
        confidence: CONFIDENCE.MODERATE,
      };
    }

    return {
      isValid: false,
      confidence: CONFIDENCE.INVALID_FORMAT,
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

// Self-register on module import
import { registerValidator } from './registry.js';
registerValidator(new VatNumberValidator());

export default VatNumberValidator;
