# Story 8.10: Subword Token Merging for ML Detection

## Story

As a **PII detection system**,
I want **consecutive ML model tokens (B-XXX, I-XXX) to be merged into complete entities**,
So that **"Hans Müller" is detected as a single PERSON_NAME entity instead of fragmented ["Hans", "Müller"]**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.10 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Done |
| **Created** | 2025-12-24 |
| **Completed** | 2025-12-27 |
| **Priority** | P0 - Critical |

## Acceptance Criteria

**Given** ML model detects `["B-PER", "I-PER", "I-PER"]` for "Hans Müller"
**When** subword token merging runs
**Then** tokens are merged into a single entity: `{ text: "Hans Müller", type: "PERSON_NAME", start: 0, end: 11 }`

**And** merging works for all entity types (PER, LOC, ORG, MISC)
**And** merged entity confidence is averaged from component tokens
**And** merging works identically in Electron and Browser
**And** very short entities (<2 characters) are filtered out as noise
**And** merged entity text matches original document text (not tokenizer output)

## Technical Design

### Files to Create/Modify

1. **Create:** `shared/pii/ml/SubwordTokenMerger.ts` - Shared utility for both Electron and Browser
2. **Modify:** `src/pii/passes/HighRecallPass.ts` - Use merger in Electron
3. **Modify:** `browser-app/src/pii/BrowserHighRecallPass.ts` - Use shared merger (replace local implementation)
4. **Modify:** `browser-app/src/processing/PIIDetector.ts` - Use shared merger

### Interface

```typescript
// shared/pii/ml/SubwordTokenMerger.ts

/**
 * ML model token prediction (BIO tagging scheme)
 */
export interface MLToken {
  word: string;
  entity: string;  // B-PER, I-PER, B-LOC, etc.
  score: number;
  start: number;
  end: number;
}

/**
 * Merged entity result
 */
export interface MergedEntity {
  word: string;        // Full merged text from original document
  entity: string;     // Entity type without B-/I- prefix
  score: number;       // Averaged confidence
  start: number;       // Start position in original text
  end: number;         // End position in original text
}

/**
 * Merge consecutive subword tokens into complete entities
 * 
 * HuggingFace NER models use BIO tagging:
 * - B-XXX: Beginning of entity
 * - I-XXX: Inside/continuation of entity
 * - O: Outside (not an entity)
 * 
 * @param tokens - Raw ML model predictions
 * @param originalText - Original document text (for accurate span extraction)
 * @param minLength - Minimum entity length to keep (default: 2)
 * @returns Merged entities
 */
export function mergeSubwordTokens(
  tokens: MLToken[],
  originalText: string,
  minLength: number = 2
): MergedEntity[];
```

### Algorithm

```typescript
mergeSubwordTokens(tokens, originalText, minLength):
  1. Initialize:
     - merged: MergedEntity[] = []
     - current: MergedEntity | null = null
  
  2. For each token in tokens:
     a. Extract entity type: entityType = token.entity.replace(/^[BI]-/, '')
     b. Check if inside token: isInside = token.entity.startsWith('I-')
     
     c. If current exists AND isInside AND same type:
        - Extend current entity:
          * current.end = token.end
          * current.score = average(current.score, token.score)
     d. Else:
        - Finalize current (if exists) → add to merged
        - Start new entity:
          * current = {
              entity: entityType,
              start: token.start,
              end: token.end,
              score: token.score
            }
  
  3. Finalize last entity (if exists)
  
  4. Extract text from originalText for each merged entity:
     - merged[i].word = originalText.substring(merged[i].start, merged[i].end)
  
  5. Filter by minLength:
     - return merged.filter(e => e.word.length >= minLength)
```

### Example

**Input:**
```typescript
tokens = [
  { word: 'Hans', entity: 'B-PER', score: 0.95, start: 0, end: 4 },
  { word: 'Müller', entity: 'I-PER', score: 0.92, start: 5, end: 11 },
  { word: 'Zürich', entity: 'B-LOC', score: 0.88, start: 15, end: 21 }
]
originalText = "Hans Müller in Zürich"
```

**Output:**
```typescript
[
  { word: 'Hans Müller', entity: 'PER', score: 0.935, start: 0, end: 11 },
  { word: 'Zürich', entity: 'LOC', score: 0.88, start: 15, end: 21 }
]
```

### Integration Points

**Electron (`HighRecallPass.ts`):**
```typescript
private async runMLDetection(text: string): Promise<Entity[]> {
  if (!this.nerPipeline) return [];

  try {
    const predictions = await this.nerPipeline(text);
    
    // NEW: Merge subword tokens
    const merged = mergeSubwordTokens(predictions, text);
    
    const entities: Entity[] = [];
    for (const pred of merged) {
      if (pred.score < this.mlThreshold) continue;
      const type = this.mapMLType(pred.entity);
      if (type === 'UNKNOWN') continue;
      
      entities.push({
        id: generateEntityId(),
        type,
        text: pred.word,  // Now full merged text
        start: pred.start,
        end: pred.end,
        confidence: pred.score,
        source: 'ML',
        metadata: {
          mlEntityGroup: pred.entity,
          mlScore: pred.score,
        },
      });
    }
    
    return entities;
  } catch (error) {
    console.error('ML detection error:', error);
    return [];
  }
}
```

