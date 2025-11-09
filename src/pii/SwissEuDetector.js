/**
 * Swiss & European PII Detection Module
 *
 * Provides rule-based detection for region-specific PII types:
 * - Swiss AVS/AHV numbers (Social Security)
 * - IBAN (International Bank Account Numbers)
 * - EU-specific identifiers
 *
 * Works alongside ML-based detection for comprehensive coverage.
 */

export class SwissEuDetector {
  // Static IBAN country lengths lookup (avoid recreation on every validation)
  static IBAN_COUNTRY_LENGTHS = {
    'AD': 24, 'AE': 23, 'AL': 28, 'AT': 20, 'AZ': 28, 'BA': 20, 'BE': 16,
    'BG': 22, 'BH': 22, 'BR': 29, 'BY': 28, 'CH': 21, 'CR': 22, 'CY': 28,
    'CZ': 24, 'DE': 22, 'DK': 18, 'DO': 28, 'EE': 20, 'EG': 29, 'ES': 24,
    'FI': 18, 'FO': 18, 'FR': 27, 'GB': 22, 'GE': 22, 'GI': 23, 'GL': 18,
    'GR': 27, 'GT': 28, 'HR': 21, 'HU': 28, 'IE': 22, 'IL': 23, 'IS': 26,
    'IT': 27, 'JO': 30, 'KW': 30, 'KZ': 20, 'LB': 28, 'LI': 21, 'LT': 20,
    'LU': 20, 'LV': 21, 'MC': 27, 'MD': 24, 'ME': 22, 'MK': 19, 'MR': 27,
    'MT': 31, 'MU': 30, 'NL': 18, 'NO': 15, 'PK': 24, 'PL': 28, 'PS': 29,
    'PT': 25, 'QA': 29, 'RO': 24, 'RS': 22, 'SA': 24, 'SE': 24, 'SI': 19,
    'SK': 24, 'SM': 27, 'TN': 24, 'TR': 26, 'UA': 29, 'VA': 22, 'VG': 24,
    'XK': 20
  };

  constructor() {
    this.patterns = this.initializePatterns();
  }

