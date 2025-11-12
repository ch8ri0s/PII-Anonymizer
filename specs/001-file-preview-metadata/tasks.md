# Tasks: File Preview and Metadata Display

**Feature Branch**: `001-file-preview-metadata`
**Created**: 2025-11-09
**Input**: Design documents from `/specs/001-file-preview-metadata/`
**Prerequisites**: spec.md (user stories defined)

**Project Type**: Electron Desktop Application (JavaScript, HTML, CSS)
**Testing Framework**: Mocha + Chai
**Tests**: Not explicitly requested in spec - focus on implementation only

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Root files**: `index.html`, `renderer.js`, `main.js`, `styles.css`, `preload.js`
- **Source**: `src/` (converters, PII detection)
- **Tests**: `test/` (if tests were requested - not in scope)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for preview/metadata feature

- [ ] T001 Review existing file selection implementation in renderer.js to understand current selectedFiles array structure
- [ ] T002 Review existing drag-and-drop handlers in renderer.js (lines 63-76) for integration points
- [ ] T003 Review existing file processing workflow in fileProcessor.js to understand where preview/metadata extraction fits

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create metadata extraction utility module at src/utils/metadataExtractor.js with functions for file stats (size, modified date)
- [ ] T005 [P] Create text statistics utility module at src/utils/textStats.js with functions for line count and word count calculation
- [ ] T006 [P] Create content preview utility module at src/utils/contentPreview.js with function to extract first 20 lines or 1000 characters
- [ ] T007 Add IPC handlers in main.js for file metadata extraction (getFileMetadata) using Node.js fs.stat
- [ ] T008 [P] Add IPC handlers in main.js for content preview extraction (getFilePreview) with 20 lines / 1000 char limit
- [ ] T009 [P] Expose new IPC APIs in preload.js via contextBridge for metadata and preview functions
- [ ] T010 Add CSS styles in styles.css for preview panel, metadata display grid, and file info cards

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - File Selection with Drag and Drop (Priority: P1) 🎯 MVP

**Goal**: Enable drag-and-drop file selection with visual feedback

**Independent Test**: Drag a DOCX file onto the app window, verify drop zone highlights on hover and file is accepted

### Implementation for User Story 1

- [ ] T011 [US1] Update drop zone styling in index.html to add visual hover state indicators (border highlight, background color change)
- [ ] T012 [US1] Enhance dragover event handler in renderer.js to add CSS class for active drop zone visual feedback
- [ ] T013 [US1] Enhance dragleave event handler in renderer.js to remove active CSS class and restore default styling
- [ ] T014 [US1] Add file type validation in handleInputItems function in renderer.js to check for supported extensions (.docx, .pdf, .xlsx, .csv, .txt)
- [ ] T015 [US1] Add error message display for unsupported file types using showStatus function in renderer.js
- [ ] T016 [US1] Implement multiple file handling logic in handleInputItems to accept all files when multiple are dropped (prepare for batch queue)

**Checkpoint**: User Story 1 complete - drag-and-drop works with visual feedback and validation

---

## Phase 4: User Story 2 - File Selection with Browser Dialog (Priority: P2)

**Goal**: Provide file browser button as alternative selection method

**Independent Test**: Click file selection button, choose a PDF from dialog, verify it loads

### Implementation for User Story 2

- [ ] T017 [US2] Verify file-input element in index.html has correct accept attribute for supported file types
- [ ] T018 [US2] Ensure file-input change event handler in renderer.js properly calls handleInputItems for dialog-selected files
- [ ] T019 [US2] Add proper file dialog filter configuration in main.js if using custom dialog (or rely on HTML accept attribute)
- [ ] T020 [US2] Ensure single-file vs multi-file selection is handled based on file-input multiple attribute
- [ ] T021 [US2] Test and ensure cancel action on file dialog returns to previous state without errors

**Checkpoint**: User Story 2 complete - file browser dialog works alongside drag-and-drop

---

## Phase 5: User Story 3 - File Metadata Display (Priority: P1)

**Goal**: Display filename, last modified date, line count, and word count for selected file

**Independent Test**: Select any file, verify all 4 metadata fields display accurately within 2 seconds

### Implementation for User Story 3

- [ ] T022 [P] [US3] Create metadata display UI section in index.html with divs for filename, last-modified, line-count, word-count
- [ ] T023 [P] [US3] Add metadata panel CSS styling in styles.css with grid layout for clean 2x2 or 4x1 metadata display
- [ ] T024 [US3] Implement async getFileMetadata function in renderer.js that calls IPC to get file stats (size, modified timestamp)
- [ ] T025 [US3] Implement async calculateTextStats function in renderer.js that calls IPC to get line count and word count from file content
- [ ] T026 [US3] Add date formatting function in renderer.js to convert timestamp to human-readable format (e.g., "November 9, 2025")
- [ ] T027 [US3] Update handleInputItems or create displayFileMetadata function in renderer.js to populate metadata UI when file is selected
- [ ] T028 [US3] Add loading spinner/indicator in metadata section for files taking >1 second to process
- [ ] T029 [US3] Handle metadata extraction errors gracefully with user-friendly messages in metadata panel

