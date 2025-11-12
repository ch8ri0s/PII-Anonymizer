# Feature Specification: File Preview and Metadata Display

**Feature Branch**: `001-file-preview-metadata`
**Created**: 2025-11-09
**Status**: Draft
**Input**: User description: "allow drag and drop or single file selecting. Upon confirmation, file preview and metadata information (file name, last saved, number of lines, words) shall be visible. User will be able to launch process, cancel or update file."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - File Selection with Drag and Drop (Priority: P1)

As a user, I want to drag and drop a document file onto the application window so that I can quickly select files for anonymization without navigating through file system dialogs.

**Why this priority**: Drag and drop is the most intuitive and efficient method for file selection in modern desktop applications. This is the primary entry point for the feature and provides the best user experience.

**Independent Test**: Can be fully tested by dragging a supported file (DOCX, PDF, Excel, CSV, TXT) onto the application window and verifying the file is recognized and loaded into the preview area.

**Acceptance Scenarios**:

1. **Given** the application is open, **When** I drag a supported file (DOCX, PDF, Excel, CSV, or TXT) over the application window, **Then** a visual indicator shows the drop zone is active
2. **Given** a file is being dragged over the application, **When** I drop the file onto the application window, **Then** the file is loaded and the preview/metadata screen is displayed
3. **Given** I am dragging a file, **When** I drop an unsupported file type (e.g., .zip, .exe), **Then** an error message indicates the file type is not supported
4. **Given** the application is open, **When** I drag multiple files simultaneously, **Then** all files are accepted and queued for batch processing with a queue interface showing all pending files

---

### User Story 2 - File Selection with Browser Dialog (Priority: P2)

As a user, I want to click a "Select File" button to browse my file system so that I have an alternative method to select files when drag and drop is not convenient.

**Why this priority**: Provides essential accessibility and serves as a fallback for users who prefer traditional file selection or cannot use drag and drop (accessibility considerations, trackpad users, etc.).

**Independent Test**: Can be fully tested by clicking the file selection button, choosing a file from the system dialog, and verifying the file loads into the preview area with metadata displayed.

**Acceptance Scenarios**:

1. **Given** the application is open, **When** I click the "Select File" or similar button, **Then** a system file browser dialog opens filtered to supported file types
2. **Given** the file browser is open, **When** I select a supported file and confirm, **Then** the file is loaded and the preview/metadata screen is displayed
3. **Given** the file browser is open, **When** I cancel the dialog, **Then** the application returns to the previous state without changes
4. **Given** the file browser is open, **When** I attempt to select multiple files, **Then** only single-file selection is permitted

---

### User Story 3 - File Metadata Display (Priority: P1)

As a user, I want to see key metadata about my selected file (filename, last modified date, line count, word count) so that I can verify I've selected the correct document before processing.

**Why this priority**: Critical for user confidence and error prevention. Users need to verify file selection before committing to the anonymization process, especially given the potentially sensitive nature of the documents.

**Independent Test**: Can be fully tested by selecting any supported file and verifying all metadata fields (filename, last saved date, line count, word count) are accurately displayed and formatted in a readable manner.

**Acceptance Scenarios**:

1. **Given** a file has been selected, **When** the preview screen loads, **Then** the filename is displayed prominently at the top
2. **Given** a file has been selected, **When** the preview screen loads, **Then** the last modified/saved date is displayed in human-readable format (e.g., "November 9, 2025" or "2025-11-09")
3. **Given** a file has been selected, **When** the preview screen loads, **Then** the number of lines in the document is calculated and displayed
4. **Given** a file has been selected, **When** the preview screen loads, **Then** the word count is calculated and displayed
5. **Given** a large file is selected, **When** metadata calculation takes more than 1 second, **Then** a loading indicator is shown during calculation

---

### User Story 4 - File Content Preview (Priority: P2)

As a user, I want to see a preview of my file's content so that I can verify the file contains the expected information before starting the anonymization process.

**Why this priority**: Enhances user confidence and reduces processing errors. Users can catch mistakes (wrong file, corrupted content) before investing time in processing.

**Independent Test**: Can be fully tested by selecting a file and verifying that a representative preview of the content is displayed (first N lines or a scrollable preview).

**Acceptance Scenarios**:

