# Story 2.3: Address Confidence Scoring

Status: done

## Story

As a **PII detection system**,
I want **to calculate confidence scores for grouped addresses based on component completeness, pattern matching, and validation**,
so that **high-confidence addresses are auto-anonymized while uncertain groupings are flagged for user review**.

## Acceptance Criteria

| AC ID | Criterion |
|-------|-----------|
| AC-2.3.1 | Given a grouped address entity, confidence score includes +0.2 per component (max 5 components) |
| AC-2.3.2 | Pattern match adds +0.3 if matches known Swiss/EU format |
| AC-2.3.3 | Postal code validation adds +0.2 if valid Swiss/EU postal code |
| AC-2.3.4 | City validation adds +0.1 if matches known city |
| AC-2.3.5 | Addresses with confidence < 0.6 are flagged for user review |
| AC-2.3.6 | High-confidence addresses (>= 0.8) are auto-anonymized |

## Tasks / Subtasks

- [x] **Task 1: Extend AddressScorer configuration** (AC: 2.3.1, 2.3.2, 2.3.3, 2.3.4)
  - [x] Add configurable weight multipliers for each scoring factor
  - [x] Add configurable thresholds for review and auto-anonymize
  - [x] Create `AddressScorerConfig` interface with defaults
  - [x] Unit tests: verify config initialization and defaults

- [x] **Task 2: Implement component completeness scoring** (AC: 2.3.1)
  - [x] Calculate +0.2 per unique component type (STREET_NAME, STREET_NUMBER, POSTAL_CODE, CITY, COUNTRY)
  - [x] Cap maximum completeness score at 1.0 (5 components)
  - [x] Track which components are present vs missing
  - [x] Unit tests: verify scoring for 1, 2, 3, 4, 5 components

- [x] **Task 3: Implement pattern match scoring** (AC: 2.3.2)
  - [x] Add +0.3 for SWISS or EU pattern match
  - [x] Add +0.24 (0.3 * 0.8) for ALTERNATIVE pattern
  - [x] Add +0.15 (0.3 * 0.5) for PARTIAL pattern
  - [x] Add 0 for NONE pattern
  - [x] Unit tests: verify scoring for each pattern type

- [x] **Task 4: Implement postal code validation scoring** (AC: 2.3.3)
  - [x] Validate Swiss postal codes (4 digits, 1000-9999 range)
  - [x] Validate EU postal codes (5 digits for DE, FR, IT)
  - [x] Validate Austrian postal codes (4 digits)
  - [x] Add +0.2 for valid Swiss postal code with canton lookup
  - [x] Add +0.16 (0.2 * 0.8) for valid EU postal code format
  - [x] Add +0.14 (0.2 * 0.7) for possible Austrian postal code
  - [x] Add +0.06 (0.2 * 0.3) for unverified postal code
  - [x] Unit tests: verify scoring for various postal code formats

- [x] **Task 5: Implement city validation scoring** (AC: 2.3.4)
  - [x] Check city against Swiss city database (from AddressClassifier)
  - [x] Add +0.1 for known Swiss city
  - [x] Add +0.05 (0.1 * 0.5) for city following valid postal code
  - [x] Add +0.03 (0.1 * 0.3) for unverified city
  - [x] Unit tests: verify scoring for known vs unknown cities

- [x] **Task 6: Implement country presence scoring** (AC: 2.3.1)
  - [x] Add +0.1 for explicit country component
  - [x] Add +0.05 for CH prefix in postal code (implicit country)
  - [x] Unit tests: verify country scoring

- [x] **Task 7: Calculate final confidence score** (AC: 2.3.5, 2.3.6)
  - [x] Sum all factor scores and normalize to 0-1 range
  - [x] Set `flaggedForReview: true` if confidence < 0.6
  - [x] Set `autoAnonymize: true` if confidence >= 0.8
  - [x] Store individual scoring factors in `scoringFactors` array
  - [x] Unit tests: verify final score calculation and thresholds

- [x] **Task 8: Update Entity with scoring results** (AC: all)
  - [x] Create `updateEntityWithScore()` method
  - [x] Set entity confidence from scored address
  - [x] Add scoring metadata to entity
  - [x] Integration test: full scoring pipeline

- [x] **Task 9: Integration with AddressRelationshipPass** (AC: all)
  - [x] Ensure AddressRelationshipPass uses AddressScorer correctly
  - [x] Verify grouped addresses receive proper confidence scores
  - [x] Integration test: end-to-end address detection with scoring

- [x] **Task 10: Test suite** (AC: all)
  - [x] Create `test/unit/pii/address/AddressScorer.test.js`
  - [x] Test all scoring factors individually
  - [x] Test combined scoring scenarios
  - [x] Test threshold behavior (review vs auto-anonymize)
  - [x] Target: 20+ tests covering all ACs (43 tests created)

## Dev Notes

### Architecture Alignment

This story implements the confidence scoring phase of address relationship modeling as specified in Epic 2 tech spec. The AddressScorer calculates confidence scores based on multiple factors and determines whether addresses should be auto-anonymized or flagged for review.

**Component Location:**
- Scorer: `src/pii/AddressScorer.ts` (already exists, needs enhancement)
- Types: `src/types/detection.ts` (ScoringFactor, ScoredAddress)
- Tests: `test/unit/pii/address/AddressScorer.test.js`