**Checkpoint**: User Story 3 complete - metadata displays for selected files

---

## Phase 6: User Story 4 - File Content Preview (Priority: P2)

**Goal**: Show first 20 lines or 1000 characters of file content

**Independent Test**: Select a TXT file, verify preview shows first portion with truncation indicator if applicable

### Implementation for User Story 4

- [ ] T030 [P] [US4] Create content preview UI section in index.html with scrollable text area or div for preview content
- [ ] T031 [P] [US4] Add preview panel CSS styling in styles.css with monospace font, max-height, scroll, and border
- [ ] T032 [US4] Implement async getFilePreview function in renderer.js that calls IPC to extract first 20 lines or 1000 chars
- [ ] T033 [US4] Add truncation indicator logic in renderer.js to display "... (preview truncated)" when content exceeds limit
- [ ] T034 [US4] Integrate preview generation into displayFileMetadata flow in renderer.js so preview loads with metadata
- [ ] T035 [US4] Add loading indicator in preview section for files taking >2 seconds to generate preview
- [ ] T036 [US4] Handle preview errors (corrupted files, read failures) with error message in preview panel
- [ ] T037 [US4] Add basic structure preservation for DOCX/PDF previews (headings, paragraphs visible in plain text)

**Checkpoint**: User Story 4 complete - content preview displays for selected files

---

## Phase 7: User Story 5 - Process Control Actions (Priority: P1)

**Goal**: Provide Launch, Cancel, and Update File buttons

**Independent Test**: Select file, verify all three buttons work - Launch starts processing, Cancel clears, Update allows reselect

### Implementation for User Story 5

- [ ] T038 [P] [US5] Add "Launch Process" button to index.html or ensure existing process-button is visible when file selected
- [ ] T039 [P] [US5] Add "Cancel" button to index.html for clearing current file selection
- [ ] T040 [P] [US5] Add "Update File" or "Change File" button to index.html for replacing current selection
- [ ] T041 [US5] Implement Launch Process button click handler in renderer.js that calls existing processFiles workflow
- [ ] T042 [US5] Implement Cancel button click handler in renderer.js that calls clearState and resets UI to initial file selection screen
- [ ] T043 [US5] Implement Update File button handler in renderer.js that clears current selection and re-enables drop zone / file browser
- [ ] T044 [US5] Add button state management in renderer.js - disable Launch when no file selected, enable when valid file loaded
- [ ] T045 [US5] Update updateProcessButton function in renderer.js to handle new button states based on file selection
- [ ] T046 [US5] Ensure metadata and preview refresh when Update File loads a new file selection

**Checkpoint**: User Story 5 complete - all process controls functional

---

## Phase 8: User Story 6 - Batch File Processing Queue (Priority: P2)

**Goal**: Support multiple file selection with queue UI and batch processing

**Independent Test**: Drag 3 files, verify queue shows all files, can preview each, remove individual files, and process as batch

### Implementation for User Story 6

- [ ] T047 [P] [US6] Create batch queue UI section in index.html with list container for queued files
- [ ] T048 [P] [US6] Add batch queue CSS styling in styles.css with file list items, remove buttons, and selected file highlight
- [ ] T049 [US6] Create batch queue data structure in renderer.js (array of file objects with metadata, path, status)
- [ ] T050 [US6] Implement addToQueue function in renderer.js that adds files to queue and updates queue UI
- [ ] T051 [US6] Implement removeFromQueue function in renderer.js that removes individual files by index or ID
- [ ] T052 [US6] Update handleInputItems function in renderer.js to add all dropped/selected files to batch queue
- [ ] T053 [US6] Implement queue item click handler in renderer.js to display clicked file's metadata and preview
- [ ] T054 [US6] Add remove button (X icon) to each queue item with click handler calling removeFromQueue
- [ ] T055 [US6] Implement "Add More Files" functionality that allows dragging additional files to existing queue
- [ ] T056 [US6] Update Launch Process to handle batch mode - process all files in queue sequentially
- [ ] T057 [US6] Add batch progress UI elements in index.html showing "Processing 2 of 5" with overall progress bar
- [ ] T058 [US6] Implement batch progress tracking in renderer.js updating UI during sequential file processing
- [ ] T059 [US6] Add cancel batch operation handler that stops after current file and keeps unprocessed files in queue
- [ ] T060 [US6] Display empty queue message ("No files selected. Drag files here to add to batch.") when queue is empty

