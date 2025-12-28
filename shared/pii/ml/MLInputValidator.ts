/**
 * ML Input Validation Utility (Story 8.12)
 *
 * Validates and normalizes text input before ML inference.
 * Prevents invalid inputs from reaching the model.
 *
 * @module shared/pii/ml/MLInputValidator
 */

/**
 * Configuration for input validation
 */
export interface ValidationConfig {
  /** Maximum text length in characters (default: 100,000) */
  maxLength: number;
  /** Minimum text length (default: 1) */
  minLength: number;
  /** Whether to allow empty strings (default: false) */
  allowEmpty: boolean;
  /** Whether to normalize encoding (default: true) */
  normalizeEncoding: boolean;
  /** Whether to trim whitespace (default: true) */
  trimWhitespace: boolean;
}

/**
 * Result of input validation
 */
export interface ValidationResult {
  /** Whether the input is valid for ML inference */
  valid: boolean;
  /** Normalized text if valid */
  text?: string;
  /** Error message if invalid */
  error?: string;
  /** Non-fatal warnings */
  warnings?: string[];
}

/**
 * Default validation configuration
 */
export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  maxLength: 100_000, // 100K characters (~25K tokens)
  minLength: 1,
  allowEmpty: false,
  normalizeEncoding: true,
  trimWhitespace: true,
};

/**
 * Common control character codes that may affect ML processing
 */
const CONTROL_CHAR_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Invalid UTF-8 replacement character
 */
const REPLACEMENT_CHAR = '\uFFFD';

/**
 * Pattern to detect replacement characters (indicates encoding issues)
 */
const REPLACEMENT_CHAR_PATTERN = /\uFFFD/g;

/**
 * Validate and normalize text input for ML inference
 *
 * @param text - Input text to validate (may be null/undefined)
 * @param config - Optional validation configuration
 * @returns Validation result with normalized text or error
 *
 * @example
 * ```typescript
 * const result = validateMLInput("Hello, world!");
 * if (result.valid) {
 *   const normalizedText = result.text;
 *   // Proceed with ML inference
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function validateMLInput(
  text: string | null | undefined,
  config?: Partial<ValidationConfig>,
): ValidationResult {
  const cfg = { ...DEFAULT_VALIDATION_CONFIG, ...config };
  const warnings: string[] = [];

  // Rule 1: Null/Undefined Check
  if (text === null || text === undefined) {
    return {
      valid: false,
      error: 'Input text is null or undefined',
    };
  }

  // Ensure text is a string (type guard)
  if (typeof text !== 'string') {
    return {
      valid: false,
      error: `Input text must be a string, got ${typeof text}`,
    };
  }

  let normalizedText = text;

  // Rule 2: Trim whitespace if configured
  if (cfg.trimWhitespace) {
    normalizedText = normalizedText.trim();
  }

  // Rule 3: Empty String Check
  if (normalizedText.length === 0) {
    if (!cfg.allowEmpty) {
      return {
        valid: false,
        error: 'Input text is empty',
      };
    }
    // Allow empty if configured
    return {
      valid: true,
      text: normalizedText,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Rule 4: Minimum Length Check
  if (normalizedText.length < cfg.minLength) {
    return {
      valid: false,
      error: `Input text is too short (${normalizedText.length} < ${cfg.minLength} characters)`,
    };
  }

  // Rule 5: Maximum Length Check
  if (normalizedText.length > cfg.maxLength) {
    return {
      valid: false,
      error: `Input text exceeds maximum length of ${cfg.maxLength} characters (got ${normalizedText.length})`,
      warnings: ['Consider using document chunking (Story 8.11) for large documents'],
    };
  }

  // Rule 6: Encoding Normalization
  if (cfg.normalizeEncoding) {
    const normalized = normalizeEncoding(normalizedText);
    if (normalized.changed) {
      normalizedText = normalized.text;
      warnings.push('Text encoding was normalized');
    }
    if (normalized.hadReplacementChars) {
      warnings.push('Invalid UTF-8 sequences were replaced');
    }
  }

  // Rule 7: Control Character Detection
  const controlCharCount = countControlCharacters(normalizedText);
  if (controlCharCount > 0) {
    const controlCharRatio = controlCharCount / normalizedText.length;
    if (controlCharRatio > 0.1) {
      // More than 10% control characters
      warnings.push(
        `High ratio of control characters detected (${controlCharCount} chars, ${(controlCharRatio * 100).toFixed(1)}%)`,
      );
    } else if (controlCharCount > 10) {
      warnings.push(`Control characters detected (${controlCharCount} chars)`);
    }
  }

  return {
    valid: true,
    text: normalizedText,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Normalize text encoding to UTF-8
 *
 * @param text - Input text
 * @returns Normalized text with metadata
 */
function normalizeEncoding(text: string): {
  text: string;
  changed: boolean;
  hadReplacementChars: boolean;
} {
  const originalLength = text.length;

  // Check for existing replacement characters (indicates prior encoding issues)
  const hadReplacementChars = REPLACEMENT_CHAR_PATTERN.test(text);

  // Normalize to NFC (Canonical Decomposition, followed by Canonical Composition)
  // This ensures consistent Unicode representation
  let normalized: string;
  try {
    normalized = text.normalize('NFC');
  } catch {
    // If normalization fails, return original
    return { text, changed: false, hadReplacementChars };
  }

  // Check if normalization changed the text
  const changed = normalized !== text || normalized.length !== originalLength;

  return {
    text: normalized,
    changed,
    hadReplacementChars,
  };
}

/**
 * Count control characters in text
 *
 * @param text - Input text
 * @returns Number of control characters
 */
function countControlCharacters(text: string): number {
  const matches = text.match(CONTROL_CHAR_PATTERN);
  return matches ? matches.length : 0;
}

/**
 * Check if text is valid for ML inference (quick check)
 *
 * @param text - Input text
 * @returns True if text is valid
 */
export function isValidMLInput(text: string | null | undefined): boolean {
  return validateMLInput(text).valid;
}

/**
 * Get validation error message for text (if any)
 *
 * @param text - Input text
 * @returns Error message or undefined if valid
 */
export function getValidationError(
  text: string | null | undefined,
): string | undefined {
  const result = validateMLInput(text);
  return result.error;
}

/**
 * MLInputValidator class for object-oriented usage
 */
export class MLInputValidator {
  private config: ValidationConfig;

  constructor(config?: Partial<ValidationConfig>) {
    this.config = { ...DEFAULT_VALIDATION_CONFIG, ...config };
  }

  /**
   * Validate text input
   */
  validate(text: string | null | undefined): ValidationResult {
    return validateMLInput(text, this.config);
  }

  /**
   * Check if text is valid (quick check)
   */
  isValid(text: string | null | undefined): boolean {
    return this.validate(text).valid;
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<ValidationConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  configure(config: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a configured MLInputValidator instance
 */
export function createMLInputValidator(
  config?: Partial<ValidationConfig>,
): MLInputValidator {
  return new MLInputValidator(config);
}
