# File Preview Feature - Quick Start Guide

## ✅ Implementation Status: COMPLETE

The File Preview and Metadata Display feature has been successfully implemented and is ready to use!

---

## 🚀 Getting Started

### 1. Build the Application

```bash
# Compile TypeScript and build CSS
npm run compile && npm run css:build
```

### 2. Start the Application

```bash
# Start Electron app
npm run dev
```

The application will launch with the new file preview functionality integrated!

---

## 🎯 How to Use

### Method 1: Drag and Drop
1. Open the application
2. Drag a file from your file system onto the drop zone
3. The file will be added to the batch queue
4. Metadata and preview will load automatically

### Method 2: File Browser
1. Click the "Preview Files" button (or the drop zone)
2. Select one or multiple files
3. Files will be added to the batch queue
4. Click any file in the queue to view its preview

### Supported File Types
- `.txt` - Plain text files
- `.docx`, `.doc` - Microsoft Word documents
- `.pdf` - PDF documents
- `.xlsx`, `.xls` - Microsoft Excel spreadsheets
- `.csv` - CSV files

---

## 🧪 Testing

### Quick Console Test
1. Start the app: `npm run dev`
2. Open DevTools: View → Toggle Developer Tools
3. In the Console tab, paste and run:

```javascript
// Test file metadata
const metadata = await window.electronAPI.getFileMetadata('./test/data/sample.txt');
console.log(metadata);

// Test file preview
const preview = await window.electronAPI.getFilePreview('./test/data/sample.txt', { lines: 20, chars: 1000 });
console.log(preview);
```

### Run Test Script
In the DevTools Console:
```javascript
// Copy and paste the content of test-file-preview.js
```

### Run Automated Tests
```bash
npm test
```

---

## 📋 Features Implemented

### ✅ File Selection
- Drag-and-drop support
- Native file browser dialog
- Multi-file selection
- File type filtering

### ✅ Metadata Display
- Filename
- File size (human-readable format)
- Last modified date
- Line count
- Word count
- Character count

### ✅ Content Preview
- First 20 lines OR 1000 characters (whichever comes first)
- Truncation indicator
- Streaming for large files
- Memory-efficient processing

### ✅ Batch Queue
- Add multiple files
- Remove individual files
- Clear entire queue
- Click to preview any file
- Visual selection highlighting

### ✅ Security
- Path validation (prevents directory traversal)
- Extension whitelisting
- File size limits (1GB max)
- Error message redaction
- Secure IPC communication

---

## 🔧 Architecture

### IPC Channels
- `file:getMetadata` - Extract file metadata
- `file:getPreview` - Generate content preview
- `dialog:selectFiles` - Open file selection dialog

### Key Files
- **Main Process**: `dist/services/filePreviewHandlers.mjs` - IPC handlers
- **Renderer Process**: `filePreviewIntegration.js` - UI integration
- **UI Components**: `dist/ui/filePreviewUI.js` - UI logic
- **Utilities**: `dist/utils/` - Core processing logic

---

## 🐛 Troubleshooting

### App won't start
```bash
# Rebuild everything
npm run compile && npm run css:build
npm run dev
```

### Module not found errors
- Check that `dist/` directory exists and has compiled files
- Run `npm run compile` to regenerate

### CSS not loading
- Check that `output.css` exists in the project root
- Run `npm run css:build` to regenerate

### IPC errors
- Check browser DevTools console for errors
- Verify preload.js is loaded (check Application tab)
- Ensure main.js registered handlers

---

## 📊 Performance Targets

All targets from the specification are met:

- ✅ File selection via drag-drop: < 3s
- ✅ File selection via browser: < 10s
- ✅ Metadata extraction: < 2s for files < 10MB
- ✅ Preview generation: < 3s for files < 10MB

---

## 📚 Documentation

For more detailed information, see:
- **Full Implementation Details**: `IMPLEMENTATION_STATUS.md`
- **Manual Test Scenarios**: `specs/001-file-preview-metadata/quickstart.md`
- **Feature Specification**: `specs/001-file-preview-metadata/spec.md`
- **IPC Contracts**: `specs/001-file-preview-metadata/contracts/`

---

## ✨ What's Next?

The feature is production-ready! You can:
1. Test with your own files
2. Integrate with the existing anonymization workflow
3. Add additional enhancements (see IMPLEMENTATION_STATUS.md)

**Enjoy the new file preview functionality! 🎉**
