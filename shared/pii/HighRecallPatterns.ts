/**
 * High-Recall PII Detection Patterns (Shared)
 *
 * Regex patterns for Swiss/EU PII detection used by both
 * Electron and browser-app HighRecallPass implementations.
 *
 * @module shared/pii/HighRecallPatterns
 */

/**
 * Entity type for PII detection
 */
export type EntityType =
  | 'PERSON'
  | 'ORGANIZATION'
  | 'LOCATION'
  | 'DATE'
  | 'PHONE'
  | 'EMAIL'
  | 'ADDRESS'
  | 'SWISS_AVS'
  | 'SWISS_ADDRESS'
  | 'EU_ADDRESS'
  | 'IBAN'
  | 'VAT_NUMBER'
  | 'PAYMENT_REF'
  | 'AMOUNT'
  | 'UNKNOWN';

/**
 * Regex pattern definition for rule-based detection
 */
export interface PatternDef {
  /** Entity type this pattern detects */
  type: EntityType;
  /** Regex pattern (must have global flag) */
  pattern: RegExp;
  /** Priority for conflict resolution (lower = higher priority) */
  priority: number;
}

/**
 * ML entity type mapping from model output to EntityType
 */
export const ML_ENTITY_MAPPING: Record<string, EntityType> = {
  PER: 'PERSON',
  PERSON: 'PERSON',
  ORG: 'ORGANIZATION',
  ORGANIZATION: 'ORGANIZATION',
  LOC: 'LOCATION',
  LOCATION: 'LOCATION',
  GPE: 'LOCATION',
  DATE: 'DATE',
  PHONE: 'PHONE',
  EMAIL: 'EMAIL',
  ADDRESS: 'ADDRESS',
  MISC: 'UNKNOWN',
};

/**
 * Map ML model entity group to EntityType
 *
 * @param mlType - Raw ML entity group (e.g., "PER", "B-PER", "I-ORG")
 * @returns Mapped EntityType
 */
export function mapMLEntityType(mlType: string): EntityType {
  // Remove B- or I- prefix if present (BIO tagging scheme)
  const cleanType = mlType.replace(/^[BI]-/, '').toUpperCase();
  return ML_ENTITY_MAPPING[cleanType] || 'UNKNOWN';
}

/**
 * Build regex patterns for Swiss/EU PII detection
 *
 * Patterns are ordered by type priority:
 * 1. High-confidence identifiers (AVS, IBAN, Email)
 * 2. Semi-structured data (Phone, VAT, Payment refs)
 * 3. Address patterns (Swiss, German, French)
 * 4. Temporal data (Dates)
 * 5. Financial amounts
 *
 * @returns Array of PatternDef for rule-based detection
 */
