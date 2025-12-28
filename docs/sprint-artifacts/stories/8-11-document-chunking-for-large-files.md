# Story 8.11: Document Chunking for Large Files

## Story

As a **PII detection system**,
I want **large documents to be processed in chunks**,
So that **documents exceeding model context limits are handled reliably without memory issues or timeouts**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.11 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Done |
| **Created** | 2025-12-24 |
| **Started** | 2025-12-27 |
| **Completed** | 2025-12-27 |
| **Priority** | P0 - Critical |

## Acceptance Criteria

**Given** a document with 15,000 tokens
**When** ML detection runs
**Then** document is split into overlapping chunks of max 512 tokens
**And** each chunk is processed independently
**And** results are merged with correct offset adjustments
**And** no information is lost at chunk boundaries
**And** processing completes without memory errors or timeouts

**And** chunking is configurable (max chunk size, overlap size)
**And** chunking works identically in Electron and Browser
**And** small documents (<512 tokens) are processed without chunking (no overhead)

## Technical Design

### Files to Create/Modify

1. **Create:** `shared/pii/ml/TextChunker.ts` - Shared chunking utility
2. **Modify:** `src/pii/passes/HighRecallPass.ts` - Add chunking before ML inference
3. **Modify:** `browser-app/src/pii/BrowserHighRecallPass.ts` - Add chunking before ML inference
4. **Modify:** `browser-app/src/processing/PIIDetector.ts` - Add chunking (if used)

### Interface

```typescript
// shared/pii/ml/TextChunker.ts

export interface ChunkConfig {
  /** Maximum tokens per chunk (default: 512) */
  maxTokens: number;
  /** Overlap tokens between chunks (default: 50) */
  overlapTokens: number;
  /** Tokenizer function (optional, uses simple word count if not provided) */
  tokenizer?: (text: string) => number;
}

export interface TextChunk {
  text: string;
  start: number;      // Character position in original text
  end: number;        // Character position in original text
  chunkIndex: number; // 0-based chunk index
}

/**
 * Split text into overlapping chunks for ML model processing
 * 
 * @param text - Full document text
 * @param config - Chunking configuration
 * @returns Array of text chunks with position information
 */
export function chunkText(text: string, config?: Partial<ChunkConfig>): TextChunk[];

/**
 * Merge ML predictions from multiple chunks back into original document coordinates
 * 
 * @param chunkPredictions - Predictions per chunk: Array<{ chunkIndex: number, predictions: MLToken[] }>
 * @param chunks - Original chunks used for processing
 * @returns Merged predictions with correct offsets
 */
export function mergeChunkPredictions(
  chunkPredictions: Array<{ chunkIndex: number; predictions: MLToken[] }>,
  chunks: TextChunk[]
): MLToken[];
```

### Chunking Algorithm

```typescript
chunkText(text, config):
  1. Estimate tokens (simple: text.length / 4, or use tokenizer if provided)
  2. If estimated tokens <= maxTokens:
     - Return single chunk: [{ text, start: 0, end: text.length, chunkIndex: 0 }]
  
  3. Split into sentences (preserve sentence boundaries)
  4. Group sentences into chunks:
     - Current chunk: []
     - Current tokens: 0
     - For each sentence:
       - If current tokens + sentence tokens > maxTokens:
         - Finalize current chunk
         - Start new chunk with overlap (last N sentences from previous)
       - Add sentence to current chunk
       - current tokens += sentence tokens
  
  5. Return chunks with position information
```

### Merging Algorithm

```typescript
mergeChunkPredictions(chunkPredictions, chunks):
  1. For each chunk's predictions:
     - Adjust offsets: prediction.start += chunk.start
     - Adjust offsets: prediction.end += chunk.start
  
  2. Deduplicate overlapping predictions (same entity at same position):
     - Keep prediction with highest confidence
     - Remove duplicates within overlap regions
  
  3. Return merged predictions
```

### Default Configuration

```typescript
const DEFAULT_CONFIG: ChunkConfig = {
  maxTokens: 512,        // Safe for most NER models
  overlapTokens: 50,     // Prevents boundary issues
  tokenizer: undefined,  // Use simple estimation
};
```

### Integration Points

