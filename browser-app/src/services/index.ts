/**
 * Browser App Services
 *
 * Exports all services for the browser-based PII anonymizer.
 */

// Feedback Logging (Story 7.8)
export {
  isEnabled as isFeedbackEnabled,
  setEnabled as setFeedbackEnabled,
  isAvailable as isFeedbackAvailable,
  logCorrection,
  getStatistics as getFeedbackStatistics,
  getRecentCorrections,
  runRotation as runFeedbackRotation,
  initFeedbackLogger,
  resetFeedbackLogger,
  getSettings as getFeedbackSettings,
} from './FeedbackLogger';

export {
  isIndexedDBAvailable,
  openDatabase as openFeedbackDatabase,
  closeDatabase as closeFeedbackDatabase,
  addEntry as addFeedbackEntry,
  getEntriesByMonth as getFeedbackEntriesByMonth,
  getAllEntries as getAllFeedbackEntries,
  getRecentEntries as getRecentFeedbackEntries,
  getEntryCount as getFeedbackEntryCount,
  deleteEntriesOlderThan as deleteFeedbackEntriesOlderThan,
  deleteAllEntries as deleteAllFeedbackEntries,
  deleteDatabase as deleteFeedbackDatabase,
} from './FeedbackStore';

export {
  anonymizeForLog,
  hashDocumentName,
  generateId as generateFeedbackId,
  getTypeMarker,
  getCurrentMonth,
  isMonthExpired,
} from './LogAnonymizer';

export {
  setCurrentDocument,
  clearCurrentDocument,
  initializeSelectionTracking,
  handleSelectionChanges,
  handleManualMark,
  logDismiss,
  logAdd,
  resetFeedbackIntegration,
} from './FeedbackIntegration';

// Type re-exports
export type {
  CorrectionEntry,
  CorrectionAction,
  LogCorrectionInput,
  LogResult,
  FeedbackSettings,
  FeedbackStatistics,
  EntitySource,
} from '../types/feedback';

export {
  DEFAULT_FEEDBACK_SETTINGS,
  DEFAULT_RETENTION_MONTHS,
  FEEDBACK_DB_NAME,
  FEEDBACK_DB_VERSION,
  CORRECTIONS_STORE_NAME,
  FEEDBACK_SETTINGS_KEY,
} from '../types/feedback';
