# Softcom PII Anonymiser

[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/ch8ri0s/A5-PII-Anonymizer)
[![Platform](https://img.shields.io/badge/platform-macOS%20|%20Windows%20|%20Linux-lightgrey.svg)](https://github.com/ch8ri0s/A5-PII-Anonymizer)

**Open source desktop application for anonymising documents into LLM-ready Markdown with comprehensive EU and Swiss PII detection.**

![Softcom PII Anonymiser Preview](./assets/preview.gif)

---

## 🎯 What It Does

Converts sensitive documents (Word, Excel, PDF, CSV, TXT) into clean, anonymised Markdown files ready for use with Large Language Models (ChatGPT, Claude, Gemini, etc.). All processing happens **100% locally** on your machine - no cloud, no API calls, complete privacy.

### Key Features

✅ **LLM-Ready Markdown Output** - Clean, structured format perfect for AI workflows
✅ **100% Local Processing** - Your data never leaves your computer
✅ **Multi-Format Support** - DOCX, PDF, Excel, CSV, TXT
✅ **Entity Mapping** - JSON file mapping anonymised tokens back to originals
✅ **EU & Swiss PII Detection** - Specialised detection for European data protection
✅ **Hybrid Detection** - ML model (94%+ accuracy) + rule-based patterns
✅ **Markdown-Aware** - Preserves code blocks, tables, and formatting
✅ **Multi-Language** - Supports 7 languages (EN, ES, DE, FR, IT, NL, SV)

---

## 📜 License

**CC BY-NC-SA 4.0** - Free for non-commercial use

- ✅ Personal use
- ✅ Educational use
- ✅ Research use
- ❌ Commercial use (requires separate license)

**Commercial Licensing:** For commercial use, contact **[contact@softcom.pro](mailto:contact@softcom.pro)**

---

## 🚀 Quick Start

### Installation

#### Option 1: Download Pre-Built App (Easiest)

1. Download the latest release for your platform:
   - **macOS**: `Softcom-PII-Anonymiser-mac.dmg`
   - **Windows**: `Softcom-PII-Anonymiser-win.exe`
   - **Linux**: `Softcom-PII-Anonymiser-linux.AppImage`

2. Install and run the application

3. On first launch, the app will download the PII detection model (~500MB)

#### Option 2: Build from Source

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

1. **Drop files** into the application or click to select
2. **Choose output directory** (optional - defaults to source directory)
3. **Click "Convert to Markdown"**
4. **Get results:**
   - `filename-anon.md` - Anonymised Markdown file
   - `filename-mapping.json` - Entity mapping for de-anonymisation

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
sourceFormat: docx
processed: 2025-11-09T14:30:00Z
anonymised: true
piiModel: betterdataai/PII_DETECTION_MODEL
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
  "timestamp": "2025-11-09T14:30:00Z",
  "model": "betterdataai/PII_DETECTION_MODEL",
  "detectionMethods": ["ML (transformers)", "Rule-based (Swiss/EU)"],
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

### Rule-Based Detection (Swiss-Specific)

| Type | Format | Validation |
|------|--------|------------|
| **AVS/AHV Number** | 756.XXXX.XXXX.XX | EAN-13 checksum |
| **IBAN** | CH93 0076 2011... | Mod-97 algorithm |
| **Swiss UID** | CHE-123.456.789 | Format validation |
| **Bank Account** | BC-XXXXX-X | Legacy format |
| **Passport** | P1234567 | Format check |
| **License Plate** | ZH 123456 | Canton codes |

### ML-Based Detection (Multi-Language)

Detects standard PII across 7 languages using state-of-the-art transformer model:

- Names (people, organizations)
- Email addresses
- Phone numbers
- Physical addresses
- Credit card numbers
- Social Security numbers
- IP addresses
- Usernames & passwords
- And more...

### European Identifiers

- **EU VAT Numbers** - All EU country formats
- **IBAN** - All 77 IBAN countries supported
- **EHIC** - European Health Insurance Cards
- **National IDs** - Country-specific patterns

---

## 📁 Supported File Formats

| Format | Extension | Structure Preservation | Notes |
|--------|-----------|----------------------|-------|
| **Plain Text** | `.txt` | ✅ Perfect | As-is conversion |
| **CSV** | `.csv` | ✅ Perfect | Markdown tables, 1000 row limit |
| **Word** | `.docx` | ✅ Excellent (90%+) | Headings, tables, lists preserved |
| **Excel** | `.xlsx`, `.xls` | ✅ Excellent | Multi-sheet support, formulas computed |
| **PDF** | `.pdf` | ⚠️ Good (60-80%) | Heuristic structure detection |

### Format-Specific Notes

**DOCX:**
- Headings (H1-H6) → Markdown headings
- Tables → Markdown tables
- Bold/italic → Markdown formatting
- Images → Descriptive placeholders
- Lists → Markdown lists

**Excel:**
- Each sheet → Separate Markdown section
- Formulas → Computed values shown
- Merged cells → Noted in structure
- Charts/images → Descriptive text

**PDF:**
- Best effort structure detection
- Page breaks preserved
- For best results, convert to DOCX first

---

## 🔒 Privacy & Security

### 🟢 Security Status: LOW RISK

Softcom PII Anonymiser underwent a comprehensive security audit (2025-11-09) against OWASP Top 10 and Electron security best practices:

- ✅ **8 of 10** vulnerabilities FIXED
- ✅ All CRITICAL and HIGH severity issues resolved
- ✅ Sandboxed renderer with context isolation
- ✅ Path traversal protection
- ✅ URL injection prevention
- ✅ Content Security Policy enabled

[View Security Audit Report →](SECURITY_AUDIT.md) | [Security Policy →](SECURITY.md)

### Data Protection

- **100% Local** - No internet connection required for processing
- **No Telemetry** - No usage tracking or analytics
- **No Cloud** - All data stays on your machine
- **Open Source** - Audit the code yourself
- **Sandboxed** - Electron renderer runs in secure sandbox
- **PII Never Logged** - Original PII values never written to logs

### Security Architecture

**Hardened Electron Security:**
- ✅ `contextIsolation: true` - Isolates renderer from Node.js
- ✅ `nodeIntegration: false` - Prevents arbitrary code execution
- ✅ Preload script with `contextBridge` - Secure IPC communication only
- ✅ Content Security Policy - Blocks XSS attacks
- ✅ Path validation - Prevents directory traversal
- ✅ URL sanitization - Blocks javascript:, data:, file:// URIs

**File System Protection:**
- Path normalization and validation before all file operations
- Output files restricted to user-specified directories only
- Temporary files created with safe permissions

**Error Handling:**
- File paths redacted from user-facing error messages
- Full errors logged to console for debugging (local only)
- No sensitive data in exception messages

### GDPR Compliance

This tool helps you comply with GDPR (EU) and nFADP (Swiss) when working with LLMs:

- Anonymise personal data before cloud processing (Art. 5, 32 GDPR)
- Keep original-to-pseudonym mapping locally (Art. 30 GDPR)
- De-anonymise results using mapping file (Art. 15 GDPR)
- Document your privacy-preserving workflow (Art. 24 GDPR)
- Data minimization - only processes files you select (Art. 5 GDPR)
- Purpose limitation - anonymization only (Art. 5 GDPR)

### Security Best Practices

**For Mapping Files:**
```bash
# ⚠️ -mapping.json contains original PII!

# Set restrictive permissions (user-only)
chmod 600 customer-data-mapping.json

# Store in encrypted directory
cp *-mapping.json ~/secure-vault/

# Delete when no longer needed
shred -uvz customer-data-mapping.json
```

**For Output Files:**
```bash
# Review anonymized output before sharing
cat customer-data-anon.md | less

# Verify critical PII was caught
grep -E "NAME_|EMAIL_|PHONE_|SSN_" customer-data-anon.md
```

### Vulnerability Reporting

Found a security issue? Please report responsibly:

📧 **Email:** contact@softcom.pro (Subject: [SECURITY])

See [SECURITY.md](SECURITY.md) for our vulnerability disclosure policy.

### Limitations

⚠️ **Not 100% Guaranteed** - ML models can miss edge cases (94%+ accuracy)
⚠️ **Review Critical Data** - Always manually review highly sensitive documents
⚠️ **Defense in Depth** - Use as part of comprehensive privacy strategy
⚠️ **Context Matters** - Some PII requires domain knowledge to detect
⚠️ **Mapping Files** - Contain original PII, store securely and delete when done

---

## 🎓 Use Cases

### 1. LLM Document Analysis

```bash
# Anonymise client contract
→ Input: contract.docx
→ Output: contract-anon.md

# Upload to ChatGPT for analysis
→ "Summarise key terms in this contract"

# De-anonymise results using mapping.json
→ Replace NAME_1 with actual client name
```

### 2. RAG (Retrieval-Augmented Generation)

```bash
# Build vector database from sensitive docs
1. Anonymise all documents → .md files
2. Chunk Markdown (structure preserved)
3. Create embeddings
4. Query without PII exposure
5. De-anonymise retrieved passages
```

### 3. Training Data Preparation

```bash
# Create fine-tuning dataset from real data
1. Anonymise customer interactions
2. Export to JSONL with preserved structure
3. Fine-tune model on anonymised data
4. Deploy without privacy concerns
```

### 4. Document Review Workflows

```bash
# Share sensitive docs with external reviewers
1. Anonymise documents
2. Share .md files (no PII)
3. Collect feedback/edits
4. Apply changes to originals using mapping
```

---

## ⚙️ Advanced Configuration

### Model Configuration

Edit `fileProcessor.js` to change the PII detection model:

```javascript
// Default: Multi-language model
const MODEL_NAME = 'betterdataai/PII_DETECTION_MODEL';

// Alternative: English-only (smaller, faster)
// const MODEL_NAME = 'lakshyakh93/deberta_finetuned_pii';
```

### Conversion Options

Modify converter parameters in `src/converters/`:

```javascript
// CSV: Change row limit
const csvConverter = new CsvToMarkdown({ maxRows: 5000 });

// Excel: Change rows per sheet
const excelConverter = new ExcelToMarkdown({ maxRowsPerSheet: 2000 });
```

### Swiss/EU Detection

Add custom patterns in `src/pii/SwissEuDetector.js`:

```javascript
// Add new pattern
CUSTOM_ID: {
  name: 'CUSTOM_ID',
  pattern: /your-regex-here/g,
  validate: (match) => { /* validation logic */ }
}
```

---

## 🛠️ Development

### Project Structure

```
Softcom-PII-Anonymiser/
├── src/
│   ├── converters/           # Format-to-Markdown converters
│   │   ├── MarkdownConverter.js    (base class)
│   │   ├── TextToMarkdown.js
│   │   ├── CsvToMarkdown.js
│   │   ├── DocxToMarkdown.js
│   │   ├── ExcelToMarkdown.js
│   │   └── PdfToMarkdown.js
│   └── pii/                  # PII detection
│       └── SwissEuDetector.js      (Swiss/EU patterns)
├── fileProcessor.js          # Main processing logic
├── main.js                   # Electron main process
├── renderer.js               # UI logic
├── index.html                # Application UI
├── styles.css                # Styling
├── package.json              # Dependencies & config
└── models/                   # AI model storage (download on first run)
```

### Building

```bash
# Development
npm run dev              # Run with dev tools

# Production builds
npm run build            # All platforms
npm run build:mac        # macOS (DMG + app)
npm run build:win        # Windows (EXE + installer)
npm run build:linux      # Linux (AppImage + deb)
```

### Dependencies

**Core:**
- `electron` - Desktop app framework
- `@xenova/transformers` - ML model inference
- `exceljs` - Excel file processing
- `mammoth` - DOCX text extraction
- `pdf-parse` - PDF text extraction
- `turndown` - HTML to Markdown conversion
- `marked` - Markdown parsing/validation

---

## 🤝 Contributing

Contributions welcome! This is open source under CC BY-NC-SA 4.0.

### How to Contribute

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Areas for Contribution

- Additional language support
- More file format converters
- Improved PDF structure detection
- Country-specific PII patterns
- Test coverage
- Documentation improvements
- Bug fixes

---

## 📞 Support

**Non-Commercial Users:** Open an issue on GitHub
**Commercial Licensing:** [contact@softcom.pro](mailto:contact@softcom.pro)
**Documentation:** See [USAGE_GUIDE.md](USAGE_GUIDE.md)

---

## 🙏 Acknowledgments

Built with open source components:

- **BetterData AI** - [PII Detection Model](https://huggingface.co/betterdataai/PII_DETECTION_MODEL) (Apache 2.0)
- **Xenova** - [Transformers.js](https://github.com/xenova/transformers.js) (Apache 2.0)
- **Microsoft** - [DeBERTa](https://huggingface.co/microsoft/deberta-v3-base) (MIT)
- **Electron** - Desktop framework (MIT)

---

## 📝 License Summary

**For Non-Commercial Use:**
- ✅ Use freely for personal, educational, research purposes
- ✅ Modify and distribute (must keep same license)
- ✅ Attribution required

**For Commercial Use:**
- ❌ Not permitted without license
- 💰 Contact [contact@softcom.pro](mailto:contact@softcom.pro) for commercial licensing

Full license: [LICENSE](LICENSE)

---

**Made with ❤️ for privacy-conscious LLM users**

**Softcom** | Privacy-First Document Processing
