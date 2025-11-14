/**
 * Renderer i18n Integration
 * Initializes and manages i18n in the renderer process
 */

import { init, t, setLocale, getLocale } from './i18nService.js';
import { formatDate, formatTime, formatFileSize, formatNumber, formatDateTime } from './localeFormatter.js';

let currentLocale = 'en';

/**
 * Initialize i18n in renderer
 * Detects system language, loads translations, and initializes service
 * @returns {Promise<string>} - Initialized locale
 */
export async function initializeI18n() {
  try {
    // Check for stored language preference
    const storedLanguage = localStorage.getItem('preferredLanguage');
    const languageSource = localStorage.getItem('languageSource');

    let targetLocale;

    if (storedLanguage && languageSource === 'manual') {
      // User explicitly set a language
      targetLocale = storedLanguage;
      console.log(`[i18n] Using user-selected language: ${targetLocale}`);
    } else {
      // Detect system language
      const localeInfo = await window.i18nAPI.getDetectedLocale();

      if (!localeInfo.success) {
        console.warn('[i18n] Locale detection failed, defaulting to English');
        targetLocale = 'en';
      } else {
        targetLocale = localeInfo.language;
        console.log(`[i18n] Detected system language: ${targetLocale} (from ${localeInfo.systemLocale})`);

        if (!localeInfo.supported) {
          console.log(`[i18n] System language not supported, falling back to English`);
        }
      }
    }

    // Load translations
    await loadLocale(targetLocale);

    console.log(`[i18n] Initialized with locale: ${currentLocale}`);
    return currentLocale;
  } catch (error) {
    console.error('[i18n] Initialization error:', error);
    // Fallback to English with empty translations
    currentLocale = 'en';
    init('en', {});
    return 'en';
  }
}

/**
 * Load translations for a specific locale
 * @param {string} locale - Two-letter language code
 * @returns {Promise<void>}
 */
async function loadLocale(locale) {
  try {
    // Load target locale
    const localeData = await window.i18nAPI.getTranslations(locale);

    if (!localeData.success) {
      throw new Error(localeData.error || 'Failed to load translations');
    }

    // Load English as fallback (if not already English)
    let fallbackTranslations = {};
    if (locale !== 'en') {
      const fallbackData = await window.i18nAPI.getTranslations('en');
      if (fallbackData.success) {
        fallbackTranslations = fallbackData.translations;
      }
    }

    // Initialize i18n service
    init(locale, localeData.translations, fallbackTranslations);
    currentLocale = locale;
  } catch (error) {
    console.error(`[i18n] Failed to load locale ${locale}:`, error);
    throw error;
  }
}

/**
 * Change application language
 * @param {string} locale - Two-letter language code ('en', 'fr', 'de')
 * @returns {Promise<void>}
 */
export async function changeLanguage(locale) {
  if (locale === currentLocale) {
    console.log(`[i18n] Already using locale: ${locale}`);
    return;
  }

  try {
    await loadLocale(locale);

    // Save preference
    localStorage.setItem('preferredLanguage', locale);
    localStorage.setItem('languageSource', 'manual');
    localStorage.setItem('languageTimestamp', Date.now().toString());

    console.log(`[i18n] Changed language to: ${locale}`);

    // Trigger re-render (emit custom event)
    window.dispatchEvent(new CustomEvent('language-changed', { detail: { locale } }));
  } catch (error) {
    console.error(`[i18n] Failed to change language to ${locale}:`, error);
    throw error;
  }
}

/**
 * Get current locale
 * @returns {string}
 */
export function getCurrentLocale() {
  return currentLocale;
}

/**
 * Translate a key
 * @param {string} key - Translation key
 * @returns {string} - Translated text
 */
export function translate(key) {
  return t(key);
}

/**
 * Update all UI text elements with translations
 * Call this after initializing i18n or changing language
 */
