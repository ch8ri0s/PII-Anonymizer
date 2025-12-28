/**
 * Rule Engine (Story 3.4)
 *
 * Loads and applies document type-specific detection rules.
 * Provides a unified interface for configuring detection behavior
 * based on document classification.
 */

import { Entity } from '../types/detection.js';
import { DocumentType, DocumentClassification } from './DocumentClassifier.js';
import { InvoiceRules, createInvoiceRules } from './rules/InvoiceRules.js';
import { LetterRules, createLetterRules } from './rules/LetterRules.js';
import { LoggerFactory } from '../utils/LoggerFactory.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Create logger for rule engine
const log = LoggerFactory.create('pii:rules');

/**
 * Rule configuration for a document type
 */
export interface DocumentTypeRuleConfig {
  enabled: boolean;
  rules: string[];
  confidenceBoosts: Record<string, number>;
  entityTypeMapping: Record<string, string>;
  thresholds: {
    autoAnonymize: number;
    flagForReview: number;
    minConfidence: number;
  };
  note?: string;
}

/**
 * Global rule engine settings
 */
export interface GlobalRuleSettings {
  enableDocumentTypeDetection: boolean;
  fallbackToUnknown: boolean;
  minClassificationConfidence: number;
  logClassificationResults: boolean;
  cacheClassificationResults: boolean;
}

/**
 * Complete rules configuration
 */
export interface RulesConfiguration {
  version: string;
  description: string;
  documentTypes: Record<DocumentType, DocumentTypeRuleConfig>;
  globalSettings: GlobalRuleSettings;
  ruleDefinitions: Record<string, RuleDefinition>;
}

/**
 * Rule definition
 */
export interface RuleDefinition {
  description: string;
  patterns: string[];
  entityType: string;
  baseConfidence: number;
}

/**
 * Configuration for Rule Engine
 */
export interface RuleEngineConfig {
  /** Path to custom configuration file */
  configPath?: string;

  /** Override default configuration */
  overrides?: Partial<RulesConfiguration>;

  /** Enable debug logging */
  debug?: boolean;
}

// Get default config path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_CONFIG_PATH = join(__dirname, '..', 'config', 'detectionRules.json');

/**
 * Default configuration (embedded fallback)
 */
const DEFAULT_CONFIG: RulesConfiguration = {
  version: '1.0.0',
  description: 'Default detection rules configuration',
  documentTypes: {
    INVOICE: {
      enabled: true,
      rules: ['invoiceNumber', 'amount', 'vatNumber', 'paymentRef', 'iban'],
      confidenceBoosts: { header: 0.2, table: 0.1 },
      entityTypeMapping: {},
      thresholds: { autoAnonymize: 0.85, flagForReview: 0.6, minConfidence: 0.4 },
    },
    LETTER: {
      enabled: true,
      rules: ['sender', 'recipient', 'salutation', 'signature'],
      confidenceBoosts: { header: 0.15, signatureArea: 0.25 },
      entityTypeMapping: {},
      thresholds: { autoAnonymize: 0.8, flagForReview: 0.55, minConfidence: 0.35 },
    },
    FORM: {
      enabled: true,
      rules: ['formField', 'signature'],
      confidenceBoosts: { labeledField: 0.3 },
      entityTypeMapping: {},
      thresholds: { autoAnonymize: 0.75, flagForReview: 0.5, minConfidence: 0.3 },
    },
    CONTRACT: {
      enabled: true,
      rules: ['parties', 'signature', 'date'],
      confidenceBoosts: { partiesClause: 0.25, signatureBlock: 0.2 },
      entityTypeMapping: {},
      thresholds: { autoAnonymize: 0.85, flagForReview: 0.6, minConfidence: 0.4 },
    },
    REPORT: {
      enabled: true,
      rules: ['author', 'sections'],
      confidenceBoosts: { authorBlock: 0.25 },
      entityTypeMapping: {},
      thresholds: { autoAnonymize: 0.8, flagForReview: 0.55, minConfidence: 0.35 },
    },
    UNKNOWN: {
      enabled: true,
      rules: [],
      confidenceBoosts: {},
      entityTypeMapping: {},
      thresholds: { autoAnonymize: 0.8, flagForReview: 0.6, minConfidence: 0.4 },
    },
  },
  globalSettings: {
    enableDocumentTypeDetection: true,
    fallbackToUnknown: true,
    minClassificationConfidence: 0.4,
    logClassificationResults: true,
    cacheClassificationResults: true,
  },
  ruleDefinitions: {},
};

/**
 * Rule Engine
 *
 * Coordinates document type-specific rule application.
 */
export class RuleEngine {
  private config: RulesConfiguration;
  private invoiceRules: InvoiceRules;
  private letterRules: LetterRules;
  private debug: boolean;

  constructor(engineConfig: RuleEngineConfig = {}) {
    this.debug = engineConfig.debug || false;
    this.config = this.loadConfiguration(engineConfig);

    // Initialize type-specific rule engines
    this.invoiceRules = createInvoiceRules();
    this.letterRules = createLetterRules();
  }

  /**
   * Load configuration from file or defaults
   */
  private loadConfiguration(engineConfig: RuleEngineConfig): RulesConfiguration {
    let config = { ...DEFAULT_CONFIG };

    // Try to load from file
    const configPath = engineConfig.configPath || DEFAULT_CONFIG_PATH;

    try {
      if (existsSync(configPath)) {
        const fileContent = readFileSync(configPath, 'utf-8');
        const fileConfig = JSON.parse(fileContent) as Partial<RulesConfiguration>;

        // Merge with defaults
        config = this.mergeConfigs(config, fileConfig);

        if (this.debug) {
          log.debug('Loaded configuration', { configPath });
        }
      }
    } catch {
      if (this.debug) {
        log.warn('Failed to load config, using defaults', { configPath });
      }
    }

    // Apply overrides
    if (engineConfig.overrides) {
      config = this.mergeConfigs(config, engineConfig.overrides);
    }

    return config;
  }

