/**
 * Validator Registry
 *
 * Centralized registry for PII validators with auto-registration support.
 * Provides a clean pattern for adding new validators with minimal boilerplate.
 *
 * ## Adding a New Validator
 *
 * 1. Create your validator file (e.g., `MyValidator.ts`)
 * 2. Import and call `registerValidator()` at module level:
 *    ```typescript
 *    import { registerValidator } from './registry.js';
 *    export class MyValidator implements ValidationRule { ... }
 *    registerValidator(new MyValidator());
 *    ```
 * 3. Import your validator in `index.ts` to trigger registration
 *
 * That's it! Reduced from 5 files to 2.
 *
 * @module shared/pii/validators/registry
 */

import type { ValidationRule, ValidatorEntityType } from './types.js';

/**
 * Entry in the validator registry with priority for conflict resolution
 */
interface ValidatorEntry {
  /** The validator instance */
  validator: ValidationRule;
  /** Priority for conflict resolution (higher wins) */
  priority: number;
}

/**
 * Centralized registry for PII validators.
 *
 * Features:
 * - Map-based storage for O(1) lookups
 * - Priority system for handling entity type conflicts
 * - Freeze capability to lock registry after initialization
 * - Reset mechanism for test isolation
 *
 * @example
 * ```typescript
 * // Register a validator with default priority (0)
 * validatorRegistry.register(new MyValidator());
 *
 * // Register with higher priority to override existing
 * validatorRegistry.register(new BetterValidator(), 10);
 *
 * // Freeze to prevent runtime modifications
 * validatorRegistry.freeze();
 * ```
 */
export class ValidatorRegistry {
  /** Internal storage mapping entity type to validator entry */
  private validators = new Map<ValidatorEntityType, ValidatorEntry>();

  /** Whether the registry is frozen (no more registrations allowed) */
  private frozen = false;

  /**
   * Register a validator in the registry.
   *
   * If a validator for the same entity type already exists:
   * - Higher priority wins and replaces the existing validator
   * - Same priority: first registered validator wins (no replacement)
   *
   * @param validator - The validator to register
   * @param priority - Priority for conflict resolution (default: 0, higher wins)
   * @throws Error if registry is frozen
   *
   * @example
   * ```typescript
   * registry.register(new EmailValidator()); // priority 0
   * registry.register(new BetterEmailValidator(), 10); // replaces above
   * ```
   */
  register(validator: ValidationRule, priority = 0): void {
    if (this.frozen) {
      throw new Error(
        `Registry is frozen. Cannot register validator: ${validator.name}`,
      );
    }

    const entityType = validator.entityType as ValidatorEntityType;
    const existing = this.validators.get(entityType);

    // Register if no existing validator OR if new priority is higher
    if (!existing || priority > existing.priority) {
      this.validators.set(entityType, { validator, priority });
    }
    // If same priority, first one wins (do nothing)
  }

  /**
   * Get all registered validators.
   *
   * @returns Array of all registered validators (order not guaranteed)
   */
  getAll(): ValidationRule[] {
    return Array.from(this.validators.values()).map((entry) => entry.validator);
  }

  /**
   * Get a validator by entity type (O(1) lookup).
   *
   * @param type - The entity type to get validator for
   * @returns The validator for the type, or undefined if not found
   */
  get(type: ValidatorEntityType): ValidationRule | undefined {
    return this.validators.get(type)?.validator;
  }

  /**
   * Check if a validator exists for the given entity type.
   *
   * @param type - The entity type to check
   * @returns True if a validator is registered for this type
   */
  has(type: ValidatorEntityType): boolean {
    return this.validators.has(type);
  }

  /**
   * Freeze the registry to prevent further modifications.
   *
   * Once frozen, any attempt to register a new validator will throw an error.
   * This should be called after all validators are registered to prevent
   * accidental runtime modifications.
   *
   * Note: Freezing is one-way; use `_reset()` to unfreeze (for testing only).
   */
  freeze(): void {
    this.frozen = true;
  }

  /**
   * Check if the registry is frozen.
   *
   * @returns True if the registry is frozen
   */
  isFrozen(): boolean {
    return this.frozen;
  }

  /**
   * Get the number of registered validators.
   */
  get size(): number {
    return this.validators.size;
  }

  /**
   * Reset the registry (for testing only).
   *
   * Clears all registrations and unfreezes the registry.
   * This should only be used in test beforeEach/afterEach hooks.
   *
   * @internal
   */
  _reset(): void {
    this.validators.clear();
    this.frozen = false;
  }
}

/**
 * Singleton validator registry instance.
 *
 * Use this instance for all validator registration and lookup operations.
 * Validators self-register by calling `registerValidator()` at module load time.
 */
export const validatorRegistry = new ValidatorRegistry();

/**
 * Register a validator in the global registry.
 *
 * This is a convenience function that delegates to `validatorRegistry.register()`.
 * Use this in validator files for self-registration at module load time.
 *
 * @param validator - The validator to register
 * @param priority - Priority for conflict resolution (default: 0, higher wins)
 *
 * @example
 * ```typescript
 * // In MyValidator.ts
 * import { registerValidator } from './registry.js';
 *
 * export class MyValidator implements ValidationRule {
 *   entityType = 'MY_TYPE' as const;
 *   name = 'MyValidator';
 *   validate(entity) { ... }
 * }
 *
 * // Self-register on module import
 * registerValidator(new MyValidator());
 * ```
 */
export function registerValidator(
  validator: ValidationRule,
  priority = 0,
): void {
  validatorRegistry.register(validator, priority);
}
