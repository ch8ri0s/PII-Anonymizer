/**
 * Invoice-Specific Detection Rules (Story 3.2)
 *
 * Provides invoice-optimized PII detection patterns for:
 * - Vendor names and details
 * - Invoice numbers and references
 * - Amounts and currencies
 * - VAT numbers (Swiss/EU)
 * - Payment references (Swiss QR, IBAN)
 */

import { Entity, EntitySource } from '../../types/detection.js';
import { generateEntityId } from '../DetectionPipeline.js';

/**
 * Invoice-specific entity types
 */
export type InvoiceEntityType =
  | 'VENDOR_NAME'
  | 'INVOICE_NUMBER'
  | 'AMOUNT'
  | 'VAT_NUMBER'
  | 'PAYMENT_REF'
  | 'IBAN'
  | 'QR_REFERENCE';

/**
 * Configuration for Invoice Rules
 */
export interface InvoiceRulesConfig {
  /** Extract amounts */
  extractAmounts: boolean;

  /** Extract VAT numbers */
  extractVatNumbers: boolean;

  /** Extract payment references */
  extractPaymentRefs: boolean;

  /** Boost confidence for header entities */
  headerConfidenceBoost: number;

  /** Boost confidence for table entities */
  tableConfidenceBoost: number;
}

const DEFAULT_CONFIG: InvoiceRulesConfig = {
  // Disabled: AMOUNT is not PII and causes false positives (Story 8.18)
  extractAmounts: false,
  extractVatNumbers: true,
  extractPaymentRefs: true,
  headerConfidenceBoost: 0.2,
  tableConfidenceBoost: 0.1,
};

/**
 * Invoice number patterns (multilingual)
 */
