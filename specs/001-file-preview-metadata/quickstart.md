# Quickstart: File Preview and Metadata Display

**Feature**: File Preview and Metadata Display
**Date**: 2025-11-09
**Purpose**: Manual test scenarios for validating feature implementation

---

## Prerequisites

1. Application built with TypeScript + Tailwind CSS
2. Test data files available in `test/data/`:
   - `sample.txt` (~1KB plain text)
   - `sample.docx` (~10KB Word document)
   - `sample.pdf` (~50KB PDF)
   - `sample.csv` (~5KB CSV)
   - `long-document.txt` (>1000 characters, for truncation testing)
3. Application running: `npm run dev`

---

## Test Scenario 1: Single File Metadata Display

**User Story**: US3 - File Metadata Display (Priority P1)

**Objective**: Verify that all metadata fields display correctly for a selected file.

### Steps

1. Launch the application (`npm run dev`)
2. Drag `test/data/sample.docx` onto the drop zone
3. Observe the metadata panel

### Expected Results

✅ **Filename** displayed prominently at top: `sample.docx`
✅ **File Size** shown in human-readable format: `10 KB` (or similar)
✅ **Last Modified** date in readable format: `November 9, 2025` or `2025-11-09`
✅ **Line Count** displayed: > 0
✅ **Word Count** displayed: > 0
✅ All metadata appears within **2 seconds** (per SC-003)

### Validation

- Verify filename matches actual file
- Check last modified date against file system (right-click → Get Info on macOS)
- Open file manually and count lines/words to validate (spot check)
- If metadata takes > 2s, loading indicator MUST be shown (per FR-013)

---

## Test Scenario 2: Content Preview Truncation

**User Story**: US4 - File Content Preview (Priority P2)

**Objective**: Verify preview shows first 20 lines OR 1000 characters and indicates truncation.

### Steps

1. Launch application
2. Select `test/data/long-document.txt` (file with >20 lines and >1000 chars)
3. Observe preview panel

### Expected Results

✅ Preview shows **first 20 lines OR first 1000 characters** (whichever comes first)
✅ **Truncation indicator** visible: `"... (preview truncated)"` or similar
✅ Preview renders within **3 seconds** (per SC-004)
✅ Preview uses monospace font for readability
✅ Preview panel has scroll if content doesn't fit vertically

### Validation

- Count visible lines (should be ≤ 20)
- Count visible characters (should be ≤ 1000)
- Verify truncation message appears
- Open file manually to confirm more content exists beyond preview

---

## Test Scenario 3: Batch Queue Management

**User Story**: US6 - Batch File Processing Queue (Priority P2)

**Objective**: Verify multiple files can be added to queue, previewed, and removed individually.

### Steps

1. Launch application
2. Drag 3 files simultaneously:
   - `sample.docx`
   - `sample.pdf`
   - `sample.csv`
3. Verify all 3 appear in batch queue list
4. Click on `sample.pdf` in the queue
5. Observe metadata/preview updates to show PDF info
6. Click remove button (X icon) next to `sample.pdf`
7. Verify `sample.pdf` removed, other 2 files remain

### Expected Results

✅ All 3 files added to queue within **10 seconds** (per SC-009)
✅ Queue shows filename for each file
✅ Click on queue item highlights it (visual feedback)
✅ Metadata/preview updates when clicking different files
✅ Remove button removes only selected file
✅ Queue count updates correctly (3 → 2 after removal)
✅ Empty queue message appears when last file removed

### Validation

- Verify queue interface clearly shows all pending files (SC-010)
- Confirm user can remove files without confusion (SC-011)
- Test removing first, middle, and last file in queue
- Test removing currently selected file (metadata/preview should clear or show next file)

---

## Test Scenario 4: Error Handling

**User Story**: US1 - Drag and Drop + Error handling (Priority P1)

**Objective**: Verify clear, user-friendly error messages for unsupported files and read failures.

### Steps

#### Part A: Unsupported File Type

1. Drag an unsupported file (e.g., `image.png`, `archive.zip`) onto drop zone
2. Observe error message

**Expected**:
✅ Error message appears: `"File type not supported. Accepted formats: DOCX, PDF, XLSX, CSV, TXT"`
✅ File NOT added to queue
✅ User can continue selecting other files

#### Part B: Non-Existent File

1. Programmatically call `window.electronAPI.getFileMetadata('/nonexistent/file.docx')`
2. Observe error

**Expected**:
✅ Error message: `"Cannot read file file.docx: File not found"`
✅ Error code: `FILE_NOT_FOUND`
✅ Full path NOT exposed in user-facing message

#### Part C: Corrupted File

