/**
 * IBAN Validator (Shared)
 *
 * Validates International Bank Account Numbers.
 * Format: CC## #### #### #### #### #### (varies by country)
 * Checksum: ISO 7064 Mod 97-10
 *
 * @module shared/pii/validators/IbanValidator
 */

import type {
  ValidatorEntity,
  ValidationResult,
  ValidationRule,
  ValidatorEntityType,
} from './types.js';
import { CONFIDENCE } from './confidence.js';

/**
 * IBAN lengths by country code
 */
const IBAN_LENGTHS: Record<string, number> = {
  CH: 21, // Switzerland
  LI: 21, // Liechtenstein
  DE: 22, // Germany
  AT: 20, // Austria
  FR: 27, // France
  IT: 27, // Italy
  ES: 24, // Spain
  NL: 18, // Netherlands
  BE: 16, // Belgium
  LU: 20, // Luxembourg
  GB: 22, // United Kingdom
  IE: 22, // Ireland
  PT: 25, // Portugal
  GR: 27, // Greece
  PL: 28, // Poland
  CZ: 24, // Czech Republic
  SK: 24, // Slovakia
  HU: 28, // Hungary
  SE: 24, // Sweden
  DK: 18, // Denmark
  NO: 15, // Norway
  FI: 18, // Finland
};

/**
 * Validate IBAN using Mod 97-10 algorithm
 */
function validateMod97(iban: string): boolean {
  // Move first 4 characters to end
  const rearranged = iban.slice(4) + iban.slice(0, 4);

  // Convert letters to numbers (A=10, B=11, ..., Z=35)
  let numericString = '';
  for (const char of rearranged) {
    if (char >= 'A' && char <= 'Z') {
      numericString += (char.charCodeAt(0) - 55).toString();
    } else {
      numericString += char;
    }
  }

  // Calculate mod 97 in chunks (to avoid BigInt issues)
  let remainder = 0;
  for (let i = 0; i < numericString.length; i += 7) {
    const chunk = remainder.toString() + numericString.slice(i, i + 7);
    remainder = parseInt(chunk, 10) % 97;
  }

  return remainder === 1;
}

/**
 * IBAN Validator
 *
 * Validates IBANs using ISO 7064 Mod 97-10 checksum.
 * Supports Swiss and EU country codes.
 */
export class IbanValidator implements ValidationRule {
  /** Maximum IBAN length (Malta has longest at 31, with spaces up to 34) */
  static readonly MAX_LENGTH = 34;

  entityType: ValidatorEntityType = 'IBAN';
  name = 'IbanValidator';

  validate(entity: ValidatorEntity): ValidationResult {
    // SECURITY: Check length before processing to prevent ReDoS
    if (entity.text.length > IbanValidator.MAX_LENGTH) {
      return {
        isValid: false,
        confidence: CONFIDENCE.FAILED,
        reason: `Input exceeds maximum length (${IbanValidator.MAX_LENGTH})`,
      };
    }

    const iban = entity.text.replace(/\s/g, '').toUpperCase();

    // Check minimum length
    if (iban.length < 15) {
      return {
        isValid: false,
        confidence: CONFIDENCE.FAILED,
        reason: `Too short: ${iban.length} characters`,
      };
    }

    // Extract country code
    const countryCode = iban.slice(0, 2);
    const expectedLength = IBAN_LENGTHS[countryCode];

    if (expectedLength && iban.length !== expectedLength) {
      return {
        isValid: false,
        confidence: CONFIDENCE.INVALID_FORMAT,
        reason: `Invalid length for ${countryCode}: ${iban.length} (expected ${expectedLength})`,
      };
    }

    // Mod 97-10 checksum validation
    if (!validateMod97(iban)) {
      return {
        isValid: false,
        confidence: CONFIDENCE.INVALID_FORMAT,
        reason: 'Checksum validation failed (Mod 97-10)',
      };
    }

    return {
      isValid: true,
      confidence: CONFIDENCE.CHECKSUM_VALID,
    };
  }
}

/**
 * Validate IBAN (standalone function)
 */
export function validateIban(text: string): boolean {
  const validator = new IbanValidator();
  return validator.validate({ text }).isValid;
}

/**
 * Validate IBAN with full result
 */
export function validateIbanFull(text: string): ValidationResult {
  const validator = new IbanValidator();
  return validator.validate({ text });
}

// Self-register on module import
import { registerValidator } from './registry.js';
registerValidator(new IbanValidator());

export default IbanValidator;
