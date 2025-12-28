/**
 * Entity Format Validators
 *
 * Validation rules for PII entity formats (Pass 2).
 * Re-exports validators from shared module for platform compatibility.
 *
 * @module src/pii/validators
 */

import type { EntityType } from '../../types/detection.js';

// Re-export all validators from shared (compiled)
export {
  // Types
  type ValidatorEntityType,
  type ValidatorEntity,
  type ValidationResult as SharedValidationResult,
  type ValidationRule as SharedValidationRule,
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
} from '../../../shared/dist/pii/validators/index.js';

// Import for local use
import {
  SwissAddressValidator,
  SwissAvsValidator,
  IbanValidator,
  EmailValidator,
  PhoneValidator,
  DateValidator,
  SwissPostalCodeValidator,
  VatNumberValidator,
} from '../../../shared/dist/pii/validators/index.js';

import type { ValidationRule } from '../../../shared/dist/pii/validators/index.js';

/**
 * Get all validators
 */
export function getAllValidators(): ValidationRule[] {
  return [
    new SwissAddressValidator(),
    new SwissAvsValidator(),
    new IbanValidator(),
    new EmailValidator(),
    new PhoneValidator(),
    new DateValidator(),
    new SwissPostalCodeValidator(),
    new VatNumberValidator(),
  ];
}

/**
 * Get validator for specific entity type
 */
export function getValidatorForType(
  type: EntityType,
): ValidationRule | undefined {
  const validators = getAllValidators();
  return validators.find((v) => v.entityType === type);
}
