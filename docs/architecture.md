# A5-PII-Anonymizer - Architecture Document

## Executive Summary

A5-PII-Anonymizer is a privacy-first document anonymization platform that processes documents locally to detect and anonymize PII for LLM-ready output. The architecture supports both **Electron desktop** and **browser PWA** deployments, prioritizing privacy (100% local processing), extensibility (pluggable converters and detectors), and accuracy (multi-pass detection pipeline). This document captures architectural decisions for v3.0 enhancements including the browser app (Epic 9), centralized logging (Epic 10), and ML enhancements (Epic 8).

---

## Decision Summary

| Category | Decision | Version | Affects Epics | Rationale |
|----------|----------|---------|---------------|-----------|
| Runtime | Electron + Browser (PWA) | 39.1.1 / Vite | All | Desktop app with Node.js backend; Browser app for web deployment |
| Language | TypeScript | 5.9.x | All | Full TypeScript coverage in src/, browser-app/, shared/ |
| ML Framework | @xenova/transformers | 2.17.2 | Epic 1, 2, 8 | Local inference, WASM-based, no Python dependency |
| Styling | Tailwind CSS | 3.x | Epic 4, 5 | Utility-first, responsive design |
| Testing | Mocha + Chai | Mocha 11.x | All | 139+ tests passing |
| Build | electron-builder / Vite | Latest | All | Cross-platform packaging; browser bundling |
| IPC | contextBridge (isolated) | - | All | Security: no nodeIntegration in renderer |
| Logging | LoggerFactory + electron-log | 5.4.x | Epic 10 | Centralized logging with PII redaction |
| Validation | zod | 3.x | All | Runtime schema validation |

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
├── eslint.config.js             # ESLint flat config
│
├── browser-app/                 # [NEW] Standalone browser version (Epic 9)
│   ├── src/
│   │   ├── main.ts              # Browser app entry point
│   │   ├── batch/               # Batch processing (BatchQueueManager)
│   │   ├── components/          # UI components
│   │   │   ├── EntitySidebar.ts
│   │   │   ├── PreviewPanel.ts
│   │   │   ├── BatchController.ts
│   │   │   ├── KeyboardShortcuts.ts
│   │   │   ├── preview/         # Preview subcomponents
│   │   │   └── sidebar/         # Sidebar subcomponents
│   │   ├── converters/          # Browser-compatible converters
│   │   │   ├── CsvConverter.ts
│   │   │   ├── DocxConverter.ts
│   │   │   ├── ExcelConverter.ts
│   │   │   ├── PdfConverter.ts
│   │   │   └── TextConverter.ts
│   │   ├── download/            # File download handling
│   │   ├── errors/              # Error handling
│   │   ├── i18n/                # Browser i18n service
│   │   ├── model/               # ML model management
│   │   │   └── ModelManager.ts
│   │   ├── pii/                 # Browser-specific PII passes
│   │   │   ├── BrowserHighRecallPass.ts
│   │   │   ├── BrowserDocumentTypePass.ts
│   │   │   ├── BrowserRuleEngine.ts
│   │   │   ├── BrowserSwissPostalDatabase.ts
│   │   │   └── BrowserAddressRelationshipPass.ts
│   │   ├── processing/          # Processing pipeline
│   │   │   ├── FileProcessor.ts
│   │   │   ├── PIIDetector.ts
│   │   │   └── Anonymizer.ts
│   │   ├── pwa/                 # PWA support
│   │   │   ├── PWAManager.ts
│   │   │   ├── PWAInstallBanner.ts
│   │   │   └── PWAStatusIndicator.ts
│   │   ├── services/            # Browser services
│   │   │   ├── FeedbackLogger.ts
│   │   │   ├── FeedbackStore.ts
│   │   │   └── FeedbackIntegration.ts
│   │   ├── ui/                  # UI modules
│   │   ├── utils/               # Utilities
│   │   │   ├── logger.ts        # Browser-compatible logger
│   │   │   └── WorkerLogger.ts  # Web Worker logger
│   │   └── workers/             # Web Workers
│   │       └── pii.worker.ts    # Background PII detection
│   ├── test/                    # Browser-app tests
│   ├── package.json             # Browser-app dependencies (Vite)
│   └── vite.config.ts           # Vite configuration
│
├── shared/                      # Shared code (Electron + Browser)
│   ├── converters/              # Shared converter utilities
│   │   ├── CsvConverter.ts
│   │   ├── DocxConverter.ts
│   │   ├── ExcelConverter.ts
│   │   ├── PdfTextProcessor.ts
│   │   ├── TextConverter.ts
│   │   ├── MarkdownUtils.ts
│   │   ├── types.ts
│   │   └── index.ts
│   ├── pii/                     # Shared PII detection modules
│   │   ├── context/             # Context enhancement (Epic 8)
│   │   │   ├── ContextEnhancer.ts
│   │   │   ├── ContextWords.ts
│   │   │   └── DenyList.ts
│   │   ├── countries/           # Country-specific recognizers
│   │   │   ├── ch/              # Swiss-specific (AvsRecognizer)
│   │   │   ├── eu/              # EU patterns
│   │   │   ├── us/              # US patterns
│   │   │   └── core/            # Core patterns
│   │   ├── feedback/            # Feedback aggregation (Epic 5)
│   │   │   ├── FeedbackAggregator.ts
│   │   │   └── types.ts
│   │   ├── ml/                  # ML processing (Epic 8)
│   │   │   ├── MLInputValidator.ts
│   │   │   ├── MLMetrics.ts
│   │   │   ├── MLRetryHandler.ts
│   │   │   ├── SubwordTokenMerger.ts
│   │   │   └── TextChunker.ts
│   │   ├── postprocessing/      # Post-processing passes (Epic 8)
│   │   │   └── ConsolidationPass.ts  # Story 8.8
│   │   ├── preprocessing/       # Text normalization (Epic 8)
│   │   │   ├── TextNormalizer.ts
│   │   │   └── Lemmatizer.ts
│   │   ├── recognizers/         # Pluggable recognizer framework
│   │   │   ├── BaseRecognizer.ts
│   │   │   ├── Registry.ts
│   │   │   ├── YamlLoader.ts
│   │   │   └── types.ts
│   │   ├── HighRecallPatterns.ts
│   │   ├── RuleEngineConfig.ts
│   │   ├── SwissPostalData.ts
│   │   └── index.ts
│   ├── test/                    # Shared test utilities
│   │   ├── accuracy.ts          # Precision/recall calculation
│   │   ├── constants.ts
│   │   ├── expectedResults.ts
│   │   └── helpers.ts
│   ├── types/                   # Shared type definitions
│   │   ├── index.ts
│   │   └── pdfTable.ts
│   ├── utils/                   # Shared utilities
│   │   ├── TableDetector.ts
│   │   ├── TableToMarkdownConverter.ts
│   │   └── pdfTableDetector.ts
│   └── tsconfig.json
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
│   ├── core/                    # [NEW] Core business logic (Epic 10)
│   │   ├── Session.ts           # Session management
│   │   ├── anonymization.ts     # Anonymization engine
│   │   ├── fileProcessor.ts     # TypeScript file processor
│   │   └── index.ts
│   │
│   ├── pii/                     # PII detection (TypeScript)
│   │   ├── SwissEuDetector.ts   # Rule-based Swiss/EU patterns
│   │   ├── DetectionPipeline.ts # Multi-pass orchestrator (Epic 1)
│   │   ├── RuleEngine.ts        # Configurable rule engine
│   │   ├── AddressClassifier.ts # Address component linking (Epic 2)
│   │   ├── AddressComponentDetector.ts
│   │   ├── AddressLinker.ts
│   │   ├── AddressScorer.ts
│   │   ├── DocumentClassifier.ts # Document type detection (Epic 3)
│   │   ├── SwissPostalDatabase.ts
│   │   ├── passes/              # Detection passes
│   │   │   ├── HighRecallPass.ts
│   │   │   ├── FormatValidationPass.ts
│   │   │   ├── ContextScoringPass.ts
│   │   │   ├── DocumentTypePass.ts
│   │   │   ├── AddressRelationshipPass.ts
│   │   │   ├── ConsolidationPass.ts
│   │   │   └── index.ts
│   │   ├── validators/          # Format validators (Epic 1)
│   │   │   └── index.ts
│   │   └── rules/               # Document-type rules (Epic 3)
│   │       ├── InvoiceRules.ts
│   │       └── LetterRules.ts
│   │
│   ├── services/                # IPC handlers and services
│   │   ├── filePreviewHandlers.ts
│   │   ├── i18nHandlers.ts
│   │   ├── converterBridge.ts
│   │   ├── batchQueueManager.ts
│   │   ├── feedbackLogger.ts    # User correction logging (Epic 5)
│   │   ├── feedbackHandlers.ts
│   │   ├── accuracyHandlers.ts
│   │   ├── accuracyStats.ts
│   │   ├── modelHandlers.ts
│   │   └── modelManager.ts
│   │
│   ├── ui/                      # UI components
│   │   ├── filePreviewUI.ts
│   │   └── EntityReviewUI.ts    # Entity review panel (Epic 4)
│   │
│   ├── i18n/                    # Internationalization (TypeScript)
│   │   ├── i18nService.ts
│   │   ├── languageDetector.ts
│   │   ├── localeFormatter.ts
│   │   └── rendererI18n.ts
│   │
│   ├── config/                  # Configuration
│   │   ├── constants.ts         # Application constants
│   │   ├── detectionRules.json  # Document-type rule config
│   │   └── detectionDenyList.json # False positive deny list
│   │
│   ├── data/                    # Static data
│   │   └── swissPostalCodes.json
│   │
│   ├── utils/                   # Utilities
│   │   ├── LoggerFactory.ts     # [NEW] Centralized logging (Epic 10)
│   │   ├── metadataExtractor.ts
│   │   ├── pathValidator.ts
│   │   ├── previewGenerator.ts
│   │   ├── pdfTableDetector.ts
│   │   ├── errorHandler.ts
│   │   ├── ipcValidator.ts
│   │   ├── safeRegex.ts
│   │   └── asyncTimeout.ts
│   │
│   └── types/                   # TypeScript definitions
│       ├── index.ts
│       ├── ipc.ts
│       ├── filePreview.ts
│       ├── fileMetadata.ts
│       ├── batchQueue.ts
│       ├── pdfTable.ts
│       ├── detection.ts         # Detection pipeline types
│       ├── accuracy.ts
│       ├── entityReview.ts
│       ├── errors.ts
│       ├── feedback.ts
│       └── modelDownload.ts
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
│   │   ├── pii/                 # Pipeline tests (Epic 1, 8)
│   │   │   ├── DetectionPipeline.test.js
│   │   │   ├── AddressModeling.test.js
│   │   │   ├── ConsolidationPass.test.js
│   │   │   ├── DocumentTypeDetection.test.js
│   │   │   ├── Epic8PipelineIntegration.test.js
│   │   │   ├── context/         # Context enhancement tests
│   │   │   ├── address/         # Address detection tests
│   │   │   ├── ml/              # ML module tests
│   │   │   ├── feedback/        # Feedback tests
│   │   │   ├── recognizers/     # Recognizer tests
│   │   │   └── preprocessing/   # Preprocessing tests
│   │   ├── i18n/
│   │   ├── shared/              # Shared module tests
│   │   └── anonymization/       # Anonymization tests
│   ├── integration/
│   │   ├── pii/
│   │   │   ├── ConsolidationIntegration.test.js
│   │   │   ├── NormalizationIntegration.test.js
│   │   │   ├── QualityValidation.test.js
│   │   │   ├── RuntimeContextIntegration.test.js
│   │   │   ├── ItalianPatterns.test.js
│   │   │   └── PresidioCompatibility.test.js
│   │   └── fullPipeline.test.js
│   ├── accuracy/                # Accuracy benchmarks
│   ├── performance/             # Performance tests
│   └── fixtures/
│       ├── piiAnnotated/        # Golden test dataset
│       ├── realistic/           # Realistic test documents
│       └── pdfTables.js
│
├── models/                      # ML model cache
│   └── Xenova/
│       └── distilbert-base-multilingual-cased-ner-hrl/
│
├── scripts/                     # Build and utility scripts
│   ├── patch-pdf-parse.js
│   └── generate-realistic-test-files.mjs
│
└── docs/                        # Documentation
    ├── prd.md
    ├── epics.md
    ├── architecture.md          # This document
    ├── test-design-system.md    # System-level test design
    ├── ML_DETECTION_REVIEW.md   # ML detection analysis
    └── sprint-artifacts/        # Sprint planning documents
        ├── sprint-status.yaml
        └── stories/             # User stories by epic
