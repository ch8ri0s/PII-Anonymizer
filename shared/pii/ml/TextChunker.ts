/**
 * Text Chunker for Large Document Processing (Story 8.11)
 *
 * Splits large documents into overlapping chunks for ML model processing.
 * Handles documents exceeding model context limits (typically 512 tokens).
 *
 * Features:
 * - Sentence-boundary aware chunking (no mid-sentence splits)
 * - Configurable overlap to prevent boundary information loss
 * - Offset adjustment for merging predictions back to original coordinates
 * - Deduplication of overlapping predictions
 *
 * @module shared/pii/ml/TextChunker
 */

import type { MLToken } from './SubwordTokenMerger.js';

/**
 * Configuration for text chunking
 */
export interface ChunkConfig {
  /** Maximum tokens per chunk (default: 512) */
  maxTokens: number;
  /** Overlap tokens between chunks (default: 50) */
  overlapTokens: number;
  /** Custom tokenizer function (optional, uses simple word count if not provided) */
  tokenizer?: (text: string) => number;
}

/**
 * A chunk of text with position information
 */
export interface TextChunk {
  /** Chunk text content */
  text: string;
  /** Character start position in original text */
  start: number;
  /** Character end position in original text */
  end: number;
  /** 0-based chunk index */
  chunkIndex: number;
}

/**
 * Prediction result from a single chunk
 */
export interface ChunkPrediction {
  /** Index of the chunk this prediction came from */
  chunkIndex: number;
  /** ML predictions for this chunk (positions relative to chunk start) */
  predictions: MLToken[];
}

/**
 * Default chunking configuration
 */
export const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
  maxTokens: 512,
  overlapTokens: 50,
  tokenizer: undefined,
};

/**
 * Simple token estimation (approximately 4 characters per token)
 * This is a rough estimate that works well for most Western languages.
 */
export function estimateTokenCount(text: string): number {
  // Simple heuristic: ~4 chars per token for English/German/French
  // Also count words as a minimum (handles languages with longer words)
  const charBasedEstimate = Math.ceil(text.length / 4);
  const wordBasedEstimate = text.split(/\s+/).filter((w) => w.length > 0).length;
  return Math.max(charBasedEstimate, wordBasedEstimate);
}

/**
 * Split text into sentences, preserving sentence boundaries
 */
export function splitIntoSentences(text: string): string[] {
  if (text.length === 0) return [];

  // Sentence-ending patterns (handles . ! ? and common abbreviations)
  // This regex splits on sentence-ending punctuation followed by whitespace
  const sentences: string[] = [];
  let currentSentence = '';
  let i = 0;

  while (i < text.length) {
    currentSentence += text[i];

    // Check for sentence endings
    if (text[i] === '.' || text[i] === '!' || text[i] === '?') {
      // Look ahead: if followed by whitespace and uppercase/newline, it's a sentence boundary
      const nextChar = text[i + 1];
      const nextNextChar = text[i + 2];

      const isEndOfText = i === text.length - 1;
      const followedByWhitespace = nextChar && /\s/.test(nextChar);
      const followedByUppercase =
        nextNextChar && /[A-ZÄÖÜÀÂÇÉÈÊËÎÏÔÛÙÜŸŒÆ]/.test(nextNextChar);
      const followedByNewline = nextChar === '\n';

      // Check for common abbreviations that shouldn't end a sentence
      const abbreviationPatterns = /(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|e\.g|i\.e|Inc|Ltd|Corp|Co)\.$/i;
      const isAbbreviation = abbreviationPatterns.test(currentSentence);

      if (
        !isAbbreviation &&
        (isEndOfText || followedByNewline || (followedByWhitespace && followedByUppercase))
      ) {
        sentences.push(currentSentence);
        currentSentence = '';
        // Skip trailing whitespace
        while (text[i + 1] && /\s/.test(text[i + 1])) {
          i++;
        }
      }
    }

    i++;
  }

  // Add any remaining text as a sentence
  if (currentSentence.trim().length > 0) {
    sentences.push(currentSentence);
  }

  return sentences;
}

