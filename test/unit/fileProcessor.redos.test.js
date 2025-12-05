/**
 * Test Suite: ReDoS (Regular Expression Denial of Service) Protection (CRITICAL BUG FIX)
 *
 * Requirements:
 * 1. Regex matching must complete within reasonable time (< 100ms per pattern)
 * 2. Pathological input (e.g., 'a'.repeat(50)) must not cause exponential backtracking
 * 3. buildFuzzyRegex() must have bounded repetition or timeout protection
 * 4. Large entity texts (100+ chars) should not hang the application
 * 5. Multiple consecutive matches should not multiply processing time exponentially
 *
 * Current Bug: buildFuzzyRegex() creates patterns with unbounded quantifiers
 * Pattern like `a[^a-zA-Z0-9]{0,3}b[^a-zA-Z0-9]{0,3}...` causes catastrophic backtracking
 *
 * Expected: These tests will FAIL (timeout) until regex is protected
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import { FileProcessor } from '../../fileProcessor.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FileProcessor ReDoS Protection (CRITICAL)', () => {
  const _testDataDir = path.join(__dirname, '../data');
  const outputDir = path.join(__dirname, '../output');

  beforeEach(async () => {
    // Clean output directory
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (_err) {
      // Ignore if doesn't exist
    }
    await fs.mkdir(outputDir, { recursive: true });
  });

  it('should not hang on pathological repetitive input', async function() {
    this.timeout(15000); // 15 second max - first test loads ML model

    // ReDoS attack vector: long repetitive string
    const attackString = 'a'.repeat(50);
    const content = `Employee: ${attackString}\nStatus: Active`;

    const filePath = path.join(outputDir, 'redos-attack.txt');
    await fs.writeFile(filePath, content, 'utf8');

    const outputPath = path.join(outputDir, 'redos-attack-anon.md');

    const startTime = Date.now();

    // THIS WILL TIMEOUT/HANG if ReDoS vulnerability exists
    await FileProcessor.processFile(filePath, outputPath);

    const duration = Date.now() - startTime;
    console.log(`Processing time: ${duration}ms`);

    // Should complete in reasonable time (< 10 seconds including ML model cold start)
    // Actual regex processing should be <100ms; bulk of time is model loading
    expect(duration).to.be.lessThan(10000,
      'CRITICAL BUG: Regex took too long - possible ReDoS vulnerability');
  });

  it('should handle alternating character patterns efficiently', async function() {
    this.timeout(5000);

    // Another ReDoS vector: alternating patterns that cause backtracking
    const attackString = 'ababababababababababababababababababababababab';
    const content = `Contact: ${attackString}\nEmail: test@example.com`;

    const filePath = path.join(outputDir, 'redos-alternating.txt');
    await fs.writeFile(filePath, content, 'utf8');

    const outputPath = path.join(outputDir, 'redos-alternating-anon.md');

    const startTime = Date.now();
    await FileProcessor.processFile(filePath, outputPath);
    const duration = Date.now() - startTime;

    console.log(`Alternating pattern processing time: ${duration}ms`);

    expect(duration).to.be.lessThan(2000,
      'CRITICAL BUG: Alternating patterns cause exponential backtracking');
  });

  it('should process long entity names without timeout', async function() {
    this.timeout(5000);

    // Long but valid entity name (some companies have very long names)
    const longName = 'International Business Machines Corporation Subsidiary Holdings Limited Partnership';
    const content = `Company: ${longName}\nLocation: New York`;

    const filePath = path.join(outputDir, 'long-entity.txt');
    await fs.writeFile(filePath, content, 'utf8');

    const outputPath = path.join(outputDir, 'long-entity-anon.md');

    const startTime = Date.now();
    await FileProcessor.processFile(filePath, outputPath);
    const duration = Date.now() - startTime;

    console.log(`Long entity processing time: ${duration}ms`);

    // Should handle legitimately long names quickly
    expect(duration).to.be.lessThan(3000);
  });

  it('should handle multiple similar entities without exponential slowdown', async function() {
    this.timeout(10000);

    // Multiple entities with similar patterns
    const entities = Array(20).fill(0).map((_, i) =>
      `Employee${i}: ${'a'.repeat(30 + i)}`,
    ).join('\n');

    const content = `Staff List:\n${entities}`;

    const filePath = path.join(outputDir, 'multiple-entities.txt');
    await fs.writeFile(filePath, content, 'utf8');

    const outputPath = path.join(outputDir, 'multiple-entities-anon.md');

    const startTime = Date.now();
    await FileProcessor.processFile(filePath, outputPath);
    const duration = Date.now() - startTime;

    console.log(`Multiple entities processing time: ${duration}ms`);

    // Processing 20 entities should be roughly linear, not exponential
    // With ReDoS, this could take minutes; without, should be < 8 seconds (includes ML model loading)
    expect(duration).to.be.lessThan(8000,
      'CRITICAL BUG: Multiple entities cause exponential processing time');
  });

  it('should handle special characters mixed with repetition', async function() {
    this.timeout(5000);

    // Combination of special chars and repetition (worst case for naive regex)
    const attackString = 'a!a!a!a!a!a!a!a!a!a!a!a!a!a!a!a!a!a!a!a!';
    const content = `Data: ${attackString}\nType: Test`;

    const filePath = path.join(outputDir, 'special-chars-redos.txt');
    await fs.writeFile(filePath, content, 'utf8');

    const outputPath = path.join(outputDir, 'special-chars-redos-anon.md');

    const startTime = Date.now();
    await FileProcessor.processFile(filePath, outputPath);
    const duration = Date.now() - startTime;

    console.log(`Special chars + repetition processing time: ${duration}ms`);

    expect(duration).to.be.lessThan(2000,
      'CRITICAL BUG: Special characters with repetition cause catastrophic backtracking');
  });

  it('should timeout individual regex operations gracefully', async function() {
    this.timeout(5000);

    // Extreme case: very long string that would definitely trigger ReDoS
    const extremeString = 'x'.repeat(100);
    const content = `Value: ${extremeString}!!!!!!!!!!!!!!!!!!`;

    const filePath = path.join(outputDir, 'extreme-redos.txt');
    await fs.writeFile(filePath, content, 'utf8');

    const outputPath = path.join(outputDir, 'extreme-redos-anon.md');

    const startTime = Date.now();

    // Should either:
    // 1. Complete quickly with timeout protection, or
    // 2. Skip the problematic pattern gracefully
    // Should NOT hang indefinitely
    await FileProcessor.processFile(filePath, outputPath);

    const duration = Date.now() - startTime;
    console.log(`Extreme case processing time: ${duration}ms`);

    expect(duration).to.be.lessThan(3000,
      'CRITICAL BUG: No timeout protection on regex operations');
  });

  it('should process file even if some patterns are skipped due to timeout', async function() {
    this.timeout(5000);

    // Mix of normal and problematic patterns
    const content = `
      Normal Name: John Doe
      Attack: ${'a'.repeat(50)}
      Another Name: Jane Smith
      More Attack: ${'b'.repeat(50)}
      Final Name: Bob Johnson
    `;

    const filePath = path.join(outputDir, 'mixed-content.txt');
    await fs.writeFile(filePath, content, 'utf8');

    const outputPath = path.join(outputDir, 'mixed-content-anon.md');

    const startTime = Date.now();
    await FileProcessor.processFile(filePath, outputPath);
    const duration = Date.now() - startTime;

    console.log(`Mixed content processing time: ${duration}ms`);

    // Should complete by skipping problematic patterns
    expect(duration).to.be.lessThan(3000);

    // Verify output file was created
    const outputExists = await fs.access(outputPath).then(() => true).catch(() => false);
    expect(outputExists).to.be.true;

    // Verify some anonymization occurred (normal names should be processed)
    const mappingPath = outputPath.replace('.md', '-mapping.json');
    const mappingData = await fs.readFile(mappingPath, 'utf8');
    const mapping = JSON.parse(mappingData);

    // Should have processed at least some entities (the safe ones)
    expect(Object.keys(mapping.entities).length).to.be.greaterThan(0,
      'Should process safe entities even if some patterns timeout');
  });

  it('should maintain linear time complexity for increasing input size', async function() {
    this.timeout(15000);

    // Test that processing time scales linearly, not exponentially
    const sizes = [10, 20, 30];
    const times = [];

    for (const size of sizes) {
      const content = `Employee: ${'a'.repeat(size)}\nDepartment: Engineering`;
      const filePath = path.join(outputDir, `linear-test-${size}.txt`);
      await fs.writeFile(filePath, content, 'utf8');

      const outputPath = path.join(outputDir, `linear-test-${size}-anon.md`);

      const startTime = Date.now();
      await FileProcessor.processFile(filePath, outputPath);
      const duration = Date.now() - startTime;

      times.push(duration);
      console.log(`Size ${size}: ${duration}ms`);
    }

    // Calculate ratios
    const ratio1 = times[1] / times[0]; // 20/10
    const ratio2 = times[2] / times[1]; // 30/20

    console.log(`Time ratios: ${ratio1.toFixed(2)}x, ${ratio2.toFixed(2)}x`);

    // Linear: ratios should be close to 2.0 and 1.5
    // Exponential: ratios would be much higher (4x, 9x, etc.)
    // With ReDoS, these ratios could be 10x, 100x, or timeout

    // Allow up to 5x increase (generous margin, but exponential would be much worse)
    expect(ratio1).to.be.lessThan(5, 'CRITICAL BUG: Exponential time complexity detected');
    expect(ratio2).to.be.lessThan(5, 'CRITICAL BUG: Exponential time complexity detected');
  });
});