```

---

## Epic to Architecture Mapping

| Epic | Primary Components | Secondary Components |
|------|-------------------|---------------------|
| Epic 1: Multi-Pass Detection | `src/pii/DetectionPipeline.ts`, `src/pii/passes/ContextScoringPass.ts`, `src/pii/validators/` | `fileProcessor.js`, `src/types/detection.ts` |
| Epic 2: Address Modeling | `src/pii/AddressClassifier.ts`, `src/pii/AddressLinker.ts`, `src/pii/AddressScorer.ts` | `src/pii/AddressComponentDetector.ts`, `src/pii/SwissPostalDatabase.ts` |
| Epic 3: Document-Type Detection | `src/pii/DocumentClassifier.ts`, `src/pii/rules/`, `src/config/detectionRules.json` | `src/pii/passes/DocumentTypePass.ts` |
| Epic 4: User Review | `src/ui/EntityReviewUI.ts`, `renderer.js`, `index.html` | `src/services/`, `preload.cjs` |
| Epic 5: Confidence & Feedback | `src/services/feedbackLogger.ts`, `shared/pii/feedback/FeedbackAggregator.ts` | `src/services/accuracyStats.ts` |
| Epic 8: ML Enhancements | `shared/pii/ml/`, `shared/pii/preprocessing/`, `shared/pii/postprocessing/` | `shared/pii/context/`, `shared/pii/recognizers/` |
| Epic 9: Browser App | `browser-app/src/`, `shared/` | PWA support, Web Workers |
| Epic 10: Logger Migration | `src/utils/LoggerFactory.ts`, `browser-app/src/utils/logger.ts` | `browser-app/src/utils/WorkerLogger.ts` |

---

## Technology Stack Details

### Core Technologies

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Electron | 39.1.1 | Desktop framework | Main + renderer process isolation |
| Node.js | 18+ | Runtime | ES modules, async/await |
| TypeScript | 5.9.x | Type safety | Strict mode, full migration complete |
| @xenova/transformers | 2.17.2 | ML inference | WASM-based, browser-compatible |
| Tailwind CSS | 3.x | Styling | Utility classes, JIT |
| Vite | Latest | Browser build | Used in browser-app |

### Document Processing Libraries

| Library | Purpose | Notes |
|---------|---------|-------|
| mammoth | DOCX → HTML | Preserves structure |
| pdf-parse | PDF text extraction | With custom table detector |
| exceljs | Excel processing | Formulas, formatting |
| marked | Markdown validation | GFM support |
| turndown | HTML → Markdown | Table support |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| electron-log | Structured logging | File + console transport |
| zod | Runtime validation | Schema validation |
| husky | Git hooks | Pre-commit linting |
| lint-staged | Staged file linting | TypeScript + ESLint |
| ESLint | Code quality | Flat config (eslint.config.js) |

### Integration Points

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      ELECTRON APP (main.js)                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │fileProcessor │───▶│ Converters   │───▶│ PII Pipeline │               │
│  │     .js      │    │ (TypeScript) │    │ (TypeScript) │               │
│  └──────────────┘    └──────────────┘    └──────────────┘               │
│         │                   │                   │                        │
│         │                   └───────────────────┼────────────┐           │
│         │ IPC (contextBridge)                   ▼            ▼           │
│         ▼                                ┌──────────────┐ ┌────────────┐ │
│  ┌──────────────┐                        │  ML Model    │ │LoggerFactory│ │
│  │   Handlers   │                        │  (WASM)      │ │(electron-log)│ │
│  │ (TypeScript) │                        └──────────────┘ └────────────┘ │
│  └──────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────┘
          │ IPC                                    ▲
          ▼                                        │ imports
┌─────────────────────────────────────────────────────────────────────────┐
│                      RENDERER PROCESS                                    │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │ renderer.js  │───▶│ UI Components│───▶│    i18n      │               │
│  │              │    │ (TypeScript) │    │ (TypeScript) │               │
│  └──────────────┘    └──────────────┘    └──────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
                                ▲
                                │ shared/
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    BROWSER APP (browser-app/)                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │   main.ts    │───▶│  Components  │───▶│  PWA Support │               │
│  │   (Vite)     │    │ (TypeScript) │    │ (TypeScript) │               │
│  └──────────────┘    └──────────────┘    └──────────────┘               │
│         │                   │                   │                        │
│         ▼                   ▼                   ▼                        │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │FileProcessor │    │ PIIDetector  │    │  Web Worker  │               │
│  │  (Browser)   │    │  (Browser)   │    │ (pii.worker) │               │
│  └──────────────┘    └──────────────┘    └──────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
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

5. **Pass 5 - Consolidation (Epic 8 - Story 8.8)**
   - Resolves overlapping entity spans using priority table
   - Consolidates address components into unified ADDRESS entities
   - Links repeated entity occurrences with logical IDs
   - Output: Clean, deduplicated entities with linking

### Entity Consolidation Pass (Epic 8 - Story 8.8)

**Purpose:** Post-processing pass that consolidates overlapping and fragmented entities into coherent units for consistent anonymization.

**Components:**

1. **ConsolidationPass** (`shared/pii/postprocessing/ConsolidationPass.ts`)
   - Overlap resolution using entity type priority table
   - Address component consolidation
   - Entity linking with normalized/fuzzy text matching
   - Configurable strategies (priority-only vs confidence-weighted)

**Architecture:**

```typescript
interface ConsolidationPassConfig {
  // Overlap resolution
  enableOverlapResolution: boolean;      // @default true
  overlapStrategy: 'priority-only' | 'confidence-weighted';  // @default 'confidence-weighted'

