# Epic Technical Specification: Validator Module Improvements

Date: 2025-12-28
Author: Claude Code (Architectural Review)
Epic ID: 11
Status: Draft

---

## Overview

Epic 11 addresses architectural improvements to the shared validators module (`shared/pii/validators/`) based on a comprehensive code review. The validators were recently refactored from `src/pii/validators/` to enable code sharing between the Electron app and browser-app PWA.

While the refactoring successfully achieved code sharing, the architectural review identified 11 improvement opportunities across type safety, performance, security, and maintainability domains. This epic organizes these improvements into prioritized stories.

## Objectives and Scope

### In Scope

- **Type Safety:** Unify divergent ValidationRule interfaces between shared and src modules
- **Performance:** Implement singleton pattern for validator factory, O(1) validator lookup
- **Security:** Add ReDoS protection with input length limits
- **Code Quality:** Extract magic numbers to named constants, eliminate code duplication
- **Testing:** Create dedicated test files for all 8 validators
- **Extensibility:** Improve validator registration and composition patterns

### Out of Scope

- Adding new validator types (covered by feature epics)
- Changing validation algorithms or rules
- External validation service integration
- Validation result persistence or logging

## System Architecture Alignment

### Affected Components

| Component | Impact | Notes |
|-----------|--------|-------|
| `shared/pii/validators/types.ts` | Enhancement | Unify ValidationRule interface |
| `shared/pii/validators/index.ts` | Enhancement | Singleton pattern, Map-based lookup |
| `shared/pii/validators/*.ts` | Enhancement | Add input limits, extract constants |
| `src/pii/validators/index.ts` | Simplification | Remove duplicate getAllValidators() |
| `src/types/detection.ts` | Alignment | Align with shared types |
| `test/unit/pii/validators/*.test.js` | New | Add missing test files |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Current Architecture                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  browser-app/               src/                                 │
│  ┌──────────────┐          ┌──────────────────────┐             │
│  │ BrowserRule  │          │ FormatValidationPass │             │
│  │ Engine       │          └──────────┬───────────┘             │
│  └──────┬───────┘                     │                         │
│         │                             │                         │
│         │                   ┌─────────▼───────────┐             │
│         │                   │ src/pii/validators/ │             │
│         │                   │ (re-export + dupe)  │  ◄── ISSUE  │
│         │                   └─────────┬───────────┘             │
│         │                             │                         │
│         └─────────────┬───────────────┘                         │
│                       │                                         │
│             ┌─────────▼───────────┐                             │
│             │ shared/pii/validators│                            │
│             │ ┌─────────────────┐ │                             │
│             │ │ types.ts        │ │  ◄── Divergent types        │
│             │ │ index.ts        │ │  ◄── No singleton           │
│             │ │ *Validator.ts   │ │  ◄── Magic numbers          │
│             │ └─────────────────┘ │                             │
│             └─────────────────────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Stories

### High Priority (Security & Type Safety)

#### Story 11.1: Unify ValidationRule Interfaces
**Priority:** High | **Effort:** 3 SP | **Risk:** Medium

**Problem:** Two incompatible `ValidationRule` interfaces exist:
- `shared/pii/validators/types.ts`: Uses `ValidatorEntity` (minimal: `{text, type?}`)
- `src/types/detection.ts`: Uses full `Entity` (includes `id`, `start`, `end`, `confidence`)

The `context?: string` parameter also differs between implementations.

**Acceptance Criteria:**
- [ ] Single source of truth for ValidationRule interface
- [ ] Adapter pattern or unified interface supports both use cases
- [ ] No type casting required at module boundaries
- [ ] All validators compile without type errors
- [ ] FormatValidationPass works with unified interface

