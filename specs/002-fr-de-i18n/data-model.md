# Phase 1: Data Model - i18n Entities

**Feature**: French and German Internationalization Support
**Date**: 2025-11-11
**Purpose**: Define data structures for translations, preferences, and locale configuration

## Core Entities

### 1. Translation File

**Description**: JSON file containing all translatable strings for a single locale.

**Schema**:
```typescript
interface TranslationFile {
  metadata: {
    locale: 'en' | 'fr' | 'de';
    version: string;              // Semantic version (e.g., "2.0.0")
    lastUpdated: string;          // ISO 8601 timestamp
    translator?: string;          // Optional: translator name/service
    reviewedBy?: string;          // Optional: reviewer name
  };
  translations: {
    [section: string]: {         // e.g., "app", "upload", "metadata"
      [key: string]: string;     // e.g., "title": "Upload your file"
    };
  };
}
```

**Example** (`locales/fr.json`):
```json
{
  "metadata": {
    "locale": "fr",
    "version": "2.0.0",
    "lastUpdated": "2025-11-11T00:00:00Z",
    "translator": "Professional Translation Service",
    "reviewedBy": "Native French Speaker"
  },
  "translations": {
    "app": {
      "title": "Anonymiseur PII",
      "subtitle": "Téléchargez des documents pour détecter et anonymiser automatiquement les informations personnelles"
    },
    "upload": {
      "title": "Déposez votre fichier ici",
      "browse": "Parcourir les fichiers",
      "dragText": "ou cliquez pour parcourir depuis votre ordinateur",
      "supportedFormats": "Formats supportés"
    }
  }
}
```

**Validation Rules**:
- `locale` must be one of: `en`, `fr`, `de`
- `version` must follow semver format
- `lastUpdated` must be valid ISO 8601 timestamp
- All translation keys in `en.json` must exist in `fr.json` and `de.json`
- Translation values must not be empty strings
- No HTML/script tags allowed in translation strings (security)

**File Location**: `/locales/*.json` (root of project)

---

### 2. Language Preference

**Description**: User's selected language stored in browser localStorage.

**Schema**:
```typescript
interface LanguagePreference {
  locale: 'en' | 'fr' | 'de';
  source: 'auto' | 'manual';    // How language was determined
  timestamp: number;             // Unix timestamp (ms) when set
}
```

**Storage Key**: `preferredLanguage`, `languageSource`, `languageTimestamp` (separate keys in localStorage)

**Example**:
```javascript
// Auto-detected from OS
{
  locale: 'fr',
  source: 'auto',
  timestamp: 1699680000000
}

// Manually selected by user
{
  locale: 'de',
  source: 'manual',
  timestamp: 1699680123456
}
```

**State Transitions**:
```
[App Launch]
  ↓
[Check localStorage]
  ↓
├─ Found 'manual' → Use stored preference
└─ Found 'auto' OR Not found → Detect OS language
     ↓
   [User opens language selector]
     ↓
   [User selects language]
     ↓
   Set source='manual', Save to localStorage
```

**Validation Rules**:
- `locale` must be one of: `en`, `fr`, `de`
- `source` must be either `auto` or `manual`
- `timestamp` must be positive integer
- Invalid values → fall back to OS detection

---

### 3. Locale Configuration

**Description**: Runtime configuration for locale-specific formatting.

**Schema**:
```typescript
interface LocaleConfiguration {
  locale: string;                  // BCP 47 locale tag (e.g., 'fr-FR', 'de-DE')
  language: 'en' | 'fr' | 'de';    // Two-letter language code
  dateFormat: {
    short: Intl.DateTimeFormatOptions;
    medium: Intl.DateTimeFormatOptions;
    long: Intl.DateTimeFormatOptions;
  };
  timeFormat: Intl.DateTimeFormatOptions;
  numberFormat: Intl.NumberFormatOptions;
}
```

**Example** (French):
```javascript
{
  locale: 'fr-FR',
  language: 'fr',
  dateFormat: {
    short: { year: 'numeric', month: '2-digit', day: '2-digit' },
    medium: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' }
  },
  timeFormat: { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false },
  numberFormat: { minimumFractionDigits: 2, maximumFractionDigits: 2 }
}
```

**Preset Configurations**:

**English (en-US)**:
- Date: MM/DD/YYYY
- Time: 12-hour format (AM/PM)
- Numbers: 1,234.56 (comma thousands, period decimal)

**French (fr-FR)**:
- Date: DD/MM/YYYY
- Time: 24-hour format
- Numbers: 1 234,56 (space thousands, comma decimal)

**German (de-DE)**:
- Date: DD.MM.YYYY
- Time: 24-hour format
- Numbers: 1.234,56 (period thousands, comma decimal)

**Usage**:
```javascript
const config = getLocaleConfiguration('fr');
const formatter = new Intl.DateTimeFormat(config.locale, config.dateFormat.short);
console.log(formatter.format(new Date())); // "11/11/2025"
```

---

## Helper Entities

### 4. Translation Key

**Description**: Dot-notation string identifying a translation.

**Format**: `<section>.<key>`

**Examples**:
- `app.title` → Application title
- `upload.browse` → Browse button text
- `metadata.filename` → Filename label
- `errors.fileLoadFailed` → Error message

**Validation Rules**:
- Must match pattern: `^[a-z_]+(\\.[a-z_]+)+$`
- Section and key must be lowercase with underscores
- Minimum 2 parts (section.key)
- Maximum 3 parts (section.subsection.key)

---

### 5. Translated String

**Description**: A single localized text value.

