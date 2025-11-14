# UI Redesign Plan - Based on Reference App

## Overview

Redesign the Electron app UI to match the beautiful React reference app design while keeping vanilla JavaScript implementation.

**Reference**: `File PII Sanitization App/` (React + shadcn/ui + Tailwind)
**Target**: Electron app with vanilla HTML/CSS/JS

---

## Design System

### Colors (from reference)
```css
--slate-50: #f8fafc;
--slate-100: #f1f5f9;
--slate-200: #e2e8f0;
--slate-300: #cbd5e1;
--slate-400: #94a3b8;
--slate-500: #64748b;
--slate-600: #475569;
--slate-700: #334155;
--slate-900: #0f172a;

--blue-50: #eff6ff;
--blue-100: #dbeafe;
--blue-500: #3b82f6;
--blue-600: #2563eb;
--blue-700: #1d4ed8;

--green-50: #f0fdf4;
--green-100: #dcfce7;
--green-600: #16a34a;
--green-700: #15803d;

--red-100: #fee2e2;
--red-500: #ef4444;
--red-600: #dc2626;
--red-700: #b91c1c;
```

### Typography
- **Headings**: Inter or system font stack
- **Body**: 14px base, slate-600
- **Monospace**: Monaco, Consolas for preview

### Spacing
- Container: `max-w-7xl mx-auto`
- Grid gap: `gap-6` (1.5rem)
- Card padding: `p-6` (1.5rem)
- Section spacing: `space-y-4` (1rem)

---

## Layout Structure

### 1. Main Container
```html
<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <!-- Upload Zone OR Processing View -->
  </div>
</div>
```

### 2. Header (always visible)
```html
<div class="mb-8">
  <h1 class="text-4xl font-bold text-slate-900 mb-2">
    PII Anonymiser
  </h1>
  <p class="text-lg text-slate-600">
    Upload documents to automatically detect and sanitize personally identifiable information
  </p>
</div>
```

### 3. Upload Zone (before file selection)
```html
<div class="card border-2 border-dashed border-slate-300 hover:border-slate-400">
  <div class="p-12 text-center">
    <!-- Upload icon (large) -->
    <!-- "Drop your file here" heading -->
    <!-- "Browse Files" button -->
    <!-- Supported formats -->
  </div>
</div>
```

### 4. Processing View (after file selection)
```html
<div class="grid lg:grid-cols-3 gap-6">
  <!-- Left Column (1/3) -->
  <div class="lg:col-span-1 space-y-6">
    <div id="file-metadata-panel"><!-- File Details Card --></div>
    <div id="file-preview-panel"><!-- Preview Card --></div>
  </div>

  <!-- Right Column (2/3) -->
  <div class="lg:col-span-2">
    <div id="processing-output"><!-- Sanitization Results Card --></div>
  </div>
</div>
```

---

## Component Breakdown

### Component 1: FileUploadZone

**Visual Design**:
- Large centered upload icon (64px) in slate-400
- Dashed border that turns blue on drag-over
- "Drop your file here" heading (text-2xl)
- "or click to browse" subtext (text-slate-600)
- Blue "Browse Files" button
- Supported formats section with colored badges

**HTML Structure**:
```html
<div id="upload-zone" class="upload-card">
  <div class="upload-icon-wrapper">
    <svg class="upload-icon"><!-- Upload SVG --></svg>
  </div>

  <h2>Drop your file here</h2>
  <p>or click to browse from your computer</p>

  <label class="browse-button">
    <input type="file" hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.csv" />
    <span>Browse Files</span>
  </label>

  <div class="supported-formats">
    <p>Supported formats:</p>
    <div class="format-badges">
      <div class="badge badge-red">PDF</div>
      <div class="badge badge-blue">Word</div>
      <div class="badge badge-green">Excel</div>
      <div class="badge badge-purple">CSV</div>
    </div>
  </div>
</div>
```

**Interactions**:
- Drag over: border blue + background blue-50
- Drop: process file
- Click: open file picker
- File selected: hide zone, show processing view

---

### Component 2: FileMetadataPanel

**Visual Design**:
- White card with rounded corners
- "File Details" title with close button
- Icon + label + value rows with separators
- Colored badge for file type

