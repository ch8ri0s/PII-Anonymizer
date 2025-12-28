/**
 * Confidence Level Constants
 *
 * Standardized confidence values for PII validation results.
 * Higher values indicate stronger certainty in the validation outcome.
 *
 * @module shared/pii/validators/confidence
 */

/**
 * Validation confidence levels
 */
export const CONFIDENCE = {
  /**
   * Checksum-validated entity (AVS, IBAN)
   * Mathematical verification passed - highest certainty
   */
  CHECKSUM_VALID: 0.95,

  /**
   * Strong format match with additional validation
   * Format correct + secondary checks passed
   */
  FORMAT_VALID: 0.9,

  /**
   * Standard format validation passed
   * Format matches expected pattern
   */
  STANDARD: 0.85,

  /**
   * Known valid entity in expected range
   * Matches known data (city names, postal codes)
   */
  KNOWN_VALID: 0.82,

  /**
   * Partial validation passed
   * Some checks passed, others not applicable
   */
  MODERATE: 0.75,

  /**
   * Weak match requiring context
   * Format recognized but needs additional signals
   */
  WEAK: 0.5,

  /**
   * Format invalid but entity type recognized
   * Looks like the entity type but fails validation
   */
  INVALID_FORMAT: 0.4,

  /**
   * Validation failed
   * Does not match expected format
   */
  FAILED: 0.3,

  /**
   * Strong false positive indicator
   * Detected as something else (e.g., year vs postal code)
   */
  FALSE_POSITIVE: 0.2,
} as const;

/**
 * Type for confidence level keys
 */
export type ConfidenceLevel = keyof typeof CONFIDENCE;

/**
 * Type for confidence values
 */
export type ConfidenceValue = (typeof CONFIDENCE)[ConfidenceLevel];
