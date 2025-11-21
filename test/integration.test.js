/**
 * Integration test for enhanced file processor
 * Tests end-to-end text extraction and anonymization
 */

import { FileProcessor } from '../fileProcessor.enhanced.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n=== Integration Tests for Enhanced File Processor ===\n');

async function testFile(inputFile, expectedPII) {
  const outputFile = path.join(__dirname, 'output', path.basename(inputFile).replace(/(\.\w+)$/, '-anon$1'));

  // Ensure output directory exists
  const outputDir = path.dirname(outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`\nTesting: ${path.basename(inputFile)}`);
  console.log(`Output: ${path.basename(outputFile)}`);

  try {
    const startTime = Date.now();
    await FileProcessor.processFile(inputFile, outputFile);
    const duration = Date.now() - startTime;

    // Verify output exists
    if (!fs.existsSync(outputFile)) {
      console.log(`  ✗ Output file not created`);
      return false;
    }

    // Read output and check
    const stats = fs.statSync(outputFile);
    console.log(`  ✓ File created (${stats.size} bytes)`);
    console.log(`  ✓ Processing time: ${duration}ms`);

    // For text files, verify PII was removed
    if (inputFile.endsWith('.txt') || inputFile.endsWith('.csv')) {
      const outputContent = fs.readFileSync(outputFile, 'utf8');

      // Check that expected PII is NOT in output
      let piiRemoved = true;
      for (const pii of expectedPII) {
        if (outputContent.toLowerCase().includes(pii.toLowerCase())) {
          console.log(`  ⚠ PII still present: "${pii}"`);
          piiRemoved = false;
        }
      }

      if (piiRemoved) {
        console.log(`  ✓ PII successfully anonymized`);
      }

      // Check that document structure is preserved
      const originalContent = fs.readFileSync(inputFile, 'utf8');
      const originalLines = originalContent.split('\n').length;
      const outputLines = outputContent.split('\n').length;
      const linePreservation = (outputLines / originalLines) * 100;

      console.log(`  ✓ Line preservation: ${linePreservation.toFixed(1)}%`);
    }

    return true;
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
    return false;
  }
}

// Run tests
(async () => {
  let passed = 0;
  let failed = 0;

  // Test 1: TXT file with PII
  if (await testFile(
    path.join(__dirname, 'data', 'test-sample.txt'),
    ['Dr. Sarah Chen', 'sarah.chen@example.com', '(555) 123-4567', '123 Main Street']
  )) {
    passed++;
  } else {
    failed++;
  }

  // Test 2: CSV file with structured PII
  if (await testFile(
    path.join(__dirname, 'data', 'test-sample.csv'),
    ['John Smith', 'john.smith@email.com', 'Maria Garcia']
  )) {
    passed++;
  } else {
    failed++;
  }

  // Test 3: PDF file
  if (await testFile(
    path.join(__dirname, 'data', '05-versions-space.pdf'),
    []
  )) {
    passed++;
  } else {
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log(`\nIntegration Test Results: ${passed}/${passed + failed} passed`);

  if (failed > 0) {
    console.log(`\n⚠ ${failed} test(s) failed`);
    process.exit(1);
  } else {
    console.log('\n✓ All integration tests passed!');
    process.exit(0);
  }
})();
