/**
 * Browser-compatible Document Type Detection Pass (Story 7.3)
 *
 * A detection pass that:
 * 1. Classifies the document type (invoice, letter, form, etc.)
 * 2. Applies type-specific confidence boosts
 * 3. Adjusts confidence based on document context
 *
 * Uses DocumentClassifier (platform-agnostic) and BrowserRuleEngine.
 */

import type {
  Entity,
  DetectionPass,
  PipelineContext,
} from '../types/detection.js';
import {
  DocumentClassifier,
  createDocumentClassifier,
  DocumentClassification,
  DocumentType,
} from '@pii/DocumentClassifier';
import { BrowserRuleEngine, createBrowserRuleEngine } from './BrowserRuleEngine';
import { createLogger } from '../utils/logger.js';

// Create logger for document type detection pass
const log = createLogger('pii:pass:doctype');

/**
 * Configuration for Browser Document Type Pass
 */
export interface BrowserDocumentTypePassConfig {
  /** Minimum confidence for document classification */
  minClassificationConfidence: number;

  /** Enable type-specific confidence boosts */
  applyConfidenceBoosts: boolean;

  /** Store classification in output metadata */
  storeClassification: boolean;

  /** Enable debug logging */
  debug: boolean;
}

const DEFAULT_CONFIG: BrowserDocumentTypePassConfig = {
  minClassificationConfidence: 0.4,
  applyConfidenceBoosts: true,
  storeClassification: true,
  debug: false,
};

/**
 * Browser Document Type Detection Pass
 *
 * Integrates document classification with type-specific
 * confidence boosts into the multi-pass pipeline.
 */
export class BrowserDocumentTypePass implements DetectionPass {
  name = 'BrowserDocumentType';
  order = 5; // Run early, before other passes
  enabled = true;

  private config: BrowserDocumentTypePassConfig;
  private classifier: DocumentClassifier;
  private ruleEngine: BrowserRuleEngine;

  constructor(config: Partial<BrowserDocumentTypePassConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.classifier = createDocumentClassifier({
      minConfidence: this.config.minClassificationConfidence,
      detectLanguage: true,
      analyzeStructure: true,
    });

    this.ruleEngine = createBrowserRuleEngine();
  }

  /**
   * Execute the document type detection pass
   */
  async execute(
    text: string,
    entities: Entity[],
    context: PipelineContext,
  ): Promise<Entity[]> {
    // Step 1: Classify document type
    const classification = this.classifier.classify(text);

    if (this.config.debug) {
      log.debug('Document classification result', {
        type: classification.type,
        confidence: classification.confidence.toFixed(2),
        language: classification.language,
        featureCount: classification.features.length,
      });
    }

    // Store classification in context for other passes
    context.metadata = context.metadata || {};
    context.metadata.documentClassification = classification;
    context.metadata.documentType = classification.type;
    context.metadata.documentLanguage = classification.language;

    // Step 2: Apply confidence boosts if enabled
    let resultEntities = entities;

    if (this.config.applyConfidenceBoosts && classification.confidence >= this.config.minClassificationConfidence) {
      resultEntities = this.ruleEngine.applyConfidenceBoosts(
        entities,
        classification.type,
      );

      // Tag entities with document type source
      resultEntities = resultEntities.map(entity => ({
        ...entity,
        metadata: {
          ...entity.metadata,
          documentType: classification.type,
          documentLanguage: classification.language,
        },
      }));
    }

    // Step 3: Add classification metadata to entities if storing
    if (this.config.storeClassification) {
      resultEntities = this.enrichEntitiesWithContext(
        resultEntities,
        classification,
        text,
      );
    }

    return resultEntities;
  }

  /**
   * Enrich entities with document context
   */
  private enrichEntitiesWithContext(
    entities: Entity[],
    classification: DocumentClassification,
    text: string,
  ): Entity[] {
    const textLength = text.length;

    return entities.map(entity => {
      // Calculate entity position ratio
      const positionRatio = entity.start / textLength;

      // Determine position zone
      let positionZone: 'header' | 'body' | 'footer' = 'body';
      if (positionRatio < 0.2) positionZone = 'header';
      else if (positionRatio > 0.8) positionZone = 'footer';

      // Apply type-specific context adjustments
      const contextAdjustment = this.calculateContextAdjustment(
        entity,
        classification.type,
        positionZone,
      );

      return {
        ...entity,
        confidence: Math.min(Math.max(entity.confidence + contextAdjustment, 0), 1),
        metadata: {
          ...entity.metadata,
          positionZone,
          positionRatio: positionRatio.toFixed(2),
          documentType: classification.type,
          documentConfidence: classification.confidence.toFixed(2),
        },
      };
    });
  }

  /**
   * Calculate context-based confidence adjustment
   */
  private calculateContextAdjustment(
    entity: Entity,
    docType: DocumentType,
    positionZone: 'header' | 'body' | 'footer',
  ): number {
    let adjustment = 0;

    // Type-specific adjustments
    switch (docType) {
      case 'INVOICE':
        // Invoice numbers more likely in header
        if (entity.type === 'INVOICE_NUMBER' && positionZone === 'header') {
          adjustment += 0.1;
        }
        // Amounts more likely in body/table area
        if (entity.type === 'AMOUNT' && positionZone === 'body') {
          adjustment += 0.05;
        }
        // IBANs/payment refs more likely in footer
        if ((entity.type === 'IBAN' || entity.type === 'PAYMENT_REF') && positionZone === 'footer') {
          adjustment += 0.1;
        }
        break;

      case 'LETTER':
        // Sender info more likely in header
        if (entity.type === 'SENDER' && positionZone === 'header') {
          adjustment += 0.15;
        }
        // Signatures more likely in footer
        if (entity.type === 'SIGNATURE' && positionZone === 'footer') {
          adjustment += 0.15;
        }
        // Salutations typically in upper body
        if (entity.type === 'SALUTATION_NAME' && positionZone !== 'footer') {
          adjustment += 0.1;
        }
        break;

      case 'CONTRACT':
        // Parties typically at start
        if (entity.type === 'PARTY' && positionZone === 'header') {
          adjustment += 0.1;
        }
        // Signatures at end
        if (entity.type === 'SIGNATURE' && positionZone === 'footer') {
          adjustment += 0.15;
        }
        break;

      case 'FORM':
        // Form fields throughout, slight boost for labeled ones
        if (entity.metadata?.isLabeledField) {
          adjustment += 0.1;
        }
        break;

      case 'REPORT':
        // Authors typically in header
        if (entity.type === 'AUTHOR' && positionZone === 'header') {
          adjustment += 0.15;
        }
        break;

      default:
        // No type-specific adjustments for UNKNOWN
        break;
    }

    return adjustment;
  }

  /**
   * Get the document classifier for external use
   */
  getClassifier(): DocumentClassifier {
    return this.classifier;
  }

  /**
   * Get the rule engine for external use
   */
  getRuleEngine(): BrowserRuleEngine {
    return this.ruleEngine;
  }

  /**
   * Classify document without applying rules
   */
  classifyOnly(text: string): DocumentClassification {
    return this.classifier.classify(text);
  }
}

/**
 * Factory function for creating BrowserDocumentTypePass
 */
export function createBrowserDocumentTypePass(
  config?: Partial<BrowserDocumentTypePassConfig>,
): BrowserDocumentTypePass {
  return new BrowserDocumentTypePass(config);
}
