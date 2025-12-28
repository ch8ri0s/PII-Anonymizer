/**
 * Pass 3: Context Scoring
 *
 * Third pass in the detection pipeline that scores entities based on context.
 * Uses proximity to related entities, label keywords, and position to refine confidence.
 *
 * @module src/pii/passes/ContextScoringPass
 */

import type {
  Entity,
  DetectionPass,
  PipelineContext,
  ContextFactor,
  EntityType,
  ColumnContext,
  RegionHint,
} from '../../types/detection.js';
import {
  ContextEnhancer,
  getContextWords,
  type PositionedEntity,
} from '../../../shared/dist/pii/index.js';

/**
 * Label keywords that boost confidence for each entity type
 */
const LABEL_KEYWORDS: Record<EntityType, string[]> = {
  PERSON: [
    'name',
    'nom',
    'vorname',
    'nachname',
    'herr',
    'frau',
    'mr',
    'mrs',
    'ms',
    'dr',
    'prof',
    'monsieur',
    'madame',
  ],
  PERSON_NAME: [
    'name',
    'nom',
    'vorname',
    'nachname',
    'herr',
    'frau',
    'mr',
    'mrs',
    'ms',
    'dr',
    'prof',
    'monsieur',
    'madame',
  ],
  ORGANIZATION: [
    'firma',
    'company',
    'société',
    'gmbh',
    'ag',
    'sa',
    'sàrl',
    'ltd',
    'inc',
    'corp',
  ],
  LOCATION: ['ort', 'location', 'lieu', 'city', 'ville', 'stadt'],
  ADDRESS: [
    'adresse',
    'address',
    'anschrift',
    'wohnort',
    'domicile',
    'strasse',
    'rue',
    'street',
  ],
  SWISS_ADDRESS: [
    'adresse',
    'address',
    'anschrift',
    'wohnort',
    'domicile',
    'ch-',
    'schweiz',
    'suisse',
  ],
  EU_ADDRESS: ['adresse', 'address', 'anschrift', 'deutschland', 'france', 'österreich'],
  SWISS_AVS: [
    'avs',
    'ahv',
    'sozialversicherung',
    'assurance',
    'versicherungsnummer',
    'numéro avs',
  ],
  IBAN: ['iban', 'konto', 'compte', 'account', 'bankverbindung', 'coordonnées bancaires'],
  PHONE: [
    'tel',
    'telefon',
    'téléphone',
    'phone',
    'mobile',
    'handy',
    'natel',
    'portable',
    'fax',
  ],
  EMAIL: ['email', 'e-mail', 'mail', 'courriel', 'elektronisch'],
  DATE: [
    'datum',
    'date',
    'geboren',
    'geburtsdatum',
    'né',
    'naissance',
    'born',
    'birthday',
  ],
  AMOUNT: ['betrag', 'montant', 'amount', 'total', 'summe', 'prix', 'price', 'chf', 'eur'],
  VAT_NUMBER: ['mwst', 'tva', 'iva', 'vat', 'ust', 'uid', 'steuer'],
  INVOICE_NUMBER: [
    'rechnung',
    'facture',
    'invoice',
    'rechnungsnummer',
    'numéro',
    'ref',
    'beleg',
  ],
  PAYMENT_REF: ['referenz', 'référence', 'reference', 'zahlungsreferenz', 'qr'],
  // Epic 3: Letter and contract entity types
  QR_REFERENCE: ['qr', 'referenz', 'référence', 'reference'],
  SENDER: ['absender', 'expéditeur', 'sender', 'from', 'von', 'de'],
  RECIPIENT: ['empfänger', 'destinataire', 'recipient', 'to', 'an', 'à'],
  SALUTATION_NAME: ['dear', 'cher', 'sehr geehrte', 'liebe'],
  SIGNATURE: ['unterschrift', 'signature', 'signatur', 'signed', 'signé'],
  LETTER_DATE: ['datum', 'date', 'le'],
  REFERENCE_LINE: ['betreff', 'objet', 're:', 'subject', 'betrifft'],
  PARTY: ['partei', 'partie', 'party', 'vertragspartner'],
  AUTHOR: ['autor', 'auteur', 'author', 'verfasser'],
  VENDOR_NAME: ['lieferant', 'fournisseur', 'vendor', 'supplier'],
  UNKNOWN: [],
};

