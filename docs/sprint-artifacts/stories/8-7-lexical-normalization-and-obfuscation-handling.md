# Story 8.7: Lexical Normalization & Obfuscation Handling

## Story

As a **PII detector**,  
I want **input text to be normalized and common PII obfuscations reversed before detection**,  
So that **phone numbers, emails, and IDs written in “human‑obfuscated” form are still reliably detected and anonymised**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.7 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Backlog |
| **Created** | 2025-12-24 |

## Acceptance Criteria

**Given** an email written as `john (dot) doe (at) mail (dot) ch`  
**When** the detection pipeline runs  
**Then** it is normalized so that the EMAIL recognizer detects it as PII.

**And** common obfuscation patterns for emails and phone numbers (EN/FR/DE) are handled (e.g. "at", "(at)", "(a)", "dot", "(dot)", spaces and dashes between digits).  
**And** zero‑width spaces and non‑breaking spaces are removed before detection.  
**And** Unicode is normalized to a consistent form (e.g. NFKC) before tokenization.  
**And** original character offsets can still be mapped back for accurate anonymisation and mapping file generation.
**And** normalization rules are conservative and can be disabled/tuned per rule type if they cause regressions
**And** obfuscation patterns are initially EN/FR/DE only (other locales documented as future extension)

## Technical Design

### File to Create

`shared/pii/preprocessing/TextNormalizer.ts`

### Responsibilities

- Perform **text‑level normalization** before HighRecall detection:
  - Unicode normalization (NFKC).
  - Canonical whitespace normalization (spaces, tabs, non‑breaking, zero‑width spaces).
  - De‑obfuscation of common PII formats (emails, phones).
- Maintain a **position mapping** from normalized text back to original indices for offset repair.

### Interfaces

```typescript
export interface NormalizationResult {
  /** Normalized text used by downstream passes */
  normalizedText: string;
  /**
   * Map from normalized index to original index.
   * For indices that result from collapsing characters (e.g. removing zero‑width spaces),
   * map to the nearest original index.
   */
  indexMap: number[];
}

export interface TextNormalizerOptions {
  /** Enable/disable email de‑obfuscation (default: true) */
  handleEmails?: boolean;
  /** Enable/disable phone de‑obfuscation (default: true) */
  handlePhones?: boolean;
  /** Enable/disable Unicode normalization (default: true) */
  normalizeUnicode?: boolean;
  /** Enable/disable whitespace normalization (default: true) */
  normalizeWhitespace?: boolean;
  /** Target Unicode normalization form (default: 'NFKC') */
  normalizationForm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD';
  /** Supported locales for obfuscation patterns (default: ['en', 'fr', 'de']) */
  supportedLocales?: string[];
}

export class TextNormalizer {
  constructor(options?: TextNormalizerOptions);

  /**
   * Normalize input text for PII detection.
   * @param input Original document text
   */
  normalize(input: string): NormalizationResult;

  /**
   * Map an entity span from normalized text back to original text.
   */
  mapSpan(start: number, end: number, indexMap: number[]): { start: number; end: number };
}
```

### Normalization Rules (Initial Set)

- **Unicode & whitespace**
  - Normalize using `input.normalize('NFKC')`.
  - Replace `\u00A0` (non‑breaking space), `\u200B` (zero‑width space), and similar with a plain space or remove when between digits/letters of the same token.
  - Collapse multiple spaces and tabs into a single space.

- **Email de‑obfuscation** (case‑insensitive, multilingual hints)
  - Replace common patterns:
    - `(at)`, `[at]`, `{at}`, ` at ` → `@`
    - `(dot)`, `[dot]`, `{dot}`, ` dot ` → `.`
    - Variants like ` arobase ` (FR) → `@`
  - Remove unnecessary spaces around `@` and `.` in candidate email strings.

- **Phone de‑obfuscation**
  - Remove spaces, dashes, and dots between digits where appropriate:
    - `+41 79 123 45 67`, `+41-79-123-45-67`, `+41.79.123.45.67` → canonical digit + separator form.
  - Normalize `(0)` patterns: `+41 (0) 79 123 45 67` → `+41 79 123 45 67`.

### Algorithm (High‑Level)

1. Iterate through original string, emitting normalized characters into `normalizedText` while building `indexMap` such that:
   - `indexMap[normalizedIndex] = originalIndex`.
2. Apply obfuscation rewrites using conservative regexes, keeping `indexMap` updated.
3. Return `NormalizationResult`.
4. After detection on `normalizedText`, map each entity’s `(start, end)` back to original coordinates via `mapSpan`.

## Integration Points

- New **pre‑pass** used by both Electron and Browser pipelines:
  - `src/pii/DetectionPipeline.ts` (Electron)
  - `browser-app/src/processing/FileProcessor.ts` or browser DetectionPipeline equivalent.
- All subsequent passes (`HighRecallPass`, validators, `ContextScoringPass`) run on `normalizedText`.
- Mapping back to original offsets happens immediately before:
  - Anonymisation step in `Anonymizer.ts`.
  - Mapping file generation (so mapping reflects original content).

## Test Scenarios

1. `john (dot) doe (at) mail (dot) ch` → detected as EMAIL with correct original span.  
2. `+41 (0) 79-123-45-67` → normalized, PHONE recognizer fires; offsets map to full original number.  
3. Zero‑width spaces inside an IBAN (`CH93\u20000076 2011 6238 5295 7`) are removed and IBAN is detected.  
4. Mixed whitespace (tabs, NBSP) are normalized without altering semantic content.  
5. Disabling `handleEmails` or `handlePhones` leaves obfuscated patterns unchanged.  
6. Normalization does not shift offsets for text that is not transformed.  
7. Browser and Electron pipelines produce identical entity spans on the same obfuscated fixture.

## Definition of Done

- [ ] `shared/pii/preprocessing/TextNormalizer.ts` implemented with configurable options.  
- [ ] Normalization integrated as the first step in both Electron and Browser detection pipelines.  
- [ ] Unit tests in `test/unit/pii/preprocessing/TextNormalizer.test.ts`.  
- [ ] Integration tests with obfuscated fixtures added under `test/fixtures/piiAnnotated/`.  
- [ ] Configurable normalization rules (can disable email/phone/unicode/whitespace independently)
- [ ] Locale dependency documented (EN/FR/DE initially, extension path for other locales)
- [ ] Regression tests verify normalization doesn't break existing detection
- [ ] TypeScript compiles without errors in both projects.  
- [ ] Documented briefly in `docs/architecture.md` under the detection pipeline section.


