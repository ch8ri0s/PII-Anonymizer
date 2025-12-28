/**
 * Swiss Address Validator (Shared)
 *
 * Validates Swiss postal code + city patterns while filtering out
 * false positives from dates and years.
 *
 * Used by both Electron app (src/pii) and browser-app (shared/pii).
 *
 * @module shared/pii/validators/SwissAddressValidator
 */

import { MONTH_NAMES } from './locale-data.js';

/**
 * Words that commonly follow years but are NOT city names
 */
const NON_CITY_WORDS = new Set([
  // Document/business terms (FR/DE/EN/IT)
  'attestation', 'rapport', 'report', 'bericht', 'document', 'dokument',
  'contrat', 'contract', 'vertrag', 'contratto',
  'version', 'edition', 'ausgabe', 'edizione',
  'année', 'annee', 'year', 'jahr', 'anno',
  // Execution/process terms
  'execution', 'exécution', 'ausführung', 'esecuzione',
  // Common function words (that might start with capital after year)
  'pour', 'and', 'oder', 'from', 'with', 'date', 'depuis', 'since', 'ab',
  'fondation', 'collective', 'stiftung', 'fondazione',
  // Prepositions/articles that shouldn't start city names after years
  'l\'exécution', 'l\'execution', 'l\'année', 'l\'annee',
]);

/**
 * Known Swiss cities in the 1900-2099 postal code range
 * These are legitimate cities that should NOT be rejected as year false positives
 */
const KNOWN_SWISS_CITIES_IN_YEAR_RANGE = new Set([
  // 1900-1999 range (Valais)
  'sion', 'sierre', 'martigny', 'monthey', 'saxon', 'fully', 'leytron',
  'chamoson', 'conthey', 'vétroz', 'vetroz', 'ardon', 'riddes', 'saillon',
  'brig', 'visp', 'naters', 'zermatt', 'saas-fee',
  // 2000-2099 range (Neuchâtel/Jura)
  'neuchâtel', 'neuchatel', 'la chaux-de-fonds', 'le locle', 'fleurier',
  'couvet', 'môtiers', 'motiers', 'travers', 'boudry', 'cortaillod',
  'colombier', 'auvernier', 'bevaix', 'gorgier', 'saint-aubin',
]);

/**
 * Keywords that indicate a date context when appearing before a 4-digit number
 */
const DATE_CONTEXT_KEYWORDS = /\b(date|depuis|since|ab|from|le|am|on|year|année|annee|jahr|anno|en|im|in|vom|du)\s*[:.]?\s*$/i;

/**
 * Pattern for DD.MM. or DD/MM format before a year
 */
const DATE_PREFIX_PATTERN = /\d{1,2}[.\/]\d{1,2}[.\/]?\s*$/;

import type {
  ValidatorEntity,
  ValidationResult,
  ValidationRule,
  ValidatorEntityType,
} from './types.js';
import { CONFIDENCE } from './confidence.js';

/**
 * Validation result with confidence and optional reason
 */
export interface AddressValidationResult {
  isValid: boolean;
  confidence: number;
  reason?: string;
}

/**
 * Validate Swiss address (postal code + city) with full context analysis
 *
 * @param address - The matched address text (e.g., "1700 Fribourg")
 * @param fullText - Optional full document text for context analysis
 * @returns AddressValidationResult with isValid, confidence, and optional reason
 */
export function validateSwissAddressFull(address: string, fullText = ''): AddressValidationResult {
  const postalCode = parseInt(address.substring(0, 4), 10);

  // Basic postal code range check
  if (postalCode < 1000 || postalCode > 9999) {
    return {
      isValid: false,
      confidence: CONFIDENCE.FAILED,
      reason: `Postal code ${postalCode} outside Swiss range (1000-9999)`,
    };
  }

  const city = address.substring(4).trim();
  if (city.length < 3) {
    return {
      isValid: false,
      confidence: CONFIDENCE.FAILED,
      reason: `City name too short: "${city}"`,
    };
  }

  // Year-like patterns (1900-2099) overlap with real Swiss postal codes
  // These require extra validation to filter false positives
  if (postalCode >= 1900 && postalCode <= 2099) {
    const yearCheckResult = checkYearFalsePositive(address, city, fullText);
    if (!yearCheckResult.isValid) {
      return yearCheckResult;
    }
  }

  // Check if the first word after postal code is a known non-city word
  const firstWord = city.split(/[\s\n]/)[0] || '';
  if (firstWord && NON_CITY_WORDS.has(firstWord.toLowerCase())) {
    return {
      isValid: false,
      confidence: CONFIDENCE.INVALID_FORMAT,
      reason: `"${firstWord}" is not a valid city name`,
    };
  }

  // Valid Swiss address
  return {
    isValid: true,
    confidence: CONFIDENCE.KNOWN_VALID,
  };
}

