# Data Model: File Preview and Metadata Display

**Feature**: File Preview and Metadata Display
**Date**: 2025-11-09
**Purpose**: Define TypeScript interfaces and data structures for file metadata, preview, and batch queue management

---

## Entity Overview

This feature introduces four core entities:

1. **FileMetadata** - Computed information about a selected file
2. **FilePreview** - Truncated content representation for user verification
3. **BatchQueue** - Collection of files pending processing
4. **BatchProgress** - Real-time tracking information for batch operations

---

## 1. FileMetadata

**Purpose**: Stores computed metadata about a file for display to the user before processing.

### TypeScript Interface

```typescript
// src/types/fileMetadata.ts

export interface FileMetadata {
  /** Base filename without directory path (e.g., "document.docx") */
  filename: string;

  /** Absolute path to the file */
  filePath: string;

  /** File size in bytes */
  fileSize: number;

  /** Human-readable file size (e.g., "2.5 MB") */
  fileSizeFormatted: string;

  /** Last modified timestamp from file system */
  lastModified: Date;

  /** Human-readable last modified date (e.g., "November 9, 2025") */
  lastModifiedFormatted: string;

  /** Number of lines in the document (after conversion to text/markdown) */
  lineCount: number;

  /** Number of words in the document */
  wordCount: number;

  /** Total character count */
  charCount: number;

  /** File extension (e.g., ".docx", ".pdf") */
  extension: string;

  /** MIME type if detectable (e.g., "application/pdf") */
  mimeType?: string;
}
```

### Validation Rules

- **filename**: MUST NOT be empty, MUST NOT contain path separators (/, \)
- **filePath**: MUST be absolute path, MUST exist on file system
- **fileSize**: MUST be >= 0 (0 for empty files is valid)
- **lastModified**: MUST be valid Date object, not future date
- **lineCount**: MUST be >= 0 (0 for empty files is valid)
- **wordCount**: MUST be >= 0
- **charCount**: MUST be >= 0
- **extension**: MUST be one of: `.txt`, `.docx`, `.pdf`, `.xlsx`, `.xls`, `.csv`

### Lifecycle

```
Selected → Validation → Extraction (async) → Formatting → Display → Disposal
```

1. **Selected**: User drops file or selects via dialog
2. **Validation**: Check file exists, type supported, readable
3. **Extraction** (async, 200-800ms): Read file stats + extract text for counts
4. **Formatting**: Convert dates and file size to human-readable strings
5. **Display**: Render in metadata panel UI
6. **Disposal**: Garbage collected when file removed from queue or app closed

### Example Instance

```typescript
const exampleMetadata: FileMetadata = {
  filename: "customer-data.docx",
  filePath: "/Users/john/Documents/customer-data.docx",
  fileSize: 524288,
  fileSizeFormatted: "512 KB",
  lastModified: new Date("2025-11-09T14:30:00Z"),
  lastModifiedFormatted: "November 9, 2025",
  lineCount: 145,
  wordCount: 1823,
  charCount: 9847,
  extension: ".docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};
```

---

## 2. FilePreview

**Purpose**: Provides a truncated view of file content for user verification before processing.

### TypeScript Interface

```typescript
// src/types/filePreview.ts

export interface FilePreview {
  /** Preview content (first 20 lines or 1000 characters) */
  content: string;

  /** True if content was truncated (file has more content than preview shows) */
  isTruncated: boolean;

  /** Number of lines in the preview */
  previewLineCount: number;

  /** Number of characters in the preview */
  previewCharCount: number;

  /** Format type of the preview */
  formatType: PreviewFormatType;

  /** Optional error message if preview extraction failed */
  error?: string;
}

export type PreviewFormatType =
  | 'text'       // Plain text (TXT, CSV)
  | 'structured' // Formatted (DOCX, PDF, Excel with basic structure preserved)
  | 'error';     // Preview extraction failed

export interface PreviewOptions {
  /** Maximum number of lines to extract (default: 20) */
  maxLines: number;

  /** Maximum number of characters to extract (default: 1000) */
  maxChars: number;

  /** Whether to preserve basic formatting (headings, paragraphs) */
  preserveStructure: boolean;
}
```

