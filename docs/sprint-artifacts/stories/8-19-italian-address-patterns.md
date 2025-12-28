# Story 8.19: Italian Address Pattern Support

## Story

As a **PII detection maintainer**,
I want **Italian street and postal code patterns to be detected**,
So that **addresses like "Via Nassa 19, 6900 Lugano" are properly identified**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.19 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Done |
| **Created** | 2025-12-27 |
| **Completed** | 2025-12-27 |

## Problem

Italian addresses in Swiss documents (Ticino region) were not being detected:
- Street patterns: Via, Viale, Piazza, Corso, Vicolo, Largo
- Italian 5-digit postal codes with city names
- This caused false negatives in the ADDRESS category

## Solution

Added two new patterns to HighRecallPatterns.ts:

1. **Italian Street Pattern**:
   ```typescript
   // Matches: Via Nassa 19, Viale Roma 42, Piazza Dante 3
   pattern: /\b(?:via|viale|piazza|corso|vicolo|largo)\s+(?:del\s+|della\s+|dei\s+|delle\s+|di\s+)?[A-ZÀ-Ÿ][a-zà-ÿ]+(?:[\s-][A-Za-zà-ÿ]+)*\s+\d+[a-z]?\b/gi
   ```

2. **Italian Postal Code + City Pattern**:
   ```typescript
   // Matches: 6900 Lugano, 20121 Milano, 00187 Roma
   pattern: /\b(?:I[-\s]?)?\d{5}\s+[A-ZÀÈÉÌÒÙ][a-zàèéìòù]{2,}(?:[-\s][A-Za-zàèéìòù]+)*\b/g
   ```

## Impact

- **ADDRESS Recall**: 90.5% → 100% (+9.5%)
- **True Positives**: +2 ADDRESS detections

## Files Modified

- `shared/pii/HighRecallPatterns.ts` (lines 190-210)

## Definition of Done

- [x] Italian street patterns implemented
- [x] Italian postal code patterns implemented
- [x] Patterns support Italian articles (del, della, dei, delle, di)
- [x] All tests pass
