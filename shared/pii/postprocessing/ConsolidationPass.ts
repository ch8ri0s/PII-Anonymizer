/**
 * Consolidation Pass (Story 8.8)
 *
 * Post-processing pass that consolidates overlapping and partial PII spans
 * into coherent entities. Runs late in the pipeline after all detection
 * passes have completed.
 *
 * Features:
 * 1. Overlap Resolution - Resolves overlapping spans using priority + confidence
 * 2. Address Consolidation - Groups address components into unified ADDRESS entities
 * 3. Entity Linking - Links repeated occurrences with logical IDs
 *
 * @module shared/pii/postprocessing/ConsolidationPass
 */

/**
 * Entity type for consolidation (subset of full EntityType)
 * Import actual types at runtime to avoid circular dependencies
 */
export type ConsolidationEntityType =
  | 'PERSON'
  | 'PERSON_NAME'
  | 'ORGANIZATION'
  | 'LOCATION'
  | 'ADDRESS'
  | 'SWISS_ADDRESS'
  | 'EU_ADDRESS'
  | 'SWISS_AVS'
  | 'IBAN'
  | 'PHONE'
  | 'EMAIL'
  | 'DATE'
  | 'AMOUNT'
  | 'VAT_NUMBER'
  | 'INVOICE_NUMBER'
  | 'PAYMENT_REF'
  | 'QR_REFERENCE'
  | 'SENDER'
  | 'RECIPIENT'
  | 'SALUTATION_NAME'
  | 'SIGNATURE'
  | 'LETTER_DATE'
  | 'REFERENCE_LINE'
  | 'PARTY'
  | 'AUTHOR'
  | 'VENDOR_NAME'
  | 'UNKNOWN';

/**
 * Minimal entity interface for consolidation
 * Compatible with Entity from src/types/detection.ts
 */
export interface ConsolidationEntity {
  id: string;
  type: ConsolidationEntityType;
  text: string;
  start: number;
  end: number;
  confidence: number;
  source: 'ML' | 'RULE' | 'BOTH' | 'MANUAL' | 'LINKED' | 'CONSOLIDATED';
  logicalId?: string;
  metadata?: Record<string, unknown>;
  components?: Array<{
    type: string;
    text: string;
    start: number;
    end: number;
    linked?: boolean;
    linkedToGroupId?: string;
  }>;
  flaggedForReview?: boolean;
  selected?: boolean;
  validation?: {
    status: 'valid' | 'invalid' | 'unchecked';
    reason?: string;
    checkedBy?: string;
  };
  context?: {
    score: number;
    factors: Array<{
      name: string;
      weight: number;
      matched: boolean;
      description?: string;
    }>;
  };
}

/**
 * Strategy for resolving overlapping entities
 */
export type OverlapStrategy = 'priority-only' | 'confidence-weighted';

/**
 * Strategy for linking repeated entities
 */
export type LinkingStrategy = 'exact' | 'normalized' | 'fuzzy';

/**
 * Configuration for ConsolidationPass
 */
export interface ConsolidationPassConfig {
  /**
   * Maximum distance in characters to consider components part of the same address
   * @default 50
   */
  addressMaxGap: number;

  /**
   * Enable/disable address consolidation (grouping components into ADDRESS)
   * @default true
   */
  enableAddressConsolidation: boolean;

  /**
   * Enable/disable overlap resolution
   * @default true
   */
  enableOverlapResolution: boolean;

  /**
   * Enable/disable entity linking (assigning logicalIds)
   * @default true
   */
  enableEntityLinking: boolean;

  /**
   * Whether to include component entities in output (Option B) or hide them (Option A)
   * @default false (Option A - components hidden)
   */
  showComponents: boolean;

  /**
   * Custom entity type priority table (higher number = higher priority)
   * Types not in table get priority 0
   */
  entityTypePriority: Partial<Record<ConsolidationEntityType, number>>;

  /**
   * Strategy for resolving overlapping entities
   * - 'priority-only': Use type priority table only
   * - 'confidence-weighted': Use priority * confidence for final score
   * @default 'confidence-weighted'
   */
  overlapStrategy: OverlapStrategy;

