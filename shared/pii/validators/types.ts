/**
 * Shared Validator Types
 *
 * Platform-agnostic type definitions for PII validators.
 * Unified interface for both Electron app (src/) and browser-app.
 *
 * @module shared/pii/validators/types
 */

/**
 * Entity types supported by validators in the shared module.
 * The main app (src/types/detection.ts) extends this with additional types.
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
 * Minimal entity interface for validation.
 * This is the base interface - the main app's Entity extends this.
 *
 * Compatible with both:
 * - Minimal objects: { text: 'example', type: 'EMAIL' }
 * - Full Entity objects from src/types/detection.ts
 */
export interface ValidatorEntity {
  /** The text to validate */
  text: string;
  /** Entity type (optional for minimal validation) */
  type?: string;
}

/**
 * Optional validation context for enhanced validation.
 * Provides additional information to validators without requiring it.
 */
export interface ValidationContext {
  /** Full document text for context analysis */
  fullText?: string;
  /** Position of entity in fullText (avoids indexOf search) */
  position?: number;
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
 * Interface for validation rules.
 *
 * Generic interface supporting both:
 * - Shared validators with minimal ValidatorEntity
 * - Main app validators with full Entity
 *
 * @template TEntity - Entity type, defaults to ValidatorEntity
 * @template TEntityType - Entity type string, defaults to ValidatorEntityType | string
 */
export interface ValidationRule<
  TEntity extends ValidatorEntity = ValidatorEntity,
  TEntityType extends string = ValidatorEntityType | string
> {
  /** Entity type this rule applies to */
  entityType: TEntityType;

  /** Rule name for logging */
  name: string;

  /**
   * Validate an entity
   * @param entity - Entity to validate (minimal or full)
   * @param context - Optional validation context (fullText, position)
   * @returns Validation result
   */
  validate(entity: TEntity, context?: ValidationContext | string): ValidationResult;
}
