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
} from './types.js';

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
import { SwissAddressValidator } from './SwissAddressValidator.js';
import { SwissAvsValidator } from './SwissAvsValidator.js';
import { IbanValidator } from './IbanValidator.js';
import { EmailValidator } from './EmailValidator.js';
import { PhoneValidator } from './PhoneValidator.js';
import { DateValidator } from './DateValidator.js';
import { SwissPostalCodeValidator } from './SwissPostalCodeValidator.js';
import { VatNumberValidator } from './VatNumberValidator.js';
import type { ValidationRule, ValidatorEntityType } from './types.js';

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
  type: ValidatorEntityType,
): ValidationRule | undefined {
  const validators = getAllValidators();
  return validators.find((v) => v.entityType === type);
}
