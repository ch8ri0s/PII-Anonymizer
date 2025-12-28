/**
 * Shared PII Validators
 *
 * Validation functions for PII entity detection used by both
 * Electron app and browser-app.
 *
 * ## Adding a New Validator
 *
 * 1. Create your validator file (e.g., `MyValidator.ts`) with self-registration:
 *    ```typescript
 *    import { registerValidator } from './registry.js';
 *    export class MyValidator implements ValidationRule { ... }
 *    registerValidator(new MyValidator());
 *    ```
 *
 * 2. Import and export your validator in this file:
 *    ```typescript
 *    export { MyValidator, validateMy } from './MyValidator.js';
 *    ```
 *
 * That's it! Only 2 files needed (down from 5).
 *
 * @module shared/pii/validators
 */

// Types
export type {
  ValidatorEntityType,
  ValidatorEntity,
  ValidationResult,
  ValidationRule,
  ValidationContext,
} from './types.js';

// Confidence constants
export { CONFIDENCE } from './confidence.js';
export type { ConfidenceLevel, ConfidenceValue } from './confidence.js';

// Locale data (month names for EN, DE, FR, IT)
export {
  MONTH_NAME_TO_NUMBER,
  MONTH_NAMES,
  isMonthName,
  getMonthNumber,
  SUPPORTED_LANGUAGES,
} from './locale-data.js';
export type { SupportedLanguage } from './locale-data.js';

// Registry (export for direct access if needed)
export { validatorRegistry, registerValidator, ValidatorRegistry } from './registry.js';

// ============================================================================
// VALIDATOR IMPORTS - Each import triggers self-registration via registry
// ============================================================================
// Note: These imports must happen BEFORE getAllValidators()/getValidatorForType()
// are called. The re-exports below ensure validators are loaded and registered.

// Swiss Address Validator
export {
  SwissAddressValidator,
  validateSwissAddress,
  validateSwissAddressFull,
  type AddressValidationResult,
} from './SwissAddressValidator.js';

// Swiss AVS Number Validator
export {
  SwissAvsValidator,
  validateSwissAvs,
  validateSwissAvsFull,
} from './SwissAvsValidator.js';

// IBAN Validator
export {
  IbanValidator,
  validateIban,
  validateIbanFull,
} from './IbanValidator.js';

// Email Validator
export {
  EmailValidator,
  validateEmail,
  validateEmailFull,
} from './EmailValidator.js';

// Phone Number Validator
export {
  PhoneValidator,
  validatePhone,
  validatePhoneFull,
} from './PhoneValidator.js';

// Date Validator
export {
  DateValidator,
  validateDate,
  validateDateFull,
} from './DateValidator.js';

// Swiss Postal Code Validator
// @internal - Not included in registry. Exported for direct use only.
// Use SwissAddressValidator for registry-based address validation.
// This validator shares entityType 'SWISS_ADDRESS' with SwissAddressValidator,
// which would cause a Map key collision if registered.
export {
  SwissPostalCodeValidator,
  validateSwissPostalCode,
  validateSwissPostalCodeFull,
} from './SwissPostalCodeValidator.js';

// VAT Number Validator
export {
  VatNumberValidator,
  validateVatNumber,
  validateVatNumberFull,
} from './VatNumberValidator.js';

// ============================================================================
// REGISTRY ACCESS FUNCTIONS
// ============================================================================

import { validatorRegistry } from './registry.js';
import type { ValidationRule, ValidatorEntityType } from './types.js';

/**
 * Cached frozen array of validators (for backward compatibility)
 * The registry holds the validators; this caches the frozen array form.
 */
let validatorsCache: readonly ValidationRule[] | null = null;

/**
 * Get all validators (uses registry)
 *
 * Returns a frozen array of all registered validators. The array is
 * cached for performance and frozen to prevent accidental modification.
 *
 * Validators are registered via self-registration when their modules
 * are imported (see imports above).
 *
 * Note: SwissPostalCodeValidator is intentionally NOT included in this registry.
 * It shares entityType 'SWISS_ADDRESS' with SwissAddressValidator, which would
 * cause a Map key collision in getValidatorForType(). Use SwissPostalCodeValidator
 * directly for standalone postal code validation.
 *
 * @returns Frozen array of all registered validators (7 validators)
 */
export function getAllValidators(): readonly ValidationRule[] {
  if (!validatorsCache) {
    validatorsCache = Object.freeze(validatorRegistry.getAll());
  }
  return validatorsCache;
}

/**
 * Get validator for specific entity type (O(1) lookup via registry)
 *
 * Uses the registry's Map-based storage for constant-time lookups.
 *
 * @param type - The entity type to get validator for
 * @returns The validator for the type, or undefined if not found
 */
export function getValidatorForType(
  type: ValidatorEntityType,
): ValidationRule | undefined {
  return validatorRegistry.get(type);
}

// Import validator classes for manual re-registration after reset
import { SwissAddressValidator } from './SwissAddressValidator.js';
import { SwissAvsValidator } from './SwissAvsValidator.js';
import { IbanValidator } from './IbanValidator.js';
import { EmailValidator } from './EmailValidator.js';
import { PhoneValidator } from './PhoneValidator.js';
import { DateValidator } from './DateValidator.js';
import { VatNumberValidator } from './VatNumberValidator.js';
import { registerValidator } from './registry.js';

/**
 * Reset validator cache (for testing only)
 *
 * This function is intended for test isolation. Call it in
 * beforeEach/afterEach hooks to ensure tests start with fresh
 * validator instances.
 *
 * Note: This resets both the local cache AND the registry, then
 * re-registers all validators with fresh instances.
 *
 * @internal
 */
export function _resetValidatorsCache(): void {
  validatorsCache = null;
  validatorRegistry._reset();

  // Re-register validators with fresh instances
  // ES module imports are cached, so we need to manually re-register
  registerValidator(new SwissAddressValidator());
  registerValidator(new SwissAvsValidator());
  registerValidator(new IbanValidator());
  registerValidator(new EmailValidator());
  registerValidator(new PhoneValidator());
  registerValidator(new DateValidator());
  registerValidator(new VatNumberValidator());
}

/**
 * Reset validator map only (for testing only)
 *
 * This function resets only the local array cache while preserving
 * the registry's registered validators. Useful for testing cache
 * initialization behavior.
 *
 * @internal
 */
export function _resetValidatorMap(): void {
  validatorsCache = null;
}
