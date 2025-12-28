/**
 * Detection Pipeline Orchestrator
 *
 * Multi-pass PII detection architecture (Epic 1, Story 1.1).
 * Sequences detection passes: High-Recall → Format Validation → Context Scoring
 *
 * @module src/pii/DetectionPipeline
 */

import { v4 as uuidv4 } from 'uuid';
import { LoggerFactory } from '../utils/LoggerFactory.js';
import type {
  Entity,
  DetectionPass,
  PipelineContext,
  PassResult,
  DetectionResult,
  PipelineConfig,
  EntityType,
  Epic8Metadata,
} from '../types/detection.js';
import {
  TextNormalizer,
  type NormalizationResult,
} from '../../shared/dist/pii/index.js';

/**
 * Default pipeline configuration
 */
const DEFAULT_CONFIG: PipelineConfig = {
  mlConfidenceThreshold: 0.3,
  contextWindowSize: 50,
  autoAnonymizeThreshold: 0.6,
  enabledPasses: {
    highRecall: true,
    formatValidation: true,
    contextScoring: true,
    documentType: false, // Enabled in Epic 3
  },
  debug: false,
  // Epic 8: Enable quality improvement features by default
  enableEpic8Features: true,
  // Story 8.7: Enable text normalization by default
  enableNormalization: true,
};

/**
 * Detection Pipeline Orchestrator
 *
 * Manages the multi-pass detection process, sequencing passes
 * and aggregating results.
 */
// Create logger for pipeline orchestration
const log = LoggerFactory.create('pii:pipeline');

