# Story 11.5: Extract Confidence Constants

**Epic:** 11 - Validator Module Improvements
**Priority:** Medium
**Effort:** 2 SP
**Status:** Done

## Dev Agent Record

### Context Reference
- `docs/sprint-artifacts/stories/11-5-extract-confidence-constants.context.xml`

### Debug Log
- 2025-12-28: Started implementation - creating confidence.ts with 9 named constants
- Updated all 8 validators to import and use CONFIDENCE constants
- Created comprehensive unit tests (15 tests)
- All 2181 tests pass with no regressions

### Completion Notes
Successfully extracted all magic confidence numbers to named constants:
- Created `shared/pii/validators/confidence.ts` with CONFIDENCE object
- Added JSDoc documentation for each confidence level
- Updated all 8 validators: SwissAvsValidator, IbanValidator, EmailValidator, PhoneValidator, DateValidator, SwissPostalCodeValidator, SwissAddressValidator, VatNumberValidator
- Exported constants from `shared/pii/validators/index.ts`
- Created 15 unit tests in `test/unit/pii/validators/Confidence.test.js`

### File List
**New Files:**
- `shared/pii/validators/confidence.ts` - CONFIDENCE constants with JSDoc

**Modified Files:**
- `shared/pii/validators/index.ts` - Added export for CONFIDENCE
- `shared/pii/validators/SwissAvsValidator.ts` - Uses CONFIDENCE constants
- `shared/pii/validators/IbanValidator.ts` - Uses CONFIDENCE constants
- `shared/pii/validators/EmailValidator.ts` - Uses CONFIDENCE constants
- `shared/pii/validators/PhoneValidator.ts` - Uses CONFIDENCE constants
- `shared/pii/validators/DateValidator.ts` - Uses CONFIDENCE constants
- `shared/pii/validators/SwissPostalCodeValidator.ts` - Uses CONFIDENCE constants
- `shared/pii/validators/SwissAddressValidator.ts` - Uses CONFIDENCE constants
- `shared/pii/validators/VatNumberValidator.ts` - Uses CONFIDENCE constants

**Test Files:**
- `test/unit/pii/validators/Confidence.test.js` - 15 new tests

### Change Log
- 2025-12-28: Implemented Story 11.5 - Extracted confidence constants (2181 tests passing)
- 2025-12-28: Senior Developer Review (AI) - APPROVED

---

## Problem Statement

Magic confidence values are scattered across validator files without explanation:

| Value | Occurrences | Meaning (Implicit) |
|-------|-------------|-------------------|
| 0.95 | SwissAvsValidator, IbanValidator | Checksum validated |
| 0.9 | EmailValidator, VatNumberValidator | Strong format match |
| 0.85 | DateValidator, SwissPostalCodeValidator, SwissAddressValidator | Standard validation |
| 0.82 | SwissAddressValidator | Valid address |
| 0.75 | PhoneValidator, IbanValidator, VatNumberValidator, SwissAddressValidator | Partial validation |
| 0.5 | PhoneValidator | Weak match |
| 0.4 | Multiple validators | Invalid format |
| 0.3 | Multiple validators | Validation failed |
| 0.2 | SwissAddressValidator | False positive indicator |

### Issues
1. **Unclear Meaning:** No documentation of what each level represents
2. **Inconsistency Risk:** Similar validations may use different values
3. **Hard to Tune:** Changing thresholds requires finding all occurrences
4. **Code Smell:** Magic numbers violate clean code principles

## Acceptance Criteria

- [x] Named constants for all confidence levels
- [x] JSDoc documentation explaining each level
- [x] Consistent usage across all validators
- [x] Single file to adjust thresholds globally
- [x] No magic numbers in validator files

## Technical Approach

