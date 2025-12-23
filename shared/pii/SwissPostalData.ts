/**
 * Swiss Postal Data Types and Utilities (Shared)
 *
 * Platform-agnostic types and utility functions for Swiss postal code
 * validation and lookup. Used by both Electron and browser-app.
 *
 * @module shared/pii/SwissPostalData
 */

/**
 * Raw postal codes data structure from JSON file
 */
export interface PostalCodesData {
  cantons: Record<string, string>;
  postalCodes: Record<string, { city: string; canton: string; aliases: string[] }>;
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
 * Database statistics
 */
export interface PostalDatabaseStats {
  postalCodes: number;
  cities: number;
  cantons: number;
}

/**
 * Clean postal code input (remove CH- prefix, spaces, normalize)
 *
 * Handles various input formats:
 * - "CH-8001" → "8001"
 * - "CH 1201" → "1201"
 * - " 3000 " → "3000"
 *
 * @param code - Raw postal code input
 * @returns Cleaned 4-digit postal code string
 */
export function cleanPostalCode(code: string | number | null | undefined): string {
  if (code === null || code === undefined) {
    return '';
  }
  return String(code)
    .toUpperCase()
    .replace(/^CH[-\s]?/, '')
    .replace(/\s/g, '')
    .trim();
}

/**
 * Normalize city name for case-insensitive, accent-insensitive comparison
 *
 * Handles Swiss multilingual city names:
 * - "Zürich" → "zurich"
 * - "Genève" → "geneve"
 * - "Bâle" → "bale"
 *
 * @param city - City name to normalize
 * @returns Normalized lowercase string without accents
 */
export function normalizeCity(city: string | null | undefined): string {
  if (!city) {
    return '';
  }
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

/**
 * Validate postal code format (4 digits in range 1000-9999)
 *
 * @param code - Cleaned postal code
 * @returns true if valid Swiss postal code format
 */
export function isValidSwissPostalCodeFormat(code: string): boolean {
  if (!/^\d{4}$/.test(code)) {
    return false;
  }
  const num = parseInt(code, 10);
  return num >= 1000 && num <= 9999;
}

/**
 * Swiss canton abbreviations
 */
export const SWISS_CANTONS: Record<string, string> = {
  AG: 'Aargau',
  AI: 'Appenzell Innerrhoden',
  AR: 'Appenzell Ausserrhoden',
  BE: 'Bern',
  BL: 'Basel-Landschaft',
  BS: 'Basel-Stadt',
  FR: 'Fribourg',
  GE: 'Genève',
  GL: 'Glarus',
  GR: 'Graubünden',
  JU: 'Jura',
  LU: 'Luzern',
  NE: 'Neuchâtel',
  NW: 'Nidwalden',
  OW: 'Obwalden',
  SG: 'St. Gallen',
  SH: 'Schaffhausen',
  SO: 'Solothurn',
  SZ: 'Schwyz',
  TG: 'Thurgau',
  TI: 'Ticino',
  UR: 'Uri',
  VD: 'Vaud',
  VS: 'Valais',
  ZG: 'Zug',
  ZH: 'Zürich',
};
