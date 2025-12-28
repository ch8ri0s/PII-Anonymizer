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
import { LoggerFactory } from '../../utils/LoggerFactory.js';

// Create logger for high-recall detection pass
const log = LoggerFactory.create('pii:pass:recall');
import {
  type PatternDef,
  buildHighRecallPatterns,
  mapMLEntityType,
  DEFAULT_ML_THRESHOLD,
  DEFAULT_RULE_CONFIDENCE,
  MIN_MATCH_LENGTH,
  DenyList,
  // Story 8.10: Subword token merging
  mergeSubwordTokens,
  // Story 8.11: Document chunking for large files
  type ChunkPrediction,
  chunkText,
  mergeChunkPredictions,
  // Story 8.12: ML input validation
  validateMLInput,
  // Story 8.13: ML error recovery with retry logic
  withRetry,
  // Story 8.14: ML performance monitoring
  createInferenceMetrics,
  recordMLMetrics,
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
          log.debug('DenyList filtered entities', { count: totalFiltered });
        }
      }
    }

    return merged;
  }

  /**
   * Run ML model detection with lowered threshold
   * Story 8.10: Merges consecutive B-XXX/I-XXX tokens into complete entities
   * Story 8.11: Chunks large documents to handle >512 token documents
   * Story 8.12: Validates input before ML inference
   * Story 8.13: Retries on transient errors with exponential backoff
   * Story 8.14: Records ML inference metrics for performance monitoring
   */
  private async runMLDetection(text: string): Promise<Entity[]> {
    if (!this.nerPipeline) return [];

    // Story 8.14: Track inference start time
    const startTime = Date.now();

    // Story 8.12: Validate input before ML inference
    const validation = validateMLInput(text);
    if (!validation.valid) {
      // Log validation error without PII content
      log.warn('ML input validation failed', {
        error: validation.error,
        textLength: text?.length ?? 0,
      });
      return [];
    }

    // Use validated/normalized text
    const validatedText = validation.text!;

    // Log warnings if any
    if (validation.warnings?.length) {
      validation.warnings.forEach((w) =>
        log.warn('ML input warning', { warning: w }),
      );
    }

    // Story 8.11: Chunk large documents for ML processing
    const chunks = chunkText(validatedText, { maxTokens: 512, overlapTokens: 50 });

    // Story 8.13: Wrap ML inference with retry logic for transient errors
    const retryResult = await withRetry(
      async () => {
        // Process all chunks (sequentially to avoid memory pressure)
        const chunkPredictions: ChunkPrediction[] = [];
        for (const chunk of chunks) {
          const predictions = await this.nerPipeline!(chunk.text);
          chunkPredictions.push({
            chunkIndex: chunk.chunkIndex,
            predictions: predictions.map((p) => ({
              word: p.word,
              entity: p.entity_group,
              score: p.score,
              start: p.start,
              end: p.end,
            })),
          });
        }
        return chunkPredictions;
      },
      {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 5000,
      },
    );

    // Handle retry failure
    if (!retryResult.success) {
      log.error('ML detection failed after retries', {
        attempts: retryResult.attempts,
        totalDurationMs: retryResult.totalDurationMs,
        error: retryResult.error?.message,
        textLength: validatedText.length,
      });

      // Story 8.14: Record failed inference metrics
      const endTime = Date.now();
      recordMLMetrics(createInferenceMetrics({
        startTime,
        endTime,
        textLength: validatedText.length,
        entitiesDetected: 0,
        platform: 'electron',
        modelName: 'xenova/bert-ner',
        chunked: chunks.length > 1,
        chunkCount: chunks.length,
        failed: true,
        retryAttempts: retryResult.attempts,
      }));

      return [];
    }

    // Log retry info if multiple attempts were needed
    if (retryResult.attempts > 1) {
      log.warn('ML detection succeeded after retry', {
        attempts: retryResult.attempts,
        totalDurationMs: retryResult.totalDurationMs,
      });
    }

    const chunkPredictions = retryResult.result!;

    // Story 8.11: Merge predictions from all chunks with offset adjustment
    const allPredictions = mergeChunkPredictions(chunkPredictions, chunks);

    // Story 8.10: Merge consecutive subword tokens (B-XXX, I-XXX → single entity)
    // This handles HuggingFace NER models that return fragmented tokens
    const mergedTokens = mergeSubwordTokens(allPredictions, validatedText, {
      minLength: MIN_MATCH_LENGTH,
    });

    const entities: Entity[] = [];

    for (const merged of mergedTokens) {
      // Apply ML threshold filter
      if (merged.score < this.mlThreshold) continue;

      const type = this.mapMLType(merged.entity);
      if (type === 'UNKNOWN') continue;

      entities.push({
        id: generateEntityId(),
        type,
        text: merged.word,
        start: merged.start,
        end: merged.end,
        confidence: merged.score,
        source: 'ML',
        metadata: {
          mlEntityGroup: merged.entity,
          mlScore: merged.score,
          tokenCount: merged.tokenCount,
          chunkCount: chunks.length,
        },
      });
    }

    // Story 8.14: Record successful inference metrics
    const endTime = Date.now();
    recordMLMetrics(createInferenceMetrics({
      startTime,
      endTime,
      textLength: validatedText.length,
      entitiesDetected: entities.length,
      platform: 'electron',
      modelName: 'xenova/bert-ner',
      chunked: chunks.length > 1,
      chunkCount: chunks.length,
      retryAttempts: retryResult.attempts > 1 ? retryResult.attempts : undefined,
    }));

    return entities;
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

        // Apply pattern-specific validation if defined
        if (patternDef.validate && !patternDef.validate(matchText)) {
          continue;
        }

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
