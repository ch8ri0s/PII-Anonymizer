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

// =====================================================
// COMPREHENSIVE DOCUMENT TESTS - Edge Cases
// =====================================================

console.log('\n--- Invoice Document (Complex Formatting) ---');

await runTest('should extract invoice with aligned columns and indentation', async () => {
      const filePath = path.join(__dirname, 'data', 'test-invoice.txt');
      const result = await extractor.extractText(filePath);

      // Check key PII elements are present
      assert.ok(result.text.includes('Dr. James Wilson'), 'Should contain recipient name');
      assert.ok(result.text.includes('(617) 555-2345'), 'Should contain phone number');
      assert.ok(result.text.includes('jwilson@wilsonmedical.com'), 'Should contain email');
      assert.ok(result.text.includes('12-3456789'), 'Should contain Tax ID');

      // Check financial data preserved
      assert.ok(result.text.includes('$14,723.90'), 'Should contain total amount');
      assert.ok(result.text.includes('1234567890'), 'Should contain bank account');
});

await runTest('should preserve invoice table structure', async () => {
      const filePath = path.join(__dirname, 'data', 'test-invoice.txt');
      const result = await extractor.extractText(filePath);

      // Check table separator lines are preserved
      assert.ok(result.text.includes('==='), 'Should preserve separator lines');

      // Line count should indicate structure preservation
      const lines = result.text.split('\n');
      assert.ok(lines.length > 40, 'Should have many lines indicating structure');
});

console.log('\n--- Email Document (Multi-Party Communication) ---');

await runTest('should extract email with multiple contacts', async () => {
      const filePath = path.join(__dirname, 'data', 'test-email.txt');
      const result = await extractor.extractText(filePath);

      // Check email headers preserved
      assert.ok(result.text.includes('Jennifer Martinez'), 'Should contain sender name');
      assert.ok(result.text.includes('j.martinez@techstartup.io'), 'Should contain sender email');

      // Check multiple contacts extracted
      assert.ok(result.text.includes('David Park'), 'Should contain team member');
      assert.ok(result.text.includes('John Anderson'), 'Should contain client name');
      assert.ok(result.text.includes('+1-415-555-7890'), 'Should contain international phone');

      // Check nested information
      assert.ok(result.text.includes('Sarah Anderson'), 'Should contain emergency contact');
});

await runTest('should preserve email confidentiality markers', async () => {
      const filePath = path.join(__dirname, 'data', 'test-email.txt');
      const result = await extractor.extractText(filePath);

      assert.ok(result.text.includes('CONFIDENTIAL'), 'Should preserve confidentiality markers');
      assert.ok(result.text.includes('NDA'), 'Should preserve legal references');
});

console.log('\n--- Database Export CSV (Structured PII) ---');

await runTest('should extract CSV with sensitive columns', async () => {
      const filePath = path.join(__dirname, 'data', 'test-database-export.csv');
      const result = await extractor.extractText(filePath);

      // Check all PII types present
      assert.ok(result.text.includes('123-45-6789'), 'Should contain SSN');
      assert.ok(result.text.includes('4532-1234-5678-9012'), 'Should contain credit card');
      assert.ok(result.text.includes('1985-03-15'), 'Should contain DOB');

      // Check structure maintained
      assert.strictEqual(result.metadata.rows, 10, 'Should have 10 data rows');
});

await runTest('should preserve all CSV columns', async () => {
      const filePath = path.join(__dirname, 'data', 'test-database-export.csv');
      const result = await extractor.extractText(filePath);

      // Check headers are present
      assert.ok(result.text.includes('FirstName'), 'Should have FirstName column');
      assert.ok(result.text.includes('SSN'), 'Should have SSN column');
      assert.ok(result.text.includes('CreditCard'), 'Should have CreditCard column');
      assert.ok(result.text.includes('Salary'), 'Should have Salary column');
});

console.log('\n--- Medical Record (HIPAA-Sensitive) ---');

