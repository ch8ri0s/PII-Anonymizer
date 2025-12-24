/**
 * FeedbackLogger - User Correction Feedback Logging Service
 *
 * Story 7.8: User Correction Feedback Logging
 * AC #1: Correction is logged to IndexedDB with anonymized context
 * AC #2: Log entry includes: action type, entity type, anonymized context, document hash, timestamp
 * AC #3: For dismissals: original detection source and confidence score are recorded
 * AC #4: User can enable/disable feedback logging via settings toggle
 * AC #5: Settings preference persists in localStorage
 * AC #6: Simple statistics are exposed
 *
 * Browser port of src/services/feedbackLogger.ts using IndexedDB and localStorage.
 */

import type {
  CorrectionEntry,
  LogCorrectionInput,
  LogResult,
  FeedbackSettings,
  FeedbackStatistics,
} from '../types/feedback';

import {
  DEFAULT_FEEDBACK_SETTINGS,
  FEEDBACK_SETTINGS_KEY,
  DEFAULT_RETENTION_MONTHS,
} from '../types/feedback';

import {
  isIndexedDBAvailable,
  addEntry,
  getAllEntries,
  getRecentEntries,
  deleteEntriesOlderThan,
} from './FeedbackStore';

import {
  anonymizeForLog,
  hashDocumentName,
  generateId,
  getCurrentMonth,
} from './LogAnonymizer';

// Module-level singleton state
let settings: FeedbackSettings | null = null;
let statisticsCache: FeedbackStatistics | null = null;
let statisticsCacheTime: number = 0;
const STATISTICS_CACHE_TTL = 60000; // 1 minute cache

/**
 * Load settings from localStorage
 * @returns The feedback settings
 */
function loadSettings(): FeedbackSettings {
  if (settings !== null) {
    return settings;
  }

  try {
    const stored = localStorage.getItem(FEEDBACK_SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as FeedbackSettings;
      settings = { ...DEFAULT_FEEDBACK_SETTINGS, ...parsed };
      return settings;
    }
  } catch (error) {
    console.warn('Failed to load feedback settings, using defaults:', error);
  }

  settings = { ...DEFAULT_FEEDBACK_SETTINGS };
  return settings;
}

/**
 * Save settings to localStorage
 */