  // Address consolidation
  enableAddressConsolidation: boolean;   // @default true
  addressMaxGap: number;                 // @default 50 (characters)
  minAddressComponents: number;          // @default 2
  showComponents: boolean;               // @default false (Option A)

  // Entity linking
  enableEntityLinking: boolean;          // @default true
  linkingStrategy: 'exact' | 'normalized' | 'fuzzy';  // @default 'normalized'

  // Priority table
  entityTypePriority: Record<EntityType, number>;
}

interface ConsolidationResult {
  entities: Entity[];
  metadata: {
    overlapsResolved: number;
    addressesConsolidated: number;
    entitiesLinked: number;
    originalEntityCount: number;
    durationMs: number;
  };
}
```

**Entity Type Priority Table:**

| Type | Priority | Rationale |
|------|----------|-----------|
| SWISS_AVS | 100 | Highest: specific identifiers |
| IBAN | 95 | Structured financial data |
| QR_REFERENCE | 90 | Payment-specific |
| VAT_NUMBER | 85 | Business identifier |
| EMAIL | 80 | Structured format |
| PHONE | 75 | Validated patterns |
| SWISS_ADDRESS | 60 | Region-specific |
| ADDRESS | 55 | General address |
| PERSON_NAME | 50 | Common entity |
| ORGANIZATION | 45 | Entity with context |
| UNKNOWN | 0 | Fallback |

**Entity Linking:**

Repeated occurrences of the same entity receive a shared `logicalId` (e.g., `PERSON_1`, `ORGANIZATION_2`), enabling consistent anonymization across the document.

Strategies:
- **exact**: Only exact text matches are linked
- **normalized**: Case-insensitive, whitespace-normalized matching (default)
- **fuzzy**: Handles title variations (Mr/Herr/M.), typos

**Integration:**

The ConsolidationPass is registered with order 50, executing after AddressRelationshipPass (40). It operates in both Electron and Browser environments via the shared module.

**Mapping File Integration:**

The mapping file (v4.0) includes:
- `entityLinks`: Maps logicalId to placeholder for repeated entities
- `addresses[].logicalId`: Links repeated address occurrences

### Centralized Logging Architecture (Epic 10)

**Purpose:** Unified logging across Electron main process, renderer, browser app, and web workers with structured output, PII redaction, and environment-aware configuration.

**Components:**

1. **LoggerFactory** (`src/utils/LoggerFactory.ts`) - Electron app logging
   - Factory pattern: `LoggerFactory.create('scope')` returns scoped Logger
   - Uses electron-log for file + console transport
   - Configurable per-scope log levels
   - PII redaction in production logs
   - Singleton pattern with cached instances

2. **Browser Logger** (`browser-app/src/utils/logger.ts`) - Browser app logging
   - Console-based output with structured formatting
   - Same API as LoggerFactory for consistency
   - No file transport (browser limitation)

3. **WorkerLogger** (`browser-app/src/utils/WorkerLogger.ts`) - Web Worker logging
   - postMessage-based communication to main thread
   - Structured log forwarding
   - Worker-safe implementation

**Architecture:**

```typescript
// Factory pattern usage
import { LoggerFactory } from './utils/LoggerFactory';

