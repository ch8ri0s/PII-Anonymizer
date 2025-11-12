# Research: File Preview and Metadata Display

**Feature**: File Preview and Metadata Display
**Date**: 2025-11-09
**Purpose**: Resolve technical unknowns and establish implementation patterns for TypeScript + Tailwind CSS Electron app

---

## 1. Test Strategy for TypeScript Electron IPC Handlers

### Decision: Mocha + Chai + ts-node with Manual IPC Mocking

**Rationale**:
- **ts-node** runs TypeScript tests directly without pre-compilation step
- **Mocha** already used in project (minimal new dependencies)
- **@types/mocha** and **@types/chai** provide full TypeScript IntelliSense
- Manual mocking via EventEmitter keeps tests lightweight and fast
- No deprecated dependencies (Spectron abandoned, Playwright overkill for unit tests)

**Implementation Pattern**:
```typescript
// test/utils/metadataExtractor.test.ts
import { expect } from 'chai';
import { getFileMetadata } from '../../src/utils/metadataExtractor';
import * as path from 'path';

describe('MetadataExtractor', () => {
  it('should extract metadata from text file', async () => {
    const testFile = path.join(__dirname, '../data/sample.txt');
    const metadata = await getFileMetadata(testFile);

    expect(metadata).to.have.property('filename', 'sample.txt');
    expect(metadata.lineCount).to.be.greaterThan(0);
    expect(metadata.wordCount).to.be.greaterThan(0);
  });

  it('should handle file not found error', async () => {
    try {
      await getFileMetadata('/nonexistent/file.txt');
      expect.fail('Should have thrown error');
    } catch (err) {
      expect(err.message).to.include('ENOENT');
    }
  });
});
```

**package.json test script**:
```json
{
  "scripts": {
    "test": "mocha --require ts-node/register test/**/*.test.ts --timeout 10000",
    "test:watch": "mocha --require ts-node/register test/**/*.test.ts --watch"
  }
}
```

**Required Dependencies**:
- `typescript` - compiler
- `ts-node` - run .ts files directly
- `@types/node` - Node.js type definitions
- `@types/mocha` - Mocha type definitions
- `@types/chai` - Chai type definitions

**Alternatives Considered**:
- **Spectron**: Rejected - deprecated, unmaintained
- **Playwright for Electron**: Rejected - overkill for unit tests, better for E2E
- **Jest**: Rejected - requires different test patterns, Mocha already in use

---

## 2. File Reading Approach for Preview (First N Lines)

### Decision: Streaming with readline + TypeScript Promise Wrapper

**Rationale**:
- Node.js `fs.createReadStream()` + `readline` provides memory-efficient line-by-line reading
- Stop reading after 20 lines OR 1000 characters (whichever first)
- TypeScript async/await wrapper provides clean API with type safety
- Memory footprint: ~10KB buffer vs full file load

**Implementation**:
```typescript
// src/utils/contentPreview.ts
import * as fs from 'fs';
import * as readline from 'readline';

export interface PreviewOptions {
  maxLines: number;
  maxChars: number;
}

export interface FilePreview {
  content: string;
  isTruncated: boolean;
  formatType: 'text' | 'structured';
}

export async function extractPreview(
  filePath: string,
  options: PreviewOptions = { maxLines: 20, maxChars: 1000 }
): Promise<FilePreview> {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream });

    const lines: string[] = [];
    let totalChars = 0;
    let truncated = false;

    rl.on('line', (line: string) => {
      if (lines.length < options.maxLines && totalChars < options.maxChars) {
        lines.push(line);
        totalChars += line.length;
      } else {
        truncated = true;
        rl.close();
        stream.destroy();
      }
    });

    rl.on('close', () => {
      resolve({
        content: lines.join('\n'),
        isTruncated: truncated,
        formatType: 'text'
      });
    });

    rl.on('error', (err: Error) => reject(err));
    stream.on('error', (err: Error) => reject(err));
  });
}
```

**Performance**:
- 1GB file: stops after ~1KB read (< 50ms)
- Memory: ~10KB buffer vs ~1GB full read
- Works for TXT, CSV; DOCX/PDF use converter extraction instead

**Alternatives Considered**:
- **Full fs.readFile()**: Rejected - memory inefficient for large files
- **Manual chunking**: Rejected - readline handles line boundaries automatically
- **External tool (head)**: Rejected - Windows compatibility issues

---

## 3. TypeScript Configuration for Mixed .ts/.js Codebase

### Decision: Incremental Migration with allowJs + esModuleInterop

**Rationale**:
- **allowJs**: true - allows importing existing .js converters from .ts files
- **esModuleInterop**: true - enables `import * as fs from 'fs'` syntax
- **target**: ES2020 - modern features, Node 18+ supports
- **module**: CommonJS - Electron/Node.js standard
- **outDir**: dist/ - keeps compiled JS separate from source
- **include/exclude**: compile only necessary files, skip node_modules

