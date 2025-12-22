#!/usr/bin/env node
/**
 * Automated PII Detection Test Suite
 * Tests both ML-based and Swiss/EU rule-based detection
 */

import { pipeline } from '@xenova/transformers';
import SwissEuDetector from './src/pii/SwissEuDetector.js';
import { PdfToMarkdown } from './dist/converters/PdfToMarkdown.js';
import fs from 'fs';

// Test cases with expected PII
const testCases = [
  {
    name: 'Swiss Phone Numbers',
    text: 'Contact Marc at tél.+41223334455 or +41 22 333 44 55',
    expected: {
      phones: ['+41223334455', '+41 22 333 44 55'],
    },
  },
  {
    name: 'Email Addresses',
    text: 'Send to m.mueller@example.ch or contact@example.com',
    expected: {
      emails: ['m.mueller@example.ch', 'contact@example.com'],
    },
  },
  {
    name: 'Swiss Addresses',
    text: 'Located at 1700 Fribourg and 8085 Zurich',
    expected: {
      addresses: ['1700 Fribourg', '8085 Zurich'],
    },
  },
  {
    name: 'Company Names',
    text: 'Example Technologies SA and Test Assurances GmbH',
    expected: {
      companies: ['Example Technologies SA', 'Test Assurances GmbH'],
    },
  },
  {
    name: 'Swiss Dates',
    text: 'Date: 07.06.2024 and deadline 15.12.2025',
    expected: {
      dates: ['07.06.2024', '15.12.2025'],
    },
  },
  {
    name: 'Swiss AVS Numbers',
    text: 'AVS: 756.1234.5678.97',
    expected: {
      swissAvs: ['756.1234.5678.97'],
    },
  },
  {
    name: 'Contract Numbers',
    text: "Contract no 65'075'002",
    expected: {
      contracts: ["65'075'002"],
    },
  },
];

// PDF test case - uses test fixture instead of real document
const pdfTestCase = {
  name: 'PDF Text Normalization',
  path: './test/fixtures/sample-document.pdf',
  expectedInNormalized: [
    'Example Company SA',       // Company name
    '+41 22 333 44 55',         // Phone should be properly spaced
    'Jean Pierre Müller',       // Name should be readable
  ],
};

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║     AUTOMATED PII DETECTION TEST SUITE                   ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Test 1: Swiss/EU Rule-Based Detection
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 1: Swiss/EU Rule-Based Detection');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const swissEuDetector = new SwissEuDetector();
let passedTests = 0;
let failedTests = 0;

for (const testCase of testCases) {
  console.log(`\n📋 Test: ${testCase.name}`);
  console.log(`   Input: "${testCase.text}"`);

  const detected = swissEuDetector.detect(testCase.text);
  console.log(`   Detected ${detected.length} entities:`);

  detected.forEach(entity => {
    console.log(`      - [${entity.type}] "${entity.text}"`);
  });

  // Check if we found what we expected
  let testPassed = false;
  if (testCase.expected.phones) {
    const foundPhones = detected.filter(e => e.type === 'PHONE').map(e => e.text);
    testPassed = testCase.expected.phones.every(p =>
      foundPhones.some(f => f.replace(/[\s-]/g, '') === p.replace(/[\s-]/g, '')),
    );
  } else if (testCase.expected.emails) {
    const foundEmails = detected.filter(e => e.type === 'EMAIL').map(e => e.text);
    testPassed = testCase.expected.emails.every(e => foundEmails.includes(e));
  } else if (testCase.expected.addresses) {
    const foundAddresses = detected.filter(e => e.type === 'ADDRESS').map(e => e.text);
    testPassed = testCase.expected.addresses.some(a =>
      foundAddresses.some(f => f.includes(a.split(' ')[0])),
    );
  } else if (testCase.expected.companies) {
    const foundCompanies = detected.filter(e => e.type === 'ORG').map(e => e.text);
    testPassed = testCase.expected.companies.some(c =>
      foundCompanies.some(f => f.includes(c.split(' ')[0])),
    );
  } else if (testCase.expected.dates) {
    const foundDates = detected.filter(e => e.type === 'DATE').map(e => e.text);
    testPassed = testCase.expected.dates.every(d => foundDates.includes(d));
  } else if (testCase.expected.swissAvs) {
    const foundAvs = detected.filter(e => e.type === 'SWISS_AVS').map(e => e.text);
    testPassed = testCase.expected.swissAvs.every(a => foundAvs.includes(a));
  } else if (testCase.expected.contracts) {
    const foundContracts = detected.filter(e => e.type === 'ID_NUMBER').map(e => e.text);
    testPassed = testCase.expected.contracts.some(c =>
      foundContracts.some(f => f.replace(/'/g, '') === c.replace(/'/g, '')),
    );
  }

  if (testPassed) {
    console.log('   ✅ PASSED');
    passedTests++;
  } else {
    console.log('   ❌ FAILED - Expected to find all items');
    failedTests++;
  }
}

