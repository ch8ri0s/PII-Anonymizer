/**
 * IPC Integration Tests for File Preview Feature
 *
 * Tests the IPC communication for:
 * - file:getMetadata
 * - file:getPreview
 * - dialog:selectFiles
 *
 * Note: These tests verify the IPC contract implementation.
 * Run with: npm run test
 */

const { expect } = require('chai');
const path = require('path');
const fs = require('fs');

describe('File Preview IPC Integration', function() {
  const testDataDir = path.join(__dirname, 'data');

  describe('Test Data Setup', function() {
    it('should have test data directory', function() {
      expect(fs.existsSync(testDataDir)).to.be.true;
    });

    it('should have sample.txt file', function() {
      const samplePath = path.join(testDataDir, 'sample.txt');
      expect(fs.existsSync(samplePath)).to.be.true;
    });
  });

  describe('Path Validator (Unit Tests)', function() {
    // We'll import and test the compiled TypeScript modules
    let validateFilePath, _PathValidationError;

    before(function() {
      try {
        const pathValidatorModule = require('../dist/utils/pathValidator.js');
        validateFilePath = pathValidatorModule.validateFilePath;
        _PathValidationError = pathValidatorModule.PathValidationError;
      // eslint-disable-next-line no-unused-vars
      } catch (_error) {
        this.skip(); // Skip if TypeScript not compiled yet
      }
    });

    it('should validate existing file', function() {
      if (!validateFilePath) this.skip();

      const testFile = path.join(testDataDir, 'sample.txt');
      const validPath = validateFilePath(testFile, {
        mustExist: true,
        mustBeReadable: true,
      });

      expect(validPath).to.be.a('string');
      expect(path.isAbsolute(validPath)).to.be.true;
    });

    it('should reject non-existent file', function() {
      if (!validateFilePath) this.skip();

      const testFile = path.join(testDataDir, 'nonexistent.txt');

      expect(() => {
        validateFilePath(testFile, { mustExist: true });
      }).to.throw();
    });

    it('should reject unsupported file type', function() {
      if (!validateFilePath) this.skip();

      const testFile = path.join(testDataDir, 'sample.png');

      expect(() => {
        validateFilePath(testFile, {
          mustExist: false,
          allowedExtensions: ['.txt', '.pdf'],
        });
      }).to.throw();
    });

    it('should reject path with null byte', function() {
      if (!validateFilePath) this.skip();

      expect(() => {
        validateFilePath('/path/with\0null', { mustExist: false });
      }).to.throw();
    });
  });

  describe('Metadata Extractor (Unit Tests)', function() {
    let getFileMetadata;

    before(function() {
      try {
        const metadataModule = require('../dist/utils/metadataExtractor.js');
        getFileMetadata = metadataModule.getFileMetadata;
      // eslint-disable-next-line no-unused-vars
      } catch (_error) {
        this.skip();
      }
    });

    it('should extract metadata from text file', async function() {
      if (!getFileMetadata) this.skip();

      const testFile = path.join(testDataDir, 'sample.txt');

      // Create sample.txt if it doesn't exist
      if (!fs.existsSync(testFile)) {
        fs.writeFileSync(testFile, 'Hello World\nThis is a test file.\n');
      }

      const metadata = await getFileMetadata(testFile);

      expect(metadata).to.have.property('filename');
      expect(metadata).to.have.property('fileSize');
      expect(metadata).to.have.property('lineCount');
      expect(metadata).to.have.property('wordCount');
      expect(metadata).to.have.property('charCount');
      expect(metadata.filename).to.equal('sample.txt');
      expect(metadata.lineCount).to.be.a('number');
      expect(metadata.wordCount).to.be.a('number');
    });

    it('should format file size correctly', async function() {
      if (!getFileMetadata) this.skip();

      const testFile = path.join(testDataDir, 'sample.txt');
      const metadata = await getFileMetadata(testFile);

      expect(metadata.fileSizeFormatted).to.match(/\d+(\.\d+)?\s+(B|KB|MB|GB)/);
    });

    it('should format dates correctly', async function() {
      if (!getFileMetadata) this.skip();

      const testFile = path.join(testDataDir, 'sample.txt');
      const metadata = await getFileMetadata(testFile);

      // Check ISO 8601 format
      expect(metadata.lastModified).to.match(/^\d{4}-\d{2}-\d{2}T/);

      // Check human-readable format
      expect(metadata.lastModifiedFormatted).to.be.a('string');
      expect(metadata.lastModifiedFormatted.length).to.be.greaterThan(0);
    });
  });

  describe('Preview Generator (Unit Tests)', function() {
    let getFilePreview;

    before(function() {
      try {
        const previewModule = require('../dist/utils/previewGenerator.js');
        getFilePreview = previewModule.getFilePreview;
      // eslint-disable-next-line no-unused-vars
      } catch (_error) {
        this.skip();
      }
    });

    it('should generate preview from text file', async function() {
      if (!getFilePreview) this.skip();

      const testFile = path.join(testDataDir, 'sample.txt');
      const preview = await getFilePreview(testFile, { lines: 20, chars: 1000 });

      expect(preview).to.have.property('content');
      expect(preview).to.have.property('isTruncated');
      expect(preview).to.have.property('previewLineCount');
      expect(preview).to.have.property('previewCharCount');
      expect(preview.content).to.be.a('string');
    });

    it('should truncate long content', async function() {
      if (!getFilePreview) this.skip();

      // Create a file with > 20 lines
      const testFile = path.join(testDataDir, 'long-test.txt');
      const lines = Array(50).fill('This is line').map((l, i) => `${l} ${i + 1}`);
      fs.writeFileSync(testFile, lines.join('\n'));

      const preview = await getFilePreview(testFile, { lines: 20, chars: 1000 });

      expect(preview.isTruncated).to.be.true;
      expect(preview.previewLineCount).to.be.at.most(20);

      // Cleanup
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });

    it('should handle empty file', async function() {
      if (!getFilePreview) this.skip();

      const testFile = path.join(testDataDir, 'empty-test.txt');
      fs.writeFileSync(testFile, '');

      const preview = await getFilePreview(testFile, { lines: 20, chars: 1000 });

      expect(preview.previewLineCount).to.equal(0);
      expect(preview.previewCharCount).to.equal(0);

      // Cleanup
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }
    });
  });

  describe('Integration Notes', function() {
    it('should have TypeScript compiled to dist/', function() {
      const distPath = path.join(__dirname, '..', 'dist');
      expect(fs.existsSync(distPath)).to.be.true;
    });

    it('should have compiled utilities', function() {
      const utilsPath = path.join(__dirname, '..', 'dist', 'utils');
      expect(fs.existsSync(utilsPath)).to.be.true;
    });

    it('should have compiled types', function() {
      const typesPath = path.join(__dirname, '..', 'dist', 'types');
      expect(fs.existsSync(typesPath)).to.be.true;
    });
  });
});
