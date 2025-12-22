# A5-PII-Anonymizer - Architecture Document

## Executive Summary

A5-PII-Anonymizer is an Electron-based desktop application that processes documents locally to detect and anonymize PII for LLM-ready output. The architecture prioritizes privacy (100% local processing), extensibility (pluggable converters and detectors), and accuracy (multi-pass detection pipeline). This document captures architectural decisions for v3.0 enhancements while maintaining backward compatibility with the production v2.0.0 codebase.

---

## Decision Summary

| Category | Decision | Version | Affects Epics | Rationale |
|----------|----------|---------|---------------|-----------|
| Runtime | Electron | 39.1.1 | All | Desktop app with Node.js backend, Chromium renderer |
| Language | TypeScript (converters), JavaScript ES2022 (main) | TS 5.x | All | Gradual migration, type safety for new code |
| ML Framework | @xenova/transformers | 2.17.2 | Epic 1, 2 | Local inference, WASM-based, no Python dependency |
| Styling | Tailwind CSS | 3.x | Epic 4, 5 | Utility-first, responsive design |
| Testing | Mocha + Chai | Mocha 10.x | All | Existing test suite, 101+ tests passing |
| Build | electron-builder | Latest | All | Cross-platform packaging |
| IPC | contextBridge (isolated) | - | All | Security: no nodeIntegration in renderer |

---

## Project Structure

```
A5-PII-Anonymizer/
├── main.js                      # Electron main process entry
├── fileProcessor.js             # Core processing orchestration
├── renderer.js                  # UI logic (vanilla JS)
├── preload.cjs                  # Secure IPC bridge
├── index.html                   # Main window HTML
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── tailwind.config.js           # Tailwind CSS config
│
├── src/
│   ├── converters/              # Document format converters (TypeScript)
│   │   ├── DocxToMarkdown.ts
│   │   ├── PdfToMarkdown.ts
│   │   ├── ExcelToMarkdown.ts
│   │   ├── CsvToMarkdown.ts
│   │   ├── TextToMarkdown.ts
│   │   └── MarkdownConverter.ts # Base interface
│   │
│   ├── pii/                     # PII detection (JavaScript → TypeScript migration planned)
│   │   ├── SwissEuDetector.js   # Rule-based Swiss/EU patterns
│   │   ├── DetectionPipeline.ts # [NEW] Multi-pass orchestrator (Epic 1)
│   │   ├── AddressClassifier.ts # [NEW] Address component linking (Epic 2)
│   │   ├── DocumentClassifier.ts # [NEW] Document type detection (Epic 3)
│   │   ├── ContextScorer.ts     # [NEW] Context-based confidence (Epic 1)
│   │   ├── validators/          # [NEW] Format validators (Epic 1)
│   │   │   ├── SwissAvsValidator.ts
│   │   │   ├── IbanValidator.ts
│   │   │   └── PhoneValidator.ts
│   │   └── rules/               # [NEW] Document-type rules (Epic 3)
│   │       ├── InvoiceRules.ts
│   │       └── LetterRules.ts
│   │
│   ├── services/                # IPC handlers and services
│   │   ├── filePreviewHandlers.ts
│   │   ├── i18nHandlers.ts
│   │   ├── converterBridge.ts
│   │   ├── batchQueueManager.ts
│   │   └── feedbackLogger.ts    # [NEW] User correction logging (Epic 5)
│   │
│   ├── ui/                      # UI components
│   │   ├── filePreviewUI.ts
│   │   ├── EntitySidebar.ts     # [NEW] Entity review panel (Epic 4)
│   │   └── AccuracyDashboard.ts # [NEW] Stats display (Epic 5)
│   │
│   ├── i18n/                    # Internationalization
│   │   ├── i18nService.js
│   │   ├── languageDetector.js
│   │   ├── localeFormatter.js
│   │   └── rendererI18n.js
│   │
│   ├── config/                  # Configuration
│   │   ├── logging.js           # Logger with non-Electron fallback
│   │   └── detectionRules.json  # [NEW] Document-type rule config (Epic 3)
│   │
│   ├── utils/                   # Utilities
│   │   ├── metadataExtractor.ts
│   │   ├── pathValidator.ts
│   │   ├── previewGenerator.ts
│   │   ├── pdfTableDetector.ts
│   │   └── logger.ts
│   │
│   └── types/                   # TypeScript definitions
│       ├── index.ts
│       ├── ipc.ts
│       ├── filePreview.ts
│       ├── fileMetadata.ts
│       ├── batchQueue.ts
│       ├── pdfTable.ts
│       └── detection.ts         # [NEW] Detection pipeline types (Epic 1)
│
├── locales/                     # Translation files
│   ├── en.json
│   ├── fr.json
│   └── de.json
│
├── dist/                        # Compiled TypeScript output
│
├── test/                        # Test suites
│   ├── unit/
│   │   ├── converters/
│   │   ├── pii/                 # [NEW] Pipeline tests (Epic 1)
│   │   │   ├── DetectionPipeline.test.ts
│   │   │   ├── AddressClassifier.test.ts
│   │   │   └── DocumentClassifier.test.ts
│   │   └── i18n/
│   ├── integration/
│   │   └── pipeline.test.js     # [NEW] Multi-pass integration (Epic 1)
│   └── fixtures/
│       ├── piiAnnotated/        # [NEW] Golden test dataset
│       └── pdfTables.js
│
├── models/                      # ML model cache
│   └── Xenova/
│       └── distilbert-base-multilingual-cased-ner-hrl/
│
└── docs/                        # Documentation
    ├── prd.md
    ├── epics.md
    ├── architecture.md          # This document
    └── test-design-system.md    # System-level test design
```

