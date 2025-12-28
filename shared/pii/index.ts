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

// Recognizer architecture (Story 8.5)
export {
  // Types
  type PatternDefinition,
  type RecognizerConfig,
  type RecognizerMatch,
  type RecognizerSpecificity,
  type RegistryGlobalConfig,
  type Recognizer,
  type RecognizerFilter,
  type RegistryAnalysisResult,
  DEFAULT_RECOGNIZER_CONFIG,
  DEFAULT_REGISTRY_CONFIG,
  // Base class
  BaseRecognizer,
  // Registry
  RecognizerRegistry,
  // YAML Loader
  type YamlRecognizerConfig,
  type YamlRecognizerDef,
  type YamlPatternDef,
  GenericRecognizer,
  parseYamlConfig,
  yamlDefToConfig,
  createRecognizersFromConfig,
  loadRecognizersFromYaml,
  validateYamlConfig,
} from './recognizers/index.js';

// Country-specific recognizers
export { AvsRecognizer } from './countries/ch/index.js';

// Preprocessing (Story 8.7)
export {
  type NormalizationResult,
  type TextNormalizerOptions,
  TextNormalizer,
  createTextNormalizer,
  defaultNormalizer,
  type Lemmatizer,
  type LemmatizerLanguage,
  SimpleLemmatizer,
  createLemmatizer,
  defaultLemmatizer,
  SUPPORTED_LEMMATIZER_LANGUAGES,
} from './preprocessing/index.js';

// Postprocessing (Story 8.8)
export {
  type ConsolidationEntityType,
  type ConsolidationEntity,
  type OverlapStrategy,
  type LinkingStrategy,
  type ConsolidationPassConfig,
  type ConsolidationResult,
  ConsolidationPass,
  createConsolidationPass,
  DEFAULT_ENTITY_PRIORITY,
  DEFAULT_CONFIG as DEFAULT_CONSOLIDATION_CONFIG,
} from './postprocessing/ConsolidationPass.js';

// Feedback Learning Loop (Story 8.9)
export {
  type FeedbackAction,
  type FeedbackSource,
  type EntityPosition,
  type FeedbackEntity,
  type FeedbackEvent,
  type AggregatedPattern,
  type FeedbackSummary,
  type RetentionSettings,
  type ExportMode,
  type ExportOptions,
  type AggregationResult,
  DEFAULT_RETENTION_SETTINGS,
  MAX_CONTEXT_LENGTH,
  LEGACY_ACTION_MAP,
  toFeedbackAction,
} from './feedback/types.js';

export {
  type AggregationOptions,
  FeedbackAggregator,
  createAggregator,
} from './feedback/FeedbackAggregator.js';

// Validators (Shared validation rules for PII entities)
export {
  // Types
  type ValidatorEntityType,
  type ValidatorEntity,
  type ValidationResult as ValidatorValidationResult,
  type ValidationRule as ValidatorValidationRule,
  type AddressValidationResult,
  // Swiss Address Validator
  SwissAddressValidator,
  validateSwissAddress,
  validateSwissAddressFull,
  // Swiss AVS Validator
  SwissAvsValidator,
  validateSwissAvs,
  validateSwissAvsFull,
  // IBAN Validator
  IbanValidator,
  validateIban,
  validateIbanFull,
  // Email Validator
  EmailValidator,
  validateEmail,
  validateEmailFull,
  // Phone Validator
  PhoneValidator,
  validatePhone,
  validatePhoneFull,
  // Date Validator
  DateValidator,
  validateDate,
  validateDateFull,
  // Swiss Postal Code Validator
  SwissPostalCodeValidator,
  validateSwissPostalCode,
  validateSwissPostalCodeFull,
  // VAT Number Validator
  VatNumberValidator,
  validateVatNumber,
  validateVatNumberFull,
  // Helper functions
  getAllValidators,
  getValidatorForType,
} from './validators/index.js';

// ML Detection Utilities (Story 8.10, 8.11, 8.12, 8.13, 8.14)
export {
  // Story 8.10: Subword Token Merging
  type MLToken,
  type MLTokenAlt,
  type MergedEntity,
  type MergeConfig,
  mergeSubwordTokens,
  mergeTokens,
  extractEntityType,
  isInsideToken,
  isBeginningToken,
  normalizeToken,
  SubwordTokenMerger,
  createSubwordTokenMerger,
  DEFAULT_MERGE_CONFIG,
  // Story 8.11: Document Chunking
  type ChunkConfig,
  type TextChunk,
  type ChunkPrediction,
  chunkText,
  mergeChunkPredictions,
  needsChunking,
  estimateTokenCount,
  splitIntoSentences,
  TextChunker,
  createTextChunker,
  DEFAULT_CHUNK_CONFIG,
  // Story 8.12: ML Input Validation
  type ValidationConfig,
  type ValidationResult,
  validateMLInput,
  isValidMLInput,
  getValidationError,
  MLInputValidator,
  createMLInputValidator,
  DEFAULT_VALIDATION_CONFIG,
  // Story 8.13: ML Error Recovery with Retry Logic
  type RetryConfig,
  type RetryResult,
  withRetry,
  isRetryableError,
  calculateDelay,
  MLRetryHandler,
  createMLRetryHandler,
  DEFAULT_RETRY_CONFIG,
  // Story 8.14: ML Performance Monitoring
  type MLInferenceMetrics,
  type AggregatedMetrics,
  type MetricsConfig,
  recordMLMetrics,
  getAggregatedMetrics,
  exportMetrics,
  clearMetrics,
  getMetricsCount,
  aggregateMetrics,
  createInferenceMetrics,
  getGlobalCollector,
  MLMetricsCollector,
  createMLMetricsCollector,
  DEFAULT_METRICS_CONFIG,
} from './ml/index.js';
