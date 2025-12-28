# A5-PII-Anonymizer - Epic Breakdown

**Author:** Olivier
**Date:** 2025-12-05
**Project Level:** Production Enhancement
**Target Scale:** Desktop Application (Individual/SMB)

---

## Overview

This document provides the epic and story breakdown for A5-PII-Anonymizer v3.0 enhancements, building on the production-ready v2.0.0 base. The focus is on **accuracy improvements** identified in the brainstorming session and **planned features** from the PRD.

**Living Document Notice:** This is the initial version from PRD analysis. Will be enhanced after Architecture workflow adds technical decisions.

### Epic Summary

| Epic | Goal | Stories | FRs Covered |
|------|------|---------|-------------|
| Epic 1 | Multi-Pass Detection Architecture | 5 | FR-2.10 |
| Epic 2 | Address Relationship Modeling | 4 | FR-2.7 (enhanced) |
| Epic 3 | Document-Type Detection | 4 | FR-2.11 |
| Epic 4 | User Review Workflow | 4 | FR-3.5, FR-5.7, FR-5.8 |
| Epic 5 | Confidence Scoring & Feedback | 3 | Quality improvement |
| Epic 6 | Infrastructure & Developer Experience | 7 | DX-2-4, SEC-1-2, UX-1, BUG-1 |
| Epic 7 | Browser Migration | 8 | FR-6.1-6.6, FR-5.8, FR-5.9 (browser) |
| Epic 8 | PII Detection Quality Improvement | 6 | FR-2.12 (Presidio patterns) |
| Epic 9 | UI Harmonization (Tailwind + shadcn) | 6 | DX-5, UX-2 |
| Epic 10 | Console-to-Logger Migration | 10 | DX-6, DX-7, SEC-3 |

**Total:** 10 Epics, 57 Stories

---

## Functional Requirements Inventory

### Completed (v2.0.0) - Reference Only
- FR-1.1 through FR-1.8: Document Ingestion (All Done)
- FR-2.1 through FR-2.9: PII Detection Core (All Done)
- FR-3.1 through FR-3.4: Anonymization Core (All Done)
- FR-4.1 through FR-4.6: Output Generation (All Done)
- FR-5.1 through FR-5.6: User Interface Core (All Done)

### Planned (v3.0) - This Epic Breakdown
- FR-2.10: Multi-pass detection for relationship modeling
- FR-2.11: Document-type-aware detection rules
- FR-3.5: Partial anonymization (user entity selection)
- FR-5.7: Entity sidebar with type filters
- FR-5.8: Manual PII marking tool

### Planned (v3.1) - Browser Migration
- FR-6.1: Browser-native document conversion
- FR-6.2: Client-side ML model loading
- FR-6.3: Browser PII detection pipeline
- FR-6.4: Entity review UI (browser)
- FR-6.5: Browser file I/O (download/upload)
- FR-6.6: Progressive Web App support

---

## FR Coverage Map

| FR ID | Description | Epic | Stories |
|-------|-------------|------|---------|
| FR-2.10 | Multi-pass detection | Epic 1 | 1.1-1.5 |
| FR-2.7 (enhanced) | Address relationship modeling | Epic 2 | 2.1-2.4 |
| FR-2.11 | Document-type detection | Epic 3 | 3.1-3.4 |
| FR-3.5 | Partial anonymization | Epic 4 | 4.3 |
| FR-5.7 | Entity sidebar | Epic 4 | 4.1, 4.2 |
| FR-5.8 | Manual PII marking | Epic 4 | 4.4 |
| FR-6.1 | Browser document conversion | Epic 7 | 7.1 |
| FR-6.2 | Client-side ML loading | Epic 7 | 7.2 |
| FR-6.3 | Browser PII pipeline | Epic 7 | 7.3 |
| FR-6.4 | Entity review UI (browser) | Epic 7 | 7.4 |
| FR-6.5 | Browser file I/O | Epic 7 | 7.5 |
| FR-6.6 | PWA support | Epic 7 | 7.6 |

---

## Epic 1: Multi-Pass Detection Architecture

**Goal:** Transform the current single-pass PII detection into a multi-pass architecture that improves accuracy from 94% to 98%+ by separating entity detection, validation, and relationship linking into distinct phases.

**User Value:** Users get significantly fewer missed PII (false negatives) and fewer false positives, reducing manual review time and improving compliance confidence.

**FRs Covered:** FR-2.10

---

### Story 1.1: Detection Pipeline Orchestrator

As a **system architect**,
I want **a pipeline orchestrator that sequences multiple detection passes**,
So that **each pass can build on the results of previous passes**.

**Acceptance Criteria:**

**Given** a document text input
**When** the orchestrator receives a processDocument() call
**Then** it executes Pass 1 (raw detection), Pass 2 (validation), Pass 3 (relationship linking) in sequence

**And** each pass receives the cumulative entity list from previous passes
**And** the final result includes merged, deduplicated entities with confidence scores
**And** processing completes within 2x the current single-pass time

**Prerequisites:** None (foundation story)

**Technical Notes:**
- Create new `src/pii/DetectionPipeline.ts`
- Define `DetectionPass` interface with `execute(text: string, entities: Entity[]): Entity[]`
- Implement pass registry and sequencing logic
- Maintain backward compatibility with existing `FileProcessor.processFile()` API
- Add pipeline configuration in settings for enabling/disabling passes

---

### Story 1.2: Pass 1 - High-Recall Entity Detection

As a **PII detection system**,
I want **a first pass focused on maximum recall (finding all possible entities)**,
So that **subsequent passes can refine rather than miss entities**.

**Acceptance Criteria:**

**Given** document text as input
**When** Pass 1 executes
**Then** it runs ML model with lowered confidence threshold (0.3 vs current 0.5)

**And** it runs all SwissEuDetector regex patterns
**And** it outputs raw entity list with source tags (ML/RULE/BOTH)
**And** recall target is 99%+ (prefer false positives over false negatives)

**Prerequisites:** Story 1.1 (Pipeline Orchestrator)

**Technical Notes:**
- Modify ML model inference to accept configurable confidence threshold
- Add entity source tracking: `{ source: 'ML' | 'RULE' | 'BOTH' }`
- Keep existing patterns but mark as "high-recall mode"
- Log detection statistics for accuracy monitoring

---

### Story 1.3: Pass 2 - Format Validation

As a **PII detection system**,
I want **a second pass that validates entity formats and checksums**,
So that **false positives from Pass 1 are filtered out**.

**Acceptance Criteria:**

**Given** raw entity list from Pass 1
**When** Pass 2 executes
**Then** each entity is validated against format rules:
  - SWISS_AVS: Checksum validation (mod 97)
  - IBAN: Country code + checksum validation
  - PHONE: Swiss/EU format pattern matching
  - EMAIL: RFC 5322 validation
  - DATE: Valid date range check (1900-2100)

**And** entities failing validation are marked `confidence: 'low'` (not removed)
**And** entities passing validation get confidence boost

**Prerequisites:** Story 1.2 (Pass 1)

**Technical Notes:**
- Create `src/pii/validators/` directory with validator per entity type
- Swiss AVS checksum: `(11 - (sum % 11)) % 11`
- IBAN validation: ISO 7064 Mod 97-10
- Return validation result with reason if failed

---

### Story 1.4: Pass 3 - Context Scoring

As a **PII detection system**,
I want **a third pass that scores entities based on surrounding context**,
So that **ambiguous entities can be correctly classified**.

**Acceptance Criteria:**

**Given** validated entity list from Pass 2
**When** Pass 3 executes
**Then** each entity receives context score based on:
  - Proximity to related entities (name near phone = higher confidence)
  - Label keywords nearby ("Tel:", "Email:", "Name:" = higher confidence)
  - Document section (header/footer = lower for addresses)
  - Repetition count (same entity repeated = higher confidence)

**And** final confidence = base_confidence * context_multiplier
**And** entities below threshold (0.4) are flagged for user review

**Prerequisites:** Story 1.3 (Pass 2)

**Technical Notes:**
- Create `src/pii/ContextScorer.ts`
- Define context window size (50 chars before/after)
- Build keyword dictionary for each entity type
- Consider entity clustering for proximity scoring

---

### Story 1.5: Pipeline Integration Tests

As a **quality engineer**,
I want **comprehensive tests validating the multi-pass pipeline**,
So that **accuracy improvements are measurable and regressions prevented**.

**Acceptance Criteria:**

**Given** the golden test suite (100+ annotated documents)
**When** running pipeline integration tests
**Then** overall accuracy is measured and reported

**And** per-pass metrics are tracked (entities added/removed/modified)
**And** processing time regression is flagged if >3x baseline
**And** test report includes precision, recall, F1 score per entity type

**Prerequisites:** Stories 1.1-1.4 (Complete pipeline)

**Technical Notes:**
- Create `test/integration/pipeline.test.js`
- Use fixtures from `test/fixtures/piiAnnotated/`
- Generate accuracy report in JSON format
- Add to CI pipeline with baseline thresholds

---

## Epic 2: Address Relationship Modeling

**Goal:** Implement entity relationship modeling to group address components (street, number, postal code, city) into unified address entities, solving the root cause identified in brainstorming.

