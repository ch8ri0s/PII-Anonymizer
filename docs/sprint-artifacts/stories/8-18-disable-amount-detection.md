# Story 8.18: Disable AMOUNT Detection

## Story

As a **PII detection maintainer**,
I want **AMOUNT entities to not be detected as PII**,
So that **precision improves by eliminating false positives from financial amounts**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.18 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Done |
| **Created** | 2025-12-27 |
| **Completed** | 2025-12-27 |

## Problem

AMOUNT detection was causing 15 false positives with 0% precision because:
- Financial amounts (CHF 150.00, EUR 1,234.56) are NOT personally identifiable information
- They represent transaction data, not personal data
- Ground truth correctly excludes AMOUNT as a PII entity type

## Solution

1. Disabled AMOUNT detection in InvoiceRules.ts DEFAULT_CONFIG:
   ```typescript
   extractAmounts: false,  // Disabled - not PII
   ```

2. Commented out AMOUNT pattern in HighRecallPatterns.ts with explanation

3. Updated tests to:
   - Test AMOUNT detection when explicitly enabled
   - Verify AMOUNT is NOT detected by default

## Impact

- **False Positives**: -15 (eliminated all AMOUNT FPs)
- **Precision**: +6% contribution to overall precision improvement

## Files Modified

- `src/pii/rules/InvoiceRules.ts` (line 48)
- `shared/pii/HighRecallPatterns.ts` (lines 216-224)
- `test/unit/pii/DocumentTypeDetection.test.js`

## Definition of Done

- [x] AMOUNT detection disabled by default
- [x] Tests updated to verify behavior
- [x] All tests pass (1486 passing)
