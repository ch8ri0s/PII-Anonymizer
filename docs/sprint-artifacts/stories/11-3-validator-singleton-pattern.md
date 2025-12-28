# Story 11.3: Implement Singleton Pattern for Validators

Status: done
Completed: 2025-12-28

## Story

As a **developer**,
I want **validators to be instantiated once and cached**,
so that **memory allocation is reduced and GC pressure is minimized during document processing**.

## Problem Statement

The `getAllValidators()` function in `shared/pii/validators/index.ts` creates 8 new validator instances on every call:

```typescript
export function getAllValidators(): ValidationRule[] {
  return [
    new SwissAddressValidator(),
    new SwissAvsValidator(),
    new IbanValidator(),
    new EmailValidator(),
    new PhoneValidator(),
    new DateValidator(),
    new SwissPostalCodeValidator(),
    new VatNumberValidator(),
  ];
}
```

### Impact
- **Memory:** 8 objects created per call
- **GC Pressure:** Frequent allocations in hot paths
- **Performance:** Unnecessary object construction during pipeline execution

### Usage Patterns
This function is called:
- During pipeline initialization
- For each entity validation lookup via `getValidatorForType()`
- Multiple times per document processing

## Acceptance Criteria

1. - [x] Validators instantiated once (lazy initialization on first call)
2. - [x] `getAllValidators()` returns cached array on subsequent calls
3. - [x] Returned array is immutable (frozen) to prevent accidental modification
4. - [x] Memory profile shows single validator set across 1000+ calls
5. - [x] Test isolation maintained via `_resetValidatorsCache()` internal function
6. - [x] No breaking changes to public API (backward compatible)

## Tasks / Subtasks

- [x] Task 1: Implement singleton caching pattern (AC: #1, #2)
  - [x] Add `validatorsCache` module-level variable (initially `null`)
  - [x] Modify `getAllValidators()` to check cache before creating instances
  - [x] Create validators only on first call, return cache on subsequent calls
  - [x] Update return type to `readonly ValidationRule[]`

- [x] Task 2: Implement array immutability (AC: #3)
  - [x] Wrap validator array with `Object.freeze()`
  - [x] Ensure TypeScript return type reflects `readonly` array

- [x] Task 3: Add test reset mechanism (AC: #5)
  - [x] Create `_resetValidatorsCache()` internal function
  - [x] Export with underscore prefix to indicate internal use
  - [x] Add JSDoc warning about test-only usage

- [x] Task 4: Write unit tests (AC: #1, #2, #3, #4, #5, #6)
  - [x] Test: Same array instance returned on multiple calls
  - [x] Test: Array is frozen (`Object.isFrozen()`)
  - [x] Test: Contains all 8 validator types
  - [x] Test: Reset function clears cache
  - [x] Test: Memory efficiency (1000 calls, no significant heap increase)

- [x] Task 5: Verify backward compatibility (AC: #6)
  - [x] Run existing validator tests
  - [x] Run full test suite to catch any regressions
  - [x] Verify FormatValidationPass works with singleton

## Technical Approach

### Implementation
```typescript
// shared/pii/validators/index.ts

let validatorsCache: readonly ValidationRule[] | null = null;

/**
 * Get all validators (singleton pattern)
 *
 * Validators are instantiated once and cached for the lifetime
 * of the application. The returned array is frozen to prevent
 * accidental modification.
 */
export function getAllValidators(): readonly ValidationRule[] {
  if (!validatorsCache) {
    validatorsCache = Object.freeze([
      new SwissAddressValidator(),
      new SwissAvsValidator(),
      new IbanValidator(),
      new EmailValidator(),
      new PhoneValidator(),
      new DateValidator(),
      new SwissPostalCodeValidator(),
      new VatNumberValidator(),
    ]);
  }
  return validatorsCache;
}

/**
 * Reset validator cache (for testing only)
 * @internal
 */
export function _resetValidatorsCache(): void {
  validatorsCache = null;
}
```

### Return Type Change
- Before: `ValidationRule[]` (mutable)
- After: `readonly ValidationRule[]` (immutable)

This is a minor TypeScript change that enforces correct usage.

## Dev Notes

### Architecture Patterns and Constraints

**Singleton Pattern Justification:**
- Validators are stateless classes - they hold no instance data
- Same validation logic applies across all document processing
- Pattern follows existing precedent in the codebase (e.g., `LoggerFactory` uses singleton instances)
- No thread-safety concerns in JavaScript single-threaded environment

**Immutability:**
- `Object.freeze()` prevents array mutation (push, pop, splice)
- TypeScript `readonly` enforces compile-time safety
- Consumers should not modify the validator array

**Test Isolation:**
- `_resetValidatorsCache()` allows tests to start with fresh instances
- Underscore prefix follows TypeScript convention for internal APIs
- Tests should call reset in `beforeEach` or `afterEach` hooks

### Project Structure Notes

Files to modify:
- `shared/pii/validators/index.ts` - Primary implementation

Callers to verify:
- `src/pii/validators/index.ts` - Re-exports `getAllValidators()`
- `src/pii/passes/FormatValidationPass.ts` - Uses `getAllValidators()`
- `browser-app/src/pii/BrowserRuleEngine.ts` - May use validators

### Considerations

- **No breaking API changes** - Function signature remains the same
- **Return type narrowing** - `readonly` is a subtype, compatible with `ValidationRule[]`
- **getValidatorForType() optimization** - Story 11.7 will add Map-based O(1) lookup using this singleton

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-11.md#Story-11.3]
- [Source: docs/architecture.md#Implementation-Patterns]
- [Source: shared/pii/validators/index.ts - Current implementation]

## Dependencies

- Story 11.1: Unify ValidationRule Interfaces (recommended first, but not blocking)

## Blocks

- Story 11.7: Implement O(1) Validator Lookup (uses singleton pattern)

## Testing Requirements

### Unit Tests
```javascript
describe('getAllValidators', () => {
  beforeEach(() => {
    _resetValidatorsCache();
  });

  it('should return same array instance on multiple calls', () => {
    const first = getAllValidators();
    const second = getAllValidators();
    expect(first).to.equal(second); // Same reference
  });

  it('should return frozen array', () => {
    const validators = getAllValidators();
    expect(Object.isFrozen(validators)).to.be.true;
  });

  it('should contain all 8 validator types', () => {
    const validators = getAllValidators();
    expect(validators).to.have.lengthOf(8);

    const types = validators.map(v => v.entityType);
    expect(types).to.include('SWISS_ADDRESS');
    expect(types).to.include('SWISS_AVS');
    expect(types).to.include('IBAN');
    expect(types).to.include('EMAIL');
    expect(types).to.include('PHONE');
    expect(types).to.include('DATE');
    expect(types).to.include('VAT_NUMBER');
  });

  it('should reset cache when _resetValidatorsCache is called', () => {
    const first = getAllValidators();
    _resetValidatorsCache();
    const second = getAllValidators();
    expect(first).to.not.equal(second); // Different reference after reset
  });
});
```

### Memory Test
```javascript
describe('Memory efficiency', () => {
  it('should not increase memory on repeated calls', () => {
    _resetValidatorsCache();
    const initial = process.memoryUsage().heapUsed;

    for (let i = 0; i < 10000; i++) {
      getAllValidators();
    }

    const final = process.memoryUsage().heapUsed;
    const increase = final - initial;

    // Allow small variance, but no significant increase
    expect(increase).to.be.lessThan(100000); // < 100KB
  });
});
```

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