**tsconfig.json**:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./",
    "esModuleInterop": true,
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "types": ["node", "mocha", "chai"]
  },
  "include": [
    "src/**/*.ts",
    "*.ts",
    "test/**/*.ts"
  ],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.js"
  ]
}
```

**Build Script** (package.json):
```json
{
  "scripts": {
    "build": "npm run build:ts && npm run build:tailwind",
    "build:ts": "tsc",
    "build:tailwind": "tailwindcss -i ./input.css -o ./output.css --minify",
    "watch:ts": "tsc --watch",
    "watch:tailwind": "tailwindcss -i ./input.css -o ./output.css --watch",
    "dev": "npm run build && electron ."
  }
}
```

**Alternatives Considered**:
- **Migrate all .js to .ts immediately**: Rejected - high risk, large scope
- **Separate tsconfig for tests**: Rejected - adds complexity, single config sufficient
- **ts-loader/webpack**: Rejected - unnecessary bundling for Electron

---

## 4. Tailwind CSS Setup for Electron

### Decision: Tailwind CLI + PostCSS (No Build Tools)

**Rationale**:
- **Tailwind CLI**: standalone tool, no webpack/vite needed
- **PostCSS**: processes Tailwind directives, autoprefixer for browser compat
- **JIT mode**: on-demand class generation, faster builds, smaller CSS
- **Content paths**: scan .html and .ts files for class names

**tailwind.config.js**:
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{ts,js}',
    './renderer.ts'
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1e40af',
        secondary: '#6b7280',
        accent: '#3b82f6',
        success: '#10b981',
        error: '#ef4444',
      },
    },
  },
  plugins: [],
}
```

**input.css**:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom app-specific styles */
@layer components {
  .metadata-card {
    @apply bg-white rounded-lg shadow-md p-4 border border-gray-200;
  }

  .queue-item {
    @apply flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors;
  }

  .btn-primary {
    @apply px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500;
  }
}
```

**postcss.config.js**:
```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**index.html** (link compiled CSS):
```html
<link rel="stylesheet" href="output.css" />
<!-- Keep styles.css for existing app styles -->
<link rel="stylesheet" href="styles.css" />
```

**Required Dependencies**:
- `tailwindcss` - core framework
- `postcss` - CSS processor
- `autoprefixer` - browser prefixes

**Alternatives Considered**:
- **Webpack + postcss-loader**: Rejected - overkill, slow builds
- **Vite**: Rejected - designed for web, not Electron
- **CDN link**: Rejected - violates offline requirement, security concerns

---

## 5. Headless UI Integration (Without React)

### Decision: Alpine.js + @headlessui/alpine for Accessible Components

**Rationale**:
- **Problem**: @headlessui/tailwindcss requires React (incompatible with vanilla JS)
- **Solution**: Alpine.js provides reactive directives in HTML (Vue-like syntax)
- **@headlessui/alpine**: Official Headless UI components for Alpine.js
- **Lightweight**: 15KB gzipped, no build step, works in renderer process
- **Accessible**: ARIA attributes, keyboard navigation, focus management built-in

**Installation**:
```bash
npm install alpinejs @headlessui/alpine
```

**Example: Batch Queue with Listbox (Accessible Dropdown)**:
```html
<!-- index.html -->
<div x-data="batchQueue()" class="max-w-2xl mx-auto p-4">
  <!-- Queue list -->
  <div x-show="files.length > 0" class="space-y-2">
    <template x-for="(file, index) in files" :key="index">
      <div
        class="queue-item cursor-pointer"
        :class="{ 'bg-blue-50 border-blue-500': selectedIndex === index }"
        @click="selectFile(index)"
      >
        <span x-text="file.filename" class="font-medium"></span>
        <button
          @click.stop="removeFile(index)"
          class="text-red-600 hover:text-red-800"
        >
          Remove
        </button>
      </div>
    </template>
  </div>

  <!-- Empty state -->
  <div x-show="files.length === 0" class="text-center py-8 text-gray-500">
    No files selected. Drag files here to add to batch.
  </div>
</div>

<script type="module">
  import Alpine from 'alpinejs'
  import Headless from '@headlessui/alpine'

  Alpine.plugin(Headless)

  Alpine.data('batchQueue', () => ({
    files: [],
    selectedIndex: null,

    selectFile(index) {
      this.selectedIndex = index;
      // Load metadata/preview for this file
      window.electronAPI.getFileMetadata(this.files[index].filePath)
        .then(metadata => {
          // Update UI with metadata
        });
    },

    removeFile(index) {
      this.files.splice(index, 1);
      if (this.selectedIndex === index) {
        this.selectedIndex = null;
      }
    }
  }))

  Alpine.start()
</script>
```

