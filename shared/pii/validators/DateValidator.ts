/**
 * Date Validator (Shared)
 *
 * Validates date values in European formats (DD.MM.YYYY, DD/MM/YYYY).
 * Supports German, French, and English month names.
 *
 * @module shared/pii/validators/DateValidator
 */

import type {
  ValidatorEntity,
  ValidationResult,
  ValidationRule,
  ValidatorEntityType,
} from './types.js';

/**
 * Month name mappings for German, French, English
 * Note: Some names are shared across languages (april, september, november)
 */
const MONTHS: Record<string, number> = {
  // English
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  // German (excluding duplicates: april, august, september, november are same as English)
  januar: 1, februar: 2, märz: 3, mai: 5, juni: 6,
  juli: 7, oktober: 10, dezember: 12,
  // French (excluding duplicates)
  janvier: 1, février: 2, mars: 3, avril: 4, juin: 6,
  juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12,
};

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

  // Month name format (German/French/English)
  const monthNameMatch = text
    .toLowerCase()
    .match(/(\d{1,2})\.?\s*([a-zäöüéè]+)\s*(\d{2,4})/);
  if (monthNameMatch && monthNameMatch[1] && monthNameMatch[2] && monthNameMatch[3]) {
    const monthName = monthNameMatch[2];
    const monthNum = MONTHS[monthName];
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
  entityType: ValidatorEntityType = 'DATE';
  name = 'DateValidator';

  validate(entity: ValidatorEntity): ValidationResult {
    const text = entity.text;

    // Try to parse the date
    const parsed = parseDate(text);

    if (!parsed) {
      return {
        isValid: false,
        confidence: 0.4,
        reason: 'Could not parse date',
      };
    }

    const { day, month, year } = parsed;

    // Validate month range
    if (month < 1 || month > 12) {
      return {
        isValid: false,
        confidence: 0.3,
        reason: `Invalid month: ${month}`,
      };
    }

    // Validate day range for the given month
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

export default DateValidator;
