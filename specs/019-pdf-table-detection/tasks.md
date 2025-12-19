# Implementation Tasks: PDF Table Detection and Extraction

**Feature**: PDF Table Detection and Extraction
**Branch**: `019-pdf-table-detection`
**Date**: 2025-11-16
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

---

## Task Summary

**Total Tasks**: 47
**User Stories**: 3 (P1: Basic Tables, P2: Complex Tables, P3: Fallback & Error Handling)
**Parallel Opportunities**: 18 tasks marked [P]
**MVP Scope**: Phase 3 (User Story 1 - Basic Table Detection) = 16 tasks

**Implementation Strategy**: Incremental delivery by user story priority. Each story is independently testable and deployable.

---

## Phase 1: Setup & Project Initialization

**Goal**: Prepare project structure and dependencies for table detection implementation

**Tasks**:

- [ ] T001 Create TypeScript type definitions file at src/types/pdfTable.ts with BoundingBox, Alignment, DetectionMethod, TableCell, TableRow, TableStructure, DetectionResult, PdfTextItem interfaces (from data-model.md)
- [ ] T002 Update src/types/index.ts to export all new table-related types from pdfTable.ts
- [ ] T003 Run TypeScript compiler to verify type definitions compile without errors: npm run compile
- [ ] T004 Create test fixtures directory at test/fixtures/ if it doesn't exist
- [ ] T005 [P] Create test fixture file at test/fixtures/pdfTables.js with simpleBorderedTable, borderlessTable, columnarText fixtures (from quickstart.md Phase 2)
- [ ] T006 [P] Verify project ignore files are properly configured (.gitignore includes node_modules/, dist/, .env*, *.log)

**Completion Criteria**: Type system ready, test infrastructure prepared, no compilation errors

---

## Phase 2: Foundational - Core Detection Module

**Goal**: Implement the core table detection module that all user stories will depend on

**Dependencies**: Must complete Phase 1 before starting

**Tasks**:

- [ ] T007 Create src/utils/pdfTableDetector.ts with TableDetector class stub and constructor
- [ ] T008 Implement TableDetector.detectTables() method with try-catch wrapper and graceful fallback (FR-008 compliance)
- [ ] T009 Implement TableDetector.validateTable() method checking minimum 2 rows, 2 columns, confidence >= 0.7, and column consistency (FR-003 validation)
- [ ] T010 Implement TableDetector.createFallbackResult() private method returning DetectionResult with fallbackUsed: true
- [ ] T011 Create TableToMarkdownConverter class in src/utils/pdfTableDetector.ts with method stubs
- [ ] T012 Implement TableToMarkdownConverter.escapeCell() method handling pipes, backslashes, newlines (FR-006 compliance)
- [ ] T013 Implement TableToMarkdownConverter.generateAlignmentRow() method with left/right/center alignment logic (FR-005)
- [ ] T014 Implement TableToMarkdownConverter.generateHeader() method using escapeCell()
- [ ] T015 Implement TableToMarkdownConverter.generateDataRow() method handling empty cells (FR-011)
- [ ] T016 Implement TableToMarkdownConverter.convertTable() method orchestrating header, alignment, and data row generation (FR-002, FR-007)
- [ ] T017 Export TableDetector and TableToMarkdownConverter classes from src/utils/pdfTableDetector.ts
- [ ] T018 Run TypeScript compiler to verify foundational module compiles: npm run compile

**Completion Criteria**: Core detection and conversion classes implemented with graceful error handling, compiles successfully

---

## Phase 3: User Story 1 - Basic Table Detection (Priority P1)

**Goal**: Detect and convert simple bordered tables with clear gridlines (80% of use cases)

**Why P1**: Core value proposition - without this, feature delivers no value

**Independent Test Criteria**:
- Convert PDF with 3x5 bordered table → Output contains valid Markdown table with pipes and alignment
- Multiple tables on different pages → Each table detected separately
- Numeric columns → Right-aligned, text columns → Left-aligned
- Multi-page table → Rows merged into single table

**Dependencies**: Must complete Phase 2 (Foundational)

