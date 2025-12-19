import fs from 'fs';
import path from 'path';
import { pipeline, env } from '@xenova/transformers';
import { fileURLToPath } from 'url';
import { createLogger } from '../config/logging.js';

// Import safe regex utilities (Story 6.2: ReDoS protection)
import { safeReplace, analyzePatternComplexity } from '../utils/safeRegex.js';

// Import centralized constants (Story 6.8)
import { PROCESSING } from '../config/constants.js';

// Initialize loggers
const log = createLogger('fileProcessor');
const mlLog = createLogger('ml');
const securityLog = createLogger('security');

// Import converters
import { TextToMarkdown } from '../converters/TextToMarkdown.js';
import { CsvToMarkdown } from '../converters/CsvToMarkdown.js';
import { DocxToMarkdown } from '../converters/DocxToMarkdown.js';
import { ExcelToMarkdown } from '../converters/ExcelToMarkdown.js';
import { PdfToMarkdown } from '../converters/PdfToMarkdown.js';

// Import Swiss/EU PII detector
import { SwissEuDetector } from '../pii/SwissEuDetector.js';

// Import new multi-pass detection pipeline (Epic 1)
import { createPipeline } from '../pii/DetectionPipeline.js';
import { createHighRecallPass } from '../pii/passes/HighRecallPass.js';
import { createFormatValidationPass } from '../pii/passes/FormatValidationPass.js';
import { createContextScoringPass } from '../pii/passes/ContextScoringPass.js';

// Import Address Relationship Pass (Epic 2)
import { createAddressRelationshipPass } from '../pii/passes/AddressRelationshipPass.js';

// Import Document Type Pass (Epic 3)
import { createDocumentTypePass } from '../pii/passes/DocumentTypePass.js';

// Import types
import type { MarkdownConverter } from '../converters/MarkdownConverter.js';

/**
 * Detected entity from pipeline
 */
interface DetectedEntity {
  type: string;
  text: string;
  start?: number;
  end?: number;
  confidence?: number;
  flaggedForReview?: boolean;
  metadata?: {
    isGroupedAddress?: boolean;
    breakdown?: {
      street?: string;
      number?: string;
      postal?: string;
      city?: string;
      country?: string;
    };
    finalConfidence?: number;
    patternMatched?: string;
    scoringFactors?: string[];
    autoAnonymize?: boolean;
  };
}

/**
 * Address entry for mapping file
 */
interface AddressEntry {
  placeholder: string;
  type: string;
  originalText: string;
  start: number;
  end: number;
  components: {
    street: string | null;
    number: string | null;
    postal: string | null;
    city: string | null;
    country: string | null;
  };
  confidence: number;
  patternMatched: string | null;
  scoringFactors: string[];
  flaggedForReview: boolean;
  autoAnonymize: boolean;
}

/**
 * Anonymized range tracking
 */
interface AnonymizedRange {
  start: number;
  end: number;
  placeholder: string;
}

/**
 * Mapping file structure
 */
interface MappingFile {
  version: string;
  timestamp: string;
  model: string;
  documentType: string;
  detectionMethods: string[];
  entities: Record<string, string>;
  addresses: AddressEntry[];
}

/**
 * Anonymization result
 */
interface AnonymizeResult {
  text: string;
  documentType?: string;
}

/**
 * Anonymize markdown result
 */
interface AnonymizeMarkdownResult {
  anonymised: string;
  mapping: MappingFile;
}

/**
 * Process file result
 */
interface ProcessFileResult {
  success: boolean;
  outputPath: string;
  mappingPath: string;
  originalMarkdown: string;
}

/**
 * NER prediction from transformers.js
 */
interface NERPrediction {
  entity: string;
  score: number;
  word: string;
  start: number;
  end: number;
}

/**
 * Pipeline result
 */
interface PipelineResult {
  entities: DetectedEntity[];
  documentType?: string;
  passes?: unknown[];
}

// ES module paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine if we're in Electron context (for model path)
const isElectronContext = typeof process !== 'undefined' &&
  process.versions &&
  'electron' in process.versions;

// Get model path - use modelManager in Electron, fallback for tests
let modelPath: string;
if (isElectronContext) {
  // Dynamic import to avoid top-level electron import in non-Electron contexts
  try {
    const { getModelBasePath } = await import('../services/modelManager.js');
    modelPath = getModelBasePath();
  } catch {
    // Fallback if import fails
    modelPath = path.join(__dirname, '..', '..', 'models');
  }
} else {
  // Non-Electron context (tests, CLI tools): use local models directory
  modelPath = path.join(__dirname, '..', '..', 'models');
}

