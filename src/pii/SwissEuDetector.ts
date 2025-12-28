/**
 * Swiss & European PII Detection Module
 *
 * TypeScript version that works in both Node.js (Electron) and browser environments.
 *
 * Provides rule-based detection for region-specific PII types:
 * - Swiss AVS/AHV numbers (Social Security)
 * - IBAN (International Bank Account Numbers)
 * - EU-specific identifiers
 *
 * Works alongside ML-based detection for comprehensive coverage.
 */

import { validateSwissAddress } from './validators/index.js';

export interface PIIMatch {
  text: string;
  type: string;
  start: number;
  end: number;
  source?: 'regex' | 'ml';
}

export interface FormattedMatch {
  text: string;
  label: string;
  type: string;
}

interface PatternDefinition {
  name: string;
  pattern: RegExp;
  validate: (match: string, context?: string) => boolean;
  extractGroup?: number; // If set, use this capturing group instead of full match
}

export class SwissEuDetector {
  private patterns: Record<string, PatternDefinition>;

  // Static IBAN country lengths lookup (avoid recreation on every validation)
  private static readonly IBAN_COUNTRY_LENGTHS: Record<string, number> = {
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

  // Type labels for display
  private static readonly TYPE_LABELS: Record<string, string> = {
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

  // Priority for deduplication (higher = higher priority)
  private static readonly TYPE_PRIORITY: Record<string, number> = {
    'IBAN': 100,
    'SWISS_AVS': 90,
    'EMAIL': 80,
    'SWISS_BANK_ACCOUNT': 70,
    'SWISS_UID': 60,
    'EU_VAT': 50,
    'PASSPORT': 40,
    'LICENSE_PLATE': 30,
    'PHONE': 20,
    'ADDRESS': 15,
    'ORG': 10,
    'DATE': 5,
    'ID_NUMBER': 1,
    'EHIC': 1,
  };

  constructor() {
    this.patterns = this.initializePatterns();
  }

  /**
   * Initialize all regex patterns for Swiss/EU PII
   */
  private initializePatterns(): Record<string, PatternDefinition> {
    return {
      // IBAN (International Bank Account Number) - MUST BE FIRST for priority
      IBAN: {
        name: 'IBAN',
        pattern: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}\b/g,
        validate: (match) => this.validateIBAN(match),
      },

      // IBAN with spaces/dashes (common formatting)
      IBAN_FORMATTED: {
        name: 'IBAN',
        pattern: /\b[A-Z]{2}[\s-]?[0-9]{2}(?:[\s-]?[A-Z0-9]{4}){2,7}(?:[\s-]?[A-Z0-9]{1,3})?\b/g,
        validate: (match) => this.validateIBAN(match.replace(/[\s-]/g, '')),
      },

      // Swiss AVS/AHV Number (Swiss Social Security)
      // Format: 756.XXXX.XXXX.XX
      SWISS_AVS: {
        name: 'SWISS_AVS',
        pattern: /\b756\.\d{4}\.\d{4}\.\d{2}\b/g,
        validate: (match) => this.validateSwissAVS(match),
      },

      // Swiss AVS without dots
      SWISS_AVS_NODOTS: {
        name: 'SWISS_AVS',
        pattern: /\b756\d{10}\b/g,
        validate: (match) => this.validateSwissAVSNoDots(match),
      },

      // Partially masked AVS
      SWISS_AVS_MASKED: {
        name: 'SWISS_AVS',
        pattern: /\b756\.(?:\d{4}|X{4}|\*{4})\.(?:\d{4}|X{4}|\*{4})\.(?:\d{2}|X{2}|\*{2})\b/gi,
        validate: () => true,
      },

      // Swiss Bank Account Number (legacy format)
      SWISS_BANK_ACCOUNT: {
        name: 'SWISS_BANK_ACCOUNT',
        pattern: /\b\d{2}-\d{5,6}-\d\b/g,
        validate: () => true,
      },

      // EU VAT Numbers
      EU_VAT: {
        name: 'EU_VAT',
        pattern: /\b(AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)U?[0-9A-Z]{8,12}\b/g,
        validate: () => true,
      },

      // Swiss UID (Unternehmens-Identifikationsnummer)
      SWISS_UID: {
        name: 'SWISS_UID',
        pattern: /\bCHE-\d{3}\.\d{3}\.\d{3}(?:\s+(?:MWST|TVA|IVA))?\b/g,
        validate: () => true,
      },

      // Swiss Passport Number
      SWISS_PASSPORT: {
        name: 'PASSPORT',
        pattern: /\b[A-Z]\d{7}\b/g,
        validate: (match) => /^[A-Z]\d{7}$/.test(match),
      },

      // Swiss License Plate
      SWISS_LICENSE_PLATE: {
        name: 'LICENSE_PLATE',
        pattern: /\b(AG|AI|AR|BE|BL|BS|FR|GE|GL|GR|JU|LU|NE|NW|OW|SG|SH|SO|SZ|TG|TI|UR|VD|VS|ZG|ZH)\s?\d{1,6}\b/g,
        validate: () => true,
      },

      // Phone Numbers (Swiss/International)
      PHONE_NUMBER: {
        name: 'PHONE',
        pattern: /(?:\+41|0041|0)[\s-]?\(?\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}|(?:\+|00)\d{1,3}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,4}(?:[\s-]?\d{1,4})?/g,
        validate: (match, context) => this.validatePhoneNumber(match, context),
      },

      // Partially masked phone numbers
      PHONE_MASKED: {
        name: 'PHONE',
        pattern: /(?:\+41|0041|0)[\s-]?\(?\d{2}\)?[\s-]?(?:\d{3}|X{3}|\*{3})[\s-]?(?:\d{2}|X{2}|\*{2})[\s-]?(?:\d{2}|X{2}|\*{2})/gi,
        validate: () => true,
      },

      // Email Addresses
      EMAIL: {
        name: 'EMAIL',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        validate: (match) => this.validateEmail(match),
      },

      // Email addresses split across lines (common in PDFs)
      // Username must start with alphanumeric and not end with a period (to avoid matching "word.@domain")
      EMAIL_MULTILINE: {
        name: 'EMAIL',
        pattern: /\b[A-Za-z0-9][A-Za-z0-9._%+-]*[A-Za-z0-9]\s*[\r\n]+\s*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        validate: (match) => this.validateEmail(match.replace(/\s+/g, '')),
      },

      // Partially masked email addresses
      EMAIL_MASKED: {
        name: 'EMAIL',
        pattern: /\b[A-Za-z0-9._%+-]*(?:\*{3,}|X{3,})[A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi,
        validate: () => true,
      },

      // Swiss Date Formats
      SWISS_DATE: {
        name: 'DATE',
        pattern: /\b(?:0?[1-9]|[12][0-9]|3[01])\.(?:0?[1-9]|1[012])\.(?:19|20)\d{2}\b/g,
        validate: (match) => this.validateDate(match),
      },

      // Swiss Postal Code + City
      SWISS_ADDRESS: {
        name: 'ADDRESS',
        pattern: /\b\d{4}[^\S\n]+[A-ZÀ-ÖØ-Ýa-zà-öø-ÿ][A-ZÀ-ÖØ-Ýa-zà-öø-ÿ-']+(?:[^\S\n]+[A-ZÀ-ÖØ-Ýa-zà-öø-ÿ][A-ZÀ-ÖØ-Ýa-zà-öø-ÿ-']+)?\b/g,
        validate: (match, context) => this.validateSwissAddressInternal(match, context),
      },

      // Street Address with Number (Swiss/EU format: "Street Name Number")
      // Matches: Rue/Route/Chemin/Avenue/Rte/Ch./Av./Boulevard/Bd/Allée/Place/Platz/Strasse/Str. + name + number
      STREET_ADDRESS: {
        name: 'ADDRESS',
        pattern: /\b(?:Rue|Route|Rte|Chemin|Ch\.|Avenue|Av\.|Boulevard|Bd|Allée|Place|Platz|Strasse|Str\.|Via|Viale|Corso|Piazza)(?:\s+(?:de\s+la|du|de|des|dell[ao']?|della|degli|dei))?\s+[A-ZÀ-ÖØ-Ýa-zà-öø-ÿ][A-ZÀ-ÖØ-Ýa-zà-öø-ÿ\s\-']{1,30}\s+\d{1,4}[A-Za-z]?\b/gi,
        validate: (match) => this.validateStreetAddress(match),
      },

      // Company Name Suffixes
      COMPANY_NAME: {
        name: 'ORG',
        pattern: /\b[A-ZÀ-ÖØ-Ý][A-Za-zÀ-ÖØ-Ýà-öø-ÿ\s&\-']{2,}\s+(?:SA|GmbH|AG|Sàrl|SARL|Ltd|Inc|Corp|SAS|EURL)\b/g,
        validate: () => true,
      },

      // Contract/Reference Numbers
      CONTRACT_NUMBER: {
        name: 'ID_NUMBER',
        pattern: /\b\d{2,3}'?\d{3}'?\d{3}\b/g,
        validate: () => true,
      },

      // Person Names - Contextual patterns to minimize false positives
      // IMPORTANT: Do NOT use the 'i' flag - it makes [a-z] match uppercase too!
      // Name before telephone indicator (common in business letters)
      // extractGroup: 1 tells the detector to use capturing group 1 instead of full match
      PERSON_NAME_TEL: {
        name: 'PERSON_NAME',
        pattern: /([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]+){1,3}),?\s*(?:[Tt][ée]l\.?|[Tt]éléphone)/g,
        validate: (match) => this.validatePersonName(match),
        extractGroup: 1,
      },

      // Name after "référence" or "reference" (common in business correspondence)
      PERSON_NAME_REF: {
        name: 'PERSON_NAME',
        pattern: /(?:[Rr][ée]f[ée]rence|[Cc]ontact)\s+([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]+){1,3})/g,
        validate: (match) => this.validatePersonName(match),
        extractGroup: 1,
      },

      // Names in signature blocks (FirstName LastName pattern on its own line or after salutations)
      // This uses a lookahead to ensure the pattern isn't followed by business terms
      PERSON_NAME_SIG: {
        name: 'PERSON_NAME',
        pattern: /\b([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]+\s+[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]+)(?=\s+[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]+\s+[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]+\s*$|\s*$)/gm,
        validate: (match) => this.validatePersonName(match),
        extractGroup: 1,
      },
    };
  }

  /**
   * Validate person name to reduce false positives
   */
  private validatePersonName(name: string): boolean {
    if (!name || name.length < 3) return false;

    // Split into parts
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return false;

    // Check each part is a valid name part (not all caps, not a common word)
    const commonWords = new Set([
      'fondation', 'collective', 'case', 'postale', 'notre', 'votre',
      'zurich', 'suisse', 'switzerland', 'scanning', 'assurances',
      'chemin', 'route', 'rue', 'avenue', 'visiteurs', 'direct',
      'technologies', 'softcom', 'vita', 'mesdames', 'messieurs',
    ]);

    for (const part of parts) {
      const lowerPart = part.toLowerCase();
      if (commonWords.has(lowerPart)) return false;
      // Reject if part is all uppercase (likely acronym)
      if (part === part.toUpperCase() && part.length > 2) return false;
    }

    return true;
  }

  /**
   * Detect all Swiss/EU PII in text
   */
  detect(text: string): PIIMatch[] {
    const matches: PIIMatch[] = [];

    for (const [key, detector] of Object.entries(this.patterns)) {
      const regex = detector.pattern;
      regex.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null) {
        // Use capturing group if specified, otherwise use full match
        const extractGroup = (detector as { extractGroup?: number }).extractGroup;
        const matchedText = extractGroup !== undefined && match[extractGroup]
          ? match[extractGroup]
          : match[0];

        // Calculate correct start position for capturing groups
        let matchStart = match.index;
        if (extractGroup !== undefined && match[extractGroup]) {
          // Find the actual position of the capturing group within the full match
          const fullMatch = match[0];
          const groupMatch = match[extractGroup];
          const groupOffset = fullMatch.indexOf(groupMatch);
          if (groupOffset >= 0) {
            matchStart = match.index + groupOffset;
          }
        }

        // Context-aware false positive prevention for phone numbers
        if (detector.name === 'PHONE' && (key === 'PHONE_NUMBER' || key === 'PHONE_MASKED')) {
          const start = Math.max(0, match.index - 50);
          const end = Math.min(text.length, match.index + matchedText.length + 50);
          const context = text.substring(start, end);

          const productPrefixes = ['ART-', 'SKU-', 'PROD-', 'REF-', 'CODE-', 'ITEM-', 'CAT-', 'Model:', 'Product:', 'Serial:', 'Part:'];
          const isProductCode = productPrefixes.some(prefix => {
            const prefixPos = context.toLowerCase().indexOf(prefix.toLowerCase());
            return prefixPos >= 0 && prefixPos < (match!.index - start + 10);
          });

          const hasDashPattern = /\w+-\d+-\d+-\d+/.test(matchedText) || Boolean(matchedText.match(/-.*-.*-/));

          if (isProductCode || hasDashPattern) {
            continue;
          }
        }

        // Validate if validation function exists
        if (!detector.validate(matchedText, text)) {
          continue;
        }

        matches.push({
          text: matchedText,
          type: detector.name,
          start: matchStart,
          end: matchStart + matchedText.length,
          source: 'regex',
        });
      }
    }

    return this.deduplicateMatches(matches);
  }

