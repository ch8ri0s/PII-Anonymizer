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
| Epic 6 | Infrastructure & Developer Experience | 8 | DX-1-4, SEC-1-2, UX-1, BUG-1 |
| Epic 7 | Browser Migration | 7 | FR-6.1-6.6, FR-5.8 (browser) |

**Total:** 7 Epics, 35 Stories

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

As a **developer maintaining the codebase**,
I want **a centralized logging factory with consistent configuration**,
So that **all modules use the same logging patterns and levels can be controlled centrally**.

**Acceptance Criteria:**

**Given** any module in the application
**When** it needs to log messages
**Then** it imports the central logger factory and creates a scoped logger

**And** logger supports levels: debug, info, warn, error
**And** log format includes: timestamp, level, scope, message
**And** log level can be configured globally (via env or settings)
**And** existing `createLogger` calls are migrated to use the factory
**And** logger works in both main process and renderer process

**Prerequisites:** None (infrastructure story)

**Technical Notes:**
- Consolidate existing `src/utils/logger.ts` into factory pattern
- Support scoped loggers: `LoggerFactory.create('module-name')`
- Add log level filtering based on environment/config
- Ensure Electron IPC compatibility for renderer logging
- Consider structured logging (JSON format) for production

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