### Constraints

- **content**: Max length 10,000 characters (hard cap to prevent UI lag)
- **previewLineCount**: <= maxLines (typically 20)
- **previewCharCount**: <= maxChars (typically 1000)
- **isTruncated**: true if original file content exceeds preview limits
- **formatType**: Cannot be 'error' unless error property is set

### Lifecycle

```
File Selected → Extraction Request → Stream Read → Truncation Check → Format → Display
```

1. **File Selected**: User clicks on file in queue
2. **Extraction Request**: IPC call to main process
3. **Stream Read**: Use readline to read first N lines efficiently
4. **Truncation Check**: Stop at 20 lines OR 1000 chars (whichever first)
5. **Format**: Add "... (preview truncated)" indicator if needed
6. **Display**: Render in preview panel with monospace font

### Example Instances

**Text File (Not Truncated)**:
```typescript
const textPreview: FilePreview = {
  content: "Line 1\nLine 2\nLine 3\n...\nLine 15",
  isTruncated: false,
  previewLineCount: 15,
  previewCharCount: 245,
  formatType: 'text'
};
```

**DOCX File (Truncated)**:
```typescript
const docxPreview: FilePreview = {
  content: "# Customer Report\n\n## Executive Summary\n\nThis document provides...",
  isTruncated: true,
  previewLineCount: 20,
  previewCharCount: 987,
  formatType: 'structured'
};
```

**Error Case**:
```typescript
const errorPreview: FilePreview = {
  content: "",
  isTruncated: false,
  previewLineCount: 0,
  previewCharCount: 0,
  formatType: 'error',
  error: "File is corrupted or password-protected"
};
```

---

## 3. BatchQueue

**Purpose**: Manages a collection of files pending batch processing with metadata and preview caching.

### TypeScript Interface

```typescript
// src/types/batchQueue.ts

export interface QueuedFile {
  /** Unique identifier for this queued file (generated on add) */
  id: string;

  /** Absolute path to the file */
  filePath: string;

  /** Base filename for display */
  filename: string;

  /** Cached metadata (null until explicitly loaded) */
  metadata: FileMetadata | null;

  /** Cached preview (null until explicitly loaded) */
  preview: FilePreview | null;

  /** Current processing status */
  status: FileProcessingStatus;

  /** Timestamp when file was added to queue */
  addedAt: Date;

  /** Optional error message if processing failed */
  error?: string;
}

export type FileProcessingStatus =
  | 'pending'     // Not yet processed
  | 'processing'  // Currently being anonymized
  | 'completed'   // Successfully processed
  | 'failed';     // Processing error occurred

export interface BatchQueueState {
  /** Array of queued files */
  files: QueuedFile[];

  /** Index of currently selected file for preview (null if none selected) */
  selectedIndex: number | null;

  /** Overall queue status */
  status: QueueStatus;

  /** Index of file currently being processed (null if idle) */
  currentProcessingIndex: number | null;
}

export type QueueStatus =
  | 'idle'        // Queue not processing
  | 'processing'  // Actively processing files
  | 'paused'      // Processing paused by user
  | 'completed';  // All files processed (successfully or with errors)
```

### Operations

**Core Operations**:
```typescript
interface BatchQueueOperations {
  /** Add a new file to the queue */
  addFile(filePath: string, filename: string): string; // Returns generated ID

  /** Remove a file from the queue by ID */
  removeFile(id: string): void;

  /** Clear all files from the queue */
  clear(): void;

  /** Load metadata for a specific file (cached if already loaded) */
  loadMetadata(id: string): Promise<FileMetadata>;

  /** Load preview for a specific file (cached if already loaded) */
  loadPreview(id: string): Promise<FilePreview>;

  /** Select a file for metadata/preview display */
  selectFile(id: string): void;

  /** Start processing all pending files */
  startProcessing(): void;

  /** Pause processing (finishes current file, then stops) */
  pause(): void;

  /** Resume processing from where it was paused */
  resume(): void;

  /** Get current batch progress */
  getProgress(): BatchProgress;
}
```

### Validation Rules

