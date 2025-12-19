/**
 * Entity Format Validators
 *
 * Validation rules for PII entity formats (Pass 2).
 * Each validator checks format-specific rules and checksums.
 *
 * @module src/pii/validators
 */

import type {
  Entity,
  ValidationRule,
  ValidationResult,
  EntityType,
} from '../../types/detection.js';

/**
 * Swiss AVS Number Validator
 *
 * Format: 756.XXXX.XXXX.XX
 * Checksum: EAN-13 mod 10
 */
export class SwissAvsValidator implements ValidationRule {
  entityType: EntityType = 'SWISS_AVS';
  name = 'SwissAvsValidator';

  validate(entity: Entity): ValidationResult {
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
    const checksum = this.calculateEAN13Checksum(digits.slice(0, 12));
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

  private calculateEAN13Checksum(digits: string): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digitChar = digits[i];
      const digit = digitChar ? parseInt(digitChar, 10) : 0;
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    return (10 - (sum % 10)) % 10;
  }
}

/**
 * IBAN Validator
 *
 * Format: CC## #### #### #### #### #### (varies by country)
 * Checksum: ISO 7064 Mod 97-10
 */
export class IbanValidator implements ValidationRule {
  entityType: EntityType = 'IBAN';
  name = 'IbanValidator';

  // IBAN lengths by country
  private readonly lengths: Record<string, number> = {
    CH: 21, // Switzerland
    DE: 22, // Germany
    FR: 27, // France
    IT: 27, // Italy
    AT: 20, // Austria
    ES: 24, // Spain
    NL: 18, // Netherlands
    BE: 16, // Belgium
    LU: 20, // Luxembourg
    LI: 21, // Liechtenstein
  };

  validate(entity: Entity): ValidationResult {
    const iban = entity.text.replace(/\s/g, '').toUpperCase();

    // Check minimum length
    if (iban.length < 15) {
      return {
        isValid: false,
        confidence: 0.3,
        reason: `Too short: ${iban.length} characters`,
      };
    }

    // Extract country code
    const countryCode = iban.slice(0, 2);
    const expectedLength = this.lengths[countryCode];

    if (expectedLength && iban.length !== expectedLength) {
      return {
        isValid: false,
        confidence: 0.4,
        reason: `Invalid length for ${countryCode}: ${iban.length} (expected ${expectedLength})`,
      };
    }

    // Mod 97-10 checksum validation
    if (!this.validateMod97(iban)) {
      return {
        isValid: false,
        confidence: 0.4,
        reason: 'Checksum validation failed (Mod 97-10)',
      };
    }

    return {
      isValid: true,
      confidence: 0.95,
    };
  }

  private validateMod97(iban: string): boolean {
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
}

/**
 * Email Validator
 *
 * RFC 5322 simplified validation
 */
export class EmailValidator implements ValidationRule {
  entityType: EntityType = 'EMAIL';
  name = 'EmailValidator';

