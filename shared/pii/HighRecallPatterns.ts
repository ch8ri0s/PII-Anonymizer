/**
 * High-Recall PII Detection Patterns (Shared)
 *
 * Regex patterns for Swiss/EU PII detection used by both
 * Electron and browser-app HighRecallPass implementations.
 *
 * @module shared/pii/HighRecallPatterns
 */

import { validateSwissAddress } from './validators/SwissAddressValidator.js';

/**
 * Entity type for PII detection
 */
export type EntityType =
  | 'PERSON'
  | 'PERSON_NAME'
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
  /** Optional validation function to filter false positives */
  validate?: (match: string) => boolean;
}

/**
 * ML entity type mapping from model output to EntityType
 */
export const ML_ENTITY_MAPPING: Record<string, EntityType> = {
  PER: 'PERSON',
  PERSON: 'PERSON',
  PERSON_NAME: 'PERSON_NAME',
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

    // IBAN (CH, DE, FR, AT, IT, GB, etc.) - supports both compact and formatted with spaces
    // Handles alphanumeric BBAN sections (needed for FR, GB, and other countries)
    // Uses [ ]? instead of \s? to avoid matching newlines at the end
    {
      type: 'IBAN',
      pattern: /\b[A-Z]{2}\d{2}[ ]?(?:[A-Z0-9]{1,4}[ ]?){3,8}[A-Z0-9]{0,4}\b/g,
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
    // Note: Swiss postal codes are 1000-9999, but we exclude patterns that look like
    // ISO timestamps (year followed by T or -) to avoid false positives in frontmatter
    // Story 8.22: Require minimum 3-character city name to reduce false positives
    // Story 10.x: Added validation to filter year false positives (e.g., "2024 Attestation")
    // Story 11.x: Fixed boundary - use [ \t] not \s, limit city words to 2, stop at newlines
    {
      type: 'SWISS_ADDRESS',
      pattern:
        /\b(?:CH[-\s]?)?[1-9]\d{3}(?![-T])[ \t]+[A-ZÄÖÜ][a-zäöüé]{2,}(?:-[A-Za-zäöüé]+){0,2}\b/g,
      priority: 3,
      validate: validateSwissAddress,
    },

    // German/Austrian postal codes with city
    // Story 8.22: Require minimum 3-character city name
    {
      type: 'EU_ADDRESS',
      pattern:
        /\b(?:D[-\s]?|A[-\s]?)?\d{5}\s+[A-ZÄÖÜ][a-zäöüß]{2,}(?:[-\s][A-Za-zäöüß]+)*/g,
      priority: 3,
    },

    // French postal codes with city
    // Story 8.22: Require minimum 3-character city name
    {
      type: 'EU_ADDRESS',
      pattern:
        /\b(?:F[-\s]?)?\d{5}\s+[A-ZÀÂÆÉÈÊËÏÎÔŒÙÛÜ][a-zàâæéèêëïîôœùûüÿç]{2,}(?:[-\s][A-Za-zàâæéèêëïîôœùûüÿç]+)*/g,
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

    // Street addresses (Italian) - Story 8.19
    // Matches: Via Nassa 19, Viale Roma 42, Piazza Dante 3, Corso Italia 15
    {
      type: 'ADDRESS',
      pattern:
        /\b(?:via|viale|piazza|corso|vicolo|largo)\s+(?:del\s+|della\s+|dei\s+|delle\s+|di\s+)?[A-ZÀ-Ÿ][a-zà-ÿ]+(?:[\s-][A-Za-zà-ÿ]+)*\s+\d+[a-z]?\b/gi,
      priority: 3,
    },

    // Italian postal codes with city (5 digits, 00100-99999)
    // Matches: 6900 Lugano, 20121 Milano, 00187 Roma
    // Story 8.22: Require minimum 3-character city name
    {
      type: 'EU_ADDRESS',
      pattern:
        /\b(?:I[-\s]?)?\d{5}\s+[A-ZÀÈÉÌÒÙ][a-zàèéìòù]{2,}(?:[-\s][A-Za-zàèéìòù]+)*\b/g,
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
    // NOTE: AMOUNT detection disabled (Story 8.18) - financial amounts are not PII
    // and were causing 15 false positives with 0% precision.
    // Pattern kept as comment for reference:
    // {
    //   type: 'AMOUNT',
    //   pattern: /\b(?:CHF|EUR|€|Fr\.?)\s*\d{1,3}(?:['\s.,]\d{3})*(?:[.,]\d{2})?\b/gi,
    //   priority: 5,
    // },

    // === Priority 6: Organization names (Story 8.21) ===
    // Detect companies with legal suffixes (Swiss/EU)

    // Organization with legal suffix: "Company Name AG/SA/GmbH/Ltd"
    // Matches: ABB Ltd, Roche Holding AG, Credit Suisse Group AG
    {
      type: 'ORGANIZATION',
      pattern:
        /\b[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿA-Z]+(?:[\s-]+[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿA-Z]+)*\s+(?:AG|SA|GmbH|Ltd|Inc|Corp|LLC|Sàrl|SARL|Cie|KG|SE|Plc)\.?\b/g,
      priority: 6,
    },

    // Acronym organizations with suffix: "UBS AG", "ABB Ltd"
    {
      type: 'ORGANIZATION',
      pattern:
        /\b[A-Z]{2,6}\s+(?:AG|SA|GmbH|Ltd|Inc|Corp|LLC|SE|Plc)\.?\b/g,
      priority: 6,
    },

    // === Priority 7: Person names (contextual patterns) ===
    // These patterns look for names in common contexts to reduce false positives

    // Names in "FirstName LastName" pattern (European names with accents)
    // Must have at least 2 parts, each starting with uppercase
    // Uses [ ]+ instead of \s+ to avoid matching across newlines
    // Avoid matching common words and frontmatter content
    {
      type: 'PERSON_NAME',
      pattern:
        /\b([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]{2,})[ ]+([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]{2,})(?:[ ]+[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]{2,})?\b/g,
      priority: 7,
      validate: validatePersonName,
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

/**
 * Common words that should not be detected as person names
 * (frontmatter keywords, common document terms, etc.)
 */
const PERSON_NAME_EXCLUSIONS = new Set([
  // Frontmatter/YAML keys
  'source', 'processed', 'anonymised', 'anonymized', 'format', 'model',
  // Common document terms
  'fondation', 'collective', 'case', 'postale', 'notre', 'votre',
  'scanning', 'assurances', 'technologies', 'visiteurs', 'direct',
  'contact', 'information', 'details', 'address', 'email', 'phone',
  // Invoice/document structure terms (not person names)
  'invoice', 'number', 'date', 'due', 'payment', 'total', 'amount',
  'description', 'quantity', 'price', 'unit', 'subtotal', 'tax', 'vat',
  'software', 'module', 'development', 'project', 'management', 'services',
  'consulting', 'support', 'maintenance', 'license', 'subscription',
  'order', 'reference', 'customer', 'client', 'billing', 'shipping',
  // Geographic terms
  'zurich', 'zürich', 'geneve', 'geneva', 'bern', 'basel', 'lausanne',
  'suisse', 'switzerland', 'schweiz',
  // Address terms (German street suffixes that might appear after names)
  'chemin', 'route', 'rue', 'avenue', 'strasse', 'street', 'place', 'platz',
  'bahnhofstrasse', 'hauptstrasse', 'poststrasse', 'dorfstrasse', 'schulstrasse',
  // Common titles/honorifics (should be followed by name, not be the name)
  'mesdames', 'messieurs', 'madame', 'monsieur', 'herr', 'frau',
  // Technical terms
  'detection', 'browser', 'document', 'markdown', 'sample', 'test',
  // Story 8.20: Italian street types
  'via', 'viale', 'piazza', 'corso', 'vicolo', 'largo',
  // Story 8.20: French street types
  'allée', 'boulevard',
  // Story 8.20: German street types
  'gasse', 'weg', 'allee', 'straße',
]);

/**
 * Story 8.20: Company legal suffixes that indicate organization, not person
 */
const COMPANY_SUFFIXES = new Set([
  'ltd', 'ag', 'sa', 'gmbh', 'inc', 'corp', 'llc', 'plc',
  'sàrl', 'sarl', 'cie', 'kg', 'ohg', 'se', 'nv', 'bv',
]);

/**
 * Story 8.20: Company-indicating words that suggest organization
 */
const COMPANY_WORDS = new Set([
  'holding', 'group', 'groupe', 'gruppe',
  'technologies', 'technologien',
  'services', 'dienstleistungen',
  'solutions', 'systems', 'consulting',
  'partners', 'associates', 'foundation', 'institute', 'bank',
]);

/**
 * Validate a potential person name match
 * Returns true if the match looks like a real person name
 *
 * Story 8.20: Enhanced validation to filter out company names and addresses
 */
export function validatePersonName(name: string): boolean {
  if (!name || name.length < 5) return false;

  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return false;

  // Story 8.20: Check if last word is a company suffix (e.g., "ABB Ltd")
  const lastPart = parts[parts.length - 1];
  if (lastPart) {
    const lastPartLower = lastPart.toLowerCase().replace(/\.$/, ''); // Remove trailing dot
    if (COMPANY_SUFFIXES.has(lastPartLower)) return false;
    if (COMPANY_WORDS.has(lastPartLower)) return false;
  }

  // Story 8.20: Check if first word is a street type (e.g., "Via Nassa")
  const firstPart = parts[0];
  if (firstPart) {
    const firstPartLower = firstPart.toLowerCase();
    if (PERSON_NAME_EXCLUSIONS.has(firstPartLower)) return false;
  }

  for (const part of parts) {
    const lowerPart = part.toLowerCase();

    // Reject if any part is in exclusion list
    if (PERSON_NAME_EXCLUSIONS.has(lowerPart)) return false;

    // Reject if part is all uppercase (likely acronym) and > 2 chars
    if (part === part.toUpperCase() && part.length > 2) return false;

    // Each part should start with uppercase followed by lowercase
    if (!/^[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]+$/.test(part)) return false;
  }

  return true;
}