  /**
   * Remove duplicate and overlapping matches with priority handling
   */
  private deduplicateMatches(matches: PIIMatch[]): PIIMatch[] {
    const typePriority = SwissEuDetector.TYPE_PRIORITY;

    matches.sort((a, b) => {
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      const priorityA = typePriority[a.type] || 0;
      const priorityB = typePriority[b.type] || 0;
      return priorityB - priorityA;
    });

    const result: PIIMatch[] = [];

    for (const match of matches) {
      const hasOverlap = result.some(existing => {
        const overlaps = match.start < existing.end && match.end > existing.start;

        if (overlaps) {
          const matchPriority = typePriority[match.type] || 0;
          const existingPriority = typePriority[existing.type] || 0;

          if (matchPriority > existingPriority) {
            const index = result.indexOf(existing);
            result.splice(index, 1);
            return false;
          }
          return true;
        }
        return false;
      });

      if (!hasOverlap) {
        result.push(match);
      }
    }

    return result.sort((a, b) => a.start - b.start);
  }

  // ==================== Validation Methods ====================

  /**
   * Validate Swiss AVS/AHV number using EAN-13 checksum
   */
  private validateSwissAVS(avsNumber: string): boolean {
    const cleaned = avsNumber.replace(/\./g, '');
    if (!/^756\d{10}$/.test(cleaned)) {
      return false;
    }
    return this.validateEAN13Checksum(cleaned);
  }

