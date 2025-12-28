#!/usr/bin/env node
/**
 * Export Feedback Dataset Script (Story 8.9)
 *
 * Exports user correction feedback data for analysis and model improvement.
 * Reads local feedback log files and produces aggregated summaries.
 *
 * Usage:
 *   node scripts/export-feedback-dataset.mjs [options]
 *
 * Options:
 *   --mode=raw|anonymised  Export mode (default: anonymised)
 *   --output=<dir>         Output directory (default: ./feedback-export)
 *   --min-count=<n>        Minimum pattern count to include (default: 1)
 *   --max-patterns=<n>     Maximum patterns per category (default: 50)
 *   --include-contexts     Include example context windows
 *   --help                 Show this help message
 *
 * Output Files:
 *   feedback-summary.json   Aggregated pattern counts and statistics
 *   feedback-events.jsonl   Raw or anonymised events (one per line)
 *
 * Privacy:
 *   - Raw mode: Full events with context (internal use only)
 *   - Anonymised mode: Hashed patterns, no raw PII (safe for sharing)
 *
 * This script is designed to be run manually by maintainers.
 * It does NOT transmit data anywhere - all output is local.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log file pattern
const LOG_FILE_PATTERN = /^corrections-\d{4}-\d{2}\.json$/;

// Action mapping from legacy to new format
const LEGACY_ACTION_MAP = {
  'DISMISS': 'mark_as_not_pii',
  'ADD': 'mark_as_pii',
};

/**
 * Validate output path for security (prevent path traversal)
 * @param {string} outputDir - The output directory path
 * @returns {string} - Validated absolute path
 */
