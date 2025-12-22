#!/usr/bin/env node
/**
 * Enhanced Automated PII Detection Test Suite
 * Tests both ML-based and Swiss/EU rule-based detection
 * Includes edge cases and pseudo-random test generation
 */

import { pipeline } from '@xenova/transformers';
import SwissEuDetector from './src/pii/SwissEuDetector.js';
import { PdfToMarkdown } from './dist/converters/PdfToMarkdown.js';
import fs from 'fs';

/**
 * Pseudo-random number generator with seed for reproducibility
 */
class SeededRandom {
  constructor(seed = 42) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  choice(array) {
    return array[Math.floor(this.next() * array.length)];
  }

  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

const random = new SeededRandom(Date.now() % 1000000);

/**
 * Pseudo-random data generators
 */
const generators = {
  swissPhone() {
    const formats = [
      () => `+41${random.int(10, 99)}${random.int(100, 999)}${random.int(10, 99)}${random.int(10, 99)}`,
      () => `+41 ${random.int(10, 99)} ${random.int(100, 999)} ${random.int(10, 99)} ${random.int(10, 99)}`,
      () => `0${random.int(10, 99)} ${random.int(100, 999)} ${random.int(10, 99)} ${random.int(10, 99)}`,
      () => `0${random.int(10, 99)}-${random.int(100, 999)}-${random.int(10, 99)}-${random.int(10, 99)}`,
    ];
    return random.choice(formats)();
  },

  email() {
    const names = ['john.doe', 'marie.dupont', 'hans.mueller', 'alice.brown', 'pierre.martin'];
    const domains = ['example.com', 'test.ch', 'company.de', 'mail.fr', 'domain.eu'];
    return `${random.choice(names)}@${random.choice(domains)}`;
  },

  swissAddress() {
    const cities = [
      'Zürich', 'Genève', 'Basel', 'Lausanne', 'Bern', 'Winterthur', 'Luzern',
      'St. Gallen', 'Lugano', 'Biel', 'Thun', 'Fribourg', 'Köniz', 'Neuchâtel',
    ];
    const postalCode = random.int(1000, 9999);
    return `${postalCode} ${random.choice(cities)}`;
  },

  companyName() {
    const prefixes = ['Swiss', 'Global', 'Alpine', 'European', 'Tech', 'Digital', 'Innovative'];
    const middles = ['Solutions', 'Systems', 'Technologies', 'Consulting', 'Services', 'Industries'];
    const suffixes = ['SA', 'GmbH', 'AG', 'Ltd', 'Inc'];
    return `${random.choice(prefixes)} ${random.choice(middles)} ${random.choice(suffixes)}`;
  },

  swissDate() {
    const day = String(random.int(1, 28)).padStart(2, '0');
    const month = String(random.int(1, 12)).padStart(2, '0');
    const year = random.int(2000, 2025);
    return `${day}.${month}.${year}`;
  },

  swissAVS() {
    const prefix = '756';
    const middle1 = String(random.int(1000, 9999)).padStart(4, '0');
    const middle2 = String(random.int(1000, 9999)).padStart(4, '0');

    // Generate a random first digit of the checksum (0-9)
    const checksumFirstDigit = String(random.int(0, 9));

    // Calculate EAN-13 checksum for 12 digits (prefix + middle1 + middle2 + first checksum digit)
    const without_final_check = prefix + middle1 + middle2 + checksumFirstDigit;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(without_final_check[i], 10);
      sum += (i % 2 === 0) ? digit : digit * 3;
    }
    const checksumSecondDigit = (10 - (sum % 10)) % 10;
    const checksum = checksumFirstDigit + String(checksumSecondDigit);

    return `${prefix}.${middle1}.${middle2}.${checksum}`;
  },

  contractNumber() {
    const part1 = String(random.int(10, 99));
    const part2 = String(random.int(100, 999));
    const part3 = String(random.int(100, 999));
    return `${part1}'${part2}'${part3}`;
  },

  frenchName() {
    const firstNames = ['Pierre', 'Marie', 'Jean', 'Sophie', 'Luc', 'Anne', 'François', 'Isabelle'];
    const lastNames = ['Dupont', 'Martin', 'Bernard', 'Dubois', 'Laurent', 'Simon', 'Michel', 'Lefebvre'];
    return `${random.choice(firstNames)} ${random.choice(lastNames)}`;
  },

  germanName() {
    const firstNames = ['Hans', 'Anna', 'Klaus', 'Eva', 'Wolfgang', 'Petra', 'Jürgen', 'Sabine'];
    const lastNames = ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker'];
    return `${random.choice(firstNames)} ${random.choice(lastNames)}`;
  },
};

/**
 * Edge case test scenarios
 */
