# Story 2.2: Proximity-Based Component Linking

Status: done

## Story

As a **PII detection system**,
I want **to group address components that are spatially close together using proximity analysis and pattern matching**,
so that **complete addresses are anonymized as unified entities rather than fragmented pieces**.

## Acceptance Criteria

| AC ID | Criterion |
|-------|-----------|
| AC-2.2.1 | Given classified address components, when proximity linking runs, then components within 50 characters are grouped as candidates |
| AC-2.2.2 | Swiss address patterns are recognized: [Street] [Number], [PostalCode] [City] |
| AC-2.2.3 | EU address patterns are recognized: [Street] [Number], [PostalCode] [City], [Country] |
| AC-2.2.4 | Alternative patterns are recognized: [PostalCode] [City], [Street] [Number] |
| AC-2.2.5 | Grouped components create a single ADDRESS entity with sub-components |
| AC-2.2.6 | Original component entities are marked as "linked" (not standalone) |

## Tasks / Subtasks

- [x] **Task 1: Create TypeScript types for linked addresses** (AC: 2.2.5, 2.2.6)
  - [x] Create `LinkedAddressGroup` interface in `src/types/detection.ts`
  - [x] Create `GroupedAddress` interface with components field
  - [x] Add `linked` flag to `AddressComponent` interface
  - [x] Export types from `src/types/index.ts`

- [x] **Task 2: Implement proximity-based grouping** (AC: 2.2.1)
  - [x] Create `src/pii/AddressLinker.ts`
  - [x] Implement `groupByProximity(components: AddressComponent[], threshold: number): AddressComponent[][]`
  - [x] Sort components by position before grouping
  - [x] Handle line breaks (expand window to 100 chars if newline detected)
  - [x] Unit tests: verify grouping within 50-char threshold

- [x] **Task 3: Implement Swiss address pattern matching** (AC: 2.2.2)
  - [x] Implement pattern: [Street] [Number], [PostalCode] [City]
  - [x] Validate component order matches Swiss format
  - [x] Integration tests: "Rue de Lausanne 12, 1000 Lausanne"

- [x] **Task 4: Implement EU address pattern matching** (AC: 2.2.3)
  - [x] Implement pattern: [Street] [Number], [PostalCode] [City], [Country]
  - [x] Handle optional country component
  - [x] Integration tests: "Bahnhofstrasse 1, 8001 Zürich, Schweiz"

- [x] **Task 5: Implement alternative pattern matching** (AC: 2.2.4)
  - [x] Implement pattern: [PostalCode] [City], [Street] [Number]
  - [x] Handle reversed order common in some documents
  - [x] Integration tests: "1000 Lausanne, Rue de Lausanne 12"

- [x] **Task 6: Create GroupedAddress entities** (AC: 2.2.5)
  - [x] Implement `createGroupedAddress(components: AddressComponent[]): GroupedAddress`
  - [x] Calculate full address span (start of first, end of last component)
  - [x] Store individual components in `components` field
  - [x] Set `patternMatched` field based on detected pattern
  - [x] Unit tests: verify grouped entity structure

- [x] **Task 7: Mark original components as linked** (AC: 2.2.6)
  - [x] Add `linked: boolean` property to original components
  - [x] Set `linkedToGroupId` reference on component entities
  - [x] Ensure linked components are excluded from standalone detection
  - [x] Unit tests: verify linked flag is set

- [x] **Task 8: Integration with AddressClassifier** (AC: all)
  - [x] Update `AddressClassifier.ts` to use `AddressLinker`
  - [x] Add `linkAndGroup(text: string): GroupedAddress[]` method
  - [x] Integration test: full pipeline from text to grouped addresses

- [x] **Task 9: Test suite** (AC: all)
  - [x] Create `test/unit/pii/address/AddressLinker.test.js`
  - [x] Test proximity grouping with various thresholds
  - [x] Test all pattern variations (Swiss, EU, alternative)
  - [x] Test edge cases: overlapping addresses, scattered components
  - [x] 26 tests passing

## Dev Notes

### Architecture Alignment

This story implements the proximity linking phase of address component classification as specified in Epic 2 tech spec. The AddressLinker will be called by AddressClassifier after component detection.

**Component Location:**
- Linker: `src/pii/AddressLinker.ts`
- Types: `src/types/detection.ts` (extended)
- Tests: `test/unit/pii/address/AddressLinker.test.js`

