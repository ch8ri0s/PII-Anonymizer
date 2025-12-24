/**
 * Detection Pipeline Type Definitions
 *
 * Core types for the multi-pass PII detection architecture (Epic 1).
 * These types define the entity model, detection passes, and pipeline context.
 */

/**
 * Source of entity detection
 */
export type EntitySource = 'ML' | 'RULE' | 'BOTH' | 'MANUAL';

/**
 * Entity types supported by the detection system
 */
export type EntityType =
  | 'PERSON'
  | 'PERSON_NAME'
  | 'ORGANIZATION'
  | 'LOCATION'
  | 'ADDRESS'
  | 'SWISS_ADDRESS'
  | 'EU_ADDRESS'
  | 'SWISS_AVS'
  | 'IBAN'
  | 'PHONE'
  | 'EMAIL'
  | 'DATE'
  | 'AMOUNT'
  | 'VAT_NUMBER'
  | 'INVOICE_NUMBER'
  | 'PAYMENT_REF'
  | 'QR_REFERENCE'
  // Letter-specific entity types (Epic 3)
  | 'SENDER'
  | 'RECIPIENT'
  | 'SALUTATION_NAME'
  | 'SIGNATURE'
  | 'LETTER_DATE'
  | 'REFERENCE_LINE'
  // Contract-specific entity types (Epic 3)
  | 'PARTY'
  | 'AUTHOR'
  | 'VENDOR_NAME'
  | 'UNKNOWN';

/**
 * Validation status from Pass 2
 */
export type ValidationStatus = 'valid' | 'invalid' | 'unchecked';

/**
 * Address component types for relationship modeling (Epic 2)
 */
export type AddressComponentType =
  | 'STREET_NAME'
  | 'STREET_NUMBER'
  | 'POSTAL_CODE'
  | 'CITY'
  | 'COUNTRY'
  | 'REGION';

/**
 * Address component for grouped addresses
 */
export interface AddressComponent {
  type: AddressComponentType;
  text: string;
  start: number;
  end: number;
  /** Flag indicating this component has been linked to a group (Story 2.2) */
  linked?: boolean;
  /** Reference to the group this component belongs to */
  linkedToGroupId?: string;
}

/**
 * Address pattern types for pattern matching (Story 2.2)
 */
export type AddressPatternType = 'SWISS' | 'EU' | 'ALTERNATIVE' | 'PARTIAL' | 'NONE';

/**
 * Grouped address entity with linked components (Story 2.2)
 */
export interface GroupedAddress {
  /** Unique identifier for this grouped address */
  id: string;
  /** Entity type - always 'ADDRESS' for grouped addresses */
  type: 'ADDRESS';
  /** Full address text span from first to last component */
  text: string;
  /** Start position of first component */
  start: number;
  /** End position of last component */
  end: number;
  /** Confidence score (calculated in Story 2.3) */
  confidence: number;
  /** Source indicator for linked addresses */
  source: 'LINKED';
  /** Individual components that make up this address */
  components: {
    street?: string;
    number?: string;
    postal?: string;
    city?: string;
    country?: string;
  };
  /** Original component entities */
  componentEntities: AddressComponent[];
  /** Pattern that was matched */
  patternMatched: AddressPatternType;
  /** Validation status based on component validation */
  validationStatus: 'valid' | 'partial' | 'uncertain';
}

/**
 * Result from proximity-based grouping (Story 2.2)
 */
export interface LinkedAddressGroup {
  /** Components in this group */
  components: AddressComponent[];
  /** Detected pattern type */
  pattern: AddressPatternType;
  /** Start position of the group */
  start: number;
  /** End position of the group */
  end: number;
  /** Whether this group forms a valid address */
  isValid: boolean;
}

/**
 * Core entity detected in a document
 */
export interface Entity {
  /** Unique identifier for this entity instance */
  id: string;

  /** Entity type classification */
  type: EntityType;

  /** Original text matched */
  text: string;

  /** Start position in document (character offset) */
  start: number;

  /** End position in document (character offset) */
  end: number;

  /** Confidence score (0-1) */
  confidence: number;

  /** Detection source */
  source: EntitySource;

  /** Validation status from Pass 2 */
  validation?: {
    status: ValidationStatus;
    reason?: string;
    checkedBy?: string;
  };

  /** Context scoring from Pass 3 */
  context?: {
    score: number;
    factors: ContextFactor[];
  };

  /** For ADDRESS type: linked components */
  components?: AddressComponent[];

  /** Flag for entities needing user review */
  flaggedForReview?: boolean;