/**
 * Check if a potential address in the 1900-2099 range is actually a year
 *
 * @param address - The full matched text
 * @param city - The city portion (after postal code)
 * @param fullText - The full document text
 * @returns AddressValidationResult indicating if this is a false positive
 */
function checkYearFalsePositive(
  address: string,
  city: string,
  fullText: string
): AddressValidationResult {
  const firstWord = city.split(/[\s\n]/)[0]?.toLowerCase() || '';

  // 0. Check if it's a KNOWN Swiss city - these are always valid
  if (KNOWN_SWISS_CITIES_IN_YEAR_RANGE.has(firstWord)) {
    return {
      isValid: true,
      confidence: CONFIDENCE.STANDARD,
      reason: `Known Swiss city: "${firstWord}"`,
    };
  }

  // 1. Check if followed by a month name (strong indicator of date)
  if (MONTH_NAMES.has(firstWord)) {
    return {
      isValid: false,
      confidence: CONFIDENCE.FALSE_POSITIVE,
      reason: `Year followed by month name "${firstWord}"`,
    };
  }

  // 2. Check if followed by a known non-city word
  if (NON_CITY_WORDS.has(firstWord)) {
    return {
      isValid: false,
      confidence: CONFIDENCE.FAILED,
      reason: `Year followed by non-city word "${firstWord}"`,
    };
  }

  // 3. Check context BEFORE the match for date indicators
  if (fullText) {
    const posInText = fullText.indexOf(address);
    if (posInText > 0) {
      // Look back up to 20 characters for context
      const before = fullText.substring(Math.max(0, posInText - 20), posInText);

      // Check for DD.MM. or DD/MM pattern immediately before
      if (DATE_PREFIX_PATTERN.test(before)) {
        return {
          isValid: false,
          confidence: CONFIDENCE.FALSE_POSITIVE,
          reason: 'Preceded by date pattern (DD.MM. or DD/MM)',
        };
      }

      // Check for date-related keywords before
      if (DATE_CONTEXT_KEYWORDS.test(before)) {
        return {
          isValid: false,
          confidence: CONFIDENCE.FAILED,
          reason: 'Preceded by date-related keyword',
        };
      }
    }

    // 4. Check context AFTER - if year is at sentence end, likely not address
    const posEnd = fullText.indexOf(address) + address.length;
    if (posEnd > 0 && posEnd < fullText.length) {
      const after = fullText.substring(posEnd, Math.min(fullText.length, posEnd + 15));
      // If immediately followed by punctuation or line break with no more text
      if (/^[\s]*[.;,!?\n]/.test(after)) {
        // Check if the match is standalone (no street context)
        const beforeContext = fullText.substring(Math.max(0, fullText.indexOf(address) - 50), fullText.indexOf(address));
        const hasStreetContext = /(?:Rue|Route|Rte|Chemin|Strasse|Str\.|Via|Avenue|Av\.)/i.test(beforeContext);
        if (!hasStreetContext) {
          return {
            isValid: false,
            confidence: CONFIDENCE.INVALID_FORMAT,
            reason: 'Year at sentence boundary without street context',
          };
        }
      }
    }
  }

  // Passed all year false-positive checks
  return {
    isValid: true,
    confidence: CONFIDENCE.MODERATE, // Slightly lower confidence for year-range postal codes
  };
}

/**
 * Validation function for use in regex pattern validation
 *
 * @param address - The address text to validate
 * @param fullText - Optional full document text for context analysis
 * @returns boolean indicating if the address is valid
 */
export function validateSwissAddress(address: string, fullText = ''): boolean {
  const result = validateSwissAddressFull(address, fullText);
  return result.isValid;
}

/**
 * Swiss Address Validator Class
 *
 * Implements ValidationRule interface for use in validation pipelines.
 */
export class SwissAddressValidator implements ValidationRule {
  /** Maximum address input length (reasonable address length) */
  static readonly MAX_LENGTH = 200;

  entityType: ValidatorEntityType = 'SWISS_ADDRESS';
  name = 'SwissAddressValidator';

  validate(entity: ValidatorEntity, context?: string): ValidationResult {
    // SECURITY: Check length before processing to prevent ReDoS
    if (entity.text.length > SwissAddressValidator.MAX_LENGTH) {
      return {
        isValid: false,
        confidence: CONFIDENCE.FAILED,
        reason: `Input exceeds maximum length (${SwissAddressValidator.MAX_LENGTH})`,
      };
    }

    const result = validateSwissAddressFull(entity.text, context || '');
    return {
      isValid: result.isValid,
      confidence: result.confidence,
      reason: result.reason,
    };
  }
}

export default SwissAddressValidator;
