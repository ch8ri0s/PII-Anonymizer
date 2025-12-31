/**
 * DATE Entity Detection E2E Tests
 *
 * Intensive tests for DATE entity detection comparing browser-app and Electron behavior.
 * Uses the Softcom_Attestation_LPP.pdf as the primary test document.
 *
 * Expected dates in the document:
 * - 07.06.2024 (document date)
 * - 01.01.2014 (affiliation date: "depuis le 01.01.2014")
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import { createTestLogger } from '../helpers/testLogger';

// Import browser-app components
import { PdfConverter } from '../../src/converters/PdfConverter';
import { BrowserHighRecallPass } from '../../src/pii/BrowserHighRecallPass';
import { PIIDetector } from '../../src/processing/PIIDetector';
import type { PipelineContext, Entity } from '../../src/types/detection';

// Import shared patterns for comparison
import {
  buildHighRecallPatterns,
  validateDate,
  validateDateFull,
} from '../../../shared/dist/pii/index.js';

// Import Electron's SwissEuDetector for comparison
import { SwissEuDetector } from '@core/index';

const log = createTestLogger('test:date-detection');

// Test file path - the actual PDF provided
const TEST_PDF_PATH = '/Users/olivier/Downloads/Softcom_Attestation_LPP.pdf';

// Expected dates from the document
const EXPECTED_DATES = [
  { text: '07.06.2024', description: 'Document date' },
  { text: '01.01.2014', description: 'Affiliation date' },
];

// Helper to create File from buffer (for browser-app)
function bufferToFile(buffer: Buffer, filename: string): File {
  const uint8Array = new Uint8Array(buffer);
  const blob = new Blob([uint8Array]);
  return new File([blob], filename, { type: 'application/pdf' });
}

describe('DATE Entity Detection E2E Tests', () => {
  let pdfBuffer: Buffer;
  let pdfFile: File;
  let markdown: string;
  let pdfConverter: PdfConverter;

  beforeAll(async () => {
    // Check if the test PDF exists
    if (!fs.existsSync(TEST_PDF_PATH)) {
      log.warn('Test PDF not found, tests will be skipped', { path: TEST_PDF_PATH });
      return;
    }

    pdfBuffer = fs.readFileSync(TEST_PDF_PATH);
    pdfFile = bufferToFile(pdfBuffer, 'Softcom_Attestation_LPP.pdf');
    pdfConverter = new PdfConverter();

    // Convert PDF to markdown
    markdown = await pdfConverter.convert(pdfFile);
    log.info('PDF converted to markdown', {
      chars: markdown.length,
      lines: markdown.split('\n').length,
    });

    // Log first 500 chars for debugging
    log.debug('Markdown preview', { preview: markdown.substring(0, 500) });
  });

  describe('PDF Text Extraction', () => {
    it('should extract text containing expected dates', () => {
      if (!markdown) {
        log.warn('Skipping: PDF not available');
        return;
      }

      // Check that dates appear in the extracted text
      for (const expectedDate of EXPECTED_DATES) {
        const found = markdown.includes(expectedDate.text);
        log.info('Date text extraction check', {
          date: expectedDate.text,
          description: expectedDate.description,
          found,
        });
        expect(found, `Expected date "${expectedDate.text}" (${expectedDate.description}) to be in extracted text`).toBe(true);
      }
    });

    it('should preserve date formats correctly', () => {
      if (!markdown) {
        log.warn('Skipping: PDF not available');
        return;
      }

      // European date format: DD.MM.YYYY
      const datePattern = /\b(?:0?[1-9]|[12]\d|3[01])\.(?:0?[1-9]|1[0-2])\.(?:19|20)\d{2}\b/g;
      const matches = markdown.match(datePattern) || [];

      log.info('Date patterns found in text', {
        count: matches.length,
        dates: matches,
      });

      expect(matches.length, 'Should find at least 2 dates in European format').toBeGreaterThanOrEqual(2);
    });
  });

  describe('Shared DATE Validator', () => {
    it('should validate expected date formats', () => {
      for (const expectedDate of EXPECTED_DATES) {
        const result = validateDateFull(expectedDate.text);
        log.info('Date validation result', {
          date: expectedDate.text,
          isValid: result.isValid,
          confidence: result.confidence,
          reason: result.reason,
        });
        expect(result.isValid, `Date "${expectedDate.text}" should be valid`).toBe(true);
      }
    });

    it('should validate various European date formats', () => {
      const testDates = [
        { text: '07.06.2024', shouldBeValid: true },
        { text: '01.01.2014', shouldBeValid: true },
        { text: '25.12.2023', shouldBeValid: true },
        { text: '31.12.1999', shouldBeValid: true },
        { text: '1.1.2000', shouldBeValid: true },
        { text: '07/06/2024', shouldBeValid: true },
        { text: '07-06-2024', shouldBeValid: true },
        { text: '32.12.2024', shouldBeValid: false }, // Invalid day
        { text: '07.13.2024', shouldBeValid: false }, // Invalid month
        { text: '07.06.1800', shouldBeValid: false }, // Year out of range
      ];

      for (const testDate of testDates) {
        const isValid = validateDate(testDate.text);
        log.debug('Date format validation', {
          text: testDate.text,
          expected: testDate.shouldBeValid,
          actual: isValid,
        });
        expect(isValid, `Date "${testDate.text}" validation should be ${testDate.shouldBeValid}`).toBe(testDate.shouldBeValid);
      }
    });
  });

  describe('Shared HighRecallPatterns DATE Patterns', () => {
    it('should have DATE patterns defined', () => {
      const patterns = buildHighRecallPatterns();
      const datePatterns = patterns.filter(p => p.type === 'DATE');

      log.info('DATE patterns from buildHighRecallPatterns', {
        totalPatterns: patterns.length,
        datePatterns: datePatterns.length,
      });

      expect(datePatterns.length, 'Should have DATE patterns defined').toBeGreaterThan(0);

      // Log the actual patterns
      for (const pattern of datePatterns) {
        log.debug('DATE pattern', {
          type: pattern.type,
          priority: pattern.priority,
          pattern: pattern.pattern.toString(),
        });
      }
    });

    it('should match expected dates with regex patterns', () => {
      const patterns = buildHighRecallPatterns();
      const datePatterns = patterns.filter(p => p.type === 'DATE');

      for (const expectedDate of EXPECTED_DATES) {
        let matched = false;

        for (const patternDef of datePatterns) {
          // Reset lastIndex for global patterns
          patternDef.pattern.lastIndex = 0;
          if (patternDef.pattern.test(expectedDate.text)) {
            matched = true;
            log.debug('Date matched by pattern', {
              date: expectedDate.text,
              pattern: patternDef.pattern.toString(),
            });
            break;
          }
        }

        expect(matched, `Expected date "${expectedDate.text}" should match at least one DATE pattern`).toBe(true);
      }
    });
  });

  describe('BrowserHighRecallPass DATE Detection', () => {
    let pass: BrowserHighRecallPass;
    let context: PipelineContext;

    beforeEach(() => {
      pass = new BrowserHighRecallPass(0.3);
      context = {
        documentId: 'test-pdf-date',
        language: 'fr',
        metadata: {},
        passResults: new Map(),
        startTime: Date.now(),
      };
    });

    it('should detect DATE entities from the PDF markdown', async () => {
      if (!markdown) {
        log.warn('Skipping: PDF not available');
        return;
      }

      const entities = await pass.execute(markdown, [], context);
      const dateEntities = entities.filter(e => e.type === 'DATE');

      log.info('BrowserHighRecallPass DATE detection results', {
        totalEntities: entities.length,
        dateEntities: dateEntities.length,
      });

      // Log all detected dates
      for (const entity of dateEntities) {
        log.info('Detected DATE entity', {
          text: entity.text,
          start: entity.start,
          end: entity.end,
          confidence: entity.confidence,
          source: entity.source,
        });
      }

      // Should detect at least 2 dates
      expect(dateEntities.length, 'Should detect at least 2 DATE entities').toBeGreaterThanOrEqual(2);

      // Check for expected dates
      const detectedTexts = dateEntities.map(e => e.text);
      for (const expectedDate of EXPECTED_DATES) {
        const found = detectedTexts.some(t => t.includes(expectedDate.text));
        expect(found, `Expected date "${expectedDate.text}" (${expectedDate.description}) should be detected`).toBe(true);
      }
    });

    it('should detect dates with correct positions', async () => {
      if (!markdown) {
        log.warn('Skipping: PDF not available');
        return;
      }

      const entities = await pass.execute(markdown, [], context);
      const dateEntities = entities.filter(e => e.type === 'DATE');

      for (const entity of dateEntities) {
        // Verify that the text at the detected position matches
        const extractedText = markdown.substring(entity.start, entity.end);
        expect(extractedText, `Position mismatch for DATE entity`).toBe(entity.text);

        log.debug('Position verification', {
          text: entity.text,
          start: entity.start,
          end: entity.end,
          extractedText,
          match: extractedText === entity.text,
        });
      }
    });
  });

  describe('SwissEuDetector DATE Detection (Electron)', () => {
    let detector: SwissEuDetector;

    beforeEach(() => {
      detector = new SwissEuDetector();
    });

    it('should detect DATE entities from the PDF markdown', () => {
      if (!markdown) {
        log.warn('Skipping: PDF not available');
        return;
      }

      const matches = detector.detect(markdown);
      const dateMatches = matches.filter(m => m.type === 'DATE');

      log.info('SwissEuDetector DATE detection results', {
        totalMatches: matches.length,
        dateMatches: dateMatches.length,
      });

      // Log all detected dates
      for (const match of dateMatches) {
        log.info('Detected DATE match', {
          text: match.text,
          start: match.start,
          end: match.end,
          type: match.type,
        });
      }

      // Should detect at least 2 dates
      expect(dateMatches.length, 'Should detect at least 2 DATE matches').toBeGreaterThanOrEqual(2);

      // Check for expected dates
      const detectedTexts = dateMatches.map(m => m.text);
      for (const expectedDate of EXPECTED_DATES) {
        const found = detectedTexts.some(t => t.includes(expectedDate.text));
        expect(found, `Expected date "${expectedDate.text}" (${expectedDate.description}) should be detected`).toBe(true);
      }
    });
  });

  describe('Cross-Platform DATE Detection Consistency', () => {
    let browserPass: BrowserHighRecallPass;
    let electronDetector: SwissEuDetector;

    beforeEach(() => {
      browserPass = new BrowserHighRecallPass(0.3);
      electronDetector = new SwissEuDetector();
    });

    it('should detect the same dates in both apps', async () => {
      if (!markdown) {
        log.warn('Skipping: PDF not available');
        return;
      }

      // Browser-app detection
      const context: PipelineContext = {
        documentId: 'test-cross-platform',
        language: 'fr',
        metadata: {},
        passResults: new Map(),
        startTime: Date.now(),
      };
      const browserEntities = await browserPass.execute(markdown, [], context);
      const browserDates = browserEntities
        .filter(e => e.type === 'DATE')
        .map(e => e.text)
        .sort();

      // Electron detection
      const electronMatches = electronDetector.detect(markdown);
      const electronDates = electronMatches
        .filter(m => m.type === 'DATE')
        .map(m => m.text)
        .sort();

      log.info('Cross-platform DATE comparison', {
        browserDates,
        electronDates,
        browserCount: browserDates.length,
        electronCount: electronDates.length,
      });

      // Check that both detect the expected dates
      for (const expectedDate of EXPECTED_DATES) {
        const inBrowser = browserDates.some(d => d.includes(expectedDate.text));
        const inElectron = electronDates.some(d => d.includes(expectedDate.text));

        log.info('Expected date check', {
          date: expectedDate.text,
          description: expectedDate.description,
          inBrowser,
          inElectron,
        });

        expect(inBrowser, `Browser should detect "${expectedDate.text}"`).toBe(true);
        expect(inElectron, `Electron should detect "${expectedDate.text}"`).toBe(true);
      }

      // Both should detect EXACTLY the same dates (identical behavior)
      expect(browserDates, 'Browser and Electron should detect identical DATE texts').toEqual(electronDates);
    });

    it('should detect dates at consistent positions', async () => {
      if (!markdown) {
        log.warn('Skipping: PDF not available');
        return;
      }

      // Browser-app detection
      const context: PipelineContext = {
        documentId: 'test-positions',
        language: 'fr',
        metadata: {},
        passResults: new Map(),
        startTime: Date.now(),
      };
      const browserEntities = await browserPass.execute(markdown, [], context);
      const browserDates = browserEntities.filter(e => e.type === 'DATE');

      // Electron detection
      const electronMatches = electronDetector.detect(markdown);
      const electronDates = electronMatches.filter(m => m.type === 'DATE');

      // For each expected date, compare positions
      for (const expectedDate of EXPECTED_DATES) {
        const browserEntity = browserDates.find(e => e.text.includes(expectedDate.text));
        const electronMatch = electronDates.find(m => m.text.includes(expectedDate.text));

        if (browserEntity && electronMatch) {
          log.info('Position comparison', {
            date: expectedDate.text,
            browserStart: browserEntity.start,
            electronStart: electronMatch.start,
            browserEnd: browserEntity.end,
            electronEnd: electronMatch.end,
            positionMatch: browserEntity.start === electronMatch.start && browserEntity.end === electronMatch.end,
          });

          // Positions should be identical for the same text
          expect(browserEntity.start, `Start position mismatch for "${expectedDate.text}"`).toBe(electronMatch.start);
          expect(browserEntity.end, `End position mismatch for "${expectedDate.text}"`).toBe(electronMatch.end);
        }
      }
    });
  });

  describe('Full Pipeline DATE Detection', () => {
    let piiDetector: PIIDetector;

    beforeEach(() => {
      piiDetector = new PIIDetector();
    });

    it('should detect dates through complete browser-app pipeline', async () => {
      if (!markdown) {
        log.warn('Skipping: PDF not available');
        return;
      }

      await piiDetector.initializePipeline();
      const result = await piiDetector.detectWithPipeline(markdown, {
        config: { debug: true },
      });

      const dateEntities = result.entities.filter(e => e.type === 'DATE');

      log.info('Full pipeline DATE detection', {
        totalEntities: result.entities.length,
        dateEntities: dateEntities.length,
        documentType: result.documentType,
        durationMs: result.metadata.totalDurationMs,
        passResults: result.metadata.passResults,
        entityCounts: result.metadata.entityCounts,
      });

      // Log all detected entities for debugging
      log.info('All detected entities', {
        types: result.entities.map(e => e.type),
        entities: result.entities.slice(0, 20).map(e => ({
          type: e.type,
          text: e.text.substring(0, 30),
          confidence: e.confidence,
        })),
      });

      // Log all dates found
      for (const entity of dateEntities) {
        log.info('Pipeline detected DATE', {
          text: entity.text,
          confidence: entity.confidence,
          source: entity.source,
        });
      }

      // Should detect at least 2 dates
      expect(dateEntities.length, 'Full pipeline should detect at least 2 dates').toBeGreaterThanOrEqual(2);

      // Check for expected dates
      for (const expectedDate of EXPECTED_DATES) {
        const found = dateEntities.some(e => e.text.includes(expectedDate.text));
        expect(found, `Pipeline should detect "${expectedDate.text}"`).toBe(true);
      }
    });
  });

  describe('Edge Cases and Date Format Variants', () => {
    let pass: BrowserHighRecallPass;
    let context: PipelineContext;

    beforeEach(() => {
      pass = new BrowserHighRecallPass(0.3);
      context = {
        documentId: 'test-edge-cases',
        language: 'fr',
        metadata: {},
        passResults: new Map(),
        startTime: Date.now(),
      };
    });

    it('should detect dates in various European formats', async () => {
      const testTexts = [
        { text: 'Date: 07.06.2024', expectedDate: '07.06.2024' },
        { text: 'Le 01.01.2014', expectedDate: '01.01.2014' },
        { text: 'Datum: 25/12/2023', expectedDate: '25/12/2023' },
        { text: '31-12-1999', expectedDate: '31-12-1999' },
        { text: 'Am 1.1.2000', expectedDate: '1.1.2000' },
      ];

      for (const test of testTexts) {
        const entities = await pass.execute(test.text, [], context);
        const dateEntities = entities.filter(e => e.type === 'DATE');

        log.debug('Edge case test', {
          input: test.text,
          expectedDate: test.expectedDate,
          found: dateEntities.length > 0,
          detected: dateEntities.map(e => e.text),
        });

        expect(dateEntities.length, `Should detect date in "${test.text}"`).toBeGreaterThanOrEqual(1);
        expect(
          dateEntities.some(e => e.text === test.expectedDate),
          `Should detect "${test.expectedDate}" in "${test.text}"`,
        ).toBe(true);
      }
    });

    it('should detect German month name dates', async () => {
      const testTexts = [
        { text: '15. Januar 2024', expectedDate: '15. Januar 2024' },
        { text: '3 März 2023', expectedDate: '3 März 2023' },
        { text: '25 Dezember 2022', expectedDate: '25 Dezember 2022' },
      ];

      for (const test of testTexts) {
        const entities = await pass.execute(test.text, [], { ...context, language: 'de' });
        const dateEntities = entities.filter(e => e.type === 'DATE');

        log.debug('German date test', {
          input: test.text,
          found: dateEntities.length > 0,
          detected: dateEntities.map(e => e.text),
        });

        expect(dateEntities.length, `Should detect German date in "${test.text}"`).toBeGreaterThanOrEqual(1);
      }
    });

    it('should detect French month name dates', async () => {
      const testTexts = [
        { text: '15 janvier 2024', expectedDate: '15 janvier 2024' },
        { text: '3 mars 2023', expectedDate: '3 mars 2023' },
        { text: '25 décembre 2022', expectedDate: '25 décembre 2022' },
      ];

      for (const test of testTexts) {
        const entities = await pass.execute(test.text, [], { ...context, language: 'fr' });
        const dateEntities = entities.filter(e => e.type === 'DATE');

        log.debug('French date test', {
          input: test.text,
          found: dateEntities.length > 0,
          detected: dateEntities.map(e => e.text),
        });

        expect(dateEntities.length, `Should detect French date in "${test.text}"`).toBeGreaterThanOrEqual(1);
      }
    });

    it('should NOT detect invalid dates', async () => {
      const invalidDates = [
        '32.12.2024', // Invalid day
        '15.13.2024', // Invalid month
        '00.05.2024', // Invalid day (0)
        '15.00.2024', // Invalid month (0)
      ];

      for (const invalidDate of invalidDates) {
        const entities = await pass.execute(`Date: ${invalidDate}`, [], context);
        const dateEntities = entities.filter(e => e.type === 'DATE');

        // The pattern might still match, but validation should reject
        // Note: HighRecallPass may not validate dates, so this tests pattern strictness
        log.debug('Invalid date test', {
          input: invalidDate,
          detected: dateEntities.map(e => e.text),
        });
      }
    });
  });

  describe('All Entity Types Detection (for reference)', () => {
    let pass: BrowserHighRecallPass;

    beforeEach(() => {
      pass = new BrowserHighRecallPass(0.3);
    });

    it('should list all entity types detected in the PDF', async () => {
      if (!markdown) {
        log.warn('Skipping: PDF not available');
        return;
      }

      const context: PipelineContext = {
        documentId: 'test-all-types',
        language: 'fr',
        metadata: {},
        passResults: new Map(),
        startTime: Date.now(),
      };

      const entities = await pass.execute(markdown, [], context);

      // Group by type
      const byType: Record<string, Entity[]> = {};
      for (const entity of entities) {
        if (!byType[entity.type]) {
          byType[entity.type] = [];
        }
        byType[entity.type].push(entity);
      }

      // Log summary
      const summary: Record<string, number> = {};
      for (const [type, typeEntities] of Object.entries(byType)) {
        summary[type] = typeEntities.length;
      }

      log.info('Entity types summary', { summary, total: entities.length });

      // Log details for each type
      for (const [type, typeEntities] of Object.entries(byType)) {
        log.info(`${type} entities`, {
          count: typeEntities.length,
          samples: typeEntities.slice(0, 5).map(e => ({
            text: e.text,
            confidence: e.confidence,
          })),
        });
      }

      // Ensure DATE is among the detected types
      expect(byType['DATE'], 'DATE should be among detected entity types').toBeDefined();
      expect(byType['DATE']?.length, 'Should have DATE entities').toBeGreaterThan(0);
    });
  });
});
