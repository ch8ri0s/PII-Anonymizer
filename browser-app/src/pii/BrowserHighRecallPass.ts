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
import {
  isModelReady,
  isFallbackMode,
  runInference,
  // Story 8.15: Worker-based inference
  getUseWorker,
  runInferenceInWorker,
} from '../model';
import {
  type PatternDef,
  buildHighRecallPatterns,
  mapMLEntityType,
  DEFAULT_ML_THRESHOLD,
  DEFAULT_RULE_CONFIDENCE,
  MIN_MATCH_LENGTH,
  DenyList,
  // Story 8.10: Subword token merging
  type MLToken,
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
    const mergedResults = this.mergeEntities(results, text);

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
   * Story 8.10: Merges consecutive B-XXX/I-XXX tokens into complete entities
   * Story 8.11: Chunks large documents to handle >512 token documents
   * Story 8.12: Validates input before ML inference
   * Story 8.13: Retries on transient errors with exponential backoff
   * Story 8.14: Records ML inference metrics for performance monitoring
   * Story 8.15: Uses Web Worker for inference to keep UI responsive
   */
  private async runMLDetection(text: string): Promise<Entity[]> {
    // Story 8.14: Track inference start time
    const startTime = Date.now();

    // Story 8.12: Validate input before ML inference
    const validation = validateMLInput(text);
    if (!validation.valid) {
      // Log validation error without PII content
      console.warn('[BrowserHighRecallPass] ML input validation failed:', {
        error: validation.error,
        textLength: text?.length ?? 0,
      });
      return [];
    }

    // Use validated/normalized text (text is guaranteed to exist when valid is true)
    const validatedText = validation.text ?? text;

    // Log warnings if any
    if (validation.warnings?.length) {
      validation.warnings.forEach((w) =>
        console.warn('[BrowserHighRecallPass] ML input warning:', w),
      );
    }

    // Story 8.11: Chunk large documents for ML processing
    const chunks = chunkText(validatedText, { maxTokens: 512, overlapTokens: 50 });

    // Story 8.15: Determine whether to use worker or main thread
    const useWorker = getUseWorker();

    // Story 8.13: Wrap ML inference with retry logic for transient errors
    const retryResult = await withRetry(
      async () => {
        // Process all chunks (sequentially to avoid memory pressure in browser)
        const chunkPredictions: ChunkPrediction[] = [];
        for (const chunk of chunks) {
          // Story 8.15: Use worker inference if enabled, otherwise main thread
          const predictions = useWorker
            ? await runInferenceInWorker(chunk.text)
            : await runInference(chunk.text);
          chunkPredictions.push({
            chunkIndex: chunk.chunkIndex,
            predictions: predictions as MLToken[],
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
      console.error('[BrowserHighRecallPass] ML detection failed after retries:', {
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
        platform: 'browser',
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
      console.warn('[BrowserHighRecallPass] ML detection succeeded after retry:', {
        attempts: retryResult.attempts,
        totalDurationMs: retryResult.totalDurationMs,
      });
    }

    // Result is guaranteed to exist when success is true (guarded by early return above)
    const chunkPredictions = retryResult.result ?? [];

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
        id: uuidv4(),
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
      platform: 'browser',
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