export class DetectionPipeline {
  private passes: DetectionPass[] = [];
  private config: PipelineConfig;
  private normalizer: TextNormalizer;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.normalizer = new TextNormalizer(config.normalizerOptions);
  }

  /**
   * Register a detection pass
   * @param pass - Detection pass to register
   */
  registerPass(pass: DetectionPass): void {
    this.passes.push(pass);
    // Sort by order to ensure correct sequencing
    this.passes.sort((a, b) => a.order - b.order);
  }

  /**
   * Remove a detection pass by name
   * @param name - Name of pass to remove
   */
  removePass(name: string): void {
    this.passes = this.passes.filter((p) => p.name !== name);
  }

  /**
   * Get registered passes
   */
  getPasses(): DetectionPass[] {
    return [...this.passes];
  }

  /**
   * Update pipeline configuration
   * @param config - Configuration updates
   */
  configure(config: Partial<PipelineConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PipelineConfig {
    return { ...this.config };
  }

  /**
   * Process document through detection pipeline
   *
   * @param text - Document text to process
   * @param documentId - Optional document identifier
   * @param language - Document language (auto-detected if not provided)
   * @returns Detection result with entities and metadata
   */
  async process(
    text: string,
    documentId?: string,
    language?: 'en' | 'fr' | 'de',
  ): Promise<DetectionResult> {
    const startTime = Date.now();
    const docId = documentId || uuidv4();

    // Story 8.7: Apply text normalization as pre-pass
    let processText = text;
    let normalizationResult: NormalizationResult | undefined;

    if (this.config.enableNormalization !== false) {
      const normStartTime = Date.now();
      normalizationResult = this.normalizer.normalize(text);
      processText = normalizationResult.normalizedText;
      this.log(
        `Normalization complete: ${text.length} → ${processText.length} chars (${Date.now() - normStartTime}ms)`,
      );
    }

    // Initialize pipeline context
    const context: PipelineContext = {
      documentId: docId,
      language: language || this.detectLanguage(processText),
      passResults: new Map(),
      startTime,
      config: this.config,
      // Story 8.7: Store normalization result for offset mapping
      normalization: normalizationResult,
      originalText: text,
    };

    let entities: Entity[] = [];
    const passResults: PassResult[] = [];

    // Execute each enabled pass in order (on normalized text)
    for (const pass of this.passes) {
      if (!pass.enabled) {
        this.log(`Skipping disabled pass: ${pass.name}`);
        continue;
      }

      const passStart = Date.now();
      const entitiesBefore = entities.length;

      try {
        this.log(`Executing pass: ${pass.name}`);
        entities = await pass.execute(processText, entities, context);

        const passResult: PassResult = {
          passName: pass.name,
          entitiesAdded: Math.max(0, entities.length - entitiesBefore),
          entitiesModified: 0, // Tracked within pass
          entitiesRemoved: Math.max(0, entitiesBefore - entities.length),
          durationMs: Date.now() - passStart,
        };

        passResults.push(passResult);
        context.passResults.set(pass.name, passResult);

        this.log(
          `Pass ${pass.name} complete: ${entities.length} entities (${passResult.durationMs}ms)`,
        );
      } catch (error) {
        log.error('Pass execution failed', {
          pass: pass.name,
          error: error instanceof Error ? error.message : String(error),
        });
        // Continue with next pass on error
      }
    }

    // Story 8.7: Map entity offsets back to original text coordinates
    if (normalizationResult && normalizationResult.indexMap.length > 0) {
      entities = this.mapEntitiesToOriginal(entities, normalizationResult, text);
    }

    // Post-processing: deduplicate and flag for review
    entities = this.deduplicateEntities(entities);
    entities = this.flagForReview(entities);

    // Build pass timings from passResults
    const passTimings: Record<string, number> = {};
    for (const pr of passResults) {
      passTimings[pr.passName] = pr.durationMs;
    }

    // Build Epic 8 metadata from context if enabled
    const enableEpic8 = this.config.enableEpic8Features !== false;
    let epic8Metadata: Epic8Metadata | undefined;
    if (enableEpic8 && context.metadata) {
      const denyListFiltered = context.metadata.denyListFiltered as
        | Partial<Record<EntityType, number>>
        | undefined;
      const contextBoosted = context.metadata.contextBoosted as
        | Partial<Record<EntityType, number>>
        | undefined;

      if (denyListFiltered || contextBoosted) {
        epic8Metadata = {
          denyListFiltered: denyListFiltered || {},
          contextBoosted: contextBoosted || {},
        };
      }
    }

    // Build result
    const result: DetectionResult = {
      entities,
      documentType: context.documentType || 'UNKNOWN',
      metadata: {
        totalDurationMs: Date.now() - startTime,
        passResults,
        entityCounts: this.countByType(entities),
        flaggedCount: entities.filter((e) => e.flaggedForReview).length,
        passTimings,
        epic8: epic8Metadata,
      },
    };

    this.log(
      `Pipeline complete: ${entities.length} entities in ${result.metadata.totalDurationMs}ms`,
    );

    return result;
  }

  /**
   * Map entity offsets from normalized text back to original text
   * Story 8.7: Uses indexMap for accurate offset repair
   */
  private mapEntitiesToOriginal(
    entities: Entity[],
    normalization: NormalizationResult,
    originalText: string,
  ): Entity[] {
    const { indexMap } = normalization;

    return entities.map((entity) => {
      const mappedSpan = this.normalizer.mapSpan(entity.start, entity.end, indexMap);

      // Extract the actual text from original for accuracy
      const originalMatchText = originalText.slice(mappedSpan.start, mappedSpan.end);

      return {
        ...entity,
        start: mappedSpan.start,
        end: mappedSpan.end,
        // Update text to match original if different
        text: originalMatchText || entity.text,
      };
    });
  }

  /**
   * Detect document language from text
   * Simple heuristic based on common words
   */
  private detectLanguage(text: string): 'en' | 'fr' | 'de' {
    const sample = text.slice(0, 2000).toLowerCase();

    const markers = {
      de: ['und', 'der', 'die', 'das', 'ist', 'für', 'mit', 'von', 'strasse'],
      fr: ['et', 'le', 'la', 'les', 'de', 'du', 'des', 'pour', 'rue', 'avec'],
      en: ['the', 'and', 'of', 'to', 'in', 'is', 'for', 'with', 'street'],
    };

    const counts = {
      de: 0,
      fr: 0,
      en: 0,
    };

    for (const [lang, words] of Object.entries(markers)) {
      for (const word of words) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = sample.match(regex);
        if (matches) {
          counts[lang as keyof typeof counts] += matches.length;
        }
      }
    }

    // Return language with highest count, default to 'de' (Swiss German)
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const topLang = sorted[0];
    return topLang ? (topLang[0] as 'en' | 'fr' | 'de') : 'de';
  }

  /**
   * Deduplicate overlapping entities
   * Keeps entity with higher confidence when overlapping
   */
  private deduplicateEntities(entities: Entity[]): Entity[] {
    if (entities.length === 0) return [];

    // Sort by start position, then by length (longer first)
    const sorted = [...entities].sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return b.end - b.start - (a.end - a.start);
    });

    const result: Entity[] = [];
    let lastEnd = -1;

    for (const entity of sorted) {
      // Check for overlap with previous entity
      if (entity.start >= lastEnd) {
        result.push(entity);
        lastEnd = entity.end;
      } else if (result.length > 0) {
        // Overlapping - keep higher confidence
        const prev = result[result.length - 1];
        if (prev && entity.confidence > prev.confidence) {
          result[result.length - 1] = entity;
          lastEnd = entity.end;
        }
        // If equal/lower confidence, skip this entity
      }
    }

    return result;
  }

  /**
   * Flag low-confidence entities for user review
   */
  private flagForReview(entities: Entity[]): Entity[] {
    const threshold = this.config.autoAnonymizeThreshold || 0.6;

    return entities.map((entity) => ({
      ...entity,
      flaggedForReview: entity.confidence < threshold,
      selected: entity.confidence >= threshold, // Auto-select high confidence
    }));
  }

  /**
   * Count entities by type
   */
  private countByType(entities: Entity[]): Record<EntityType, number> {
    const counts: Record<string, number> = {};

    for (const entity of entities) {
      counts[entity.type] = (counts[entity.type] || 0) + 1;
    }

    return counts as Record<EntityType, number>;
  }

  /**
   * Log message if debug enabled
   */
  private log(message: string): void {
    if (this.config.debug) {
      log.debug(message);
    }
  }
}

/**
 * Create a configured detection pipeline instance
 * Factory function for easy instantiation
 */
export function createPipeline(
  config: Partial<PipelineConfig> = {},
): DetectionPipeline {
  return new DetectionPipeline(config);
}

/**
 * Generate unique entity ID
 */
export function generateEntityId(): string {
  return uuidv4();
}

/**
 * Create a new PipelineContext
 */
export function createContext(
  documentId: string,
  config?: PipelineConfig,
): PipelineContext {
  return {
    documentId,
    passResults: new Map(),
    startTime: Date.now(),
    config,
  };
}
