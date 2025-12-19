/**
 * FileProcessingSession - Pure State Management
 *
 * Encapsulates state for a single file processing operation.
 * This is a pure class with no I/O dependencies - works in both
 * Node.js and browser environments.
 *
 * Each session has its own:
 * - Pseudonym counters (PER_1, PER_2, etc.)
 * - Pseudonym mappings (entity text -> pseudonym)
 * - Structured address mappings
 */

export interface AddressEntry {
  placeholder: string;
  type: string;
  originalText: string;
  start: number;
  end: number;
  components: {
    street: string | null;
    number: string | null;
    postal: string | null;
    city: string | null;
    country: string | null;
  };
  confidence: number;
  patternMatched: string | null;
  scoringFactors: string[];
  flaggedForReview: boolean;
  autoAnonymize: boolean;
}

export interface AnonymizedRange {
  start: number;
  end: number;
  placeholder: string;
}

export interface AddressEntityInput {
  text: string;
  type?: string;
  start: number;
  end: number;
  confidence?: number;
  flaggedForReview?: boolean;
  metadata?: {
    isGroupedAddress?: boolean;
    breakdown?: {
      street?: string;
      number?: string;
      postal?: string;
      city?: string;
      country?: string;
    };
    finalConfidence?: number;
    patternMatched?: string;
    scoringFactors?: string[];
    autoAnonymize?: boolean;
  };
}

export class FileProcessingSession {
  private pseudonymCounters: Record<string, number> = {};
  private pseudonymMapping: Record<string, string> = {};
  private addressMappings: AddressEntry[] = [];
  private anonymizedRanges: AnonymizedRange[] = [];

  /**
   * Get or create a consistent pseudonym for an entity
   */
  getOrCreatePseudonym(entityText: string, entityType: string): string {
    if (this.pseudonymMapping[entityText]) {
      return this.pseudonymMapping[entityText];
    }

    if (!this.pseudonymCounters[entityType]) {
      this.pseudonymCounters[entityType] = 1;
    }

    const pseudonym = `${entityType}_${this.pseudonymCounters[entityType]++}`;
    this.pseudonymMapping[entityText] = pseudonym;

    return pseudonym;
  }

  /**
   * Get the current mapping state
   */
  getMapping(): Record<string, string> {
    return { ...this.pseudonymMapping };
  }

  /**
   * Get entity count
   */
  getEntityCount(): number {
    return Object.keys(this.pseudonymMapping).length + this.addressMappings.length;
  }

  /**
   * Register a grouped address with structured data
   */
  registerGroupedAddress(addressEntity: AddressEntityInput): string {
    const addressType = addressEntity.type || 'ADDRESS';

    if (!this.pseudonymCounters[addressType]) {
      this.pseudonymCounters[addressType] = 1;
    }

    const counter = this.pseudonymCounters[addressType]++;
    const placeholder = `[${addressType}_${counter}]`;

    const metadata = addressEntity.metadata || {};
    const breakdown = metadata.breakdown || {};

    const addressEntry: AddressEntry = {
      placeholder,
      type: addressType,
      originalText: addressEntity.text,
      start: addressEntity.start,
      end: addressEntity.end,
      components: {
        street: breakdown.street || null,
        number: breakdown.number || null,
        postal: breakdown.postal || null,
        city: breakdown.city || null,
        country: breakdown.country || null,
      },
      confidence: addressEntity.confidence || metadata.finalConfidence || 0,
      patternMatched: metadata.patternMatched || null,
      scoringFactors: metadata.scoringFactors || [],
      flaggedForReview: addressEntity.flaggedForReview || false,
      autoAnonymize: metadata.autoAnonymize !== false,
    };

    this.addressMappings.push(addressEntry);

    this.anonymizedRanges.push({
      start: addressEntity.start,
      end: addressEntity.end,
      placeholder,
    });

    this.pseudonymMapping[addressEntity.text] = placeholder;

    return placeholder;
  }

  /**
   * Check if a position range is already covered by an anonymized address
   */
  isRangeAnonymized(start: number, end: number): boolean {
    return this.anonymizedRanges.some(
      (range) => start < range.end && end > range.start,
    );
  }

  /**
   * Mark a position range as anonymized
   */
  markRangeAnonymized(start: number, end: number, placeholder: string = ''): void {
    this.anonymizedRanges.push({ start, end, placeholder });
  }

  /**
   * Get structured address mappings
   */
  getAddressMappings(): AddressEntry[] {
    return [...this.addressMappings];
  }

  /**
   * Get the extended mapping for export
   */
  getExtendedMapping(): {
    entities: Record<string, string>;
    addresses: AddressEntry[];
    } {
    return {
      entities: { ...this.pseudonymMapping },
      addresses: [...this.addressMappings],
    };
  }
}

export default FileProcessingSession;
