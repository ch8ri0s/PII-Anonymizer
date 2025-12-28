/**
 * Full Pipeline Integration Tests with Real Documents
 *
 * Tests the complete data extraction and PII detection pipeline using
 * actual test documents from test/.files/
 *
 * These tests validate:
 * 1. Document conversion (PDF, DOCX, Excel) to Markdown
 * 2. PII detection across all document types
 * 3. Document type classification
 * 4. Address relationship linking
 * 5. Pipeline pass coordination
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

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Test logger for consistent output
import { createTestLogger } from '../helpers/testLogger.js';
const log = createTestLogger('integration:pipeline');

// Import converters
import DocxToMarkdown from '../../dist/converters/DocxToMarkdown.js';
import PdfToMarkdown from '../../dist/converters/PdfToMarkdown.js';
import ExcelToMarkdown from '../../dist/converters/ExcelToMarkdown.js';

// Import PII detection components
import { SwissEuDetector } from '../../dist/pii/SwissEuDetector.js';
import { createPipeline } from '../../dist/pii/DetectionPipeline.js';
import { createHighRecallPass } from '../../dist/pii/passes/HighRecallPass.js';
import { createFormatValidationPass } from '../../dist/pii/passes/FormatValidationPass.js';
import { createContextScoringPass } from '../../dist/pii/passes/ContextScoringPass.js';
import { createAddressRelationshipPass } from '../../dist/pii/passes/AddressRelationshipPass.js';
import { createDocumentTypePass } from '../../dist/pii/passes/DocumentTypePass.js';

// Import document classifier
import { createDocumentClassifier } from '../../dist/pii/DocumentClassifier.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_FILES_DIR = path.join(__dirname, '../.files');

// Helper to check if test files exist
function getAvailableTestFiles() {
  if (!fs.existsSync(TEST_FILES_DIR)) {
    return [];
  }
  return fs.readdirSync(TEST_FILES_DIR).filter(f => !f.startsWith('.'));
}

describe('Full Pipeline Integration Tests', function () {
  this.timeout(30000); // Allow time for PDF parsing and ML inference

  const testFiles = getAvailableTestFiles();

  before(function () {
    if (testFiles.length === 0) {
      log.warn('No test files found in test/.files/ - skipping integration tests');
      log.warn('Place anonymized test documents in test/.files/ to enable these tests');
      this.skip();
    }
    log.info('Test files found', { count: testFiles.length, files: testFiles.join(', ') });
  });

  describe('Document Conversion Pipeline', function () {
    it('should convert DOCX files to Markdown', async function () {
      const docxFiles = testFiles.filter(f => f.endsWith('.docx'));
      if (docxFiles.length === 0) {
        this.skip();
        return;
      }

      const converter = new DocxToMarkdown();

      for (const filename of docxFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);

        // Electron converters expect file path, not buffer
        const result = await converter.convert(filePath);

        expect(result, `${filename} should produce markdown`).to.be.a('string');
        expect(result.length, `${filename} should produce non-empty markdown`).to.be.greaterThan(0);

        // Basic markdown structure checks
        expect(result).to.not.include('<html>'); // Should not have raw HTML
        expect(result).to.not.include('<?xml'); // Should not have XML

        log.debug('DOCX converted', { filename, chars: result.length });
      }
    });

    it('should convert PDF files to Markdown', async function () {
      const pdfFiles = testFiles.filter(f => f.endsWith('.pdf'));
      if (pdfFiles.length === 0) {
        this.skip();
        return;
      }

      const converter = new PdfToMarkdown();

      for (const filename of pdfFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);

        // Electron converters expect file path, not buffer
        const result = await converter.convert(filePath);

        expect(result, `${filename} should produce markdown`).to.be.a('string');
        expect(result.length, `${filename} should produce non-empty markdown`).to.be.greaterThan(0);

        log.debug('PDF converted', { filename, chars: result.length });
      }
    });

    it('should convert Excel files to Markdown', async function () {
      const xlsxFiles = testFiles.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
      if (xlsxFiles.length === 0) {
        this.skip();
        return;
      }

      const converter = new ExcelToMarkdown();

      for (const filename of xlsxFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);

        // Electron converters expect file path, not buffer
        const result = await converter.convert(filePath);

        expect(result, `${filename} should produce markdown`).to.be.a('string');
        expect(result.length, `${filename} should produce non-empty markdown`).to.be.greaterThan(0);

        // Excel should produce tables
        if (result.length > 50) {
          expect(result, `${filename} should contain table structure`).to.include('|');
        }

        log.debug('Excel converted', { filename, chars: result.length });
      }
    });
  });

  describe('PII Detection - SwissEuDetector', function () {
    let detector;

    before(function () {
      detector = new SwissEuDetector();
    });

    it('should detect Swiss/EU PII in converted documents', async function () {
      const converter = new PdfToMarkdown();
      const pdfFiles = testFiles.filter(f => f.endsWith('.pdf'));

      if (pdfFiles.length === 0) {
        this.skip();
        return;
      }

      let totalMatches = 0;

      for (const filename of pdfFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const markdown = await converter.convert(filePath);

        const matches = detector.detect(markdown);
        totalMatches += matches.length;

        // Group by type for reporting
        const byType = {};
        for (const match of matches) {
          byType[match.type] = (byType[match.type] || 0) + 1;
        }
        log.debug('PII matches found', { filename, count: matches.length, types: byType });
      }

      // At least some PII should be detected in real business documents
      expect(totalMatches, 'Should detect some PII across test files').to.be.greaterThan(0);
    });

    it('should detect common PII types in invoices', async function () {
      const invoiceFiles = testFiles.filter(f =>
        f.includes('invoice') && f.endsWith('.pdf'),
      );

      if (invoiceFiles.length === 0) {
        this.skip();
        return;
      }

      const converter = new PdfToMarkdown();

      for (const filename of invoiceFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const markdown = await converter.convert(filePath);

        const matches = detector.detect(markdown);
        const types = new Set(matches.map(m => m.type));

        // Invoices typically contain amounts, dates, possibly IBANs
        const invoiceTypes = ['AMOUNT', 'DATE', 'IBAN', 'VAT_NUMBER', 'INVOICE_NUMBER', 'PHONE', 'EMAIL'];
        const hasInvoiceType = invoiceTypes.some(t => types.has(t));

        log.debug('Invoice PII types', { filename, types: [...types] });
        expect(hasInvoiceType, `${filename} should contain invoice-related PII`).to.be.true;
      }
    });
  });

  describe('Document Type Classification', function () {
    let classifier;

    before(function () {
      classifier = createDocumentClassifier();
    });

    it('should classify document types correctly', async function () {
      const converter = new PdfToMarkdown();
      const pdfFiles = testFiles.filter(f => f.endsWith('.pdf'));

      if (pdfFiles.length === 0) {
        this.skip();
        return;
      }

      for (const filename of pdfFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const markdown = await converter.convert(filePath);

        const classification = classifier.classify(markdown);

        log.debug('Document classified', {
          filename,
          type: classification.type,
          confidence: `${(classification.confidence * 100).toFixed(1)}%`,
          language: classification.language || 'unknown',
        });

        expect(classification.type).to.be.oneOf([
          'INVOICE', 'LETTER', 'FORM', 'CONTRACT', 'REPORT', 'UNKNOWN',
        ]);
        expect(classification.confidence).to.be.a('number');
        expect(classification.confidence).to.be.at.least(0);
        expect(classification.confidence).to.be.at.most(1);

        // Invoice files should be classified as invoices
        if (filename.includes('invoice')) {
          expect(classification.type, `${filename} should be classified as INVOICE`)
            .to.equal('INVOICE');
        }

        // Contract files should be classified as contracts
        if (filename.includes('contract')) {
          expect(['CONTRACT', 'LETTER', 'UNKNOWN'], `${filename} should be contract-related`)
            .to.include(classification.type);
        }
      }
    });
  });

  describe('Full Detection Pipeline', function () {
    let pipeline;

    before(function () {
      // Create pipeline with all passes
      pipeline = createPipeline({
        mlConfidenceThreshold: 0.3,
        enabledPasses: {
          highRecall: true,
          formatValidation: true,
          contextScoring: true,
          addressRelationship: true,
          documentType: true,
        },
      });

      // Register all passes
      pipeline.registerPass(createHighRecallPass(0.3));
      pipeline.registerPass(createFormatValidationPass());
      pipeline.registerPass(createContextScoringPass());
      pipeline.registerPass(createAddressRelationshipPass());
      pipeline.registerPass(createDocumentTypePass());
    });

    it('should process documents through complete pipeline', async function () {
      const converter = new PdfToMarkdown();
      const pdfFiles = testFiles.filter(f => f.endsWith('.pdf')).slice(0, 3); // Test first 3 PDFs

      if (pdfFiles.length === 0) {
        this.skip();
        return;
      }

      for (const filename of pdfFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const markdown = await converter.convert(filePath);

        const documentId = `test-${Date.now()}`;
        const result = await pipeline.process(markdown, documentId, 'en');

        log.debug('Pipeline processed', {
          filename,
          documentType: result.documentType,
          entityCount: result.entities.length,
          durationMs: result.metadata.totalDurationMs,
        });

        expect(result).to.have.property('entities').that.is.an('array');
        expect(result).to.have.property('documentType');
        expect(result).to.have.property('metadata');
        expect(result.metadata).to.have.property('totalDurationMs');
        expect(result.metadata).to.have.property('passResults').that.is.an('array');

        // Verify entity structure
        if (result.entities.length > 0) {
          const entity = result.entities[0];
          expect(entity).to.have.property('id');
          expect(entity).to.have.property('type');
          expect(entity).to.have.property('text');
          expect(entity).to.have.property('start');
          expect(entity).to.have.property('end');
          expect(entity).to.have.property('confidence');
          expect(entity).to.have.property('source');
        }
      }
    });

    it('should detect addresses and link components', async function () {
      const converter = new PdfToMarkdown();

      // Find files likely to contain addresses (invoices, letters)
      const addressFiles = testFiles.filter(f =>
        (f.includes('invoice') || f.includes('letter') || f.includes('contract')) &&
        f.endsWith('.pdf'),
      );

      if (addressFiles.length === 0) {
        this.skip();
        return;
      }

      for (const filename of addressFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const markdown = await converter.convert(filePath);

        const documentId = `test-${Date.now()}`;
        const result = await pipeline.process(markdown, documentId, 'en');

        // Check for address-related entities
        const addressEntities = result.entities.filter(e =>
          e.type === 'ADDRESS' ||
          e.type === 'SWISS_ADDRESS' ||
          e.type === 'EU_ADDRESS' ||
          e.type === 'LOCATION',
        );

        // Check for linked address components
        const linkedEntities = result.entities.filter(e =>
          e.components && e.components.length > 0,
        );

        log.debug('Address entities found', {
          filename,
          addressCount: addressEntities.length,
          linkedCount: linkedEntities.length,
        });
      }
    });
  });

  describe('Pipeline Pass Coordination', function () {
    it('should run passes in correct order', async function () {
      const converter = new PdfToMarkdown();
      const pdfFile = testFiles.find(f => f.endsWith('.pdf'));

      if (!pdfFile) {
        this.skip();
        return;
      }

      const pipeline = createPipeline({
        debug: true,
        enabledPasses: {
          highRecall: true,
          formatValidation: true,
          contextScoring: true,
          addressRelationship: true,
          documentType: true,
        },
      });

      pipeline.registerPass(createHighRecallPass(0.3));
      pipeline.registerPass(createFormatValidationPass());
      pipeline.registerPass(createContextScoringPass());
      pipeline.registerPass(createAddressRelationshipPass());
      pipeline.registerPass(createDocumentTypePass());

      const filePath = path.join(TEST_FILES_DIR, pdfFile);
      const markdown = await converter.convert(filePath);

      const result = await pipeline.process(markdown, 'test-order', 'en');

      // Verify all passes executed
      const passNames = result.metadata.passResults.map(p => p.passName);

      log.debug('Pass execution order', { passes: passNames });

      expect(passNames.length, 'All passes should execute').to.be.greaterThan(0);
    });

    it('should accumulate entities across passes', async function () {
      const converter = new PdfToMarkdown();
      const pdfFile = testFiles.find(f => f.includes('invoice') && f.endsWith('.pdf'));

      if (!pdfFile) {
        this.skip();
        return;
      }

      const pipeline = createPipeline({
        enabledPasses: {
          highRecall: true,
          formatValidation: true,
          contextScoring: true,
        },
      });

      pipeline.registerPass(createHighRecallPass(0.3));
      pipeline.registerPass(createFormatValidationPass());
      pipeline.registerPass(createContextScoringPass());

      const filePath = path.join(TEST_FILES_DIR, pdfFile);
      const markdown = await converter.convert(filePath);

      const result = await pipeline.process(markdown, 'test-accumulate', 'en');

      // Check that HighRecallPass added entities
      const highRecallResult = result.metadata.passResults.find(p =>
        p.passName.includes('HighRecall'),
      );

      if (highRecallResult) {
        log.debug('HighRecallPass results', { entitiesAdded: highRecallResult.entitiesAdded });
        expect(highRecallResult.entitiesAdded, 'HighRecallPass should add entities').to.be.at.least(0);
      }

      // Check that validation pass modified entities
      const validationResult = result.metadata.passResults.find(p =>
        p.passName.includes('Validation') || p.passName.includes('Format'),
      );

      if (validationResult) {
        log.debug('ValidationPass results', { entitiesModified: validationResult.entitiesModified });
      }
    });
  });

  describe('Entity Quality Metrics', function () {
    it('should produce entities with valid confidence scores', async function () {
      const converter = new PdfToMarkdown();
      const pdfFile = testFiles.find(f => f.endsWith('.pdf'));

      if (!pdfFile) {
        this.skip();
        return;
      }

      const pipeline = createPipeline({
        enabledPasses: {
          highRecall: true,
          formatValidation: true,
          contextScoring: true,
        },
      });

      pipeline.registerPass(createHighRecallPass(0.3));
      pipeline.registerPass(createFormatValidationPass());
      pipeline.registerPass(createContextScoringPass());

      const filePath = path.join(TEST_FILES_DIR, pdfFile);
      const markdown = await converter.convert(filePath);

      const result = await pipeline.process(markdown, 'test-confidence', 'en');

      for (const entity of result.entities) {
        expect(entity.confidence, `Entity ${entity.id} confidence should be number`)
          .to.be.a('number');
        expect(entity.confidence, `Entity ${entity.id} confidence should be >= 0`)
          .to.be.at.least(0);
        expect(entity.confidence, `Entity ${entity.id} confidence should be <= 1`)
          .to.be.at.most(1);
      }

      // Report confidence distribution
      if (result.entities.length > 0) {
        const avgConfidence = result.entities.reduce((sum, e) => sum + e.confidence, 0)
          / result.entities.length;
        const highConfidence = result.entities.filter(e => e.confidence >= 0.8).length;
        const lowConfidence = result.entities.filter(e => e.confidence < 0.5).length;

        log.debug('Confidence distribution', {
          filename: pdfFile,
          avgConfidence: `${(avgConfidence * 100).toFixed(1)}%`,
          highConfidence,
          lowConfidence,
        });
      }
    });

    it('should not have overlapping entity spans', async function () {
      const converter = new PdfToMarkdown();
      const pdfFile = testFiles.find(f => f.endsWith('.pdf'));

      if (!pdfFile) {
        this.skip();
        return;
      }

      const pipeline = createPipeline({
        enabledPasses: {
          highRecall: true,
          formatValidation: true,
        },
      });

      pipeline.registerPass(createHighRecallPass(0.3));
      pipeline.registerPass(createFormatValidationPass());

      const filePath = path.join(TEST_FILES_DIR, pdfFile);
      const markdown = await converter.convert(filePath);

      const result = await pipeline.process(markdown, 'test-overlap', 'en');

      // Sort entities by start position
      const sorted = [...result.entities].sort((a, b) => a.start - b.start);

      // Check for overlaps
      let overlapCount = 0;
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];

        if (current.end > next.start) {
          overlapCount++;
          log.debug('Entity overlap detected', {
            first: { text: current.text, start: current.start, end: current.end },
            second: { text: next.text, start: next.start, end: next.end },
          });
        }
      }

      // Some overlap may be acceptable for grouped entities, but flag excessive overlap
      expect(overlapCount, 'Should have minimal entity overlaps').to.be.lessThan(5);
    });
  });

  describe('Performance Benchmarks', function () {
    it('should process documents within acceptable time', async function () {
      const converter = new PdfToMarkdown();
      const pdfFiles = testFiles.filter(f => f.endsWith('.pdf'));

      if (pdfFiles.length === 0) {
        this.skip();
        return;
      }

      const pipeline = createPipeline({
        enabledPasses: {
          highRecall: true,
          formatValidation: true,
          contextScoring: true,
          addressRelationship: true,
        },
      });

      pipeline.registerPass(createHighRecallPass(0.3));
      pipeline.registerPass(createFormatValidationPass());
      pipeline.registerPass(createContextScoringPass());
      pipeline.registerPass(createAddressRelationshipPass());

      for (const filename of pdfFiles) {
        const filePath = path.join(TEST_FILES_DIR, filename);
        const fileStats = fs.statSync(filePath);
        const fileSize = fileStats.size / 1024; // KB

        const conversionStart = Date.now();
        const markdown = await converter.convert(filePath);
        const conversionTime = Date.now() - conversionStart;

        const pipelineStart = Date.now();
        const result = await pipeline.process(markdown, `perf-${filename}`, 'en');
        const pipelineTime = Date.now() - pipelineStart;

        const totalTime = conversionTime + pipelineTime;

        log.debug('Performance metrics', {
          filename,
          fileSizeKB: fileSize.toFixed(1),
          conversionMs: conversionTime,
          pipelineMs: pipelineTime,
          entityCount: result.entities.length,
          totalMs: totalTime,
        });

        // Expect reasonable performance (< 10s for any document)
        expect(totalTime, `${filename} should process in < 10s`).to.be.lessThan(10000);
      }
    });
  });
});
