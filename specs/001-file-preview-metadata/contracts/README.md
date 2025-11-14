# IPC Contracts

This directory contains the Inter-Process Communication (IPC) contract definitions for the File Preview and Metadata Display feature.

## Overview

Electron uses IPC to communicate between the main process (Node.js with full system access) and renderer processes (sandboxed browser contexts). All contracts follow a request-response pattern using `ipcRenderer.invoke()` / `ipcMain.handle()`.

## Security Model

- **Context Isolation**: Enabled (renderer cannot access Node.js directly)
- **Preload Script**: Exposes type-safe APIs via `contextBridge`
- **Input Validation**: All file paths validated in main process before fs operations
- **Error Handling**: Errors serialized and returned (never thrown across process boundary)

## Contracts

1. [**file:getMetadata**](./file-getMetadata.md) - Extract file metadata (stats + text analysis)
2. [**file:getPreview**](./file-getPreview.md) - Generate content preview (first N lines/chars)
3. [**dialog:selectFiles**](./dialog-selectFiles.md) - Open file selection dialog (extends existing)

## TypeScript Types

All contract types are defined in `src/types/ipc.ts` and exported for use across processes:

```typescript
// src/types/ipc.ts
import type { FileMetadata } from './fileMetadata';
import type { FilePreview } from './filePreview';

export interface ElectronAPI {
  // File operations
  getFileMetadata(filePath: string): Promise<FileMetadata>;
  getFilePreview(filePath: string, limit: { lines: number; chars: number }): Promise<FilePreview>;

  // Dialog operations
  selectFiles(options: {
    allowMultiple: boolean;
    filters: Array<{ name: string; extensions: string[] }>;
  }): Promise<string[] | null>;

  // Additional IPC methods can be added here
}

// Global type augmentation for window.electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

## Usage Example

**Renderer Process** (renderer.ts):
```typescript
// Type-safe API calls with IntelliSense
const metadata = await window.electronAPI.getFileMetadata('/path/to/file.docx');
console.log(`Lines: ${metadata.lineCount}, Words: ${metadata.wordCount}`);

const preview = await window.electronAPI.getFilePreview('/path/to/file.txt', {
  lines: 20,
  chars: 1000
});
console.log(preview.content);
```

**Main Process** (main.ts):
```typescript
import { ipcMain } from 'electron';
import { getFileMetadata } from './src/utils/metadataExtractor';

ipcMain.handle('file:getMetadata', async (event, filePath: string) => {
  try {
    // Validate path (prevent directory traversal)
    const safePath = validateAndNormalizePath(filePath);

    // Extract metadata
    const metadata = await getFileMetadata(safePath);

    return metadata;
  } catch (error) {
    // Return error object (don't throw)
    return { error: error.message };
  }
});
```

**Preload Script** (preload.ts):
```typescript
import { contextBridge, ipcRenderer } from 'electron';

const api: ElectronAPI = {
  getFileMetadata: (filePath) => ipcRenderer.invoke('file:getMetadata', filePath),
  getFilePreview: (filePath, limit) => ipcRenderer.invoke('file:getPreview', filePath, limit),
  selectFiles: (options) => ipcRenderer.invoke('dialog:selectFiles', options),
};

contextBridge.exposeInMainWorld('electronAPI', api);
```

## Error Handling Pattern

All IPC handlers follow this error handling pattern:

```typescript
ipcMain.handle('channel:name', async (event, ...args) => {
  try {
    // 1. Validate inputs
    validateInputs(args);

    // 2. Perform operation
    const result = await operation();

    // 3. Return success
    return result;
  } catch (error) {
    // 4. Return error (don't throw)
    return {
      error: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    };
  }
});
```

**Renderer side**:
```typescript
const result = await window.electronAPI.someMethod(args);

if ('error' in result) {
  // Handle error
  console.error(result.error);
  showErrorToUser(result.error);
} else {
  // Success - result is type FileMetadata | FilePreview | etc.
  processResult(result);
}
```

## Performance Targets

| Contract | Target Latency | Notes |
|----------|----------------|-------|
| file:getMetadata | < 2s for < 10MB files | Includes text extraction |
| file:getPreview | < 3s for < 10MB files | Stream-based, stops early |
| dialog:selectFiles | User-dependent | Native OS dialog |

## Security Considerations

1. **Path Validation**: All file paths MUST be validated before fs operations:
   - Normalize path (resolve `.`, `..`)
   - Check path is not outside allowed directories
   - Verify file exists and is readable
   - Check file extension against whitelist

2. **Input Sanitization**:
   - Reject paths with null bytes
   - Reject paths starting with `file://`, `javascript:`, `data:`
   - Limit file size (warn > 100MB, reject > 1GB)

3. **Error Message Redaction**:
   - User-facing errors MUST NOT contain full file paths
   - Use filename only: "Cannot read sample.docx"
   - Full errors logged to console for debugging (local only)

## Testing

Each contract should have:

1. **Unit tests** (test/ipc/*.test.ts):
   - Mock IPC handlers
   - Test success cases
   - Test error cases (file not found, permissions, etc.)

2. **Integration tests** (test/integration/ipc.test.ts):
   - Test actual Electron IPC communication
   - Test with real files in test/data/

See individual contract files for specific test scenarios.
