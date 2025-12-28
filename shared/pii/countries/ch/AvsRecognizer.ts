/**
 * Swiss AVS/AHV Number Recognizer
 *
 * Detects Swiss social security numbers (AVS/AHV-Nummer).
 * Format: 756.XXXX.XXXX.XX (with dots) or 756XXXXXXXXXX (without)
 *
 * Features:
 * - Multiple format support (with/without dots)
 * - EAN-13 checksum validation
 * - Context words in DE/FR/IT/EN
 * - High priority (70) for Swiss-specific patterns
 *
 * @module shared/pii/countries/ch/AvsRecognizer
 */

import { BaseRecognizer } from '../../recognizers/BaseRecognizer.js';
import { RecognizerConfig } from '../../recognizers/types.js';

/**
 * Recognizer for Swiss AVS/AHV social security numbers.
 *
 * @example
 * ```typescript
 * const recognizer = new AvsRecognizer();
 * const matches = recognizer.analyze('My AVS is 756.1234.5678.97');
 * // Returns match with type 'SWISS_AVS', confidence 0.7
 * ```
 */
export class AvsRecognizer extends BaseRecognizer {
  readonly config: RecognizerConfig = {
    name: 'SwissAVS',
    supportedLanguages: ['de', 'fr', 'it', 'en'],
    supportedCountries: ['CH'],
    patterns: [
      {
        // Format with dots: 756.XXXX.XXXX.XX
        regex: /756\.\d{4}\.\d{4}\.\d{2}/,
        score: 0.7,
        entityType: 'SWISS_AVS',
        name: 'AVS with dots',
      },
      {
        // Format without dots: 756XXXXXXXXXX
        regex: /756\d{10}/,
        score: 0.6,
        entityType: 'SWISS_AVS',
        name: 'AVS without dots',
      },
    ],
    priority: 70, // High priority for country-specific patterns
    specificity: 'country',
    contextWords: [
      // German
      'ahv',
      'ahv-nummer',
      'ahvnummer',
      'sozialversicherung',
      'sozialversicherungsnummer',
      // French
      'avs',
      'numéro avs',
      'sécurité sociale',
      // Italian
      'avs',
      'numero avs',
      'previdenza sociale',
      // English
      'social security',
      'ssn',
    ],
    denyPatterns: [],
    useGlobalContext: true,
    useGlobalDenyList: true,
    validator: (match: string) => this.validateChecksum(match),
  };

  /**
   * Validate AVS number using EAN-13 checksum algorithm.
   *
   * The Swiss AVS number uses the EAN-13 checksum:
   * 1. Take first 12 digits
   * 2. Alternate multiply by 1 and 3
   * 3. Sum the results
   * 4. Checksum = (10 - (sum % 10)) % 10
   * 5. Must match the 13th digit
   *
   * @param avs - AVS number to validate (with or without dots)
   * @returns true if checksum is valid
   */
  private validateChecksum(avs: string): boolean {
    // Extract only digits
    const digits = avs.replace(/\D/g, '');

    // Must be exactly 13 digits
    if (digits.length !== 13) {
      return false;
    }

    // Must start with 756 (Swiss country code)
    if (!digits.startsWith('756')) {
      return false;
    }

    // EAN-13 checksum calculation
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(digits[i], 10);
      // Positions 0, 2, 4... multiply by 1; positions 1, 3, 5... multiply by 3
      sum += i % 2 === 0 ? digit : digit * 3;
    }

    const calculatedCheckDigit = (10 - (sum % 10)) % 10;
    const actualCheckDigit = parseInt(digits[12], 10);

    return calculatedCheckDigit === actualCheckDigit;
  }

  /**
   * Format an AVS number with dots for display.
   *
   * @param avs - AVS number (with or without dots)
   * @returns Formatted AVS number (e.g., "756.1234.5678.97")
   */
  static format(avs: string): string {
    const digits = avs.replace(/\D/g, '');
    if (digits.length !== 13) {
      return avs; // Return as-is if invalid
    }
    return `${digits.slice(0, 3)}.${digits.slice(3, 7)}.${digits.slice(7, 11)}.${digits.slice(11, 13)}`;
  }

  /**
   * Generate a valid AVS number for testing.
   * Uses the proper EAN-13 checksum calculation.
   *
   * @param partial - 12-digit partial AVS (without checksum)
   * @returns Complete 13-digit AVS number
   */
  static generateWithChecksum(partial: string): string {
    const digits = partial.replace(/\D/g, '');
    if (digits.length !== 12 || !digits.startsWith('756')) {
      throw new Error('Partial must be 12 digits starting with 756');
    }

    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(digits[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    return digits + checkDigit;
  }
}