/**
 * Split text into overlapping chunks for ML model processing
 *
 * The algorithm:
 * 1. If text is small enough, return as single chunk
 * 2. Split text into sentences to preserve sentence boundaries
 * 3. Group sentences into chunks, respecting maxTokens limit
 * 4. Add overlap from previous chunk to handle boundary entities
 *
 * @param text - Full document text
 * @param config - Chunking configuration
 * @returns Array of text chunks with position information
 */
export function chunkText(
  text: string,
  config: Partial<ChunkConfig> = {},
): TextChunk[] {
  const cfg: ChunkConfig = { ...DEFAULT_CHUNK_CONFIG, ...config };
  const tokenize = cfg.tokenizer || estimateTokenCount;

  if (text.length === 0) {
    return [];
  }

  // Check if document is small enough for single chunk
  const totalTokens = tokenize(text);
  if (totalTokens <= cfg.maxTokens) {
    return [
      {
        text,
        start: 0,
        end: text.length,
        chunkIndex: 0,
      },
    ];
  }

  // Split into sentences
  const sentences = splitIntoSentences(text);
  if (sentences.length === 0) {
    // Fallback: treat entire text as one "sentence"
    return [
      {
        text,
        start: 0,
        end: text.length,
        chunkIndex: 0,
      },
    ];
  }

  const chunks: TextChunk[] = [];
  let currentChunkSentences: string[] = [];
  let currentTokenCount = 0;
  let chunkStartIndex = 0;
  let textPosition = 0;
  const sentencePositions: Array<{ start: number; end: number }> = [];

  // Calculate positions for each sentence (including trailing whitespace)
  let pos = 0;
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const start = text.indexOf(sentence, pos);
    let end = start + sentence.length;

    // Include trailing whitespace between sentences
    // This ensures chunk.text matches text.substring(chunk.start, chunk.end)
    if (i < sentences.length - 1) {
      const nextSentence = sentences[i + 1];
      const nextStart = text.indexOf(nextSentence, end);
      if (nextStart > end) {
        // Include the whitespace up to the next sentence
        end = nextStart;
      }
    }

    sentencePositions.push({ start, end });
    pos = end;
  }

  // Track overlap sentences for the next chunk
  let overlapSentences: string[] = [];
  let overlapTokenCount = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceTokens = tokenize(sentence);

    // Check if adding this sentence would exceed limit
    if (currentTokenCount + sentenceTokens > cfg.maxTokens && currentChunkSentences.length > 0) {
      // Finalize current chunk - use original text slice to preserve exact whitespace
      const startPos = sentencePositions[chunkStartIndex].start;
      const endPos = sentencePositions[chunkStartIndex + currentChunkSentences.length - 1].end;
      const chunkText = text.substring(startPos, endPos);

      chunks.push({
        text: chunkText,
        start: startPos,
        end: endPos,
        chunkIndex: chunks.length,
      });

      // Calculate overlap for next chunk
      overlapSentences = [];
      overlapTokenCount = 0;

      // Work backwards to collect overlap sentences
      for (let j = currentChunkSentences.length - 1; j >= 0 && overlapTokenCount < cfg.overlapTokens; j--) {
        const overlapSentence = currentChunkSentences[j];
        overlapSentences.unshift(overlapSentence);
        overlapTokenCount += tokenize(overlapSentence);
      }

      // Start new chunk with overlap
      currentChunkSentences = [...overlapSentences];
      currentTokenCount = overlapTokenCount;
      chunkStartIndex = i - overlapSentences.length;
    }

    // Add sentence to current chunk
    currentChunkSentences.push(sentence);
    currentTokenCount += sentenceTokens;
  }

  // Finalize last chunk - use original text slice to preserve exact whitespace
  if (currentChunkSentences.length > 0) {
    const startPos = sentencePositions[chunkStartIndex].start;
    const endIdx = Math.min(chunkStartIndex + currentChunkSentences.length - 1, sentencePositions.length - 1);
    const endPos = sentencePositions[endIdx].end;
    const chunkText = text.substring(startPos, endPos);

    chunks.push({
      text: chunkText,
      start: startPos,
      end: endPos,
      chunkIndex: chunks.length,
    });
  }

  return chunks;
}

