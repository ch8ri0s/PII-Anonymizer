# Story 8.2: Context Words Database

## Story

As a **PII detector**,
I want **access to context words for each entity type and language**,
So that **I can boost confidence when relevant context is found nearby**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.2 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Backlog |
| **Created** | 2025-12-23 |

## Acceptance Criteria

**Given** a PERSON_NAME entity detected
**When** context lookup is performed
**Then** relevant context words are returned (e.g., "nom", "name", "contact", "M.", "Mme")

**And** context words are organized by entity type (PERSON_NAME, PHONE, EMAIL, etc.)
**And** context words support EN, FR, DE languages
**And** context words can be extended without code changes (data-driven)
**And** context words support weights and polarity (positive/negative) for fine-grained confidence adjustment
**And** context words include version/provenance metadata for auditability

## Technical Design

### File to Create

`shared/pii/context/ContextWords.ts`

### Data Structure

```typescript
/**
 * Context word definition with weight and polarity
 */
export interface ContextWord {
  word: string;
  weight: number;  // 0.0-1.0, default 1.0
  polarity: 'positive' | 'negative';  // 'positive' boosts, 'negative' reduces confidence
}

/**
 * Context words organized by entity type and language
 * Based on Microsoft Presidio patterns
 */
export type ContextWordsConfig = Record<string, Record<string, ContextWord[]>>;

/**
 * Metadata for context words database
 */
export interface ContextWordsMetadata {
  version: string;
  source: string;  // e.g., "Presidio v2.2.33", "Human curated"
  lastUpdated: string;  // ISO8601
}

export const CONTEXT_WORDS_METADATA: ContextWordsMetadata = {
  version: '1.0',
  source: 'Presidio v2.2.33 + Human curated',
  lastUpdated: '2025-12-23T00:00:00Z'
};

export const CONTEXT_WORDS: ContextWordsConfig = {
  PERSON_NAME: {
    en: [
      // Salutations (high weight)
      { word: 'mr', weight: 1.0, polarity: 'positive' },
      { word: 'mrs', weight: 1.0, polarity: 'positive' },
      { word: 'ms', weight: 1.0, polarity: 'positive' },
      { word: 'miss', weight: 1.0, polarity: 'positive' },
      { word: 'dr', weight: 1.0, polarity: 'positive' },
      { word: 'prof', weight: 1.0, polarity: 'positive' },
      // Field labels (medium-high weight)
      { word: 'name', weight: 0.9, polarity: 'positive' },
      { word: 'contact', weight: 0.8, polarity: 'positive' },
      { word: 'attention', weight: 0.8, polarity: 'positive' },
      { word: 'attn', weight: 0.8, polarity: 'positive' },
      { word: 'dear', weight: 0.7, polarity: 'positive' },
      // Identifiers (medium weight)
      { word: 'by', weight: 0.6, polarity: 'positive' },
      { word: 'from', weight: 0.6, polarity: 'positive' },
      { word: 'to', weight: 0.6, polarity: 'positive' },
      { word: 'author', weight: 0.7, polarity: 'positive' },
      { word: 'owner', weight: 0.7, polarity: 'positive' },
      { word: 'manager', weight: 0.7, polarity: 'positive' },
      { word: 'director', weight: 0.7, polarity: 'positive' },
      { word: 'signed', weight: 0.6, polarity: 'positive' },
      { word: 'approved', weight: 0.6, polarity: 'positive' },
      // Negative context (reduces confidence)
      { word: 'example.com', weight: 0.8, polarity: 'negative' },
      { word: 'test@', weight: 0.7, polarity: 'negative' }
    ],
    fr: [
      // Salutations
      'm.', 'mme', 'mlle', 'dr', 'prof',
      // Field labels
      'nom', 'prénom', 'contact', 'attention', 'cher', 'chère',
      // Identifiers
      'par', 'de', 'à', 'auteur', 'propriétaire', 'responsable',
      'directeur', 'signé', 'approuvé'
    ],
    de: [
      // Salutations
      'herr', 'frau', 'dr', 'prof',
      // Field labels
      'name', 'vorname', 'kontakt', 'achtung', 'lieber', 'liebe',
      // Identifiers
      'von', 'an', 'autor', 'eigentümer', 'verantwortlich',
      'direktor', 'unterschrieben', 'genehmigt'
    ]
  },

  PHONE_NUMBER: {
    en: [
      'phone', 'tel', 'telephone', 'mobile', 'cell', 'fax',
      'call', 'contact', 'number', 'direct', 'office', 'home'
    ],
    fr: [
      'téléphone', 'tél', 'mobile', 'portable', 'fax',
      'appeler', 'contact', 'numéro', 'direct', 'bureau', 'domicile'
    ],
    de: [
      'telefon', 'tel', 'mobil', 'handy', 'fax',
      'anrufen', 'kontakt', 'nummer', 'direkt', 'büro', 'privat'
    ]
  },

  EMAIL: {
    en: [
      'email', 'e-mail', 'mail', 'contact', 'address',
      'send', 'write', 'message'
    ],
    fr: [
      'courriel', 'e-mail', 'email', 'mail', 'contact', 'adresse',
      'envoyer', 'écrire', 'message'
    ],
    de: [
      'email', 'e-mail', 'mail', 'kontakt', 'adresse',
      'senden', 'schreiben', 'nachricht'
    ]
  },

  ADDRESS: {
    en: [
      'address', 'street', 'road', 'avenue', 'postal', 'zip',
      'city', 'town', 'location', 'deliver', 'ship'
    ],
    fr: [
      'adresse', 'rue', 'avenue', 'chemin', 'postal', 'code',
      'ville', 'localité', 'livrer', 'livraison'
    ],
    de: [
      'adresse', 'strasse', 'weg', 'platz', 'postleitzahl', 'plz',
      'stadt', 'ort', 'liefern', 'lieferung'
    ]
  },

  IBAN: {
    en: ['iban', 'account', 'bank', 'transfer', 'payment', 'swift', 'bic'],
    fr: ['iban', 'compte', 'banque', 'virement', 'paiement', 'swift', 'bic'],
    de: ['iban', 'konto', 'bank', 'überweisung', 'zahlung', 'swift', 'bic']
  },

  SWISS_AVS: {
    en: ['avs', 'ahv', 'social', 'security', 'insurance'],
    fr: ['avs', 'numéro', 'sécurité', 'sociale', 'assurance'],
    de: ['ahv', 'nummer', 'sozialversicherung', 'versicherung']
  },

  SWISS_POSTAL_CODE: {
    en: ['postal', 'zip', 'code', 'npa'],
    fr: ['postal', 'code', 'npa', 'localité'],
    de: ['postleitzahl', 'plz', 'ort']
  },

  DATE: {
    en: ['date', 'born', 'birth', 'dob', 'issued', 'expires', 'valid'],
    fr: ['date', 'né', 'naissance', 'émis', 'expire', 'valide'],
    de: ['datum', 'geboren', 'geburt', 'ausgestellt', 'gültig']
  }
};

/**
 * Get context words for entity type and language
 * @param entityType - The PII entity type
 * @param language - The language code (en, fr, de)
 * @returns Array of context words with weights and polarity
 */
export function getContextWords(entityType: string, language: string): ContextWord[];

/**
 * Get simple word list (backward compatibility)
 * @param entityType - The PII entity type
 * @param language - The language code (en, fr, de)
 * @returns Array of word strings (empty if not found)
 */
export function getContextWordStrings(entityType: string, language: string): string[];

/**
 * Get all context words for an entity type (all languages)
 * @param entityType - The PII entity type
 * @returns Array of unique context words
 */
export function getAllContextWords(entityType: string): string[];
```

