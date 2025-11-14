# IPC Contract: i18n Communication

**Feature**: French and German Internationalization Support
**Purpose**: Define secure communication between main and renderer processes for i18n

## Overview

All i18n-related IPC communication follows Electron's context isolation security model:
- Main process loads translation files from disk
- Renderer requests translations via IPC handlers
- Language preference stored in renderer's localStorage (no IPC needed)
- Preload script exposes safe APIs via `contextBridge`

## IPC Handlers (Main Process)

### 1. `i18n:getTranslations`

**Description**: Load and return translation strings for specified locale

**Direction**: Renderer → Main

**Request**:
```javascript
{
  locale: 'en' | 'fr' | 'de'
}
```

**Response**:
```javascript
{
  success: true,
  locale: 'fr',
  translations: {
    app: { ... },
    upload: { ... },
    metadata: { ... },
    // ... all translation sections
  }
}
```

**Error Response**:
```javascript
{
  success: false,
  error: 'Translation file not found',
  locale: 'en',  // Falls back to English
  translations: { ... }  // English translations as fallback
}
```

**Implementation** (`main.js`):
```javascript
ipcMain.handle('i18n:getTranslations', async (event, locale) => {
  try {
    // Validate locale
    if (!['en', 'fr', 'de'].includes(locale)) {
      locale = 'en';
    }

    // Load translation file
    const filePath = path.join(__dirname, 'locales', `${locale}.json`);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const translationData = JSON.parse(fileContent);

    return {
      success: true,
      locale,
      translations: translationData.translations
    };
  } catch (error) {
    console.error(`Failed to load translations for ${locale}:`, error);

    // Fallback to English
    const enPath = path.join(__dirname, 'locales', 'en.json');
    const enContent = fs.readFileSync(enPath, 'utf-8');
    const enData = JSON.parse(enContent);

    return {
      success: false,
      error: error.message,
      locale: 'en',
      translations: enData.translations
    };
  }
});
```

---

### 2. `i18n:getDetectedLocale`

**Description**: Detect OS language and return appropriate locale

**Direction**: Renderer → Main

**Request**: None (no parameters)

**Response**:
```javascript
{
  systemLocale: 'fr-FR',     // Full locale from app.getLocale()
  language: 'fr',            // Extracted language code
  supported: true            // Whether language is supported
}
```

**Unsupported Language Response**:
```javascript
{
  systemLocale: 'es-ES',
  language: 'es',
  supported: false,
  fallback: 'en'             // Default language
}
```

**Implementation** (`main.js`):
```javascript
ipcMain.handle('i18n:getDetectedLocale', async () => {
  const systemLocale = app.getLocale(); // e.g., 'fr-FR', 'de-CH'
  const language = systemLocale.substring(0, 2).toLowerCase();

  const supported = ['en', 'fr', 'de'];
  const isSupported = supported.includes(language);

  return {
    systemLocale,
    language: isSupported ? language : 'en',
    supported: isSupported,
    ...(is Supported ? {} : { fallback: 'en' })
  };
});
```

---

## Preload API (contextBridge)

**File**: `preload.cjs`

**Exposed API**:
```javascript
contextBridge.exposeInMainWorld('i18nAPI', {
  /**
   * Load translations for specified locale
   * @param {string} locale - Language code ('en'|'fr'|'de')
   * @returns {Promise<Object>} Translation data
   */
  getTranslations: (locale) => {
    if (typeof locale !== 'string' || !['en', 'fr', 'de'].includes(locale)) {
      return Promise.reject(new Error('Invalid locale'));
    }
    return ipcRenderer.invoke('i18n:getTranslations', locale);
  },

  /**
   * Get detected system locale
   * @returns {Promise<Object>} Locale detection result
   */
  getDetectedLocale: () => {
    return ipcRenderer.invoke('i18n:getDetectedLocale');
  }
});
```

---

## Renderer Usage

**File**: `renderer.js`

### Initialize i18n on App Load

