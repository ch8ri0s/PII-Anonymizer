# Quick Start Guide: i18n Development

**Feature**: French and German Internationalization Support
**Audience**: Developers adding or modifying translations
**Last Updated**: 2025-11-11

## Overview

This guide explains how to work with the PII Anonymiser's internationalization system. Our i18n architecture uses:
- **JSON files** for translations (`locales/*.json`)
- **Native Intl API** for date/time/number formatting
- **localStorage** for user preference persistence
- **IPC handlers** for secure translation loading

## Quick Reference

```bash
# Add a new translation
1. Edit locales/en.json (add key)
2. Edit locales/fr.json (add French translation)
3. Edit locales/de.json (add German translation)
4. Use in code: i18n.t('section.key')

# Test translations
npm run test:i18n

# Check translation coverage
npm run test:i18n:coverage

# Run app in specific language
LANG=fr npm run dev    # French
LANG=de npm run dev    # German
```

---

## Adding a New Translation

### Step 1: Add to English (Source of Truth)

**File**: `locales/en.json`

```json
{
  "metadata": {
    "locale": "en",
    "version": "2.0.0",
    "lastUpdated": "2025-11-11T00:00:00Z"
  },
  "translations": {
    "upload": {
      "title": "Drop your file here",
      "newKey": "Your new English text here"  // ← Add this
    }
  }
}
```

**Rules**:
- Use lowercase with underscores for keys (`new_key`, not `newKey` or `NewKey`)
- Nest under appropriate section (`upload`, `metadata`, `processing`, etc.)
- Keep text concise and clear
- Avoid HTML or markup in translations

---

### Step 2: Add French Translation

**File**: `locales/fr.json`

```json
{
  "translations": {
    "upload": {
      "title": "Déposez votre fichier ici",
      "newKey": "Votre nouveau texte français ici"  // ← Add French version
    }
  }
}
```

**Tips**:
- French text is typically 10-15% longer than English
- Use formal "vous" form unless context requires "tu"
- Respect French typography: space before `:`  `;` `!` `?`
- Get native speaker review for user-facing text

---

### Step 3: Add German Translation

**File**: `locales/de.json`

```json
{
  "translations": {
    "upload": {
      "title": "Legen Sie Ihre Datei hier ab",
      "newKey": "Ihr neuer deutscher Text hier"  // ← Add German version
    }
  }
}
```

**Tips**:
- German text is typically 20-30% longer (compound words)
- Use formal "Sie" form for address
- Capitalize all nouns
- Get native speaker review for user-facing text

---

### Step 4: Use in Code

**Renderer** (`renderer.js`):
```javascript
// Simple translation
const text = i18n.t('upload.newKey');
// Returns: "Your new English text here" (if locale is 'en')

// Use in DOM
document.getElementById('my-element').textContent = i18n.t('upload.newKey');

// Use in template literal
const message = `${i18n.t('upload.title')} - ${i18n.t('upload.newKey')}`;
```

---

## Translation Organization

### Sections

Translations are organized by UI area:

| Section | Purpose | Example Keys |
|---------|---------|--------------|
| `app` | Application-level | `app.title`, `app.subtitle` |
| `upload` | Upload interface | `upload.browse`, `upload.dragText` |
| `metadata` | File metadata panel | `metadata.filename`, `metadata.size` |
| `processing` | Processing interface | `processing.ready`, `processing.success` |
| `download` | Download buttons | `download.markdown`, `download.mapping` |
| `tabs` | Tab labels | `tabs.markdown`, `tabs.mapping` |
| `fileTypes` | Document types | `fileTypes.pdfDocument` |
| `entityTypes` | PII entity labels | `entityTypes.person`, `entityTypes.email` |
| `errors` | Error messages | `errors.fileLoadFailed` |
| `buttons` | Common buttons | `buttons.ok`, `buttons.cancel` |

### Key Naming Conventions

**Good**:
```
upload.drop_zone_title
metadata.file_size_label
processing.status_message
```

**Bad**:
```
UploadDropZoneTitle        // No camelCase
upload_drop_zone_title     // No flat keys (missing section)
upload.dropZone.Title      // No deep nesting
upload.title-text          // No hyphens
```

---

## Testing Translations

### Unit Test: Translation Coverage

**File**: `tests/unit/translationCoverage.test.js`

```javascript
import { expect } from 'chai';
import en from '../../locales/en.json';
import fr from '../../locales/fr.json';
import de from '../../locales/de.json';

describe('Translation Coverage', () => {
  it('should have all English keys in French', () => {
    const enKeys = extractKeys(en.translations);
    const frKeys = extractKeys(fr.translations);

    enKeys.forEach(key => {
      expect(frKeys).to.include(key, `Missing French translation for: ${key}`);
    });
  });

  it('should have all English keys in German', () => {
    const enKeys = extractKeys(en.translations);
    const deKeys = extractKeys(de.translations);

    enKeys.forEach(key => {
      expect(deKeys).to.include(key, `Missing German translation for: ${key}`);
    });
  });

  it('should have no empty translations', () => {
    [en, fr, de].forEach(locale => {
      const values = extractValues(locale.translations);
      values.forEach(({ key, value }) => {
        expect(value).to.not.be.empty(`Empty translation for: ${key}`);
      });
    });
  });
});

function extractKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object') {
      keys = keys.concat(extractKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}
```