**Technical Approach:**
```typescript
// Option A: Generic interface
export interface ValidationRule<T extends ValidatorEntity = ValidatorEntity> {
  entityType: ValidatorEntityType | string;
  name: string;
  validate(entity: T, context?: string): ValidationResult;
}

// Option B: Adapter in src/
export class ValidatorAdapter implements LocalValidationRule {
  constructor(private sharedValidator: SharedValidationRule) {}
  validate(entity: Entity): ValidationResult {
    return this.sharedValidator.validate({ text: entity.text }, entity.context);
  }
}
```

---

#### Story 11.2: Add ReDoS Protection to Validators
**Priority:** High | **Effort:** 2 SP | **Risk:** High (Security)

**Problem:** `EmailValidator.ts` uses a complex regex with nested quantifiers that could cause exponential backtracking with crafted inputs:
```typescript
const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
```

**Acceptance Criteria:**
- [ ] All validators have input length limits
- [ ] EmailValidator: max 254 chars (RFC 5321)
- [ ] PhoneValidator: max 20 chars
- [ ] IbanValidator: max 34 chars (longest IBAN)
- [ ] Other validators: reasonable limits based on format
- [ ] Unit tests for length limit enforcement
- [ ] Validation fails fast with appropriate error message

**Technical Approach:**
```typescript
validate(entity: ValidatorEntity): ValidationResult {
  if (entity.text.length > 254) {
    return { isValid: false, confidence: 0.3, reason: 'Input exceeds maximum length (254)' };
  }
  // ... rest of validation
}
```

---

#### Story 11.3: Implement Singleton Pattern for Validators
**Priority:** High | **Effort:** 1 SP | **Risk:** Low

**Problem:** `getAllValidators()` creates 8 new validator instances on every call, causing unnecessary memory allocation and GC pressure.

**Acceptance Criteria:**
- [ ] Validators instantiated once and cached
- [ ] `getAllValidators()` returns cached array
- [ ] Memory profile shows single validator set
- [ ] Thread-safe for concurrent access (if applicable)

**Technical Approach:**
```typescript
let validatorsCache: ValidationRule[] | null = null;

export function getAllValidators(): ValidationRule[] {
  if (!validatorsCache) {
    validatorsCache = Object.freeze([
      new SwissAddressValidator(),
      new SwissAvsValidator(),
      // ...
    ]);
  }
  return validatorsCache;
}
```

---

#### Story 11.4: Remove Duplicate getAllValidators()
**Priority:** High | **Effort:** 0.5 SP | **Risk:** Low

**Problem:** `getAllValidators()` is implemented in both:
- `shared/pii/validators/index.ts`
- `src/pii/validators/index.ts`

This violates DRY and creates maintenance burden.

**Acceptance Criteria:**
- [ ] `src/pii/validators/index.ts` re-exports from shared only
- [ ] No duplicate function implementations
- [ ] All imports continue to work
- [ ] Tests pass without modification

---

### Medium Priority (Code Quality)

#### Story 11.5: Extract Confidence Constants
**Priority:** Medium | **Effort:** 2 SP | **Risk:** Low

**Problem:** Magic confidence values scattered across validators:
- `0.95`, `0.9`, `0.85`, `0.82`, `0.75`, `0.5`, `0.4`, `0.3`, `0.2`

**Acceptance Criteria:**
- [ ] Named constants for all confidence levels
- [ ] Documentation explaining each level's meaning
- [ ] Consistent usage across all validators
- [ ] Easy to adjust thresholds globally

**Technical Approach:**
```typescript
// shared/pii/validators/confidence.ts
export const CONFIDENCE = {
  /** Checksum-validated (AVS, IBAN) */
  CHECKSUM_VALID: 0.95,
  /** Strong format match with validation */
  FORMAT_VALID: 0.9,
  /** Standard format validation */
  STANDARD: 0.85,
  /** Known entity in valid range */
  KNOWN_VALID: 0.82,
  /** Partial validation passed */
  MODERATE: 0.75,
  /** Weak match, needs context */
  LOW: 0.5,
  /** Format invalid but recognizable */
  INVALID_FORMAT: 0.4,
  /** Validation failed */
  FAILED: 0.3,
  /** Strong false positive indicator */
  FALSE_POSITIVE: 0.2,
} as const;
```