**Alternative Pattern: Vanilla JS with Tailwind Only**:
```typescript
// renderer.ts - Pure TypeScript without Alpine
class BatchQueueUI {
  private files: Array<{ filePath: string; filename: string }> = [];
  private selectedIndex: number | null = null;
  private container: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    this.render();
  }

  addFile(filePath: string, filename: string): void {
    this.files.push({ filePath, filename });
    this.render();
  }

  removeFile(index: number): void {
    this.files.splice(index, 1);
    if (this.selectedIndex === index) {
      this.selectedIndex = null;
    }
    this.render();
  }

  private render(): void {
    this.container.innerHTML = this.files.length === 0
      ? '<div class="text-center py-8 text-gray-500">No files selected.</div>'
      : this.files.map((file, i) => `
          <div
            class="queue-item ${i === this.selectedIndex ? 'bg-blue-50 border-blue-500' : ''}"
            onclick="batchQueue.selectFile(${i})"
          >
            <span class="font-medium">${file.filename}</span>
            <button
              onclick="event.stopPropagation(); batchQueue.removeFile(${i})"
              class="text-red-600 hover:text-red-800"
            >
              Remove
            </button>
          </div>
        `).join('');
  }

  selectFile(index: number): void {
    this.selectedIndex = index;
    // Load metadata/preview
    window.electronAPI.getFileMetadata(this.files[index].filePath);
  }
}

// Global instance
const batchQueue = new BatchQueueUI('batch-queue-container');
```

**Decision**: Use **Vanilla TypeScript approach** (second option)
- **Reason**: Simpler, no new framework, full TypeScript control
- **Trade-off**: Lose some Headless UI accessibility features, but can implement manually
- **Benefit**: Fewer dependencies, better debugging, explicit state management

**Alternatives Considered**:
- **Alpine.js + Headless UI**: Rejected - adds framework complexity
- **Lit (Web Components)**: Rejected - over-engineered for simple list
- **Preact**: Rejected - still React-like, unnecessary for non-reactive UI

---

## 6. Performance: fs.stat vs Manual Parsing for Metadata

### Decision: Hybrid Approach (fs.stat + Converter Reuse)

**Rationale**:
- `fs.stat()` provides instant file system metadata (<1ms)
- Line/word count requires content parsing (unavoidable)
- Reuse existing converter logic to avoid duplication
- Type-safe wrappers around converter outputs

**Implementation**:
```typescript
// src/types/fileMetadata.ts
export interface FileMetadata {
  filename: string;
  filePath: string;
  fileSize: number;
  lastModified: Date;
  lineCount: number;
  wordCount: number;
  charCount: number;
}

// src/utils/metadataExtractor.ts
import * as fs from 'fs';
import * as path from 'path';

export async function getFileMetadata(filePath: string): Promise<FileMetadata> {
  // Fast: file system stats
  const stats = fs.statSync(filePath);
  const filename = path.basename(filePath);
  const fileSize = stats.size;
  const lastModified = stats.mtime;

  // Slower: content analysis (reuse converters)
  const converter = getConverterForFile(filePath);
  const markdown = await converter.convert(filePath);

  const lines = markdown.split('\n');
  const words = markdown.split(/\s+/).filter(w => w.length > 0);

  return {
    filename,
    filePath,
    fileSize,
    lastModified,
    lineCount: lines.length,
    wordCount: words.length,
    charCount: markdown.length
  };
}

function getConverterForFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  // Return appropriate converter (TextToMarkdown, DocxToMarkdown, etc.)
  // TypeScript will enforce correct return type
}
```

**Performance Estimates**:
| File Type | Size | fs.stat | Text Extraction | Total |
|-----------|------|---------|----------------|-------|
| TXT       | 1MB  | <1ms    | ~50ms          | ~51ms |
| DOCX      | 5MB  | <1ms    | ~200ms         | ~201ms|
| PDF       | 10MB | <1ms    | ~800ms         | ~801ms|

---

## 7. Electron Dialog API for Multi-File Selection

### Decision: HTML `<input multiple>` + Typed IPC Wrapper

**Rationale**:
- HTML input already exists, just ensure `multiple` attribute present
- TypeScript wrapper provides type-safe access to file paths
- Electron dialog available as fallback for programmatic selection

**Type-Safe IPC Contract**:
```typescript
// src/types/ipc.ts
export interface ElectronAPI {
  selectFiles: (options: {
    allowMultiple: boolean;
    filters: Array<{ name: string; extensions: string[] }>;
  }) => Promise<string[] | null>;

  getFileMetadata: (filePath: string) => Promise<FileMetadata>;
  getFilePreview: (filePath: string, limit: { lines: number; chars: number }) => Promise<FilePreview>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
```

