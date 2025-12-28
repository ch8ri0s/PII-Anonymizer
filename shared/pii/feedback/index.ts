/**
 * Feedback Learning Loop Module (Story 8.9)
 *
 * Exports shared types and utilities for user feedback aggregation:
 * - Types for feedback events and patterns
 * - FeedbackAggregator for pattern analysis
 *
 * Used by both desktop (Electron) and browser applications.
 */

// Types
export type {
  FeedbackAction,
  FeedbackSource,
  EntityPosition,
  FeedbackEntity,
  FeedbackEvent,
  AggregatedPattern,
  FeedbackSummary,
  RetentionSettings,
  ExportMode,
  ExportOptions,
  AggregationResult,
  LogCorrectionInput,
  LogResult,
  IFeedbackLogger,
} from './types.js';

export {
  DEFAULT_RETENTION_SETTINGS,
  MAX_CONTEXT_LENGTH,
  LEGACY_ACTION_MAP,
  toFeedbackAction,
} from './types.js';

// Aggregator
export {
  FeedbackAggregator,
  createAggregator,
} from './FeedbackAggregator.js';

export type { AggregationOptions } from './FeedbackAggregator.js';
