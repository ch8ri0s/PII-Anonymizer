/**
 * LogAnonymizer - Anonymization Engine for Feedback Logging
 *
 * Story 7.8: User Correction Feedback Logging
 * AC #8: No PII is ever stored in logs - all text is anonymized before storage
 *
 * Ported from src/services/feedbackLogger.ts:159-205
 * Uses Web Crypto API for document hashing instead of Node.js crypto.
 */

/**
 * Entity type patterns for anonymization
 * Maps entity types to their replacement markers
 */
const ENTITY_TYPE_MARKERS: Record<string, string> = {
  PERSON: '[PERSON]',
  PERSON_NAME: '[PERSON]',
  ORGANIZATION: '[ORG]',
  ORG: '[ORG]',
  LOCATION: '[LOCATION]',
  ADDRESS: '[ADDRESS]',
  STREET_ADDRESS: '[ADDRESS]',
  SWISS_ADDRESS: '[ADDRESS]',
  EU_ADDRESS: '[ADDRESS]',
  SWISS_AVS: '[AVS]',
  AVS: '[AVS]',
  IBAN: '[IBAN]',
  PHONE: '[PHONE]',
  EMAIL: '[EMAIL]',
  DATE: '[DATE]',
  AMOUNT: '[AMOUNT]',
  VAT_NUMBER: '[VAT]',
  INVOICE_NUMBER: '[INVOICE_NUM]',
  PAYMENT_REF: '[PAYMENT_REF]',
  QR_REFERENCE: '[QR_REF]',
  SENDER: '[PERSON]',
  RECIPIENT: '[PERSON]',
  SALUTATION_NAME: '[PERSON]',
  SIGNATURE: '[PERSON]',
  LETTER_DATE: '[DATE]',
  REFERENCE_LINE: '[REF]',
  PARTY: '[PARTY]',
  AUTHOR: '[PERSON]',
  VENDOR_NAME: '[ORG]',
  ID_NUMBER: '[ID]',
  OTHER: '[OTHER]',
  UNKNOWN: '[UNKNOWN]',
};

/**
 * Regular expression patterns for common PII formats
 * These catch any PII that might be in the context text
 *
 * IMPORTANT: Order matters! More specific patterns (like IBAN) must be
 * applied before less specific patterns (like phone/postal) to prevent
 * partial matches.
 */
const PII_PATTERNS = {
  // IBAN pattern - Swiss IBAN: CH + 2 digits + 17 alphanumeric (with optional spaces)
  // Examples: CH93 0076 2011 6238 5295 7 or CH9300762011623852957
  // Must be applied FIRST to prevent phone/postal patterns from matching parts of it
  // This pattern matches both spaced and non-spaced formats
  ibanSpaced: /[A-Z]{2}\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{1,3}/gi,
  ibanCompact: /[A-Z]{2}\d{19,21}/gi,

  // Swiss AVS number (756.XXXX.XXXX.XX) - must be before phone patterns
  swissAvs: /756[.\s-]?\d{4}[.\s-]?\d{4}[.\s-]?\d{2}/g,

  // Email pattern
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,

  // Swiss phone patterns (+41, 0041, or local format)
  swissPhone: /(\+41|0041|0)[\s.-]?[0-9]{2}[\s.-]?[0-9]{3}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}/g,

  // International phone (generic format)
  intlPhone: /\+[1-9]\d{1,2}[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{2,4}/g,

  // Swiss postal codes (4 digits starting with 1-9)
  // Applied last - be conservative to avoid false positives
  swissPostal: /\b[1-9][0-9]{3}\b/g,
};

/**
 * Get the marker for an entity type
 * @param entityType The entity type to get marker for
 * @returns The marker string (e.g., '[PERSON]')
 */
export function getTypeMarker(entityType: string): string {
  return ENTITY_TYPE_MARKERS[entityType] || '[PII]';
}

