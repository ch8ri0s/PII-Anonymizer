/**
 * Text Normalizer for PII Detection
 *
 * Performs text-level normalization before PII detection:
 * - Unicode normalization (NFKC)
 * - Whitespace normalization (zero-width, non-breaking spaces)
 * - Email de-obfuscation (at, dot, arobase patterns)
 * - Phone de-obfuscation (spaces, dashes, (0) removal)
 *
 * Maintains position mapping from normalized text back to original indices
 * for accurate anonymization and mapping file generation.
 *
 * @module shared/pii/preprocessing/TextNormalizer
 */

/**
 * Result of text normalization
 */
export interface NormalizationResult {
  /** Normalized text used by downstream passes */
  normalizedText: string;
  /**
   * Map from normalized index to original index.
   * indexMap[normalizedIndex] = originalIndex
   * For indices that result from collapsing characters,
   * map to the nearest original index.
   */
  indexMap: number[];
}

/**
 * Configuration options for TextNormalizer
 */
export interface TextNormalizerOptions {
  /** Enable/disable email de-obfuscation (default: true) */
  handleEmails?: boolean;
  /** Enable/disable phone de-obfuscation (default: true) */
  handlePhones?: boolean;
  /** Enable/disable Unicode normalization (default: true) */
  normalizeUnicode?: boolean;
  /** Enable/disable whitespace normalization (default: true) */
  normalizeWhitespace?: boolean;
  /** Target Unicode normalization form (default: 'NFKC') */
  normalizationForm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
  /** Supported locales for obfuscation patterns (default: ['en', 'fr', 'de']) */
  supportedLocales?: string[];
}

/**
 * Replacement function type
 */
type ReplacementFn = (match: string, ...groups: string[]) => string;

/**
 * Replacement pattern definition
 */
interface ReplacementPattern {
  /** Regex pattern to match */
  pattern: RegExp;
  /** Replacement string or function */
  replacement: string | ReplacementFn;
  /** Description for debugging */
  description: string;
}

/**
 * Default configuration
 */
const DEFAULT_OPTIONS: Required<TextNormalizerOptions> = {
  handleEmails: true,
  handlePhones: true,
  normalizeUnicode: true,
  normalizeWhitespace: true,
  normalizationForm: 'NFKC',
  supportedLocales: ['en', 'fr', 'de'],
};

/**
 * Zero-width and invisible characters to remove
 */
const ZERO_WIDTH_CHARS = [
  '\u200B', // Zero Width Space
  '\u200C', // Zero Width Non-Joiner
  '\u200D', // Zero Width Joiner
  '\u2060', // Word Joiner
  '\uFEFF', // Zero Width No-Break Space (BOM)
];

/**
 * Non-breaking space variants to normalize
 */
const NBSP_CHARS = [
  '\u00A0', // Non-Breaking Space
  '\u2007', // Figure Space
  '\u202F', // Narrow No-Break Space
];

/**
 * Email de-obfuscation patterns (EN/FR/DE)
 * Order matters - more specific patterns first
 */
const EMAIL_PATTERNS: ReplacementPattern[] = [
  // English patterns
  { pattern: /\s*\(at\)\s*/gi, replacement: '@', description: 'EN: (at)' },
  { pattern: /\s*\[at\]\s*/gi, replacement: '@', description: 'EN: [at]' },
  { pattern: /\s*\{at\}\s*/gi, replacement: '@', description: 'EN: {at}' },
  // Note: Standalone " at " is NOT matched to avoid false positives like "Call us at +41"
  // Only parenthesized/bracketed forms are matched for standalone use
  { pattern: /\s*\(dot\)\s*/gi, replacement: '.', description: 'EN: (dot)' },
  { pattern: /\s*\[dot\]\s*/gi, replacement: '.', description: 'EN: [dot]' },
  { pattern: /\s*\{dot\}\s*/gi, replacement: '.', description: 'EN: {dot}' },
  // Note: Standalone " dot " is NOT matched to avoid false positives

  // French patterns (more specific first)
  { pattern: /\s*\(arobase\)\s*/gi, replacement: '@', description: 'FR: (arobase)' },
  { pattern: /\s*arobase\s*/gi, replacement: '@', description: 'FR: arobase' },
  { pattern: /\s*\(point\)\s*/gi, replacement: '.', description: 'FR: (point)' },
  { pattern: /\s*point\s+/gi, replacement: '.', description: 'FR: point' },

  // German patterns
  { pattern: /\s*\(Klammeraffe\)\s*/gi, replacement: '@', description: 'DE: (Klammeraffe)' },
  { pattern: /\s*Klammeraffe\s*/gi, replacement: '@', description: 'DE: Klammeraffe' },
  { pattern: /\s*\(Punkt\)\s*/gi, replacement: '.', description: 'DE: (Punkt)' },
  // Note: Standalone " Punkt " is NOT matched to avoid false positives
];