1. Create a corrupted PDF (manually edit binary file to corrupt)
2. Drag corrupted PDF onto drop zone
3. Attempt to extract metadata

**Expected**:
✅ Graceful error: `"Cannot read file sample.pdf: File may be corrupted or password-protected"`
✅ Application does not crash
✅ User can continue working with other files

### Validation

- Error messages are clear and guide user to corrective action (SC-007)
- File paths redacted from user-facing errors (security requirement)
- Full errors logged to browser console for debugging

---

## Test Scenario 5: Drag-and-Drop Visual Feedback

**User Story**: US1 - Drag and Drop (Priority P1)

**Objective**: Verify visual feedback during drag-and-drop operations.

### Steps

1. Drag a file (`sample.txt`) from desktop over application window
2. Hold file over drop zone (don't drop yet)
3. Observe visual changes
4. Move file outside drop zone (still dragging)
5. Observe visual changes
6. Drop file onto drop zone
7. Observe completion feedback

### Expected Results

✅ **Hover State**: Drop zone changes color/border when file dragged over (FR-012)
✅ **Active Indicator**: Clear visual showing "drop here" zone (SC-008)
✅ **Leave State**: Drop zone returns to normal when file dragged away
✅ **Success Feedback**: File appears in queue OR metadata panel after drop
✅ Entire flow completes within **3 seconds** (SC-001)

### Validation

- Drop zone is visually distinct (SC-008)
- Users understand where to drop without instruction
- Visual feedback matches common drag-drop patterns (macOS/Windows standards)

---

## Test Scenario 6: Batch Processing with Progress

**User Story**: US6 - Batch Processing (Priority P2)

**Objective**: Verify sequential processing with progress indicators.

### Setup

Create 5 small test files for quick processing:
- `doc1.txt`, `doc2.txt`, `doc3.txt`, `doc4.txt`, `doc5.txt`

### Steps

1. Drag all 5 files into queue
2. Click "Launch Batch Process" button
3. Observe progress indicators
4. Wait for completion

### Expected Results

✅ **Current File Indicator**: Shows `"Processing file 1 of 5"`, then `"Processing file 2 of 5"`, etc.
✅ **Progress Bars**: Two progress bars visible:
   - Current file progress (0-100%)
   - Overall batch progress (0-100%)
✅ **Sequential Processing**: Files processed one at a time (not parallel)
✅ **Status Updates**: Each file status changes: `pending` → `processing` → `completed`
✅ **Final State**: All files marked `completed` when done

### Pause/Cancel Test

1. Start batch processing with 5 files
2. Click "Cancel" after 2nd file completes
3. Observe behavior

**Expected**:
✅ Processing stops after current file (3rd file) completes
✅ Files 4-5 remain in queue with `pending` status
✅ User can resume processing or remove files

### Validation

- Progress visible with file number and overall % (SC-012)
- Cancel stops gracefully (doesn't interrupt current file)
- Queue state preserved after cancel

---

## Test Scenario 7: Process Control Actions

**User Story**: US5 - Process Control Actions (Priority P1)

**Objective**: Verify Launch, Cancel, and Update File buttons work correctly.

### Steps

1. Drag `sample.docx` onto drop zone
2. Verify **Launch Process** button is enabled
3. Click **Cancel** button
4. Verify application returns to initial state
5. Drag `sample.pdf` onto drop zone
6. Click **Update File** button
7. Select `sample.csv` from file browser
8. Verify metadata refreshes to show CSV info

### Expected Results

✅ **Launch Process**: Enabled when file selected, initiates anonymization
✅ **Cancel**: Clears file selection, returns to empty drop zone
✅ **Update File**: Opens file browser, replaces current file on selection
✅ **Button States**: Launch disabled when no file selected (FR-016)
✅ All buttons discoverable and clickable without confusion (SC-005)

### Validation

- Buttons have clear labels
- Disabled states visually distinct (grayed out)
- Click feedback (button press animation)
- No double-click issues (debouncing)

---

## Test Scenario 8: Multi-File Selection via Dialog

**User Story**: US2 - File Browser Dialog (Priority P2)

**Objective**: Verify file browser supports single and multi-file selection.

### Steps

#### Part A: Single File Selection

1. Click "Select File" button
2. File dialog opens with filter: "Supported Files (DOCX, PDF, XLSX, CSV, TXT)"
3. Select `sample.docx`
4. Click "Open"
5. Verify file loads into metadata panel

**Expected**:
✅ Dialog filters to supported file types only
✅ Single file selection mode (can't select multiple)
✅ Selected file loads within **10 seconds** (SC-002)

#### Part B: Multi-File Selection (Batch Mode)

1. Enable batch mode (if not default)
2. Click "Select Files" button
3. Select multiple files: `sample.docx`, `sample.pdf`, `sample.csv`
4. Click "Open"
5. Verify all files added to queue

**Expected**:
✅ Dialog allows multi-selection (Ctrl+Click or Cmd+Click)
✅ All selected files appear in batch queue
✅ Queue shows correct count (3 files)

#### Part C: Cancel Dialog

1. Click "Select File" button
2. Click "Cancel" in dialog (don't select file)
3. Verify application state unchanged

**Expected**:
✅ Dialog closes without error
✅ Previous state preserved (no crash, no empty panels)

### Validation

- Dialog filters work correctly on all platforms (macOS, Windows, Linux)
- Multi-selection enabled only when batch mode active
- Cancel action safe (no side effects)

---

## Performance Benchmarks

Use these files from `test/data/` for performance testing:

| File | Size | Expected Metadata Time | Expected Preview Time |
|------|------|----------------------|---------------------|
| `sample.txt` | 1KB | < 100ms | < 50ms |
| `sample.csv` | 5KB | < 200ms | < 100ms |
| `sample.docx` | 10KB | < 500ms | < 200ms |
| `sample.pdf` | 50KB | < 800ms | < 300ms |
| `large-document.pdf` | 10MB | < 2000ms (SC-003) | < 3000ms (SC-004) |

**How to Test**:
1. Open browser DevTools (Console)
2. Look for performance logs (if implemented)
3. Or manually time with stopwatch from file drop to metadata display

**Pass Criteria**:
- Files < 10MB: Metadata < 2s, Preview < 3s
- Loading indicators shown if > 1s (metadata) or > 2s (preview)

---

## Edge Cases

### Empty File

1. Create empty file: `touch empty.txt`
2. Drag `empty.txt` onto drop zone

**Expected**:
✅ Metadata shows: 0 lines, 0 words, 0 characters
✅ Preview shows: "(File is empty)" or similar message
✅ No crash or error

### Very Long Filename

1. Create file with 255-character filename
2. Drag onto drop zone

**Expected**:
✅ Filename displays (may be truncated with ellipsis if too long for UI)
✅ Full filename visible in tooltip or metadata detail view

### File Deleted After Selection

1. Drag `sample.txt` onto drop zone
2. Delete `sample.txt` from file system (outside app)
3. Click "Launch Process"

**Expected**:
✅ Error: "Cannot process sample.txt: File not found"
✅ File removed from queue or marked as failed
✅ User can remove failed file and continue with others

---

## Accessibility Testing

1. **Keyboard Navigation**:
   - Tab through queue items
   - Enter/Space to select file
   - Delete key to remove selected file

2. **Screen Reader**:
   - Queue items have ARIA labels: "sample.docx, 145 lines, 1823 words"
   - Buttons have descriptive labels
   - Loading states announced

3. **High Contrast Mode**:
   - Drop zone border visible
   - Selected queue item clearly highlighted
   - Button states distinguishable

---

## Clean-Up

After testing:
1. Remove test files from queue
2. Close application
3. Verify no temp files left in system temp directory
4. Check console for warnings or errors

---

## Success Criteria Checklist

Review all Success Criteria from spec.md:

- [ ] **SC-001**: Files selectable via drag-drop < 3s
- [ ] **SC-002**: Files selectable via browser < 10s
- [ ] **SC-003**: Metadata displays < 2s for < 10MB files
- [ ] **SC-004**: Preview generates < 3s for < 10MB files
- [ ] **SC-005**: Control actions discoverable and clickable
- [ ] **SC-006**: 95% file selection success on first attempt
- [ ] **SC-007**: Error messages clear and helpful
- [ ] **SC-008**: Drop zone visually distinct
- [ ] **SC-009**: 5 files added to queue < 10s
- [ ] **SC-010**: Queue interface shows all files with preview ability
- [ ] **SC-011**: Individual file removal from queue without confusion
- [ ] **SC-012**: Batch progress visible with file number and overall %

---

## Reporting Issues

If any test fails, report with:
- **Test Scenario**: Name and number
- **Expected**: What should happen
- **Actual**: What actually happened
- **Steps to Reproduce**: Exact steps taken
- **Environment**: OS, Electron version, file type
- **Screenshots**: Attach if visual issue
- **Console Logs**: Copy relevant errors from DevTools

---

## Next Steps

After manual testing passes:
1. Automated test implementation (Mocha + Chai)
2. Integration tests for IPC contracts
3. Performance profiling with larger files
4. Cross-platform testing (macOS, Windows, Linux)
