# Implementation Plan: French and German Internationalization Support

**Branch**: `002-fr-de-i18n` | **Date**: 2025-11-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-fr-de-i18n/spec.md`

## Summary

Add French and German internationalization (i18n) support to the Softcom PII Anonymiser Electron desktop application. The system will detect the user's operating system language preference, display all UI text in the selected language (English, French, or German), provide a manual language selector, and persist language preferences across sessions. The implementation uses a JSON-based translation system with locale-specific formatting for dates, times, and numbers, following Electron best practices for context-isolated renderer processes.

## Technical Context

**Language/Version**: JavaScript ES modules (Node.js 18+), Electron 39.1.1
**Primary Dependencies**:
- `electron` 39.1.1 (main/renderer/preload architecture)
- Built-in `Intl` API for date/time/number formatting
- JSON translation files (no external i18n library needed)

**Storage**:
- Electron `localStorage` in renderer process for language preference persistence
- JSON files for translation strings (`locales/en.json`, `locales/fr.json`, `locales/de.json`)

**Testing**:
- Mocha (existing test framework)
- Manual UI testing for visual verification of translations
- Automated tests for translation coverage and locale detection

**Target Platform**:
- macOS (primary)
- Windows and Linux (secondary)
- Electron desktop application with context isolation

**Project Type**: Single desktop application (Electron main + renderer)

**Performance Goals**:
- Language switching < 100ms
- Zero UI flicker during language change
- Translation file loading < 50ms

**Constraints**:
- Must maintain context isolation (`contextIsolation: true`)
- No external API calls (100% local operation per constitution)
- Must work offline
- Translation strings must not exceed JSON size limits (< 1MB per file)

**Scale/Scope**:
- ~150-200 translatable UI strings
- 3 languages (English, French, German)
- Single-user desktop application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Privacy-First Architecture ✓ PASS

**No network calls required**: Translation files are local JSON loaded from disk. Language detection uses Electron's `app.getLocale()` which reads OS preferences locally. No cloud services or external APIs involved.

**No PII in i18n**: Translation strings contain only static UI text. No user data, file content, or PII appears in translation files or language preference storage.

### II. Test-First Development ✓ PASS

**Test plan defined**: Will write tests for:
1. Translation string coverage (all keys present in all languages)
2. Language detection from OS locale
3. Language preference persistence across sessions
4. Locale formatting (dates, numbers) for each language
5. Fallback behavior for missing translations

**Red-Green-Refactor workflow**: Tests written before implementing translation system, language selector UI, and locale formatting.

### III. Comprehensive PII Detection ⚠️ NOT APPLICABLE

**Not affected**: This feature only translates UI strings. PII detection logic remains unchanged. Entity type labels in change mapping get translated, but detection patterns and models are unaffected.

### IV. Security Hardening ✓ PASS

**Context isolation maintained**: Language preference accessed via IPC handler or preload-exposed API. Translation strings loaded in main process and sent to renderer via secure contextBridge API.

**No new security risks**: JSON translation files are part of application bundle (not user-provided). No file system traversal, no dynamic code execution, no XSS vectors introduced.

**Input sanitization**: Language selector limited to whitelisted values (`en`, `fr`, `de`). No user-provided translation strings accepted.

### V. LLM-Ready Output Quality ⚠️ NOT APPLICABLE

**Not affected**: This feature only translates UI text. Document conversion and Markdown output remain unchanged. Metadata in output files can include language preference for auditability.

### Compliance Summary

- **Passes**: Privacy-First (I), Test-First (II), Security (IV)
- **Not Applicable**: PII Detection (III), Output Quality (V)
- **No violations requiring justification**

## Project Structure

### Documentation (this feature)

```text
specs/002-fr-de-i18n/
├── plan.md              # This file
├── research.md          # Phase 0: i18n patterns, locale APIs, best practices
├── data-model.md        # Phase 1: Translation string structure, language preference model
├── quickstart.md        # Phase 1: Developer guide for adding new translations
├── contracts/           # Phase 1: Translation JSON schema, IPC contract
└── tasks.md             # Phase 2: Implementation task list (created by /speckit.tasks)
```

### Source Code (repository root)

```text
locales/                 # NEW: Translation files
├── en.json              # English (source language)
├── fr.json              # French translations
└── de.json              # German translations

src/
├── i18n/                # NEW: Internationalization module
│   ├── i18nService.js   # Translation loading and management
│   ├── localeFormatter.js # Date/time/number formatting
│   └── languageDetector.js # OS language detection
├── converters/          # Existing
├── pii/                 # Existing
├── services/            # Existing
│   └── i18nHandlers.js  # NEW: IPC handlers for language operations
└── ui/                  # Existing

main.js                  # Modified: Register i18n IPC handlers
preload.cjs              # Modified: Expose i18n APIs via contextBridge
renderer.js              # Modified: Use translated strings, add language selector
index.html               # Modified: Add language selector UI component
styles.css or ui-components.css # Modified: Style language selector

