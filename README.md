# Softcom PII Anonymiser

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/ch8ri0s/A5-PII-Anonymizer)
[![Platform](https://img.shields.io/badge/platform-Desktop%20%2B%20Browser%20PWA-lightgrey.svg)](https://github.com/ch8ri0s/A5-PII-Anonymizer)
[![i18n](https://img.shields.io/badge/languages-EN%20|%20FR%20|%20DE-green.svg)](./I18N_GUIDE.md)

> A companion **browser PWA** with the same core capabilities lives in `browser-app/` (see its README for browser-specific details).

**Open source desktop and browser application for anonymising documents into LLM-ready Markdown with comprehensive PII detection and multilingual support.**

---

## 🎯 What It Does

Converts sensitive documents (Word, Excel, PDF, CSV, TXT) into clean, anonymised Markdown files ready for use with Large Language Models (ChatGPT, Claude, Gemini, etc.). All processing happens **100% locally** on your machine - no cloud, no API calls, complete privacy.

### ✨ Key Features

✅ **LLM-Ready Markdown Output** - Clean, structured format perfect for AI workflows
✅ **100% Local Processing** - Your data never leaves your computer
✅ **Multi-Format Support** - DOCX, PDF, Excel, CSV, TXT
✅ **Entity Mapping** - JSON file mapping anonymised tokens back to originals
✅ **Multilingual UI** - English, French, German with automatic detection
✅ **Hybrid PII Detection** - ML model (94%+ accuracy) + rule-based patterns
✅ **Swiss & EU Specialized** - AVS/AHV numbers, IBAN, UID, VAT IDs
✅ **File Preview** - Real-time preview and metadata display
✅ **Modern UI** - Clean, professional interface with drag-and-drop

---

## 🌍 Multilingual Support (NEW in v2.0)

The application automatically detects your system language and provides a fully translated interface:

- 🇬🇧 **English** - Default language
- 🇫🇷 **Français** - Complete French translation
- 🇩🇪 **Deutsch** - Complete German translation

**Features:**
- Automatic OS language detection
- One-click language switching via dropdown
- Locale-specific date/time/number formatting
- Persistent language preference
- 88 fully translated UI elements

[📖 Read the i18n Implementation Guide →](./I18N_GUIDE.md)

---

## 📜 License

**MIT License** - Free and open source

```
Copyright (c) 2024 Agentic A5 (Original A5-PII-Anonymizer)
Copyright (c) 2025 Softcom (Enhancements and i18n)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

**What this means:**
- ✅ Free for personal, educational, and commercial use
- ✅ Modify and distribute freely
- ✅ No usage restrictions
- ✅ Attribution appreciated but not required

**Full License:** [LICENSE](./LICENSE)

---

## 🚀 Quick Start

### Option 1: Download Pre-Built App

1. Download for your platform:
   - **macOS**: `Softcom-PII-Anonymiser-mac.dmg`
   - **Windows**: `Softcom-PII-Anonymiser-win.exe`
   - **Linux**: `Softcom-PII-Anonymiser-linux.AppImage`

2. Install and run
3. On first launch, the PII detection model downloads automatically (~500MB)

### Option 2: Build Desktop App from Source

```bash
# Clone repository
git clone https://github.com/ch8ri0s/A5-PII-Anonymizer.git
cd A5-PII-Anonymizer

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for your platform
npm run build:mac    # macOS
npm run build:win    # Windows
npm run build:linux  # Linux
```

### Option 3: Run the Browser PWA (Experimental, same core pipeline)

The project also includes a **browser-based PWA** in `browser-app/` which reuses the same converters, PII detection pipeline, and i18n layer, but runs fully in the browser (no install required).

```bash
cd browser-app
npm install
npm run dev         # Start Vite dev server (opens in browser)
```

Key characteristics:
- **Same capabilities** as the desktop app for single/batch file anonymisation
- **100% client-side processing** using Web Workers and `@xenova/transformers`
- **Installable PWA** (Add to Home Screen) with offline model cache
- Tested end‑to‑end across Chromium, Firefox, and WebKit (`browser-app/e2e`)

> Note: Very large files or older devices may perform better with the desktop app due to Electron’s Node.js filesystem access and memory profile.

### Basic Usage (Desktop & Browser)

1. **Drop files** or click to browse
2. **Preview** file content and metadata
3. **Process** - Click "Process File"
4. **Download** results:
   - `filename-anon.md` - Anonymised Markdown
   - `filename-mapping.json` - Entity mapping

### Desktop vs Browser PWA

| Aspect | Desktop App (Electron) | Browser PWA (`browser-app/`) |
|--------|------------------------|------------------------------|
| Installation | DMG/EXE/AppImage | No install required (visit URL, optional “Add to Home Screen”) |
| Processing | 100% local, Node.js filesystem access | 100% client-side, browser APIs + Web Workers |
| Performance | Best for very large files and long runs | Excellent on modern browsers; constrained by browser memory limits |
| Updates | Via installer / auto‑update | Deployed like any web app / static hosting |
| Offline Model Cache | Local filesystem | IndexedDB / browser cache |
| Feature Parity | Full | Matches core pipeline (converters, PII detection, batch, i18n) |

---

## 📊 Example

### Input (customer_data.docx)

```
Customer Information

Name: Hans Müller
Email: hans.mueller@example.ch
Phone: +41 79 123 45 67
Address: Bahnhofstrasse 1, 8001 Zürich
AVS Number: 756.1234.5678.90
IBAN: CH93 0076 2011 6238 5295 7
```

### Output (customer_data-anon.md)

```markdown
---
source: customer_data.docx
processed: 2025-11-12T14:30:00Z
anonymised: true
---

# Customer Information

Name: NAME_1
Email: EMAIL_1
Phone: PHONE_1
Address: ADDRESS_1
AVS Number: SWISS_AVS_1
IBAN: IBAN_1
```

### Mapping (customer_data-mapping.json)

```json
{
  "version": "2.0",
  "timestamp": "2025-11-12T14:30:00Z",
  "entities": {
    "Hans Müller": "NAME_1",
    "hans.mueller@example.ch": "EMAIL_1",
    "+41 79 123 45 67": "PHONE_1",
    "Bahnhofstrasse 1, 8001 Zürich": "ADDRESS_1",
    "756.1234.5678.90": "SWISS_AVS_1",
    "CH93 0076 2011 6238 5295 7": "IBAN_1"
  }
}
```

---

## 🇪🇺🇨🇭 Swiss & European PII Detection

### Swiss-Specific Patterns

| Type | Format | Validation |
|------|--------|------------|
| **AVS/AHV Number** | 756.XXXX.XXXX.XX | EAN-13 checksum |
| **IBAN** | CH93 0076 2011... | Mod-97 algorithm |
| **Swiss UID** | CHE-123.456.789 | Format validation |
| **Bank Account** | BC-XXXXX-X | Legacy format |

### European Identifiers

- **EU VAT Numbers** - All EU formats
- **IBAN** - All 77 IBAN countries
- **EHIC** - European Health Insurance Cards
- **National IDs** - Country-specific patterns

---

## 📁 Supported File Formats

| Format | Extensions | Quality | Notes |
|--------|------------|---------|-------|
| **Plain Text** | `.txt` | ✅ Perfect | Direct conversion |
| **CSV** | `.csv` | ✅ Perfect | Markdown tables |
| **Word** | `.docx` | ✅ Excellent (90%+) | Full structure |
| **Excel** | `.xlsx`, `.xls` | ✅ Excellent | Multi-sheet |
| **PDF** | `.pdf` | ⚠️ Good (70-80%) | Heuristic parsing |

---

## 🧱 Architecture Overview (Desktop & Browser)

Both the Electron app and the browser PWA share the same **core architecture**:

- **Shared core modules** (converters, PII detection pipeline, types, utilities) live in `src/` and `shared/`, and are reused by both runtimes.
- **Desktop app** wires these into `main.js`, `fileProcessor.js`, and `renderer.js` with a secure `preload.cjs` bridge and IPC services in `src/services/`.
- **Browser PWA** wires the same pipeline into `browser-app/src/` (`processing/`, `pii/`, `converters/`, `workers/`, `ui/`, `pwa/`) using Web Workers and `@xenova/transformers` in browser mode.
- **i18n and UX** are kept consistent via shared JSON locale files (`/locales`, `browser-app/public/locales`) and parallel UI components, so behaviour and wording match across desktop and web.

For more details, see `docs/architecture.md` and `specs/browser-migration/MIGRATION_PLAN.md`.

---

## 🔒 Privacy & Security

### Security Status: ✅ PRODUCTION READY

- ✅ **100% Local Processing** - No internet required
- ✅ **No Telemetry** - Zero tracking or analytics
- ✅ **Context Isolation** - Sandboxed renderer process
- ✅ **IPC Validation** - Secure inter-process communication
- ✅ **Path Protection** - Directory traversal prevention
- ✅ **CSP Enabled** - Content Security Policy active

**Security Audit:** [View Full Report →](./SECURITY_AUDIT.md)

### GDPR & nFADP Compliance

This tool helps comply with EU GDPR and Swiss nFADP:

- ✅ **Art. 5 GDPR** - Data minimization and purpose limitation
- ✅ **Art. 32 GDPR** - Pseudonymization of personal data
- ✅ **Art. 30 GDPR** - Local mapping file as processing record
- ✅ **Art. 15 GDPR** - De-anonymization capability maintained

---

## 🎓 Use Cases

### 1. LLM Document Analysis

Anonymise contracts, reports, or customer data before uploading to ChatGPT/Claude for analysis.

### 2. RAG (Retrieval-Augmented Generation)

Build vector databases from sensitive documents without exposing PII.

### 3. Training Data Preparation

Create privacy-safe fine-tuning datasets from real customer interactions.

### 4. Collaborative Review

Share anonymised documents with external reviewers without privacy concerns.

---

## 🛠️ Development

### Project Structure

```
├── src/
│   ├── converters/           # Format converters
│   ├── i18n/                 # Internationalization
│   ├── services/             # IPC handlers
│   └── pii/                  # PII detection
├── locales/                  # Translation files (EN/FR/DE)
├── test/                     # Test suites (139 tests)
├── fileProcessor.js          # Core processing
├── main.js                   # Electron main process
├── renderer.js               # UI logic
└── i18n-init.js              # i18n initialization
```

### Running Tests

```bash
# All tests
npm test

# i18n tests only
npm run test:i18n

# Translation coverage
npm run test:i18n:coverage
```

**Test Results:** ✅ 139/139 passing

### Logging

This project uses `LoggerFactory` for centralized, structured logging. **Never use `console.*` directly.**

```typescript
// Electron app
import { LoggerFactory } from './utils/LoggerFactory';
const log = LoggerFactory.create('my-module');
log.info('Processing started', { itemCount: 10 });

// Browser app
import { createLogger } from './utils/logger';
const log = createLogger('my-module');
log.info('Processing started', { itemCount: 10 });
```

**See:** [CLAUDE.md § Logging](./CLAUDE.md#logging) for full documentation including scope naming, log levels, PII safety, and troubleshooting.

### Building

```bash
npm run dev              # Development mode
npm run build            # All platforms
npm run build:mac        # macOS only
npm run build:win        # Windows only
npm run build:linux      # Linux only
```

### Dependencies

**Core:**
- `electron` ^39.1.1 - Desktop framework
- `@xenova/transformers` 2.17.2 - ML inference
- `exceljs` ^4.4.0 - Excel processing
- `mammoth` ^1.11.0 - DOCX extraction
- `pdf-parse` ^1.1.1 - PDF parsing
- `turndown` ^7.2.2 - HTML to Markdown
- `marked` ^17.0.0 - Markdown validation

**Zero External Dependencies for i18n** - Custom JSON-based solution

---

## 🤝 Contributing

Contributions welcome! This project is open source under MIT License.

### How to Contribute

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Areas for Contribution

- 🌍 Additional language translations (Spanish, Italian, etc.)
- 📄 More file format converters
- 🔍 Improved PDF structure detection
- 🌐 Country-specific PII patterns
- ✅ Test coverage expansion
- 📚 Documentation improvements
- 🐛 Bug fixes

---

## 📞 Support & Contact

- **Issues:** Open an issue on GitHub
- **Email:** [contact@softcom.pro](mailto:contact@softcom.pro)
- **Documentation:**
  - [i18n Guide](./I18N_GUIDE.md)
  - [Security Audit](./SECURITY_AUDIT.md)
  - [Implementation Summary](./I18N_IMPLEMENTATION_SUMMARY.md)

---

## 🙏 Acknowledgments

### Original Project

Based on **[A5-PII-Anonymizer](https://github.com/AgenticA5/A5-PII-Anonymizer)** by Agentic A5
- Original MIT License
- Core PII detection architecture
- Multi-format document conversion

### v2.0 Enhancements by Softcom

- ✨ Multilingual UI (EN/FR/DE)
- 🎨 Modern redesigned interface
- 📄 File preview and metadata display
- 🔒 Enhanced security audit
- ⚡ Performance optimizations
- 🧪 Comprehensive test suite

### Open Source Components

- **BetterData AI** - [PII Detection Model](https://huggingface.co/betterdataai/PII_DETECTION_MODEL) (Apache 2.0)
- **Xenova** - [Transformers.js](https://github.com/xenova/transformers.js) (Apache 2.0)
- **Microsoft** - [DeBERTa](https://huggingface.co/microsoft/deberta-v3-base) (MIT)
- **Electron** - Desktop framework (MIT)

---

## 📈 Version History

### v2.0.0 (2025-11-12) - Softcom Edition

- ✨ **NEW:** Complete French and German translations
- ✨ **NEW:** Automatic OS language detection
- ✨ **NEW:** Language selector dropdown
- ✨ **NEW:** File preview panel with metadata
- ✨ **NEW:** Modern card-based UI redesign
- ✨ **NEW:** Comprehensive test suite (139 tests)
- 🔒 **IMPROVED:** Security audit and fixes
- ⚡ **IMPROVED:** Performance optimizations (10-100x faster)
- 📚 **IMPROVED:** Complete documentation

### v1.0.0 (2024) - Agentic A5

- Initial release with PII detection
- Multi-format document support
- Electron desktop application

---

## 📝 License Summary

**MIT License** - Simple and permissive

✅ **Commercial use**
✅ **Modification**
✅ **Distribution**
✅ **Private use**
⚠️ **No warranty**
⚠️ **No liability**

[Full License Text →](./LICENSE)

---

**Made with ❤️ for privacy-conscious LLM users**

**Softcom** | Privacy-First Document Processing
Based on **A5-PII-Anonymizer** by Agentic A5