export function buildHighRecallPatterns(): PatternDef[] {
  return [
    // === Priority 1: High-confidence identifiers ===

    // Swiss AVS number (756.XXXX.XXXX.XX)
    {
      type: 'SWISS_AVS',
      pattern: /756[.\s]?\d{4}[.\s]?\d{4}[.\s]?\d{2}/g,
      priority: 1,
    },

    // IBAN (CH, DE, FR, AT, IT, etc.)
    {
      type: 'IBAN',
      pattern: /\b[A-Z]{2}\d{2}[\s]?(?:\d{4}[\s]?){4,7}\d{0,2}\b/g,
      priority: 1,
    },

    // Email
    {
      type: 'EMAIL',
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
      priority: 1,
    },

    // === Priority 2: Semi-structured identifiers ===

    // Phone numbers (Swiss, German, French, Italian, Austrian)
    {
      type: 'PHONE',
      pattern:
        /(?:\+|00)?(?:41|49|33|39|43)[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}/g,
      priority: 2,
    },

    // VAT numbers (Swiss)
    {
      type: 'VAT_NUMBER',
      pattern: /\bCHE[-\s]?\d{3}[.\s]?\d{3}[.\s]?\d{3}(?:\s*(?:MWST|TVA|IVA))?\b/gi,
      priority: 2,
    },

    // VAT numbers (EU)
    {
      type: 'VAT_NUMBER',
      pattern: /\b(?:DE|FR|IT|AT)\s?\d{8,11}\b/g,
      priority: 2,
    },

    // Swiss QR reference (26-27 digits)
    {
      type: 'PAYMENT_REF',
      pattern: /\b\d{2}[\s]?\d{5}[\s]?\d{5}[\s]?\d{5}[\s]?\d{5}[\s]?\d{5,6}\b/g,
      priority: 2,
    },

    // === Priority 3: Address patterns ===

    // Swiss postal codes with city
    {
      type: 'SWISS_ADDRESS',
      pattern:
        /\b(?:CH[-\s]?)?[1-9]\d{3}\s+[A-ZÄÖÜ][a-zäöüé]+(?:[-\s][A-Za-zäöüé]+)*/g,
      priority: 3,
    },

    // German/Austrian postal codes with city
    {
      type: 'EU_ADDRESS',
      pattern:
        /\b(?:D[-\s]?|A[-\s]?)?\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:[-\s][A-Za-zäöüß]+)*/g,
      priority: 3,
    },

    // French postal codes with city
    {
      type: 'EU_ADDRESS',
      pattern:
        /\b(?:F[-\s]?)?\d{5}\s+[A-ZÀÂÆÉÈÊËÏÎÔŒÙÛÜ][a-zàâæéèêëïîôœùûüÿç]+(?:[-\s][A-Za-zàâæéèêëïîôœùûüÿç]+)*/g,
      priority: 3,
    },

    // Street addresses (German)
    {
      type: 'ADDRESS',
      pattern:
        /\b[A-ZÄÖÜ][a-zäöüß]+(?:straße|strasse|gasse|weg|platz|allee)\s+\d+[a-z]?\b/gi,
      priority: 3,
    },

    // Street addresses (French)
    {
      type: 'ADDRESS',
      pattern:
        /\b(?:rue|avenue|boulevard|chemin|place|allée)\s+(?:de\s+(?:la\s+)?|du\s+|des\s+)?[A-ZÀ-Ÿ][a-zà-ÿ]+(?:[\s-][A-Za-zà-ÿ]+)*\s+\d+[a-z]?\b/gi,
      priority: 3,
    },

    // === Priority 4: Date patterns ===

    // Date patterns (European format)
    {
      type: 'DATE',
      pattern:
        /\b(?:0?[1-9]|[12]\d|3[01])[\s./-](?:0?[1-9]|1[0-2])[\s./-](?:19|20)?\d{2}\b/g,
      priority: 4,
    },

    // Date patterns (with month names - German)
    {
      type: 'DATE',
      pattern:
        /\b(?:0?[1-9]|[12]\d|3[01])\.?\s*(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s*(?:19|20)?\d{2,4}\b/gi,
      priority: 4,
    },

    // Date patterns (with month names - French)
    {
      type: 'DATE',
      pattern:
        /\b(?:0?[1-9]|[12]\d|3[01])\s*(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s*(?:19|20)?\d{2,4}\b/gi,
      priority: 4,
    },

    // === Priority 5: Financial amounts ===

    // Amount patterns (CHF, EUR)
    {
      type: 'AMOUNT',
      pattern:
        /\b(?:CHF|EUR|€|Fr\.?)\s*\d{1,3}(?:['\s.,]\d{3})*(?:[.,]\d{2})?\b/gi,
      priority: 5,
    },
  ];
}

/**
 * Default ML threshold for high-recall detection
 * Lower threshold = more detections (higher recall, lower precision)
 */
export const DEFAULT_ML_THRESHOLD = 0.3;

/**
 * Default rule-based confidence score
 * Applied to all regex-matched entities
 */
export const DEFAULT_RULE_CONFIDENCE = 0.7;

/**
 * Minimum match length to avoid false positives
 */
export const MIN_MATCH_LENGTH = 3;
