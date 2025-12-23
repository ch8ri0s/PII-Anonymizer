/**
 * Shared Test Constants
 *
 * Common test data and expected values used across both
 * Electron and browser-app integration tests.
 */

/**
 * Expected document types from classification
 */
export const DOCUMENT_TYPES = [
  'INVOICE',
  'LETTER',
  'FORM',
  'CONTRACT',
  'REPORT',
  'UNKNOWN',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/**
 * PII types commonly found in invoices
 */
export const INVOICE_PII_TYPES = [
  'AMOUNT',
  'DATE',
  'IBAN',
  'VAT_NUMBER',
  'INVOICE_NUMBER',
  'PHONE',
  'EMAIL',
] as const;

/**
 * Address-related entity types
 */
export const ADDRESS_ENTITY_TYPES = [
  'ADDRESS',
  'SWISS_ADDRESS',
  'EU_ADDRESS',
  'LOCATION',
] as const;

/**
 * Mock processing result for download pipeline tests
 */
export interface MockProcessingResult {
  sanitizedMarkdown: string;
  originalMarkdown: string;
  entities: Record<string, string>;
  piiCount: number;
  metadata: {
    type: string;
    name: string;
  };
}

/**
 * Standard mock processing result
 */
export function createMockProcessingResult(): MockProcessingResult {
  return {
    sanitizedMarkdown: 'Contact PER_1 at EMAIL_1. Regards, ORG_1',
    originalMarkdown: 'Contact John Doe at john@example.com. Regards, Acme Corp',
    entities: {
      'John Doe': 'PER_1',
      'john@example.com': 'EMAIL_1',
      'Acme Corp': 'ORG_1',
    },
    piiCount: 3,
    metadata: {
      type: 'docx',
      name: 'test-document.docx',
    },
  };
}

/**
 * Entity review state structure
 */
export interface EntityReviewEntity {
  id: string;
  originalText: string;
  replacement: string;
  type: string;
  confidence: number;
  source: string;
  status: 'approved' | 'rejected' | 'edited' | 'pending';
  flaggedForReview: boolean;
  position: { start: number; end: number } | null;
  context: string | null;
  editedReplacement: string | null;
}

export interface EntityReviewState {
  entities: EntityReviewEntity[];
  filters: {
    types: string[];
    minConfidence: number;
    showFlaggedOnly: boolean;
    statusFilter: string;
    searchText: string;
  };
  groupExpanded: Record<string, boolean>;
}

/**
 * Create mock entity review state from processing result
 */
export function createMockEntityReviewState(_processingResult?: MockProcessingResult): EntityReviewState {
  return {
    entities: [
      {
        id: 'entity-0',
        originalText: 'John Doe',
        replacement: 'PER_1',
        type: 'PERSON',
        confidence: 0.95,
        source: 'ML',
        status: 'approved',
        flaggedForReview: false,
        position: { start: 8, end: 16 },
        context: 'Contact John Doe at...',
        editedReplacement: null,
      },
      {
        id: 'entity-1',
        originalText: 'john@example.com',
        replacement: 'EMAIL_1',
        type: 'EMAIL',
        confidence: 0.99,
        source: 'RULE',
        status: 'approved',
        flaggedForReview: false,
        position: { start: 20, end: 36 },
        context: '...at john@example.com. Regards...',
        editedReplacement: null,
      },
      {
        id: 'entity-2',
        originalText: 'Acme Corp',
        replacement: 'ORG_1',
        type: 'ORGANIZATION',
        confidence: 0.85,
        source: 'ML',
        status: 'approved',
        flaggedForReview: false,
        position: { start: 47, end: 56 },
        context: 'Regards, Acme Corp',
        editedReplacement: null,
      },
    ],
    filters: {
      types: [],
      minConfidence: 0,
      showFlaggedOnly: false,
      statusFilter: 'all',
      searchText: '',
    },
    groupExpanded: {},
  };
}

/**
 * Test file categories based on filename patterns
 */
export const FILE_PATTERNS = {
  invoice: (filename: string) => filename.includes('invoice') && filename.endsWith('.pdf'),
  contract: (filename: string) => filename.includes('contract'),
  letter: (filename: string) => filename.includes('letter'),
  addressContaining: (filename: string) =>
    (filename.includes('invoice') || filename.includes('letter') || filename.includes('contract')) &&
    filename.endsWith('.pdf'),
  pdf: (filename: string) => filename.endsWith('.pdf'),
  docx: (filename: string) => filename.endsWith('.docx'),
  excel: (filename: string) => filename.endsWith('.xlsx') || filename.endsWith('.xls'),
  csv: (filename: string) => filename.endsWith('.csv'),
  text: (filename: string) => filename.endsWith('.txt'),
} as const;

/**
 * MIME types for file creation in browser tests
 */
export const MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
};

/**
 * Performance thresholds
 */
export const PERFORMANCE_THRESHOLDS = {
  maxProcessingTimeMs: 10000, // 10 seconds max for any document
  maxSmallFileConversionMs: 1000, // 1 second for small files
} as const;

/**
 * Entity structure validation
 */
export const REQUIRED_ENTITY_PROPERTIES = [
  'id',
  'type',
  'text',
  'start',
  'end',
  'confidence',
  'source',
] as const;

/**
 * Pipeline result structure validation
 */
export const REQUIRED_PIPELINE_RESULT_PROPERTIES = {
  root: ['entities', 'documentType', 'metadata'],
  metadata: ['totalDurationMs', 'passResults'],
} as const;
