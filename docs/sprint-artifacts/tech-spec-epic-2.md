# Epic Technical Specification: Address Relationship Modeling

Date: 2025-12-08
Author: Olivier
Epic ID: 2
Status: Final

---

## Overview

Epic 2 implements entity relationship modeling to group address components (street name, street number, postal code, city, country) into unified ADDRESS entities. This addresses the root cause of partial address leakage identified in brainstorming: currently, address components detected separately (e.g., "1700" as postal code, "Fribourg" as city) result in fragmented anonymization, where "Rue de Lausanne 12, 1000 Lausanne" becomes "[STREET] 12, [POSTAL_CODE] [CITY]" instead of a single "[ADDRESS_1]" placeholder.

The solution leverages the multi-pass detection pipeline (completed in Epic 1) to add a component classification phase followed by proximity-based linking. Swiss and EU address formats are supported with pattern matching, and confidence scoring ensures ambiguous groupings are flagged for user review.

## Objectives and Scope

**In Scope:**
- Address component classification (STREET_NAME, STREET_NUMBER, POSTAL_CODE, CITY, COUNTRY)
- Proximity-based component linking within spatial proximity (50 characters)
- Swiss address pattern matching (Street Number, PostalCode City)
- EU address pattern matching (Street Number, PostalCode City, Country)
- Confidence scoring based on component completeness and validation
- Unified ADDRESS entity output with structured components in mapping file
- Integration with existing SwissEuDetector.js patterns
- Swiss postal code validation (1000-9999 range)

**Out of Scope:**
- International address formats beyond Swiss/EU (US, UK, Asian formats)
- Address geocoding or validation against external APIs
- PO Box and special address handling (Postfach, Case postale)
- Multi-line address block detection from visual layout
- Address normalization (standardizing abbreviations like "Str." → "Strasse")

## System Architecture Alignment

This epic aligns with the architecture document's "Address Component Linking (Epic 2)" section and ADR-005:

**Primary Components:**
- `src/pii/AddressClassifier.ts` - New module for component classification and linking
- `src/pii/SwissEuDetector.js` - Existing patterns enhanced with component tagging

**Secondary Components:**
- `fileProcessor.js` - Anonymization logic updated for grouped addresses
- Mapping file schema - Extended with `components` field for structured addresses

**Integration Points:**
- Runs as Pass 2.5 (between Format Validation and Context Scoring) in DetectionPipeline
- Receives individual entity detections from Pass 1-2
- Outputs grouped ADDRESS entities with confidence scores to Pass 3

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| `AddressClassifier.ts` | Classify text segments as address components, link components, calculate confidence | Entity[], text | GroupedAddress[] | Epic 2 |
| `AddressComponentDetector.ts` | Detect individual address components using regex patterns | text | AddressComponent[] | Story 2.1 |
| `AddressLinker.ts` | Group components by proximity and pattern matching | AddressComponent[] | LinkedAddressGroup[] | Story 2.2 |
| `AddressConfidenceScorer.ts` | Calculate confidence for grouped addresses | LinkedAddressGroup | ScoredAddress | Story 2.3 |
| `SwissEuDetector.js` (enhanced) | Provide component-level tagging for existing patterns | text | Entity[] with componentType | Story 2.1 |

### Data Models and Contracts

```typescript
// src/types/address.ts

/**
 * Address component types following Swiss/EU conventions
 */
type AddressComponentType =
  | 'STREET_NAME'    // "Rue de Lausanne", "Bahnhofstrasse"
  | 'STREET_NUMBER'  // "12", "12a", "12-14"
  | 'POSTAL_CODE'    // "1000", "8001", "CH-1000"
  | 'CITY'           // "Lausanne", "Zurich"
  | 'COUNTRY';       // "Switzerland", "CH"

/**
 * Individual address component detected in text
 */
interface AddressComponent {
  type: AddressComponentType;
  text: string;
  start: number;
  end: number;
  confidence: number;
  source: 'ML' | 'RULE' | 'BOTH';
}

/**
 * Grouped address with linked components
 */
interface GroupedAddress {
  type: 'ADDRESS';
  text: string;                      // Full address text span
  start: number;                     // Start of first component
  end: number;                       // End of last component
  confidence: number;                // Calculated confidence (0-1)
  source: 'LINKED';                  // Indicates component linking
  components: {
    street?: string;
    number?: string;
    postal?: string;
    city?: string;
    country?: string;
  };
  componentEntities: AddressComponent[];  // Original components
  patternMatched?: string;               // "SWISS" | "EU" | "PARTIAL"
  validationStatus: 'valid' | 'partial' | 'uncertain';
}

/**
 * Swiss postal code lookup entry
 */
interface SwissPostalCode {
  code: number;           // 1000-9999
  city: string;           // Primary city name
  canton: string;         // Two-letter canton code
  aliases: string[];      // Alternative city names (multilingual)
}
```