**Checkpoint**: User Story 6 complete - batch processing works end-to-end

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T061 [P] Add comprehensive error handling across all file operations with user-friendly error messages
- [ ] T062 [P] Implement edge case handling: files deleted after selection, permission errors, empty files
- [ ] T063 [P] Add accessibility improvements: keyboard navigation, ARIA labels, focus management
- [ ] T064 [P] Optimize metadata/preview extraction performance for large files (lazy loading, debouncing)
- [ ] T065 [P] Add file size validation with warnings for very large files (>100MB)
- [ ] T066 Add visual polish: animations for drag-drop feedback, smooth transitions, loading states
- [ ] T067 [P] Update existing documentation in README.md with new preview/metadata/batch features
- [ ] T068 Manual testing across all user stories with various file types (DOCX, PDF, Excel, CSV, TXT)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-8)**: All depend on Foundational phase completion
  - US1 (Drag & Drop) → Can start after Foundational
  - US2 (File Browser) → Can start after Foundational, independent of US1
  - US3 (Metadata Display) → Can start after Foundational, independent of US1/US2
  - US4 (Content Preview) → Can start after Foundational, independent of US1/US2/US3
  - US5 (Process Controls) → Depends on US1 OR US2 (need file selection first), can proceed independently
  - US6 (Batch Queue) → Depends on US1, US3, US4, US5 (builds on single-file workflow)
- **Polish (Phase 9)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1 (alternative selection method)
- **User Story 3 (P1)**: Can start after Foundational (Phase 2) - Independent of US1/US2
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Independent of US1/US2/US3
- **User Story 5 (P1)**: Requires US1 OR US2 complete (need file selection first)
- **User Story 6 (P2)**: Requires US1, US3, US4, US5 complete (extends single-file with batch)

### Within Each User Story

- Tasks marked [P] can run in parallel (different files, no dependencies)
- Tasks without [P] must run sequentially within that story
- UI tasks (HTML) before styling (CSS) before logic (JS) is recommended but not strictly required

### Parallel Opportunities

- All Setup tasks (T001-T003) can run in parallel
- Phase 2 Foundational: T005-T006 parallel, T008-T010 parallel
- US3: T022-T023 parallel
- US4: T030-T031 parallel
- US5: T038-T040 parallel
- US6: T047-T048 parallel, T061-T065 parallel in Polish phase

---

## Parallel Example: User Story 3 (Metadata Display)

```bash
# Launch UI and styling tasks together:
Task T022: "Create metadata display UI section in index.html"
Task T023: "Add metadata panel CSS styling in styles.css"

# Then implement logic tasks sequentially:
Task T024 → T025 → T026 → T027 → T028 → T029
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 3 + 5 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T010) - CRITICAL BLOCKER
3. Complete Phase 3: User Story 1 - Drag & Drop (T011-T016)
4. Complete Phase 5: User Story 3 - Metadata Display (T022-T029)
5. Complete Phase 7: User Story 5 - Process Controls (T038-T046)
6. **STOP and VALIDATE**: Test single-file workflow end-to-end
7. Deploy/demo if ready - **This is a functional MVP!**

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add US1 (Drag/Drop) → Test independently → Functional drop zone ✅
3. Add US3 (Metadata) → Test independently → See file info before processing ✅
4. Add US5 (Controls) → Test independently → **MVP complete** 🎯
5. Add US2 (File Browser) → Test independently → Alternative selection method ✅
6. Add US4 (Preview) → Test independently → Content verification ✅
7. Add US6 (Batch Queue) → Test independently → **Full feature complete** 🎉

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (T001-T010)
2. Once Foundational is done:
   - Developer A: User Story 1 (Drag & Drop)
   - Developer B: User Story 3 (Metadata Display)
   - Developer C: User Story 4 (Content Preview)
3. Then:
   - Developer A: User Story 5 (Process Controls) - requires US1
   - Developer B: User Story 2 (File Browser) - independent
4. Finally:
   - Developer A or B: User Story 6 (Batch Queue) - requires US1/3/4/5

---

## Notes

- [P] tasks = different files, no dependencies - can run in parallel
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable after Foundational phase
- No tests included in this task list (not requested in spec)
- Constitution principle: Test-First is NON-NEGOTIABLE, but user did not request tests in spec
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

**Total Tasks**: 68 tasks across 6 user stories + setup/foundational/polish
**MVP Scope**: US1 + US3 + US5 (approximately 26 tasks)
**Full Feature**: All 6 user stories (68 tasks)
