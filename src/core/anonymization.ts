/**
 * Anonymization Utilities - Pure Functions
 *
 * These are pure string transformation functions that work
 * identically in Node.js and browser environments.
 */

/**
 * Safely escapes all regex meta-characters in a string
 */
export function escapeRegexChars(str: string): string {
  return str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Builds a fuzzy regex that matches text ignoring spacing/punctuation
 *
 * ReDoS Protection:
 * 1. Limits input length to prevent exponential backtracking
 * 2. Uses simpler patterns with reduced quantifiers
 * 3. Avoids nested quantifiers that cause catastrophic backtracking
 *
 * @param mergedString - The entity text to match
 * @returns Regex pattern or null if invalid/too complex
 */
export function buildFuzzyRegex(mergedString: string): RegExp | null {
  // Protection: Length limit
  const MAX_ENTITY_LENGTH = 50;
  if (mergedString.length > MAX_ENTITY_LENGTH) {
    return null;
  }

  let noPunc = mergedString.replace(/[^\w]/g, '');
  if (!noPunc) return null;

  // Protection: Minimum length to prevent false positives
  const MIN_ENTITY_LENGTH = 3;
  if (noPunc.length < MIN_ENTITY_LENGTH) {
    return null;
  }

  // Protection: Character count limit
  if (noPunc.length > 30) {
    return null;
  }

  noPunc = escapeRegexChars(noPunc);

  // Build pattern with optional separators between chars
  let pattern = '';
  const chars = Array.from(noPunc);

  for (let i = 0; i < chars.length; i++) {
    pattern += chars[i];
    if (i < chars.length - 1) {
      // Non-greedy to reduce backtracking
      pattern += '[^a-zA-Z0-9]{0,2}?';
    }
  }

  if (!pattern) return null;

  try {
    return new RegExp(pattern, 'ig');
  } catch {
    return null;
  }
}

/**
 * Extract fenced code blocks from Markdown to protect during anonymization
 */
export function extractCodeBlocks(markdown: string): {
  textWithoutCode: string;
  codeBlocks: string[];
} {
  const codeBlocks: string[] = [];
  const placeholder = '<<<CODE_BLOCK_{}>>>';
  const regex = /```[\s\S]*?```/g;
  let index = 0;

  const textWithoutCode = markdown.replace(regex, (matched) => {
    codeBlocks.push(matched);
    return placeholder.replace('{}', String(index++));
  });

  return { textWithoutCode, codeBlocks };
}

/**
 * Restore code blocks after anonymization
 */
export function restoreCodeBlocks(text: string, codeBlocks: string[]): string {
  if (codeBlocks.length === 0) return text;

  return text.replace(/<<<CODE_BLOCK_(\d+)>>>/g, (match, index) => {
    const blockIndex = parseInt(index, 10);
    return codeBlocks[blockIndex] || match;
  });
}

/**
 * Extract inline code to protect during anonymization
 */
export function extractInlineCode(text: string): {
  textWithoutInline: string;
  inlineCode: string[];
} {
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
 * Restore inline code after anonymization
 */
export function restoreInlineCode(text: string, inlineCode: string[]): string {
  if (inlineCode.length === 0) return text;

  return text.replace(/<<<INLINE_(\d+)>>>/g, (match, index) => {
    const codeIndex = parseInt(index, 10);
    return inlineCode[codeIndex] || match;
  });
}

/**
 * Check if an entity is a grouped address
 */
export function isGroupedAddress(entity: {
  type: string;
  metadata?: { isGroupedAddress?: boolean };
}): boolean {
  return (
    entity.metadata?.isGroupedAddress === true ||
    ['ADDRESS', 'SWISS_ADDRESS', 'EU_ADDRESS'].includes(entity.type)
  );
}

/**
 * Type definitions for PII entities
 */
export interface PIIEntity {
  text: string;
  type: string;
  start: number;
  end: number;
  confidence?: number;
  source?: 'regex' | 'ml';
  metadata?: {
    isGroupedAddress?: boolean;
    breakdown?: Record<string, string>;
    finalConfidence?: number;
    patternMatched?: string;
    scoringFactors?: string[];
    autoAnonymize?: boolean;
  };
  flaggedForReview?: boolean;
}

/**
 * Mapping file structure
 */
export interface MappingFile {
  version: string;
  timestamp: string;
  model?: string;
  documentType?: string;
  detectionMethods: string[];
  entities: Record<string, string>;
  addresses: Array<{
    placeholder: string;
    type: string;
    originalText: string;
    components: Record<string, string | null>;
    confidence: number;
    patternMatched: string | null;
    scoringFactors: string[];
    flaggedForReview: boolean;
    autoAnonymize: boolean;
  }>;
}
