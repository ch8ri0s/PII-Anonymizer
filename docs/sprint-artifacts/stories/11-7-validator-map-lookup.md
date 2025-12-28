# Story 11.7: Implement O(1) Validator Lookup

**Epic:** 11 - Validator Module Improvements
**Priority:** Medium
**Effort:** 1 SP
**Status:** Done

---

## Problem Statement

The `getValidatorForType()` function uses `Array.find()` which iterates through all validators for each lookup:

```typescript
export function getValidatorForType(
  type: ValidatorEntityType,
): ValidationRule | undefined {
  const validators = getAllValidators();
  return validators.find((v) => v.entityType === type);
}
```

### Performance Impact
- **Time Complexity:** O(n) where n = number of validators (currently 8)
- **Usage Pattern:** Called once per entity during validation
- **Document Impact:** For a document with 100 entities, this is 800 comparisons

While not critical with 8 validators, this becomes problematic if:
- More validators are added
- High-volume document processing is needed
- Real-time validation is required

## Acceptance Criteria

- [x] Map-based validator lookup
- [x] O(1) complexity for type lookups
- [x] Lazy initialization of map
- [x] Backward compatible API
- [x] Memory efficient (single map instance)
- [x] Handles unknown types gracefully

## Technical Approach

### Implementation
```typescript
// shared/pii/validators/index.ts

let validatorMap: Map<ValidatorEntityType, ValidationRule> | null = null;

/**
 * Get validator for specific entity type (O(1) lookup)
 *
 * Uses a lazily-initialized Map for constant-time lookups.
 *
 * @param type - The entity type to get validator for
 * @returns The validator for the type, or undefined if not found
 */
export function getValidatorForType(
  type: ValidatorEntityType,
): ValidationRule | undefined {
  if (!validatorMap) {
    validatorMap = new Map(
      getAllValidators().map(v => [v.entityType, v])
    );
  }
  return validatorMap.get(type);
}

/**
 * Reset validator map (for testing only)
 * @internal
 */
export function _resetValidatorMap(): void {
  validatorMap = null;
}
```

### Alternative: Combined Cache
If Story 11.3 (singleton) is implemented first, combine the caches:

```typescript
interface ValidatorCache {
  list: readonly ValidationRule[];
  map: Map<ValidatorEntityType, ValidationRule>;
}

let cache: ValidatorCache | null = null;

function getCache(): ValidatorCache {
  if (!cache) {
    const list = Object.freeze([
      new SwissAddressValidator(),
      // ...
    ]);
    const map = new Map(list.map(v => [v.entityType, v]));
    cache = { list, map };
  }
  return cache;
}

export function getAllValidators(): readonly ValidationRule[] {
  return getCache().list;
}

export function getValidatorForType(type: ValidatorEntityType): ValidationRule | undefined {
  return getCache().map.get(type);
}
```

## Files to Modify

1. `shared/pii/validators/index.ts` - Update lookup function

## Testing Requirements

### Unit Tests
```javascript
describe('getValidatorForType', () => {
  it('should return correct validator for each type', () => {
    const types = [
      'SWISS_ADDRESS', 'SWISS_AVS', 'IBAN', 'EMAIL',
      'PHONE', 'DATE', 'VAT_NUMBER'
    ];

    types.forEach(type => {
      const validator = getValidatorForType(type);
      expect(validator).to.exist;
      expect(validator.entityType).to.equal(type);
    });
  });

  it('should return undefined for unknown type', () => {
    const validator = getValidatorForType('UNKNOWN_TYPE');
    expect(validator).to.be.undefined;
  });

  it('should return same instance on multiple calls', () => {
    const first = getValidatorForType('EMAIL');
    const second = getValidatorForType('EMAIL');
    expect(first).to.equal(second);
  });
});
```

### Performance Test
```javascript
describe('Lookup performance', () => {
  it('should be faster than O(n) for many lookups', () => {
    const types = ['EMAIL', 'PHONE', 'IBAN', 'SWISS_AVS'];

    // Warm up cache
    types.forEach(t => getValidatorForType(t));

    const iterations = 100000;
    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
      getValidatorForType(types[i % types.length]);
    }

    const elapsed = Date.now() - start;

    // Should complete in < 100ms for 100k lookups
    expect(elapsed).to.be.lessThan(100);
  });
});
```

## Dependencies

- Story 11.3: Implement Singleton Pattern (recommended first for combined cache)

## Blocks

- None

## Notes

- Consider combining with Story 11.3 for cleaner implementation
- The `_resetValidatorMap()` is for testing isolation
- If multiple entity types map to same validator (Story 11.9), Map handles this naturally

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/11-7-validator-map-lookup.context.xml

