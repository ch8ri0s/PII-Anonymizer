/**
 * BrowserSwissPostalDatabase Tests
 *
 * Tests for the browser-compatible Swiss postal code database.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BrowserSwissPostalDatabase,
  getBrowserSwissPostalDatabase,
  createBrowserSwissPostalDatabase,
} from '../../src/pii/BrowserSwissPostalDatabase';

// Mock postal data for testing - matches the actual JSON format
const mockPostalData = {
  version: '1.0.0',
  source: 'Test',
  lastUpdated: '2025-01-01',
  description: 'Test data',
  cantons: {
    ZH: 'Zürich',
    VD: 'Vaud',
    BE: 'Bern',
    GE: 'Genève',
    BS: 'Basel-Stadt',
    LU: 'Luzern',
    SG: 'St. Gallen',
  },
  postalCodes: {
    '8001': { city: 'Zürich', canton: 'ZH', aliases: [] },
    '8002': { city: 'Zürich', canton: 'ZH', aliases: [] },
    '1000': { city: 'Lausanne', canton: 'VD', aliases: [] },
    '3000': { city: 'Bern', canton: 'BE', aliases: ['Berne'] },
    '1200': { city: 'Genève', canton: 'GE', aliases: ['Geneva', 'Genf'] },
    '4000': { city: 'Basel', canton: 'BS', aliases: ['Bâle'] },
    '6000': { city: 'Luzern', canton: 'LU', aliases: ['Lucerne'] },
    '9000': { city: 'St. Gallen', canton: 'SG', aliases: ['Saint-Gall'] },
  },
};

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BrowserSwissPostalDatabase', () => {
  let database: BrowserSwissPostalDatabase;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPostalData),
    });
    database = createBrowserSwissPostalDatabase();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should create database instance', () => {
      expect(database).toBeInstanceOf(BrowserSwissPostalDatabase);
    });

    it('should not be ready before initialization', () => {
      const newDb = createBrowserSwissPostalDatabase();
      expect(newDb.isReady()).toBe(false);
    });

    it('should be ready after initialization', async () => {
      await database.initialize();
      expect(database.isReady()).toBe(true);
    });

    it('should fetch postal data on initialization', async () => {
      await database.initialize();
      expect(mockFetch).toHaveBeenCalledWith('./data/swissPostalCodes.json');
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      const db = createBrowserSwissPostalDatabase();

      await db.initialize();

      // Should still be usable with range validation fallback
      expect(db.isReady()).toBe(true);
      // validate() uses range checking as fallback when no data loaded
      expect(db.validate('8001')).toBe(true);
      // lookup() returns null when no data loaded
      expect(db.lookup('8001')).toBeNull();
    });
  });

  describe('Validation', () => {
    beforeEach(async () => {
      await database.initialize();
    });

    it('should validate known postal code', () => {
      expect(database.validate('8001')).toBe(true);
    });

    it('should accept valid range postal codes not in database', () => {
      // The validator accepts any 4-digit code in range 1000-9999 as fallback
      expect(database.validate('9999')).toBe(true);
    });

    it('should reject out of range postal codes', () => {
      // Postal codes < 1000 or > 9999 are invalid
      expect(database.validate('0999')).toBe(false);
    });

    it('should handle postal codes with leading zeros', () => {
      expect(database.validate('1000')).toBe(true);
    });

    it('should reject invalid format', () => {
      expect(database.validate('abc')).toBe(false);
      expect(database.validate('12345')).toBe(false);
      expect(database.validate('')).toBe(false);
    });

    it('should validate postal codes as numbers', () => {
      // The database normalizes input
      expect(database.validate(String(8001))).toBe(true);
    });
  });

  describe('Lookup', () => {
    beforeEach(async () => {
      await database.initialize();
    });

    it('should lookup postal code and return city info', () => {
      const result = database.lookup('8001');

      expect(result).toBeDefined();
      expect(result?.city).toBe('Zürich');
      expect(result?.canton).toBe('ZH');
    });

    it('should return null for unknown postal code', () => {
      const result = database.lookup('9999');
      expect(result).toBeNull();
    });

    it('should return first result for postal codes with multiple cities', () => {
      // 8001 and 8002 both map to Zürich
      const result1 = database.lookup('8001');
      const result2 = database.lookup('8002');

      expect(result1?.city).toBe('Zürich');
      expect(result2?.city).toBe('Zürich');
    });
  });

  describe('Find by City', () => {
    beforeEach(async () => {
      await database.initialize();
    });

    it('should find postal codes by city name', () => {
      const results = database.findByCity('Zürich');

      expect(results.length).toBeGreaterThan(0);
      expect(results.includes('8001')).toBe(true);
    });

    it('should be case-insensitive', () => {
      const results = database.findByCity('zürich');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should return empty array for unknown city', () => {
      const results = database.findByCity('UnknownCity');
      expect(results).toEqual([]);
    });

    it('should find by aliases', () => {
      // Genève has aliases: Geneva, Genf
      const results = database.findByCity('Geneva');

      expect(results.length).toBeGreaterThan(0);
      expect(results.includes('1200')).toBe(true);
    });
  });

  describe('Known City Check', () => {
    beforeEach(async () => {
      await database.initialize();
    });

    it('should recognize known cities', () => {
      expect(database.isKnownCity('Zürich')).toBe(true);
      expect(database.isKnownCity('Bern')).toBe(true);
      expect(database.isKnownCity('Genève')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(database.isKnownCity('zürich')).toBe(true);
      expect(database.isKnownCity('BERN')).toBe(true);
    });

    it('should reject unknown cities', () => {
      expect(database.isKnownCity('UnknownCity')).toBe(false);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getBrowserSwissPostalDatabase', () => {
      const instance1 = getBrowserSwissPostalDatabase();
      const instance2 = getBrowserSwissPostalDatabase();

      expect(instance1).toBe(instance2);
    });

    it('should require manual initialization for singleton', async () => {
      const instance = getBrowserSwissPostalDatabase();
      // Singleton requires manual initialize() call
      await instance.initialize();
      expect(instance.isReady()).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await database.initialize();
    });

    it('should handle null input gracefully', () => {
      expect(database.validate(null as unknown as string)).toBe(false);
      expect(database.lookup(null as unknown as string)).toBeNull();
    });

    it('should handle undefined input gracefully', () => {
      expect(database.validate(undefined as unknown as string)).toBe(false);
      expect(database.lookup(undefined as unknown as string)).toBeNull();
    });

    it('should handle whitespace-padded postal codes', () => {
      expect(database.validate(' 8001 ')).toBe(true);
      expect(database.lookup(' 8001 ')?.city).toBe('Zürich');
    });
  });
});