export function updateUITranslations() {
  const locale = getLocale();

  // App header
  const appTitle = document.querySelector('.app-title');
  if (appTitle) {
    // Preserve the logo img element
    const logo = appTitle.querySelector('img');
    appTitle.textContent = t('app.title');
    if (logo) {
      appTitle.insertBefore(logo, appTitle.firstChild);
    }
  }

  const appSubtitle = document.querySelector('.app-subtitle');
  if (appSubtitle) {
    appSubtitle.textContent = t('app.subtitle');
  }

  // Upload zone
  const uploadHeading = document.querySelector('.upload-heading');
  if (uploadHeading) {
    uploadHeading.textContent = t('upload.heading');
  }

  const uploadText = document.querySelector('.upload-text');
  if (uploadText) {
    uploadText.textContent = t('upload.text');
  }

  const browseButton = document.querySelector('.browse-button span');
  if (browseButton) {
    browseButton.textContent = t('upload.browseButton');
  }

  const supportedFormats = document.querySelector('.supported-formats p');
  if (supportedFormats) {
    supportedFormats.textContent = t('upload.supportedFormats');
  }

  // File type badges
  updateFormatBadges();

  // File details panel
  const fileDetailsTitle = document.querySelector('.card-header .card-title');
  if (fileDetailsTitle && fileDetailsTitle.textContent === 'File Details') {
    fileDetailsTitle.textContent = t('fileDetails.title');
  }

  updateFileDetailsLabels();

  // Preview panel
  const previewTitle = document.querySelectorAll('.card-title')[1];
  if (previewTitle) {
    previewTitle.textContent = t('preview.title');
  }

  const previewContent = document.getElementById('preview-content');
  if (previewContent && previewContent.textContent === 'Select a file to preview...') {
    previewContent.textContent = t('preview.selectFile');
  }

  // Processing panel
  const processingTitle = document.querySelector('#processing-view .card-title');
  if (processingTitle) {
    processingTitle.textContent = t('processing.title');
  }

  const piiCountText = document.getElementById('pii-count-text');
  if (piiCountText && piiCountText.textContent.includes('Click')) {
    piiCountText.textContent = t('processing.ready');
  }

  // Buttons
  const downloadMarkdown = document.getElementById('download-markdown');
  if (downloadMarkdown) {
    const icon = downloadMarkdown.querySelector('i');
    downloadMarkdown.textContent = t('download.markdown');
    if (icon) {
      downloadMarkdown.insertBefore(icon, downloadMarkdown.firstChild);
    }
  }

  const downloadMapping = document.getElementById('download-mapping');
  if (downloadMapping) {
    const icon = downloadMapping.querySelector('i');
    downloadMapping.textContent = t('download.mapping');
    if (icon) {
      downloadMapping.insertBefore(icon, downloadMapping.firstChild);
    }
  }

  const processButton = document.getElementById('process-button');
  if (processButton) {
    const icon = processButton.querySelector('i');
    processButton.textContent = t('processing.processButton');
    if (icon) {
      processButton.insertBefore(icon, processButton.firstChild);
    }
  }

  // Tabs
  const tabs = document.querySelectorAll('.tab');
  if (tabs[0]) tabs[0].textContent = t('tabs.markdown');
  if (tabs[1]) tabs[1].textContent = t('tabs.mapping');

  // Footer
  updateFooter();

  console.log(`[i18n] UI updated to locale: ${locale}`);
}

/**
 * Update format badges with translations
 */
function updateFormatBadges() {
  const badges = document.querySelectorAll('.format-badge-text');
  const types = ['pdf', 'word', 'excel', 'csv'];

  badges.forEach((badge, index) => {
    if (types[index]) {
      badge.textContent = t(`fileTypes.${types[index]}`);
    }
  });
}

/**
 * Update file details labels with translations
 */
function updateFileDetailsLabels() {
  const labels = document.querySelectorAll('.metadata-label');
  const keys = ['fileName', 'type', 'size', 'lastModified'];

  labels.forEach((label, index) => {
    if (keys[index]) {
      label.textContent = t(`fileDetails.${keys[index]}`);
    }
  });
}

/**
 * Update footer with translations
 */
function updateFooter() {
  // This is a simple version - may need to be more sophisticated
  // based on the actual footer HTML structure
  const footer = document.querySelector('div[style*="border-top"]');
  if (footer) {
    const outputStrong = footer.querySelector('strong');
    if (outputStrong && outputStrong.textContent === 'Output:') {
      outputStrong.textContent = t('footer.output');
    }
  }
}

// Export formatting utilities
export {
  formatDate,
  formatTime,
  formatFileSize,
  formatNumber,
  formatDateTime
};
