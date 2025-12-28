/**
 * Presidio Test Data Adapter
 *
 * Converts Microsoft Presidio test data format to our internal format.
 * Used for compatibility testing against the Presidio benchmark.
 *
 * @module shared/test/presidioAdapter
 */

import * as fs from 'fs';
import type { Entity } from './accuracy';

/**
 * Entity type mapping: Presidio → Our types
 */
export const PRESIDIO_TYPE_MAP: Record<string, string> = {
  PERSON: 'PERSON_NAME',
  PER: 'PERSON_NAME',
  EMAIL_ADDRESS: 'EMAIL',
  PHONE_NUMBER: 'PHONE_NUMBER',
  IBAN_CODE: 'IBAN',
  CREDIT_CARD: 'CREDIT_CARD',
  IP_ADDRESS: 'IP_ADDRESS',
  DATE_TIME: 'DATE',
  LOCATION: 'ADDRESS',
  ORGANIZATION: 'ORGANIZATION',
  US_SSN: 'SSN',
  US_DRIVER_LICENSE: 'DRIVER_LICENSE',
  URL: 'URL',
  NRP: 'NATIONALITY',
};

/**
 * Presidio span format
 */
export interface PresidioSpan {
  entity_type: string;
  entity_value: string;
  start_position: number;
  end_position: number;
}

/**
 * Presidio InputSample format
 */
export interface PresidioSample {
  full_text: string;
  masked?: string;
  spans: PresidioSpan[];
  template_id?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Annotated document in our format
 */
export interface AnnotatedDocument {
  id: string;
  text: string;
  language: string;
  source: string;
  expectedEntities: Entity[];
}

/**
 * IBAN test case format
 */
export interface IbanTestCase {
  iban: string;
  country: string;
  description: string;
}

/**
 * Invalid IBAN test case format
 */
export interface InvalidIbanTestCase {
  iban: string;
  reason: string;
}

/**
 * Formatted IBAN test case
 */
export interface FormattedIbanTestCase {
  formatted: string;
  normalized: string;
  country: string;
}

/**
 * IBAN edge case
 */
export interface IbanEdgeCase {
  text: string;
  should_detect: boolean;
  reason: string;
}

/**
 * IBAN test cases file structure
 */
export interface IbanTestCases {
  version: string;
  source: string;
  description: string;
  valid_ibans: IbanTestCase[];
  invalid_ibans: InvalidIbanTestCase[];
  formatted_ibans: FormattedIbanTestCase[];
  edge_cases: IbanEdgeCase[];
}

/**
 * Map Presidio entity type to our internal type
 */
export function mapPresidioEntityType(presidioType: string): string {
  const normalized = presidioType.toUpperCase().trim();
  return PRESIDIO_TYPE_MAP[normalized] || normalized;
}

/**
 * Convert Presidio span to our Entity format
 */
export function convertPresidioSpan(span: PresidioSpan): Entity {
  return {
    text: span.entity_value,
    type: mapPresidioEntityType(span.entity_type),
    start: span.start_position,
    end: span.end_position,
  };
}

/**
 * Convert Presidio sample to our annotated document format
 */
export function convertPresidioSample(sample: PresidioSample, index: number = 0): AnnotatedDocument {
  return {
    id: `presidio-${sample.template_id ?? index}`,
    text: sample.full_text,
    language: 'en', // Presidio samples are primarily English
    source: 'presidio-research',
    expectedEntities: sample.spans.map(convertPresidioSpan),
  };
}

/**
 * Load and convert Presidio dataset from JSON file
 */
export function loadPresidioFixtures(jsonPath: string): AnnotatedDocument[] {
  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const samples: PresidioSample[] = Array.isArray(raw) ? raw : [raw];
  return samples.map((sample, index) => convertPresidioSample(sample, index));
}

/**
 * Load IBAN test cases from JSON file
 */
export function loadIbanTestCases(jsonPath: string): IbanTestCases {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
}

/**
 * Generate test document from IBAN test case
 */
export function ibanToTestDocument(testCase: IbanTestCase): AnnotatedDocument {
  const text = `IBAN: ${testCase.iban}`;
  return {
    id: `iban-${testCase.country}`,
    text,
    language: 'en',
    source: 'presidio-iban-tests',
    expectedEntities: [
      {
        text: testCase.iban,
        type: 'IBAN',
        start: 6, // After "IBAN: "
        end: 6 + testCase.iban.length,
      },
    ],
  };
}

/**
 * Generate test documents from all valid IBAN test cases
 */
export function generateIbanTestDocuments(testCases: IbanTestCases): AnnotatedDocument[] {
  return testCases.valid_ibans.map(ibanToTestDocument);
}