const log = LoggerFactory.create('fileProcessor');
log.info('Processing started', { fileCount: 10 });
log.error('Processing failed', { error: err.message });

// Configuration
LoggerFactory.configure({
  level: 'debug',
  scopeLevels: { 'pii': 'info' },
  redactPII: true,
});
```

**Log Level Hierarchy:**
- `debug` → `info` → `warn` → `error`
- Environment-based defaults: `debug` in development, `info` in production
- Per-scope overrides via `LOG_LEVEL` env or `scopeLevels` config

**PII Redaction Patterns:**
- Email addresses → `[EMAIL_REDACTED]`
- Phone numbers → `[PHONE_REDACTED]`
- IBAN numbers → `[IBAN_REDACTED]`
- Swiss AHV numbers → `[AHV_REDACTED]`
- File paths → `[PATH_REDACTED]`

### Browser App Architecture (Epic 9)

**Purpose:** Standalone web application version of the PII anonymizer that runs entirely in the browser, enabling deployment as a PWA without Electron dependencies.

**Key Differences from Electron:**

| Aspect | Electron App | Browser App |
|--------|--------------|-------------|
| Entry Point | `main.js` | `browser-app/src/main.ts` |
| Build System | electron-builder | Vite |
| File Access | Node.js fs | File API / drag-drop |
| PII Processing | Main process | Web Worker |
| Logging | electron-log | console + WorkerLogger |
| Storage | Electron userData | IndexedDB / localStorage |
| ML Model | Node.js runtime | WASM in browser |

**Processing Pipeline:**

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  UploadUI    │────▶│FileProcessor │────▶│ PIIDetector  │
│ (drag-drop)  │     │  (Browser)   │     │  (Worker)    │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐     ┌──────────────┐
                     │  Converters  │     │ Web Worker   │
                     │  (Browser)   │     │(pii.worker)  │
                     └──────────────┘     └──────────────┘
                            │                    │
                            └────────┬───────────┘
                                     ▼
                            ┌──────────────┐
                            │ PreviewPanel │
                            │ (rendering)  │
                            └──────────────┘
```

