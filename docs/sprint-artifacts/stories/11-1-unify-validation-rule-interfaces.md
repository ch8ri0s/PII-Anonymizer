# Story 11.1: Unify ValidationRule Interfaces

**Epic:** 11 - Validator Module Improvements
**Priority:** High
**Effort:** 3 SP
**Status:** Done
**Completed:** 2025-12-28

---

## Problem Statement

Two incompatible `ValidationRule` interfaces exist in the codebase:

### Interface 1: `shared/pii/validators/types.ts`
```typescript
export interface ValidationRule {
  entityType: ValidatorEntityType;
  name: string;
  validate(entity: ValidatorEntity, context?: string): ValidationResult;
}

export interface ValidatorEntity {
  text: string;
  type?: string;
}
```

### Interface 2: `src/types/detection.ts`
```typescript
export interface ValidationRule {
  entityType: EntityType;
  name: string;
  validate(entity: Entity): ValidationResult;
}

export interface Entity {
  id: string;
  text: string;
  type: EntityType;
  start: number;
  end: number;
  confidence: number;
  source?: 'regex' | 'ml';
}
```

### Key Differences
| Aspect | Shared | Src |
|--------|--------|-----|
| Entity type | `ValidatorEntity` (minimal) | `Entity` (full) |
| Context parameter | `context?: string` | None |
| Entity types | 7 types | 25+ types |

This causes type mismatches when shared validators are used in the main app's FormatValidationPass.

## Acceptance Criteria

- [x] Single source of truth for ValidationRule interface
- [x] Adapter pattern or unified interface supports both use cases
- [x] No type casting required at module boundaries
- [x] All validators compile without type errors
- [x] FormatValidationPass works with unified interface
- [x] Browser-app imports work unchanged

## Technical Approach

### Option A: Generic Interface (Recommended)
```typescript
// shared/pii/validators/types.ts
export interface ValidationRule<T extends MinimalEntity = MinimalEntity> {
  entityType: ValidatorEntityType | string;
  name: string;
  validate(entity: T, context?: string): ValidationResult;
}

export interface MinimalEntity {
  text: string;
  type?: string;
}
```

Benefits:
- Flexible for both use cases
- No adapter needed
- Type-safe at boundaries

### Option B: Adapter Pattern
```typescript
// src/pii/validators/adapter.ts
export class ValidatorAdapter implements LocalValidationRule {
  constructor(private sharedValidator: SharedValidationRule) {}

  get entityType() { return this.sharedValidator.entityType; }
  get name() { return this.sharedValidator.name; }

  validate(entity: Entity): ValidationResult {
    return this.sharedValidator.validate(
      { text: entity.text, type: entity.type },
      undefined // context
    );
  }
}
```

Benefits:
- No changes to shared module
- Clear separation of concerns

Drawbacks:
- Extra wrapper layer
- More code to maintain

## Files to Modify

1. `shared/pii/validators/types.ts` - Update interface
2. `src/types/detection.ts` - Align or extend shared types
3. `src/pii/validators/index.ts` - Update imports
4. All validator files - Update to match interface

## Testing Requirements

- [ ] Unit tests for type compatibility
- [ ] Integration test: shared validator in FormatValidationPass
- [ ] Compile test: no type errors in either module
- [ ] Browser-app build succeeds

## Dependencies

- None (foundational story)

## Blocks

- Story 11.3: Implement Singleton Pattern
- Story 11.4: Remove Duplicate getAllValidators()

---

## Implementation Notes (2025-12-28)

### Approach Taken: Generic Interface (Option A)

The implementation unified the ValidationRule interfaces using a generic approach:

1. **Updated `shared/pii/validators/types.ts`:**
   - Made `ValidationRule<TEntity, TEntityType>` generic with defaults
   - Added `ValidationContext` interface for enhanced validation (fullText, position)
   - Kept backward compatibility with `ValidatorEntity` as default

2. **Updated `src/types/detection.ts`:**
   - Imports `BaseValidationRule` from shared
   - `ValidationRule` extends `BaseValidationRule<Entity, EntityType>`
   - Re-exports `ValidationContext`, `ValidatorEntity` for compatibility

3. **Updated `src/pii/validators/index.ts`:**
   - Re-exports shared types including `ValidationRule`
   - `getAllValidators()` returns `SharedValidationRule[]`

4. **Updated `src/pii/passes/FormatValidationPass.ts`:**
   - Uses shared `ValidationRule` type from validators index
   - Compatible with both shared validators and full Entity objects

### Key Design Decisions

- **Generic defaults**: `ValidationRule<TEntity = ValidatorEntity, TEntityType = ValidatorEntityType | string>`
- **Context union**: `validate(entity: TEntity, context?: ValidationContext | string)` supports both old string and new object context
- **Type compatibility**: `Entity` is compatible with `ValidatorEntity` (has required `text` property)

### Test Results

All 1779 tests pass after the unification.
