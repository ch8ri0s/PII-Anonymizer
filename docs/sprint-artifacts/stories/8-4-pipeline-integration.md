# Story 8.4: Pipeline Integration

## Story

As a **detection pipeline**,
I want **DenyList filtering and Context Enhancement integrated**,
So that **improved accuracy is applied to all document processing**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.4 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Backlog |
| **Created** | 2025-12-23 |

## Acceptance Criteria

**Given** document processing request
**When** HighRecallPass completes
**Then** DenyList filters false positives before next pass

**And** ContextScoringPass uses ContextEnhancer for confidence adjustment
**And** both Electron and Browser pipelines have identical logic
**And** existing tests continue passing
**And** processing time increase is <10%
**And** canonical pass ordering is documented and enforced (Normalization → HighRecall → DenyList → FormatValidation → ContextScoring → DocumentRules → Consolidation)
**And** Epic 8 features (DenyList + ContextEnhancement) can be toggled via config flag for A/B testing
**And** DetectionResult.metadata includes counts of filtered/boosted entities and per-pass timing

## Technical Design

### Files to Modify

1. `src/pii/passes/HighRecallPass.ts` (Electron)
2. `src/pii/passes/ContextScoringPass.ts` (Electron)
3. `browser-app/src/pii/BrowserHighRecallPass.ts` (Browser)

### HighRecallPass Integration

```typescript
// src/pii/passes/HighRecallPass.ts

import { DenyList } from '@shared/pii/context/DenyList';

class HighRecallPass implements DetectionPass {
  async execute(context: DetectionContext): Promise<DetectionResult> {
    // Existing detection logic...
    let entities = await this.detectEntities(context.text);

    // NEW: Filter false positives
    const language = context.language || 'en';
    entities = entities.filter(entity =>
      !DenyList.isDenied(entity.text, entity.type, language)
    );

    return { entities, metadata: { ... } };
  }
}
```

### ContextScoringPass Integration

```typescript
// src/pii/passes/ContextScoringPass.ts

import { ContextEnhancer } from '@shared/pii/context/ContextEnhancer';
import { getContextWords } from '@shared/pii/context/ContextWords';

class ContextScoringPass implements DetectionPass {
  private enhancer = new ContextEnhancer();

  async execute(context: DetectionContext): Promise<DetectionResult> {
    const language = context.language || 'en';
    const text = context.text;

    // Enhanced scoring with context
    const enhancedEntities = context.entities.map(entity => {
      const contextWords = getContextWords(entity.type, language);
      if (contextWords.length > 0) {
        return this.enhancer.enhance(entity, text, contextWords);
      }
      return entity;
    });

    // Existing scoring logic continues...
    return { entities: enhancedEntities, metadata: { ... } };
  }
}
```

### BrowserHighRecallPass Integration

```typescript
// browser-app/src/pii/BrowserHighRecallPass.ts

import { DenyList } from '@shared/pii/context/DenyList';

class BrowserHighRecallPass implements DetectionPass {
  async execute(context: DetectionContext): Promise<DetectionResult> {
    // Existing detection logic...
    let entities = await this.detectEntities(context.text);

    // NEW: Filter false positives (same as Electron)
    const language = context.language || 'en';
    entities = entities.filter(entity =>
      !DenyList.isDenied(entity.text, entity.type, language)
    );

    return { entities, metadata: { ... } };
  }
}
```

### Path Alias Configuration

**Electron (tsconfig.json):**
```json
{
  "compilerOptions": {
    "paths": {
      "@shared/*": ["./shared/*"]
    }
  }
}
```

**Browser (vite.config.ts):**
```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, '../shared')
    }
  }
});
```

### Performance Requirements

- DenyList check: <1ms per entity (hash lookup)
- Context enhancement: <5ms per entity
- Total overhead: <10% of current processing time
- Benchmark before/after integration

## Prerequisites

- Story 8.1 (DenyList System)
- Story 8.2 (Context Words Database)
- Story 8.3 (Context Enhancement System)

## Integration Points

- All three shared modules imported
- **Canonical Pipeline Order** (must be consistent across Electron and Browser):
  1. **TextNormalizer** (Story 8.7) - Normalize text, build index map
  2. **HighRecallPass** - ML + rule-based detection on normalized text
  3. **DenyList Filter** (Story 8.1) - Remove false positives
  4. **FormatValidationPass** - Validate IBAN checksums, AVS, etc.
  5. **ContextScoringPass** (Story 8.3) - Apply context enhancement
  6. **DocumentTypePass** (Epic 3) - Apply document-type-specific rules
  7. **ConsolidationPass** (Story 8.8) - Merge overlaps, consolidate addresses
  8. **Span Mapping** - Map normalized spans back to original text offsets
- Feature flag: `enableEpic8Features: boolean` in detection config (default: true)
- Metadata tracking: `DetectionResult.metadata` includes:
  - `denyListFiltered: Record<EntityType, number>`
  - `contextBoosted: Record<EntityType, number>`
  - `passTimings: Record<string, number>` (milliseconds per pass)

## Test Scenarios

1. Invoice with "Montant" → filtered out, not in results
2. Invoice with "Jean Dupont" → detected with boosted confidence
3. Electron and Browser produce identical results
4. All existing integration tests pass
5. Processing time increase <10%
6. Language detection flows to DenyList and ContextEnhancer

## Definition of Done

- [ ] `HighRecallPass.ts` updated with DenyList
- [ ] `ContextScoringPass.ts` updated with ContextEnhancer
- [ ] `BrowserHighRecallPass.ts` synced with Electron
- [ ] Path aliases configured in both projects
- [ ] Canonical pipeline order documented and enforced in both Electron and Browser
- [ ] Feature flag `enableEpic8Features` implemented and tested
- [ ] Metadata tracking added (filtered counts, boosted counts, pass timings)
- [ ] All existing tests pass
- [ ] Performance benchmark shows <10% overhead
- [ ] Integration tests verify filtering and enhancement
- [ ] A/B test mode verified (can disable Epic 8 features for comparison)
