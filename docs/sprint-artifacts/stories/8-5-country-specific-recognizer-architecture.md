# Story 8.5: Country-Specific Recognizer Architecture

## Story

As a **PII system maintainer**,
I want **patterns organized by country with clear extension points**,
So that **adding US patterns doesn't require modifying Swiss code**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.5 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Backlog |
| **Created** | 2025-12-23 |

## Acceptance Criteria

**Given** need to add US SSN pattern
**When** developer creates `shared/pii/countries/us/SsnRecognizer.ts`
**Then** pattern is automatically available when US region enabled

**And** BaseRecognizer abstract class provides standard interface
**And** each recognizer declares supported countries and languages
**And** recognizers include their own context words and deny patterns
**And** validation functions (checksums) are per-recognizer
**And** recognizers have explicit priority field for conflict resolution
**And** recognizer registration and enablement is configuration-driven
**And** recognizers can use global ContextWords/DenyList or override with their own

## Technical Design

### Files to Create

```
shared/pii/
├── recognizers/
│   ├── types.ts              # Interfaces and types
│   ├── BaseRecognizer.ts     # Abstract base class
│   └── index.ts              # Barrel export
└── countries/
    ├── core/                 # Universal patterns
    │   ├── EmailRecognizer.ts
    │   ├── IbanRecognizer.ts
    │   └── index.ts
    ├── ch/                   # Swiss patterns
    │   ├── AvsRecognizer.ts
    │   ├── SwissPhoneRecognizer.ts
    │   └── index.ts
    ├── eu/                   # EU patterns
    │   ├── VatRecognizer.ts
    │   └── index.ts
    └── us/                   # US patterns (scaffolded)
        └── index.ts
```

### Recognizer Interface

```typescript
// shared/pii/recognizers/types.ts

/**
 * Pattern definition for recognizers
 */
export interface PatternDefinition {
  /** Regex to match */
  regex: RegExp;
  /** Base confidence score (0.3-0.7) */
  score: number;
  /** Entity type produced */
  entityType: string;
  /** Optional name for debugging */
  name?: string;
}

/**
 * Recognizer configuration
 */
export interface RecognizerConfig {
  /** Unique recognizer name */
  name: string;
  /** Supported language codes (en, fr, de) */
  supportedLanguages: string[];
  /** Supported country codes (CH, EU, US) */
  supportedCountries: string[];
  /** Detection patterns */
  patterns: PatternDefinition[];
  /** Priority for conflict resolution (higher = more specific, default: 50) */
  priority: number;
  /** Context words for confidence boost (if empty, uses global ContextWords) */
  contextWords: string[];
  /** Deny patterns for false positives (if empty, uses global DenyList) */
  denyPatterns: (string | RegExp)[];
  /** Optional validation function (checksum, etc.) */
  validator?: (match: string) => boolean;
  /** Whether to use global context/deny lists (default: true) */
  useGlobalContext: boolean;
  useGlobalDenyList: boolean;
}

/**
 * Detection result from recognizer
 */
export interface RecognizerMatch {
  text: string;
  type: string;
  start: number;
  end: number;
  confidence: number;
  source: string;
  recognizer: string;
}
```

### Base Recognizer Class

```typescript
// shared/pii/recognizers/BaseRecognizer.ts

import { RecognizerConfig, RecognizerMatch, PatternDefinition } from './types';

export abstract class BaseRecognizer {
  abstract readonly config: RecognizerConfig;

  /**
   * Analyze text and return matches
   */
  analyze(text: string, language?: string): RecognizerMatch[] {
    if (language && !this.supportsLanguage(language)) {
      return [];
    }

    const matches: RecognizerMatch[] = [];

    for (const pattern of this.config.patterns) {
      const regex = new RegExp(pattern.regex, 'gi');
      let match;

      while ((match = regex.exec(text)) !== null) {
        const matchText = match[0];

        // Check deny list
        if (this.isDenied(matchText)) {
          continue;
        }

        // Validate if validator exists
        if (this.config.validator && !this.config.validator(matchText)) {
          continue;
        }

        matches.push({
          text: matchText,
          type: pattern.entityType,
          start: match.index,
          end: match.index + matchText.length,
          confidence: pattern.score,
          source: 'RULE',
          recognizer: this.config.name
        });
      }
    }

    return matches;
  }

  /**
   * Check if recognizer supports language
   */
  supportsLanguage(language: string): boolean {
    return this.config.supportedLanguages.includes(language);
  }

  /**
   * Check if recognizer supports country
   */
  supportsCountry(country: string): boolean {
    return this.config.supportedCountries.includes(country);
  }

  /**
   * Check if text is in deny list
   */
  protected isDenied(text: string): boolean {
    const normalized = text.toLowerCase();
    return this.config.denyPatterns.some(pattern => {
      if (typeof pattern === 'string') {
        return normalized === pattern.toLowerCase();
      }
      return pattern.test(text);
    });
  }

  /**
   * Get context words for this recognizer
   */
  getContextWords(): string[] {
    return this.config.contextWords;
  }
}
```