---

## Epic to Architecture Mapping

| Epic | Primary Components | Secondary Components |
|------|-------------------|---------------------|
| Epic 1: Multi-Pass Detection | `src/pii/DetectionPipeline.ts`, `src/pii/ContextScorer.ts`, `src/pii/validators/` | `fileProcessor.js`, `src/types/detection.ts` |
| Epic 2: Address Modeling | `src/pii/AddressClassifier.ts` | `src/pii/SwissEuDetector.js`, mapping file schema |
| Epic 3: Document-Type Detection | `src/pii/DocumentClassifier.ts`, `src/pii/rules/`, `src/config/detectionRules.json` | `src/converters/PdfToMarkdown.ts` |
| Epic 4: User Review | `src/ui/EntitySidebar.ts`, `renderer.js`, `index.html` | `src/services/`, preload.cjs |
| Epic 5: Confidence & Feedback | `src/services/feedbackLogger.ts`, `src/ui/AccuracyDashboard.ts` | localStorage, electron app data |

---

## Technology Stack Details

### Core Technologies

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Electron | 39.1.1 | Desktop framework | Main + renderer process isolation |
| Node.js | 18+ | Runtime | ES modules, async/await |
| TypeScript | 5.x | Type safety | Strict mode, converters migrated |
| @xenova/transformers | 2.17.2 | ML inference | WASM-based, browser-compatible |
| Tailwind CSS | 3.x | Styling | Utility classes, JIT |

### Document Processing Libraries

| Library | Purpose | Notes |
|---------|---------|-------|
| mammoth | DOCX → HTML | Preserves structure |
| pdf-parse | PDF text extraction | With custom table detector |
| exceljs | Excel processing | Formulas, formatting |
| marked | Markdown validation | GFM support |
| turndown | HTML → Markdown | Table support |

### Integration Points

