#!/usr/bin/env node
/**
 * Hybrid Shared Folder Compilation Script
 *
 * Checks if any TypeScript source files in shared/ are newer than their
 * compiled JavaScript counterparts in shared/dist/. Only recompiles if needed.
 *
 * Usage:
 *   node scripts/compile-shared.mjs         # Check and compile if needed
 *   node scripts/compile-shared.mjs --force # Force recompile
 *
 * @see docs/sprint-artifacts/retrospectives/epic-11-retrospective.md
 */

import { execSync } from 'child_process';
import { statSync, readdirSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const sharedDir = join(projectRoot, 'shared');
const distDir = join(sharedDir, 'dist');

const FORCE = process.argv.includes('--force');
const VERBOSE = process.argv.includes('--verbose') || process.argv.includes('-v');

/**
 * Recursively get all TypeScript files in a directory
 */
function getTsFiles(dir, files = []) {
  if (!existsSync(dir)) return files;

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'dist' && entry.name !== 'node_modules') {
      getTsFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Get the corresponding .js file path for a .ts file
 */
function getJsPath(tsPath) {
  const relativePath = relative(sharedDir, tsPath);
  return join(distDir, relativePath.replace(/\.ts$/, '.js'));
}

/**
 * Check if source file is newer than compiled file
 */
function isSourceNewer(tsPath, jsPath) {
  if (!existsSync(jsPath)) {
    if (VERBOSE) console.log(`  [NEW] ${relative(sharedDir, tsPath)} (no compiled output)`);
    return true;
  }

  const tsStat = statSync(tsPath);
  const jsStat = statSync(jsPath);
  const isNewer = tsStat.mtimeMs > jsStat.mtimeMs;

  if (VERBOSE && isNewer) {
    console.log(`  [CHANGED] ${relative(sharedDir, tsPath)}`);
  }

  return isNewer;
}

/**
 * Main function
 */
function main() {
  console.log('Checking shared folder compilation status...');

  // Check if dist directory exists
  if (!existsSync(distDir)) {
    console.log('  dist/ directory does not exist - full compile needed');
    compile();
    return;
  }

  // Force recompile if requested
  if (FORCE) {
    console.log('  --force flag set - recompiling');
    compile();
    return;
  }

  // Get all TypeScript source files
  const tsFiles = getTsFiles(sharedDir);

  if (tsFiles.length === 0) {
    console.log('  No TypeScript files found in shared/');
    return;
  }

  if (VERBOSE) {
    console.log(`  Found ${tsFiles.length} TypeScript files`);
  }

  // Check if any source is newer than its compiled output
  let needsCompile = false;
  const changedFiles = [];

  for (const tsPath of tsFiles) {
    const jsPath = getJsPath(tsPath);
    if (isSourceNewer(tsPath, jsPath)) {
      needsCompile = true;
      changedFiles.push(relative(sharedDir, tsPath));
    }
  }

  if (needsCompile) {
    console.log(`  ${changedFiles.length} file(s) changed - recompiling shared/`);
    compile();
  } else {
    console.log('  All files up to date - no compilation needed');
  }
}

/**
 * Run TypeScript compiler in shared directory
 */
function compile() {
  console.log('  Compiling shared/ ...');
  try {
    execSync('npx tsc', {
      cwd: sharedDir,
      stdio: VERBOSE ? 'inherit' : 'pipe',
    });
    console.log('  Compilation successful');
  } catch (error) {
    console.error('  Compilation failed!');
    if (!VERBOSE) {
      console.error(error.stdout?.toString() || error.message);
    }
    process.exit(1);
  }
}

main();
