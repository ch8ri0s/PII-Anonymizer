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
- **PDF Table Detection:** src/utils/pdfTableDetector.ts (auto-detects tables in PDFs)
- **PII Detection:** src/pii/SwissEuDetector.js
- **i18n:** src/i18n/ (EN/FR/DE support)
- **UI:** renderer.js, index.html, src/ui/
- **Tests:** test/ (101+ tests)

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
│   │   ├── previewGenerator.ts
│   │   └── pdfTableDetector.ts  # PDF table detection & Markdown conversion
│   │
│   └── types/                # TypeScript definitions
│       ├── index.ts
│       ├── ipc.ts
│       ├── filePreview.ts
│       ├── fileMetadata.ts
│       ├── batchQueue.ts
│       └── pdfTable.ts       # Table detection type definitions
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

### Adding New Validator

Validators use self-registration via `ValidatorRegistry`. To add a new validator:

1. Create `shared/pii/validators/MyValidator.ts`:
   ```typescript
   import type { ValidatorEntity, ValidationResult, ValidationRule, ValidatorEntityType } from './types.js';
   import { CONFIDENCE } from './confidence.js';
   import { registerValidator } from './registry.js';

   export class MyValidator implements ValidationRule {
     entityType: ValidatorEntityType = 'MY_TYPE';
     name = 'MyValidator';

     validate(entity: ValidatorEntity): ValidationResult {
       // Validation logic here
       return { isValid: true, confidence: CONFIDENCE.STANDARD };
     }
   }

   // Self-register on module import
   registerValidator(new MyValidator());
   ```

2. Export from `shared/pii/validators/index.ts`:
   ```typescript
   export { MyValidator, validateMy } from './MyValidator.js';
   ```

3. Add entity type to `ValidatorEntityType` in `shared/pii/validators/types.ts`

4. Add tests in `test/unit/pii/validators/MyValidator.test.js`

**That's it!** Only 2 files needed (validator + index export). The validator self-registers when imported.

### PDF Table Detection

The PDF converter automatically detects and converts tables to GitHub Flavored Markdown.

**Key Components:**
- `src/utils/pdfTableDetector.ts` - TableDetector and TableToMarkdownConverter classes
- `src/types/pdfTable.ts` - Type definitions for table structures

**Detection Methods:**
- **Lattice detection** - Bordered tables with clear gridlines (95%+ confidence)
- **Stream detection** - Borderless/whitespace-separated tables (80%+ confidence)
- **Letter layout detection** - Detects formal letters with sidebars (skips false table detection)

**Features:**
- Automatic column alignment (left for text, right for numeric)
- Multi-page table merging
- Special character escaping (pipes, backslashes)
- Graceful fallback to text extraction when detection fails
- Position-based text reconstruction for proper word spacing in PDFs
- Metadata in YAML frontmatter (tableCount, detectionMethod, confidence)

**Adding New Detection Heuristics:**
1. Update detection methods in `TableDetector` class
2. Adjust confidence scoring in `calculateLatticeConfidence()` or `calculateStreamConfidence()`
3. Add test fixtures in `test/fixtures/pdfTables.js`
4. Write tests in `test/unit/pdfTableDetector.test.js`

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

## Logging

This project uses a centralized logging system via `LoggerFactory`. **Never use `console.*` directly** - use the appropriate logger for your context.

### Quick Start

**Electron App (src/):**
```typescript
import { LoggerFactory } from './utils/LoggerFactory';
const log = LoggerFactory.create('my-module');

log.debug('Detailed info for troubleshooting', { data: value });
log.info('Significant event occurred', { result: 'success' });
log.warn('Something unexpected but recoverable', { issue: 'details' });
log.error('Something failed', { error: error.message });
```

**Browser App (browser-app/src/):**
```typescript
import { createLogger } from './utils/logger';
const log = createLogger('my-module');

log.debug('Detailed troubleshooting info', { data: value });
log.info('Significant event', { result: 'success' });
log.warn('Recoverable issue', { issue: 'details' });
log.error('Failure occurred', { error: error.message });
```

**Web Workers (browser-app/src/workers/):**
```typescript
import { createWorkerLogger } from '../utils/WorkerLogger';
const log = createWorkerLogger('ml:inference');

log.info('Processing started', { items: count });
log.error('Processing failed', { error: err.message }); // Flushes immediately
```

**Test Files:**
```javascript
// Electron tests (test/)
import { testLogger, createTestLogger } from '../helpers/testLogger.js';
testLogger.info('Test setup complete');
const log = createTestLogger('integration:pipeline');

// Browser-app tests (browser-app/test/)
import { testLogger, createTestLogger } from '../helpers/testLogger';
```

