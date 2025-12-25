/**
 * Test Suite: FileProcessor Session Isolation (CRITICAL BUG FIX)
 *
 * Requirements:
 * 1. Each file processing operation must have isolated pseudonym mappings
 * 2. File A's "John Doe" → PERSON_1 should NOT affect File B's "John Doe"
 * 3. Multiple files processed sequentially should have independent mappings
 * 4. Batch processing should maintain isolation between files
 * 5. The same PII entity in different files should get different pseudonyms
 *
 * Note: Uses multi-pass detection pipeline (v3.0) which outputs full entity type names:
 *       PERSON (not PER), ORGANIZATION (not ORG), LOCATION (not LOC)
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
  const _testDataDir = path.join(__dirname, '../data');
  const outputDir = path.join(__dirname, '../output');

  beforeEach(async () => {
    // Clean output directory
    try {
      await fs.rm(outputDir, { recursive: true, force: true });
    // eslint-disable-next-line no-unused-vars
    } catch (_err) {
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

    // Get first detected person entity from each file (PERSON_ prefix in v3.0 pipeline)
    const entities1 = Object.entries(mapping1.entities).filter(([_k, v]) => v.startsWith('PERSON'));
    const entities2 = Object.entries(mapping2.entities).filter(([_k, v]) => v.startsWith('PERSON'));

    console.log('File 1 entities:', entities1);
    console.log('File 2 entities:', entities2);

    // Both files should have detected entities
    expect(entities1.length).to.be.greaterThan(0, 'File 1 should have detected entities');
    expect(entities2.length).to.be.greaterThan(0, 'File 2 should have detected entities');

    // CRITICAL TEST: Each file should have independent counters starting at 1
    // If isolation works, both should have PERSON_1 (counter restarted for each file)
    const pseudonym1 = entities1[0][1];
    const pseudonym2 = entities2[0][1];

    console.log('File 1 first person pseudonym:', pseudonym1);
    console.log('File 2 first person pseudonym:', pseudonym2);

    // Each file's counter should restart at 1 (proves isolation)
    expect(pseudonym1).to.equal('PERSON_1', 'File 1 should start counter at 1');
    expect(pseudonym2).to.equal('PERSON_1', 'File 2 should restart counter at 1 (isolated session)');
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

    // Each file should have independent PERSON_1 counters (proves isolation)
    const file1Persons = Object.entries(results[0].entities).filter(([_k, v]) => v.startsWith('PERSON'));
    const file2Persons = Object.entries(results[1].entities).filter(([_k, v]) => v.startsWith('PERSON'));
    const file3Persons = Object.entries(results[2].entities).filter(([_k, v]) => v.startsWith('PERSON'));

    console.log('File 1 persons:', file1Persons);
    console.log('File 2 persons:', file2Persons);
    console.log('File 3 persons:', file3Persons);

    // All should have detected persons
    expect(file1Persons.length).to.be.greaterThan(0);
    expect(file2Persons.length).to.be.greaterThan(0);
    expect(file3Persons.length).to.be.greaterThan(0);

    // CRITICAL: Each file should have PERSON_1 (counter restarts - proves isolation)
    expect(file1Persons[0][1]).to.equal('PERSON_1', 'File 1 starts at PERSON_1');
    expect(file2Persons[0][1]).to.equal('PERSON_1', 'File 2 restarts at PERSON_1');
    expect(file3Persons[0][1]).to.equal('PERSON_1', 'File 3 restarts at PERSON_1');
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

    // Check that each file has its own PERSON_1 (proves session isolation)
    const personPseudonyms = mappings.map(m => {
      const persons = Object.entries(m.entities).filter(([_k, v]) => v.startsWith('PERSON'));
      return persons.length > 0 ? persons[0][1] : null;
    });

    console.log('Person pseudonyms from concurrent processing:', personPseudonyms);

    // All should have detected persons
    personPseudonyms.forEach((p, i) => {
      expect(p).to.not.equal(null, `File ${i} should have detected person`);
    });

    // CRITICAL: Each concurrent file should have PERSON_1 or PERSON_NAME_1 (proves isolation)
    // If state was shared, they'd have PERSON_1, PERSON_2, PERSON_3, PERSON_4, PERSON_5
    personPseudonyms.forEach((p, i) => {
      // Accept either PERSON_1 or PERSON_NAME_1 (ML model returns PERSON_NAME now)
      const isValid = p === 'PERSON_1' || p === 'PERSON_NAME_1';
      expect(isValid).to.equal(true, `Concurrent file ${i} should have isolated PERSON_1 or PERSON_NAME_1, got: ${p}`);
    });
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

    // Get first person from each file
    const persons1 = Object.entries(mapping1.entities).filter(([_k, v]) => v.startsWith('PERSON'));
    const persons2 = Object.entries(mapping2.entities).filter(([_k, v]) => v.startsWith('PERSON'));

    console.log('Before reset persons:', persons1);
    console.log('After reset persons:', persons2);

    // resetMappings() is now a no-op since isolation is automatic
    // Both files should independently start at PERSON_1 or PERSON_NAME_1
    if (persons1.length > 0 && persons2.length > 0) {
      // Accept either PERSON_1 or PERSON_NAME_1 (ML model returns PERSON_NAME now)
      const isValid1 = persons1[0][1] === 'PERSON_1' || persons1[0][1] === 'PERSON_NAME_1';
      const isValid2 = persons2[0][1] === 'PERSON_1' || persons2[0][1] === 'PERSON_NAME_1';
      expect(isValid1).to.equal(true, `File 1 starts at PERSON_1 or PERSON_NAME_1, got: ${persons1[0][1]}`);
      expect(isValid2).to.equal(true, `File 2 restarts at PERSON_1 or PERSON_NAME_1 (isolation), got: ${persons2[0][1]}`);
    }
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

    // Each invoice should have independent counters
    const invoice1Persons = Object.entries(results[0].mapping.entities).filter(([_k, v]) => v.startsWith('PERSON'));
    const invoice2Persons = Object.entries(results[1].mapping.entities).filter(([_k, v]) => v.startsWith('PERSON'));
    const invoice3Persons = Object.entries(results[2].mapping.entities).filter(([_k, v]) => v.startsWith('PERSON'));

    const invoice1Orgs = Object.entries(results[0].mapping.entities).filter(([_k, v]) => v.startsWith('ORGANIZATION'));
    const invoice2Orgs = Object.entries(results[1].mapping.entities).filter(([_k, v]) => v.startsWith('ORGANIZATION'));
    const invoice3Orgs = Object.entries(results[2].mapping.entities).filter(([_k, v]) => v.startsWith('ORGANIZATION'));

    console.log('Invoice 1 - Persons:', invoice1Persons);
    console.log('Invoice 2 - Persons:', invoice2Persons);
    console.log('Invoice 3 - Persons:', invoice3Persons);
    console.log('Invoice 1 - Orgs:', invoice1Orgs);
    console.log('Invoice 2 - Orgs:', invoice2Orgs);
    console.log('Invoice 3 - Orgs:', invoice3Orgs);

    // CRITICAL: Each invoice should have independent counters starting at 1
    // Invoice 1 and 3 have same content but should have isolated PERSON_1/PERSON_NAME_1, ORGANIZATION_1
    if (invoice1Persons.length > 0) {
      // Accept either PERSON_1 or PERSON_NAME_1 (ML model returns PERSON_NAME now)
      const isValid = invoice1Persons[0][1] === 'PERSON_1' || invoice1Persons[0][1] === 'PERSON_NAME_1';
      expect(isValid).to.equal(true, `Invoice 1 PERSON starts at 1, got: ${invoice1Persons[0][1]}`);
    }
    if (invoice3Persons.length > 0) {
      const isValid = invoice3Persons[0][1] === 'PERSON_1' || invoice3Persons[0][1] === 'PERSON_NAME_1';
      expect(isValid).to.equal(true, `Invoice 3 PERSON restarts at 1, got: ${invoice3Persons[0][1]}`);
    }
    if (invoice1Orgs.length > 0) {
      expect(invoice1Orgs[0][1]).to.equal('ORGANIZATION_1', 'Invoice 1 ORGANIZATION starts at 1');
    }
    if (invoice3Orgs.length > 0) {
      expect(invoice3Orgs[0][1]).to.equal('ORGANIZATION_1', 'Invoice 3 ORGANIZATION restarts at 1');
    }
  });
});
