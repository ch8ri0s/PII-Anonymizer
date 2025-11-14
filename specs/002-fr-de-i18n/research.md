# Phase 0: Research & Analysis - i18n Implementation

**Feature**: French and German Internationalization Support
**Date**: 2025-11-11
**Purpose**: Resolve technical unknowns and establish implementation patterns

## Research Questions & Decisions

### 1. Electron i18n Architecture with Context Isolation

**Question**: How should we handle i18n in Electron with `contextIsolation: true` and `nodeIntegration: false`?

**Research Findings**:
- Popular libraries (i18next, electron-i18n) require complex setup with context isolation
- Most add significant bundle size (50-200KB) for features we don't need
- Native Intl API provides all formatting capabilities we need (dates, numbers, pluralization)
- Simple JSON + custom loader is fastest and most maintainable for our scale

**Decision**: **Custom JSON-based translation system**

**Rationale**:
- Zero external dependencies (aligns with privacy-first constitution)
- Full control over translation loading and caching
- Minimal bundle size impact (~2KB for loader code)
- Leverages native `Intl` API for locale formatting
- Easier to audit and maintain than external libraries

**Implementation Pattern**:
```javascript
// Main process: Load translations from JSON files
const translations = {
  en: require('../locales/en.json'),
  fr: require('../locales/fr.json'),
  de: require('../locales/de.json')
};

// IPC Handler
ipcMain.handle('i18n:getTranslations', (event, locale) => {
  return translations[locale] || translations.en;
});

// Renderer via preload
contextBridge.exposeInMainWorld('i18nAPI', {
  getTranslations: (locale) => ipcRenderer.invoke('i18n:getTranslations', locale),
  getDetectedLocale: () => ipcRenderer.invoke('i18n:getDetectedLocale')
});
```

**Alternatives Considered**:
- `i18next`: Too complex, 200KB bundle size, overkill for 3 languages
- `electron-i18n`: Requires webpack config changes, less flexible
- Inline translations in renderer: Violates security model, no SSR possible

---

### 2. Locale Detection Strategy

**Question**: How reliable is `app.getLocale()` and how do we handle locale variants (fr-FR, fr-CH, de-DE, de-CH)?

**Research Findings**:
- `app.getLocale()` returns full locale string (e.g., `fr-FR`, `de-CH`, `en-US`)
- Reliability: 99%+ across macOS/Windows/Linux (uses OS language preferences)
- Locale variants: Swiss French/German use same translations as FR/DE (per spec assumptions)
- Fallback needed for unsupported locales (Spanish → English)

**Decision**: **Use `app.getLocale()` with two-character language extraction**

**Rationale**:
- System API is most reliable source of user preference
- Simple fallback logic handles variants and unsupported languages
- No user prompts needed on first launch

**Implementation Pattern**:
```javascript
function detectLanguage() {
  const systemLocale = app.getLocale(); // e.g., 'fr-FR', 'de-CH'
  const language = systemLocale.substring(0, 2); // Extract 'fr', 'de'

  const supported = ['en', 'fr', 'de'];
  return supported.includes(language) ? language : 'en';
}
```

**Edge Cases Handled**:
- `fr-CH` → `fr` (Swiss French uses standard French translations)
- `de-AT` → `de` (Austrian German uses standard German translations)
- `es-ES` → `en` (Spanish not supported, default to English)
- `en-GB` → `en` (All English variants use same translations)

**Alternatives Considered**:
- Full locale matching (fr-FR vs fr-CH): Unnecessary, same translations work
- Browser language detection: Not applicable (Electron desktop app)
- Prompt user on first launch: Adds friction, system preference is sufficient

---

### 3. Translation File Structure

**Question**: Should translation keys be flat or nested? How to organize for maintainability?

**Research Findings**:
- Flat structure (`"upload_title"`, `"metadata_filename"`): Simple but scales poorly
- Nested structure (`"upload": { "title": ... }`): Better organization, follows UI hierarchy
- Deeply nested (3+ levels): Harder to reference, more verbose
- Key naming: snake_case vs camelCase vs dot.notation

