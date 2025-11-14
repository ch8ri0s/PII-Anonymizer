# IPC Contract: file:getMetadata

**Channel**: `file:getMetadata`
**Purpose**: Extract file metadata including file system stats and text statistics
**Process**: Renderer → Main → File System + Converter → Renderer

---

## Request

### Channel Name
```typescript
'file:getMetadata'
```

### Input Parameters

```typescript
{
  filePath: string  // Absolute path to the file
}
```

**Parameter Details**:
- **filePath**: MUST be absolute path, NOT relative
- **Example**: `/Users/john/Documents/report.docx`
- **Invalid**: `./report.docx`, `~/Documents/report.docx`

### Validation Rules

**Main Process MUST validate**:
1. Path is absolute (starts with `/` or drive letter on Windows)
2. Path does not contain null bytes
3. Path does not contain traversal sequences that escape allowed directories
4. File exists (fs.existsSync)
5. File is readable (fs.access with fs.constants.R_OK)
6. File extension is in whitelist: `.txt`, `.docx`, `.pdf`, `.xlsx`, `.xls`, `.csv`

---

## Response

### Success Response

```typescript
{
  filename: string;                // "report.docx"
  filePath: string;                // "/Users/john/Documents/report.docx"
  fileSize: number;                // 524288 (bytes)
  fileSizeFormatted: string;       // "512 KB"
  lastModified: string;            // ISO 8601 date string (serialized Date)
  lastModifiedFormatted: string;   // "November 9, 2025"
  lineCount: number;               // 145
  wordCount: number;               // 1823
  charCount: number;               // 9847
  extension: string;               // ".docx"
  mimeType?: string;               // "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}
```

**Note**: `lastModified` is serialized as ISO 8601 string because Date objects don't serialize across IPC. Renderer converts back to Date if needed.

### Error Response

```typescript
{
  error: string;        // "Cannot read file: File not found"
  code: string;         // "FILE_NOT_FOUND" (error code enum)
  filename?: string;    // "report.docx" (if filename could be extracted)
}
```

**Error Codes**:
- `FILE_NOT_FOUND` - File does not exist at specified path
- `PERMISSION_DENIED` - No read permission for file
- `UNSUPPORTED_TYPE` - File extension not in whitelist
- `FILE_TOO_LARGE` - File size > 1GB (hard limit)
- `CORRUPTED_FILE` - File exists but cannot be read/parsed
- `READ_ERROR` - Generic file read error
- `INVALID_PATH` - Path validation failed
- `UNKNOWN_ERROR` - Unexpected error

---

## Implementation

### Main Process Handler (main.ts)

```typescript
import { ipcMain } from 'electron';
import { getFileMetadata } from './src/utils/metadataExtractor';
import { validateFilePath } from './src/utils/pathValidator';

ipcMain.handle('file:getMetadata', async (event, filePath: string) => {
  try {
    // 1. Validate path
    const safePath = validateFilePath(filePath, {
      mustExist: true,
      mustBeReadable: true,
      allowedExtensions: ['.txt', '.docx', '.pdf', '.xlsx', '.xls', '.csv']
    });

    // 2. Extract metadata
    const metadata = await getFileMetadata(safePath);

    // 3. Serialize Date to string for IPC
    return {
      ...metadata,
      lastModified: metadata.lastModified.toISOString()
    };

  } catch (error) {
    // Redact full path from error message
    const filename = path.basename(filePath);

    return {
      error: `Cannot read file ${filename}: ${getErrorMessage(error)}`,
      code: getErrorCode(error),
      filename
    };
  }
});

function getErrorMessage(error: any): string {
  if (error.code === 'ENOENT') return 'File not found';
  if (error.code === 'EACCES') return 'Permission denied';
  return error.message || 'Unknown error';
}

function getErrorCode(error: any): string {
  if (error.code === 'ENOENT') return 'FILE_NOT_FOUND';
  if (error.code === 'EACCES') return 'PERMISSION_DENIED';
  return 'UNKNOWN_ERROR';
}
```

