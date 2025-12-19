/**
 * SafeRegex - ReDoS-protected regex utilities
 *
 * Provides timeout-protected regex operations to prevent
 * Regular Expression Denial of Service (ReDoS) attacks.
 *
 * Story 6.2: ReDoS Vulnerability Fix
 *
 * Key features:
 * - Timing-based detection of slow regex operations
 * - Configurable timeout thresholds
 * - Graceful fallback on timeout
 * - Logging for security monitoring
 */

import { LoggerFactory, type Logger } from './LoggerFactory.js';

// Create scoped logger
const log: Logger = LoggerFactory.create('safeRegex');

/**
 * Configuration options for safe regex operations
 */
export interface SafeRegexConfig {
  /** Timeout in milliseconds (default: 100ms per AC1) */
  timeoutMs?: number;
  /** Maximum input length before chunking (default: 10000 per AC2) */
  maxInputLength?: number;
  /** Maximum pattern complexity score (default: 100) */
  maxComplexity?: number;
  /** Enable logging of timeout events (default: true) */
  logTimeouts?: boolean;
}

/**
 * Result of a safe regex operation
 */
export interface SafeRegexResult<T> {
  /** Whether the operation completed successfully */
  success: boolean;
  /** The result value (if successful) */
  value?: T;
  /** Whether the operation timed out */
  timedOut: boolean;
  /** Duration in milliseconds */
  durationMs: number;
  /** Error message (if any) */
  error?: string;
}

// Default configuration
const DEFAULT_CONFIG: Required<SafeRegexConfig> = {
  timeoutMs: 100,
  maxInputLength: 10000,
  maxComplexity: 100,
  logTimeouts: true,
};

// Global configuration (can be modified via configure())
let globalConfig: Required<SafeRegexConfig> = { ...DEFAULT_CONFIG };

/**
 * Analyze pattern complexity to detect potentially dangerous patterns
 *
 * Higher scores indicate more complex (and potentially dangerous) patterns:
 * - Nested quantifiers: +10 each
 * - Unbounded quantifiers (*,+): +5 each
 * - Character classes with quantifiers: +3 each
 * - Alternation groups: +2 each
 *
 * @param pattern - Regex pattern string
 * @returns Complexity score (0-100+)
 */
export function analyzePatternComplexity(pattern: string): number {
  let score = 0;

  // Nested quantifiers (e.g., (a+)+ or [^x]{0,3}+ - dangerous)
  const nestedQuantifiers = pattern.match(/\{[^}]+\}[*+?]|\)[*+?]\)?[*+?]/g);
  if (nestedQuantifiers) {
    score += nestedQuantifiers.length * 10;
  }

  // Unbounded quantifiers (* or +)
  const unboundedQuantifiers = pattern.match(/[*+](?!\?)/g);
  if (unboundedQuantifiers) {
    score += unboundedQuantifiers.length * 5;
  }

  // Character classes with quantifiers (e.g., [^a-z]{0,3})
  const classWithQuantifier = pattern.match(/\][{*+]/g);
  if (classWithQuantifier) {
    score += classWithQuantifier.length * 3;
  }

  // Alternation groups (|)
  const alternations = pattern.match(/\|/g);
  if (alternations) {
    score += alternations.length * 2;
  }

  // Pattern length factor
  score += Math.floor(pattern.length / 50);

  return score;
}

/**
 * Check if a pattern is potentially dangerous (high ReDoS risk)
 *
 * @param pattern - Regex pattern string
 * @param maxComplexity - Maximum allowed complexity (default from config)
 * @returns True if pattern exceeds complexity threshold
 */
export function isPatternDangerous(
  pattern: string,
  maxComplexity: number = globalConfig.maxComplexity,
): boolean {
  const complexity = analyzePatternComplexity(pattern);
  return complexity > maxComplexity;
}

/**
 * Execute a regex test with timeout protection
 *
 * Note: True timeout requires worker threads. This implementation uses
 * timing checks that detect slow operations but cannot interrupt them.
 * For critical applications, consider the worker-based version.
 *
 * @param regex - The regex to test
 * @param text - Text to test against
 * @param config - Optional configuration overrides
 * @returns SafeRegexResult with test result
 */
