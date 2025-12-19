# Check If Preload Loaded

## In DevTools Console, run each command:

### 1. Check if electronAPI exists at all
```javascript
window.electronAPI
```
**Expected**: Should show an object
**If undefined**: Preload didn't load

---

### 2. Check all window APIs
```javascript
console.log('electronAPI:', window.electronAPI);
console.log('pathAPI:', window.pathAPI);
console.log('fsAPI:', window.fsAPI);
console.log('nodeAPI:', window.nodeAPI);
```

---

### 3. Check if you see the preload success message
Look in the Console for:
```
✓ Preload script initialized securely
```

**If you DON'T see this message**, the preload script didn't run.

---

## If Preload Didn't Load:

### Fix 1: Check main.js path
Run in terminal:
```bash
grep preload /Users/olivier/Projects/A5-PII-Anonymizer/main.js
```

Should show:
```javascript
preload: path.join(__dirname, 'preload.cjs')
```

---

### Fix 2: Verify file exists
```bash
ls -la /Users/olivier/Projects/A5-PII-Anonymizer/preload.cjs
```

---

### Fix 3: Check Electron console (not browser console)

When you start the app with `npm run dev`, look at the **TERMINAL output** (not DevTools).

Look for errors like:
- `Unable to load preload script`
- `Error in preload script`

---

### Fix 4: Restart with DevTools open

Edit `main.js` line 27 to uncomment:
```javascript
mainWindow.webContents.openDevTools();
```

This will automatically open DevTools on startup so you can see any early errors.

---

### Fix 5: Force reload

In the Electron app:
- Press **Cmd+R** (Mac) or **Ctrl+R** (Windows) to reload
- Check if APIs appear after reload

---

## Quick Test

If electronAPI exists, test it:
```javascript
// Should return object with methods
Object.keys(window.electronAPI)
```

Should show:
```
['processFile', 'selectInputDirectory', 'selectOutputDirectory', 'openFolder', 'onLogMessage', 'getFileMetadata', 'getFilePreview', 'selectFiles']
```

---

## What to Share:

1. Output of: `window.electronAPI`
2. Whether you see: `✓ Preload script initialized securely` in console
3. Any error messages in terminal when starting app
4. Any error messages in DevTools console about preload