### New File: `shared/pii/validators/confidence.ts`
```typescript
/**
 * Confidence Level Constants
 *
 * Standardized confidence values for PII validation results.
 * Higher values indicate stronger certainty in the validation outcome.
 *
 * @module shared/pii/validators/confidence
 */

/**
 * Validation confidence levels
 */
export const CONFIDENCE = {
  /**
   * Checksum-validated entity (AVS, IBAN)
   * Mathematical verification passed - highest certainty
   */
  CHECKSUM_VALID: 0.95,

  /**
   * Strong format match with additional validation
   * Format correct + secondary checks passed
   */
  FORMAT_VALID: 0.9,

  /**
   * Standard format validation passed
   * Format matches expected pattern
   */
  STANDARD: 0.85,

  /**
   * Known valid entity in expected range
   * Matches known data (city names, postal codes)
   */
  KNOWN_VALID: 0.82,

  /**
   * Partial validation passed
   * Some checks passed, others not applicable
   */
  MODERATE: 0.75,

  /**
   * Weak match requiring context
   * Format recognized but needs additional signals
   */
  WEAK: 0.5,

  /**
   * Format invalid but entity type recognized
   * Looks like the entity type but fails validation
   */
  INVALID_FORMAT: 0.4,

  /**
   * Validation failed
   * Does not match expected format
   */
  FAILED: 0.3,

  /**
   * Strong false positive indicator
   * Detected as something else (e.g., year vs postal code)
   */
  FALSE_POSITIVE: 0.2,
} as const;

/**
 * Type for confidence level keys
 */
export type ConfidenceLevel = keyof typeof CONFIDENCE;

/**
 * Type for confidence values
 */
export type ConfidenceValue = typeof CONFIDENCE[ConfidenceLevel];
```

### Usage Example
```typescript
// Before
return {
  isValid: true,
  confidence: 0.95,
};

// After
import { CONFIDENCE } from './confidence.js';

return {
  isValid: true,
  confidence: CONFIDENCE.CHECKSUM_VALID,
};
```

## Files to Modify

1. `shared/pii/validators/confidence.ts` - New file
2. `shared/pii/validators/index.ts` - Export constants
3. `shared/pii/validators/SwissAddressValidator.ts` - Use constants
4. `shared/pii/validators/SwissAvsValidator.ts` - Use constants
5. `shared/pii/validators/IbanValidator.ts` - Use constants
6. `shared/pii/validators/EmailValidator.ts` - Use constants
7. `shared/pii/validators/PhoneValidator.ts` - Use constants
8. `shared/pii/validators/DateValidator.ts` - Use constants
9. `shared/pii/validators/SwissPostalCodeValidator.ts` - Use constants
10. `shared/pii/validators/VatNumberValidator.ts` - Use constants

## Implementation Steps

1. Create `confidence.ts` with all constants
2. Export from `index.ts`
3. Update each validator file:
   - Add import
   - Replace magic numbers with constants
   - Ensure correct constant is used for each case
4. Review for consistency
5. Run tests

## Testing Requirements

### Unit Tests
```javascript
describe('Confidence constants', () => {
  it('should export all confidence levels', () => {
    expect(CONFIDENCE.CHECKSUM_VALID).to.equal(0.95);
    expect(CONFIDENCE.FORMAT_VALID).to.equal(0.9);
    expect(CONFIDENCE.STANDARD).to.equal(0.85);
    expect(CONFIDENCE.KNOWN_VALID).to.equal(0.82);
    expect(CONFIDENCE.MODERATE).to.equal(0.75);
    expect(CONFIDENCE.WEAK).to.equal(0.5);
    expect(CONFIDENCE.INVALID_FORMAT).to.equal(0.4);
    expect(CONFIDENCE.FAILED).to.equal(0.3);
    expect(CONFIDENCE.FALSE_POSITIVE).to.equal(0.2);
  });

  it('should be in descending order', () => {
    const values = Object.values(CONFIDENCE);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).to.be.lessThan(values[i - 1]);
    }
  });
});
```

### Regression Tests
- All existing validator tests should pass
- Confidence values in results should be unchanged

## Dependencies

- None (can be implemented independently)

## Blocks

- None

## Notes

- Consider grouping by validation outcome (valid/invalid) if clearer
- May want to add threshold constants for decision making
- Could extend with per-entity-type confidence ranges

---

## Senior Developer Review (AI)

**Reviewer:** Olivier
**Date:** 2025-12-28
**Outcome:** ✅ APPROVE

### Summary

Excellent implementation of confidence constant extraction. All magic numbers have been replaced with well-documented named constants. The implementation follows clean code principles and maintains backward compatibility. All 2181 tests pass.

### Key Findings

No significant issues found. Implementation is clean and complete.

#### Low Severity
- Note: The `CONFIDENCE` object uses `as const` but is not `Object.freeze()` at runtime. This is acceptable since TypeScript's type system prevents modification at compile time.

### Acceptance Criteria Coverage

