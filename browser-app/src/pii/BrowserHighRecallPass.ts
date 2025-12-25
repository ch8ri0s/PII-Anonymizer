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
  DenyList,
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

    // Detect frontmatter range to exclude from detection
    const frontmatterEnd = this.getFrontmatterEndPosition(text);

    // Store frontmatter end position in context metadata for other passes to use
    if (!context.metadata) {
      context.metadata = {};
    }
    context.metadata.frontmatterEnd = frontmatterEnd;

    // Run ML-based detection if model is ready
    if (isModelReady() && !isFallbackMode()) {
      const mlEntities = await this.runMLDetection(text);
      results.push(...mlEntities);
    }

    // Run rule-based detection (always available)
    const ruleEntities = this.runRuleDetection(text, context.language);
    results.push(...ruleEntities);

    // Merge overlapping entities from ML and RULE sources FIRST
    let mergedResults = this.mergeEntities(results, text);

    // Filter out entities that start within frontmatter AFTER merge
    // This ensures merged entities that expanded into frontmatter are excluded
    if (frontmatterEnd > 0) {
      console.log('[BrowserHighRecallPass] Frontmatter end position:', frontmatterEnd);
      console.log('[BrowserHighRecallPass] Merged entities:', mergedResults.length);

      // Log all ADDRESS entities for debugging
      const addressEntities = mergedResults.filter(e => e.type === 'SWISS_ADDRESS' || e.type === 'ADDRESS' || e.type === 'EU_ADDRESS');
      console.log('[BrowserHighRecallPass] ADDRESS entities:', JSON.stringify(addressEntities.map(e => ({ type: e.type, text: e.text.substring(0, 50), start: e.start, end: e.end }))));

      const entitiesInFrontmatter = mergedResults.filter(e => e.start < frontmatterEnd);
      console.log('[BrowserHighRecallPass] Entities in frontmatter (will be removed):', entitiesInFrontmatter.map(e => ({ type: e.type, text: e.text.substring(0, 30), start: e.start })));
    }
    let filteredResults = mergedResults.filter(e => e.start >= frontmatterEnd);

    // Epic 8: Apply DenyList filtering if enabled (default: true)
    const enableEpic8 = context.config?.enableEpic8Features !== false;
    if (enableEpic8) {
      const language = context.language || 'en';
      const beforeCount = filteredResults.length;

      // Track filtered counts by entity type
      const filteredCounts: Partial<Record<EntityType, number>> = {};

      filteredResults = filteredResults.filter((entity) => {
        const isDenied = DenyList.isDenied(entity.text, entity.type, language);
        if (isDenied) {
          filteredCounts[entity.type] =
            (filteredCounts[entity.type] || 0) + 1;
        }
        return !isDenied;
      });

      // Store filtered counts in context metadata for pipeline result
      context.metadata.denyListFiltered = filteredCounts;

      const afterCount = filteredResults.length;
      if (beforeCount !== afterCount) {
        const totalFiltered = beforeCount - afterCount;
        console.log(
          `[BrowserHighRecallPass] DenyList filtered ${totalFiltered} entities`,
        );
      }
    }

    return filteredResults;
  }

  /**
   * Get the end position of YAML frontmatter (after closing ---)
   * Returns 0 if no frontmatter is found
   */
  private getFrontmatterEndPosition(text: string): number {
    // Check if document starts with frontmatter
    if (!text.startsWith('---')) {
      return 0;
    }

    // Find the closing ---
    const closingIndex = text.indexOf('\n---', 3);
    if (closingIndex === -1) {
      return 0;
    }

    // Return position after the closing --- and newline
    return closingIndex + 4 + (text[closingIndex + 4] === '\n' ? 1 : 0);
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

        // Run validation function if present
        if (patternDef.validate && !patternDef.validate(matchText)) {
          continue;
        }

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
