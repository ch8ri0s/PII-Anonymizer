# Story 8.1: DenyList System Implementation

## Story

As a **document processor**,
I want **common false positives (table headers, acronyms) filtered out**,
So that **I don't see "Montant", "Description" flagged as PERSON_NAME**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.1 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Backlog |
| **Created** | 2025-12-23 |

## Acceptance Criteria

**Given** text containing "Montant" as a table header
**When** PII detection runs
**Then** "Montant" is NOT detected as PERSON_NAME

**And** global deny patterns include multilingual table headers (EN/FR/DE)
**And** entity-type specific deny patterns filter acronyms from PERSON_NAME
**And** deny patterns are case-insensitive
**And** deny-list is configurable per language
**And** deny patterns are loaded from JSON config file (`detectionDenyList.json`) for easy extension without code changes
**And** initial scope targets PERSON_NAME, ORGANIZATION, and NUMBER entity types (other types may be added later)
**And** top false positive patterns from FeedbackAggregator (Story 8.9) can be imported as candidate deny patterns (manual review required)

## Technical Design

### Files to Create

1. `shared/pii/context/DenyList.ts` - Core DenyList class
2. `src/config/detectionDenyList.json` - Configuration file (can be extended by language teams)

### Interface

```typescript
/**
 * Configuration for deny-list patterns
 */
export interface DenyListConfig {
  global: (string | RegExp)[];
  byEntityType: Record<string, (string | RegExp)[]>;
  byLanguage: Record<string, (string | RegExp)[]>;
}

/**
 * DenyList class for filtering false positives
 */
export class DenyList {
  /**
   * Check if text should be denied for given entity type
   * @param text - The detected entity text
   * @param entityType - The entity type (PERSON_NAME, PHONE, etc.)
   * @param language - Optional language code (en, fr, de)
   * @returns true if text should be filtered out
   */
  static isDenied(text: string, entityType: string, language?: string): boolean;

  /**
   * Add a pattern to the deny list
   */
  static addPattern(pattern: string | RegExp, scope: 'global' | string): void;

  /**
   * Get all patterns for entity type and language
   */
  static getPatterns(entityType?: string, language?: string): (string | RegExp)[];
}
```

### Configuration File Structure

**`src/config/detectionDenyList.json`:**
```json
{
  "version": "1.0",
  "global": [
    "Montant", "Libellé", "Description", "Quantité", "Prix", "Total",
    "Sous-total", "TVA", "Rabais", "Réduction",
    "Beschreibung", "Betrag", "Menge", "Preis", "Summe", "MwSt",
    "Amount", "Quantity", "Price", "Subtotal", "Tax", "Discount",
    "Date", "Datum", "Référence", "Reference", "Referenz"
  ],
  "byEntityType": {
    "PERSON_NAME": [
      { "pattern": "^[A-Z]{2,4}$", "type": "regex" },
      { "pattern": "^\\d+$", "type": "regex" },
      { "pattern": "^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$", "type": "regex", "flags": "i" },
      { "pattern": "^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$", "type": "regex", "flags": "i" }
    ],
    "ORGANIZATION": [],
    "NUMBER": []
  },
  "byLanguage": {
    "fr": [],
    "de": [],
    "en": []
  }
}
```

**Note:** Patterns are loaded at startup from JSON. The DenyList class provides methods to reload config dynamically if needed.

### Algorithm

```
isDenied(text, entityType, language):
  1. Normalize text (trim, case-insensitive for strings)
  2. Check global deny list
  3. Check entityType-specific deny list
  4. Check language-specific deny list
  5. For RegExp patterns, test against original text
  6. Return true if any match, false otherwise
```

## Prerequisites

None (first story in epic)

## Integration Points

- Will be called from `HighRecallPass.ts` (Electron)
- Will be called from `BrowserHighRecallPass.ts` (Browser)
- Integration deferred to Story 8.4
- Configuration file (`detectionDenyList.json`) is part of the canonical detection config referenced by Stories 8.1-8.5
- Feedback loop integration: Story 8.9's `FeedbackAggregator` can export top false positives as candidate patterns for manual review and addition to config

## Test Scenarios

1. "Montant" is denied as PERSON_NAME
2. "Description" is denied as PERSON_NAME
3. "Jean Dupont" is NOT denied (valid name)
4. "TVA" (3-letter acronym) is denied
5. Case-insensitive: "montant" and "MONTANT" both denied
6. RegExp patterns work correctly
7. Unknown entity types fall back to global only

## Definition of Done

- [ ] `shared/pii/context/DenyList.ts` created
- [ ] `src/config/detectionDenyList.json` created with initial patterns
- [ ] DenyList loads patterns from JSON config file
- [ ] Unit tests in `test/unit/pii/context/DenyList.test.ts`
- [ ] All acceptance criteria testable
- [ ] Initial scope limited to PERSON_NAME, ORGANIZATION, NUMBER entity types (documented)
- [ ] TypeScript compiles without errors
- [ ] Works in both Electron and Browser environments
- [ ] Config file format documented for future extensions
