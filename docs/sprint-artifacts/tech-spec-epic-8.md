# Epic Technical Specification: PII Detection Quality Improvement

Date: 2025-12-23
Author: Olivier
Epic ID: 8
Status: Draft

---

## Overview

Epic 8 improves PII detection quality by implementing Microsoft Presidio-inspired patterns: deny-lists for false positive reduction, context enhancement for confidence boosting, and extensible country-specific recognizers. Quality assessment revealed precision ~75% (table headers detected as PERSON_NAME) and browser recall ~75% vs Electron ~90%.

**User Value:** Higher accuracy PII detection with fewer false positives (users don't need to review table headers as potential PII) and easier extensibility for country-specific patterns.

The solution leverages the existing multi-pass detection pipeline (Epic 1) by adding deny-list filtering after HighRecallPass and context enhancement in ContextScoringPass. The architecture follows Microsoft Presidio patterns for extensibility.

## Objectives and Scope

**In Scope:**
- DenyList system to filter common false positives (table headers, acronyms)
- Context enhancement using Presidio's contextSimilarityFactor approach
- Multilingual context words database (EN/FR/DE)
- Extensible country-specific recognizer architecture
- Platform parity between Electron and Browser

**Out of Scope:**
- New PII entity types (covered by future epics)
- ML model retraining or fine-tuning
- External API integrations for validation
- Migration of existing patterns to new recognizer architecture (future work)

## System Architecture Alignment

This epic aligns with the architecture document's multi-pass detection pipeline:

**Primary Components:**
- `shared/pii/context/DenyList.ts` - New module for false positive filtering
- `shared/pii/context/ContextEnhancer.ts` - New module for confidence boosting
- `shared/pii/context/ContextWords.ts` - Context words database

**Secondary Components:**
- `src/pii/passes/HighRecallPass.ts` - Integration with DenyList
- `src/pii/passes/ContextScoringPass.ts` - Integration with ContextEnhancer
- `browser-app/src/pii/BrowserHighRecallPass.ts` - Browser parity

**Integration Points:**
- DenyList runs after HighRecallPass entity detection
- ContextEnhancer runs within ContextScoringPass
- Shared code in `shared/pii/` used by both Electron and Browser

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| `DenyList.ts` | Filter false positive entities | Entity, entityType, language | boolean (isDenied) | Story 8.1 |
| `ContextWords.ts` | Provide context words per entity type | entityType, language | string[] | Story 8.2 |
| `ContextEnhancer.ts` | Boost confidence based on context | Entity, fullText, contextWords | Entity with adjusted confidence | Story 8.3 |
| `types.ts` | Recognizer interface definitions | - | TypeScript interfaces | Story 8.5 |
| `BaseRecognizer.ts` | Abstract recognizer base class | - | Abstract class | Story 8.5 |

### Data Models and Contracts

```typescript
// shared/pii/context/DenyList.ts

/**
 * Configuration for deny-list patterns
 */
export interface DenyListConfig {
  global: (string | RegExp)[];           // Applies to all entity types
  byEntityType: Record<string, (string | RegExp)[]>;
  byLanguage: Record<string, (string | RegExp)[]>;
}

/**
 * DenyList class for filtering false positives
 */
export class DenyList {
  static isDenied(text: string, entityType: string, language?: string): boolean;
  static addPattern(pattern: string | RegExp, scope: 'global' | string): void;
  static getPatterns(entityType?: string, language?: string): (string | RegExp)[];
}

// shared/pii/context/ContextWords.ts

/**
 * Context words organized by entity type and language
 */
export type ContextWordsConfig = Record<string, Record<string, string[]>>;

export const CONTEXT_WORDS: ContextWordsConfig = {
  PERSON_NAME: {
    en: ['name', 'contact', 'attention', 'dear', 'mr', 'mrs', 'ms'],
    fr: ['nom', 'contact', 'attention', 'cher', 'chère', 'm.', 'mme'],
    de: ['name', 'kontakt', 'achtung', 'herr', 'frau']
  },
  // ... other entity types
};

// shared/pii/context/ContextEnhancer.ts

/**
 * Configuration for context enhancement
 */
export interface ContextEnhancerConfig {
  windowSize: number;           // Characters to check (default: 100)
  similarityFactor: number;     // Boost amount (Presidio: 0.35)
  minScoreWithContext: number;  // Floor score (Presidio: 0.4)
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
}

export class ContextEnhancer {
  constructor(config?: Partial<ContextEnhancerConfig>);
  enhance(entity: PositionedEntity, fullText: string, contextWords: string[]): PositionedEntity;
}

// shared/pii/recognizers/types.ts

/**
 * Pattern definition for recognizers
 */
export interface PatternDefinition {
  regex: RegExp;
  score: number;           // Base confidence (0.3-0.7)
  entityType: string;
}

/**
 * Recognizer configuration
 */
export interface RecognizerConfig {
  name: string;
  supportedLanguages: string[];
  supportedCountries: string[];
  patterns: PatternDefinition[];
  contextWords: string[];
  denyPatterns: (string | RegExp)[];
  validator?: (match: string) => boolean;
}
```

### APIs and Interfaces

```typescript
// DenyList API
class DenyList {
  /**
   * Check if text should be denied for given entity type
   * @param text - The detected entity text
   * @param entityType - The entity type (PERSON_NAME, PHONE, etc.)
   * @param language - Optional language code (en, fr, de)
   * @returns true if text should be filtered out
   */
  static isDenied(text: string, entityType: string, language?: string): boolean;
}

// ContextEnhancer API
class ContextEnhancer {
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
}

// Context Words API
/**
 * Get context words for entity type and language
 * @param entityType - The entity type
 * @param language - The language code
 * @returns Array of context words
 */
function getContextWords(entityType: string, language: string): string[];
```

### Workflows and Sequencing

```
┌─────────────────────────────────────────────────────────────────┐
│                    ENHANCED DETECTION PIPELINE                   │
└─────────────────────────────────────────────────────────────────┘

Input: Document Text
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Pass 1: High-Recall Detection (existing)                         │
│  - ML model detection                                            │
│  - Regex pattern matching                                        │
│  Output: Entity[] with initial detections                        │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ NEW: DenyList Filtering                                          │
│                                                                  │
│  for each entity:                                                │
│    if DenyList.isDenied(entity.text, entity.type, language):    │
│      remove entity from list                                     │
│                                                                  │
│  Filters: "Montant", "Description", "Total", acronyms, etc.     │
│  Output: Entity[] without false positives                        │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Pass 2: Format Validation (existing)                             │
│  - Checksum validation (IBAN, AVS)                              │
│  - Format verification                                           │
│  Output: Entity[] with validation status                         │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Pass 3: Context Scoring (enhanced)                               │
│                                                                  │
│  for each entity:                                                │
│    contextWords = getContextWords(entity.type, language)         │
│    entity = contextEnhancer.enhance(entity, fullText, words)    │
│                                                                  │
│  Presidio factors:                                               │
│  - similarityFactor: 0.35 (boost when context found)            │
│  - minScoreWithContext: 0.4 (floor score)                       │
│                                                                  │
│  Output: Entity[] with adjusted confidence                       │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
Output: Final Entity[] ready for anonymization
```

## Non-Functional Requirements

### Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| DenyList check | <1ms per entity | Hash-based lookup |
| Context enhancement | <5ms per entity | String search in window |
| Total overhead | <10% increase | Must not impact user experience |
| Memory | <10MB additional | Context words database is small |

### Security

| Requirement | Implementation | Source |
|-------------|---------------|--------|
| No external calls | All data embedded locally | NFR-S1 |
| No PII logging | Log only entity types, not text | Architecture |
| Path validation | N/A (no file operations) | - |

### Reliability

| Requirement | Implementation |
|-------------|---------------|
| Graceful degradation | If DenyList fails, continue without filtering |
| Default behavior | If context words missing, use base confidence |
| Error isolation | Errors per-entity don't affect others |

## Dependencies and Integrations

### Internal Dependencies

| Component | Dependency Type | Integration Point |
|-----------|----------------|-------------------|
| `HighRecallPass.ts` | Modified | Add DenyList filtering |
| `ContextScoringPass.ts` | Modified | Add ContextEnhancer |
| `BrowserHighRecallPass.ts` | Modified | Sync with Electron |
| `src/types/detection.ts` | Extended | Import shared types |

### Data Dependencies

| Data | Source | Format | Size |
|------|--------|--------|------|
| Deny patterns | Quality assessment | TypeScript | ~2KB |
| Context words | Presidio patterns | TypeScript | ~5KB |

## Acceptance Criteria (Authoritative)

### Story 8.1: DenyList System Implementation

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-8.1.1 | Given "Montant" detected as PERSON_NAME, when DenyList runs, then entity is filtered | Yes |
| AC-8.1.2 | Given "Description" detected as PERSON_NAME, when DenyList runs, then entity is filtered | Yes |
| AC-8.1.3 | DenyList supports string patterns | Yes |
| AC-8.1.4 | DenyList supports RegExp patterns | Yes |
| AC-8.1.5 | DenyList is case-insensitive | Yes |
| AC-8.1.6 | Entity-type specific patterns work (e.g., PERSON_NAME deny list) | Yes |
| AC-8.1.7 | Language-specific patterns work | Yes |

### Story 8.2: Context Words Database

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-8.2.1 | PERSON_NAME has context words for EN, FR, DE | Yes |
| AC-8.2.2 | PHONE has context words for EN, FR, DE | Yes |
| AC-8.2.3 | EMAIL has context words | Yes |
| AC-8.2.4 | Context words include salutations (Mr, Mme, Herr) | Yes |
| AC-8.2.5 | Context words include field labels (Name:, Nom:) | Yes |
| AC-8.2.6 | getContextWords() returns correct words | Yes |

### Story 8.3: Context Enhancement System

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-8.3.1 | Entity with context words gets confidence boost | Yes |
| AC-8.3.2 | Boost is up to 0.35 (Presidio factor) | Yes |
| AC-8.3.3 | Minimum confidence with context is 0.4 | Yes |
| AC-8.3.4 | Window size is 100 characters by default | Yes |
| AC-8.3.5 | Config options are respected | Yes |
| AC-8.3.6 | Entity without context keeps base confidence | Yes |

### Story 8.4: Pipeline Integration

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-8.4.1 | DenyList filtering runs after HighRecallPass | Yes |
| AC-8.4.2 | ContextEnhancer runs in ContextScoringPass | Yes |
| AC-8.4.3 | Electron pipeline works correctly | Yes |
| AC-8.4.4 | Browser pipeline works correctly | Yes |
| AC-8.4.5 | Existing tests continue passing | Yes |
| AC-8.4.6 | Processing time increase is <10% | Yes |

### Story 8.5: Country-Specific Recognizer Architecture

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-8.5.1 | RecognizerConfig interface defined | Yes |
| AC-8.5.2 | BaseRecognizer abstract class created | Yes |
| AC-8.5.3 | Directory structure supports countries (ch, eu, us) | Yes |
| AC-8.5.4 | Example Swiss recognizer scaffolded | Yes |
| AC-8.5.5 | Recognizer can declare context words | Yes |
| AC-8.5.6 | Recognizer can declare deny patterns | Yes |

### Story 8.6: Integration Tests & Quality Validation

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-8.6.1 | DenyList unit tests pass | Yes |
| AC-8.6.2 | ContextEnhancer unit tests pass | Yes |
| AC-8.6.3 | Integration tests with invoice fixtures pass | Yes |
| AC-8.6.4 | Precision improves to >90% | Yes |
| AC-8.6.5 | Recall remains ≥90% (Electron) | Yes |
| AC-8.6.6 | Recall remains ≥85% (Browser) | Yes |

## Risks, Assumptions, Open Questions

### Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | DenyList too aggressive (filters valid entities) | High | Medium | Start conservative, expand based on testing |
| R2 | Context words incomplete | Medium | Medium | Use Presidio patterns as reference |
| R3 | Performance degradation | Medium | Low | Optimize hot paths, benchmark |

### Assumptions

| ID | Assumption | Validation Approach |
|----|-----------|-------------------|
| A1 | Table headers are primary false positive source | Validated via quality assessment |
| A2 | Presidio patterns transfer to our domain | Test with real documents |
| A3 | Shared code works in both Electron and Browser | Integration tests on both platforms |

### Open Questions

| ID | Question | Owner | Target Resolution |
|----|----------|-------|-------------------|
| Q1 | Should deny patterns be user-configurable? | PM | Before Story 8.4 |
| Q2 | Should context window expand across newlines? | Dev | During Story 8.3 |

## Test Strategy Summary

### Test Levels

| Level | Coverage | Framework | Location |
|-------|----------|-----------|----------|
| Unit Tests | DenyList, ContextWords, ContextEnhancer | Mocha + Chai / Vitest | `test/unit/pii/context/` |
| Integration Tests | Pipeline with new modules | Mocha + Chai / Vitest | `test/integration/pii/` |
| E2E Tests | Full document processing | Mocha + Chai / Vitest | `test/e2e/` |

### Test Coverage Requirements

| Component | Minimum Coverage | Critical Paths |
|-----------|-----------------|----------------|
| DenyList | 95% | isDenied() function |
| ContextWords | 90% | getContextWords() function |
| ContextEnhancer | 95% | enhance() function |
| Pipeline Integration | 80% | End-to-end flow |

### Key Test Scenarios

**Unit Tests:**
1. DenyList filters "Montant", "Description", "Total"
2. DenyList allows valid person names through
3. ContextEnhancer boosts confidence with context
4. ContextEnhancer respects window boundaries
5. Context words return correct values per language

**Integration Tests:**
1. Invoice document: table headers filtered, names detected
2. Contract document: addresses linked, context boosts applied
3. Mixed document: correct precision/recall metrics

**E2E Tests:**
1. Invoice with table headers → no false positives
2. Letter with names → high confidence with context
3. Multi-format batch → consistent behavior

## Story Summary

| Story | Title | Prerequisites | Files |
|-------|-------|---------------|-------|
| 8.1 | DenyList System Implementation | None | `shared/pii/context/DenyList.ts` |
| 8.2 | Context Words Database | None | `shared/pii/context/ContextWords.ts` |
| 8.3 | Context Enhancement System | 8.2 | `shared/pii/context/ContextEnhancer.ts` |
| 8.4 | Pipeline Integration | 8.1, 8.2, 8.3 | HighRecallPass, ContextScoringPass |
| 8.5 | Country-Specific Recognizer Architecture | 8.1, 8.2, 8.3 | `shared/pii/recognizers/` |
| 8.6 | Integration Tests & Quality Validation | 8.1-8.5 | `test/unit/pii/context/` |