1. **Given** a file has been selected, **When** the preview screen loads, **Then** the first 20 lines or 1000 characters (whichever comes first) of the file content is displayed
2. **Given** a file preview is displayed, **When** the content exceeds the preview limit, **Then** an indicator shows "... (preview truncated)" or similar message
3. **Given** a file with formatting (DOCX, PDF), **When** the preview loads, **Then** basic structure (headings, paragraphs) is visible in plain text or simplified format
4. **Given** a file is being processed for preview, **When** preview generation takes more than 2 seconds, **Then** a loading indicator is shown

---

### User Story 5 - Process Control Actions (Priority: P1)

As a user, I want to launch the anonymization process, cancel my selection, or update to a different file so that I have full control over the workflow after file selection.

**Why this priority**: Essential workflow controls. Without these actions, users cannot proceed with their task or correct mistakes, making this a blocking requirement for usability.

**Independent Test**: Can be fully tested by selecting a file and verifying all three actions work correctly: Launch (proceeds to anonymization), Cancel (returns to initial state), Update (allows reselecting a different file).

**Acceptance Scenarios**:

1. **Given** a file is loaded with metadata displayed, **When** I click "Launch Process" or similar action button, **Then** the anonymization process begins and progress feedback is shown
2. **Given** a file is loaded with metadata displayed, **When** I click "Cancel", **Then** the file selection is cleared and the application returns to the initial file selection screen
3. **Given** a file is loaded with metadata displayed, **When** I click "Update File" or "Change File", **Then** I can select a new file (via drag-drop or browse) and the previous selection is replaced
4. **Given** a file is loaded, **When** I update to a new file, **Then** the metadata and preview refresh to show the new file's information
5. **Given** no file is selected, **When** the initial screen is displayed, **Then** only the file selection methods (drag-drop zone, browse button) are available, and process controls are disabled

---

### User Story 6 - Batch File Processing Queue (Priority: P2)

As a user, I want to select and process multiple files at once so that I can efficiently anonymize multiple documents without repeating the selection process.

**Why this priority**: Significant productivity improvement for users with multiple documents. Reduces repetitive interactions and allows bulk operations. Priority P2 because single-file workflow (P1) must work first.

**Independent Test**: Can be fully tested by dragging multiple files simultaneously, verifying they all appear in a queue interface, and confirming each can be individually previewed, removed, or processed as a batch.

**Acceptance Scenarios**:

1. **Given** the application is open, **When** I drag 3 files simultaneously and drop them, **Then** all 3 files are added to a batch queue interface
2. **Given** multiple files are in the queue, **When** I click on any file in the queue, **Then** that file's metadata and preview are displayed
3. **Given** multiple files are in the queue, **When** I click a remove/delete button next to a file, **Then** that file is removed from the queue without affecting others
4. **Given** a batch queue with files, **When** I drag additional files, **Then** the new files are added to the existing queue
5. **Given** a batch queue is populated, **When** I click "Launch Batch Process", **Then** all files are processed sequentially with progress shown for current file and overall batch (e.g., "Processing 2 of 5")
6. **Given** batch processing is in progress, **When** I cancel the operation, **Then** processing stops after the current file completes, and unprocessed files remain in the queue
7. **Given** an empty queue, **When** the queue interface is displayed, **Then** it shows a message like "No files selected. Drag files here to add to batch."

---

### Edge Cases

