/**
 * Swiss AVS Number Validator (Shared)
 *
 * Validates Swiss AVS/AHV social security numbers.
 * Format: 756.XXXX.XXXX.XX
 * Checksum: EAN-13 mod 10
 *
 * @module shared/pii/validators/SwissAvsValidator
 */

import type {
  ValidatorEntity,
  ValidationResult,
  ValidationRule,
  ValidatorEntityType,
} from './types.js';

/**
 * Calculate EAN-13 checksum
 */
function calculateEAN13Checksum(digits: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digitChar = digits[i];
    const digit = digitChar ? parseInt(digitChar, 10) : 0;
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * Swiss AVS Number Validator
 *
 * Validates Swiss social security numbers (AVS/AHV).
 * Uses EAN-13 checksum algorithm.
 */
export class SwissAvsValidator implements ValidationRule {
  entityType: ValidatorEntityType = 'SWISS_AVS';
  name = 'SwissAvsValidator';

  validate(entity: ValidatorEntity): ValidationResult {
    const digits = entity.text.replace(/\D/g, '');

    // Must be 13 digits
    if (digits.length !== 13) {
      return {
        isValid: false,
        confidence: 0.3,
        reason: `Invalid length: ${digits.length} digits (expected 13)`,
      };
    }

    // Must start with 756 (Switzerland country code)
    if (!digits.startsWith('756')) {
      return {
        isValid: false,
        confidence: 0.3,
        reason: 'Does not start with Swiss country code 756',
      };
    }

    // EAN-13 checksum validation
    const checksum = calculateEAN13Checksum(digits.slice(0, 12));
    const lastDigit = digits[12];
    const expectedCheck = lastDigit ? parseInt(lastDigit, 10) : -1;

    if (checksum !== expectedCheck) {
      return {
        isValid: false,
        confidence: 0.4,
        reason: `Checksum mismatch: expected ${checksum}, got ${expectedCheck}`,
      };
    }

    return {
      isValid: true,
      confidence: 0.95,
    };
  }
}

/**
 * Validate Swiss AVS number (standalone function)
 */
export function validateSwissAvs(text: string): boolean {
  const validator = new SwissAvsValidator();
  return validator.validate({ text }).isValid;
}

/**
 * Validate Swiss AVS with full result
 */
export function validateSwissAvsFull(text: string): ValidationResult {
  const validator = new SwissAvsValidator();
  return validator.validate({ text });
}

export default SwissAvsValidator;
