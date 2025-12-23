/**
 * Expected PII Detection Results for Test Documents
 *
 * These are the expected PII entities and document classifications
 * for the test documents in test/.files/
 *
 * Used by both Electron and browser-app integration tests to ensure
 * consistent detection across platforms.
 */

/**
 * Expected PII types by document category
 */
export const EXPECTED_PII_BY_DOCUMENT_TYPE = {
  invoice: {
    expectedTypes: ['AMOUNT', 'DATE', 'IBAN', 'VAT_NUMBER', 'PHONE', 'EMAIL', 'ADDRESS', 'ORGANIZATION'],
    requiredTypes: ['DATE'], // At least one of these must be present
    documentType: 'INVOICE',
    minEntities: 3,
  },
  contract: {
    expectedTypes: ['PERSON', 'ORGANIZATION', 'DATE', 'ADDRESS', 'SIGNATURE'],
    requiredTypes: ['DATE', 'ORGANIZATION'],
    documentType: 'CONTRACT',
    minEntities: 2,
  },
  letter: {
    expectedTypes: ['PERSON', 'ADDRESS', 'DATE', 'ORGANIZATION', 'PHONE', 'EMAIL'],
    requiredTypes: ['DATE'],
    documentType: 'LETTER',
    minEntities: 2,
  },
  hr_report: {
    expectedTypes: ['PERSON', 'SWISS_AVS', 'DATE', 'SALARY', 'ADDRESS'],
    requiredTypes: ['PERSON'],
    documentType: 'REPORT',
    minEntities: 3,
  },
  insurance: {
    expectedTypes: ['PERSON', 'DATE', 'AMOUNT', 'POLICY_NUMBER', 'ADDRESS'],
    requiredTypes: ['DATE'],
    documentType: 'FORM',
    minEntities: 2,
  },
} as const;

/**
 * Test document inventory with expected characteristics
 * Based on actual PII detection results from running the pipeline
 */
export const TEST_DOCUMENTS = {
  'test-invoice-1.pdf': {
    category: 'invoice',
    language: 'fr',
    expectedDocumentType: 'INVOICE',
    expectedEntityTypes: ['DATE', 'ORG', 'ADDRESS', 'PHONE', 'IBAN', 'PERSON_NAME', 'SWISS_UID'],
    minEntityCount: 50, // Actually detects 63 entities
    maxProcessingTimeMs: 5000,
    // Sample entities for verification:
    // - ORG: "Syslog informatique SA"
    // - ADDRESS: "1700 Fribourg", "Route André Piller 50"
    // - PHONE: "+41 26 425 53 00"
    // - DATE: "16.05.2025"
    // - IBAN: Bank account numbers
  },
  'test-invoice-validation-1.pdf': {
    category: 'invoice',
    language: 'fr',
    expectedDocumentType: 'INVOICE',
    expectedEntityTypes: ['DATE', 'ORG', 'ADDRESS', 'PHONE', 'EMAIL', 'IBAN', 'SWISS_UID', 'PERSON_NAME'],
    minEntityCount: 40, // Actually detects 48 entities
    maxProcessingTimeMs: 5000,
    // Sample entities for verification:
    // - DATE: "31.05.2025", "29.06.2025"
    // - ORG: "Equinoxe MIS Development SA"
    // - ADDRESS: "1701 Fribourg"
  },
  'test-contract-amendment-1.docx': {
    category: 'contract',
    language: 'fr',
    expectedDocumentType: 'CONTRACT',
    expectedEntityTypes: ['ADDRESS', 'SWISS_UID', 'ORG', 'DATE', 'PERSON_NAME'],
    minEntityCount: 25, // Actually detects 29 entities
    maxProcessingTimeMs: 3000,
    // Sample entities for verification:
    // - ADDRESS: "Route André Piller 50", "1762 Givisiez", "Rue Joseph-Piller 13", "1701 Fribourg"
    // - SWISS_UID: "CHE-107.523.883"
    // - PERSON_NAME: Various names
    // - DATE: Multiple dates
  },
  'test-contract-amendment-2.pdf': {
    category: 'contract',
    language: 'fr',
    expectedDocumentType: 'CONTRACT',
    expectedEntityTypes: ['ADDRESS', 'PHONE', 'DATE', 'ORG', 'SWISS_UID', 'PERSON_NAME'],
    minEntityCount: 60, // Actually detects 76 entities
    maxProcessingTimeMs: 5000,
    // Sample entities for verification:
    // - ADDRESS: "Route André Piller 50", "1701 Fribourg"
    // - PHONE: "+41 26 305 31 61"
    // - DATE: Multiple dates (37 detected)
    // - PERSON_NAME: 10 names detected
  },
  'test-hr-report-1.xlsx': {
    category: 'hr_report',
    language: 'fr',
    expectedDocumentType: 'UNKNOWN', // Excel files often classified as unknown
    expectedEntityTypes: ['ADDRESS', 'DATE'],
    minEntityCount: 5, // Actually detects 11 entities
    maxProcessingTimeMs: 3000,
    // Sample entities for verification:
    // - DATE: "09.04.2025"
    // - ADDRESS: Various (may include data row counts as false positives)
  },
  'test-insurance-attestation-1.pdf': {
    category: 'insurance',
    language: 'fr',
    expectedDocumentType: 'UNKNOWN', // Attestation not a standard type
    expectedEntityTypes: ['ORG', 'ADDRESS', 'ID_NUMBER', 'PERSON_NAME', 'PHONE', 'DATE', 'EMAIL'],
    minEntityCount: 15, // Actually detects 20 entities
    maxProcessingTimeMs: 5000,
    // Sample entities for verification:
    // - ORG: "Softcom Technologies SA"
    // - ADDRESS: "Rte du Jura 37A", "1700 Fribourg"
    // - ID_NUMBER: "65'075'002"
    // - PERSON_NAME: "Bruno Figueiredo Carvalho"
    // - PHONE: "+41 21 627 41 37"
    // - DATE: "07.06.2024"
  },
  'test-legal-response-1.pdf': {
    category: 'letter',
    language: 'fr',
    expectedDocumentType: 'UNKNOWN', // Legal response may not match LETTER
    expectedEntityTypes: ['ADDRESS', 'PHONE', 'EMAIL', 'SWISS_UID', 'PERSON_NAME'],
    minEntityCount: 15, // Actually detects 20 entities
    maxProcessingTimeMs: 5000,
    // Sample entities for verification:
    // - ADDRESS: "1701 Fribourg", "Route de Beaumont 20"
    // - PHONE: "+41 26 305 31 61", "+41 26 305 32 16"
    // - EMAIL: "frederic.thevoz@fr.ch"
    // - SWISS_UID: TVA number
  },
} as const;

