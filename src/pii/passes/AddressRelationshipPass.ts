/**
 * Address Relationship Pass (Story 2.4)
 *
 * A detection pass that groups address components into unified address entities.
 * Integrates with the multi-pass detection pipeline (Epic 1).
 *
 * This pass:
 * 1. Identifies address components in text
 * 2. Links components by proximity into grouped addresses
 * 3. Scores each address for confidence
 * 4. Converts to ADDRESS entities that replace individual components
 */

import {
  Entity,
  DetectionPass,
  PipelineContext,
  GroupedAddress,
} from '../../types/detection.js';
import { AddressClassifier, createAddressClassifier } from '../AddressClassifier.js';
import { AddressLinker, createAddressLinker } from '../AddressLinker.js';
import { AddressScorer, createAddressScorer, ScoredAddress } from '../AddressScorer.js';
import { generateEntityId } from '../DetectionPipeline.js';

/**
 * Configuration for Address Relationship Pass
 */
export interface AddressRelationshipPassConfig {
  /** Maximum distance between components to link (chars) */
  maxComponentDistance: number;

  /** Minimum components for valid address */
  minComponents: number;

  /** Threshold for flagging addresses for review */
  reviewThreshold: number;

  /** Threshold for auto-anonymization */
  autoAnonymizeThreshold: number;

  /** Whether to keep standalone components as fallback */
  keepStandaloneComponents: boolean;
}

const DEFAULT_CONFIG: AddressRelationshipPassConfig = {
  maxComponentDistance: 50,
  minComponents: 2,
  reviewThreshold: 0.6,
  autoAnonymizeThreshold: 0.8,
  keepStandaloneComponents: true,
};

/**
 * Address Relationship Detection Pass
 *
 * Integrates address classification, linking, and scoring into the
 * detection pipeline to produce unified ADDRESS entities.
 */
export class AddressRelationshipPass implements DetectionPass {
  name = 'AddressRelationship';
  order = 40; // After ContextScoring (30)
  enabled = true;

  private config: AddressRelationshipPassConfig;
  private classifier: AddressClassifier;
  private linker: AddressLinker;
  private scorer: AddressScorer;

  constructor(config: Partial<AddressRelationshipPassConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.classifier = createAddressClassifier({
      maxComponentDistance: this.config.maxComponentDistance,
    });

    this.linker = createAddressLinker({
      proximityThreshold: this.config.maxComponentDistance,
      minComponents: this.config.minComponents,
    });

    this.scorer = createAddressScorer({
      reviewThreshold: this.config.reviewThreshold,
      autoAnonymizeThreshold: this.config.autoAnonymizeThreshold,
    });
  }

  /**
   * Execute the address relationship pass
   */
  async execute(
    text: string,
    entities: Entity[],
    _context: PipelineContext,
  ): Promise<Entity[]> {
    // Step 1: Classify address components in text
    const components = this.classifier.classifyComponents(text);

    if (components.length === 0) {
      // No address components found, return entities unchanged
      return entities;
    }

    // Step 2: Link components into grouped addresses
    const groupedAddresses = this.linker.linkComponents(text, components);

    // Step 3: Score each grouped address
    const scoredAddresses = this.scorer.scoreAddresses(groupedAddresses);

    // Step 4: Convert to entities and merge with existing
    const addressEntities = this.convertToEntities(scoredAddresses);

    // Step 5: Mark overlapping entities for removal/merging
    const mergedEntities = this.mergeWithExisting(entities, addressEntities, text);

    return mergedEntities;
  }

  /**
   * Convert scored addresses to Entity objects
   */
  private convertToEntities(addresses: ScoredAddress[]): Entity[] {
    return addresses.map(addr => ({
      id: generateEntityId(),
      type: this.determineAddressType(addr),
      text: addr.text,
      start: addr.start,
      end: addr.end,
      confidence: addr.finalConfidence,
      source: 'RULE' as const,
      components: addr.componentEntities,
      flaggedForReview: addr.flaggedForReview,
      metadata: {
        isGroupedAddress: true,
        patternMatched: addr.patternMatched,
        breakdown: addr.components,
        componentCount: addr.componentEntities.length,
        scoringFactors: addr.scoringFactors,
        autoAnonymize: addr.autoAnonymize,
      },
    }));
  }

  /**
   * Determine specific address type based on content
   */
  private determineAddressType(addr: ScoredAddress): 'ADDRESS' | 'SWISS_ADDRESS' | 'EU_ADDRESS' {
    // Check for Swiss indicators
    const postalCode = addr.components.postal || '';
    const isSwissPostal = postalCode.includes('CH') ||
      (postalCode.length === 4 && /^[1-9]\d{3}$/.test(postalCode));

    if (isSwissPostal || addr.patternMatched === 'SWISS') {
      return 'SWISS_ADDRESS';
    }

    // Check for EU indicators
    if (addr.patternMatched === 'EU' ||
        addr.components.country ||
        (postalCode.length === 5)) {
      return 'EU_ADDRESS';
    }

    return 'ADDRESS';
  }

  /**
   * Merge new address entities with existing entities
   *
   * Rules:
   * 1. Grouped addresses replace overlapping location/address entities
   * 2. Non-overlapping entities are preserved
   * 3. Higher confidence addresses take precedence
   */
  private mergeWithExisting(
    existingEntities: Entity[],
    addressEntities: Entity[],
    _text: string,
  ): Entity[] {
    const result: Entity[] = [];
    const consumedRanges: Array<{ start: number; end: number }> = [];

    // First, add all grouped address entities
    for (const addr of addressEntities) {
      result.push(addr);
      consumedRanges.push({ start: addr.start, end: addr.end });
    }

    // Then, add existing entities that don't overlap with addresses
    for (const entity of existingEntities) {
      const isConsumed = consumedRanges.some(range =>
        this.rangesOverlap(entity.start, entity.end, range.start, range.end),
      );

      if (!isConsumed) {
        result.push(entity);
      } else {
        // Entity overlaps with grouped address
        // Keep if it's a different type (not location/address related)
        const isAddressRelated = ['ADDRESS', 'SWISS_ADDRESS', 'EU_ADDRESS', 'LOCATION'].includes(entity.type);

        if (!isAddressRelated) {
          result.push(entity);
        }
        // Otherwise, the grouped address subsumes this entity
      }
    }

    // Sort by position
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

  /**
   * Get standalone components that weren't grouped
   * (for fallback detection)
   */
  getStandaloneComponents(
    allComponents: ReturnType<AddressClassifier['classifyComponents']>,
    groupedAddresses: GroupedAddress[],
  ): ReturnType<AddressClassifier['classifyComponents']> {
    const usedPositions = new Set<string>();

    for (const addr of groupedAddresses) {
      // Use componentEntities (array of AddressComponent)
      for (const comp of addr.componentEntities) {
        usedPositions.add(`${comp.start}-${comp.end}`);
      }
    }

    return allComponents.filter(comp =>
      !usedPositions.has(`${comp.start}-${comp.end}`),
    );
  }
}

/**
 * Factory function for creating AddressRelationshipPass
 */
export function createAddressRelationshipPass(
  config?: Partial<AddressRelationshipPassConfig>,
): AddressRelationshipPass {
  return new AddressRelationshipPass(config);
}