  /**
   * Merge configurations
   */
  private mergeConfigs(
    base: RulesConfiguration,
    override: Partial<RulesConfiguration>,
  ): RulesConfiguration {
    return {
      version: override.version || base.version,
      description: override.description || base.description,
      documentTypes: {
        ...base.documentTypes,
        ...override.documentTypes,
      },
      globalSettings: {
        ...base.globalSettings,
        ...override.globalSettings,
      },
      ruleDefinitions: {
        ...base.ruleDefinitions,
        ...override.ruleDefinitions,
      },
    };
  }

  /**
   * Apply document type-specific rules
   */
  applyRules(
    text: string,
    classification: DocumentClassification,
    existingEntities: Entity[] = [],
  ): Entity[] {
    const docType = classification.type;
    const typeConfig = this.config.documentTypes[docType];

    if (!typeConfig || !typeConfig.enabled) {
      return existingEntities;
    }

    let entities = [...existingEntities];

    // Apply type-specific rules
    switch (docType) {
      case 'INVOICE':
        entities = this.invoiceRules.applyRules(text, entities);
        break;

      case 'LETTER':
        entities = this.letterRules.applyRules(
          text,
          entities,
          classification.language || 'en',
        );
        break;

      case 'FORM':
        // Form rules could be added here
        break;

      case 'CONTRACT':
        // Contract rules could be added here
        break;

      case 'REPORT':
        // Report rules could be added here
        break;

      case 'UNKNOWN':
        // No type-specific rules for unknown
        break;
    }

    // Apply thresholds
    entities = this.applyThresholds(entities, typeConfig.thresholds);

    // Apply confidence boosts based on type config
    entities = this.applyTypeConfidenceBoosts(entities, typeConfig, text);

    return entities;
  }

  /**
   * Apply thresholds to entities
   */
  private applyThresholds(
    entities: Entity[],
    thresholds: DocumentTypeRuleConfig['thresholds'],
  ): Entity[] {
    return entities.map(entity => {
      // Filter out low-confidence entities
      if (entity.confidence < thresholds.minConfidence) {
        // Mark for filtering
        return { ...entity, flaggedForReview: true, metadata: { ...entity.metadata, lowConfidence: true } };
      }

      // Flag for review
      if (entity.confidence < thresholds.flagForReview) {
        return { ...entity, flaggedForReview: true };
      }

      // Mark for auto-anonymization
      if (entity.confidence >= thresholds.autoAnonymize) {
        return {
          ...entity,
          metadata: { ...entity.metadata, autoAnonymize: true },
        };
      }

      return entity;
    }).filter(entity => !entity.metadata?.lowConfidence);
  }

  /**
   * Apply type-specific confidence boosts
   */
  private applyTypeConfidenceBoosts(
    entities: Entity[],
    typeConfig: DocumentTypeRuleConfig,
    text: string,
  ): Entity[] {
    const textLength = text.length;
    const headerEnd = Math.floor(textLength * 0.2);
    const footerStart = Math.floor(textLength * 0.8);

    return entities.map(entity => {
      let boost = 0;

      // Header boost
      if (typeConfig.confidenceBoosts.header && entity.start < headerEnd) {
        boost += typeConfig.confidenceBoosts.header;
      }

      // Footer/signature boost
      if (typeConfig.confidenceBoosts.signatureArea && entity.start > footerStart) {
        boost += typeConfig.confidenceBoosts.signatureArea;
      }

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
   * Get configuration for a document type
   */
  getTypeConfig(docType: DocumentType): DocumentTypeRuleConfig {
    return this.config.documentTypes[docType] || this.config.documentTypes.UNKNOWN;
  }

  /**
   * Get global settings
   */
  getGlobalSettings(): GlobalRuleSettings {
    return this.config.globalSettings;
  }

  /**
   * Get enabled rules for a document type
   */
  getEnabledRules(docType: DocumentType): string[] {
    const typeConfig = this.config.documentTypes[docType];
    return typeConfig?.enabled ? typeConfig.rules : [];
  }

  /**
   * Check if document type detection is enabled
   */
  isDocumentTypeDetectionEnabled(): boolean {
    return this.config.globalSettings.enableDocumentTypeDetection;
  }

  /**
   * Get entity type mapping for a document type
   */
  getEntityTypeMapping(docType: DocumentType): Record<string, string> {
    return this.config.documentTypes[docType]?.entityTypeMapping || {};
  }

  /**
   * Validate configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check version
    if (!this.config.version) {
      errors.push('Missing version field');
    }

    // Check document types
    const requiredTypes: DocumentType[] = ['INVOICE', 'LETTER', 'FORM', 'CONTRACT', 'REPORT', 'UNKNOWN'];
    for (const type of requiredTypes) {
      if (!this.config.documentTypes[type]) {
        errors.push(`Missing document type configuration: ${type}`);
      }
    }

    // Check thresholds
    for (const [type, config] of Object.entries(this.config.documentTypes)) {
      if (config.thresholds) {
        if (config.thresholds.autoAnonymize < config.thresholds.flagForReview) {
          errors.push(`${type}: autoAnonymize threshold should be >= flagForReview`);
        }
        if (config.thresholds.flagForReview < config.thresholds.minConfidence) {
          errors.push(`${type}: flagForReview threshold should be >= minConfidence`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Factory function for creating RuleEngine
 */
export function createRuleEngine(config?: RuleEngineConfig): RuleEngine {
  return new RuleEngine(config);
}