**PWA Features:**
- Service worker for offline capability
- Install banner for "Add to Home Screen"
- PWA status indicator in UI
- Cached ML model for offline use

**Shared Code Strategy:**

The `shared/` directory contains code used by both Electron and browser apps:
- `shared/pii/` - PII detection algorithms, preprocessing, ML utilities
- `shared/converters/` - Document conversion utilities
- `shared/types/` - TypeScript type definitions
- `shared/test/` - Test utilities and fixtures

Browser-specific implementations (prefixed with `Browser*`):
- `BrowserHighRecallPass.ts` - Browser-compatible high recall detection
- `BrowserDocumentTypePass.ts` - Document type detection without Node.js
- `BrowserRuleEngine.ts` - Rule engine for browser environment
- `BrowserSwissPostalDatabase.ts` - Postal code lookup via fetch

### Text Normalization & Lemmatization (Epic 8 - Story 8.7)

**Purpose:** Improve PII detection accuracy by normalizing obfuscated text and enhancing context word matching through lemmatization.

**Components:**

1. **TextNormalizer** (`shared/pii/preprocessing/TextNormalizer.ts`)
   - Unicode normalization (NFKC)
   - Whitespace normalization (zero-width character removal, NBSP conversion)
   - Email de-obfuscation (EN/FR/DE patterns: `(at)`, `arobase`, `Klammeraffe`, etc.)
   - Phone de-obfuscation (`(0)` prefix removal)
   - Position mapping (indexMap) for accurate offset repair

