# Browser Migration Plan: A5-PII-Anonymizer

> Converting the Electron desktop app to a browser-based implementation

## Executive Summary

This plan outlines the migration of A5-PII-Anonymizer from an Electron desktop application to a fully browser-based web application. The migration preserves 100% local processing for privacy while eliminating the need for installation.

**Key Benefits:**
- Zero installation - runs in any modern browser
- 100% privacy preserved - all processing client-side
- Cross-platform by default
- Easier distribution and updates
- ~80% code reuse from existing codebase

---

## Phase 1: Project Setup & Core Infrastructure

### 1.1 Create Browser Project Structure

```
browser-app/
├── index.html              # Single page application entry
├── src/
│   ├── main.ts             # Application entry point
│   ├── app.ts              # Core application logic
│   │
│   ├── converters/         # Browser-compatible converters
│   │   ├── PdfConverter.ts     # pdf.js implementation
│   │   ├── DocxConverter.ts    # mammoth browser build
│   │   ├── ExcelConverter.ts   # exceljs browser build
│   │   ├── CsvConverter.ts     # Direct port
│   │   └── TextConverter.ts    # Direct port
│   │
│   ├── pii/                # Direct port (100% compatible)
│   │   ├── SwissEuDetector.ts
│   │   ├── DetectionPipeline.ts
│   │   └── passes/
│   │
│   ├── processing/         # Core processing logic
│   │   ├── FileProcessor.ts    # Browser-adapted processor
│   │   ├── SessionManager.ts   # Session handling
│   │   └── Anonymizer.ts       # Text anonymization
│   │
│   ├── workers/            # Web Workers for heavy tasks
│   │   ├── pdf.worker.ts
│   │   ├── pii.worker.ts
│   │   └── model.worker.ts
│   │
│   ├── ui/                 # UI components
│   │   ├── FileUpload.ts
│   │   ├── EntityReview.ts
│   │   ├── ProgressIndicator.ts
│   │   └── ResultsPanel.ts
│   │
│   ├── storage/            # Browser storage utilities
│   │   ├── ModelCache.ts       # IndexedDB for ML model
│   │   └── SessionStorage.ts   # Processing state
│   │
│   └── utils/              # Utilities
│       ├── fileHelpers.ts
│       └── download.ts
│
├── styles/
│   └── main.css            # Tailwind CSS (port existing)
│
├── public/
│   └── locales/            # i18n files (direct port)
│
├── vite.config.ts          # Build configuration
├── tsconfig.json
└── package.json
```

### 1.2 Dependencies

```json
{
  "dependencies": {
    "@xenova/transformers": "^2.17.2",
    "pdfjs-dist": "^4.0.379",
    "mammoth": "^1.6.0",
    "exceljs": "^4.4.0",
    "turndown": "^7.2.0",
    "marked": "^12.0.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "typescript": "^5.3.0",
    "tailwindcss": "^3.4.0"
  }
}
```

---

## Phase 2: Converter Migration

### 2.1 PDF Converter (Replace pdf-parse with pdf.js)

**Current:** Uses `pdf-parse` (Node.js only)
**New:** Mozilla's `pdf.js` (browser-native)

```typescript
// src/converters/PdfConverter.ts
import * as pdfjsLib from 'pdfjs-dist';

export class PdfConverter {
  async convert(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    let markdown = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      // Process text items with position data for table detection
      markdown += this.processPage(textContent);
    }
    return markdown;
  }
}
```

**Migration Steps:**
1. Install `pdfjs-dist` package
2. Configure worker for pdf.js
3. Port table detection logic (already position-based)
4. Test with existing PDF fixtures

### 2.2 DOCX Converter (Use mammoth browser build)

**Current:** mammoth Node.js
**New:** mammoth browser build (nearly identical API)

```typescript
// src/converters/DocxConverter.ts
import mammoth from 'mammoth';

export class DocxConverter {
  async convert(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return this.htmlToMarkdown(result.value);
  }
}
```