/**
 * Entity types that commonly appear together
 */
const RELATED_TYPES: Record<EntityType, EntityType[]> = {
  PERSON: ['PHONE', 'EMAIL', 'ADDRESS', 'SWISS_ADDRESS', 'DATE'],
  PERSON_NAME: ['PHONE', 'EMAIL', 'ADDRESS', 'SWISS_ADDRESS', 'DATE'],
  ORGANIZATION: ['PHONE', 'EMAIL', 'ADDRESS', 'VAT_NUMBER', 'IBAN'],
  LOCATION: ['ADDRESS', 'SWISS_ADDRESS', 'EU_ADDRESS'],
  ADDRESS: ['PERSON', 'ORGANIZATION', 'PHONE'],
  SWISS_ADDRESS: ['PERSON', 'ORGANIZATION', 'PHONE', 'SWISS_AVS'],
  EU_ADDRESS: ['PERSON', 'ORGANIZATION', 'PHONE'],
  SWISS_AVS: ['PERSON', 'DATE', 'SWISS_ADDRESS'],
  IBAN: ['PERSON', 'ORGANIZATION', 'AMOUNT'],
  PHONE: ['PERSON', 'ORGANIZATION', 'ADDRESS', 'EMAIL'],
  EMAIL: ['PERSON', 'ORGANIZATION', 'PHONE'],
  DATE: ['PERSON', 'INVOICE_NUMBER', 'AMOUNT'],
  AMOUNT: ['DATE', 'INVOICE_NUMBER', 'IBAN', 'VAT_NUMBER'],
  VAT_NUMBER: ['ORGANIZATION', 'AMOUNT', 'INVOICE_NUMBER'],
  INVOICE_NUMBER: ['DATE', 'AMOUNT', 'ORGANIZATION'],
  PAYMENT_REF: ['AMOUNT', 'IBAN'],
  // Epic 3: Letter and contract entity types
  QR_REFERENCE: ['AMOUNT', 'IBAN', 'PAYMENT_REF'],
  SENDER: ['ADDRESS', 'PHONE', 'EMAIL', 'ORGANIZATION'],
  RECIPIENT: ['ADDRESS', 'PERSON', 'SALUTATION_NAME'],
  SALUTATION_NAME: ['RECIPIENT', 'PERSON'],
  SIGNATURE: ['PERSON', 'LETTER_DATE'],
  LETTER_DATE: ['SIGNATURE', 'REFERENCE_LINE'],
  REFERENCE_LINE: ['LETTER_DATE', 'RECIPIENT'],
  PARTY: ['SIGNATURE', 'ORGANIZATION', 'PERSON'],
  AUTHOR: ['PERSON', 'ORGANIZATION'],
  VENDOR_NAME: ['ORGANIZATION', 'VAT_NUMBER', 'IBAN'],
  UNKNOWN: [],
};

/**
 * Weight for runtime context words (slightly lower than predefined)
 * Per Story 8.16: runtime context words get weight 0.8
 */
const RUNTIME_CONTEXT_WEIGHT = 0.8;

/**
 * Default region hint boost when entity type matches expected type
 * Per Story 8.16: region hints add +0.2 boost
 */
const REGION_HINT_BOOST = 0.2;

/**
 * Default column context boost when no explicit boost provided
 * Per Story 8.16: column boost capped at 0.0-0.5
 */
const DEFAULT_COLUMN_BOOST = 0.2;

/**
 * Context Scoring Pass
 *
 * Scores entities based on surrounding context to refine confidence.
 * Epic 8: Now also applies ContextEnhancer for context-word-based boosting.
 * Story 8.16: Supports runtime context injection (Presidio pattern).
 */
export class ContextScoringPass implements DetectionPass {
  readonly name = 'ContextScoringPass';
  readonly order = 30;
  enabled = true;