// Test 2: ML-Based Detection
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 2: ML-Based Detection (Multilingual NER)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Loading multilingual NER model...');
const classifier = await pipeline('token-classification',
  'Xenova/distilbert-base-multilingual-cased-ner-hrl',
  {
    cache_dir: './models',
  },
);
console.log('✓ Model loaded\n');

// Test with French names
const frenchNameTest = {
  name: 'Names (French)',
  text: 'Jean Pierre Müller, Marie Dubois et François Martin',
};
console.log(`📋 Test: ${frenchNameTest.name}`);
console.log(`   Input: "${frenchNameTest.text}"`);

const mlResults = await classifier(frenchNameTest.text);
console.log(`   Raw ML output (${mlResults.length} tokens):`);
mlResults.forEach(r => {
  if (r.entity.startsWith('B-') || r.entity.startsWith('I-')) {
    console.log(`      - [${r.entity}] "${r.word}" (score: ${(r.score * 100).toFixed(1)}%)`);
  }
});

// Check if names were detected
const detectedPersons = mlResults.filter(r => r.entity.includes('PER'));
if (detectedPersons.length > 0) {
  console.log('   ✅ PASSED - Detected person entities');
  passedTests++;
} else {
  console.log('   ❌ FAILED - No person entities detected');
  failedTests++;
}

// Test 3: PDF Text Normalization
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 3: PDF Text Normalization');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

if (fs.existsSync(pdfTestCase.path)) {
  console.log(`📋 Test: ${pdfTestCase.name}`);
  console.log(`   PDF: ${pdfTestCase.path.split('/').pop()}`);

  const converter = new PdfToMarkdown();
  const markdown = await converter.convert(pdfTestCase.path);

  console.log(`   Converted to ${markdown.length} chars of markdown`);
  console.log('\n   Checking for expected normalized text...');

  let _pdfTestsPassed = 0;
  let pdfTestsFailed = 0;

  for (const expected of pdfTestCase.expectedInNormalized) {
    const found = markdown.includes(expected);
    if (found) {
      console.log(`      ✅ Found: "${expected}"`);
      _pdfTestsPassed++;
    } else {
      console.log(`      ❌ Missing: "${expected}"`);
      pdfTestsFailed++;
    }
  }

  if (pdfTestsFailed === 0) {
    console.log('\n   ✅ PASSED - All expected text found');
    passedTests++;
  } else {
    console.log(`\n   ❌ FAILED - ${pdfTestsFailed} items missing`);
    failedTests++;

    // Show sample of normalized text
    console.log('\n   Sample of normalized text (first 500 chars):');
    console.log(`   ${markdown.substring(0, 500).replace(/\n/g, ' ')}`);
  }
} else {
  console.log(`⚠️  SKIPPED - PDF file not found: ${pdfTestCase.path}`);
}

// Summary
console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
console.log('║                    TEST SUMMARY                           ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');
console.log(`   Total Tests: ${passedTests + failedTests}`);
console.log(`   ✅ Passed: ${passedTests}`);
console.log(`   ❌ Failed: ${failedTests}`);
console.log(`   Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%\n`);

if (failedTests === 0) {
  console.log('🎉 All tests passed!\n');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Review the output above.\n');
  process.exit(1);
}