- **Maximum queue size**: 50 files (soft limit, warning shown if exceeded)
- **Duplicate files**: Same filePath can be added multiple times (user responsibility)
- **File availability**: Files must exist at time of processing (not validated on add)
- **ID uniqueness**: Generated IDs must be unique within queue (use UUID or timestamp-based)

### Lifecycle

```
Empty → Files Added → Selection/Preview → Processing Started → Sequential Processing → Completed
```

### Example State

```typescript
const queueState: BatchQueueState = {
  files: [
    {
      id: "f1a2b3c4",
      filePath: "/Users/john/doc1.docx",
      filename: "doc1.docx",
      metadata: { /* cached FileMetadata */ },
      preview: null, // Not yet loaded
      status: "completed",
      addedAt: new Date("2025-11-09T10:00:00Z")
    },
    {
      id: "d5e6f7g8",
      filePath: "/Users/john/doc2.pdf",
      filename: "doc2.pdf",
      metadata: null,
      preview: null,
      status: "processing",
      addedAt: new Date("2025-11-09T10:01:00Z")
    },
    {
      id: "h9i0j1k2",
      filePath: "/Users/john/doc3.csv",
      filename: "doc3.csv",
      metadata: null,
      preview: null,
      status: "pending",
      addedAt: new Date("2025-11-09T10:02:00Z")
    }
  ],
  selectedIndex: 1, // doc2.pdf selected for preview
  status: "processing",
  currentProcessingIndex: 1
};
```

---

## 4. BatchProgress

**Purpose**: Real-time tracking information for batch processing operations.

### TypeScript Interface

```typescript
// src/types/batchQueue.ts (continued)

export interface BatchProgress {
  /** Current file number being processed (1-indexed for UI display) */
  currentFileNumber: number;

  /** Total number of files in the batch */
  totalFiles: number;

  /** Current file processing progress (0-100) */
  currentFileProgress: number;

  /** Overall batch progress (0-100) */
  overallProgress: number;

  /** Estimated time remaining in seconds (null if unknown) */
  estimatedTimeRemaining: number | null;

  /** Number of successfully processed files */
  completedCount: number;

  /** Number of failed files */
  failedCount: number;

  /** Number of pending files */
  pendingCount: number;
}
```

### Computed Properties

**overallProgress** calculation:
```typescript
overallProgress = ((completedCount + (currentFileProgress / 100)) / totalFiles) * 100
```

**estimatedTimeRemaining** calculation (optional):
```typescript
// Based on average time per file so far
const avgTimePerFile = elapsedTime / completedCount;
estimatedTimeRemaining = avgTimePerFile * pendingCount;
```

### Display Format

**UI Strings**:
- Primary: `"Processing file 2 of 5"` (`currentFileNumber` of `totalFiles`)
- Detail: `"3 completed, 1 failed, 1 pending"` (counts)
- Progress bars: Current file (0-100%) + Overall batch (0-100%)

### Example Instance

```typescript
const progress: BatchProgress = {
  currentFileNumber: 2,
  totalFiles: 5,
  currentFileProgress: 65,
  overallProgress: 33, // (1 + 0.65) / 5 * 100 = 33%
  estimatedTimeRemaining: 180, // 3 minutes
  completedCount: 1,
  failedCount: 0,
  pendingCount: 3
};
```

---

## Entity Relationships

```
┌─────────────────┐
│  BatchQueue     │
│  - files[]      │
└────────┬────────┘
         │
         │ contains 1..*
         ▼
┌─────────────────┐      has 0..1      ┌─────────────────┐
│  QueuedFile     │────────────────────▶│  FileMetadata   │
│  - id           │                     │  (cached)       │
│  - filePath     │      has 0..1      └─────────────────┘
│  - status       │────────────────────▶┌─────────────────┐
└─────────────────┘                     │  FilePreview    │
                                        │  (cached)       │
                                        └─────────────────┘

┌─────────────────┐      computed from  ┌─────────────────┐
│  BatchProgress  │◀────────────────────│  BatchQueue     │
│  - currentFile  │                     │  - files[]      │
│  - overallProg  │                     │  - status       │
└─────────────────┘                     └─────────────────┘
```

---

## Data Flow

### Metadata Extraction Flow

