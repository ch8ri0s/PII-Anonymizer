# A5-PII-Anonymizer - Product Requirements Document

**Author:** Olivier
**Date:** 2025-12-05
**Version:** 1.0

---

## Executive Summary

A5-PII-Anonymizer is a privacy-first desktop application that transforms business documents into LLM-ready Markdown while automatically detecting and anonymizing Personally Identifiable Information. Built specifically for Swiss and EU compliance contexts, it enables organizations to safely leverage AI tools without exposing sensitive data.

The application addresses a critical market gap: businesses want to use powerful LLM tools but cannot share documents containing customer data, employee information, or confidential business details. A5-PII-Anonymizer provides a secure, offline solution that processes documents locally, ensuring data never leaves the user's machine.

### What Makes This Special

1. **100% Local Processing** - No cloud dependencies, no API calls, complete data sovereignty
2. **Swiss/EU PII Specialization** - Unique detection patterns for AVS numbers, IBAN, Swiss addresses, and EU-specific formats
3. **Reversible Anonymization** - Mapping files allow re-identification when authorized, supporting audit trails
4. **Multi-Format Intelligence** - Single workflow handles DOCX, PDF (with tables), Excel, CSV, and plain text
5. **LLM-Optimized Output** - Clean GitHub Flavored Markdown preserves document structure for AI consumption

---

## Project Classification

**Technical Type:** Desktop Application (Electron)
**Domain:** Privacy & Compliance (EU/Swiss Data Protection)
**Complexity:** Medium-High

This is a specialized desktop application combining document processing, machine learning-based NER (Named Entity Recognition), and rule-based pattern matching. The domain requires deep understanding of Swiss/EU data protection regulations (GDPR, Swiss FADP) and regional PII formats.

### Domain Context

The application operates in the intersection of:
- **Document Processing** - Multi-format ingestion and conversion
- **Privacy Engineering** - PII detection, anonymization, and compliance
- **AI/ML Integration** - Local transformer models for entity recognition
- **Desktop Security** - Electron sandboxing, IPC isolation, path validation

Key compliance considerations:
- Swiss Federal Act on Data Protection (FADP/nDSG)
- EU General Data Protection Regulation (GDPR)
- Data minimization principles
- Right to erasure support via mapping files

---

## Success Criteria

### Core Success Metrics

| Metric | Target | Current | Priority |
|--------|--------|---------|----------|
| PII Detection Accuracy | 98%+ | 94% | P0 |
| False Positive Rate | <2% | ~5% | P0 |
| Processing Speed | <30s for typical document | ~15s | P1 |
| Format Support | 5 formats | 5 formats | P0 |
| Multi-language UI | EN, FR, DE | Complete | P1 |

### Quality Gates

1. **Zero PII Leakage** - No detected PII should appear in output without anonymization
2. **Document Fidelity** - Markdown output must preserve semantic structure (headings, tables, lists)
3. **Offline Capability** - Application must function without network connectivity after initial model download
4. **Reversibility** - All anonymizations must be reversible via mapping file

### Business Metrics

- User productivity: 10x faster than manual redaction
- Compliance confidence: Auditable anonymization with mapping trail
- Adoption friction: <5 minutes from download to first anonymized document

---

## Product Scope

### MVP - Minimum Viable Product

The current v2.0.0 represents the completed MVP with:

**Document Processing**
- [x] DOCX to Markdown conversion (mammoth)
- [x] PDF to Markdown with table detection (pdf-parse + custom detector)
- [x] Excel to Markdown with formatting preservation (exceljs)
- [x] CSV to Markdown tables
- [x] Plain text to Markdown

**PII Detection**
- [x] ML-based NER using @xenova/transformers
- [x] Swiss/EU rule-based patterns (SwissEuDetector.js)
- [x] Entity types: PERSON, ORG, ADDRESS, PHONE, EMAIL, DATE, ID_NUMBER, SWISS_AVS, IBAN

**User Interface**
- [x] Drag-and-drop file upload
- [x] Real-time preview with PII highlighting
- [x] Batch processing queue
- [x] i18n support (EN, FR, DE)

**Security**
- [x] 100% local processing
- [x] IPC isolation with context bridge
- [x] Path validation to prevent directory traversal
- [x] Secure temp file handling

### Growth Features (Post-MVP)

**Accuracy Improvements** (from brainstorming session)
- [ ] Multi-pass detection architecture (entities → relationships)
- [ ] Document-type-aware processing (invoice, letter, form detection)
- [ ] Address component grouping (street + number + postal + city as single entity)
- [ ] Sliding window context for improved accuracy
- [ ] Confidence scoring with user review workflow

