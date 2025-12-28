# Story 11.9: Resolve Entity Type Collision

Status: done

## Story

As a **developer**,
I want **each validator to have a unique entity type identifier**,
so that **`getValidatorForType()` returns the correct validator and Map-based lookups work correctly**.

## Problem Statement

Both `SwissAddressValidator` and `SwissPostalCodeValidator` use the same entity type `'SWISS_ADDRESS'`:

```typescript
// SwissAddressValidator.ts (line 260)
export class SwissAddressValidator implements ValidationRule {
  entityType: ValidatorEntityType = 'SWISS_ADDRESS';
  // ...
}

// SwissPostalCodeValidator.ts (line 27)
export class SwissPostalCodeValidator implements ValidationRule {
  entityType: ValidatorEntityType = 'SWISS_ADDRESS';  // Same!
  // ...
}
```

### Impact

1. **Map Collision:** In the O(1) Map-based lookup (Story 11.7), `SwissPostalCodeValidator` overwrites `SwissAddressValidator` since they share the same key
2. **Ambiguous Lookup:** `getValidatorForType('SWISS_ADDRESS')` returns only one validator (the last one added to the Map)
3. **Semantic Confusion:** Postal code validation ≠ full address validation
4. **Test Discrepancy:** The array has 8 validators but the Map will only have 7 unique entries

### Current Behavior (from index.ts)

```typescript
validatorsCache = Object.freeze([
  new SwissAddressValidator(),      // entityType: 'SWISS_ADDRESS'
  new SwissAvsValidator(),          // entityType: 'SWISS_AVS'
  new IbanValidator(),              // entityType: 'IBAN'
  new EmailValidator(),             // entityType: 'EMAIL'
  new PhoneValidator(),             // entityType: 'PHONE'
  new DateValidator(),              // entityType: 'DATE'
  new SwissPostalCodeValidator(),   // entityType: 'SWISS_ADDRESS' ← COLLISION!
  new VatNumberValidator(),         // entityType: 'VAT_NUMBER'
]);
```

When `getValidatorForType()` builds its Map, `SwissPostalCodeValidator` overwrites `SwissAddressValidator` because they share the key `'SWISS_ADDRESS'`.

## Acceptance Criteria

1. - [x] Each validator has unique entity type OR clear internal role
2. - [x] `getValidatorForType('SWISS_ADDRESS')` returns `SwissAddressValidator`
3. - [x] No silent overwrites in Map-based lookup
4. - [x] Documentation clarifies validator relationships
5. - [x] Backward compatibility maintained for external consumers
6. - [x] All existing tests continue to pass

## Options Analysis

### Option A: Add New Entity Type `SWISS_POSTAL_CODE`

Add `'SWISS_POSTAL_CODE'` to `ValidatorEntityType`:

```typescript
export type ValidatorEntityType =
  | 'SWISS_AVS'
  | 'IBAN'
  | 'EMAIL'
  | 'PHONE'
  | 'DATE'
  | 'SWISS_ADDRESS'
  | 'SWISS_POSTAL_CODE'  // New
  | 'VAT_NUMBER';
```

**Pros:**
- Clear separation of concerns
- Each validator uniquely addressable
- Type-safe lookup
- Explicit in the type system

**Cons:**
- Breaking change for type consumers
- May need to update entity detection logic
- Creates two "address-related" types which may be confusing

### Option B: Make SwissPostalCodeValidator Internal (Recommended)

Keep `SwissPostalCodeValidator` as internal helper, remove from registry:

```typescript
// index.ts - Remove from getAllValidators
export function getAllValidators(): readonly ValidationRule[] {
  if (!validatorsCache) {
    validatorsCache = Object.freeze([
      new SwissAddressValidator(),
      new SwissAvsValidator(),
      new IbanValidator(),
      new EmailValidator(),
      new PhoneValidator(),
      new DateValidator(),
      // SwissPostalCodeValidator intentionally NOT included
      new VatNumberValidator(),
    ]);
  }
  return validatorsCache;
}
```