**Run tests**:
```bash
npm run test -- tests/unit/translationCoverage.test.js
```

---

### Manual Testing

**Test in Different Languages**:
```bash
# Launch app
npm run dev

# In browser console:
window.i18nAPI.getDetectedLocale()  // Check detected language
changeLanguage('fr')                // Switch to French
changeLanguage('de')                // Switch to German
```

**Visual Checklist**:
- [ ] All text labels translated (no English in FR/DE mode)
- [ ] No text overflow (longer translations fit in UI)
- [ ] No layout breaks (buttons, cards sized correctly)
- [ ] Dates formatted correctly (DD/MM/YYYY for FR/DE)
- [ ] Numbers formatted correctly (1 234,56 for FR, 1.234,56 for DE)

---

## Locale Formatting

### Dates

```javascript
import { formatDate } from './src/i18n/localeFormatter.js';

const date = new Date('2025-11-11T14:30:00');

formatDate(date, 'en');  // "11/11/2025"
formatDate(date, 'fr');  // "11/11/2025"
formatDate(date, 'de');  // "11.11.2025"
```

### Times

```javascript
import { formatTime } from './src/i18n/localeFormatter.js';

const date = new Date('2025-11-11T14:30:45');

formatTime(date, 'en');  // "2:30:45 PM"
formatTime(date, 'fr');  // "14:30:45"
formatTime(date, 'de');  // "14:30:45"
```

### File Sizes

```javascript
import { formatFileSize } from './src/i18n/localeFormatter.js';

formatFileSize(1234567, 'en');  // "1,234.57 KB"
formatFileSize(1234567, 'fr');  // "1 234,57 KB"
formatFileSize(1234567, 'de');  // "1.234,57 KB"
```

---

## Common Tasks

### Add a New UI Section

1. **Create section in all three files**:

`locales/en.json`:
```json
{
  "translations": {
    "newSection": {
      "title": "New Feature",
      "description": "This is a new feature"
    }
  }
}
```

2. **Add to FR and DE** with corresponding translations

3. **Use in code**:
```javascript
const title = i18n.t('newSection.title');
```

---

### Handle Missing Translation

**Automatic Fallback**:
```javascript
// If French translation missing, automatically falls back to English
i18n.t('new.missing.key', 'fr');
// Returns English value if French not found
// Returns key itself ('new.missing.key') if English also missing
```

**Manual Fallback**:
```javascript
function getTranslationSafe(key, locale = 'en') {
  try {
    return i18n.t(key, locale);
  } catch (error) {
    console.warn(`Translation not found: ${key}`);
    return key; // Return key as fallback
  }
}
```

---

### Debug Missing Translations

**Enable debug mode** (`src/i18n/i18nService.js`):
```javascript
const DEBUG = true;  // Set to true

function translate(key, locale) {
  const value = lookup(key, locale);

  if (!value && DEBUG) {
    console.warn(`[i18n] Missing translation: ${key} (locale: ${locale})`);
  }

  return value || key;
}
```

**Run app and check console** for warnings about missing keys.

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
- **Don't hardcode text in renderer**: Always use `i18n.t()`
- **Don't mix languages**: All keys must exist in all languages
- **Don't translate programmatic values**: Error codes, API keys, etc.

---

## Troubleshooting

### "Translation not found" error

**Cause**: Key doesn't exist in translation file

**Fix**:
1. Check spelling: `i18n.t('uploda.title')` ← typo
2. Verify key exists in `locales/*.json`
3. Restart app after adding new keys

---

### Text overflow in UI

**Cause**: French/German text longer than English

**Fix**:
1. Check if container has fixed width
2. Use `text-overflow: ellipsis` or wrapping
3. Consider shorter translation
4. Increase container width if needed

---

### Date format wrong

**Cause**: Using manual formatting instead of Intl API

**Fix**:
```javascript
// BAD
const formatted = `${month}/${day}/${year}`;

// GOOD
const formatted = formatDate(date, currentLocale);
```

---

### Language not persisting

**Cause**: localStorage not being set

**Fix**:
```javascript
function changeLanguage(locale) {
  // Must save ALL three values
  localStorage.setItem('preferredLanguage', locale);
  localStorage.setItem('languageSource', 'manual');
  localStorage.setItem('languageTimestamp', Date.now().toString());
}
```

---

## Resources

- **Translation Files**: `/locales/*.json`
- **i18n Service**: `/src/i18n/i18nService.js`
- **Locale Formatter**: `/src/i18n/localeFormatter.js`
- **IPC Handlers**: `/src/services/i18nHandlers.js`
- **Tests**: `/tests/unit/i18n*.test.js`
- **Contracts**: `/specs/002-fr-de-i18n/contracts/`

---

## Getting Help

1. **Check this guide first**
2. **Review example in existing translations** (`locales/en.json`)
3. **Run tests to verify coverage**: `npm run test:i18n`
4. **Check contracts for API usage**: `contracts/ipc-contract.md`
5. **Consult data model**: `data-model.md`

---

## Next Steps

- [x] Read this quick start guide
- [ ] Add your first translation key
- [ ] Run translation coverage test
- [ ] Test in all three languages
- [ ] Get native speaker review (for production)
- [ ] Commit changes with descriptive message

**Example commit message**:
```
i18n: Add translations for new upload hints

- Added upload.drop_zone_hint to all languages
- Updated FR/DE with native speaker review
- Verified visual layout in all languages
```