**Schema**:
```typescript
interface TranslatedString {
  key: string;              // Translation key (e.g., "upload.title")
  en: string;               // English text
  fr: string;               // French text
  de: string;               // German text
}
```

**Example**:
```javascript
{
  key: "processing.ready",
  en: "Ready to process your file",
  fr: "Prêt à traiter votre fichier",
  de: "Bereit, Ihre Datei zu verarbeiten"
}
```

**Usage in Code**:
```javascript
// Access via i18n service
const text = i18n.t('processing.ready', currentLocale);
// Returns: "Prêt à traiter votre fichier" (if locale is 'fr')
```

---

## Relationships

```
┌─────────────────────────────┐
│   Translation Files         │
│   (locales/*.json)          │
│   ┌──────┬──────┬──────┐   │
│   │ en   │  fr  │  de  │   │
│   └──────┴──────┴──────┘   │
└──────────────┬──────────────┘
               │ Loaded by
               ↓
┌─────────────────────────────┐
│  i18n Service               │
│  (src/i18n/i18nService.js)  │
│  - Load translations        │
│  - Resolve keys             │
│  - Format with locale       │
└──────────────┬──────────────┘
               │ Uses
               ↓
┌─────────────────────────────┐
│  Language Preference        │
│  (localStorage)             │
│  - locale: 'fr'             │
│  - source: 'manual'         │
└──────────────┬──────────────┘
               │ Informs
               ↓
┌─────────────────────────────┐
│  Locale Configuration       │
│  (runtime)                  │
│  - Date/time formats        │
│  - Number formats           │
└─────────────────────────────┘
```

---

## Data Flows

### Application Startup

```
1. [App Launch]
   ↓
2. Load language preference from localStorage
   ├─ Found 'manual' preference → Use stored locale
   └─ Not found OR 'auto' → Detect OS locale via app.getLocale()
   ↓
3. Request translations from main process
   ↓
4. Main process loads JSON file for locale
   ↓
5. Return translations to renderer
   ↓
6. Initialize i18n service with translations
   ↓
7. Render UI with translated strings
```

### Language Switch (User Action)

```
1. [User clicks language selector]
   ↓
2. [User selects 'Français']
   ↓
3. Update localStorage:
   - preferredLanguage = 'fr'
   - languageSource = 'manual'
   - languageTimestamp = Date.now()
   ↓
4. Request translations for 'fr' from main process
   ↓
5. Receive French translations
   ↓
6. Update i18n service with new translations
   ↓
7. Trigger re-render of all UI text
   ↓
8. Apply locale-specific formatting (dates, numbers)
```

### Translation Lookup

```
1. Component needs text: i18n.t('upload.title')
   ↓
2. i18n service splits key: section='upload', key='title'
   ↓
3. Lookup in translations object: translations.upload.title
   ↓
4. Found? → Return translated string
   ↓
5. Not found? → Fall back to English
   ↓
6. Still not found? → Return key itself (debugging aid)
```

---

## Constraints & Business Rules

1. **Translation Coverage**: Every key in `en.json` MUST exist in `fr.json` and `de.json`
2. **No Empty Translations**: Translation values cannot be empty strings
3. **Fallback Chain**: Missing translation → English → Key itself
4. **Locale Whitelist**: Only `en`, `fr`, `de` are supported (others → English)
5. **Persistence**: Manual language selection persists across app restarts
6. **Auto-Detection**: If no manual preference, always detect from OS on startup
7. **Immutability**: Translation files are read-only at runtime (not user-editable)
8. **Security**: Translation strings must not contain HTML, scripts, or control characters

---

## File Manifest

**New Files**:
- `/locales/en.json` - English translations (source of truth)
- `/locales/fr.json` - French translations
- `/locales/de.json` - German translations

**Translation Keys** (Estimated ~150-200 strings):
- `app.*` (5 keys) - Application-level text
- `upload.*` (10 keys) - Upload interface
- `metadata.*` (8 keys) - File metadata panel
- `processing.*` (15 keys) - Processing interface
- `download.*` (5 keys) - Download buttons
- `tabs.*` (5 keys) - Tab labels
- `fileTypes.*` (5 keys) - Document type badges
- `entityTypes.*` (10 keys) - PII entity labels
- `errors.*` (20 keys) - Error messages
- `footer.*` (5 keys) - Footer text
- `buttons.*` (10 keys) - Common button labels
- `messages.*` (15 keys) - Status and success messages

**Total Estimated Size**:
- `en.json`: ~50KB
- `fr.json`: ~55KB (French text typically 10% longer)
- `de.json`: ~60KB (German text typically 20% longer, compound words)
- **Total**: ~165KB for all three languages

---

## Validation & Testing

**Data Integrity Tests**:
1. Translation coverage: All keys in `en.json` exist in `fr.json` and `de.json`
2. No empty values: All translation values are non-empty strings
3. Key format: All keys match pattern `^[a-z_]+(\\.[a-z_]+)+$`
4. Schema validation: Files match TranslationFile interface
5. Character encoding: Files are UTF-8 encoded

**Runtime Tests**:
1. Translation lookup returns correct string for given locale
2. Missing translation falls back to English
3. Locale formatting applies correct patterns for dates/numbers
4. Language preference persists across app restarts
5. Language switching updates all UI text immediately

---

## Next Steps

- [ ] Create translation JSON schema in `contracts/`
- [ ] Define IPC contract for translation loading
- [ ] Create initial English translation file with all keys
- [ ] Write quickstart guide for adding new translations
- [ ] Implement translation coverage validation script