```javascript
// Get stored preference or detect OS language
async function initializeI18n() {
  // Check localStorage for manual preference
  const storedLocale = localStorage.getItem('preferredLanguage');
  const storedSource = localStorage.getItem('languageSource');

  let locale;
  if (storedLocale && storedSource === 'manual') {
    // Use manual preference
    locale = storedLocale;
  } else {
    // Detect from OS
    const detected = await window.i18nAPI.getDetectedLocale();
    locale = detected.language;
  }

  // Load translations
  const result = await window.i18nAPI.getTranslations(locale);

  if (result.success) {
    // Initialize i18n service with translations
    i18n.init(result.locale, result.translations);

    // Render UI
    updateUIText();
  } else {
    console.warn('Failed to load translations, using English fallback');
    i18n.init('en', result.translations);
    updateUIText();
  }
}
```

### Change Language (User Action)

```javascript
async function changeLanguage(newLocale) {
  // Validate
  if (!['en', 'fr', 'de'].includes(newLocale)) {
    console.error('Invalid locale:', newLocale);
    return;
  }

  // Load new translations
  const result = await window.i18nAPI.getTranslations(newLocale);

  if (result.success) {
    // Update i18n service
    i18n.setLocale(result.locale, result.translations);

    // Save preference
    localStorage.setItem('preferredLanguage', result.locale);
    localStorage.setItem('languageSource', 'manual');
    localStorage.setItem('languageTimestamp', Date.now().toString());

    // Update all UI text
    updateUIText();
  } else {
    console.error('Failed to change language:', result.error);
  }
}
```

---

## Security Considerations

1. **Input Validation**: All locale parameters validated against whitelist (`en`, `fr`, `de`)
2. **Path Traversal Prevention**: Locale string validated before constructing file path
3. **No User-Provided Translations**: Only bundled JSON files loaded (no user file uploads)
4. **Context Isolation**: Renderer cannot directly access `fs` or `path` modules
5. **Error Handling**: Failed translation loads fall back to English (no app crash)
6. **No PII in Transit**: Translation strings contain only static UI text (no user data)

---

## Error Handling

### Translation File Not Found

```javascript
// Main process catches error and returns English fallback
{
  success: false,
  error: 'ENOENT: no such file or directory, open locales/fr.json',
  locale: 'en',
  translations: { ... }  // English translations
}
```

### Invalid JSON in Translation File

```javascript
// Main process catches parse error
{
  success: false,
  error: 'Unexpected token in JSON at position 123',
  locale: 'en',
  translations: { ... }  // English fallback
}
```

### Network/IPC Timeout

```javascript
// Renderer handles promise rejection
try {
  const result = await window.i18nAPI.getTranslations('fr');
} catch (error) {
  console.error('IPC timeout:', error);
  // Use cached translations or show error to user
}
```

---

## Testing

### Unit Tests

**File**: `tests/unit/ipcHandlers.test.js`

```javascript
describe('i18n IPC Handlers', () => {
  it('should return French translations for fr locale', async () => {
    const result = await ipcMain.handle('i18n:getTranslations', {}, 'fr');
    expect(result.success).to.be.true;
    expect(result.locale).to.equal('fr');
    expect(result.translations.app).to.exist;
  });

  it('should fallback to English for invalid locale', async () => {
    const result = await ipcMain.handle('i18n:getTranslations', {}, 'invalid');
    expect(result.locale).to.equal('en');
  });

  it('should detect system locale correctly', async () => {
    const result = await ipcMain.handle('i18n:getDetectedLocale', {});
    expect(result).to.have.property('systemLocale');
    expect(result).to.have.property('language');
    expect(result).to.have.property('supported');
  });
});
```

### Integration Tests

**File**: `tests/integration/i18n.test.js`

```javascript
describe('i18n Integration', () => {
  it('should load French translations via IPC', async () => {
    const translations = await window.i18nAPI.getTranslations('fr');
    expect(translations.success).to.be.true;
    expect(translations.translations.app.title).to.include('Anonymiseur');
  });

  it('should persist language preference', async () => {
    await changeLanguage('de');
    const stored = localStorage.getItem('preferredLanguage');
    expect(stored).to.equal('de');
  });
});
```

---

## Performance Metrics

- **Translation File Load Time**: < 50ms (target)
- **IPC Round Trip**: < 20ms (typical)
- **Language Switch Total Time**: < 100ms (target, includes load + render)
- **Translation File Size**: ~50-60KB per language
- **Memory Usage**: ~200KB for all three languages cached

---

## Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-11 | Initial IPC contract definition |

---

## References

- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/api/ipc-main)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [Electron Security Best Practices](https://www.electronjs.org/docs/latest/tutorial/security)
