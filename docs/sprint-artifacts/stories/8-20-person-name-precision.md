# Story 8.20: PERSON_NAME Precision Improvement

## Story

As a **PII detection maintainer**,
I want **company names and street names to not be detected as person names**,
So that **PERSON_NAME precision improves from 37.5% toward 90% target**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.20 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Done |
| **Created** | 2025-12-27 |
| **Completed** | 2025-12-27 |

## Problem

PERSON_NAME detection had 35 false positives (37.5% precision) because:
- Company names: "ABB Ltd", "Roche Holding", "Credit Suisse Group AG"
- Street names: "Via Nassa", "Rue Lausanne", "Avenue Gare"
- Service/product names: "Consulting Services", "Project Management"

## Solution

### 1. DenyList Expansion (DenyList.ts)
Added regex patterns to filter PERSON_NAME false positives:
- Company suffixes: `Ltd|AG|SA|GmbH|Inc|Corp|LLC|...`
- Street type prefixes: `Via|Rue|Route|Avenue|Strasse|...`
- Company-indicating words: `Holding|Group|Technologies|Services|...`
- Generic document terms: `Case|Notre|Services|Gestion|...`

### 2. Negative Context Words (ContextWords.ts)
Added negative context words for PERSON_NAME in all languages:
- English: ltd, inc, corp, group, holding, street, road, avenue
- French: sa, sàrl, groupe, rue, avenue, boulevard, via, viale
- German: ag, gmbh, gruppe, strasse, gasse, weg, platz

### 3. Enhanced Validation (HighRecallPatterns.ts)
Updated `validatePersonName()` function:
- Check if last word is a company suffix
- Check if first word is a street type
- Added COMPANY_SUFFIXES and COMPANY_WORDS sets

## Impact

- **PERSON_NAME False Positives**: 35 → 28 (-7)
- **PERSON_NAME Precision**: 37.5% → 42.9% (+5.4%)
- Still needs ML model improvements for remaining FPs

## Files Modified

- `shared/pii/context/DenyList.ts` (lines 119-127)
- `shared/pii/context/ContextWords.ts` (negative context words)
- `shared/pii/HighRecallPatterns.ts` (validatePersonName, COMPANY_SUFFIXES)

## Definition of Done

- [x] DenyList expanded with company and street patterns
- [x] Negative context words added for all languages
- [x] validatePersonName enhanced to check suffixes
- [x] All tests pass
