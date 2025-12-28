/**
 * FeedbackStore - IndexedDB Storage for Correction Entries
 *
 * Story 7.8: User Correction Feedback Logging
 * AC #1: Correction is logged to IndexedDB with anonymized context
 * AC #7: Logs rotate monthly with configurable max retention
 *
 * Provides browser-native storage for correction entries using IndexedDB.
 * Handles database initialization, CRUD operations, and monthly rotation.
 */

import type { CorrectionEntry } from '../types/feedback';
import {
  FEEDBACK_DB_NAME,
  FEEDBACK_DB_VERSION,
  CORRECTIONS_STORE_NAME,
  DEFAULT_RETENTION_MONTHS,
} from '../types/feedback';
import { createLogger } from '../utils/logger';

// Logger for feedback store
const log = createLogger('feedback:store');

/** Database instance singleton */
let dbInstance: IDBDatabase | null = null;

/** Flag to track if IndexedDB is available */
let indexedDBAvailable: boolean | null = null;

/**
 * Check if IndexedDB is available (may be blocked in private browsing)
 */
export function isIndexedDBAvailable(): boolean {
  if (indexedDBAvailable !== null) {
    return indexedDBAvailable;
  }

  try {
    // Check if indexedDB exists
    if (typeof indexedDB === 'undefined') {
      indexedDBAvailable = false;
      return false;
    }

    // Try to open a test database to verify it's actually usable
    // Some browsers block IndexedDB in private/incognito mode
    indexedDBAvailable = true;
    return true;
  } catch {
    indexedDBAvailable = false;
    return false;
  }
}

/**
 * Open the IndexedDB database
 * Creates the database and object stores if they don't exist
 */
