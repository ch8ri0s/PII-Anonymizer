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
 * Regex pattern definition
 */
interface PatternDef {
  type: EntityType;
  pattern: RegExp;
  priority: number;
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

  constructor(mlThreshold: number = 0.3) {
    this.mlThreshold = mlThreshold;
    this.patterns = this.buildPatterns();
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
    return this.mergeEntities(results);
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
    const mapping: Record<string, EntityType> = {
      PER: 'PERSON',
      PERSON: 'PERSON',
      ORG: 'ORGANIZATION',
      ORGANIZATION: 'ORGANIZATION',
      LOC: 'LOCATION',
      LOCATION: 'LOCATION',
      GPE: 'LOCATION',
      DATE: 'DATE',
      PHONE: 'PHONE',
      EMAIL: 'EMAIL',
      ADDRESS: 'ADDRESS',
      MISC: 'UNKNOWN',
    };

    return mapping[mlType.toUpperCase()] || 'UNKNOWN';
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
        if (matchText.length < 3) continue;

        entities.push({
          id: generateEntityId(),
          type: patternDef.type,
          text: matchText,
          start: match.index,
          end: match.index + matchText.length,
          confidence: 0.7, // Rule-based default confidence
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
   * Build regex patterns for Swiss/EU PII detection
   */
  private buildPatterns(): PatternDef[] {
    return [
      // Swiss AVS number (756.XXXX.XXXX.XX)
      {
        type: 'SWISS_AVS',
        pattern: /756[.\s]?\d{4}[.\s]?\d{4}[.\s]?\d{2}/g,
        priority: 1,
      },

      // IBAN (CH, DE, FR, AT, IT, etc.)
      {
        type: 'IBAN',
        pattern:
          /\b[A-Z]{2}\d{2}[\s]?(?:\d{4}[\s]?){4,7}\d{0,2}\b/g,
        priority: 1,
      },

      // Email
      {
        type: 'EMAIL',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
        priority: 1,
      },

      // Phone numbers (Swiss, German, French, Italian, Austrian)
      {
        type: 'PHONE',
        pattern:
          /(?:\+|00)?(?:41|49|33|39|43)[\s.-]?(?:\(?\d{1,4}\)?[\s.-]?)?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{2,4}/g,
        priority: 2,
      },

      // Swiss postal codes with city
      {
        type: 'SWISS_ADDRESS',
        pattern: /\b(?:CH[-\s]?)?[1-9]\d{3}\s+[A-ZÄÖÜ][a-zäöüé]+(?:[-\s][A-Za-zäöüé]+)*/g,
        priority: 3,
      },

      // German/Austrian postal codes with city
      {
        type: 'EU_ADDRESS',
        pattern: /\b(?:D[-\s]?|A[-\s]?)?\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:[-\s][A-Za-zäöüß]+)*/g,
        priority: 3,
      },

      // French postal codes with city
      {
        type: 'EU_ADDRESS',
        pattern: /\b(?:F[-\s]?)?\d{5}\s+[A-ZÀÂÆÉÈÊËÏÎÔŒÙÛÜ][a-zàâæéèêëïîôœùûüÿç]+(?:[-\s][A-Za-zàâæéèêëïîôœùûüÿç]+)*/g,
        priority: 3,
      },

      // Street addresses (German)
      {
        type: 'ADDRESS',
        pattern:
          /\b[A-ZÄÖÜ][a-zäöüß]+(?:straße|strasse|gasse|weg|platz|allee)\s+\d+[a-z]?\b/gi,
        priority: 3,
      },

      // Street addresses (French)
      {
        type: 'ADDRESS',
        pattern:
          /\b(?:rue|avenue|boulevard|chemin|place|allée)\s+(?:de\s+(?:la\s+)?|du\s+|des\s+)?[A-ZÀ-Ÿ][a-zà-ÿ]+(?:[\s-][A-Za-zà-ÿ]+)*\s+\d+[a-z]?\b/gi,
        priority: 3,
      },

      // Date patterns (European format)
      {
        type: 'DATE',
        pattern:
          /\b(?:0?[1-9]|[12]\d|3[01])[\s./-](?:0?[1-9]|1[0-2])[\s./-](?:19|20)?\d{2}\b/g,
        priority: 4,
      },

      // Date patterns (with month names - German)
      {
        type: 'DATE',
        pattern:
          /\b(?:0?[1-9]|[12]\d|3[01])\.?\s*(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s*(?:19|20)?\d{2,4}\b/gi,
        priority: 4,
      },

      // Date patterns (with month names - French)
      {
        type: 'DATE',
        pattern:
          /\b(?:0?[1-9]|[12]\d|3[01])\s*(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s*(?:19|20)?\d{2,4}\b/gi,
        priority: 4,
      },

      // VAT numbers (Swiss)
      {
        type: 'VAT_NUMBER',
        pattern: /\bCHE[-\s]?\d{3}[.\s]?\d{3}[.\s]?\d{3}(?:\s*(?:MWST|TVA|IVA))?\b/gi,
        priority: 2,
      },

      // VAT numbers (EU)
      {
        type: 'VAT_NUMBER',
        pattern: /\b(?:DE|FR|IT|AT)\s?\d{8,11}\b/g,
        priority: 2,
      },

      // Swiss QR reference (26-27 digits)
      {
        type: 'PAYMENT_REF',
        pattern: /\b\d{2}[\s]?\d{5}[\s]?\d{5}[\s]?\d{5}[\s]?\d{5}[\s]?\d{5,6}\b/g,
        priority: 2,
      },

      // Amount patterns (CHF, EUR)
      {
        type: 'AMOUNT',
        pattern:
          /\b(?:CHF|EUR|€|Fr\.?)\s*\d{1,3}(?:['\s.,]\d{3})*(?:[.,]\d{2})?\b/gi,
        priority: 5,
      },
    ];
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
