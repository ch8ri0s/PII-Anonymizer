/**
 * Pass 1: High-Recall Entity Detection
 *
 * First pass in the detection pipeline focused on maximum recall.
 * Runs ML model with lowered threshold and all regex patterns.
 * Prefers false positives over false negatives.
 *
 * @module src/pii/passes/HighRecallPass
 */

import type {
  Entity,
  DetectionPass,
  PipelineContext,
  EntityType,
} from '../../types/detection.js';
import { generateEntityId } from '../DetectionPipeline.js';
import {
  type PatternDef,
  buildHighRecallPatterns,
  mapMLEntityType,
  DEFAULT_ML_THRESHOLD,
  DEFAULT_RULE_CONFIDENCE,
  MIN_MATCH_LENGTH,
  DenyList,
} from '../../../shared/dist/pii/index.js';

/**
 * ML model prediction result
 */
interface MLPrediction {
  entity_group: string;
  score: number;
  word: string;
  start: number;
  end: number;
}

/**
 * High-Recall Detection Pass
 *
 * Runs all detection methods with low thresholds to maximize recall.
 * Target: 99%+ recall (prefer false positives over false negatives)
 */
export class HighRecallPass implements DetectionPass {
  readonly name = 'HighRecallPass';
  readonly order = 10;
  enabled = true;

  private mlThreshold: number;
  private patterns: PatternDef[];
  private nerPipeline: ((text: string) => Promise<MLPrediction[]>) | null =
    null;

  constructor(mlThreshold: number = DEFAULT_ML_THRESHOLD) {
    this.mlThreshold = mlThreshold;
    this.patterns = buildHighRecallPatterns();
  }

  /**
   * Set the NER pipeline function
   * Called after ML model is loaded
   */
  setNerPipeline(pipeline: (text: string) => Promise<MLPrediction[]>): void {
    this.nerPipeline = pipeline;
  }

  /**
   * Execute high-recall detection
   */
  async execute(
    text: string,
    entities: Entity[],
    context: PipelineContext,
  ): Promise<Entity[]> {
    const results: Entity[] = [...entities];

    // Run ML-based detection
    if (this.nerPipeline) {
      const mlEntities = await this.runMLDetection(text);
      results.push(...mlEntities);
    }

    // Run rule-based detection
    const ruleEntities = this.runRuleDetection(text, context.language);
    results.push(...ruleEntities);

    // Merge overlapping entities from ML and RULE sources
    let merged = this.mergeEntities(results);

    // Epic 8: Apply DenyList filtering if enabled (default: true)
    const enableEpic8 = context.config?.enableEpic8Features !== false;
    if (enableEpic8) {
      const language = context.language || 'en';
      const beforeCount = merged.length;

      // Track filtered counts by entity type
      const filteredCounts: Partial<Record<EntityType, number>> = {};

      merged = merged.filter((entity) => {
        const isDenied = DenyList.isDenied(entity.text, entity.type, language);
        if (isDenied) {
          filteredCounts[entity.type] =
            (filteredCounts[entity.type] || 0) + 1;
        }
        return !isDenied;
      });

      // Store filtered counts in context metadata for pipeline result
      if (!context.metadata) {
        context.metadata = {};
      }
      context.metadata.denyListFiltered = filteredCounts;

      const afterCount = merged.length;
      if (beforeCount !== afterCount) {
        // Log for debugging when entities are filtered
        const totalFiltered = beforeCount - afterCount;
        if (context.config?.debug) {
          console.log(
            `[HighRecallPass] DenyList filtered ${totalFiltered} entities`,
          );
        }
      }
    }

    return merged;
  }

  /**
   * Run ML model detection with lowered threshold
   */
  private async runMLDetection(text: string): Promise<Entity[]> {
    if (!this.nerPipeline) return [];

    try {
      const predictions = await this.nerPipeline(text);
      const entities: Entity[] = [];

      for (const pred of predictions) {
        if (pred.score < this.mlThreshold) continue;

        const type = this.mapMLType(pred.entity_group);
        if (type === 'UNKNOWN') continue;

        entities.push({
          id: generateEntityId(),
          type,
          text: pred.word,
          start: pred.start,
          end: pred.end,
          confidence: pred.score,
          source: 'ML',
          metadata: {
            mlEntityGroup: pred.entity_group,
            mlScore: pred.score,
          },
        });
      }

      return entities;
    } catch (error) {
      console.error('ML detection error:', error);
      return [];
    }
  }

  /**
   * Map ML model entity groups to our EntityType
   */
  private mapMLType(mlType: string): EntityType {
    return mapMLEntityType(mlType);
  }

  /**
   * Run regex pattern detection
   */
  private runRuleDetection(
    text: string,
    _language?: 'en' | 'fr' | 'de',
  ): Entity[] {
    const entities: Entity[] = [];

    for (const patternDef of this.patterns) {
      const matches = text.matchAll(patternDef.pattern);

      for (const match of matches) {
        if (match.index === undefined) continue;

        const matchText = match[0];

        // Skip very short matches (likely false positives)
        if (matchText.length < MIN_MATCH_LENGTH) continue;

        entities.push({
          id: generateEntityId(),
          type: patternDef.type,
          text: matchText,
          start: match.index,
          end: match.index + matchText.length,
          confidence: DEFAULT_RULE_CONFIDENCE,
          source: 'RULE',
          metadata: {
            patternName: patternDef.type,
            patternPriority: patternDef.priority,
          },
        });
      }
    }

    return entities;
  }

  /**
   * Merge entities from different sources
   * When same text detected by both ML and RULE, mark as 'BOTH'
   */
  private mergeEntities(entities: Entity[]): Entity[] {
    if (entities.length === 0) return [];

    // Group by position overlap
    const merged: Entity[] = [];
    const sorted = [...entities].sort((a, b) => a.start - b.start);

    for (const entity of sorted) {
      // Check if this entity overlaps with an existing one
      const overlapping = merged.find(
        (e) =>
          (entity.start >= e.start && entity.start < e.end) ||
          (entity.end > e.start && entity.end <= e.end) ||
          (entity.start <= e.start && entity.end >= e.end),
      );

      if (overlapping) {
        // Merge: combine sources, take higher confidence
        if (overlapping.source !== entity.source) {
          overlapping.source = 'BOTH';
          overlapping.confidence = Math.max(
            overlapping.confidence,
            entity.confidence,
          );
          // Expand bounds if needed
          overlapping.start = Math.min(overlapping.start, entity.start);
          overlapping.end = Math.max(overlapping.end, entity.end);
          // Update text to match new bounds
          // Note: text update would need original document text
        }
      } else {
        merged.push({ ...entity });
      }
    }

    return merged;
  }
}

/**
 * Create a configured HighRecallPass instance
 */
export function createHighRecallPass(mlThreshold?: number): HighRecallPass {
  return new HighRecallPass(mlThreshold);
}
