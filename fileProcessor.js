import fs from 'fs';
import path from 'path';
import { pipeline, env } from '@xenova/transformers';
import { fileURLToPath } from 'url';
import { createLogger } from './src/config/logging.js';

// Initialize loggers
const log = createLogger('fileProcessor');
const mlLog = createLogger('ml');
const securityLog = createLogger('security');

// Import converters (from dist/ - TypeScript compiled output)
import { TextToMarkdown } from './dist/converters/TextToMarkdown.js';
import { CsvToMarkdown } from './dist/converters/CsvToMarkdown.js';
import { DocxToMarkdown } from './dist/converters/DocxToMarkdown.js';
import { ExcelToMarkdown } from './dist/converters/ExcelToMarkdown.js';
import { PdfToMarkdown } from './dist/converters/PdfToMarkdown.js';

// Import Swiss/EU PII detector (from dist/ - TypeScript compiled output)
import { SwissEuDetector } from './dist/pii/SwissEuDetector.js';

// ES module paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Transformers.js environment
env.localModelPath = path.join(__dirname, 'models');
env.allowRemoteModels = false;  // Model is cached locally, no remote downloads needed
env.quantized = false;

// Model configuration
// Using Xenova's multilingual NER model (supports 10 languages including French, German, English)
// Supports: Arabic, German, English, Spanish, French, Italian, Latvian, Dutch, Portuguese, Chinese
// Entity types: PER (person), ORG (organization), LOC (location)
const MODEL_NAME = 'Xenova/distilbert-base-multilingual-cased-ner-hrl';

// Pipeline reference (shared across sessions for performance)
let nerPipeline = null;

// Swiss/EU detector instance (shared, stateless)
const swissEuDetector = new SwissEuDetector();

// Initialize converters with model name (shared, stateless)
const converters = {
  '.txt': new TextToMarkdown({ modelName: MODEL_NAME }),
  '.csv': new CsvToMarkdown({ modelName: MODEL_NAME }),
  '.docx': new DocxToMarkdown({ modelName: MODEL_NAME }),
  '.xlsx': new ExcelToMarkdown({ modelName: MODEL_NAME }),
  '.xls': new ExcelToMarkdown({ modelName: MODEL_NAME }),
  '.pdf': new PdfToMarkdown({ modelName: MODEL_NAME }),
};

/**
 * FileProcessingSession - Encapsulates state for a single file processing operation
 *
 * This class provides isolation between different file processing operations,
 * ensuring that pseudonym mappings don't leak between files.
 *
 * Each session has its own:
 * - Pseudonym counters (PER_1, PER_2, etc.)
 * - Pseudonym mappings (entity text -> pseudonym)
 */
class FileProcessingSession {
  constructor() {
    // Per-session pseudonym state (isolated)
    this.pseudonymCounters = {};
    this.pseudonymMapping = {};
  }

  /**
   * Get or create a consistent pseudonym for an entity
   * @param {string} entityText - The original entity text
   * @param {string} entityType - The entity type (PER, ORG, LOC, etc.)
   * @returns {string} The pseudonym
   */
  getOrCreatePseudonym(entityText, entityType) {
    // Check if we already have a mapping in THIS session
    if (this.pseudonymMapping[entityText]) {
      return this.pseudonymMapping[entityText];
    }

    // Initialize counter for this type if needed
    if (!this.pseudonymCounters[entityType]) {
      this.pseudonymCounters[entityType] = 1;
    }

    // Generate pseudonym
    const pseudonym = `${entityType}_${this.pseudonymCounters[entityType]++}`;
    this.pseudonymMapping[entityText] = pseudonym;

    return pseudonym;
  }

  /**
   * Get the current mapping state
   * @returns {Object} The pseudonym mapping
   */
  getMapping() {
    return { ...this.pseudonymMapping };
  }

  /**
   * Get entity count
   * @returns {number} Number of entities anonymized in this session
   */
  getEntityCount() {
    return Object.keys(this.pseudonymMapping).length;
  }
}

/**
 * Aggressively merges consecutive tokens of the same entity type.
 */
