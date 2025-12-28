/**
 * Browser-compatible Swiss Postal Code Database (Story 7.3, Task 6)
 *
 * Provides lookup and validation for Swiss postal codes (PLZ/NPA).
 * Loads data via fetch from public/data/swissPostalCodes.json
 *
 * Performance target: <10ms per lookup after initialization
 */

import {
  type PostalCodesData,
  type SwissPostalCode,
  type PostalLookupResult,
  cleanPostalCode,
  normalizeCity,
  isValidSwissPostalCodeFormat,
} from '../../../shared/dist/pii/index.js';
import { createLogger } from '../utils/logger.js';

// Create logger for postal database
const log = createLogger('pii:postal');

// Re-export types for consumers
export type { SwissPostalCode, PostalLookupResult };

/**
 * Browser-compatible Swiss Postal Code Database
 *
 * Provides fast validation and lookup for Swiss postal codes.
 * Data is loaded asynchronously via fetch.
 */
export class BrowserSwissPostalDatabase {
  private postalCodes: Map<string, SwissPostalCode> = new Map();
  private cityToPostalCodes: Map<string, string[]> = new Map();
  private cantonNames: Map<string, string> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database by loading data from JSON
   * Can be called multiple times safely - only loads once
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.initPromise) {
      this.initPromise = this.loadData();
    }

    return this.initPromise;
  }

  /**
   * Check if database is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if database is ready (alias for isInitialized)
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Load postal code data from JSON file
   */
  private async loadData(): Promise<void> {
    try {
      // Try to fetch from public folder
      const response = await fetch('./data/swissPostalCodes.json');
      if (!response.ok) {
        throw new Error(`Failed to load postal codes: ${response.status}`);
      }

      const data: PostalCodesData = await response.json();
      this.processData(data);
      this.initialized = true;
    } catch (error) {
      log.warn('Failed to load Swiss postal database', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Initialize with empty data - validation will use range checking only
      this.initialized = true;
    }
  }

  /**
   * Process loaded JSON data into lookup maps
   */
  private processData(data: PostalCodesData): void {
    // Load canton names
    for (const [code, name] of Object.entries(data.cantons)) {
      this.cantonNames.set(code, name);
    }

    // Load postal codes
    for (const [code, codeData] of Object.entries(data.postalCodes)) {
      const entry: SwissPostalCode = {
        code,
        city: codeData.city,
        canton: codeData.canton,
        aliases: codeData.aliases || [],
      };

      this.postalCodes.set(code, entry);

      // Index by city name (normalized for accent-insensitive lookup)
      const cityNorm = normalizeCity(codeData.city);
      if (!this.cityToPostalCodes.has(cityNorm)) {
        this.cityToPostalCodes.set(cityNorm, []);
      }
      const cityList = this.cityToPostalCodes.get(cityNorm);
      if (cityList) cityList.push(code);

      // Index by aliases
      for (const alias of codeData.aliases || []) {
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

    // Check if in database (if initialized with data)
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
let instance: BrowserSwissPostalDatabase | null = null;

/**
 * Get the Swiss postal database singleton
 * Note: Call initialize() before using lookup functions
 */
export function getBrowserSwissPostalDatabase(): BrowserSwissPostalDatabase {
  if (!instance) {
    instance = new BrowserSwissPostalDatabase();
  }
  return instance;
}

/**
 * Create a new Swiss postal database instance
 * (use getBrowserSwissPostalDatabase() for singleton access)
 */
export function createBrowserSwissPostalDatabase(): BrowserSwissPostalDatabase {
  return new BrowserSwissPostalDatabase();
}
