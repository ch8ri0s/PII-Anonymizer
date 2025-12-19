/**
 * Address Component Classifier (Story 2.1)
 *
 * Classifies text segments as address components (street, number, postal code, city, country)
 * to enable relationship-based address grouping.
 *
 * Supports Swiss and EU address formats in EN/FR/DE.
 */

import {
  AddressComponent,
  AddressComponentType,
  Entity,
  EntityType,
} from '../types/detection.js';
import { generateEntityId } from './DetectionPipeline.js';

/**
 * Swiss postal code ranges by canton
 * Source: Swiss Post
 */
const SWISS_POSTAL_RANGES: Array<{ min: number; max: number; canton: string }> = [
  { min: 1000, max: 1299, canton: 'VD' },
  { min: 1300, max: 1399, canton: 'VD/VS' },
  { min: 1400, max: 1499, canton: 'VD' },
  { min: 1500, max: 1599, canton: 'FR/VD' },
  { min: 1600, max: 1699, canton: 'FR/VD' },
  { min: 1700, max: 1799, canton: 'FR' },
  { min: 1800, max: 1899, canton: 'VD/VS' },
  { min: 1900, max: 1999, canton: 'VS' },
  { min: 2000, max: 2099, canton: 'NE' },
  { min: 2100, max: 2199, canton: 'NE' },
  { min: 2200, max: 2299, canton: 'NE' },
  { min: 2300, max: 2399, canton: 'NE/BE' },
  { min: 2400, max: 2499, canton: 'NE/BE' },
  { min: 2500, max: 2599, canton: 'BE' },
  { min: 2600, max: 2699, canton: 'BE/SO' },
  { min: 2700, max: 2799, canton: 'BE/JU' },
  { min: 2800, max: 2899, canton: 'JU' },
  { min: 2900, max: 2999, canton: 'JU' },
  { min: 3000, max: 3999, canton: 'BE' },
  { min: 4000, max: 4999, canton: 'BS/BL/SO/AG' },
  { min: 5000, max: 5999, canton: 'AG/SO' },
  { min: 6000, max: 6999, canton: 'LU/ZG/SZ/NW/OW/UR/TI' },
  { min: 7000, max: 7999, canton: 'GR' },
  { min: 8000, max: 8999, canton: 'ZH/SH/TG/SG' },
  { min: 9000, max: 9999, canton: 'SG/AR/AI/TG/SH' },
];

/**
 * Major Swiss cities with multilingual variants
 */
const SWISS_CITIES: Map<string, string[]> = new Map([
  ['zurich', ['zürich', 'zurich', 'zurigo']],
  ['geneva', ['genève', 'geneva', 'genf', 'ginevra']],
  ['basel', ['basel', 'bâle', 'basilea']],
  ['bern', ['bern', 'berne', 'berna']],
  ['lausanne', ['lausanne', 'losanna']],
  ['winterthur', ['winterthur', 'winterthour']],
  ['lucerne', ['luzern', 'lucerne', 'lucerna']],
  ['stgallen', ['st. gallen', 'st.gallen', 'saint-gall', 'san gallo']],
  ['lugano', ['lugano']],
  ['biel', ['biel', 'bienne']],
  ['thun', ['thun', 'thoune']],
  ['fribourg', ['fribourg', 'freiburg', 'friburgo']],
  ['neuchatel', ['neuchâtel', 'neuchatel', 'neuenburg']],
  ['sion', ['sion', 'sitten']],
  ['chur', ['chur', 'coire', 'coira']],
  ['montreux', ['montreux']],
  ['zug', ['zug', 'zoug']],
]);

/**
 * EU country names in multiple languages
 */
const EU_COUNTRIES: Map<string, string[]> = new Map([
  ['switzerland', ['switzerland', 'suisse', 'schweiz', 'svizzera', 'ch']],
  ['germany', ['germany', 'allemagne', 'deutschland', 'de']],
  ['france', ['france', 'frankreich', 'francia', 'fr']],
  ['italy', ['italy', 'italie', 'italien', 'italia', 'it']],
  ['austria', ['austria', 'autriche', 'österreich', 'at']],
  ['liechtenstein', ['liechtenstein', 'li']],
  ['belgium', ['belgium', 'belgique', 'belgien', 'belgio', 'be']],
  ['netherlands', ['netherlands', 'pays-bas', 'niederlande', 'paesi bassi', 'nl']],
  ['luxembourg', ['luxembourg', 'luxemburg', 'lussemburgo', 'lu']],
]);