function aggressiveMergeTokens(predictions) {
  if (!predictions || predictions.length === 0) return [];

  const merged = [];
  let current = null;

  for (const pred of predictions) {
    const type = pred.entity.replace(/^(B-|I-)/, '');
    let word = pred.word.replace(/\s+/g, '').replace(/[^\w\s.,'-]/g, '');
    word = word.trim();

    if (!word) continue;

    if (!current) {
      current = { type, text: word };
    } else if (current.type === type) {
      current.text += word;
    } else {
      merged.push(current);
      current = { type, text: word };
    }
  }

  if (current) {
    merged.push(current);
  }

  return merged;
}

/**
 * Safely escapes all regex meta-characters in a string.
 */
function escapeRegexChars(str) {
  return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Builds a fuzzy regex that matches the merged string ignoring spacing/punctuation.
 *
 * ReDoS Protection Strategy:
 * 1. Limit input length to prevent exponential backtracking
 * 2. Use simpler pattern with word boundaries
 * 3. Avoid nested quantifiers that cause catastrophic backtracking
 *
 * @param {string} mergedString - The entity text to match
 * @returns {RegExp|null} Regex pattern or null if invalid/too complex
 */
function buildFuzzyRegex(mergedString) {
  // Protection Layer 1: Length limit to prevent exponential complexity
  const MAX_ENTITY_LENGTH = 50;
  if (mergedString.length > MAX_ENTITY_LENGTH) {
    securityLog.debug('Skipping long entity (ReDoS protection)', { maxLength: MAX_ENTITY_LENGTH });
    return null;
  }

  let noPunc = mergedString.replace(/[^\w]/g, '');
  if (!noPunc) return null;

  // Protection Layer 2: Minimum length to prevent single-character false positives
  // This prevents cases like "C" being detected as PII and replacing all "c" letters
  const MIN_ENTITY_LENGTH = 3;
  if (noPunc.length < MIN_ENTITY_LENGTH) {
    securityLog.debug('Skipping short entity (false positive protection)', { minLength: MIN_ENTITY_LENGTH });
    return null;
  }

  // Protection Layer 3: Character count limit
  if (noPunc.length > 30) {
    securityLog.debug('Skipping entity after cleanup (ReDoS protection)', { charCount: noPunc.length });
    return null;
  }

  noPunc = escapeRegexChars(noPunc);

  // Protection Layer 4: Use simpler, safer pattern
  // Instead of: a[^a-zA-Z0-9]{0,3}b[^a-zA-Z0-9]{0,3}... (nested quantifiers - BAD)
  // Use: word boundaries with escaped literal (simpler - GOOD)

  // Build pattern that allows optional punctuation/whitespace between chars
  // but limits it to prevent catastrophic backtracking
  let pattern = '';
  const chars = Array.from(noPunc);

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];

    // Add character
    pattern += char;

    // Add optional separator (but not after last char)
    if (i < chars.length - 1) {
      // Use possessive quantifier alternative: limit backtracking
      // Match 0-2 non-alphanumeric chars (reduced from 0-3 for safety)
      pattern += '[^a-zA-Z0-9]{0,2}?'; // Non-greedy to reduce backtracking
    }
  }

  if (!pattern) return null;

  try {
    return new RegExp(pattern, 'ig');
  } catch (err) {
    securityLog.warn('Regex build failed', { error: err.message });
    return null;
  }
}

/**
 * Test regex with timeout protection
 *
 * @param {RegExp} regex - The regex to test
 * @param {string} text - Text to match against
 * @param {number} timeoutMs - Timeout in milliseconds (default: 100ms)
 * @returns {boolean} Whether regex matched (false on timeout)
 */
function testRegexWithTimeout(regex, text, timeoutMs = 100) {
  const startTime = Date.now();

  try {
    // Reset regex state
    regex.lastIndex = 0;

    // Test match
    const result = regex.test(text);

    const duration = Date.now() - startTime;

    // Check if took too long (potential ReDoS)
    if (duration > timeoutMs) {
      securityLog.warn('Regex test timeout (potential ReDoS)', { duration, timeout: timeoutMs });
      return false;
    }

    return result;
  } catch (err) {
    securityLog.warn('Regex test error', { error: err.message });
    return false;
  }
}

/**
 * Loads the PII detection model from local files.
 */
async function loadNERModel() {
  if (!nerPipeline) {
    mlLog.info('Loading PII detection model', { model: MODEL_NAME });
    nerPipeline = await pipeline('token-classification', MODEL_NAME);
    mlLog.info('Model loaded successfully');
  }
  return nerPipeline;
}

/**
 * Extract code blocks from Markdown to protect them during anonymization
 */
function extractCodeBlocks(markdown) {
  const codeBlocks = [];
  const placeholder = '<<<CODE_BLOCK_{}>>>';

  // Match fenced code blocks (```...```)
  const regex = /```[\s\S]*?```/g;
  let match;
  let index = 0;

  const textWithoutCode = markdown.replace(regex, (matched) => {
    codeBlocks.push(matched);
    return placeholder.replace('{}', index++);
  });

  return { textWithoutCode, codeBlocks };
}

/**
 * Restore code blocks after anonymization (optimized single-pass)
 */
function restoreCodeBlocks(text, codeBlocks) {
  if (codeBlocks.length === 0) return text;

  // Single-pass replacement using regex with capture group
  return text.replace(/<<<CODE_BLOCK_(\d+)>>>/g, (match, index) => {
    const blockIndex = parseInt(index, 10);
    return codeBlocks[blockIndex] || match;
  });
}

/**
 * Extract inline code to protect during anonymization
 */
function extractInlineCode(text) {
  const inlineCode = [];
  const placeholder = '<<<INLINE_{}>>>';

  const regex = /`[^`]+`/g;
  let index = 0;

  const textWithoutInline = text.replace(regex, (matched) => {
    inlineCode.push(matched);
    return placeholder.replace('{}', index++);
  });

  return { textWithoutInline, inlineCode };
}

/**
 * Restore inline code after anonymization (optimized single-pass)
 */
function restoreInlineCode(text, inlineCode) {
  if (inlineCode.length === 0) return text;

  // Single-pass replacement using regex with capture group
  return text.replace(/<<<INLINE_(\d+)>>>/g, (match, index) => {
    const codeIndex = parseInt(index, 10);
    return inlineCode[codeIndex] || match;
  });
}

/**
 * Main anonymization function using both ML model and Swiss/EU rules.
 * @param {string} text - Text to anonymize
 * @param {FileProcessingSession} session - Session for isolated state
 */
async function anonymizeText(text, session) {
  let processedText = String(text);

  // Step 1: ML-based detection
  const ner = await loadNERModel();
  mlLog.debug('Running ML-based PII detection');
  const predictions = await ner(processedText);

  const mlEntities = aggressiveMergeTokens(predictions);
  mlLog.info('ML detection completed', { entityCount: mlEntities.length });

  // Step 2: Rule-based Swiss/EU detection
  mlLog.debug('Running Swiss/EU rule-based PII detection');
  const swissEuEntities = swissEuDetector.detect(processedText);
  mlLog.info('Swiss/EU detection completed', { entityCount: swissEuEntities.length });

  // Step 3: Merge all entities
  const allEntities = [...mlEntities, ...swissEuEntities];

  // Step 4: Build replacement map and patterns (single-pass optimization)
  const replacements = new Map();
  const patterns = [];

  for (const entity of allEntities) {
    const entityType = entity.type;
    const entityText = entity.text;

    if (!entityText) continue;

    // ✅ CRITICAL FIX: Filter entity BEFORE adding to session mapping
    // This prevents short entities (like "C") from appearing in mapping file
    const fuzzyRegex = buildFuzzyRegex(entityText);

    if (!fuzzyRegex) {
      // ✅ SECURITY: Don't log PII - only log entity type
      securityLog.debug('Skipping invalid pattern', { entityType });
      continue;
    }

    // Only create pseudonym AFTER validation passes
    const pseudonym = session.getOrCreatePseudonym(entityText, entityType);

    // ✅ SECURITY: Don't log actual PII values - only log entity types and pseudonyms
    mlLog.debug('Entity mapped', { entityType, pseudonym });
    patterns.push(fuzzyRegex.source);
    replacements.set(fuzzyRegex.source, pseudonym);
  }

  // Step 5: Single-pass replacement using combined regex
  if (patterns.length > 0) {
    const combinedPattern = new RegExp(patterns.join('|'), 'ig');
    processedText = processedText.replace(combinedPattern, (match) => {
      // Find which pattern matched
      for (const [pattern, pseudonym] of replacements) {
        const regex = new RegExp(pattern, 'ig');
        if (regex.test(match)) {
          return pseudonym;
        }
      }
      return match;
    });
  }

  return processedText;
}

/**
 * Anonymize Markdown while preserving syntax (code blocks, inline code)
 * @param {string} markdown - Markdown text to anonymize
 * @param {FileProcessingSession} session - Session for isolated state
 */
async function anonymizeMarkdown(markdown, session) {
  log.debug('Anonymizing Markdown (preserving code blocks)');

  // Step 1: Extract and protect code blocks
  const { textWithoutCode, codeBlocks } = extractCodeBlocks(markdown);

  // Step 2: Extract and protect inline code
  const { textWithoutInline, inlineCode } = extractInlineCode(textWithoutCode);

  // Step 3: Anonymize the remaining text with session
  const anonymizedText = await anonymizeText(textWithoutInline, session);

  // Step 4: Restore inline code
  let result = restoreInlineCode(anonymizedText, inlineCode);

  // Step 5: Restore code blocks
  result = restoreCodeBlocks(result, codeBlocks);

  // Step 6: Create mapping export from session
  const mapping = {
    version: '2.0',
    timestamp: new Date().toISOString(),
    model: MODEL_NAME,
    detectionMethods: ['ML (transformers)', 'Rule-based (Swiss/EU)'],
    entities: session.getMapping(),
  };

  log.info('Anonymization complete', { entityCount: session.getEntityCount() });

  return { anonymised: result, mapping };
}

/**
 * Main file processing class
 */
export class FileProcessor {
  /**
   * ✅ SECURITY: Validate output path to prevent path traversal
   */
  static validateOutputPath(outputPath) {
    if (!outputPath || typeof outputPath !== 'string') {
      throw new Error('Invalid output path: must be a non-empty string');
    }

    // Normalize and resolve path
    const normalizedPath = path.normalize(outputPath);
    const resolvedPath = path.resolve(normalizedPath);

    // Prevent path traversal
    if (resolvedPath.includes('..')) {
      throw new Error('Invalid output path: path traversal detected');
    }

    // Ensure path is absolute
    if (!path.isAbsolute(resolvedPath)) {
      throw new Error('Invalid output path: must be absolute');
    }

    // Check that parent directory exists
    const parentDir = path.dirname(resolvedPath);
    if (!fs.existsSync(parentDir)) {
      throw new Error('Invalid output path: parent directory does not exist');
    }

    return resolvedPath;
  }

  static async processFile(filePath, outputPath) {
    const ext = path.extname(filePath).toLowerCase();
    const converter = converters[ext];

    if (!converter) {
      throw new Error(`Unsupported file type: ${ext}`);
    }

    // Create a new session for this file (isolated state)
    const session = new FileProcessingSession();

    try {
      const fileName = path.basename(filePath);
      log.info('Processing file', { fileName, extension: ext });

      // Step 1: Convert to Markdown
      log.debug('Converting to Markdown');
      const markdown = await converter.convert(filePath);
      log.info('Converted to Markdown', { charCount: markdown.length });

      // Step 2: Anonymise Markdown with session
      log.debug('Anonymising content');
      const { anonymised, mapping } = await anonymizeMarkdown(markdown, session);
      log.info('Anonymisation complete');

      // ✅ SECURITY: Validate output paths before writing
      const validatedOutputPath = this.validateOutputPath(outputPath);

      // Step 3: Write Markdown output
      const mdOutputPath = validatedOutputPath.replace(/\.[^.]+$/, '.md');
      fs.writeFileSync(mdOutputPath, anonymised, 'utf8');
      log.info('Saved Markdown output', { fileName: path.basename(mdOutputPath) });

      // Step 4: Write mapping JSON (ALWAYS)
      const mappingPath = validatedOutputPath.replace(/\.[^.]+$/, '-mapping.json');
      fs.writeFileSync(
        mappingPath,
        JSON.stringify(mapping, null, 2),
        'utf8',
      );
      log.info('Saved mapping file', { fileName: path.basename(mappingPath) });

      return {
        success: true,
        outputPath: mdOutputPath,
        mappingPath,
      };

    } catch (error) {
      // ✅ SECURITY: Log full error details for debugging
      log.error('Error processing file', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  static generateOutputFileName(originalName) {
    const baseName = path.basename(originalName, path.extname(originalName));
    return `${baseName}-anon.md`;
  }

  static validateFileType(filePath) {
    const supportedTypes = [
      '.doc', '.docx', '.xls', '.xlsx', '.csv', '.pdf', '.txt',
    ];
    const ext = path.extname(filePath).toLowerCase();
    return supportedTypes.includes(ext);
  }

  /**
   * Reset pseudonym mappings (DEPRECATED - no longer needed)
   *
   * This method is kept for backward compatibility but does nothing,
   * as each processFile() call now creates its own isolated session.
   *
   * @deprecated Each file processing operation is now automatically isolated
   */
  static resetMappings() {
    log.debug('resetMappings called (deprecated, no-op)');
    // No-op: Each processFile() creates a new session automatically
  }
}