**Data Flow:**
```
AddressComponentDetector.detectAddressComponents(text)
    ↓
AddressComponent[] (individual components)
    ↓
AddressLinker.groupByProximity(components, 50)
    ↓
AddressComponent[][] (grouped candidates)
    ↓
AddressLinker.matchPatterns(groups)
    ↓
GroupedAddress[] (linked address entities)
```

### Proximity Algorithm

```
Step 2 - Proximity Linking:
  • Sort components by position
  • Group components within 50-char window
  • Handle line breaks (expand window to 100 chars if newline)

  Algorithm:
  for each component:
    if (component.start - lastEnd) < threshold:
      add to current group
    else:
      start new group
```

### Address Patterns

**Swiss Pattern:** `[Street] [Number], [PostalCode] [City]`
- Example: "Rue de Lausanne 12, 1000 Lausanne"
- Components: STREET_NAME, STREET_NUMBER, POSTAL_CODE, CITY

**EU Pattern:** `[Street] [Number], [PostalCode] [City], [Country]`
- Example: "Bahnhofstrasse 1, 8001 Zürich, Schweiz"
- Components: STREET_NAME, STREET_NUMBER, POSTAL_CODE, CITY, COUNTRY

**Alternative Pattern:** `[PostalCode] [City], [Street] [Number]`
- Example: "1000 Lausanne, Rue de Lausanne 12"
- Components: POSTAL_CODE, CITY, STREET_NAME, STREET_NUMBER

### Open Questions (from Tech Spec)

- **Q2:** How to handle building names in addresses (e.g., "Tour Bel-Air")?
  - Decision: Treat as part of street name if detected, otherwise ignore for MVP

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Story-2.2-Proximity-Based-Component-Linking]
- [Source: docs/architecture.md#Address-Component-Linking]
- Depends on: Story 2.1 (Address Component Classifier) - COMPLETED

---

## Dev Agent Record

### Completion Notes
**Completed:** 2025-12-08
**Definition of Done:** All acceptance criteria met, code reviewed, tests passing

### Context Reference

- [docs/sprint-artifacts/stories/2-2-proximity-based-component-linking.context.xml](./2-2-proximity-based-component-linking.context.xml)

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: successful
- Test suite: 26 tests passing (new), 121 total address tests
- All acceptance criteria verified

### Completion Notes List

1. **Task 1 (Types)**: Extended `src/types/detection.ts` with `AddressPatternType`, `GroupedAddress`, `LinkedAddressGroup`, and added `linked`/`linkedToGroupId` to `AddressComponent`
2. **Task 2 (Proximity Grouping)**: Implemented `groupByProximity()` in `AddressLinker.ts` with 50-char threshold and newline expansion
3. **Task 3-5 (Pattern Matching)**: Implemented `detectPattern()` method supporting SWISS, EU, ALTERNATIVE, PARTIAL, NONE patterns
4. **Task 6 (GroupedAddress)**: Implemented `createGroupedAddressFromLinked()` with full entity structure
5. **Task 7 (Linking)**: Implemented `linkAndGroup()` returning grouped addresses, linked components, and unlinked components
6. **Task 8 (Integration)**: Updated `processText()` to use new linkAndGroup pipeline
7. **Task 9 (Tests)**: Created comprehensive test suite with 26 tests covering all ACs

**Key Changes:**
- Updated `GroupedAddress` interface in detection.ts to use `components` for breakdown and `componentEntities` for array
- Updated `AddressScorer.ts` and `AddressRelationshipPass.ts` to use new type structure
- All 121 address tests pass

### File List

**Modified:**
- `src/types/detection.ts` - Extended with new types for Story 2.2
- `src/pii/AddressLinker.ts` - Added proximity grouping and pattern matching
- `src/pii/AddressScorer.ts` - Updated to use new GroupedAddress type
- `src/pii/passes/AddressRelationshipPass.ts` - Updated to use new types

**Created:**
- `test/unit/pii/address/AddressLinker.test.js` - 26 tests for Story 2.2

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-08 | Dev Agent (Opus 4.5) | Initial story creation from Epic 2 tech spec |
| 2025-12-08 | Dev Agent (Opus 4.5) | Implementation complete - all 9 tasks done, 26 tests passing |
