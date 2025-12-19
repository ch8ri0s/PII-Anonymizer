/**
 * PII Detector - Browser Version with ML Model Support
 *
 * Enhanced detector that combines:
 * 1. ML model inference (if available)
 * 2. Regex-based SwissEuDetector (always available)
 *
 * Supports graceful fallback when ML model is unavailable.
 */

// Import shared detector from core (via Vite alias)
import { SwissEuDetector } from '@core/index';
import type { PIIMatch } from '@core/index';
import { isModelReady, isFallbackMode, runInference } from '../model';

// Re-export types for convenience
export type { PIIMatch };

/**
 * Detection mode
 */
export type DetectionMode = 'full' | 'regex-only';

/**
 * Extended PII match with source information
 */
export interface ExtendedPIIMatch extends PIIMatch {
  /** Source of the detection */
  source: 'ML' | 'REGEX' | 'BOTH';
  /** ML confidence score (if from ML) */
  mlScore?: number;
}

/**
 * Browser-compatible PII detector with ML support
 *
 * Uses SwissEuDetector for regex patterns and optionally
 * combines with ML model inference for enhanced accuracy.
 */
export class PIIDetector {
  private detector: SwissEuDetector;
  private mode: DetectionMode;

  constructor() {
    this.detector = new SwissEuDetector();
    this.mode = 'full';
  }

  /**
   * Get current detection mode
   */
  getMode(): DetectionMode {
    // Check if model is ready or in fallback
    if (isFallbackMode() || !isModelReady()) {
      return 'regex-only';
    }
    return this.mode;
  }

  /**
   * Set detection mode
   */
  setMode(mode: DetectionMode): void {
    this.mode = mode;
  }

  /**
   * Detect PII in text using available methods
   */
  async detect(text: string): Promise<ExtendedPIIMatch[]> {
    const actualMode = this.getMode();

    if (actualMode === 'regex-only') {
      // Use regex-only detection
      const regexMatches = this.detector.detect(text);
      return regexMatches.map(match => ({
        ...match,
        source: 'REGEX' as const,
      }));
    }

    // Full mode: combine ML + regex
    const [regexMatches, mlMatches] = await Promise.all([
      Promise.resolve(this.detector.detect(text)),
      this.runMLDetection(text),
    ]);

    // Merge and deduplicate matches
    return this.mergeMatches(regexMatches, mlMatches);
  }

  /**
   * Synchronous detect (regex-only, for backwards compatibility)
   */
  detectSync(text: string): PIIMatch[] {
    return this.detector.detect(text);
  }

  /**
   * Run ML model inference
   */
  private async runMLDetection(text: string): Promise<ExtendedPIIMatch[]> {
    try {
      const mlResults = await runInference(text);

      // Merge consecutive tokens of the same entity type (B-XXX, I-XXX)
      const mergedEntities = this.mergeSubwordTokens(mlResults, text);

      return mergedEntities.map(entity => ({
        type: this.mapMLEntityType(entity.entity),
        text: entity.word,
        start: entity.start,
        end: entity.end,
        source: 'ML' as const,
        mlScore: entity.score,
      }));
    } catch (error) {
      console.warn('ML detection failed, using regex-only:', error);
      return [];
    }
  }