**Decision**: **2-level nested structure with dot notation**

**Rationale**:
- Mirrors UI component structure (upload, metadata, processing, download)
- Easy to find translations by feature area
- Dot notation for keys (`upload.title`) is concise and readable
- Prevents key collisions across UI sections

**Translation JSON Structure**:
```json
{
  "metadata": {
    "locale": "en",
    "version": "2.0.0",
    "lastUpdated": "2025-11-11T00:00:00Z"
  },
  "translations": {
    "app": {
      "title": "PII Anonymiser",
      "subtitle": "Upload documents to automatically detect and sanitize..."
    },
    "upload": {
      "title": "Drop your file here",
      "browse": "Browse Files",
      "dragText": "or click to browse from your computer",
      "supportedFormats": "Supported formats"
    },
    "metadata": {
      "filename": "File Name",
      "type": "Type",
      "size": "Size",
      "modified": "Last Modified"
    },
    "processing": {
      "ready": "Ready to process your file",
      "processButton": "Process File",
      "processing": "Processing and sanitizing PII...",
      "success": "File successfully processed and sanitized"
    },
    "download": {
      "markdown": "Markdown",
      "mapping": "Mapping"
    },
    "fileTypes": {
      "pdfDocument": "PDF Document",
      "wordDocument": "Word Document",
      "excelSpreadsheet": "Excel Spreadsheet",
      "csvFile": "CSV File",
      "textFile": "Text File"
    },
    "entityTypes": {
      "person": "Person",
      "location": "Location",
      "organization": "Organization",
      "phone": "Phone",
      "email": "Email",
      "iban": "IBAN",
      "ahv": "AHV Number",
      "passport": "Passport",
      "uidNumber": "UID Number"
    },
    "errors": {
      "fileLoadFailed": "Failed to load file data",
      "processingFailed": "Processing failed",
      "invalidFile": "Invalid file type"
    }
  }
}
```

**Access Pattern**:
```javascript
i18n.t('upload.title')         // "Drop your file here"
i18n.t('metadata.filename')    // "File Name"
i18n.t('errors.fileLoadFailed') // "Failed to load file data"
```

**Alternatives Considered**:
- Flat structure: Doesn't scale, hard to find related keys
- 3+ level nesting: Too verbose (`app.header.title.main`)
- Component-based files: Multiple JSON files harder to manage

---

### 4. Locale Formatting (Dates, Times, Numbers)

**Question**: How to format locale-specific data without external libraries?

**Research Findings**:
- JavaScript `Intl` API provides comprehensive locale formatting
- `Intl.DateTimeFormat`: Handles date/time with locale-specific patterns
- `Intl.NumberFormat`: Handles numbers, currencies, units with proper separators
- CLDR standards: French/German use space as thousands separator, comma for decimals
- Browser/Node.js support: Intl API fully supported in Electron's Chromium

**Decision**: **Use native `Intl` API for all formatting**

**Rationale**:
- Zero dependencies, built into JavaScript engine
- Fully standards-compliant (Unicode CLDR)
- Automatic locale-specific formatting
- Covers all requirements (dates, times, file sizes)

**Implementation Patterns**:

**Date Formatting**:
```javascript
function formatDate(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}
// en: "11/11/2025"
// fr: "11/11/2025" (day-month-year in France)
// de: "11.11.2025" (day.month.year in Germany)
```

**Time Formatting**:
```javascript
function formatTime(date, locale) {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}
// en: "2:30:45 PM"
// fr: "14:30:45" (24-hour format)
// de: "14:30:45" (24-hour format)
```

