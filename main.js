/**
 * A5 PII Anonymizer - Main Process
 *
 * Electron main process with secure configuration.
 * Uses contextIsolation and preload script for security.
 */

import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { FileProcessor } from './fileProcessor.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let isModelLoaded = false;

/**
 * Create the main application window with secure settings
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      // Note: nodeIntegration is needed for file operations in renderer
      // In future, move file ops to main process for better security
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      enableRemoteModule: false,
      sandbox: false,
    },
    backgroundColor: '#1a1a1a',
    titleBarStyle: 'hiddenInset',
    show: false, // Don't show until ready
  });

  // Show window when ready to prevent flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile('index.html');

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * Set macOS dock icon
 */
function setDockIcon() {
  if (process.platform === 'darwin') {
    const iconPath = app.isPackaged
      ? path.join(process.resourcesPath, 'assets', 'icon.png')
      : path.join(__dirname, 'assets', 'icon.png');

    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath);
    }
  }
}

// App lifecycle
app.whenReady().then(() => {
  createWindow();
  setDockIcon();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============================================
// IPC Handlers
// ============================================

/**
 * Select output directory
 */
ipcMain.handle('select-output-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Output Directory'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

/**
 * Select input directory
 */
ipcMain.handle('select-input-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Input Directory'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

/**
 * Process a single file with progress reporting
 */
ipcMain.handle('process-file', async (event, { filePath, outputDir }) => {
  try {
    const fileName = path.basename(filePath);

    // Notify about model loading on first run
    if (!isModelLoaded) {
      sendToRenderer('model-status', {
        status: 'loading',
        message: 'Loading PII detection model (first-time initialization)...'
      });
      sendToRenderer('log-message', '🔄 Initializing AI model (this may take a moment)...');
    }

    // Send progress update
    sendToRenderer('progress', {
      status: 'processing',
      fileName: fileName,
      message: `Processing: ${fileName}`
    });
    sendToRenderer('log-message', `📄 Processing: ${fileName}`);

    // Determine output path
    const directory = outputDir || path.dirname(filePath);
    const newFileName = FileProcessor.generateOutputFileName(fileName);
    const outputPath = path.join(directory, newFileName);

    // Process the file
    await FileProcessor.processFile(filePath, outputPath);

    // Mark model as loaded after first successful process
    if (!isModelLoaded) {
      isModelLoaded = true;
      sendToRenderer('model-status', {
        status: 'ready',
        message: 'PII detection model ready'
      });
    }

    // Send completion update
    sendToRenderer('progress', {
      status: 'complete',
      fileName: fileName,
      outputPath: outputPath,
      message: `Completed: ${fileName}`
    });
    sendToRenderer('log-message', `✅ Finished: ${newFileName}`);

    return { success: true, outputPath };

  } catch (error) {
    console.error('Error in process-file IPC:', error);

    sendToRenderer('progress', {
      status: 'error',
      fileName: path.basename(filePath),
      error: error.message
    });
    sendToRenderer('log-message', `❌ Error: ${error.message}`);

    return { success: false, error: error.message };
  }
});

/**
 * Open folder or URL in system default app
 */
ipcMain.handle('open-folder', async (event, folderPath) => {
  if (!folderPath) return;

  if (folderPath.startsWith('http://') || folderPath.startsWith('https://')) {
    await shell.openExternal(folderPath);
  } else {
    await shell.openPath(folderPath);
  }
});

/**
 * Get app version
 */
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// ============================================
// Helper Functions
// ============================================

/**
 * Send message to renderer process
 */
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}
