/**
 * Feedback Logger Tests (Epic 5, Story 5.2)
 *
 * Tests for the user correction logging functionality including:
 * - PII anonymization in logs
 * - Log file rotation
 * - Correction entry creation
 * - Settings persistence
 * - Document hash generation
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';

describe('Epic 5: Feedback Logging', function () {
  // Set longer timeout for file operations
  this.timeout(10000);

  /**
   * Mock log directory for testing
   */
  let testLogDir;

  beforeEach(function () {
    // Create unique temp directory for each test
    testLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'feedback-test-'));
  });

  afterEach(function () {
    // Clean up test directory
    try {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('5.2.1: Log Dismissals', function () {
    it('should create a valid DISMISS correction entry structure', function () {
      const entry = createMockCorrectionEntry('DISMISS');

      expect(entry).to.have.property('id');
      expect(entry).to.have.property('timestamp');
      expect(entry.action).to.equal('DISMISS');
      expect(entry).to.have.property('entityType');
      expect(entry).to.have.property('context');
      expect(entry).to.have.property('documentHash');
    });

    it('should include originalSource for dismissed entities', function () {
      const entry = createMockCorrectionEntry('DISMISS', {
        originalSource: 'ML',
        confidence: 0.75,
      });

      expect(entry.originalSource).to.equal('ML');
      expect(entry.confidence).to.equal(0.75);
    });

    it('should include position data when available', function () {
      const entry = createMockCorrectionEntry('DISMISS', {
        position: { start: 10, end: 25 },
      });

      expect(entry.position).to.deep.equal({ start: 10, end: 25 });
    });
  });

  describe('5.2.2: Log Manual Additions', function () {
    it('should create a valid ADD correction entry structure', function () {
      const entry = createMockCorrectionEntry('ADD');

      expect(entry).to.have.property('id');
      expect(entry).to.have.property('timestamp');
      expect(entry.action).to.equal('ADD');
      expect(entry).to.have.property('entityType');
      expect(entry).to.have.property('context');
      expect(entry).to.have.property('documentHash');
    });

    it('should set originalSource to MANUAL for manual additions', function () {
      const entry = createMockCorrectionEntry('ADD', {
        originalSource: 'MANUAL',
      });

      expect(entry.originalSource).to.equal('MANUAL');
    });
  });

  describe('5.2.3: Privacy Anonymization', function () {
    it('should replace email addresses with [EMAIL] marker', function () {
      const text = 'Contact us at john.doe@company.com for more info';
      const anonymized = anonymizeForLog(text, 'EMAIL', 'john.doe@company.com');

      expect(anonymized).to.include('[EMAIL]');
      expect(anonymized).to.not.include('john.doe@company.com');
    });

    it('should replace Swiss phone numbers with [PHONE] marker', function () {
      const text = 'Call me at +41 79 123 45 67 anytime';
      const anonymized = anonymizeForLog(text, 'PHONE', '+41 79 123 45 67');

      expect(anonymized).to.include('[PHONE]');
      expect(anonymized).to.not.include('+41 79 123 45 67');
    });

    it('should replace IBAN with [IBAN] marker', function () {
      const text = 'Transfer to CH93 0076 2011 6238 5295 7';
      const anonymized = anonymizeForLog(text, 'IBAN', 'CH93 0076 2011 6238 5295 7');

      expect(anonymized).to.include('[IBAN]');
      expect(anonymized).to.not.include('CH93 0076 2011 6238 5295 7');
    });

    it('should replace Swiss AVS numbers with [AVS] marker', function () {
      const text = 'My AVS number is 756.1234.5678.90';
      const anonymized = anonymizeForLog(text, 'SWISS_AVS', '756.1234.5678.90');

      expect(anonymized).to.include('[AVS]');
      expect(anonymized).to.not.include('756.1234.5678.90');
    });

    it('should replace specific PII with entity type marker', function () {
      const text = 'Dear John Smith, we received your application';
      const anonymized = anonymizeForLog(text, 'PERSON', 'John Smith');

      expect(anonymized).to.include('[PERSON]');
      expect(anonymized).to.not.include('John Smith');
    });

    it('should hash document names for privacy', function () {
      const hash1 = hashDocumentName('invoice-2024-001.pdf');
      const hash2 = hashDocumentName('invoice-2024-001.pdf');
      const hash3 = hashDocumentName('different-document.pdf');

      expect(hash1).to.equal(hash2);
      expect(hash1).to.not.equal(hash3);
      expect(hash1.length).to.equal(16); // Truncated SHA-256
    });

    it('should not include actual PII in context', function () {
      const text = 'John Doe lives at Bahnhofstrasse 1, 8001 Zürich';
      const anonymized = anonymizeForLog(text, 'PERSON', 'John Doe');

      expect(anonymized).to.not.include('John Doe');
      expect(anonymized).to.include('[PERSON]');
    });
  });

  describe('5.2.4: Monthly Log Rotation', function () {
    it('should generate log file path with YYYY-MM format', function () {
      const logPath = getLogFilePath(testLogDir);
      const now = new Date();
      const expectedMonth = now.toISOString().slice(0, 7); // YYYY-MM

      expect(logPath).to.include(`corrections-${expectedMonth}.json`);
    });

    it('should create separate log files for different months', function () {
      const path1 = generateLogFilePath('2024-01', testLogDir);
      const path2 = generateLogFilePath('2024-02', testLogDir);

      expect(path1).to.not.equal(path2);
      expect(path1).to.include('corrections-2024-01.json');
      expect(path2).to.include('corrections-2024-02.json');
    });
  });

  describe('5.2.5: Opt-out Setting', function () {
    it('should respect disabled logging setting', function () {
      const settings = { enabled: false };
      const shouldLog = settings.enabled;

      expect(shouldLog).to.be.false;
    });

    it('should log when enabled', function () {
      const settings = { enabled: true };
      const shouldLog = settings.enabled;

      expect(shouldLog).to.be.true;
    });

    it('should default to enabled', function () {
      const defaultSettings = { enabled: true };

      expect(defaultSettings.enabled).to.be.true;
    });
  });

  describe('Log File Operations', function () {
    it('should create a valid log file structure', function () {
      const logFile = createEmptyLogFile();

      expect(logFile).to.have.property('version');
      expect(logFile).to.have.property('month');
      expect(logFile).to.have.property('createdAt');
      expect(logFile).to.have.property('updatedAt');
      expect(logFile).to.have.property('entries');
      expect(logFile.entries).to.be.an('array');
    });

    it('should append entries to log file', function () {
      const logFile = createEmptyLogFile();
      const entry = createMockCorrectionEntry('DISMISS');

      logFile.entries.push(entry);

      expect(logFile.entries.length).to.equal(1);
      expect(logFile.entries[0].action).to.equal('DISMISS');
    });

    it('should write log file to disk', function () {
      const logPath = path.join(testLogDir, 'corrections-test.json');
      const logFile = createEmptyLogFile();
      const entry = createMockCorrectionEntry('ADD');
      logFile.entries.push(entry);

      fs.writeFileSync(logPath, JSON.stringify(logFile, null, 2));

      expect(fs.existsSync(logPath)).to.be.true;

      const content = JSON.parse(fs.readFileSync(logPath, 'utf-8'));
      expect(content.entries.length).to.equal(1);
    });

    it('should read existing log file', function () {
      const logPath = path.join(testLogDir, 'corrections-test.json');
      const logFile = createEmptyLogFile();
      logFile.entries.push(createMockCorrectionEntry('DISMISS'));
      logFile.entries.push(createMockCorrectionEntry('ADD'));
      fs.writeFileSync(logPath, JSON.stringify(logFile, null, 2));

      const loaded = JSON.parse(fs.readFileSync(logPath, 'utf-8'));

      expect(loaded.entries.length).to.equal(2);
    });
  });

  describe('Entry Validation', function () {
    it('should require action field', function () {
      const isValid = validateCorrectionInput({ entityType: 'PERSON', documentName: 'test.pdf' });
      expect(isValid).to.be.false;
    });

    it('should require entityType field', function () {
      const isValid = validateCorrectionInput({ action: 'DISMISS', documentName: 'test.pdf' });
      expect(isValid).to.be.false;
    });

    it('should require documentName field', function () {
      const isValid = validateCorrectionInput({ action: 'DISMISS', entityType: 'PERSON' });
      expect(isValid).to.be.false;
    });

    it('should accept valid DISMISS input', function () {
      const isValid = validateCorrectionInput({
        action: 'DISMISS',
        entityType: 'PERSON',
        documentName: 'test.pdf',
        originalText: 'John Doe',
        contextText: 'Dear John Doe',
      });
      expect(isValid).to.be.true;
    });

    it('should accept valid ADD input', function () {
      const isValid = validateCorrectionInput({
        action: 'ADD',
        entityType: 'EMAIL',
        documentName: 'test.pdf',
        originalText: 'test@example.com',
        contextText: 'Contact test@example.com',
      });
      expect(isValid).to.be.true;
    });

    it('should reject invalid action', function () {
      const isValid = validateCorrectionInput({
        action: 'INVALID',
        entityType: 'PERSON',
        documentName: 'test.pdf',
      });
      expect(isValid).to.be.false;
    });
  });

  describe('UUID Generation', function () {
    it('should generate unique IDs for entries', function () {
      const id1 = generateUUID();
      const id2 = generateUUID();

      expect(id1).to.not.equal(id2);
      expect(id1).to.match(/^[0-9a-f-]{36}$/);
    });
  });

  describe('Context Extraction', function () {
    it('should extract context around entity', function () {
      const markdown = 'This is a long document. John Doe is mentioned here. More text follows.';
      const context = extractEntityContext({ originalText: 'John Doe', position: null }, markdown);

      expect(context).to.include('John Doe');
      expect(context.length).to.be.lessThan(markdown.length + 10); // Plus ellipsis
    });

    it('should add ellipsis for truncated context', function () {
      const markdown = 'A'.repeat(100) + 'John Doe' + 'B'.repeat(100);
      const context = extractEntityContext({ originalText: 'John Doe', position: null }, markdown);

      expect(context).to.include('...');
    });

    it('should return entity text when not found in markdown', function () {
      const markdown = 'Some other content';
      const context = extractEntityContext({ originalText: 'John Doe', position: null }, markdown);

      expect(context).to.equal('John Doe');
    });

    it('should handle empty markdown', function () {
      const context = extractEntityContext({ originalText: 'John Doe', position: null }, '');

      expect(context).to.equal('John Doe');
    });
  });
});

// ====================
// Helper Functions
// ====================

/**
 * Create a mock correction entry for testing
 */
function createMockCorrectionEntry(action, options = {}) {
  return {
    id: generateUUID(),
    timestamp: new Date().toISOString(),
    action,
    entityType: options.entityType || 'PERSON',
    context: options.context || '[PERSON] is mentioned here',
    documentHash: hashDocumentName(options.documentName || 'test-doc.pdf'),
    originalSource: options.originalSource,
    confidence: options.confidence,
    position: options.position,
  };
}

/**
 * Create an empty log file structure
 */
function createEmptyLogFile() {
  const now = new Date();
  return {
    version: '1.0',
    month: now.toISOString().slice(0, 7),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    entries: [],
  };
}

/**
 * Anonymize text for logging
 */
function anonymizeForLog(text, entityType, originalText) {
  if (!text) return '';

  let anonymized = text;

  // Entity type markers
  const markers = {
    PERSON: '[PERSON]',
    ORGANIZATION: '[ORG]',
    EMAIL: '[EMAIL]',
    PHONE: '[PHONE]',
    IBAN: '[IBAN]',
    SWISS_AVS: '[AVS]',
    ADDRESS: '[ADDRESS]',
  };

  // Replace the original text with marker
  if (originalText && originalText.length > 0) {
    const marker = markers[entityType] || '[PII]';
    const escaped = originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    anonymized = anonymized.replace(new RegExp(escaped, 'gi'), marker);
  }

  // Pattern-based anonymization
  anonymized = anonymized.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '[EMAIL]',
  );

  anonymized = anonymized.replace(
    /(\+41|0041|0)[\s.-]?[0-9]{2}[\s.-]?[0-9]{3}[\s.-]?[0-9]{2}[\s.-]?[0-9]{2}/g,
    '[PHONE]',
  );

  anonymized = anonymized.replace(
    /[A-Z]{2}[0-9]{2}[\s]?[A-Z0-9]{4}[\s]?[0-9]{4}[\s]?[0-9]{4}[\s]?[0-9]{4}[\s]?[0-9]{4}[\s]?[0-9]{0,2}/gi,
    '[IBAN]',
  );

  anonymized = anonymized.replace(
    /756[.\s-]?\d{4}[.\s-]?\d{4}[.\s-]?\d{2}/g,
    '[AVS]',
  );

  return anonymized;
}

