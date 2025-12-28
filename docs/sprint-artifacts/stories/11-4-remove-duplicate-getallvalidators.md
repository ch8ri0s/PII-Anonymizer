# Story 11.4: Remove Duplicate getAllValidators()

Status: done
Completed: 2025-12-28

## Story

As a **developer**,
I want **`src/pii/validators/index.ts` to re-export `getAllValidators()` from shared instead of duplicating it**,
so that **there is a single source of truth for validator instantiation, reducing maintenance burden and preventing inconsistencies**.

## Problem Statement

The `getAllValidators()` function is implemented in two places:

### Location 1: `shared/pii/validators/index.ts` (Canonical)
```typescript
let validatorsCache: readonly ValidationRule[] | null = null;

export function getAllValidators(): readonly ValidationRule[] {
  if (!validatorsCache) {
    validatorsCache = Object.freeze([...]);
  }
  return validatorsCache;
}
```

### Location 2: `src/pii/validators/index.ts` (Duplicate)
```typescript
export function getAllValidators(): SharedValidationRule[] {
  return [
    new SwissAddressValidator(),
    new SwissAvsValidator(),
    // ... 8 validators - NOT using singleton!
  ];
}
```

### Issues
1. **DRY Violation:** Same logic duplicated in two files
2. **Singleton Bypassed:** `src/` version creates new instances every call, defeating Story 11.3's optimization
3. **Maintenance Risk:** Changes must be made in both places
4. **Inconsistency Risk:** Implementations can diverge (already have - no caching in `src/`)

## Acceptance Criteria

1. - [x] `src/pii/validators/index.ts` re-exports `getAllValidators` from shared
2. - [x] `src/pii/validators/index.ts` re-exports `getValidatorForType` from shared
3. - [x] `src/pii/validators/index.ts` re-exports `_resetValidatorsCache` from shared
4. - [x] No duplicate function implementations remain
5. - [x] All existing imports continue to work
6. - [x] Type compatibility maintained (return type is `readonly ValidationRule[]`)
7. - [x] Tests pass without modification

## Tasks / Subtasks