**Format Expansion**
- [ ] PowerPoint (PPTX) support
- [ ] RTF support
- [ ] HTML support
- [ ] Image OCR integration (Tesseract)

**Enterprise Features**
- [ ] Custom PII pattern configuration
- [ ] Organization-specific entity dictionaries
- [ ] Batch folder processing with watch mode
- [ ] CLI interface for automation

### Vision (Future)

**Advanced Intelligence**
- Document classification and routing
- Learning from user corrections (feedback loop)
- Cross-document entity consistency
- Named entity linking (person → role → organization)

**Integration**
- VS Code extension for developers
- Browser extension for web content
- API mode for system integration
- Cloud deployment option (for enterprise with data residency controls)

---

## Domain-Specific Requirements

### Privacy & Compliance Domain

This application must adhere to privacy-by-design principles:

**Data Minimization**
- Only extract text necessary for anonymization
- No logging of document content
- Temp files securely deleted after processing

**Purpose Limitation**
- Clear user consent for processing
- No secondary use of extracted data
- No telemetry or analytics

**Accuracy Requirement**
- False negatives (missed PII) are critical failures
- System should err on side of over-detection
- Confidence thresholds must be configurable

**Accountability**
- Mapping files provide audit trail
- Processing logs (without content) available
- Version tracking for reproducibility

This section shapes all functional and non-functional requirements below.

---

## Innovation & Novel Patterns

### Multi-Pass Detection Architecture

Based on brainstorming analysis, the key innovation is transitioning from single-pass to multi-pass processing:

```
Pass 1: Raw Entity Detection (high recall)
  ↓
Pass 2: Entity Relationship Modeling (link components)
  ↓
Pass 3: Context Validation (reduce false positives)
  ↓
Pass 4: Document-Type Adjustment (format-specific rules)
```

### Hybrid ML + Rules Engine

Combining transformer-based NER with deterministic rule matching:
- ML model provides base entity detection
- Rules validate format compliance (Swiss phone format, AVS checksum)
- Rules catch region-specific patterns ML models miss
- Ensemble scoring determines final confidence

### Validation Approach

1. **Golden Test Suite** - 100+ annotated documents with known PII
2. **Regression Testing** - Every change tested against baseline accuracy
3. **User Feedback Integration** - Missed PII reports feed training data
4. **A/B Comparison** - New algorithms compared against current production

---

## Desktop Application Specific Requirements

### Platform Support

| Platform | Status | Installer |
|----------|--------|-----------|
| macOS (Intel) | Supported | DMG |
| macOS (Apple Silicon) | Supported | DMG |
| Windows 10/11 | Supported | NSIS/MSI |
| Linux (Debian-based) | Supported | AppImage/DEB |

### System Requirements

- **RAM:** 4GB minimum, 8GB recommended (ML model loading)
- **Disk:** 1GB available (500MB for ML model cache)
- **Display:** 1280x720 minimum resolution
- **OS:** macOS 10.15+, Windows 10+, Ubuntu 20.04+

### Desktop Integration

- System tray presence for quick access
- Native file dialog integration
- Drag-and-drop from file managers
- Keyboard shortcuts for power users
- Auto-update via electron-updater

---

## User Experience Principles

### Design Philosophy

1. **Privacy Visible** - User should always know data stays local
2. **Confidence Transparency** - Show detection confidence levels
3. **Progressive Disclosure** - Simple by default, power features discoverable
4. **Error Recovery** - Clear guidance when processing fails
5. **Accessibility First** - WCAG 2.1 AA compliance target

### Key Interactions

**Primary Flow: Document Anonymization**
```
1. Drop file(s) → Immediate format detection
2. Preview panel shows document structure
3. PII highlighted with entity type labels
4. One-click process or batch queue
5. Download anonymized MD + mapping JSON
```

**Secondary Flow: Review & Correct**
```
1. View detected entities in sidebar
2. Dismiss false positives
3. Mark missed PII manually
4. Re-process with corrections
```

**Settings & Configuration**
```
1. Language selection (EN/FR/DE)
2. Detection sensitivity slider
3. Entity type toggles (enable/disable)
4. Output folder preference
```

---

## Functional Requirements

### FR-1: Document Ingestion

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-1.1 | Accept DOCX files up to 50MB | P0 | Done |
| FR-1.2 | Accept PDF files up to 50MB | P0 | Done |
| FR-1.3 | Accept Excel files (XLSX, XLS) up to 50MB | P0 | Done |
| FR-1.4 | Accept CSV files up to 50MB | P0 | Done |
| FR-1.5 | Accept TXT files up to 50MB | P0 | Done |
| FR-1.6 | Detect and reject unsupported file types | P0 | Done |
| FR-1.7 | Support batch file selection (up to 20 files) | P1 | Done |
| FR-1.8 | Display file metadata before processing | P1 | Done |

