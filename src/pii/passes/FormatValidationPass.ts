/**
 * Pass 2: Format Validation
 *
 * Second pass in the detection pipeline that validates entity formats.
 * Checks checksums, patterns, and format rules to filter false positives.
 *
 * @module src/pii/passes/FormatValidationPass
 */

import type {
  Entity,
  DetectionPass,
  PipelineContext,
  ValidationRule,
  EntityType,
} from '../../types/detection.js';
import { getAllValidators } from '../validators/index.js';

/**
 * Format Validation Pass
 *
 * Validates entity formats and checksums from Pass 1.
 * Entities failing validation are marked low-confidence (not removed).
 */
export class FormatValidationPass implements DetectionPass {
  readonly name = 'FormatValidationPass';
  readonly order = 20;
  enabled = true;

  private validators: ValidationRule[];

  constructor(validators?: ValidationRule[]) {
    this.validators = validators || getAllValidators();
  }

  /**
   * Add a custom validator
   */
  addValidator(validator: ValidationRule): void {
    this.validators.push(validator);
  }

  /**
   * Execute format validation
   */
  async execute(
    _text: string,
    entities: Entity[],
    _context: PipelineContext,
  ): Promise<Entity[]> {
    return entities.map((entity) => this.validateEntity(entity));
  }

  /**
   * Validate a single entity
   */
  private validateEntity(entity: Entity): Entity {
    const validator = this.getValidator(entity.type);

    if (!validator) {
      // No validator for this type - mark as unchecked
      return {
        ...entity,
        validation: {
          status: 'unchecked',
          reason: `No validator for type ${entity.type}`,
        },
      };
    }

    const result = validator.validate(entity);

    // Calculate new confidence based on validation
    let newConfidence = entity.confidence;
    if (result.isValid) {
      // Boost confidence for valid entities
      newConfidence = Math.min(1.0, entity.confidence * 1.2);
    } else {
      // Reduce confidence for invalid entities
      newConfidence = Math.min(entity.confidence, result.confidence);
    }

    return {
      ...entity,
      confidence: newConfidence,
      validation: {
        status: result.isValid ? 'valid' : 'invalid',
        reason: result.reason,
        checkedBy: validator.name,
      },
    };
  }

  /**
   * Get validator for entity type
   */
  private getValidator(type: EntityType): ValidationRule | undefined {
    return this.validators.find((v) => v.entityType === type);
  }
}

/**
 * Create a configured FormatValidationPass instance
 */
export function createFormatValidationPass(
  validators?: ValidationRule[],
): FormatValidationPass {
  return new FormatValidationPass(validators);
}