**User Value:** Complete addresses are anonymized as single units instead of fragmented components, preventing partial address leakage and improving anonymization quality.

**FRs Covered:** FR-2.7 (enhanced)

---

### Story 2.1: Address Component Classifier

As a **PII detection system**,
I want **to classify text segments as address components**,
So that **related components can be linked together**.

**Acceptance Criteria:**

**Given** detected entities and surrounding text
**When** address classification runs
**Then** the following component types are identified:
  - STREET_NAME: "Rue de Lausanne", "Bahnhofstrasse"
  - STREET_NUMBER: "12", "12a", "12-14"
  - POSTAL_CODE: "1000", "8001", "CH-1000"
  - CITY: "Lausanne", "Zurich", "Zürich"
  - COUNTRY: "Switzerland", "Suisse", "Schweiz", "CH"

**And** components are tagged with position (start, end indices)
**And** Swiss postal codes (1000-9999) are validated against known ranges

**Prerequisites:** Epic 1 complete (multi-pass pipeline)

**Technical Notes:**
- Create `src/pii/AddressClassifier.ts`
- Use Swiss Post postal code database for validation
- Handle multilingual city names (Genève/Geneva/Genf)
- Consider OCR artifacts in PDF addresses

---

### Story 2.2: Proximity-Based Component Linking

As a **PII detection system**,
I want **to link address components within spatial proximity**,
So that **"Rue de Lausanne 12, 1000 Lausanne" becomes one address entity**.

**Acceptance Criteria:**

**Given** classified address components
**When** proximity linking runs
**Then** components within 50 characters are grouped as candidates

**And** valid address patterns are recognized:
  - Swiss: [Street] [Number], [PostalCode] [City]
  - EU: [Street] [Number], [PostalCode] [City], [Country]
  - Alternative: [PostalCode] [City], [Street] [Number]

**And** grouped components create a single ADDRESS entity with sub-components
**And** original component entities are marked as "linked" (not standalone)

**Prerequisites:** Story 2.1 (Component Classifier)

**Technical Notes:**
- Implement sliding window grouping algorithm
- Define address pattern grammar for Swiss/EU formats
- Handle line breaks and formatting variations
- Store linked entity as: `{ type: 'ADDRESS', components: [...], text: 'full address' }`

---

### Story 2.3: Address Confidence Scoring

As a **PII detection system**,
I want **to assign confidence scores to grouped addresses**,
So that **incomplete or ambiguous groupings can be flagged for review**.

**Acceptance Criteria:**

**Given** a grouped address entity
**When** confidence scoring runs
**Then** score is calculated based on:
  - Component completeness: +0.2 per component (max 5)
  - Pattern match: +0.3 if matches known Swiss/EU format
  - Postal code validation: +0.2 if valid Swiss/EU postal code
  - City validation: +0.1 if matches known city

**And** addresses with confidence < 0.6 are flagged for user review
**And** high-confidence addresses (> 0.8) are auto-anonymized

**Prerequisites:** Story 2.2 (Proximity Linking)

**Technical Notes:**
- Create scoring function in AddressClassifier
- Maintain Swiss city/postal code lookup table
- Log confidence factors for debugging

---

### Story 2.4: Address Anonymization Strategy

As a **user processing documents**,
I want **grouped addresses anonymized as coherent units**,
So that **"Rue de Lausanne 12, 1000 Lausanne" becomes "[ADDRESS_1]" not "Rue de Lausanne [NUMBER], [POSTAL] [CITY]"**.

**Acceptance Criteria:**

**Given** a grouped address entity
**When** anonymization runs
**Then** the entire address span is replaced with single placeholder: [ADDRESS_N]

**And** mapping file stores full original address with components:
```json
{
  "ADDRESS_1": {
    "original": "Rue de Lausanne 12, 1000 Lausanne",
    "components": {
      "street": "Rue de Lausanne",
      "number": "12",
      "postal": "1000",
      "city": "Lausanne"
    }
  }
}
```

**And** partial matches (standalone postal codes) still work as fallback

**Prerequisites:** Story 2.3 (Confidence Scoring)

**Technical Notes:**
- Modify anonymization logic in fileProcessor.js
- Update mapping file schema for structured addresses
- Ensure re-identification can reconstruct full address

---

## Epic 3: Document-Type Detection

**Goal:** Implement document-type classification (invoice, letter, form, contract) to apply type-specific detection rules and reduce false positives.

**User Value:** Users processing invoices get invoice-optimized detection (amounts, dates, vendor info), while letter processing focuses on correspondent details, improving accuracy for each document type.

**FRs Covered:** FR-2.11

---

### Story 3.1: Document Type Classifier

As a **PII detection system**,
I want **to classify document types based on structure and content**,
So that **type-specific detection rules can be applied**.

**Acceptance Criteria:**

**Given** document text and structure
**When** classification runs (before PII detection)
**Then** document is classified as one of:
  - INVOICE: Contains amount patterns, "Invoice", "Rechnung", "Facture"
  - LETTER: Contains salutation, formal structure, signature block
  - FORM: Contains labeled fields, checkboxes, structured layout
  - CONTRACT: Contains parties, clauses, signatures, dates
  - REPORT: Contains sections, headings, narrative text
  - UNKNOWN: Default fallback

**And** classification confidence score is assigned (0-1)
**And** document type is stored in output YAML frontmatter

**Prerequisites:** None (standalone capability)

**Technical Notes:**
- Create `src/pii/DocumentClassifier.ts`
- Use keyword matching + structure analysis
- Consider using ML classifier in future (fine-tuned BERT)
- Store classification in processing metadata

---

### Story 3.2: Invoice-Specific Detection Rules

As a **user processing invoices**,
I want **invoice-optimized PII detection**,
So that **vendor details, amounts, and reference numbers are accurately identified**.

**Acceptance Criteria:**

