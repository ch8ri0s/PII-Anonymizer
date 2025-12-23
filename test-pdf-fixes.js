/**
 * Test script to verify PDF processing fixes
 * Tests:
 * 1. Broken spacing in PDF text extraction (fixBrokenSpacing)
 * 2. Single-character PII entity filtering (MIN_ENTITY_LENGTH = 3)
 */

import { processFile } from './fileProcessor.js';
import fs from 'fs/promises';
import _path from 'path';

const PDF_PATH = './test/fixtures/sample-document.pdf';
const OUTPUT_DIR = '/Users/olivier/Downloads';

async function testPdfFixes() {
  console.log('🧪 Testing PDF processing fixes...\n');

  try {
    // Process the problematic PDF
    console.log('📄 Processing PDF:', PDF_PATH);
    const result = await processFile(PDF_PATH, OUTPUT_DIR);

    console.log('\n✅ Processing completed successfully');
    console.log('📊 Results:');
    console.log('  - Output MD:', result.outputPath);
    console.log('  - Mapping JSON:', result.mappingPath);

    // Read the output files
    const mdContent = await fs.readFile(result.outputPath, 'utf8');
    const mappingContent = await fs.readFile(result.mappingPath, 'utf8');
    const mapping = JSON.parse(mappingContent);

    // Check for issues
    console.log('\n🔍 Validation checks:');

    // Check 1: No single-character entities in mapping
    const singleCharEntities = Object.keys(mapping.entities).filter(key => key.length === 1);
    if (singleCharEntities.length === 0) {
      console.log('  ✅ No single-character PII entities detected');
    } else {
      console.log('  ❌ Found single-character entities:', singleCharEntities);
    }

    // Check 2: No broken spacing patterns in MD
    const brokenSpacingPatterns = [
      /\bmes dames\b/i,
      /\bsie urs\b/i,
      /\bconform ément\b/i,
      /\bpr ésente\b/i,
      /\ben treprise\b/i,
      /\bd ' adh\b/i,
      /\bl ' entreprise\b/i,
    ];

    let foundBrokenSpacing = false;
    for (const pattern of brokenSpacingPatterns) {
      if (pattern.test(mdContent)) {
        console.log(`  ❌ Found broken spacing pattern: ${pattern}`);
        foundBrokenSpacing = true;
      }
    }

    if (!foundBrokenSpacing) {
      console.log('  ✅ No broken spacing patterns detected');
    }

    // Check 3: No PER_3 scattered throughout (from single 'C' detection)
    const per3Count = (mdContent.match(/PER_3/g) || []).length;
    console.log(`  📊 PER_3 occurrences: ${per3Count}`);

    // In the broken version, PER_3 appeared ~50+ times due to every 'c' being replaced
    // In the fixed version, it should appear much less (only legitimate entities)
    if (per3Count < 15) {
      console.log('  ✅ PER_3 usage looks reasonable (not mass-replaced)');
    } else {
      console.log('  ⚠️  High PER_3 count - possible mass replacement issue');
    }

    // Print sample of the output
    console.log('\n📝 Sample output (first 500 chars):');
    console.log(mdContent.substring(0, 500));

    console.log('\n🎉 Test completed!');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testPdfFixes();
