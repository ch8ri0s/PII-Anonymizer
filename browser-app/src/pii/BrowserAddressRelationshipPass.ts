/**
 * Browser-compatible Address Relationship Pass
 *
 * Extends the core AddressRelationshipPass to respect frontmatter boundaries.
 * Filters out address entities that start within YAML frontmatter.
 */

import type {
  Entity,
  DetectionPass,
  PipelineContext,
} from '../types/detection.js';
import { createAddressRelationshipPass } from '@pii/passes/AddressRelationshipPass';

/**
 * Browser Address Relationship Detection Pass
 *
 * Wraps the core AddressRelationshipPass to filter entities in frontmatter.
 * Uses frontmatterEnd from context.metadata set by BrowserHighRecallPass.
 */
export class BrowserAddressRelationshipPass implements DetectionPass {
  readonly name = 'BrowserAddressRelationship';
  readonly order = 40; // Same as core AddressRelationshipPass
  enabled = true;

  private corePass: DetectionPass;

  constructor() {
    this.corePass = createAddressRelationshipPass();
  }

  /**
   * Execute address relationship detection with frontmatter filtering
   *
   * Note: The core AddressRelationshipPass creates grouped addresses by linking
   * address components. However, this can be overly aggressive in browser context
   * where documents have markdown headers that get incorrectly grouped with addresses.
   *
   * This pass filters:
   * 1. Entities that start within YAML frontmatter
   * 2. Grouped addresses that span too much content (likely false positives)
   */
  async execute(
    text: string,
    entities: Entity[],
    context: PipelineContext,
  ): Promise<Entity[]> {
    // Get frontmatter end position from context (set by BrowserHighRecallPass)
    const frontmatterEnd = (context.metadata?.frontmatterEnd as number) || 0;

    // Run the core pass
    const result = await this.corePass.execute(text, entities, context);

    // Filter out entities that start within frontmatter
    let filteredResult = result;
    if (frontmatterEnd > 0) {
      filteredResult = result.filter(e => e.start >= frontmatterEnd);
    }

    // Filter out grouped addresses that are suspiciously large
    // (contain newlines followed by content that isn't address-like)
    // Normal addresses should be < 100 chars and not contain markdown headers
    filteredResult = filteredResult.filter(e => {
      if (e.type === 'SWISS_ADDRESS' || e.type === 'EU_ADDRESS') {
        // Check if this is a grouped address (has isGroupedAddress metadata)
        const isGrouped = e.metadata?.isGroupedAddress === true;
        if (isGrouped) {
          // Reject grouped addresses that:
          // 1. Span more than 100 characters
          // 2. Contain markdown headers (#)
          // 3. Contain multiple paragraph breaks (\n\n)
          const entityText = e.text;
          if (entityText.length > 100) return false;
          if (entityText.includes('#')) return false;
          if ((entityText.match(/\n\n/g) || []).length > 1) return false;
        }
      }
      return true;
    });

    return filteredResult;
  }
}

/**
 * Factory function for creating BrowserAddressRelationshipPass
 */
export function createBrowserAddressRelationshipPass(): BrowserAddressRelationshipPass {
  return new BrowserAddressRelationshipPass();
}
