#!/usr/bin/env node
/**
 * Baseline Metrics Capture Script
 *
 * Runs PII detection against annotated fixtures and captures precision/recall metrics.
 * Used to establish baseline before Epic 8 improvements.
 *
 * Usage:
 *   node scripts/capture-baseline.mjs
 *   node scripts/capture-baseline.mjs --output test/baselines/epic8-before.json
 *   node scripts/capture-baseline.mjs --dry-run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Import shared accuracy utilities
const accuracyModule = await import('../shared/dist/test/accuracy.js');
const {
  calculatePrecisionRecall,
  aggregateMetrics,
  formatMetrics,
  normalizeEntityType,
} = accuracyModule;

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const outputIndex = args.indexOf('--output');
const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : path.join(projectRoot, 'test/baselines/epic8-before.json');

console.log('=== PII Detection Baseline Capture ===\n');
console.log(`Mode: ${dryRun ? 'DRY RUN' : 'CAPTURE'}`);
console.log(`Output: ${outputPath}\n`);

// Load ground truth annotations
const groundTruthPath = path.join(projectRoot, 'test/fixtures/piiAnnotated/realistic-ground-truth.json');
const groundTruth = JSON.parse(fs.readFileSync(groundTruthPath, 'utf-8'));

// Load fixtures directory
const fixturesDir = path.join(projectRoot, 'test/fixtures/realistic');

/**
 * Simple PII detection using rule-based patterns only
 * (ML model not loaded in script context)
 */
function detectPIISimple(text) {
  const entities = [];
  let id = 0;

  // Swiss AVS pattern: 756.XXXX.XXXX.XX
  const avsPattern = /756\.\d{4}\.\d{4}\.\d{2}/g;
  let match;
  while ((match = avsPattern.exec(text)) !== null) {
    entities.push({
      text: match[0],
      type: 'SWISS_AVS',
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.95,
      id: `entity_${id++}`,
    });
  }

  // IBAN pattern: CH followed by digits and spaces
  const ibanPattern = /CH\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{4}[\s]?\d{1}/g;
  while ((match = ibanPattern.exec(text)) !== null) {
    entities.push({
      text: match[0],
      type: 'IBAN',
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.95,
      id: `entity_${id++}`,
    });
  }

  // Email pattern
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  while ((match = emailPattern.exec(text)) !== null) {
    entities.push({
      text: match[0],
      type: 'EMAIL',
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.90,
      id: `entity_${id++}`,
    });
  }

  // Swiss phone pattern: +41 XX XXX XX XX
  const phonePattern = /\+41[\s]?\d{2}[\s]?\d{3}[\s]?\d{2}[\s]?\d{2}/g;
  while ((match = phonePattern.exec(text)) !== null) {
    entities.push({
      text: match[0],
      type: 'PHONE_NUMBER',
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.90,
      id: `entity_${id++}`,
    });
  }

  // Date patterns (various formats)
  const datePatterns = [
    /\d{2}[./-]\d{2}[./-]\d{4}/g,  // DD.MM.YYYY, DD/MM/YYYY
    /\d{2}[./-]\d{1,2}[./-]\d{4}/g,  // DD.M.YYYY
    /\d{1,2}\s+(?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|January|February|March|April|May|June|July|August|September|October|November|December|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}/gi,
  ];

  for (const pattern of datePatterns) {
    while ((match = pattern.exec(text)) !== null) {
      // Avoid duplicates
      const exists = entities.some(e => e.start === match.index && e.type === 'DATE');
      if (!exists) {
        entities.push({
          text: match[0],
          type: 'DATE',
          start: match.index,
          end: match.index + match[0].length,
          confidence: 0.85,
          id: `entity_${id++}`,
        });
      }
    }
  }

  return entities;
}

/**
 * Process all annotated documents and calculate metrics
 */
