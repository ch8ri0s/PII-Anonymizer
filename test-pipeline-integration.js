#!/usr/bin/env node
/**
 * Detection Pipeline Integration Test
 *
 * Compares the current single-pass detection with the new multi-pass pipeline.
 * Run this before and after integration to measure improvements.
 */

import { SwissEuDetector } from './dist/pii/SwissEuDetector.js';
import { pipeline } from '@xenova/transformers';

// Test cases covering various PII types
const testCases = [
  // Swiss-specific PII
  {
    name: 'Swiss AVS Number (valid checksum)',
    text: 'AVS: 756.1234.5678.97',
    expected: { types: ['SWISS_AVS'], count: 1 },
  },
  {
    name: 'Swiss IBAN',
    text: 'IBAN: CH93 0076 2011 6238 5295 7',
    expected: { types: ['IBAN'], count: 1 },
  },
  {
    name: 'Swiss Phone Number',
    text: 'Tel: +41 44 123 45 67',
    expected: { types: ['PHONE'], count: 1 },
  },
  {
    name: 'Swiss Address',
    text: 'Adresse: Bahnhofstrasse 10, 8001 Zürich',
    expected: { types: ['ADDRESS', 'SWISS_ADDRESS'], minCount: 1 },
  },
  {
    name: 'Swiss VAT Number',
    text: 'UID: CHE-123.456.789 MWST',
    expected: { types: ['VAT_NUMBER', 'COMPANY_ID'], minCount: 1 },
  },

  // EU PII
  {
    name: 'German IBAN',
    text: 'Konto: DE89 3704 0044 0532 0130 00',
    expected: { types: ['IBAN'], count: 1 },
  },
  {
    name: 'French Phone',
    text: 'Téléphone: +33 1 42 86 82 82',
    expected: { types: ['PHONE'], count: 1 },
  },

  // Email
  {
    name: 'Email Address',
    text: 'Contact: max.mustermann@example.ch',
    expected: { types: ['EMAIL'], count: 1 },
  },

  // Dates
  {
    name: 'Date (European format)',
    text: 'Geburtsdatum: 15.03.1985',
    expected: { types: ['DATE'], count: 1 },
  },
  {
    name: 'Date (German month name)',
    text: 'Datum: 15. Januar 2024',
    expected: { types: ['DATE'], count: 1 },
  },

  // Complex scenarios
  {
    name: 'Multiple PII in one sentence',
    text: 'Herr Max Mustermann (max@example.ch, +41 44 123 45 67) wohnt in 8001 Zürich.',
    expected: { minCount: 3 },
  },
  {
    name: 'Invoice-style document',
    text: `
      Rechnung Nr. 2024-001
      Datum: 15.01.2024
      Kunde: Jean Dupont
      IBAN: CH93 0076 2011 6238 5295 7
      Betrag: CHF 1'234.50
      MwSt-Nr: CHE-123.456.789 MWST
    `,
    expected: { minCount: 4 },
  },

  // Edge cases / False positive prevention
  {
    name: 'Product code (should NOT be phone)',
    text: 'Artikel: ART-021-627-4137',
    expected: { types: [], maxPhones: 0 },
  },
  {
    name: 'Version number (should NOT be ID)',
    text: 'Version 2.11.627.4137',
    expected: { maxCount: 1 },
  },
  {
    name: 'GPS coordinates (should NOT be phone)',
    text: 'Koordinaten: 46.519653, 6.633158',
    expected: { maxPhones: 0 },
  },
];

// Detection function using current approach
async function detectWithCurrent(text, ner) {
  const detector = new SwissEuDetector();

  // Rule-based detection
  const ruleEntities = detector.detect(text);

  // ML-based detection
  const predictions = await ner(text);
  const mlEntities = predictions
    .filter(p => p.score > 0.5)
    .map(p => ({
      type: p.entity.replace(/^(B-|I-)/, ''),
      text: p.word,
      score: p.score,
      source: 'ML',
    }));

  return [...ruleEntities, ...mlEntities];
}

// Detection function using new pipeline
async function detectWithPipeline(text, ner) {
  // Dynamic import of the new pipeline
  const { createPipeline } = await import('./dist/pii/DetectionPipeline.js');
  const { createHighRecallPass } = await import('./dist/pii/passes/HighRecallPass.js');
  const { createFormatValidationPass } = await import('./dist/pii/passes/FormatValidationPass.js');
  const { createContextScoringPass } = await import('./dist/pii/passes/ContextScoringPass.js');

  const pipeline = createPipeline({ debug: false });
  pipeline.registerPass(createHighRecallPass(0.3));
  pipeline.registerPass(createFormatValidationPass());
  pipeline.registerPass(createContextScoringPass());

  // Set up NER pipeline for the high recall pass
  const highRecallPass = pipeline.getPasses()[0];
  highRecallPass.setNerPipeline(async (t) => {
    const preds = await ner(t);
    return preds.map(p => ({
      entity_group: p.entity.replace(/^(B-|I-)/, ''),
      score: p.score,
      word: p.word,
      start: p.start,
      end: p.end,
    }));
  });

  const result = await pipeline.process(text);
  return result.entities;
}

