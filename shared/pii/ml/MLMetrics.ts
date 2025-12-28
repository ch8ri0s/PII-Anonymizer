/**
 * ML Performance Monitoring (Story 8.14)
 *
 * Provides metrics collection and aggregation for ML inference performance.
 * Records inference time, text length, entities detected, and more.
 * Privacy-safe: no PII content, only metadata.
 *
 * @module shared/pii/ml/MLMetrics
 */

/**
 * Individual ML inference metrics
 */
export interface MLInferenceMetrics {
  /** Inference duration in milliseconds */
  durationMs: number;
  /** Input text length in characters */
  textLength: number;
  /** Estimated tokens processed */
  tokensProcessed: number;
  /** Number of entities detected */
  entitiesDetected: number;
  /** Document type (if known) */
  documentType?: string;
  /** Document language */
  language?: string;
  /** Timestamp when inference completed */
  timestamp: number;
  /** Platform (electron/browser) */
  platform: 'electron' | 'browser';
  /** Model name/identifier */
  modelName: string;
  /** Whether chunking was used */
  chunked: boolean;
  /** Number of chunks (if chunked) */
  chunkCount?: number;
  /** Memory usage in MB (if available) */
  memoryUsageMB?: number;
  /** Whether inference failed */
  failed?: boolean;
  /** Retry attempts (if any) */
  retryAttempts?: number;
}

/**
 * Aggregated metrics across multiple inferences
 */
export interface AggregatedMetrics {
  /** Total number of inferences */
  totalInferences: number;
  /** Number of failed inferences */
  failedInferences: number;
  /** Average inference time (ms) */
  avgInferenceTimeMs: number;
  /** P50 (median) inference time (ms) */
  p50InferenceTimeMs: number;
  /** P95 inference time (ms) */
  p95InferenceTimeMs: number;
  /** P99 inference time (ms) */
  p99InferenceTimeMs: number;
  /** Minimum inference time (ms) */
  minInferenceTimeMs: number;
  /** Maximum inference time (ms) */
  maxInferenceTimeMs: number;
  /** Average text length (characters) */
  avgTextLength: number;
  /** Average tokens processed */
  avgTokensProcessed: number;
  /** Average entities per document */
  avgEntitiesPerDocument: number;
  /** Total entities detected */
  totalEntitiesDetected: number;
  /** Metrics by document type */
  byDocumentType: Record<string, Omit<AggregatedMetrics, 'byDocumentType' | 'byLanguage'>>;
  /** Metrics by language */
  byLanguage: Record<string, Omit<AggregatedMetrics, 'byDocumentType' | 'byLanguage'>>;
}

/**
 * Configuration for metrics collection
 */
export interface MetricsConfig {
  /** Maximum number of inferences to keep (default: 1000) */
  maxRetention: number;
  /** Whether monitoring is enabled (default: true) */
  enabled: boolean;
}

/**
 * Default metrics configuration
 */
export const DEFAULT_METRICS_CONFIG: MetricsConfig = {
  maxRetention: 1000,
  enabled: true,
};

/**
 * MLMetricsCollector class for collecting and aggregating ML performance metrics
 */
export class MLMetricsCollector {
  private metrics: MLInferenceMetrics[] = [];
  private config: MetricsConfig;

  constructor(config?: Partial<MetricsConfig>) {
    this.config = { ...DEFAULT_METRICS_CONFIG, ...config };
  }

  /**
   * Record a single inference's metrics
   */
  record(metrics: MLInferenceMetrics): void {
    if (!this.config.enabled) return;

    this.metrics.push(metrics);

    // Prune old metrics if exceeding retention limit
    if (this.metrics.length > this.config.maxRetention) {
      this.metrics = this.metrics.slice(-this.config.maxRetention);
    }
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): readonly MLInferenceMetrics[] {
    return this.metrics;
  }

  /**
   * Get the number of recorded metrics
   */
  getCount(): number {
    return this.metrics.length;
  }

  /**
   * Get aggregated metrics
   */
  getAggregated(): AggregatedMetrics {
    return aggregateMetrics(this.metrics);
  }

  /**
   * Export metrics as JSON string
   */
  export(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      config: this.config,
      metricsCount: this.metrics.length,
      aggregated: this.getAggregated(),
      raw: this.metrics,
    }, null, 2);
  }

  /**
   * Clear all recorded metrics
   */
  clear(): void {
    this.metrics = [];
  }

  /**
   * Update configuration
   */
  configure(config: Partial<MetricsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<MetricsConfig> {
    return { ...this.config };
  }
}

// Global singleton collector for convenience
let globalCollector: MLMetricsCollector | null = null;

/**
 * Get the global metrics collector
 */
export function getGlobalCollector(): MLMetricsCollector {
  if (!globalCollector) {
    globalCollector = new MLMetricsCollector();
  }
  return globalCollector;
}

/**
 * Record ML inference metrics to the global collector
 */
export function recordMLMetrics(metrics: MLInferenceMetrics): void {
  getGlobalCollector().record(metrics);
}

/**
 * Get aggregated metrics from the global collector
 */
export function getAggregatedMetrics(): AggregatedMetrics {
  return getGlobalCollector().getAggregated();
}