**HTML Structure**:
```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">File Details</h3>
    <button class="btn-ghost btn-sm" id="reset-btn">×</button>
  </div>

  <div class="card-content">
    <div class="metadata-row">
      <svg class="icon"><!-- FileText icon --></svg>
      <div>
        <p class="label">File Name</p>
        <p class="value" id="meta-filename">sample.csv</p>
      </div>
    </div>

    <hr class="separator" />

    <div class="metadata-row">
      <svg class="icon"><!-- FileType icon --></svg>
      <div>
        <p class="label">Type</p>
        <span class="badge badge-purple">CSV File</span>
      </div>
    </div>

    <hr class="separator" />

    <div class="metadata-row">
      <svg class="icon"><!-- HardDrive icon --></svg>
      <div>
        <p class="label">Size</p>
        <p class="value" id="meta-size">2.4 KB</p>
      </div>
    </div>

    <hr class="separator" />

    <div class="metadata-row">
      <svg class="icon"><!-- Calendar icon --></svg>
      <div>
        <p class="label">Last Modified</p>
        <p class="value" id="meta-modified">Nov 10, 2024 at 2:30 PM</p>
      </div>
    </div>
  </div>
</div>
```

**Data Binding** (from IPC):
```javascript
const metadata = await window.electronAPI.getFileMetadata(filePath);
document.getElementById('meta-filename').textContent = metadata.filename;
document.getElementById('meta-size').textContent = metadata.fileSizeFormatted;
document.getElementById('meta-modified').textContent = metadata.lastModifiedFormatted;
```

---

### Component 3: FilePreview

**Visual Design**:
- White card with "Preview" title
- Scrollable area (h-64 = 256px)
- Monospace font in slate-700
- Light gray background (slate-50)
- Border (slate-200)

**HTML Structure**:
```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">Preview</h3>
  </div>

  <div class="card-content">
    <div class="scroll-area">
      <pre id="preview-content" class="preview-text"></pre>
    </div>
  </div>
</div>
```

**Data Binding**:
```javascript
const preview = await window.electronAPI.getFilePreview(filePath, { lines: 20, chars: 1000 });
document.getElementById('preview-content').textContent = preview.content;
```

---

### Component 4: ProcessingOutput

**Visual Design**:
- Large card spanning 2/3 of layout
- Header with title + download buttons
- Success alert (green) when complete
- Loading spinner during processing
- Tabbed interface:
  - Tab 1: Sanitized Markdown (scrollable preview)
  - Tab 2: Change Mapping (list of changes)

**HTML Structure**:
```html
<div class="card h-full">
  <div class="card-header">
    <div class="header-split">
      <div>
        <h3 class="card-title">Sanitization Results</h3>
        <p class="subtitle" id="pii-count">11 PII instances detected and sanitized</p>
      </div>
      <div class="button-group">
        <button class="btn-primary btn-sm" id="download-markdown">
          <svg><!-- Download icon --></svg>
          Markdown
        </button>
        <button class="btn-outline btn-sm" id="download-mapping">
          <svg><!-- Download icon --></svg>
          Mapping
        </button>
      </div>
    </div>
  </div>

  <div class="card-content">
    <!-- Loading State -->
    <div id="processing-spinner" class="loader-container hidden">
      <svg class="spinner"><!-- Loader animation --></svg>
      <p>Processing and sanitizing PII...</p>
    </div>

    <!-- Success State -->
    <div id="processing-result" class="hidden">
      <div class="alert alert-success">
        <svg><!-- CheckCircle icon --></svg>
        <p>File successfully processed and sanitized. Ready to download.</p>
      </div>

      <div class="tabs">
        <div class="tab-list">
          <button class="tab active" data-tab="markdown">Sanitized Markdown</button>
          <button class="tab" data-tab="mapping">Change Mapping</button>
        </div>

        <div class="tab-content active" id="tab-markdown">
          <div class="scroll-area h-96">
            <pre id="sanitized-markdown"></pre>
          </div>
        </div>

        <div class="tab-content" id="tab-mapping">
          <div class="scroll-area h-96">
            <div id="change-list" class="change-list"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

**Change Mapping Item**:
```html
<div class="change-item">
  <div class="change-header">
    <span class="badge badge-outline">PER</span>
    <span class="location">Line 5</span>
  </div>
  <div class="change-details">
    <div class="change-row">
      <span class="label">Original:</span>
      <span class="original">John Smith</span>
    </div>
    <div class="change-row">
      <span class="label">Replaced:</span>
      <span class="replacement">PER_1</span>
    </div>
  </div>
</div>
```

---

## CSS Classes (Tailwind-inspired)

### Cards
```css
.card {
  background: white;
  border-radius: 0.5rem;
  border: 1px solid var(--slate-200);
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
}

.card-header {
  padding: 1.5rem;
  border-bottom: 1px solid var(--slate-200);
}

.card-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--slate-900);
}

.card-content {
  padding: 1.5rem;
}
```

### Buttons
```css
.btn-primary {
  background: var(--blue-600);
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: var(--blue-700);
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--slate-300);
  color: var(--slate-700);
}

