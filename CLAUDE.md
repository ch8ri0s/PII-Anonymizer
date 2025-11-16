# A5-PII-Anonymizer Development Guidelines

> Electron desktop app for anonymising documents to LLM-ready Markdown with EU/Swiss PII detection

## Overview

**Type:** Desktop Application (Electron)
**Purpose:** Privacy-preserving document conversion with PII detection
**Team Size:** Small team
**Phase:** Production (v2.0.0)

## Quick Navigation

- **Core Processing:** fileProcessor.js, main.js
- **Converters:** src/converters/ (DOCX, PDF, Excel, CSV, Text → Markdown)
- **PII Detection:** src/pii/SwissEuDetector.js
- **i18n:** src/i18n/ (EN/FR/DE support)
- **UI:** renderer.js, index.html, src/ui/
- **Tests:** test/ (139 tests)

## Tech Stack

### Core Framework
- **Electron 39.1.1** - Desktop application framework
- **Node.js 18+** - Runtime (ES modules)
- **TypeScript 5.x** - Type-safe development

### UI & Styling
- **Tailwind CSS 3.x** - Utility-first styling
- **@headlessui/tailwindcss** - Accessible UI components
- **Vanilla JavaScript** - Renderer process (no framework)

### Document Processing
- **mammoth** - DOCX extraction
- **pdf-parse** - PDF parsing
- **exceljs** - Excel processing
- **marked** - Markdown validation
- **turndown** - HTML to Markdown conversion

### ML & AI
- **@xenova/transformers 2.17.2** - Local PII detection model
- **BetterData AI PII Model** - 94%+ accuracy

### i18n
- **Custom JSON-based solution** - Zero external dependencies
- **Languages:** EN, FR, DE

## Project Structure

```
├── main.js                   # Electron main process
├── fileProcessor.js          # Core document processing logic
├── renderer.js               # UI logic & event handlers
├── preload.cjs               # Secure IPC bridge
├── index.html                # Main UI layout
│
├── src/
│   ├── converters/           # Format-specific converters
│   │   ├── DocxToMarkdown.ts
│   │   ├── PdfToMarkdown.ts
│   │   ├── ExcelToMarkdown.ts
│   │   ├── CsvToMarkdown.ts
│   │   └── TextToMarkdown.ts
│   │
│   ├── pii/                  # PII detection
│   │   └── SwissEuDetector.js
│   │
│   ├── i18n/                 # Internationalization
│   │   ├── i18nService.js
│   │   ├── languageDetector.js
│   │   ├── localeFormatter.js
│   │   └── rendererI18n.js
│   │
│   ├── services/             # IPC handlers
│   │   ├── filePreviewHandlers.ts
│   │   ├── i18nHandlers.ts
│   │   ├── converterBridge.ts
│   │   └── batchQueueManager.ts
│   │
│   ├── ui/                   # UI components
│   │   └── filePreviewUI.ts
│   │
│   ├── utils/                # Utilities
│   │   ├── metadataExtractor.ts
│   │   ├── pathValidator.ts
│   │   └── previewGenerator.ts
│   │
│   └── types/                # TypeScript definitions
│       ├── index.ts
│       ├── ipc.ts
│       ├── filePreview.ts
│       ├── fileMetadata.ts
│       └── batchQueue.ts
│
├── locales/                  # Translation files
│   ├── en.json
│   ├── fr.json
│   └── de.json
│
├── test/                     # Test suites
│   ├── unit/
│   └── integration/
│
└── dist/                     # Compiled TypeScript
```

## Development Workflow

### Setup & Installation

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Build CSS
npm run css:build