**Migration Steps:**
1. Use mammoth's browser build (same package, different import)
2. Replace `Buffer` with `ArrayBuffer`
3. Test with existing DOCX fixtures

### 2.3 Excel Converter (exceljs browser mode)

```typescript
// src/converters/ExcelConverter.ts
import ExcelJS from 'exceljs';

export class ExcelConverter {
  async convert(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);
    return this.workbookToMarkdown(workbook);
  }
}
```

### 2.4 CSV/Text Converters (Direct Port)

These are already browser-compatible - just remove `fs` usage.

---

## Phase 3: PII Detection Migration

### 3.1 SwissEuDetector (Direct Port)

The `SwissEuDetector.js` is 100% browser-compatible:
- Pure JavaScript regex patterns
- No Node.js dependencies
- Stateless class design

**Migration:** Copy file, convert to TypeScript

### 3.2 ML Model Loading (Browser Adaptation)

```typescript
// src/pii/ModelLoader.ts
import { pipeline, env } from '@xenova/transformers';

// Configure for browser
env.useBrowserCache = true;
env.allowLocalModels = false;

export class PIIModelLoader {
  private classifier: any = null;

  async load(onProgress?: (progress: number) => void): Promise<void> {
    this.classifier = await pipeline(
      'token-classification',
      'Xenova/distilbert-base-multilingual-cased-ner-hrl',
      { progress_callback: onProgress }
    );
  }

  async detect(text: string): Promise<Entity[]> {
    const results = await this.classifier(text);
    return this.processResults(results);
  }
}
```

**Model Caching Strategy:**
1. First load: Download from HuggingFace CDN (~129MB)
2. Browser caches model in IndexedDB
3. Subsequent loads: Instant from cache
4. Optional: Service Worker for offline support

---

## Phase 4: File I/O Replacement

### 4.1 File Input (Replace Electron dialogs)

```typescript
// src/ui/FileUpload.ts
export class FileUpload {
  private input: HTMLInputElement;

  constructor(container: HTMLElement) {
    this.input = document.createElement('input');
    this.input.type = 'file';
    this.input.multiple = true;
    this.input.accept = '.pdf,.docx,.xlsx,.csv,.txt';

    // Drag and drop support
    container.addEventListener('drop', this.handleDrop.bind(this));
    container.addEventListener('dragover', (e) => e.preventDefault());
  }

  async getFiles(): Promise<File[]> {
    return new Promise((resolve) => {
      this.input.onchange = () => resolve(Array.from(this.input.files || []));
      this.input.click();
    });
  }
}
```

### 4.2 File Output (Replace fs.writeFile)

```typescript
// src/utils/download.ts
export function downloadFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

export function downloadZip(files: Map<string, string>): void {
  // Use JSZip for multiple files
  const zip = new JSZip();
  files.forEach((content, name) => zip.file(name, content));

  zip.generateAsync({ type: 'blob' }).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'anonymized-files.zip';
    a.click();
  });
}
```

---

## Phase 5: UI Migration

### 5.1 HTML Structure (Simplified)

The existing `index.html` can be largely reused with these changes:
- Remove Electron-specific meta tags
- Remove CSP for Electron
- Add module script import

### 5.2 JavaScript Migration

**Replace IPC calls with direct function calls:**

```typescript
// Before (Electron)
window.electronAPI.processFiles(files);

// After (Browser)
await fileProcessor.processFiles(files);
```

**Keep existing UI logic:**
- Entity review panel
- Accuracy dashboard
- Progress indicators
- Tab navigation
- All Tailwind styles

---

## Phase 6: Web Workers (Performance)

### 6.1 PDF Processing Worker