2. **SimpleLemmatizer** (`shared/pii/preprocessing/Lemmatizer.ts`)
   - Lightweight suffix-stripping lemmatization (no NLP dependencies)
   - Multi-language support (EN/FR/DE)
   - Cached results for performance
   - Following Presidio's LemmaContextAwareEnhancer pattern

**Architecture:**

```typescript
interface NormalizationResult {
  normalizedText: string;
  indexMap: number[];  // normalizedIndex → originalIndex
}

class TextNormalizer {
  normalize(input: string): NormalizationResult;
  mapSpan(start: number, end: number, indexMap: number[]): { start: number; end: number };
}

interface Lemmatizer {
  lemmatize(word: string, language?: string): string;
}
```

**Processing Flow:**

```
Input: "Contact john (dot) doe (at) mail (dot) ch"
                          │
                          ▼
              ┌─────────────────────┐
              │   TextNormalizer    │
              │  (Pre-detection)    │
              └─────────────────────┘
                          │
                          ▼
Normalized: "Contact john.doe@mail.ch"
IndexMap:   [0,1,2,...,8,9,10,11,11,11,11,11,12,...]
                          │
                          ▼
              ┌─────────────────────┐
              │   PII Detection     │
              │   (on normalized)   │
              └─────────────────────┘
                          │
                          ▼
Entity: EMAIL at positions [8, 24] in normalized text
                          │
                          ▼
              ┌─────────────────────┐
              │    mapSpan()        │
              │ (offset repair)     │
              └─────────────────────┘
                          │
                          ▼
Mapped: EMAIL at positions [8, 43] in original text
(Points to "john (dot) doe (at) mail (dot) ch")
```

