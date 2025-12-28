/**
 * Shared Validator Types
 *
 * Platform-agnostic type definitions for PII validators.
 *
 * @module shared/pii/validators/types
 */

/**
 * Entity types supported by validators
 */
export type ValidatorEntityType =
  | 'SWISS_AVS'
  | 'IBAN'
  | 'EMAIL'
  | 'PHONE'
  | 'DATE'
  | 'SWISS_ADDRESS'
  | 'VAT_NUMBER';

/**
 * Minimal entity interface for validation
 */
export interface ValidatorEntity {
  text: string;
  type?: string;
}

/**
 * Validation result returned by validators
 */
export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  reason?: string;
}

/**
 * Interface for validation rules
 */
export interface ValidationRule {
  entityType: ValidatorEntityType;
  name: string;
  validate(entity: ValidatorEntity, context?: string): ValidationResult;
}