export type TestDocumentName = keyof typeof TEST_DOCUMENTS;

/**
 * Sample entities for exact match verification
 * These are specific entities that MUST be detected in each document
 */
export const SAMPLE_ENTITIES_FOR_VERIFICATION = {
  'test-invoice-1.pdf': [
    { type: 'ORG', textContains: 'Syslog informatique SA' },
    { type: 'ADDRESS', textContains: '1700 Fribourg' },
    { type: 'PHONE', textContains: '+41 26 425 53 00' },
    { type: 'DATE', textContains: '16.05.2025' },
    { type: 'ADDRESS', textContains: 'Route André Piller 50' },
  ],
  'test-invoice-validation-1.pdf': [
    { type: 'DATE', textContains: '31.05.2025' },
    { type: 'DATE', textContains: '29.06.2025' },
    { type: 'ORG', textContains: 'Equinoxe MIS Development SA' },
    { type: 'ADDRESS', textContains: '1701 Fribourg' },
  ],
  'test-contract-amendment-1.docx': [
    { type: 'ADDRESS', textContains: 'Route André Piller 50' },
    { type: 'ADDRESS', textContains: '1762 Givisiez' },
    { type: 'SWISS_UID', textContains: 'CHE-107.523.883' },
    { type: 'ADDRESS', textContains: '1701 Fribourg' },
  ],
  'test-contract-amendment-2.pdf': [
    { type: 'ADDRESS', textContains: 'Route André Piller 50' },
    { type: 'ADDRESS', textContains: '1701 Fribourg' },
    { type: 'PHONE', textContains: '+41 26 305 31 61' },
  ],
  'test-hr-report-1.xlsx': [
    { type: 'DATE', textContains: '09.04.2025' },
  ],
  'test-insurance-attestation-1.pdf': [
    { type: 'ORG', textContains: 'Softcom Technologies SA' },
    { type: 'ADDRESS', textContains: 'Rte du Jura 37A' },
    { type: 'ADDRESS', textContains: '1700 Fribourg' },
    { type: 'ID_NUMBER', textContains: "65'075'002" },
    { type: 'PERSON_NAME', textContains: 'Bruno Figueiredo Carvalho' },
    { type: 'PHONE', textContains: '+41 21 627 41 37' },
  ],
  'test-legal-response-1.pdf': [
    { type: 'ADDRESS', textContains: '1701 Fribourg' },
    { type: 'PHONE', textContains: '+41 26 305 31 61' },
    { type: 'PHONE', textContains: '+41 26 305 32 16' },
    { type: 'ADDRESS', textContains: 'Route de Beaumont 20' },
  ],
} as const;

/**
 * Get sample entities that must be detected for a document
 */
export function getSampleEntitiesForVerification(filename: string) {
  return SAMPLE_ENTITIES_FOR_VERIFICATION[filename as TestDocumentName] || [];
}

/**
 * Verify that specific entities were detected
 */
export function verifyRequiredEntities(
  filename: string,
  detectedEntities: Array<{ type: string; text: string }>,
): { allFound: boolean; missing: Array<{ type: string; textContains: string }> } {
  const required = getSampleEntitiesForVerification(filename);
  const missing: Array<{ type: string; textContains: string }> = [];

  for (const req of required) {
    const found = detectedEntities.some(
      e => e.type === req.type && e.text.includes(req.textContains),
    );
    if (!found) {
      missing.push(req);
    }
  }

  return {
    allFound: missing.length === 0,
    missing,
  };
}

