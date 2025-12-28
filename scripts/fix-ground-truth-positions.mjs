#!/usr/bin/env node
/**
 * Fix ground truth entity positions after fixture regeneration
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GROUND_TRUTH_PATH = path.join(__dirname, '../test/fixtures/piiAnnotated/realistic-ground-truth.json');
const FIXTURES_DIR = path.join(__dirname, '../test/fixtures/realistic');

function findEntityPosition(text, entityText) {
  const idx = text.indexOf(entityText);
  if (idx === -1) return null;
  return { start: idx, end: idx + entityText.length };
}

const groundTruth = JSON.parse(fs.readFileSync(GROUND_TRUTH_PATH, 'utf-8'));

let fixedCount = 0;
let notFoundCount = 0;

for (const [filename, doc] of Object.entries(groundTruth.documents)) {
  if (doc.entities === null || doc.entities === undefined || doc.entities.length === 0) continue;

  const filePath = path.join(FIXTURES_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.log(`${filename}: File not found`);
    continue;
  }

  const text = fs.readFileSync(filePath, 'utf-8');

  for (const entity of doc.entities) {
    const pos = findEntityPosition(text, entity.text);
    if (pos) {
      if (entity.start !== pos.start || entity.end !== pos.end) {
        console.log(`${filename}: Fixed ${entity.type} "${entity.text.substring(0, 25)}..."`);
        console.log(`  Old: ${entity.start}-${entity.end}, New: ${pos.start}-${pos.end}`);
        entity.start = pos.start;
        entity.end = pos.end;
        fixedCount++;
      }
    } else {
      console.log(`${filename}: Could not find "${entity.text.substring(0, 30)}..." (${entity.type})`);
      notFoundCount++;
    }
  }
}

fs.writeFileSync(GROUND_TRUTH_PATH, JSON.stringify(groundTruth, null, 2) + '\n');
console.log(`\nDone: ${fixedCount} fixed, ${notFoundCount} not found.`);