**Browser (`BrowserHighRecallPass.ts`):**
- Replace local `mergeSubwordTokens` with shared version
- Same integration pattern as Electron

## Prerequisites

- None (can run independently)

## Integration Points

- Used by `HighRecallPass` (Electron)
- Used by `BrowserHighRecallPass` (Browser)
- Used by `PIIDetector` (Browser legacy path)
- Shared module ensures consistency across platforms

## Test Scenarios

1. **Simple merge:** `["B-PER", "I-PER"]` → single PERSON_NAME entity
2. **Multi-token merge:** `["B-PER", "I-PER", "I-PER", "I-PER"]` → single entity
3. **Different types:** `["B-PER", "I-PER", "B-LOC"]` → two separate entities
4. **Standalone token:** `["B-PER"]` (no I- tokens) → single entity
5. **Confidence averaging:** Scores are averaged correctly
6. **Text extraction:** Merged text matches original document substring
7. **Min length filter:** Entities <2 chars are filtered out
8. **Edge case:** Empty tokens array returns empty array
9. **Edge case:** Tokens with invalid positions are handled gracefully
10. **Cross-platform:** Electron and Browser produce identical results

## Definition of Done

- [x] `shared/pii/ml/SubwordTokenMerger.ts` created with comprehensive tests
- [x] `HighRecallPass.ts` updated to use shared merger
- [x] `BrowserHighRecallPass.ts` updated to use shared merger (removes duplication)
- [x] `PIIDetector.ts` updated to use shared merger
- [x] Unit tests in `test/unit/pii/ml/SubwordTokenMerger.test.js` (37 tests)
- [x] Integration tests verify merged entities in both Electron and Browser
- [x] All test scenarios pass
- [x] TypeScript compiles without errors
- [x] No regressions in existing ML detection tests (1555 Electron + 914 Browser)
- [x] Performance impact is negligible (<1ms per document)

## Implementation Summary

**Files Created:**
- `shared/pii/ml/SubwordTokenMerger.ts` - Shared utility with `mergeSubwordTokens()`, `SubwordTokenMerger` class
- `shared/pii/ml/index.ts` - Module exports
- `test/unit/pii/ml/SubwordTokenMerger.test.js` - 37 comprehensive tests

**Files Modified:**
- `shared/pii/index.ts` - Added ml module exports
- `src/pii/passes/HighRecallPass.ts` - Integrated shared merger
- `browser-app/src/pii/BrowserHighRecallPass.ts` - Integrated shared merger
- `browser-app/src/processing/PIIDetector.ts` - Replaced local implementation with shared merger

**Features:**
- Merges consecutive B-XXX/I-XXX tokens into single entities
- Calculates averaged confidence scores
- Supports configurable minLength and maxGap
- Handles both `entity` and `entity_group` token formats
- Works identically in Electron and Browser

## Precision/Recall Impact Testing

### Baseline Comparison
Uses shared accuracy utilities from `shared/test/accuracy.ts`:

```typescript
import { calculatePrecisionRecall, meetsThresholds } from '@shared-test/accuracy';
import groundTruth from 'test/fixtures/piiAnnotated/realistic-ground-truth.json';

// Compare against baseline (test/baselines/epic8-before.json)
const metrics = calculatePrecisionRecall(detected, expected);
const result = meetsThresholds(metrics, {
  precision: 0.90,  // Target: no regression from baseline
  recall: 0.90,
});
```

### Regression Prevention
- **Baseline metrics:** See `test/baselines/epic8-before.json`
- **Pre-change:** Precision 100%, Recall 54.2% (rule-based only)
- **Expected improvement:** PERSON_NAME recall +5-10% (multi-word names now merged)
- **Regression threshold:** No precision/recall drop for any entity type

### ML-Specific Test Scenarios
| Scenario | Input | Expected Result |
|----------|-------|-----------------|
| Multi-word names | "Hans Müller" | Single PERSON_NAME entity, not ["Hans", "Müller"] |
| Compound locations | "Zürich Hauptbahnhof" | Single LOCATION entity |
| Organization names | "Schweizerische Bundesbahnen SBB" | Single ORGANIZATION entity |
| Mixed entity adjacency | "Hans Müller, Zürich" | Separate PERSON_NAME and LOCATION |

### Cross-Platform Validation
- Run identical fixtures through Electron (Mocha) and Browser (Vitest)
- Use `aggregateMetrics` to compare platform-specific results
- Assert: `electronMetrics.f1 === browserMetrics.f1` (within tolerance)

## Impact

**Before:** Electron produces fragmented entities, inconsistent with Browser
**After:** Both platforms produce identical, complete entities
**Quality Improvement:** +5-10% accuracy for multi-word names and locations