tests/
├── unit/
│   ├── i18nService.test.js       # NEW: Translation loading tests
│   ├── localeFormatter.test.js   # NEW: Formatting tests
│   └── languageDetector.test.js  # NEW: Detection tests
└── integration/
    └── i18n.test.js     # NEW: End-to-end language switching tests
```

**Structure Decision**: Single desktop application structure. New `locales/` directory at root for translation files. New `src/i18n/` module for core i18n functionality. Modifications to existing `main.js`, `preload.cjs`, `renderer.js`, and HTML/CSS for UI integration.

## Complexity Tracking

> **No constitution violations - this section left empty**

## Phase 0: Research & Analysis

*See [research.md](./research.md) for detailed findings*

### Research Tasks

1. **Electron i18n Best Practices**
   - How do Electron apps typically handle i18n with context isolation?
   - What are the trade-offs between i18next, electron-i18n, and custom JSON solutions?
   - Decision: Custom JSON + Intl API (no dependencies)

2. **Locale Detection Strategies**
   - How reliable is `app.getLocale()` across macOS/Windows/Linux?
   - What are the edge cases for locale strings (e.g., `fr-CH` vs `fr-FR`)?
   - Decision: Use `app.getLocale()` with locale fallback logic

3. **Translation Management**
   - What JSON structure optimizes for maintainability and performance?
   - How to organize translations (flat vs nested keys)?
   - Decision: Nested structure by UI section (`upload.title`, `metadata.filename`)

4. **Locale Formatting**
   - How to format dates/times/numbers per locale without external libs?
   - What are the CLDR standards for FR/DE number formatting?
   - Decision: Use native `Intl.DateTimeFormat` and `Intl.NumberFormat`

5. **Language Preference Persistence**
   - Where to store user's language choice in Electron?
   - localStorage vs electron-store vs config file?
   - Decision: `localStorage` in renderer (simplest, secure with context isolation)

## Phase 1: Design & Contracts

*See [data-model.md](./data-model.md) and [quickstart.md](./quickstart.md)*

### Data Model

**Translation String Entity**:
```json
{
  "key": "upload.title",
  "en": "Upload your file here",
  "fr": "Téléchargez votre fichier ici",
  "de": "Laden Sie Ihre Datei hier hoch"
}
```

**Language Preference**:
```javascript
{
  locale: 'fr',        // ISO 639-1 code (en|fr|de)
  source: 'manual',    // 'auto' | 'manual'
  timestamp: 1699680000
}
```

### API Contracts

**IPC Contract** (`src/services/i18nHandlers.js`):
```javascript
// Main → Renderer
ipcMain.handle('i18n:getTranslations', (event, locale) => {
  // Returns: { locale: 'fr', translations: {...} }
});

ipcMain.handle('i18n:getDetectedLocale', () => {
  // Returns: { locale: 'fr-FR', fallback: 'fr' }
});

// Renderer → Main
// (None - language preference stored in renderer localStorage)
```

**Translation JSON Schema** (`contracts/translation-schema.json`):
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["metadata", "translations"],
  "properties": {
    "metadata": {
      "type": "object",
      "properties": {
        "locale": { "type": "string", "pattern": "^(en|fr|de)$" },
        "version": { "type": "string" },
        "lastUpdated": { "type": "string", "format": "date-time" }
      }
    },
    "translations": {
      "type": "object",
      "patternProperties": {
        "^[a-z_]+(\\.[a-z_]+)*$": { "type": "string" }
      }
    }
  }
}
```

### Quick Start Guide

*See [quickstart.md](./quickstart.md) for full developer guide*

**Adding a new translation string**:
1. Add key to `locales/en.json` (source of truth)
2. Add corresponding translations to `locales/fr.json` and `locales/de.json`
3. Use in renderer: `i18n.t('your.new.key')`
4. Run translation coverage test to verify

**Testing translations**:
```bash
npm run test:i18n           # Run all i18n tests
npm run test:i18n:coverage  # Check translation coverage
```

## Phase 2: Implementation Tasks

*Task breakdown will be generated by `/speckit.tasks` command*

This plan ends here. Run `/speckit.tasks` to generate the detailed task list with acceptance criteria, subtasks, and validation steps.

## Next Steps

1. ✅ Phase 0: Create `research.md` with i18n pattern decisions
2. ✅ Phase 1: Create `data-model.md` and API contracts
3. ✅ Phase 1: Create `quickstart.md` developer guide
4. ⏭️ Phase 2: Run `/speckit.tasks` to generate implementation tasks
5. ⏭️ Implementation: Execute tasks following Test-First Development (TDD)
6. ⏭️ Testing: Verify all success criteria from spec.md
7. ⏭️ Documentation: Update README with i18n features
8. ⏭️ Release: Merge to main after all tests pass

## Notes

- **Translation Quality**: Professional French and German translations needed before release (not part of technical implementation)
- **Locale Expansion**: Architecture supports adding more languages by simply adding new JSON files
- **Performance**: Translation file size currently ~50KB per language, well under constraints
- **Accessibility**: Language selector must be keyboard-navigable and screen-reader friendly
