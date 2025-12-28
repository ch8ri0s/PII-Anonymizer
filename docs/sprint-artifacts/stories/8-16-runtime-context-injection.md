# Story 8.16: Runtime Context Injection

## Story

As a **PII detection caller**,
I want **to pass additional context at analysis time**,
So that **column headers, document metadata, and user hints can improve detection accuracy without modifying recognizer code**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.16 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | done |
| **Created** | 2025-12-25 |
| **Completed** | 2025-12-28 |
| **Priority** | P2 - Medium |
| **Reference** | Microsoft Presidio `context` parameter pattern |

## Acceptance Criteria

**Given** a document being processed
**When** the caller provides additional context (e.g., column headers, document type hints)
**Then** that context is used to boost entity confidence appropriately

**And** context can be passed at the API call level (not just configured globally)
**And** context words from the request are merged with recognizer-defined context words
**And** context injection works in both Electron and Browser pipelines
**And** existing behavior is unchanged when no context is provided
**And** context injection overhead is <5ms per document

## Technical Design

### Use Cases

1. **Structured Data (CSV/Excel):** Column headers indicate entity types
   - Column "Phone Number" → boost PHONE entities in that column
   - Column "Email Address" → boost EMAIL entities in that column

2. **Document Metadata:** External hints about document type
   - User tags document as "Invoice" → apply invoice-specific rules
   - OCR confidence scores → factor into entity confidence

3. **User Hints:** Manual assistance for difficult documents
   - User highlights a region as "contains addresses"
   - Previous corrections on similar documents

### Interface

```typescript
// shared/pii/types/detection.ts

/**
 * Runtime context passed at analysis time
 * Presidio pattern: context parameter on analyze()
 */
export interface RuntimeContext {
  /** Additional context words to merge with recognizer defaults */
  contextWords?: string[];

  /** Column headers (for structured data - CSV, Excel) */
  columnHeaders?: ColumnContext[];

  /** Document-level hints */
  documentHints?: DocumentHints;

  /** User-provided region hints */
  regionHints?: RegionHint[];
}

export interface ColumnContext {
  /** Column index or name */
  column: string | number;
  /** Entity type this column likely contains */
  entityType: string;
  /** Confidence boost for entities in this column (0.0-0.5) */
  confidenceBoost?: number;
}

export interface DocumentHints {
  /** Suggested document type (overrides auto-detection) */
  documentType?: string;
  /** Languages present in document */
  languages?: string[];
  /** OCR confidence (0.0-1.0, affects overall confidence) */
  ocrConfidence?: number;
}

export interface RegionHint {
  /** Start position in text */
  start: number;
  /** End position in text */
  end: number;
  /** Entity type expected in this region */
  expectedEntityType?: string;
  /** Context words specific to this region */
  contextWords?: string[];
}
```

### Detection Options Update

```typescript
// Update existing DetectionOptions interface

export interface DetectionOptions {
  /** Language for detection */
  language?: 'en' | 'fr' | 'de';

  /** Document type (if known) */
  documentType?: string;

  /** Runtime context injection (NEW - Presidio pattern) */
  context?: RuntimeContext;

  /** Enable/disable specific passes */
  enabledPasses?: string[];

  /** Confidence thresholds */
  thresholds?: ThresholdConfig;
}
```

### Context Application in Pipeline

```typescript
// src/pii/passes/ContextScoringPass.ts

class ContextScoringPass implements DetectionPass {
  async execute(text: string, entities: Entity[], context: PipelineContext): Promise<Entity[]> {
    const language = context.language || 'en';

    // Merge runtime context words with recognizer defaults
    const runtimeContext = context.options?.context;

    return entities.map(entity => {
      // 1. Get base context words for entity type
      let contextWords = getContextWords(entity.type, language);

      // 2. Merge runtime context words (Presidio pattern)
      if (runtimeContext?.contextWords) {
        contextWords = [...contextWords, ...runtimeContext.contextWords.map(word => ({
          word,
          weight: 0.8,  // Runtime context slightly lower weight than predefined
          polarity: 'positive' as const
        }))];
      }

      // 3. Apply column context boost
      if (runtimeContext?.columnHeaders) {
        const columnBoost = this.getColumnBoost(entity, runtimeContext.columnHeaders);
        if (columnBoost > 0) {
          entity = { ...entity, confidence: Math.min(1.0, entity.confidence + columnBoost) };
        }
      }

      // 4. Apply region hints
      if (runtimeContext?.regionHints) {
        const regionBoost = this.getRegionBoost(entity, runtimeContext.regionHints);
        if (regionBoost > 0) {
          entity = { ...entity, confidence: Math.min(1.0, entity.confidence + regionBoost) };
        }
      }

      // 5. Standard context enhancement
      return this.enhancer.enhance(entity, text, contextWords);
    });
  }

  private getColumnBoost(entity: Entity, columns: ColumnContext[]): number {
    // Match entity position to column, return boost if matching type
    // Implementation depends on how column positions are tracked
    return 0;
  }

  private getRegionBoost(entity: Entity, regions: RegionHint[]): number {
    for (const region of regions) {
      if (entity.start >= region.start && entity.end <= region.end) {
        if (region.expectedEntityType === entity.type) {
          return 0.2;  // Boost for expected type in region
        }
      }
    }
    return 0;
  }
}
```

