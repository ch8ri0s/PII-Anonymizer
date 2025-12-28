/**
 * Date Validator (Shared)
 *
 * Validates date values in European formats (DD.MM.YYYY, DD/MM/YYYY).
 * Supports German, French, English, and Italian month names.
 *
 * @module shared/pii/validators/DateValidator
 */

import type {
  ValidatorEntity,
  ValidationResult,
  ValidationRule,
  ValidatorEntityType,
} from './types.js';
import { CONFIDENCE } from './confidence.js';
import { MONTH_NAME_TO_NUMBER } from './locale-data.js';

/**
 * Parsed date result
 */
interface ParsedDate {
  day: number;
  month: number;
  year: number;
}

/**
 * Parse date from text
 */
function parseDate(text: string): ParsedDate | null {
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

  // Month name format (German/French/English/Italian)
  const monthNameMatch = text
    .toLowerCase()
    .match(/(\d{1,2})\.?\s*([a-zäöüéè]+)\s*(\d{2,4})/);
  if (monthNameMatch && monthNameMatch[1] && monthNameMatch[2] && monthNameMatch[3]) {
    const monthName = monthNameMatch[2];
    const monthNum = MONTH_NAME_TO_NUMBER[monthName];
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

/**
 * Date Validator
 *
 * Validates dates in European formats.
 */
export class DateValidator implements ValidationRule {
  /** Maximum date input length (longest date format) */
  static readonly MAX_LENGTH = 50;

  entityType: ValidatorEntityType = 'DATE';
  name = 'DateValidator';

  validate(entity: ValidatorEntity): ValidationResult {
    // SECURITY: Check length before processing to prevent ReDoS
    if (entity.text.length > DateValidator.MAX_LENGTH) {
      return {
        isValid: false,
        confidence: CONFIDENCE.FAILED,
        reason: `Input exceeds maximum length (${DateValidator.MAX_LENGTH})`,
      };
    }

    const text = entity.text;

    // Try to parse the date
    const parsed = parseDate(text);

    if (!parsed) {
      return {
        isValid: false,
        confidence: CONFIDENCE.INVALID_FORMAT,
        reason: 'Could not parse date',
      };
    }

    const { day, month, year } = parsed;

    // Validate month range
    if (month < 1 || month > 12) {
      return {
        isValid: false,
        confidence: CONFIDENCE.FAILED,
        reason: `Invalid month: ${month}`,
      };
    }

    // Validate day range for the given month
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) {
      return {
        isValid: false,
        confidence: CONFIDENCE.FAILED,
        reason: `Invalid day: ${day} for month ${month}`,
      };
    }

    // Check year range (1900-2100)
    if (year < 1900 || year > 2100) {
      return {
        isValid: false,
        confidence: CONFIDENCE.INVALID_FORMAT,
        reason: `Year out of range: ${year}`,
      };
    }

    return {
      isValid: true,
      confidence: CONFIDENCE.STANDARD,
    };
  }
}

/**
 * Validate date (standalone function)
 */
export function validateDate(text: string): boolean {
  const validator = new DateValidator();
  return validator.validate({ text }).isValid;
}

/**
 * Validate date with full result
 */
export function validateDateFull(text: string): ValidationResult {
  const validator = new DateValidator();
  return validator.validate({ text });
}

// Self-register on module import
import { registerValidator } from './registry.js';
registerValidator(new DateValidator());

export default DateValidator;