export function safeTest(
  regex: RegExp,
  text: string,
  config?: SafeRegexConfig,
): SafeRegexResult<boolean> {
  const cfg = { ...globalConfig, ...config };
  const startTime = Date.now();

  try {
    // Reset regex state
    regex.lastIndex = 0;

    // Check input length
    if (text.length > cfg.maxInputLength) {
      return {
        success: false,
        timedOut: false,
        durationMs: 0,
        error: `Input exceeds maximum length (${text.length} > ${cfg.maxInputLength})`,
      };
    }

    // Perform the test
    const result = regex.test(text);
    const durationMs = Date.now() - startTime;

    // Check if it took too long (potential ReDoS)
    if (durationMs > cfg.timeoutMs) {
      if (cfg.logTimeouts) {
        log.warn('Regex test exceeded timeout', {
          durationMs,
          timeoutMs: cfg.timeoutMs,
          patternLength: regex.source.length,
          inputLength: text.length,
        });
      }
      return {
        success: false,
        timedOut: true,
        durationMs,
        error: `Regex execution exceeded timeout (${durationMs}ms > ${cfg.timeoutMs}ms)`,
      };
    }

    return {
      success: true,
      value: result,
      timedOut: false,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);

    log.error('Regex test failed', { error: message, durationMs });

    return {
      success: false,
      timedOut: false,
      durationMs,
      error: message,
    };
  }
}

/**
 * Execute a regex match with timeout protection
 *
 * @param regex - The regex to execute
 * @param text - Text to match against
 * @param config - Optional configuration overrides
 * @returns SafeRegexResult with match result
 */
export function safeMatch(
  regex: RegExp,
  text: string,
  config?: SafeRegexConfig,
): SafeRegexResult<RegExpMatchArray | null> {
  const cfg = { ...globalConfig, ...config };
  const startTime = Date.now();

  try {
    // Reset regex state
    regex.lastIndex = 0;

    // Check input length
    if (text.length > cfg.maxInputLength) {
      return {
        success: false,
        timedOut: false,
        durationMs: 0,
        error: `Input exceeds maximum length (${text.length} > ${cfg.maxInputLength})`,
      };
    }

    // Perform the match
    const result = text.match(regex);
    const durationMs = Date.now() - startTime;

    // Check if it took too long
    if (durationMs > cfg.timeoutMs) {
      if (cfg.logTimeouts) {
        log.warn('Regex match exceeded timeout', {
          durationMs,
          timeoutMs: cfg.timeoutMs,
          patternLength: regex.source.length,
          inputLength: text.length,
        });
      }
      return {
        success: false,
        timedOut: true,
        durationMs,
        error: `Regex execution exceeded timeout (${durationMs}ms > ${cfg.timeoutMs}ms)`,
      };
    }

    return {
      success: true,
      value: result,
      timedOut: false,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);

    log.error('Regex match failed', { error: message, durationMs });

    return {
      success: false,
      timedOut: false,
      durationMs,
      error: message,
    };
  }
}

/**
 * Execute a regex replace with timeout protection
 *
 * @param regex - The regex to use
 * @param text - Text to perform replacement on
 * @param replacement - Replacement string or function
 * @param config - Optional configuration overrides
 * @returns SafeRegexResult with replaced text
 */
export function safeReplace(
  regex: RegExp,
  text: string,
  replacement: string | ((match: string, ...args: unknown[]) => string),
  config?: SafeRegexConfig,
): SafeRegexResult<string> {
  const cfg = { ...globalConfig, ...config };
  const startTime = Date.now();

  try {
    // Reset regex state
    regex.lastIndex = 0;

    // Check input length
    if (text.length > cfg.maxInputLength) {
      return {
        success: false,
        timedOut: false,
        durationMs: 0,
        error: `Input exceeds maximum length (${text.length} > ${cfg.maxInputLength})`,
      };
    }

    // Perform the replacement
    const result = text.replace(regex, replacement as string);
    const durationMs = Date.now() - startTime;

    // Check if it took too long
    if (durationMs > cfg.timeoutMs) {
      if (cfg.logTimeouts) {
        log.warn('Regex replace exceeded timeout', {
          durationMs,
          timeoutMs: cfg.timeoutMs,
          patternLength: regex.source.length,
          inputLength: text.length,
        });
      }
      return {
        success: false,
        value: text, // Return original on timeout
        timedOut: true,
        durationMs,
        error: `Regex execution exceeded timeout (${durationMs}ms > ${cfg.timeoutMs}ms)`,
      };
    }

    return {
      success: true,
      value: result,
      timedOut: false,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);

    log.error('Regex replace failed', { error: message, durationMs });

    return {
      success: false,
      value: text, // Return original on error
      timedOut: false,
      durationMs,
      error: message,
    };
  }
}