/**
 * Street type suffixes in multiple languages
 */
const STREET_SUFFIXES: string[] = [
  // German
  'strasse', 'straße', 'str.', 'str', 'weg', 'gasse', 'platz', 'allee', 'ring', 'damm',
  // French
  'rue', 'avenue', 'av.', 'av', 'boulevard', 'blvd', 'chemin', 'ch.', 'place', 'pl.',
  'route', 'rte', 'allée', 'impasse', 'passage', 'quai',
  // Italian
  'via', 'viale', 'piazza', 'corso', 'vicolo', 'largo',
  // English
  'street', 'st.', 'road', 'rd.', 'lane', 'ln.', 'drive', 'dr.', 'court', 'ct.',
  'avenue', 'ave.', 'boulevard', 'blvd.', 'way', 'circle',
];

/**
 * Configuration for address classification
 */
export interface AddressClassifierConfig {
  /** Maximum distance between components to consider for grouping (chars) */
  maxComponentDistance: number;
  /** Minimum confidence for Swiss postal code (with validation) */
  swissPostalMinConfidence: number;
  /** Language for classification hints */
  language?: 'en' | 'fr' | 'de';
}

const DEFAULT_CONFIG: AddressClassifierConfig = {
  maxComponentDistance: 50,
  swissPostalMinConfidence: 0.8,
  language: 'de',
};

/**
 * Address Component Classifier
 *
 * Identifies and classifies address components in text, preparing them
 * for proximity-based grouping into complete addresses.
 */
export class AddressClassifier {
  private config: AddressClassifierConfig;