### APIs and Interfaces

```typescript
// src/pii/AddressClassifier.ts

/**
 * Main address classification API
 */
class AddressClassifier {
  /**
   * Classify and link address components from detected entities
   * @param entities - Entities from Pass 1-2 detection
   * @param text - Original document text for context
   * @returns Grouped addresses with confidence scores
   */
  classifyAndLink(entities: Entity[], text: string): GroupedAddress[];

  /**
   * Detect address components in text
   * @param text - Document text
   * @returns Individual address components
   */
  detectComponents(text: string): AddressComponent[];

  /**
   * Link components within proximity threshold
   * @param components - Detected components
   * @param proximityThreshold - Max char distance (default: 50)
   * @returns Grouped component clusters
   */
  linkByProximity(
    components: AddressComponent[],
    proximityThreshold?: number
  ): AddressComponent[][];

  /**
   * Match component groups against address patterns
   * @param group - Linked component group
   * @returns Pattern match result with confidence
   */
  matchPattern(group: AddressComponent[]): {
    pattern: 'SWISS' | 'EU' | 'PARTIAL' | 'NONE';
    confidence: number;
  };

  /**
   * Calculate final confidence score for grouped address
   * @param address - Grouped address
   * @returns Updated address with final confidence
   */
  scoreConfidence(address: GroupedAddress): GroupedAddress;
}

// IPC Integration (added to preload.cjs)
interface AddressClassifierIPC {
  'address:classify': (text: string, entities: Entity[]) => Promise<GroupedAddress[]>;
  'address:validate-postal': (code: string) => Promise<SwissPostalCode | null>;
}
```

### Workflows and Sequencing

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADDRESS CLASSIFICATION FLOW                   │
└─────────────────────────────────────────────────────────────────┘

Input: Entity[] from Pass 1-2, Original Text
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Component Detection                                      │
│                                                                  │
│  • Extract entities already tagged as address-related           │
│  • Run component-specific patterns:                              │
│    - Street: /(?:rue|avenue|chemin|strasse|weg|place)\s+[\w\s]+/│
│    - Number: /\d{1,4}[a-z]?(?:\s*[-–]\s*\d{1,4})?/             │
│    - Postal: /(?:CH-?)?\d{4}/                                   │
│    - City: Match against Swiss city database                     │
│                                                                  │
│  Output: AddressComponent[] with positions                       │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Proximity Linking                                        │
│                                                                  │
│  • Sort components by position                                   │
│  • Group components within 50-char window                        │
│  • Handle line breaks (expand window to 100 chars if newline)   │
│                                                                  │
│  Algorithm:                                                      │
│  for each component:                                             │
│    if (component.start - lastEnd) < threshold:                  │
│      add to current group                                        │
│    else:                                                         │
│      start new group                                             │
│                                                                  │
│  Output: AddressComponent[][] (grouped clusters)                 │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Pattern Matching                                         │
│                                                                  │
│  Swiss Pattern: [Street] [Number], [Postal] [City]              │
│  EU Pattern: [Street] [Number], [Postal] [City], [Country]      │
│  Alt Pattern: [Postal] [City], [Street] [Number]                │
│                                                                  │
│  • Check component order matches pattern                         │
│  • Validate postal code against Swiss database                   │
│  • Match city name (including multilingual variants)            │
│                                                                  │
│  Output: PatternMatch { pattern, confidence }                    │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Confidence Scoring                                       │
│                                                                  │
│  Base Score Calculation:                                         │
│  • Component completeness: +0.2 per component (max 1.0)         │
│  • Pattern match: +0.3 for Swiss/EU, +0.1 for partial           │
│  • Postal validation: +0.2 if Swiss postal code valid           │
│  • City validation: +0.1 if city matches postal code            │
│                                                                  │
│  Confidence Thresholds:                                          │
│  • >= 0.8: HIGH (auto-anonymize)                                │
│  • 0.6-0.8: MEDIUM (include with warning)                       │
│  • < 0.6: LOW (flag for user review)                            │
│                                                                  │
│  Output: GroupedAddress[] with confidence                        │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Entity Merging                                           │
│                                                                  │
│  • Replace original component entities with grouped ADDRESS     │
│  • Mark original components as "linked" (not standalone)        │
│  • Preserve ungrouped components as fallback entities           │
│                                                                  │
│  Output: Entity[] with grouped ADDRESS entities                  │
└─────────────────────────────────────────────────────────────────┘