### Example: Swiss AVS Recognizer

```typescript
// shared/pii/countries/ch/AvsRecognizer.ts

import { BaseRecognizer, RecognizerConfig } from '../../recognizers';

export class AvsRecognizer extends BaseRecognizer {
  readonly config: RecognizerConfig = {
    name: 'SwissAVS',
    supportedLanguages: ['de', 'fr', 'it', 'en'],
    supportedCountries: ['CH'],
    patterns: [
      {
        regex: /756\.\d{4}\.\d{4}\.\d{2}/,
        score: 0.7,
        entityType: 'SWISS_AVS',
        name: 'AVS with dots'
      },
      {
        regex: /756\d{10}/,
        score: 0.6,
        entityType: 'SWISS_AVS',
        name: 'AVS without dots'
      }
    ],
    contextWords: ['avs', 'ahv', 'social', 'sécurité', 'sozialversicherung'],
    denyPatterns: [],
    validator: this.validateChecksum.bind(this)
  };

  private validateChecksum(avs: string): boolean {
    const digits = avs.replace(/\D/g, '');
    if (digits.length !== 13) return false;

    // EAN-13 checksum validation
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(digits[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(digits[12], 10);
  }
}
```

### Recognizer Registry

```typescript
// shared/pii/recognizers/index.ts

import { BaseRecognizer } from './BaseRecognizer';
import { RecognizerRegistryConfig } from './types';

const registry: Map<string, BaseRecognizer> = new Map();

export interface RecognizerRegistryConfig {
  enabledCountries?: string[];  // If set, only these countries enabled
  enabledLanguages?: string[];  // If set, only these languages enabled
  enabledRecognizers?: string[]; // If set, only these recognizers enabled
}

export function registerRecognizer(recognizer: BaseRecognizer): void {
  registry.set(recognizer.config.name, recognizer);
}

export function getRecognizers(
  country?: string,
  language?: string,
  config?: RecognizerRegistryConfig
): BaseRecognizer[] {
  let recognizers = Array.from(registry.values());
  
  // Filter by country/language
  if (country) {
    recognizers = recognizers.filter(r => r.supportsCountry(country));
  }
  if (language) {
    recognizers = recognizers.filter(r => r.supportsLanguage(language));
  }
  
  // Apply registry config
  if (config) {
    if (config.enabledCountries) {
      recognizers = recognizers.filter(r =>
        r.config.supportedCountries.some(c => config.enabledCountries!.includes(c))
      );
    }
    if (config.enabledLanguages) {
      recognizers = recognizers.filter(r =>
        r.config.supportedLanguages.some(l => config.enabledLanguages!.includes(l))
      );
    }
    if (config.enabledRecognizers) {
      recognizers = recognizers.filter(r =>
        config.enabledRecognizers!.includes(r.config.name)
      );
    }
  }
  
  // Sort by priority (higher priority first)
  return recognizers.sort((a, b) => 
    (b.config.priority || 50) - (a.config.priority || 50)
  );
}

export function resolveOverlappingMatches(
  matches: RecognizerMatch[]
): RecognizerMatch[] {
  // When multiple recognizers match same span, prefer higher priority
  // Implementation deferred to ConsolidationPass (Story 8.8)
  return matches;
}

export { BaseRecognizer } from './BaseRecognizer';
export * from './types';
```

## Prerequisites

- Stories 8.1, 8.2, 8.3 (architecture informs design)

## Integration Points

- Recognizers can use global `ContextWords` and `DenyList` (Stories 8.1, 8.2) via `useGlobalContext`/`useGlobalDenyList` flags
- Registry configuration loaded from `detectionRules.json` (canonical config file)
- Future work: migrate existing SwissEuDetector patterns to recognizers
- Future work: integrate registry with DetectionPipeline
- This story creates architecture only; migration is future epic
- Priority-based conflict resolution feeds into ConsolidationPass (Story 8.8)

## Test Scenarios

1. RecognizerConfig interface is valid TypeScript
2. BaseRecognizer.analyze() detects patterns
3. BaseRecognizer.isDenied() filters correctly
4. Validator function is called when present
5. Language/country filtering works
6. Registry registration and lookup works
7. Swiss AVS recognizer detects valid AVS numbers
8. Swiss AVS checksum validation works

## Definition of Done

- [ ] `shared/pii/recognizers/types.ts` created with priority field
- [ ] `shared/pii/recognizers/BaseRecognizer.ts` created
- [ ] `shared/pii/recognizers/index.ts` barrel created with registry config support
- [ ] `shared/pii/countries/ch/AvsRecognizer.ts` example with priority=70 (high)
- [ ] Directory structure for core, ch, eu, us
- [ ] Registry configuration integration with `detectionRules.json`
- [ ] Priority-based sorting and conflict resolution logic
- [ ] Unit tests in `test/unit/pii/recognizers/`
- [ ] TypeScript compiles without errors
- [ ] Documentation in code comments
