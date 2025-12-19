/**
 * Address Linker (Story 2.2)
 *
 * Groups address components that are spatially close together using
 * proximity analysis and pattern matching to create unified ADDRESS entities.
 *
 * Supports Swiss, EU, and alternative address patterns:
 * - SWISS: [Street] [Number], [PostalCode] [City]
 * - EU: [Street] [Number], [PostalCode] [City], [Country]
 * - ALTERNATIVE: [PostalCode] [City], [Street] [Number]
 */

import {
  AddressComponent,
  AddressComponentType,
  AddressPatternType,
  Entity,
  EntitySource,
  GroupedAddress,
  LinkedAddressGroup,
} from '../types/detection.js';
import { AddressClassifier } from './AddressClassifier.js';
import { generateEntityId } from './DetectionPipeline.js';

/**
 * Configuration for address linking
 */
export interface AddressLinkerConfig {
  /** Default proximity threshold in characters (AC-2.2.1: 50 chars) */
  proximityThreshold: number;

  /** Expanded threshold when newline is detected (default: 100) */
  newlineThreshold: number;

  /** Minimum components required for valid address */
  minComponents: number;

  /** Maximum components in single address */
  maxComponents: number;

  /** Language for pattern matching */
  language?: 'en' | 'fr' | 'de';
}

const DEFAULT_CONFIG: AddressLinkerConfig = {
  proximityThreshold: 50,  // AC-2.2.1: 50-char threshold
  newlineThreshold: 100,   // Expanded window for multiline addresses
  minComponents: 2,
  maxComponents: 6,
  language: 'de',
};

/**
 * Address Linker
 *
 * Groups address components into complete addresses using proximity
 * and pattern matching (Story 2.2).
 *
 * Algorithm:
 * 1. groupByProximity: Sort components by position, group within 50-char window
 * 2. matchPatterns: Match groups against Swiss/EU/Alternative patterns
 * 3. createGroupedAddress: Create unified ADDRESS entities
 */
export class AddressLinker {
  private config: AddressLinkerConfig;
  private classifier: AddressClassifier;

  constructor(config: Partial<AddressLinkerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.classifier = new AddressClassifier({
      maxComponentDistance: this.config.proximityThreshold,
    });
  }

  /**
   * Group address components by spatial proximity (AC-2.2.1)
   *
   * Algorithm:
   * 1. Sort components by position
   * 2. Group components within threshold distance
   * 3. Handle line breaks (expand window to newlineThreshold if newline detected)
   *
   * @param components - Address components to group
   * @param text - Original text (for newline detection)
   * @returns Array of component groups
   */
  groupByProximity(
    components: AddressComponent[],
    text: string,
  ): AddressComponent[][] {
    if (components.length === 0) {
      return [];
    }

    // Sort components by start position
    const sorted = [...components].sort((a, b) => a.start - b.start);
    const groups: AddressComponent[][] = [];

    const firstComponent = sorted[0];
    if (!firstComponent) {
      return [];
    }

    let currentGroup: AddressComponent[] = [firstComponent];

    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const previous = sorted[i - 1];

      // TypeScript guard
      if (!current || !previous) continue;

      const gap = current.start - previous.end;

      // Check if there's a newline between components
      const textBetween = text.substring(previous.end, current.start);
      const hasNewline = /[\r\n]/.test(textBetween);

      // Use expanded threshold if newline is present
      const threshold = hasNewline
        ? this.config.newlineThreshold
        : this.config.proximityThreshold;

      if (gap <= threshold && gap >= 0) {
        // Add to current group
        currentGroup.push(current);
      } else {
        // Start a new group
        if (currentGroup.length >= this.config.minComponents) {
          groups.push(currentGroup);
        }
        currentGroup = [current];
      }
    }