```
┌─────────────────────────────────────────────────────────────────┐
│                        MAIN PROCESS                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │fileProcessor │───▶│ Converters   │───▶│ PII Pipeline │       │
│  │     .js      │    │ (TypeScript) │    │ (TypeScript) │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                                       │                │
│         │ IPC (contextBridge)                   │                │
│         ▼                                       ▼                │
│  ┌──────────────┐                       ┌──────────────┐        │
│  │   Handlers   │                       │  ML Model    │        │
│  │ (TypeScript) │                       │  (WASM)      │        │
│  └──────────────┘                       └──────────────┘        │
└─────────────────────────────────────────────────────────────────┘
                              │ IPC
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │ renderer.js  │───▶│ UI Components│───▶│    i18n      │       │
│  │              │    │ (TypeScript) │    │ (JavaScript) │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Novel Pattern Designs

### Multi-Pass Detection Pipeline (Epic 1)

**Purpose:** Improve PII detection accuracy from 94% to 98%+ by separating concerns into distinct passes.

**Architecture:**

```typescript
interface DetectionPass {
  name: string;
  execute(text: string, entities: Entity[], context: PipelineContext): Promise<Entity[]>;
}

class DetectionPipeline {
  private passes: DetectionPass[] = [];

  async process(text: string): Promise<DetectionResult> {
    let entities: Entity[] = [];
    const context = new PipelineContext();

    for (const pass of this.passes) {
      entities = await pass.execute(text, entities, context);
      context.recordPassResults(pass.name, entities);
    }

    return { entities, metadata: context.getMetadata() };
  }
}
```

**Pass Sequence:**

1. **Pass 1 - High Recall Detection**
   - ML model with lowered threshold (0.3)
   - All SwissEuDetector patterns
   - Output: Raw entities with source tags

2. **Pass 2 - Format Validation**
   - AVS checksum validation
   - IBAN country + checksum
   - Phone format compliance
   - Output: Entities with validation status

3. **Pass 3 - Context Scoring**
   - Proximity analysis
   - Label keyword detection
   - Document position weighting
   - Output: Entities with confidence scores

4. **Pass 4 - Document-Type Adjustment (Optional)**
   - Applies document-type-specific rules
   - Adjusts confidence based on context
   - Output: Final entity list

### Address Component Linking (Epic 2)

**Purpose:** Group address components into unified ADDRESS entities.

**Data Flow:**

```
Input: "Rue de Lausanne 12, 1000 Lausanne"

Step 1 - Component Classification:
  [STREET_NAME: "Rue de Lausanne", pos: 0-16]
  [STREET_NUMBER: "12", pos: 17-19]
  [POSTAL_CODE: "1000", pos: 21-24]
  [CITY: "Lausanne", pos: 26-34]

Step 2 - Proximity Linking:
  Group components within 50 chars: [all 4 components]

Step 3 - Pattern Matching:
  Matches Swiss pattern: [Street] [Number], [Postal] [City]

Step 4 - Confidence Scoring:
  completeness: 4/5 components = +0.8
  pattern_match: Swiss format = +0.3
  postal_valid: 1000 is valid = +0.2
  city_valid: "Lausanne" known = +0.1
  Total: 1.0 (capped) = HIGH confidence

Output:
  {
    type: "ADDRESS",
    text: "Rue de Lausanne 12, 1000 Lausanne",
    confidence: 1.0,
    components: {
      street: "Rue de Lausanne",
      number: "12",
      postal: "1000",
      city: "Lausanne"
    }
  }
```

---

## Implementation Patterns

These patterns ensure consistent implementation across all AI agents:

### Naming Conventions

| Category | Convention | Example |
|----------|------------|---------|
| TypeScript files | PascalCase.ts | `DetectionPipeline.ts` |
| JavaScript files | camelCase.js | `fileProcessor.js` |
| Test files | *.test.ts / *.test.js | `DetectionPipeline.test.ts` |
| Type definitions | PascalCase | `interface Entity {}` |
| Functions | camelCase | `processDocument()` |
| Constants | SCREAMING_SNAKE | `MAX_FILE_SIZE` |
| IPC channels | kebab-case | `'file:process'` |

### Code Organization

| Pattern | Rule |
|---------|------|
| New features | TypeScript in `src/` directory |
| Tests | Co-located in `test/` mirroring `src/` structure |
| Shared types | `src/types/` directory |
| Utilities | `src/utils/` directory |
| IPC handlers | `src/services/` directory |

### Error Handling

```typescript
// Pattern: Wrap async operations with try-catch
async function processFile(filePath: string): Promise<ProcessResult> {
  try {
    validatePath(filePath); // Throws on invalid path
    const content = await readFile(filePath);
    return await processContent(content);
  } catch (error) {
    logger.error('File processing failed', { filePath, error });
    throw new ProcessingError(`Failed to process ${filePath}: ${error.message}`);
  }
}