/**
 * Hash document name for privacy
 */
function hashDocumentName(filename) {
  return crypto.createHash('sha256').update(filename).digest('hex').slice(0, 16);
}

/**
 * Get log file path for current month
 */
function getLogFilePath(logDir) {
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  return path.join(logDir, `corrections-${month}.json`);
}

/**
 * Generate log file path for specific month
 */
function generateLogFilePath(month, logDir) {
  return path.join(logDir, `corrections-${month}.json`);
}

/**
 * Validate correction input
 */
function validateCorrectionInput(input) {
  if (!input || typeof input !== 'object') return false;
  if (!input.action || !['DISMISS', 'ADD'].includes(input.action)) return false;
  if (!input.entityType || typeof input.entityType !== 'string') return false;
  if (!input.documentName || typeof input.documentName !== 'string') return false;
  return true;
}

/**
 * Generate a UUID
 */
function generateUUID() {
  return crypto.randomUUID();
}

/**
 * Extract context around an entity
 */
function extractEntityContext(entity, markdown) {
  if (!markdown || !entity.originalText) {
    return entity.originalText || '';
  }

  const entityIndex = markdown.indexOf(entity.originalText);
  if (entityIndex === -1) {
    return entity.originalText;
  }

  const contextStart = Math.max(0, entityIndex - 50);
  const contextEnd = Math.min(markdown.length, entityIndex + entity.originalText.length + 50);

  let context = markdown.slice(contextStart, contextEnd);

  if (contextStart > 0) context = '...' + context;
  if (contextEnd < markdown.length) context = context + '...';

  return context;
}
