/**
 * Browser-compatible Rule Engine (Story 7.3, Task 7)
 *
 * Provides document type-specific rule configuration for browser-based detection.
 * This is a simplified version that doesn't import the full rule modules
 * (which have Node.js dependencies). Instead it provides configuration-based
 * rule application for the browser environment.
 */

import type { Entity } from '../types/detection.js';
import type { DocumentType } from '../../../shared/dist/pii/index.js';

// Re-export DocumentType for consumers
export type { DocumentType };

/**
 * Rule configuration for a document type
 */
export interface DocumentTypeRuleConfig {
  /** Required entity types for this document */
  requiredTypes: string[];
  /** Entity types with boosted confidence */
  boostedTypes: string[];
  /** Entity types to suppress (low relevance) */
  suppressedTypes: string[];
  /** Confidence boost amounts per entity type */
  confidenceBoosts: Record<string, number>;
}

/**
 * Global rule engine settings
 */
export interface GlobalRuleSettings {
  /** Minimum confidence threshold */
  minConfidence: number;
  /** Enable entity merging */
  enableMerging: boolean;
  /** Character threshold for merging nearby entities */
  mergeThreshold: number;
}

/**
 * Rule definition for custom rules
 */
export interface RuleDefinition {
  name: string;
  description: string;
  pattern?: string;
  entityType: string;
  confidence: number;
}

/**
 * Complete rules configuration
 */
export interface RulesConfiguration {
  global: GlobalRuleSettings;
  documentTypes: Partial<Record<DocumentType, DocumentTypeRuleConfig>>;
  rules: RuleDefinition[];
}

/**
 * Configuration for Browser Rule Engine
 */
export interface BrowserRuleEngineConfig {
  /** Override default configuration */
  overrides?: Partial<RulesConfiguration>;

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Default configuration (embedded)
 */
const DEFAULT_CONFIG: RulesConfiguration = {
  global: {
    minConfidence: 0.5,
    enableMerging: true,
    mergeThreshold: 10,
  },
  documentTypes: {
    INVOICE: {
      requiredTypes: ['AMOUNT', 'DATE'],
      boostedTypes: ['IBAN', 'VAT_NUMBER', 'PAYMENT_REF'],
      suppressedTypes: [],
      confidenceBoosts: {
        AMOUNT: 0.15,
        IBAN: 0.2,
        VAT_NUMBER: 0.15,
      },
    },
    LETTER: {
      requiredTypes: [],
      boostedTypes: ['PERSON', 'ADDRESS', 'DATE'],
      suppressedTypes: [],
      confidenceBoosts: {
        PERSON: 0.1,
        ADDRESS: 0.1,
      },
    },
    CONTRACT: {
      requiredTypes: ['DATE'],
      boostedTypes: ['PERSON', 'ORGANIZATION', 'ADDRESS'],
      suppressedTypes: [],
      confidenceBoosts: {
        PERSON: 0.15,
        ORGANIZATION: 0.15,
        DATE: 0.1,
      },
    },
    MEDICAL: {
      requiredTypes: [],
      boostedTypes: ['SWISS_AVS', 'DATE', 'PERSON'],
      suppressedTypes: [],
      confidenceBoosts: {
        SWISS_AVS: 0.25,
        PERSON: 0.15,
      },
    },
    LEGAL: {
      requiredTypes: [],
      boostedTypes: ['PERSON', 'ORGANIZATION', 'DATE', 'ADDRESS'],
      suppressedTypes: [],
      confidenceBoosts: {
        PERSON: 0.15,
        ORGANIZATION: 0.15,
      },
    },
    CORRESPONDENCE: {
      requiredTypes: [],
      boostedTypes: ['EMAIL', 'PHONE', 'ADDRESS', 'PERSON'],
      suppressedTypes: [],
      confidenceBoosts: {
        EMAIL: 0.1,
        PHONE: 0.1,
      },
    },
    UNKNOWN: {
      requiredTypes: [],
      boostedTypes: [],
      suppressedTypes: [],
      confidenceBoosts: {},
    },
  },
  rules: [],
};

/**
 * Browser-compatible Rule Engine
 *
 * Provides configuration-based rule application for document types.
 */
export class BrowserRuleEngine {
  private config: RulesConfiguration;

  constructor(config: RulesConfiguration | BrowserRuleEngineConfig = {}) {
    // Handle both direct config and engine config
    if ('global' in config && 'documentTypes' in config) {
      // Direct RulesConfiguration
      this.config = config as RulesConfiguration;
    } else {
      // BrowserRuleEngineConfig
      const engineConfig = config as BrowserRuleEngineConfig;
      this.config = this.mergeWithDefaults(engineConfig.overrides);
    }
  }

  /**
   * Merge overrides with defaults
   */
  private mergeWithDefaults(overrides?: Partial<RulesConfiguration>): RulesConfiguration {
    if (!overrides) return DEFAULT_CONFIG;

    return {
      global: { ...DEFAULT_CONFIG.global, ...overrides.global },
      documentTypes: { ...DEFAULT_CONFIG.documentTypes, ...overrides.documentTypes },
      rules: overrides.rules || DEFAULT_CONFIG.rules,
    };
  }

  /**
   * Get rules for a specific document type
   */
  getRulesForDocumentType(docType: string): DocumentTypeRuleConfig | undefined {
    return this.config.documentTypes[docType as DocumentType];
  }

  /**
   * Get global settings
   */
  getGlobalSettings(): GlobalRuleSettings {
    return this.config.global;
  }

  /**
   * Get custom rules
   */
  getCustomRules(): RuleDefinition[] {
    return this.config.rules;
  }

  /**
   * Apply confidence boosts to entities based on document type
   */
  applyConfidenceBoosts(
    entities: Entity[],
    docType: string,
  ): Entity[] {
    const typeConfig = this.getRulesForDocumentType(docType);
    if (!typeConfig) return entities;

    return entities.map(entity => {
      const boost = typeConfig.confidenceBoosts[entity.type] || 0;
      if (boost > 0) {
        return {
          ...entity,
          confidence: Math.min(entity.confidence + boost, 1.0),
          metadata: { ...entity.metadata, typeBoostApplied: boost },
        };
      }
      return entity;
    });
  }

  /**
   * Filter entities below minimum confidence
   */
  filterByMinConfidence(entities: Entity[]): Entity[] {
    const minConfidence = this.config.global.minConfidence;
    return entities.filter(e => e.confidence >= minConfidence);
  }

  /**
   * Check if entity type should be suppressed for document type
   */
  isTypeSuppressed(entityType: string, docType: string): boolean {
    const typeConfig = this.getRulesForDocumentType(docType);
    return typeConfig?.suppressedTypes.includes(entityType) || false;
  }

  /**
   * Check if entity type is boosted for document type
   */
  isTypeBoosted(entityType: string, docType: string): boolean {
    const typeConfig = this.getRulesForDocumentType(docType);
    return typeConfig?.boostedTypes.includes(entityType) || false;
  }
}

/**
 * Factory function for creating BrowserRuleEngine
 */
export function createBrowserRuleEngine(config?: RulesConfiguration | BrowserRuleEngineConfig): BrowserRuleEngine {
  return new BrowserRuleEngine(config);
}
