/**
 * PII Detector - Browser Version with Full Pipeline Support (Story 7.3)
 *
 * Enhanced detector that combines:
 * 1. ML model inference (if available)
 * 2. Regex-based SwissEuDetector (always available)
 * 3. Full multi-pass detection pipeline (optional)
 *
 * Supports graceful fallback when ML model is unavailable.
 */

// Import shared detector from core (via Vite alias)
import { SwissEuDetector } from '@core/index';
import type { PIIMatch } from '@core/index';
import { isModelReady, isFallbackMode, runInference } from '../model';

// Import pipeline components
import type { Entity, DetectionResult, PipelineConfig } from '../types/detection.js';
import { DetectionPipeline, createPipeline } from '@pii/DetectionPipeline';
import { createFormatValidationPass } from '@pii/passes/FormatValidationPass';
import { createContextScoringPass } from '@pii/passes/ContextScoringPass';
import { createAddressRelationshipPass } from '@pii/passes/AddressRelationshipPass';
import { createBrowserHighRecallPass } from '../pii/BrowserHighRecallPass';
import { createBrowserDocumentTypePass } from '../pii/BrowserDocumentTypePass';

// Worker types
import type { WorkerRequest, WorkerResponse, ProgressCallback } from '../workers/types';

// Re-export types for convenience
export type { PIIMatch, Entity, DetectionResult };

/**
 * Pipeline detection options
 */
export interface PipelineDetectionOptions {
  /** Use web worker for background processing */
  useWorker?: boolean;
  /** Progress callback for long-running operations */
  onProgress?: ProgressCallback;
  /** Pipeline configuration overrides */
  config?: Partial<PipelineConfig>;
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Detection mode
 */
export type DetectionMode = 'full' | 'regex-only';

/**
 * Extended PII match with source information
 *
 * Note: Uses Omit to properly override the source property with uppercase values
 * for consistency with the Entity interface from the detection pipeline.
 */
export interface ExtendedPIIMatch extends Omit<PIIMatch, 'source'> {
  /** Source of the detection (uppercase for compatibility with Entity.source) */
  source: 'ML' | 'REGEX' | 'BOTH' | 'MANUAL';
  /** ML confidence score (if from ML) */
  mlScore?: number;
  /** Confidence score (0-1) for compatibility with Entity */
  confidence?: number;
  /** Unique identifier (for compatibility with Entity) */
  id?: string;
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
  private pipeline: DetectionPipeline | null = null;
  private worker: Worker | null = null;
  private workerReady = false;
  private pendingRequests = new Map<string, {
    resolve: (value: DetectionResult) => void;
    reject: (error: Error) => void;
    onProgress?: ProgressCallback;
  }>();

  constructor() {
    this.detector = new SwissEuDetector();
    this.mode = 'full';
  }

  /**
   * Initialize the detection pipeline
   * Call this before using detectWithPipeline()
   */
  async initializePipeline(): Promise<void> {
    if (this.pipeline) return;

    // Create pipeline with default config
    this.pipeline = createPipeline({
      mlConfidenceThreshold: 0.3,
      enabledPasses: {
        highRecall: true,
        formatValidation: true,
        contextScoring: true,
        addressRelationship: true,
        documentType: true,
      },
    });

    // Register browser-compatible passes
    this.pipeline.registerPass(createBrowserHighRecallPass(0.3));
    this.pipeline.registerPass(createFormatValidationPass());
    this.pipeline.registerPass(createContextScoringPass());
    this.pipeline.registerPass(createAddressRelationshipPass());
    this.pipeline.registerPass(createBrowserDocumentTypePass());
  }

  /**
   * Initialize the web worker for background processing
   */
  initializeWorker(): void {
    if (this.worker) return;

    try {
      this.worker = new Worker(
        new URL('../workers/pii.worker.ts', import.meta.url),
        { type: 'module' },
      );

      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      this.worker.onerror = (error) => {
        console.error('Worker error:', error);
        // Reject all pending requests
        for (const [id, { reject }] of this.pendingRequests) {
          reject(new Error(`Worker error: ${error.message}`));
          this.pendingRequests.delete(id);
        }
      };

      // Send init message
      this.worker.postMessage({ id: 'init', type: 'init' });
    } catch (error) {
      console.warn('Failed to initialize worker:', error);
      this.worker = null;
    }
  }