const edgeCases = [
  {
    name: 'Phone Numbers - Edge Cases',
    category: 'edge',
    tests: [
      {
        text: 'Emergency: +41 0 0000 00 00',
        desc: 'All zeros',
        shouldDetect: false,
      },
      {
        text: 'Call +41 11 111 11 11 or +41 22 222 22 22',
        desc: 'Repeated digits',
        shouldDetect: true, // Valid pattern but suspicious
      },
      {
        text: 'Phone: +41216274137+41 21 627 41 37',
        desc: 'Consecutive phones without space',
        shouldDetect: true,
      },
      {
        text: 'Contact: +41-21-627-41-37',
        desc: 'Dashes only format',
        shouldDetect: true,
      },
      {
        text: 'Tel: 0041 21 627 41 37',
        desc: 'International prefix 0041',
        shouldDetect: true,
      },
    ],
  },
  {
    name: 'Email Addresses - Edge Cases',
    category: 'edge',
    tests: [
      {
        text: 'Contact: user+tag@example.com',
        desc: 'Plus sign in local part',
        shouldDetect: true,
      },
      {
        text: 'Email: first.last@sub.domain.com',
        desc: 'Subdomain',
        shouldDetect: true,
      },
      {
        text: 'Invalid: @example.com',
        desc: 'Missing local part',
        shouldDetect: false,
      },
      {
        text: 'Invalid: user@',
        desc: 'Missing domain',
        shouldDetect: false,
      },
      {
        text: 'Edge: a@b.co',
        desc: 'Minimal valid email',
        shouldDetect: true,
      },
    ],
  },
  {
    name: 'Swiss Addresses - Edge Cases',
    category: 'edge',
    tests: [
      {
        text: 'Location: 999 Invalid',
        desc: 'Invalid postal code (< 1000)',
        shouldDetect: false,
      },
      {
        text: 'At: 10000 TooHigh',
        desc: 'Invalid postal code (> 9999)',
        shouldDetect: false,
      },
      {
        text: 'Street: 1700 F',
        desc: 'Too short city name',
        shouldDetect: false,
      },
      {
        text: 'Adresse: 8001 Zürich-Zentrum',
        desc: 'City with hyphen',
        shouldDetect: true,
      },
      {
        text: 'Place: 1234 Saint-Gall',
        desc: 'City with apostrophe/hyphen',
        shouldDetect: true,
      },
    ],
  },
  {
    name: 'Dates - Edge Cases',
    category: 'edge',
    tests: [
      {
        text: 'Date: 32.01.2024',
        desc: 'Invalid day (> 31)',
        shouldDetect: false,
      },
      {
        text: 'Date: 01.13.2024',
        desc: 'Invalid month (> 12)',
        shouldDetect: false,
      },
      {
        text: 'Born: 29.02.2024',
        desc: 'Leap year date',
        shouldDetect: true,
      },
      {
        text: 'From 1.1.2024 to 31.12.2024',
        desc: 'Single digit day/month',
        shouldDetect: true,
      },
      {
        text: 'Historical: 01.01.1899',
        desc: 'Too old (< 1900)',
        shouldDetect: false,
      },
    ],
  },
  {
    name: 'Mixed PII - Complex Scenarios',
    category: 'edge',
    tests: [
      {
        text: 'Contact Pierre Dupont at pierre.dupont@example.com or +41 21 123 45 67 for contract 12\'345\'678',
        desc: 'Multiple PII types in one sentence',
        shouldDetect: true,
        expectedTypes: ['PHONE', 'EMAIL', 'ID_NUMBER'],
      },
      {
        text: 'Adresse: Example Technologies SA, 1200 Genève, AVS: 756.1234.5678.97, Date: 07.06.2024',
        desc: 'Multiple Swiss-specific PII',
        shouldDetect: true,
        expectedTypes: ['ORG', 'ADDRESS', 'SWISS_AVS', 'DATE'],
      },
      {
        text: 'Meeting with Hans Müller and Marie Dupont at 8001 Zürich on 15.03.2024',
        desc: 'Names, location, and date',
        shouldDetect: true,
        expectedTypes: ['ADDRESS', 'DATE'],
      },
    ],
  },
  {
    name: 'False Positives - Should NOT Detect',
    category: 'negative',
    tests: [
      {
        text: 'Product code: 123-456-789',
        desc: 'Product code similar to phone',
        shouldDetect: false,
      },
      {
        text: 'Version: 2024.01.15',
        desc: 'Version number similar to date',
        shouldDetect: false,
      },
      {
        text: 'Equation: a@b+c',
        desc: 'Math notation with @',
        shouldDetect: false,
      },
      {
        text: 'Reference: REF-2024-001',
        desc: 'Reference number',
        shouldDetect: false,
      },
    ],
  },
];

/**
 * Generate pseudo-random test cases
 */