const INVOICE_NUMBER_PATTERNS: RegExp[] = [
  // English patterns
  /(?:invoice|inv|bill)\s*(?:no\.?|nr\.?|#|number|:)\s*([A-Z0-9][\w-]{2,20})/gi,
  // German patterns
  /(?:rechnung|rech|re)\s*(?:nr\.?|nummer|:)\s*([A-Z0-9][\w-]{2,20})/gi,
  // French patterns
  /(?:facture|fact|fac)\s*(?:n[°o]\.?|numéro|:)\s*([A-Z0-9][\w-]{2,20})/gi,
  // Generic patterns
  /(?:ref|reference|réf)\s*(?:no\.?|nr\.?|#|:)?\s*([A-Z0-9][\w-]{4,20})/gi,
];

/**
 * Amount patterns (Swiss/EU currencies)
 */
const AMOUNT_PATTERNS: RegExp[] = [
  // CHF formats: CHF 1'234.56 or 1'234.56 CHF
  /(?:chf|sfr)\s*[\d',.\s]{1,15}/gi,
  /[\d',.\s]{3,15}\s*(?:chf|sfr)/gi,
  // EUR formats: EUR 1.234,56 or 1.234,56 EUR or €1,234.56
  /(?:eur|€)\s*[\d',.\s]{1,15}/gi,
  /[\d',.\s]{3,15}\s*(?:eur|€)/gi,
  // USD formats
  /(?:usd|\$)\s*[\d',.\s]{1,15}/gi,
  /[\d',.\s]{3,15}\s*(?:usd)/gi,
  // GBP formats
  /(?:gbp|£)\s*[\d',.\s]{1,15}/gi,
  // Generic with decimal: 1,234.56 or 1.234,56 (at least 2 decimal places)
  /\b\d{1,3}(?:[',.\s]\d{3})*[.,]\d{2}\b/g,
];

/**
 * Swiss VAT number pattern: CHE-123.456.789 MWST/TVA/IVA
 */
const SWISS_VAT_PATTERN = /CHE[-\s]?\d{3}[.\s]?\d{3}[.\s]?\d{3}\s*(?:MWST|TVA|IVA)?/gi;

/**
 * EU VAT number patterns by country
 */
const EU_VAT_PATTERNS: Record<string, RegExp> = {
  AT: /ATU\d{8}/gi,           // Austria
  BE: /BE0?\d{9,10}/gi,       // Belgium
  DE: /DE\d{9}/gi,            // Germany
  FR: /FR[A-Z0-9]{2}\d{9}/gi, // France
  IT: /IT\d{11}/gi,           // Italy
  NL: /NL\d{9}B\d{2}/gi,      // Netherlands
  ES: /ES[A-Z0-9]\d{7}[A-Z0-9]/gi, // Spain
  LU: /LU\d{8}/gi,            // Luxembourg
  GB: /GB\d{9,12}/gi,         // UK (historical)
};

/**
 * Swiss QR reference patterns
 */
const QR_REFERENCE_PATTERNS: RegExp[] = [
  // QR-IBAN reference (26-27 digits)
  /\b\d{26,27}\b/g,
  // Structured reference with RF prefix (ISO 11649)
  /RF\d{2}[A-Z0-9]{1,21}/gi,
  // ESR reference (Swiss payment slip)
  /\b\d{2}\s?\d{5}\s?\d{5}\s?\d{5}\s?\d{5}\s?\d{5}\s?\d{2}\b/g,
];

/**
 * IBAN patterns (Swiss and EU)
 * Supports both compact (CH9300762011623852957) and formatted (CH93 0076 2011 6238 5295 7) IBANs
 * Pattern matches: Country code (2 letters) + Check digits (2 digits) + BBAN (up to 30 alphanumeric chars with optional spaces)
 * Uses [ ]? instead of \s? to avoid matching newlines at the end
 */
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}[ ]?(?:[A-Z0-9]{1,4}[ ]?){3,8}[A-Z0-9]{0,4}\b/gi;

/**
 * Invoice Rules Engine
 */
export class InvoiceRules {
  private config: InvoiceRulesConfig;

  constructor(config: Partial<InvoiceRulesConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Apply invoice-specific detection rules
   */
  applyRules(
    text: string,
    existingEntities: Entity[] = [],
  ): Entity[] {
    const newEntities: Entity[] = [];

    // Extract invoice numbers
    const invoiceNumbers = this.extractInvoiceNumbers(text);
    newEntities.push(...invoiceNumbers);

    // Extract amounts
    if (this.config.extractAmounts) {
      const amounts = this.extractAmounts(text);
      newEntities.push(...amounts);
    }

    // Extract VAT numbers
    if (this.config.extractVatNumbers) {
      const vatNumbers = this.extractVatNumbers(text);
      newEntities.push(...vatNumbers);
    }

    // Extract payment references
    if (this.config.extractPaymentRefs) {
      const paymentRefs = this.extractPaymentReferences(text);
      newEntities.push(...paymentRefs);
    }

    // Boost confidence for entities in header area
    const headerEnd = Math.floor(text.length * 0.2);
    for (const entity of newEntities) {
      if (entity.start < headerEnd) {
        entity.confidence = Math.min(
          entity.confidence + this.config.headerConfidenceBoost,
          1.0,
        );
        entity.metadata = {
          ...entity.metadata,
          positionBoost: 'header',
        };
      }
    }

    // Deduplicate with existing entities
    return this.deduplicateEntities(existingEntities, newEntities);
  }

  /**
   * Extract invoice numbers from text
   */
  private extractInvoiceNumbers(text: string): Entity[] {
    const entities: Entity[] = [];
    const usedRanges = new Set<string>();

    for (const pattern of INVOICE_NUMBER_PATTERNS) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0];
        const invoiceNumber = match[1] || fullMatch;
        const start = match.index;
        const end = start + fullMatch.length;

        // Skip if overlaps with existing
        const rangeKey = `${start}-${end}`;
        if (usedRanges.has(rangeKey)) continue;
        usedRanges.add(rangeKey);

        // Validate: not too short, not just numbers
        if (invoiceNumber.length < 3) continue;
        if (/^\d{1,3}$/.test(invoiceNumber)) continue;

        entities.push({
          id: generateEntityId(),
          type: 'INVOICE_NUMBER' as const,
          text: fullMatch,
          start,
          end,
          confidence: 0.85,
          source: 'RULE' as EntitySource,
          metadata: {
            extractedNumber: invoiceNumber,
            ruleType: 'invoice_number',
          },
        });
      }
    }

    return entities;
  }

  /**
   * Extract amounts from text
   */
  private extractAmounts(text: string): Entity[] {
    const entities: Entity[] = [];
    const usedRanges = new Set<string>();

    for (const pattern of AMOUNT_PATTERNS) {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0].trim();
        const start = match.index;
        const end = start + match[0].length;

        const rangeKey = `${start}-${end}`;
        if (usedRanges.has(rangeKey)) continue;
        usedRanges.add(rangeKey);

        // Parse and validate amount
        const parsed = this.parseAmount(fullMatch);
        if (!parsed) continue;

        // Skip very small amounts (likely not PII)
        if (parsed.value < 10) continue;

        entities.push({
          id: generateEntityId(),
          type: 'AMOUNT' as const,
          text: fullMatch,
          start,
          end,
          confidence: 0.75,
          source: 'RULE' as EntitySource,
          metadata: {
            currency: parsed.currency,
            value: parsed.value,
            ruleType: 'amount',
          },
        });
      }
    }

    return entities;
  }

  /**
   * Parse amount string to get currency and value
   */
  private parseAmount(text: string): { currency: string; value: number } | null {
    // Detect currency
    let currency = 'UNKNOWN';
    if (/chf|sfr/i.test(text)) currency = 'CHF';
    else if (/eur|€/i.test(text)) currency = 'EUR';
    else if (/usd|\$/i.test(text)) currency = 'USD';
    else if (/gbp|£/i.test(text)) currency = 'GBP';

    // Extract numeric value
    const numericPart = text.replace(/[^\d.,'\s]/g, '').trim();

    // Determine decimal separator
    // Swiss/German: 1'234.56 or 1.234,56
    // English: 1,234.56
    let normalized: string;

    if (numericPart.includes("'")) {
      // Swiss format with apostrophe thousands separator
      normalized = numericPart.replace(/'/g, '').replace(',', '.');
    } else if (/\d+\.\d{3},\d{2}$/.test(numericPart)) {
      // European format: 1.234,56
      normalized = numericPart.replace(/\./g, '').replace(',', '.');
    } else {
      // Standard format: 1,234.56
      normalized = numericPart.replace(/,/g, '').replace(/\s/g, '');
    }

    const value = parseFloat(normalized);
    if (isNaN(value)) return null;

    return { currency, value };
  }

  /**
   * Extract VAT numbers from text
   */
  private extractVatNumbers(text: string): Entity[] {
    const entities: Entity[] = [];
    const usedRanges = new Set<string>();

    // Swiss VAT
    SWISS_VAT_PATTERN.lastIndex = 0;
    let match;

    while ((match = SWISS_VAT_PATTERN.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const rangeKey = `${start}-${end}`;

      if (!usedRanges.has(rangeKey)) {
        usedRanges.add(rangeKey);
        entities.push({
          id: generateEntityId(),
          type: 'VAT_NUMBER' as const,
          text: match[0],
          start,
          end,
          confidence: 0.95,
          source: 'RULE' as EntitySource,
          metadata: {
            country: 'CH',
            ruleType: 'swiss_vat',
          },
        });
      }
    }

    // EU VAT numbers
    for (const [country, pattern] of Object.entries(EU_VAT_PATTERNS)) {
      pattern.lastIndex = 0;

      while ((match = pattern.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        const rangeKey = `${start}-${end}`;

        if (!usedRanges.has(rangeKey)) {
          usedRanges.add(rangeKey);
          entities.push({
            id: generateEntityId(),
            type: 'VAT_NUMBER' as const,
            text: match[0],
            start,
            end,
            confidence: 0.9,
            source: 'RULE' as EntitySource,
            metadata: {
              country,
              ruleType: 'eu_vat',
            },
          });
        }
      }
    }

    return entities;
  }

  /**
   * Extract payment references from text
   */
  private extractPaymentReferences(text: string): Entity[] {
    const entities: Entity[] = [];
    const usedRanges = new Set<string>();

    // IBAN
    IBAN_PATTERN.lastIndex = 0;
    let match;

    while ((match = IBAN_PATTERN.exec(text)) !== null) {
      const iban = match[0].replace(/\s/g, '');
      if (!this.isValidIBAN(iban)) continue;

      const start = match.index;
      const end = start + match[0].length;
      const rangeKey = `${start}-${end}`;

      if (!usedRanges.has(rangeKey)) {
        usedRanges.add(rangeKey);
        entities.push({
          id: generateEntityId(),
          type: 'IBAN' as const,
          text: match[0],
          start,
          end,
          confidence: 0.95,
          source: 'RULE' as EntitySource,
          metadata: {
            country: iban.substring(0, 2),
            ruleType: 'iban',
          },
        });
      }
    }

    // QR references
    for (const pattern of QR_REFERENCE_PATTERNS) {
      pattern.lastIndex = 0;

      while ((match = pattern.exec(text)) !== null) {
        const ref = match[0].replace(/\s/g, '');

        // Validate length for QR reference
        if (ref.length < 20 || ref.length > 27) continue;

        const start = match.index;
        const end = start + match[0].length;
        const rangeKey = `${start}-${end}`;

        // Skip if overlaps with IBAN
        if (usedRanges.has(rangeKey)) continue;
        usedRanges.add(rangeKey);

        entities.push({
          id: generateEntityId(),
          type: 'PAYMENT_REF' as const,
          text: match[0],
          start,
          end,
          confidence: 0.85,
          source: 'RULE' as EntitySource,
          metadata: {
            referenceType: ref.startsWith('RF') ? 'ISO11649' : 'QR',
            ruleType: 'qr_reference',
          },
        });
      }
    }

    return entities;
  }

  /**
   * Basic IBAN validation (checksum)
   */
  private isValidIBAN(iban: string): boolean {
    // Minimum length check
    if (iban.length < 15 || iban.length > 34) return false;

    // Country code check
    if (!/^[A-Z]{2}/.test(iban)) return false;

    // Move country code and check digits to end
    const rearranged = iban.substring(4) + iban.substring(0, 4);

    // Convert letters to numbers (A=10, B=11, etc.)
    let numericString = '';
    for (const char of rearranged) {
      if (/[A-Z]/.test(char)) {
        numericString += (char.charCodeAt(0) - 55).toString();
      } else {
        numericString += char;
      }
    }

    // Mod 97 check
    let remainder = 0;
    for (let i = 0; i < numericString.length; i++) {
      const char = numericString[i];
      if (char === undefined) return false;
      const digit = parseInt(char, 10);
      if (isNaN(digit)) return false;
      remainder = (remainder * 10 + digit) % 97;
    }

    return remainder === 1;
  }

  /**
   * Deduplicate entities, preferring higher confidence
   */
  private deduplicateEntities(
    existing: Entity[],
    newEntities: Entity[],
  ): Entity[] {
    const result = [...existing];

    for (const newEntity of newEntities) {
      const overlapping = result.find(e =>
        this.rangesOverlap(e.start, e.end, newEntity.start, newEntity.end),
      );

      if (!overlapping) {
        result.push(newEntity);
      } else if (newEntity.confidence > overlapping.confidence) {
        // Replace with higher confidence entity
        const index = result.indexOf(overlapping);
        result[index] = newEntity;
      }
    }

    return result.sort((a, b) => a.start - b.start);
  }

  /**
   * Check if two ranges overlap
   */
  private rangesOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number,
  ): boolean {
    return start1 < end2 && start2 < end1;
  }
}

/**
 * Factory function for creating InvoiceRules
 */
export function createInvoiceRules(
  config?: Partial<InvoiceRulesConfig>,
): InvoiceRules {
  return new InvoiceRules(config);
}
