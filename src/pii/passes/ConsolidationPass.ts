/**
 * Consolidation Pass Wrapper (Story 8.8)
 *
 * Wraps the shared ConsolidationPass to implement the DetectionPass interface
 * for integration with the Electron detection pipeline.
 *
 * Pipeline Order: Runs after AddressRelationshipPass (order 50)
 *
 * @module src/pii/passes/ConsolidationPass
 */

import type { Entity, DetectionPass, PipelineContext } from '../../types/detection.js';
import {
  ConsolidationPass as SharedConsolidationPass,
  type ConsolidationPassConfig,
  type ConsolidationEntity,
} from '../../../shared/dist/pii/index.js';

/**
 * Consolidation Pass for Detection Pipeline
 *
 * Post-processing pass that:
 * 1. Resolves overlapping entity spans
 * 2. Consolidates address components into unified ADDRESS entities
 * 3. Links repeated entities with logical IDs
 */
export class ConsolidationPass implements DetectionPass {
  readonly name = 'ConsolidationPass';
  readonly order = 50; // After AddressRelationshipPass (40)
  enabled = true;

  private consolidator: SharedConsolidationPass;

  constructor(config: Partial<ConsolidationPassConfig> = {}) {
    this.consolidator = new SharedConsolidationPass(config);
  }

  /**
   * Execute consolidation pass
   */
  async execute(
    text: string,
    entities: Entity[],
    context: PipelineContext,
  ): Promise<Entity[]> {
    if (entities.length === 0) {
      return entities;
    }

    // Convert Entity[] to ConsolidationEntity[]
    const consolidationEntities: ConsolidationEntity[] = entities.map((e) => ({
      id: e.id,
      type: e.type as ConsolidationEntity['type'],
      text: e.text,
      start: e.start,
      end: e.end,
      confidence: e.confidence,
      source: e.source as ConsolidationEntity['source'],
      logicalId: e.logicalId,
      metadata: e.metadata,
      components: e.components?.map((c) => ({
        type: c.type,
        text: c.text,
        start: c.start,
        end: c.end,
        linked: c.linked,
        linkedToGroupId: c.linkedToGroupId,
      })),
      flaggedForReview: e.flaggedForReview,
      selected: e.selected,
      validation: e.validation,
      context: e.context,
    }));

    // Run consolidation
    const result = this.consolidator.consolidate(consolidationEntities, text);

    // Store metadata in pipeline context
    if (!context.metadata) {
      context.metadata = {};
    }
    context.metadata.consolidation = result.metadata;

    // Convert back to Entity[]
    const consolidatedEntities: Entity[] = result.entities.map((e) => ({
      id: e.id,
      type: e.type,
      text: e.text,
      start: e.start,
      end: e.end,
      confidence: e.confidence,
      source: e.source === 'CONSOLIDATED' ? 'RULE' : e.source,
      logicalId: e.logicalId,
      metadata: e.metadata,
      components: e.components?.map((c) => ({
        type: c.type as Entity['components'] extends Array<infer T> ? T extends { type: infer U } ? U : never : never,
        text: c.text,
        start: c.start,
        end: c.end,
        linked: c.linked,
        linkedToGroupId: c.linkedToGroupId,
      })),
      flaggedForReview: e.flaggedForReview,
      selected: e.selected,
      validation: e.validation,
      context: e.context,
    } as Entity));

    return consolidatedEntities;
  }

  /**
   * Get current configuration
   */
  getConfig(): ConsolidationPassConfig {
    return this.consolidator.getConfig();
  }

  /**
   * Update configuration
   */
  configure(config: Partial<ConsolidationPassConfig>): void {
    this.consolidator.configure(config);
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
