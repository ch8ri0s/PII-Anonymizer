/**
 * Test Suite: FileProcessor Session Isolation (CRITICAL BUG FIX)
 *
 * Requirements:
 * 1. Each file processing operation must have isolated pseudonym mappings
 * 2. File A's "John Doe" → PER_1 should NOT affect File B's "John Doe"
 * 3. Multiple files processed sequentially should have independent mappings
 * 4. Batch processing should maintain isolation between files
 * 5. The same PII entity in different files should get different pseudonyms
 *
 * Current Bug: Global state causes cross-contamination between files
 * Expected: These tests will FAIL until FileProcessor is refactored
 */

import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { FileProcessor } from '../../fileProcessor.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('FileProcessor Session Isolation (CRITICAL)', () => {
  const testDataDir = path.join(__dirname, '../data');
  const outputDir = path.join(__dirname, '../output');

  beforeEach(async () => {
    // Clean output directory
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore if doesn't exist
    }
    await fs.mkdir(outputDir, { recursive: true });

    // Reset any global state (will still fail due to bug)
    FileProcessor.resetMappings();
  });

  it('should maintain separate pseudonym mappings for different files', async function() {
    this.timeout(15000);

    // Create two test files with identical PII
    const file1Content = 'Employee: John Doe\nEmail: john@example.com';
    const file2Content = 'Employee: John Doe\nEmail: john@example.com';

    const file1Path = path.join(outputDir, 'file1.txt');
    const file2Path = path.join(outputDir, 'file2.txt');

    await fs.writeFile(file1Path, file1Content, 'utf8');
    await fs.writeFile(file2Path, file2Content, 'utf8');

    // Process first file
    const output1Path = path.join(outputDir, 'file1-anon.md');
    await FileProcessor.processFile(file1Path, output1Path);

    // Read first file's mapping
    const mapping1Path = path.join(outputDir, 'file1-anon-mapping.json');
    const mapping1Data = await fs.readFile(mapping1Path, 'utf8');
    const mapping1 = JSON.parse(mapping1Data);

    // Process second file
    const output2Path = path.join(outputDir, 'file2-anon.md');
    await FileProcessor.processFile(file2Path, output2Path);

    // Read second file's mapping
    const mapping2Path = path.join(outputDir, 'file2-anon-mapping.json');
    const mapping2Data = await fs.readFile(mapping2Path, 'utf8');
    const mapping2 = JSON.parse(mapping2Data);

    // CRITICAL TEST: Same PII should have DIFFERENT pseudonyms in different files
    const johnPseudonym1 = mapping1.entities['John Doe'];
    const johnPseudonym2 = mapping2.entities['John Doe'];

    console.log('File 1 John Doe pseudonym:', johnPseudonym1);
    console.log('File 2 John Doe pseudonym:', johnPseudonym2);

    // THIS WILL FAIL due to global state bug
    expect(johnPseudonym1).to.not.equal(johnPseudonym2,
      'CRITICAL BUG: Same PII in different files should have different pseudonyms');

    // Each file should have independent pseudonym counters
    expect(johnPseudonym1).to.match(/^PER_1$/);
    expect(johnPseudonym2).to.match(/^PER_1$/); // Should restart at 1 for new file
  });

  it('should not leak pseudonyms between sequential file processing', async function() {
    this.timeout(15000);

    // Create three files with different people named differently
    const file1Content = 'Employee: Alice Smith';
    const file2Content = 'Employee: Bob Jones';
    const file3Content = 'Employee: Alice Smith'; // Same as file1

    const files = [
      { input: path.join(outputDir, 'emp1.txt'), content: file1Content },
      { input: path.join(outputDir, 'emp2.txt'), content: file2Content },
      { input: path.join(outputDir, 'emp3.txt'), content: file3Content },
    ];

    const results = [];

    // Process files sequentially
    for (const file of files) {
      await fs.writeFile(file.input, file.content, 'utf8');
      const outputPath = file.input.replace('.txt', '-anon.md');
      await FileProcessor.processFile(file.input, outputPath);

      const mappingPath = outputPath.replace('.md', '-mapping.json');
      const mappingData = await fs.readFile(mappingPath, 'utf8');
      const mapping = JSON.parse(mappingData);
      results.push(mapping);
    }

    // File 1 and File 3 have same person
    const alicePseudonym1 = results[0].entities['Alice Smith'];
    const alicePseudonym3 = results[2].entities['Alice Smith'];

    console.log('File 1 Alice pseudonym:', alicePseudonym1);
    console.log('File 3 Alice pseudonym:', alicePseudonym3);

    // THIS WILL FAIL: Alice in file 3 will reuse pseudonym from file 1
    expect(alicePseudonym1).to.not.equal(alicePseudonym3,
      'CRITICAL BUG: Same person in different files should have different pseudonyms');
  });

  it('should allow concurrent file processing without state collision', async function() {
    this.timeout(20000);

    // Create 5 files with same PII
    const sharedPII = 'Contact: Jane Doe, jane@example.com';
    const files = [];

    for (let i = 0; i < 5; i++) {
      const filePath = path.join(outputDir, `concurrent${i}.txt`);
      await fs.writeFile(filePath, sharedPII, 'utf8');
      files.push(filePath);
    }

    // Process all files concurrently
    const processPromises = files.map(async (filePath) => {
      const outputPath = filePath.replace('.txt', '-anon.md');
      await FileProcessor.processFile(filePath, outputPath);

      const mappingPath = outputPath.replace('.md', '-mapping.json');
      const mappingData = await fs.readFile(mappingPath, 'utf8');
      return JSON.parse(mappingData);
    });

    const mappings = await Promise.all(processPromises);

    // Collect all pseudonyms for "Jane Doe"
    const janePseudonyms = mappings.map(m => m.entities['Jane Doe']);

    console.log('Jane Doe pseudonyms from concurrent processing:', janePseudonyms);

    // THIS WILL FAIL: Race conditions will cause duplicates or missing entries
    const uniquePseudonyms = new Set(janePseudonyms);
    expect(uniquePseudonyms.size).to.equal(5,
      'CRITICAL BUG: Concurrent processing causes state collision');
  });

  it('should maintain isolation after resetMappings() is called', async function() {
    this.timeout(15000);

    const content = 'Employee: Test Person';

    // Process file 1
    const file1Path = path.join(outputDir, 'reset1.txt');
    await fs.writeFile(file1Path, content, 'utf8');
    const output1Path = path.join(outputDir, 'reset1-anon.md');
    await FileProcessor.processFile(file1Path, output1Path);

    const mapping1Path = output1Path.replace('.md', '-mapping.json');
    const mapping1Data = await fs.readFile(mapping1Path, 'utf8');
    const mapping1 = JSON.parse(mapping1Data);

    // Reset mappings
    FileProcessor.resetMappings();

    // Process file 2 with same content
    const file2Path = path.join(outputDir, 'reset2.txt');
    await fs.writeFile(file2Path, content, 'utf8');
    const output2Path = path.join(outputDir, 'reset2-anon.md');
    await FileProcessor.processFile(file2Path, output2Path);

    const mapping2Path = output2Path.replace('.md', '-mapping.json');
    const mapping2Data = await fs.readFile(mapping2Path, 'utf8');
    const mapping2 = JSON.parse(mapping2Data);

    // After reset, counters should restart
    const pseudonym1 = mapping1.entities['Test Person'];
    const pseudonym2 = mapping2.entities['Test Person'];

    console.log('Before reset:', pseudonym1);
    console.log('After reset:', pseudonym2);

    // Both should be PER_1 (counter restarted)
    expect(pseudonym1).to.match(/^PER_1$/);
    expect(pseudonym2).to.match(/^PER_1$/);

    // But they should still be from different sessions
    // (This test documents current behavior, even with reset)
  });

  it('should preserve per-file mapping integrity in batch operations', async function() {
    this.timeout(20000);

    // Simulate batch processing of 3 files
    const batch = [
      { name: 'invoice1.txt', content: 'Client: ABC Corp\nContact: John Smith' },
      { name: 'invoice2.txt', content: 'Client: XYZ Ltd\nContact: Jane Doe' },
      { name: 'invoice3.txt', content: 'Client: ABC Corp\nContact: John Smith' }, // Duplicate of invoice1
    ];

    const results = [];

    for (const item of batch) {
      const inputPath = path.join(outputDir, item.name);
      await fs.writeFile(inputPath, item.content, 'utf8');

      const outputPath = inputPath.replace('.txt', '-anon.md');
      await FileProcessor.processFile(inputPath, outputPath);

      const mappingPath = outputPath.replace('.md', '-mapping.json');
      const mappingData = await fs.readFile(mappingPath, 'utf8');
      const mapping = JSON.parse(mappingData);

      const anonymized = await fs.readFile(outputPath, 'utf8');

      results.push({ mapping, anonymized, original: item.content });
    }

    // Invoice 1 and Invoice 3 should have DIFFERENT pseudonyms for same entities
    const invoice1John = results[0].mapping.entities['John Smith'];
    const invoice3John = results[2].mapping.entities['John Smith'];

    const invoice1ABC = results[0].mapping.entities['ABC Corp'];
    const invoice3ABC = results[2].mapping.entities['ABC Corp'];

    console.log('Invoice 1 - John Smith:', invoice1John);
    console.log('Invoice 3 - John Smith:', invoice3John);
    console.log('Invoice 1 - ABC Corp:', invoice1ABC);
    console.log('Invoice 3 - ABC Corp:', invoice3ABC);

    // THIS WILL FAIL due to global state
    expect(invoice1John).to.not.equal(invoice3John,
      'CRITICAL BUG: Batch processing shares pseudonyms across files');
    expect(invoice1ABC).to.not.equal(invoice3ABC,
      'CRITICAL BUG: Batch processing shares pseudonyms across files');
  });
});