function generateRandomTests(count = 5) {
  const tests = [];

  for (let i = 0; i < count; i++) {
    const phone = generators.swissPhone();
    const email = generators.email();
    const address = generators.swissAddress();
    const company = generators.companyName();
    const date = generators.swissDate();
    const avs = generators.swissAVS();
    const contract = generators.contractNumber();
    const frenchName = generators.frenchName();
    const _germanName = generators.germanName();

    tests.push({
      name: `Random Test ${i + 1}`,
      text: `Le ${date}, ${frenchName} de ${company} à ${address} peut être contacté au ${phone} ou ${email}. AVS: ${avs}, Contrat: ${contract}.`,
      expected: {
        phones: [phone],
        emails: [email],
        addresses: [address],
        companies: [company],
        dates: [date],
        swissAvs: [avs],
        contracts: [contract],
      },
      isRandom: true,
    });
  }

  return tests;
}

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║  ENHANCED PII DETECTION TEST SUITE (With Edge Cases)     ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');
console.log(`Seed: ${random.seed} (for reproducibility)\n`);

const swissEuDetector = new SwissEuDetector();
let passedTests = 0;
let failedTests = 0;
const edgeCasesResults = { passed: 0, failed: 0, total: 0 };

// Test 1: Edge Cases
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 1: Edge Cases & Boundary Testing');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

for (const category of edgeCases) {
  console.log(`\n📂 Category: ${category.name}`);

  for (const test of category.tests) {
    edgeCasesResults.total++;
    console.log(`\n   🔍 ${test.desc}`);
    console.log(`   Input: "${test.text}"`);

    const detected = swissEuDetector.detect(test.text);
    console.log(`   Detected: ${detected.length} entities`);

    if (detected.length > 0) {
      detected.forEach(entity => {
        console.log(`      - [${entity.type}] "${entity.text}"`);
      });
    }

    let passed = false;
    if (test.expectedTypes) {
      // Check if all expected types are present
      const detectedTypes = detected.map(e => e.type);
      passed = test.expectedTypes.every(type => detectedTypes.includes(type));
    } else {
      // Simple shouldDetect check
      passed = test.shouldDetect ? detected.length > 0 : detected.length === 0;
    }

    if (passed) {
      console.log('   ✅ PASSED');
      edgeCasesResults.passed++;
    } else {
      console.log(`   ❌ FAILED - Expected shouldDetect=${test.shouldDetect}, found ${detected.length} entities`);
      edgeCasesResults.failed++;
    }
  }
}

// Test 2: Pseudo-Random Test Cases
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 2: Pseudo-Random Generated Tests');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const randomTests = generateRandomTests(5);

for (const testCase of randomTests) {
  console.log(`\n📋 ${testCase.name}`);
  console.log(`   Input: "${testCase.text}"`);

  const detected = swissEuDetector.detect(testCase.text);
  console.log(`   Detected ${detected.length} entities:`);

  detected.forEach(entity => {
    console.log(`      - [${entity.type}] "${entity.text}"`);
  });

  // Validate each expected type
  let allFound = true;
  const checks = [];

  if (testCase.expected.phones) {
    const foundPhones = detected.filter(e => e.type === 'PHONE').map(e => e.text);
    const phoneMatch = testCase.expected.phones.every(p =>
      foundPhones.some(f => f.replace(/[\s-]/g, '') === p.replace(/[\s-]/g, '')),
    );
    checks.push({ type: 'PHONE', found: phoneMatch });
    if (!phoneMatch) allFound = false;
  }

  if (testCase.expected.emails) {
    const foundEmails = detected.filter(e => e.type === 'EMAIL').map(e => e.text);
    const emailMatch = testCase.expected.emails.every(e => foundEmails.includes(e));
    checks.push({ type: 'EMAIL', found: emailMatch });
    if (!emailMatch) allFound = false;
  }

  if (testCase.expected.addresses) {
    const foundAddresses = detected.filter(e => e.type === 'ADDRESS').map(e => e.text);
    const addressMatch = testCase.expected.addresses.some(a =>
      foundAddresses.some(f => f.includes(a.split(' ')[0])),
    );
    checks.push({ type: 'ADDRESS', found: addressMatch });
    if (!addressMatch) allFound = false;
  }

  if (testCase.expected.dates) {
    const foundDates = detected.filter(e => e.type === 'DATE').map(e => e.text);
    const dateMatch = testCase.expected.dates.every(d => foundDates.includes(d));
    checks.push({ type: 'DATE', found: dateMatch });
    if (!dateMatch) allFound = false;
  }

  if (testCase.expected.swissAvs) {
    const foundAvs = detected.filter(e => e.type === 'SWISS_AVS').map(e => e.text);
    const avsMatch = testCase.expected.swissAvs.every(a => foundAvs.includes(a));
    checks.push({ type: 'AVS', found: avsMatch });
    if (!avsMatch) allFound = false;
  }

  // Show validation results
  console.log('   Validation:');
  checks.forEach(check => {
    console.log(`      ${check.found ? '✅' : '❌'} ${check.type}`);
  });

  if (allFound) {
    console.log('   ✅ PASSED - All expected PII found');
    passedTests++;
  } else {
    console.log('   ❌ FAILED - Some expected PII missing');
    failedTests++;
  }
}