// Transformers.js environment - use userData directory for lazy-loaded model
// Model is downloaded on first launch via modelManager, stored in userData/models/
mlLog.info('Using model path', { modelPath });
env.localModelPath = modelPath;
env.cacheDir = modelPath;
env.allowRemoteModels = true;  // Allow remote model downloads (handled by modelManager)
// @ts-expect-error - quantized is a valid env option in transformers.js
env.quantized = false;

// Model configuration
// Using Xenova's multilingual NER model (supports 10 languages including French, German, English)
// Supports: Arabic, German, English, Spanish, French, Italian, Latvian, Dutch, Portuguese, Chinese
// Entity types: PER (person), ORG (organization), LOC (location)
const MODEL_NAME = 'Xenova/distilbert-base-multilingual-cased-ner-hrl';

// Pipeline reference (shared across sessions for performance)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nerPipeline: any = null;

// Swiss/EU detector instance (shared, stateless) - kept for backward compatibility
// @ts-expect-error Kept for backward compatibility, may be used in future
const _swissEuDetector = new SwissEuDetector();

// Multi-pass detection pipeline instance (shared)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let detectionPipeline: any = null;

/**
 * Initialize the multi-pass detection pipeline
 * Called once when model is loaded
 */
function initializeDetectionPipeline(): { pipeline: unknown; highRecallPass: ReturnType<typeof createHighRecallPass> } {
  if (detectionPipeline) return { pipeline: detectionPipeline, highRecallPass: createHighRecallPass(0.3) };

  mlLog.info('Initializing multi-pass detection pipeline');

  detectionPipeline = createPipeline({
    mlConfidenceThreshold: 0.3,
    contextWindowSize: 50,
    autoAnonymizeThreshold: 0.6,
    debug: false,
  });

  // Register passes in order
  // Pass 1: Document Type Detection (order=5) - classifies document and applies type-specific rules
  detectionPipeline.registerPass(createDocumentTypePass());

  // Pass 2: High Recall (order=10) - broad entity detection with ML model
  const highRecallPass = createHighRecallPass(0.3);
  detectionPipeline.registerPass(highRecallPass);

  // Pass 3: Format Validation (order=20) - validates entity formats
  detectionPipeline.registerPass(createFormatValidationPass());

  // Pass 4: Context Scoring (order=30) - scores based on surrounding context
  detectionPipeline.registerPass(createContextScoringPass());

  // Pass 5: Address Relationship (order=40) - links address components
  detectionPipeline.registerPass(createAddressRelationshipPass());

  mlLog.info('Detection pipeline initialized with 5 passes (including Document Type Detection)');

  return { pipeline: detectionPipeline, highRecallPass };
}

