# Internationalization (i18n) Guide

**Softcom PII Anonymiser - French & German Support**
**Version**: 2.0.0
**Last Updated**: 2025-11-12

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Features](#features)
4. [Architecture](#architecture)
5. [Usage Guide](#usage-guide)
6. [Testing](#testing)
7. [Adding New Languages](#adding-new-languages)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The PII Anonymiser supports three languages with automatic OS detection and user preference persistence:

- 🇬🇧 **English** (en) - Default
- 🇫🇷 **French** (fr)
- 🇩🇪 **German** (de)

### Key Features

✅ **Automatic OS Language Detection**
✅ **Visual Language Selector** (flag buttons in header)
✅ **localStorage Persistence** (remembers user preference)
✅ **Locale-Specific Formatting** (dates, times, file sizes)
✅ **Zero External Dependencies** (custom JSON-based solution)
✅ **100% Test Coverage** (139 passing tests)

---

## Quick Start

### Using the Language Selector

Click the flag buttons in the top-right corner:
- 🇬🇧 = English
- 🇫🇷 = French
- 🇩🇪 = German

The UI updates immediately and your preference is saved.

### Programmatic Language Change

Open browser console (DevTools) and run:

```javascript
// Change to French
await window.i18n.changeLanguage('fr');

// Change to German
await window.i18n.changeLanguage('de');

// Check current language
console.log(window.i18n.currentLocale); // 'en', 'fr', or 'de'
```

---

## Features

### 1. Automatic OS Detection

On first launch, the app detects your system language:

```javascript
// Detected on macOS/Windows/Linux
System locale: fr-FR → Language: French (fr)
System locale: de-CH → Language: German (de)
System locale: es-ES → Language: English (en) [fallback]
```

### 2. Locale-Specific Formatting

#### Dates

| Language | Format | Example |
|----------|--------|---------|
| English | MM/DD/YYYY | 11/12/2025 |
| French | DD/MM/YYYY | 12/11/2025 |
| German | DD.MM.YYYY | 12.11.2025 |

#### Times

| Language | Format | Example |
|----------|--------|---------|
| English | 12-hour | 2:30:45 PM |
| French | 24-hour | 14:30:45 |
| German | 24-hour | 14:30:45 |

#### Numbers & File Sizes

| Language | Format | Example |
|----------|--------|---------|
| English | 1,234.56 KB | Comma thousands, dot decimal |
| French | 1 234,56 KB | Space thousands, comma decimal |
| German | 1.234,56 KB | Dot thousands, comma decimal |

### 3. Fallback Chain

When a translation is missing:

```
User Locale (fr) → English (en) → Key itself
```

Example:
```javascript
// If 'upload.newKey' missing in French:
window.i18n.t('upload.newKey')
// → Returns English value (fallback)
// → Or 'upload.newKey' if not in English either
```

---

## Architecture

### File Structure

```
├── locales/                  # Translation files
│   ├── en.json              # English (88 keys)
│   ├── fr.json              # French (88 keys)
│   └── de.json              # German (88 keys)
├── src/i18n/                # Core modules
│   ├── languageDetector.js  # OS language detection
│   ├── localeFormatter.js   # Date/time/number formatting
│   ├── i18nService.js       # Translation service
│   └── rendererI18n.js      # ES module version (optional)
├── src/services/
│   └── i18nHandlers.js      # IPC handlers (main process)
├── i18n-init.js             # Renderer initialization
└── test/unit/i18n/          # 139 passing tests
```

### Translation File Format

**`locales/en.json`:**
```json
{
  "metadata": {
    "locale": "en",
    "version": "2.0.0",
    "lastUpdated": "2025-11-12T00:00:00Z"
  },
  "translations": {
    "app": {
      "title": "PII Anonymiser",
      "subtitle": "Upload documents to automatically detect..."
    },
    "upload": {
      "heading": "Drop your file here",
      "browseButton": "Browse Files"
    }
  }
}
```

### Component Architecture

```
┌─────────────────────────────────────────────┐
│          User Interface (HTML)              │
│         Click 🇫🇷 button → French          │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│        i18n-init.js (Renderer)              │
│  • Detects OS language                      │
│  • Loads translations via IPC               │
│  • Updates UI with translations             │
│  • Handles language selector clicks         │
└──────────────────┬──────────────────────────┘
                   │ IPC (secure)
┌──────────────────▼──────────────────────────┐
│      i18nHandlers.js (Main Process)         │
│  • Reads locales/*.json files               │
│  • Validates locale (whitelist)             │
│  • Returns translations to renderer         │
└─────────────────────────────────────────────┘
```

---

## Usage Guide

### For Users

**Change Language:**
1. Click a flag button in the top-right corner
2. UI updates immediately
3. Language preference is saved

**Reset to OS Language:**
```javascript
// Clear saved preference
localStorage.removeItem('preferredLanguage');
localStorage.removeItem('languageSource');
// Reload app - will detect OS language again
```

### For Developers

#### Adding a New Translation Key

**1. Add to English (`locales/en.json`):**
```json
{
  "translations": {
    "buttons": {
      "submit": "Submit",
      "newKey": "New Button Text"  // ← Add here
    }
  }
}
```

**2. Add to French (`locales/fr.json`):**
```json
{
  "translations": {
    "buttons": {
      "submit": "Soumettre",
      "newKey": "Nouveau texte du bouton"  // ← French translation
    }
  }
}
```

**3. Add to German (`locales/de.json`):**
```json
{
  "translations": {
    "buttons": {
      "submit": "Absenden",
      "newKey": "Neuer Button-Text"  // ← German translation
    }
  }
}
```

**4. Use in Code:**

In HTML (via i18n-init.js):
```javascript
// The updateUI() function automatically translates elements
// Or manually:
document.getElementById('my-button').textContent = window.i18n.t('buttons.newKey');
```

In renderer.js:
```javascript
const buttonText = window.i18n.t('buttons.newKey');
```

#### Formatting Dates and File Sizes

**File Size:**
```javascript
const bytes = 1234567;
const formatted = window.i18n.formatFileSize(bytes);
// English: "1,234.57 KB"
// French:  "1 234,57 KB"
// German:  "1.234,57 KB"
```

**Date:**
```javascript
const date = new Date();
const formatted = window.i18n.formatDate(date);
// English: "11/12/2025"
// French:  "12/11/2025"
// German:  "12.11.2025"
```

**Time:**
```javascript
const date = new Date();
const formatted = window.i18n.formatTime(date);
// English: "2:30:45 PM"
// French:  "14:30:45"
// German:  "14:30:45"
```

#### Listening for Language Changes

```javascript
window.addEventListener('language-changed', (event) => {
  const newLocale = event.detail.locale;
  console.log(`Language changed to: ${newLocale}`);

  // Update dynamic content
  updateMyComponent();
});
```

---

## Testing

### Run All i18n Tests

```bash
# All tests (139 passing)
npm run test:i18n

# Translation coverage only
npm run test:i18n:coverage
```

### Test Coverage

| Module | Tests | Status |
|--------|-------|--------|
| Translation Coverage | 14 | ✅ Passing |
| Language Detector | 27 | ✅ Passing |
| Locale Formatter | 42 | ✅ Passing |
| i18n Service | 56 | ✅ Passing |
| **Total** | **139** | ✅ **All Passing** |

### Manual Testing Checklist

- [ ] App starts in correct OS language
- [ ] Click 🇫🇷 → All text changes to French
- [ ] Click 🇩🇪 → All text changes to German
- [ ] Click 🇬🇧 → All text changes to English
- [ ] File sizes formatted correctly (space/dot/comma)
- [ ] Dates formatted correctly (MM/DD vs DD/MM vs DD.MM)
- [ ] Times formatted correctly (12h vs 24h)
- [ ] Close and reopen → Language persists
- [ ] Upload file → Metadata shows correct formats
- [ ] No text overflow (French/German are longer)

---

## Adding New Languages

### Step 1: Create Translation File

Create `locales/es.json` (Spanish example):

```json
{
  "metadata": {
    "locale": "es",
    "version": "2.0.0",
    "lastUpdated": "2025-11-12T00:00:00Z"
  },
  "translations": {
    "app": {
      "title": "Anonimizador PII",
      "subtitle": "Suba documentos para detectar automáticamente..."
    },
    // ... all 88 keys translated to Spanish
  }
}
```

### Step 2: Update Language Detector

**`src/i18n/languageDetector.js`:**
```javascript
const supported = ['en', 'fr', 'de', 'es']; // Add 'es'
```

### Step 3: Update Locale Formatter

**`src/i18n/localeFormatter.js`:**
```javascript
const localeMap = {
  'en': 'en-US',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'es': 'es-ES'  // Add Spanish mapping
};
```

### Step 4: Update Preload Validation

**`preload.cjs`:**
```javascript
if (typeof locale !== 'string' || !['en', 'fr', 'de', 'es'].includes(locale)) {
  return Promise.reject(new Error('Invalid locale. Must be en, fr, de, or es'));
}
```

### Step 5: Add Language Button

**`index.html`:**
```html
<button class="language-btn" data-lang="es" title="Español">
  <span style="font-size: 1.25rem;">🇪🇸</span>
</button>
```

### Step 6: Update Tests

**`test/unit/i18n/translationCoverage.test.js`:**
```javascript
const esData = await loadTranslations('es');

it('should have all English keys in Spanish', () => {
  // Add test for Spanish parity
});
```

### Step 7: Verify

```bash
npm run test:i18n:coverage
# Should show 100% parity for Spanish
```

---

## Troubleshooting

### Issue: "Translation not found"

**Cause**: Key doesn't exist in translation file

**Solution**:
1. Check spelling: `window.i18n.t('uploda.title')` ← typo
2. Verify key exists in `locales/en.json`
3. Verify key exists in `locales/fr.json` and `locales/de.json`
4. Run: `npm run test:i18n:coverage`

### Issue: Text Overflow

**Cause**: French/German translations are longer

**Solution**:
- Use `text-overflow: ellipsis` in CSS
- Increase container width
- Use shorter translations
- Test in all languages visually

### Issue: Date Format Wrong

**Cause**: Using manual formatting instead of Intl API

**Bad**:
```javascript
const formatted = `${month}/${day}/${year}`;
```

**Good**:
```javascript
const formatted = window.i18n.formatDate(date);
```

### Issue: Language Not Persisting

**Cause**: localStorage not being set correctly

**Solution**:
```javascript
// All three must be set together
localStorage.setItem('preferredLanguage', locale);
localStorage.setItem('languageSource', 'manual');
localStorage.setItem('languageTimestamp', Date.now().toString());
```

### Issue: Missing Translations

**Check coverage**:
```bash
npm run test:i18n:coverage
```

**Fix**:
1. Add missing key to `locales/en.json`
2. Add French translation to `locales/fr.json`
3. Add German translation to `locales/de.json`
4. Re-run tests

---

## Best Practices

### DO ✓

- **Always add to all three files** (`en.json`, `fr.json`, `de.json`)
- **Use descriptive keys**: `upload.drop_zone_hint` not `upload.text1`
- **Keep translations concise**: UI space is limited
- **Use Intl API for formatting**: Don't hardcode date/number formats
- **Test in all languages**: Visual review in FR and DE
- **Get native speaker review**: For user-facing text

### DON'T ✗

- **Don't use HTML in translations**: `"Click <b>here</b>"` ← BAD
- **Don't include variables**: `"Hello {name}"` ← Use template literals in code
- **Don't nest too deep**: Max 2 levels (`section.key`)
- **Don't hardcode text in renderer**: Always use `window.i18n.t()`
- **Don't mix languages**: All keys must exist in all languages
- **Don't translate programmatic values**: Error codes, API keys, etc.

---

## Resources

- **Translation Files**: `/locales/*.json`
- **i18n Service**: `/src/i18n/i18nService.js`
- **Locale Formatter**: `/src/i18n/localeFormatter.js`
- **IPC Handlers**: `/src/services/i18nHandlers.js`
- **Tests**: `/test/unit/i18n/*.test.js`
- **Quick Start**: `/specs/002-fr-de-i18n/quickstart.md`
- **Contracts**: `/specs/002-fr-de-i18n/contracts/`

---

## Summary

The Softcom PII Anonymiser i18n system provides:

- ✅ **3 Languages**: English, French, German
- ✅ **Auto-Detection**: OS language on first launch
- ✅ **Persistence**: localStorage for user preference
- ✅ **Formatting**: Locale-specific dates, times, file sizes
- ✅ **Testing**: 139 tests with 100% coverage
- ✅ **Zero Dependencies**: Custom JSON solution
- ✅ **Security**: IPC validation, no user-controlled paths

**Ready for production use!** 🚀

---

*For more details, see `/specs/002-fr-de-i18n/` directory.*