  private windowSize: number;
  private flagThreshold: number;
  private contextEnhancer: ContextEnhancer;

  constructor(windowSize: number = 50, flagThreshold: number = 0.4) {
    this.windowSize = windowSize;
    this.flagThreshold = flagThreshold;
    this.contextEnhancer = new ContextEnhancer();
  }

  /**
   * Execute context scoring
   */
  async execute(
    text: string,
    entities: Entity[],
    context: PipelineContext,
  ): Promise<Entity[]> {
    const windowSize = context.config?.contextWindowSize || this.windowSize;
    const enableEpic8 = context.config?.enableEpic8Features !== false;
    const language = context.language || 'en';

    // Story 8.16: Extract runtime context from config
    const runtimeContext = context.config?.context;

    // Track context boosted counts for metadata
    const boostedCounts: Partial<Record<EntityType, number>> = {};
    // Story 8.16: Track runtime context boosts separately
    const runtimeBoostedCounts: Partial<Record<EntityType, number>> = {};

    const scoredEntities = entities.map((entity) => {
      const factors = this.scoreEntity(entity, text, entities, windowSize);
      const contextScore = this.calculateContextScore(factors);

      // Apply context multiplier to confidence (existing logic)
      let newConfidence = Math.min(
        1.0,
        entity.confidence * (0.7 + contextScore * 0.6),
      );

      // Story 8.16: Apply runtime context boosts BEFORE ContextEnhancer
      let runtimeBoostApplied = 0;

      // Story 8.16: Apply column context boost
      if (runtimeContext?.columnHeaders) {
        const columnBoost = this.getColumnBoost(entity, runtimeContext.columnHeaders);
        if (columnBoost > 0) {
          newConfidence = Math.min(1.0, newConfidence + columnBoost);
          runtimeBoostApplied += columnBoost;
        }
      }

      // Story 8.16: Apply region hint boost
      if (runtimeContext?.regionHints) {
        const regionBoost = this.getRegionBoost(entity, runtimeContext.regionHints);
        if (regionBoost > 0) {
          newConfidence = Math.min(1.0, newConfidence + regionBoost);
          runtimeBoostApplied += regionBoost;
        }
      }

      // Track runtime boost
      if (runtimeBoostApplied > 0) {
        runtimeBoostedCounts[entity.type] =
          (runtimeBoostedCounts[entity.type] || 0) + 1;
      }

      // Epic 8: Apply ContextEnhancer for additional context-word-based boosting
      if (enableEpic8) {
        // Get base context words for entity type
        let contextWords = getContextWords(entity.type, language);

        // Story 8.16: Merge runtime context words with recognizer defaults
        if (runtimeContext?.contextWords && runtimeContext.contextWords.length > 0) {
          const runtimeWords = runtimeContext.contextWords.map((word) => ({
            word: word.toLowerCase(),
            weight: RUNTIME_CONTEXT_WEIGHT,
            polarity: 'positive' as const,
          }));
          contextWords = [...contextWords, ...runtimeWords];
        }

        // Story 8.16: Merge region-specific context words
        if (runtimeContext?.regionHints) {
          for (const region of runtimeContext.regionHints) {
            if (
              entity.start >= region.start &&
              entity.end <= region.end &&
              region.contextWords &&
              region.contextWords.length > 0
            ) {
              const regionWords = region.contextWords.map((word) => ({
                word: word.toLowerCase(),
                weight: RUNTIME_CONTEXT_WEIGHT,
                polarity: 'positive' as const,
              }));
              contextWords = [...contextWords, ...regionWords];
            }
          }
        }

        if (contextWords.length > 0) {
          // Convert Entity to PositionedEntity for ContextEnhancer
          const positionedEntity: PositionedEntity = {
            text: entity.text,
            type: entity.type,
            start: entity.start,
            end: entity.end,
            confidence: newConfidence,
            source: entity.source,
          };

          const result = this.contextEnhancer.enhanceWithDetails(
            positionedEntity,
            text,
            contextWords,
          );

          // Track if boosted
          if (result.boostApplied > 0) {
            boostedCounts[entity.type] =
              (boostedCounts[entity.type] || 0) + 1;
          }

          newConfidence = result.entity.confidence;
        }
      }

      return {
        ...entity,
        confidence: newConfidence,
        context: {
          score: contextScore,
          factors,
        },
        flaggedForReview: newConfidence < this.flagThreshold,
      };
    });

    // Store boosted counts in context metadata for pipeline result
    if (enableEpic8) {
      if (!context.metadata) {
        context.metadata = {};
      }
      context.metadata.contextBoosted = boostedCounts;
    }

    // Story 8.16: Store runtime context boost counts
    if (runtimeContext) {
      if (!context.metadata) {
        context.metadata = {};
      }
      context.metadata.runtimeContextBoosted = runtimeBoostedCounts;
    }

    return scoredEntities;
  }