**Lemmatization Context Enhancement:**

```typescript
// In ContextEnhancer
const contextWords = this.extractContextWords(text, entity);
const lemmas = contextWords.map(w => this.lemmatizer.lemmatize(w));

// Matches "addresses" near ADDRESS entity → "address" lemma matches context word
// Matches "Rechnungen" near AMOUNT entity → "Rechnung" lemma matches context word
```

**Supported De-obfuscation Patterns:**

| Language | @ Patterns | . Patterns |
|----------|------------|------------|
| English | `(at)`, `[at]`, `{at}` | `(dot)`, `[dot]`, `{dot}` |
| French | `arobase`, `(arobase)` | `point`, `(point)` |
| German | `Klammeraffe`, `(Klammeraffe)` | `(Punkt)` |

**Configuration:**

```typescript
const normalizer = new TextNormalizer({
  handleEmails: true,           // Email de-obfuscation
  handlePhones: true,           // Phone de-obfuscation
  normalizeUnicode: true,       // NFKC normalization
  normalizeWhitespace: true,    // Zero-width removal
  normalizationForm: 'NFKC',    // Unicode form
  supportedLocales: ['en', 'fr', 'de'],
});
```

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
// Pattern: Structured logging with LoggerFactory (Epic 10)
import { LoggerFactory } from '../utils/LoggerFactory';

// Create scoped logger (singleton per scope)
const log = LoggerFactory.create('fileProcessor');

// Levels: debug, info, warn, error
log.info('Processing started', { filePath, fileSize });
log.debug('Entity detected', { entity, confidence });
log.warn('Low confidence entity', { entity, confidence, threshold });
log.error('Processing failed', { error, context });

// Never log PII content - only metadata
log.info('Entity found', { type: entity.type, position: entity.start }); // Good
log.info('Entity found', { text: entity.text }); // BAD - leaks PII (auto-redacted in prod)