**preload.ts**:
```typescript
import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronAPI } from './src/types/ipc';

const api: ElectronAPI = {
  selectFiles: (options) => ipcRenderer.invoke('dialog:selectFiles', options),
  getFileMetadata: (filePath) => ipcRenderer.invoke('file:getMetadata', filePath),
  getFilePreview: (filePath, limit) => ipcRenderer.invoke('file:getPreview', filePath, limit),
};

contextBridge.exposeInMainWorld('electronAPI', api);
```

**renderer.ts** (type-safe usage):
```typescript
async function handleFileSelect() {
  const filePaths = await window.electronAPI.selectFiles({
    allowMultiple: true,
    filters: [
      { name: 'Supported Files', extensions: ['docx', 'pdf', 'xlsx', 'csv', 'txt'] }
    ]
  });

  if (filePaths) {
    for (const filePath of filePaths) {
      const metadata = await window.electronAPI.getFileMetadata(filePath);
      batchQueue.addFile(filePath, metadata.filename);
    }
  }
}
```

---

## 8. Batch Queue Memory Management

### Decision: In-Memory TypeScript Class with 50-File Soft Limit

**Rationale**:
- Type-safe queue class with clear interfaces
- Lazy loading of metadata/preview (only for selected file)
- 50 files × ~1KB metadata = ~50KB memory (negligible)

**Implementation**:
```typescript
// src/types/batchQueue.ts
export interface QueuedFile {
  filePath: string;
  filename: string;
  metadata: FileMetadata | null;
  preview: FilePreview | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface BatchProgress {
  currentFileNumber: number;
  totalFiles: number;
  currentFileProgress: number;  // 0-100
  overallProgress: number;       // 0-100
}

// src/utils/batchQueue.ts
export class BatchQueue {
  private files: QueuedFile[] = [];
  private readonly maxSize = 50;
  private currentIndex = 0;
  private status: 'idle' | 'processing' | 'paused' | 'completed' = 'idle';

  addFile(filePath: string, filename: string): void {
    if (this.files.length >= this.maxSize) {
      console.warn(`Queue size exceeds recommended limit (${this.maxSize})`);
    }

    this.files.push({
      filePath,
      filename,
      metadata: null,
      preview: null,
      status: 'pending'
    });
  }

  removeFile(index: number): void {
    this.files.splice(index, 1);
    if (this.currentIndex === index) {
      this.currentIndex = 0;
    }
  }

  async loadMetadataForFile(index: number): Promise<FileMetadata> {
    if (!this.files[index].metadata) {
      this.files[index].metadata = await window.electronAPI.getFileMetadata(
        this.files[index].filePath
      );
    }
    return this.files[index].metadata!;
  }

  getProgress(): BatchProgress {
    const total = this.files.length;
    const currentProgress = 50; // Would come from actual processing
    const overall = total > 0
      ? ((this.currentIndex + currentProgress / 100) / total) * 100
      : 0;

    return {
      currentFileNumber: this.currentIndex + 1,
      totalFiles: total,
      currentFileProgress: currentProgress,
      overallProgress: overall
    };
  }

  getFiles(): readonly QueuedFile[] {
    return Object.freeze([...this.files]);
  }
}
```

---

## Summary of Decisions

| Decision Area | Chosen Approach | Key Benefit |
|---------------|-----------------|-------------|
| **Language** | TypeScript 5.x with incremental JS migration | Type safety, better IDE support, catch errors at compile time |
| **Testing** | Mocha + Chai + ts-node | Runs .ts tests directly, no pre-compilation |
| **Styling** | Tailwind CSS (CLI + PostCSS) | Utility-first, fast builds, no bundler needed |
| **UI Components** | Vanilla TypeScript (no Alpine/Headless UI) | Simpler, full control, fewer dependencies |
| **File Preview** | Streaming with readline + Promise wrapper | Memory-efficient for large files |
| **Metadata** | Hybrid (fs.stat + converter reuse) | Fast for stats, accurate for content |
| **IPC Contracts** | Typed interfaces in src/types/ipc.ts | Compile-time validation, IntelliSense |
| **Queue** | TypeScript class with type-safe methods | Clear API, 50-file soft limit |

---

## Required New Dependencies

```json
{
  "dependencies": {
    "tailwindcss": "^3.4.0",
    "alpinejs": "^3.13.0",
    "@headlessui/alpine": "^1.0.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "ts-node": "^10.9.0",
    "@types/node": "^20.10.0",
    "@types/mocha": "^10.0.0",
    "@types/chai": "^4.3.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

---

## Open Questions (All Resolved)

All technical unknowns have been addressed. Ready for Phase 1 (data-model.md, contracts/, quickstart.md).