  /**
   * Handle messages from web worker
   */
  private handleWorkerMessage(response: WorkerResponse): void {
    const { id, type, payload } = response;

    if (type === 'ready') {
      this.workerReady = true;
      return;
    }

    const pending = this.pendingRequests.get(id);
    if (!pending) return;

    switch (type) {
      case 'result':
        if (payload?.result) {
          pending.resolve(payload.result);
        }
        this.pendingRequests.delete(id);
        break;

      case 'progress':
        if (pending.onProgress && payload?.progress !== undefined && payload?.stage) {
          pending.onProgress(payload.progress, payload.stage);
        }
        break;

      case 'error':
        pending.reject(new Error(payload?.error || 'Unknown worker error'));
        this.pendingRequests.delete(id);
        break;

      case 'cancelled':
        pending.reject(new Error('Detection cancelled'));
        this.pendingRequests.delete(id);
        break;
    }
  }

  /**
   * Terminate the web worker
   */
  terminateWorker(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerReady = false;
      this.pendingRequests.clear();
    }
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
   * Detect PII using the full multi-pass pipeline
   * Provides higher accuracy (94%+) than basic detect()
   *
   * @param text - Text to analyze
   * @param options - Detection options
   * @returns Full detection result with entities and metadata
   */
  async detectWithPipeline(
    text: string,
    options: PipelineDetectionOptions = {},
  ): Promise<DetectionResult> {
    const { useWorker = false, onProgress, timeout = 30000 } = options;

    // Use worker for regex-only background processing
    if (useWorker && this.worker && this.workerReady) {
      return this.detectWithWorker(text, onProgress, timeout);
    }

    // Main thread pipeline execution
    await this.initializePipeline();
    if (!this.pipeline) {
      throw new Error('Pipeline initialization failed');
    }

    onProgress?.(10, 'Starting pipeline detection');

    const result = await this.pipeline.process(
      text,
      crypto.randomUUID(),
      'en',
    );

    onProgress?.(100, 'Detection complete');

    return result;
  }

  /**
   * Run detection in web worker (regex-only, non-blocking)
   */
  private detectWithWorker(
    text: string,
    onProgress?: ProgressCallback,
    timeout: number = 30000,
  ): Promise<DetectionResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const id = crypto.randomUUID();

      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Detection timeout after ${timeout}ms`));
      }, timeout);

      // Store pending request
      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        onProgress,
      });

      // Send detection request
      const request: WorkerRequest = {
        id,
        type: 'detect',
        payload: { text },
      };
      this.worker.postMessage(request);
    });
  }

  /**
   * Cancel a pending worker detection
   */
  cancelWorkerDetection(requestId: string): void {
    if (this.worker && this.pendingRequests.has(requestId)) {
      const request: WorkerRequest = {
        id: crypto.randomUUID(),
        type: 'cancel',
        payload: { documentId: requestId },
      };
      this.worker.postMessage(request);
    }
  }

  /**
   * Check if pipeline is initialized
   */
  isPipelineReady(): boolean {
    return this.pipeline !== null;
  }

  /**
   * Check if worker is ready
   */
  isWorkerReady(): boolean {
    return this.worker !== null && this.workerReady;
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
    originalText: string,
  ): Array<{ word: string; entity: string; score: number; start: number; end: number }> {
    if (results.length === 0) return [];

    type TokenEntity = { word: string; entity: string; score: number; start: number; end: number };
    const merged: TokenEntity[] = [];
    let current: TokenEntity | null = null;

    // Helper to finalize current entity
    const finalizeCurrent = (): void => {
      if (current) {
        current.word = originalText.substring(current.start, current.end);
        merged.push(current);
      }
    };

    // Helper to create new entity from token
    const createFromToken = (token: TokenEntity): TokenEntity => ({
      word: token.word,
      entity: token.entity,
      score: token.score,
      start: token.start,
      end: token.end,
    });

    for (const token of results) {
      const isInside = token.entity.startsWith('I-');
      const entityType = token.entity.replace(/^[BI]-/, '');

      // Check if this is a continuation of the same entity type
      const isContinuation = isInside && current &&
        current.entity.replace(/^[BI]-/, '') === entityType;

      if (isContinuation && current) {
        // Extend the current entity
        current.end = token.end;
        // Average the scores
        current.score = (current.score + token.score) / 2;
      } else {
        // Start new entity: beginning token, standalone token, different type, or no current
        finalizeCurrent();
        current = createFromToken(token);
      }
    }

    // Don't forget the last entity
    finalizeCurrent();

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
  private overlaps(
    a: { start: number; end: number },
    b: { start: number; end: number },
  ): boolean {
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
    // Cast to PIIMatch[] - ExtendedPIIMatch is structurally compatible (has all required fields)
    const byType = this.getStatistics(matches as unknown as PIIMatch[]);
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