/**
 * Phone de-obfuscation patterns
 * Conservative patterns to avoid breaking position mapping
 * Only (0) removal is done - separator normalization breaks offset tracking
 */
const PHONE_PATTERNS: ReplacementPattern[] = [
  // Remove (0) in international format: +41 (0) 79 → +41 79
  // This is safe because the replacement is just stripping characters
  {
    pattern: /(\+\d{1,3})\s*\(0\)\s*/g,
    replacement: '$1 ',
    description: 'Remove (0) prefix',
  },
  // NOTE: Separator normalization (e.g., dashes/dots to spaces) is NOT done here
  // because it breaks offset mapping. The phone regex patterns in HighRecallPass
  // already handle various separator formats.
];

/**
 * Text Normalizer
 *
 * Performs text-level normalization while maintaining position mapping
 * for accurate offset repair after PII detection.
 */
export class TextNormalizer {
  private options: Required<TextNormalizerOptions>;

  constructor(options?: TextNormalizerOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Normalize input text for PII detection
   *
   * @param input - Original document text
   * @returns Normalized text with position mapping
   */
  normalize(input: string): NormalizationResult {
    if (!input) {
      return { normalizedText: '', indexMap: [] };
    }

    // Step 1: Unicode normalization (character-level, may change length)
    let { text, indexMap } = this.options.normalizeUnicode
      ? this.applyUnicodeNormalization(input)
      : { text: input, indexMap: this.createIdentityMap(input.length) };

    // Step 2: Whitespace normalization (remove zero-width, normalize NBSP)
    if (this.options.normalizeWhitespace) {
      const result = this.applyWhitespaceNormalization(text, indexMap);
      text = result.text;
      indexMap = result.indexMap;
    }

    // Step 3: Email de-obfuscation
    if (this.options.handleEmails) {
      const result = this.applyPatterns(text, indexMap, EMAIL_PATTERNS);
      text = result.text;
      indexMap = result.indexMap;
    }

    // Step 4: Phone de-obfuscation
    if (this.options.handlePhones) {
      const result = this.applyPatterns(text, indexMap, PHONE_PATTERNS);
      text = result.text;
      indexMap = result.indexMap;
    }

    return { normalizedText: text, indexMap };
  }

  /**
   * Map an entity span from normalized text back to original text
   *
   * @param start - Start index in normalized text
   * @param end - End index in normalized text
   * @param indexMap - Position mapping from normalize()
   * @returns Span in original text coordinates
   */
  mapSpan(
    start: number,
    end: number,
    indexMap: number[],
  ): { start: number; end: number } {
    if (indexMap.length === 0) {
      return { start, end };
    }

    // Map start to original position
    const mappedStart = start < indexMap.length ? indexMap[start] : indexMap[indexMap.length - 1];

    // Map end to original position (end is exclusive, so use end-1 then add 1)
    let mappedEnd: number;
    if (end <= 0) {
      mappedEnd = 0;
    } else if (end > indexMap.length) {
      // End is beyond normalized text, use last mapped position + 1
      mappedEnd = (indexMap[indexMap.length - 1] ?? 0) + 1;
    } else {
      // end-1 gives us the last character's position, then we add 1 for exclusive end
      mappedEnd = (indexMap[end - 1] ?? mappedStart) + 1;
    }

    return {
      start: mappedStart ?? start,
      end: mappedEnd,
    };
  }

  /**
   * Get current options
   */
  getOptions(): Required<TextNormalizerOptions> {
    return { ...this.options };
  }

  /**
   * Apply Unicode normalization
   */
  private applyUnicodeNormalization(
    input: string,
  ): { text: string; indexMap: number[] } {
    const normalized = input.normalize(this.options.normalizationForm);

    // If lengths match, we can use a simple identity map
    if (normalized.length === input.length) {
      return { text: normalized, indexMap: this.createIdentityMap(input.length) };
    }

    // Build position map for length-changing normalization
    // This is complex because NFKC can both expand and contract characters
    const indexMap: number[] = [];

    let originalIdx = 0;
    let normalizedIdx = 0;

    // Process character by character
    while (originalIdx < input.length) {
      const originalChar = input[originalIdx];
      if (originalChar === undefined) {
        originalIdx++;
        continue;
      }
      const normalizedChar = originalChar.normalize(this.options.normalizationForm);

      // Map each normalized character back to the original position
      for (let i = 0; i < normalizedChar.length; i++) {
        indexMap.push(originalIdx);
      }

      originalIdx++;
      normalizedIdx += normalizedChar.length;
    }

    return { text: normalized, indexMap };
  }

  /**
   * Apply whitespace normalization
   */
  private applyWhitespaceNormalization(
    input: string,
    inputIndexMap: number[],
  ): { text: string; indexMap: number[] } {
    const result: string[] = [];
    const indexMap: number[] = [];

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      if (char === undefined) {
        continue;
      }
      const originalIndex = inputIndexMap[i] ?? i;

      // Remove zero-width characters entirely
      if (ZERO_WIDTH_CHARS.includes(char)) {
        continue; // Skip, don't add to result
      }

      // Normalize NBSP variants to regular space
      if (NBSP_CHARS.includes(char)) {
        result.push(' ');
        indexMap.push(originalIndex);
        continue;
      }

      // Keep other characters as-is
      result.push(char);
      indexMap.push(originalIndex);
    }

    return { text: result.join(''), indexMap };
  }