  /**
   * Strategy for linking repeated entities
   * - 'exact': Only exact text matches
   * - 'normalized': Case-insensitive, whitespace-normalized
   * - 'fuzzy': Handles title variations (Mr/Herr/M.)
   * @default 'normalized'
   */
  linkingStrategy: LinkingStrategy;

  /**
   * Minimum confidence for address consolidation
   * Addresses with lower confidence are not consolidated
   * @default 0.5
   */
  minConsolidationConfidence: number;

  /**
   * Store original spans in metadata for reversibility
   * @default true
   */
  preserveOriginalSpans: boolean;

  /**
   * Minimum components required to form a valid address
   * @default 2
   */
  minAddressComponents: number;
}

/**
 * Default entity type priorities
 * Higher number = higher priority in overlap resolution
 */
export const DEFAULT_ENTITY_PRIORITY: Record<ConsolidationEntityType, number> = {
  // Highest priority: Specific identifier types
  SWISS_AVS: 100,
  IBAN: 95,
  QR_REFERENCE: 90,
  VAT_NUMBER: 85,

  // High priority: Structured formats
  EMAIL: 80,
  PHONE: 75,
  PAYMENT_REF: 70,
  INVOICE_NUMBER: 65,

  // Medium-high: Address types
  SWISS_ADDRESS: 60,
  EU_ADDRESS: 58,
  ADDRESS: 55,

  // Medium: Person/Org types
  PERSON_NAME: 50,
  PERSON: 48,
  ORGANIZATION: 45,
  VENDOR_NAME: 43,

  // Letter-specific types
  SENDER: 40,
  RECIPIENT: 38,
  SALUTATION_NAME: 35,
  SIGNATURE: 33,
  AUTHOR: 30,
  PARTY: 28,
  REFERENCE_LINE: 25,
  LETTER_DATE: 22,

  // Lower priority: General types
  DATE: 20,
  AMOUNT: 18,
  LOCATION: 15,

  // Lowest priority
  UNKNOWN: 0,
};

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: ConsolidationPassConfig = {
  addressMaxGap: 50,
  enableAddressConsolidation: true,
  enableOverlapResolution: true,
  enableEntityLinking: true,
  showComponents: false,
  entityTypePriority: DEFAULT_ENTITY_PRIORITY,
  overlapStrategy: 'confidence-weighted',
  linkingStrategy: 'normalized',
  minConsolidationConfidence: 0.5,
  preserveOriginalSpans: true,
  minAddressComponents: 2,
};

/**
 * Title/salutation variations for fuzzy matching
 */
const TITLE_VARIATIONS: Record<string, string[]> = {
  mr: ['mr', 'mr.', 'herr', 'm.', 'monsieur', 'mister'],
  mrs: ['mrs', 'mrs.', 'frau', 'mme', 'mme.', 'madame'],
  ms: ['ms', 'ms.', 'fräulein', 'mlle', 'mademoiselle'],
  dr: ['dr', 'dr.', 'doktor', 'docteur'],
  prof: ['prof', 'prof.', 'professor', 'professeur'],
};

/**
 * Result of consolidation with metadata
 */
export interface ConsolidationResult {
  /** Consolidated entities */
  entities: ConsolidationEntity[];

  /** Metadata about consolidation */
  metadata: {
    /** Number of overlaps resolved */
    overlapsResolved: number;
    /** Number of addresses consolidated */
    addressesConsolidated: number;
    /** Number of entity groups linked */
    entitiesLinked: number;
    /** Original entity count before consolidation */
    originalEntityCount: number;
    /** Duration in milliseconds */
    durationMs: number;
  };
}

/**
 * Consolidation Pass
 *
 * Post-processing pass that consolidates overlapping and fragmented entities
 * into coherent units for cleaner anonymization.
 */
export class ConsolidationPass {
  private config: ConsolidationPassConfig;