/**
 * Split text into chunks for processing large inputs
 *
 * @param text - Text to split
 * @param maxChunkSize - Maximum size of each chunk (default from config)
 * @param overlapSize - Overlap between chunks to avoid splitting entities (default: 100)
 * @returns Array of text chunks
 */
export function chunkText(
  text: string,
  maxChunkSize: number = globalConfig.maxInputLength,
  overlapSize: number = 100,
): string[] {
  if (text.length <= maxChunkSize) {
    return [text];
  }

  // Ensure overlap is less than chunk size to prevent infinite loops
  const safeOverlap = Math.min(overlapSize, Math.floor(maxChunkSize / 2));

  const chunks: string[] = [];
  let position = 0;

  while (position < text.length) {
    // Calculate chunk end position
    let chunkEnd = Math.min(position + maxChunkSize, text.length);

    // Try to break at a natural boundary (newline or space)
    if (chunkEnd < text.length) {
      const searchWindow = Math.min(200, maxChunkSize - 1);
      const searchStart = Math.max(chunkEnd - searchWindow, position);
      const searchText = text.slice(searchStart, chunkEnd);

      // Look for newline first
      const lastNewline = searchText.lastIndexOf('\n');
      if (lastNewline > 0) {
        chunkEnd = searchStart + lastNewline + 1;
      } else {
        // Fall back to space
        const lastSpace = searchText.lastIndexOf(' ');
        if (lastSpace > 0) {
          chunkEnd = searchStart + lastSpace + 1;
        }
      }
    }

    chunks.push(text.slice(position, chunkEnd));

    // Move position, accounting for overlap (but not on last chunk)
    if (chunkEnd < text.length) {
      // Ensure we always make forward progress
      const newPosition = chunkEnd - safeOverlap;
      position = Math.max(newPosition, position + 1);
    } else {
      break;
    }
  }

  return chunks;
}

/**
 * Configure global safe regex settings
 *
 * @param config - Configuration options to apply
 */
export function configure(config: SafeRegexConfig): void {
  globalConfig = { ...globalConfig, ...config };
  log.debug('SafeRegex configuration updated', config as unknown as Record<string, unknown>);
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  globalConfig = { ...DEFAULT_CONFIG };
}

/**
 * Get current configuration
 */
export function getConfig(): Required<SafeRegexConfig> {
  return { ...globalConfig };
}

/**
 * SafeRegex class for object-oriented usage
 */
export class SafeRegex {
  private regex: RegExp;
  private config: Required<SafeRegexConfig>;

  constructor(pattern: string | RegExp, flags?: string, config?: SafeRegexConfig) {
    if (typeof pattern === 'string') {
      this.regex = new RegExp(pattern, flags);
    } else {
      this.regex = pattern;
    }
    this.config = { ...globalConfig, ...config };
  }

  /**
   * Test if the pattern matches the text
   */
  test(text: string): SafeRegexResult<boolean> {
    return safeTest(this.regex, text, this.config);
  }

  /**
   * Find matches in the text
   */
  match(text: string): SafeRegexResult<RegExpMatchArray | null> {
    return safeMatch(this.regex, text, this.config);
  }

  /**
   * Replace matches in the text
   */
  replace(
    text: string,
    replacement: string | ((match: string, ...args: unknown[]) => string),
  ): SafeRegexResult<string> {
    return safeReplace(this.regex, text, replacement, this.config);
  }

  /**
   * Get the underlying regex
   */
  get source(): string {
    return this.regex.source;
  }

  /**
   * Get the regex flags
   */
  get flags(): string {
    return this.regex.flags;
  }

  /**
   * Check if the pattern is potentially dangerous
   */
  isDangerous(): boolean {
    return isPatternDangerous(this.regex.source, this.config.maxComplexity);
  }

  /**
   * Get pattern complexity score
   */
  getComplexity(): number {
    return analyzePatternComplexity(this.regex.source);
  }
}