---

#### Story 11.6: Create Test Files for All Validators
**Priority:** Medium | **Effort:** 5 SP | **Risk:** Low

**Problem:** Only `SwissAddressValidator` has a dedicated test file. Other validators lack comprehensive tests.

**Acceptance Criteria:**
- [ ] Test file for each validator (8 total)
- [ ] Valid input tests for each validator
- [ ] Invalid input tests with expected reasons
- [ ] Edge cases: empty strings, Unicode, long inputs
- [ ] Checksum validation tests (AVS, IBAN, VAT)
- [ ] Test coverage ≥80% for validators module

**Test Files to Create:**
```
test/unit/pii/validators/
  SwissAddressValidator.test.js  ✓ (exists)
  SwissAvsValidator.test.js      (new)
  IbanValidator.test.js          (new)
  EmailValidator.test.js         (new)
  PhoneValidator.test.js         (new)
  DateValidator.test.js          (new)
  SwissPostalCodeValidator.test.js (new)
  VatNumberValidator.test.js     (new)
```

---

#### Story 11.7: Implement O(1) Validator Lookup
**Priority:** Medium | **Effort:** 1 SP | **Risk:** Low

**Problem:** `getValidatorForType()` uses `Array.find()` which is O(n) for each lookup.

**Acceptance Criteria:**
- [ ] Map-based validator lookup
- [ ] O(1) complexity for type lookups
- [ ] Lazy initialization of map
- [ ] Backward compatible API

**Technical Approach:**
```typescript
let validatorMap: Map<ValidatorEntityType, ValidationRule> | null = null;

export function getValidatorForType(type: ValidatorEntityType): ValidationRule | undefined {
  if (!validatorMap) {
    validatorMap = new Map(
      getAllValidators().map(v => [v.entityType, v])
    );
  }
  return validatorMap.get(type);
}
```

---

#### Story 11.8: Extract Shared Locale Data
**Priority:** Medium | **Effort:** 1 SP | **Risk:** Low

**Problem:** Month names are duplicated in:
- `SwissAddressValidator.ts` (lines 15-28)
- `DateValidator.ts` (lines 21-31)

**Acceptance Criteria:**
- [ ] Single source for month names
- [ ] Shared across validators
- [ ] Support for DE, FR, EN, IT
- [ ] Easy to extend with new languages

**Technical Approach:**
```typescript
// shared/pii/validators/locale-data.ts
export const MONTH_NAMES: Record<string, number> = {
  // English
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  // German
  januar: 1, februar: 2, märz: 3, mai: 5, juni: 6,
  juli: 7, oktober: 10, dezember: 12,
  // French
  janvier: 1, février: 2, mars: 3, avril: 4, juin: 6,
  juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12,
  // Italian
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};
```

---

### Low Priority (Extensibility)

#### Story 11.9: Resolve Entity Type Collision
**Priority:** Low | **Effort:** 1 SP | **Risk:** Low

**Problem:** Both `SwissAddressValidator` and `SwissPostalCodeValidator` use `entityType: 'SWISS_ADDRESS'`, causing ambiguity in `getValidatorForType()`.

**Acceptance Criteria:**
- [ ] Each validator has unique entity type OR
- [ ] SwissPostalCodeValidator renamed to clarify it's a sub-validator
- [ ] `getValidatorForType()` returns correct validator
- [ ] Documentation clarifies validator relationships

**Options:**
1. Add `SWISS_POSTAL_CODE` entity type
2. Rename to `SwissAddressPostalValidator` (internal use)
3. Make `SwissPostalCodeValidator` a private helper

---

#### Story 11.10: Implement Validator Registry Pattern
**Priority:** Low | **Effort:** 3 SP | **Risk:** Medium