// Pattern: Custom error classes
class ProcessingError extends Error {
  constructor(message: string, public readonly code: string = 'PROCESSING_ERROR') {
    super(message);
    this.name = 'ProcessingError';
  }
}
```

### Logging Strategy

```typescript
// Pattern: Structured logging with levels
import { logger } from '../config/logging';

// Levels: error, warn, info, debug
logger.info('Processing started', { filePath, fileSize });
logger.debug('Entity detected', { entity, confidence });
logger.warn('Low confidence entity', { entity, confidence, threshold });
logger.error('Processing failed', { error, context });

// Never log PII content - only metadata
logger.info('Entity found', { type: entity.type, position: entity.start }); // Good
logger.info('Entity found', { text: entity.text }); // BAD - leaks PII
```

---

## Consistency Rules

### IPC Communication

```typescript
// Main process handler pattern
ipcMain.handle('pii:detect', async (event, { text, options }) => {
  // 1. Validate input
  if (typeof text !== 'string') {
    throw new ValidationError('Text must be a string');
  }

  // 2. Process
  const result = await pipeline.process(text, options);

  // 3. Return serializable result
  return {
    entities: result.entities.map(e => e.toJSON()),
    metadata: result.metadata
  };
});

// Renderer invocation pattern
const result = await window.electronAPI.detectPII(text, options);
```

### Entity Data Structure

```typescript
interface Entity {
  type: EntityType;           // 'PERSON' | 'ORG' | 'ADDRESS' | etc.
  text: string;               // Original matched text
  start: number;              // Start position in document
  end: number;                // End position in document
  confidence: number;         // 0.0 - 1.0
  source: 'ML' | 'RULE' | 'BOTH' | 'MANUAL';
  validationStatus?: 'valid' | 'invalid' | 'unknown';
  components?: Record<string, string>;  // For compound entities like ADDRESS
}
```

### Mapping File Format

```json
{
  "version": "2.0",
  "generated": "2024-01-15T10:30:00Z",
  "sourceFile": "document.pdf",
  "entities": {
    "PERSON_1": {
      "original": "Jean Pierre Müller",
      "type": "PERSON",
      "occurrences": 3
    },
    "ADDRESS_1": {
      "original": "Rue de Lausanne 12, 1000 Lausanne",
      "type": "ADDRESS",
      "components": {
        "street": "Rue de Lausanne",
        "number": "12",
        "postal": "1000",
        "city": "Lausanne"
      },
      "occurrences": 1
    }
  },
  "statistics": {
    "totalEntities": 15,
    "byType": {
      "PERSON": 5,
      "ADDRESS": 3,
      "PHONE": 2,
      "EMAIL": 5
    }
  }
}
```

---

## Data Architecture

### Entity Type Taxonomy

```
PII_ENTITY
├── PERSON              # Individual names
├── ORG                 # Organization names
├── LOCATION
│   ├── ADDRESS         # Full postal addresses
│   ├── CITY            # City names only
│   └── COUNTRY         # Country names only
├── CONTACT
│   ├── EMAIL           # Email addresses
│   ├── PHONE           # Phone numbers
│   └── URL             # Web URLs (optional)
├── IDENTIFIER
│   ├── SWISS_AVS       # Swiss social security
│   ├── IBAN            # Bank account
│   ├── ID_NUMBER       # Contract/reference numbers
│   └── VAT_NUMBER      # VAT registration
├── TEMPORAL
│   └── DATE            # Date values
└── FINANCIAL
    └── AMOUNT          # Currency amounts (optional)