async function captureBaseline() {
  const results = {
    electron: {
      documents: [],
      metrics: null,
    },
    browser: {
      documents: [],
      metrics: null,
    },
  };

  const allMetrics = [];
  const byDocumentType = {};
  const byLanguage = {};

  // Process each annotated document
  for (const [filename, docInfo] of Object.entries(groundTruth.documents)) {
    if (!docInfo.entities || docInfo.entities.length === 0) {
      console.log(`  Skipping ${filename} (no annotations)`);
      continue;
    }

    const filePath = path.join(fixturesDir, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`  Skipping ${filename} (file not found)`);
      continue;
    }

    const text = fs.readFileSync(filePath, 'utf-8');
    console.log(`Processing: ${filename}`);

    // Detect PII using simple rule-based detection
    const detected = detectPIISimple(text);

    // Normalize expected entities
    const expected = docInfo.entities.map(e => ({
      ...e,
      type: normalizeEntityType(e.type),
    }));

    // Calculate metrics
    const metrics = calculatePrecisionRecall(detected, expected);
    allMetrics.push(metrics);

    // Track by document type
    const docType = docInfo.documentType || 'unknown';
    if (!byDocumentType[docType]) {
      byDocumentType[docType] = [];
    }
    byDocumentType[docType].push(metrics);

    // Track by language
    const lang = docInfo.language || 'unknown';
    if (!byLanguage[lang]) {
      byLanguage[lang] = [];
    }
    byLanguage[lang].push(metrics);

    results.electron.documents.push({
      filename,
      language: docInfo.language,
      documentType: docInfo.documentType,
      expectedCount: expected.length,
      detectedCount: detected.length,
      precision: metrics.precision,
      recall: metrics.recall,
      f1: metrics.f1,
    });

    console.log(`  Expected: ${expected.length}, Detected: ${detected.length}`);
    console.log(`  Precision: ${(metrics.precision * 100).toFixed(1)}%, Recall: ${(metrics.recall * 100).toFixed(1)}%`);
  }

  // Aggregate overall metrics
  const overall = aggregateMetrics(allMetrics);
  results.electron.metrics = overall;

  // Note: Browser metrics would be captured separately via Vitest
  // For now, copy Electron metrics as placeholder
  results.browser = JSON.parse(JSON.stringify(results.electron));

  console.log('\n=== Overall Metrics ===\n');
  console.log(formatMetrics(overall));

  return { results, byDocumentType, byLanguage };
}

/**
 * Update baseline file with captured metrics
 */
function updateBaselineFile(outputPath, capturedData) {
  const { results, byDocumentType, byLanguage: _byLanguage } = capturedData;

  // Load existing baseline
  let baseline;
  if (fs.existsSync(outputPath)) {
    baseline = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
  } else {
    console.error(`Baseline file not found: ${outputPath}`);
    process.exit(1);
  }

  // Update Electron metrics
  const electronMetrics = results.electron.metrics;
  baseline.platforms.electron.overall = {
    precision: electronMetrics.precision,
    recall: electronMetrics.recall,
    f1: electronMetrics.f1,
    documentsEvaluated: results.electron.documents.length,
    totalEntitiesExpected: results.electron.documents.reduce((sum, d) => sum + d.expectedCount, 0),
    totalEntitiesDetected: results.electron.documents.reduce((sum, d) => sum + d.detectedCount, 0),
  };

  // Update per-entity-type metrics
  for (const [type, typeMetrics] of Object.entries(electronMetrics.perEntityType)) {
    if (baseline.platforms.electron.perEntityType[type]) {
      baseline.platforms.electron.perEntityType[type].precision = typeMetrics.precision;
      baseline.platforms.electron.perEntityType[type].recall = typeMetrics.recall;
      baseline.platforms.electron.perEntityType[type].f1 = typeMetrics.f1;
    }
  }

  // Update browser metrics (placeholder - same as Electron for now)
  baseline.platforms.browser.overall = { ...baseline.platforms.electron.overall };
  for (const [type, typeMetrics] of Object.entries(electronMetrics.perEntityType)) {
    if (baseline.platforms.browser.perEntityType[type]) {
      baseline.platforms.browser.perEntityType[type].precision = typeMetrics.precision;
      baseline.platforms.browser.perEntityType[type].recall = typeMetrics.recall;
      baseline.platforms.browser.perEntityType[type].f1 = typeMetrics.f1;
    }
  }

  // Update by document type
  for (const [docType, metricsArray] of Object.entries(byDocumentType)) {
    const aggregated = aggregateMetrics(metricsArray);
    if (baseline.byDocumentType[docType]) {
      baseline.byDocumentType[docType].electron = {
        precision: aggregated.precision,
        recall: aggregated.recall,
      };
      baseline.byDocumentType[docType].browser = {
        precision: aggregated.precision,
        recall: aggregated.recall,
      };
    }
  }

  // Update timestamp
  baseline.created = new Date().toISOString().split('T')[0];

  return baseline;
}

// Main execution
try {
  const capturedData = await captureBaseline();

  if (dryRun) {
    console.log('\n[DRY RUN] Would update baseline file with captured metrics');
    console.log('Run without --dry-run to save results.');
  } else {
    const updatedBaseline = updateBaselineFile(outputPath, capturedData);
    fs.writeFileSync(outputPath, JSON.stringify(updatedBaseline, null, 2));
    console.log(`\n✓ Baseline saved to ${outputPath}`);
  }
} catch (error) {
  console.error('Error capturing baseline:', error);
  process.exit(1);
}
