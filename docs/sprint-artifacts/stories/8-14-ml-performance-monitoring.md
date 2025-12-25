# Story 8.14: ML Performance Monitoring

## Story

As a **system maintainer**,
I want **metrics on ML inference performance**,
So that **I can identify bottlenecks, track improvements, and optimize the detection pipeline**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.14 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Backlog |
| **Created** | 2025-12-24 |
| **Priority** | P1 - High |

## Acceptance Criteria

**Given** ML inference runs on a document
**When** performance monitoring is enabled
**Then** metrics are recorded:
- Inference time (milliseconds)
- Text length (characters)
- Tokens processed (estimated)
- Entities detected (count)
- Memory usage (if available)

**And** metrics are aggregated per document type and language
**And** metrics are exportable for analysis
**And** metrics don't contain PII content
**And** monitoring overhead is <1% of inference time

## Technical Design

### Files to Create/Modify

1. **Create:** `shared/pii/ml/MLMetrics.ts` - Metrics collection and aggregation
2. **Modify:** `src/pii/passes/HighRecallPass.ts` - Record metrics
3. **Modify:** `browser-app/src/pii/BrowserHighRecallPass.ts` - Record metrics
4. **Modify:** `browser-app/src/model/ModelManager.ts` - Record inference metrics

### Interface

```typescript
// shared/pii/ml/MLMetrics.ts

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
  /** Timestamp */
  timestamp: number;
  /** Platform (electron/browser) */
  platform: 'electron' | 'browser';
  /** Model name */
  modelName: string;
  /** Whether chunking was used */
  chunked: boolean;
  /** Number of chunks (if chunked) */
  chunkCount?: number;
  /** Memory usage in MB (if available) */
  memoryUsageMB?: number;
}

export interface AggregatedMetrics {
  /** Total inferences */
  totalInferences: number;
  /** Average inference time (ms) */
  avgInferenceTimeMs: number;
  /** P50 inference time (ms) */
  p50InferenceTimeMs: number;
  /** P95 inference time (ms) */
  p95InferenceTimeMs: number;
  /** P99 inference time (ms) */
  p99InferenceTimeMs: number;
  /** Average text length */
  avgTextLength: number;
  /** Average entities per document */
  avgEntitiesPerDocument: number;
  /** Metrics by document type */
  byDocumentType: Record<string, AggregatedMetrics>;
  /** Metrics by language */
  byLanguage: Record<string, AggregatedMetrics>;
}

/**
 * Record ML inference metrics
 */
export function recordMLMetrics(metrics: MLInferenceMetrics): void;

/**
 * Get aggregated metrics
 */
export function getAggregatedMetrics(): AggregatedMetrics;

/**
 * Export metrics to JSON
 */
export function exportMetrics(): string;

/**
 * Clear all metrics
 */
export function clearMetrics(): void;
```

### Metrics Collection

```typescript
// In HighRecallPass.runMLDetection
private async runMLDetection(text: string): Promise<Entity[]> {
  if (!this.nerPipeline) return [];

  const startTime = performance.now();
  const startMemory = performance.memory?.usedJSHeapSize; // Browser only

  try {
    // ... existing inference code ...
    const predictions = await this.nerPipeline(text);
    
    const endTime = performance.now();
    const endMemory = performance.memory?.usedJSHeapSize;
    const durationMs = endTime - startTime;

    // Record metrics
    recordMLMetrics({
      durationMs,
      textLength: text.length,
      tokensProcessed: Math.ceil(text.length / 4), // Rough estimate
      entitiesDetected: entities.length,
      documentType: context.documentType,
      language: context.language,
      timestamp: Date.now(),
      platform: 'electron',
      modelName: MODEL_NAME,
      chunked: chunks.length > 1,
      chunkCount: chunks.length,
      memoryUsageMB: endMemory ? (endMemory - startMemory) / 1024 / 1024 : undefined,
    });

    return entities;
  } catch (error) {
    // Record failed inference
    recordMLMetrics({
      durationMs: performance.now() - startTime,
      textLength: text.length,
      tokensProcessed: Math.ceil(text.length / 4),
      entitiesDetected: 0,
      timestamp: Date.now(),
      platform: 'electron',
      modelName: MODEL_NAME,
      // ... error flag could be added ...
    });
    throw error;
  }
}
```

