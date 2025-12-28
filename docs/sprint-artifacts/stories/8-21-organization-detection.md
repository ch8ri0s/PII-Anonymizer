# Story 8.21: Organization Detection Implementation

## Story

As a **PII detection maintainer**,
I want **organization names with legal suffixes to be detected**,
So that **ORGANIZATION recall improves from 0% to 100%**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.21 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Done |
| **Created** | 2025-12-27 |
| **Completed** | 2025-12-27 |

## Problem

ORGANIZATION detection had 0% recall with 9 false negatives because:
- No regex patterns existed for organizations
- ML model detections were being filtered out by MIN_ENTITY_LENGTH
- Expected organizations: ABB Ltd, Swisscom AG, UBS Group AG, Roche Holding AG, etc.

## Solution

Added two ORGANIZATION patterns to HighRecallPatterns.ts:

### 1. Full Company Name Pattern
```typescript
// Matches: ABB Ltd, Roche Holding AG, Credit Suisse Group AG
pattern: /\b[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿA-Z]+(?:[\s-]+[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿA-Z]+)*\s+(?:AG|SA|GmbH|Ltd|Inc|Corp|LLC|Sàrl|SARL|Cie|KG|SE|Plc)\.?\b/g
```

### 2. Acronym Organization Pattern
```typescript
// Matches: UBS AG, ABB Ltd, SBB SA
pattern: /\b[A-Z]{2,6}\s+(?:AG|SA|GmbH|Ltd|Inc|Corp|LLC|SE|Plc)\.?\b/g
```

## Impact

- **ORGANIZATION Recall**: 0% → 100%
- **ORGANIZATION Precision**: N/A → 100%
- **True Positives**: +9 (all expected organizations detected)
- **False Positives**: 0

## Files Modified

- `shared/pii/HighRecallPatterns.ts` (lines 244-262)

## Supported Legal Suffixes

Swiss/EU company types supported:
- Switzerland: AG, SA, GmbH, Sàrl/SARL
- Germany: GmbH, AG, KG, SE
- UK/International: Ltd, Inc, Corp, LLC, Plc, Cie

## Definition of Done

- [x] Full company name pattern implemented
- [x] Acronym organization pattern implemented
- [x] All 9 expected organizations detected
- [x] No false positives introduced
- [x] All tests pass