### US1: Test Setup

- [ ] T019 [US1] Create test file at test/unit/pdfTableDetector.test.js with Mocha/Chai imports and describe block for TableDetector
- [ ] T020 [US1] Write RED test: "should detect simple bordered 3x3 table with 95%+ confidence" using simpleBorderedTable fixture (SC-001)
- [ ] T021 [US1] Write RED test: "should validate table structure (min 2 rows, 2 columns)" checking FR-003 compliance
- [ ] T022 [US1] Write RED test: "should never throw exception, even on invalid input" testing null and empty array inputs (SC-008)
- [ ] T023 [US1] Write RED test: "should set fallbackUsed: true for non-table content" using columnarText fixture (FR-008)

### US1: Core Implementation

- [ ] T024 [US1] Implement TableDetector.detectLattice() method with bordered table detection algorithm using pdf-parse position metadata
- [ ] T025 [US1] Add lattice detection logic: detect horizontal/vertical lines using consistent y-positions and x-positions across text items
- [ ] T026 [US1] Add cell clustering logic: group text items into grid cells based on detected line positions
- [ ] T027 [US1] Add TableStructure builder: create rows and cells from clustered text items with confidence scoring
- [ ] T028 [US1] Implement column alignment detection: check if cell content is numeric for right-alignment, text for left-alignment (FR-005)
- [ ] T029 [US1] Run tests to achieve GREEN: npm test test/unit/pdfTableDetector.test.js
- [ ] T030 [US1] Refactor detectLattice() to extract helper methods: detectHorizontalLines(), detectVerticalLines(), buildGrid(), if code exceeds 50 lines

### US1: Markdown Conversion Tests

- [ ] T031 [US1] Create test file at test/unit/tableToMarkdown.test.js with describe block for TableToMarkdownConverter
- [ ] T032 [US1] Write RED test: "should generate valid Markdown table from TableStructure" verifying pipe syntax and alignment separators
- [ ] T033 [US1] Write RED test: "should escape pipe characters in cell content" testing FR-006 compliance
- [ ] T034 [US1] Write RED test: "should handle empty cells correctly" verifying FR-011 compliance
- [ ] T035 [US1] Run Markdown conversion tests to achieve GREEN: npm test test/unit/tableToMarkdown.test.js

### US1: Multi-Page Table Support

- [ ] T036 [US1] Implement TableDetector.mergeTables() method to combine tables spanning multiple pages (FR-004)
- [ ] T037 [US1] Add merge logic: detect header repetition pattern and matching column structure across pages
- [ ] T038 [US1] Write test: "should merge multi-page tables with repeated headers" using multi-page fixture

### US1: Integration

- [ ] T039 [US1] Update src/converters/PdfToMarkdown.ts: import TableDetector and TableToMarkdownConverter
- [ ] T040 [US1] Add tableDetector and tableConverter as class properties in PdfToMarkdown constructor
- [ ] T041 [US1] Enhance convert() method: for each page, call detectTables() and convert detected tables to Markdown (FR-001, FR-002)
- [ ] T042 [US1] Add fallback logic: if detection fails or confidence low, use existing text extraction (FR-008, FR-009)
- [ ] T043 [US1] Implement addTableMetadata() private method to enhance frontmatter with tablesDetected, tableCount, method, confidence (FR-012)
- [ ] T044 [US1] Update frontmatter generation to include table metadata in YAML format
- [ ] T045 [US1] Run TypeScript compilation: npm run compile
- [ ] T046 [US1] Create integration test file at test/integration/pdfTableConversion.test.js
- [ ] T047 [US1] Write integration test: "should convert PDF with single bordered table to Markdown" with end-to-end verification
- [ ] T048 [US1] Write integration test: "should detect multiple tables on different pages" verifying page markers
- [ ] T049 [US1] Write integration test: "should include table metadata in frontmatter" checking YAML fields
- [ ] T050 [US1] Run integration tests: npm test test/integration/pdfTableConversion.test.js