/**
 * Merge ML predictions from multiple chunks back into original document coordinates
 *
 * The algorithm:
 * 1. Adjust prediction offsets based on chunk start position
 * 2. Collect all predictions from all chunks
 * 3. Deduplicate overlapping predictions (same entity at same position)
 * 4. Return merged predictions sorted by position
 *
 * @param chunkPredictions - Predictions per chunk with chunk index
 * @param chunks - Original chunks used for processing
 * @returns Merged predictions with correct offsets in original document
 */
export function mergeChunkPredictions(
  chunkPredictions: ChunkPrediction[],
  chunks: TextChunk[],
): MLToken[] {
  if (chunkPredictions.length === 0 || chunks.length === 0) {
    return [];
  }

  // Collect all predictions with adjusted offsets
  const allPredictions: MLToken[] = [];

  for (const cp of chunkPredictions) {
    const chunk = chunks.find((c) => c.chunkIndex === cp.chunkIndex);
    if (!chunk) continue;

    for (const pred of cp.predictions) {
      // Adjust offsets to original document coordinates
      allPredictions.push({
        ...pred,
        start: pred.start + chunk.start,
        end: pred.end + chunk.start,
      });
    }
  }

  // Sort by position
  allPredictions.sort((a, b) => a.start - b.start || a.end - b.end);

  // Deduplicate overlapping predictions
  // Two predictions are duplicates if they have significant overlap and same entity type
  const deduplicated: MLToken[] = [];

  for (const pred of allPredictions) {
    // Check for overlap with existing predictions
    const existingIdx = deduplicated.findIndex((existing) => {
      // Must be same entity type
      if (existing.entity !== pred.entity) return false;

      // Check for significant overlap (>50% of smaller entity)
      const overlapStart = Math.max(existing.start, pred.start);
      const overlapEnd = Math.min(existing.end, pred.end);
      const overlapLength = Math.max(0, overlapEnd - overlapStart);

      const existingLength = existing.end - existing.start;
      const predLength = pred.end - pred.start;
      const minLength = Math.min(existingLength, predLength);

      return overlapLength > minLength * 0.5;
    });

    if (existingIdx >= 0) {
      // Keep the prediction with higher confidence
      const existing = deduplicated[existingIdx];
      if (pred.score > existing.score) {
        // Expand bounds to cover both predictions
        deduplicated[existingIdx] = {
          ...pred,
          start: Math.min(existing.start, pred.start),
          end: Math.max(existing.end, pred.end),
        };
      } else {
        // Expand existing bounds
        deduplicated[existingIdx] = {
          ...existing,
          start: Math.min(existing.start, pred.start),
          end: Math.max(existing.end, pred.end),
        };
      }
    } else {
      deduplicated.push(pred);
    }
  }

  return deduplicated;
}

/**
 * Check if a document needs chunking
 *
 * @param text - Document text
 * @param maxTokens - Maximum tokens before chunking (default: 512)
 * @returns true if document needs to be chunked
 */
export function needsChunking(text: string, maxTokens: number = 512): boolean {
  return estimateTokenCount(text) > maxTokens;
}

/**
 * Text chunker class with pre-configured settings
 */
export class TextChunker {
  private config: ChunkConfig;

  constructor(config: Partial<ChunkConfig> = {}) {
    this.config = { ...DEFAULT_CHUNK_CONFIG, ...config };
  }

  /**
   * Chunk text using configured settings
   */
  chunk(text: string): TextChunk[] {
    return chunkText(text, this.config);
  }

  /**
   * Check if text needs chunking with current config
   */
  needsChunking(text: string): boolean {
    return needsChunking(text, this.config.maxTokens);
  }

  /**
   * Merge predictions from chunks
   */
  mergePredictions(
    chunkPredictions: ChunkPrediction[],
    chunks: TextChunk[],
  ): MLToken[] {
    return mergeChunkPredictions(chunkPredictions, chunks);
  }

  /**
   * Get current configuration
   */
  getConfig(): ChunkConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  configure(config: Partial<ChunkConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create a configured TextChunker instance
 */
export function createTextChunker(config?: Partial<ChunkConfig>): TextChunker {
  return new TextChunker(config);
}