.btn-ghost {
  background: transparent;
  color: var(--slate-600);
}

.btn-sm {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}
```

### Badges
```css
.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-red { background: var(--red-100); color: var(--red-700); }
.badge-blue { background: var(--blue-100); color: var(--blue-700); }
.badge-green { background: var(--green-100); color: var(--green-700); }
.badge-purple { background: #f3e8ff; color: #7c3aed; }
```

### Scroll Areas
```css
.scroll-area {
  overflow-y: auto;
  border: 1px solid var(--slate-200);
  border-radius: 0.375rem;
  background: var(--slate-50);
  padding: 1rem;
}

.h-64 { height: 16rem; }
.h-96 { height: 24rem; }
```

### Tabs
```css
.tabs { margin-top: 1rem; }

.tab-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.25rem;
  background: var(--slate-100);
  padding: 0.25rem;
  border-radius: 0.5rem;
}

.tab {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  background: transparent;
  color: var(--slate-700);
  transition: all 0.2s;
}

.tab.active {
  background: white;
  box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
  color: var(--slate-900);
}

.tab-content {
  display: none;
  margin-top: 1rem;
}

.tab-content.active {
  display: block;
}
```

### Alerts
```css
.alert {
  padding: 1rem;
  border-radius: 0.5rem;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.alert-success {
  background: var(--green-50);
  border: 1px solid var(--green-200);
  color: var(--green-700);
}

.alert svg {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
}
```

---

## Implementation Steps

### Step 1: Update index.html Structure ✅
- Replace old layout with new card-based design
- Use semantic HTML structure from reference

### Step 2: Create New CSS File
- `ui-components.css` with all component styles
- Import lucide-react icons (or use Font Awesome equivalents)

### Step 3: Update renderer.js
- Keep existing IPC logic
- Add UI state management functions:
  - `showUploadZone()`
  - `showProcessingView()`
  - `populateMetadata(metadata)`
  - `populatePreview(preview)`
  - `showProcessingSpinner()`
  - `showProcessingResults(markdown, mapping)`

### Step 4: Add Tab Switching Logic
```javascript
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    // Remove active from all tabs/content
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Add active to clicked tab
    tab.classList.add('active');
    const targetId = 'tab-' + tab.dataset.tab;
    document.getElementById(targetId).classList.add('active');
  });
});
```

### Step 5: Add Download Handlers
```javascript
document.getElementById('download-markdown').addEventListener('click', () => {
  const markdown = document.getElementById('sanitized-markdown').textContent;
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sanitized.md';
  a.click();
  URL.revokeObjectURL(url);
});
```

### Step 6: Integrate with Existing IPC
- Keep all existing `window.electronAPI` calls
- Just update where the data is displayed in the new UI

---

## Icons

**Reference app uses lucide-react. Map to Font Awesome:**

| Lucide Icon | Font Awesome Equivalent |
|-------------|-------------------------|
| Upload | fa-upload |
| FileText | fa-file-alt |
| Calendar | fa-calendar |
| HardDrive | fa-hdd |
| FileType | fa-file |
| X | fa-times |
| Download | fa-download |
| Loader2 | fa-spinner (fa-spin) |
| CheckCircle2 | fa-check-circle |
| FileSpreadsheet | fa-file-excel |

---

## Responsive Breakpoints

```css
/* Mobile first, then: */
@media (min-width: 1024px) {
  .lg\\:grid-cols-3 {
    grid-template-columns: repeat(3, 1fr);
  }

  .lg\\:col-span-1 {
    grid-column: span 1 / span 1;
  }

  .lg\\:col-span-2 {
    grid-column: span 2 / span 2;
  }
}
```

---

## Animation

### Upload Zone Drag State
```css
.upload-card {
  transition: all 0.2s;
}

.upload-card.dragging {
  border-color: var(--blue-500);
  background: var(--blue-50);
}

.upload-card.dragging .upload-icon {
  color: var(--blue-600);
}
```

### Spinner Animation
```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spinner {
  animation: spin 1s linear infinite;
}
```

### Fade In
```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.processing-result {
  animation: fadeIn 0.3s ease-out;
}
```

---

## Next Steps

1. **Create `ui-components.css`** with all styles above
2. **Rewrite `index.html`** with new structure
3. **Update `renderer.js`** to populate new UI
4. **Test complete workflow**:
   - Upload file → metadata appears
   - Preview loads → shows content
   - Process → spinner → results
   - Tabs switch → markdown/mapping
   - Download → files saved

**Goal**: Match reference app's polish while keeping Electron integration intact! ✨
