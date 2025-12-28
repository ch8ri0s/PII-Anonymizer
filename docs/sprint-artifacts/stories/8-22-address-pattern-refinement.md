# Story 8.22: Address Pattern Refinement

## Story

As a **PII detection maintainer**,
I want **postal code + city patterns to require minimum city name length**,
So that **ADDRESS precision improves by reducing false positives**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.22 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Done |
| **Created** | 2025-12-27 |
| **Completed** | 2025-12-27 |

## Problem

ADDRESS detection had 8 false positives (70.4% precision) because:
- Postal code patterns were too permissive
- Short city names could match unintended text
- Patterns like "2024 X" could match as address

## Solution

Updated postal code + city patterns in HighRecallPatterns.ts to require:
- Minimum 3-character city name (was 1)
- Pattern: `[A-Z][a-z]{2,}` instead of `[A-Z][a-z]+`

### Patterns Updated

1. **Swiss Postal Codes** (line 155):
   ```typescript
   // Before: [A-ZÄÖÜ][a-zäöüé]+
   // After:  [A-ZÄÖÜ][a-zäöüé]{2,}
   ```

2. **German/Austrian Postal Codes** (line 164):
   ```typescript
   // Before: [A-ZÄÖÜ][a-zäöüß]+
   // After:  [A-ZÄÖÜ][a-zäöüß]{2,}
   ```

3. **French Postal Codes** (line 173):
   ```typescript
   // Before: [A-ZÀÂÆÉÈÊËÏÎÔŒÙÛÜ][a-zàâæéèêëïîôœùûüÿç]+
   // After:  [A-ZÀÂÆÉÈÊËÏÎÔŒÙÛÜ][a-zàâæéèêëïîôœùûüÿç]{2,}
   ```

4. **Italian Postal Codes** (line 208):
   ```typescript
   // Before: [A-ZÀÈÉÌÒÙ][a-zàèéìòù]+
   // After:  [A-ZÀÈÉÌÒÙ][a-zàèéìòù]{2,}
   ```

## Impact

- **ADDRESS Precision**: Marginal improvement from pattern tightening
- Prevents false positives from 1-2 character "city" matches
- No valid Swiss/EU city names have less than 3 characters

## Files Modified

- `shared/pii/HighRecallPatterns.ts` (lines 155, 164, 173, 208)

## Definition of Done

- [x] Swiss postal code pattern refined
- [x] German/Austrian postal code pattern refined
- [x] French postal code pattern refined
- [x] Italian postal code pattern refined
- [x] All tests pass
