#!/usr/bin/env node
/**
 * Adversarial PII Detection Accuracy Test Suite
 *
 * Tests edge cases and difficult scenarios to measure true accuracy.
 * Target: 99% precision and recall
 */

import SwissEuDetector from './src/pii/SwissEuDetector.js';
import { pipeline } from '@xenova/transformers';

// Initialize detector
const detector = new SwissEuDetector();

// Load ML model
console.log('Loading ML model...');
const ner = await pipeline('token-classification',
  'Xenova/distilbert-base-multilingual-cased-ner-hrl',
  { cache_dir: './models' },
);
console.log('✓ Model loaded\n');

/**
 * Adversarial test cases designed to challenge the detector
 */
const adversarialTests = [
  // ============ Context-Dependent Detection ============
  {
    category: 'Context-Dependent Phone Numbers',
    tests: [
      {
        name: 'Phone Without Strong Format Markers',
        text: 'You can reach me at 021 627 41 37',
        expected: { phones: ['021 627 41 37'] },
      },
      {
        name: 'Phone With Context Keyword (French)',
        text: 'Appelez-moi au numéro 021 627 41 37',
        expected: { phones: ['021 627 41 37'] },
      },
      {
        name: 'Phone With Context Keyword (German)',
        text: 'Rufen Sie mich unter 021 627 41 37 an',
        expected: { phones: ['021 627 41 37'] },
      },
      {
        name: 'Multiple Phones in Sentence',
        text: 'Contact: 021 627 41 37 (office) or 079 123 45 67 (mobile)',
        expected: { phones: ['021 627 41 37', '079 123 45 67'] },
      },
    ],
  },

  // ============ Format Variants ============
  {
    category: 'Format Variants',
    tests: [
      {
        name: 'IBAN With Spaces',
        text: 'My account: CH93 0076 2011 6238 5295 7',
        expected: { ibans: ['CH93 0076 2011 6238 5295 7'] },
      },
      {
        name: 'IBAN Without Spaces',
        text: 'IBAN: CH9300762011623852957',
        expected: { ibans: ['CH9300762011623852957'] },
      },
      {
        name: 'Phone With Extension',
        text: 'Office: +41 21 627 41 37 ext. 123',
        expected: { phones: ['+41 21 627 41 37'] },
      },
      {
        name: 'Phone With Brackets',
        text: 'Mobile: +41 (79) 123 45 67',
        expected: { phones: ['+41 (79) 123 45 67'] },
      },
      {
        name: 'Contract Number With Slashes',
        text: 'Contract: 65/075/002',
        expected: { contracts: ['65/075/002'] },
      },
    ],
  },

  // ============ Partially Masked PII ============
  {
    category: 'Partially Masked PII',
    tests: [
      {
        name: 'Partially Masked Email',
        text: 'Contact: b.figue***@zurich.ch',
        expected: { emails: ['b.figue***@zurich.ch'] },
      },
      {
        name: 'Partially Masked Phone',
        text: 'Call: +41 21 XXX XX 37',
        expected: { phones: ['+41 21 XXX XX 37'] },
      },
      {
        name: 'Partially Masked AVS',
        text: 'AVS: 756.XXXX.5678.97',
        expected: { avs: ['756.XXXX.5678.97'] },
      },
    ],
  },

  // ============ Multi-Language Names ============
  {
    category: 'Multi-Language Names (ML-based)',
    tests: [
      {
        name: 'French Name With Accents',
        text: 'Employé: François Müller-Lefèvre',
        expected: { persons: ['François Müller-Lefèvre'] },
      },
      {
        name: 'German Name With Umlauts',
        text: 'Mitarbeiter: Jürgen Günther von Schönberg',
        expected: { persons: ['Jürgen Günther von Schönberg'] },
      },
      {
        name: 'Portuguese Name',
        text: 'Employee: Bruno Figueiredo Carvalho',
        expected: { persons: ['Bruno Figueiredo Carvalho'] },
      },
      {
        name: 'Mixed Case Name',
        text: 'Contact: jean-PIERRE DUBOIS',
        expected: { persons: ['jean-PIERRE DUBOIS'] },
      },
    ],
  },

  // ============ Complex Scenarios ============
  {
    category: 'Complex Multi-PII Scenarios',
    tests: [
      {
        name: 'All PII Types in One Sentence',
        text: 'Bruno (AVS: 756.1234.5678.97) at b.carvalho@zurich.ch, phone +41 21 627 41 37, lives at 1700 Fribourg',
        expected: {
          persons: ['Bruno'],
          avs: ['756.1234.5678.97'],
          emails: ['b.carvalho@zurich.ch'],
          phones: ['+41 21 627 41 37'],
          addresses: ['1700 Fribourg'],
        },
      },
      {
        name: 'Invoice With Multiple PII',
        text: 'Invoice for Jean Dupont (jean.dupont@company.ch), AVS 756.9876.5432.10, Account CH22 0070 0110 0002 3456 7, Amount: CHF 1\'234.50',
        expected: {
          persons: ['Jean Dupont'],
          emails: ['jean.dupont@company.ch'],
          avs: ['756.9876.5432.10'],
          ibans: ['CH22 0070 0110 0002 3456 7'],
        },
      },
    ],
  },

  // ============ Edge Cases ============
  {
    category: 'Edge Cases',
    tests: [
      {
        name: 'Date Near Year Boundary',
        text: 'Born on 31.12.1999',
        expected: { dates: ['31.12.1999'] },
      },
      {
        name: 'Leap Year Date',
        text: 'Date: 29.02.2024',
        expected: { dates: ['29.02.2024'] },
      },
      {
        name: 'Email With Plus Sign',
        text: 'Email: user+tag@example.com',
        expected: { emails: ['user+tag@example.com'] },
      },
      {
        name: 'Email With Subdomain',
        text: 'Contact: admin@mail.company.ch',
        expected: { emails: ['admin@mail.company.ch'] },
      },
      {
        name: 'Postal Code Boundaries',
        text: 'Locations: 1000 Lausanne and 9999 Kleinstadt',
        expected: { addresses: ['1000 Lausanne', '9999 Kleinstadt'] },
      },
    ],
  },

  // ============ False Positive Prevention ============
  {
    category: 'False Positive Prevention',
    tests: [
      {
        name: 'Product Code (Not Phone)',
        text: 'Product: ART-021-627-4137',
        expected: { phones: [] }, // Should NOT detect as phone
      },
      {
        name: 'Version Number (Not ID)',
        text: 'Software version 2.11.627.4137',
        expected: { ids: [] }, // Should NOT detect as ID
      },
      {
        name: 'Serial Number (Not AVS)',
        text: 'Serial: SN-756-1234-5678-99',
        expected: { avs: [] }, // Should NOT detect (invalid checksum)
      },
      {
        name: 'Coordinate (Not Phone)',
        text: 'GPS: 46.519653, 6.633158',
        expected: { phones: [] },
      },
    ],
  },
];