/**
 * Get expected results for a test document
 */
export function getExpectedResults(filename: string) {
  return TEST_DOCUMENTS[filename as TestDocumentName] || null;
}

/**
 * Categorize filename by document type
 */
export function categorizeDocument(filename: string): keyof typeof EXPECTED_PII_BY_DOCUMENT_TYPE | null {
  const lowerName = filename.toLowerCase();

  if (lowerName.includes('invoice')) return 'invoice';
  if (lowerName.includes('contract')) return 'contract';
  if (lowerName.includes('letter') || lowerName.includes('legal')) return 'letter';
  if (lowerName.includes('hr') || lowerName.includes('report')) return 'hr_report';
  if (lowerName.includes('insurance') || lowerName.includes('attestation')) return 'insurance';

  return null;
}

/**
 * Get minimum expected entity count for a document
 */
export function getMinEntityCount(filename: string): number {
  const expected = getExpectedResults(filename);
  if (expected) return expected.minEntityCount;

  const category = categorizeDocument(filename);
  if (category) return EXPECTED_PII_BY_DOCUMENT_TYPE[category].minEntities;

  return 1; // At least 1 entity expected in any business document
}

/**
 * Get expected entity types for a document
 */
export function getExpectedEntityTypes(filename: string): readonly string[] {
  const expected = getExpectedResults(filename);
  if (expected) return expected.expectedEntityTypes;

  const category = categorizeDocument(filename);
  if (category) return EXPECTED_PII_BY_DOCUMENT_TYPE[category].expectedTypes;

  return [];
}

/**
 * Get expected document type classification
 */
export function getExpectedDocumentType(filename: string): string {
  const expected = getExpectedResults(filename);
  if (expected) return expected.expectedDocumentType;

  const category = categorizeDocument(filename);
  if (category) return EXPECTED_PII_BY_DOCUMENT_TYPE[category].documentType;

  return 'UNKNOWN';
}

/**
 * Validate detection results against expectations
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalEntities: number;
    expectedMinimum: number;
    typesFound: string[];
    expectedTypes: readonly string[];
    missingRequiredTypes: string[];
    documentTypeMatch: boolean;
  };
}

export function validateDetectionResults(
  filename: string,
  entities: Array<{ type: string }>,
  documentType: string,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const expectedMinimum = getMinEntityCount(filename);
  const expectedTypes = getExpectedEntityTypes(filename);
  const expectedDocType = getExpectedDocumentType(filename);

  const typesFound = [...new Set(entities.map(e => e.type))];
  const category = categorizeDocument(filename);
  const requiredTypes = category
    ? EXPECTED_PII_BY_DOCUMENT_TYPE[category].requiredTypes
    : [];

  const missingRequiredTypes = requiredTypes.filter(
    type => !typesFound.includes(type),
  );

  // Validation checks
  if (entities.length < expectedMinimum) {
    errors.push(
      `Expected at least ${expectedMinimum} entities, found ${entities.length}`,
    );
  }

  if (missingRequiredTypes.length > 0) {
    warnings.push(
      `Missing required types: ${missingRequiredTypes.join(', ')}`,
    );
  }

  const documentTypeMatch =
    documentType === expectedDocType || expectedDocType === 'UNKNOWN';

  if (!documentTypeMatch && expectedDocType !== 'UNKNOWN') {
    warnings.push(
      `Document type mismatch: expected ${expectedDocType}, got ${documentType}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalEntities: entities.length,
      expectedMinimum,
      typesFound,
      expectedTypes,
      missingRequiredTypes,
      documentTypeMatch,
    },
  };
}

/**
 * Cross-platform consistency check
 * Compares results from two platforms and returns differences
 */
export interface ConsistencyResult {
  consistent: boolean;
  entityCountDiff: number;
  missingInB: string[];
  extraInB: string[];
  typeMatchPercentage: number;
}

export function checkCrossPlatformConsistency(
  entitiesA: Array<{ type: string; text: string }>,
  entitiesB: Array<{ type: string; text: string }>,
): ConsistencyResult {
  const textsA = new Set(entitiesA.map(e => e.text));
  const textsB = new Set(entitiesB.map(e => e.text));

  const missingInB = [...textsA].filter(t => !textsB.has(t));
  const extraInB = [...textsB].filter(t => !textsA.has(t));

  const totalUnique = new Set([...textsA, ...textsB]).size;
  const matching = totalUnique - missingInB.length - extraInB.length;
  const typeMatchPercentage = totalUnique > 0 ? (matching / totalUnique) * 100 : 100;

  return {
    consistent: missingInB.length === 0 && extraInB.length === 0,
    entityCountDiff: Math.abs(entitiesA.length - entitiesB.length),
    missingInB,
    extraInB,
    typeMatchPercentage,
  };
}
