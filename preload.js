/**
 * Preload Script for A5 PII Anonymizer
 *
 * This script runs in a sandboxed context and exposes a secure API
 * to the renderer process via contextBridge.
 *
 * Security: This prevents direct Node.js/Electron API access from
 * the renderer, protecting against XSS attacks.
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // File/Directory Selection
  selectOutputDirectory: () => ipcRenderer.invoke('select-output-directory'),
  selectInputDirectory: () => ipcRenderer.invoke('select-input-directory'),

  // File Processing
  processFile: (data) => ipcRenderer.invoke('process-file', data),

  // Shell operations
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),

  // Event listeners for progress and logging
  onLogMessage: (callback) => {
    const subscription = (_event, message) => callback(message);
    ipcRenderer.on('log-message', subscription);
    // Return cleanup function
    return () => ipcRenderer.removeListener('log-message', subscription);
  },

  onProgress: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('progress', subscription);
    return () => ipcRenderer.removeListener('progress', subscription);
  },

  onModelStatus: (callback) => {
    const subscription = (_event, status) => callback(status);
    ipcRenderer.on('model-status', subscription);
    return () => ipcRenderer.removeListener('model-status', subscription);
  },

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => process.platform
});

// Notify main process that preload is ready
console.log('Preload script loaded successfully');