  /**
   * Get confidence boost based on column context (Story 8.16)
   *
   * @param entity - Entity to check
   * @param columns - Column context configurations
   * @returns Confidence boost (0.0-0.5)
   */
  private getColumnBoost(entity: Entity, columns: ColumnContext[]): number {
    // Check if entity metadata contains column information
    const entityColumn = entity.metadata?.column as string | number | undefined;

    if (entityColumn === undefined) {
      return 0;
    }

    for (const col of columns) {
      // Match by column index or name
      const columnMatches =
        col.column === entityColumn ||
        (typeof col.column === 'string' &&
          typeof entityColumn === 'string' &&
          col.column.toLowerCase() === entityColumn.toLowerCase());

      if (columnMatches) {
        // Check if entity type matches expected type
        const typeMatches =
          col.entityType === entity.type ||
          (typeof col.entityType === 'string' && col.entityType.toUpperCase() === entity.type);

        if (typeMatches) {
          // Return configured boost or default, capped at 0.5
          const boost = col.confidenceBoost ?? DEFAULT_COLUMN_BOOST;
          return Math.min(0.5, Math.max(0, boost));
        }
      }
    }

    return 0;
  }

  /**
   * Get confidence boost based on region hints (Story 8.16)
   *
   * @param entity - Entity to check
   * @param regions - Region hint configurations
   * @returns Confidence boost (0.0-0.2)
   */
  private getRegionBoost(entity: Entity, regions: RegionHint[]): number {
    for (const region of regions) {
      // Check if entity is within the region
      if (entity.start >= region.start && entity.end <= region.end) {
        // If expected type matches, apply boost
        if (region.expectedEntityType) {
          const typeMatches =
            region.expectedEntityType === entity.type ||
            (typeof region.expectedEntityType === 'string' &&
              region.expectedEntityType.toUpperCase() === entity.type);

          if (typeMatches) {
            return REGION_HINT_BOOST;
          }
        }
      }
    }

    return 0;
  }

  /**
   * Score an entity based on context
   */
  private scoreEntity(
    entity: Entity,
    text: string,
    entities: Entity[],
    windowSize: number,
  ): ContextFactor[] {
    const factors: ContextFactor[] = [];

    // Factor 1: Label keywords nearby
    factors.push(this.checkLabelKeywords(entity, text, windowSize));

    // Factor 2: Related entity proximity
    factors.push(this.checkRelatedEntities(entity, entities, windowSize));

    // Factor 3: Position in document
    factors.push(this.checkDocumentPosition(entity, text));

    // Factor 4: Repetition count
    factors.push(this.checkRepetition(entity, entities));

    return factors;
  }

  /**
   * Check for label keywords near the entity
   */
  private checkLabelKeywords(
    entity: Entity,
    text: string,
    windowSize: number,
  ): ContextFactor {
    const keywords = LABEL_KEYWORDS[entity.type] || [];
    if (keywords.length === 0) {
      return {
        name: 'labelKeywords',
        weight: 0.25,
        matched: false,
        description: 'No label keywords defined for this type',
      };
    }

    // Get text window before the entity
    const windowStart = Math.max(0, entity.start - windowSize);
    const textBefore = text.slice(windowStart, entity.start).toLowerCase();

    // Check if any keyword appears in the window
    const matchedKeyword = keywords.find(
      (kw) =>
        textBefore.includes(kw.toLowerCase()) ||
        textBefore.includes(kw.toLowerCase() + ':') ||
        textBefore.includes(kw.toLowerCase() + ' '),
    );

    return {
      name: 'labelKeywords',
      weight: 0.25,
      matched: !!matchedKeyword,
      description: matchedKeyword
        ? `Found keyword "${matchedKeyword}" nearby`
        : 'No label keywords found',
    };
  }