```
User selects file
      ↓
Add to queue (QueuedFile created, metadata = null)
      ↓
User clicks file in queue
      ↓
Check if metadata cached? ──Yes──▶ Display cached metadata
      ↓ No
IPC: file:getMetadata(filePath)
      ↓
Main process: Extract stats + text analysis
      ↓
Return FileMetadata object
      ↓
Cache in QueuedFile.metadata
      ↓
Display in metadata panel
```

### Batch Processing Flow

```
User clicks "Launch Batch Process"
      ↓
Set queue.status = 'processing'
      ↓
For each file in queue (sequential):
      ↓
Set file.status = 'processing'
      ↓
Call existing anonymization workflow
      ↓
Update currentFileProgress (0-100%)
      ↓
On completion: file.status = 'completed' or 'failed'
      ↓
Update BatchProgress (compute overall%)
      ↓
Display progress bars
      ↓
Next file
      ↓
All files processed
      ↓
Set queue.status = 'completed'
```

---

## Storage & Persistence

**Storage Strategy**: **In-Memory Only** (No persistence)

**Rationale**:
- Desktop app with single-user sessions
- Queue is transient - user can re-select files if app closes
- Metadata/preview cache is small (~1KB per file × 50 files = ~50KB)
- No database or localStorage needed
- Simplifies implementation and avoids stale data issues

**Lifecycle**:
- **Created**: When user adds files to queue
- **Exists**: In renderer process memory during app session
- **Destroyed**: When user clears queue, removes files, or closes app
- **Not persisted**: No saving to disk, no recovery after app restart

---

## Type Definitions Summary

All interfaces defined above will be exported from:

```
src/types/
├── fileMetadata.ts    - FileMetadata interface
├── filePreview.ts     - FilePreview, PreviewOptions, PreviewFormatType
├── batchQueue.ts      - QueuedFile, BatchQueueState, BatchProgress, FileProcessingStatus, QueueStatus
└── ipc.ts             - IPC contract types (see contracts/ for details)
```

These types will be used across:
- **Renderer process** (renderer.ts): UI logic, state management
- **Main process** (main.ts): IPC handlers, file operations
- **Utility modules** (src/utils/): Metadata extraction, preview generation
- **Tests** (test/**/*.test.ts): Type-safe test fixtures and assertions

---

## Validation & Error Handling

### Validation Strategy

**Client-side (Renderer)**:
- File extension check before adding to queue
- File existence check (via fs.access) before metadata extraction
- Queue size warning if > 50 files

**Server-side (Main Process)**:
- Path normalization and validation (prevent directory traversal)
- File read permission check
- File size check (warn if > 100MB, reject if > 1GB)
- MIME type validation against whitelist

### Error Types

```typescript
export type FileOperationError =
  | 'FILE_NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'UNSUPPORTED_TYPE'
  | 'FILE_TOO_LARGE'
  | 'CORRUPTED_FILE'
  | 'READ_ERROR'
  | 'UNKNOWN_ERROR';

export interface FileError {
  code: FileOperationError;
  message: string;
  filePath: string;
  timestamp: Date;
}
```

---

## Performance Considerations

**Metadata Extraction**:
- **Target**: < 2s for files < 10MB
- **Bottleneck**: Text extraction from DOCX/PDF
- **Mitigation**: Use streaming, cache results, show loading indicator

**Preview Generation**:
- **Target**: < 3s for files < 10MB
- **Bottleneck**: File I/O for large files
- **Mitigation**: Stop at 20 lines / 1000 chars, use readline streaming

**Batch Queue**:
- **Target**: 50-file UI render < 100ms
- **Bottleneck**: DOM manipulation for large lists
- **Mitigation**: Virtual scrolling if needed, but 50 items manageable without

**Memory**:
- **Metadata**: ~1KB per file
- **Preview**: ~1KB per file (truncated)
- **Total for 50 files**: ~100KB (negligible)

---

## Next Steps

1. Implement TypeScript interfaces in `src/types/`
2. Create utility modules in `src/utils/` using these types
3. Define IPC contracts (see `contracts/` directory)
4. Implement BatchQueue class with type-safe methods
5. Add validation logic following rules defined above
6. Create test fixtures using example instances from this document