**Problem:** Adding a new validator requires editing 5 files:
1. Create validator file
2. Export from `shared/pii/validators/index.ts`
3. Add to `getAllValidators()` array
4. Re-export from `shared/pii/index.ts`
5. Re-export from `src/pii/validators/index.ts`

**Acceptance Criteria:**
- [ ] Auto-discovery or registry pattern
- [ ] New validators only need to be created and registered
- [ ] Backward compatible with existing code
- [ ] Clear documentation for adding validators

**Technical Approach:**
```typescript
// shared/pii/validators/registry.ts
class ValidatorRegistry {
  private validators = new Map<ValidatorEntityType, ValidationRule>();

  register(validator: ValidationRule): void {
    this.validators.set(validator.entityType, validator);
  }

  getAll(): ValidationRule[] {
    return Array.from(this.validators.values());
  }

  get(type: ValidatorEntityType): ValidationRule | undefined {
    return this.validators.get(type);
  }
}

export const registry = new ValidatorRegistry();

// Auto-register built-in validators
registry.register(new SwissAddressValidator());
registry.register(new SwissAvsValidator());
// ...
```

---

#### Story 11.11: Optimize Context Search Performance
**Priority:** Low | **Effort:** 2 SP | **Risk:** Low

**Problem:** `SwissAddressValidator` uses `fullText.indexOf(address)` which is O(n) for large documents. When validating multiple addresses, this becomes O(n*m).

**Acceptance Criteria:**
- [ ] Optional position parameter for validators
- [ ] Avoid O(n) search when position is known
- [ ] Backward compatible (position optional)
- [ ] Performance improvement measurable in benchmarks

**Technical Approach:**
```typescript
export interface ValidationContext {
  fullText?: string;
  position?: number;  // New: avoid indexOf search
}

export function validateSwissAddressFull(
  address: string,
  context: ValidationContext = {}
): AddressValidationResult {
  const { fullText = '', position } = context;
  const posInText = position ?? fullText.indexOf(address);
  // ...
}
```

---

## Dependencies

| Story | Depends On | Blocks |
|-------|------------|--------|
| 11.1  | None | 11.3, 11.4 |
| 11.2  | None | None |
| 11.3  | 11.1 | 11.7 |
| 11.4  | 11.1 | None |
| 11.5  | None | None |
| 11.6  | None | None |
| 11.7  | 11.3 | None |
| 11.8  | None | None |
| 11.9  | None | 11.10 |
| 11.10 | 11.9 | None |
| 11.11 | None | None |

## Effort Summary

| Priority | Stories | Total SP |
|----------|---------|----------|
| High | 11.1, 11.2, 11.3, 11.4 | 6.5 SP |
| Medium | 11.5, 11.6, 11.7, 11.8 | 9 SP |
| Low | 11.9, 11.10, 11.11 | 6 SP |
| **Total** | **11 stories** | **21.5 SP** |

## Success Metrics

1. **Type Safety:** Zero type casting at module boundaries
2. **Performance:** `getAllValidators()` called 1000x uses same memory as 1x
3. **Security:** All validators reject inputs > max length in <1ms
4. **Test Coverage:** Validators module ≥80% coverage
5. **Code Quality:** No magic numbers in validator files

## Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Type changes break existing code | High | Medium | Comprehensive test suite before changes |
| Singleton causes issues in tests | Medium | Low | Provide reset mechanism for tests |
| Registry pattern over-engineering | Low | Medium | Keep simple, expand only if needed |

## Timeline Recommendation

**Sprint 1 (High Priority):** Stories 11.1-11.4 (6.5 SP)
- Focus on security and type safety
- Foundation for other improvements

**Sprint 2 (Medium Priority):** Stories 11.5-11.8 (9 SP)
- Code quality and testing
- Can be parallelized

**Sprint 3 (Low Priority):** Stories 11.9-11.11 (6 SP)
- Extensibility improvements
- Can be deferred if other priorities emerge
