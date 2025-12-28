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
  entityType: ValidatorEntityType = 'EMAIL';
  name = 'EmailValidator';

  validate(entity: ValidatorEntity): ValidationResult {
    const email = entity.text.toLowerCase();

    // Basic RFC 5322 pattern
    if (!EMAIL_PATTERN.test(email)) {
      return {
        isValid: false,
        confidence: 0.3,
        reason: 'Does not match email format',
      };
    }

    // Check for common invalid patterns
    if (email.includes('..')) {
      return {
        isValid: false,
        confidence: 0.3,
        reason: 'Contains consecutive dots',
      };
    }

    // Check TLD is at least 2 chars
    const tld = email.split('.').pop();
    if (!tld || tld.length < 2) {
      return {
        isValid: false,
        confidence: 0.4,
        reason: 'Invalid TLD',
      };
    }

    return {
      isValid: true,
      confidence: 0.9,
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

export default EmailValidator;
