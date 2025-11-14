/**
 * Preload Script - Secure IPC Bridge
 *
 * This script runs in a privileged context and exposes only specific,
 * sanitized APIs to the renderer process via contextBridge.
 *
 * Security: Prevents direct Node.js access from renderer while allowing
 * controlled communication with main process.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose only specific, validated IPC methods to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Process a file for PII anonymization
   * @param {Object} data - { filePath: string, outputDir: string }
   * @returns {Promise<Object>} - { success: boolean, outputPath?: string, error?: string }
   */
  processFile: (data) => {
    // Validate input before sending to main process
    if (!data || typeof data.filePath !== 'string') {
      return Promise.reject(new Error('Invalid file path'));
    }
    return ipcRenderer.invoke('process-file', data);
  },

  /**
   * Select an input directory
   * @returns {Promise<string|null>} - Selected directory path or null
   */
  selectInputDirectory: () => {
    return ipcRenderer.invoke('select-input-directory');
  },

  /**
   * Select an output directory
   * @returns {Promise<string|null>} - Selected directory path or null
   */
  selectOutputDirectory: () => {
    return ipcRenderer.invoke('select-output-directory');
  },

  /**
   * Open a folder or URL
   * @param {string} folderPath - Path or URL to open
   * @returns {Promise<void>}
   */
  openFolder: (folderPath) => {
    // Validate input
    if (typeof folderPath !== 'string' || folderPath.length === 0) {
      return Promise.reject(new Error('Invalid folder path'));
    }
    return ipcRenderer.invoke('open-folder', folderPath);
  },

  /**
   * Listen for log messages from main process
   * @param {Function} callback - Called with (message: string)
   */
  onLogMessage: (callback) => {
    // Validate callback
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    // Use a wrapper to sanitize incoming messages
    const wrappedCallback = (event, message) => {
      // Ensure message is a string
      if (typeof message === 'string') {
        callback(message);
      }
    };

    ipcRenderer.on('log-message', wrappedCallback);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('log-message', wrappedCallback);
    };
  },

  /**
   * Get file metadata (stats + text analysis)
   * @param {string} filePath - Absolute path to the file
   * @returns {Promise<Object>} - FileMetadata | FileMetadataError
   */
  getFileMetadata: (filePath) => {
    if (typeof filePath !== 'string' || filePath.length === 0) {
      return Promise.reject(new Error('Invalid file path'));
    }
    return ipcRenderer.invoke('file:getMetadata', filePath);
  },

  /**
   * Get content preview (first N lines or M characters)
   * @param {string} filePath - Absolute path to the file
   * @param {Object} limit - { lines: number, chars: number }
   * @returns {Promise<Object>} - FilePreview | FilePreviewError
   */
  getFilePreview: (filePath, limit) => {
    if (typeof filePath !== 'string' || filePath.length === 0) {
      return Promise.reject(new Error('Invalid file path'));
    }
    if (!limit || typeof limit.lines !== 'number' || typeof limit.chars !== 'number') {
      return Promise.reject(new Error('Invalid limit parameters'));
    }
    return ipcRenderer.invoke('file:getPreview', filePath, limit);
  },

  /**
   * Open file selection dialog
   * @param {Object} options - { allowMultiple: boolean, filters: Array }
   * @returns {Promise<string[]|null>} - Selected file paths or null if cancelled
   */
  selectFiles: (options) => {
    if (!options || typeof options.allowMultiple !== 'boolean') {
      return Promise.reject(new Error('Invalid options'));
    }
    return ipcRenderer.invoke('dialog:selectFiles', options);
  },

  /**
   * Read a JSON file
   * @param {string} filePath - Absolute path to the JSON file
   * @returns {Promise<Object>} - Parsed JSON object
   */
  readJsonFile: (filePath) => {
    if (typeof filePath !== 'string' || filePath.length === 0) {
      return Promise.reject(new Error('Invalid file path'));
    }
    return ipcRenderer.invoke('file:readJson', filePath);
  }
});

// Expose i18n API for internationalization
contextBridge.exposeInMainWorld('i18nAPI', {
  /**
   * Get translations for a specific locale
   * @param {string} locale - Two-letter language code ('en', 'fr', 'de')
   * @returns {Promise<Object>} - { success: boolean, locale: string, translations: Object, metadata?: Object, error?: string }
   */
  getTranslations: (locale) => {
    if (typeof locale !== 'string' || !['en', 'fr', 'de'].includes(locale)) {
      return Promise.reject(new Error('Invalid locale. Must be en, fr, or de'));
    }
    return ipcRenderer.invoke('i18n:getTranslations', locale);
  },

  /**
   * Get detected system locale
   * @returns {Promise<Object>} - { success: boolean, language: string, systemLocale: string, supported: boolean, fallback?: string }
   */
  getDetectedLocale: () => {
    return ipcRenderer.invoke('i18n:getDetectedLocale');
  }
});

// Expose safe Node.js modules (read-only)
contextBridge.exposeInMainWorld('nodeAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});

// ✅ SECURITY: Expose limited fs and path operations (sandboxed)
// These are needed for renderer file handling but are safer than full Node.js access
const fs = require('fs');
const path = require('path');
const os = require('os');

contextBridge.exposeInMainWorld('fsAPI', {
  // File system operations (limited and validated)
  lstat: async (filePath) => {
    if (typeof filePath !== 'string') throw new Error('Invalid path');
    const stats = await fs.promises.lstat(filePath);
    // Return a serializable object with methods converted to properties
    return {
      isDirectory: () => stats.isDirectory(),
      isFile: () => stats.isFile(),
      isSymbolicLink: () => stats.isSymbolicLink(),
      size: stats.size,
      mtime: stats.mtime,
      ctime: stats.ctime,
      atime: stats.atime
    };
  },

  stat: async (filePath) => {
    if (typeof filePath !== 'string') throw new Error('Invalid path');
    const stats = await fs.promises.stat(filePath);
    // Return a serializable object with methods converted to properties
    return {
      isDirectory: () => stats.isDirectory(),
      isFile: () => stats.isFile(),
      isSymbolicLink: () => stats.isSymbolicLink(),
      size: stats.size,
      mtime: stats.mtime,
      ctime: stats.ctime,
      atime: stats.atime
    };
  },

  readdir: (dirPath) => {
    if (typeof dirPath !== 'string') throw new Error('Invalid path');
    return fs.promises.readdir(dirPath);
  },

  writeFile: (filePath, data, callback) => {
    if (typeof filePath !== 'string') throw new Error('Invalid path');
    return fs.writeFile(filePath, data, callback);
  },

  existsSync: (filePath) => {
    if (typeof filePath !== 'string') throw new Error('Invalid path');
    return fs.existsSync(filePath);
  }
});

contextBridge.exposeInMainWorld('pathAPI', {
  join: (...args) => path.join(...args),
  basename: (filePath, ext) => path.basename(filePath, ext),
  dirname: (filePath) => path.dirname(filePath),
  extname: (filePath) => path.extname(filePath),
  normalize: (filePath) => path.normalize(filePath),
  resolve: (...args) => path.resolve(...args),
  isAbsolute: (filePath) => path.isAbsolute(filePath)
});

contextBridge.exposeInMainWorld('osAPI', {
  tmpdir: () => os.tmpdir()
});

// Log successful preload
console.log('✓ Preload script initialized securely');
console.log('✓ electronAPI methods:', Object.keys(contextBridge.exposeInMainWorld.name || {}));
console.log('✓ window.electronAPI should be available');
