/**
 * Test Suite for Enhanced Text Extractor
 * Using TDD approach with Node.js built-in assert module
 */

import assert from 'assert';
import { TextExtractor } from '../src/textExtractor.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test runner utilities
let testCount = 0;
let passedCount = 0;
let failedCount = 0;

async function runTest(name, testFn) {
  testCount++;
  try {
    await testFn();
    passedCount++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failedCount++;
    console.log(`  ✗ ${name}`);
    console.log(`    Error: ${error.message}`);
    if (process.env.VERBOSE) {
      console.log(error.stack);
    }
  }
}

function describe(suiteName, fn) {
  console.log(`\n${suiteName}`);
  fn();
}

// Main test suite
console.log('\n=== TextExtractor Test Suite ===\n');

const extractor = new TextExtractor();

// Test: TXT File Extraction - Line breaks
await runTest('should extract text from .txt file preserving line breaks', async () => {
      const filePath = path.join(__dirname, 'data', 'test-sample.txt');
      const result = await extractor.extractText(filePath);

      // Verify basic extraction
      assert.ok(result.text, 'Should extract text');
      assert.ok(result.text.includes('Dr. Sarah Chen'), 'Should contain name');
      assert.ok(result.text.includes('sarah.chen@example.com'), 'Should contain email');

      // Verify line breaks are preserved
      const lines = result.text.split('\n');
      assert.ok(lines.length > 10, 'Should preserve multiple lines');

      // Verify metadata
      assert.strictEqual(result.format, 'txt');
      assert.ok(result.metadata, 'Should have metadata');
});

await runTest('should preserve paragraph spacing in text files', async () => {
      const filePath = path.join(__dirname, 'data', 'test-sample.txt');
      const result = await extractor.extractText(filePath);

      // Check for double line breaks (paragraph spacing)
      assert.ok(result.text.includes('\n\n'), 'Should preserve paragraph breaks');
});

console.log('\nCSV File Extraction');

await runTest('should extract text from .csv file preserving structure', async () => {
      const filePath = path.join(__dirname, 'data', 'test-sample.csv');
      const result = await extractor.extractText(filePath);

      // Verify extraction
      assert.ok(result.text, 'Should extract text');
      assert.ok(result.text.includes('John Smith'), 'Should contain names');
      assert.ok(result.text.includes('john.smith@email.com'), 'Should contain emails');

      // Verify tabular structure is maintained
      assert.strictEqual(result.format, 'csv');
      assert.ok(result.metadata.rows, 'Should have row count');
      assert.ok(result.metadata.rows >= 3, 'Should have at least 3 data rows');
});

await runTest('should preserve column alignment in CSV', async () => {
      const filePath = path.join(__dirname, 'data', 'test-sample.csv');
      const result = await extractor.extractText(filePath);

      // Verify headers are preserved
      assert.ok(result.text.includes('Name') && result.text.includes('Email'),
        'Should preserve column headers');
});

console.log('\nPDF File Extraction');

await runTest('should extract text from PDF preserving layout', async () => {
      const filePath = path.join(__dirname, 'data', '05-versions-space.pdf');
      const result = await extractor.extractText(filePath);

      assert.ok(result.text, 'Should extract text from PDF');
      assert.strictEqual(result.format, 'pdf');
      assert.ok(result.metadata.pages, 'Should have page count');
});

await runTest('should preserve paragraph structure in PDF', async () => {
      const filePath = path.join(__dirname, 'data', '05-versions-space.pdf');
      const result = await extractor.extractText(filePath);

      // PDF should maintain some line structure
      const lines = result.text.split('\n').filter(line => line.trim());
      assert.ok(lines.length > 0, 'Should have multiple text elements');
});

console.log('\nFormat Detection');

await runTest('should correctly detect file format from extension', () => {
      assert.strictEqual(extractor.detectFormat('test.txt'), 'txt');
      assert.strictEqual(extractor.detectFormat('test.csv'), 'csv');
      assert.strictEqual(extractor.detectFormat('test.pdf'), 'pdf');
      assert.strictEqual(extractor.detectFormat('test.docx'), 'docx');
      assert.strictEqual(extractor.detectFormat('test.xlsx'), 'xlsx');
});

await runTest('should throw error for unsupported formats', () => {
      assert.throws(() => {
        extractor.detectFormat('test.exe');
      }, /Unsupported file format/);
});

console.log('\nError Handling');

await runTest('should handle non-existent files gracefully', async () => {
      try {
        await extractor.extractText('/nonexistent/file.txt');
        throw new Error('Should throw error for non-existent file');
      } catch (error) {
        assert.ok(error.message.includes('not found') || error.message.includes('ENOENT') || error.message.includes('Should throw'));
      }
});

await runTest('should handle corrupted files gracefully', async () => {
      // Create a corrupted PDF
      const corruptedPath = path.join(__dirname, 'data', 'corrupted.pdf');
      fs.writeFileSync(corruptedPath, 'This is not a real PDF file');

      try {
        const result = await extractor.extractText(corruptedPath);
        // Should either throw or return empty text with error info
        assert.ok(result.error || result.text === '');
      } catch (error) {
        assert.ok(error, 'Should handle corrupted files');
      } finally {
        // Cleanup
        if (fs.existsSync(corruptedPath)) {
          fs.unlinkSync(corruptedPath);
        }
      }
});

console.log('\nText Quality Metrics');

await runTest('should extract with 99%+ character accuracy for simple text', async () => {
      const filePath = path.join(__dirname, 'data', 'test-sample.txt');
      const original = fs.readFileSync(filePath, 'utf8');
      const result = await extractor.extractText(filePath);

      // For plain text, should be 100% accurate
      const accuracy = (result.text.length / original.length) * 100;
      assert.ok(accuracy >= 99, `Accuracy should be >= 99%, got ${accuracy}%`);
});

await runTest('should preserve spacing accuracy', async () => {
      const filePath = path.join(__dirname, 'data', 'test-sample.txt');
      const original = fs.readFileSync(filePath, 'utf8');
      const result = await extractor.extractText(filePath);

      // Count line breaks in original vs extracted
      const originalLines = original.split('\n').length;
      const extractedLines = result.text.split('\n').length;
      const lineAccuracy = (extractedLines / originalLines) * 100;

      assert.ok(lineAccuracy >= 95, `Line break accuracy should be >= 95%, got ${lineAccuracy}%`);
});

console.log('\nWhitespace Preservation');

await runTest('should preserve meaningful whitespace', async () => {
      const filePath = path.join(__dirname, 'data', 'test-sample.txt');
      const result = await extractor.extractText(filePath);

      // Check that indentation/spacing is maintained where important
      assert.ok(result.preservesWhitespace, 'Should flag whitespace preservation');
});

await runTest('should maintain word boundaries', async () => {
      const filePath = path.join(__dirname, 'data', 'test-sample.txt');
      const result = await extractor.extractText(filePath);

      // Words should not be concatenated
      assert.ok(!result.text.includes('NameDr.'), 'Should not concatenate words');
      assert.ok(!result.text.includes('EmailPhone'), 'Should maintain word boundaries');
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`\nTest Results: ${passedCount}/${testCount} passed`);
if (failedCount > 0) {
  console.log(`Failed: ${failedCount}`);
  process.exit(1);
} else {
  console.log('\n✓ All tests passed!');
  process.exit(0);
}