Output: Updated Entity[] ready for Pass 3 (Context Scoring)
```

## Non-Functional Requirements

### Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| Component detection latency | <100ms per document | Must not significantly impact overall processing (NFR-P3: 30s for 10 pages) |
| Proximity linking | O(n log n) complexity | Sort-based algorithm for scalability |
| Memory overhead | <50MB additional | Postal code database loaded once, cached |
| Batch processing impact | <10% throughput reduction | Address linking adds minimal overhead to pipeline |

**Performance Constraints from PRD/Architecture:**
- NFR-P3: Document processing (10-page PDF) must complete in <30s
- NFR-P5: Memory usage during processing must stay under 1GB
- Address classification runs in pipeline, not as separate IPC call

### Security

| Requirement | Implementation | Source |
|-------------|---------------|--------|
| No external API calls | Swiss postal code database embedded locally | NFR-S1: Zero network calls |
| Path validation | All file operations use pathValidator.ts | NFR-S3 |
| No PII logging | Log only entity types and positions, never text content | Architecture logging pattern |
| IPC validation | Validate all address:* IPC inputs | NFR-S6 |

**Security Notes:**
- Swiss postal code database (~3000 entries) bundled with application
- No geocoding or external validation APIs
- Address components stored in mapping file follow existing security model

### Reliability/Availability

| Requirement | Implementation |
|-------------|---------------|
| Graceful degradation | If postal database fails to load, use pattern-only matching |
| Partial results | Return ungrouped components if linking fails |
| Error recovery | Catch exceptions per-address, continue with remaining entities |
| Timeout protection | Address classification subject to pipeline timeout (NFR-R4) |

**Fallback Behavior:**
- Database unavailable → Pattern matching only (reduced confidence)
- Pattern matching fails → Return components as individual entities
- Single address error → Log warning, continue with other addresses

### Observability

| Signal | Type | Purpose |
|--------|------|---------|
| `address.components_detected` | Counter | Track component detection volume |
| `address.groups_created` | Counter | Track successful address groupings |
| `address.confidence_distribution` | Histogram | Monitor confidence score distribution |
| `address.pattern_matches` | Counter by pattern | Track which patterns are most common |
| `address.linking_failures` | Counter | Track failed groupings for debugging |

**Logging Requirements:**
```typescript
// Example log entries (no PII)
logger.debug('Address component detected', {
  type: 'POSTAL_CODE',
  position: { start: 125, end: 129 },
  confidence: 0.95
});

