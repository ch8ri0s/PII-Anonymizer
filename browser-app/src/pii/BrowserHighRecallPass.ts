/**
 * Browser-compatible High-Recall Detection Pass (Story 7.3, Task 3)
 *
 * First pass in the detection pipeline focused on maximum recall.
 * Integrates with browser ModelManager for ML inference.
 * Runs ML model with lowered threshold and all regex patterns.
 * Prefers false positives over false negatives.
 */

import type {
  Entity,
  DetectionPass,
  PipelineContext,
  EntityType,
} from '../types/detection.js';
import { v4 as uuidv4 } from 'uuid';
import { isModelReady, isFallbackMode, runInference } from '../model';
import {
  type PatternDef,
  buildHighRecallPatterns,
  mapMLEntityType,
  DEFAULT_ML_THRESHOLD,
  DEFAULT_RULE_CONFIDENCE,
  MIN_MATCH_LENGTH,
} from '../../../shared/dist/pii/index.js';

/**
 * Browser High-Recall Detection Pass
 *
 * Runs all detection methods with low thresholds to maximize recall.
 * Target: 99%+ recall (prefer false positives over false negatives)
 */
export class BrowserHighRecallPass implements DetectionPass {
  readonly name = 'BrowserHighRecallPass';
  readonly order = 10;
  enabled = true;

  private mlThreshold: number;
  private patterns: PatternDef[];

  constructor(mlThreshold: number = DEFAULT_ML_THRESHOLD) {
    this.mlThreshold = mlThreshold;
    this.patterns = buildHighRecallPatterns();
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

    // Run ML-based detection if model is ready
    if (isModelReady() && !isFallbackMode()) {
      const mlEntities = await this.runMLDetection(text);
      results.push(...mlEntities);
    }

    // Run rule-based detection (always available)
    const ruleEntities = this.runRuleDetection(text, context.language);
    results.push(...ruleEntities);

    // Merge overlapping entities from ML and RULE sources
    return this.mergeEntities(results, text);
  }

  /**
   * Run ML model detection with lowered threshold
   */
  private async runMLDetection(text: string): Promise<Entity[]> {
    try {
      const predictions = await runInference(text);
      const entities: Entity[] = [];

      for (const pred of predictions) {
        if (pred.score < this.mlThreshold) continue;

        const type = this.mapMLType(pred.entity);
        if (type === 'UNKNOWN') continue;

        entities.push({
          id: uuidv4(),
          type,
          text: pred.word,
          start: pred.start,
          end: pred.end,
          confidence: pred.score,
          source: 'ML',
          metadata: {
            mlEntityGroup: pred.entity,
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
      // Reset lastIndex for global patterns
      patternDef.pattern.lastIndex = 0;
      const matches = text.matchAll(patternDef.pattern);

      for (const match of matches) {
        if (match.index === undefined) continue;

        const matchText = match[0];

        // Skip very short matches (likely false positives)
        if (matchText.length < MIN_MATCH_LENGTH) continue;

        entities.push({
          id: uuidv4(),
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
  private mergeEntities(entities: Entity[], originalText: string): Entity[] {
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
          const newStart = Math.min(overlapping.start, entity.start);
          const newEnd = Math.max(overlapping.end, entity.end);
          overlapping.start = newStart;
          overlapping.end = newEnd;
          // Update text to match new bounds
          overlapping.text = originalText.substring(newStart, newEnd);
        }
      } else {
        merged.push({ ...entity });
      }
    }

    return merged;
  }
}

/**
 * Create a configured BrowserHighRecallPass instance
 */
export function createBrowserHighRecallPass(mlThreshold?: number): BrowserHighRecallPass {
  return new BrowserHighRecallPass(mlThreshold);
}
