# IPC Contract: dialog:selectFiles

**Channel**: `dialog:selectFiles`
**Purpose**: Open native file selection dialog (extends existing functionality)
**Process**: Renderer → Main → OS Dialog → Main → Renderer

---

## Request

### Channel Name
```typescript
'dialog:selectFiles'
```

### Input Parameters

```typescript
{
  allowMultiple: boolean;  // Enable multi-file selection
  filters: Array<{
    name: string;          // "Supported Files"
    extensions: string[];  // ['docx', 'pdf', 'xlsx', 'csv', 'txt']
  }>;
}
```

---

## Response

### Success Response

```typescript
string[] | null  // Array of absolute file paths, or null if cancelled
```

**Example**: `["/Users/john/doc1.docx", "/Users/john/doc2.pdf"]`

---

## Implementation

### Main Process Handler

```typescript
import { dialog, BrowserWindow } from 'electron';

ipcMain.handle('dialog:selectFiles', async (event, options: {
  allowMultiple: boolean;
  filters: Array<{ name: string; extensions: string[] }>;
}) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  const result = await dialog.showOpenDialog(win!, {
    properties: options.allowMultiple ? ['openFile', 'multiSelections'] : ['openFile'],
    filters: options.filters
  });

  if (result.canceled) return null;
  return result.filePaths;
});
```

---

## Usage Example

```typescript
const filePaths = await window.electronAPI.selectFiles({
  allowMultiple: true,
  filters: [
    { name: 'Supported Files', extensions: ['docx', 'pdf', 'xlsx', 'csv', 'txt'] }
  ]
});

if (filePaths) {
  for (const filePath of filePaths) {
    batchQueue.addFile(filePath);
  }
}
```

---

## Related Contracts

- [file:getMetadata](./file-getMetadata.md) - Called after files selected
- [file:getPreview](./file-getPreview.md) - Called after metadata loaded
