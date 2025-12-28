# Story 8.8: Entity Consolidation & Span Repair

## Story

As a **detection pipeline maintainer**,  
I want **overlapping and partial PII spans to be consolidated into coherent entities**,  
So that **addresses, IDs, and names are anonymised as complete units instead of fragmented pieces**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.8 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Completed |
| **Created** | 2025-12-24 |
| **Completed** | 2025-12-27 |

## Acceptance Criteria

**Given** a Swiss address like `Rue de Lausanne 12, 1000 Lausanne`  
**When** detectors identify separate components (street, number, postal code, city)  
**Then** consolidation produces a single ADDRESS span covering the full address.

**And** overlapping spans (e.g. PERSON and EMAIL over the same text) are resolved to the most specific type.  
**And** repeated occurrences of the same literal (e.g. `Hans Müller` appearing 3 times) are linked to the same logical entity ID in the mapping file.  
**And** consolidation runs identically in Electron and Browser pipelines.
**And** address consolidation consumes outputs from Epic 2 address component classifiers (STREET_NAME, POSTAL_CODE, CITY, etc.)
**And** UI and mapping file behavior is consistent (component entities either hidden or nested under consolidated ADDRESS)
**And** partial address matches (only postal code detected) are handled gracefully (no degenerate ADDRESS entities)

## Technical Design

### File to Create

`shared/pii/postprocessing/ConsolidationPass.ts`

### Interfaces

Re‑use / extend existing entity types from `src/types/detection.ts`:

```typescript
export interface ConsolidationPassConfig {
  /** Maximum distance in characters to consider components part of the same address (default: 50) */
  addressMaxGap: number;
  /** Enable/disable per‑type consolidation behaviours */
  enableAddressConsolidation: boolean;
  enableOverlapResolution: boolean;
  enableEntityLinking: boolean;
}

export class ConsolidationPass implements DetectionPass {
  constructor(config?: Partial<ConsolidationPassConfig>);

  execute(context: DetectionContext): Promise<DetectionResult>;
}
```

### Behaviours

1. **Overlap Resolution**
   - For spans that overlap or nest:
     - Prefer more specific / higher‑priority entity types:
       - Example priority: `SWISS_AVS`, `IBAN`, `SWISS_UID` > `IDENTIFIER` > `NUMBER`.
     - If two entities of the same type overlap, keep the **longest span**.
   - Implement as a deterministic rule based on:
     - Entity type priority table (configurable).
     - Span length.
     - Confidence score as tie‑breaker.

2. **Address Consolidation**
   - **Prerequisite**: Consume outputs from Epic 2 address component classifiers:
     - `AddressClassifier` (Story 2-1) produces STREET_NAME, STREET_NUMBER, POSTAL_CODE, CITY entities
     - `ProximityBasedComponentLinking` (Story 2-2) groups components
     - `AddressConfidenceScoring` (Story 2-3) provides confidence scores
   - Group components that:
     - Are within `addressMaxGap` characters in the same line or paragraph.
     - Match a known pattern for the current country (e.g. Swiss pattern from Epic 2).
   - Emit a new `ADDRESS` entity:
     - `text`: full span from first component start to last component end.
     - `components`: dictionary of sub‑components as already defined in detection types.
     - `confidence`: aggregate based on component confidences (e.g. min or weighted average).
   - **UI/Mapping behavior decision**:
     - Option A: Remove component entities from final list (cleaner UI, simpler mapping)
     - Option B: Keep component entities with `parentId` pointing to consolidated ADDRESS (better debugging)
     - **Default**: Option A (components removed), configurable via `ConsolidationPassConfig.showComponents`
   - **Partial address handling**: If only postal code + city detected (no street), either:
     - Skip consolidation (leave as separate POSTAL_CODE + CITY entities), OR
     - Create ADDRESS with `partial: true` flag (documented in entity metadata)