- [ ] Task 1: Update re-exports in `src/pii/validators/index.ts` (AC: #1, #2, #3)
  - [ ] Add `getAllValidators` to the export block from shared
  - [ ] Add `getValidatorForType` to the export block from shared
  - [ ] Add `_resetValidatorsCache` to the export block from shared

- [ ] Task 2: Remove duplicate implementations (AC: #4)
  - [ ] Delete the local `getAllValidators()` function definition
  - [ ] Delete the local `getValidatorForType()` function definition
  - [ ] Remove now-unused validator class imports (used only in deleted functions)

- [ ] Task 3: Verify type compatibility (AC: #5, #6)
  - [ ] Ensure `FormatValidationPass` works with readonly array
  - [ ] Check that all callers handle `readonly ValidationRule[]` return type
  - [ ] Run TypeScript type check

- [ ] Task 4: Run tests (AC: #7)
  - [ ] Run full test suite
  - [ ] Verify no regressions in validator functionality
  - [ ] Verify FormatValidationPass integration works

## Technical Approach

### Current State (`src/pii/validators/index.ts`)
```typescript
// Import for local use (REMOVE - only needed for duplicate functions)
import {
  SwissAddressValidator,
  SwissAvsValidator,
  // ...
} from '../../../shared/dist/pii/validators/index.js';

// DUPLICATE - REMOVE this
export function getAllValidators(): SharedValidationRule[] {
  return [
    new SwissAddressValidator(),
    // ...
  ];
}

// DUPLICATE - REMOVE this
export function getValidatorForType(
  type: EntityType,
): SharedValidationRule | undefined {
  const validators = getAllValidators();
  return validators.find((v) => v.entityType === type);
}
```

### Target State
```typescript
// Re-export all validators and utility functions from shared
export {
  // Types
  type ValidatorEntityType,
  type ValidatorEntity,
  type ValidationResult as SharedValidationResult,
  type ValidationRule as SharedValidationRule,
  type ValidationContext,
  type AddressValidationResult,
  // Validators
  SwissAddressValidator,
  validateSwissAddress,
  validateSwissAddressFull,
  SwissAvsValidator,
  validateSwissAvs,
  validateSwissAvsFull,
  IbanValidator,
  validateIban,
  validateIbanFull,
  EmailValidator,
  validateEmail,
  validateEmailFull,
  PhoneValidator,
  validatePhone,
  validatePhoneFull,
  DateValidator,
  validateDate,
  validateDateFull,
  SwissPostalCodeValidator,
  validateSwissPostalCode,
  validateSwissPostalCodeFull,
  VatNumberValidator,
  validateVatNumber,
  validateVatNumberFull,
  // Utility functions (from shared - NOT duplicated)
  getAllValidators,
  getValidatorForType,
  _resetValidatorsCache,
} from '../../../shared/dist/pii/validators/index.js';

// Re-export the ValidationRule type for use by FormatValidationPass
export type { SharedValidationRule as ValidationRule };
```

## Dev Notes

### Learnings from Previous Story (11.3)

Story 11.3 implemented the singleton pattern in `shared/pii/validators/index.ts`:
- Added `validatorsCache` module-level variable
- `getAllValidators()` now returns frozen, cached array
- Added `_resetValidatorsCache()` for test isolation
- Return type changed to `readonly ValidationRule[]`

**Critical insight:** The `src/` duplicate does NOT have these optimizations, meaning callers via `src/pii/validators/` are creating 8 new objects per call while callers via `shared/` get the singleton. This inconsistency must be fixed.

[Source: stories/11-3-validator-singleton-pattern.md]

### Architecture Patterns and Constraints

**Single Source of Truth:**
- All validator functionality should come from `shared/pii/validators/`
- `src/pii/validators/` should only re-export, never implement

**Import Path Compatibility:**
- Existing code imports from `../../pii/validators/index.js` (relative to src/)
- Re-exports maintain this import path while delegating to shared

**Type Re-exports:**
- `ValidationRule` re-exported as `SharedValidationRule` for clarity
- Also re-exported as `ValidationRule` for backward compatibility

### Project Structure Notes

Files to modify:
- `src/pii/validators/index.ts` - Remove duplicates, add re-exports

Callers to verify:
- `src/pii/passes/FormatValidationPass.ts` - Primary consumer
- Tests in `test/` that import from `src/pii/validators/`

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-11.md#Story-11.4]
- [Source: shared/pii/validators/index.ts - Canonical implementation]
- [Source: src/pii/validators/index.ts - File to refactor]

## Dependencies

- Story 11.3: Implement Singleton Pattern (provides the canonical implementation to re-export)

## Blocks

- None

## Testing Requirements

### Verification Tests
```javascript
describe('Validator exports', () => {
  it('should export getAllValidators from shared', () => {
    const srcGetAll = require('../../src/pii/validators').getAllValidators;
    const sharedGetAll = require('../../shared/dist/pii/validators').getAllValidators;

    // Should be the same function reference
    expect(srcGetAll).to.equal(sharedGetAll);
  });

  it('should export getValidatorForType from shared', () => {
    const srcGetType = require('../../src/pii/validators').getValidatorForType;
    const sharedGetType = require('../../shared/dist/pii/validators').getValidatorForType;

    expect(srcGetType).to.equal(sharedGetType);
  });

  it('should export _resetValidatorsCache from shared', () => {
    const srcReset = require('../../src/pii/validators')._resetValidatorsCache;
    const sharedReset = require('../../shared/dist/pii/validators')._resetValidatorsCache;

    expect(srcReset).to.equal(sharedReset);
  });

  it('should return singleton from src import path', () => {
    const { getAllValidators } = require('../../src/pii/validators');

    const first = getAllValidators();
    const second = getAllValidators();

    expect(first).to.equal(second); // Same reference
    expect(Object.isFrozen(first)).to.be.true;
  });
});
```

### Regression Tests
- All existing validator tests should pass unchanged
- FormatValidationPass should work correctly with readonly array
- No import errors in any module

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

## Change Log

| Date | Author | Description |
|------|--------|-------------|
| 2025-12-28 | create-story workflow | Initial story draft created |
| 2025-12-28 | create-story workflow | Enhanced with learnings from Story 11.3 |
