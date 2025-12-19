/**
 * i18n IPC Handlers
 * Provides secure IPC handlers for translation loading and locale detection
 *
 * Security: Validates all inputs, uses read-only file access, no user-controlled paths
 *
 * Story 6.3: Added sender verification
 */

import { ipcMain, app, IpcMainInvokeEvent } from 'electron';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { detectLanguage as _detectLanguage, getLocaleInfo } from '../i18n/languageDetector.js';
import { createLogger } from '../utils/LoggerFactory.js';
import { verifySender } from '../utils/ipcValidator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const log = createLogger('i18n');

// Whitelist of allowed locales (security: prevent path traversal)
const ALLOWED_LOCALES = ['en', 'fr', 'de'] as const;
type AllowedLocale = typeof ALLOWED_LOCALES[number];

interface TranslationData {
  translations: Record<string, string>;
  metadata?: Record<string, unknown>;
}

interface TranslationResponse {
  success: boolean;
  locale: string;
  translations?: Record<string, string>;
  metadata?: Record<string, unknown>;
  error?: string;
}

interface LocaleResponse {
  success: boolean;
  language?: string;
  supported?: boolean;
  systemLocale?: string;
  error?: string;
  /** Additional locale info properties from getLocaleInfo() */
  [key: string]: unknown;
}

/**
 * Register all i18n IPC handlers
 * Call this from main.js during app initialization
 */
export function registerI18nHandlers(): void {
  // Handler: Get translations for a specific locale
  ipcMain.handle('i18n:getTranslations', async (event: IpcMainInvokeEvent, locale: unknown): Promise<TranslationResponse> => {
    // ✅ SECURITY: Verify sender (Story 6.3)
    if (!verifySender(event)) {
      log.warn('i18n:getTranslations: Unauthorized sender rejected');
      return { success: false, locale: 'unknown', error: 'Unauthorized request' };
    }

    try {
      // Validate locale (security: whitelist validation)
      if (!locale || typeof locale !== 'string' || !ALLOWED_LOCALES.includes(locale as AllowedLocale)) {
        throw new Error(`Invalid locale: ${locale}`);
      }

      // Construct path to translation file (security: no user-controlled paths)
      const localesDir = join(__dirname, '../../locales');
      const translationPath = join(localesDir, `${locale}.json`);

      // Read translation file
      const fileContents = await readFile(translationPath, 'utf-8');
      const translationData: TranslationData = JSON.parse(fileContents);

      // Validate structure (security: ensure expected format)
      if (!translationData.translations || typeof translationData.translations !== 'object') {
        throw new Error(`Invalid translation file structure for locale: ${locale}`);
      }

      return {
        success: true,
        locale,
        translations: translationData.translations,
        metadata: translationData.metadata || {},
      };
    } catch (error) {
      const localeStr = typeof locale === 'string' ? locale : 'unknown';
      log.error('Error loading translations', { locale: localeStr, error: (error as Error).message });
      return {
        success: false,
        locale: localeStr,
        error: (error as Error).message,
      };
    }
  });

  // Handler: Get detected system locale
  ipcMain.handle('i18n:getDetectedLocale', async (event: IpcMainInvokeEvent): Promise<LocaleResponse> => {
    // ✅ SECURITY: Verify sender (Story 6.3)
    if (!verifySender(event)) {
      log.warn('i18n:getDetectedLocale: Unauthorized sender rejected');
      return { success: false, error: 'Unauthorized request', language: 'en', supported: true };
    }

    try {
      const systemLocale = app.getLocale();
      const localeInfo = getLocaleInfo(systemLocale);

      return {
        success: true,
        ...localeInfo,
      };
    } catch (error) {
      log.error('Error detecting locale', { error: (error as Error).message });
      return {
        success: false,
        error: (error as Error).message,
        language: 'en', // Safe fallback
        supported: true,
        systemLocale: 'en-US',
      };
    }
  });

  log.info('i18n IPC handlers registered');
}

/**
 * Unregister all i18n IPC handlers
 * Call during app cleanup if needed
 */
export function unregisterI18nHandlers(): void {
  ipcMain.removeHandler('i18n:getTranslations');
  ipcMain.removeHandler('i18n:getDetectedLocale');
  log.info('i18n IPC handlers unregistered');
}
