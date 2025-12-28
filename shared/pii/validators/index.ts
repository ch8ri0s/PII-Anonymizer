/**
 * Shared PII Validators
 *
 * Validation functions for PII entity detection used by both
 * Electron app and browser-app.
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
// @internal - Not included in getAllValidators() registry. Exported for direct use only.
// Use SwissAddressValidator for registry-based address validation.
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

// Import classes for getAllValidators
// Note: SwissPostalCodeValidator is intentionally NOT imported here because it is
// not included in the registry. It shares entityType 'SWISS_ADDRESS' with
// SwissAddressValidator, which would cause a Map key collision in getValidatorForType().
import { SwissAddressValidator } from './SwissAddressValidator.js';
import { SwissAvsValidator } from './SwissAvsValidator.js';
import { IbanValidator } from './IbanValidator.js';
import { EmailValidator } from './EmailValidator.js';
import { PhoneValidator } from './PhoneValidator.js';
import { DateValidator } from './DateValidator.js';
import { VatNumberValidator } from './VatNumberValidator.js';
import type { ValidationRule, ValidatorEntityType } from './types.js';

/**
 * Cached validator instances (singleton pattern)
 * Validators are stateless, so a single instance per type is sufficient.
 */
let validatorsCache: readonly ValidationRule[] | null = null;

/**
 * Cached validator map for O(1) type lookups
 * Lazily initialized from validatorsCache on first getValidatorForType() call.
 */
let validatorMap: Map<ValidatorEntityType, ValidationRule> | null = null;

/**
 * Get all validators (singleton pattern)
 *
 * Validators are instantiated once and cached for the lifetime
 * of the application. The returned array is frozen to prevent
 * accidental modification.
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
    validatorsCache = Object.freeze([
      new SwissAddressValidator(),
      new SwissAvsValidator(),
      new IbanValidator(),
      new EmailValidator(),
      new PhoneValidator(),
      new DateValidator(),
      // SwissPostalCodeValidator intentionally NOT included - see @internal docs
      new VatNumberValidator(),
    ]);
  }
  return validatorsCache;
}

/**
 * Reset validator cache (for testing only)
 *
 * This function is intended for test isolation. Call it in
 * beforeEach/afterEach hooks to ensure tests start with fresh
 * validator instances.
 *
 * @internal
 */
export function _resetValidatorsCache(): void {
  validatorsCache = null;
  validatorMap = null;
}

/**
 * Reset validator map only (for testing only)
 *
 * This function resets only the validator map cache while preserving
 * the validators cache. Useful for testing map initialization behavior.
 *
 * @internal
 */
export function _resetValidatorMap(): void {
  validatorMap = null;
}

/**
 * Get validator for specific entity type (O(1) lookup)
 *
 * Uses a lazily-initialized Map for constant-time lookups.
 * The map is built from getAllValidators() on first call and
 * cached for subsequent lookups.
 *
 * @param type - The entity type to get validator for
 * @returns The validator for the type, or undefined if not found
 */
export function getValidatorForType(
  type: ValidatorEntityType,
): ValidationRule | undefined {
  if (!validatorMap) {
    validatorMap = new Map(
      getAllValidators().map((v) => [v.entityType as ValidatorEntityType, v]),
    );
  }
  return validatorMap.get(type);
}
