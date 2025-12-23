/**
 * Swiss Postal Code Database (Story 2.1, Task 2)
 *
 * Provides lookup and validation for Swiss postal codes (PLZ/NPA).
 * Uses embedded JSON data for offline operation (NFR-S1).
 *
 * Performance target: <10ms per lookup (NFR-P3)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  type PostalCodesData,
  type SwissPostalCode,
  type PostalLookupResult,
  cleanPostalCode,
  normalizeCity,
  isValidSwissPostalCodeFormat,
} from '../../shared/dist/pii/index.js';

// Re-export types for consumers
export type { SwissPostalCode, PostalLookupResult };

// Load JSON data at module initialization
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataPath = join(__dirname, '..', 'data', 'swissPostalCodes.json');

let postalCodesData: PostalCodesData;
try {
  postalCodesData = JSON.parse(readFileSync(dataPath, 'utf-8')) as PostalCodesData;
} catch {
  // Fallback for when running from dist directory
  const distPath = join(__dirname, '..', '..', 'src', 'data', 'swissPostalCodes.json');
  postalCodesData = JSON.parse(readFileSync(distPath, 'utf-8')) as PostalCodesData;
}

/**
 * Swiss Postal Code Database
 *
 * Provides fast validation and lookup for Swiss postal codes.
 * Data is loaded once at initialization for optimal performance.
 */
export class SwissPostalDatabase {
  private postalCodes: Map<string, SwissPostalCode>;
  private cityToPostalCodes: Map<string, string[]>;
  private cantonNames: Map<string, string>;

  constructor() {
    this.postalCodes = new Map();
    this.cityToPostalCodes = new Map();
    this.cantonNames = new Map();
    this.loadData();
  }

  /**
   * Load postal code data from embedded JSON
   */
  private loadData(): void {
    // Load canton names
    for (const [code, name] of Object.entries(postalCodesData.cantons)) {
      this.cantonNames.set(code, name);
    }

    // Load postal codes
    for (const [code, data] of Object.entries(postalCodesData.postalCodes)) {
      const entry: SwissPostalCode = {
        code,
        city: data.city,
        canton: data.canton,
        aliases: data.aliases || [],
      };

      this.postalCodes.set(code, entry);

      // Index by city name (normalized for accent-insensitive lookup)
      const cityNorm = normalizeCity(data.city);
      if (!this.cityToPostalCodes.has(cityNorm)) {
        this.cityToPostalCodes.set(cityNorm, []);
      }
      const cityList = this.cityToPostalCodes.get(cityNorm);
      if (cityList) cityList.push(code);

      // Index by aliases
      for (const alias of data.aliases || []) {
        const aliasNorm = normalizeCity(alias);
        if (!this.cityToPostalCodes.has(aliasNorm)) {
          this.cityToPostalCodes.set(aliasNorm, []);
        }
        const aliasList = this.cityToPostalCodes.get(aliasNorm);
        if (aliasList) aliasList.push(code);
      }
    }
  }

  /**
   * Validate if a postal code is a valid Swiss postal code
   *
   * @param code - Postal code to validate (with or without CH- prefix)
   * @returns true if valid Swiss postal code, false otherwise
   */
  validate(code: string): boolean {
    const cleaned = cleanPostalCode(code);

    // Check if in database
    if (this.postalCodes.has(cleaned)) {
      return true;
    }

    // Also validate format (4 digits in range 1000-9999)
    return isValidSwissPostalCodeFormat(cleaned);
  }

  /**
   * Look up postal code details
   *
   * @param code - Postal code to look up
   * @returns Lookup result or null if not found
   */
  lookup(code: string): PostalLookupResult | null {
    const cleaned = cleanPostalCode(code);
    const entry = this.postalCodes.get(cleaned);

    if (!entry) {
      return null;
    }

    return {
      city: entry.city,
      canton: entry.canton,
      cantonName: this.cantonNames.get(entry.canton) || entry.canton,
      aliases: entry.aliases,
    };
  }

  /**
   * Find postal codes by city name
   *
   * @param city - City name to search for
   * @returns Array of matching postal codes
   */
  findByCity(city: string): string[] {
    const cityNorm = normalizeCity(city);
    return this.cityToPostalCodes.get(cityNorm) || [];
  }

  /**
   * Check if a city name is known (exact or alias match)
   *
   * @param city - City name to check
   * @returns true if city is known, false otherwise
   */
  isKnownCity(city: string): boolean {
    const cityNorm = normalizeCity(city);
    return this.cityToPostalCodes.has(cityNorm);
  }

  /**
   * Get all cities for a canton
   *
   * @param canton - Canton code (e.g., "ZH", "VD")
   * @returns Array of cities in the canton
   */
  getCitiesInCanton(canton: string): string[] {
    const cities: Set<string> = new Set();
    const cantonUpper = canton.toUpperCase();

    for (const entry of this.postalCodes.values()) {
      if (entry.canton === cantonUpper || entry.canton.includes(cantonUpper)) {
        cities.add(entry.city);
      }
    }

    return Array.from(cities).sort();
  }

  /**
   * Get canton code for a postal code
   *
   * @param code - Postal code
   * @returns Canton code or null if not found
   */
  getCantonForPostalCode(code: string): string | null {
    const cleaned = cleanPostalCode(code);
    const entry = this.postalCodes.get(cleaned);
    return entry ? entry.canton : null;
  }

  /**
   * Get all Swiss city names (for matching)
   *
   * @returns Array of all city names and aliases
   */
  getAllCityNames(): string[] {
    const names: Set<string> = new Set();

    for (const entry of this.postalCodes.values()) {
      names.add(entry.city);
      for (const alias of entry.aliases) {
        names.add(alias);
      }
    }

    return Array.from(names).sort();
  }

  /**
   * Get database statistics
   */
  getStats(): { postalCodes: number; cities: number; cantons: number } {
    return {
      postalCodes: this.postalCodes.size,
      cities: this.cityToPostalCodes.size,
      cantons: this.cantonNames.size,
    };
  }
}

// Singleton instance for performance
let instance: SwissPostalDatabase | null = null;

/**
 * Get the Swiss postal database singleton
 */
export function getSwissPostalDatabase(): SwissPostalDatabase {
  if (!instance) {
    instance = new SwissPostalDatabase();
  }
  return instance;
}

/**
 * Create a new Swiss postal database instance
 * (use getSwissPostalDatabase() for singleton access)
 */
export function createSwissPostalDatabase(): SwissPostalDatabase {
  return new SwissPostalDatabase();
}