- What happens when a file is dragged but dropped outside the designated drop zone?
- What happens when a file is deleted or moved after selection but before processing?
- What happens when a file is too large to preview efficiently (e.g., 1GB PDF)?
- What happens when a corrupted or password-protected file is selected?
- What happens when metadata cannot be extracted (e.g., binary files misidentified as text)?
- What happens when a file has zero lines or zero words (empty file)?
- What happens when the user's system file permissions prevent reading the selected file?
- What happens if the user drags a folder instead of a file?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept file input via drag-and-drop onto the application window
- **FR-002**: System MUST accept file input via system file browser dialog triggered by a clickable button/area
- **FR-003**: System MUST validate that selected files are of supported types (DOCX, PDF, Excel, CSV, TXT)
- **FR-004**: System MUST display filename of the selected file
- **FR-005**: System MUST display last modified date of the selected file in human-readable format
- **FR-006**: System MUST calculate and display the number of lines in the selected file
- **FR-007**: System MUST calculate and display the word count in the selected file
- **FR-008**: System MUST display a preview of the file content (first N lines or characters)
- **FR-009**: System MUST provide a "Launch Process" action that initiates the anonymization workflow
- **FR-010**: System MUST provide a "Cancel" action that clears the current file selection and returns to initial state
- **FR-011**: System MUST provide an "Update File" action that allows replacing the current selection with a new file
- **FR-012**: System MUST show visual feedback during drag-and-drop operations (hover state, drop zone indication)
- **FR-013**: System MUST show loading indicators when metadata calculation or preview generation takes longer than 1 second
- **FR-014**: System MUST handle file read errors gracefully with user-friendly error messages (e.g., "Cannot read file", "File is corrupted")
- **FR-015**: System MUST reject unsupported file types with clear error messages indicating accepted formats
- **FR-016**: System MUST disable "Launch Process" action when no valid file is selected
- **FR-017**: System MUST support batch file selection and processing when multiple files are dragged simultaneously
- **FR-018**: System MUST display a queue interface showing all files pending processing when multiple files are selected
- **FR-019**: System MUST allow users to view metadata and preview for each file in the batch queue
- **FR-020**: System MUST allow users to remove individual files from the batch queue before processing
- **FR-021**: System MUST process batch files sequentially with progress indication for the current file and overall batch
- **FR-022**: System MUST allow users to add additional files to an existing batch queue

### Key Entities

- **Selected File**: Represents the document chosen by the user for processing
  - Attributes: file path, filename, file extension, file size, last modified timestamp, content (raw or extracted)
  - Lifecycle: Selected → Metadata extracted → Preview generated → Ready for processing OR Cancelled/Replaced

- **File Metadata**: Computed information about the selected file
  - Attributes: line count, word count, character count, file size in bytes/KB/MB, last modified date (formatted)
  - Derived from: Selected File content and file system properties

- **File Preview**: Truncated representation of file content for user verification
  - Attributes: preview text (first 20 lines or 1000 characters), truncation indicator (boolean), format type (plain text, structured)
  - Constraints: Limited to prevent performance issues with large files

- **Batch Queue**: Collection of files pending processing in batch mode
  - Attributes: list of Selected Files, current file index, total count, processing status (idle, processing, paused)
  - Operations: add file, remove file, clear queue, process all sequentially
  - Lifecycle: Empty → Files added → Processing → Completed/Partially completed

- **Batch Progress**: Tracking information for batch processing operations
  - Attributes: current file number, total files, current file progress (percentage), overall batch progress
  - Display format: "Processing file 2 of 5" and progress bars for current and overall

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can select a file via drag-and-drop in under 3 seconds from opening the application
- **SC-002**: Users can select a file via file browser in under 10 seconds (including dialog navigation time)
- **SC-003**: File metadata (filename, date, line count, word count) displays within 2 seconds for files under 10MB
- **SC-004**: File preview generates and displays within 3 seconds for files under 10MB
- **SC-005**: All three control actions (Launch, Cancel, Update) are discoverable and clickable without user confusion
- **SC-006**: 95% of users successfully select the correct file on first attempt (verified by metadata review)
- **SC-007**: Error messages for unsupported files or read failures are clear and guide users to corrective action
- **SC-008**: Drag-and-drop zone is visually distinct and users understand where to drop files without instruction
- **SC-009**: Users can add 5 files to a batch queue in under 10 seconds
- **SC-010**: Batch queue interface clearly shows all pending files with ability to preview each one
- **SC-011**: Users can remove individual files from batch queue without confusion
- **SC-012**: Batch processing progress is visible with current file number and overall completion percentage

## Assumptions

- File system access permissions are granted by the user's operating system (standard for Electron apps)
- Supported file types are limited to those already handled by existing converters (DOCX, PDF, Excel, CSV, TXT)
- Line count and word count calculations use existing conversion logic (already implemented in the application)
- Preview generation will reuse extraction logic from the file converters
- Last modified date is available from standard file system metadata
- Batch processing extends the current single-file architecture with queue management
- Batch files are processed sequentially (not in parallel) to avoid resource contention
- Maximum reasonable batch size is 50 files (no hard limit enforced, but UI optimized for this range)
- Users have basic familiarity with drag-and-drop interactions (standard for desktop applications)
- Default preview length: first 20 lines or 1000 characters (whichever is reached first)