  /**
   * Merge consecutive subword tokens into complete entities
   * HuggingFace NER uses B-XXX (beginning) and I-XXX (inside) labels
   */
  private mergeSubwordTokens(
    results: Array<{ word: string; entity: string; score: number; start: number; end: number }>,
    originalText: string
  ): Array<{ word: string; entity: string; score: number; start: number; end: number }> {
    if (results.length === 0) return [];

    const merged: Array<{ word: string; entity: string; score: number; start: number; end: number }> = [];
    let current: { word: string; entity: string; score: number; start: number; end: number } | null = null;

    for (const token of results) {
      const isBeginning = token.entity.startsWith('B-');
      const isInside = token.entity.startsWith('I-');
      const entityType = token.entity.replace(/^[BI]-/, '');

      if (isBeginning || !current) {
        // Start a new entity
        if (current) {
          // Finalize the previous entity
          current.word = originalText.substring(current.start, current.end);
          merged.push(current);
        }
        current = {
          word: token.word,
          entity: token.entity,
          score: token.score,
          start: token.start,
          end: token.end,
        };
      } else if (isInside && current) {
        // Check if this continues the same entity type
        const currentType = current.entity.replace(/^[BI]-/, '');
        if (currentType === entityType) {
          // Extend the current entity
          current.end = token.end;
          // Average the scores
          current.score = (current.score + token.score) / 2;
        } else {
          // Different type - finalize current and start new
          current.word = originalText.substring(current.start, current.end);
          merged.push(current);
          current = {
            word: token.word,
            entity: token.entity,
            score: token.score,
            start: token.start,
            end: token.end,
          };
        }
      } else {
        // Standalone token (no B- or I- prefix)
        if (current) {
          current.word = originalText.substring(current.start, current.end);
          merged.push(current);
        }
        current = {
          word: token.word,
          entity: token.entity,
          score: token.score,
          start: token.start,
          end: token.end,
        };
      }
    }

    // Don't forget the last entity
    if (current) {
      current.word = originalText.substring(current.start, current.end);
      merged.push(current);
    }

    // Filter out very short entities (likely noise)
    return merged.filter(e => e.word.length >= 2);
  }

  /**
   * Map ML entity types to our internal types
   */
  private mapMLEntityType(mlType: string): string {
    // HuggingFace NER labels to our types
    const mapping: Record<string, string> = {
      'B-PER': 'PERSON_NAME',
      'I-PER': 'PERSON_NAME',
      'B-LOC': 'LOCATION',
      'I-LOC': 'LOCATION',
      'B-ORG': 'ORGANIZATION',
      'I-ORG': 'ORGANIZATION',
      'B-MISC': 'OTHER',
      'I-MISC': 'OTHER',
    };
    return mapping[mlType] || 'OTHER';
  }

  /**
   * Merge and deduplicate ML and regex matches
   */
  private mergeMatches(
    regexMatches: PIIMatch[],
    mlMatches: ExtendedPIIMatch[],
  ): ExtendedPIIMatch[] {
    const merged: ExtendedPIIMatch[] = [];
    const seen = new Set<string>();

    // Add regex matches first
    for (const match of regexMatches) {
      const key = `${match.start}-${match.end}-${match.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({
          ...match,
          source: 'REGEX',
        });
      }
    }

    // Add ML matches, marking overlaps as BOTH
    for (const mlMatch of mlMatches) {
      const key = `${mlMatch.start}-${mlMatch.end}-${mlMatch.type}`;
      const existingIdx = merged.findIndex(
        m => this.overlaps(m, mlMatch),
      );

      if (existingIdx >= 0) {
        // Overlapping match - mark as BOTH and boost confidence
        merged[existingIdx] = {
          ...merged[existingIdx],
          source: 'BOTH',
          mlScore: mlMatch.mlScore,
          confidence: Math.max(
            merged[existingIdx].confidence || 0,
            mlMatch.confidence || 0,
          ) * 1.1, // Boost confidence for matches found by both
        };
      } else if (!seen.has(key)) {
        // New ML-only match
        seen.add(key);
        merged.push(mlMatch);
      }
    }

    // Sort by position
    merged.sort((a, b) => a.start - b.start);

    return merged;
  }

  /**
   * Check if two matches overlap
   */
  private overlaps(a: PIIMatch, b: PIIMatch): boolean {
    return a.start < b.end && b.start < a.end;
  }

  /**
   * Get statistics about detected PII
   */
  getStatistics(matches: PIIMatch[]): Record<string, number> {
    return this.detector.getStatistics(matches);
  }

  /**
   * Get human-readable label for a PII type
   */
  getTypeLabel(type: string): string {
    return this.detector.getTypeLabel(type);
  }

  /**
   * Get extended statistics including source breakdown
   */
  getExtendedStatistics(matches: ExtendedPIIMatch[]): {
    byType: Record<string, number>;
    bySource: Record<string, number>;
    total: number;
  } {
    const byType = this.getStatistics(matches);
    const bySource: Record<string, number> = {
      ML: 0,
      REGEX: 0,
      BOTH: 0,
    };

    for (const match of matches) {
      bySource[match.source] = (bySource[match.source] || 0) + 1;
    }

    return {
      byType,
      bySource,
      total: matches.length,
    };
  }
}

export default PIIDetector;
