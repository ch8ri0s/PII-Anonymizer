# Story 11.11: Optimize Context Search Performance

Status: done

## Story

As a **developer**,
I want **optional position parameters for validators that perform context searches**,
so that **we avoid O(n) indexOf operations when the entity position is already known from detection**.

## Acceptance Criteria

1. - [x] Optional `position` parameter added to `ValidationContext` interface
2. - [x] `SwissAddressValidator` uses provided position instead of `indexOf` when available
3. - [x] Backward compatible - position is optional, falls back to `indexOf` if not provided
4. - [x] Performance improvement measurable in benchmarks for large documents
5. - [x] No regression in validation accuracy
6. - [x] Unit tests verify position-based validation works correctly
7. - [x] Unit tests verify backward compatibility with legacy string parameter

## Tasks / Subtasks

- [x] Task 1: Update ValidationContext interface (AC: #1)
  - [x] Add optional `position?: number` field to `ValidationContext` in `shared/pii/validators/types.ts`
  - [x] Add JSDoc explaining the field purpose and usage
  - [x] Export updated interface
  - **Note:** This was already implemented in Story 11.1 - ValidationContext already has position field

- [x] Task 2: Update SwissAddressValidator to use position (AC: #2, #3, #5)
  - [x] Modify `validateSwissAddressFull()` to accept `ValidationContext` object
  - [x] Use `position` from context if provided, otherwise fall back to `indexOf`
  - [x] Maintain backward compatibility with legacy string parameter
  - [x] Ensure context extraction still works correctly with position

- [x] Task 3: Create unit tests (AC: #4, #6, #7)
  - [x] Add tests to `test/unit/pii/validators/SwissAddressValidator.test.js`
  - [x] Test: Position provided, indexOf not called on fullText
  - [x] Test: Position not provided, falls back to indexOf
  - [x] Test: Backward compatibility with string parameter
  - [x] Test: Validation accuracy unchanged with position

- [x] Task 4: Create performance benchmark (AC: #4)
  - [x] Create performance test comparing with/without position
  - [x] Benchmark with large document (100KB+)
  - [x] Document performance improvement in test output
  - **Result:** 84% performance improvement (1.52ms vs 0.24ms for 500 validations on 102KB doc)

- [x] Task 5: Update callers (optional, for future stories) (AC: #2)
  - [x] Document which callers should be updated to pass position
  - [x] Note: `FormatValidationPass`, `HighRecallPatterns` are candidates
  - [x] This task is informational - actual updates in future optimization stories

- [x] Task 6: Verify no regressions (AC: #5)
  - [x] Run full validator test suite
  - [x] Run integration tests
  - [x] Verify existing validation behavior unchanged
  - **Result:** 2294 tests passing, 54 SwissAddressValidator tests passing

## Dev Notes

### Learnings from Previous Story

**From Story 11-10 (Validator Registry Pattern) - Status: review**

Story 11-10 introduces a registry pattern for validators. Key points relevant to 11-11:

- **Registry centralizes validator management** - Changes to validator interfaces should consider registry compatibility
- **7 validators in registry** (not 8) - SwissPostalCodeValidator remains `@internal`
- **Singleton pattern established** (Story 11.3) - Validators are cached, so interface changes must be backward compatible
- **O(1) Map-based lookup** (Story 11.7) - Performance already optimized at lookup level

[Source: stories/11-10-validator-registry-pattern.md#Dev-Notes]

### Problem Analysis

The `SwissAddressValidator` uses `fullText.indexOf(address)` for context extraction:

```typescript
// SwissAddressValidator.ts lines 186-188
if (fullText) {
  const posInText = fullText.indexOf(address);
  // Extract context around position...
}
```

**Performance Impact:**
- **Time Complexity:** O(n) where n = document length per validation
- **Cumulative:** For m addresses in document: O(n * m)
- **Real-world:** 100KB document with 50 addresses = 5M character comparisons

### Technical Approach

**Option A (Recommended): Position Parameter**

Add optional position to validation context - simple and provides immediate benefit:

```typescript
// types.ts
export interface ValidationContext {
  fullText?: string;
  position?: number;  // Position of entity in fullText (avoids indexOf)
}

// SwissAddressValidator.ts
validate(entity: ValidatorEntity, context?: ValidationContext): ValidationResult {
  const { fullText = '', position } = context || {};
  const posInText = position ?? fullText.indexOf(entity.text);
  // ...
}
```

**Backward Compatibility:**

Support legacy string parameter:
```typescript
export function validateSwissAddressFull(
  address: string,
  context: ValidationContext | string = {}
): AddressValidationResult {
  const ctx: ValidationContext = typeof context === 'string'
    ? { fullText: context }
    : context;
  // ...
}
```

### Project Structure Notes

**Files to Modify:**
```
shared/pii/validators/
├── types.ts                       ← Add position to ValidationContext
└── SwissAddressValidator.ts       ← Use position when available
```

**Test Files to Modify:**
```
test/unit/pii/validators/
└── SwissAddressValidator.test.js  ← Add position-based tests
```

**Future Caller Updates (Out of Scope):**
- `src/pii/passes/FormatValidationPass.ts` - Already has entity.start position
- `shared/pii/HighRecallPatterns.ts` - Has match.index from regex
- `src/pii/SwissEuDetector.ts` - Has match.index from regex

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-11.md#Story-11.11]
- [Source: shared/pii/validators/SwissAddressValidator.ts - Current indexOf usage]
- [Source: shared/pii/validators/types.ts - ValidationContext interface]
- [Source: docs/architecture.md#Implementation-Patterns]

## Dependencies

- Story 11.1: Unify ValidationRule Interfaces - **DONE** (ValidationContext type exists)

## Blocks

- None - This is an optional performance optimization

## Dev Agent Record

### Context Reference

- `docs/sprint-artifacts/stories/11-11-optimize-context-search.context.xml`

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Task 1: ValidationContext interface already had position field from Story 11.1
- Task 2: Implemented backward-compatible position parameter in SwissAddressValidator
- Task 4: Benchmark showed 84% performance improvement

### Completion Notes List

- **Implementation Summary:** Added optional position parameter support to `validateSwissAddressFull()` and `SwissAddressValidator.validate()` methods. The position parameter is used in `checkYearFalsePositive()` to avoid O(n) `indexOf` calls when extracting context around the matched address.

- **Backward Compatibility:** Full backward compatibility maintained - string parameter still works, undefined context still works, empty object still works. All 39 existing tests pass.

- **Performance Improvement:** Benchmark shows 84% improvement on 102KB document with 500 validations (1.52ms without position vs 0.24ms with position).

- **Future Work:** Callers that could benefit from passing position:
  - `src/pii/SwissEuDetector.ts:533` - has match.index
  - `shared/pii/HighRecallPatterns.ts:160` - has match.index
  - `src/pii/passes/FormatValidationPass.ts` - has entity.start

### File List

**Modified:**
- `shared/pii/validators/SwissAddressValidator.ts` - Added position parameter support
- `test/unit/pii/validators/SwissAddressValidator.test.js` - Added 15 new tests

**Not Modified (already complete):**
- `shared/pii/validators/types.ts` - ValidationContext already has position field

## Change Log

| Date | Author | Description |
|------|--------|-------------|
| 2025-12-28 | create-story workflow | Initial story draft created |
| 2025-12-28 | create-story workflow | Updated to standard template format with previous story learnings |
| 2025-12-28 | dev-story workflow | Implementation complete - 84% performance improvement, 54 tests passing |
| 2025-12-28 | code-review workflow | Code review APPROVED |

## Code Review

### Review Date
2025-12-28

### Reviewer
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Verdict
**APPROVED** ✅

### AC Validation

| AC | Description | Status | Evidence |
|----|-------------|--------|----------|
| #1 | Optional position parameter added to ValidationContext interface | ✅ PASS | `shared/pii/validators/types.ts` - Already present from Story 11.1 |
| #2 | SwissAddressValidator uses provided position instead of indexOf | ✅ PASS | `SwissAddressValidator.ts:185` - `position ?? fullText.indexOf(address)` |
| #3 | Backward compatible - position optional, falls back to indexOf | ✅ PASS | `SwissAddressValidator.ts:87-89` - Type guard for string vs ValidationContext |
| #4 | Performance improvement measurable in benchmarks | ✅ PASS | 84% improvement (1.52ms → 0.24ms for 500 validations on 102KB doc) |
| #5 | No regression in validation accuracy | ✅ PASS | 2294 tests passing, 54 SwissAddressValidator tests |
| #6 | Unit tests verify position-based validation works correctly | ✅ PASS | 15 new tests covering position-based validation |
| #7 | Unit tests verify backward compatibility with legacy string parameter | ✅ PASS | 3 backward compatibility tests in describe block |

### Task Validation

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| 1 | Update ValidationContext interface | ✅ COMPLETE | Already had position field from Story 11.1 |
| 2 | Update SwissAddressValidator to use position | ✅ COMPLETE | Both functions updated with type guards |
| 3 | Create unit tests | ✅ COMPLETE | 15 new tests added |
| 4 | Create performance benchmark | ✅ COMPLETE | 84% improvement documented |
| 5 | Update callers (documentation) | ✅ COMPLETE | Future work documented in story |
| 6 | Verify no regressions | ✅ COMPLETE | Full test suite passing |

### Code Quality Assessment

| Category | Assessment |
|----------|------------|
| **Type Safety** | ✅ Proper TypeScript union type with type guard |
| **Error Handling** | ✅ Graceful fallback via nullish coalescing |
| **Security** | ✅ MAX_LENGTH ReDoS protection (200 chars) |
| **Test Coverage** | ✅ 15 new tests, comprehensive coverage |
| **Documentation** | ✅ JSDoc comments on all public APIs |
| **Backward Compatibility** | ✅ String parameter still works |
| **Performance** | ✅ 84% improvement measured |

### Files Reviewed

1. `shared/pii/validators/SwissAddressValidator.ts` - Implementation
2. `shared/pii/validators/types.ts` - Interface (unchanged)
3. `test/unit/pii/validators/SwissAddressValidator.test.js` - Tests

### Summary

Clean implementation following project patterns. Position parameter correctly avoids O(n) indexOf when available while maintaining full backward compatibility. Performance benchmark demonstrates measurable improvement on large documents. All 7 acceptance criteria validated with evidence
