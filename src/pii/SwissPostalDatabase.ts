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

// Load JSON data at module initialization
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataPath = join(__dirname, '..', 'data', 'swissPostalCodes.json');

interface PostalCodesData {
  cantons: Record<string, string>;
  postalCodes: Record<string, { city: string; canton: string; aliases: string[] }>;
}

let postalCodesData: PostalCodesData;
try {
  postalCodesData = JSON.parse(readFileSync(dataPath, 'utf-8')) as PostalCodesData;
} catch {
  // Fallback for when running from dist directory
  const distPath = join(__dirname, '..', '..', 'src', 'data', 'swissPostalCodes.json');
  postalCodesData = JSON.parse(readFileSync(distPath, 'utf-8')) as PostalCodesData;
}

/**
 * Swiss postal code entry
 */
export interface SwissPostalCode {
  code: string;
  city: string;
  canton: string;
  aliases: string[];
}

/**
 * Result from postal code lookup
 */
export interface PostalLookupResult {
  city: string;
  canton: string;
  cantonName: string;
  aliases: string[];
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

      // Index by city name (case-insensitive)
      const cityLower = data.city.toLowerCase();
      if (!this.cityToPostalCodes.has(cityLower)) {
        this.cityToPostalCodes.set(cityLower, []);
      }
      const cityList = this.cityToPostalCodes.get(cityLower);
      if (cityList) cityList.push(code);

      // Index by aliases
      for (const alias of data.aliases || []) {
        const aliasLower = alias.toLowerCase();
        if (!this.cityToPostalCodes.has(aliasLower)) {
          this.cityToPostalCodes.set(aliasLower, []);
        }
        const aliasList = this.cityToPostalCodes.get(aliasLower);
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
    // Extract numeric part
    const cleaned = this.cleanPostalCode(code);

    // Must be 4 digits
    if (!/^\d{4}$/.test(cleaned)) {
      return false;
    }

    // Check if in database
    if (this.postalCodes.has(cleaned)) {
      return true;
    }

    // Also check range (1000-9999) for codes not in database
    const num = parseInt(cleaned, 10);
    return num >= 1000 && num <= 9999;
  }

  /**
   * Look up postal code details
   *
   * @param code - Postal code to look up
   * @returns Lookup result or null if not found
   */
  lookup(code: string): PostalLookupResult | null {
    const cleaned = this.cleanPostalCode(code);
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
    const cityLower = this.normalizeCity(city);
    return this.cityToPostalCodes.get(cityLower) || [];
  }

  /**
   * Check if a city name is known (exact or alias match)
   *
   * @param city - City name to check
   * @returns true if city is known, false otherwise
   */
  isKnownCity(city: string): boolean {
    const cityLower = this.normalizeCity(city);
    return this.cityToPostalCodes.has(cityLower);
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
    const cleaned = this.cleanPostalCode(code);
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

  /**
   * Clean postal code input (remove CH- prefix, spaces)
   */
  private cleanPostalCode(code: string): string {
    return code
      .toUpperCase()
      .replace(/^CH[-\s]?/, '')
      .replace(/\s/g, '')
      .trim();
  }

  /**
   * Normalize city name for comparison
   */
  private normalizeCity(city: string): string {
    return city
      .toLowerCase()
      .replace(/[äàâ]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[îïì]/g, 'i')
      .replace(/[öôò]/g, 'o')
      .replace(/[üùû]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[ß]/g, 'ss')
      .trim();
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