**User Story 1 Completion Criteria**:
- ✅ Simple bordered tables detected with 95%+ confidence (SC-001)
- ✅ Valid Markdown tables generated with proper alignment (SC-004)
- ✅ Multi-page tables merged correctly (FR-004)
- ✅ Metadata included in frontmatter (FR-012)
- ✅ All US1 tests passing
- ✅ TypeScript compilation successful
- ✅ Independent test: User can convert PDF with basic table and get formatted Markdown output

---

## Phase 4: User Story 2 - Complex Table Handling (Priority P2)

**Goal**: Detect borderless tables and handle merged cells, nested headers

**Why P2**: Enhances feature for 15-20% of real-world use cases, but P1 already delivers value

**Independent Test Criteria**:
- Borderless table with whitespace-separated columns → Detected and converted
- Merged header cells → Content split or noted in output
- Inconsistent row heights → All content captured correctly

**Dependencies**: Must complete Phase 3 (User Story 1)

### US2: Test Setup

- [ ] T051 [US2] Create borderless table test fixture in test/fixtures/pdfTables.js with stream detection scenario
- [ ] T052 [US2] Write RED test: "should detect borderless table with 80%+ confidence" using borderlessTable fixture (SC-005)
- [ ] T053 [US2] Write RED test: "should handle merged cells by splitting content across columns" testing merged cell scenario

### US2: Stream Detection Implementation

- [ ] T054 [US2] Implement TableDetector.detectStream() method stub with borderless table detection algorithm
- [ ] T055 [US2] Add DBSCAN clustering logic for column boundary detection using consistent x-positions across rows
- [ ] T056 [US2] Add row clustering logic using y-position grouping with tolerance for varying row heights
- [ ] T057 [US2] Add confidence scoring for stream detection (lower than lattice due to ambiguity)
- [ ] T058 [US2] Update detectTables() method to fall back from lattice to stream if lattice confidence < 0.7
- [ ] T059 [US2] Run tests to achieve GREEN for borderless table detection: npm test test/unit/pdfTableDetector.test.js

### US2: Merged Cell Handling

- [ ] T060 [US2] Add merged cell detection logic in detectLattice(): identify text items spanning >1.5x average cell width
- [ ] T061 [US2] Implement cell content splitting or warning generation for merged cells
- [ ] T062 [US2] Add mergedCellsDetected field to DetectionResult.warnings array
- [ ] T063 [US2] Write integration test: "should detect and note merged cells in table" verifying warning message
- [ ] T064 [US2] Run integration tests: npm test test/integration/pdfTableConversion.test.js

**User Story 2 Completion Criteria**:
- ✅ Borderless tables detected with 80%+ confidence (SC-005)
- ✅ Merged cells handled with warnings (edge case documented)
- ✅ Stream detection algorithm working
- ✅ All US2 tests passing
- ✅ Independent test: User can convert PDF with borderless table and get formatted output

---

## Phase 5: User Story 3 - Fallback & Error Handling (Priority P3)

**Goal**: Gracefully handle detection failures and ambiguous table-like structures

**Why P3**: Improves robustness and UX, but feature is valuable without perfect error handling

**Independent Test Criteria**:
- Ambiguous columnar text → Confidence score included or fallback to text extraction
- Partial detection failure → Both detected table and missed content shown
- Complex nested tables → Clear error message with fallback

**Dependencies**: Must complete Phase 4 (User Story 2)

### US3: Confidence Scoring & Warnings

- [ ] T065 [US3] Implement confidence threshold checking in validateTable(): reject tables with confidence < 0.7
- [ ] T066 [US3] Add warning generation for low-confidence detections (0.5-0.7 range) in DetectionResult.warnings
- [ ] T067 [US3] Write test: "should include confidence score in output for ambiguous tables" verifying warning text
- [ ] T068 [US3] Write test: "should fall back to text extraction for confidence < 0.7" checking fallbackUsed flag

### US3: Partial Detection Handling

- [ ] T069 [US3] Add partial detection logic: if some rows detected but structure incomplete, mark as partial in warnings
- [ ] T070 [US3] Update convertTable() to include HTML comment indicating partial detection: `<!-- Partial table detection -->`
- [ ] T071 [US3] Write integration test: "should handle partial detection with warnings" verifying both table and text output
- [ ] T072 [US3] Write integration test: "should not crash on malformed table structures" testing extreme edge cases