### Preload Script (preload.ts)

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getFileMetadata: (filePath: string) =>
    ipcRenderer.invoke('file:getMetadata', filePath)
});
```

### Renderer Usage (renderer.ts)

```typescript
async function displayFileMetadata(filePath: string) {
  const result = await window.electronAPI.getFileMetadata(filePath);

  if ('error' in result) {
    // Error case
    showError(result.error);
    console.error(`Metadata error [${result.code}]:`, result.error);
    return;
  }

  // Success case
  const metadata = result;

  // Convert ISO string back to Date
  const lastModifiedDate = new Date(metadata.lastModified);

  // Display in UI
  document.getElementById('filename').textContent = metadata.filename;
  document.getElementById('file-size').textContent = metadata.fileSizeFormatted;
  document.getElementById('last-modified').textContent = metadata.lastModifiedFormatted;
  document.getElementById('line-count').textContent = metadata.lineCount.toString();
  document.getElementById('word-count').textContent = metadata.wordCount.toString();
}
```

---

## Performance

### Target Latency
- **< 2 seconds** for files < 10MB
- **< 5 seconds** for files < 50MB
- **Reject** files > 1GB

### Breakdown

| Operation | Time (1MB file) | Time (10MB file) |
|-----------|-----------------|------------------|
| Path validation | < 1ms | < 1ms |
| fs.stat() | < 1ms | < 1ms |
| Text extraction | 50-100ms | 200-800ms |
| Line/word count | 10-20ms | 50-100ms |
| **Total** | **~60-120ms** | **~250-900ms** |

### Optimization Strategies

1. **Parallel Operations**:
   - Run fs.stat() while converter loads
   - Count lines and words in single pass

2. **Caching**:
   - Renderer caches results per file path
   - Avoid re-extracting if file already processed

3. **Loading Indicator**:
   - Show spinner if > 1 second (per Success Criteria SC-003)

---

## Test Scenarios

### Unit Tests (test/ipc/getMetadata.test.ts)

```typescript
describe('IPC: file:getMetadata', () => {
  it('should extract metadata from text file', async () => {
    const testFile = path.join(__dirname, '../data/sample.txt');
    const result = await window.electronAPI.getFileMetadata(testFile);

    expect(result).not.to.have.property('error');
    expect(result.filename).to.equal('sample.txt');
    expect(result.lineCount).to.be.greaterThan(0);
    expect(result.wordCount).to.be.greaterThan(0);
  });

  it('should return error for non-existent file', async () => {
    const result = await window.electronAPI.getFileMetadata('/nonexistent/file.txt');

    expect(result).to.have.property('error');
    expect(result.code).to.equal('FILE_NOT_FOUND');
  });

  it('should return error for unsupported file type', async () => {
    const testFile = path.join(__dirname, '../data/image.png');
    const result = await window.electronAPI.getFileMetadata(testFile);

    expect(result).to.have.property('error');
    expect(result.code).to.equal('UNSUPPORTED_TYPE');
  });

  it('should format file size correctly', async () => {
    const testFile = path.join(__dirname, '../data/large.docx'); // 5MB file
    const result = await window.electronAPI.getFileMetadata(testFile);

    expect(result.fileSizeFormatted).to.match(/\d+(\.\d+)? MB/);
  });

  it('should format dates in human-readable format', async () => {
    const testFile = path.join(__dirname, '../data/sample.txt');
    const result = await window.electronAPI.getFileMetadata(testFile);

    // e.g., "November 9, 2025" or "2025-11-09"
    expect(result.lastModifiedFormatted).to.match(/\w+ \d+, \d{4}||\d{4}-\d{2}-\d{2}/);
  });
});
```

### Integration Tests

Test with actual files from `test/data/`:
- `sample.txt` (plain text, ~1KB)
- `sample.docx` (DOCX, ~10KB)
- `sample.pdf` (PDF, ~50KB)
- `sample.csv` (CSV, ~5KB)
- `large-document.pdf` (PDF, ~10MB)

---

## Security Notes

### Path Traversal Prevention

```typescript
function validateFilePath(filePath: string): string {
  // 1. Resolve to absolute path
  const resolved = path.resolve(filePath);

  // 2. Check for null bytes
  if (filePath.includes('\0')) {
    throw new Error('Invalid path: contains null byte');
  }

  // 3. Ensure path is within allowed directories (optional, depends on requirements)
  // const allowedRoot = path.resolve(os.homedir());
  // if (!resolved.startsWith(allowedRoot)) {
  //   throw new Error('Invalid path: outside allowed directory');
  // }

  return resolved;
}
```

### Error Message Redaction

**Bad** (exposes full path):
```
Error: ENOENT: no such file or directory '/Users/john/private/secret.docx'
```

**Good** (redacts path):
```
Cannot read file secret.docx: File not found
```

---

## Examples

### Example 1: Successful Extraction

**Request**:
```typescript
window.electronAPI.getFileMetadata('/Users/john/Documents/report.docx')
```

**Response**:
```json
{
  "filename": "report.docx",
  "filePath": "/Users/john/Documents/report.docx",
  "fileSize": 524288,
  "fileSizeFormatted": "512 KB",
  "lastModified": "2025-11-09T14:30:00.000Z",
  "lastModifiedFormatted": "November 9, 2025",
  "lineCount": 145,
  "wordCount": 1823,
  "charCount": 9847,
  "extension": ".docx",
  "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
}
```

### Example 2: File Not Found

**Request**:
```typescript
window.electronAPI.getFileMetadata('/Users/john/missing.txt')
```

**Response**:
```json
{
  "error": "Cannot read file missing.txt: File not found",
  "code": "FILE_NOT_FOUND",
  "filename": "missing.txt"
}
```

### Example 3: Permission Denied

**Request**:
```typescript
window.electronAPI.getFileMetadata('/root/protected.pdf')
```

**Response**:
```json
{
  "error": "Cannot read file protected.pdf: Permission denied",
  "code": "PERMISSION_DENIED",
  "filename": "protected.pdf"
}
```

---

## Related Contracts

- [file:getPreview](./file-getPreview.md) - Get content preview (often called after metadata extraction)
- [dialog:selectFiles](./dialog-selectFiles.md) - Select files to extract metadata from

---

## Changelog

- **2025-11-09**: Initial contract definition with TypeScript types and security validation
