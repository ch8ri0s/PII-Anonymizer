/**
 * FeedbackStore Tests
 *
 * Story 7.8: User Correction Feedback Logging
 * AC #1: Correction is logged to IndexedDB with anonymized context
 * AC #7: Logs rotate monthly with configurable max retention
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { CorrectionEntry } from '../../src/types/feedback';
import {
  isIndexedDBAvailable,
  openDatabase,
  closeDatabase,
  addEntry,
  getEntriesByMonth,
  getAllEntries,
  getRecentEntries,
  getEntryCount,
  deleteEntriesOlderThan,
  deleteAllEntries,
  deleteDatabase,
} from '../../src/services/FeedbackStore';

// Helper to create a test entry
function createTestEntry(overrides: Partial<CorrectionEntry> = {}): CorrectionEntry {
  const now = new Date();
  return {
    id: `test-${Date.now()}-${Math.random()}`,
    timestamp: now.toISOString(),
    month: now.toISOString().slice(0, 7),
    action: 'DISMISS',
    entityType: 'PERSON',
    context: 'Test context with [PERSON]',
    documentHash: 'abc123def456',
    ...overrides,
  };
}

describe('FeedbackStore', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await deleteDatabase();
  });

  afterEach(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  describe('isIndexedDBAvailable', () => {
    it('should return true when IndexedDB is available', () => {
      expect(isIndexedDBAvailable()).toBe(true);
    });
  });

  describe('openDatabase', () => {
    it('should open the database successfully', async () => {
      const db = await openDatabase();
      expect(db).toBeDefined();
      expect(db.name).toBe('pii-anonymizer-feedback');
    });

    it('should create the corrections object store', async () => {
      const db = await openDatabase();
      expect(db.objectStoreNames.contains('corrections')).toBe(true);
    });

    it('should return the same instance on subsequent calls', async () => {
      const db1 = await openDatabase();
      const db2 = await openDatabase();
      expect(db1).toBe(db2);
    });
  });

  describe('addEntry', () => {
    it('should add an entry and return its ID', async () => {
      const entry = createTestEntry({ id: 'unique-id-123' });
      const id = await addEntry(entry);
      expect(id).toBe('unique-id-123');
    });

    it('should store all entry fields', async () => {
      const entry = createTestEntry({
        id: 'test-full-entry',
        action: 'DISMISS',
        entityType: 'EMAIL',
        context: 'Contact at [EMAIL]',
        documentHash: 'hashvalue',
        originalSource: 'ML',
        confidence: 0.95,
        position: { start: 10, end: 30 },
      });

      await addEntry(entry);
      const entries = await getAllEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        id: 'test-full-entry',
        action: 'DISMISS',
        entityType: 'EMAIL',
        context: 'Contact at [EMAIL]',
        documentHash: 'hashvalue',
        originalSource: 'ML',
        confidence: 0.95,
        position: { start: 10, end: 30 },
      });
    });

    it('should add multiple entries', async () => {
      await addEntry(createTestEntry({ id: 'entry-1' }));
      await addEntry(createTestEntry({ id: 'entry-2' }));
      await addEntry(createTestEntry({ id: 'entry-3' }));

      const count = await getEntryCount();
      expect(count).toBe(3);
    });
  });

  describe('getEntriesByMonth', () => {
    it('should return entries for a specific month', async () => {
      await addEntry(createTestEntry({ id: 'dec-2025', month: '2025-12' }));
      await addEntry(createTestEntry({ id: 'jan-2026', month: '2026-01' }));
      await addEntry(createTestEntry({ id: 'dec-2025-2', month: '2025-12' }));

      const decEntries = await getEntriesByMonth('2025-12');
      const janEntries = await getEntriesByMonth('2026-01');

      expect(decEntries).toHaveLength(2);
      expect(janEntries).toHaveLength(1);
    });

    it('should return empty array for month with no entries', async () => {
      await addEntry(createTestEntry({ month: '2025-12' }));

      const entries = await getEntriesByMonth('2020-01');
      expect(entries).toHaveLength(0);
    });
  });

  describe('getAllEntries', () => {
    it('should return all entries', async () => {
      await addEntry(createTestEntry({ id: '1' }));
      await addEntry(createTestEntry({ id: '2' }));
      await addEntry(createTestEntry({ id: '3' }));

      const entries = await getAllEntries();
      expect(entries).toHaveLength(3);
    });

    it('should return empty array when no entries', async () => {
      const entries = await getAllEntries();
      expect(entries).toHaveLength(0);
    });
  });

  describe('getRecentEntries', () => {
    it('should return entries in reverse chronological order', async () => {
      await addEntry(createTestEntry({ id: 'old', timestamp: '2025-01-01T00:00:00Z' }));
      await addEntry(createTestEntry({ id: 'mid', timestamp: '2025-06-01T00:00:00Z' }));
      await addEntry(createTestEntry({ id: 'new', timestamp: '2025-12-01T00:00:00Z' }));

      const recent = await getRecentEntries(2);

      expect(recent).toHaveLength(2);
      expect(recent[0].id).toBe('new');
      expect(recent[1].id).toBe('mid');
    });

    it('should respect the limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await addEntry(createTestEntry({ id: `entry-${i}` }));
      }

      const recent = await getRecentEntries(5);
      expect(recent).toHaveLength(5);
    });

    it('should return all entries if limit exceeds count', async () => {
      await addEntry(createTestEntry({ id: '1' }));
      await addEntry(createTestEntry({ id: '2' }));

      const recent = await getRecentEntries(10);
      expect(recent).toHaveLength(2);
    });
  });

  describe('getEntryCount', () => {
    it('should return 0 for empty database', async () => {
      const count = await getEntryCount();
      expect(count).toBe(0);
    });

    it('should return correct count', async () => {
      await addEntry(createTestEntry());
      await addEntry(createTestEntry());
      await addEntry(createTestEntry());

      const count = await getEntryCount();
      expect(count).toBe(3);
    });
  });

  describe('deleteEntriesOlderThan', () => {
    it('should delete entries older than retention period', async () => {
      const now = new Date();
      const oldDate = new Date(now.getFullYear(), now.getMonth() - 8, 1);
      const recentDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);

      await addEntry(createTestEntry({
        id: 'old',
        timestamp: oldDate.toISOString(),
        month: oldDate.toISOString().slice(0, 7),
      }));
      await addEntry(createTestEntry({
        id: 'recent',
        timestamp: recentDate.toISOString(),
        month: recentDate.toISOString().slice(0, 7),
      }));

      const deleted = await deleteEntriesOlderThan(6);

      expect(deleted).toBe(1);
      const remaining = await getAllEntries();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('recent');
    });

    it('should not delete entries within retention period', async () => {
      const now = new Date();

      await addEntry(createTestEntry({
        id: 'current',
        timestamp: now.toISOString(),
      }));

      const deleted = await deleteEntriesOlderThan(6);

      expect(deleted).toBe(0);
      const count = await getEntryCount();
      expect(count).toBe(1);
    });

    it('should respect custom retention period', async () => {
      const now = new Date();
      const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);

      await addEntry(createTestEntry({
        id: 'two-months',
        timestamp: twoMonthsAgo.toISOString(),
      }));

      // With 3 month retention, should not delete
      let deleted = await deleteEntriesOlderThan(3);
      expect(deleted).toBe(0);

      // With 1 month retention, should delete
      deleted = await deleteEntriesOlderThan(1);
      expect(deleted).toBe(1);
    });
  });

  describe('deleteAllEntries', () => {
    it('should delete all entries and return count', async () => {
      await addEntry(createTestEntry({ id: '1' }));
      await addEntry(createTestEntry({ id: '2' }));
      await addEntry(createTestEntry({ id: '3' }));

      const deleted = await deleteAllEntries();

      expect(deleted).toBe(3);
      const count = await getEntryCount();
      expect(count).toBe(0);
    });

    it('should return 0 for empty database', async () => {
      const deleted = await deleteAllEntries();
      expect(deleted).toBe(0);
    });
  });

  describe('deleteDatabase', () => {
    it('should delete the database', async () => {
      await addEntry(createTestEntry());

      await deleteDatabase();

      // Should be able to open fresh database
      const db = await openDatabase();
      expect(db).toBeDefined();

      const count = await getEntryCount();
      expect(count).toBe(0);
    });
  });

  describe('action types', () => {
    it('should store DISMISS action correctly', async () => {
      await addEntry(createTestEntry({
        id: 'dismiss-test',
        action: 'DISMISS',
        originalSource: 'ML',
        confidence: 0.85,
      }));

      const entries = await getAllEntries();
      expect(entries[0].action).toBe('DISMISS');
      expect(entries[0].originalSource).toBe('ML');
      expect(entries[0].confidence).toBe(0.85);
    });

    it('should store ADD action correctly', async () => {
      await addEntry(createTestEntry({
        id: 'add-test',
        action: 'ADD',
      }));

      const entries = await getAllEntries();
      expect(entries[0].action).toBe('ADD');
    });
  });

  describe('entity types', () => {
    it('should store various entity types', async () => {
      const types = ['PERSON', 'EMAIL', 'PHONE', 'IBAN', 'ADDRESS', 'DATE'];

      for (const type of types) {
        await addEntry(createTestEntry({ id: `type-${type}`, entityType: type }));
      }

      const entries = await getAllEntries();
      const storedTypes = entries.map(e => e.entityType);

      for (const type of types) {
        expect(storedTypes).toContain(type);
      }
    });
  });
});
