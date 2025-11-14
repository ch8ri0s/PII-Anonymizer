# File Preview Feature - Troubleshooting Guide

## Issue: Files Selected But No Preview Shows

### What to Check:

1. **Open Developer Tools**
   - Start the app: `npm run dev`
   - Open DevTools: **View → Toggle Developer Tools**
   - Go to the **Console** tab
   - Look for any error messages (red text)

2. **Check Console Messages**

   You should see these messages when the app loads:
   ```
   ✓ Preload script initialized securely
   [FilePreview] IPC handlers registered successfully
   📦 File Preview integration script loaded
   🔧 Initializing File Preview feature...
   ✅ File Preview feature initialized
   ✓ Enhanced file input handlers
   ✓ Added preview button
   ```

3. **When You Select a File**

   You should see:
   ```
   📁 Files selected: 1
   📄 Adding file to preview: /path/to/file.txt
     ⏳ Loading metadata...
     ✓ Metadata loaded: 42 lines
   ```

### Common Issues & Fixes:

#### Issue 1: "Cannot find module" errors

**Symptoms**: Red errors in console about missing modules

**Fix**:
```bash
# Rebuild everything
npm run compile && npm run css:build
npm run dev
```

---

#### Issue 2: No console messages at all

**Symptoms**: Console is empty or only shows basic messages

**Fix**: The integration script may not be loading

1. Check that `index.html` has this line:
   ```html
   <script type="module" src="filePreviewIntegration.js"></script>
   ```

2. Verify the file exists:
   ```bash
   ls filePreviewIntegration.js
   ```

---

#### Issue 3: UI panels not appearing

**Symptoms**: No metadata or preview panels visible after selecting file

**Fix**: Check if panels are being created

In DevTools Console, run:
```javascript
// Check if UI panels exist
console.log('Metadata panel:', document.getElementById('file-metadata-panel'));
console.log('Preview panel:', document.getElementById('file-preview-panel'));
console.log('Queue panel:', document.getElementById('batch-queue-panel'));

// Check if filePreviewUI is available
console.log('filePreviewUI:', window.filePreviewUI);
```

If any return `null`, the UI didn't initialize correctly.

---

#### Issue 4: IPC methods not available

**Symptoms**: Errors like "getFileMetadata is not a function"

**Fix**: Check preload script loaded

In DevTools Console:
```javascript
// Check if IPC methods are available
console.log('electronAPI:', window.electronAPI);
console.log('getFileMetadata:', typeof window.electronAPI.getFileMetadata);
console.log('getFilePreview:', typeof window.electronAPI.getFilePreview);
console.log('selectFiles:', typeof window.electronAPI.selectFiles);
```

All should show `function`.

---

### Manual Test:

If the UI isn't working, test the IPC directly:

```javascript
// Test in DevTools Console

// 1. Test file metadata
const testPath = './test/data/sample.txt';
const metadata = await window.electronAPI.getFileMetadata(testPath);
console.log('Metadata:', metadata);

// 2. Test file preview
const preview = await window.electronAPI.getFilePreview(testPath, {
  lines: 20,
  chars: 1000
});
console.log('Preview:', preview);

// 3. If both work, manually trigger UI
if (window.filePreviewUI) {
  await window.filePreviewUI.loadFileInfo(testPath);
}
```

---

### Debug Mode:

Enable verbose logging by running this in Console:

```javascript
// Enable debug mode
window.DEBUG_FILE_PREVIEW = true;

// Try selecting a file again
```

---

### Check File Paths:

The issue might be file paths. Test with an absolute path:

```javascript
// Get absolute path to test file
const fs = window.fsAPI;
const path = window.pathAPI;

// Try with absolute path
const testFile = path.resolve('./test/data/sample.txt');
console.log('Testing with:', testFile);

const metadata = await window.electronAPI.getFileMetadata(testFile);
console.log(metadata);
```

---

### Verify Test Files Exist:

```bash
# Check test files
ls -la test/data/
```

You should see:
- `sample.txt`
- `sample.csv`
- `sample.pdf`
- `sample.docx` (if available)

If missing, create a simple test file:
```bash
echo "Hello World\nThis is a test file\nLine 3" > test/data/sample.txt
```

---

### Complete Reset:

If nothing works, do a complete rebuild:

```bash
# 1. Clean dist directory
rm -rf dist/

# 2. Rebuild everything
npm run compile && npm run css:build

# 3. Restart app
npm run dev
```

---

### Still Not Working?

Share these from DevTools Console:

1. **All console messages** (copy/paste the entire console)
2. **Check for errors** (any red text)
3. **Run this diagnostic**:

```javascript
// Diagnostic script
console.log('=== File Preview Diagnostic ===');
console.log('1. Window APIs:', {
  electronAPI: !!window.electronAPI,
  pathAPI: !!window.pathAPI,
  fsAPI: !!window.fsAPI,
  filePreviewUI: !!window.filePreviewUI
});

console.log('2. IPC Methods:', {
  getFileMetadata: typeof window.electronAPI?.getFileMetadata,
  getFilePreview: typeof window.electronAPI?.getFilePreview,
  selectFiles: typeof window.electronAPI?.selectFiles
});

console.log('3. DOM Elements:', {
  dropZone: !!document.getElementById('drop-zone'),
  fileInput: !!document.getElementById('file-input'),
  metadataPanel: !!document.getElementById('file-metadata-panel'),
  previewPanel: !!document.getElementById('file-preview-panel'),
  queuePanel: !!document.getElementById('batch-queue-panel')
});

console.log('4. Test file existence:');
try {
  const exists = window.fsAPI.existsSync('./test/data/sample.txt');
  console.log('  sample.txt exists:', exists);
} catch(e) {
  console.log('  Error checking file:', e.message);
}

console.log('=== End Diagnostic ===');
```

Copy and share the output!
