/**
 * Browser PII Detection Module (Story 7.3)
 *
 * Exports browser-compatible PII detection components.
 * Uses Vite aliases to import shared components from main src/.
 */

// Browser-specific components (no Node.js dependencies)
export {
  BrowserSwissPostalDatabase,
  getBrowserSwissPostalDatabase,
  createBrowserSwissPostalDatabase,
  type SwissPostalCode,
  type PostalLookupResult,
} from './BrowserSwissPostalDatabase';

export {
  BrowserRuleEngine,
  createBrowserRuleEngine,
  type BrowserRuleEngineConfig,
  type DocumentTypeRuleConfig,
  type GlobalRuleSettings,
  type RulesConfiguration,
  type RuleDefinition,
} from './BrowserRuleEngine';

export {
  BrowserHighRecallPass,
  createBrowserHighRecallPass,
} from './BrowserHighRecallPass';

// Re-export shared components from @pii that are browser-compatible
export { DetectionPipeline, createPipeline, generateEntityId, createContext } from '@pii/DetectionPipeline';
export { FormatValidationPass, createFormatValidationPass } from '@pii/passes/FormatValidationPass';
export { ContextScoringPass, createContextScoringPass } from '@pii/passes/ContextScoringPass';
export { AddressRelationshipPass, createAddressRelationshipPass } from '@pii/passes/AddressRelationshipPass';
export { DocumentTypePass, createDocumentTypePass } from '@pii/passes/DocumentTypePass';
export { ConsolidationPass, createConsolidationPass } from '@pii/passes/ConsolidationPass';
export { DocumentClassifier, createDocumentClassifier } from '@pii/DocumentClassifier';
export { AddressClassifier, createAddressClassifier } from '@pii/AddressClassifier';
export { AddressLinker, createAddressLinker } from '@pii/AddressLinker';
export { AddressScorer, createAddressScorer } from '@pii/AddressScorer';
export { getAllValidators, getValidatorForType } from '@pii/validators';

// Re-export types from local types directory
export type {
  Entity,
  EntityType,
  EntitySource,
  DetectionPass,
  PipelineContext,
  PassResult,
  DetectionResult,
  PipelineConfig,
  DocumentType,
  ValidationRule,
  ValidationResult,
  ContextRule,
  ContextFactor,
  ValidationStatus,
  AddressComponent,
  AddressComponentType,
  AddressPatternType,
  GroupedAddress,
  LinkedAddressGroup,
  MappingEntry,
  MappingFile,
} from '../types/detection.js';