  /**
   * Initialize all regex patterns for Swiss/EU PII
   */
  initializePatterns() {
    return {
      // Swiss AVS/AHV Number (Swiss Social Security)
      // Format: 756.XXXX.XXXX.XX
      // Example: 756.9217.0769.85
      SWISS_AVS: {
        name: 'SWISS_AVS',
        pattern: /\b756\.\d{4}\.\d{4}\.\d{2}\b/g,
        validate: this.validateSwissAVS.bind(this)
      },

      // Swiss AVS without dots (also common)
      // Format: 7569217076985
      SWISS_AVS_NODOTS: {
        name: 'SWISS_AVS',
        pattern: /\b756\d{10}\b/g,
        validate: this.validateSwissAVSNoDots.bind(this)
      },

      // IBAN (International Bank Account Number)
      // Universal pattern with country code validation
      // Format: CH93 0076 2011 6238 5295 7 (Swiss example)
      IBAN: {
        name: 'IBAN',
        pattern: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}\b/g,
        validate: this.validateIBAN.bind(this)
      },

      // IBAN with spaces/dashes (common formatting)
      IBAN_FORMATTED: {
        name: 'IBAN',
        pattern: /\b[A-Z]{2}[\s\-]?[0-9]{2}(?:[\s\-]?[A-Z0-9]{4}){2,7}(?:[\s\-]?[A-Z0-9]{1,3})?\b/g,
        validate: (match) => this.validateIBAN(match.replace(/[\s\-]/g, ''))
      },

      // Swiss Bank Account Number (legacy format before IBAN)
      // Format: BC-XXXXX-X (BC = Bank Code, 5-6 digits, check digit)
      SWISS_BANK_ACCOUNT: {
        name: 'SWISS_BANK_ACCOUNT',
        pattern: /\b\d{2}-\d{5,6}-\d\b/g,
        validate: () => true // Simple format check is sufficient
      },

      // EU VAT Numbers (various formats)
      // Covers major EU countries
      EU_VAT: {
        name: 'EU_VAT',
        pattern: /\b(AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)U?[0-9A-Z]{8,12}\b/g,
        validate: () => true // Country-specific validation can be added
      },

      // Swiss UID (Unternehmens-Identifikationsnummer)
      // Format: CHE-123.456.789 (Business Identification Number)
      SWISS_UID: {
        name: 'SWISS_UID',
        pattern: /\bCHE-\d{3}\.\d{3}\.\d{3}(?:\s+(?:MWST|TVA|IVA))?\b/g,
        validate: () => true
      },

      // European Health Insurance Card (EHIC) Number
      // Format varies by country, but typically 16-20 digits
      EHIC: {
        name: 'EHIC',
        pattern: /\b\d{16,20}\b/g,
        validate: this.validateEHIC.bind(this)
      },

      // Swiss Passport Number
      // Format: Letter + 7 digits (e.g., P1234567)
      SWISS_PASSPORT: {
        name: 'PASSPORT',
        pattern: /\b[A-Z]\d{7}\b/g,
        validate: (match) => /^[A-Z]\d{7}$/.test(match)
      },

      // Swiss License Plate
      // Format: ZH 123456 (canton code + up to 6 digits)
      SWISS_LICENSE_PLATE: {
        name: 'LICENSE_PLATE',
        pattern: /\b(AG|AI|AR|BE|BL|BS|FR|GE|GL|GR|JU|LU|NE|NW|OW|SG|SH|SO|SZ|TG|TI|UR|VD|VS|ZG|ZH)\s?\d{1,6}\b/g,
        validate: () => true
      }
    };
  }

  /**
   * Validate Swiss AVS/AHV number using EAN-13 checksum
   */
  validateSwissAVS(avsNumber) {
    // Remove dots and validate format
    const cleaned = avsNumber.replace(/\./g, '');

    if (!/^756\d{10}$/.test(cleaned)) {
      return false;
    }

    // EAN-13 checksum validation
    return this.validateEAN13Checksum(cleaned);
  }

  /**
   * Validate Swiss AVS without dots
   */
  validateSwissAVSNoDots(avsNumber) {
    if (!/^756\d{10}$/.test(avsNumber)) {
      return false;
    }

    return this.validateEAN13Checksum(avsNumber);
  }

  /**
   * EAN-13 checksum algorithm (used by Swiss AVS)
   */
  validateEAN13Checksum(number) {
    if (number.length !== 13) return false;

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(number[i], 10);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }

    const checksum = (10 - (sum % 10)) % 10;
    return checksum === parseInt(number[12], 10);
  }

  /**
   * Validate IBAN using mod-97 algorithm
   */
  validateIBAN(iban) {
    // Remove spaces and convert to uppercase
    const cleaned = iban.replace(/\s/g, '').toUpperCase();

    // Check basic format
    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(cleaned)) {
      return false;
    }

    // Check length by country (use static property to avoid object recreation)
    const countryCode = cleaned.substring(0, 2);
    const expectedLength = SwissEuDetector.IBAN_COUNTRY_LENGTHS[countryCode];

    if (!expectedLength || cleaned.length !== expectedLength) {
      return false;
    }

    // Mod-97 validation
    // Move first 4 characters to end
    const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);

    // Convert letters to numbers (A=10, B=11, ..., Z=35)
    let numericString = '';
    for (const char of rearranged) {
      if (/[A-Z]/.test(char)) {
        numericString += (char.charCodeAt(0) - 55).toString();
      } else {
        numericString += char;
      }
    }

    // Calculate mod 97
    return this.mod97(numericString) === 1;
  }

  /**
   * Calculate mod 97 for large numbers (used in IBAN validation)
   */
  mod97(numericString) {
    let remainder = 0;
    for (const digit of numericString) {
      remainder = (remainder * 10 + parseInt(digit, 10)) % 97;
    }
    return remainder;
  }

  /**
   * Validate European Health Insurance Card number
   * This is a heuristic - actual validation varies by country
   */
  validateEHIC(number) {
    // Must be 16-20 digits
    if (!/^\d{16,20}$/.test(number)) {
      return false;
    }

    // Avoid false positives (credit cards, phone numbers, etc.)
    // EHIC typically starts with country-specific prefixes
    // This is a basic check - can be enhanced with country-specific logic
    const prefix = number.substring(0, 4);

    // Common credit card prefixes to exclude
    const creditCardPrefixes = ['4', '5', '6', '3'];
    if (creditCardPrefixes.some(p => number.startsWith(p))) {
      return false;
    }

    return true;
  }

  /**
   * Detect all Swiss/EU PII in text
   * Returns array of matches with type and position
   */
  detect(text) {
    const matches = [];

    for (const [key, detector] of Object.entries(this.patterns)) {
      // Use existing regex pattern (don't recreate)
      const regex = detector.pattern;

      // Reset lastIndex for global regexes to ensure correct matching
      regex.lastIndex = 0;

      let match;
      while ((match = regex.exec(text)) !== null) {
        const matchedText = match[0];

        // Validate if validation function exists
        if (detector.validate && !detector.validate(matchedText)) {
          continue; // Skip invalid matches
        }

        matches.push({
          text: matchedText,
          type: detector.name,
          start: match.index,
          end: match.index + matchedText.length
        });
      }
    }

    // Remove duplicates and overlaps
    return this.deduplicateMatches(matches);
  }

  /**
   * Remove duplicate and overlapping matches
   */
  deduplicateMatches(matches) {
    // Sort by start position
    matches.sort((a, b) => a.start - b.start);

    const result = [];
    let lastEnd = -1;

    for (const match of matches) {
      // Skip if this match overlaps with the previous one
      if (match.start < lastEnd) {
        continue;
      }

      result.push(match);
      lastEnd = match.end;
    }

    return result;
  }

  /**
   * Get statistics about detected PII types
   */
  getStatistics(matches) {
    const stats = {};

    for (const match of matches) {
      if (!stats[match.type]) {
        stats[match.type] = 0;
      }
      stats[match.type]++;
    }

    return stats;
  }

  /**
   * Format detected match for display
   */
  formatMatch(match) {
    const labels = {
      'SWISS_AVS': 'Swiss AVS/AHV Number',
      'IBAN': 'IBAN (Bank Account)',
      'SWISS_BANK_ACCOUNT': 'Swiss Bank Account',
      'EU_VAT': 'EU VAT Number',
      'SWISS_UID': 'Swiss Business ID (UID)',
      'EHIC': 'European Health Insurance Card',
      'PASSPORT': 'Passport Number',
      'LICENSE_PLATE': 'License Plate'
    };

    return {
      text: match.text,
      label: labels[match.type] || match.type,
      type: match.type
    };
  }
}

export default SwissEuDetector;
