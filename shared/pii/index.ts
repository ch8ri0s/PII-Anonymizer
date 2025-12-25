/**
 * Shared PII Detection Module
 *
 * Re-exports all shared PII detection utilities.
 *
 * @module shared/pii
 */

export {
  type EntityType,
  type PatternDef,
  ML_ENTITY_MAPPING,
  mapMLEntityType,
  buildHighRecallPatterns,
  DEFAULT_ML_THRESHOLD,
  DEFAULT_RULE_CONFIDENCE,
  MIN_MATCH_LENGTH,
} from './HighRecallPatterns.js';

export {
  type PostalCodesData,
  type SwissPostalCode,
  type PostalLookupResult,
  type PostalDatabaseStats,
  cleanPostalCode,
  normalizeCity,
  isValidSwissPostalCodeFormat,
  SWISS_CANTONS,
} from './SwissPostalData.js';

export {
  type DocumentType,
  type ConfidenceThresholds,
  type BaseDocumentTypeConfig,
  type BaseGlobalSettings,
  DOCUMENT_TYPES,
  DEFAULT_CONFIDENCE_THRESHOLDS,
  DEFAULT_GLOBAL_SETTINGS,
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPE_ICONS,
  DEFAULT_TYPE_CONFIDENCE_BOOSTS,
  DEFAULT_BOOSTED_TYPES,
  isValidDocumentType,
  getConfidenceBoost,
} from './RuleEngineConfig.js';

export {
  type PatternEntry,
  type DenyListConfigFile,
  type DenyListConfig,
  DenyList,
  parseDenyListConfigFile,
} from './context/DenyList.js';

export {
  type ContextWord,
  type ContextWordsMetadata,
  type ContextWordsConfig,
  CONTEXT_WORDS,
  CONTEXT_WORDS_METADATA,
  getContextWords,
  getContextWordStrings,
  getAllContextWords,
  getPositiveContextWords,
  getNegativeContextWords,
  getMetadata,
  getSupportedEntityTypes,
  getSupportedLanguages,
} from './context/ContextWords.js';

export {
  type ContextEnhancerConfig,
  type PositionedEntity,
  type EnhancementResult,
  ContextEnhancer,
  createContextEnhancer,
  DEFAULT_CONTEXT_ENHANCER_CONFIG,
} from './context/ContextEnhancer.js';