**Data Flow:**
```
GroupedAddress[] (from AddressLinker)
    ↓
AddressScorer.scoreAddress(groupedAddress)
    ↓
ScoredAddress with:
  - finalConfidence: number (0-1)
  - scoringFactors: ScoringFactor[]
  - flaggedForReview: boolean
  - autoAnonymize: boolean
    ↓
Entity[] with confidence and review flags
```

### Scoring Formula (from Tech Spec)

```
Base Score Calculation:
  • Component completeness: +0.2 per component (max 1.0 for 5 components)
  • Pattern match: +0.3 for Swiss/EU, +0.1 for partial
  • Postal validation: +0.2 if valid Swiss/EU postal code
  • City validation: +0.1 if matches known city

Confidence Thresholds:
  • >= 0.8: HIGH (auto-anonymize)
  • 0.6-0.8: MEDIUM (include with warning)
  • < 0.6: LOW (flag for user review)
```

### Project Structure Notes

- Follow existing AddressScorer.ts patterns from Story 2.2
- Use `ScoringFactor` interface for detailed breakdown
- Use `ScoredAddress` interface extending `GroupedAddress`
- Tests in `test/unit/pii/address/` following Mocha + Chai patterns

### Learnings from Previous Story

**From Story 2-2-proximity-based-component-linking (Status: done)**

- **GroupedAddress Type Structure**: Use `components` field for breakdown object (street, number, postal, city, country) and `componentEntities` field for array of AddressComponent
- **AddressPatternType**: Use 'SWISS' | 'EU' | 'ALTERNATIVE' | 'PARTIAL' | 'NONE' enum values
- **AddressScorer.ts Already Updated**: The scorer was updated in Story 2.2 to use new type structure - build upon existing implementation
- **Field References**: Use `address.components.postal` (not `address.breakdown.postalCode`), `address.patternMatched` (not `address.patternType`)
- **Test Patterns**: Follow `test/unit/pii/address/AddressLinker.test.js` patterns - 26 tests covering all ACs
- **All 121 address tests pass** - ensure no regression

[Source: stories/2-2-proximity-based-component-linking.md#Dev-Agent-Record]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-2.md#Story-2.3-Address-Confidence-Scoring]
- [Source: docs/architecture.md#Address-Component-Linking]
- Depends on: Story 2.2 (Proximity-Based Component Linking) - COMPLETED

---

## Dev Agent Record

### Context Reference

- [docs/sprint-artifacts/stories/2-3-address-confidence-scoring.context.xml](./2-3-address-confidence-scoring.context.xml)

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: successful
- Test suite: 43 new tests, 514 total unit tests passing
- All acceptance criteria verified

### Completion Notes List

1. **Tasks 1-9 Already Implemented**: The AddressScorer.ts from Story 2.2 already contained all scoring logic:
   - `AddressScorerConfig` interface with configurable weights and thresholds
   - `scoreComponentCompleteness()` - +0.2 per unique component type
   - `scorePatternMatch()` - +0.3 for SWISS/EU, +0.24 for ALTERNATIVE, +0.15 for PARTIAL
   - `scorePostalCode()` - +0.2 for Swiss, +0.16 for EU, +0.14 for Austrian
   - `scoreCityValidation()` - +0.1 for known Swiss city
   - `scoreCountryPresence()` - +0.1 for explicit country
   - `updateEntityWithScore()` - copies scoring metadata to entity
   - Integration with AddressRelationshipPass via `scoreAddresses()`

2. **Task 10 (Test Suite)**: Created comprehensive test suite with 43 tests:
   - Configuration tests (3 tests)
   - AC-2.3.1 Component completeness (6 tests)
   - AC-2.3.2 Pattern match scoring (5 tests)
   - AC-2.3.3 Postal code validation (5 tests)
   - AC-2.3.4 City validation (5 tests)
   - Country presence scoring (3 tests)
   - AC-2.3.5 Review flagging (3 tests)
   - AC-2.3.6 Auto-anonymization (3 tests)
   - Final confidence calculation (3 tests)
   - Batch scoring (2 tests)
   - Entity update (2 tests)
   - Integration scenarios (3 tests)

3. **Legacy Test Updates**: Fixed `AddressModeling.test.js` to use Story 2.2 type structure:
   - Changed `breakdown.postalCode` to `components.postal`
   - Changed `patternType` to `patternMatched`
   - Updated pattern enum values from legacy to new format

### File List

**Created:**
- `test/unit/pii/address/AddressScorer.test.js` - 43 tests covering all ACs

**Modified:**
- `test/unit/pii/AddressModeling.test.js` - Updated to use Story 2.2 GroupedAddress structure

**Verified (no changes needed):**
- `src/pii/AddressScorer.ts` - Already implements all AC requirements
- `src/pii/passes/AddressRelationshipPass.ts` - Already integrates with scorer
- `src/types/detection.ts` - Types already defined

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-08 | SM Agent (Opus 4.5) | Initial story creation from Epic 2 tech spec |
| 2025-12-08 | Dev Agent (Opus 4.5) | Implementation complete - all 10 tasks done, 43 tests passing |