  constructor(config: Partial<ConsolidationPassConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute consolidation on a list of entities
   *
   * @param entities - Input entities from detection pipeline
   * @param text - Original document text (for address consolidation)
   * @returns Consolidated entities with metadata
   */
  consolidate(entities: ConsolidationEntity[], text: string): ConsolidationResult {
    const startTime = Date.now();
    const originalCount = entities.length;

    let result = [...entities];
    let overlapsResolved = 0;
    let addressesConsolidated = 0;
    let entitiesLinked = 0;

    // Store original spans if configured
    if (this.config.preserveOriginalSpans) {
      result = result.map((e) => ({
        ...e,
        metadata: {
          ...e.metadata,
          originalSpans: entities
            .filter((orig) => this.spansOverlap(orig, e))
            .map((orig) => ({ start: orig.start, end: orig.end, type: orig.type })),
        },
      }));
    }

    // Step 1: Overlap Resolution
    if (this.config.enableOverlapResolution) {
      const overlapResult = this.resolveOverlaps(result);
      overlapsResolved = result.length - overlapResult.length;
      result = overlapResult;
    }

    // Step 2: Address Consolidation
    if (this.config.enableAddressConsolidation) {
      const addressResult = this.consolidateAddresses(result, text);
      addressesConsolidated = addressResult.consolidatedCount;
      result = addressResult.entities;
    }

    // Step 3: Entity Linking
    if (this.config.enableEntityLinking) {
      const linkResult = this.linkEntities(result);
      entitiesLinked = linkResult.groupCount;
      result = linkResult.entities;
    }

    return {
      entities: result,
      metadata: {
        overlapsResolved,
        addressesConsolidated,
        entitiesLinked,
        originalEntityCount: originalCount,
        durationMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Resolve overlapping entities
   * Keeps the entity with highest score based on configured strategy
   */
  resolveOverlaps(entities: ConsolidationEntity[]): ConsolidationEntity[] {
    if (entities.length === 0) return [];

    // Sort by start position, then by length (longer first)
    const sorted = [...entities].sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return (b.end - b.start) - (a.end - a.start);
    });

    const result: ConsolidationEntity[] = [];
    const consumed = new Set<string>();

    for (const entity of sorted) {
      if (consumed.has(entity.id)) continue;

      // Find all entities that overlap with this one
      const overlapping = sorted.filter(
        (other) =>
          other.id !== entity.id &&
          !consumed.has(other.id) &&
          this.spansOverlap(entity, other),
      );

      if (overlapping.length === 0) {
        // No overlaps, keep entity
        result.push(entity);
        consumed.add(entity.id);
      } else {
        // Resolve overlap: pick winner
        const candidates = [entity, ...overlapping];
        const winner = this.pickOverlapWinner(candidates);

        result.push(winner);
        consumed.add(winner.id);

        // Mark all overlapping as consumed
        for (const other of overlapping) {
          consumed.add(other.id);
        }
      }
    }

    return result;
  }

  /**
   * Pick winner from overlapping entities based on strategy
   */
  private pickOverlapWinner(candidates: ConsolidationEntity[]): ConsolidationEntity {
    const scored = candidates.map((entity) => {
      const priority = this.config.entityTypePriority[entity.type] ?? 0;

      let score: number;
      if (this.config.overlapStrategy === 'priority-only') {
        // Priority-only: just use type priority
        score = priority;
      } else {
        // Confidence-weighted: priority * confidence
        score = priority * entity.confidence;
      }

      // Tie-breaker: longer span wins
      const length = entity.end - entity.start;

      return { entity, score, length };
    });

    // Sort by score desc, then by length desc
    scored.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return b.length - a.length;
    });

    return scored[0]?.entity ?? candidates[0]!;
  }