  constructor(config: Partial<AddressClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Classify all address components in the given text
   */
  classifyComponents(text: string): AddressComponent[] {
    const components: AddressComponent[] = [];

    // Find street names
    components.push(...this.findStreetNames(text));

    // Find street numbers
    components.push(...this.findStreetNumbers(text, components));

    // Find postal codes
    components.push(...this.findPostalCodes(text));

    // Find cities
    components.push(...this.findCities(text));

    // Find countries
    components.push(...this.findCountries(text));

    // Sort by position
    return components.sort((a, b) => a.start - b.start);
  }

  /**
   * Find street names in text
   */
  private findStreetNames(text: string): AddressComponent[] {
    const components: AddressComponent[] = [];

    // Pattern: Word(s) followed by street suffix
    // Examples: "Bahnhofstrasse", "Rue de Lausanne", "Via Roma"
    for (const suffix of STREET_SUFFIXES) {
      const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Pattern for suffix at end: "Bahnhofstrasse", "Hauptstr."
      const suffixEndPattern = new RegExp(
        `([A-ZÄÖÜ][a-zäöüéèàâêîôûç]+(?:\\s+[a-zäöüéèàâêîôûç]+)*${escapedSuffix})(?:\\s|,|$)`,
        'gi',
      );

      // Pattern for suffix at start: "Rue de Lausanne", "Avenue des Alpes"
      const suffixStartPattern = new RegExp(
        `(${escapedSuffix}\\s+(?:de\\s+la\\s+|de\\s+|du\\s+|des\\s+|della\\s+|del\\s+)?[A-ZÄÖÜ][a-zäöüéèàâêîôûç]+(?:\\s+[A-ZÄÖÜ]?[a-zäöüéèàâêîôûç]+)*)`,
        'gi',
      );

      let match;

      while ((match = suffixEndPattern.exec(text)) !== null) {
        const captured = match[1];
        if (!captured) continue;
        const streetName = captured.trim();
        if (streetName.length >= 5 && !this.isAlreadyFound(components, match.index)) {
          components.push({
            type: 'STREET_NAME',
            text: streetName,
            start: match.index,
            end: match.index + streetName.length,
          });
        }
      }

      while ((match = suffixStartPattern.exec(text)) !== null) {
        const captured = match[1];
        if (!captured) continue;
        const streetName = captured.trim();
        if (streetName.length >= 5 && !this.isAlreadyFound(components, match.index)) {
          components.push({
            type: 'STREET_NAME',
            text: streetName,
            start: match.index,
            end: match.index + streetName.length,
          });
        }
      }
    }

    return components;
  }

  /**
   * Find street numbers near street names
   */
  private findStreetNumbers(text: string, streetNames: AddressComponent[]): AddressComponent[] {
    const components: AddressComponent[] = [];

    // Pattern: digits optionally followed by letter (12, 12a, 12-14)
    const numberPattern = /\b(\d{1,4}[a-zA-Z]?(?:\s*[-–]\s*\d{1,4}[a-zA-Z]?)?)\b/g;

    let match;
    while ((match = numberPattern.exec(text)) !== null) {
      const number = match[1];
      if (!number) continue;
      const position = match.index;

      // Check if this number is near a street name
      const nearStreet = streetNames.some(street => {
        const distance = Math.min(
          Math.abs(position - street.end),
          Math.abs(position - street.start),
        );
        return distance <= this.config.maxComponentDistance;
      });

      if (nearStreet) {
        components.push({
          type: 'STREET_NUMBER',
          text: number,
          start: position,
          end: position + number.length,
        });
      }
    }

    return components;
  }

  /**
   * Find postal codes (Swiss and EU formats)
   */
  private findPostalCodes(text: string): AddressComponent[] {
    const components: AddressComponent[] = [];

    // Swiss postal code: 4 digits (1000-9999) optionally prefixed with CH-
    const swissPostalPattern = /\b(?:CH[-\s]?)?([1-9]\d{3})\b/g;

    // German postal code: 5 digits
    const germanPostalPattern = /\b(?:D[-\s]?)?(\d{5})\b/g;

    // French postal code: 5 digits
    const frenchPostalPattern = /\b(?:F[-\s]?)?(\d{5})\b/g;

    // Italian postal code: 5 digits
    const italianPostalPattern = /\b(?:I[-\s]?)?(\d{5})\b/g;

    // Austrian postal code: 4 digits
    const austrianPostalPattern = /\b(?:A[-\s]?)?(\d{4})\b/g;

    let match;

    // Swiss postal codes
    while ((match = swissPostalPattern.exec(text)) !== null) {
      const code = match[1];
      if (!code) continue;
      const fullMatch = match[0];
      const codeNum = parseInt(code, 10);

      // Validate Swiss postal code range
      if (this.isValidSwissPostalCode(codeNum)) {
        components.push({
          type: 'POSTAL_CODE',
          text: fullMatch,
          start: match.index,
          end: match.index + fullMatch.length,
        });
      }
    }

    // German postal codes (5 digits starting with 0-9)
    while ((match = germanPostalPattern.exec(text)) !== null) {
      if (!this.isAlreadyFound(components, match.index)) {
        components.push({
          type: 'POSTAL_CODE',
          text: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    // French postal codes
    while ((match = frenchPostalPattern.exec(text)) !== null) {
      if (!this.isAlreadyFound(components, match.index)) {
        components.push({
          type: 'POSTAL_CODE',
          text: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    // Italian postal codes
    while ((match = italianPostalPattern.exec(text)) !== null) {
      if (!this.isAlreadyFound(components, match.index)) {
        components.push({
          type: 'POSTAL_CODE',
          text: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    // Austrian postal codes
    while ((match = austrianPostalPattern.exec(text)) !== null) {
      const code = match[1];
      if (!code) continue;
      const codeNum = parseInt(code, 10);
      // Austrian codes are 1000-9999 but different from Swiss
      if (codeNum >= 1000 && codeNum <= 9999 && !this.isAlreadyFound(components, match.index)) {
        components.push({
          type: 'POSTAL_CODE',
          text: match[0],
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    return components;
  }

  /**
   * Find city names in text
   */
  private findCities(text: string): AddressComponent[] {
    const components: AddressComponent[] = [];
    const textLower = text.toLowerCase();

    // Check against known Swiss cities
    for (const [, variants] of SWISS_CITIES) {
      for (const variant of variants) {
        // Create word boundary pattern
        const pattern = new RegExp(`\\b${this.escapeRegex(variant)}\\b`, 'gi');
        let match;

        while ((match = pattern.exec(textLower)) !== null) {
          if (!this.isAlreadyFound(components, match.index)) {
            // Get the actual case from original text
            const originalText = text.substring(match.index, match.index + variant.length);
            components.push({
              type: 'CITY',
              text: originalText,
              start: match.index,
              end: match.index + variant.length,
            });
          }
        }
      }
    }

    // Also look for capitalized words after postal codes
    const postalCodes = this.findPostalCodes(text);
    for (const postal of postalCodes) {
      // Look for capitalized word(s) after postal code
      const afterPostal = text.substring(postal.end, postal.end + 50);
      const cityMatch = afterPostal.match(/^\s*([A-ZÄÖÜ][a-zäöüéèàâêîôûç]+(?:\s+[a-zäöüéèàâêîôûç]+)?)/);

      if (cityMatch) {
        const capturedCity = cityMatch[1];
        const matchIndex = cityMatch.index ?? 0;
        if (capturedCity && !this.isAlreadyFound(components, postal.end + matchIndex)) {
          const cityText = capturedCity.trim();
          const cityStart = postal.end + afterPostal.indexOf(cityText);
          components.push({
            type: 'CITY',
            text: cityText,
            start: cityStart,
            end: cityStart + cityText.length,
          });
        }
      }
    }

    return components;
  }

  /**
   * Find country names in text
   */
  private findCountries(text: string): AddressComponent[] {
    const components: AddressComponent[] = [];
    const textLower = text.toLowerCase();

    for (const [, variants] of EU_COUNTRIES) {
      for (const variant of variants) {
        // Skip 2-letter codes unless they appear standalone or after comma
        if (variant.length <= 2) {
          const pattern = new RegExp(`(?:,\\s*|\\s+)(${this.escapeRegex(variant)})(?:\\s|$|\\.)`, 'gi');
          let match;
          while ((match = pattern.exec(text)) !== null) {
            const countryText = match[1];
            if (!countryText) continue;
            const countryStart = match.index + match[0].indexOf(countryText);
            if (!this.isAlreadyFound(components, countryStart)) {
              components.push({
                type: 'COUNTRY',
                text: countryText,
                start: countryStart,
                end: countryStart + countryText.length,
              });
            }
          }
        } else {
          const pattern = new RegExp(`\\b${this.escapeRegex(variant)}\\b`, 'gi');
          let match;
          while ((match = pattern.exec(textLower)) !== null) {
            if (!this.isAlreadyFound(components, match.index)) {
              const originalText = text.substring(match.index, match.index + variant.length);
              components.push({
                type: 'COUNTRY',
                text: originalText,
                start: match.index,
                end: match.index + variant.length,
              });
            }
          }
        }
      }
    }

    return components;
  }

  /**
   * Validate Swiss postal code against known ranges
   */
  isValidSwissPostalCode(code: number): boolean {
    return SWISS_POSTAL_RANGES.some(range => code >= range.min && code <= range.max);
  }

  /**
   * Get canton for a Swiss postal code
   */
  getCantonForPostalCode(code: number): string | null {
    const range = SWISS_POSTAL_RANGES.find(r => code >= r.min && code <= r.max);
    return range ? range.canton : null;
  }

  /**
   * Normalize city name for comparison
   */
  normalizeCity(city: string): string {
    return city.toLowerCase()
      .replace(/[äàâ]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[îïì]/g, 'i')
      .replace(/[öôò]/g, 'o')
      .replace(/[üùû]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[ß]/g, 'ss')
      .trim();
  }

  /**
   * Check if a city matches known Swiss cities
   */
  isKnownSwissCity(city: string): boolean {
    const normalized = this.normalizeCity(city);
    for (const [, variants] of SWISS_CITIES) {
      if (variants.some(v => this.normalizeCity(v) === normalized)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if position already has a component
   */
  private isAlreadyFound(components: AddressComponent[], position: number): boolean {
    return components.some(c => position >= c.start && position < c.end);
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Convert address components to Entity array for pipeline integration
   */
  componentsToEntities(components: AddressComponent[], source: 'RULE' = 'RULE'): Entity[] {
    return components.map(comp => ({
      id: generateEntityId(),
      type: this.componentTypeToEntityType(comp.type),
      text: comp.text,
      start: comp.start,
      end: comp.end,
      confidence: 0.7, // Base confidence for component detection
      source,
      metadata: {
        componentType: comp.type,
        isAddressComponent: true,
      },
    }));
  }

  /**
   * Map component type to entity type
   */
  private componentTypeToEntityType(compType: AddressComponentType): EntityType {
    switch (compType) {
      case 'STREET_NAME':
      case 'STREET_NUMBER':
        return 'ADDRESS';
      case 'POSTAL_CODE':
        return 'SWISS_ADDRESS'; // Will be refined based on validation
      case 'CITY':
        return 'LOCATION';
      case 'COUNTRY':
        return 'LOCATION';
      case 'REGION':
        return 'LOCATION';
      default:
        return 'ADDRESS';
    }
  }
}

/**
 * Factory function for creating AddressClassifier
 */
export function createAddressClassifier(
  config?: Partial<AddressClassifierConfig>,
): AddressClassifier {
  return new AddressClassifier(config);
}
