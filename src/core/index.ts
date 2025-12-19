/**
 * Core Module - Shared Pure Functions
 *
 * This module contains all pure functions that work in both
 * Node.js (Electron) and browser environments.
 *
 * NO I/O operations - just transformations and logic.
 */

// Re-export session management
export { FileProcessingSession } from './Session.js';
export type { AddressEntry, AnonymizedRange, AddressEntityInput } from './Session.js';

// Re-export anonymization utilities
export {
  buildFuzzyRegex,
  escapeRegexChars,
  extractCodeBlocks,
  restoreCodeBlocks,
  extractInlineCode,
  restoreInlineCode,
  isGroupedAddress,
} from './anonymization.js';
export type { PIIEntity, MappingFile } from './anonymization.js';

// Re-export PII detector (TypeScript version - browser compatible)
export { SwissEuDetector } from '../pii/SwissEuDetector.js';
export type { PIIMatch, FormattedMatch } from '../pii/SwissEuDetector.js';