### FR-2: PII Detection

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-2.1 | Detect person names (multi-language) | P0 | Done |
| FR-2.2 | Detect organization names | P0 | Done |
| FR-2.3 | Detect email addresses | P0 | Done |
| FR-2.4 | Detect phone numbers (Swiss/EU formats) | P0 | Done |
| FR-2.5 | Detect Swiss AVS/AHV numbers with checksum validation | P0 | Done |
| FR-2.6 | Detect IBAN with country validation | P0 | Done |
| FR-2.7 | Detect Swiss addresses (postal code + city) | P0 | Done |
| FR-2.8 | Detect dates (multiple formats) | P1 | Done |
| FR-2.9 | Detect contract/reference numbers | P1 | Done |
| FR-2.10 | Support multi-pass detection for relationship modeling | P0 | Planned |
| FR-2.11 | Document-type-aware detection rules | P1 | Planned |

### FR-3: Anonymization

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-3.1 | Replace PII with type-specific placeholders | P0 | Done |
| FR-3.2 | Generate unique identifiers per entity instance | P0 | Done |
| FR-3.3 | Maintain consistency (same entity → same placeholder) | P0 | Done |
| FR-3.4 | Create reversible mapping file (JSON) | P0 | Done |
| FR-3.5 | Support partial anonymization (user selects entities) | P2 | Planned |

### FR-4: Output Generation

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-4.1 | Generate GitHub Flavored Markdown | P0 | Done |
| FR-4.2 | Preserve document structure (headings, lists) | P0 | Done |
| FR-4.3 | Convert tables to GFM table syntax | P0 | Done |
| FR-4.4 | Include YAML frontmatter with metadata | P1 | Done |
| FR-4.5 | Generate mapping JSON alongside MD | P0 | Done |
| FR-4.6 | Support custom output directory | P1 | Done |

### FR-5: User Interface

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-5.1 | Drag-and-drop file upload zone | P0 | Done |
| FR-5.2 | Real-time file preview | P0 | Done |
| FR-5.3 | PII highlighting in preview | P0 | Done |
| FR-5.4 | Processing progress indicator | P0 | Done |
| FR-5.5 | Batch queue management | P1 | Done |
| FR-5.6 | Language switcher (EN/FR/DE) | P1 | Done |
| FR-5.7 | Entity sidebar with type filters | P2 | Planned |
| FR-5.8 | Manual PII marking tool | P2 | Planned |

---

## Non-Functional Requirements

### Performance

| ID | Requirement | Target | Priority |
|----|-------------|--------|----------|
| NFR-P1 | Initial app launch time | <5s | P1 |
| NFR-P2 | ML model load time (first use) | <30s | P2 |
| NFR-P3 | Document processing (10-page PDF) | <30s | P1 |
| NFR-P4 | Memory usage (idle) | <300MB | P1 |
| NFR-P5 | Memory usage (processing) | <1GB | P1 |
| NFR-P6 | Batch processing throughput | 10 docs/min | P2 |

### Security

| ID | Requirement | Target | Priority |
|----|-------------|--------|----------|
| NFR-S1 | Zero network calls during processing | 100% | P0 |
| NFR-S2 | IPC context isolation | Enabled | P0 |
| NFR-S3 | Path traversal prevention | All inputs | P0 |
| NFR-S4 | Secure temp file cleanup | Automatic | P0 |
| NFR-S5 | No telemetry/tracking | Zero | P0 |
| NFR-S6 | Input validation on all IPC channels | 100% | P0 |
| NFR-S7 | ReDoS protection in regex patterns | All patterns | P0 |

### Accessibility

| ID | Requirement | Target | Priority |
|----|-------------|--------|----------|
| NFR-A1 | Keyboard navigation | Full support | P1 |
| NFR-A2 | Screen reader compatibility | NVDA, VoiceOver | P2 |
| NFR-A3 | Color contrast ratio | WCAG AA (4.5:1) | P1 |
| NFR-A4 | Focus indicators | Visible | P1 |
| NFR-A5 | Text scaling support | 100%-200% | P2 |

### Reliability

| ID | Requirement | Target | Priority |
|----|-------------|--------|----------|
| NFR-R1 | Crash recovery | Auto-save state | P1 |
| NFR-R2 | Error handling coverage | 100% async ops | P0 |
| NFR-R3 | Graceful degradation | Skip failed files | P1 |
| NFR-R4 | Timeout protection | All operations | P0 |

---

_This PRD captures the essence of A5-PII-Anonymizer - empowering users to safely leverage AI tools while maintaining complete control over their sensitive data._

_Created through collaborative discovery between Olivier and AI facilitator._