  /**
   * Consolidate address components into unified ADDRESS entities
   */
  consolidateAddresses(
    entities: ConsolidationEntity[],
    text: string,
  ): { entities: ConsolidationEntity[]; consolidatedCount: number } {
    // Address component types to look for
    const componentTypes = new Set([
      'STREET_NAME',
      'STREET_NUMBER',
      'POSTAL_CODE',
      'CITY',
      'COUNTRY',
      'REGION',
    ]);

    // Separate address components from other entities
    const addressComponents: ConsolidationEntity[] = [];
    const otherEntities: ConsolidationEntity[] = [];

    for (const entity of entities) {
      // Check if this entity has address components in metadata
      // or if it's marked as an address-related type from AddressRelationshipPass
      if (
        entity.components &&
        entity.components.length > 0 &&
        (entity.type === 'ADDRESS' || entity.type === 'SWISS_ADDRESS' || entity.type === 'EU_ADDRESS')
      ) {
        // Already consolidated address from AddressRelationshipPass - keep as-is
        otherEntities.push(entity);
      } else if (entity.metadata?.isAddressComponent || componentTypes.has(entity.type as string)) {
        addressComponents.push(entity);
      } else {
        otherEntities.push(entity);
      }
    }

    if (addressComponents.length < this.config.minAddressComponents) {
      // Not enough components to consolidate
      return { entities, consolidatedCount: 0 };
    }

    // Group components by proximity
    const groups = this.groupAddressComponents(addressComponents, text);

    // Convert groups to consolidated ADDRESS entities
    const consolidatedAddresses: ConsolidationEntity[] = [];
    const usedComponentIds = new Set<string>();

    for (const group of groups) {
      if (group.length < this.config.minAddressComponents) {
        continue;
      }

      // Calculate aggregate confidence
      const avgConfidence =
        group.reduce((sum, c) => sum + c.confidence, 0) / group.length;

      if (avgConfidence < this.config.minConsolidationConfidence) {
        continue;
      }

      // Sort by position
      const sorted = [...group].sort((a, b) => a.start - b.start);
      const first = sorted[0]!;
      const last = sorted[sorted.length - 1]!;

      // Extract text span
      const fullText = text.substring(first.start, last.end);

      // Build components map
      const components = sorted.map((c) => ({
        type: (c.metadata?.componentType as string) || c.type,
        text: c.text,
        start: c.start,
        end: c.end,
        linked: true,
      }));

      // Create consolidated address
      const consolidated: ConsolidationEntity = {
        id: `consolidated-addr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: this.determineAddressType(components),
        text: fullText,
        start: first.start,
        end: last.end,
        confidence: avgConfidence,
        source: 'CONSOLIDATED',
        components,
        metadata: {
          consolidatedFrom: sorted.map((c) => c.id),
          componentCount: sorted.length,
          ...(this.config.preserveOriginalSpans && {
            originalSpans: sorted.map((c) => ({
              start: c.start,
              end: c.end,
              type: c.type,
            })),
          }),
        },
      };

      consolidatedAddresses.push(consolidated);

      for (const c of group) {
        usedComponentIds.add(c.id);
      }
    }

    // Build result
    let result: ConsolidationEntity[];

    if (this.config.showComponents) {
      // Option B: Keep components (mark them as linked)
      result = [
        ...otherEntities,
        ...consolidatedAddresses,
        ...addressComponents.map((c) => ({
          ...c,
          metadata: {
            ...c.metadata,
            linkedToAddress: usedComponentIds.has(c.id),
          },
        })),
      ];
    } else {
      // Option A: Hide used components
      result = [
        ...otherEntities,
        ...consolidatedAddresses,
        ...addressComponents.filter((c) => !usedComponentIds.has(c.id)),
      ];
    }

    return {
      entities: result,
      consolidatedCount: consolidatedAddresses.length,
    };
  }

  /**
   * Group address components by proximity
   */
  private groupAddressComponents(
    components: ConsolidationEntity[],
    text: string,
  ): ConsolidationEntity[][] {
    if (components.length === 0) return [];

    // Sort by position
    const sorted = [...components].sort((a, b) => a.start - b.start);

    const groups: ConsolidationEntity[][] = [];
    let currentGroup: ConsolidationEntity[] = [sorted[0]!];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i]!;
      const previous = sorted[i - 1]!;

      const gap = current.start - previous.end;

      // Check for newline between components (allow larger gap)
      const textBetween = text.substring(previous.end, current.start);
      const hasNewline = /[\r\n]/.test(textBetween);
      const threshold = hasNewline
        ? this.config.addressMaxGap * 2
        : this.config.addressMaxGap;

      if (gap <= threshold && gap >= 0) {
        currentGroup.push(current);
      } else {
        if (currentGroup.length >= this.config.minAddressComponents) {
          groups.push(currentGroup);
        }
        currentGroup = [current];
      }
    }

    // Don't forget last group
    if (currentGroup.length >= this.config.minAddressComponents) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Determine address type based on components
   */
  private determineAddressType(
    components: Array<{ type: string; text: string }>,
  ): 'ADDRESS' | 'SWISS_ADDRESS' | 'EU_ADDRESS' {
    const hasPostal = components.some((c) => c.type === 'POSTAL_CODE');
    const postalText = components.find((c) => c.type === 'POSTAL_CODE')?.text || '';

    // Swiss postal codes are 4 digits starting with 1-9
    const isSwissPostal = /^[1-9]\d{3}$/.test(postalText);

    // Check for country indicators
    const countryComp = components.find((c) => c.type === 'COUNTRY');
    const countryText = countryComp?.text?.toLowerCase() || '';

    if (isSwissPostal || countryText.includes('schweiz') || countryText.includes('suisse') || countryText.includes('switzerland') || countryText === 'ch') {
      return 'SWISS_ADDRESS';
    }

    if (countryComp || (hasPostal && !isSwissPostal)) {
      return 'EU_ADDRESS';
    }

    return 'ADDRESS';
  }

  /**
   * Link repeated entities with logical IDs
   */
  linkEntities(entities: ConsolidationEntity[]): {
    entities: ConsolidationEntity[];
    groupCount: number;
  } {
    // Group entities by normalized text + type
    const groups = new Map<string, ConsolidationEntity[]>();

    for (const entity of entities) {
      const key = this.getEntityGroupKey(entity);
      const group = groups.get(key) || [];
      group.push(entity);
      groups.set(key, group);
    }

    // Assign logical IDs
    const typeCounters = new Map<string, number>();
    let groupCount = 0;

    const result = entities.map((entity) => {
      const key = this.getEntityGroupKey(entity);
      const group = groups.get(key) || [];

      if (group.length > 1) {
        groupCount++;

        // Get or create logical ID for this group
        if (!group[0]?.logicalId) {
          // Assign new logical ID
          const baseType = this.getBaseType(entity.type);
          const count = (typeCounters.get(baseType) || 0) + 1;
          typeCounters.set(baseType, count);

          const logicalId = `${baseType}_${count}`;

          // Assign to all in group
          for (const e of group) {
            e.logicalId = logicalId;
          }
        }
      }

      return entity;
    });

    return {
      entities: result,
      groupCount: Math.floor(groupCount / 2), // Divide by 2 since we count each pair twice
    };
  }

  /**
   * Get grouping key for entity based on linking strategy
   */
  private getEntityGroupKey(entity: ConsolidationEntity): string {
    const baseType = this.getBaseType(entity.type);

    switch (this.config.linkingStrategy) {
      case 'exact':
        return `${baseType}:${entity.text}`;

      case 'normalized':
        return `${baseType}:${this.normalizeText(entity.text)}`;

      case 'fuzzy':
        return `${baseType}:${this.fuzzyNormalizeText(entity.text)}`;

      default:
        return `${baseType}:${entity.text}`;
    }
  }

  /**
   * Get base type for logical ID (e.g., SWISS_ADDRESS -> ADDRESS)
   */
  private getBaseType(type: ConsolidationEntityType): string {
    if (type === 'SWISS_ADDRESS' || type === 'EU_ADDRESS') {
      return 'ADDRESS';
    }
    if (type === 'PERSON_NAME') {
      return 'PERSON';
    }
    return type;
  }

  /**
   * Normalize text for entity linking (case + whitespace)
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Fuzzy normalize text (removes titles, handles variations)
   */
  private fuzzyNormalizeText(text: string): string {
    let normalized = this.normalizeText(text);

    // Remove known title variations
    for (const variations of Object.values(TITLE_VARIATIONS)) {
      for (const title of variations) {
        const regex = new RegExp(`^${title}\\s+`, 'i');
        normalized = normalized.replace(regex, '');
      }
    }

    return normalized.trim();
  }

  /**
   * Check if two entity spans overlap
   */
  private spansOverlap(a: ConsolidationEntity, b: ConsolidationEntity): boolean {
    return a.start < b.end && b.start < a.end;
  }

  /**
   * Get current configuration
   */
  getConfig(): ConsolidationPassConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  configure(config: Partial<ConsolidationPassConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Factory function to create ConsolidationPass
 */
export function createConsolidationPass(
  config?: Partial<ConsolidationPassConfig>,
): ConsolidationPass {
  return new ConsolidationPass(config);
}