logger.info('Address grouped', {
  componentCount: 4,
  pattern: 'SWISS',
  confidence: 0.87,
  position: { start: 100, end: 145 }
});
```

## Dependencies and Integrations

### External Dependencies

| Dependency | Version | Purpose | Notes |
|------------|---------|---------|-------|
| TypeScript | 5.x | Type-safe implementation | Already in project |
| Mocha + Chai | 10.x | Unit and integration tests | Already in project |

**No new npm dependencies required.** Address classification is implemented using:
- Native JavaScript/TypeScript regex patterns
- Embedded Swiss postal code database (JSON)
- Existing project utilities (pathValidator, logger)

### Internal Dependencies

| Component | Dependency Type | Integration Point |
|-----------|----------------|-------------------|
| `DetectionPipeline.ts` | Required | AddressClassifier registers as Pass 2.5 |
| `SwissEuDetector.js` | Enhanced | Component tagging added to existing patterns |
| `fileProcessor.js` | Modified | Anonymization logic for grouped addresses |
| `src/types/detection.ts` | Extended | AddressComponent and GroupedAddress types |
| `preload.cjs` | Extended | New IPC channels for address operations |

### Data Dependencies

| Data | Source | Format | Size |
|------|--------|--------|------|
| Swiss postal codes | Swiss Post | JSON | ~150KB |
| Swiss cities | Derived from postal codes | JSON | Included |
| Canton mapping | Static | JSON | ~2KB |

**Swiss Postal Code Database Schema:**
```json
{
  "postalCodes": {
    "1000": {
      "city": "Lausanne",
      "canton": "VD",
      "aliases": ["Lausanne 1", "Lausanne 25 Dist"]
    },
    "8001": {
      "city": "Zürich",
      "canton": "ZH",
      "aliases": ["Zurich", "Zurigo"]
    }
  }
}
```

### Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTEGRATION ARCHITECTURE                      │
└─────────────────────────────────────────────────────────────────┘

DetectionPipeline.ts
       │
       ├── Pass 1: High-Recall Detection (existing)
       │
       ├── Pass 2: Format Validation (existing)
       │
       ├── Pass 2.5: Address Classification (NEW - Epic 2)
       │      │
       │      ├── AddressClassifier.ts
       │      │      ├── detectComponents()
       │      │      ├── linkByProximity()
       │      │      ├── matchPattern()
       │      │      └── scoreConfidence()
       │      │
       │      └── SwissPostalDatabase.ts
       │             └── validate(), lookup()
       │
       └── Pass 3: Context Scoring (existing)

fileProcessor.js
       │
       └── anonymizeEntities()
              │
              └── handleGroupedAddress()  (NEW)
                     ├── Replace full span with [ADDRESS_N]
                     └── Store components in mapping file
```

## Acceptance Criteria (Authoritative)

### Story 2.1: Address Component Classifier

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-2.1.1 | Given detected entities and text, when address classification runs, then STREET_NAME components are identified (e.g., "Rue de Lausanne", "Bahnhofstrasse") | Yes |
| AC-2.1.2 | Given text with addresses, when classification runs, then STREET_NUMBER components are identified (e.g., "12", "12a", "12-14") | Yes |
| AC-2.1.3 | Given text with addresses, when classification runs, then POSTAL_CODE components are identified (e.g., "1000", "8001", "CH-1000") | Yes |
| AC-2.1.4 | Given text with addresses, when classification runs, then CITY components are identified (e.g., "Lausanne", "Zurich", "Zürich") | Yes |
| AC-2.1.5 | Given text with addresses, when classification runs, then COUNTRY components are identified (e.g., "Switzerland", "Suisse", "CH") | Yes |
| AC-2.1.6 | Components are tagged with position (start, end indices) | Yes |
| AC-2.1.7 | Swiss postal codes (1000-9999) are validated against known ranges | Yes |

### Story 2.2: Proximity-Based Component Linking

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-2.2.1 | Given classified address components, when proximity linking runs, then components within 50 characters are grouped as candidates | Yes |
| AC-2.2.2 | Swiss address patterns are recognized: [Street] [Number], [PostalCode] [City] | Yes |
| AC-2.2.3 | EU address patterns are recognized: [Street] [Number], [PostalCode] [City], [Country] | Yes |
| AC-2.2.4 | Alternative patterns are recognized: [PostalCode] [City], [Street] [Number] | Yes |
| AC-2.2.5 | Grouped components create a single ADDRESS entity with sub-components | Yes |
| AC-2.2.6 | Original component entities are marked as "linked" (not standalone) | Yes |

