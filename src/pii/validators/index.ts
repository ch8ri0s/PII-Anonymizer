/**
 * Entity Format Validators
 *
 * Validation rules for PII entity formats (Pass 2).
 * Re-exports validators from shared module for platform compatibility.
 *
 * Uses singleton pattern from shared module - validators are instantiated
 * once and cached for the lifetime of the application.
 *
 * @module src/pii/validators
 */

// Re-export all validators from shared (compiled)
export {
  // Types
  type ValidatorEntityType,
  type ValidatorEntity,
  type ValidationResult as SharedValidationResult,
  type ValidationRule as SharedValidationRule,
  type ValidationContext,
  type AddressValidationResult,
  // Swiss Address Validator
  SwissAddressValidator,
  validateSwissAddress,
  validateSwissAddressFull,
  // Swiss AVS Validator
  SwissAvsValidator,
  validateSwissAvs,
  validateSwissAvsFull,
  // IBAN Validator
  IbanValidator,
  validateIban,
  validateIbanFull,
  // Email Validator
  EmailValidator,
  validateEmail,
  validateEmailFull,
  // Phone Validator
  PhoneValidator,
  validatePhone,
  validatePhoneFull,
  // Date Validator
  DateValidator,
  validateDate,
  validateDateFull,
  // Swiss Postal Code Validator
  SwissPostalCodeValidator,
  validateSwissPostalCode,
  validateSwissPostalCodeFull,
  // VAT Number Validator
  VatNumberValidator,
  validateVatNumber,
  validateVatNumberFull,
  // Singleton functions
  getAllValidators,
  getValidatorForType,
  _resetValidatorsCache,
} from '../../../shared/dist/pii/validators/index.js';

import type { ValidationRule as SharedValidationRule } from '../../../shared/dist/pii/validators/index.js';

// Re-export the ValidationRule type for use by FormatValidationPass
export type { SharedValidationRule as ValidationRule };
