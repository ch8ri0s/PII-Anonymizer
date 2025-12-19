/**
 * Central Constants Configuration
 *
 * Story 6.8: Constants and Magic Numbers
 * Provides centralized, documented constants for the entire application.
 *
 * Organization:
 * - PREVIEW: File preview display limits
 * - PROCESSING: File processing and regex parameters
 * - SECURITY: Security limits and constraints
 * - TIMEOUT: Operation timeout values (re-exported from asyncTimeout)
 * - LOGGING: Log file management limits
 */

// ============================================================================
// Preview Constants
// ============================================================================

/**
 * Preview display configuration
 * Controls how file previews are shown in the UI
 */
export const PREVIEW = {
  /**
   * Maximum number of lines to display in file preview
   * @description Limits preview to first N lines for performance
   */
  LINE_LIMIT: 20,

  /**
   * Maximum number of characters to display in file preview
   * @description Prevents UI from being overwhelmed by large files
   */
  CHAR_LIMIT: 1000,

  /**
   * Default lines for preview handlers when no limit specified
   * @description Used in filePreviewHandlers.ts as fallback
   */
  DEFAULT_LINES: 100,

  /**
   * Default characters for preview handlers when no limit specified
   * @description Used in filePreviewHandlers.ts as fallback
   */
  DEFAULT_CHARS: 10000,
} as const;

// ============================================================================
// Processing Constants
// ============================================================================

/**
 * File processing configuration
 * Controls PII detection and text processing behavior
 */
export const PROCESSING = {
  /**
   * Maximum gap tolerance for fuzzy regex matching
   * @description Allows N non-alphanumeric characters between matched characters
   * Reduced from 3 to 2 for better ReDoS protection (Story 6.2)
   * @example "John Doe" matches "John-Doe" or "John  Doe" but not "John----Doe"
   */
  FUZZY_MATCH_GAP_TOLERANCE: 2,

  /**
   * Maximum entity length before skipping (ReDoS protection)
   * @description Prevents processing extremely long strings that could cause exponential backtracking
   * @security Mitigates ReDoS vulnerability in fuzzy regex building
   */
  MAX_ENTITY_LENGTH: 50,

  /**
   * Minimum entity length for detection
   * @description Prevents false positives from single-character matches
   * @example "C" would be too short, "John" would pass
   */
  MIN_ENTITY_LENGTH: 3,

  /**
   * Maximum character count after cleanup
   * @description Additional safeguard against complex entities after punctuation removal
   */
  MAX_ENTITY_CHARS_CLEANED: 30,

  /**
   * Default regex test timeout in milliseconds
   * @description Prevents regex execution from hanging on pathological input
   * @security Part of ReDoS mitigation strategy
   */
  REGEX_TIMEOUT_MS: 100,

  /**
   * Base timeout for file processing in milliseconds
   * @description Starting point for file processing timeout calculation
   */
  BASE_TIMEOUT_MS: 30000,

  /**
   * Additional timeout per megabyte of file size
   * @description Scales timeout based on file size for large files
   */
  PER_MB_TIMEOUT_MS: 10000,
} as const;

// ============================================================================
// Security Constants
// ============================================================================

/**
 * Security limits and constraints
 * Enforces safe boundaries for file and data handling
 */
export const SECURITY = {
  /**
   * Maximum file size allowed for processing in bytes (100MB)
   * @description Prevents OOM attacks and ensures reasonable processing times
   */
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024,

  /**
   * Maximum string length in IPC payloads in bytes (1MB)
   * @description Prevents memory exhaustion from large string inputs
   */
  MAX_STRING_LENGTH: 1024 * 1024,

  /**
   * Maximum array items in IPC payloads
   * @description Prevents processing extremely large arrays
   */
  MAX_ARRAY_ITEMS: 10000,

  /**
   * Maximum object nesting depth
   * @description Prevents stack overflow from deeply nested objects
   */
  MAX_OBJECT_DEPTH: 10,

  /**
   * Maximum path length
   * @description Enforces reasonable path lengths (typical OS limit)
   */
  MAX_PATH_LENGTH: 4096,
} as const;