    // Don't forget the last group
    if (currentGroup.length >= this.config.minComponents) {
      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * Match component groups against known address patterns (AC-2.2.2, AC-2.2.3, AC-2.2.4)
   *
   * Patterns:
   * - SWISS: [Street] [Number], [PostalCode] [City] (AC-2.2.2)
   * - EU: [Street] [Number], [PostalCode] [City], [Country] (AC-2.2.3)
   * - ALTERNATIVE: [PostalCode] [City], [Street] [Number] (AC-2.2.4)
   * - PARTIAL: Some components but incomplete pattern
   * - NONE: Cannot form a recognizable address
   *
   * @param groups - Component groups from proximity analysis
   * @returns Linked address groups with pattern information
   */
  matchPatterns(groups: AddressComponent[][]): LinkedAddressGroup[] {
    return groups.map(components => {
      const pattern = this.detectPattern(components);
      const isValid = pattern !== 'NONE' && pattern !== 'PARTIAL';

      return {
        components,
        pattern,
        start: Math.min(...components.map(c => c.start)),
        end: Math.max(...components.map(c => c.end)),
        isValid,
      };
    });
  }

  /**
   * Detect which address pattern a group of components matches
   *
   * @param components - Components in a group
   * @returns The detected pattern type
   */
  detectPattern(components: AddressComponent[]): AddressPatternType {
    // Build a map of component types present
    const types = new Set(components.map(c => c.type));
    const hasStreet = types.has('STREET_NAME');
    const hasNumber = types.has('STREET_NUMBER');
    const hasPostal = types.has('POSTAL_CODE');
    const hasCity = types.has('CITY');
    const hasCountry = types.has('COUNTRY');

    // Sort by position for order checking
    const sortedByPosition = [...components].sort((a, b) => a.start - b.start);

    // Check for EU pattern: street, postal, city, country (AC-2.2.3)
    if (hasStreet && hasPostal && hasCity && hasCountry) {
      return 'EU';
    }

    // Check for Swiss pattern: street, postal, city (no country) (AC-2.2.2)
    if (hasStreet && hasPostal && hasCity && !hasCountry) {
      const streetIndex = sortedByPosition.findIndex(c => c.type === 'STREET_NAME');
      const postalIndex = sortedByPosition.findIndex(c => c.type === 'POSTAL_CODE');

      if (streetIndex !== -1 && postalIndex !== -1 && streetIndex < postalIndex) {
        return 'SWISS';
      }
    }

    // Check for alternative pattern: postal, city, street (AC-2.2.4)
    if (hasStreet && hasPostal && hasCity) {
      const streetIndex = sortedByPosition.findIndex(c => c.type === 'STREET_NAME');
      const postalIndex = sortedByPosition.findIndex(c => c.type === 'POSTAL_CODE');

      if (postalIndex !== -1 && streetIndex !== -1 && postalIndex < streetIndex) {
        return 'ALTERNATIVE';
      }
    }

    // Check for partial - has some required components
    if ((hasStreet || hasNumber) && (hasPostal || hasCity)) {
      return 'PARTIAL';
    }

    if (hasPostal && hasCity) {
      return 'PARTIAL';
    }

    return 'NONE';
  }

  /**
   * Create a GroupedAddress entity from a LinkedAddressGroup (AC-2.2.5)
   *
   * @param linkedGroup - The linked address group
   * @param text - Original text for extracting full address text
   * @returns GroupedAddress entity
   */
  createGroupedAddressFromLinked(
    linkedGroup: LinkedAddressGroup,
    text: string,
  ): GroupedAddress {
    const { components, pattern, start, end } = linkedGroup;

    // Extract component values
    const streetComp = components.find(c => c.type === 'STREET_NAME');
    const numberComp = components.find(c => c.type === 'STREET_NUMBER');
    const postalComp = components.find(c => c.type === 'POSTAL_CODE');
    const cityComp = components.find(c => c.type === 'CITY');
    const countryComp = components.find(c => c.type === 'COUNTRY');

    // Extract the full address text span
    const fullText = text.substring(start, end);

    // Generate ID first
    const id = generateEntityId();

    // Mark components as linked (AC-2.2.6)
    const linkedComponents: AddressComponent[] = components.map(c => ({
      ...c,
      linked: true,
      linkedToGroupId: id,
    }));

    // Determine validation status based on pattern
    let validationStatus: 'valid' | 'partial' | 'uncertain';
    if (pattern === 'SWISS' || pattern === 'EU') {
      validationStatus = 'valid';
    } else if (pattern === 'ALTERNATIVE') {
      validationStatus = 'partial';
    } else {
      validationStatus = 'uncertain';
    }

    // Calculate confidence based on pattern and component count
    const confidence = this.calculateConfidence(pattern, components);

    return {
      id,
      type: 'ADDRESS',
      text: fullText,
      start,
      end,
      confidence,
      source: 'LINKED',
      components: {
        street: streetComp?.text,
        number: numberComp?.text,
        postal: postalComp?.text,
        city: cityComp?.text,
        country: countryComp?.text,
      },
      componentEntities: linkedComponents,
      patternMatched: pattern,
      validationStatus,
    };
  }

  /**
   * Calculate confidence score for a grouped address (Story 2.3 preparation)
   *
   * Scoring factors:
   * - Pattern match: SWISS/EU = 0.85, ALTERNATIVE = 0.75, PARTIAL = 0.5
   * - Component count bonus: +0.02 per component over minimum
   * - Has street + number: +0.05
   * - Has postal + city: +0.05
   */
  calculateConfidence(pattern: AddressPatternType, components: AddressComponent[]): number {
    let confidence = 0;

    // Base confidence by pattern
    switch (pattern) {
      case 'SWISS':
      case 'EU':
        confidence = 0.85;
        break;
      case 'ALTERNATIVE':
        confidence = 0.75;
        break;
      case 'PARTIAL':
        confidence = 0.5;
        break;
      default:
        confidence = 0.3;
    }

    // Component count bonus
    const extraComponents = components.length - this.config.minComponents;
    if (extraComponents > 0) {
      confidence += extraComponents * 0.02;
    }

    // Check for complete street info
    const hasStreet = components.some(c => c.type === 'STREET_NAME');
    const hasNumber = components.some(c => c.type === 'STREET_NUMBER');
    if (hasStreet && hasNumber) {
      confidence += 0.05;
    }

    // Check for complete location info
    const hasPostal = components.some(c => c.type === 'POSTAL_CODE');
    const hasCity = components.some(c => c.type === 'CITY');
    if (hasPostal && hasCity) {
      confidence += 0.05;
    }

    // Cap at 1.0
    return Math.min(confidence, 1.0);
  }

  /**
   * Full pipeline: group components, match patterns, create grouped addresses (AC-2.2.1 through AC-2.2.6)
   *
   * @param components - Address components from AddressClassifier
   * @param text - Original document text
   * @returns Array of grouped addresses and updated components
   */
  linkAndGroup(
    components: AddressComponent[],
    text: string,
  ): {
    groupedAddresses: GroupedAddress[];
    unlinkedComponents: AddressComponent[];
    linkedComponents: AddressComponent[];
  } {
    // Step 1: Group by proximity (AC-2.2.1)
    const proximityGroups = this.groupByProximity(components, text);

    // Step 2: Match patterns (AC-2.2.2, AC-2.2.3, AC-2.2.4)
    const linkedGroups = this.matchPatterns(proximityGroups);

    // Step 3: Create grouped addresses for valid groups (AC-2.2.5)
    const groupedAddresses: GroupedAddress[] = [];
    const linkedComponentSet = new Set<AddressComponent>();

    for (const group of linkedGroups) {
      if (group.isValid || group.pattern === 'PARTIAL') {
        const groupedAddress = this.createGroupedAddressFromLinked(group, text);
        groupedAddresses.push(groupedAddress);

        // Track linked components
        group.components.forEach(c => linkedComponentSet.add(c));
      }
    }

    // Step 4: Separate linked and unlinked components (AC-2.2.6)
    const linkedComponents: AddressComponent[] = [];
    const unlinkedComponents: AddressComponent[] = [];

    for (const component of components) {
      if (linkedComponentSet.has(component)) {
        // Mark as linked
        linkedComponents.push({
          ...component,
          linked: true,
        });
      } else {
        unlinkedComponents.push(component);
      }
    }

    return {
      groupedAddresses,
      unlinkedComponents,
      linkedComponents,
    };
  }

  /**
   * Link components into grouped addresses (legacy method for backward compatibility)
   */
  linkComponents(text: string, components: AddressComponent[]): GroupedAddress[] {
    const groups: GroupedAddress[] = [];
    const usedIndices = new Set<number>();

    // Sort components by position
    const sortedComponents = [...components].sort((a, b) => a.start - b.start);

    // Sliding window grouping
    for (let i = 0; i < sortedComponents.length; i++) {
      if (usedIndices.has(i)) continue;

      const seedComponent = sortedComponents[i];
      if (!seedComponent) continue;
      const group: AddressComponent[] = [seedComponent];
      usedIndices.add(i);

      // Find nearby components within distance threshold
      for (let j = i + 1; j < sortedComponents.length && group.length < this.config.maxComponents; j++) {
        if (usedIndices.has(j)) continue;

        const candidate = sortedComponents[j];
        const lastInGroup = group[group.length - 1];
        if (!candidate || !lastInGroup) continue;

        // Check if candidate is within distance of last component in group
        const distance = candidate.start - lastInGroup.end;

        if (distance <= this.config.proximityThreshold && distance >= 0) {
          // Check if adding this component makes sense
          if (this.isValidAddition(group, candidate)) {
            group.push(candidate);
            usedIndices.add(j);
          }
        } else if (distance > this.config.proximityThreshold) {
          // Too far, stop looking
          break;
        }
      }

      // Create grouped address if we have enough components
      if (group.length >= this.config.minComponents) {
        const grouped = this.createGroupedAddress(text, group);
        if (grouped) {
          groups.push(grouped);
        }
      }
    }

    return groups;
  }

  /**
   * Check if adding a component to a group is valid
   */
  private isValidAddition(group: AddressComponent[], candidate: AddressComponent): boolean {
    const existingTypes = new Set(group.map(c => c.type));

    // Don't allow duplicate component types (except STREET_NAME for composite streets)
    if (existingTypes.has(candidate.type) && candidate.type !== 'STREET_NAME') {
      return false;
    }

    // Check logical ordering
    const lastComponent = group[group.length - 1];
    if (!lastComponent) return false;
    const lastType = lastComponent.type;

    // Valid transitions
    const validTransitions: Record<AddressComponentType, AddressComponentType[]> = {
      STREET_NAME: ['STREET_NUMBER', 'POSTAL_CODE', 'CITY'],
      STREET_NUMBER: ['POSTAL_CODE', 'CITY', 'STREET_NAME'],
      POSTAL_CODE: ['CITY', 'COUNTRY', 'STREET_NAME'],
      CITY: ['COUNTRY', 'POSTAL_CODE'],
      COUNTRY: [],
      REGION: ['CITY', 'COUNTRY'],
    };

    return validTransitions[lastType]?.includes(candidate.type) ?? false;
  }

  /**
   * Create a grouped address from components (uses new GroupedAddress type from detection.ts)
   */
  private createGroupedAddress(
    text: string,
    components: AddressComponent[],
  ): GroupedAddress | null {
    if (components.length < this.config.minComponents) {
      return null;
    }

    // Sort by position
    const sorted = [...components].sort((a, b) => a.start - b.start);

    // Extract full text span
    const firstComponent = sorted[0];
    const lastComponent = sorted[sorted.length - 1];
    if (!firstComponent || !lastComponent) return null;

    const start = firstComponent.start;
    const end = lastComponent.end;
    const fullText = text.substring(start, end);

    // Extract component values
    const streetComp = sorted.find(c => c.type === 'STREET_NAME');
    const numberComp = sorted.find(c => c.type === 'STREET_NUMBER');
    const postalComp = sorted.find(c => c.type === 'POSTAL_CODE');
    const cityComp = sorted.find(c => c.type === 'CITY');
    const countryComp = sorted.find(c => c.type === 'COUNTRY');

    // Determine pattern type using the new detectPattern method
    const patternType = this.detectPattern(sorted);

    // Calculate confidence using the new method
    const confidence = this.calculateConfidence(patternType, sorted);

    // Generate ID
    const id = generateEntityId();

    // Mark components as linked
    const linkedComponents: AddressComponent[] = sorted.map(c => ({
      ...c,
      linked: true,
      linkedToGroupId: id,
    }));

    // Determine validation status based on pattern
    let validationStatus: 'valid' | 'partial' | 'uncertain';
    if (patternType === 'SWISS' || patternType === 'EU') {
      validationStatus = 'valid';
    } else if (patternType === 'ALTERNATIVE') {
      validationStatus = 'partial';
    } else {
      validationStatus = 'uncertain';
    }

    return {
      id,
      type: 'ADDRESS',
      text: fullText,
      start,
      end,
      confidence,
      source: 'LINKED',
      components: {
        street: streetComp?.text,
        number: numberComp?.text,
        postal: postalComp?.text,
        city: cityComp?.text,
        country: countryComp?.text,
      },
      componentEntities: linkedComponents,
      patternMatched: patternType,
      validationStatus,
    };
  }

  /**
   * Convert grouped addresses to Entity array
   */
  groupedAddressesToEntities(
    addresses: GroupedAddress[],
    source: EntitySource = 'RULE',
  ): Entity[] {
    return addresses.map(addr => ({
      id: addr.id,
      type: 'ADDRESS' as const,
      text: addr.text,
      start: addr.start,
      end: addr.end,
      confidence: addr.confidence,
      source,
      components: addr.componentEntities,
      metadata: {
        patternType: addr.patternMatched,
        breakdown: addr.components,
        componentCount: addr.componentEntities.length,
        isGroupedAddress: true,
      },
    }));
  }

  /**
   * Process text to find and link addresses
   *
   * Convenience method that combines classification and linking.
   */
  processText(text: string): {
    components: AddressComponent[];
    addresses: GroupedAddress[];
    entities: Entity[];
  } {
    // Step 1: Classify components
    const components = this.classifier.classifyComponents(text);

    // Step 2: Link into addresses using the new linkAndGroup method
    const { groupedAddresses } = this.linkAndGroup(components, text);

    // Step 3: Convert to entities
    const entities = this.groupedAddressesToEntities(groupedAddresses);

    return { components, addresses: groupedAddresses, entities };
  }
}

/**
 * Factory function for creating AddressLinker
 */
export function createAddressLinker(
  config?: Partial<AddressLinkerConfig>,
): AddressLinker {
  return new AddressLinker(config);
}
