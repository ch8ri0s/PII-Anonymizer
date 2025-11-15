import { app, BrowserWindow, ipcMain, dialog, shell, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { FileProcessor } from './fileProcessor.js';
import { fileURLToPath } from 'url';
import { registerFilePreviewHandlers } from './dist/services/filePreviewHandlers.js';
import { registerI18nHandlers } from './dist/services/i18nHandlers.js';

let isLLMInitialized = false; // track if LLM is loaded once

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

// ✅ SECURITY: Input validation helper for IPC handlers
function validateIpcInput(data, schema) {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid input: must be an object' };
  }

  for (const [key, type] of Object.entries(schema)) {
    if (typeof data[key] !== type) {
      return { valid: false, error: `Invalid ${key}: must be ${type}` };
    }
    if (type === 'string' && data[key].trim() === '') {
      return { valid: false, error: `Invalid ${key}: cannot be empty` };
    }
  }

  return { valid: true };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      nodeIntegration: false,       // ✅ SECURITY: Disable Node.js in renderer
      contextIsolation: true,        // ✅ SECURITY: Enable context isolation
      sandbox: false,                // Note: Disabled for fs access - consider moving fs ops to main process
      preload: path.join(__dirname, 'preload.cjs')  // ✅ SECURITY: Use preload for IPC
    },
    backgroundColor: '#1a1a1a',
  });
  // mainWindow.webContents.openDevTools(); // uncomment if you want the console

  mainWindow.loadFile('index.html');

  // Uncomment to debug preload issues:
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  // ✅ SECURITY: Set Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data:; " +
          "font-src 'self'; " +
          "connect-src 'none'; " +
          "frame-src 'none';"
        ]
      }
    });
  });

  createWindow();

  // Register IPC handlers
  registerFilePreviewHandlers();
  registerI18nHandlers();

  // macOS Dock icon
  if (process.platform === 'darwin') {
    if (app.isPackaged) {
      // In production, icon is inside resources/assets/icon.png
      const iconPath = path.join(process.resourcesPath, 'assets', 'icon.png');
      app.dock.setIcon(iconPath);
    } else {
      // In dev mode, use a local path
      const devIconPath = path.join(__dirname, 'assets', 'icon.png');
      app.dock.setIcon(devIconPath);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('select-output-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('select-input-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('process-file', async (event, data) => {
  try {
    // ✅ SECURITY: Validate input structure and types
    const validation = validateIpcInput(data, { filePath: 'string' });
    if (!validation.valid) {
      console.warn('process-file validation failed:', validation.error);
      return { success: false, error: validation.error };
    }

    const { filePath, outputDir } = data;

    // ✅ SECURITY: Validate filePath is not empty after trimming
    if (filePath.trim() === '') {
      return { success: false, error: 'Invalid file path: cannot be empty' };
    }

    // ✅ SECURITY: Validate file exists
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File does not exist' };
    }

    // ✅ SECURITY: Validate file size (max 100MB to prevent OOM attacks)
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      return { success: false, error: 'File too large (max 100MB)' };
    }

    // ✅ SECURITY: Validate file extension (only supported types)
    const supportedExtensions = ['.txt', '.csv', '.docx', '.xlsx', '.xls', '.pdf'];
    const fileExtension = path.extname(filePath).toLowerCase();
    if (!supportedExtensions.includes(fileExtension)) {
      return { success: false, error: `Unsupported file type: ${fileExtension}` };
    }

    // ✅ SECURITY: Validate outputDir if provided
    if (outputDir !== undefined && outputDir !== null) {
      if (typeof outputDir !== 'string' || outputDir.trim() === '') {
        return { success: false, error: 'Invalid output directory' };
      }
    }

    const fileName = path.basename(filePath);

    // If LLM not yet loaded, notify the renderer
    if (!isLLMInitialized) {
      mainWindow.webContents.send('log-message', "Initializing LLM (first-time load)...");
    }

    mainWindow.webContents.send('log-message', `Processing: ${fileName}`);

    const directory = outputDir || path.dirname(filePath);
    const newFileName = FileProcessor.generateOutputFileName(fileName);
    const outputPath = path.join(directory, newFileName);

    await FileProcessor.processFile(filePath, outputPath);

    // Mark LLM as initialized after first file
    isLLMInitialized = true;

    // Read the generated markdown file to return its content
    let markdownContent = '';
    try {
      markdownContent = fs.readFileSync(outputPath, 'utf-8');
    } catch (readError) {
      console.error('Could not read output file:', readError);
    }

    // Construct mapping file path (matches fileProcessor.js naming)
    const mappingPath = outputPath.replace('.md', '-mapping.json');

    mainWindow.webContents.send('log-message', `Finished: ${fileName}`);
    return { success: true, outputPath, markdownContent, mappingPath };
  } catch (error) {
    // ✅ SECURITY: Log full error to console (for debugging)
    console.error("Error in process-file IPC:", error);

    // ✅ SECURITY: Sanitize error message for UI (remove file paths)
    const sanitizedError = error.message.replace(/\/[\w\/.-]+/g, '[REDACTED_PATH]');
    mainWindow.webContents.send('log-message', `Error: ${sanitizedError}`);

    return { success: false, error: sanitizedError };
  }
});

// Read JSON file handler
ipcMain.handle('file:readJson', async (event, filePath) => {
  try {
    // ✅ SECURITY: Validate file path type and presence
    if (!filePath || typeof filePath !== 'string') {
      return { error: 'Invalid file path', changes: [] };
    }

    // ✅ SECURITY: Validate not empty after trimming
    if (filePath.trim() === '') {
      return { error: 'Invalid file path: cannot be empty', changes: [] };
    }

    // ✅ SECURITY: Enforce .json extension
    const fileExtension = path.extname(filePath).toLowerCase();
    if (fileExtension !== '.json') {
      console.warn('Blocked non-JSON file read attempt:', filePath);
      return { error: 'Only .json files are allowed', changes: [] };
    }

    // ✅ SECURITY: Prevent path traversal
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..')) {
      console.warn('Blocked path traversal attempt:', filePath);
      return { error: 'Invalid file path', changes: [] };
    }

    // ✅ SECURITY: Ensure path is absolute
    if (!path.isAbsolute(normalizedPath)) {
      console.warn('Blocked relative path:', filePath);
      return { error: 'Invalid file path', changes: [] };
    }

    // Check if file exists
    if (!fs.existsSync(normalizedPath)) {
      console.warn('Mapping file not found:', normalizedPath);
      return { error: 'Mapping file not found', changes: [] };
    }

    // Read and parse JSON
    const content = fs.readFileSync(normalizedPath, 'utf-8');
    const data = JSON.parse(content);
    return data;
  } catch (error) {
    console.error('Error reading JSON file:', error);
    // ✅ SECURITY: Sanitize error message (remove paths)
    const sanitizedError = error.message.replace(/\/[\w\/.-]+/g, '[REDACTED_PATH]');
    return { error: sanitizedError, changes: [] };
  }
});