function validateOutputPath(outputDir) {
  const resolvedPath = path.resolve(outputDir);
  const cwd = process.cwd();
  const homeDir = os.homedir();

  // Allow paths within CWD, home directory, or /tmp
  const allowedPrefixes = [
    cwd,
    homeDir,
    '/tmp',
    os.tmpdir(),
  ];

  // On Windows, also allow the resolved path if it's on the same drive
  if (process.platform === 'win32') {
    const cwdDrive = cwd.slice(0, 3).toUpperCase();
    const resolvedDrive = resolvedPath.slice(0, 3).toUpperCase();
    if (cwdDrive === resolvedDrive) {
      return resolvedPath;
    }
  }

  const isAllowed = allowedPrefixes.some(prefix => resolvedPath.startsWith(prefix));

  if (!isAllowed) {
    console.error('Security error: Output directory must be within:');
    console.error(`  - Current working directory: ${cwd}`);
    console.error(`  - Home directory: ${homeDir}`);
    console.error(`  - Temp directory: ${os.tmpdir()}`);
    console.error(`\nProvided path resolves to: ${resolvedPath}`);
    process.exit(1);
  }

  return resolvedPath;
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {
    mode: 'anonymised',
    outputDir: './feedback-export',
    minCount: 1,
    maxPatterns: 50,
    includeContexts: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--mode=')) {
      options.mode = arg.slice(7);
      if (options.mode !== 'raw' && options.mode !== 'anonymised') {
        console.error(`Invalid mode: ${options.mode}. Use 'raw' or 'anonymised'.`);
        process.exit(1);
      }
    } else if (arg.startsWith('--output=')) {
      options.outputDir = arg.slice(9);
    } else if (arg.startsWith('--min-count=')) {
      options.minCount = parseInt(arg.slice(12), 10);
    } else if (arg.startsWith('--max-patterns=')) {
      options.maxPatterns = parseInt(arg.slice(15), 10);
    } else if (arg === '--include-contexts') {
      options.includeContexts = true;
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Export Feedback Dataset Script (Story 8.9)

Exports user correction feedback data for analysis and model improvement.

Usage:
  node scripts/export-feedback-dataset.mjs [options]

Options:
  --mode=raw|anonymised  Export mode (default: anonymised)
                         - raw: Full events with context (internal use only)
                         - anonymised: Hashed patterns, no raw PII
  --output=<dir>         Output directory (default: ./feedback-export)
  --min-count=<n>        Minimum pattern count to include (default: 1)
  --max-patterns=<n>     Maximum patterns per category (default: 50)
  --include-contexts     Include example context windows
  --help                 Show this help message

Output Files:
  feedback-summary.json   Aggregated pattern counts and statistics
  feedback-events.jsonl   Events (one JSON object per line)

Examples:
  # Export anonymised summary (safe for sharing)
  node scripts/export-feedback-dataset.mjs

  # Export raw data for internal analysis
  node scripts/export-feedback-dataset.mjs --mode=raw --include-contexts

  # Export to specific directory with minimum count filter
  node scripts/export-feedback-dataset.mjs --output=./analysis --min-count=3
`);
}

/**
 * Find the Electron app userData directory
 */
function findLogDirectory() {
  // Try common Electron userData locations
  const appName = 'A5-PII-Anonymizer';
  const candidates = [];

  if (process.platform === 'darwin') {
    candidates.push(path.join(os.homedir(), 'Library', 'Application Support', appName));
  } else if (process.platform === 'win32') {
    candidates.push(path.join(os.homedir(), 'AppData', 'Roaming', appName));
  } else {
    candidates.push(path.join(os.homedir(), '.config', appName));
  }

  // Also check XDG_DATA_HOME on Linux
  if (process.env.XDG_DATA_HOME) {
    candidates.push(path.join(process.env.XDG_DATA_HOME, appName));
  }

  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }

  return null;
}

/**
 * Load all log files from directory
 */
function loadLogFiles(logDir) {
  const entries = [];

  try {
    const files = fs.readdirSync(logDir);
    const logFiles = files.filter(f => LOG_FILE_PATTERN.test(f)).sort();

    console.log(`Found ${logFiles.length} log file(s) in ${logDir}`);

    for (const file of logFiles) {
      const filePath = path.join(logDir, file);
      try {
        const data = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(data);
        if (parsed.entries && Array.isArray(parsed.entries)) {
          entries.push(...parsed.entries);
          console.log(`  - ${file}: ${parsed.entries.length} entries`);
        }
      } catch (err) {
        console.warn(`  - ${file}: Failed to parse (${err.message})`);
      }
    }
  } catch (err) {
    console.error(`Failed to read log directory: ${err.message}`);
  }

  return entries;
}

/**
 * Convert legacy entry to FeedbackEvent
 */
function toFeedbackEvent(entry) {
  const action = LEGACY_ACTION_MAP[entry.action] || 'mark_as_not_pii';

  const entity = {
    text: entry.context?.slice(0, 200) || '',
    type: entry.entityType,
    start: entry.position?.start ?? 0,
    end: entry.position?.end ?? 0,
    confidence: entry.confidence,
    source: entry.originalSource,
  };

  return {
    id: entry.id,
    timestamp: entry.timestamp,
    source: 'desktop',
    documentId: entry.documentHash,
    action,
    originalEntity: action === 'mark_as_not_pii' ? entity : undefined,
    updatedEntity: action === 'mark_as_pii' ? entity : undefined,
    contextWindow: entry.context?.slice(0, 200),
  };
}

/**
 * Hash a pattern for anonymisation
 */
function hashPattern(text) {
  return crypto.createHash('sha256').update(text.toLowerCase().trim()).digest('hex').slice(0, 12);
}

/**
 * Anonymise a FeedbackEvent
 */
function anonymiseEvent(event) {
  const anonymised = { ...event };

  // Hash document ID (already hashed, but double-hash for extra privacy)
  anonymised.documentId = hashPattern(event.documentId);

  // Anonymise entity text
  if (anonymised.originalEntity) {
    anonymised.originalEntity = {
      ...anonymised.originalEntity,
      text: `[${anonymised.originalEntity.type}_PATTERN_${hashPattern(anonymised.originalEntity.text)}]`,
    };
  }

  if (anonymised.updatedEntity) {
    anonymised.updatedEntity = {
      ...anonymised.updatedEntity,
      text: `[${anonymised.updatedEntity.type}_PATTERN_${hashPattern(anonymised.updatedEntity.text)}]`,
    };
  }

  // Remove context window in anonymised mode
  delete anonymised.contextWindow;

  return anonymised;
}

/**
 * Aggregate events into patterns
 */
function aggregateEvents(events, options) {
  const falsePositives = new Map();
  const missedPii = new Map();

  for (const event of events) {
    if (event.action === 'mark_as_not_pii' && event.originalEntity) {
      const key = `${event.originalEntity.text.toLowerCase().trim()}|${event.originalEntity.type}`;
      const existing = falsePositives.get(key) || {
        pattern: event.originalEntity.text.trim(),
        entityType: event.originalEntity.type,
        count: 0,
        contexts: [],
        confidenceSum: 0,
        sources: new Set(),
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
      };
      existing.count++;
      if (event.originalEntity.confidence) {
        existing.confidenceSum += event.originalEntity.confidence;
      }
      if (event.originalEntity.source) {
        existing.sources.add(event.originalEntity.source);
      }
      if (options.includeContexts && event.contextWindow && existing.contexts.length < 3) {
        existing.contexts.push(event.contextWindow);
      }
      if (event.timestamp < existing.firstSeen) existing.firstSeen = event.timestamp;
      if (event.timestamp > existing.lastSeen) existing.lastSeen = event.timestamp;
      falsePositives.set(key, existing);
    }

    if (event.action === 'mark_as_pii' && event.updatedEntity) {
      const key = `${event.updatedEntity.text.toLowerCase().trim()}|${event.updatedEntity.type}`;
      const existing = missedPii.get(key) || {
        pattern: event.updatedEntity.text.trim(),
        entityType: event.updatedEntity.type,
        count: 0,
        contexts: [],
        firstSeen: event.timestamp,
        lastSeen: event.timestamp,
      };
      existing.count++;
      if (options.includeContexts && event.contextWindow && existing.contexts.length < 3) {
        existing.contexts.push(event.contextWindow);
      }
      if (event.timestamp < existing.firstSeen) existing.firstSeen = event.timestamp;
      if (event.timestamp > existing.lastSeen) existing.lastSeen = event.timestamp;
      missedPii.set(key, existing);
    }
  }

  // Convert to arrays, filter, sort, and limit
  const fpPatterns = Array.from(falsePositives.values())
    .filter(p => p.count >= options.minCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, options.maxPatterns)
    .map(p => ({
      pattern: options.mode === 'anonymised' ? `[${p.entityType}_PATTERN_${hashPattern(p.pattern)}]` : p.pattern,
      entityType: p.entityType,
      count: p.count,
      avgConfidence: p.confidenceSum > 0 ? p.confidenceSum / p.count : undefined,
      sources: p.sources.size > 0 ? Array.from(p.sources) : undefined,
      firstSeen: p.firstSeen,
      lastSeen: p.lastSeen,
      exampleContexts: options.includeContexts && p.contexts.length > 0 ? p.contexts : undefined,
    }));

  const missedPatterns = Array.from(missedPii.values())
    .filter(p => p.count >= options.minCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, options.maxPatterns)
    .map(p => ({
      pattern: options.mode === 'anonymised' ? `[${p.entityType}_PATTERN_${hashPattern(p.pattern)}]` : p.pattern,
      entityType: p.entityType,
      count: p.count,
      firstSeen: p.firstSeen,
      lastSeen: p.lastSeen,
      exampleContexts: options.includeContexts && p.contexts.length > 0 ? p.contexts : undefined,
    }));

  // Calculate date range
  const timestamps = events.map(e => e.timestamp).sort();

  // Count by action and source
  const byAction = {
    mark_as_not_pii: events.filter(e => e.action === 'mark_as_not_pii').length,
    mark_as_pii: events.filter(e => e.action === 'mark_as_pii').length,
    change_entity_type: events.filter(e => e.action === 'change_entity_type').length,
    adjust_confidence: events.filter(e => e.action === 'adjust_confidence').length,
  };

  const bySource = {
    desktop: events.filter(e => e.source === 'desktop').length,
    browser: events.filter(e => e.source === 'browser').length,
  };

  return {
    falsePositives: fpPatterns,
    missedPii: missedPatterns,
    totalEvents: events.length,
    dateRange: {
      start: timestamps[0] || new Date().toISOString(),
      end: timestamps[timestamps.length - 1] || new Date().toISOString(),
    },
    byAction,
    bySource,
  };
}

/**
 * Main export function
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Validate and resolve output path
  const validatedOutputDir = validateOutputPath(options.outputDir);

  console.log('\n=== Feedback Dataset Export ===\n');
  console.log(`Mode: ${options.mode}`);
  console.log(`Output: ${validatedOutputDir}`);
  console.log(`Min count: ${options.minCount}`);
  console.log(`Max patterns: ${options.maxPatterns}`);
  console.log(`Include contexts: ${options.includeContexts}`);

  // Warn about raw mode
  if (options.mode === 'raw') {
    console.log('\n⚠️  WARNING: Raw mode exports may contain sensitive pattern data.');
    console.log('   Do not share raw exports externally.\n');
  } else {
    console.log('');
  }

  // Find log directory
  const logDir = findLogDirectory();
  if (!logDir) {
    console.error('Could not find Electron app userData directory.');
    console.error('Make sure the A5-PII-Anonymizer app has been run at least once.');
    process.exit(1);
  }

  console.log(`Log directory: ${logDir}\n`);

  // Load all entries
  const entries = loadLogFiles(logDir);
  if (entries.length === 0) {
    console.log('\nNo feedback entries found. Nothing to export.');
    process.exit(0);
  }

  console.log(`\nTotal entries: ${entries.length}\n`);

  // Convert to FeedbackEvents
  const events = entries.map(toFeedbackEvent);

  // Aggregate
  const summary = aggregateEvents(events, options);

  // Create output directory with error handling
  try {
    fs.mkdirSync(validatedOutputDir, { recursive: true });
  } catch (err) {
    console.error(`Failed to create output directory: ${err.message}`);
    process.exit(1);
  }

  // Write summary
  const summaryPath = path.join(validatedOutputDir, 'feedback-summary.json');
  const summaryData = {
    exportedAt: new Date().toISOString(),
    mode: options.mode,
    version: '1.0',
    ...summary,
  };
  try {
    fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2), 'utf-8');
    console.log(`Written: ${summaryPath}`);
  } catch (err) {
    console.error(`Failed to write summary: ${err.message}`);
    process.exit(1);
  }

  // Write events (JSONL format)
  const eventsPath = path.join(validatedOutputDir, 'feedback-events.jsonl');
  const eventsToWrite = options.mode === 'anonymised'
    ? events.map(anonymiseEvent)
    : events;
  const eventsContent = eventsToWrite.map(e => JSON.stringify(e)).join('\n');
  try {
    fs.writeFileSync(eventsPath, eventsContent, 'utf-8');
    console.log(`Written: ${eventsPath}`);
  } catch (err) {
    console.error(`Failed to write events: ${err.message}`);
    process.exit(1);
  }

  // Print summary
  console.log('\n=== Export Summary ===\n');
  console.log(`Total events: ${summary.totalEvents}`);
  console.log(`Date range: ${summary.dateRange.start.slice(0, 10)} to ${summary.dateRange.end.slice(0, 10)}`);
  console.log(`\nFalse positives: ${summary.falsePositives.length} patterns`);
  if (summary.falsePositives.length > 0) {
    console.log('  Top 5:');
    for (const p of summary.falsePositives.slice(0, 5)) {
      console.log(`    - ${p.entityType}: ${p.pattern} (${p.count}x)`);
    }
  }
  console.log(`\nMissed PII: ${summary.missedPii.length} patterns`);
  if (summary.missedPii.length > 0) {
    console.log('  Top 5:');
    for (const p of summary.missedPii.slice(0, 5)) {
      console.log(`    - ${p.entityType}: ${p.pattern} (${p.count}x)`);
    }
  }

  console.log('\n=== Export Complete ===\n');
  console.log(`Files written to: ${validatedOutputDir}`);
  console.log('\nNext steps:');
  console.log('  1. Review feedback-summary.json for top patterns');
  console.log('  2. Add high-frequency false positives to DenyList');
  console.log('  3. Add missed PII patterns to recognizers/ContextWords');
  console.log('  4. Use feedback-events.jsonl for ML model fine-tuning');
}

main().catch(err => {
  console.error('Export failed:', err.message);
  process.exit(1);
});