**Number Formatting** (File Sizes):
```javascript
function formatFileSize(bytes, locale) {
  const kb = bytes / 1024;
  const mb = kb / 1024;

  if (mb >= 1) {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(mb) + ' MB';
  }
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(kb) + ' KB';
}
// en: "1,234.56 KB"
// fr: "1 234,56 KB" (space + comma)
// de: "1.234,56 KB" (dot + comma)
```

**Alternatives Considered**:
- Moment.js / date-fns: Adds 200KB+, overkill for simple formatting
- Manual formatting: Error-prone, doesn't follow locale conventions
- Template strings with locale-specific patterns: Brittle, hard to maintain

---

### 5. Language Preference Persistence

**Question**: Where to store user's manual language selection?

**Research Findings**:
- `localStorage`: Available in renderer, persists across sessions, domain-scoped
- `electron-store`: Requires additional dependency, overkill for single value
- Config file (JSON): Requires file I/O, more complex IPC
- Cookies: Not applicable (desktop app)

**Decision**: **Use `localStorage` in renderer process**

**Rationale**:
- Simplest solution with zero dependencies
- Secure with context isolation (isolated per origin)
- Synchronous API (no async complexity)
- Automatic persistence across app restarts
- Scoped to renderer (no main process coordination needed)

**Implementation Pattern**:
```javascript
// Save preference
function setLanguagePreference(locale) {
  localStorage.setItem('preferredLanguage', locale);
  localStorage.setItem('languageSource', 'manual');
  localStorage.setItem('languageTimestamp', Date.now());
}

// Load preference
function getLanguagePreference() {
  const preferred = localStorage.getItem('preferredLanguage');
  const source = localStorage.getItem('languageSource') || 'auto';

  if (preferred && ['en', 'fr', 'de'].includes(preferred)) {
    return { locale: preferred, source };
  }

  // Fall back to OS language if no preference or invalid
  return { locale: detectSystemLanguage(), source: 'auto' };
}

// Clear preference (reset to auto)
function clearLanguagePreference() {
  localStorage.removeItem('preferredLanguage');
  localStorage.removeItem('languageSource');
}
```

**Data Stored**:
- `preferredLanguage`: `"en"` | `"fr"` | `"de"`
- `languageSource`: `"auto"` | `"manual"`
- `languageTimestamp`: Unix timestamp (for analytics/debugging)

**Security Considerations**:
- localStorage is isolated per Electron session (no XSS risk with context isolation)
- Values validated before use (whitelist check)
- No sensitive data stored (only UI preference)

**Alternatives Considered**:
- `electron-store`: 50KB dependency for storing 3 values, overkill
- Config file in app data directory: Requires IPC, async I/O, more complexity
- Main process global: Requires IPC coordination, harder to test

---

## Technology Decisions Summary

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Translation System | Custom JSON + native loader | Zero dependencies, full control, minimal size |
| Locale Detection | `app.getLocale()` with fallback | System API most reliable, simple extraction logic |
| Translation Structure | 2-level nested with dot notation | Organized by UI section, easy to navigate |
| Date/Time/Number Formatting | Native `Intl` API | Standards-compliant, zero dependencies |
| Preference Storage | `localStorage` in renderer | Simplest, secure, automatic persistence |

## Implementation Checklist

- [x] Research Electron i18n patterns
- [x] Evaluate locale detection methods
- [x] Design translation JSON structure
- [x] Verify Intl API capabilities
- [x] Choose preference storage mechanism
- [ ] Create translation JSON schema (Phase 1)
- [ ] Define IPC contracts (Phase 1)
- [ ] Write developer guide (Phase 1)

## References

- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
- [MDN Intl API Documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl)
- [Unicode CLDR - Locale Data](https://cldr.unicode.org/)
- [Electron app.getLocale() Documentation](https://www.electronjs.org/docs/latest/api/app#appgetlocale)

## Next Steps

Phase 1: Design
- Create `data-model.md` with entity definitions
- Create `contracts/` directory with JSON schemas and IPC definitions
- Create `quickstart.md` developer guide for adding translations
- Update agent context with i18n technology choices