  /**
   * Validate Swiss AVS without dots
   */
  private validateSwissAVSNoDots(avsNumber: string): boolean {
    if (!/^756\d{10}$/.test(avsNumber)) {
      return false;
    }
    return this.validateEAN13Checksum(avsNumber);
  }

  /**
   * EAN-13 checksum algorithm (used by Swiss AVS)
   */
  private validateEAN13Checksum(number: string): boolean {
    if (number.length !== 13) return false;

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const char = number.charAt(i);
      const digit = parseInt(char, 10);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }

    const checksum = (10 - (sum % 10)) % 10;
    return checksum === parseInt(number.charAt(12), 10);
  }

  /**
   * Validate IBAN using mod-97 algorithm
   */
  private validateIBAN(iban: string): boolean {
    const cleaned = iban.replace(/\s/g, '').toUpperCase();

    if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(cleaned)) {
      return false;
    }

    const countryCode = cleaned.substring(0, 2);
    const expectedLength = SwissEuDetector.IBAN_COUNTRY_LENGTHS[countryCode];

    if (!expectedLength || cleaned.length !== expectedLength) {
      return false;
    }

    // Mod-97 validation
    const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);

    let numericString = '';
    for (const char of rearranged) {
      if (/[A-Z]/.test(char)) {
        numericString += (char.charCodeAt(0) - 55).toString();
      } else {
        numericString += char;
      }
    }

    return this.mod97(numericString) === 1;
  }

  /**
   * Calculate mod 97 for large numbers
   */
  private mod97(numericString: string): number {
    let remainder = 0;
    for (const digit of numericString) {
      remainder = (remainder * 10 + parseInt(digit, 10)) % 97;
    }
    return remainder;
  }

  /**
   * Validate phone number
   */
  private validatePhoneNumber(phone: string, _context = ''): boolean {
    const cleaned = phone.replace(/[\s\-()]/g, '');

    if (cleaned.length < 10) return false;
    if (/^(\d)\1+$/.test(cleaned)) return false;

    const phoneDigits = cleaned.replace(/^(\+41|0041|41|0)/, '');
    if (/^0+$/.test(phoneDigits)) return false;

    return true;
  }

  /**
   * Validate email address
   */
  private validateEmail(email: string): boolean {
    const parts = email.split('@');
    if (parts.length !== 2) return false;

    const local = parts[0];
    const domain = parts[1];

    if (!local || local.length > 64) return false;
    if (!domain || !domain.includes('.')) return false;

    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2) return false;

    return true;
  }

  /**
   * Validate Swiss address (postal code + city)
   * Delegates to the SwissAddressValidator for comprehensive year false-positive detection.
   */
  private validateSwissAddressInternal(address: string, fullText = ''): boolean {
    return validateSwissAddress(address, fullText);
  }

  /**
   * Validate street address (Street Name + Number)
   */
  private validateStreetAddress(address: string): boolean {
    if (!address || address.length < 5) return false;

    // Must contain a number (house number)
    if (!/\d+[A-Za-z]?\s*$/.test(address)) return false;

    // Extract the street name part (without the number)
    const streetName = address.replace(/\s+\d+[A-Za-z]?\s*$/, '').trim();

    // Street name should be at least 3 chars (e.g., "Rue X" after prefix)
    if (streetName.length < 5) return false;

    // Avoid matching things that look like addresses but aren't
    const falsePositives = ['case postale', 'postfach', 'p.o. box', 'boîte postale'];
    const lowerAddress = address.toLowerCase();
    for (const fp of falsePositives) {
      if (lowerAddress.includes(fp)) return false;
    }

    return true;
  }

  /**
   * Validate date format
   */
  private validateDate(date: string): boolean {
    const parts = date.split('.');
    if (parts.length !== 3) return false;

    const dayStr = parts[0];
    const monthStr = parts[1];
    const yearStr = parts[2];
    if (!dayStr || !monthStr || !yearStr) return false;

    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    if (day < 1 || day > 31) return false;
    if (month < 1 || month > 12) return false;
    if (year < 1900 || year > 2100) return false;

    return true;
  }

  // ==================== Utility Methods ====================

  /**
   * Get statistics about detected PII types
   */
  getStatistics(matches: PIIMatch[]): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const match of matches) {
      stats[match.type] = (stats[match.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Format detected match for display
   */
  formatMatch(match: PIIMatch): FormattedMatch {
    return {
      text: match.text,
      label: SwissEuDetector.TYPE_LABELS[match.type] || match.type,
      type: match.type,
    };
  }

  /**
   * Get human-readable label for a PII type
   */
  getTypeLabel(type: string): string {
    return SwissEuDetector.TYPE_LABELS[type] || type;
  }
}

export default SwissEuDetector;