/**
 * Escape special regex characters in a string
 * @param str The string to escape
 * @returns The escaped string safe for use in RegExp
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Anonymize text by replacing PII with type markers
 *
 * This preserves the structure of the text while removing sensitive content.
 * First replaces the specific original text, then applies pattern-based
 * anonymization to catch any remaining PII in the context.
 *
 * @param text - Text to anonymize (e.g., surrounding context)
 * @param entityType - Type of the primary entity (used for context)
 * @param originalText - Optional original PII text to specifically replace
 * @returns Anonymized text with PII replaced by type markers
 */
export function anonymizeForLog(
  text: string,
  entityType: string,
  originalText?: string,
): string {
  if (!text) return '';

  let anonymized = text;

  // Apply pattern-based anonymization FIRST to protect structured PII
  // (emails, phones, etc.) from being partially matched by name replacement.
  //
  // IMPORTANT: Order matters! Apply more specific patterns first to prevent
  // partial matches by less specific patterns.

  // IBAN patterns - MUST be first (contains digits that look like phone/postal)
  // Try compact format first (no spaces), then spaced format
  anonymized = anonymized.replace(PII_PATTERNS.ibanCompact, '[IBAN]');
  anonymized = anonymized.replace(PII_PATTERNS.ibanSpaced, '[IBAN]');

  // Swiss AVS pattern - must be before phone patterns (starts with 756)
  anonymized = anonymized.replace(PII_PATTERNS.swissAvs, '[AVS]');

  // Email pattern - before name replacement to protect emails like john@example.com
  anonymized = anonymized.replace(PII_PATTERNS.email, '[EMAIL]');

  // Phone patterns (Swiss and international)
  anonymized = anonymized.replace(PII_PATTERNS.swissPhone, '[PHONE]');
  anonymized = anonymized.replace(PII_PATTERNS.intlPhone, '[PHONE]');

  // Swiss postal codes - LAST (most generic, avoid false positives)
  anonymized = anonymized.replace(PII_PATTERNS.swissPostal, '[POSTAL]');

  // NOW apply the specific text replacement AFTER pattern-based anonymization
  // This ensures structured PII (emails) are protected before name replacement
  if (originalText && originalText.length > 0) {
    const marker = getTypeMarker(entityType);
    // Escape special regex characters in originalText
    const escaped = escapeRegExp(originalText);
    anonymized = anonymized.replace(new RegExp(escaped, 'gi'), marker);
  }

  return anonymized;
}

/**
 * Hash a document filename using Web Crypto API (SHA-256)
 *
 * Used to anonymize document names while allowing pattern analysis
 * across corrections for the same document.
 *
 * @param filename - The document filename to hash
 * @returns First 16 characters of the SHA-256 hash in hex
 */
export async function hashDocumentName(filename: string): Promise<string> {
  // Handle environments where crypto.subtle may not be available
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    // Fallback: simple hash for testing environments
    let hash = 0;
    for (let i = 0; i < filename.length; i++) {
      const char = filename.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0').slice(0, 16);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(filename);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Return first 16 characters for brevity
  return hashHex.slice(0, 16);
}

/**
 * Generate a UUID v4 for entry IDs
 *
 * Uses crypto.randomUUID() if available, otherwise falls back to
 * a polyfill implementation.
 *
 * @returns A UUID v4 string
 */
export function generateId(): string {
  // Use native crypto.randomUUID if available
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback implementation for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get the current month in YYYY-MM format
 * @returns Month string (e.g., '2025-12')
 */
export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Check if a month string is older than the retention period
 * @param month Month string in YYYY-MM format
 * @param retentionMonths Number of months to retain
 * @returns true if the month is older than retention period
 */
export function isMonthExpired(month: string, retentionMonths: number): boolean {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10) - 1; // JS months are 0-indexed

  const entryDate = new Date(year, monthNum, 1);
  const now = new Date();
  const cutoffDate = new Date(now.getFullYear(), now.getMonth() - retentionMonths, 1);

  return entryDate < cutoffDate;
}