  /**
   * Check for related entities nearby
   */
  private checkRelatedEntities(
    entity: Entity,
    entities: Entity[],
    windowSize: number,
  ): ContextFactor {
    const relatedTypes = RELATED_TYPES[entity.type] || [];
    if (relatedTypes.length === 0) {
      return {
        name: 'relatedEntities',
        weight: 0.3,
        matched: false,
        description: 'No related types defined',
      };
    }

    // Find entities within window
    const nearbyRelated = entities.filter((other) => {
      if (other.id === entity.id) return false;
      if (!relatedTypes.includes(other.type)) return false;

      // Check proximity
      const distance = Math.min(
        Math.abs(other.start - entity.end),
        Math.abs(entity.start - other.end),
      );

      return distance <= windowSize;
    });

    return {
      name: 'relatedEntities',
      weight: 0.3,
      matched: nearbyRelated.length > 0,
      description:
        nearbyRelated.length > 0
          ? `Found ${nearbyRelated.length} related entities nearby (${nearbyRelated.map((e) => e.type).join(', ')})`
          : 'No related entities nearby',
    };
  }

  /**
   * Check document position (header/footer = lower confidence for some types)
   */
  private checkDocumentPosition(entity: Entity, text: string): ContextFactor {
    const docLength = text.length;
    const position = entity.start / docLength;

    // Header is first 10%, footer is last 10%
    const isHeader = position < 0.1;
    const isFooter = position > 0.9;

    // Types that are more likely in body (not header/footer)
    const bodyTypes: EntityType[] = ['SWISS_AVS', 'IBAN', 'PAYMENT_REF'];

    if (bodyTypes.includes(entity.type) && (isHeader || isFooter)) {
      return {
        name: 'documentPosition',
        weight: 0.15,
        matched: false,
        description: `${entity.type} found in ${isHeader ? 'header' : 'footer'} (unusual position)`,
      };
    }

    // Types expected in header (sender/recipient info)
    const headerTypes: EntityType[] = ['ADDRESS', 'SWISS_ADDRESS', 'EU_ADDRESS', 'PHONE', 'EMAIL'];

    if (headerTypes.includes(entity.type) && isHeader) {
      return {
        name: 'documentPosition',
        weight: 0.15,
        matched: true,
        description: `${entity.type} found in header (expected position)`,
      };
    }

    return {
      name: 'documentPosition',
      weight: 0.15,
      matched: true,
      description: 'Position neutral',
    };
  }

  /**
   * Check if entity text is repeated in document
   */
  private checkRepetition(entity: Entity, entities: Entity[]): ContextFactor {
    const repetitions = entities.filter(
      (e) => e.id !== entity.id && e.text === entity.text && e.type === entity.type,
    );

    const count = repetitions.length;

    return {
      name: 'repetition',
      weight: 0.2,
      matched: count > 0,
      description:
        count > 0
          ? `Entity repeated ${count + 1} times in document`
          : 'Entity appears once',
    };
  }

  /**
   * Calculate overall context score from factors
   */
  private calculateContextScore(factors: ContextFactor[]): number {
    let score = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      if (factor.matched) {
        score += factor.weight;
      }
      totalWeight += factor.weight;
    }

    // Normalize to 0-1
    return totalWeight > 0 ? score / totalWeight : 0.5;
  }
}

/**
 * Create a configured ContextScoringPass instance
 */
export function createContextScoringPass(
  windowSize?: number,
  flagThreshold?: number,
): ContextScoringPass {
  return new ContextScoringPass(windowSize, flagThreshold);
}