### Storage

- **Electron:** Store in app data directory (`app.getPath('userData')/ml-metrics.json`)
- **Browser:** Store in IndexedDB or localStorage
- **Retention:** Keep last 1000 inferences (configurable)
- **Privacy:** No PII content, only metadata

## Prerequisites

- None (can run independently)

## Integration Points

- Used by `HighRecallPass` (Electron)
- Used by `BrowserHighRecallPass` (Browser)
- Metrics can be exported for analysis
- Can be integrated with Accuracy Dashboard (Epic 5)

## Test Scenarios

1. **Metrics recorded:** Inference metrics are captured correctly
2. **Aggregation:** Metrics are aggregated by document type and language
3. **Percentiles:** P50, P95, P99 calculated correctly
4. **Export:** Metrics export to JSON format
5. **Retention:** Old metrics are pruned (keep last 1000)
6. **Privacy:** No PII content in metrics
7. **Performance:** Overhead <1% of inference time
8. **Memory tracking:** Memory usage recorded when available (browser)
9. **Chunking metrics:** Chunked documents tracked separately
10. **Cross-platform:** Both platforms record compatible metrics

## Definition of Done

- [ ] `shared/pii/ml/MLMetrics.ts` created with metrics collection
- [ ] `HighRecallPass.ts` updated to record metrics
- [ ] `BrowserHighRecallPass.ts` updated to record metrics
- [ ] Metrics storage implemented (Electron + Browser)
- [ ] Aggregation logic implemented
- [ ] Export functionality implemented
- [ ] Unit tests in `test/unit/pii/ml/MLMetrics.test.ts`
- [ ] Performance tests verify <1% overhead
- [ ] Privacy verified (no PII in metrics)
- [ ] TypeScript compiles without errors
- [ ] Metrics format documented

## Precision/Recall Impact Testing

### Baseline Comparison
Uses shared accuracy utilities from `shared/test/accuracy.ts`:

```typescript
import { calculatePrecisionRecall, aggregateMetrics } from '@shared-test/accuracy';

// Monitoring should have zero impact on quality
const withMonitoringMetrics = calculatePrecisionRecall(monitoredDetected, expected);
const baselineMetrics = calculatePrecisionRecall(baselineDetected, expected);

// Quality must be identical
expect(withMonitoringMetrics.f1).toBe(baselineMetrics.f1);
```

### Regression Prevention
- **Baseline metrics:** See `test/baselines/epic8-before.json`
- **Monitoring overhead:** <1% of inference time (no quality impact)
- **Memory constraint:** Metrics storage does not affect detection quality
- **Regression threshold:** Zero precision/recall delta with monitoring enabled

### ML-Specific Test Scenarios
| Scenario | Metric Captured | Quality Assertion |
|----------|-----------------|-------------------|
| Normal inference | durationMs, entitiesDetected | F1 matches baseline |
| Large document | tokensProcessed, chunked: true | Same quality as small doc |
| Failed inference | error logged, entitiesDetected: 0 | No false positives |
| Multi-language batch | byLanguage aggregation | Per-language F1 matches targets |
| Memory-constrained | memoryUsageMB recorded | Quality maintained under pressure |

### Cross-Platform Validation
- Metrics format identical across Electron and Browser
- Aggregated quality metrics can be compared cross-platform
- Performance correlation: slower inference should not mean lower quality

### Metrics-Quality Correlation
```typescript
// Test that metrics accurately reflect quality
const metrics = getAggregatedMetrics();
const qualityMetrics = aggregateMetrics(allDocumentMetrics);

// High entity count should correlate with high recall
// This validates metrics are tracking real detection quality
```

## Impact

**Before:** No visibility into ML performance
**After:** Comprehensive metrics for optimization and monitoring
**Quality Improvement:** Enables data-driven performance improvements

