/**
 * i18n IPC Handlers
 * Provides secure IPC handlers for translation loading and locale detection
 *
 * Security: Validates all inputs, uses read-only file access, no user-controlled paths
 */

import { ipcMain, app } from 'electron';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { detectLanguage, getLocaleInfo } from '../i18n/languageDetector.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Whitelist of allowed locales (security: prevent path traversal)
const ALLOWED_LOCALES = ['en', 'fr', 'de'];

/**
 * Register all i18n IPC handlers
 * Call this from main.js during app initialization
 */
export function registerI18nHandlers() {
  // Handler: Get translations for a specific locale
  ipcMain.handle('i18n:getTranslations', async (event, locale) => {
    try {
      // Validate locale (security: whitelist validation)
      if (!locale || !ALLOWED_LOCALES.includes(locale)) {
        throw new Error(`Invalid locale: ${locale}`);
      }

      // Construct path to translation file (security: no user-controlled paths)
      const localesDir = join(__dirname, '../../locales');
      const translationPath = join(localesDir, `${locale}.json`);

      // Read translation file
      const fileContents = await readFile(translationPath, 'utf-8');
      const translationData = JSON.parse(fileContents);

      // Validate structure (security: ensure expected format)
      if (!translationData.translations || typeof translationData.translations !== 'object') {
        throw new Error(`Invalid translation file structure for locale: ${locale}`);
      }

      return {
        success: true,
        locale,
        translations: translationData.translations,
        metadata: translationData.metadata || {}
      };
    } catch (error) {
      console.error(`Error loading translations for locale ${locale}:`, error);
      return {
        success: false,
        locale,
        error: error.message
      };
    }
  });

  // Handler: Get detected system locale
  ipcMain.handle('i18n:getDetectedLocale', async (event) => {
    try {
      const systemLocale = app.getLocale();
      const localeInfo = getLocaleInfo(systemLocale);

      return {
        success: true,
        ...localeInfo
      };
    } catch (error) {
      console.error('Error detecting locale:', error);
      return {
        success: false,
        error: error.message,
        language: 'en', // Safe fallback
        supported: true,
        systemLocale: 'en-US'
      };
    }
  });

  console.log('[i18n] IPC handlers registered');
}

/**
 * Unregister all i18n IPC handlers
 * Call during app cleanup if needed
 */
export function unregisterI18nHandlers() {
  ipcMain.removeHandler('i18n:getTranslations');
  ipcMain.removeHandler('i18n:getDetectedLocale');
  console.log('[i18n] IPC handlers unregistered');
}
