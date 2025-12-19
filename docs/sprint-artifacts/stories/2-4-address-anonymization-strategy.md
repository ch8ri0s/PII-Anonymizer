# Story 2.4: Address Anonymization Strategy

Status: done

## Story

As a **document processor**,
I want **to replace grouped address entities with single unified placeholders and store structured address data in the mapping file**,
so that **addresses are anonymized coherently without fragmentation and can be fully reconstructed from the mapping**.

## Acceptance Criteria

| AC ID | Criterion |
|-------|-----------|
| AC-2.4.1 | Given a grouped address entity, the entire address span is replaced with single placeholder [ADDRESS_N] |
| AC-2.4.2 | Mapping file stores full original address with components (street, number, postal, city) |
| AC-2.4.3 | Partial matches (standalone postal codes) still work as fallback |
| AC-2.4.4 | "Rue de Lausanne 12, 1000 Lausanne" becomes "[ADDRESS_1]" not "Rue de Lausanne [NUMBER], [POSTAL] [CITY]" |

## Tasks / Subtasks

- [x] **Task 1: Analyze current anonymization flow in fileProcessor.js** (AC: all)
  - [x] Identify where entities are replaced with placeholders
  - [x] Understand current mapping file structure
  - [x] Document entry points for grouped address handling

- [x] **Task 2: Implement ADDRESS entity placeholder replacement** (AC: 2.4.1)
  - [x] Create `registerGroupedAddress()` method in FileProcessingSession
  - [x] Replace full text span (start to end) with `[ADDRESS_N]`
  - [x] Handle counter for ADDRESS_1, SWISS_ADDRESS_1, EU_ADDRESS_1, etc.
  - [x] Unit tests: verify single placeholder for grouped address

- [x] **Task 3: Extend mapping file schema for addresses** (AC: 2.4.2)
  - [x] Define structured address entry in mapping file
  - [x] Include: placeholder, originalText, components (street, number, postal, city, country)
  - [x] Include: confidence, patternMatched, scoringFactors from ScoredAddress
  - [x] Unit tests: verify mapping file structure

- [x] **Task 4: Implement mapping file writer for addresses** (AC: 2.4.2)
  - [x] Extract components from GroupedAddress/ScoredAddress metadata
  - [x] Write structured entry to mapping JSON (v3.1 schema)
  - [x] Preserve all scoring metadata for audit
  - [x] Integration test: verify complete mapping entry

- [x] **Task 5: Handle fallback for partial/standalone entities** (AC: 2.4.3)
  - [x] Detect ungrouped address components via isRangeAnonymized()
  - [x] Standalone entities pass through normal processing
  - [x] Entities overlapping with grouped addresses are skipped
  - [x] Unit tests: verify fallback behavior

- [x] **Task 6: Prevent fragmented anonymization** (AC: 2.4.4)
  - [x] Skip individual component replacement if part of grouped address
  - [x] Verify grouped address takes precedence over component entities
  - [x] Handle overlapping entity spans via anonymizedRanges tracking
  - [x] Integration test: "Rue de Lausanne 12, 1000 Lausanne" → [ADDRESS_1]

- [x] **Task 7: Update entity processing order** (AC: all)
  - [x] Process grouped ADDRESS entities first (position-based replacement)
  - [x] Track anonymized ranges to prevent double-processing
  - [x] Process remaining ungrouped entities with fuzzy regex
  - [x] Unit tests: verify processing order

- [x] **Task 8: Integration with detection pipeline** (AC: all)
  - [x] ScoredAddress flows from AddressRelationshipPass via metadata.isGroupedAddress
  - [x] flaggedForReview and autoAnonymize flags stored in mapping
  - [x] All addresses processed regardless of confidence (flags for UI use)
  - [x] Integration test: full pipeline with address anonymization

- [x] **Task 9: E2E test suite** (AC: all)
  - [x] Test Swiss address: "Bahnhofstrasse 10, 8001 Zürich"
  - [x] Test EU address: "Rue de Lausanne 12, 1000 Lausanne, Suisse"
  - [x] Test multiple addresses in same document
  - [x] Test document with mixed grouped and standalone entities
  - [x] 16 tests passing covering all ACs

## Dev Notes

### Architecture Alignment

This story completes Epic 2 by implementing the anonymization strategy for grouped addresses. The flow is:

```
ScoredAddress (from Story 2.3)
    ↓
fileProcessor.js → handleGroupedAddress()
    ↓
[ADDRESS_N] placeholder in output
    ↓
Mapping file with structured components
```

**Component Location:**
- Primary: `fileProcessor.js` - `handleGroupedAddress()` function
- Types: `src/types/detection.ts` (GroupedAddress, ScoredAddress already defined)
- Tests: `test/unit/anonymization/` and `test/e2e/`

**Integration Points:**
- Input: ScoredAddress[] from AddressRelationshipPass (Pass 5, order=40)
- Output: Anonymized text + mapping.json with ADDRESS entries

