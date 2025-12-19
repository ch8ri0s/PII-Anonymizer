/**
 * Address Component Detector (Story 2.1)
 *
 * Provides the main API for detecting address components in text.
 * This module wraps AddressClassifier and integrates with SwissPostalDatabase.
 *
 * Main API: detectAddressComponents(text: string): AddressComponent[]
 */

import { AddressComponent, AddressComponentType } from '../types/detection.js';
import { AddressClassifier, createAddressClassifier } from './AddressClassifier.js';
import { getSwissPostalDatabase, SwissPostalDatabase } from './SwissPostalDatabase.js';

/**
 * Configuration for address component detection
 */
export interface AddressComponentDetectorConfig {
  /** Maximum distance between components to consider for grouping (chars) */
  maxComponentDistance?: number;
  /** Language hint for detection */
  language?: 'en' | 'fr' | 'de';
  /** Enable strict postal code validation */
  strictPostalValidation?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: AddressComponentDetectorConfig = {
  maxComponentDistance: 50,
  language: 'de',
  strictPostalValidation: true,
};

/**
 * Address Component Detector
 *
 * Main class for detecting address components in text.
 * Uses AddressClassifier for pattern matching and SwissPostalDatabase for validation.
 */
export class AddressComponentDetector {
  private classifier: AddressClassifier;
  private postalDatabase: SwissPostalDatabase;
  private config: AddressComponentDetectorConfig;

  constructor(config: AddressComponentDetectorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.classifier = createAddressClassifier({
      maxComponentDistance: this.config.maxComponentDistance,
      language: this.config.language,
    });
    this.postalDatabase = getSwissPostalDatabase();
  }

  /**
   * Detect all address components in the given text
   *
   * This is the main API method for Story 2.1
   *
   * @param text - Text to analyze for address components
   * @returns Array of detected address components with positions
   */
  detectAddressComponents(text: string): AddressComponent[] {
    // Get initial components from classifier
    const components = this.classifier.classifyComponents(text);

    // Enhanced validation for postal codes
    if (this.config.strictPostalValidation) {
      return components.filter((comp) => {
        if (comp.type === 'POSTAL_CODE') {
          return this.validatePostalCode(comp.text);
        }
        return true;
      });
    }

    return components;
  }

  /**
   * Detect address components and return with enhanced metadata
   *
   * @param text - Text to analyze
   * @returns Components with additional validation metadata
   */
  detectAddressComponentsWithMetadata(
    text: string,
  ): Array<AddressComponent & { metadata?: Record<string, unknown> }> {
    const components = this.classifier.classifyComponents(text);

    return components.map((comp) => {
      const enhanced: AddressComponent & { metadata?: Record<string, unknown> } = { ...comp };

      if (comp.type === 'POSTAL_CODE') {
        const lookup = this.postalDatabase.lookup(comp.text);
        if (lookup) {
          enhanced.metadata = {
            validated: true,
            city: lookup.city,
            canton: lookup.canton,
            cantonName: lookup.cantonName,
          };
        } else {
          enhanced.metadata = {
            validated: this.postalDatabase.validate(comp.text),
          };
        }
      } else if (comp.type === 'CITY') {
        enhanced.metadata = {
          isKnownCity: this.postalDatabase.isKnownCity(comp.text),
          postalCodes: this.postalDatabase.findByCity(comp.text),
        };
      }

      return enhanced;
    });
  }

  /**
   * Validate a postal code
   */
  validatePostalCode(code: string): boolean {
    return this.postalDatabase.validate(code);
  }

  /**
   * Lookup postal code details
   */
  lookupPostalCode(code: string): { city: string; canton: string } | null {
    const result = this.postalDatabase.lookup(code);
    if (!result) return null;
    return { city: result.city, canton: result.canton };
  }

  /**
   * Check if a city is known in the Swiss postal database
   */
  isKnownCity(city: string): boolean {
    return this.postalDatabase.isKnownCity(city);
  }

  /**
   * Get component type statistics for detected components
   */
  getComponentStats(components: AddressComponent[]): Record<AddressComponentType, number> {
    const stats: Record<AddressComponentType, number> = {
      STREET_NAME: 0,
      STREET_NUMBER: 0,
      POSTAL_CODE: 0,
      CITY: 0,
      COUNTRY: 0,
      REGION: 0,
    };

    for (const comp of components) {
      stats[comp.type]++;
    }

    return stats;
  }
}

/**
 * Create an address component detector instance
 */
export function createAddressComponentDetector(
  config?: AddressComponentDetectorConfig,
): AddressComponentDetector {
  return new AddressComponentDetector(config);
}

/**
 * Convenience function: detect address components in text
 *
 * This is the main entry point for Story 2.1 integration
 *
 * @param text - Text to analyze
 * @returns Array of address components with positions
 */
export function detectAddressComponents(text: string): AddressComponent[] {
  const detector = new AddressComponentDetector();
  return detector.detectAddressComponents(text);
}
