# IPC Contract: file:getPreview

**Channel**: `file:getPreview`
**Purpose**: Generate truncated content preview (first 20 lines or 1000 characters)
**Process**: Renderer → Main → Stream Read → Renderer

---

## Request

### Channel Name
```typescript
'file:getPreview'
```

### Input Parameters

```typescript
{
  filePath: string;
  limit: {
    lines: number;   // Default: 20
    chars: number;   // Default: 1000
  }
}
```

---

## Response

### Success Response

```typescript
{
  content: string;           // Preview text
  isTruncated: boolean;      // true if file has more content
  previewLineCount: number;  // Actual lines in preview
  previewCharCount: number;  // Actual chars in preview
  formatType: 'text' | 'structured' | 'error';
}
```

### Error Response

```typescript
{
  error: string;        // User-friendly error message
  code: string;         // Error code (same as getMetadata)
  filename?: string;
}
```

---

## Implementation

### Main Process Handler

```typescript
ipcMain.handle('file:getPreview', async (event, filePath: string, limit: { lines: number; chars: number }) => {
  try {
    const safePath = validateFilePath(filePath);
    const preview = await extractPreview(safePath, limit);
    return preview;
  } catch (error) {
    return {
      error: `Cannot generate preview: ${getErrorMessage(error)}`,
      code: getErrorCode(error),
      filename: path.basename(filePath)
    };
  }
});
```

---

## Performance

- **Target**: < 3 seconds for files < 10MB
- **Stops early**: After reading 20 lines OR 1000 chars (whichever first)
- **Memory**: ~10KB buffer (not full file)

---

## Test Scenarios

```typescript
it('should truncate long files', async () => {
  const result = await window.electronAPI.getFilePreview('/path/to/long.txt', {
    lines: 20,
    chars: 1000
  });

  expect(result.isTruncated).to.be.true;
  expect(result.previewLineCount).to.be.at.most(20);
  expect(result.previewCharCount).to.be.at.most(1000);
});
```

---

## Related Contracts

- [file:getMetadata](./file-getMetadata.md) - Often called together for full file info display