**HighRecallPass (`runMLDetection`):**
```typescript
private async runMLDetection(text: string): Promise<Entity[]> {
  if (!this.nerPipeline) return [];

  try {
    // NEW: Chunk large documents
    const chunks = chunkText(text, { maxTokens: 512, overlapTokens: 50 });
    
    // Process chunks in parallel (or sequentially for memory efficiency)
    const chunkResults = await Promise.all(
      chunks.map(async (chunk, index) => {
        const predictions = await this.nerPipeline(chunk.text);
        return { chunkIndex: index, predictions };
      })
    );
    
    // Merge predictions with offset adjustment
    const mergedPredictions = mergeChunkPredictions(chunkResults, chunks);
    
    // Continue with existing entity mapping logic...
    const entities: Entity[] = [];
    for (const pred of mergedPredictions) {
      // ... existing code ...
    }
    
    return entities;
  } catch (error) {
    console.error('ML detection error:', error);
    return [];
  }
}
```

## Prerequisites

- Story 8.10 (Subword Token Merging) - Chunking works with merged tokens

## Integration Points

- Used by `HighRecallPass` (Electron)
- Used by `BrowserHighRecallPass` (Browser)
- Works with `mergeSubwordTokens` from Story 8.10
- Chunking happens before ML inference, merging happens after

## Test Scenarios

1. **Small document (<512 tokens):** No chunking, single inference call
2. **Large document (>2000 tokens):** Split into multiple chunks
3. **Overlap handling:** Entities spanning chunk boundaries are detected correctly
4. **Offset adjustment:** Predictions have correct positions in original document
5. **Deduplication:** Overlapping predictions in overlap regions are deduplicated
6. **Sentence boundaries:** Chunks respect sentence boundaries (no mid-sentence splits)
7. **Empty chunks:** Handled gracefully
8. **Very large document (50K tokens):** Processes without memory issues
9. **Performance:** Chunking overhead <5% for small documents
10. **Cross-platform:** Electron and Browser produce identical chunking

## Definition of Done

- [x] `shared/pii/ml/TextChunker.ts` created with chunking and merging logic
- [x] `HighRecallPass.ts` updated with chunking before ML inference
- [x] `BrowserHighRecallPass.ts` updated with chunking
- [x] Unit tests in `test/unit/pii/ml/TextChunker.test.js` (44 tests passing)
- [x] Integration tests with large documents (>10K tokens) - see real-world scenarios tests
- [x] Performance tests verify no significant overhead for small documents
- [x] Memory tests verify no leaks with very large documents
- [x] All test scenarios pass (44/44)
- [x] TypeScript compiles without errors
- [x] Configuration is documented and tunable

## Precision/Recall Impact Testing

### Baseline Comparison
Uses shared accuracy utilities from `shared/test/accuracy.ts`:

```typescript
import { calculatePrecisionRecall, aggregateMetrics } from '@shared-test/accuracy';

// Test with documents of varying sizes
const smallDocMetrics = calculatePrecisionRecall(smallDocDetected, smallDocExpected);
const largeDocMetrics = calculatePrecisionRecall(largeDocDetected, largeDocExpected);

// Large doc should have same quality as small doc
expect(largeDocMetrics.f1).toBeCloseTo(smallDocMetrics.f1, 0.02);
```

### Regression Prevention
- **Baseline metrics:** See `test/baselines/epic8-before.json`
- **Chunking constraint:** No quality degradation for chunked documents
- **Boundary handling:** Entities spanning chunk boundaries must be detected
- **Regression threshold:** Large doc F1 within 2% of small doc F1

### ML-Specific Test Scenarios
| Scenario | Input Size | Expected Result |
|----------|------------|-----------------|
| Small doc (no chunking) | <512 tokens | Single inference, baseline quality |
| Medium doc | 1000 tokens | 2 chunks, same quality as small |
| Large doc | 5000 tokens | Multiple chunks, entities at boundaries detected |
| Very large doc | 50K tokens | Completes without timeout, quality maintained |
| Entity at boundary | Name spans chunk overlap | Single merged entity (not duplicated) |

### Cross-Platform Validation
- Run large document fixtures through both platforms
- Assert identical chunk count and entity detection
- Memory usage: Browser should not exceed 500MB for 50K token doc

## Impact

**Before:** Large documents may fail or timeout
**After:** Documents of any size can be processed reliably
**Quality Improvement:** Enables processing of large reports, contracts, and batch files






