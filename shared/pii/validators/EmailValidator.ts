/**
 * Email Validator (Shared)
 *
 * Validates email addresses using RFC 5322 simplified pattern.
 *
 * @module shared/pii/validators/EmailValidator
 */

import type {
  ValidatorEntity,
  ValidationResult,
  ValidationRule,
  ValidatorEntityType,
} from './types.js';
import { CONFIDENCE } from './confidence.js';

/**
 * RFC 5322 simplified email pattern
 */
const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/**
 * Email Validator
 *
 * Validates email addresses using RFC 5322 patterns.
 */
export class EmailValidator implements ValidationRule {
  /** Maximum email length per RFC 5321 */
  static readonly MAX_LENGTH = 254;

  entityType: ValidatorEntityType = 'EMAIL';
  name = 'EmailValidator';

  validate(entity: ValidatorEntity): ValidationResult {
    // SECURITY: Check length before regex to prevent ReDoS
    if (entity.text.length > EmailValidator.MAX_LENGTH) {
      return {
        isValid: false,
        confidence: CONFIDENCE.FAILED,
        reason: `Input exceeds maximum length (${EmailValidator.MAX_LENGTH})`,
      };
    }

    const email = entity.text.toLowerCase();

    // Basic RFC 5322 pattern
    if (!EMAIL_PATTERN.test(email)) {
      return {
        isValid: false,
        confidence: CONFIDENCE.FAILED,
        reason: 'Does not match email format',
      };
    }

    // Check for common invalid patterns
    if (email.includes('..')) {
      return {
        isValid: false,
        confidence: CONFIDENCE.FAILED,
        reason: 'Contains consecutive dots',
      };
    }

    // Check TLD is at least 2 chars
    const tld = email.split('.').pop();
    if (!tld || tld.length < 2) {
      return {
        isValid: false,
        confidence: CONFIDENCE.INVALID_FORMAT,
        reason: 'Invalid TLD',
      };
    }

    return {
      isValid: true,
      confidence: CONFIDENCE.FORMAT_VALID,
    };
  }
}

/**
 * Validate email (standalone function)
 */
export function validateEmail(text: string): boolean {
  const validator = new EmailValidator();
  return validator.validate({ text }).isValid;
}

/**
 * Validate email with full result
 */
export function validateEmailFull(text: string): ValidationResult {
  const validator = new EmailValidator();
  return validator.validate({ text });
}

// Self-register on module import
import { registerValidator } from './registry.js';
registerValidator(new EmailValidator());

export default EmailValidator;