// Initialize converters with model name (shared, stateless)
const converters: Record<string, MarkdownConverter> = {
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
 * - Structured address mappings (Story 2.4)
 */
export class FileProcessingSession {
  // Per-session pseudonym state (isolated)
  private pseudonymCounters: Record<string, number> = {};
  private pseudonymMapping: Record<string, string> = {};

  // Structured address mappings (Story 2.4: Address Anonymization Strategy)
  // Stores full address data including components, confidence, and scoring factors
  private addressMappings: AddressEntry[] = [];

  // Track ranges that have been anonymized (to prevent fragmentation)
  private anonymizedRanges: AnonymizedRange[] = [];

  constructor() {
    this.pseudonymCounters = {};
    this.pseudonymMapping = {};
    this.addressMappings = [];
    this.anonymizedRanges = [];
  }

  /**
   * Get or create a consistent pseudonym for an entity
   * @param entityText - The original entity text
   * @param entityType - The entity type (PER, ORG, LOC, etc.)
   * @returns The pseudonym
   */
  getOrCreatePseudonym(entityText: string, entityType: string): string {
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
   * @returns The pseudonym mapping
   */
  getMapping(): Record<string, string> {
    return { ...this.pseudonymMapping };
  }

  /**
   * Get entity count
   * @returns Number of entities anonymized in this session
   */
  getEntityCount(): number {
    return Object.keys(this.pseudonymMapping).length + this.addressMappings.length;
  }

  /**
   * Register a grouped address with structured data (Story 2.4)
   *
   * @param addressEntity - Entity with grouped address data
   * @returns The placeholder (e.g., "[ADDRESS_1]")
   */
  registerGroupedAddress(addressEntity: DetectedEntity): string {
    // Determine address type for placeholder
    const addressType = addressEntity.type || 'ADDRESS';

    // Initialize counter for this address type if needed
    if (!this.pseudonymCounters[addressType]) {
      this.pseudonymCounters[addressType] = 1;
    }

    // Generate placeholder: [ADDRESS_1], [SWISS_ADDRESS_1], etc.
    const counter = this.pseudonymCounters[addressType]++;
    const placeholder = `[${addressType}_${counter}]`;

    // Extract structured data from entity metadata
    const metadata = addressEntity.metadata ?? {};
    const breakdown = metadata.breakdown ?? {};

    // Build structured address entry for mapping file
    const addressEntry: AddressEntry = {
      placeholder,
      type: addressType,
      originalText: addressEntity.text,
      start: addressEntity.start ?? 0,
      end: addressEntity.end ?? 0,
      components: {
        street: breakdown.street ?? null,
        number: breakdown.number ?? null,
        postal: breakdown.postal ?? null,
        city: breakdown.city ?? null,
        country: breakdown.country ?? null,
      },
      confidence: addressEntity.confidence ?? metadata.finalConfidence ?? 0,
      patternMatched: metadata.patternMatched ?? null,
      scoringFactors: metadata.scoringFactors ?? [],
      flaggedForReview: addressEntity.flaggedForReview ?? false,
      autoAnonymize: metadata.autoAnonymize !== false,
    };

    // Store structured mapping
    this.addressMappings.push(addressEntry);

    // Track this range as anonymized (to prevent fragmented anonymization)
    this.anonymizedRanges.push({
      start: addressEntity.start ?? 0,
      end: addressEntity.end ?? 0,
      placeholder,
    });

    // Also add to simple mapping for backward compatibility
    this.pseudonymMapping[addressEntity.text] = placeholder;

    return placeholder;
  }

  /**
   * Check if a position range is already covered by an anonymized address
   *
   * @param start - Start position
   * @param end - End position
   * @returns True if range overlaps with anonymized address
   */
  isRangeAnonymized(start: number, end: number): boolean {
    return this.anonymizedRanges.some(range =>
      start < range.end && end > range.start,
    );
  }

  /**
   * Get structured address mappings (Story 2.4)
   *
   * @returns Array of structured address entries
   */
  getAddressMappings(): AddressEntry[] {
    return [...this.addressMappings];
  }

  /**
   * Get the extended mapping for export (includes structured addresses)
   *
   * @returns Combined mapping with addresses array
   */
  getExtendedMapping(): { entities: Record<string, string>; addresses: AddressEntry[] } {
    return {
      entities: { ...this.pseudonymMapping },
      addresses: [...this.addressMappings],
    };
  }
}

/**
 * Safely escapes all regex meta-characters in a string.
 */
function escapeRegexChars(str: string): string {
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
 * @param mergedString - The entity text to match
 * @returns Regex pattern or null if invalid/too complex
 */
function buildFuzzyRegex(mergedString: string): RegExp | null {
  // Protection Layer 1: Length limit to prevent exponential complexity
  // Story 6.8: Use centralized PROCESSING constants
  if (mergedString.length > PROCESSING.MAX_ENTITY_LENGTH) {
    securityLog.debug('Skipping long entity (ReDoS protection)', { maxLength: PROCESSING.MAX_ENTITY_LENGTH });
    return null;
  }

  let noPunc = mergedString.replace(/[^\w]/g, '');
  if (!noPunc) return null;

  // Protection Layer 2: Minimum length to prevent single-character false positives
  // This prevents cases like "C" being detected as PII and replacing all "c" letters
  if (noPunc.length < PROCESSING.MIN_ENTITY_LENGTH) {
    securityLog.debug('Skipping short entity (false positive protection)', { minLength: PROCESSING.MIN_ENTITY_LENGTH });
    return null;
  }

  // Protection Layer 3: Character count limit after cleanup
  if (noPunc.length > PROCESSING.MAX_ENTITY_CHARS_CLEANED) {
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
      // Match 0-N non-alphanumeric chars (N = FUZZY_MATCH_GAP_TOLERANCE)
      // Story 6.8 AC4: Document regex quantifier reasoning
      pattern += `[^a-zA-Z0-9]{0,${PROCESSING.FUZZY_MATCH_GAP_TOLERANCE}}?`; // Non-greedy to reduce backtracking
    }
  }

  if (!pattern) return null;

  try {
    return new RegExp(pattern, 'ig');
  } catch (err) {
    securityLog.warn('Regex build failed', { error: (err as Error).message });
    return null;
  }
}

/**
 * Loads the PII detection model from local files.
 */
async function loadNERModel(): Promise<unknown> {
  if (!nerPipeline) {
    mlLog.info('Loading PII detection model', { model: MODEL_NAME });
    nerPipeline = await pipeline('token-classification', MODEL_NAME);
    mlLog.info('Model loaded successfully');

    // Initialize multi-pass pipeline and connect ML model
    const { highRecallPass } = initializeDetectionPipeline();

    // Set up NER pipeline adapter for high recall pass
    highRecallPass.setNerPipeline(async (text: string) => {
      const predictions = await nerPipeline(text);
      return (predictions as NERPrediction[]).map((p: NERPrediction) => ({
        entity_group: p.entity.replace(/^(B-|I-)/, ''),
        score: p.score,
        word: p.word,
        start: p.start,
        end: p.end,
      }));
    });

    mlLog.info('ML model connected to detection pipeline');
  }
  return nerPipeline;
}

/**
 * Extract code blocks from Markdown to protect them during anonymization
 */
function extractCodeBlocks(markdown: string): { textWithoutCode: string; codeBlocks: string[] } {
  const codeBlocks: string[] = [];
  const placeholder = '<<<CODE_BLOCK_{}>>>';

  // Match fenced code blocks (```...```)
  const regex = /```[\s\S]*?```/g;
  let index = 0;

  const textWithoutCode = markdown.replace(regex, (matched) => {
    codeBlocks.push(matched);
    return placeholder.replace('{}', String(index++));
  });

  return { textWithoutCode, codeBlocks };
}

/**
 * Restore code blocks after anonymization (optimized single-pass)
 */
function restoreCodeBlocks(text: string, codeBlocks: string[]): string {
  if (codeBlocks.length === 0) return text;

  // Single-pass replacement using regex with capture group
  return text.replace(/<<<CODE_BLOCK_(\d+)>>>/g, (match, index) => {
    const blockIndex = parseInt(index, 10);
    return codeBlocks[blockIndex] ?? match;
  });
}

/**
 * Extract inline code to protect during anonymization
 */
function extractInlineCode(text: string): { textWithoutInline: string; inlineCode: string[] } {
  const inlineCode: string[] = [];
  const placeholder = '<<<INLINE_{}>>>';

  const regex = /`[^`]+`/g;
  let index = 0;

  const textWithoutInline = text.replace(regex, (matched) => {
    inlineCode.push(matched);
    return placeholder.replace('{}', String(index++));
  });

  return { textWithoutInline, inlineCode };
}

/**
 * Restore inline code after anonymization (optimized single-pass)
 */
function restoreInlineCode(text: string, inlineCode: string[]): string {
  if (inlineCode.length === 0) return text;

  // Single-pass replacement using regex with capture group
  return text.replace(/<<<INLINE_(\d+)>>>/g, (match, index) => {
    const codeIndex = parseInt(index, 10);
    return inlineCode[codeIndex] ?? match;
  });
}

/**
 * Check if an entity is a grouped address (Story 2.4)
 *
 * @param entity - Entity to check
 * @returns True if entity is a grouped address
 */
function isGroupedAddress(entity: DetectedEntity): boolean {
  return entity.metadata?.isGroupedAddress === true ||
    ['ADDRESS', 'SWISS_ADDRESS', 'EU_ADDRESS'].includes(entity.type);
}

/**
 * Main anonymization function using multi-pass detection pipeline.
 *
 * Pipeline passes:
 * 1. High-Recall Pass - ML model + rule-based detection with low threshold
 * 2. Format Validation Pass - Validates entities against format rules
 * 3. Context Scoring Pass - Scores entities based on surrounding context
 * 4. Address Relationship Pass - Links address components into grouped addresses
 *
 * Story 2.4: Address Anonymization Strategy
 * - Grouped addresses are processed FIRST using position-based replacement
 * - This ensures "Rue de Lausanne 12, 1000 Lausanne" becomes "[ADDRESS_1]"
 *   instead of fragmented "[STREET] 12, [POSTAL_CODE] [CITY]"
 * - Entities overlapping with grouped addresses are skipped
 *
 * @param text - Text to anonymize
 * @param session - Session for isolated state
 */
async function anonymizeText(text: string, session: FileProcessingSession): Promise<AnonymizeResult> {
  let processedText = String(text);

  // Ensure ML model and pipeline are initialized
  await loadNERModel();

  // Run multi-pass detection pipeline
  mlLog.debug('Running multi-pass detection pipeline');
  const result: PipelineResult = await detectionPipeline.process(processedText);

  mlLog.info('Pipeline detection completed', {
    entityCount: result.entities.length,
    passesExecuted: result.passes?.length ?? 3,
  });

  // ========== STORY 2.4: ADDRESS ANONYMIZATION STRATEGY ==========
  // Step 1: Separate grouped addresses from other entities
  const groupedAddresses = result.entities.filter(isGroupedAddress);
  const otherEntities = result.entities.filter((e: DetectedEntity) => !isGroupedAddress(e));

  mlLog.debug('Entity classification', {
    groupedAddresses: groupedAddresses.length,
    otherEntities: otherEntities.length,
  });

  // Step 2: Sort grouped addresses by position (descending) for safe replacement
  // We replace from end to start to preserve positions
  const sortedAddresses = [...groupedAddresses].sort((a, b) => (b.start ?? 0) - (a.start ?? 0));

  // Step 3: Replace grouped addresses using position-based replacement
  for (const addressEntity of sortedAddresses) {
    // Validate entity has required position data
    if (typeof addressEntity.start !== 'number' || typeof addressEntity.end !== 'number') {
      mlLog.warn('Address entity missing position data', { type: addressEntity.type });
      continue;
    }

    // Register address and get placeholder
    const placeholder = session.registerGroupedAddress(addressEntity);

    // SECURITY: Don't log actual address - only log type and placeholder
    mlLog.debug('Address replaced', {
      type: addressEntity.type,
      placeholder,
      confidence: addressEntity.confidence?.toFixed(2),
      start: addressEntity.start,
      end: addressEntity.end,
    });

    // Position-based replacement (exact span)
    processedText =
      processedText.slice(0, addressEntity.start) +
      placeholder +
      processedText.slice(addressEntity.end);
  }

  // ========== REMAINING ENTITY PROCESSING ==========
  // Step 4: Build replacement map for non-address entities
  // Skip entities that overlap with already-anonymized address ranges
  const replacements = new Map<string, string>();
  const patterns: string[] = [];

  for (const entity of otherEntities) {
    const entityType = entity.type;
    const entityText = entity.text;

    if (!entityText) continue;

    // Skip if this entity's range overlaps with a grouped address (Story 2.4: AC-2.4.4)
    if (typeof entity.start === 'number' && typeof entity.end === 'number') {
      if (session.isRangeAnonymized(entity.start, entity.end)) {
        mlLog.debug('Skipping entity (overlaps with grouped address)', { entityType });
        continue;
      }
    }

    // CRITICAL FIX: Filter entity BEFORE adding to session mapping
    // This prevents short entities (like "C") from appearing in mapping file
    const fuzzyRegex = buildFuzzyRegex(entityText);

    if (!fuzzyRegex) {
      // SECURITY: Don't log PII - only log entity type
      securityLog.debug('Skipping invalid pattern', { entityType });
      continue;
    }

    // Only create pseudonym AFTER validation passes
    const pseudonym = session.getOrCreatePseudonym(entityText, entityType);

    // SECURITY: Don't log actual PII values - only log entity types and pseudonyms
    mlLog.debug('Entity mapped', { entityType, pseudonym, confidence: entity.confidence?.toFixed(2) });
    patterns.push(fuzzyRegex.source);
    replacements.set(fuzzyRegex.source, pseudonym);
  }

  // Step 5: Single-pass replacement for remaining entities using combined regex
  // Story 6.2: Use safeReplace with timeout protection
  if (patterns.length > 0) {
    const combinedPattern = new RegExp(patterns.join('|'), 'ig');

    // Check pattern complexity before execution
    const complexity = analyzePatternComplexity(combinedPattern.source);
    if (complexity > 100) {
      securityLog.warn('High complexity pattern detected', { complexity, patternCount: patterns.length });
    }

    // Apply replacement with ReDoS protection
    const replaceResult = safeReplace(
      combinedPattern,
      processedText,
      (match: string) => {
        // Find which pattern matched
        for (const [pattern, pseudonym] of replacements) {
          const regex = new RegExp(pattern, 'ig');
          if (regex.test(match)) {
            return pseudonym;
          }
        }
        return match;
      },
      { timeoutMs: 500 }, // Allow 500ms for combined pattern
    );

    if (replaceResult.success && replaceResult.value !== undefined) {
      processedText = replaceResult.value;
    } else if (replaceResult.timedOut) {
      securityLog.warn('Regex replacement timed out, using fallback', {
        durationMs: replaceResult.durationMs,
        patternCount: patterns.length,
      });
      // Fallback: process patterns individually with lower timeout
      for (const [pattern, pseudonym] of replacements) {
        const regex = new RegExp(pattern, 'ig');
        const individualResult = safeReplace(regex, processedText, pseudonym, { timeoutMs: 100 });
        if (individualResult.success && individualResult.value !== undefined) {
          processedText = individualResult.value;
        }
      }
    }
  }

  // Story 3.1: Return document type from detection result for mapping file
  return { text: processedText, documentType: result.documentType };
}

/**
 * Anonymize Markdown while preserving syntax (code blocks, inline code)
 * @param markdown - Markdown text to anonymize
 * @param session - Session for isolated state
 */
async function anonymizeMarkdown(markdown: string, session: FileProcessingSession): Promise<AnonymizeMarkdownResult> {
  log.debug('Anonymizing Markdown (preserving code blocks)');

  // Step 1: Extract and protect code blocks
  const { textWithoutCode, codeBlocks } = extractCodeBlocks(markdown);

  // Step 2: Extract and protect inline code
  const { textWithoutInline, inlineCode } = extractInlineCode(textWithoutCode);

  // Step 3: Anonymize the remaining text with session
  // Story 3.1: anonymizeText now returns { text, documentType }
  const anonymizeResult = await anonymizeText(textWithoutInline, session);

  // Step 4: Restore inline code
  let result = restoreInlineCode(anonymizeResult.text, inlineCode);

  // Step 5: Restore code blocks
  result = restoreCodeBlocks(result, codeBlocks);

  // Step 6: Create mapping export from session (Story 2.4: Extended format)
  const addressMappings = session.getAddressMappings();
  const entityMapping = session.getMapping();

  // Build extended mapping with structured address data
  // Story 3.1: Added documentType and updated to v3.2
  const mapping: MappingFile = {
    version: '3.2', // Updated for Story 3.1 document type detection
    timestamp: new Date().toISOString(),
    model: MODEL_NAME,
    // Story 3.1: Document type classification result
    documentType: anonymizeResult.documentType ?? 'UNKNOWN',
    detectionMethods: [
      'Multi-Pass Pipeline v1.0',
      'Pass 0: Document Type Detection (Epic 3)',
      'Pass 1: High-Recall (ML + Rules)',
      'Pass 2: Format Validation',
      'Pass 3: Context Scoring',
      'Pass 4: Address Relationship (Epic 2)',
    ],
    // Standard entity mappings (backward compatible)
    entities: entityMapping,
    // Story 2.4: Structured address data with components
    addresses: addressMappings.map(addr => ({
      placeholder: addr.placeholder,
      type: addr.type,
      originalText: addr.originalText,
      start: addr.start,
      end: addr.end,
      components: addr.components,
      confidence: addr.confidence,
      patternMatched: addr.patternMatched,
      scoringFactors: addr.scoringFactors,
      flaggedForReview: addr.flaggedForReview,
      autoAnonymize: addr.autoAnonymize,
    })),
  };

  log.info('Anonymization complete', { entityCount: session.getEntityCount() });

  return { anonymised: result, mapping };
}

/**
 * Main file processing class
 */
export class FileProcessor {
  /**
   * SECURITY: Validate output path to prevent path traversal
   */
  static validateOutputPath(outputPath: string): string {
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

  static async processFile(filePath: string, outputPath: string): Promise<ProcessFileResult> {
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

      // SECURITY: Validate output paths before writing
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
        originalMarkdown: markdown, // Story 4.3: Return original for selective anonymization
      };

    } catch (error) {
      // SECURITY: Log full error details for debugging
      log.error('Error processing file', { error: (error as Error).message, stack: (error as Error).stack });
      throw error;
    }
  }

  static generateOutputFileName(originalName: string): string {
    const baseName = path.basename(originalName, path.extname(originalName));
    return `${baseName}-anon.md`;
  }

  static validateFileType(filePath: string): boolean {
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
  static resetMappings(): void {
    log.debug('resetMappings called (deprecated, no-op)');
    // No-op: Each processFile() creates a new session automatically
  }
}