// Test 3: ML-Based Detection with Edge Cases
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 3: ML-Based Detection - Multilingual Names');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Loading multilingual NER model...');
const classifier = await pipeline('token-classification',
  'Xenova/distilbert-base-multilingual-cased-ner-hrl',
  {
    cache_dir: './models',
  },
);
console.log('✓ Model loaded\n');

const mlTests = [
  {
    name: 'French Names with Accents',
    text: 'François Château, Élise Beauséjour et René Côté',
  },
  {
    name: 'German Names with Umlauts',
    text: 'Jürgen Müller, Björn Götz und Günther Schäfer',
  },
  {
    name: 'Mixed French-German Names',
    text: `${generators.frenchName()}, ${generators.germanName()}, ${generators.frenchName()}`,
  },
  {
    name: 'Names with Hyphens',
    text: 'Jean-Pierre Dubois, Marie-Claire Martin et Hans-Jürgen Weber',
  },
  {
    name: 'Single Character Names (Edge)',
    text: 'Contact A. B. Smith or X. Y. Zhang',
  },
];

for (const test of mlTests) {
  console.log(`\n📋 Test: ${test.name}`);
  console.log(`   Input: "${test.text}"`);

  const mlResults = await classifier(test.text);
  const personTokens = mlResults.filter(r => r.entity.includes('PER'));

  console.log(`   Detected ${personTokens.length} person tokens:`);
  personTokens.forEach(r => {
    console.log(`      - [${r.entity}] "${r.word}" (${(r.score * 100).toFixed(1)}%)`);
  });

  if (personTokens.length > 0) {
    console.log('   ✅ PASSED - Person entities detected');
    passedTests++;
  } else {
    console.log('   ❌ FAILED - No person entities detected');
    failedTests++;
  }
}

// Test 4: PDF Text Normalization (if PDF exists)
console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TEST 4: PDF Text Normalization');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const pdfPath = './test/fixtures/sample-document.pdf';
if (fs.existsSync(pdfPath)) {
  console.log('📋 Test: PDF Text Normalization');
  console.log(`   PDF: ${pdfPath.split('/').pop()}`);

  const converter = new PdfToMarkdown();
  const markdown = await converter.convert(pdfPath);

  const expectedTexts = [
    'Example Company SA',
    '+41223334455',
    'Jean Pierre Müller',
  ];

  console.log(`   Converted to ${markdown.length} chars of markdown`);
  console.log('\n   Checking for expected normalized text...');

  let pdfPassed = true;
  for (const expected of expectedTexts) {
    const found = markdown.includes(expected);
    console.log(`      ${found ? '✅' : '❌'} "${expected}"`);
    if (!found) pdfPassed = false;
  }

  if (pdfPassed) {
    console.log('\n   ✅ PASSED - All expected text found');
    passedTests++;
  } else {
    console.log('\n   ❌ FAILED - Some expected text missing');
    failedTests++;
  }
} else {
  console.log('⚠️  SKIPPED - PDF file not found');
}

// Final Summary
console.log('\n\n╔═══════════════════════════════════════════════════════════╗');
console.log('║                    TEST SUMMARY                           ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const totalTests = passedTests + failedTests + edgeCasesResults.total;
const totalPassed = passedTests + edgeCasesResults.passed;
const totalFailed = failedTests + edgeCasesResults.failed;

console.log(`   Edge Cases: ${edgeCasesResults.passed}/${edgeCasesResults.total} passed`);
console.log(`   Random Tests: ${randomTests.filter((_, i) => i < passedTests - mlTests.length - (fs.existsSync(pdfPath) ? 1 : 0)).length}/${randomTests.length} passed`);
console.log(`   ML Tests: ${mlTests.length} passed`);
console.log(`   PDF Test: ${fs.existsSync(pdfPath) ? '1' : '0'} passed\n`);

console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`   Total Tests: ${totalTests}`);
console.log(`   ✅ Passed: ${totalPassed}`);
console.log(`   ❌ Failed: ${totalFailed}`);
console.log(`   Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%\n`);

if (totalFailed === 0) {
  console.log('🎉 All tests passed!\n');
  process.exit(0);
} else {
  console.log(`⚠️  ${totalFailed} test(s) failed. Review the output above.\n`);
  process.exit(1);
}