### US3: Error Messages & User Feedback

- [ ] T073 [US3] Enhance error handling in detectTables() to catch specific error types (TypeError, RangeError) with descriptive messages
- [ ] T074 [US3] Add user-friendly error messages to DetectionResult.warnings for common failure scenarios
- [ ] T075 [US3] Update frontmatter to include detectionWarnings count field if warnings exist
- [ ] T076 [US3] Write test: "should provide clear error message for nested table structures" verifying error text clarity
- [ ] T077 [US3] Run all tests to ensure graceful degradation: npm test

**User Story 3 Completion Criteria**:
- ✅ 100% graceful degradation - no crashes (SC-008)
- ✅ Confidence scores included in output
- ✅ Partial detection handled with warnings
- ✅ Clear error messages for unsupported scenarios
- ✅ All US3 tests passing
- ✅ Independent test: User can convert PDF with ambiguous structures and get meaningful feedback

---

## Phase 6: Polish & Cross-Cutting Concerns

**Goal**: Performance optimization, code quality, and comprehensive testing

**Dependencies**: All user stories complete (Phases 3-5)

### Performance Optimization

- [ ] T078 [P] Create performance test file at test/performance/tableDetection.perf.js
- [ ] T079 [P] Write performance test: "should add <20% overhead vs baseline PDF extraction" measuring processing time (SC-003)
- [ ] T080 [P] Run performance tests with 10MB and 50MB sample PDFs to verify <20% overhead
- [ ] T081 [P] If overhead >20%, optimize hot paths: cache bounding box calculations, parallelize page processing if applicable

### Accuracy Validation

- [ ] T082 [P] Create accuracy test file at test/accuracy/tableDetection.accuracy.js
- [ ] T083 [P] Write accuracy test: "should achieve 95%+ accuracy for simple bordered tables" with 20+ test cases (SC-001)
- [ ] T084 [P] Write accuracy test: "should achieve 80%+ accuracy for borderless tables" with 20+ test cases (SC-005)
- [ ] T085 [P] Write accuracy test: "should achieve 90%+ column alignment accuracy" with numeric/text column test cases (SC-007)
- [ ] T086 [P] Run accuracy tests and document results in test output

### Code Quality & Documentation

- [ ] T087 [P] Run ESLint on all new files: npm run lint
- [ ] T088 [P] Fix any ESLint errors or warnings in src/utils/pdfTableDetector.ts and src/converters/PdfToMarkdown.ts
- [ ] T089 [P] Run full test suite to ensure no regressions: npm test
- [ ] T090 [P] Verify test coverage meets 80%+ requirement for new table detection code
- [ ] T091 [P] Add JSDoc comments to all public methods in TableDetector and TableToMarkdownConverter classes
- [ ] T092 [P] Update CLAUDE.md project documentation to mention table detection feature in "Converters" section

### Manual Testing & Edge Cases

- [ ] T093 Create test-pdfs/ directory with sample PDFs for manual testing
- [ ] T094 [P] Test with real PDF containing simple bordered table - verify Markdown output renders correctly
- [ ] T095 [P] Test with real PDF containing borderless table - verify detection and conversion quality
- [ ] T096 [P] Test with real PDF containing multi-page table - verify rows merged correctly
- [ ] T097 [P] Test with PDF containing columnar text (not a table) - verify fallback to text extraction
- [ ] T098 [P] Test edge case: PDF table with pipe characters in cells - verify pipes escaped as `\|`
- [ ] T099 [P] Test edge case: PDF table with empty cells - verify rendered as `| |` in Markdown

**Phase 6 Completion Criteria**:
- ✅ Performance overhead <20% (SC-003)
- ✅ Accuracy targets met (SC-001, SC-005, SC-007)
- ✅ Code quality passing (lint, coverage 80%+)
- ✅ All edge cases tested
- ✅ Documentation updated
- ✅ Manual testing confirms feature works end-to-end