function saveSettings(): void {
  if (!settings) return;

  try {
    settings.updatedAt = new Date().toISOString();
    localStorage.setItem(FEEDBACK_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save feedback settings:', error);
  }
}

/**
 * Invalidate the statistics cache
 */
function invalidateStatisticsCache(): void {
  statisticsCache = null;
  statisticsCacheTime = 0;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if feedback logging is enabled
 * @returns true if logging is enabled
 */
export function isEnabled(): boolean {
  return loadSettings().enabled;
}

/**
 * Enable or disable feedback logging
 * @param enabled Whether to enable logging
 */
export function setEnabled(enabled: boolean): void {
  settings = loadSettings();
  settings.enabled = enabled;
  saveSettings();
}

/**
 * Get the current settings
 * @returns The feedback settings object
 */
export function getSettings(): FeedbackSettings {
  return { ...loadSettings() };
}

/**
 * Check if the feedback logging system is available
 * (IndexedDB may be blocked in private browsing)
 * @returns true if the system can log corrections
 */
export function isAvailable(): boolean {
  return isIndexedDBAvailable();
}

/**
 * Log a correction entry
 *
 * Records when a user dismisses a detected entity or manually adds one.
 * All data is anonymized before storage.
 *
 * @param input - The correction input data
 * @returns Result of the logging operation
 */
export async function logCorrection(input: LogCorrectionInput): Promise<LogResult> {
  // Check if logging is enabled
  if (!isEnabled()) {
    return { success: true, error: 'Logging disabled' };
  }

  // Check if IndexedDB is available
  if (!isAvailable()) {
    return { success: false, error: 'IndexedDB not available' };
  }

  try {
    // Validate input
    if (!input.action || !input.entityType || !input.documentName) {
      return { success: false, error: 'Invalid input: missing required fields' };
    }

    // Get current timestamp and month
    const timestamp = new Date().toISOString();
    const month = getCurrentMonth();

    // Anonymize the context and hash the document name
    const anonymizedContext = anonymizeForLog(
      input.contextText,
      input.entityType,
      input.originalText,
    );
    const documentHash = await hashDocumentName(input.documentName);

    // Create the correction entry
    const entry: CorrectionEntry = {
      id: generateId(),
      timestamp,
      month,
      action: input.action,
      entityType: input.entityType,
      context: anonymizedContext,
      documentHash,
    };

    // Add optional fields for DISMISS action
    if (input.action === 'DISMISS') {
      if (input.originalSource) {
        entry.originalSource = input.originalSource;
      }
      if (input.confidence !== undefined) {
        entry.confidence = input.confidence;
      }
    }

    // Add position if provided
    if (input.position) {
      entry.position = input.position;
    }

    // Store in IndexedDB
    await addEntry(entry);

    // Invalidate statistics cache
    invalidateStatisticsCache();

    return { success: true, entryId: entry.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Failed to log correction:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Get statistics about logged corrections
 *
 * Returns counts by action type and entity type, plus date range info.
 * Results are cached for performance.
 *
 * @returns Statistics about corrections
 */
export async function getStatistics(): Promise<FeedbackStatistics> {
  // Return cached statistics if still valid
  const now = Date.now();
  if (statisticsCache && (now - statisticsCacheTime) < STATISTICS_CACHE_TTL) {
    return statisticsCache;
  }

  // Default empty statistics
  const stats: FeedbackStatistics = {
    totalCorrections: 0,
    byAction: { DISMISS: 0, ADD: 0 },
    byType: {},
  };

  // Check availability
  if (!isAvailable()) {
    return stats;
  }

  try {
    const entries = await getAllEntries();

    if (entries.length === 0) {
      statisticsCache = stats;
      statisticsCacheTime = now;
      return stats;
    }

    // Calculate statistics
    stats.totalCorrections = entries.length;

    // Sort by timestamp to find oldest/newest
    entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    stats.oldestEntry = entries[0].timestamp;
    stats.newestEntry = entries[entries.length - 1].timestamp;

    // Count by action and type
    for (const entry of entries) {
      // Count by action
      if (entry.action === 'DISMISS') {
        stats.byAction.DISMISS++;
      } else if (entry.action === 'ADD') {
        stats.byAction.ADD++;
      }

      // Count by entity type
      const type = entry.entityType;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
    }

    // Cache the results
    statisticsCache = stats;
    statisticsCacheTime = now;

    return stats;
  } catch (error) {
    console.error('Failed to get statistics:', error);
    return stats;
  }
}

/**
 * Get recent correction entries
 *
 * @param limit Maximum number of entries to return (default: 10)
 * @returns Array of recent correction entries
 */
export async function getRecentCorrections(limit: number = 10): Promise<CorrectionEntry[]> {
  if (!isAvailable()) {
    return [];
  }

  try {
    return await getRecentEntries(limit);
  } catch (error) {
    console.error('Failed to get recent corrections:', error);
    return [];
  }
}

/**
 * Run monthly rotation to delete old entries
 *
 * Should be called periodically (e.g., on app initialization).
 *
 * @param retentionMonths Number of months to retain (default: 6)
 * @returns Number of entries deleted
 */
export async function runRotation(
  retentionMonths: number = DEFAULT_RETENTION_MONTHS,
): Promise<number> {
  if (!isAvailable()) {
    return 0;
  }

  try {
    const deleted = await deleteEntriesOlderThan(retentionMonths);
    if (deleted > 0) {
      invalidateStatisticsCache();
    }
    return deleted;
  } catch (error) {
    console.error('Failed to run rotation:', error);
    return 0;
  }
}

/**
 * Initialize the feedback logger
 *
 * Should be called on app startup. Loads settings and runs rotation.
 */
export async function initFeedbackLogger(): Promise<void> {
  // Load settings
  loadSettings();

  // Run rotation to clean up old entries
  try {
    const deleted = await runRotation();
    if (deleted > 0) {
      console.log(`Feedback logger: Rotated ${deleted} old entries`);
    }
  } catch (error) {
    // Non-fatal - just log and continue
    console.warn('Feedback logger rotation failed:', error);
  }
}

/**
 * Reset the feedback logger (for testing)
 */
export function resetFeedbackLogger(): void {
  settings = null;
  invalidateStatisticsCache();
}
