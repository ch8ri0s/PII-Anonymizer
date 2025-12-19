/**
 * Letter-Specific Detection Rules (Story 3.3)
 *
 * Provides letter-optimized PII detection for:
 * - Sender information (header/letterhead)
 * - Recipient address blocks
 * - Salutations with names
 * - Signature blocks
 * - Letter dates
 */

import { Entity, EntitySource } from '../../types/detection.js';
import { generateEntityId } from '../DetectionPipeline.js';

/**
 * Letter-specific entity types
 */
export type LetterEntityType =
  | 'SENDER'
  | 'RECIPIENT'
  | 'SALUTATION_NAME'
  | 'SIGNATURE'
  | 'LETTER_DATE'
  | 'REFERENCE_LINE';

/**
 * Configuration for Letter Rules
 */
export interface LetterRulesConfig {
  /** Sender detection in header (first 20%) */
  senderHeaderRatio: number;

  /** Recipient block detection */
  detectRecipient: boolean;

  /** Salutation name extraction */
  extractSalutationNames: boolean;

  /** Signature detection */
  detectSignature: boolean;

  /** Confidence boost for position-aware entities */
  positionBoost: number;
}

const DEFAULT_CONFIG: LetterRulesConfig = {
  senderHeaderRatio: 0.2,
  detectRecipient: true,
  extractSalutationNames: true,
  detectSignature: true,
  positionBoost: 0.15,
};

/**
 * Salutation patterns by language
 */
