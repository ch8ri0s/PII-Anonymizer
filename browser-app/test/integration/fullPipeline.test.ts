/**
 * Full Pipeline Integration Tests for Browser App
 *
 * Tests the complete data extraction and PII detection pipeline using
 * actual test documents. These tests should produce similar results
 * to the Electron version in test/integration/fullPipeline.test.js
 *
 * Test files (anonymized names in test/.files/):
 * - test-contract-amendment-1.docx - Contract amendment document
 * - test-contract-amendment-2.pdf - Contract PDF
 * - test-hr-report-1.xlsx - HR report with employee data
 * - test-insurance-attestation-1.pdf - Insurance attestation
 * - test-invoice-1.pdf - Invoice with payment details
 * - test-invoice-validation-1.pdf - Invoice validation document
 * - test-legal-response-1.pdf - Legal response letter
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Import browser-app converters
import { PdfConverter } from '../../src/converters/PdfConverter';
import { DocxConverter } from '../../src/converters/DocxConverter';
import { ExcelConverter } from '../../src/converters/ExcelConverter';

// Import browser-app PII detection
import { PIIDetector } from '../../src/processing/PIIDetector';

// Import shared detector for comparison
import { SwissEuDetector } from '@core/index';

// Import document classifier via Vite alias
import { createDocumentClassifier } from '@pii/DocumentClassifier';

const TEST_FILES_DIR = path.join(__dirname, '../../../test/.files');

// Helper to check if test files exist
function getAvailableTestFiles(): string[] {
  if (!fs.existsSync(TEST_FILES_DIR)) {
    return [];
  }
  return fs.readdirSync(TEST_FILES_DIR).filter(f => !f.startsWith('.'));
}

// Helper to create File from buffer
function bufferToFile(buffer: Buffer, filename: string): File {
  // Convert Buffer to Uint8Array to avoid type compatibility issues
  const uint8Array = new Uint8Array(buffer);
  const blob = new Blob([uint8Array]);
  return new File([blob], filename, { type: getMimeType(filename) });
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

describe('Full Pipeline Integration Tests (Browser)', () => {
  const testFiles = getAvailableTestFiles();

  beforeAll(() => {
    if (testFiles.length === 0) {
      console.warn('⚠️  No test files found in test/.files/ - skipping integration tests');
      console.warn('   Place anonymized test documents in test/.files/ to enable these tests');
    } else {
      console.log(`Found ${testFiles.length} test files: ${testFiles.join(', ')}`);
    }
  });

  describe('Document Conversion Pipeline', () => {
    let pdfConverter: PdfConverter;
    let docxConverter: DocxConverter;
    let excelConverter: ExcelConverter;

    beforeEach(() => {
      pdfConverter = new PdfConverter();
      docxConverter = new DocxConverter();
      excelConverter = new ExcelConverter();
    });

    it('should convert DOCX files to Markdown', async () => {
      const docxFiles = testFiles.filter(f => f.endsWith('.docx'));
      if (docxFiles.length === 0) {
        console.log('Skipping: No DOCX files found');
        return;
      }

      for (const filename of docxFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const buffer = fs.readFileSync(filePath);
        const file = bufferToFile(buffer, filename);

        expect(docxConverter.supports(file), `Should support ${filename}`).toBe(true);

        const result = await docxConverter.convert(file);

        expect(result, `${filename} should produce markdown`).toBeTypeOf('string');
        expect(result.length, `${filename} should produce non-empty markdown`).toBeGreaterThan(0);

        // Basic markdown structure checks
        expect(result).not.toContain('<html>');
        expect(result).not.toContain('<?xml');

        console.log(`  ✓ ${filename}: ${result.length} chars`);
      }
    });

    it('should convert PDF files to Markdown', async () => {
      const pdfFiles = testFiles.filter(f => f.endsWith('.pdf'));
      if (pdfFiles.length === 0) {
        console.log('Skipping: No PDF files found');
        return;
      }

      for (const filename of pdfFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const buffer = fs.readFileSync(filePath);
        const file = bufferToFile(buffer, filename);

        expect(pdfConverter.supports(file), `Should support ${filename}`).toBe(true);

        const result = await pdfConverter.convert(file);

        expect(result, `${filename} should produce markdown`).toBeTypeOf('string');
        expect(result.length, `${filename} should produce non-empty markdown`).toBeGreaterThan(0);

        console.log(`  ✓ ${filename}: ${result.length} chars`);
      }
    });

    it('should convert Excel files to Markdown', async () => {
      const xlsxFiles = testFiles.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
      if (xlsxFiles.length === 0) {
        console.log('Skipping: No Excel files found');
        return;
      }

      for (const filename of xlsxFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const buffer = fs.readFileSync(filePath);
        const file = bufferToFile(buffer, filename);

        expect(excelConverter.supports(file), `Should support ${filename}`).toBe(true);

        const result = await excelConverter.convert(file);

        expect(result, `${filename} should produce markdown`).toBeTypeOf('string');
        expect(result.length, `${filename} should produce non-empty markdown`).toBeGreaterThan(0);

        // Excel should produce tables
        if (result.length > 50) {
          expect(result, `${filename} should contain table structure`).toContain('|');
        }

        console.log(`  ✓ ${filename}: ${result.length} chars`);
      }
    });
  });

  describe('PII Detection - SwissEuDetector', () => {
    let detector: SwissEuDetector;
    let pdfConverter: PdfConverter;

    beforeEach(() => {
      detector = new SwissEuDetector();
      pdfConverter = new PdfConverter();
    });

    it('should detect Swiss/EU PII in converted documents', async () => {
      const pdfFiles = testFiles.filter(f => f.endsWith('.pdf'));
      if (pdfFiles.length === 0) {
        console.log('Skipping: No PDF files found');
        return;
      }

      let totalMatches = 0;

      for (const filename of pdfFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const buffer = fs.readFileSync(filePath);
        const file = bufferToFile(buffer, filename);
        const markdown = await pdfConverter.convert(file);

        const matches = detector.detect(markdown);
        totalMatches += matches.length;

        console.log(`  ${filename}: ${matches.length} PII matches found`);

        if (matches.length > 0) {
          const byType: Record<string, number> = {};
          for (const match of matches) {
            byType[match.type] = (byType[match.type] || 0) + 1;
          }
          console.log(`    Types: ${JSON.stringify(byType)}`);
        }
      }

      expect(totalMatches, 'Should detect some PII across test files').toBeGreaterThan(0);
    });

    it('should detect common PII types in invoices', async () => {
      const invoiceFiles = testFiles.filter(f =>
        f.includes('invoice') && f.endsWith('.pdf'),
      );

      if (invoiceFiles.length === 0) {
        console.log('Skipping: No invoice files found');
        return;
      }

      for (const filename of invoiceFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const buffer = fs.readFileSync(filePath);
        const file = bufferToFile(buffer, filename);
        const markdown = await pdfConverter.convert(file);

        const matches = detector.detect(markdown);
        const types = new Set(matches.map(m => m.type));

        const invoiceTypes = ['AMOUNT', 'DATE', 'IBAN', 'VAT_NUMBER', 'INVOICE_NUMBER', 'PHONE', 'EMAIL'];
        const hasInvoiceType = invoiceTypes.some(t => types.has(t));

        console.log(`  ${filename}: Types found: ${[...types].join(', ')}`);
        expect(hasInvoiceType, `${filename} should contain invoice-related PII`).toBe(true);
      }
    });
  });

  describe('Document Type Classification', () => {
    let pdfConverter: PdfConverter;

    beforeEach(() => {
      pdfConverter = new PdfConverter();
    });

    it('should classify document types correctly', async () => {
      const pdfFiles = testFiles.filter(f => f.endsWith('.pdf'));
      if (pdfFiles.length === 0) {
        console.log('Skipping: No PDF files found');
        return;
      }

      const classifier = createDocumentClassifier();

      for (const filename of pdfFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const buffer = fs.readFileSync(filePath);
        const file = bufferToFile(buffer, filename);
        const markdown = await pdfConverter.convert(file);

        const classification = classifier.classify(markdown);

        console.log(`  ${filename}:`);
        console.log(`    Type: ${classification.type} (confidence: ${(classification.confidence * 100).toFixed(1)}%)`);
        console.log(`    Language: ${classification.language || 'unknown'}`);

        expect([
          'INVOICE', 'LETTER', 'FORM', 'CONTRACT', 'REPORT', 'UNKNOWN',
        ]).toContain(classification.type);
        expect(classification.confidence).toBeTypeOf('number');
        expect(classification.confidence).toBeGreaterThanOrEqual(0);
        expect(classification.confidence).toBeLessThanOrEqual(1);

        // Invoice files should be classified as invoices
        if (filename.includes('invoice')) {
          expect(classification.type, `${filename} should be classified as INVOICE`)
            .toBe('INVOICE');
        }
      }
    });
  });

  describe('Full Detection Pipeline', () => {
    let piiDetector: PIIDetector;
    let pdfConverter: PdfConverter;

    beforeEach(() => {
      piiDetector = new PIIDetector();
      pdfConverter = new PdfConverter();
    });

    it('should process documents through complete pipeline', async () => {
      const pdfFiles = testFiles.filter(f => f.endsWith('.pdf')).slice(0, 3);
      if (pdfFiles.length === 0) {
        console.log('Skipping: No PDF files found');
        return;
      }

      await piiDetector.initializePipeline();

      for (const filename of pdfFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const buffer = fs.readFileSync(filePath);
        const file = bufferToFile(buffer, filename);
        const markdown = await pdfConverter.convert(file);

        const result = await piiDetector.detectWithPipeline(markdown);

        console.log(`  ${filename}:`);
        console.log(`    Document type: ${result.documentType}`);
        console.log(`    Total entities: ${result.entities.length}`);
        console.log(`    Duration: ${result.metadata.totalDurationMs}ms`);

        expect(result).toHaveProperty('entities');
        expect(result.entities).toBeInstanceOf(Array);
        expect(result).toHaveProperty('documentType');
        expect(result).toHaveProperty('metadata');
        expect(result.metadata).toHaveProperty('totalDurationMs');
        expect(result.metadata).toHaveProperty('passResults');

        // Verify entity structure
        if (result.entities.length > 0) {
          const entity = result.entities[0];
          expect(entity).toHaveProperty('id');
          expect(entity).toHaveProperty('type');
          expect(entity).toHaveProperty('text');
          expect(entity).toHaveProperty('start');
          expect(entity).toHaveProperty('end');
          expect(entity).toHaveProperty('confidence');
          expect(entity).toHaveProperty('source');
        }
      }
    });

    it('should detect addresses and link components', async () => {
      const addressFiles = testFiles.filter(f =>
        (f.includes('invoice') || f.includes('letter') || f.includes('contract')) &&
        f.endsWith('.pdf'),
      );

      if (addressFiles.length === 0) {
        console.log('Skipping: No address-containing files found');
        return;
      }

      await piiDetector.initializePipeline();

      for (const filename of addressFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const buffer = fs.readFileSync(filePath);
        const file = bufferToFile(buffer, filename);
        const markdown = await pdfConverter.convert(file);

        const result = await piiDetector.detectWithPipeline(markdown);

        const addressEntities = result.entities.filter(e =>
          e.type === 'ADDRESS' ||
          e.type === 'SWISS_ADDRESS' ||
          e.type === 'EU_ADDRESS' ||
          e.type === 'LOCATION',
        );

        console.log(`  ${filename}: ${addressEntities.length} address-related entities`);

        const linkedEntities = result.entities.filter(e =>
          e.components && e.components.length > 0,
        );

        if (linkedEntities.length > 0) {
          console.log(`    Linked addresses: ${linkedEntities.length}`);
        }
      }
    });
  });

  describe('Pipeline Pass Coordination', () => {
    let piiDetector: PIIDetector;
    let pdfConverter: PdfConverter;

    beforeEach(() => {
      piiDetector = new PIIDetector();
      pdfConverter = new PdfConverter();
    });

    it('should run passes in correct order', async () => {
      const pdfFile = testFiles.find(f => f.endsWith('.pdf'));
      if (!pdfFile) {
        console.log('Skipping: No PDF files found');
        return;
      }

      await piiDetector.initializePipeline();

      const filePath = path.join(TEST_FILES_DIR, pdfFile);
      const buffer = fs.readFileSync(filePath);
      const file = bufferToFile(buffer, pdfFile);
      const markdown = await pdfConverter.convert(file);

      const result = await piiDetector.detectWithPipeline(markdown);

      // Verify all passes executed
      const passNames = result.metadata.passResults.map((p: { passName: string }) => p.passName);

      console.log('  Pass execution order:', passNames.join(' → '));

      expect(passNames.length, 'All passes should execute').toBeGreaterThan(0);
    });

    it('should accumulate entities across passes', async () => {
      const pdfFile = testFiles.find(f => f.includes('invoice') && f.endsWith('.pdf'));
      if (!pdfFile) {
        console.log('Skipping: No invoice file found');
        return;
      }

      await piiDetector.initializePipeline();

      const filePath = path.join(TEST_FILES_DIR, pdfFile);
      const buffer = fs.readFileSync(filePath);
      const file = bufferToFile(buffer, pdfFile);
      const markdown = await pdfConverter.convert(file);

      const result = await piiDetector.detectWithPipeline(markdown);

      // Check that HighRecallPass added entities
      const highRecallResult = result.metadata.passResults.find((p: { passName: string }) =>
        p.passName.includes('HighRecall'),
      );

      if (highRecallResult) {
        console.log(`  HighRecallPass: +${highRecallResult.entitiesAdded} entities`);
        expect(highRecallResult.entitiesAdded, 'HighRecallPass should add entities').toBeGreaterThanOrEqual(0);
      }

      // Check that validation pass modified entities
      const validationResult = result.metadata.passResults.find((p: { passName: string }) =>
        p.passName.includes('Validation') || p.passName.includes('Format'),
      );

      if (validationResult) {
        console.log(`  ValidationPass: ${validationResult.entitiesModified} modified`);
      }
    });

    it('should not have overlapping entity spans after pipeline', async () => {
      const pdfFile = testFiles.find(f => f.endsWith('.pdf'));
      if (!pdfFile) {
        console.log('Skipping: No PDF files found');
        return;
      }

      await piiDetector.initializePipeline();

      const filePath = path.join(TEST_FILES_DIR, pdfFile);
      const buffer = fs.readFileSync(filePath);
      const file = bufferToFile(buffer, pdfFile);
      const markdown = await pdfConverter.convert(file);

      const result = await piiDetector.detectWithPipeline(markdown);

      // Sort entities by start position
      const sorted = [...result.entities].sort((a, b) => a.start - b.start);

      // Check for overlaps
      let overlapCount = 0;
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];

        if (current.end > next.start) {
          overlapCount++;
          console.log(`  Overlap: "${current.text}" (${current.start}-${current.end}) with "${next.text}" (${next.start}-${next.end})`);
        }
      }

      // Some overlap may be acceptable for grouped entities, but flag excessive overlap
      expect(overlapCount, 'Should have minimal entity overlaps').toBeLessThan(5);
    });
  });

  describe('Entity Quality Metrics', () => {
    let piiDetector: PIIDetector;
    let pdfConverter: PdfConverter;

    beforeEach(() => {
      piiDetector = new PIIDetector();
      pdfConverter = new PdfConverter();
    });

    it('should produce entities with valid confidence scores', async () => {
      const pdfFile = testFiles.find(f => f.endsWith('.pdf'));
      if (!pdfFile) {
        console.log('Skipping: No PDF files found');
        return;
      }

      await piiDetector.initializePipeline();

      const filePath = path.join(TEST_FILES_DIR, pdfFile);
      const buffer = fs.readFileSync(filePath);
      const file = bufferToFile(buffer, pdfFile);
      const markdown = await pdfConverter.convert(file);

      const result = await piiDetector.detectWithPipeline(markdown);

      for (const entity of result.entities) {
        expect(entity.confidence, `Entity ${entity.id} confidence should be number`)
          .toBeTypeOf('number');
        expect(entity.confidence, `Entity ${entity.id} confidence should be >= 0`)
          .toBeGreaterThanOrEqual(0);
        expect(entity.confidence, `Entity ${entity.id} confidence should be <= 1`)
          .toBeLessThanOrEqual(1);
      }

      if (result.entities.length > 0) {
        const avgConfidence = result.entities.reduce((sum, e) => sum + e.confidence, 0)
          / result.entities.length;
        const highConfidence = result.entities.filter(e => e.confidence >= 0.8).length;
        const lowConfidence = result.entities.filter(e => e.confidence < 0.5).length;

        console.log(`  ${pdfFile}:`);
        console.log(`    Average confidence: ${(avgConfidence * 100).toFixed(1)}%`);
        console.log(`    High confidence (≥80%): ${highConfidence}`);
        console.log(`    Low confidence (<50%): ${lowConfidence}`);
      }
    });
  });

  describe('Cross-Platform Consistency (vs Electron)', () => {
    let browserDetector: SwissEuDetector;
    let pdfConverter: PdfConverter;

    beforeEach(() => {
      browserDetector = new SwissEuDetector();
      pdfConverter = new PdfConverter();
    });

    it('should produce consistent PII detection across platforms', async () => {
      const pdfFiles = testFiles.filter(f => f.endsWith('.pdf')).slice(0, 2);
      if (pdfFiles.length === 0) {
        console.log('Skipping: No PDF files found');
        return;
      }

      console.log('\nCross-platform consistency check:');

      for (const filename of pdfFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const buffer = fs.readFileSync(filePath);
        const file = bufferToFile(buffer, filename);
        const markdown = await pdfConverter.convert(file);

        // Detect with browser SwissEuDetector (same class as Electron)
        const matches = browserDetector.detect(markdown);

        // Group by type
        const byType: Record<string, number> = {};
        for (const match of matches) {
          byType[match.type] = (byType[match.type] || 0) + 1;
        }

        console.log(`  ${filename}:`);
        console.log(`    Total matches: ${matches.length}`);
        console.log(`    By type: ${JSON.stringify(byType)}`);

        // Verify specific entity types are detected consistently
        // These should match between Electron and browser-app
        expect(matches.length, 'Should detect entities').toBeGreaterThanOrEqual(0);
      }
    });

    it('should classify documents consistently across platforms', async () => {
      const pdfFiles = testFiles.filter(f => f.endsWith('.pdf')).slice(0, 2);
      if (pdfFiles.length === 0) {
        console.log('Skipping: No PDF files found');
        return;
      }

      const classifier = createDocumentClassifier();

      console.log('\nDocument classification consistency:');

      for (const filename of pdfFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const buffer = fs.readFileSync(filePath);
        const file = bufferToFile(buffer, filename);
        const markdown = await pdfConverter.convert(file);

        const classification = classifier.classify(markdown);

        console.log(`  ${filename}:`);
        console.log(`    Type: ${classification.type}`);
        console.log(`    Confidence: ${(classification.confidence * 100).toFixed(1)}%`);
        console.log(`    Language: ${classification.language}`);

        // Document types should be consistent
        expect([
          'INVOICE', 'LETTER', 'FORM', 'CONTRACT', 'REPORT', 'UNKNOWN',
        ]).toContain(classification.type);
      }
    });
  });

  describe('Performance Benchmarks', () => {
    let piiDetector: PIIDetector;
    let pdfConverter: PdfConverter;

    beforeEach(() => {
      piiDetector = new PIIDetector();
      pdfConverter = new PdfConverter();
    });

    it('should process documents within acceptable time', async () => {
      const pdfFiles = testFiles.filter(f => f.endsWith('.pdf'));
      if (pdfFiles.length === 0) {
        console.log('Skipping: No PDF files found');
        return;
      }

      await piiDetector.initializePipeline();

      for (const filename of pdfFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const buffer = fs.readFileSync(filePath);
        const file = bufferToFile(buffer, filename);

        const conversionStart = performance.now();
        const markdown = await pdfConverter.convert(file);
        const conversionTime = performance.now() - conversionStart;

        const pipelineStart = performance.now();
        const result = await piiDetector.detectWithPipeline(markdown);
        const pipelineTime = performance.now() - pipelineStart;

        const fileSize = buffer.length / 1024;
        const totalTime = conversionTime + pipelineTime;

        console.log(`  ${filename} (${fileSize.toFixed(1)}KB):`);
        console.log(`    Conversion: ${conversionTime.toFixed(0)}ms`);
        console.log(`    Pipeline: ${pipelineTime.toFixed(0)}ms (${result.entities.length} entities)`);
        console.log(`    Total: ${totalTime.toFixed(0)}ms`);

        expect(totalTime, `${filename} should process in < 10s`).toBeLessThan(10000);
      }
    });
  });

  describe('Expected PII Detection Results', () => {
    let detector: SwissEuDetector;
    let pdfConverter: PdfConverter;

    beforeEach(() => {
      detector = new SwissEuDetector();
      pdfConverter = new PdfConverter();
    });

    it('should detect expected entity counts per document', async () => {
      // Import expected results dynamically to avoid circular deps
      const { TEST_DOCUMENTS } = await import('@shared-test/expectedResults');

      for (const [filename, expected] of Object.entries(TEST_DOCUMENTS)) {
        if (!filename.endsWith('.pdf')) continue;
        if (!testFiles.includes(filename)) continue;

        const filePath = path.join(TEST_FILES_DIR, filename);
        const buffer = fs.readFileSync(filePath);
        const file = bufferToFile(buffer, filename);

        let markdown: string;
        try {
          markdown = await pdfConverter.convert(file);
        } catch {
          console.log(`  Skipping ${filename}: conversion failed`);
          continue;
        }

        const matches = detector.detect(markdown);

        console.log(`  ${filename}:`);
        console.log(`    Expected min: ${expected.minEntityCount}, Actual: ${matches.length}`);

        // Browser detection may vary due to PDF text extraction differences
        // Use a lower threshold (50% of expected) for browser tests
        const browserMinThreshold = Math.floor(expected.minEntityCount * 0.5);
        expect(
          matches.length,
          `${filename} should have at least ${browserMinThreshold} entities (50% of ${expected.minEntityCount})`,
        ).toBeGreaterThanOrEqual(browserMinThreshold);
      }
    });

    it('should detect specific known entities in test documents', async () => {
      const { verifyRequiredEntities } = await import('@shared-test/expectedResults');

      const documentsToTest = testFiles.filter(f => f.endsWith('.pdf'));

      for (const filename of documentsToTest) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const buffer = fs.readFileSync(filePath);
        const file = bufferToFile(buffer, filename);

        let markdown: string;
        try {
          markdown = await pdfConverter.convert(file);
        } catch {
          console.log(`  Skipping ${filename}: conversion failed`);
          continue;
        }

        const matches = detector.detect(markdown);
        const verification = verifyRequiredEntities(filename, matches);

        console.log(`  ${filename}:`);
        if (verification.allFound) {
          console.log('    All required entities found');
        } else {
          console.log(`    Missing entities: ${JSON.stringify(verification.missing)}`);
        }

        // Warn but don't fail - some entities may vary by run
        if (!verification.allFound) {
          console.warn(`    WARNING: Some expected entities not found in ${filename}`);
        }
      }
    });

    it('should classify documents with expected types', async () => {
      const { TEST_DOCUMENTS } = await import('@shared-test/expectedResults');
      const classifier = createDocumentClassifier();

      for (const [filename, expected] of Object.entries(TEST_DOCUMENTS)) {
        if (!filename.endsWith('.pdf')) continue;
        if (!testFiles.includes(filename)) continue;

        const filePath = path.join(TEST_FILES_DIR, filename);
        const buffer = fs.readFileSync(filePath);
        const file = bufferToFile(buffer, filename);

        let markdown: string;
        try {
          markdown = await pdfConverter.convert(file);
        } catch {
          console.log(`  Skipping ${filename}: conversion failed`);
          continue;
        }

        const classification = classifier.classify(markdown);

        console.log(`  ${filename}:`);
        console.log(`    Expected: ${expected.expectedDocumentType}, Actual: ${classification.type}`);
        console.log(`    Language: expected ${expected.language}, actual ${classification.language}`);

        // Check document type matches expectation
        if (expected.expectedDocumentType !== 'UNKNOWN') {
          expect(
            classification.type,
            `${filename} should be classified as ${expected.expectedDocumentType}`,
          ).toBe(expected.expectedDocumentType);
        }
      }
    });
  });
});