### Story 2.3: Address Confidence Scoring

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-2.3.1 | Given a grouped address entity, confidence score includes +0.2 per component (max 5 components) | Yes |
| AC-2.3.2 | Pattern match adds +0.3 if matches known Swiss/EU format | Yes |
| AC-2.3.3 | Postal code validation adds +0.2 if valid Swiss/EU postal code | Yes |
| AC-2.3.4 | City validation adds +0.1 if matches known city | Yes |
| AC-2.3.5 | Addresses with confidence < 0.6 are flagged for user review | Yes |
| AC-2.3.6 | High-confidence addresses (> 0.8) are auto-anonymized | Yes |

### Story 2.4: Address Anonymization Strategy

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-2.4.1 | Given a grouped address entity, the entire address span is replaced with single placeholder [ADDRESS_N] | Yes |
| AC-2.4.2 | Mapping file stores full original address with components (street, number, postal, city) | Yes |
| AC-2.4.3 | Partial matches (standalone postal codes) still work as fallback | Yes |
| AC-2.4.4 | "Rue de Lausanne 12, 1000 Lausanne" becomes "[ADDRESS_1]" not "Rue de Lausanne [NUMBER], [POSTAL] [CITY]" | Yes |

## Traceability Mapping

| AC ID | Spec Section | Component(s) | Test Idea |
|-------|-------------|--------------|-----------|
| AC-2.1.1 | Detailed Design > Component Detection | AddressComponentDetector.ts | Unit test: detect "Rue de Lausanne" as STREET_NAME |
| AC-2.1.2 | Detailed Design > Component Detection | AddressComponentDetector.ts | Unit test: detect "12a" as STREET_NUMBER |
| AC-2.1.3 | Detailed Design > Component Detection | AddressComponentDetector.ts | Unit test: detect "1000", "CH-8001" as POSTAL_CODE |
| AC-2.1.4 | Detailed Design > Component Detection | AddressComponentDetector.ts | Unit test: detect "Lausanne", "Zürich" as CITY |
| AC-2.1.5 | Detailed Design > Component Detection | AddressComponentDetector.ts | Unit test: detect "Switzerland", "CH" as COUNTRY |
| AC-2.1.6 | Data Models > AddressComponent | AddressComponent interface | Unit test: verify start/end positions |
| AC-2.1.7 | Data Models > SwissPostalCode | SwissPostalDatabase.ts | Unit test: validate 1000 (valid), 9999 (valid), 10000 (invalid) |
| AC-2.2.1 | Workflows > Step 2 | AddressLinker.ts | Unit test: group components within 50 chars |
| AC-2.2.2 | Workflows > Step 3 | AddressLinker.ts | Integration test: "Rue X 12, 1000 Lausanne" |
| AC-2.2.3 | Workflows > Step 3 | AddressLinker.ts | Integration test: "Rue X 12, 1000 Lausanne, Suisse" |
| AC-2.2.4 | Workflows > Step 3 | AddressLinker.ts | Integration test: "1000 Lausanne, Rue X 12" |
| AC-2.2.5 | Data Models > GroupedAddress | AddressClassifier.ts | Unit test: verify grouped entity structure |
| AC-2.2.6 | Workflows > Step 5 | AddressClassifier.ts | Unit test: verify original entities marked linked |
| AC-2.3.1 | NFR > Performance | AddressConfidenceScorer.ts | Unit test: 4 components = 0.8 base score |
| AC-2.3.2 | Workflows > Step 4 | AddressConfidenceScorer.ts | Unit test: Swiss pattern adds 0.3 |
| AC-2.3.3 | Workflows > Step 4 | AddressConfidenceScorer.ts | Unit test: valid postal adds 0.2 |
| AC-2.3.4 | Workflows > Step 4 | AddressConfidenceScorer.ts | Unit test: matching city adds 0.1 |
| AC-2.3.5 | NFR > Reliability | AddressClassifier.ts | Integration test: low-confidence flag |
| AC-2.3.6 | NFR > Reliability | AddressClassifier.ts | Integration test: high-confidence auto-anonymize |
| AC-2.4.1 | Integration Points | fileProcessor.js | E2E test: full address replaced with single placeholder |
| AC-2.4.2 | Data Models > Mapping File | fileProcessor.js | E2E test: verify mapping file structure |
| AC-2.4.3 | Integration Points | fileProcessor.js | E2E test: standalone postal code still detected |
| AC-2.4.4 | Overview | fileProcessor.js | E2E test: verify coherent anonymization |

