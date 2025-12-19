/**
 * Anonymizer - Browser Adapter
 *
 * Uses shared core functions from @core for anonymization logic.
 * Single source of truth for anonymization - same as Electron.
 */

import type { MappingEntry } from '../types';
import type { PIIMatch } from '@core/index';

// Import shared core utilities - same functions used by Electron
import {
  buildFuzzyRegex,
  extractCodeBlocks,
  restoreCodeBlocks,
  extractInlineCode,
  restoreInlineCode,
  FileProcessingSession,
} from '@core/index';

export { FileProcessingSession };

/**
 * Anonymize text by replacing PII with pseudonyms
 *
 * Uses the shared FileProcessingSession for state management
 * and shared fuzzy regex builder for matching.
 */
export function anonymizeText(
  text: string,
  matches: PIIMatch[],
  session: FileProcessingSession
): { anonymizedText: string; mappingTable: MappingEntry[] } {
  const mappings = new Map<string, MappingEntry>();

  // Filter out invalid matches (positions out of bounds or invalid text)
  const validMatches = matches.filter(match => {
    if (!match.text || match.text.length === 0) return false;
    if (match.start < 0 || match.end < 0) return false;
    if (match.start >= text.length || match.end > text.length) return false;
    if (match.start >= match.end) return false;
    return true;
  });

  // Sort matches by position (descending) to replace from end to start
  const sorted = [...validMatches].sort((a, b) => b.start - a.start);

  let result = text;

  for (const match of sorted) {
    // Skip if range already anonymized
    if (session.isRangeAnonymized(match.start, match.end)) {
      continue;
    }

    // Build fuzzy regex for matching (shared function)
    const regex = buildFuzzyRegex(match.text);
    if (!regex) continue;

    // Get or create pseudonym using shared session
    const pseudonym = session.getOrCreatePseudonym(match.text, match.type);

    // Track mapping
    const key = match.text.toLowerCase();
    if (mappings.has(key)) {
      mappings.get(key)!.occurrences++;
    } else {
      mappings.set(key, {
        original: match.text,
        replacement: pseudonym,
        type: match.type,
        occurrences: 1,
      });
    }

    // Mark range as anonymized before replacing
    session.markRangeAnonymized(match.start, match.end, pseudonym);

    // Replace at exact position
    result = result.slice(0, match.start) + pseudonym + result.slice(match.end);
  }

  return {
    anonymizedText: result,
    mappingTable: Array.from(mappings.values()),
  };
}

/**
 * Anonymize Markdown while preserving code blocks
 *
 * Uses shared code block extraction/restoration functions.
 * Same algorithm as Electron version.
 */
export function anonymizeMarkdown(
  markdown: string,
  matches: PIIMatch[],
  session: FileProcessingSession
): { anonymizedMarkdown: string; mappingTable: MappingEntry[] } {
  // Step 1: Extract code blocks (shared function)
  const { textWithoutCode, codeBlocks } = extractCodeBlocks(markdown);

  // Step 2: Extract inline code (shared function)
  const { textWithoutInline, inlineCode } = extractInlineCode(textWithoutCode);

  // Step 3: Anonymize text
  const { anonymizedText, mappingTable } = anonymizeText(
    textWithoutInline,
    matches,
    session
  );

  // Step 4: Restore inline code (shared function)
  let result = restoreInlineCode(anonymizedText, inlineCode);

  // Step 5: Restore code blocks (shared function)
  result = restoreCodeBlocks(result, codeBlocks);

  return {
    anonymizedMarkdown: result,
    mappingTable,
  };
}

export default { anonymizeText, anonymizeMarkdown, FileProcessingSession };