// ============================================================================
// Timeout Constants
// ============================================================================

/**
 * Operation timeout configuration
 * Defines timeout values for various async operations
 *
 * Note: These values mirror DEFAULT_TIMEOUT_CONFIG in asyncTimeout.ts
 * for backward compatibility. The asyncTimeout module remains the
 * authoritative source for timeout utilities.
 */
export const TIMEOUT = {
  /**
   * Default file processing timeout in milliseconds (60 seconds)
   * @description Main file processing operation timeout
   * Story 6.5 AC5: Default 60s
   */
  FILE_PROCESSING_MS: 60 * 1000,

  /**
   * File preview generation timeout in milliseconds (30 seconds)
   * @description Preview extraction and display timeout
   */
  FILE_PREVIEW_MS: 30 * 1000,

  /**
   * Metadata extraction timeout in milliseconds (10 seconds)
   * @description File metadata reading timeout
   */
  METADATA_MS: 10 * 1000,

  /**
   * JSON file read timeout in milliseconds (5 seconds)
   * @description JSON parsing and reading timeout
   */
  JSON_READ_MS: 5 * 1000,

  /**
   * Minimum allowed timeout in milliseconds (10 seconds)
   * @description Floor for all configurable timeouts
   * Story 6.5 AC5: Min 10s
   */
  MIN_MS: 10 * 1000,

  /**
   * Maximum allowed timeout in milliseconds (10 minutes)
   * @description Ceiling for all configurable timeouts
   * Story 6.5 AC5: Max 600s
   */
  MAX_MS: 600 * 1000,
} as const;

// ============================================================================
// Logging Constants
// ============================================================================

/**
 * Logging and accuracy statistics configuration
 * Controls log file management and retention
 */
export const LOGGING = {
  /**
   * Maximum number of log files to retain (~5 years of monthly logs)
   * @description Prevents unbounded log storage growth
   */
  MAX_LOG_FILES: 60,

  /**
   * Maximum entries per log file
   * @description Prevents individual log files from becoming too large
   */
  MAX_ENTRIES_PER_FILE: 10000,

  /**
   * Maximum total entries across all log files
   * @description Global limit on correction log entries
   */
  MAX_TOTAL_ENTRIES: 100000,
} as const;

// ============================================================================
// UI Constants
// ============================================================================

/**
 * User interface configuration
 * Controls visual elements and animations
 */
export const UI = {
  /**
   * Default animation duration in milliseconds
   * @description Standard transition timing for UI elements
   */
  ANIMATION_DURATION_MS: 200,

  /**
   * Debounce delay for search inputs in milliseconds
   * @description Prevents excessive API calls during typing
   */
  SEARCH_DEBOUNCE_MS: 300,

  /**
   * Toast notification display duration in milliseconds
   * @description How long toast messages are shown
   */
  TOAST_DURATION_MS: 3000,
} as const;

// ============================================================================
// Type Exports
// ============================================================================

/** Preview configuration type */
export type PreviewConfig = typeof PREVIEW;

/** Processing configuration type */
export type ProcessingConfig = typeof PROCESSING;

/** Security configuration type */
export type SecurityConfig = typeof SECURITY;

/** Timeout configuration type */
export type TimeoutConfigType = typeof TIMEOUT;

/** Logging configuration type */
export type LoggingConfig = typeof LOGGING;

/** UI configuration type */
export type UIConfig = typeof UI;

// ============================================================================
// Re-exports for convenience
// ============================================================================

/**
 * All constants combined for bulk import
 */
export const CONSTANTS = {
  PREVIEW,
  PROCESSING,
  SECURITY,
  TIMEOUT,
  LOGGING,
  UI,
} as const;

export default CONSTANTS;
