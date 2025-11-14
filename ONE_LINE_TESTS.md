# One-Line Tests

Copy and paste **ONE LINE AT A TIME** into the DevTools Console:

## Step 1: Check if electronAPI exists
```javascript
window.electronAPI
```
**Expected**: Should show an object with methods

---

## Step 2: Check if filePreviewUI exists
```javascript
window.filePreviewUI
```
**Expected**: Should show an object (FilePreviewUI)

---

## Step 3: Check getFileMetadata method
```javascript
typeof window.electronAPI.getFileMetadata
```
**Expected**: Should show "function"

---

## Step 4: Test loading metadata
```javascript
window.electronAPI.getFileMetadata('./test/data/sample.txt').then(function(r) { console.log(r); })
```
**Expected**: Should show metadata object with filename, size, lines, etc.

---

## Step 5: Check if DOM panels exist
```javascript
document.getElementById('file-metadata-panel')
```
**Expected**: Should show the div element (or null if not created)

---

## Step 6: Manually trigger preview
```javascript
window.filePreviewUI.loadFileInfo('./test/data/sample.txt')
```
**Expected**: Should show the metadata and preview panels in the UI

---

## What to Share:

For each test above, tell me:
- ✅ What you got (the output)
- ❌ Any errors

This will tell us exactly where the problem is!
