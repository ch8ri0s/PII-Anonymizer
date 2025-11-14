# Implementation Plan: File Preview and Metadata Display

**Branch**: `001-file-preview-metadata` | **Date**: 2025-11-09 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-file-preview-metadata/spec.md`

## Summary

Add file preview and metadata display capabilities to the PII Anonymiser application, enabling users to verify file selection before processing. The feature provides drag-and-drop file selection with visual feedback, displays file metadata (filename, last modified date, line count, word count), shows content preview (first 20 lines or 1000 characters), and supports batch file processing with queue management. This enhancement improves user confidence and reduces processing errors by allowing verification before committing to anonymization.

## Technical Context

**Language/Version**: TypeScript 5.x (compiles to JavaScript/Node.js v18+, Electron 39.1.1)
**Primary Dependencies**: Electron (desktop framework), Tailwind CSS 3.x (utility-first styling), @headlessui/tailwindcss (accessible components), @xenova/transformers (ML), mammoth (DOCX), pdf-parse (PDF), exceljs (Excel), marked (Markdown), turndown (HTML→Markdown)
**Storage**: Local file system only (no database) - files processed in-place, output written to user-specified directories
**Testing**: Mocha 11.7.5 + Chai 6.2.0 + @types/mocha, @types/chai, ts-node (TypeScript test runner)
**Target Platform**: Cross-platform desktop (macOS, Windows, Linux via Electron)
**Project Type**: Single Electron desktop application
**Performance Goals**: Metadata extraction <2s for files <10MB, preview generation <3s for files <10MB, drag-drop response <3s
**Constraints**: 100% local processing (no network), Electron security hardening (contextIsolation, no nodeIntegration), file size <1GB for practical preview
**Scale/Scope**: Single-user desktop app, batch processing up to 50 files optimized, 5 supported file types (DOCX, PDF, XLSX, CSV, TXT)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Privacy-First Architecture ✅ PASS

- **Requirement**: 100% local processing, no network calls, PII never in logs
- **Compliance**: Feature only adds file metadata/preview extraction - all processing remains local, no new network dependencies, file paths redacted from user-facing errors
- **Evidence**: Uses existing local file converters, IPC communication stays within Electron sandbox

### II. Test-First Development ⚠️ CONDITIONAL PASS

- **Requirement**: Tests written before implementation, Red-Green-Refactor cycle
- **Compliance**: User spec does not explicitly request tests. Constitution requires test-first for all features.
- **Decision**: **Proceed with tests** - metadata extraction and preview generation are core functionality requiring test coverage for correctness
- **Action**: Phase 0 research will include test strategy for metadata/preview utilities

### III. Comprehensive PII Detection ✅ PASS

- **Requirement**: Maintain 94%+ ML accuracy + rule-based Swiss/EU patterns
- **Compliance**: Feature does not modify PII detection logic - only displays file metadata and content preview
- **Evidence**: Reuses existing converters without changing detection algorithms

### IV. Security Hardening ✅ PASS

- **Requirement**: Electron best practices (contextIsolation, CSP, path validation)
- **Compliance**: New IPC handlers for metadata/preview will follow existing secure patterns (exposed via preload.js contextBridge), file path validation required before read operations
- **Evidence**: Existing main.js and preload.js already implement security requirements
- **Action**: Phase 1 will include secure IPC handler design with path normalization

### V. LLM-Ready Output Quality ✅ PASS

- **Requirement**: Preserve document structure with format-specific fidelity targets
- **Compliance**: Preview generation reuses existing converter extraction logic (already meets fidelity targets)
- **Evidence**: TextToMarkdown, DocxToMarkdown, PdfToMarkdown preserve structure per constitution requirements

**Overall Gate Status**: ✅ **PASS** - All principles satisfied. Test-first requirement addressed in Phase 0 research.

## Project Structure

### Documentation (this feature)

```text
specs/001-file-preview-metadata/
├── plan.md              # This file
├── research.md          # Phase 0 output (test strategy, performance approach)
├── data-model.md        # Phase 1 output (entities: FileMetadata, FilePreview, BatchQueue)
├── quickstart.md        # Phase 1 output (manual test scenarios)
├── contracts/           # Phase 1 output (IPC contract definitions)
└── tasks.md             # Already created - implementation task list
```

### Source Code (repository root)

**Structure Decision**: Single Electron project - feature extends existing UI and adds utility modules

```text
# Root files (Electron main/renderer processes)
├── index.html           # UI structure - ADD preview/metadata panels with Tailwind classes
├── input.css            # NEW - Tailwind CSS entry point (@tailwind directives)
├── output.css           # GENERATED - Compiled Tailwind CSS (gitignored)
├── styles.css           # EXISTING - Custom CSS (keep for app-specific styles)
├── renderer.ts          # CONVERT from .js - UI logic with TypeScript types
├── main.ts              # CONVERT from .js - Electron main with TypeScript
├── preload.ts           # CONVERT from .js - Security bridge with typed APIs
├── fileProcessor.ts     # CONVERT from .js - Processing logic with types
├── tsconfig.json        # NEW - TypeScript compiler configuration
├── tailwind.config.js   # NEW - Tailwind CSS configuration
├── postcss.config.js    # NEW - PostCSS configuration for Tailwind

