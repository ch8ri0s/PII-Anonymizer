#!/usr/bin/env node

/**
 * Patch pdf-parse to prevent it from running debug code in production
 * The library incorrectly detects Electron packaged apps as debug mode
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pdfParseIndexPath = join(__dirname, '../node_modules/pdf-parse/index.js');

try {
  let content = readFileSync(pdfParseIndexPath, 'utf8');

  // Replace the problematic debug mode check
  const originalCode = 'let isDebugMode = !module.parent;';
  const patchedCode = 'let isDebugMode = false; // Patched: disable debug mode to prevent file access errors in packaged apps';

  if (content.includes(originalCode)) {
    content = content.replace(originalCode, patchedCode);
    writeFileSync(pdfParseIndexPath, content, 'utf8');
    console.log('✅ Successfully patched pdf-parse');
  } else if (content.includes(patchedCode)) {
    console.log('✅ pdf-parse already patched');
  } else {
    console.warn('⚠️  Could not find code to patch in pdf-parse');
  }
} catch (error) {
  console.error('❌ Failed to patch pdf-parse:', error.message);
  process.exit(1);
}