### API Usage Example

```typescript
// Example: Processing a CSV with known column types

const result = await detectPII(csvText, {
  language: 'en',
  context: {
    columnHeaders: [
      { column: 0, entityType: 'PERSON_NAME', confidenceBoost: 0.3 },
      { column: 1, entityType: 'EMAIL', confidenceBoost: 0.3 },
      { column: 2, entityType: 'PHONE_NUMBER', confidenceBoost: 0.3 },
    ],
    contextWords: ['customer', 'contact', 'subscriber'],
  }
});

// Example: Document with OCR quality hints

const result = await detectPII(ocrText, {
  language: 'fr',
  context: {
    documentHints: {
      documentType: 'INVOICE',
      ocrConfidence: 0.85,
    },
    regionHints: [
      { start: 0, end: 200, expectedEntityType: 'ORGANIZATION' },  // Header area
      { start: 1500, end: 1800, contextWords: ['signature', 'signé'] },
    ]
  }
});
```

## Prerequisites

- Story 8.3 (Context Enhancement System)
- Story 8.4 (Pipeline Integration)

## Integration Points

- `ContextScoringPass` merges runtime context with static context words
- `DetectionOptions` extended with `context` parameter
- Both Electron and Browser pipelines support runtime context
- Column context useful for CSV/Excel processing
- Region hints useful for form processing

## Test Scenarios

1. **Basic context injection:** Runtime context words boost entity confidence
2. **Column headers:** Entities in typed columns get appropriate boost
3. **Region hints:** Entities in hinted regions get boost
4. **Merge behavior:** Runtime context merges with (not replaces) recognizer context
5. **No context:** Existing behavior unchanged when no context provided
6. **Performance:** Context injection adds <5ms overhead
7. **Cross-platform:** Same results in Electron and Browser

## Definition of Done

- [x] `RuntimeContext` interface defined in `src/types/detection.ts`
- [x] `PipelineConfig.context` parameter added
- [x] `ContextScoringPass` updated to merge runtime context
- [x] Column context boost logic implemented (with entity.metadata.column matching)
- [x] Region hint boost logic implemented (+0.2 boost for matching types)
- [x] Unit tests for context merging behavior (25 tests)
- [x] Integration tests with CSV column headers (13 tests)
- [x] Performance benchmark shows <5ms overhead (measured: ~0ms)
- [x] Browser pipeline supports runtime context (via PIIDetector.detectWithPipeline)
- [x] Documentation with usage examples (see below)

## Implementation Notes

### Files Modified

- `src/types/detection.ts` - Added RuntimeContext, ColumnContext, DocumentHints, RegionHint interfaces
- `src/pii/passes/ContextScoringPass.ts` - Added getColumnBoost(), getRegionBoost() methods and context merging
- `browser-app/src/processing/PIIDetector.ts` - Updated detectWithPipeline() to pass config

### Test Files Added

- `test/unit/pii/ContextScoringPass.runtimeContext.test.js` - 25 unit tests
- `test/integration/pii/RuntimeContextIntegration.test.js` - 13 integration tests

### Key Implementation Details

1. **Column Boost**: Entities with `metadata.column` matching a columnHeader get boost (0.0-0.5, default 0.2)
2. **Region Boost**: Entities within region bounds with matching type get +0.2 boost
3. **Context Words**: Runtime words merged with weight 0.8 (vs 1.0 for predefined)
4. **Metadata Tracking**: `context.metadata.runtimeContextBoosted` tracks boost counts by entity type

## Presidio Reference

This story implements the Presidio pattern of passing `context` at analysis time:

```python
# Presidio example
results = analyzer.analyze(
    text=text,
    language='en',
    context=['column: phone_number', 'document: invoice']
)
```

Our implementation extends this with structured context types (columns, regions, hints) rather than just string arrays, providing more precise control over confidence boosting.
