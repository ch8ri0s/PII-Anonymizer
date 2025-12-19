# Implementation Plan: PDF Table Detection and Extraction

**Branch**: `019-pdf-table-detection` | **Date**: 2025-11-16 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/019-pdf-table-detection/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Enhance the PDF-to-Markdown converter to automatically detect tables within PDF documents and convert them to properly formatted Markdown tables. Currently, tables are extracted as unstructured text, resulting in poor quality and usability (75% quality score). This feature will improve PDF conversion quality to 85%+ by detecting table structures, preserving row/column layout, and applying appropriate alignment while maintaining backward compatibility with existing non-table PDF content.

## Technical Context

**Language/Version**: TypeScript 5.x (converters), JavaScript ES2022 (main process)
**Primary Dependencies**: pdf-parse (existing), **NEEDS CLARIFICATION: table detection library** (tabula-js, pdf.js, or pdf-lib)
**Storage**: File system only (input PDFs, output Markdown, no database)
**Testing**: Mocha + Chai (existing test framework), 80%+ coverage requirement
**Target Platform**: Electron 39.1.1 desktop app (macOS, Windows, Linux)
**Project Type**: Single project (Electron desktop application)
**Performance Goals**: <20% processing time overhead vs current PDF extraction, <2 minutes for 50MB PDFs
**Constraints**: 100% local processing (no network calls), maintain 94%+ PII detection accuracy, backward compatible with existing PDF conversion
**Scale/Scope**: Enhancement to existing PdfToMarkdown converter (~300 LOC), support PDFs up to 50MB, handle 95% of simple tables and 80% of borderless tables

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Check (Before Phase 0)

### I. Privacy-First Architecture (NON-NEGOTIABLE)
- ✅ **PASS** - Feature operates on existing PDF conversion pipeline with 100% local processing
- ✅ **PASS** - No network calls required for table detection
- ✅ **PASS** - PII detection occurs AFTER table extraction, maintaining existing privacy guarantees
- ✅ **PASS** - Table content processed locally, no external APIs

### II. Test-First Development (NON-NEGOTIABLE)
- ✅ **PASS** - Will follow Red-Green-Refactor cycle for all table detection logic
- ✅ **PASS** - Tests required before implementation (unit tests for detection, integration tests for conversion)
- ✅ **PASS** - Test coverage target: 80%+ for new table detection code
- ⚠️ **NOTE** - Table detection accuracy tests will be added to existing converter test suite

### III. Comprehensive PII Detection
- ✅ **PASS** - Feature does not modify PII detection pipeline
- ✅ **PASS** - Table extraction happens in conversion phase, before PII detection
- ✅ **PASS** - PII within table cells will be detected by existing ML + rule-based system
- ✅ **PASS** - No impact on 94%+ accuracy requirement

### IV. Security Hardening (NON-NEGOTIABLE)
- ✅ **PASS** - No new Electron security vectors introduced
- ✅ **PASS** - File path handling uses existing validated pathValidator.ts
- ✅ **PASS** - No user input processed beyond existing file upload flow
- ✅ **PASS** - Table detection library choice will be evaluated for security (see research phase)

### V. LLM-Ready Output Quality
- ✅ **PASS** - Primary goal is improving Markdown table quality for LLM consumption
- ✅ **PASS** - Target: PDF quality 75% → 85%+ for documents with tables
- ✅ **PASS** - Maintains existing metadata (frontmatter) with added table count field
- ✅ **PASS** - Backward compatible: non-table PDFs unaffected

**GATE STATUS (Initial)**: ✅ **PASSED** - No constitutional violations. Feature aligns with all core principles.

---

### Re-Check (After Phase 1 Design)

**Date**: 2025-11-16
**Phase 1 Artifacts Reviewed**:
- ✅ research.md - Library selection (custom heuristics, zero new dependencies)
- ✅ data-model.md - Entity definitions and validation rules
- ✅ contracts/table-detection-api.md - TypeScript API contracts
- ✅ quickstart.md - Developer implementation guide

### I. Privacy-First Architecture (NON-NEGOTIABLE)
- ✅ **CONFIRMED** - Custom heuristic detection uses only pdf-parse (existing dependency)
- ✅ **CONFIRMED** - Zero new dependencies = zero new network call vectors
- ✅ **CONFIRMED** - Data model shows table extraction happens pre-PII detection
- ✅ **CONFIRMED** - API contracts enforce 100% local processing

### II. Test-First Development (NON-NEGOTIABLE)
- ✅ **CONFIRMED** - Quickstart guide enforces TDD Red-Green-Refactor cycle
- ✅ **CONFIRMED** - Test fixtures and test cases defined before implementation
- ✅ **CONFIRMED** - API contracts include testing contracts
- ✅ **CONFIRMED** - Performance and accuracy test specs included

### III. Comprehensive PII Detection
- ✅ **CONFIRMED** - Data model shows PII detection operates on table cell content post-extraction
- ✅ **CONFIRMED** - No modifications to existing PII pipeline
- ✅ **CONFIRMED** - Table content processed as text by existing ML model
- ✅ **CONFIRMED** - Accuracy requirement unchanged (94%+)

### IV. Security Hardening (NON-NEGOTIABLE)
- ✅ **CONFIRMED** - Custom heuristics = no external library security risks
- ✅ **CONFIRMED** - pdf-parse already security-audited (existing dependency)
- ✅ **CONFIRMED** - API contracts show input validation (PdfTextItem type checking)
- ✅ **CONFIRMED** - Error handling contracts prevent exception leakage (graceful degradation)

### V. LLM-Ready Output Quality
- ✅ **CONFIRMED** - Markdown table output quality targets defined (SC-004: 90% render without edits)
- ✅ **CONFIRMED** - Metadata enhancement defined (tablesDetected, tableCount, confidence)
- ✅ **CONFIRMED** - Backward compatibility maintained (fallbackUsed flag)
- ✅ **CONFIRMED** - Quality improvement target: 75% → 85%+

**GATE STATUS (Post-Phase-1)**: ✅ **PASSED** - Design maintains all constitutional principles. No violations introduced during planning phase.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── converters/
│   ├── PdfToMarkdown.ts          # PRIMARY: Enhance with table detection
│   ├── MarkdownConverter.ts      # MODIFY: Add table utilities if needed
│   └── [other converters unchanged]
│
├── services/
│   └── [existing services unchanged]
│
├── types/
│   └── pdfTable.ts               # NEW: Table detection type definitions
│
└── utils/
    └── pdfTableDetector.ts       # NEW: Table detection logic

test/
├── unit/
│   ├── converters/
│   │   └── PdfToMarkdown.test.js # ENHANCE: Add table detection tests
│   └── pdfTableDetector.test.js  # NEW: Unit tests for table detection
│
└── integration/
    └── pdfTableConversion.test.js # NEW: End-to-end table conversion tests

dist/                              # Compiled TypeScript output
└── [mirrors src/ structure]
```

**Structure Decision**: Single project Electron application. Table detection is implemented as an enhancement to the existing `PdfToMarkdown` converter in `src/converters/`. New table detection logic will be extracted to a utility module (`src/utils/pdfTableDetector.ts`) for separation of concerns and testability. Type definitions for table structures will be added to `src/types/pdfTable.ts`.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
