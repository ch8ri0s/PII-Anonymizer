# Quick Debug Steps

## To see what's happening:

1. **Start the app**:
   ```bash
   npm run dev
   ```

2. **Open Developer Tools**:
   - Click: **View → Toggle Developer Tools**
   - OR press: **Cmd+Option+I** (Mac) / **Ctrl+Shift+I** (Windows)

3. **Go to Console tab** in DevTools

4. **Paste and run this code**:

```javascript
// === DIAGNOSTIC SCRIPT ===
console.log('%c🔍 File Preview Diagnostic', 'font-size: 16px; font-weight: bold; color: blue;');

// Check 1: APIs available
console.log('\n1️⃣ Checking Window APIs...');
const apis = {
  electronAPI: window.electronAPI,
  pathAPI: window.pathAPI,
  fsAPI: window.fsAPI,
  filePreviewUI: window.filePreviewUI
};

Object.entries(apis).forEach(([name, api]) => {
  if (api) {
    console.log(`  ✅ ${name} is available`);
  } else {
    console.log(`  ❌ ${name} is MISSING`);
  }
});

// Check 2: IPC Methods
console.log('\n2️⃣ Checking IPC Methods...');
if (window.electronAPI) {
  const methods = ['getFileMetadata', 'getFilePreview', 'selectFiles'];
  methods.forEach(method => {
    const type = typeof window.electronAPI[method];
    if (type === 'function') {
      console.log(`  ✅ ${method}: ${type}`);
    } else {
      console.log(`  ❌ ${method}: ${type || 'undefined'}`);
    }
  });
} else {
  console.log('  ❌ electronAPI not available');
}

// Check 3: DOM Elements
console.log('\n3️⃣ Checking DOM Elements...');
const elements = {
  'drop-zone': document.getElementById('drop-zone'),
  'file-input': document.getElementById('file-input'),
  'file-metadata-panel': document.getElementById('file-metadata-panel'),
  'file-preview-panel': document.getElementById('file-preview-panel'),
  'batch-queue-panel': document.getElementById('batch-queue-panel')
};

Object.entries(elements).forEach(([name, el]) => {
  if (el) {
    const visible = !el.classList.contains('hidden');
    console.log(`  ✅ ${name}: exists (visible: ${visible})`);
  } else {
    console.log(`  ❌ ${name}: NOT FOUND`);
  }
});

// Check 4: Test IPC directly
console.log('\n4️⃣ Testing IPC with sample file...');
(async () => {
  try {
    const testPath = './test/data/sample.txt';
    console.log(`  Testing: ${testPath}`);

    const metadata = await window.electronAPI.getFileMetadata(testPath);

    if ('error' in metadata) {
      console.log('  ❌ Metadata Error:', metadata.error);
    } else {
      console.log('  ✅ Metadata loaded successfully!');
      console.log('    - Filename:', metadata.filename);
      console.log('    - Size:', metadata.fileSizeFormatted);
      console.log('    - Lines:', metadata.lineCount);
      console.log('    - Words:', metadata.wordCount);
    }
  } catch (error) {
    console.log('  ❌ Exception:', error.message);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Diagnostic complete!');
  console.log('='.repeat(50));
})();
```

5. **Look at the output** and check for any ❌ marks

## Expected Output (if working):

```
🔍 File Preview Diagnostic

1️⃣ Checking Window APIs...
  ✅ electronAPI is available
  ✅ pathAPI is available
  ✅ fsAPI is available
  ✅ filePreviewUI is available

2️⃣ Checking IPC Methods...
  ✅ getFileMetadata: function
  ✅ getFilePreview: function
  ✅ selectFiles: function

3️⃣ Checking DOM Elements...
  ✅ drop-zone: exists (visible: true)
  ✅ file-input: exists (visible: false)
  ✅ file-metadata-panel: exists (visible: false)
  ✅ file-preview-panel: exists (visible: false)
  ✅ batch-queue-panel: exists (visible: false)

4️⃣ Testing IPC with sample file...
  Testing: ./test/data/sample.txt
  ✅ Metadata loaded successfully!
    - Filename: sample.txt
    - Size: 1.2 KB
    - Lines: 42
    - Words: 156
```

## If You See Errors:

### ❌ electronAPI is MISSING
**Problem**: Preload script didn't run
**Fix**: Check that `preload.js` is specified in `main.js`

### ❌ filePreviewUI is MISSING
**Problem**: Integration script didn't load
**Fix**: Check that `filePreviewIntegration.js` is in index.html

### ❌ DOM panels NOT FOUND
**Problem**: UI didn't initialize
**Fix**: Check Console for JavaScript errors during page load

### ❌ File not found error
**Problem**: Test file doesn't exist
**Fix**: Create it:
```bash
echo "Test file content" > test/data/sample.txt
```

## After Running Diagnostic:

**Share the full console output** so I can see exactly what's happening!
