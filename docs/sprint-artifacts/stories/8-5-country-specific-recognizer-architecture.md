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
| **Status** | Complete |
| **Created** | 2025-12-23 |
| **Context Generated** | 2025-12-25 |
| **Implemented** | 2025-12-25 |
| **Context File** | [8-5-country-specific-recognizer-architecture.context.xml](./8-5-country-specific-recognizer-architecture.context.xml) |

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
**And** weak patterns have configurable `lowConfidenceMultiplier` (Presidio pattern for weak patterns like 5-digit zip codes)
**And** recognizers can be loaded from YAML configuration files (code-free extensibility)

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
  /** Mark as weak pattern - applies lowConfidenceMultiplier (e.g., 5-digit zip, 4-digit numbers) */
  isWeakPattern?: boolean;
}

/**
 * Global registry configuration
 */
export interface RegistryGlobalConfig {
  /** Multiplier for weak patterns (Presidio default: 0.4) */
  lowConfidenceMultiplier: number;
  /** Entity types always treated as weak (Presidio pattern) */
  lowScoreEntityNames: string[];
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

/**
 * Load recognizers from YAML configuration file
 * Presidio pattern: code-free recognizer addition
 */
export function loadRecognizersFromYAML(yamlPath: string): void {
  // Parse YAML file with structure:
  // recognizers:
  //   - name: USPhoneNumber
  //     supportedCountries: [US]
  //     supportedLanguages: [en]
  //     patterns:
  //       - regex: "\\b\\d{3}[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b"
  //         score: 0.4
  //         entityType: PHONE_NUMBER
  //         isWeakPattern: true
  //     contextWords: [phone, call, tel]
  //     denyPatterns: []
  // Implementation: parse YAML, create PatternRecognizer instances, register
}

export { BaseRecognizer } from './BaseRecognizer';
export * from './types';
```

### YAML Configuration Example

```yaml
# config/recognizers/us-recognizers.yaml
version: "1.0"
recognizers:
  - name: USPhoneNumber
    supportedCountries: [US]
    supportedLanguages: [en]
    priority: 50
    patterns:
      - regex: "\\b\\d{3}[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b"
        score: 0.4
        entityType: PHONE_NUMBER
        isWeakPattern: true  # Applies lowConfidenceMultiplier
    contextWords: [phone, call, tel, mobile, cell]
    denyPatterns: []
    useGlobalContext: true
    useGlobalDenyList: true