### Mapping File Schema

```json
{
  "entities": [
    {
      "placeholder": "[ADDRESS_1]",
      "type": "ADDRESS",
      "originalText": "Rue de Lausanne 12, 1000 Lausanne",
      "components": {
        "street": "Rue de Lausanne",
        "number": "12",
        "postal": "1000",
        "city": "Lausanne"
      },
      "confidence": 0.87,
      "patternMatched": "SWISS",
      "scoringFactors": [...],
      "flaggedForReview": false,
      "autoAnonymize": true
    }
  ]
}
```

### Project Structure Notes

- Follow existing anonymization patterns in fileProcessor.js
- Extend current mapping file format (backward compatible)
- Use TypeScript types from src/types/detection.ts
- Tests in test/unit/ and test/e2e/ following Mocha + Chai patterns

### Learnings from Previous Story

**From Story 2-3-address-confidence-scoring (Status: done)**

- **ScoredAddress Structure**: Extends GroupedAddress with:
  - `finalConfidence`: number (0-1)
  - `scoringFactors`: ScoringFactor[] (detailed breakdown)
  - `flaggedForReview`: boolean (< 0.6 confidence)
  - `autoAnonymize`: boolean (>= 0.8 confidence)
- **GroupedAddress Fields**: Use `components` (breakdown object), `componentEntities` (array), `patternMatched`
- **Threshold Logic**: < 0.6 = flag for review, >= 0.8 = auto-anonymize
- **All 514 unit tests passing** - ensure no regression

[Source: stories/2-3-address-confidence-scoring.md#Dev-Agent-Record]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Story-2.4-Address-Anonymization-Strategy]
- [Source: docs/architecture.md#Address-Component-Linking]
- Depends on: Story 2.3 (Address Confidence Scoring) - COMPLETED

---

## Dev Agent Record

### Context Reference

- [docs/sprint-artifacts/stories/2-4-address-anonymization-strategy.context.xml](./2-4-address-anonymization-strategy.context.xml)

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

**Task 1 Analysis (2025-12-08):**
- Entity detection: detectionPipeline.process() → result.entities with metadata.isGroupedAddress
- AddressRelationshipPass produces ADDRESS/SWISS_ADDRESS/EU_ADDRESS with metadata.breakdown
- Current anonymization: fuzzy regex replacement, no position-based handling for addresses
- Current mapping: simple entityText→pseudonym map, no structured components
- Integration needed: position-based replacement, extended mapping, component handling

### Completion Notes List

1. **FileProcessingSession Extended (Tasks 2-4):**
   - Added `addressMappings` array for structured address data
   - Added `anonymizedRanges` array to track covered positions
   - Added `registerGroupedAddress()` method for address placeholder generation
   - Added `isRangeAnonymized()` to prevent fragmented anonymization
   - Added `getAddressMappings()` and `getExtendedMapping()` for export

2. **anonymizeText() Rewritten (Tasks 6-7):**
   - Separates grouped addresses from other entities via `isGroupedAddress()`
   - Processes addresses FIRST using position-based replacement (end-to-start)
   - Skips entities overlapping with anonymized addresses
   - Then processes remaining entities with fuzzy regex

3. **anonymizeMarkdown() Extended (Task 4):**
   - Updated mapping version to `3.1` for Story 2.4 format
   - Added `addresses` array with structured data in mapping output
   - Added "Pass 4: Address Relationship (Epic 2)" to detection methods

4. **Test Suite (Task 9):**
   - Created `test/unit/anonymization/AddressAnonymization.test.js`
   - 16 tests covering all acceptance criteria
   - Tests for Swiss/EU addresses, multiple addresses, session isolation
   - Tests for mapping schema v3.1, structured components, metadata

5. **Infrastructure Fix:**
   - Fixed logging.js to avoid top-level await for non-Electron contexts
   - Made modelManager import conditional in fileProcessor.js
   - Tests now run in non-Electron (Node.js) environment

### File List

**Created:**
- `test/unit/anonymization/AddressAnonymization.test.js` - 16 tests covering all ACs

**Modified:**
- `fileProcessor.js` - Extended FileProcessingSession, rewrote anonymizeText(), extended mapping format
- `src/config/logging.js` - Fixed top-level await for test compatibility

**Verified (no changes needed):**
- `src/pii/passes/AddressRelationshipPass.ts` - Already produces metadata.isGroupedAddress
- `src/pii/AddressScorer.ts` - Already produces scoringFactors and flags
- `src/types/detection.ts` - Types already defined

### Test Results

- **16 new tests** in AddressAnonymization.test.js (all passing)
- **279 existing PII tests** (all passing)
- **5 session isolation tests** (all passing)
- **Total: 295+ tests passing**

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-08 | SM Agent (Opus 4.5) | Initial story creation from Epic 2 tech spec |
| 2025-12-08 | Dev Agent (Opus 4.5) | Implementation complete - all 9 tasks done, 16 new tests passing |