**Given** document classified as INVOICE
**When** PII detection runs
**Then** additional patterns are active:
  - VENDOR_NAME: Company in header position
  - INVOICE_NUMBER: Reference patterns (INV-xxx, RE-xxx)
  - AMOUNT: Currency + number patterns (CHF 1'234.56, EUR 1.234,56)
  - VAT_NUMBER: Swiss/EU VAT formats (CHE-xxx.xxx.xxx)
  - PAYMENT_REF: Swiss QR reference, IBAN reference

**And** header/footer areas get special handling (logo text ignored)
**And** table cells are processed individually

**Prerequisites:** Story 3.1 (Document Classifier)

**Technical Notes:**
- Create `src/pii/rules/InvoiceRules.ts`
- Swiss VAT format: CHE-123.456.789 MWST
- EU VAT format: Country code + 8-12 digits
- QR reference: 26-27 digits

---

### Story 3.3: Letter-Specific Detection Rules

As a **user processing formal letters**,
I want **letter-optimized PII detection**,
So that **sender, recipient, and correspondent details are accurately identified**.

**Acceptance Criteria:**

**Given** document classified as LETTER
**When** PII detection runs
**Then** letter structure is analyzed:
  - SENDER: Header/letterhead area (first 20% of document)
  - RECIPIENT: Address block (typically right-aligned or after "To:")
  - SALUTATION: "Dear", "Sehr geehrte/r", "Madame, Monsieur"
  - SIGNATURE: Name after "Mit freundlichen Grüssen" or similar
  - DATE: Letter date (typically near top)

**And** sidebar detection prevents false table detection (from brainstorming)
**And** position-aware confidence boosting is applied

**Prerequisites:** Story 3.1 (Document Classifier)

**Technical Notes:**
- Create `src/pii/rules/LetterRules.ts`
- Integrate with existing letter layout detection in pdfTableDetector.ts
- Handle multilingual salutations and closings

---

### Story 3.4: Rule Engine Configuration

As a **system administrator**,
I want **to configure which detection rules apply to each document type**,
So that **detection behavior can be customized per organization**.

**Acceptance Criteria:**

**Given** a document type
**When** PII detection initializes
**Then** rule configuration is loaded from:
```json
{
  "INVOICE": {
    "rules": ["vendor", "amount", "vatNumber", "paymentRef"],
    "confidence_boost": { "header": 0.2, "table": 0.1 }
  },
  "LETTER": {
    "rules": ["sender", "recipient", "signature"],
    "confidence_boost": { "salutation": 0.3 }
  }
}
```

**And** default configuration is provided out-of-box
**And** custom configuration file overrides defaults
**And** invalid configuration is logged and falls back to defaults

**Prerequisites:** Stories 3.2, 3.3 (Type-specific rules)

**Technical Notes:**
- Create `src/config/detectionRules.json` for defaults
- Support user config in app data directory
- Validate configuration schema on load

---

## Epic 4: User Review Workflow

**Goal:** Implement user review interface for uncertain entities, enabling partial anonymization and manual PII marking.

**User Value:** Users can review flagged entities before processing, manually mark missed PII, and choose which entities to anonymize, giving full control over the anonymization process.

**FRs Covered:** FR-3.5, FR-5.7, FR-5.8

---

### Story 4.1: Entity Sidebar Panel

As a **user reviewing detected PII**,
I want **a sidebar showing all detected entities with their types**,
So that **I can quickly see what was found and filter by type**.

**Acceptance Criteria:**

**Given** a document with detected PII
**When** the preview panel loads
**Then** a collapsible sidebar appears on the right side

**And** entities are grouped by type (PERSON, ORG, ADDRESS, etc.)
**And** each entity shows: text, confidence score, position link
**And** clicking an entity scrolls preview to that location
**And** entity count badge shows per-type totals

**Prerequisites:** None (UI enhancement)

**Technical Notes:**
- Add sidebar component to `renderer.js`
- Use existing entity data from preview generation
- Implement scroll-to-entity in preview panel
- Use Tailwind for responsive layout (collapsible on mobile)

---

### Story 4.2: Entity Type Filtering

As a **user reviewing detected PII**,
I want **to filter entities by type and confidence level**,
So that **I can focus on specific entity types or uncertain detections**.

**Acceptance Criteria:**

**Given** the entity sidebar
**When** filter controls are used
**Then** type checkboxes toggle visibility of entity types

**And** confidence slider filters entities below threshold
**And** "Show flagged only" toggle shows entities needing review
**And** filter state persists during session
**And** preview highlighting updates to match filters

**Prerequisites:** Story 4.1 (Entity Sidebar)

**Technical Notes:**
- Add filter state to renderer
- Sync filtering with preview highlighting
- Save filter preferences to localStorage

---

### Story 4.3: Selective Anonymization

As a **user processing documents**,
I want **to choose which entities to anonymize**,
So that **I can preserve non-sensitive entities while protecting PII**.

**Acceptance Criteria:**

**Given** detected entities in sidebar
**When** user toggles entity checkbox
**Then** entity is marked for inclusion/exclusion from anonymization

**And** "Select All" / "Deselect All" per type is available
**And** excluded entities appear in output without anonymization
**And** mapping file only contains selected (anonymized) entities
**And** bulk selection via Shift+Click is supported

**Prerequisites:** Story 4.2 (Entity Filtering)

**Technical Notes:**
- Add selection state to entity data model
- Modify anonymization logic to respect selection
- Update mapping file generation
- Add keyboard shortcuts for power users

---

### Story 4.4: Manual PII Marking

As a **user who found missed PII**,
I want **to manually mark text as PII**,
So that **the system learns and the text is anonymized**.

**Acceptance Criteria:**

**Given** document preview
**When** user selects text and right-clicks
**Then** context menu shows "Mark as PII" with type submenu

**And** selecting a type creates new entity with:
  - source: 'MANUAL'
  - confidence: 1.0
  - user-specified type

**And** manually marked entity appears in sidebar
**And** entity is included in anonymization
**And** optional: feedback is logged for accuracy improvement

**Prerequisites:** Story 4.3 (Selective Anonymization)

**Technical Notes:**
- Add text selection handler to preview
- Create context menu component
- Integrate manual entities with detection results
- Consider storing feedback for future model fine-tuning

---

## Epic 5: Confidence Scoring & Feedback

**Goal:** Implement transparent confidence scoring and user feedback mechanism to continuously improve detection accuracy.

**User Value:** Users understand why entities were detected (transparency), can correct mistakes (feedback), and benefit from improving accuracy over time (learning system).

**FRs Covered:** Accuracy quality improvement

---

### Story 5.1: Confidence Score Display

As a **user reviewing detected entities**,
I want **to see why each entity was detected and its confidence level**,
So that **I can make informed decisions about uncertain detections**.

**Acceptance Criteria:**

**Given** an entity in the sidebar
**When** user hovers or clicks for details
**Then** tooltip/panel shows:
  - Confidence score (0-100%)
  - Detection source (ML/RULE/BOTH/MANUAL)
  - Matched pattern (if rule-based)
  - Context factors (if scored by context)

**And** low-confidence entities (<60%) show warning indicator
**And** flagged-for-review entities are visually distinct

**Prerequisites:** Epic 1 (Multi-pass pipeline with confidence)

**Technical Notes:**
- Extend entity data model with detection metadata
- Create entity detail popover component
- Style confidence indicators (green/yellow/red)

---

### Story 5.2: User Correction Logging

As a **system improving accuracy**,
I want **to log user corrections (dismissals and manual additions)**,
So that **patterns can be analyzed for future improvements**.

**Acceptance Criteria:**

**Given** user dismisses a false positive OR marks new PII
**When** correction is made
**Then** correction is logged with:
  - Original entity (or marked text)
  - Action (DISMISS / ADD)
  - User-assigned type (if ADD)
  - Document context (surrounding text)
  - Timestamp

**And** logs are stored locally in app data directory
**And** logs are anonymized (no actual PII stored, only patterns)
**And** user can opt-out of logging in settings

**Prerequisites:** Stories 4.3, 4.4 (User corrections)

**Technical Notes:**
- Create `src/services/feedbackLogger.ts`
- Store in JSON format: `corrections-YYYY-MM.json`
- Anonymize stored data (replace PII with type markers)
- Add privacy controls in settings

---

### Story 5.3: Accuracy Dashboard

As a **power user monitoring detection quality**,
I want **to see accuracy statistics over time**,
So that **I can assess whether the system is improving**.

**Acceptance Criteria:**

**Given** accumulated correction logs
**When** user opens accuracy dashboard (Settings > Accuracy)
**Then** dashboard shows:
  - Total documents processed
  - False positive rate (dismissals / total detections)
  - False negative estimate (manual additions / total detections)
  - Per-type accuracy breakdown
  - Trend chart (weekly/monthly)

**And** dashboard data is derived from local logs only
**And** "Export Report" generates CSV summary

**Prerequisites:** Story 5.2 (Correction Logging)

**Technical Notes:**
- Create dashboard component in settings
- Calculate statistics from correction logs
- Use simple chart library (Chart.js or similar)
- Export to CSV for external analysis

---

## FR Coverage Matrix

| FR ID | Description | Epic | Stories | Status |
|-------|-------------|------|---------|--------|
| FR-2.10 | Multi-pass detection | Epic 1 | 1.1, 1.2, 1.3, 1.4, 1.5 | Planned |
| FR-2.7 | Address detection (enhanced) | Epic 2 | 2.1, 2.2, 2.3, 2.4 | Planned |
| FR-2.11 | Document-type detection | Epic 3 | 3.1, 3.2, 3.3, 3.4 | Planned |
| FR-3.5 | Partial anonymization | Epic 4 | 4.3 | Planned |
| FR-5.7 | Entity sidebar | Epic 4 | 4.1, 4.2 | Planned |
| FR-5.8 | Manual PII marking | Epic 4 | 4.4 | Planned |

**Coverage Validation:** All planned FRs from PRD are covered by at least one story.

---

## Summary

### Epic Dependencies

```
Epic 1 (Multi-Pass) ────────┬──> Epic 2 (Address Modeling)
                            │
                            └──> Epic 3 (Doc-Type Detection)
                                        │
                                        v
                                 Epic 4 (User Review) ──> Epic 5 (Feedback)
```

### Recommended Sequence

1. **Epic 1: Multi-Pass Architecture** - Foundation for accuracy improvements
2. **Epic 2: Address Relationship Modeling** - Addresses root cause from brainstorming
3. **Epic 3: Document-Type Detection** - Contextual accuracy improvement
4. **Epic 4: User Review Workflow** - User control and corrections
5. **Epic 5: Confidence & Feedback** - Transparency and continuous improvement

### Context Status

- PRD requirements: Complete (docs/prd.md)
- Architecture document: Complete (docs/architecture.md)
- Test Design document: Complete (docs/test-design-system.md)
- Implementation Readiness: READY WITH CONDITIONS (docs/implementation-readiness-report-2025-12-05.md)
- Sprint Status: Active (docs/sprint-artifacts/sprint-status.yaml)
- No UX Design document (UI stories based on PRD descriptions - acceptable for enhancement project)

**Status:** Ready for implementation. Architecture provides complete technical guidance.

---

## Epic 6: Infrastructure & Developer Experience

**Goal:** Improve codebase maintainability, observability, and developer experience through centralized logging, consistent patterns, and tooling improvements.

**User Value:** Developers get consistent logging across the application, making debugging easier and reducing time to diagnose issues. Users benefit from better error messages and more reliable operation.

**FRs Covered:** Non-functional (DX improvement)

---

### Story 6.1: Factory Central Logger

> **⚠️ MOVED TO EPIC 10** - This story has been absorbed into Epic 10: Console-to-Logger Migration as Stories 10.1-10.10, which provide comprehensive coverage including browser-app adaptation, Web Worker support, ESLint enforcement, aggressive test migration, and CI/CD integration.

**Status:** Moved to Epic 10

**Original Scope:** Centralized logging factory with consistent configuration.

**New Location:** See Epic 10, Stories 10.1-10.10 for expanded implementation.

---

### Story 6.2: ReDoS Vulnerability Fix

As a **security engineer**,
I want **the fuzzy regex matching to be protected against ReDoS attacks**,
So that **malicious input cannot cause CPU exhaustion or application hangs**.

**Acceptance Criteria:**

**Given** a document with potentially malicious input patterns
**When** the fuzzy regex matching runs
**Then** regex execution completes within a timeout limit (100ms per pattern)

**And** input strings are length-limited before regex processing
**And** nested quantifiers are replaced with atomic alternatives
**And** catastrophic backtracking is prevented through pattern redesign
**And** timeout violations are logged and processing continues with fallback

**Prerequisites:** None (security fix)

**Technical Notes:**
- Location: `fileProcessor.js:114-134` (buildFuzzyRegex function)
- Current issue: Pattern `${char}[^a-zA-Z0-9]{0,3}` creates exponential backtracking
- Fix options:
  1. Add timeout wrapper using `vm.runInNewContext` with timeout
  2. Rewrite pattern using possessive quantifiers or atomic groups
  3. Use linear-time fuzzy matching library (e.g., fuse.js)
  4. Add input length validation (max 10,000 chars per segment)
- Add ReDoS test cases to security test suite
- Reference: CODE_REVIEW.md Critical Issue #2

---

### Story 6.3: IPC Input Validation Layer

As a **security engineer**,
I want **all IPC handlers to validate their inputs**,
So that **malicious payloads from the renderer cannot cause security issues**.

**Acceptance Criteria:**

**Given** any IPC handler in main.js
**When** it receives a message from the renderer
**Then** input is validated for:
  - Type checking (string, object, etc.)
  - Required field presence
  - Path safety (no traversal patterns)
  - Size limits (prevent OOM attacks)

**And** invalid inputs return structured error responses
**And** validation failures are logged with sanitized details
**And** file size limits are enforced (default: 100MB)
**And** sender origin is verified against main window

**Prerequisites:** None (security fix)

**Technical Notes:**
- Location: `main.js:103` and all `ipcMain.handle` calls
- Create `src/utils/ipcValidator.ts` with reusable validation helpers
- Add Zod or similar schema validation library
- Implement sender verification: `BrowserWindow.fromWebContents(event.sender)`
- Reference: CODE_REVIEW.md High Priority Issue #10

---

### Story 6.4: TypeScript Strict Mode Migration

As a **developer maintaining the codebase**,
I want **all TypeScript files to use strict type checking without `any`**,
So that **type errors are caught at compile time instead of runtime**.

**Acceptance Criteria:**

**Given** the TypeScript codebase
**When** `npm run typecheck` is run
**Then** no `any` types are used except with explicit justification comments

**And** all error catches use `unknown` type with proper narrowing
**And** type assertions use type guards instead of `as` casts
**And** strict null checks are enabled and enforced
**And** all implicit `any` warnings are resolved

**Prerequisites:** None (code quality)

**Technical Notes:**
- Current issues in: `src/services/filePreviewHandlers.ts:45,86`
- Replace `catch (error: any)` with `catch (error: unknown)`
- Add type guard helpers: `isError(e): e is Error`
- Update tsconfig.json: `noImplicitAny: true`, `strictNullChecks: true`
- Create `src/types/errors.ts` with discriminated union error types
- Reference: CODE_REVIEW.md Critical Issue #4

---

### Story 6.5: Async Operation Timeouts

As a **user processing files**,
I want **long-running operations to have timeouts and cancellation**,
So that **the app doesn't appear frozen during large file processing**.

**Acceptance Criteria:**

**Given** a file processing operation
**When** it takes longer than the timeout threshold (60 seconds default)
**Then** user is notified and given options: Wait / Cancel

**And** processing can be cancelled at any point
**And** partial results are preserved if possible
**And** progress is reported to the UI during processing
**And** timeout thresholds are configurable in settings

**Prerequisites:** None (UX improvement)

**Technical Notes:**
- Location: `renderer.js:319-374` (processFile function)
- Implement AbortController pattern for cancellation
- Add progress events via IPC: `processing:progress`
- Create timeout wrapper utility with cancel support
- Add cancel button to UI during processing state
- Reference: CODE_REVIEW.md Critical Issue #5

---

### Story 6.6: Global State Refactoring

As a **developer maintaining the codebase**,
I want **file processing state to be scoped per-session instead of global**,
So that **batch processing doesn't cause data corruption between files**.

**Acceptance Criteria:**

**Given** multiple files being processed
**When** each file is processed
**Then** pseudonym counters are scoped to that file session only

**And** pseudonym mappings don't leak between files
**And** parallel processing is possible without state collision
**And** each file gets independent PER_1, PER_2 numbering
**And** mapping file contains only that file's entities

**Prerequisites:** None (critical bug fix)

**Technical Notes:**
- Location: `fileProcessor.js:35-37` (global pseudonymCounters/pseudonymMapping)
- Create `FileProcessorSession` class encapsulating state
- Each `processFile()` call creates new session instance
- Session holds: counters, mappings, current file path
- Ensure garbage collection when session completes
- Reference: CODE_REVIEW.md Critical Issue #1

---

### Story 6.7: Error Handling Standardization

As a **developer debugging issues**,
I want **consistent error handling across the codebase**,
So that **errors are properly sanitized, logged, and reported**.

**Acceptance Criteria:**

**Given** an error occurring anywhere in the application
**When** it is caught and handled
**Then** sensitive paths are redacted from error messages

**And** errors are logged with consistent format and context
**And** user-facing error messages are localized
**And** stack traces are available in development but hidden in production
**And** error codes are defined and documented

**Prerequisites:** Story 6.1 (Central Logger)

**Technical Notes:**
- Current inconsistency: `main.js:137` sanitizes, `fileProcessor.js:396` doesn't
- Create `src/utils/errorHandler.ts` with:
  - `sanitizeError(error)` - redact paths
  - `logError(error, context)` - structured logging
  - `toUserMessage(error)` - i18n-friendly message
- Define error code enum in `src/types/errors.ts`
- Reference: CODE_REVIEW.md High Priority Issue #17

---

### Story 6.8: Constants and Magic Numbers

As a **developer maintaining the codebase**,
I want **all magic numbers replaced with named constants**,
So that **values are documented and easy to change**.

**Acceptance Criteria:**

**Given** the codebase
**When** any numeric or string literal is used
**Then** it is either:
  - A named constant with JSDoc comment explaining its purpose
  - Or trivially obvious (0, 1, empty string)

**And** constants are grouped in `src/config/constants.ts`
**And** UI-related constants (preview lines, char limits) are in config
**And** regex quantifiers have documented reasoning

**Prerequisites:** None (code quality)

**Technical Notes:**
- Examples from code review:
  - `renderer.js:227`: `lines: 20, chars: 1000` → `PREVIEW_LINE_LIMIT`, `PREVIEW_CHAR_LIMIT`
  - `fileProcessor.js:123`: `{0,3}` → `FUZZY_MATCH_GAP_TOLERANCE`
- Create `src/config/constants.ts` with categories:
  - PREVIEW, PROCESSING, SECURITY, UI
- Reference: CODE_REVIEW.md Medium Priority Issue #19

---

## Epic 7: Browser Migration

**Goal:** Port the Electron desktop application to a fully browser-based web application, enabling zero-installation access while maintaining 100% local/client-side processing for privacy.

**User Value:** Users can access the PII anonymization tool directly from any modern browser without installation, while maintaining the same privacy guarantees (all processing happens client-side, no data leaves the browser).

**FRs Covered:** FR-6.1 through FR-6.6 (New)

**Reference:** specs/browser-migration/MIGRATION_PLAN.md

---

### Story 7.1: Document Converter Testing & Fixes

As a **user processing documents in the browser**,
I want **all document formats to convert correctly**,
So that **I can anonymize PDFs, DOCX, Excel, CSV, and text files without installation**.

**Acceptance Criteria:**

**Given** a file uploaded via drag-and-drop or file picker
**When** the browser app processes the file
**Then** PDF files convert to Markdown using pdf.js (existing code in browser-app/src/converters/PdfConverter.ts)

**And** DOCX files convert using mammoth browser build
**And** Excel files convert using exceljs browser mode
**And** CSV and text files convert directly (no dependencies)
**And** conversion output matches Electron app quality
**And** error handling provides user-friendly messages

**Prerequisites:** Existing browser-app scaffold (already created)

**Technical Notes:**
- Converters already exist in `browser-app/src/converters/`
- Need integration testing with test fixtures
- Verify table detection works in browser (pdf.js provides position data)
- Port existing test/fixtures for validation
- Compare output with Electron version for parity

---

### Story 7.2: ML Model Browser Integration

As a **user loading the browser app**,
I want **the PII detection ML model to load and cache efficiently**,
So that **subsequent visits don't require re-downloading the model**.

**Acceptance Criteria:**

**Given** the browser app on first load
**When** the app initializes
**Then** the ML model downloads from HuggingFace CDN (~129MB) with progress indicator

**And** model is cached in IndexedDB for offline use
**And** subsequent page loads use cached model (instant startup)
**And** user can see download progress percentage
**And** model loading can be cancelled
**And** fallback to regex-only detection if model fails to load

**Prerequisites:** Story 7.1 (converters working)

**Technical Notes:**
- Use `@xenova/transformers` browser build (already in package.json)
- Configure: `env.useBrowserCache = true`
- Implement progress callback for UI
- Create `ModelCache.ts` in browser-app/src/storage/
- Test with slow network simulation

---

### Story 7.3: PII Detection Pipeline Browser Port

As a **developer maintaining the browser app**,
I want **the multi-pass PII detection pipeline ported to browser**,
So that **browser users get the same 94%+ accuracy as desktop users**.

**Acceptance Criteria:**

**Given** converted document text
**When** PII detection runs
**Then** Pass 1 (high-recall detection) executes with regex + ML

**And** Pass 2 (format validation) validates entity formats
**And** Pass 3 (context scoring) assigns confidence scores
**And** SwissEuDetector patterns work identically to Electron version
**And** Detection accuracy matches Electron version (within 1%)
**And** Processing uses Web Worker for non-blocking UI

**Prerequisites:** Story 7.2 (model loading)

**Technical Notes:**
- Port `src/pii/` directory to browser-app
- Existing `browser-app/src/processing/PIIDetector.ts` is minimal - needs full pipeline
- Create `pii.worker.ts` for background processing
- Import patterns from main codebase SwissEuDetector
- Run accuracy tests from test/accuracy/

---

### Story 7.4: Entity Review UI Implementation

As a **user reviewing detected PII in the browser**,
I want **the same entity review interface as the desktop app**,
So that **I can filter, select, and manually mark entities before anonymization**.

**Acceptance Criteria:**

**Given** detected PII entities
**When** the preview panel loads
**Then** entity sidebar displays all entities grouped by type

**And** confidence scores and detection source are visible
**And** entity type filtering works (checkboxes per type)
**And** selective anonymization (checkbox per entity) works
**And** manual PII marking via text selection works
**And** clicking entity scrolls preview to that location
**And** UI matches desktop app styling (Tailwind)

**Prerequisites:** Story 7.3 (detection pipeline)

**Technical Notes:**
- Port UI logic from `renderer.js` and `src/ui/EntityReviewUI.ts`
- Adapt IPC calls to direct function calls
- Reuse existing Tailwind styles from `src/input.css`
- Create React-style components or vanilla JS (maintain consistency with existing code)

---

### Story 7.5: File Download & Batch Processing

As a **user anonymizing files in the browser**,
I want **to download results and process multiple files**,
So that **I can efficiently anonymize batches of documents**.

**Acceptance Criteria:**

**Given** anonymization is complete
**When** user clicks download
**Then** anonymized Markdown file downloads via browser

**And** mapping file (JSON) downloads alongside
**And** batch processing supports multiple files
**And** ZIP download option for multiple files (using JSZip)
**And** progress indicator shows per-file status
**And** partial results downloadable if one file fails

**Prerequisites:** Story 7.4 (entity review)

**Technical Notes:**
- Use Blob + URL.createObjectURL for downloads
- JSZip already in package.json
- Port batch queue logic from `src/services/batchQueueManager.ts`
- Implement `download.ts` utility functions

---

### Story 7.6: PWA & Deployment Readiness

As a **user wanting offline access**,
I want **the browser app to work as a Progressive Web App**,
So that **I can use it offline after initial model download**.

**Acceptance Criteria:**

**Given** the browser app is deployed
**When** user installs as PWA
**Then** app icon appears on home screen/desktop

**And** app works offline (after model cached)
**And** service worker caches static assets
**And** manifest.json enables install prompt
**And** app passes Lighthouse PWA audit (score > 90)
**And** deployment works on GitHub Pages / Vercel / Netlify

**Prerequisites:** Stories 7.1-7.5 (full feature parity)

**Technical Notes:**
- Create `public/manifest.json` with app metadata
- Create `sw.js` service worker for offline support
- Configure Vite for PWA build
- Test on multiple browsers (Chrome, Firefox, Safari, Edge)
- Create deployment documentation

---

### Story 7.7: Manual PII Marking UI Polish

As a **user who found missed PII in the browser app**,
I want **to manually mark text as PII using an intuitive right-click context menu**,
So that **the system includes my corrections in the anonymization and I can confidently protect all sensitive data**.

**Acceptance Criteria:**

**Given** a document is loaded with detected PII in the browser preview
**When** user selects text and wants to mark it as PII
**Then** right-click on selected text shows context menu with "Mark as PII" option

**And** clicking entity type adds selection as manual entity
**And** manual entities appear in sidebar with "Manual" badge and 100% confidence
**And** keyboard shortcut (Cmd/Ctrl+M) opens entity type selector
**And** toast notification confirms entity addition
**And** manual entity can be removed by deselecting in sidebar

**Prerequisites:** Story 7.4 (entity review UI)

**Technical Notes:**
- Fix context menu trigger: change from `mouseup` to `contextmenu` (right-click)
- Add keyboard shortcut support for power users
- Create Toast component for notifications
- Ensure manual entities integrate with anonymization pipeline
- Test across Chrome, Firefox, Safari, Edge

---

### Story 7.8: User Correction Feedback Logging

As a **product owner analyzing detection accuracy**,
I want **user corrections (dismissed entities and manual additions) to be logged locally**,
So that **I can analyze patterns in false positives/negatives and improve detection accuracy over time**.

**Acceptance Criteria:**

**Given** a user is reviewing detected entities in the browser app
**When** user dismisses a detected entity or adds a manual entity
**Then** correction is logged to IndexedDB with anonymized context

**And** log entry includes: action type, entity type, anonymized context, document hash, timestamp
**And** for dismissals: original detection source and confidence score are recorded
**And** user can enable/disable feedback logging via settings
**And** simple statistics are exposed (total corrections, by type, by action)
**And** logs rotate monthly with configurable retention
**And** no PII is ever stored in logs

**Prerequisites:** Story 7.4 (entity review UI)

**Technical Notes:**
- Use IndexedDB for browser storage (replaces Node.js file system)
- Port anonymization patterns from `src/services/feedbackLogger.ts`
- Use Web Crypto API for document hash (SHA-256)
- Store settings in localStorage
- Default to enabled (opt-out model)
- Test with fake-indexeddb in vitest

---

## FR Coverage Matrix

| FR ID | Description | Epic | Stories | Status |
|-------|-------------|------|---------|--------|
| FR-2.10 | Multi-pass detection | Epic 1 | 1.1, 1.2, 1.3, 1.4, 1.5 | Done |
| FR-2.7 | Address detection (enhanced) | Epic 2 | 2.1, 2.2, 2.3, 2.4 | Done |
| FR-2.11 | Document-type detection | Epic 3 | 3.1, 3.2, 3.3, 3.4 | Done |
| FR-3.5 | Partial anonymization | Epic 4 | 4.3 | Done |
| FR-5.7 | Entity sidebar | Epic 4 | 4.1, 4.2 | Done |
| FR-5.8 | Manual PII marking | Epic 4 | 4.4 | Done |
| DX-1 | Centralized logging | Epic 6 | 6.1 | Planned |
| SEC-1 | ReDoS protection | Epic 6 | 6.2 | Planned |
| SEC-2 | IPC input validation | Epic 6 | 6.3 | Planned |
| DX-2 | TypeScript strict mode | Epic 6 | 6.4 | Planned |
| UX-1 | Async timeouts | Epic 6 | 6.5 | Planned |
| BUG-1 | Global state fix | Epic 6 | 6.6 | Planned |
| DX-3 | Error standardization | Epic 6 | 6.7 | Planned |
| DX-4 | Magic numbers | Epic 6 | 6.8 | Planned |
| FR-6.1 | Browser document conversion | Epic 7 | 7.1 | Planned |
| FR-6.2 | Client-side ML loading | Epic 7 | 7.2 | Planned |
| FR-6.3 | Browser PII pipeline | Epic 7 | 7.3 | Planned |
| FR-6.4 | Entity review UI (browser) | Epic 7 | 7.4 | Planned |
| FR-6.5 | Browser file I/O | Epic 7 | 7.5 | Planned |
| FR-6.6 | PWA support | Epic 7 | 7.6 | Planned |
| FR-5.8 | Manual PII marking (browser) | Epic 7 | 7.7 | Planned |
| FR-5.9 | User correction logging (browser) | Epic 7 | 7.8 | Planned |

**Coverage Validation:** All planned FRs from PRD are covered by at least one story.

---

## Summary

### Epic Dependencies

```
Epic 1 (Multi-Pass) ────────┬──> Epic 2 (Address Modeling)
                            │
                            └──> Epic 3 (Doc-Type Detection)
                                        │
                                        v
                                 Epic 4 (User Review) ──> Epic 5 (Feedback)

Epic 6 (Infrastructure) ──> Independent (can run in parallel)

Epic 7 (Browser Migration) ──> Independent (can run in parallel with Epic 6)
```

### Recommended Sequence

1. **Epic 1: Multi-Pass Architecture** - Foundation for accuracy improvements ✅
2. **Epic 2: Address Relationship Modeling** - Addresses root cause from brainstorming ✅
3. **Epic 3: Document-Type Detection** - Contextual accuracy improvement ✅
4. **Epic 4: User Review Workflow** - User control and corrections ✅
5. **Epic 5: Confidence & Feedback** - Transparency and continuous improvement ✅
6. **Epic 6: Infrastructure** - Developer experience improvements ✅
7. **Epic 7: Browser Migration** - Zero-install browser version (current)

### Context Status

- PRD requirements: Complete (docs/prd.md)
- Architecture document: Complete (docs/architecture.md)
- Test Design document: Complete (docs/test-design-system.md)
- Implementation Readiness: READY WITH CONDITIONS (docs/implementation-readiness-report-2025-12-05.md)
- Sprint Status: Active (docs/sprint-artifacts/sprint-status.yaml)
- No UX Design document (UI stories based on PRD descriptions - acceptable for enhancement project)

**Status:** Ready for implementation. Architecture provides complete technical guidance.

---

_For implementation: Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown._

_This document will be updated after Architecture workflow to incorporate technical decisions._

---

## Epic 9: UI Harmonization (Tailwind + shadcn)

**Goal:** Unify the UI component architecture across Electron and browser apps using Tailwind CSS and shadcn/ui, creating a shared design system that reduces code duplication, improves consistency, and accelerates future UI development.

**User Value:** Consistent, polished user experience across both platforms with modern, accessible components. Developers benefit from a shared component library that reduces maintenance burden.

**FRs Covered:** DX-5 (Developer Experience), UX-2 (UI Consistency)

**Current State Analysis:**
- Browser-app: 20+ TypeScript components, custom CSS layer (~2500 lines), modular but app-specific
- Electron-app: 2 UI managers, pure Tailwind utilities, minimal component abstraction
- No shared component library
- Different color systems (HSL-based vs Tailwind defaults)
- Significant code duplication for buttons, badges, cards, modals

---

### Story 9.1: Shared Tailwind Configuration & Design Tokens

As a **developer working on either app**,
I want **a unified Tailwind configuration with shared design tokens**,
So that **both apps use consistent colors, spacing, typography, and shadows**.

**Acceptance Criteria:**

**Given** both Electron and browser apps
**When** I import the shared Tailwind config
**Then**:
1. Both apps use identical color palette (primary, secondary, success, warning, error, neutral)
2. CSS variables are defined for theme tokens (--primary, --background, --foreground, etc.)
3. Dark mode support is configured (class-based toggle)
4. Custom spacing scale matches across apps
5. Typography scale is consistent (font sizes, line heights, font weights)
6. Border radius, shadows, and transitions are standardized

**Prerequisites:** None (foundation story)

**Technical Notes:**
- Create `shared/tailwind-preset.js` as shared preset
- Define CSS variables in `:root` and `.dark` for theming
- Use shadcn/ui color convention (HSL-based with CSS variables)
- Both apps extend this preset in their `tailwind.config.js`
- Consider using `tailwindcss-animate` for transitions

---

### Story 9.2: Core UI Component Library Setup

As a **developer building UI features**,
I want **a shared component library based on shadcn/ui patterns**,
So that **I can use pre-built, accessible, typed components in both apps**.

**Acceptance Criteria:**

**Given** the need for reusable UI components
**When** I set up the component library
**Then**:
1. Component library created at `shared/ui-components/` (or `libs/ui/`)
2. Build system configured (TypeScript, exports for ESM/CJS)
3. Components use class-variance-authority (CVA) for variant handling
4. Components use clsx + tailwind-merge for class composition
5. All components are fully typed with TypeScript
6. Components export both the component and its props type
7. Storybook or similar documentation system set up

**Prerequisites:** Story 9.1 (Shared Tailwind Config)

**Technical Notes:**
- Use shadcn/ui component patterns (not the CLI, just the patterns)
- Install: `class-variance-authority`, `clsx`, `tailwind-merge`
- Create `cn()` utility for class merging
- Components should be framework-agnostic (vanilla TS, not React)
- Consider using `@radix-ui/colors` for accessible color scales

---

### Story 9.3: Primitive Components (Button, Badge, Card, Input)

As a **developer building UI features**,
I want **a set of primitive UI components**,
So that **I can compose higher-level interfaces with consistent styling**.

**Acceptance Criteria:**

**Given** the component library foundation
**When** I implement primitive components
**Then**:
1. **Button** component with variants: primary, secondary, ghost, destructive, outline, link
   - Sizes: sm, md, lg
   - States: default, hover, active, disabled, loading
   - Icon support (left/right)
2. **Badge** component with variants: default, success, warning, error, info, outline
   - Entity type badges: PERSON, ORG, ADDRESS, EMAIL, PHONE, DATE, etc.
3. **Card** component with: header, content, footer slots
   - Variants: default, outlined, elevated
4. **Input** component with: label, error, helper text, icons
   - Types: text, email, password, number, search
5. **Checkbox** and **Toggle** components with label support
6. All components have unit tests and documentation
7. Components work in both Electron and browser environments

**Prerequisites:** Story 9.2 (Component Library Setup)

**Technical Notes:**
- Port existing button styles from `browser-app/src/styles/components.css`
- Badge colors should match entity type colors currently in EntitySidebar.ts
- Use native HTML elements with progressive enhancement
- Ensure keyboard accessibility (focus states, tab order)

---

### Story 9.4: Composite Components (Modal, Toast, Dropdown, Tooltip)

As a **developer building interactive features**,
I want **composite UI components for overlays and feedback**,
So that **I can create consistent modal dialogs, notifications, and menus**.

**Acceptance Criteria:**

**Given** primitive components are available
**When** I implement composite components
**Then**:
1. **Modal/Dialog** component with:
   - Header, content, footer sections
   - Close button and ESC key handling
   - Focus trap for accessibility
   - Backdrop click to close (optional)
   - Sizes: sm, md, lg, full
2. **Toast** component with:
   - Variants: success, error, warning, info
   - Auto-dismiss with configurable duration
   - Action button support
   - Stacking for multiple toasts
   - Position: top-right, top-center, bottom-right, bottom-center
3. **Dropdown/Menu** component with:
   - Trigger element support
   - Keyboard navigation (arrow keys, enter, escape)
   - Grouped items with separators
   - Icons and shortcuts display
4. **Tooltip** component with:
   - Positions: top, right, bottom, left
   - Delay configuration
   - Arrow pointer
5. All components integrate with existing Toast.ts and ContextMenu.ts patterns
6. Unit tests and documentation complete

**Prerequisites:** Story 9.3 (Primitive Components)

**Technical Notes:**
- Refactor `browser-app/src/components/Toast.ts` to use shared component
- Refactor `browser-app/src/components/ContextMenu.ts` to use Dropdown
- Use `@floating-ui/dom` for positioning (lightweight, no framework dependency)
- Implement focus management for accessibility

---

### Story 9.5: Entity UI Components (EntityBadge, EntityList, EntitySidebar)

As a **developer building PII review features**,
I want **specialized entity UI components**,
So that **entity display is consistent across both apps**.

**Acceptance Criteria:**

**Given** primitive and composite components exist
**When** I implement entity-specific components
**Then**:
1. **EntityBadge** component with:
   - Entity type icon/color by type (PERSON, ORG, ADDRESS, etc.)
   - Confidence indicator (high/medium/low)
   - Source indicator (ML/RULE/BOTH/MANUAL)
   - Compact and expanded variants
2. **EntityListItem** component with:
   - Checkbox for selection
   - Entity text with truncation
   - Metadata row (confidence, position)
   - Click handler for navigation
   - Selected/highlighted states
3. **EntityGroup** component with:
   - Collapsible header with type badge and count
   - Filter checkbox
   - Bulk selection controls
4. **EntitySidebar** component with:
   - Filter panel at top
   - Scrollable entity groups
   - Empty state display
   - Responsive collapse for mobile
5. Browser-app EntitySidebar.ts refactored to use shared components
6. Electron EntityReviewUI.ts refactored to use shared components
7. Visual parity achieved between both apps

**Prerequisites:** Story 9.4 (Composite Components)

**Technical Notes:**
- Extract entity type config from `browser-app/src/components/sidebar/EntityTypeConfig.ts`
- Centralize entity colors and icons in shared config
- Maintain backward compatibility during migration
- Use event delegation pattern established in browser-app

---

### Story 9.6: Migration & Integration Testing

As a **developer completing the UI harmonization**,
I want **both apps fully migrated to the shared component library**,
So that **there is no duplicate styling code and both apps look identical**.

**Acceptance Criteria:**

**Given** all shared components are implemented
**When** I complete the migration
**Then**:
1. Browser-app uses shared components for all UI elements
2. Electron-app uses shared components for all UI elements
3. Old component-specific CSS removed (components.css cleaned up)
4. No duplicate button, badge, card, modal styles exist
5. Visual regression tests pass for both apps
6. Lighthouse accessibility score maintained (100 for browser-app)
7. Bundle size impact documented (target: <50KB added)
8. Dark mode works correctly in both apps
9. All existing tests pass
10. New component tests added (target: 50+ tests)

**Prerequisites:** Story 9.5 (Entity Components)

**Technical Notes:**
- Create migration checklist per app
- Use feature flags if needed for gradual rollout
- Document breaking changes
- Update CLAUDE.md with new component patterns
- Add visual regression testing (e.g., Playwright screenshots)

---

### Epic 9 Dependencies

```
Story 9.1 (Tailwind Config)
       │
       v
Story 9.2 (Library Setup)
       │
       v
Story 9.3 (Primitives) ──> Story 9.4 (Composites)
                                    │
                                    v
                           Story 9.5 (Entity Components)
                                    │
                                    v
                           Story 9.6 (Migration)
```

### Technical Stack

| Technology | Purpose | Notes |
|------------|---------|-------|
| Tailwind CSS 3.x | Utility-first styling | Already in use |
| shadcn/ui patterns | Component architecture | Patterns only, not React |
| class-variance-authority | Variant handling | Type-safe variants |
| clsx + tailwind-merge | Class composition | Conflict resolution |
| @floating-ui/dom | Positioning | Tooltips, dropdowns |
| TypeScript | Type safety | Full typing for all components |

### Success Metrics

| Metric | Target |
|--------|--------|
| Code duplication reduction | >60% less CSS |
| Component reuse | 100% shared across apps |
| Bundle size impact | <50KB added |
| Accessibility score | Maintain 100 |
| Developer satisfaction | Faster feature development |
| Visual consistency | Identical look across apps |

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing UI | Feature flags, gradual migration |
| Bundle size increase | Tree-shaking, code splitting |
| Framework lock-in | Keep components vanilla TS |
| Migration effort | Incremental stories, clear boundaries |

---

## Epic 10: Console-to-Logger Migration

**Goal:** Complete migration from direct `console.*` calls to LoggerFactory across the entire codebase, with ESLint enforcement, browser-app support, Web Worker logging, and CI/CD integration to prevent regression.

**User Value:** Developers get consistent, filterable, PII-safe logging with proper levels across all application contexts (Electron main, renderer, browser-app, Web Workers). Production users benefit from cleaner logs, better debugging support, and no accidental PII exposure in log files.

**FRs Covered:** DX-6 (Logging Standardization), SEC-3 (PII-Safe Logging)

**Note:** This epic absorbs and expands Story 6.1 (Factory Central Logger) from Epic 6.

**Current State Analysis:**
- **LoggerFactory.ts exists** at `src/utils/LoggerFactory.ts` with scoped loggers, log levels, PII redaction
- **976 console.* calls** across 125 files (783 log, 94 warn, 91 error, 6 debug, 2 info)
- **Top offenders in src/:** rendererI18n.ts (11), logging.ts (10), i18nService.ts (8)
- **Deprecated files:** `src/utils/logger.ts`, `src/config/logging.ts` need removal
- **No ESLint rule** preventing new console.* usage
- **Browser-app** needs LoggerFactory adaptation (currently Electron-focused)
- **Web Workers** (ML inference) have no logging strategy

---

### Story 10.1: ESLint Console Restriction Rule

As a **developer writing new code**,
I want **ESLint to flag any direct console.* usage**,
So that **all new logging goes through LoggerFactory and we don't regress**.

**Acceptance Criteria:**

**Given** any TypeScript or JavaScript file in `src/`
**When** developer uses `console.log`, `console.warn`, `console.error`, `console.debug`, or `console.info`
**Then** ESLint reports an error with message: "Use LoggerFactory.create('scope') instead of console.*"

**And** rule is configured as "error" (not warning) to block commits
**And** test files (`test/**`) are initially excluded (migrated in Story 10.8)
**And** build scripts and config files are excluded
**And** auto-fix suggestion points to LoggerFactory import

**Prerequisites:** None (can be implemented immediately)

**Technical Notes:**
- Add `no-console` rule to `.eslintrc.js` with custom message
- Configure: `"no-console": ["error", { "allow": [] }]`
- Add override for test files initially: `files: ['test/**']` with `no-console: off`
- Run `npm run lint` to get full violation count before migration
- Consider `eslint-plugin-no-console-log` for better error messages

---

### Story 10.2: LoggerFactory Browser-App Adaptation

As a **developer working on the browser-app**,
I want **LoggerFactory to work correctly in pure browser context (no Electron)**,
So that **browser-app can use the same logging patterns as Electron app**.

**Acceptance Criteria:**

**Given** code running in browser-app (Vite/PWA, no Electron)
**When** `LoggerFactory.create('scope')` is called
**Then** logger instance is created successfully without errors

**And** log messages appear in browser DevTools console with proper formatting
**And** log levels are respected (debug filtered in production)
**And** PII redaction works in browser context
**And** no errors about missing `electron-log` module
**And** graceful detection: `isElectron()` vs `isBrowser()` context
**And** console-only output (no file persistence in browser - acceptable per requirements)

**Prerequisites:** None (foundation for browser logging)

**Technical Notes:**
- Current LoggerFactory has electron-log dependency - needs conditional import
- Add environment detection: `typeof window !== 'undefined' && !window.process`
- Create browser-specific formatter matching electron-log output style
- Test in: browser-app dev server, production build, Vitest (jsdom)
- Ensure no Node.js APIs leak into browser bundle (check Vite build)

---

### Story 10.3: Web Worker Logger Implementation

As a **developer debugging ML inference issues**,
I want **LoggerFactory to work inside Web Workers**,
So that **ML model loading and inference can be logged consistently**.

**Acceptance Criteria:**

**Given** code running in a Web Worker (e.g., `pii.worker.ts` for ML inference)
**When** `LoggerFactory.create('ml:worker')` is called
**Then** logger instance is created successfully

**And** log messages are posted to main thread via `postMessage`
**And** main thread LoggerFactory receives and formats worker logs
**And** worker logs appear in DevTools with `[Worker]` prefix
**And** log levels are synchronized between worker and main thread
**And** PII redaction works in worker context
**And** no performance impact on ML inference (async logging)

**Prerequisites:** Story 10.2 (browser LoggerFactory works)

**Technical Notes:**
- Web Workers have no `console` connection to DevTools in some browsers
- Implement `WorkerLoggerTransport` that uses `postMessage`
- Main thread listens for log messages and routes to LoggerFactory
- Consider batching worker logs to reduce message overhead
- Test with: `browser-app/src/workers/` (if exists) or create test worker
- Reference: Epic 7 Story 7.3 mentions Web Worker for ML inference

---

### Story 10.4: i18n Module Logger Migration

As a **developer debugging internationalization issues**,
I want **all i18n modules to use LoggerFactory with 'i18n' scope**,
So that **i18n logging can be filtered and controlled independently**.

**Acceptance Criteria:**

**Given** the i18n modules (4 files, 25 console calls)
**When** migration is complete
**Then** all console.* calls are replaced with LoggerFactory usage:

| File | Console Calls | Logger Scope |
|------|---------------|--------------|
| `src/i18n/rendererI18n.ts` | 11 | `i18n:renderer` |
| `src/i18n/i18nService.ts` | 8 | `i18n:service` |
| `src/i18n/localeFormatter.ts` | 4 | `i18n:formatter` |
| `src/i18n/languageDetector.ts` | 2 | `i18n:detector` |

**And** log levels are appropriate:
  - Initialization success → `log.info()`
  - Missing translation keys → `log.warn()`
  - Language detection results → `log.debug()`
  - Load/parse errors → `log.error()`

**And** renderer process logging works correctly
**And** existing functionality unchanged
**And** ESLint passes with no console violations

**Prerequisites:** Story 10.2 (browser/renderer LoggerFactory works)

**Technical Notes:**
- rendererI18n.ts runs in renderer process - uses browser LoggerFactory
- Batch initialization logs to reduce noise: single info log with summary
- Test: `LoggerFactory.setScopeLevel('i18n', 'debug')` enables verbose mode
- Verify i18n works correctly after migration (run i18n tests)

---

### Story 10.5: PII Detection Module Logger Migration

As a **developer debugging PII detection issues**,
I want **all PII detection modules to use LoggerFactory with 'pii' scope**,
So that **detection logging is filterable and PII is automatically redacted**.

**Acceptance Criteria:**

**Given** the PII detection modules
**When** migration is complete
**Then** all console.* calls are replaced with LoggerFactory usage:

| File | Logger Scope |
|------|--------------|
| `src/pii/DetectionPipeline.ts` | `pii:pipeline` |
| `src/pii/passes/HighRecallPass.ts` | `pii:pass:recall` |
| `src/pii/passes/DocumentTypePass.ts` | `pii:pass:doctype` |
| `src/pii/RuleEngine.ts` | `pii:rules` |
| Any other `src/pii/**/*.ts` files | `pii:<module>` |

**And** PII values in log messages are automatically redacted by LoggerFactory
**And** detection metrics logged at info level: `log.info('Detection complete', { entities: count, duration: ms })`
**And** pattern match details logged at debug level (disabled in production)
**And** validation failures logged at warn level

**Prerequisites:** Story 10.4 (migration pattern established)

**Technical Notes:**
- CRITICAL: Verify PII redaction works - test with real Swiss AHV, IBAN, emails
- Detection can be verbose - use debug level for per-entity logs
- Add timing: `const start = Date.now(); ... log.debug('Pass done', { ms: Date.now() - start })`
- Run accuracy tests after migration to ensure no regressions

---

### Story 10.6: Utility & UI Module Logger Migration

As a **developer maintaining utility code**,
I want **all utility and UI modules to use LoggerFactory with appropriate scopes**,
So that **utility logging is consistent and filterable**.

**Acceptance Criteria:**

**Given** the utility and UI modules with console usage
**When** migration is complete
**Then** all console.* calls are replaced:

| File | Logger Scope | Notes |
|------|--------------|-------|
| `src/utils/asyncTimeout.ts` | `utils:timeout` | 3 calls |
| `src/utils/errorHandler.ts` | `utils:error` | 2 calls |
| `src/utils/LoggerFactory.ts` | `logger:internal` | 4 calls (meta-logging) |
| `src/ui/EntityReviewUI.ts` | `ui:review` | 1 call |

**And** error handler uses `log.error()` with full stack traces
**And** timeout warnings include duration: `log.warn('Operation timed out', { timeout: ms })`
**And** UI interactions use debug level (minimal noise)
**And** LoggerFactory internal errors go to console as last resort (bootstrap problem)

**Prerequisites:** Story 10.5 (migration pattern established)

**Technical Notes:**
- errorHandler.ts: Ensure errors are properly serialized (Error objects don't stringify well)
- LoggerFactory.ts: Keep 1-2 console.error for bootstrap failures (can't log if logger broken)
- asyncTimeout.ts: Include operation name in timeout logs for debugging

---

### Story 10.7: Deprecated Logger Files Removal

As a **developer maintaining the codebase**,
I want **deprecated logging files removed**,
So that **there's only one way to log (LoggerFactory) and no confusion**.

**Acceptance Criteria:**

**Given** deprecated logging files exist
**When** removal is complete
**Then**:

1. `src/utils/logger.ts` is **deleted**
2. `src/config/logging.ts` is **deleted**
3. All imports of these files are updated to use LoggerFactory
4. No runtime errors occur
5. TypeScript compilation succeeds (`npm run typecheck`)
6. All tests pass (`npm test`)
7. ESLint passes (`npm run lint`)

**And** LoggerFactory.ts is the **single source of truth** for logging
**And** Any `createLogger()` calls migrated to `LoggerFactory.create()`
**And** CLAUDE.md updated to remove references to deprecated files

**Prerequisites:** Stories 10.4-10.6 (all src/ migrations complete)

**Technical Notes:**
- Both files are already marked `@deprecated` in JSDoc
- Search: `grep -r "from.*logger" src/` and `grep -r "from.*logging" src/`
- Check for re-exports in `src/index.ts` or similar barrel files
- Update any imports in test files as well
- Git: Single commit with clear message about deprecation removal

---

### Story 10.8: Aggressive Test File Logger Migration

As a **developer running tests**,
I want **test files to use a consistent logging strategy**,
So that **test output is clean in CI and verbose when debugging locally**.

**Acceptance Criteria:**

**Given** test files in `test/` directory (783 console calls)
**When** aggressive migration is complete
**Then**:

1. **Test helper created:** `test/helpers/testLogger.ts`
   - Wraps LoggerFactory with test-friendly defaults
   - Respects `LOG_LEVEL` environment variable
   - Default level: `warn` (errors and warnings only)
   - `LOG_LEVEL=debug` enables verbose output

2. **Integration tests migrated:** `test/integration/**`
   - All console.log → `testLogger.debug()`
   - All console.warn → `testLogger.warn()`
   - All console.error → `testLogger.error()`
   - Progress/status messages → `testLogger.info()`

3. **Unit tests migrated:** `test/unit/**`
   - Same pattern as integration tests
   - Keep only essential debug output

4. **Fixture/expected output preserved:**
   - `console.log` for test fixture output comparisons is OK
   - Mark with comment: `// eslint-disable-next-line no-console -- test fixture output`

5. **ESLint updated:**
   - Remove test file exclusion from Story 10.1
   - Tests now follow same rules as src/

**And** CI runs with `LOG_LEVEL=error` (minimal output)
**And** Local dev can use `LOG_LEVEL=debug npm test` for verbose
**And** Test output is clean and readable

**Prerequisites:** Story 10.7 (src/ migration complete)

**Technical Notes:**
- testLogger.ts example:
  ```typescript
  import { LoggerFactory } from '../src/utils/LoggerFactory';
  const level = process.env.LOG_LEVEL || 'warn';
  LoggerFactory.setLevel(level);
  export const testLogger = LoggerFactory.create('test');
  ```
- Prioritize integration tests (most valuable to clean up)
- Unit tests: Focus on noisy ones first (check `test/unit/pii/`, `test/unit/fileProcessor`)
- ~783 calls is significant - may take multiple sessions

---

### Story 10.9: CI/CD Log Level Configuration

As a **DevOps engineer managing CI pipelines**,
I want **log levels configurable in CI/CD**,
So that **pipeline logs are clean but debugging is possible when needed**.

**Acceptance Criteria:**

**Given** CI/CD pipeline (GitHub Actions or similar)
**When** pipeline runs
**Then**:

1. **Default CI log level:** `error` (minimal noise)
2. **Debug mode available:** Re-run with `LOG_LEVEL=debug` for troubleshooting
3. **Test runs:** Use `LOG_LEVEL=error` by default
4. **Build step:** Use `LOG_LEVEL=warn` (catch warnings)

**And** environment variable `LOG_LEVEL` is documented
**And** CI config updated (`.github/workflows/*.yml` or equivalent)
**And** README documents how to enable verbose CI logging
**And** Log level can be set per-job or per-step

**Prerequisites:** Story 10.8 (test logging respects LOG_LEVEL)

**Technical Notes:**
- GitHub Actions: `env: LOG_LEVEL: error` at job level
- Allow manual workflow dispatch with log level input
- Consider: `LOG_LEVEL=debug` for nightly/scheduled runs
- Document in CI config with comments

---

### Story 10.10: Logger Documentation & Developer Guide

As a **developer joining the project**,
I want **clear documentation on how to use LoggerFactory**,
So that **I use logging correctly from day one**.

**Acceptance Criteria:**

**Given** a new developer reading the docs
**When** they need to add logging
**Then** documentation covers:

1. **Quick start:**
   ```typescript
   import { LoggerFactory } from './utils/LoggerFactory';
   const log = LoggerFactory.create('my-module');
   log.info('Hello', { data: 'value' });
   ```

2. **Scope naming convention:**
   - Format: `module:submodule` (e.g., `pii:pipeline`, `i18n:renderer`)
   - Keep scopes consistent with directory structure

3. **Log levels - when to use each:**
   - `debug`: Detailed troubleshooting (disabled in production)
   - `info`: Significant events, startup, completion
   - `warn`: Recoverable issues, deprecations
   - `error`: Failures requiring attention

4. **PII safety:**
   - Auto-redacted: emails, phones, IBANs, Swiss AHV
   - Never log raw user data without redaction
   - Use structured logging: `log.info('User', { id: 123 })` not `log.info('User 123')`

5. **Context-specific guidance:**
   - Main process: Full electron-log features
   - Renderer: Console output with formatting
   - Browser-app: Console only, no persistence
   - Web Workers: Messages posted to main thread
   - Tests: Use `testLogger` from test helpers

6. **Configuration:**
   - `LoggerFactory.setLevel('debug')` - global
   - `LoggerFactory.setScopeLevel('pii', 'debug')` - per-scope
   - `LOG_LEVEL=debug` environment variable

**And** documentation added to `CLAUDE.md` under new "## Logging" section
**And** JSDoc comments complete in `LoggerFactory.ts`
**And** Example usage added to `README.md` or dedicated `docs/LOGGING.md`

**Prerequisites:** Stories 10.1-10.9 (all migrations complete)

**Technical Notes:**
- Add to CLAUDE.md so AI assistants know the logging patterns
- Include common mistakes / anti-patterns section
- Add troubleshooting: "logs not appearing" checklist

---

## Epic 10 Dependencies

```
Story 10.1 (ESLint Rule) ──────────────────────────────────────────────┐
                                                                        │
Story 10.2 (Browser Adaptation) ──> Story 10.3 (Web Worker)            │
         │                                                              │
         v                                                              │
Story 10.4 (i18n) ──> Story 10.5 (PII) ──> Story 10.6 (Utils/UI)       │
                                                    │                   │
                                                    v                   │
                                           Story 10.7 (Deprecation)     │
                                                    │                   │
                                                    v                   │
                                           Story 10.8 (Tests) <─────────┘
                                                    │
                                                    v
                                           Story 10.9 (CI/CD)
                                                    │
                                                    v
                                           Story 10.10 (Documentation)
```

---

## Epic 10 Summary

| Story | Focus | Scope |
|-------|-------|-------|
| 10.1 | ESLint enforcement | Prevents new violations |
| 10.2 | Browser-app LoggerFactory | Make it work (not just verify) |
| 10.3 | Web Worker logging | ML inference logging |
| 10.4 | i18n modules | 25 console calls |
| 10.5 | PII detection | ~10 console calls |
| 10.6 | Utilities & UI | ~10 console calls |
| 10.7 | Deprecated file removal | Cleanup |
| 10.8 | Test files (aggressive) | 783 console calls |
| 10.9 | CI/CD configuration | Pipeline integration |
| 10.10 | Documentation | Developer onboarding |

**Total:** 10 stories addressing ~830 console calls + infrastructure

---

## Epic 6 Update

**Story 6.1 (Factory Central Logger)** is now **MOVED to Epic 10** and expanded into Stories 10.2-10.3. Mark Story 6.1 as "Moved to Epic 10" in Epic 6.

---

## FR Coverage Matrix (Epic 10)

| FR ID | Description | Stories | Status |
|-------|-------------|---------|--------|
| DX-6 | Logging Standardization | 10.1-10.10 | Planned |
| SEC-3 | PII-Safe Logging | 10.2, 10.3, 10.5 | Planned |
| DX-7 | CI/CD Observability | 10.9 | Planned |

---