3. **Entity Linking (Intra‑Document)**
   - For each unique literal string (e.g. `Hans Müller`, normalized by case/whitespace):
     - Assign a stable logical ID per document: `PERSON_1`, `PERSON_2`, etc.
   - Attach this logical ID to entities:
     - `logicalId: 'PERSON_1'`.
   - Ensure mapping file generator uses `logicalId` consistently so all occurrences map to the same anonymised token.

### Algorithm (High‑Level)

1. **Input**: list of entities from previous passes (on normalized text).  
2. **Resolve overlaps** according to priority rules.  
3. **Run address consolidation**:
   - For each set of address components close in text, create ADDRESS entity.  
4. **Run entity linking**:
   - Group by `(type, normalizedText)` and assign `logicalId`.  
5. **Output**: new `DetectionResult` with consolidated entities and updated metadata.

## Prerequisites

- Epic 2 Stories (2-1, 2-2, 2-3) - Address component classifiers provide input entities
- Stories 8.1-8.4 - DenyList and ContextEnhancement must run before consolidation

## Integration Points

- New pass added late in the pipeline:
  - Order: `HighRecall → DenyList/Validation → ContextScoring → DocumentRules → ConsolidationPass`.
- Electron: `src/pii/DetectionPipeline.ts`  
- Browser: `browser-app/src/pii/BrowserDocumentTypePass.ts` or equivalent pipeline definition.
- Mapping file generator:
  - Use `logicalId` as the key for anonymisation tokens where available.

## Test Scenarios

1. Swiss address components detected separately are consolidated into a single ADDRESS span with correctly populated `components`.  
2. Overlapping PERSON and IDENTIFIER spans select the correct type based on priority.  
3. `Hans Müller` appearing 3 times results in one logical ID and a consistent mapping token.  
4. Partial matches (only postal code detected) do not create degenerate ADDRESS entities.  
5. Consolidation does not introduce new overlaps or invalid spans.  
6. Electron and Browser produce identical consolidated outputs for the same annotated fixtures.  
7. Performance impact is negligible (<5% additional processing time on benchmark set).

## Definition of Done

- [x] `shared/pii/postprocessing/ConsolidationPass.ts` implemented with configuration.
- [x] Consolidation pass integrated into both Electron and Browser detection pipelines.
- [x] Epic 2 address component entities consumed correctly (STREET_NAME, POSTAL_CODE, etc.)
- [x] UI/mapping behavior documented and consistent (components hidden vs nested)
- [x] Partial address handling implemented (no degenerate ADDRESS entities)
- [x] Unit tests in `test/unit/pii/ConsolidationPass.test.ts` (31 tests)
- [x] Integration tests in `test/integration/pii/ConsolidationIntegration.test.js` (19 tests)
- [x] Mapping file generator updated to use `logicalId` for consistent anonymisation.
- [x] TypeScript compiles without errors in both projects.
- [x] Architecture document updated to include ConsolidationPass in the pipeline diagram.

## Implementation Summary

### Files Created
- `shared/pii/postprocessing/ConsolidationPass.ts` - Core implementation (786 lines)
- `src/pii/passes/ConsolidationPass.ts` - Electron pipeline wrapper (135 lines)
- `test/unit/pii/ConsolidationPass.test.js` - Unit tests (31 tests)
- `test/integration/pii/ConsolidationIntegration.test.js` - Integration tests (19 tests)

### Features Implemented
1. **Overlap Resolution** - Priority-based resolution using configurable entity type priority table
2. **Address Consolidation** - Groups components within addressMaxGap (default 50 chars)
3. **Entity Linking** - Assigns logicalId to repeated entities (exact/normalized/fuzzy strategies)
4. **Configuration** - Full configurability via ConsolidationPassConfig

### Test Coverage
- 31 unit tests covering configuration, priority, overlap, address, linking, edge cases
- 19 integration tests covering pipeline integration, real-world scenarios

### Browser Integration
- Exported from `browser-app/src/pii/index.ts`
- Uses shared implementation via Vite aliases