```

### Configuration Schema

```typescript
// src/config/detectionRules.json
interface DetectionRulesConfig {
  documentTypes: {
    [type: string]: {
      rules: string[];           // Rule names to apply
      confidenceBoost: {
        [area: string]: number;  // Area-specific boosts
      };
    };
  };
  entityTypes: {
    [type: string]: {
      enabled: boolean;
      minimumConfidence: number;
      validator?: string;        // Validator function name
    };
  };
  pipeline: {
    passes: string[];            // Pass execution order
    timeout: number;             // Per-pass timeout (ms)
  };
}
```

---

## API Contracts

### Detection Pipeline API

```typescript
// Input
interface ProcessRequest {
  text: string;
  options?: {
    documentType?: 'INVOICE' | 'LETTER' | 'FORM' | 'CONTRACT' | 'REPORT' | 'UNKNOWN';
    passes?: string[];           // Override default passes
    confidenceThreshold?: number;
    includeMetadata?: boolean;
  };
}

// Output
interface ProcessResponse {
  entities: Entity[];
  metadata?: {
    processingTime: number;
    passResults: PassResult[];
    documentType: string;
    confidence: number;
  };
}

// IPC Channel: 'pii:detect'
```

### File Processing API

```typescript
// Input
interface FileProcessRequest {
  inputPath: string;
  outputPath: string;
  options?: {
    format?: 'markdown';
    includeMapping?: boolean;
    entitySelection?: string[];  // Entity IDs to anonymize (partial)
  };
}

// Output
interface FileProcessResponse {
  success: boolean;
  outputPath: string;
  mappingPath?: string;
  statistics: ProcessingStatistics;
  errors?: ProcessingError[];
}

// IPC Channel: 'file:process'
```

---

## Security Architecture

### Electron Security Configuration

```javascript
// main.js - BrowserWindow configuration
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,        // CRITICAL: Disabled
    contextIsolation: true,        // CRITICAL: Enabled
    sandbox: true,                 // CRITICAL: Enabled
    preload: path.join(__dirname, 'preload.cjs'),
    webSecurity: true,
    allowRunningInsecureContent: false,
  }
});
```

### IPC Security

```javascript
// preload.cjs - Exposed API
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations - validated paths only
  processFile: (inputPath, outputPath, options) =>
    ipcRenderer.invoke('file:process', { inputPath, outputPath, options }),

  // PII detection - text only, no file access
  detectPII: (text, options) =>
    ipcRenderer.invoke('pii:detect', { text, options }),

  // i18n - read-only
  getTranslations: (lang) =>
    ipcRenderer.invoke('i18n:get', { lang }),
});
```

### Path Validation

```typescript
// src/utils/pathValidator.ts
function validatePath(userPath: string): string {
  const resolved = path.resolve(userPath);

  // Prevent directory traversal
  if (resolved.includes('..')) {
    throw new SecurityError('Directory traversal detected');
  }

  // Validate within allowed directories
  const allowedDirs = [app.getPath('documents'), app.getPath('downloads')];
  if (!allowedDirs.some(dir => resolved.startsWith(dir))) {
    throw new SecurityError('Path outside allowed directories');
  }

  return resolved;
}
```

### Data Protection

| Principle | Implementation |
|-----------|---------------|
| No network calls | All processing local, model cached |
| No telemetry | Zero analytics or tracking |
| Secure temp files | Auto-cleanup on process exit |
| No PII logging | Only metadata logged, never content |
| Reversible anonymization | Mapping file for authorized re-identification |

---

## Performance Considerations

### Processing Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Model load (first use) | <30s | WASM compilation |
| Model load (cached) | <5s | Pre-compiled cache |
| Document processing (10 pages) | <30s | Including all passes |
| Memory (idle) | <300MB | Electron overhead |
| Memory (processing) | <1GB | Model + document |

### Optimization Strategies

1. **Model Caching**: WASM model cached in `models/Xenova/`
2. **Lazy Loading**: ML model loaded on first detection request
3. **Batch Processing**: Queue manager prevents memory overflow
4. **Streaming**: Large files processed in chunks
5. **Worker Threads**: CPU-intensive passes in worker threads (future)

---

## Deployment Architecture

### Build Targets

| Platform | Format | Notes |
|----------|--------|-------|
| macOS (Intel) | DMG | Code signed |
| macOS (Apple Silicon) | DMG | Universal binary |
| Windows 10/11 | NSIS installer | Code signed |
| Linux | AppImage, DEB | x64 |

### Auto-Update

```javascript
// electron-builder config
"publish": {
  "provider": "github",
  "releaseType": "release"
}
```

### System Requirements

- **RAM**: 4GB minimum, 8GB recommended
- **Disk**: 1GB (500MB for model)
- **OS**: macOS 10.15+, Windows 10+, Ubuntu 20.04+

---

## Development Environment

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 8+
- Git

### Setup Commands

```bash
# Clone repository
git clone https://github.com/your-org/A5-PII-Anonymizer.git
cd A5-PII-Anonymizer

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Build Tailwind CSS
npm run css:build