### API Functions

```typescript
export function getContextWords(entityType: string, language: string): ContextWord[] {
  const typeWords = CONTEXT_WORDS[entityType];
  if (!typeWords) return [];
  return typeWords[language] || [];
}

export function getContextWordStrings(entityType: string, language: string): string[] {
  return getContextWords(entityType, language).map(cw => cw.word);
}

export function getAllContextWords(entityType: string): ContextWord[] {
  const typeWords = CONTEXT_WORDS[entityType];
  if (!typeWords) return [];
  const allWords: ContextWord[] = [];
  const seen = new Set<string>();
  Object.values(typeWords).forEach(words => {
    words.forEach(cw => {
      const key = cw.word.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        allWords.push(cw);
      }
    });
  });
  return allWords;
}

export function getMetadata(): ContextWordsMetadata {
  return CONTEXT_WORDS_METADATA;
}
```

**Note:** For backward compatibility, `ContextEnhancer` (Story 8.3) can use `getContextWordStrings()` initially, then be enhanced to use weights in a future iteration.

## Prerequisites

None (can run parallel with Story 8.1)

## Integration Points

- Used by `ContextEnhancer.ts` (Story 8.3)
- Used by `ContextScoringPass.ts` (Story 8.4)

## Test Scenarios

1. getContextWords('PERSON_NAME', 'en') returns English name words
2. getContextWords('PERSON_NAME', 'fr') returns French name words
3. getContextWords('PHONE_NUMBER', 'de') returns German phone words
4. getContextWords('UNKNOWN', 'en') returns empty array
5. getAllContextWords('EMAIL') returns all languages combined
6. Context words include salutations (Mr, Mme, Herr)
7. Context words include field labels (Name:, Nom:)

## Definition of Done

- [ ] `shared/pii/context/ContextWords.ts` created with weighted ContextWord interface
- [ ] Metadata structure includes version, source, lastUpdated
- [ ] Unit tests in `test/unit/pii/context/ContextWords.test.ts`
- [ ] All entity types have EN, FR, DE words (with weights and polarity)
- [ ] API functions work correctly (both weighted and string-based for compatibility)
- [ ] Negative context words included for common false positive patterns
- [ ] TypeScript compiles without errors
- [ ] Works in both Electron and Browser environments
