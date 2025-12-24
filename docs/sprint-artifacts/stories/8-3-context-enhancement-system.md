# Story 8.3: Context Enhancement System

## Story

As a **confidence scoring system**,
I want **to boost entity confidence when relevant context words appear nearby**,
So that **"Jean Dupont" preceded by "Nom:" gets higher confidence than standalone "Jean"**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.3 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Backlog |
| **Created** | 2025-12-23 |

## Acceptance Criteria

**Given** an entity with base confidence 0.5
**When** context words are found within 100 characters
**Then** confidence is boosted by up to 0.35 (Presidio factor)

**And** minimum confidence with context is 0.4 (Presidio floor)
**And** window size is configurable (default: 100 chars)
**And** enhancement works for all entity types with context words
**And** per-entity-type configuration overrides are supported (e.g. PERSON_NAME uses 150 chars, IBAN uses 40 chars)
**And** direction bias is configurable (preceding context can be weighted more than following context)
**And** context enhancement never resurrects entities filtered by DenyList (safety guard)

## Technical Design

### File to Create

`shared/pii/context/ContextEnhancer.ts`

### Interface

```typescript
/**
 * Configuration for context enhancement
 * Based on Microsoft Presidio patterns
 */
export interface ContextEnhancerConfig {
  /** Characters to check before/after entity (default: 100) */
  windowSize: number;
  /** Confidence boost when context found (Presidio: 0.35) */
  similarityFactor: number;
  /** Minimum confidence when context present (Presidio: 0.4) */
  minScoreWithContext: number;
  /** Weight for preceding context vs following (default: 1.0 for both) */
  precedingWeight: number;
  followingWeight: number;
  /** Per-entity-type overrides */
  perEntityType?: Record<string, Partial<ContextEnhancerConfig>>;
}

/**
 * Entity with position information
 */
export interface PositionedEntity {
  text: string;
  type: string;
  start: number;
  end: number;
  confidence: number;
  source?: string;
}

/**
 * Context enhancement result
 */
export interface EnhancementResult {
  entity: PositionedEntity;
  contextFound: string[];
  boostApplied: number;
  originalConfidence: number;
}

/**
 * Context enhancer class for confidence boosting
 */
export class ContextEnhancer {
  constructor(config?: Partial<ContextEnhancerConfig>);

  /**
   * Enhance entity confidence based on context
   * @param entity - Entity with position and base confidence
   * @param fullText - Full document text
   * @param contextWords - Words that boost confidence
   * @returns Entity with adjusted confidence score
   */
  enhance(
    entity: PositionedEntity,
    fullText: string,
    contextWords: string[]
  ): PositionedEntity;

  /**
   * Enhance with detailed result
   */
  enhanceWithDetails(
    entity: PositionedEntity,
    fullText: string,
    contextWords: string[]
  ): EnhancementResult;
}
```

### Default Configuration

```typescript
const DEFAULT_CONFIG: ContextEnhancerConfig = {
  windowSize: 100,          // Characters before/after entity
  similarityFactor: 0.35,   // Presidio default
  minScoreWithContext: 0.4, // Presidio default
  precedingWeight: 1.2,     // Preceding context weighted higher (labels before values)
  followingWeight: 0.8,     // Following context weighted lower
  perEntityType: {
    PERSON_NAME: { windowSize: 150 },  // Names benefit from larger context
    IBAN: { windowSize: 40 },          // IBANs need smaller context
    EMAIL: { windowSize: 50 }
  }
};
```

### Algorithm

```typescript
enhance(entity, fullText, contextWords):
  1. Extract context window:
     - start = max(0, entity.start - windowSize)
     - end = min(fullText.length, entity.end + windowSize)
     - contextText = fullText.slice(start, end).toLowerCase()

  2. Search for context words (with direction awareness):
     - precedingText = fullText.slice(start, entity.start).toLowerCase()
     - followingText = fullText.slice(entity.end, end).toLowerCase()
     - foundWordsPreceding = contextWords.filter(word =>
         precedingText.includes(word.toLowerCase())
       )
     - foundWordsFollowing = contextWords.filter(word =>
         followingText.includes(word.toLowerCase())
       )

  3. Calculate boost (with weights and negative context):
     - if foundWordsPreceding.length > 0 or foundWordsFollowing.length > 0:
         - Apply weights from ContextWord objects (Story 8.2)
         - Separate positive and negative context words
         - positiveBoost = sum(positive word weights) * similarityFactor * directionWeight
         - negativeBoost = sum(negative word weights) * similarityFactor * directionWeight
         - boost = positiveBoost - negativeBoost
         - newConfidence = max(
             entity.confidence + boost,
             minScoreWithContext
           )
     - else:
         newConfidence = entity.confidence
     
  4. Safety check: If entity was denied by DenyList, skip enhancement (should not reach here)

  4. Cap at 1.0:
     - return { ...entity, confidence: min(1.0, newConfidence) }
```

### Example

```typescript
const enhancer = new ContextEnhancer();
const entity = {
  text: 'Jean Dupont',
  type: 'PERSON_NAME',
  start: 50,
  end: 61,
  confidence: 0.5
};
const text = '... Nom: Jean Dupont, Contact: ...';
const contextWords = ['nom', 'name', 'contact'];

const result = enhancer.enhance(entity, text, contextWords);
// result.confidence = 0.85 (0.5 + 0.35)
```

## Prerequisites

- Story 8.2 (Context Words Database)

## Integration Points

- Uses `getContextWords()` from `ContextWords.ts`
- Will be called from `ContextScoringPass.ts` (Story 8.4)

## Test Scenarios

1. Entity with context word gets +0.35 boost
2. Entity without context keeps original confidence
3. Multiple context words don't exceed similarityFactor
4. Confidence is capped at 1.0
5. minScoreWithContext is enforced when context found
6. Window size is respected (words outside window don't count)
7. Case-insensitive matching works
8. Empty context words array returns original entity

## Definition of Done

- [ ] `shared/pii/context/ContextEnhancer.ts` created with per-entity config support
- [ ] Direction-aware context search (preceding vs following) implemented
- [ ] Negative context words reduce confidence (not just boost)
- [ ] Per-entity-type overrides work (PERSON_NAME 150 chars, IBAN 40 chars, etc.)
- [ ] Safety guard: enhancement never applied to DenyList-filtered entities
- [ ] Unit tests in `test/unit/pii/context/ContextEnhancer.test.ts`
- [ ] Presidio factors (0.35, 0.4) implemented correctly
- [ ] Window-based context search works with direction weights
- [ ] TypeScript compiles without errors
- [ ] Works in both Electron and Browser environments