**Pros:**
- No type changes required
- Clear role: sub-validator/helper
- Still exported for direct use if needed
- Simpler - 7 validators in registry
- No breaking changes

**Cons:**
- Less discoverable (not in registry)
- Slightly confusing export pattern (exported but not registered)

### Option C: Composite Pattern

Make `SwissAddressValidator` use `SwissPostalCodeValidator` internally:

```typescript
export class SwissAddressValidator implements ValidationRule {
  private postalValidator = new SwissPostalCodeValidator();
  // Use internally for postal code portion validation
}
```

**Pros:**
- Clean composition
- Single registered validator for addresses
- Clear relationship between validators

**Cons:**
- Refactoring required
- May duplicate some logic
- More complex implementation

## Recommended Approach: Option B

1. Mark `SwissPostalCodeValidator` as `@internal` in JSDoc
2. Remove from `getAllValidators()` array
3. Keep exported for direct use
4. Document relationship in JSDoc
5. Update validator count in related tests (8 → 7)

## Tasks / Subtasks

- [x] Task 1: Update SwissPostalCodeValidator.ts (AC: #1, #4)
  - [x] Add `@internal` JSDoc annotation
  - [x] Add documentation explaining its role as sub-validator
  - [x] Keep entityType as 'SWISS_ADDRESS' (semantic - it validates part of an address)

- [x] Task 2: Update index.ts - Remove from registry (AC: #2, #3)
  - [x] Remove `new SwissPostalCodeValidator()` from `getAllValidators()` array
  - [x] Keep export statements (still usable directly)
  - [x] Add comment explaining why not in registry

- [x] Task 3: Update tests (AC: #5, #6)
  - [x] Update ValidatorSingleton.test.js - expect 7 validators instead of 8
  - [x] Add test verifying SwissPostalCodeValidator is NOT in registry
  - [x] Add test verifying SwissPostalCodeValidator is still importable and functional
  - [x] Verify `getValidatorForType('SWISS_ADDRESS')` returns `SwissAddressValidator`

- [x] Task 4: Verify no regressions (AC: #6)
  - [x] Run full test suite
  - [x] Verify FormatValidationPass still works correctly
  - [x] Verify browser-app detection pipeline still works

## Files to Modify

1. `shared/pii/validators/SwissPostalCodeValidator.ts` - Add `@internal` JSDoc
2. `shared/pii/validators/index.ts` - Remove from getAllValidators array
3. `test/unit/pii/validators/ValidatorSingleton.test.js` - Update validator count
4. `test/unit/pii/validators/SwissPostalCodeValidator.test.js` - Add registry exclusion test

## Dev Notes

### Learnings from Previous Story

**From Story 11.6 (Validator Test Coverage) - Status: done**

- All 8 validators now have dedicated test files
- `SwissPostalCodeValidator.test.js` exists with 45 tests
- Tests import from `shared/dist/pii/validators/index.js`
- Test pattern: use data-driven tests with arrays of test cases
- Tests verify both class interface and standalone functions

**From Story 11.3 (Singleton Pattern) - Status: done**

- Singleton pattern already implemented in `index.ts`
- `_resetValidatorsCache()` and `_resetValidatorMap()` available for test isolation
- Validators are instantiated once and cached

**From Story 11.7 (Map Lookup) - Status: in-progress**

- This story (11.9) directly affects Story 11.7
- The Map collision occurs when building the validator map
- Fixing this collision is required for correct Map-based lookups

[Source: stories/11-6-validator-test-coverage.md#Dev-Agent-Record]

### Architecture Patterns and Constraints

**Validator Registry Pattern:**
- `getAllValidators()` returns the canonical list of registered validators
- `getValidatorForType()` provides O(1) lookup by entity type
- Internal/helper validators should NOT be in the registry

**Import Patterns:**
```typescript
// External consumers use registry
import { getAllValidators, getValidatorForType } from 'shared/pii/validators';

// Direct use of internal validator (rare)
import { SwissPostalCodeValidator } from 'shared/pii/validators';
```

### Project Structure Notes

Files affected:
```
shared/pii/validators/
├── SwissPostalCodeValidator.ts  ← Add @internal, update JSDoc
├── index.ts                     ← Remove from getAllValidators
└── types.ts                     ← No changes needed
test/unit/pii/validators/
├── SwissPostalCodeValidator.test.js  ← Add registry exclusion test
└── ValidatorSingleton.test.js        ← Update validator count
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-11.md#Story-11.9]
- [Source: shared/pii/validators/index.ts - Current implementation]
- [Source: shared/pii/validators/SwissPostalCodeValidator.ts - Collision source]
- [Source: shared/pii/validators/SwissAddressValidator.ts - Primary address validator]

## Dependencies

- Story 11.3: Singleton Pattern - DONE (provides caching infrastructure)
- Story 11.7: Map Lookup - IN-PROGRESS (this story fixes a collision that affects it)

## Blocks

- Story 11.10: Validator Registry Pattern (depends on clean registry with unique types)

## Testing Requirements

### Unit Tests

```javascript
describe('Validator registry', () => {
  it('should have 7 registered validators', () => {
    const validators = getAllValidators();
    expect(validators).to.have.lengthOf(7);
  });

  it('should not include SwissPostalCodeValidator in registry', () => {
    const validators = getAllValidators();
    const names = validators.map(v => v.name);
    expect(names).to.not.include('SwissPostalCodeValidator');
  });

  it('should return SwissAddressValidator for SWISS_ADDRESS type', () => {
    const validator = getValidatorForType('SWISS_ADDRESS');
    expect(validator).to.exist;
    expect(validator.name).to.equal('SwissAddressValidator');
  });

  it('should still export SwissPostalCodeValidator for direct use', () => {
    expect(SwissPostalCodeValidator).to.exist;
    const validator = new SwissPostalCodeValidator();
    expect(validator.validate({ text: '1000' }).isValid).to.be.true;
  });
});
```

### Regression Tests

- All existing validator tests should pass
- FormatValidationPass integration tests should pass
- Browser-app PII detection should work correctly

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/11-9-resolve-entity-type-collision.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

Implementation followed Option B from the story analysis - marking SwissPostalCodeValidator as @internal and removing from registry.

### Completion Notes List

- Added comprehensive `@internal` JSDoc to SwissPostalCodeValidator.ts (module-level and class-level)
- Removed SwissPostalCodeValidator from getAllValidators() array in index.ts
- Added explanatory comments in index.ts about the intentional exclusion
- Updated ValidatorSingleton.test.js to expect 7 validators (was 8)
- Added new test "should NOT include SwissPostalCodeValidator in registry (Story 11.9)"
- Added 6 new registry exclusion tests in SwissPostalCodeValidator.test.js
- Updated ValidatorMapLookup.test.js to expect SwissAddressValidator for SWISS_ADDRESS type
- All 2238 tests passing with 0 failures

### File List

**Modified:**
- shared/pii/validators/SwissPostalCodeValidator.ts - Added @internal JSDoc annotations
- shared/pii/validators/index.ts - Removed from getAllValidators(), added comments
- test/unit/pii/validators/ValidatorSingleton.test.js - Updated count to 7, added exclusion test
- test/unit/pii/validators/SwissPostalCodeValidator.test.js - Added 6 registry exclusion tests
- test/unit/pii/validators/ValidatorMapLookup.test.js - Updated SWISS_ADDRESS test expectation

## Change Log

| Date | Author | Description |
|------|--------|-------------|
| 2025-12-28 | create-story workflow | Initial story draft created |
| 2025-12-28 | create-story workflow | Updated with learnings from Story 11.6, complete implementation details |
| 2025-12-28 | dev-story workflow | Implemented Option B - marked SwissPostalCodeValidator as @internal and excluded from registry. 2238 tests passing. |
| 2025-12-28 | code-review workflow | Senior Developer Review completed - APPROVED |

---

## Senior Developer Review (AI)

### Review Metadata

- **Reviewer:** Olivier
- **Date:** 2025-12-28
- **Outcome:** ✅ **APPROVED**
- **Story:** 11.9 - Resolve Entity Type Collision
- **Story Key:** 11-9-resolve-entity-type-collision

### Summary

Excellent implementation of Option B from the story analysis. The entityType collision between `SwissPostalCodeValidator` and `SwissAddressValidator` has been cleanly resolved by marking `SwissPostalCodeValidator` as `@internal` and removing it from the validator registry while maintaining backward compatibility through continued exports. All 6 acceptance criteria are fully met with comprehensive test coverage.

### Acceptance Criteria Coverage

| AC# | Description | Status | Evidence |
|-----|-------------|--------|----------|
| 1 | Each validator has unique entity type OR clear internal role | ✅ IMPLEMENTED | `shared/pii/validators/SwissPostalCodeValidator.ts:7-14` - Module-level `@internal` JSDoc; Lines 30-32 class-level `@internal` |
| 2 | `getValidatorForType('SWISS_ADDRESS')` returns `SwissAddressValidator` | ✅ IMPLEMENTED | `shared/pii/validators/index.ts:131-145` - getAllValidators() now has 7 validators, SwissPostalCodeValidator excluded; Test at `test/unit/pii/validators/ValidatorMapLookup.test.js:45-52` |
| 3 | No silent overwrites in Map-based lookup | ✅ IMPLEMENTED | `shared/pii/validators/index.ts:133-142` - Only 7 validators with unique entityTypes; Test at `test/unit/pii/validators/SwissPostalCodeValidator.test.js:276-284` verifies only 1 SWISS_ADDRESS validator in registry |
| 4 | Documentation clarifies validator relationships | ✅ IMPLEMENTED | `shared/pii/validators/SwissPostalCodeValidator.ts:7-14` - Module JSDoc explains exclusion; `index.ts:77-78,92-95,124-127` - Multiple comments explaining the intentional exclusion |
| 5 | Backward compatibility maintained for external consumers | ✅ IMPLEMENTED | `shared/pii/validators/index.ts:79-83` - SwissPostalCodeValidator still exported; Test at `test/unit/pii/validators/SwissPostalCodeValidator.test.js:257-267` verifies direct import and instantiation works |
| 6 | All existing tests continue to pass | ✅ IMPLEMENTED | 2238 tests passing (0 failures); 536 validator tests specifically verified |

**Summary: 6 of 6 acceptance criteria fully implemented**

### Task Completion Validation

| Task | Marked As | Verified As | Evidence |
|------|-----------|-------------|----------|
| Task 1: Update SwissPostalCodeValidator.ts | ✅ Complete | ✅ VERIFIED | `shared/pii/validators/SwissPostalCodeValidator.ts:7-14` (module `@internal`), lines 30-44 (class `@internal` with example) |
| Task 1.1: Add `@internal` JSDoc annotation | ✅ Complete | ✅ VERIFIED | Lines 7, 30 contain `@internal` tags |
| Task 1.2: Add documentation explaining role | ✅ Complete | ✅ VERIFIED | Lines 7-14, 30-44 explain sub-validator role and usage pattern |
| Task 1.3: Keep entityType as 'SWISS_ADDRESS' | ✅ Complete | ✅ VERIFIED | Line 50: `entityType: ValidatorEntityType = 'SWISS_ADDRESS'` |
| Task 2: Update index.ts - Remove from registry | ✅ Complete | ✅ VERIFIED | `shared/pii/validators/index.ts:131-145` - SwissPostalCodeValidator NOT in array |
| Task 2.1: Remove from getAllValidators() array | ✅ Complete | ✅ VERIFIED | Line 140: `// SwissPostalCodeValidator intentionally NOT included` |
| Task 2.2: Keep export statements | ✅ Complete | ✅ VERIFIED | Lines 79-83: exports maintained for direct use |
| Task 2.3: Add comment explaining why not in registry | ✅ Complete | ✅ VERIFIED | Lines 77-78, 92-95, 124-127, 140 all have explanatory comments |
| Task 3: Update tests | ✅ Complete | ✅ VERIFIED | See below |
| Task 3.1: Update ValidatorSingleton.test.js - expect 7 | ✅ Complete | ✅ VERIFIED | `test/unit/pii/validators/ValidatorSingleton.test.js:51-55` - expects lengthOf(7) |
| Task 3.2: Add test verifying exclusion from registry | ✅ Complete | ✅ VERIFIED | `ValidatorSingleton.test.js:67-73` and `SwissPostalCodeValidator.test.js:251-255` |
| Task 3.3: Add test verifying still importable | ✅ Complete | ✅ VERIFIED | `SwissPostalCodeValidator.test.js:257-260,262-267` |
| Task 3.4: Verify SWISS_ADDRESS returns SwissAddressValidator | ✅ Complete | ✅ VERIFIED | `ValidatorMapLookup.test.js:45-52`, `SwissPostalCodeValidator.test.js:269-274` |
| Task 4: Verify no regressions | ✅ Complete | ✅ VERIFIED | 2238 tests passing with 0 failures |
| Task 4.1: Run full test suite | ✅ Complete | ✅ VERIFIED | `npm test` executed successfully |
| Task 4.2: Verify FormatValidationPass works | ✅ Complete | ✅ VERIFIED | Integration tests pass (part of 2238 tests) |
| Task 4.3: Verify browser-app detection pipeline | ✅ Complete | ✅ VERIFIED | No browser-app test failures |

**Summary: 17 of 17 tasks/subtasks verified complete, 0 questionable, 0 falsely marked**

### Test Coverage and Gaps

**New Tests Added:**
- `ValidatorSingleton.test.js:67-73` - Verifies SwissPostalCodeValidator NOT in registry
- `SwissPostalCodeValidator.test.js:231-286` - 6 new "Registry exclusion (Story 11.9)" tests

**Test Coverage:**
- ✅ Registry exclusion verified (2 tests in different files)
- ✅ Direct import/use still works (2 tests)
- ✅ getValidatorForType('SWISS_ADDRESS') returns correct validator (2 tests)
- ✅ Only 1 SWISS_ADDRESS validator in registry (1 test)
- ✅ Full regression suite passing (2238 tests)

**No gaps identified.**

### Architectural Alignment

- ✅ Follows singleton pattern from Story 11.3
- ✅ Aligns with O(1) Map lookup from Story 11.7
- ✅ Maintains backward compatibility per CLAUDE.md guidelines
- ✅ Uses `@internal` JSDoc annotation (TypeScript convention)
- ✅ No breaking changes to public API

### Security Notes

- ✅ No security concerns - this is an internal refactoring
- ✅ MAX_LENGTH ReDoS protection unchanged (line 48)
- ✅ No new attack vectors introduced

### Best-Practices and References

- [TypeScript @internal tag](https://www.typescriptlang.org/tsconfig#stripInternal) - Proper use of `@internal` for marking non-public APIs
- [ES Module exports](https://nodejs.org/api/esm.html) - Correct pattern of exporting but not including in registry
- Singleton pattern maintained correctly per Story 11.3

### Action Items

**Code Changes Required:**
*None - implementation is complete and meets all criteria*

**Advisory Notes:**
- Note: Consider documenting the "exported but not registered" pattern in CLAUDE.md for future reference
- Note: Story 11.10 (Validator Registry Pattern) can now proceed as this collision is resolved

### Review Decision

**✅ APPROVED** - All acceptance criteria met, all tasks verified complete, comprehensive test coverage, no security concerns, follows architectural patterns. Ready to merge.