---

## Dependencies & Execution Order

### User Story Dependencies

```
Phase 1 (Setup)
   ↓
Phase 2 (Foundational - Core Detection Module)
   ↓
Phase 3 (User Story 1 - Basic Table Detection) ← MVP SCOPE
   ↓
Phase 4 (User Story 2 - Complex Table Handling)
   ↓
Phase 5 (User Story 3 - Fallback & Error Handling)
   ↓
Phase 6 (Polish & Cross-Cutting Concerns)
```

**Independent Stories**: Each user story (P1, P2, P3) can be deployed independently after completion. P1 alone is a viable MVP.

### Task Execution Rules

1. **Sequential within phase**: Tasks within a phase must complete in order unless marked [P]
2. **Parallel execution**: Tasks marked [P] can run concurrently with other [P] tasks in same phase
3. **TDD cycle**: Test tasks (T020-T023, T031-T035, etc.) MUST complete before implementation tasks
4. **Compilation checkpoints**: After each implementation section, run `npm run compile` to verify TypeScript
5. **Test checkpoints**: After each feature implementation, run tests to achieve GREEN before proceeding

### Parallel Execution Examples

**Phase 1 Setup** - Can run in parallel:
- T005 (Create test fixtures) || T006 (Verify ignore files)

**Phase 6 Polish** - Can run in parallel:
- T078-T081 (Performance tests) || T082-T086 (Accuracy tests) || T087-T092 (Code quality)
- T094-T099 (All manual testing tasks can run concurrently)

---

## MVP Scope Recommendation

**Minimum Viable Product**: Complete through Phase 3 (User Story 1) = **16 core tasks** (T019-T050 excluding setup)

**Why this MVP**:
- Delivers core value: Simple bordered tables (80% of use cases)
- Independently testable and deployable
- Achieves primary success criteria (SC-001: 95% accuracy for simple tables)
- Provides foundation for P2/P3 enhancements

**After MVP**:
- Phase 4 (US2): Adds borderless table support (15-20% use cases)
- Phase 5 (US3): Adds robustness and error handling
- Phase 6: Performance, quality, documentation

---

## Testing Strategy

**Test-First Development (TDD)**: All implementation follows Red-Green-Refactor cycle

**Test Coverage Requirements**:
- Unit tests: 80%+ coverage for src/utils/pdfTableDetector.ts
- Integration tests: End-to-end conversion scenarios for each user story
- Performance tests: Verify <20% overhead (SC-003)
- Accuracy tests: Validate detection rates (SC-001, SC-005, SC-007)

**Test Execution Order**:
1. Write RED tests for feature (tests fail)
2. Implement minimal code to pass tests (GREEN)
3. Refactor for quality while keeping tests GREEN
4. Run full test suite to prevent regressions

---

## Success Criteria Validation

| Success Criteria | Validation Task | Phase |
|------------------|----------------|-------|
| SC-001: 95% accuracy (simple bordered tables) | T083 | Phase 6 |
| SC-002: PDF quality 75% → 85%+ | Manual testing (T094-T099) | Phase 6 |
| SC-003: <20% processing overhead | T079-T080 | Phase 6 |
| SC-004: 90% render without edits | T047-T049 integration tests | Phase 3 |
| SC-005: 80% accuracy (borderless tables) | T084 | Phase 6 |
| SC-006: 95% multi-page merge accuracy | T038 | Phase 3 |
| SC-007: 90% column alignment accuracy | T085 | Phase 6 |
| SC-008: 100% graceful degradation | T022, T072, T077 | Phases 3, 5 |

---

## Notes

- **Zero New Dependencies**: Custom heuristic detection uses only existing pdf-parse library (from research.md)
- **Backward Compatibility**: FR-009 maintained - non-table PDFs unaffected by new code
- **Constitutional Compliance**: All 5 principles validated in plan.md (Privacy, TDD, PII, Security, Quality)
- **Phased Delivery**: Each user story is independently deployable increment
- **Performance Constraint**: Must maintain <20% overhead vs current PDF extraction (SC-003)