// ✅ SECURITY: Open a folder or URL with validation
ipcMain.handle('open-folder', async (event, folderPath) => {
  if (!folderPath || typeof folderPath !== 'string') {
    console.warn('Invalid folder path provided');
    return;
  }

  // Handle URLs
  if (folderPath.startsWith('http://') || folderPath.startsWith('https://')) {
    try {
      const url = new URL(folderPath);

      // Only allow http and https protocols (block javascript:, data:, file:, etc.)
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        await shell.openExternal(folderPath);
      } else {
        console.warn(`Blocked unsafe URL protocol: ${url.protocol}`);
      }
    } catch (error) {
      console.error('Invalid URL:', error.message);
    }
  } else {
    // Handle local paths with validation
    try {
      // Normalize and resolve path to prevent traversal
      const normalizedPath = path.normalize(folderPath);
      const resolvedPath = path.resolve(normalizedPath);

      // Prevent path traversal
      if (resolvedPath.includes('..')) {
        console.warn('Blocked path traversal attempt:', folderPath);
        return;
      }

      // Ensure path is absolute
      if (!path.isAbsolute(resolvedPath)) {
        console.warn('Blocked relative path:', folderPath);
        return;
      }

      // Define allowed base directories (user directories only)
      const allowedBaseDirs = [
        app.getPath('home'),
        app.getPath('documents'),
        app.getPath('downloads'),
        app.getPath('desktop'),
        app.getPath('temp')
      ];

      // Check if path is within allowed directories
      const isAllowed = allowedBaseDirs.some(baseDir => {
        const resolvedBase = path.resolve(baseDir);
        return resolvedPath.startsWith(resolvedBase);
      });

      if (isAllowed) {
        // Verify path exists before opening
        if (fs.existsSync(resolvedPath)) {
          await shell.openPath(resolvedPath);
        } else {
          console.warn('Path does not exist:', resolvedPath);
        }
      } else {
        console.warn('Blocked access to path outside allowed directories:', resolvedPath);
      }
    } catch (error) {
      console.error('Error opening path:', error.message);
    }
  }
});