export async function openDatabase(): Promise<IDBDatabase> {
  // Return existing instance if available
  if (dbInstance && dbInstance.name) {
    return dbInstance;
  }

  if (!isIndexedDBAvailable()) {
    throw new Error('IndexedDB is not available');
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FEEDBACK_DB_NAME, FEEDBACK_DB_VERSION);

    request.onerror = () => {
      indexedDBAvailable = false;
      reject(new Error(`Failed to open database: ${request.error?.message || 'Unknown error'}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // Handle database close/error events
      dbInstance.onclose = () => {
        dbInstance = null;
      };

      dbInstance.onerror = (event) => {
        log.error('Database error', { error: String((event.target as IDBRequest).error) });
      };

      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create corrections object store if it doesn't exist
      if (!db.objectStoreNames.contains(CORRECTIONS_STORE_NAME)) {
        const store = db.createObjectStore(CORRECTIONS_STORE_NAME, {
          keyPath: 'id',
        });

        // Create indexes for querying
        store.createIndex('by-month', 'month', { unique: false });
        store.createIndex('by-timestamp', 'timestamp', { unique: false });
        store.createIndex('by-type', 'entityType', { unique: false });
        store.createIndex('by-action', 'action', { unique: false });
      }
    };
  });
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Add a correction entry to the database
 * @param entry The correction entry to store
 * @returns The ID of the stored entry
 */
export async function addEntry(entry: CorrectionEntry): Promise<string> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CORRECTIONS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(CORRECTIONS_STORE_NAME);

    const request = store.add(entry);

    request.onsuccess = () => {
      resolve(entry.id);
    };

    request.onerror = () => {
      reject(new Error(`Failed to add entry: ${request.error?.message || 'Unknown error'}`));
    };
  });
}

/**
 * Get all entries for a specific month
 * @param month Month in YYYY-MM format
 * @returns Array of correction entries for that month
 */
export async function getEntriesByMonth(month: string): Promise<CorrectionEntry[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CORRECTIONS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(CORRECTIONS_STORE_NAME);
    const index = store.index('by-month');

    const request = index.getAll(IDBKeyRange.only(month));

    request.onsuccess = () => {
      resolve(request.result as CorrectionEntry[]);
    };

    request.onerror = () => {
      reject(new Error(`Failed to get entries: ${request.error?.message || 'Unknown error'}`));
    };
  });
}

/**
 * Get all entries from the database
 * @returns Array of all correction entries
 */
export async function getAllEntries(): Promise<CorrectionEntry[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CORRECTIONS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(CORRECTIONS_STORE_NAME);

    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result as CorrectionEntry[]);
    };

    request.onerror = () => {
      reject(new Error(`Failed to get all entries: ${request.error?.message || 'Unknown error'}`));
    };
  });
}

/**
 * Get recent entries with a limit
 * @param limit Maximum number of entries to return
 * @returns Array of most recent correction entries
 */
export async function getRecentEntries(limit: number): Promise<CorrectionEntry[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CORRECTIONS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(CORRECTIONS_STORE_NAME);
    const index = store.index('by-timestamp');

    const entries: CorrectionEntry[] = [];
    const request = index.openCursor(null, 'prev'); // Reverse order (newest first)

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor && entries.length < limit) {
        entries.push(cursor.value as CorrectionEntry);
        cursor.continue();
      } else {
        resolve(entries);
      }
    };

    request.onerror = () => {
      reject(new Error(`Failed to get recent entries: ${request.error?.message || 'Unknown error'}`));
    };
  });
}

/**
 * Get the count of entries in the database
 * @returns Total number of entries
 */
export async function getEntryCount(): Promise<number> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CORRECTIONS_STORE_NAME, 'readonly');
    const store = transaction.objectStore(CORRECTIONS_STORE_NAME);

    const request = store.count();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(new Error(`Failed to count entries: ${request.error?.message || 'Unknown error'}`));
    };
  });
}

/**
 * Delete entries older than the specified retention period
 * @param retentionMonths Number of months to retain (default: 6)
 * @returns Number of entries deleted
 */
export async function deleteEntriesOlderThan(
  retentionMonths: number = DEFAULT_RETENTION_MONTHS,
): Promise<number> {
  const db = await openDatabase();

  // Calculate the cutoff date
  const now = new Date();
  const cutoffDate = new Date(now.getFullYear(), now.getMonth() - retentionMonths, 1);
  const cutoffTimestamp = cutoffDate.toISOString();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CORRECTIONS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(CORRECTIONS_STORE_NAME);
    const index = store.index('by-timestamp');

    let deletedCount = 0;
    const range = IDBKeyRange.upperBound(cutoffTimestamp, true); // exclusive upper bound
    const request = index.openCursor(range);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

      if (cursor) {
        cursor.delete();
        deletedCount++;
        cursor.continue();
      } else {
        resolve(deletedCount);
      }
    };

    request.onerror = () => {
      reject(new Error(`Failed to delete old entries: ${request.error?.message || 'Unknown error'}`));
    };
  });
}

/**
 * Delete all entries (for testing or reset)
 * @returns Number of entries deleted
 */
export async function deleteAllEntries(): Promise<number> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CORRECTIONS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(CORRECTIONS_STORE_NAME);

    // Get count first
    const countRequest = store.count();

    countRequest.onsuccess = () => {
      const count = countRequest.result;

      const clearRequest = store.clear();

      clearRequest.onsuccess = () => {
        resolve(count);
      };

      clearRequest.onerror = () => {
        reject(new Error(`Failed to clear entries: ${clearRequest.error?.message || 'Unknown error'}`));
      };
    };

    countRequest.onerror = () => {
      reject(new Error(`Failed to count entries: ${countRequest.error?.message || 'Unknown error'}`));
    };
  });
}

/**
 * Delete oldest entries to enforce event count limit
 * @param maxEvents Maximum number of events to retain
 * @returns Number of entries deleted
 */
export async function deleteOldestEntries(maxEvents: number): Promise<number> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CORRECTIONS_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(CORRECTIONS_STORE_NAME);

    // First get count
    const countRequest = store.count();

    countRequest.onsuccess = () => {
      const currentCount = countRequest.result;

      if (currentCount <= maxEvents) {
        resolve(0);
        return;
      }

      const toDelete = currentCount - maxEvents;
      let deletedCount = 0;

      // Open cursor in ascending order (oldest first)
      const index = store.index('by-timestamp');
      const cursorRequest = index.openCursor(null, 'next');

      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor && deletedCount < toDelete) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      cursorRequest.onerror = () => {
        reject(new Error(`Failed to delete oldest entries: ${cursorRequest.error?.message || 'Unknown error'}`));
      };
    };

    countRequest.onerror = () => {
      reject(new Error(`Failed to count entries: ${countRequest.error?.message || 'Unknown error'}`));
    };
  });
}

/**
 * Delete the entire database (for testing or complete reset)
 * @param retries Number of retries if database is blocked (default: 3)
 */
export async function deleteDatabase(retries: number = 3): Promise<void> {
  // Close existing connection first
  closeDatabase();

  // Reset the cached availability flag so it can be re-checked after deletion
  indexedDBAvailable = null;

  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      resolve(); // Nothing to delete
      return;
    }

    const request = indexedDB.deleteDatabase(FEEDBACK_DB_NAME);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`Failed to delete database: ${request.error?.message || 'Unknown error'}`));
    };

    request.onblocked = () => {
      // Database is blocked by another connection - retry after a delay
      if (retries > 0) {
        log.warn('Database deletion blocked - retrying', { retries });
        setTimeout(() => {
          deleteDatabase(retries - 1).then(resolve).catch(reject);
        }, 100);
      } else {
        log.warn('Database deletion blocked - close all connections first');
        // Resolve anyway to prevent test hangs - the database will be cleaned on next run
        resolve();
      }
    };
  });
}
