# Simple Diagnostic Test

## Copy and paste this into DevTools Console:

```javascript
console.log('=== File Preview Diagnostic ===');

// Test 1: Check APIs
console.log('\n1. Window APIs:');
console.log('  electronAPI:', typeof window.electronAPI);
console.log('  pathAPI:', typeof window.pathAPI);
console.log('  fsAPI:', typeof window.fsAPI);
console.log('  filePreviewUI:', typeof window.filePreviewUI);

// Test 2: Check IPC Methods
console.log('\n2. IPC Methods:');
if (window.electronAPI) {
  console.log('  getFileMetadata:', typeof window.electronAPI.getFileMetadata);
  console.log('  getFilePreview:', typeof window.electronAPI.getFilePreview);
  console.log('  selectFiles:', typeof window.electronAPI.selectFiles);
} else {
  console.log('  ERROR: electronAPI not available');
}

// Test 3: Check DOM
console.log('\n3. DOM Elements:');
console.log('  drop-zone:', document.getElementById('drop-zone') ? 'found' : 'NOT FOUND');
console.log('  file-metadata-panel:', document.getElementById('file-metadata-panel') ? 'found' : 'NOT FOUND');
console.log('  file-preview-panel:', document.getElementById('file-preview-panel') ? 'found' : 'NOT FOUND');
console.log('  batch-queue-panel:', document.getElementById('batch-queue-panel') ? 'found' : 'NOT FOUND');

// Test 4: Try loading a file
console.log('\n4. Testing IPC...');
window.electronAPI.getFileMetadata('./test/data/sample.txt')
  .then(function(result) {
    if (result.error) {
      console.log('  ERROR:', result.error);
    } else {
      console.log('  SUCCESS! Metadata loaded:');
      console.log('    Filename:', result.filename);
      console.log('    Size:', result.fileSizeFormatted);
      console.log('    Lines:', result.lineCount);
      console.log('    Words:', result.wordCount);
    }
  })
  .catch(function(error) {
    console.log('  EXCEPTION:', error.message);
  });

console.log('\n=== End Diagnostic ===');
```

## Expected Output (if working):

```
=== File Preview Diagnostic ===

1. Window APIs:
  electronAPI: object
  pathAPI: object
  fsAPI: object
  filePreviewUI: object

2. IPC Methods:
  getFileMetadata: function
  getFilePreview: function
  selectFiles: function

3. DOM Elements:
  drop-zone: found
  file-metadata-panel: found
  file-preview-panel: found
  batch-queue-panel: found

4. Testing IPC...
  SUCCESS! Metadata loaded:
    Filename: sample.txt
    Size: 1.2 KB
    Lines: 42
    Words: 156

=== End Diagnostic ===
```

## What Each Result Means:

### ✅ Good Results:
- `electronAPI: object` - IPC is available
- `getFileMetadata: function` - Method exists
- `drop-zone: found` - HTML elements present
- `SUCCESS! Metadata loaded` - Everything works!

### ❌ Bad Results:
- `electronAPI: undefined` - Preload didn't load
- `getFileMetadata: undefined` - Method not exposed
- `drop-zone: NOT FOUND` - HTML not loaded
- `ERROR:` or `EXCEPTION:` - Something failed

## Quick Manual Test:

If the diagnostic works, try manually loading a file preview:

```javascript
// Test with a specific file
window.filePreviewUI.loadFileInfo('./test/data/sample.txt');
```

You should see the metadata and preview panels appear!
