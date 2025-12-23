/**
 * Shared Test Utilities
 *
 * Export all shared test constants and helpers for use in both
 * Electron and browser-app integration tests.
 */

export {
  // Constants
  DOCUMENT_TYPES,
  INVOICE_PII_TYPES,
  ADDRESS_ENTITY_TYPES,
  FILE_PATTERNS,
  MIME_TYPES,
  PERFORMANCE_THRESHOLDS,
  REQUIRED_ENTITY_PROPERTIES,
  REQUIRED_PIPELINE_RESULT_PROPERTIES,

  // Types
  type DocumentType,
  type MockProcessingResult,
  type EntityReviewEntity,
  type EntityReviewState,

  // Factory functions
  createMockProcessingResult,
  createMockEntityReviewState,
} from './constants';

export {
  // Helper functions
  getMimeType,
  getReviewResult,
  applySelectiveAnonymization,
  generateMarkdownOutput,
  generateMappingOutput,
  groupByType,
  calculateConfidenceStats,
  findOverlappingEntities,
  validateEntityStructure,
  validatePipelineResultStructure,
  formatTestOutput,
} from './helpers';

export {
  // Expected results for test documents
  EXPECTED_PII_BY_DOCUMENT_TYPE,
  TEST_DOCUMENTS,
  SAMPLE_ENTITIES_FOR_VERIFICATION,
  type TestDocumentName,
  getExpectedResults,
  getSampleEntitiesForVerification,
  verifyRequiredEntities,
  categorizeDocument,
  getMinEntityCount,
  getExpectedEntityTypes,
  getExpectedDocumentType,
  validateDetectionResults,
  checkCrossPlatformConsistency,
  type ValidationResult,
  type ConsistencyResult,
} from './expectedResults';