  /** User selection state for partial anonymization */
  selected?: boolean;

  /** Metadata from detection pass */
  metadata?: Record<string, unknown>;
}

/**
 * Context factors that influence confidence scoring (Pass 3)
 */
export interface ContextFactor {
  name: string;
  weight: number;
  matched: boolean;
  description?: string;
}

/**
 * Interface for detection passes in the pipeline
 */
export interface DetectionPass {
  /** Pass name for logging and debugging */
  name: string;

  /** Pass execution order (lower = earlier) */
  order: number;

  /** Whether this pass is enabled */
  enabled: boolean;

  /**
   * Execute the detection pass
   * @param text - Document text to process
   * @param entities - Entities from previous passes
   * @param context - Pipeline context with metadata
   * @returns Updated entity list
   */
  execute(
    text: string,
    entities: Entity[],
    context: PipelineContext
  ): Promise<Entity[]>;
}

/**
 * Pipeline context passed between detection passes
 */
export interface PipelineContext {
  /** Document ID being processed */
  documentId: string;

  /** Detected document type (from Epic 3) */
  documentType?: DocumentType;

  /** Processing language */
  language?: 'en' | 'fr' | 'de';

  /** Results from each pass for debugging */
  passResults: Map<string, PassResult>;

  /** Processing start time */
  startTime: number;

  /** Configuration overrides */
  config?: PipelineConfig;

  /** Extensible metadata for passes to share data */
  metadata?: Record<string, unknown>;
}

/**
 * Result from a single detection pass
 */
export interface PassResult {
  passName: string;
  entitiesAdded: number;
  entitiesModified: number;
  entitiesRemoved: number;
  durationMs: number;
  metadata?: Record<string, unknown>;
}

/**
 * Document types for type-specific rules (Epic 3)
 */
export type DocumentType =
  | 'INVOICE'
  | 'LETTER'
  | 'FORM'
  | 'CONTRACT'
  | 'REPORT'
  | 'UNKNOWN';

/**
 * Pipeline configuration options
 */
export interface PipelineConfig {
  /** ML model confidence threshold (default: 0.3 for high-recall) */
  mlConfidenceThreshold?: number;

  /** Context window size in characters (default: 50) */
  contextWindowSize?: number;

  /** Minimum confidence for auto-anonymization (default: 0.6) */
  autoAnonymizeThreshold?: number;

  /** Enable/disable specific passes */
  enabledPasses?: {
    highRecall?: boolean;
    formatValidation?: boolean;
    contextScoring?: boolean;
    addressRelationship?: boolean;
    documentType?: boolean;
  };

  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Final result from the detection pipeline
 */
export interface DetectionResult {
  /** All detected entities after pipeline processing */
  entities: Entity[];

  /** Document type classification */
  documentType: DocumentType;

  /** Processing metadata */
  metadata: {
    totalDurationMs: number;
    passResults: PassResult[];
    entityCounts: Record<EntityType, number>;
    flaggedCount: number;
  };
}

/**
 * Validation rule for entity format validation (Pass 2)
 */
export interface ValidationRule {
  /** Entity type this rule applies to */
  entityType: EntityType;

  /** Rule name for logging */
  name: string;

  /**
   * Validate an entity
   * @param entity - Entity to validate
   * @returns Validation result
   */
  validate(entity: Entity): ValidationResult;
}

/**
 * Result from entity validation
 */
export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  reason?: string;
}

/**
 * Context scoring rule (Pass 3)
 */
export interface ContextRule {
  /** Entity type this rule applies to */
  entityType: EntityType;

  /** Rule name */
  name: string;

  /** Weight for this rule (0-1) */
  weight: number;

  /**
   * Score entity based on context
   * @param entity - Entity to score
   * @param text - Full document text
   * @param entities - All entities for proximity checks
   * @returns Context factor result
   */
  score(entity: Entity, text: string, entities: Entity[]): ContextFactor;
}

/**
 * Mapping file entry for anonymized entities (v2.0 format)
 */
export interface MappingEntry {
  /** Placeholder used in output (e.g., "[PERSON_1]") */
  placeholder: string;

  /** Original text */
  original: string;

  /** Entity type */
  type: EntityType;

  /** Detection confidence */
  confidence: number;

  /** Detection source */
  source: EntitySource;

  /** For addresses: component breakdown */
  components?: Record<string, string>;
}

/**
 * Complete mapping file structure
 */
export interface MappingFile {
  version: '2.0';
  documentId: string;
  processedAt: string;
  documentType: DocumentType;
  language: string;
  entities: MappingEntry[];
}