// Browser app logging (same API)
import { createLogger } from '../utils/logger';
const browserLog = createLogger('component');
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

**Status:** Completed
**Context:** Existing JavaScript codebase needs type safety for new features.
**Decision:** Gradual migration - new code in TypeScript, existing code migrated as touched.
**Consequences:**
- (+) Immediate type safety for new code
- (+) No "big bang" migration risk
- (+) Full TypeScript coverage in src/, browser-app/, shared/ directories
- (-) Root JS files (main.js, fileProcessor.js) remain for Electron compatibility

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

### ADR-006: Text Normalization as Pre-Detection Pass

**Status:** Accepted
**Context:** Obfuscated PII patterns (e.g., `john (at) example (dot) com`, `+41 (0) 79...`, IBANs with zero-width spaces) bypass standard detection.
**Decision:** Implement a configurable TextNormalizer as a pre-detection pass that de-obfuscates text while maintaining position mapping for accurate entity offsets.
**Consequences:**
- (+) Detects previously missed obfuscated PII
- (+) Position mapping preserves original text coordinates
- (+) Configurable per-feature (email, phone, unicode, whitespace)
- (+) Multi-language support (EN/FR/DE patterns)
- (-) Additional processing overhead (mitigated by <10% impact)
- (-) Conservative pattern matching to avoid false positives (standalone ` at ` excluded)

### ADR-007: Lightweight Lemmatization for Context Matching

**Status:** Accepted
**Context:** Context word matching fails for plural/inflected forms (e.g., "addresses" near ADDRESS entity doesn't boost confidence).
**Decision:** Implement suffix-stripping SimpleLemmatizer without external NLP dependencies, following Presidio's LemmaContextAwareEnhancer pattern.
**Consequences:**
- (+) Improved context word matching across word forms
- (+) Zero external dependencies (no spaCy, NLTK)
- (+) Fast execution with caching (~0.01ms per word)
- (+) Multi-language support (EN/FR/DE suffix rules)
- (-) Less accurate than full NLP lemmatization
- (-) Manual suffix rules need maintenance

### ADR-008: Centralized Logging via LoggerFactory (Epic 10)

**Status:** Accepted
**Context:** Inconsistent console.log usage across codebase, no PII protection in logs, different logging needs for Electron vs browser.
**Decision:** Implement LoggerFactory with factory pattern, scoped loggers, electron-log backend, and automatic PII redaction in production.
**Consequences:**
- (+) Unified logging API across all environments
- (+) Automatic PII redaction protects sensitive data
- (+) File logging in Electron for debugging
- (+) ESLint rule enforces console.log restriction
- (-) Migration effort for existing console.log calls
- (-) Browser app uses separate logger implementation

### ADR-009: Browser App with Vite + PWA (Epic 9)

**Status:** Accepted
**Context:** Need web deployment without Electron dependencies for broader accessibility.
**Decision:** Separate browser-app/ directory with Vite build, Web Workers for PII processing, PWA support for offline use.
**Consequences:**
- (+) Web deployment without app store distribution
- (+) Offline capability via PWA service worker
- (+) Faster development iteration with Vite HMR
- (+) Code sharing via shared/ directory
- (-) Some code duplication for Browser* adapter classes
- (-) Separate build and test pipelines

### ADR-010: Pluggable Recognizer Framework (Epic 8)

**Status:** Accepted
**Context:** Hard-coded PII patterns limit extensibility, country-specific patterns tightly coupled.
**Decision:** Implement BaseRecognizer class with Registry for dynamic pattern loading, YAML-based configuration support.
**Consequences:**
- (+) Easy addition of new PII patterns
- (+) Country-specific recognizers (ch/, eu/, us/)
- (+) Improved testing isolation
- (+) YAML configuration for non-developers
- (-) Additional abstraction layer
- (-) Registry initialization complexity

---

_Generated by BMAD Decision Architecture Workflow v1.0_
_Date: 2025-12-05_
_Updated: 2025-12-28 (ADR-008, ADR-009, ADR-010 for Epic 8, 9, 10)_
_For: Olivier_