# Development mode
npm run dev
```

### Development Commands

```bash
npm run dev              # Run Electron app in development
npm run typecheck        # Type-check TypeScript without emitting files
npm run compile          # Compile TypeScript once
npm run compile:watch    # Watch TypeScript changes
npm run lint             # Run ESLint on all files
npm run lint:fix         # Run ESLint and auto-fix issues
npm run lint:check       # Run ESLint with zero warnings allowed
npm run css:build        # Build Tailwind CSS once
npm run css:watch        # Watch CSS changes
npm test                 # Run all tests
npm run test:watch       # Watch test files
npm run test:i18n        # Run i18n tests only
```

### Building for Production

```bash
npm run build            # Build for all platforms
npm run build:mac        # macOS only
npm run build:win        # Windows only
npm run build:linux      # Linux only
```

## Code Style & Standards

### TypeScript Guidelines
- **Strict mode enabled** - `tsconfig.json` enforces type safety
- **Explicit types** - Avoid `any`, use specific types
- **Async/await** - Prefer over callbacks
- **Error handling** - Always use try-catch for async operations
- **IPC validation** - Validate all IPC inputs (security requirement)

### JavaScript Guidelines
- **ES modules** - Use `import/export` syntax
- **Descriptive names** - Variables, functions, files
- **Comments** - JSDoc for public APIs
- **Error handling** - Proper error messages and logging

### File Organization
- **TypeScript** → `src/` directory, compiles to `dist/`
- **JavaScript** → Root level for Electron processes
- **Types** → `src/types/` for shared TypeScript interfaces
- **Tests** → `test/` with same structure as `src/`

## Testing Requirements

### Test Coverage Goals
- **Unit tests:** 80%+ coverage for core logic
- **Integration tests:** Critical workflows (file upload → processing → download)
- **i18n tests:** Translation coverage validation

### Running Tests

```bash
npm test                        # All tests (139 currently passing)
npm run test:i18n               # i18n-specific tests
npm run test:i18n:coverage      # Translation coverage report
npm run test:watch              # Watch mode
```

### Test Structure
- Use **Mocha** + **Chai** for all tests
- Place tests in `test/` mirroring `src/` structure
- 10-second timeout for async operations
- Mock external dependencies (file system, models)

## Security Requirements

### Critical Security Rules

1. **Input Validation**
   - Validate all file paths (prevent directory traversal)
   - Sanitize all user inputs
   - Check file types before processing

2. **IPC Security**
   - Use `contextIsolation: true`
   - Validate all IPC messages
   - No direct `nodeIntegration` in renderer

3. **Path Handling**
   - Use `pathValidator.ts` for all path operations
   - Never construct paths from user input directly
   - Validate file extensions

4. **Privacy**
   - 100% local processing (no network calls)
   - No telemetry or tracking
   - Secure file handling (temp files cleaned up)

**See:** [SECURITY.md](./SECURITY.md) for full audit

## Architecture Patterns

### Electron Process Model

```
┌─────────────────┐
│   Main Process  │ (main.js, fileProcessor.js)
│                 │
│ - File I/O      │
│ - PII Detection │
│ - IPC Handlers  │
└────────┬────────┘
         │ IPC
         │ (contextBridge)
┌────────┴────────┐
│ Renderer Process│ (renderer.js, UI)
│                 │
│ - UI Logic      │
│ - i18n Display  │
│ - Event Handling│
└─────────────────┘
```

### Processing Pipeline

```
File Upload → Type Detection → Preview Generation →
PII Detection → Anonymization → Markdown Conversion →
Mapping File → Download
```

### i18n Architecture
- **Detection:** Auto-detect OS language on startup
- **Service:** Central i18nService manages translations
- **Renderer:** rendererI18n handles UI updates
- **Persistence:** Language preference saved to localStorage

## Common Workflows

### Adding New File Format Converter

1. Create `src/converters/FormatToMarkdown.ts`
2. Implement `MarkdownConverter` interface
3. Add to `converterBridge.ts` format map
4. Update file type validation in `fileProcessor.js`
5. Add tests in `test/unit/converters/`
6. Update documentation

### Adding New Translation

1. Add translations to `locales/{lang}.json`
2. Run `npm run test:i18n:coverage` to verify completeness
3. Test UI with new language
4. Update language detector if adding new language
5. Document in I18N_GUIDE.md

### Adding New PII Pattern

1. Update `src/pii/SwissEuDetector.js`
2. Add regex pattern with validation
3. Add to `getMatches()` method
4. Create test cases with real-world examples
5. Verify accuracy with `test-pii-accuracy.js`

## Debugging Tips

### Electron DevTools
- **Main process:** `console.log` → Terminal
- **Renderer process:** F12 → Browser DevTools
- **IPC messages:** Enable verbose logging in main.js

### Common Issues

**TypeScript compilation errors:**
```bash
npm run compile  # Check for type errors
```

**CSS not updating:**
```bash
npm run css:build  # Rebuild Tailwind
```

**Model not loading:**
- Check internet connection on first run
- Model downloads to `models/Xenova/` (~500MB)
- Check disk space

**Tests failing:**
```bash
npm run test:watch  # Watch mode for debugging
```

## Environment & Configuration

### Required Environment
- **Node.js:** 18+ (ES modules support)
- **npm:** 8+
- **Disk space:** 1GB+ (includes model)

### Configuration Files
- `package.json` - Dependencies & scripts
- `tsconfig.json` - TypeScript compilation
- `tailwind.config.js` - CSS utility configuration
- `postcss.config.js` - CSS processing

## Performance Considerations

- **Model loading:** First-time download ~500MB, cached afterward
- **Large files:** PDF parsing can be slow (>10MB files)
- **Batch processing:** Queue manager prevents memory overflow
- **i18n:** Minimal overhead, no external library bloat

## Resources

- **Security Audit:** [SECURITY.md](./SECURITY.md)
- **i18n Guide:** [I18N_GUIDE.md](./I18N_GUIDE.md)
- **Implementation Notes:** [I18N_IMPLEMENTATION_SUMMARY.md](./I18N_IMPLEMENTATION_SUMMARY.md)
- **Accuracy Results:** [ACCURACY_MILESTONE.md](./ACCURACY_MILESTONE.md)

## Version Information

**Current Version:** 2.0.0
**Electron:** 39.1.1
**TypeScript:** 5.x
**Last Updated:** 2025-11-16