# New utility modules (TypeScript)
src/
├── utils/               # NEW DIRECTORY
│   ├── metadataExtractor.ts    # File stats + text statistics with types
│   ├── contentPreview.ts       # Extract first 20 lines / 1000 chars with types
│   └── batchQueue.ts           # Batch queue data structure with TypeScript
├── types/               # NEW DIRECTORY
│   ├── fileMetadata.ts         # FileMetadata interface
│   ├── filePreview.ts          # FilePreview interface
│   ├── batchQueue.ts           # BatchQueue, BatchProgress interfaces
│   └── ipc.ts                  # IPC contract types
├── converters/          # EXISTING - will migrate to .ts gradually
│   ├── TextToMarkdown.js
│   ├── DocxToMarkdown.js
│   ├── PdfToMarkdown.js
│   ├── ExcelToMarkdown.js
│   └── CsvToMarkdown.js
└── pii/                 # EXISTING - no changes
    └── SwissEuDetector.js

# Tests (TypeScript)
test/
├── utils/               # NEW - unit tests with TypeScript
│   ├── metadataExtractor.test.ts
│   ├── contentPreview.test.ts
│   └── batchQueue.test.ts
└── integration/         # NEW - end-to-end test
    └── filePreview.test.ts

# Build output (gitignored)
dist/
├── main.js              # Compiled main process
├── renderer.js          # Compiled renderer process
├── preload.js           # Compiled preload script
└── src/                 # Compiled utilities
```

**Key Architectural Decisions**:
1. **TypeScript for type safety** - all new code in .ts, gradual migration of existing .js files
2. **Tailwind CSS for styling** - utility-first approach, replaces custom CSS for new components
3. **Headless UI integration** - accessible dropdown/dialog components for queue management
4. **Type-safe IPC contracts** - interfaces in src/types/ipc.ts for compile-time validation
5. **Reuse existing converters** - no changes to conversion logic, just wrap with TypeScript types
6. **Utility modules in src/utils/** - clear separation of concerns
7. **IPC for heavy operations** - metadata/preview extraction in main process (Node.js access), results sent to renderer
8. **Incremental UI enhancement** - extend existing index.html panels, don't replace entire UI
9. **Queue as array** - simple in-memory queue (no persistence needed for desktop app)
10. **Build process** - tsc for TypeScript compilation, Tailwind CLI for CSS processing

## Complexity Tracking

> **No constitution violations - section not required**

---

## Phase 0: Research & Decisions

**Prerequisites**: Constitution check passed

**Research Tasks**:
1. Investigate Mocha/Chai + ts-node test patterns for TypeScript Electron IPC handlers
2. Research best practices for limiting file read operations (first N lines efficiently)
3. Evaluate performance of fs.stat vs manual parsing for file metadata
4. Research Electron dialog API for multi-file selection constraints
5. Investigate Tailwind CSS setup for Electron (build process integration)
6. Research @headlessui/tailwindcss component patterns (no React dependency)
7. Evaluate TypeScript configuration for mixed .ts/.js codebase (incremental migration)

**Output**: `research.md` with decisions on:
- Test strategy for TypeScript IPC handlers (ts-node + manual mocking)
- File reading approach (streaming vs full read for preview)
- Batch queue size limits and memory management
- Tailwind CSS build integration (PostCSS vs CLI)
- TypeScript compiler options for Electron (target, module, esModuleInterop)
- Headless UI usage patterns without React (vanilla JS alternatives)

---

## Phase 1: Design Artifacts

**Prerequisites**: `research.md` complete

### 1. Data Model (`data-model.md`)

**Entities**:

- **FileMetadata**
  - Properties: filename (string), filePath (string), fileSize (number), lastModified (Date), lineCount (number), wordCount (number), charCount (number)
  - Validation: filePath must be absolute, fileSize > 0, counts >= 0
  - Lifecycle: Created on file selection → Populated async → Displayed in UI

- **FilePreview**
  - Properties: content (string), isTruncated (boolean), previewLimit (number = 20 lines or 1000 chars), formatType (enum: 'text', 'structured')
  - Constraints: content length <= 10000 chars (hard cap for UI performance)
  - Lifecycle: Created on file selection → Extracted from converter → Rendered in preview panel

- **BatchQueue**
  - Properties: files (Array<{file: File, metadata: FileMetadata | null, preview: FilePreview | null}>), currentIndex (number), status (enum: 'idle', 'processing', 'paused', 'completed')
  - Operations: addFile(file), removeFile(index), clear(), processNext(), pause(), resume()
  - Lifecycle: Empty → Files added → Processing (sequential) → Completed/Partial

- **BatchProgress**
  - Properties: currentFileNumber (number), totalFiles (number), currentFileProgress (number 0-100), overallProgress (number 0-100)
  - Computed: overallProgress = ((currentFileNumber - 1) + currentFileProgress/100) / totalFiles * 100
  - Display: "Processing file {currentFileNumber} of {totalFiles}" + dual progress bars

### 2. IPC Contracts (`contracts/`)

**Contract 1: getFileMetadata**
- **Channel**: `file:getMetadata`
- **Input**: `{ filePath: string }`
- **Output**: `{ filename: string, fileSize: number, lastModified: Date, lineCount: number, wordCount: number, charCount: number } | { error: string }`
- **Errors**: File not found, Permission denied, Unsupported file type
- **Performance**: Must complete <2s for files <10MB

**Contract 2: getFilePreview**
- **Channel**: `file:getPreview`
- **Input**: `{ filePath: string, limit: { lines: number, chars: number } }`
- **Output**: `{ content: string, isTruncated: boolean, formatType: string } | { error: string }`
- **Errors**: File not found, Permission denied, Read error, Corrupted file
- **Performance**: Must complete <3s for files <10MB

**Contract 3: selectMultipleFiles** (extends existing dialog)
- **Channel**: `dialog:selectFiles`
- **Input**: `{ allowMultiple: boolean, filters: Array<{name: string, extensions: string[]}> }`
- **Output**: `{ filePaths: string[] } | null` (null on cancel)
- **Errors**: Dialog cancelled, No files selected

### 3. Test Scenarios (`quickstart.md`)

**Scenario 1: Single File Metadata Display**
1. Launch app
2. Drag `test/data/sample.docx` onto drop zone
3. Verify metadata panel shows: filename, last modified date, line count, word count
4. Verify all values match actual file properties

**Scenario 2: Content Preview Truncation**
1. Launch app
2. Select `test/data/long-document.txt` (>1000 chars)
3. Verify preview shows first 1000 characters
4. Verify "... (preview truncated)" indicator appears

**Scenario 3: Batch Queue Management**
1. Launch app
2. Drag 3 files simultaneously: `sample.docx`, `sample.pdf`, `sample.csv`
3. Verify all 3 appear in queue list
4. Click on each file - verify metadata/preview updates
5. Remove middle file - verify queue adjusts
6. Launch batch process - verify sequential processing with progress indicators

**Scenario 4: Error Handling**
1. Launch app
2. Drag unsupported file (e.g., `.zip`)
3. Verify clear error message: "File type not supported. Accepted formats: DOCX, PDF, XLSX, CSV, TXT"
4. Drag corrupted PDF
5. Verify graceful error: "Cannot read file. File may be corrupted or password-protected."

### 4. Agent Context Update

Run `.specify/scripts/bash/update-agent-context.sh claude` to add to `.claude.md`:
- New IPC contracts: `file:getMetadata`, `file:getPreview`
- New utility modules: `metadataExtractor.js`, `contentPreview.js`, `batchQueue.js`
- Updated UI components: metadata panel, preview panel, batch queue list

---

## Post-Design Constitution Re-Check

### Test-First Development ✅ PASS

- **Evidence**: Phase 1 generated test scenarios in quickstart.md
- **Action Required**: tasks.md must include test tasks BEFORE implementation tasks
- **Validation**: T00X Create test files → T0(X+1) Implement functionality

### Security Hardening ✅ PASS

- **Evidence**: IPC contracts include input validation (filePath must be absolute)
- **Action Required**: Implement path normalization in main.js handlers before fs operations
- **Validation**: Test with malicious paths (../, /etc/passwd) must fail safely

**Final Gate Status**: ✅ **PASS** - Ready for task generation and implementation