// Run tests
async function runTests(usePipeline = false) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(usePipeline
    ? '  NEW MULTI-PASS PIPELINE DETECTION'
    : '  CURRENT SINGLE-PASS DETECTION');
  console.log(`${'='.repeat(60)}\n`);

  // Load ML model
  console.log('Loading ML model...');
  const ner = await pipeline('token-classification',
    'Xenova/distilbert-base-multilingual-cased-ner-hrl',
    { cache_dir: './models' },
  );
  console.log('Model loaded.\n');

  let passed = 0;
  let failed = 0;
  let totalEntities = 0;
  let falsePositives = 0;
  const results = [];

  for (const test of testCases) {
    console.log(`Test: ${test.name}`);

    const entities = usePipeline
      ? await detectWithPipeline(test.text, ner)
      : await detectWithCurrent(test.text, ner);

    totalEntities += entities.length;

    // Map entity types for comparison
    const types = entities.map(e => e.type);
    const phoneCount = types.filter(t => t === 'PHONE').length;

    let testPassed = true;
    const issues = [];

    // Check expected types
    if (test.expected.types) {
      const hasExpected = test.expected.types.some(t => types.includes(t));
      if (!hasExpected && test.expected.types.length > 0) {
        testPassed = false;
        issues.push(`Missing expected type: ${test.expected.types.join(' or ')}`);
      }
    }

    // Check count
    if (test.expected.count !== undefined) {
      if (entities.length !== test.expected.count) {
        testPassed = false;
        issues.push(`Expected ${test.expected.count} entities, got ${entities.length}`);
      }
    }

    // Check min count
    if (test.expected.minCount !== undefined) {
      if (entities.length < test.expected.minCount) {
        testPassed = false;
        issues.push(`Expected at least ${test.expected.minCount} entities, got ${entities.length}`);
      }
    }

    // Check max count (false positive prevention)
    if (test.expected.maxCount !== undefined) {
      if (entities.length > test.expected.maxCount) {
        falsePositives += entities.length - test.expected.maxCount;
        testPassed = false;
        issues.push(`Expected at most ${test.expected.maxCount} entities, got ${entities.length}`);
      }
    }

    // Check max phones (false positive prevention)
    if (test.expected.maxPhones !== undefined) {
      if (phoneCount > test.expected.maxPhones) {
        falsePositives += phoneCount;
        testPassed = false;
        issues.push(`Expected at most ${test.expected.maxPhones} phones, got ${phoneCount}`);
      }
    }

    if (testPassed) {
      console.log(`  ✅ PASSED (${entities.length} entities)`);
      passed++;
    } else {
      console.log('  ❌ FAILED');
      issues.forEach(i => console.log(`     → ${i}`));
      failed++;
    }

    // Show entities in verbose mode
    if (entities.length > 0 && entities.length <= 5) {
      entities.forEach(e => {
        const conf = e.confidence ? ` (${(e.confidence * 100).toFixed(0)}%)` : '';
        const source = e.source || '';
        console.log(`     [${e.type}] "${e.text}"${conf} ${source}`);
      });
    }
    console.log('');

    results.push({
      name: test.name,
      passed: testPassed,
      entityCount: entities.length,
      entities,
    });
  }

  // Summary
  const accuracy = ((passed / testCases.length) * 100).toFixed(1);

  console.log(`${'─'.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'─'.repeat(60)}`);
  console.log(`Tests Passed:     ${passed}/${testCases.length} (${accuracy}%)`);
  console.log(`Tests Failed:     ${failed}`);
  console.log(`Total Entities:   ${totalEntities}`);
  console.log(`False Positives:  ${falsePositives}`);
  console.log(`${'─'.repeat(60)}\n`);

  return {
    passed,
    failed,
    total: testCases.length,
    accuracy: parseFloat(accuracy),
    totalEntities,
    falsePositives,
    results,
  };
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const usePipeline = args.includes('--pipeline');
  const compareMode = args.includes('--compare');

  if (compareMode) {
    console.log('\n' + '═'.repeat(60));
    console.log('  DETECTION COMPARISON: BEFORE vs AFTER INTEGRATION');
    console.log('═'.repeat(60));

    const beforeResults = await runTests(false);
    const afterResults = await runTests(true);

    console.log('\n' + '═'.repeat(60));
    console.log('  COMPARISON RESULTS');
    console.log('═'.repeat(60));
    console.log('\n                    BEFORE      AFTER       CHANGE');
    console.log(`${'─'.repeat(60)}`);
    console.log(`Accuracy:           ${beforeResults.accuracy.toFixed(1)}%       ${afterResults.accuracy.toFixed(1)}%        ${(afterResults.accuracy - beforeResults.accuracy) >= 0 ? '+' : ''}${(afterResults.accuracy - beforeResults.accuracy).toFixed(1)}%`);
    console.log(`Total Entities:     ${beforeResults.totalEntities.toString().padEnd(10)} ${afterResults.totalEntities.toString().padEnd(10)} ${afterResults.totalEntities - beforeResults.totalEntities >= 0 ? '+' : ''}${afterResults.totalEntities - beforeResults.totalEntities}`);
    console.log(`False Positives:    ${beforeResults.falsePositives.toString().padEnd(10)} ${afterResults.falsePositives.toString().padEnd(10)} ${afterResults.falsePositives - beforeResults.falsePositives >= 0 ? '+' : ''}${afterResults.falsePositives - beforeResults.falsePositives}`);
    console.log(`${'─'.repeat(60)}\n`);

    if (afterResults.accuracy >= beforeResults.accuracy) {
      console.log('✅ Pipeline integration successful - accuracy maintained or improved!\n');
    } else {
      console.log('⚠️  Pipeline integration may have regressed accuracy.\n');
    }
  } else {
    await runTests(usePipeline);
  }
}

main().catch(console.error);