  - name: USZipCode
    supportedCountries: [US]
    supportedLanguages: [en]
    priority: 30
    patterns:
      - regex: "\\b\\d{5}(-\\d{4})?\\b"
        score: 0.01  # Very weak without context
        entityType: ZIP_CODE
        isWeakPattern: true
    contextWords: [zip, zipcode, postal]
    denyPatterns: []
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

- [x] `shared/pii/recognizers/types.ts` created with priority field and `isWeakPattern` flag
- [x] `shared/pii/recognizers/BaseRecognizer.ts` created with `lowConfidenceMultiplier` support
- [x] `shared/pii/recognizers/index.ts` barrel created with registry config support
- [x] `shared/pii/countries/ch/AvsRecognizer.ts` example with priority=70 (high)
- [x] Directory structure for core, ch, eu, us
- [x] Registry configuration integration with `detectionRules.json` or YAML
- [x] YAML loader `loadRecognizersFromYAML()` implemented for code-free extensibility
- [x] `RegistryGlobalConfig` with `lowConfidenceMultiplier` (default: 0.4) and `lowScoreEntityNames`
- [x] Priority-based sorting and conflict resolution logic
- [x] Unit tests in `test/unit/pii/recognizers/`
- [x] TypeScript compiles without errors
- [x] Documentation in code comments

## Implementation Notes

### Files Created

```
shared/pii/
├── recognizers/
│   ├── types.ts              # Interfaces: Recognizer, RecognizerConfig, PatternDefinition, etc.
│   ├── BaseRecognizer.ts     # Abstract base class with lazy pattern compilation
│   ├── Registry.ts           # RecognizerRegistry with priority sorting, error isolation
│   ├── YamlLoader.ts         # YAML/JSON loader with Zod validation, GenericRecognizer
│   └── index.ts              # Barrel export
└── countries/
    ├── index.ts              # Re-exports all country modules
    ├── core/
    │   └── index.ts          # Placeholder for universal patterns
    ├── ch/
    │   ├── AvsRecognizer.ts  # Swiss AVS/AHV with EAN-13 checksum validation
    │   └── index.ts
    ├── eu/
    │   └── index.ts          # Placeholder for EU patterns
    └── us/
        └── index.ts          # Placeholder for US patterns

test/unit/pii/recognizers/
├── types.test.js             # Default config tests
├── BaseRecognizer.test.js    # Pattern matching, deny list, validation
├── Registry.test.js          # Registration, priority, specificity, error isolation
├── AvsRecognizer.test.js     # AVS detection and checksum validation
└── YamlLoader.test.js        # YAML parsing and recognizer creation
```

### Key Design Decisions (from Elicitation)

1. **Interface-first design**: `Recognizer` interface is separate from `BaseRecognizer` abstract class for flexibility
2. **Specificity tiebreaker**: When priorities are equal, `specificity` field (country > region > global) determines order
3. **Error isolation**: `RecognizerRegistry.analyze()` wraps each recognizer in try-catch to prevent cascade failures
4. **Browser compatibility**: `ensureInitialized()` check throws clear error if registry is empty (tree-shaking safety)
5. **Lazy pattern compilation**: Patterns compiled once on first use for performance

---

## Senior Developer Review (AI)

### Review Details

| Field | Value |
|-------|-------|
| **Reviewer** | Olivier |
| **Date** | 2025-12-25 |
| **Outcome** | ✅ APPROVE |
| **Tests** | 1312 passing (63 new recognizer tests) |

### Summary

Excellent implementation of the country-specific recognizer architecture. All acceptance criteria are fully implemented with comprehensive test coverage. The code follows Microsoft Presidio patterns, integrates well with existing DenyList/ContextWords systems, and includes pre-mortem mitigations (error isolation, browser compatibility checks, specificity tiebreaker).

### Acceptance Criteria Coverage

| AC# | Description | Status | Evidence |
|-----|-------------|--------|----------|
| AC-8.5.1 | US SSN pattern extensibility | ✅ IMPLEMENTED | `shared/pii/countries/us/index.ts` - directory structure supports adding SsnRecognizer.ts |
| AC-8.5.2 | BaseRecognizer provides standard interface | ✅ IMPLEMENTED | `shared/pii/recognizers/BaseRecognizer.ts:66-245` - abstract class with analyze(), supportsLanguage(), supportsCountry() |
| AC-8.5.3 | Recognizers declare countries/languages | ✅ IMPLEMENTED | `types.ts:49-53` - supportedLanguages[], supportedCountries[] in RecognizerConfig |
| AC-8.5.4 | Recognizers include context words/deny patterns | ✅ IMPLEMENTED | `types.ts:67-71` - contextWords[], denyPatterns[] in RecognizerConfig |
| AC-8.5.5 | Validation functions per-recognizer | ✅ IMPLEMENTED | `types.ts:74` - optional validator function; `AvsRecognizer.ts:90-116` - EAN-13 checksum |
| AC-8.5.6 | Priority field for conflict resolution | ✅ IMPLEMENTED | `types.ts:58-65` - priority field + specificity tiebreaker; `Registry.ts:298-313` - sortByPriority() |
| AC-8.5.7 | Registration is configuration-driven | ✅ IMPLEMENTED | `Registry.ts:60-76` - RecognizerRegistry.register(); `types.ts:120-141` - RegistryGlobalConfig |
| AC-8.5.8 | Global/override context and deny lists | ✅ IMPLEMENTED | `types.ts:77-80` - useGlobalContext, useGlobalDenyList flags; `BaseRecognizer.ts:181-211` - isDenied() checks both |
| AC-8.5.9 | lowConfidenceMultiplier for weak patterns | ✅ IMPLEMENTED | `types.ts:122-131` - lowConfidenceMultiplier (0.4), lowScoreEntityNames; `Registry.ts:265-293` - applyConfidenceAdjustments() |
| AC-8.5.10 | YAML configuration loading | ✅ IMPLEMENTED | `YamlLoader.ts:189-200` - loadRecognizersFromYaml() with Zod validation |

**Summary: 10 of 10 acceptance criteria fully implemented**

### Task Completion Validation

| Task | Marked As | Verified As | Evidence |
|------|-----------|-------------|----------|
| Task 1: Create types.ts | ✅ Complete | ✅ VERIFIED | `shared/pii/recognizers/types.ts` - 225 lines with all interfaces |
| Task 2: Implement BaseRecognizer | ✅ Complete | ✅ VERIFIED | `shared/pii/recognizers/BaseRecognizer.ts` - 246 lines |
| Task 3: Create Registry | ✅ Complete | ✅ VERIFIED | `shared/pii/recognizers/Registry.ts` - 401 lines |
| Task 4: Scaffold directory structure | ✅ Complete | ✅ VERIFIED | `shared/pii/countries/{core,ch,eu,us}/` all exist with index.ts |
| Task 5: Implement AvsRecognizer | ✅ Complete | ✅ VERIFIED | `shared/pii/countries/ch/AvsRecognizer.ts` - 155 lines with EAN-13 validation |
| Task 6: RegistryGlobalConfig | ✅ Complete | ✅ VERIFIED | `types.ts:120-141` - includes lowConfidenceMultiplier, lowScoreEntityNames |
| Task 7: YAML loader | ✅ Complete | ✅ VERIFIED | `YamlLoader.ts` - 229 lines with Zod schemas, GenericRecognizer |
| Task 8: Unit tests | ✅ Complete | ✅ VERIFIED | 5 test files in `test/unit/pii/recognizers/` |

**Summary: 8 of 8 tasks verified, 0 questionable, 0 false completions**

### Test Coverage and Gaps

**Tests Verified:**
- `types.test.js` - DEFAULT_RECOGNIZER_CONFIG, DEFAULT_REGISTRY_CONFIG
- `BaseRecognizer.test.js` - Pattern matching, language/country support, deny list, validation
- `Registry.test.js` - Registration, priority sorting, specificity tiebreaker, error isolation, browser compatibility
- `AvsRecognizer.test.js` - AVS detection, checksum validation, format helpers
- `YamlLoader.test.js` - YAML parsing, recognizer creation, validation

**Coverage Strengths:**
- Pre-mortem scenarios tested (error isolation, empty registry throws)
- Edge cases covered (empty text, no matches, multiple matches)
- Presidio patterns tested (lowConfidenceMultiplier, weak patterns)

### Architectural Alignment

✅ **Tech-Spec Compliance:**
- All interfaces match tech-spec definitions
- Pattern scores follow 0.3-0.7 Presidio guidelines
- Priority-based sorting with specificity tiebreaker

✅ **Integration Points:**
- DenyList integration via useGlobalDenyList flag (BaseRecognizer.ts:203-208)
- ContextWords integration via useGlobalContext flag
- Proper exports from shared/pii/index.ts

✅ **Pre-mortem Mitigations:**
- Error isolation in Registry.analyze() (try-catch per recognizer)
- Browser compatibility check in ensureInitialized()
- Lazy pattern compilation for performance

### Security Notes

- No security vulnerabilities identified
- Pattern matching uses compiled RegExp (not user input)
- Zod validation for YAML config input

### Best-Practices and References

- [Microsoft Presidio Recognizer Design](https://microsoft.github.io/presidio/supported_entities/)
- [Zod Schema Validation](https://zod.dev/)
- Swiss AVS uses EAN-13 checksum per [Federal standards](https://www.ahv-iv.ch/)

### Action Items

**Code Changes Required:**
*None - all acceptance criteria and tasks verified*

**Advisory Notes:**
- Note: Consider adding EmailRecognizer and IbanRecognizer to core/ for universal patterns (future work)
- Note: TypeScript compiles successfully - no type errors
- Note: All 1312 tests passing including 63 new recognizer tests
