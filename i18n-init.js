/**
 * i18n Initialization for Renderer (Non-Module Version)
 * This file initializes i18n without using ES modules
 * It creates a global i18n object accessible to all scripts
 */

(async function() {
  'use strict';

  // Create global i18n namespace
  window.i18n = {
    currentLocale: 'en',
    translations: {},
    fallbackTranslations: {},

    /**
     * Initialize i18n system
     */
    async init() {
      try {
        // Check for stored language preference
        const storedLanguage = localStorage.getItem('preferredLanguage');
        const languageSource = localStorage.getItem('languageSource');

        let targetLocale;

        if (storedLanguage && languageSource === 'manual') {
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
          }
        }

        // Load translations
        await this.loadLocale(targetLocale);

        // Update UI
        this.updateUI();

        console.log(`[i18n] Initialized with locale: ${this.currentLocale}`);
        return this.currentLocale;
      } catch (error) {
        console.error('[i18n] Initialization error:', error);
        this.currentLocale = 'en';
        this.translations = {};
        return 'en';
      }
    },

    /**
     * Load translations for a locale
     */
    async loadLocale(locale) {
      try {
        const localeData = await window.i18nAPI.getTranslations(locale);

        if (!localeData.success) {
          throw new Error(localeData.error || 'Failed to load translations');
        }

        this.translations = localeData.translations;
        this.currentLocale = locale;

        // Load English fallback if not English
        if (locale !== 'en') {
          const fallbackData = await window.i18nAPI.getTranslations('en');
          if (fallbackData.success) {
            this.fallbackTranslations = fallbackData.translations;
          }
        } else {
          this.fallbackTranslations = {};
        }
      } catch (error) {
        console.error(`[i18n] Failed to load locale ${locale}:`, error);
        throw error;
      }
    },

    /**
     * Translate a key
     */
    t(key) {
      if (!key || typeof key !== 'string') return '';

      const parts = key.split('.');
      let value = this.translations;

      // Traverse the translation object
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          value = null;
          break;
        }
      }

      // If found and is string, return it
      if (typeof value === 'string') {
        return value;
      }

      // Try fallback
      if (this.currentLocale !== 'en' && Object.keys(this.fallbackTranslations).length > 0) {
        let fallbackValue = this.fallbackTranslations;
        for (const part of parts) {
          if (fallbackValue && typeof fallbackValue === 'object' && part in fallbackValue) {
            fallbackValue = fallbackValue[part];
          } else {
            fallbackValue = null;
            break;
          }
        }

        if (typeof fallbackValue === 'string') {
          return fallbackValue;
        }
      }

      // Return key as fallback
      return key;
    },

    /**
     * Change language
     */
    async changeLanguage(locale) {
      if (locale === this.currentLocale) {
        console.log(`[i18n] Already using locale: ${locale}`);
        return;
      }

      try {
        await this.loadLocale(locale);

        // Save preference
        localStorage.setItem('preferredLanguage', locale);
        localStorage.setItem('languageSource', 'manual');
        localStorage.setItem('languageTimestamp', Date.now().toString());

        // Update UI
        this.updateUI();

        console.log(`[i18n] Changed language to: ${locale}`);

        // Trigger event
        window.dispatchEvent(new CustomEvent('language-changed', { detail: { locale } }));
      } catch (error) {
        console.error(`[i18n] Failed to change language to ${locale}:`, error);
        throw error;
      }
    },

    /**
     * Format file size with locale-specific formatting
     */
    formatFileSize(bytes) {
      if (typeof bytes !== 'number' || bytes < 0) return '0 B';

      const locale = this.currentLocale;
      const localeMap = { 'en': 'en-US', 'fr': 'fr-FR', 'de': 'de-DE' };
      const bcp47Locale = localeMap[locale] || 'en-US';

      const kb = bytes / 1024;
      const mb = kb / 1024;
      const gb = mb / 1024;

      const formatter = new Intl.NumberFormat(bcp47Locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });

      if (gb >= 1) return `${formatter.format(gb)} GB`;
      if (mb >= 1) return `${formatter.format(mb)} MB`;
      if (kb >= 1) return `${formatter.format(kb)} KB`;
      return `${bytes} B`;
    },

    /**
     * Format date according to locale
     */
    formatDate(date) {
      if (!(date instanceof Date) || isNaN(date)) return '';

      const locale = this.currentLocale;
      const localeMap = { 'en': 'en-US', 'fr': 'fr-FR', 'de': 'de-DE' };
      const bcp47Locale = localeMap[locale] || 'en-US';

      try {
        return new Intl.DateTimeFormat(bcp47Locale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(date);
      } catch (error) {
        return date.toLocaleDateString();
      }
    },

    /**
     * Format time according to locale
     */
    formatTime(date) {
      if (!(date instanceof Date) || isNaN(date)) return '';

      const locale = this.currentLocale;
      const localeMap = { 'en': 'en-US', 'fr': 'fr-FR', 'de': 'de-DE' };
      const bcp47Locale = localeMap[locale] || 'en-US';

      try {
        return new Intl.DateTimeFormat(bcp47Locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: locale === 'en'
        }).format(date);
      } catch (error) {
        return date.toLocaleTimeString();
      }
    },

    /**
     * Update all UI text with translations
     */
    updateUI() {
      // App header
      const appTitle = document.querySelector('.app-title');
      if (appTitle) {
        const logo = appTitle.querySelector('img');
        const titleText = this.t('app.title');
        appTitle.textContent = '';
        if (logo) appTitle.appendChild(logo);
        appTitle.appendChild(document.createTextNode(' ' + titleText));
      }

      const appSubtitle = document.querySelector('.app-subtitle');
      if (appSubtitle) {
        appSubtitle.textContent = this.t('app.subtitle');
      }

      // Upload zone
      this.updateElement('.upload-heading', 'upload.heading');
      this.updateElement('.upload-text', 'upload.text');

      const browseButton = document.querySelector('.browse-button span');
      if (browseButton) {
        browseButton.textContent = this.t('upload.browseButton');
      }

      const supportedFormats = document.querySelector('.supported-formats p');
      if (supportedFormats) {
        supportedFormats.textContent = this.t('upload.supportedFormats');
      }

      // Format badges
      const badges = document.querySelectorAll('.format-badge-text');
      const types = ['pdf', 'word', 'excel', 'csv'];
      badges.forEach((badge, index) => {
        if (types[index]) {
          badge.textContent = this.t(`fileTypes.${types[index]}`);
        }
      });

      // File details
      const cardTitles = document.querySelectorAll('.card-title');
      if (cardTitles[0]) cardTitles[0].textContent = this.t('fileDetails.title');
      if (cardTitles[1]) cardTitles[1].textContent = this.t('preview.title');
      if (cardTitles[2]) cardTitles[2].textContent = this.t('processing.title');

      // Metadata labels
      const labels = document.querySelectorAll('.metadata-label');
      const keys = ['fileName', 'type', 'size', 'lastModified'];
      labels.forEach((label, index) => {
        if (keys[index]) {
          label.textContent = this.t(`fileDetails.${keys[index]}`);
        }
      });

      // Preview
      const previewContent = document.getElementById('preview-content');
      if (previewContent && previewContent.textContent.trim() === 'Select a file to preview...') {
        previewContent.textContent = this.t('preview.selectFile');
      }

      // Processing
      const piiCountText = document.getElementById('pii-count-text');
      if (piiCountText && (piiCountText.textContent.includes('Click') || piiCountText.textContent.includes('Cliquez') || piiCountText.textContent.includes('Klicken'))) {
        piiCountText.textContent = this.t('processing.ready');
      }

      const initialStateText = document.querySelector('#initial-state p');
      if (initialStateText && (initialStateText.textContent.includes('Ready') || initialStateText.textContent.includes('Prêt') || initialStateText.textContent.includes('Bereit'))) {
        initialStateText.textContent = this.t('processing.readyToProcess');
      }

      const processingSpinnerText = document.querySelector('#processing-spinner .loader-text');
      if (processingSpinnerText) {
        processingSpinnerText.textContent = this.t('processing.processing');
      }

      const successAlert = document.querySelector('#processing-result .alert p');
      if (successAlert && (successAlert.textContent.includes('successfully') || successAlert.textContent.includes('succès') || successAlert.textContent.includes('erfolgreich'))) {
        successAlert.textContent = this.t('processing.success');
      }

      // Buttons
      this.updateButtonWithIcon('#process-button', 'processing.processButton');
      this.updateButtonWithIcon('#download-markdown', 'download.markdown');
      this.updateButtonWithIcon('#download-mapping', 'download.mapping');

      // Tabs
      const tabs = document.querySelectorAll('.tab');
      if (tabs[0]) tabs[0].textContent = this.t('tabs.markdown');
      if (tabs[1]) tabs[1].textContent = this.t('tabs.mapping');

      // Footer
      this.updateElement('#footer-output-label', 'footer.output');
      this.updateElement('#footer-output-text', 'footer.outputDescription');
      this.updateElement('#footer-license-label', 'footer.license');
      this.updateElement('#footer-license-text', 'footer.licenseText');
      this.updateElement('#footer-support-label', 'footer.support');

      console.log(`[i18n] UI updated for locale: ${this.currentLocale}`);
    },

    /**
     * Helper: Update element text content
     */
    updateElement(selector, key) {
      const element = document.querySelector(selector);
      if (element) {
        element.textContent = this.t(key);
      }
    },

    /**
     * Helper: Update button text while preserving icon
     */
    updateButtonWithIcon(selector, key) {
      const button = document.querySelector(selector);
      if (button) {
        const icon = button.querySelector('i');
        const text = this.t(key);
        button.textContent = '';
        if (icon) button.appendChild(icon);
        button.appendChild(document.createTextNode(' ' + text));
      }
    }
  };

  // Setup language selector dropdown
  function setupLanguageSelector() {
    const dropdownTrigger = document.getElementById('language-dropdown-trigger');
    const dropdownContent = document.getElementById('language-dropdown-content');
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    const currentFlag = document.getElementById('current-language-flag');
    const currentName = document.getElementById('current-language-name');

    // Toggle dropdown on click
    dropdownTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdownContent.style.display === 'block';

      if (isOpen) {
        dropdownContent.style.display = 'none';
        dropdownTrigger.classList.remove('active');
      } else {
        dropdownContent.style.display = 'block';
        dropdownTrigger.classList.add('active');
      }
    });

    // Handle language selection
    dropdownItems.forEach(item => {
      item.addEventListener('click', async (e) => {
        e.stopPropagation();
        const lang = item.getAttribute('data-lang');
        const flag = item.getAttribute('data-flag');
        const name = item.getAttribute('data-name');

        if (lang) {
          try {
            await window.i18n.changeLanguage(lang);

            // Update trigger button
            currentFlag.textContent = flag;
            currentName.textContent = name;

            // Update active states
            updateLanguageButtonStates();

            // Close dropdown
            dropdownContent.style.display = 'none';
            dropdownTrigger.classList.remove('active');
          } catch (error) {
            console.error('[i18n] Failed to change language:', error);
          }
        }
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!document.getElementById('language-selector').contains(e.target)) {
        dropdownContent.style.display = 'none';
        dropdownTrigger.classList.remove('active');
      }
    });

    // Set initial state
    updateLanguageButtonStates();
    updateDropdownTrigger();
  }

  function updateDropdownTrigger() {
    const currentLang = window.i18n.currentLocale;
    const currentFlag = document.getElementById('current-language-flag');
    const currentName = document.getElementById('current-language-name');

    const languageMap = {
      'en': { flag: '🇬🇧', name: 'English' },
      'fr': { flag: '🇫🇷', name: 'Français' },
      'de': { flag: '🇩🇪', name: 'Deutsch' }
    };

    const langInfo = languageMap[currentLang] || languageMap['en'];
    if (currentFlag) currentFlag.textContent = langInfo.flag;
    if (currentName) currentName.textContent = langInfo.name;
  }

  function updateLanguageButtonStates() {
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    const currentLang = window.i18n.currentLocale;

    dropdownItems.forEach(item => {
      const lang = item.getAttribute('data-lang');
      if (lang === currentLang) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    updateDropdownTrigger();
  }

  // Expose helper functions
  window.i18n.updateLanguageButtonStates = updateLanguageButtonStates;

  // Initialize i18n when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await window.i18n.init();
      setupLanguageSelector();
    });
  } else {
    await window.i18n.init();
    setupLanguageSelector();
  }

})();
