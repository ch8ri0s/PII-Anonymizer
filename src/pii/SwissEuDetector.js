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
    'XK': 20,
  };

  constructor() {
    this.patterns = this.initializePatterns();
  }

  /**
   * Initialize all regex patterns for Swiss/EU PII
   */
  initializePatterns() {
    return {
      // IBAN (International Bank Account Number) - MUST BE FIRST for priority
      // Universal pattern with country code validation
      // Format: CH93 0076 2011 6238 5295 7 (Swiss example)
      IBAN: {
        name: 'IBAN',
        pattern: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}\b/g,
        validate: this.validateIBAN.bind(this),
      },

      // IBAN with spaces/dashes (common formatting) - HIGH PRIORITY
      IBAN_FORMATTED: {
        name: 'IBAN',
        pattern: /\b[A-Z]{2}[\s-]?[0-9]{2}(?:[\s-]?[A-Z0-9]{4}){2,7}(?:[\s-]?[A-Z0-9]{1,3})?\b/g,
        validate: (match) => this.validateIBAN(match.replace(/[\s-]/g, '')),
      },

      // Swiss AVS/AHV Number (Swiss Social Security)
      // Format: 756.XXXX.XXXX.XX
      // Example: 756.9217.0769.85
      SWISS_AVS: {
        name: 'SWISS_AVS',
        pattern: /\b756\.\d{4}\.\d{4}\.\d{2}\b/g,
        validate: this.validateSwissAVS.bind(this),
      },

      // Swiss AVS without dots (also common)
      // Format: 7569217076985
      SWISS_AVS_NODOTS: {
        name: 'SWISS_AVS',
        pattern: /\b756\d{10}\b/g,
        validate: this.validateSwissAVSNoDots.bind(this),
      },

      // Partially masked AVS (for already redacted documents)
      // Format: 756.XXXX.5678.97 or 756.****.****.97
      SWISS_AVS_MASKED: {
        name: 'SWISS_AVS',
        pattern: /\b756\.(?:\d{4}|X{4}|\*{4})\.(?:\d{4}|X{4}|\*{4})\.(?:\d{2}|X{2}|\*{2})\b/gi,
        validate: () => true, // Accept masked versions as valid
      },

      // Swiss Bank Account Number (legacy format before IBAN)
      // Format: BC-XXXXX-X (BC = Bank Code, 5-6 digits, check digit)
      SWISS_BANK_ACCOUNT: {
        name: 'SWISS_BANK_ACCOUNT',
        pattern: /\b\d{2}-\d{5,6}-\d\b/g,
        validate: () => true, // Simple format check is sufficient
      },

      // EU VAT Numbers (various formats)
      // Covers major EU countries
      EU_VAT: {
        name: 'EU_VAT',
        pattern: /\b(AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)U?[0-9A-Z]{8,12}\b/g,
        validate: () => true, // Country-specific validation can be added
      },

      // Swiss UID (Unternehmens-Identifikationsnummer)
      // Format: CHE-123.456.789 (Business Identification Number)
      SWISS_UID: {
        name: 'SWISS_UID',
        pattern: /\bCHE-\d{3}\.\d{3}\.\d{3}(?:\s+(?:MWST|TVA|IVA))?\b/g,
        validate: () => true,
      },

      // European Health Insurance Card (EHIC) Number
      // Format varies by country, but typically 16-20 digits
      EHIC: {
        name: 'EHIC',
        pattern: /\b\d{16,20}\b/g,
        validate: this.validateEHIC.bind(this),
      },

      // Swiss Passport Number
      // Format: Letter + 7 digits (e.g., P1234567)
      SWISS_PASSPORT: {
        name: 'PASSPORT',
        pattern: /\b[A-Z]\d{7}\b/g,
        validate: (match) => /^[A-Z]\d{7}$/.test(match),
      },

      // Swiss License Plate
      // Format: ZH 123456 (canton code + up to 6 digits)
      SWISS_LICENSE_PLATE: {
        name: 'LICENSE_PLATE',
        pattern: /\b(AG|AI|AR|BE|BL|BS|FR|GE|GL|GR|JU|LU|NE|NW|OW|SG|SH|SO|SZ|TG|TI|UR|VD|VS|ZG|ZH)\s?\d{1,6}\b/g,
        validate: () => true,
      },

      // Swiss/International Phone Numbers
      // Swiss format: +41 XX XXX XX XX or 0XX XXX XX XX or +41 (XX) XXX XX XX
      // Handles formats with or without spaces/dashes/brackets
      PHONE_NUMBER: {
        name: 'PHONE',
        pattern: /(?:\+41|0041|0)[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|(?:\+|00)\d{1,3}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,4}(?:[\s-]?\d{1,4})?/g,
        validate: this.validatePhoneNumber.bind(this),
      },

      // Partially masked phone numbers (for already redacted documents)
      // Format: +41 21 XXX XX 37 or +41 21 *** ** 37
      PHONE_MASKED: {
        name: 'PHONE',
        pattern: /(?:\+41|0041|0)[\s-]?\(?\d{2}\)?[\s-]?(?:\d{3}|X{3}|\*{3})[\s-]?(?:\d{2}|X{2}|\*{2})[\s-]?(?:\d{2}|X{2}|\*{2})/gi,
        validate: () => true, // Accept masked versions as valid
      },

      // Email Addresses
      // Standard email pattern with Unicode support for international domains
      EMAIL: {
        name: 'EMAIL',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        validate: this.validateEmail.bind(this),
      },

      // Partially masked email addresses (for already redacted documents)
      // Format: b.figue***@zurich.ch or user***@domain.com
      EMAIL_MASKED: {
        name: 'EMAIL',
        pattern: /\b[A-Za-z0-9._%+-]*(?:\*{3,}|X{3,})[A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi,
        validate: () => true, // Accept masked versions as valid
      },

      // Swiss Date Formats - MUST BE BEFORE ADDRESS to avoid false positives
      // DD.MM.YYYY or DD/MM/YYYY (common in Swiss documents)
      SWISS_DATE: {
        name: 'DATE',
        pattern: /\b(?:0?[1-9]|[12][0-9]|3[01])\.(?:0?[1-9]|1[012])\.(?:19|20)\d{2}\b/g,
        validate: this.validateDate.bind(this),
      },

      // Swiss Postal Code + City
      // Format: 1700 Fribourg, 8085 Zurich, etc.
      // Excludes year-like numbers (19XX, 20XX followed by "and", "or", punctuation)
      SWISS_ADDRESS: {
        name: 'ADDRESS',
        pattern: /\b\d{4}\s+[A-ZÀ-ÖØ-Ýa-zà-öø-ÿ][A-ZÀ-ÖØ-Ýa-zà-öø-ÿ\s-']{2,}\b/g,
        validate: this.validateSwissAddress.bind(this),
      },

      // Company Name Suffixes (Swiss/German/French)
      // SA, GmbH, AG, Sàrl, etc.
      COMPANY_NAME: {
        name: 'ORG',
        pattern: /\b[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-Ýà-öø-ÿ\s&\-']{2,}\s+(?:SA|GmbH|AG|Sàrl|SARL|Ltd|Inc|Corp|SAS|EURL)\b/g,
        validate: () => true,
      },

      // Contract/Reference Numbers
      // Format: XXX'XXX'XXX (Swiss number formatting with apostrophes)
      CONTRACT_NUMBER: {
        name: 'ID_NUMBER',
        pattern: /\b\d{2,3}'?\d{3}'?\d{3}\b/g,
        validate: () => true,
      },
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
    const _prefix = number.substring(0, 4);

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

        // Context-aware false positive prevention for phone numbers
        if (detector.name === 'PHONE' && (key === 'PHONE_NUMBER' || key === 'PHONE_MASKED')) {
          // Get surrounding context (50 chars before and after)
          const start = Math.max(0, match.index - 50);
          const end = Math.min(text.length, match.index + matchedText.length + 50);
          const context = text.substring(start, end);

          // Check for product code patterns that might look like phone numbers
          const productPrefixes = ['ART-', 'SKU-', 'PROD-', 'REF-', 'CODE-', 'ITEM-', 'CAT-', 'Model:', 'Product:', 'Serial:', 'Part:'];
          const isProductCode = productPrefixes.some(prefix => {
            const prefixPos = context.toLowerCase().indexOf(prefix.toLowerCase());
            return prefixPos >= 0 && prefixPos < (match.index - start + 10);
          });

          // Also check if the match itself contains dashes in product code pattern (XXX-XXX-XXX-XXX)
          const hasDashPattern = /\w+-\d+-\d+-\d+/.test(matchedText) || matchedText.match(/-.*-.*-/);

          if (isProductCode || hasDashPattern) {
            continue; // Skip product codes
          }
        }

        // Validate if validation function exists
        if (detector.validate && !detector.validate(matchedText, text)) {
          continue; // Skip invalid matches
        }

        matches.push({
          text: matchedText,
          type: detector.name,
          start: match.index,
          end: match.index + matchedText.length,
        });
      }
    }

    // Remove duplicates and overlaps
    return this.deduplicateMatches(matches);
  }

  /**
   * Remove duplicate and overlapping matches with priority handling
   */
  deduplicateMatches(matches) {
    // Define priority order (higher number = higher priority)
    const typePriority = {
      'IBAN': 100,           // Highest priority - most specific
      'SWISS_AVS': 90,
      'EMAIL': 80,
      'SWISS_BANK_ACCOUNT': 70,
      'SWISS_UID': 60,
      'EU_VAT': 50,
      'PASSPORT': 40,
      'LICENSE_PLATE': 30,
      'PHONE': 20,           // Lower priority - can have false positives
      'ADDRESS': 15,
      'ORG': 10,
      'DATE': 5,
      'ID_NUMBER': 1,
      'EHIC': 1,
    };

    // Sort by start position first, then by priority
    matches.sort((a, b) => {
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      const priorityA = typePriority[a.type] || 0;
      const priorityB = typePriority[b.type] || 0;
      return priorityB - priorityA; // Higher priority first
    });

    const result = [];

    for (const match of matches) {
      // Check if this match overlaps with any existing match in result
      const hasOverlap = result.some(existing => {
        // Check for overlap: match starts before existing ends AND match ends after existing starts
        const overlaps = (match.start < existing.end && match.end > existing.start);

        if (overlaps) {
          // If there's overlap, keep the one with higher priority
          const matchPriority = typePriority[match.type] || 0;
          const existingPriority = typePriority[existing.type] || 0;

          if (matchPriority > existingPriority) {
            // Remove the existing lower-priority match
            const index = result.indexOf(existing);
            result.splice(index, 1);
            return false; // Don't skip this match
          }
          return true; // Skip this match (existing has higher priority)
        }
        return false;
      });

      if (!hasOverlap) {
        result.push(match);
      }
    }

    // Final sort by start position
    result.sort((a, b) => a.start - b.start);

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
   * Validate phone number with context-aware false positive prevention
   */
  validatePhoneNumber(phone, _context = '') {
    // Remove spaces, dashes, and brackets for validation
    const cleaned = phone.replace(/[\s\-()]/g, '');

    // Must be at least 10 digits (including country code)
    if (cleaned.length < 10) return false;

    // Must not be all same digit (e.g., 0000000000)
    if (/^(\d)\1+$/.test(cleaned)) return false;

    // Extract just the phone number digits (after country code)
    // For Swiss numbers: +41 or 0041 or 0
    const phoneDigits = cleaned.replace(/^(\+41|0041|41|0)/, '');

    // Must not be all zeros in the actual phone number part
    if (/^0+$/.test(phoneDigits)) return false;

    return true;
  }

  /**
   * Validate email address
   */
  validateEmail(email) {
    // Basic email validation
    const parts = email.split('@');
    if (parts.length !== 2) return false;

    const [local, domain] = parts;

    // Local part should not be empty or too long
    if (!local || local.length > 64) return false;

    // Domain should have at least one dot and valid TLD
    if (!domain.includes('.')) return false;

    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2) return false;

    return true;
  }

  /**
   * Validate Swiss address (postal code + city)
   */
  validateSwissAddress(address) {
    // Swiss postal codes are 1000-9999
    const postalCode = parseInt(address.substring(0, 4), 10);
    if (postalCode < 1000 || postalCode > 9999) return false;

    // City name should be at least 3 characters
    const city = address.substring(4).trim();
    if (city.length < 3) return false;

    // Exclude year-like patterns followed by common words (not addresses)
    // e.g., "2024 and", "2025 or", "1990 was"
    const yearExclusionPattern = /^(19|20)\d{2}\s+(and|or|was|is|to|by|in|at|for|from|the|a|an)\b/i;
    if (yearExclusionPattern.test(address)) return false;

    return true;
  }

  /**
   * Validate date format
   */
  validateDate(date) {
    const parts = date.split('.');
    if (parts.length !== 3) return false;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);

    // Basic range validation
    if (day < 1 || day > 31) return false;
    if (month < 1 || month > 12) return false;
    if (year < 1900 || year > 2100) return false;

    return true;
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
      'LICENSE_PLATE': 'License Plate',
      'PHONE': 'Phone Number',
      'EMAIL': 'Email Address',
      'ADDRESS': 'Address',
      'ORG': 'Organization',
      'DATE': 'Date',
      'ID_NUMBER': 'ID/Reference Number',
    };

    return {
      text: match.text,
      label: labels[match.type] || match.type,
      type: match.type,
    };
  }
}

export default SwissEuDetector;
