# PII Anonymizer

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/ch8ri0s/A5-PII-Anonymizer)
[![Platform](https://img.shields.io/badge/platform-Desktop%20%2B%20Browser%20PWA-lightgrey.svg)](https://github.com/ch8ri0s/A5-PII-Anonymizer)
[![i18n](https://img.shields.io/badge/languages-EN%20|%20FR%20|%20DE-green.svg)](./I18N_GUIDE.md)

**Open source desktop (Electron) and browser (PWA) application for anonymising documents into LLM-ready Markdown with comprehensive PII detection and multilingual support.**

---

## 🎯 What It Does

Converts sensitive documents (Word, Excel, PDF, CSV, TXT) into clean, anonymised Markdown files ready for use with Large Language Models (ChatGPT, Claude, Gemini, etc.). All processing happens **100% locally** - no cloud, no API calls, complete privacy.

### ✨ Key Features

✅ **Dual Platform** - Electron desktop app + Browser PWA (same core capabilities)
✅ **LLM-Ready Markdown Output** - Clean, structured format perfect for AI workflows
✅ **100% Local Processing** - Your data never leaves your device
✅ **Multi-Format Support** - DOCX, PDF, Excel, CSV, TXT
✅ **Entity Mapping** - JSON file mapping anonymised tokens back to originals
✅ **Multilingual UI** - English, French, German with automatic detection
✅ **Hybrid PII Detection** - ML model (94%+ accuracy) + rule-based patterns
✅ **Swiss & EU Specialized** - AVS/AHV numbers, IBAN, UID, VAT IDs
✅ **File Preview** - Real-time preview and metadata display
✅ **Modern UI** - Clean, professional interface with drag-and-drop

---

## 🚀 Quick Start

### Option 1: Browser PWA (No Installation Required)

Visit the deployed PWA at your hosted URL, or run locally:

```bash
cd browser-app
npm install
npm run dev         # Opens in browser at http://localhost:5173
```

**Features:**
- Same capabilities as desktop app
- 100% client-side processing using Web Workers
- Installable PWA (Add to Home Screen) with offline support
- Works on any modern browser (Chrome, Firefox, Safari, Edge)

### Option 2: Desktop App (Electron)

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

### Basic Usage

1. **Drop files** or click to browse
2. **Preview** file content and metadata
3. **Process** - Click "Process File"
4. **Download** results:
   - `filename-anon.md` - Anonymised Markdown
   - `filename-mapping.json` - Entity mapping

---

## 📊 Desktop vs Browser PWA

| Aspect | Desktop App (Electron) | Browser PWA |
|--------|------------------------|-------------|
| Installation | DMG/EXE/AppImage | No install (visit URL) |
| Processing | 100% local, Node.js | 100% client-side, Web Workers |
| Performance | Best for large files | Excellent on modern browsers |
| Offline | Always works | Works after first load |
| Updates | Via installer | Automatic (web deploy) |
| Feature Parity | Full | Full (same core pipeline) |

---

## 🌍 Multilingual Support

The application automatically detects your system language:

- 🇬🇧 **English** - Default language
- 🇫🇷 **Français** - Complete French translation
- 🇩🇪 **Deutsch** - Complete German translation

**Features:**
- Automatic OS language detection
- One-click language switching
- Locale-specific date/time/number formatting
- Persistent language preference

[📖 Read the i18n Implementation Guide →](./I18N_GUIDE.md)

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

## 🧱 Architecture Overview

Both Electron and Browser PWA share the same **core architecture**:

```
├── shared/                  # Shared code (validators, patterns, types)
│   └── pii/                 # PII detection core
│       ├── validators/      # Entity validators
│       ├── context/         # Context enhancement
│       └── ml/              # ML utilities
│
├── src/                     # Electron app
│   ├── converters/          # Format converters
│   ├── pii/                 # Detection pipeline
│   ├── i18n/                # Internationalization
│   └── services/            # IPC handlers
│
├── browser-app/             # Browser PWA
│   └── src/
│       ├── converters/      # Browser converters
│       ├── pii/             # Browser detection passes
│       ├── workers/         # Web Workers for ML
│       └── ui/              # UI components
```

For more details, see `docs/architecture.md`.

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

### Running Tests

```bash
# Electron app tests (2294 tests)
npm test

# Browser app tests (1021 tests)
cd browser-app && npm test

# i18n tests only
npm run test:i18n
```

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

**See:** [CLAUDE.md § Logging](./CLAUDE.md#logging) for full documentation.

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
- **Documentation:**
  - [i18n Guide](./I18N_GUIDE.md)
  - [Security Audit](./SECURITY_AUDIT.md)
  - [Architecture](./docs/architecture.md)

---

## 🙏 Acknowledgments

### Original Project

Based on **[A5-PII-Anonymizer](https://github.com/AgenticA5/A5-PII-Anonymizer)** by Agentic A5

### Open Source Components

- **BetterData AI** - [PII Detection Model](https://huggingface.co/betterdataai/PII_DETECTION_MODEL) (Apache 2.0)
- **Xenova** - [Transformers.js](https://github.com/xenova/transformers.js) (Apache 2.0)
- **Microsoft** - [DeBERTa](https://huggingface.co/microsoft/deberta-v3-base) (MIT)
- **Electron** - Desktop framework (MIT)

---

## 📈 Version History

### v1.2.0 (2025-12)

- 🐛 **FIX:** DATE entities no longer lost to postal code detection
- ✨ **NEW:** Comprehensive DATE detection E2E tests
- ✨ **NEW:** Cross-platform behavior consistency tests

### v2.0.0 (2025-11)

- ✨ **NEW:** Browser PWA with same capabilities as desktop
- ✨ **NEW:** Complete French and German translations
- ✨ **NEW:** Automatic OS language detection
- ✨ **NEW:** File preview panel with metadata
- ✨ **NEW:** Modern card-based UI redesign
- ✨ **NEW:** Comprehensive test suite (3000+ tests)
- 🔒 **IMPROVED:** Security audit and fixes
- ⚡ **IMPROVED:** Performance optimizations

### v1.0.0 (2024)

- Initial release with PII detection
- Multi-format document support
- Electron desktop application

---

## 📜 License

**MIT License** - Free and open source

```
Copyright (c) 2024 Agentic A5 (Original A5-PII-Anonymizer)
Copyright (c) 2025 Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

✅ **Commercial use** | ✅ **Modification** | ✅ **Distribution** | ✅ **Private use**

[Full License Text →](./LICENSE)

---

**Made with ❤️ for privacy-conscious LLM users**

Based on **A5-PII-Anonymizer** by Agentic A5