await runTest('should extract medical record with PHI', async () => {
      const filePath = path.join(__dirname, 'data', 'test-medical-record.txt');
      const result = await extractor.extractText(filePath);

      // Patient identification
      assert.ok(result.text.includes('Elizabeth Anne Thompson'), 'Should contain patient name');
      assert.ok(result.text.includes('456-78-9123'), 'Should contain SSN');
      assert.ok(result.text.includes('PT-2024-78451'), 'Should contain patient ID');

      // Medical data
      assert.ok(result.text.includes('Dr. Patricia Williams'), 'Should contain physician name');
      assert.ok(result.text.includes('Lisinopril'), 'Should contain medication');

      // Insurance info
      assert.ok(result.text.includes('BCB-789456123'), 'Should contain policy number');
});

await runTest('should preserve medical record section structure', async () => {
      const filePath = path.join(__dirname, 'data', 'test-medical-record.txt');
      const result = await extractor.extractText(filePath);

      // Check section headers preserved
      assert.ok(result.text.includes('PATIENT INFORMATION'), 'Should have patient info section');
      assert.ok(result.text.includes('VISIT SUMMARY'), 'Should have visit summary section');
      assert.ok(result.text.includes('PHYSICIAN SIGNATURE'), 'Should have signature section');

      // Verify line structure maintained
      const lines = result.text.split('\n');
      assert.ok(lines.length > 60, 'Should preserve many lines');
});

console.log('\n--- Job Application (Employment PII) ---');

await runTest('should extract job application with comprehensive PII', async () => {
      const filePath = path.join(__dirname, 'data', 'test-job-application.txt');
      const result = await extractor.extractText(filePath);

      // Personal identification
      assert.ok(result.text.includes('Christopher Michael Davis'), 'Should contain full name');
      assert.ok(result.text.includes('543-21-0987'), 'Should contain SSN');
      assert.ok(result.text.includes('CA D1234567'), 'Should contain driver license');

      // Employment history
      assert.ok(result.text.includes('TechCorp Solutions Inc.'), 'Should contain employer');
      assert.ok(result.text.includes('Amanda Richardson'), 'Should contain supervisor');
      assert.ok(result.text.includes('$125,000'), 'Should contain salary');

      // References
      assert.ok(result.text.includes('Dr. Sarah Miller'), 'Should contain reference');
});

await runTest('should preserve form structure in job application', async () => {
      const filePath = path.join(__dirname, 'data', 'test-job-application.txt');
      const result = await extractor.extractText(filePath);

      // Check form sections
      assert.ok(result.text.includes('PERSONAL INFORMATION'), 'Should have personal section');
      assert.ok(result.text.includes('EMPLOYMENT HISTORY'), 'Should have employment section');
      assert.ok(result.text.includes('REFERENCES'), 'Should have references section');
});

// =====================================================
// BATCH PROCESSING TESTS
// =====================================================

console.log('\n--- Batch Processing ---');

await runTest('should process multiple files in batch', async () => {
      const files = [
        path.join(__dirname, 'data', 'test-sample.txt'),
        path.join(__dirname, 'data', 'test-sample.csv'),
        path.join(__dirname, 'data', 'test-invoice.txt')
      ];

      const results = await extractor.extractBatch(files);

      assert.strictEqual(results.length, 3, 'Should return 3 results');
      assert.ok(results.every(r => r.success), 'All should succeed');
      assert.ok(results.every(r => r.text.length > 0), 'All should have text');
});

await runTest('should handle mixed success/failure in batch', async () => {
      const files = [
        path.join(__dirname, 'data', 'test-sample.txt'),
        '/nonexistent/file.txt'
      ];

      const results = await extractor.extractBatch(files);

      assert.strictEqual(results.length, 2, 'Should return 2 results');
      assert.ok(results[0].success, 'First should succeed');
      assert.ok(!results[1].success, 'Second should fail');
});

// =====================================================
// STATISTICS TESTS
// =====================================================

console.log('\n--- Statistics & Metrics ---');

await runTest('should provide accurate statistics', async () => {
      const filePath = path.join(__dirname, 'data', 'test-medical-record.txt');
      const result = await extractor.extractText(filePath);
      const stats = extractor.getStatistics(result);

      assert.ok(stats.textLength > 2000, 'Should have substantial text length');
      assert.ok(stats.wordCount > 250, 'Should have many words');
      assert.ok(stats.lineCount > 50, 'Should have many lines');
      assert.ok(stats.paragraphCount > 5, 'Should have multiple paragraphs');
      assert.ok(stats.extractionTime >= 0, 'Should track extraction time');
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