```typescript
// src/workers/pdf.worker.ts
import * as pdfjsLib from 'pdfjs-dist';

self.onmessage = async (e: MessageEvent) => {
  const { arrayBuffer, filename } = e.data;

  try {
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    // Process PDF...
    self.postMessage({ success: true, markdown });
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
};
```

### 6.2 PII Detection Worker

```typescript
// src/workers/pii.worker.ts
import { pipeline } from '@xenova/transformers';

let classifier: any = null;

self.onmessage = async (e: MessageEvent) => {
  const { action, text } = e.data;

  if (action === 'load') {
    classifier = await pipeline('token-classification', 'Xenova/...');
    self.postMessage({ action: 'loaded' });
  }

  if (action === 'detect') {
    const results = await classifier(text);
    self.postMessage({ action: 'results', entities: results });
  }
};
```

---

## Phase 7: Testing & Validation

### 7.1 Test Migration

Port existing tests to browser test runner (Vitest):

```typescript
// test/converters/pdf.test.ts
import { describe, it, expect } from 'vitest';
import { PdfConverter } from '../../src/converters/PdfConverter';

describe('PdfConverter', () => {
  it('converts PDF to markdown', async () => {
    const file = new File([pdfBuffer], 'test.pdf', { type: 'application/pdf' });
    const converter = new PdfConverter();
    const markdown = await converter.convert(file);
    expect(markdown).toContain('# ');
  });
});
```

### 7.2 Validation Checklist

- [ ] All file formats convert correctly (PDF, DOCX, XLSX, CSV, TXT)
- [ ] PII detection matches Electron version accuracy
- [ ] Entity review UI works identically
- [ ] Download produces correct files
- [ ] Model loads and caches properly
- [ ] Works offline after initial model download
- [ ] Performance acceptable on mid-range devices
- [ ] Works in Chrome, Firefox, Safari, Edge

---

## Phase 8: Deployment Options

### 8.1 Static Hosting (Recommended)

```bash
# Build
npm run build

# Deploy to any static host:
# - GitHub Pages (free)
# - Vercel (free tier)
# - Netlify (free tier)
# - CloudFlare Pages (free)
# - Self-hosted (nginx/Apache)
```

### 8.2 Progressive Web App (Optional)

Add service worker for offline support:

```typescript
// sw.js
const CACHE_NAME = 'pii-anonymizer-v1';
const MODEL_CACHE = 'pii-model-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/assets/main.js',
        '/assets/main.css'
      ]);
    })
  );
});
```

---

## Implementation Priority

### Milestone 1: Minimal Viable Browser App
1. File upload UI (drag & drop)
2. Text file processing (simplest converter)
3. SwissEuDetector PII detection (no ML)
4. Download results
5. Basic styling

### Milestone 2: Full Document Support
1. PDF converter with pdf.js
2. DOCX converter with mammoth
3. Excel converter with exceljs
4. CSV processing

### Milestone 3: ML-Powered PII Detection
1. Transformers.js integration
2. Model loading with progress
3. IndexedDB caching
4. Hybrid detection (regex + ML)

### Milestone 4: Complete Feature Parity
1. Entity review UI
2. Manual PII marking
3. Accuracy dashboard
4. i18n support
5. Batch processing

### Milestone 5: Optimization & Polish
1. Web Workers for performance
2. PWA/offline support
3. Performance testing
4. Cross-browser testing

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Large model download | Show progress, cache aggressively |
| Browser memory limits | Stream processing for large files |
| Older browser support | Polyfills, feature detection |
| Offline requirements | Service Worker + IndexedDB |
| Performance concerns | Web Workers, lazy loading |

---

## Success Criteria

1. **Functional Parity:** All features from Electron version work
2. **PII Accuracy:** Same 94%+ accuracy as desktop version
3. **Performance:** Process 10-page PDF in < 30 seconds
4. **Compatibility:** Works in Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
5. **Privacy:** Zero network calls during processing (after model cached)
6. **User Experience:** Intuitive drag-and-drop, clear progress indicators