### Scope Naming Convention

Use `module:submodule` format matching directory structure:

| Directory | Scope Pattern | Example |
|-----------|---------------|---------|
| `src/pii/` | `pii:<module>` | `pii:pipeline`, `pii:rules` |
| `src/i18n/` | `i18n:<module>` | `i18n:renderer`, `i18n:service` |
| `src/converters/` | `converter:<type>` | `converter:pdf`, `converter:docx` |
| `browser-app/src/pwa/` | `pwa:<module>` | `pwa:manager`, `pwa:install` |
| `browser-app/src/services/` | `<service>` | `feedback:logger`, `feedback:store` |
| `browser-app/src/ui/` | `ui:<module>` | `ui:upload`, `ui:review` |
| `test/` | `test:<type>` | `test:integration`, `test:unit` |

### Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| `debug` | Detailed troubleshooting, disabled in production | Variable values, loop iterations |
| `info` | Significant events | Startup, completion, milestones |
| `warn` | Recoverable issues | Missing optional config, deprecations |
| `error` | Failures requiring attention | Exceptions, critical failures |

### PII Safety (Auto-Redaction)

LoggerFactory automatically redacts sensitive patterns in production:

| Pattern | Replacement |
|---------|-------------|
| Email addresses | `[EMAIL_REDACTED]` |
| Phone numbers | `[PHONE_REDACTED]` |
| IBANs (Swiss/EU) | `[IBAN_REDACTED]` |
| Swiss AHV numbers | `[AHV_REDACTED]` |
| File paths | `[PATH_REDACTED]` |

**Best Practice:** Use structured logging with metadata objects:
```typescript
// GOOD - metadata object, PII gets redacted
log.info('User registered', { email: user.email });

// BAD - string interpolation, PII may not be redacted in message
log.info(`User registered: ${user.email}`);
```

### Configuration

```bash
# Environment variable (preferred in CI/tests)
LOG_LEVEL=debug npm test    # Electron
VITE_LOG_LEVEL=debug npm test  # Browser-app
```

```typescript
// Programmatic (runtime)
LoggerFactory.setLevel('debug');           // Global level
LoggerFactory.setScopeLevel('pii', 'debug'); // Per-scope level
```

**Default Levels:**
- Development: `debug` (all logs visible)
- Production: `info` (Electron), `warn` (browser-app)
- Tests: `warn` (clean CI output), override with `LOG_LEVEL=debug`

### Anti-Patterns to Avoid

| Don't Do This | Do This Instead |
|---------------|-----------------|
| `console.log('debug info')` | `log.debug('debug info')` |
| `console.error(error)` | `log.error('Operation failed', { error: error.message })` |
| `log.info(\`User: ${email}\`)` | `log.info('User action', { email })` |
| `log.info('Processing item')` in a loop | `log.debug('Processing item')` |

### Troubleshooting

**Logs not appearing?**
1. Check log level - default is 'warn' in production/tests
2. Set environment variable: `LOG_LEVEL=debug` (Electron) or `VITE_LOG_LEVEL=debug` (browser-app)
3. Verify browser DevTools console filters (uncheck "Errors only")
4. Check scope-specific level settings

**Too many logs?**
1. Lower the level: `LoggerFactory.setLevel('warn')`
2. Filter specific scope: `LoggerFactory.setScopeLevel('pii', 'error')`
3. In tests, default is 'warn' for clean output

**Worker logs not appearing?**
1. Ensure main thread has `handleWorkerLogs` set up
2. Call `WorkerLogger.flush()` before worker termination
3. Check for errors in worker - they flush immediately

### Logger API Reference

```typescript
// Logger interface (all loggers implement this)
interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

// LoggerFactory (Electron)
LoggerFactory.create(scope: string): Logger
LoggerFactory.setLevel(level: LogLevel): void
LoggerFactory.setScopeLevel(scope: string, level: LogLevel): void
LoggerFactory.getLogFilePath(): string | null  // Electron only

// Browser logger
createLogger(scope: string): Logger
setLogLevel(level: LogLevel): void

// Worker logger
createWorkerLogger(scope: string): Logger
WorkerLogger.flush(): void
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

## Active Technologies
- TypeScript 5.x (converters), JavaScript ES2022 (main process) (019-pdf-table-detection)
- File system only (input PDFs, output Markdown, no database) (019-pdf-table-detection)

## Recent Changes
- 019-pdf-table-detection: Added TypeScript 5.x (converters), JavaScript ES2022 (main process)