/**
 * Export metrics from the global collector as JSON
 */
export function exportMetrics(): string {
  return getGlobalCollector().export();
}

/**
 * Clear all metrics from the global collector
 */
export function clearMetrics(): void {
  getGlobalCollector().clear();
}

/**
 * Get the number of recorded metrics
 */
export function getMetricsCount(): number {
  return getGlobalCollector().getCount();
}

/**
 * Calculate percentile from sorted array
 */
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.ceil((p / 100) * sortedValues.length) - 1;
  return sortedValues[Math.max(0, Math.min(index, sortedValues.length - 1))];
}

/**
 * Basic aggregation without grouping (used internally to avoid recursion)
 */
type BasicAggregatedMetrics = Omit<AggregatedMetrics, 'byDocumentType' | 'byLanguage'>;

function aggregateBasic(metrics: readonly MLInferenceMetrics[]): BasicAggregatedMetrics {
  const empty: BasicAggregatedMetrics = {
    totalInferences: 0,
    failedInferences: 0,
    avgInferenceTimeMs: 0,
    p50InferenceTimeMs: 0,
    p95InferenceTimeMs: 0,
    p99InferenceTimeMs: 0,
    minInferenceTimeMs: 0,
    maxInferenceTimeMs: 0,
    avgTextLength: 0,
    avgTokensProcessed: 0,
    avgEntitiesPerDocument: 0,
    totalEntitiesDetected: 0,
  };

  if (metrics.length === 0) return empty;

  const durations = metrics.map((m) => m.durationMs).sort((a, b) => a - b);
  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const totalTextLength = metrics.reduce((sum, m) => sum + m.textLength, 0);
  const totalTokens = metrics.reduce((sum, m) => sum + m.tokensProcessed, 0);
  const totalEntities = metrics.reduce((sum, m) => sum + m.entitiesDetected, 0);
  const failedCount = metrics.filter((m) => m.failed).length;

  return {
    totalInferences: metrics.length,
    failedInferences: failedCount,
    avgInferenceTimeMs: totalDuration / metrics.length,
    p50InferenceTimeMs: percentile(durations, 50),
    p95InferenceTimeMs: percentile(durations, 95),
    p99InferenceTimeMs: percentile(durations, 99),
    minInferenceTimeMs: durations[0],
    maxInferenceTimeMs: durations[durations.length - 1],
    avgTextLength: totalTextLength / metrics.length,
    avgTokensProcessed: totalTokens / metrics.length,
    avgEntitiesPerDocument: totalEntities / metrics.length,
    totalEntitiesDetected: totalEntities,
  };
}

/**
 * Aggregate metrics from an array of inference metrics
 */
export function aggregateMetrics(metrics: readonly MLInferenceMetrics[]): AggregatedMetrics {
  const basic = aggregateBasic(metrics);

  const result: AggregatedMetrics = {
    ...basic,
    byDocumentType: {},
    byLanguage: {},
  };

  if (metrics.length === 0) return result;

  // Group by document type
  const byDocType = new Map<string, MLInferenceMetrics[]>();
  for (const m of metrics) {
    const key = m.documentType || 'unknown';
    if (!byDocType.has(key)) byDocType.set(key, []);
    byDocType.get(key)!.push(m);
  }
  for (const [docType, docMetrics] of byDocType) {
    result.byDocumentType[docType] = aggregateBasic(docMetrics);
  }

  // Group by language
  const byLang = new Map<string, MLInferenceMetrics[]>();
  for (const m of metrics) {
    const key = m.language || 'unknown';
    if (!byLang.has(key)) byLang.set(key, []);
    byLang.get(key)!.push(m);
  }
  for (const [lang, langMetrics] of byLang) {
    result.byLanguage[lang] = aggregateBasic(langMetrics);
  }

  return result;
}

/**
 * Create a metrics object from inference parameters
 * Helper function for consistent metrics creation
 */
export function createInferenceMetrics(params: {
  startTime: number;
  endTime: number;
  textLength: number;
  entitiesDetected: number;
  platform: 'electron' | 'browser';
  modelName: string;
  chunked: boolean;
  chunkCount?: number;
  documentType?: string;
  language?: string;
  memoryUsageMB?: number;
  failed?: boolean;
  retryAttempts?: number;
}): MLInferenceMetrics {
  return {
    durationMs: params.endTime - params.startTime,
    textLength: params.textLength,
    tokensProcessed: Math.ceil(params.textLength / 4), // Rough estimate: 4 chars per token
    entitiesDetected: params.entitiesDetected,
    documentType: params.documentType,
    language: params.language,
    timestamp: Date.now(),
    platform: params.platform,
    modelName: params.modelName,
    chunked: params.chunked,
    chunkCount: params.chunkCount,
    memoryUsageMB: params.memoryUsageMB,
    failed: params.failed,
    retryAttempts: params.retryAttempts,
  };
}

/**
 * Create a configured MLMetricsCollector instance
 */
export function createMLMetricsCollector(
  config?: Partial<MetricsConfig>,
): MLMetricsCollector {
  return new MLMetricsCollector(config);
}