const SALUTATION_PATTERNS: Record<string, RegExp[]> = {
  en: [
    /\bDear\s+(?:Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Prof\.?)?\s*([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
    /\bDear\s+([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
    /\bTo\s+(?:Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Prof\.?)?\s*([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
  ],
  fr: [
    /\bCher\s+(?:Monsieur|M\.)\s+([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
    /\bChère\s+(?:Madame|Mme\.?)\s+([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
    /\bMadame,\s+Monsieur/gi,
    /\bMonsieur\s+([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
    /\bMadame\s+([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
  ],
  de: [
    /\bSehr\s+geehrte(?:r)?\s+(?:Herr|Frau)\s+(?:Dr\.?|Prof\.?)?\s*([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
    /\bLiebe(?:r)?\s+(?:Herr|Frau)?\s*([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
    /\bHerr\s+([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
    /\bFrau\s+([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
  ],
  it: [
    /\bGentile\s+(?:Signor|Sig\.?)\s+([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
    /\bGentile\s+(?:Signora|Sig\.?ra)\s+([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
    /\bEgregio\s+(?:Signor|Sig\.?)\s+([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
    /\bCaro\s+([A-Z][a-zA-ZÀ-ÿ'-]+)/gi,
    /\bCara\s+([A-Z][a-zA-ZÀ-ÿ'-]+)/gi,
  ],
};

/**
 * Closing/Signature patterns by language
 */
const CLOSING_PATTERNS: Record<string, RegExp[]> = {
  en: [
    /(?:sincerely|regards|best regards|kind regards|yours truly|yours faithfully|best wishes|warm regards)\s*,?\s*\n+\s*([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
  ],
  fr: [
    /(?:cordialement|salutations|meilleures salutations|bien à vous|amicalement)\s*,?\s*\n+\s*([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
    /(?:veuillez agréer|je vous prie d'agréer).*\n+\s*([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
  ],
  de: [
    /(?:mit freundlichen grüßen|mit freundlichen grüssen|hochachtungsvoll|beste grüße|beste grüsse|freundliche grüße|freundliche grüssen)\s*,?\s*\n+\s*([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
  ],
  it: [
    /(?:cordiali saluti|distinti saluti|cordialmente)\s*,?\s*\n+\s*([A-Z][a-zA-ZÀ-ÿ'-]+(?:\s+[A-Z][a-zA-ZÀ-ÿ'-]+)*)/gi,
  ],
};

/**
 * Recipient block patterns (address block after To:/À:/An:)
 */
const RECIPIENT_BLOCK_PATTERNS: RegExp[] = [
  // English
  /(?:^|\n)(?:to|attention|attn)[:.]?\s*\n?((?:[^\n]+\n){1,5})/gi,
  // French
  /(?:^|\n)(?:à|destinataire)[:.]?\s*\n?((?:[^\n]+\n){1,5})/gi,
  // German
  /(?:^|\n)(?:an|z\.?\s*hd\.?)[:.]?\s*\n?((?:[^\n]+\n){1,5})/gi,
];

/**
 * Date patterns for letter dates
 */
const DATE_PATTERNS: RegExp[] = [
  // English: January 1, 2024 or Jan 1, 2024
  /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b/gi,
  // European: 1 January 2024 or 1 janvier 2024
  /\b\d{1,2}\.?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}\b/gi,
  // ISO-like: 2024-01-15
  /\b\d{4}-\d{2}-\d{2}\b/g,
  // European numeric: 15.01.2024 or 15/01/2024
  /\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/g,
];

/**
 * Reference line patterns (Re: / Betreff: / Objet:)
 */
const REFERENCE_PATTERNS: RegExp[] = [
  /(?:^|\n)(?:re|ref|reference|subject|betreff|betr|objet|concerne)[:.]?\s*(.{5,100})(?=\n|$)/gim,
];

/**
 * Letter Rules Engine
 */
export class LetterRules {
  private config: LetterRulesConfig;

  constructor(config: Partial<LetterRulesConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Apply letter-specific detection rules
   */
  applyRules(
    text: string,
    existingEntities: Entity[] = [],
    language: 'en' | 'fr' | 'de' | 'it' = 'en',
  ): Entity[] {
    const newEntities: Entity[] = [];

    // Analyze document structure
    const structure = this.analyzeLetterStructure(text);

    // Extract salutation names
    if (this.config.extractSalutationNames) {
      const salutationEntities = this.extractSalutationNames(text, language);
      newEntities.push(...salutationEntities);
    }

    // Extract recipient block
    if (this.config.detectRecipient && structure.recipientBlockStart !== null) {
      const recipientEntities = this.extractRecipientBlock(text, structure);
      newEntities.push(...recipientEntities);
    }

    // Extract signature
    if (this.config.detectSignature) {
      const signatureEntities = this.extractSignature(text, language);
      newEntities.push(...signatureEntities);
    }

    // Extract letter date
    const dateEntities = this.extractLetterDate(text, structure);
    newEntities.push(...dateEntities);

    // Extract reference line
    const refEntities = this.extractReferenceLine(text);
    newEntities.push(...refEntities);

    // Apply position-based confidence boosts
    this.applyPositionBoosts(newEntities, structure, text.length);

    // Deduplicate with existing entities
    return this.deduplicateEntities(existingEntities, newEntities);
  }

  /**
   * Analyze letter structure to identify regions
   */
  private analyzeLetterStructure(text: string): LetterStructure {
    const totalLength = text.length;

    // Find header end (first 20%)
    const headerEndIndex = Math.floor(totalLength * this.config.senderHeaderRatio);

    // Find salutation position
    let salutationStart: number | null = null;
    let salutationEnd: number | null = null;

    for (const langPatterns of Object.values(SALUTATION_PATTERNS)) {
      for (const pattern of langPatterns) {
        pattern.lastIndex = 0;
        const match = pattern.exec(text);
        if (match) {
          salutationStart = match.index;
          salutationEnd = match.index + match[0].length;
          break;
        }
      }
      if (salutationStart !== null) break;
    }

    // Find recipient block (usually between header and salutation)
    let recipientBlockStart: number | null = null;
    let recipientBlockEnd: number | null = null;

    for (const pattern of RECIPIENT_BLOCK_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match) {
        recipientBlockStart = match.index;
        recipientBlockEnd = match.index + match[0].length;
        break;
      }
    }

    // Find closing/signature region (last 30%)
    const signatureRegionStart = Math.floor(totalLength * 0.7);

    return {
      headerEndIndex,
      salutationStart,
      salutationEnd,
      recipientBlockStart,
      recipientBlockEnd,
      signatureRegionStart,
    };
  }

  /**
   * Extract names from salutations
   */
  private extractSalutationNames(
    text: string,
    language: 'en' | 'fr' | 'de' | 'it',
  ): Entity[] {
    const entities: Entity[] = [];
    const patterns = SALUTATION_PATTERNS[language] ?? SALUTATION_PATTERNS['en'] ?? [];

    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0];
        const name = match[1];

        if (!name || name.length < 2) continue;

        // Skip generic salutations without names
        if (/^(Madame|Monsieur|Sir|Madam)$/i.test(name)) continue;

        entities.push({
          id: generateEntityId(),
          type: 'SALUTATION_NAME' as const,
          text: fullMatch,
          start: match.index,
          end: match.index + fullMatch.length,
          confidence: 0.85,
          source: 'RULE' as EntitySource,
          metadata: {
            extractedName: name,
            ruleType: 'salutation',
            language,
          },
        });
      }
    }

    return entities;
  }

  /**
   * Extract recipient block
   */
  private extractRecipientBlock(
    text: string,
    structure: LetterStructure,
  ): Entity[] {
    const entities: Entity[] = [];

    if (structure.recipientBlockStart === null) return entities;

    for (const pattern of RECIPIENT_BLOCK_PATTERNS) {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0].trim();
        const blockContent = match[1]?.trim();

        if (!blockContent || blockContent.length < 10) continue;

        entities.push({
          id: generateEntityId(),
          type: 'RECIPIENT' as const,
          text: fullMatch,
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.8,
          source: 'RULE' as EntitySource,
          metadata: {
            ruleType: 'recipient_block',
            blockContent,
          },
        });
      }
    }

    return entities;
  }

  /**
   * Extract signature from closing
   */
  private extractSignature(
    text: string,
    language: 'en' | 'fr' | 'de' | 'it',
  ): Entity[] {
    const entities: Entity[] = [];
    const langPatterns = CLOSING_PATTERNS[language] ?? CLOSING_PATTERNS['en'] ?? [];

    // Also try other languages
    const allPatterns = [
      ...langPatterns,
      ...Object.values(CLOSING_PATTERNS).flat(),
    ];

    const usedRanges = new Set<string>();

    for (const pattern of allPatterns) {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0];
        const signature = match[1];

        if (!signature || signature.length < 2) continue;

        const start = match.index;
        const end = start + fullMatch.length;
        const rangeKey = `${start}-${end}`;

        if (usedRanges.has(rangeKey)) continue;
        usedRanges.add(rangeKey);

        entities.push({
          id: generateEntityId(),
          type: 'SIGNATURE' as const,
          text: fullMatch,
          start,
          end,
          confidence: 0.9,
          source: 'RULE' as EntitySource,
          metadata: {
            extractedSignature: signature,
            ruleType: 'signature',
          },
        });
      }
    }

    return entities;
  }

  /**
   * Extract letter date
   */
  private extractLetterDate(
    text: string,
    structure: LetterStructure,
  ): Entity[] {
    const entities: Entity[] = [];
    const usedRanges = new Set<string>();

    for (const pattern of DATE_PATTERNS) {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const dateText = match[0];
        const start = match.index;
        const end = start + dateText.length;
        const rangeKey = `${start}-${end}`;

        if (usedRanges.has(rangeKey)) continue;
        usedRanges.add(rangeKey);

        // Higher confidence if in header area
        const isInHeader = start < structure.headerEndIndex;
        const confidence = isInHeader ? 0.85 : 0.7;

        entities.push({
          id: generateEntityId(),
          type: 'LETTER_DATE' as const,
          text: dateText,
          start,
          end,
          confidence,
          source: 'RULE' as EntitySource,
          metadata: {
            ruleType: 'letter_date',
            isInHeader,
          },
        });

        // Only take first date in header as letter date
        if (isInHeader) break;
      }
    }

    return entities;
  }

  /**
   * Extract reference line
   */
  private extractReferenceLine(text: string): Entity[] {
    const entities: Entity[] = [];

    for (const pattern of REFERENCE_PATTERNS) {
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0].trim();
        const refContent = match[1]?.trim();

        if (!refContent || refContent.length < 5) continue;

        entities.push({
          id: generateEntityId(),
          type: 'REFERENCE_LINE' as const,
          text: fullMatch,
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.75,
          source: 'RULE' as EntitySource,
          metadata: {
            ruleType: 'reference_line',
            referenceContent: refContent,
          },
        });
      }
    }

    return entities;
  }

  /**
   * Apply position-based confidence boosts
   */
  private applyPositionBoosts(
    entities: Entity[],
    structure: LetterStructure,
    _textLength: number,
  ): void {
    for (const entity of entities) {
      // Boost sender entities in header
      if (entity.type === 'SENDER' && entity.start < structure.headerEndIndex) {
        entity.confidence = Math.min(
          entity.confidence + this.config.positionBoost,
          1.0,
        );
        entity.metadata = { ...entity.metadata, positionBoost: 'header' };
      }

      // Boost signature entities in footer region
      if (entity.type === 'SIGNATURE' && entity.start > structure.signatureRegionStart) {
        entity.confidence = Math.min(
          entity.confidence + this.config.positionBoost,
          1.0,
        );
        entity.metadata = { ...entity.metadata, positionBoost: 'footer' };
      }

      // Boost salutation near expected position
      if (entity.type === 'SALUTATION_NAME' && structure.salutationStart !== null) {
        const expectedPosition = structure.salutationStart;
        const distance = Math.abs(entity.start - expectedPosition);

        if (distance < 100) {
          entity.confidence = Math.min(
            entity.confidence + this.config.positionBoost * 0.5,
            1.0,
          );
        }
      }
    }
  }

  /**
   * Deduplicate entities
   */
  private deduplicateEntities(
    existing: Entity[],
    newEntities: Entity[],
  ): Entity[] {
    const result = [...existing];

    for (const newEntity of newEntities) {
      const overlapping = result.find(e =>
        this.rangesOverlap(e.start, e.end, newEntity.start, newEntity.end),
      );

      if (!overlapping) {
        result.push(newEntity);
      } else if (newEntity.confidence > overlapping.confidence) {
        const index = result.indexOf(overlapping);
        result[index] = newEntity;
      }
    }

    return result.sort((a, b) => a.start - b.start);
  }

  /**
   * Check if two ranges overlap
   */
  private rangesOverlap(
    start1: number,
    end1: number,
    start2: number,
    end2: number,
  ): boolean {
    return start1 < end2 && start2 < end1;
  }
}

/**
 * Letter structure analysis result
 */
interface LetterStructure {
  headerEndIndex: number;
  salutationStart: number | null;
  salutationEnd: number | null;
  recipientBlockStart: number | null;
  recipientBlockEnd: number | null;
  signatureRegionStart: number;
}

/**
 * Factory function for creating LetterRules
 */
export function createLetterRules(
  config?: Partial<LetterRulesConfig>,
): LetterRules {
  return new LetterRules(config);
}