  validate(entity: Entity): ValidationResult {
    const email = entity.text.toLowerCase();

    // Basic RFC 5322 pattern
    const pattern = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

    if (!pattern.test(email)) {
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
 * Phone Number Validator
 *
 * Swiss and EU format validation
 */
export class PhoneValidator implements ValidationRule {
  entityType: EntityType = 'PHONE';
  name = 'PhoneValidator';

  validate(entity: Entity): ValidationResult {
    const digits = entity.text.replace(/\D/g, '');

    // Check length (international formats: 10-15 digits)
    if (digits.length < 9 || digits.length > 15) {
      return {
        isValid: false,
        confidence: 0.3,
        reason: `Invalid length: ${digits.length} digits`,
      };
    }

    // Check for valid country codes
    const validPrefixes = ['41', '49', '33', '39', '43', '32', '31', '352'];
    const hasValidPrefix = validPrefixes.some(
      (prefix) => digits.startsWith(prefix) || digits.startsWith('00' + prefix),
    );

    // Also accept numbers starting with 0 (local format)
    const isLocalFormat = digits.startsWith('0') && !digits.startsWith('00');

    if (!hasValidPrefix && !isLocalFormat) {
      return {
        isValid: false,
        confidence: 0.5,
        reason: 'No recognized country code',
      };
    }

    // Swiss mobile numbers: 076, 077, 078, 079
    if (digits.startsWith('41') || isLocalFormat) {
      const localPart = digits.startsWith('41')
        ? digits.slice(2)
        : digits.slice(1);
      if (
        localPart.startsWith('76') ||
        localPart.startsWith('77') ||
        localPart.startsWith('78') ||
        localPart.startsWith('79')
      ) {
        return {
          isValid: true,
          confidence: 0.9,
        };
      }
    }

    return {
      isValid: true,
      confidence: 0.75,
    };
  }
}

/**
 * Date Validator
 *
 * Validates date values are within reasonable range
 */
export class DateValidator implements ValidationRule {
  entityType: EntityType = 'DATE';
  name = 'DateValidator';

  validate(entity: Entity): ValidationResult {
    const text = entity.text;

    // Try to parse the date
    const parsed = this.parseDate(text);

    if (!parsed) {
      return {
        isValid: false,
        confidence: 0.4,
        reason: 'Could not parse date',
      };
    }

    const { day, month, year } = parsed;

    // Validate ranges
    if (month < 1 || month > 12) {
      return {
        isValid: false,
        confidence: 0.3,
        reason: `Invalid month: ${month}`,
      };
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) {
      return {
        isValid: false,
        confidence: 0.3,
        reason: `Invalid day: ${day} for month ${month}`,
      };
    }

    // Check year range (1900-2100)
    if (year < 1900 || year > 2100) {
      return {
        isValid: false,
        confidence: 0.4,
        reason: `Year out of range: ${year}`,
      };
    }

    return {
      isValid: true,
      confidence: 0.85,
    };
  }

  private parseDate(
    text: string,
  ): { day: number; month: number; year: number } | null {
    // European format: DD.MM.YYYY or DD/MM/YYYY
    const euroMatch = text.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
    if (euroMatch && euroMatch[1] && euroMatch[2] && euroMatch[3]) {
      let year = parseInt(euroMatch[3], 10);
      if (year < 100) {
        year += year > 30 ? 1900 : 2000;
      }
      return {
        day: parseInt(euroMatch[1], 10),
        month: parseInt(euroMatch[2], 10),
        year,
      };
    }

    // Month name format (German/French)
    const months: Record<string, number> = {
      januar: 1,
      january: 1,
      janvier: 1,
      februar: 2,
      february: 2,
      février: 2,
      märz: 3,
      march: 3,
      mars: 3,
      april: 4,
      avril: 4,
      mai: 5,
      may: 5,
      juni: 6,
      june: 6,
      juin: 6,
      juli: 7,
      july: 7,
      juillet: 7,
      august: 8,
      août: 8,
      september: 9,
      septembre: 9,
      oktober: 10,
      october: 10,
      octobre: 10,
      november: 11,
      novembre: 11,
      dezember: 12,
      december: 12,
      décembre: 12,
    };

    const monthNameMatch = text
      .toLowerCase()
      .match(/(\d{1,2})\.?\s*([a-zäöüéè]+)\s*(\d{2,4})/);
    if (monthNameMatch && monthNameMatch[1] && monthNameMatch[2] && monthNameMatch[3]) {
      const monthName = monthNameMatch[2];
      const monthNum = months[monthName];
      if (monthNum) {
        let year = parseInt(monthNameMatch[3], 10);
        if (year < 100) {
          year += year > 30 ? 1900 : 2000;
        }
        return {
          day: parseInt(monthNameMatch[1], 10),
          month: monthNum,
          year,
        };
      }
    }

    return null;
  }
}

/**
 * Swiss Postal Code Validator
 */
export class SwissPostalCodeValidator implements ValidationRule {
  entityType: EntityType = 'SWISS_ADDRESS';
  name = 'SwissPostalCodeValidator';

  validate(entity: Entity): ValidationResult {
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
    // Main ranges: 1xxx (Romandie), 2xxx (Jura), 3xxx (Bern)
    // 4xxx (Basel), 5xxx (Aargau), 6xxx (Central), 7xxx (Graubünden)
    // 8xxx (Zürich), 9xxx (Ostschweiz)
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
 * VAT Number Validator (Swiss CHE format)
 */
export class VatNumberValidator implements ValidationRule {
  entityType: EntityType = 'VAT_NUMBER';
  name = 'VatNumberValidator';

  validate(entity: Entity): ValidationResult {
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
      if (!this.validateSwissUID(digits)) {
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
    const euPattern = /^(DE|FR|IT|AT)\d{8,11}$/;
    if (euPattern.test(text.replace(/\s/g, ''))) {
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

  private validateSwissUID(digits: string): boolean {
    // Swiss UID checksum: weighted sum mod 11
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
}

/**
 * Get all validators
 */
export function getAllValidators(): ValidationRule[] {
  return [
    new SwissAvsValidator(),
    new IbanValidator(),
    new EmailValidator(),
    new PhoneValidator(),
    new DateValidator(),
    new SwissPostalCodeValidator(),
    new VatNumberValidator(),
  ];
}

/**
 * Get validator for specific entity type
 */
export function getValidatorForType(
  type: EntityType,
): ValidationRule | undefined {
  const validators = getAllValidators();
  return validators.find((v) => v.entityType === type);
}