# Run in development mode
npm run dev

# Run tests
npm test
```

### Development Scripts

```bash
npm run dev              # Start Electron in dev mode
npm run compile          # Compile TypeScript once
npm run compile:watch    # Watch TypeScript changes
npm run css:build        # Build Tailwind CSS
npm run css:watch        # Watch CSS changes
npm run lint             # Run ESLint
npm run lint:fix         # Auto-fix ESLint issues
npm test                 # Run all tests
npm run test:watch       # Watch mode for tests
```

---

## Architecture Decision Records (ADRs)

### ADR-001: Multi-Pass Pipeline Architecture

**Status:** Accepted
**Context:** Current single-pass detection achieves 94% accuracy but misses entity relationships.
**Decision:** Implement multi-pass pipeline with separate detection, validation, and scoring passes.
**Consequences:**
- (+) Improved accuracy potential (98%+ target)
- (+) Modular, testable passes
- (-) Increased processing time (~2x)
- (-) More complex codebase

### ADR-002: TypeScript Migration Strategy

**Status:** Accepted
**Context:** Existing JavaScript codebase needs type safety for new features.
**Decision:** Gradual migration - new code in TypeScript, existing code migrated as touched.
**Consequences:**
- (+) Immediate type safety for new code
- (+) No "big bang" migration risk
- (-) Mixed codebase during transition
- (-) Need to maintain both compile paths

### ADR-003: Local-First ML Inference

**Status:** Accepted
**Context:** Privacy requires no cloud API calls for PII detection.
**Decision:** Use @xenova/transformers for local WASM-based inference.
**Consequences:**
- (+) 100% local processing
- (+) No API costs or rate limits
- (-) ~500MB model download
- (-) Slower than cloud inference
- (-) Model updates require app update

### ADR-004: IPC Context Isolation

**Status:** Accepted
**Context:** Electron apps are vulnerable to XSS and RCE attacks.
**Decision:** Strict context isolation with contextBridge API.
**Consequences:**
- (+) Renderer cannot access Node.js APIs
- (+) Explicit, auditable API surface
- (-) All IPC must be explicitly defined
- (-) Slightly more boilerplate

### ADR-005: Address Component Linking

**Status:** Accepted
**Context:** Address components detected separately cause partial anonymization.
**Decision:** Implement proximity-based component linking with pattern matching.
**Consequences:**
- (+) Addresses anonymized as complete units
- (+) Mapping file preserves components
- (-) Increased complexity in anonymization logic
- (-) Need to handle partial matches gracefully

---

_Generated by BMAD Decision Architecture Workflow v1.0_
_Date: 2025-12-05_
_For: Olivier_