  /**
   * Apply replacement patterns while maintaining position mapping
   */
  private applyPatterns(
    input: string,
    inputIndexMap: number[],
    patterns: ReplacementPattern[],
  ): { text: string; indexMap: number[] } {
    let text = input;
    let indexMap = [...inputIndexMap];

    for (const { pattern, replacement } of patterns) {
      // Reset regex lastIndex
      if (pattern.global) {
        pattern.lastIndex = 0;
      }

      // Find all matches and process them
      const matches: Array<{ index: number; length: number; replacement: string }> = [];
      let match: RegExpExecArray | null;

      // Clone regex to avoid mutation issues
      const regexCopy = new RegExp(pattern.source, pattern.flags);

      while ((match = regexCopy.exec(text)) !== null) {
        let replacementStr: string;
        if (typeof replacement === 'function') {
          // Call replacement function with match groups
          replacementStr = (replacement as (...args: string[]) => string)(
            match[0],
            ...match.slice(1),
          );
        } else {
          // Handle backreferences like $1, $2
          replacementStr = match[0].replace(pattern, replacement);
        }

        matches.push({
          index: match.index,
          length: match[0].length,
          replacement: replacementStr,
        });

        // Prevent infinite loop on zero-length matches
        if (match[0].length === 0) {
          regexCopy.lastIndex++;
        }
      }

      // Apply replacements from end to start to maintain indices
      for (let i = matches.length - 1; i >= 0; i--) {
        const matchEntry = matches[i];
        if (!matchEntry) continue;
        const { index, length, replacement: replacementStr } = matchEntry;

        // Get the original index for this position
        const originalStartIndex = indexMap[index] ?? index;

        // Build new text
        const before = text.slice(0, index);
        const after = text.slice(index + length);
        text = before + replacementStr + after;

        // Update index map
        const beforeMap = indexMap.slice(0, index);
        const afterMap = indexMap.slice(index + length);

        // For the replacement, map all new characters to the original start position
        const replacementMap = new Array(replacementStr.length).fill(originalStartIndex);

        indexMap = [...beforeMap, ...replacementMap, ...afterMap];
      }
    }

    return { text, indexMap };
  }

  /**
   * Create an identity map (each index maps to itself)
   */
  private createIdentityMap(length: number): number[] {
    return Array.from({ length }, (_, i) => i);
  }
}

/**
 * Create a new TextNormalizer instance
 * @param options - Configuration options
 */
export function createTextNormalizer(options?: TextNormalizerOptions): TextNormalizer {
  return new TextNormalizer(options);
}

/**
 * Default normalizer with all options enabled
 */
export const defaultNormalizer = new TextNormalizer();
