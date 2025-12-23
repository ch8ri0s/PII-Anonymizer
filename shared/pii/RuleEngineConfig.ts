/**
 * Rule Engine Configuration Types (Shared)
 *
 * Common types for document type detection and rule configuration.
 * Used by both Electron and browser-app RuleEngine implementations.
 *
 * @module shared/pii/RuleEngineConfig
 */

/**
 * Supported document types for rule-based detection
 */
export type DocumentType =
  | 'INVOICE'
  | 'LETTER'
  | 'FORM'
  | 'CONTRACT'
  | 'REPORT'
  | 'MEDICAL'
  | 'LEGAL'
  | 'CORRESPONDENCE'
  | 'UNKNOWN';

/**
 * All document types as a readonly array (for iteration)
 */
export const DOCUMENT_TYPES: readonly DocumentType[] = [
  'INVOICE',
  'LETTER',
  'FORM',
  'CONTRACT',
  'REPORT',
  'MEDICAL',
  'LEGAL',
  'CORRESPONDENCE',
  'UNKNOWN',
] as const;

/**
 * Confidence threshold configuration
 */
export interface ConfidenceThresholds {
  /** Threshold for automatic anonymization (high confidence) */
  autoAnonymize: number;
  /** Threshold for flagging entities for review */
  flagForReview: number;
  /** Minimum confidence to include entity */
  minConfidence: number;
}

/**
 * Default confidence thresholds
 */
export const DEFAULT_CONFIDENCE_THRESHOLDS: ConfidenceThresholds = {
  autoAnonymize: 0.85,
  flagForReview: 0.6,
  minConfidence: 0.4,
};

/**
 * Base rule configuration for a document type
 */
export interface BaseDocumentTypeConfig {
  /** Whether rules for this type are enabled */
  enabled: boolean;
  /** Entity types with boosted confidence for this document type */
  boostedTypes: string[];
  /** Confidence boost amounts per entity type */
  confidenceBoosts: Record<string, number>;
}

/**
 * Global rule engine settings (shared)
 */
export interface BaseGlobalSettings {
  /** Enable document type detection */
  enableDocumentTypeDetection: boolean;
  /** Fall back to UNKNOWN type if classification fails */
  fallbackToUnknown: boolean;
  /** Minimum confidence for classification */
  minClassificationConfidence: number;
}

/**
 * Default global settings
 */
export const DEFAULT_GLOBAL_SETTINGS: BaseGlobalSettings = {
  enableDocumentTypeDetection: true,
  fallbackToUnknown: true,
  minClassificationConfidence: 0.4,
};

/**
 * Document type descriptions (for UI display)
 */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  INVOICE: 'Invoice',
  LETTER: 'Letter',
  FORM: 'Form',
  CONTRACT: 'Contract',
  REPORT: 'Report',
  MEDICAL: 'Medical Document',
  LEGAL: 'Legal Document',
  CORRESPONDENCE: 'Correspondence',
  UNKNOWN: 'Unknown',
};

/**
 * Document type icons (emoji for simple UI)
 */
export const DOCUMENT_TYPE_ICONS: Record<DocumentType, string> = {
  INVOICE: '💰',
  LETTER: '✉️',
  FORM: '📝',
  CONTRACT: '📄',
  REPORT: '📊',
  MEDICAL: '🏥',
  LEGAL: '⚖️',
  CORRESPONDENCE: '💬',
  UNKNOWN: '❓',
};

/**
 * Default confidence boosts by document type
 * These are applied when the document type is detected
 */
export const DEFAULT_TYPE_CONFIDENCE_BOOSTS: Record<DocumentType, Record<string, number>> = {
  INVOICE: {
    AMOUNT: 0.15,
    IBAN: 0.2,
    VAT_NUMBER: 0.15,
    PAYMENT_REF: 0.15,
  },
  LETTER: {
    PERSON: 0.1,
    ADDRESS: 0.1,
    DATE: 0.05,
  },
  FORM: {
    PERSON: 0.1,
    DATE: 0.1,
  },
  CONTRACT: {
    PERSON: 0.15,
    ORGANIZATION: 0.15,
    DATE: 0.1,
    ADDRESS: 0.1,
  },
  REPORT: {
    PERSON: 0.1,
    ORGANIZATION: 0.1,
    DATE: 0.05,
  },
  MEDICAL: {
    SWISS_AVS: 0.25,
    PERSON: 0.15,
    DATE: 0.1,
  },
  LEGAL: {
    PERSON: 0.15,
    ORGANIZATION: 0.15,
    ADDRESS: 0.1,
  },
  CORRESPONDENCE: {
    EMAIL: 0.1,
    PHONE: 0.1,
    PERSON: 0.1,
  },
  UNKNOWN: {},
};

/**
 * Default entity types that are boosted per document type
 */
export const DEFAULT_BOOSTED_TYPES: Record<DocumentType, string[]> = {
  INVOICE: ['IBAN', 'VAT_NUMBER', 'PAYMENT_REF', 'AMOUNT'],
  LETTER: ['PERSON', 'ADDRESS', 'DATE'],
  FORM: ['PERSON', 'DATE', 'ADDRESS'],
  CONTRACT: ['PERSON', 'ORGANIZATION', 'ADDRESS', 'DATE'],
  REPORT: ['PERSON', 'ORGANIZATION', 'DATE'],
  MEDICAL: ['SWISS_AVS', 'DATE', 'PERSON'],
  LEGAL: ['PERSON', 'ORGANIZATION', 'DATE', 'ADDRESS'],
  CORRESPONDENCE: ['EMAIL', 'PHONE', 'ADDRESS', 'PERSON'],
  UNKNOWN: [],
};

/**
 * Check if a document type is valid
 */
export function isValidDocumentType(type: string): type is DocumentType {
  return DOCUMENT_TYPES.includes(type as DocumentType);
}

/**
 * Get confidence boost for entity type based on document type
 */
export function getConfidenceBoost(docType: DocumentType, entityType: string): number {
  return DEFAULT_TYPE_CONFIDENCE_BOOSTS[docType]?.[entityType] ?? 0;
}
