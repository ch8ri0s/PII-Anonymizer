/**
 * Global Teardown for Playwright Tests
 *
 * Runs after all tests complete to clean up resources.
 */

import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

async function globalTeardown(_config: FullConfig) {
  const testResultsDir = path.join(process.cwd(), 'test-results');

  // Clean up test-results directory if all tests passed
  // (preserveOutput: 'failures-only' keeps failure artifacts)
  if (fs.existsSync(testResultsDir)) {
    const entries = fs.readdirSync(testResultsDir);

    // Remove empty directories
    for (const entry of entries) {
      const entryPath = path.join(testResultsDir, entry);
      const stat = fs.statSync(entryPath);

      if (stat.isDirectory()) {
        const contents = fs.readdirSync(entryPath);
        if (contents.length === 0) {
          fs.rmdirSync(entryPath);
        }
      }
    }

    // Remove test-results if empty
    const remaining = fs.readdirSync(testResultsDir);
    if (remaining.length === 0) {
      fs.rmdirSync(testResultsDir);
    }
  }

  console.log('\n✓ Test cleanup completed');
}

export default globalTeardown;