### Implementation Summary

**Completed:** 2025-12-28

**Changes Made:**
1. Added `validatorMap` variable for O(1) type lookups (lazily initialized)
2. Modified `_resetValidatorsCache()` to also reset the map cache
3. Added `_resetValidatorMap()` for testing map initialization behavior
4. Updated `getValidatorForType()` to use `Map.get()` instead of `Array.find()`

**Files Modified:**
- `shared/pii/validators/index.ts` - Core implementation

**Files Created:**
- `test/unit/pii/validators/ValidatorMapLookup.test.js` - 19 tests

**Test Coverage:**
- Correct validator lookup for 7 entity types
- Unknown type handling (returns undefined)
- Singleton behavior verification
- Lazy initialization verification
- Performance tests: 100k lookups in <100ms, 1M lookups in <500ms
- Cache reset function tests

**Known Issue (Resolved):**
- SWISS_ADDRESS entityType collision was resolved by Story 11-9
- SwissPostalCodeValidator is now excluded from the registry
- Map correctly returns SwissAddressValidator for SWISS_ADDRESS type

---

## Senior Developer Review (AI)

**Reviewer:** Olivier
**Date:** 2025-12-28
**Outcome:** APPROVE

### Summary

Story 11.7 implements O(1) validator lookup using a Map-based cache. The implementation is clean, well-documented, and follows the established singleton pattern from Story 11.3. All acceptance criteria are met with comprehensive test coverage. The entityType collision issue (noted during implementation) was properly resolved by Story 11-9, which excluded SwissPostalCodeValidator from the registry.

### Key Findings

**No issues found.** Implementation is clean and complete.

### Acceptance Criteria Coverage

| AC# | Description | Status | Evidence |
|-----|-------------|--------|----------|
| AC1 | Map-based validator lookup | IMPLEMENTED | `shared/pii/validators/index.ts:186-191` |
| AC2 | O(1) complexity for type lookups | IMPLEMENTED | `index.ts:187-190` - Map.get() is O(1), test confirms 100k lookups in <26ms |
| AC3 | Lazy initialization of map | IMPLEMENTED | `index.ts:186` - `if (!validatorMap)` check |
| AC4 | Backward compatible API | IMPLEMENTED | `index.ts:183-185` - Same function signature |
| AC5 | Memory efficient (single map instance) | IMPLEMENTED | `index.ts:115` - Single `validatorMap` variable |
| AC6 | Handles unknown types gracefully | IMPLEMENTED | `index.ts:191` - `Map.get()` returns undefined |

**Summary: 6 of 6 acceptance criteria fully implemented**

### Task Completion Validation

| Task | Marked As | Verified As | Evidence |
|------|-----------|-------------|----------|
| Task 1: Implement Map-based lookup | [x] | VERIFIED | `index.ts:186-191` |
| Task 2: Add lazy initialization | [x] | VERIFIED | `index.ts:186` |
| Task 3: Backward compatible API | [x] | VERIFIED | `index.ts:183-185` |
| Task 4: Add `_resetValidatorMap()` | [x] | VERIFIED | `index.ts:169-171` |
| Task 5: Add unit tests | [x] | VERIFIED | `ValidatorMapLookup.test.js` - 19 tests |
| Task 6: Add performance test | [x] | VERIFIED | `ValidatorMapLookup.test.js:181-217` |

**Summary: 6 of 6 completed tasks verified, 0 questionable, 0 false completions**

### Test Coverage and Gaps

- **19 tests** covering all functionality
- **All entity types tested** individually (7 types)
- **Edge cases tested:** unknown types, empty strings, null values
- **Performance benchmarks:** 100k lookups in <100ms, 1M lookups in <500ms
- **No gaps identified**

### Architectural Alignment

- ✅ Follows singleton pattern from Story 11.3
- ✅ Map built from frozen `validatorsCache` (memory efficient)
- ✅ Lazy initialization avoids upfront cost
- ✅ TypeScript types properly constrained
- ✅ Story 11-9 collision resolution properly integrated

### Security Notes

- No security concerns - Map keys are typed as `ValidatorEntityType`
- No external dependencies introduced

### Best-Practices and References

- [MDN Map.get()](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/get) - O(1) average time complexity
- Lazy initialization pattern correctly implemented

### Action Items

**Code Changes Required:**
- None

**Advisory Notes:**
- Note: Implementation is complete and ready for production use

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-28 | 1.0 | Initial implementation - Map-based O(1) lookup |
| 2025-12-28 | 1.1 | Senior Developer Review notes appended - APPROVED |
