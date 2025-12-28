/**
 * Phone Number Validator (Shared)
 *
 * Validates Swiss and EU phone number formats.
 *
 * @module shared/pii/validators/PhoneValidator
 */

import type {
  ValidatorEntity,
  ValidationResult,
  ValidationRule,
  ValidatorEntityType,
} from './types.js';
import { CONFIDENCE } from './confidence.js';

/**
 * Valid country code prefixes
 */
const VALID_PREFIXES = ['41', '49', '33', '39', '43', '32', '31', '352'];

/**
 * Swiss mobile prefixes (after country code)
 */
const SWISS_MOBILE_PREFIXES = ['76', '77', '78', '79'];

/**
 * Phone Number Validator
 *
 * Validates Swiss and EU phone numbers.
 */
export class PhoneValidator implements ValidationRule {
  /** Maximum phone input length (E.164 max 15 digits + formatting) */
  static readonly MAX_LENGTH = 20;

  entityType: ValidatorEntityType = 'PHONE';
  name = 'PhoneValidator';

  validate(entity: ValidatorEntity): ValidationResult {
    // SECURITY: Check length before processing to prevent ReDoS
    if (entity.text.length > PhoneValidator.MAX_LENGTH) {
      return {
        isValid: false,
        confidence: CONFIDENCE.FAILED,
        reason: `Input exceeds maximum length (${PhoneValidator.MAX_LENGTH})`,
      };
    }

    const digits = entity.text.replace(/\D/g, '');

    // Check length (international formats: 9-15 digits)
    if (digits.length < 9 || digits.length > 15) {
      return {
        isValid: false,
        confidence: CONFIDENCE.FAILED,
        reason: `Invalid length: ${digits.length} digits`,
      };
    }

    // Check for valid country codes
    const hasValidPrefix = VALID_PREFIXES.some(
      (prefix) => digits.startsWith(prefix) || digits.startsWith('00' + prefix),
    );

    // Also accept numbers starting with 0 (local format)
    const isLocalFormat = digits.startsWith('0') && !digits.startsWith('00');

    if (!hasValidPrefix && !isLocalFormat) {
      return {
        isValid: false,
        confidence: CONFIDENCE.WEAK,
        reason: 'No recognized country code',
      };
    }

    // Swiss mobile numbers: 076, 077, 078, 079
    if (digits.startsWith('41') || isLocalFormat) {
      const localPart = digits.startsWith('41')
        ? digits.slice(2)
        : digits.slice(1);

      if (SWISS_MOBILE_PREFIXES.some(prefix => localPart.startsWith(prefix))) {
        return {
          isValid: true,
          confidence: CONFIDENCE.FORMAT_VALID,
        };
      }
    }

    return {
      isValid: true,
      confidence: CONFIDENCE.MODERATE,
    };
  }
}

/**
 * Validate phone number (standalone function)
 */
export function validatePhone(text: string): boolean {
  const validator = new PhoneValidator();
  return validator.validate({ text }).isValid;
}

/**
 * Validate phone number with full result
 */
export function validatePhoneFull(text: string): ValidationResult {
  const validator = new PhoneValidator();
  return validator.validate({ text });
}

// Self-register on module import
import { registerValidator } from './registry.js';
registerValidator(new PhoneValidator());

export default PhoneValidator;