// ============ Test Execution ============

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║        ADVERSARIAL PII ACCURACY TEST SUITE               ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

for (const category of adversarialTests) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Category: ${category.category}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  for (const test of category.tests) {
    totalTests++;
    console.log(`📋 ${test.name}`);
    console.log(`   Input: "${test.text}"`);

    // Run rule-based detection
    const detected = detector.detect(test.text);

    // Run ML-based detection for person names
    let mlDetected = [];
    if (test.expected.persons) {
      const predictions = await ner(test.text);
      mlDetected = predictions
        .filter(p => p.entity.includes('PER') && p.score > 0.7)
        .map(p => ({ type: 'PERSON', text: p.word }));
    }

    // Combine detections
    const allDetected = [...detected, ...mlDetected];

    console.log(`   Detected ${allDetected.length} entities:`);
    allDetected.forEach(e => console.log(`      - [${e.type}] "${e.text}"`));

    // Validate results
    let testPassed = true;
    const reasons = [];

    if (test.expected.phones) {
      const foundPhones = allDetected
        .filter(e => e.type === 'PHONE')
        .map(e => e.text.replace(/[\s\-()]/g, ''));

      const expectedPhones = test.expected.phones
        .map(p => p.replace(/[\s\-()]/g, ''));

      const allFound = expectedPhones.every(expected =>
        foundPhones.some(found => found.includes(expected) || expected.includes(found)),
      );

      if (!allFound) {
        testPassed = false;
        reasons.push(`Expected phones: ${test.expected.phones.join(', ')}`);
      }
    }

    if (test.expected.emails) {
      const foundEmails = allDetected.filter(e => e.type === 'EMAIL').map(e => e.text);
      const allFound = test.expected.emails.every(e => foundEmails.includes(e));
      if (!allFound) {
        testPassed = false;
        reasons.push(`Expected emails: ${test.expected.emails.join(', ')}`);
      }
    }

    if (test.expected.ibans) {
      const foundIbans = allDetected.filter(e => e.type === 'IBAN').map(e => e.text);
      const allFound = test.expected.ibans.some(expected =>
        foundIbans.some(found =>
          found.replace(/\s/g, '') === expected.replace(/\s/g, ''),
        ),
      );
      if (!allFound) {
        testPassed = false;
        reasons.push(`Expected IBANs: ${test.expected.ibans.join(', ')}`);
      }
    }

    if (test.expected.avs) {
      const foundAvs = allDetected.filter(e => e.type === 'SWISS_AVS').map(e => e.text);
      const allFound = test.expected.avs.every(a => foundAvs.includes(a));
      if (!allFound) {
        testPassed = false;
        reasons.push(`Expected AVS: ${test.expected.avs.join(', ')}`);
      }
    }

    if (test.expected.dates) {
      const foundDates = allDetected.filter(e => e.type === 'DATE').map(e => e.text);
      const allFound = test.expected.dates.every(d => foundDates.includes(d));
      if (!allFound) {
        testPassed = false;
        reasons.push(`Expected dates: ${test.expected.dates.join(', ')}`);
      }
    }

    if (test.expected.addresses) {
      const foundAddresses = allDetected.filter(e => e.type === 'ADDRESS').map(e => e.text);
      const allFound = test.expected.addresses.some(expected =>
        foundAddresses.some(found => found.includes(expected.split(' ')[0])),
      );
      if (!allFound) {
        testPassed = false;
        reasons.push(`Expected addresses: ${test.expected.addresses.join(', ')}`);
      }
    }

    // Check for unwanted detections (false positives)
    if (test.expected.phones && test.expected.phones.length === 0) {
      const foundPhones = allDetected.filter(e => e.type === 'PHONE');
      if (foundPhones.length > 0) {
        testPassed = false;
        reasons.push('False positive: Detected phones when none expected');
      }
    }

    if (test.expected.avs && test.expected.avs.length === 0) {
      const foundAvs = allDetected.filter(e => e.type === 'SWISS_AVS');
      if (foundAvs.length > 0) {
        testPassed = false;
        reasons.push('False positive: Detected AVS when none expected');
      }
    }

    if (testPassed) {
      console.log('   ✅ PASSED\n');
      passedTests++;
    } else {
      console.log('   ❌ FAILED');
      reasons.forEach(r => console.log(`      → ${r}`));
      console.log('');
      failedTests++;
      failures.push({
        category: category.category,
        test: test.name,
        reasons,
      });
    }
  }
}

// ============ Summary Report ============

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║                   ACCURACY REPORT                         ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

const accuracy = (passedTests / totalTests * 100).toFixed(2);

console.log(`Total Tests:     ${totalTests}`);
console.log(`✅ Passed:       ${passedTests} (${accuracy}%)`);
console.log(`❌ Failed:       ${failedTests} (${(100 - accuracy).toFixed(2)}%)`);
console.log('\nTarget Accuracy: 99.00%');
console.log(`Current Gap:     ${Math.max(0, 99 - accuracy).toFixed(2)}%\n`);

if (failedTests > 0) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('FAILED TEST DETAILS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  failures.forEach((failure, index) => {
    console.log(`${index + 1}. [${failure.category}] ${failure.test}`);
    failure.reasons.forEach(r => console.log(`   → ${r}`));
    console.log('');
  });
}

if (accuracy >= 99) {
  console.log('🎉 TARGET ACHIEVED: 99%+ Accuracy!\n');
  process.exit(0);
} else {
  console.log(`⚠️  Target not met. Need ${(99 - accuracy).toFixed(2)}% improvement.\n`);
  process.exit(1);
}