## Risks, Assumptions, Open Questions

### Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | Address formats vary significantly across cantons | Medium | High | Start with most common formats (Swiss standard), expand based on user feedback |
| R2 | Postal code database becomes stale | Low | Low | Use Swiss Post official data, plan annual updates |
| R3 | Proximity threshold too aggressive (groups unrelated entities) | High | Medium | Configurable threshold, default 50 chars, test with real documents |
| R4 | Performance impact on large documents | Medium | Low | O(n log n) algorithm, lazy loading of postal database |
| R5 | Multi-line addresses not grouped correctly | Medium | High | Expand proximity window if newline detected, document limitation |

### Assumptions

| ID | Assumption | Validation Approach |
|----|-----------|-------------------|
| A1 | Swiss addresses follow standard format (Street Number, Postal City) | Validate with 50+ real Swiss business documents |
| A2 | Postal code database covers all inhabited Swiss locations | Cross-reference with Swiss Post official data |
| A3 | DetectionPipeline from Epic 1 is stable and operational | Epic 1 completion is prerequisite |
| A4 | Users accept partial grouping for incomplete addresses | User testing during Epic 4 (review workflow) |
| A5 | Multilingual city names (Genève/Geneva/Genf) can be mapped | Build alias table from official sources |

### Open Questions

| ID | Question | Owner | Target Resolution |
|----|----------|-------|-------------------|
| Q1 | Should PO Box addresses (Postfach, Case postale) be grouped separately? | PM | Before Story 2.1 implementation |
| Q2 | How to handle building names in addresses (e.g., "Tour Bel-Air")? | Dev | During Story 2.2 implementation |
| Q3 | Should confidence thresholds be user-configurable? | PM | Before Story 2.3 implementation |
| Q4 | What fallback behavior when city doesn't match postal code? | Dev | During Story 2.3 implementation |

## Test Strategy Summary

### Test Levels

| Level | Coverage | Framework | Location |
|-------|----------|-----------|----------|
| Unit Tests | AddressComponentDetector, AddressLinker, AddressConfidenceScorer | Mocha + Chai | `test/unit/pii/address/` |
| Integration Tests | AddressClassifier full flow, Pipeline integration | Mocha + Chai | `test/integration/address/` |
| E2E Tests | Full document processing with address anonymization | Mocha + Chai | `test/e2e/` |

### Test Coverage Requirements

| Component | Minimum Coverage | Critical Paths |
|-----------|-----------------|----------------|
| AddressComponentDetector | 90% | All 5 component types detected correctly |
| AddressLinker | 85% | Swiss and EU patterns matched |
| AddressConfidenceScorer | 90% | Scoring formula verified |
| AddressClassifier | 80% | Integration with pipeline |

### Key Test Scenarios

**Unit Tests:**
1. Detect individual street names (French, German, Italian patterns)
2. Detect street numbers including ranges (12-14) and letters (12a)
3. Validate Swiss postal codes (1000-9999 valid, others invalid)
4. Group components within proximity threshold
5. Score addresses with varying completeness

**Integration Tests:**
1. Process "Rue de Lausanne 12, 1000 Lausanne" → Single ADDRESS entity
2. Process "Bahnhofstrasse 1, 8001 Zürich, Schweiz" → Single ADDRESS with country
3. Process scattered components (>100 chars apart) → Separate entities
4. Process document with multiple addresses → All grouped correctly

**E2E Tests:**
1. LPP attestation document (real Swiss business letter)
2. Invoice with sender and recipient addresses
3. Contract with multiple party addresses
4. Mixed document with addresses and non-address postal codes

### Golden Test Dataset

Extend existing `test/fixtures/piiAnnotated/` with:
- 20 Swiss business letters with addresses
- 10 invoices with Swiss addresses
- 5 multi-page contracts with address blocks
- 5 edge cases (incomplete addresses, unusual formats)

### Regression Prevention

- All existing tests must continue passing
- Address classification must not reduce overall PII detection accuracy
- Processing time increase must be <20% from baseline
