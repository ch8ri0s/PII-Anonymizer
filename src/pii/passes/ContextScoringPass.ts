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
} from '../../types/detection.js';

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
 * Context Scoring Pass
 *
 * Scores entities based on surrounding context to refine confidence.
 */
export class ContextScoringPass implements DetectionPass {
  readonly name = 'ContextScoringPass';
  readonly order = 30;
  enabled = true;

  private windowSize: number;
  private flagThreshold: number;

  constructor(windowSize: number = 50, flagThreshold: number = 0.4) {
    this.windowSize = windowSize;
    this.flagThreshold = flagThreshold;
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

    return entities.map((entity) => {
      const factors = this.scoreEntity(entity, text, entities, windowSize);
      const contextScore = this.calculateContextScore(factors);

      // Apply context multiplier to confidence
      const newConfidence = Math.min(
        1.0,
        entity.confidence * (0.7 + contextScore * 0.6),
      );

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
