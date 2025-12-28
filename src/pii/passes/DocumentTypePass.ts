/**
 * Document Type Detection Pass (Epic 3 Integration)
 *
 * A detection pass that:
 * 1. Classifies the document type (invoice, letter, form, etc.)
 * 2. Applies type-specific detection rules
 * 3. Adjusts confidence based on document context
 */

import {
  Entity,
  DetectionPass,
  PipelineContext,
} from '../../types/detection.js';
import {
  DocumentClassifier,
  createDocumentClassifier,
  DocumentClassification,
  DocumentType,
} from '../DocumentClassifier.js';
import { RuleEngine, createRuleEngine } from '../RuleEngine.js';
import { LoggerFactory } from '../../utils/LoggerFactory.js';

// Create logger for document type detection pass
const log = LoggerFactory.create('pii:pass:doctype');

/**
 * Configuration for Document Type Pass
 */
export interface DocumentTypePassConfig {
  /** Minimum confidence for document classification */
  minClassificationConfidence: number;

  /** Enable type-specific rule application */
  applyTypeRules: boolean;

  /** Store classification in output metadata */
  storeClassification: boolean;

  /** Enable debug logging */
  debug: boolean;
}

const DEFAULT_CONFIG: DocumentTypePassConfig = {
  minClassificationConfidence: 0.4,
  applyTypeRules: true,
  storeClassification: true,
  debug: false,
};

/**
 * Document Type Detection Pass
 *
 * Integrates document classification with type-specific
 * detection rules into the multi-pass pipeline.
 */
export class DocumentTypePass implements DetectionPass {
  name = 'DocumentType';
  order = 5; // Run early, before other passes
  enabled = true;

  private config: DocumentTypePassConfig;
  private classifier: DocumentClassifier;
  private ruleEngine: RuleEngine;

  constructor(config: Partial<DocumentTypePassConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.classifier = createDocumentClassifier({
      minConfidence: this.config.minClassificationConfidence,
      detectLanguage: true,
      analyzeStructure: true,
    });

    this.ruleEngine = createRuleEngine({
      debug: this.config.debug,
    });
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

    // Step 2: Apply type-specific rules if enabled
    let resultEntities = entities;

    if (this.config.applyTypeRules && classification.confidence >= this.config.minClassificationConfidence) {
      resultEntities = this.ruleEngine.applyRules(
        text,
        classification,
        entities,
      );

      // Tag new entities with document type source
      resultEntities = resultEntities.map(entity => {
        if (!entity.metadata?.documentType) {
          return {
            ...entity,
            metadata: {
              ...entity.metadata,
              documentType: classification.type,
              documentLanguage: classification.language,
            },
          };
        }
        return entity;
      });
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
  getRuleEngine(): RuleEngine {
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
 * Factory function for creating DocumentTypePass
 */
export function createDocumentTypePass(
  config?: Partial<DocumentTypePassConfig>,
): DocumentTypePass {
  return new DocumentTypePass(config);
}