| AC# | Description | Status | Evidence |
|-----|-------------|--------|----------|
| AC1 | Named constants for all confidence levels | ✅ IMPLEMENTED | `shared/pii/validators/confidence.ts:13-67` - 9 named constants: CHECKSUM_VALID, FORMAT_VALID, STANDARD, KNOWN_VALID, MODERATE, WEAK, INVALID_FORMAT, FAILED, FALSE_POSITIVE |
| AC2 | JSDoc documentation explaining each level | ✅ IMPLEMENTED | `shared/pii/validators/confidence.ts:14-66` - Each constant has JSDoc explaining its semantic meaning |
| AC3 | Consistent usage across all validators | ✅ IMPLEMENTED | All 8 validators import and use CONFIDENCE constants: SwissAvsValidator.ts:17, IbanValidator.ts:17, EmailValidator.ts:15, PhoneValidator.ts:15, DateValidator.ts:16, SwissPostalCodeValidator.ts:16, SwissAddressValidator.ts:79, VatNumberValidator.ts:17 |
| AC4 | Single file to adjust thresholds globally | ✅ IMPLEMENTED | `shared/pii/validators/confidence.ts` - All confidence values defined in one location |
| AC5 | No magic numbers in validator files | ✅ IMPLEMENTED | Verified with grep: `confidence:\s*0\.\d+` returns no matches in shared/pii/validators/*.ts |

**Summary: 5 of 5 acceptance criteria fully implemented**

### Task Completion Validation

| Task | Marked As | Verified As | Evidence |
|------|-----------|-------------|----------|
| Create confidence.ts with all constants | ✅ Complete | ✅ Verified | `shared/pii/validators/confidence.ts` exists with 9 constants |
| Export from index.ts | ✅ Complete | ✅ Verified | `shared/pii/validators/index.ts:19-21` exports CONFIDENCE, ConfidenceLevel, ConfidenceValue |
| Update SwissAddressValidator.ts | ✅ Complete | ✅ Verified | Line 79: import, 12 usages of CONFIDENCE.* |
| Update SwissAvsValidator.ts | ✅ Complete | ✅ Verified | Line 17: import, 5 usages of CONFIDENCE.* |
| Update IbanValidator.ts | ✅ Complete | ✅ Verified | Line 17: import, 5 usages of CONFIDENCE.* |
| Update EmailValidator.ts | ✅ Complete | ✅ Verified | Line 15: import, 5 usages of CONFIDENCE.* |
| Update PhoneValidator.ts | ✅ Complete | ✅ Verified | Line 15: import, 5 usages of CONFIDENCE.* |
| Update DateValidator.ts | ✅ Complete | ✅ Verified | Line 16: import, 6 usages of CONFIDENCE.* |
| Update SwissPostalCodeValidator.ts | ✅ Complete | ✅ Verified | Line 16: import, 4 usages of CONFIDENCE.* |
| Update VatNumberValidator.ts | ✅ Complete | ✅ Verified | Line 17: import, 6 usages of CONFIDENCE.* |
| Run tests | ✅ Complete | ✅ Verified | 2181 tests passing, 15 new confidence tests |

**Summary: 11 of 11 completed tasks verified, 0 questionable, 0 falsely marked complete**

### Test Coverage and Gaps

- ✅ New test file: `test/unit/pii/validators/Confidence.test.js` with 15 tests
- ✅ Tests verify all constant values, ordering, and semantic relationships
- ✅ All existing validator tests continue to pass (regression verified)
- ✅ No test gaps identified

### Architectural Alignment

- ✅ Follows existing module pattern (types.ts for interfaces, validators for implementation)
- ✅ Constants exported from shared module for use in both Electron and browser-app
- ✅ Uses `as const` assertion for type safety
- ✅ TypeScript compilation successful

### Security Notes

- No security issues identified
- Constants are immutable at TypeScript level

### Best-Practices and References

- [Clean Code: Magic Numbers](https://refactoring.guru/smells/magic-number) - Properly addressed by extracting to named constants
- TypeScript `as const` for literal type preservation

### Action Items

**Code Changes Required:**
- None required

**Advisory Notes:**
- Note: Consider adding `Object.freeze(CONFIDENCE)` at runtime if runtime immutability is desired (low priority)
- Note: Future enhancement: Add threshold constants (e.g., `CONFIDENCE_THRESHOLD_HIGH = 0.8`) for decision-making logic
