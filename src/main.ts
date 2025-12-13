/**
 * Main Process Entry Point (TypeScript)
 *
 * Electron main process with full type safety, security features, and structured logging.
 */

import { app, BrowserWindow, ipcMain, dialog, shell, session, IpcMainInvokeEvent } from 'electron';
import path from 'path';
import fs from 'fs';
// @ts-ignore - fileProcessor.js is a JavaScript module
import { FileProcessor } from '../fileProcessor.js';
import { fileURLToPath } from 'url';
import { registerFilePreviewHandlers } from './services/filePreviewHandlers.js';
import { registerI18nHandlers } from './services/i18nHandlers.js';
import { registerModelHandlers } from './services/modelHandlers.js';
import { registerFeedbackHandlers } from './services/feedbackHandlers.js';
import { registerAccuracyHandlers } from './services/accuracyHandlers.js';
import { configureLogging, createLogger } from './config/logging.js';
import type { Logger } from './utils/logger.js';

// Initialize logging
const log: Logger = createLogger('main');
const ipcLog: Logger = createLogger('ipc');
const securityLog: Logger = createLogger('security');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

// Type definitions for IPC data structures
interface ValidationResult {
  valid: boolean;
  error?: string;
}

interface ValidationSchema {
  [key: string]: string;
}

interface ProcessFileData {
  filePath: string;
  outputDir?: string;
}

interface ProcessFileResult {
  success: boolean;
  error?: string;
  outputPath?: string;
  markdownContent?: string;
  mappingPath?: string;
  originalMarkdown?: string; // Story 4.3: For selective anonymization
}

interface ReadJsonResult {
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  changes?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Validate IPC input against a schema
 *
 * @param data - Input data to validate
 * @param schema - Schema defining expected types
 * @returns Validation result with error message if invalid
 */
function validateIpcInput(data: unknown, schema: ValidationSchema): ValidationResult {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid input: must be an object' };
  }

  const dataObj = data as Record<string, unknown>;

  for (const [key, expectedType] of Object.entries(schema)) {
    const actualType = typeof dataObj[key];

    if (actualType !== expectedType) {
      return { valid: false, error: `Invalid ${key}: must be ${expectedType}` };
    }

    if (expectedType === 'string' && (dataObj[key] as string).trim() === '') {
      return { valid: false, error: `Invalid ${key}: cannot be empty` };
    }
  }

  return { valid: true };
}

/**
 * Create the main application window
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    webPreferences: {
      nodeIntegration: false,       // ✅ SECURITY: Disable Node.js in renderer
      contextIsolation: true,        // ✅ SECURITY: Enable context isolation
      sandbox: false,                // Note: Disabled for fs access - consider moving fs ops to main process
      preload: path.join(__dirname, '../preload.cjs'),  // ✅ SECURITY: Use preload for IPC
    },
    backgroundColor: '#1a1a1a',
  });

  void mainWindow.loadFile('index.html');

  // Uncomment to debug:
  // mainWindow.webContents.openDevTools();
}

void app.whenReady().then(() => {
  // Initialize logging system
  configureLogging();
  log.info('Application starting', { platform: process.platform, version: app.getVersion() });

  // ✅ SECURITY: Set Content Security Policy
  // Note: connect-src allows HuggingFace for model downloads on first launch
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
          "connect-src 'self' https://huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co; " +
          "frame-src 'none';",
        ],
      },
    });
  });
  securityLog.info('Content Security Policy configured');

  createWindow();

  // Register IPC handlers
  registerFilePreviewHandlers();
  registerI18nHandlers();
  registerModelHandlers(mainWindow);
  registerFeedbackHandlers();
  registerAccuracyHandlers(mainWindow);
  ipcLog.info('IPC handlers registered');

  // macOS Dock icon
  if (process.platform === 'darwin') {
    if (app.isPackaged) {
      // In production, icon is inside resources/assets/icon.png
      const iconPath = path.join(process.resourcesPath, 'assets', 'icon.png');
      app.dock?.setIcon(iconPath);
    } else {
      // In dev mode, use a local path
      const devIconPath = path.join(__dirname, '../assets', 'icon.png');
      app.dock?.setIcon(devIconPath);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

/**
 * IPC Handler: Select output directory
 */
ipcMain.handle('select-output-directory', async (): Promise<string | null | undefined> => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }

  return null;
});

/**
 * IPC Handler: Select input directory
 */
ipcMain.handle('select-input-directory', async (): Promise<string | null | undefined> => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }

  return null;
});

/**
 * IPC Handler: Process file with PII detection and sanitization
 */
ipcMain.handle('process-file', async (_event: IpcMainInvokeEvent, data: unknown): Promise<ProcessFileResult> => {
  try {
    // ✅ SECURITY: Validate input structure and types
    const validation = validateIpcInput(data, { filePath: 'string' });
    if (!validation.valid) {
      securityLog.warn('process-file validation failed', { error: validation.error });
      return { success: false, error: validation.error };
    }

    const { filePath, outputDir } = data as ProcessFileData;

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

    const directory = outputDir || path.dirname(filePath);
    const newFileName = FileProcessor.generateOutputFileName(fileName);
    const outputPath = path.join(directory, newFileName);

    const result = await FileProcessor.processFile(filePath, outputPath);

    // Read the generated markdown file to return its content
    let markdownContent = '';
    try {
      markdownContent = fs.readFileSync(result.outputPath, 'utf-8');
    } catch (readError) {
      ipcLog.error('Could not read output file', { error: (readError as Error).message });
    }

    ipcLog.info('File processing completed', {
      fileName,
      hasOriginalMarkdown: !!result.originalMarkdown,
    });
    // Story 4.3: Include originalMarkdown for selective anonymization
    return {
      success: true,
      outputPath: result.outputPath,
      markdownContent,
      mappingPath: result.mappingPath,
      originalMarkdown: result.originalMarkdown,
    };
  } catch (error) {
    // ✅ SECURITY: Log full error to console (for debugging)
    const err = error as Error;
    ipcLog.error('Error in process-file IPC', { error: err.message, stack: err.stack });

    // ✅ SECURITY: Sanitize error message for UI (remove file paths)
    const sanitizedError = err.message.replace(/\/[\w/.-]+/g, '[REDACTED_PATH]');

    return { success: false, error: sanitizedError };
  }
});

/**
 * IPC Handler: Read JSON file (with security validation)
 */
ipcMain.handle('file:readJson', async (_event: IpcMainInvokeEvent, filePath: unknown): Promise<ReadJsonResult> => {
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
      securityLog.warn('Blocked non-JSON file read attempt', { extension: fileExtension });
      return { error: 'Only .json files are allowed', changes: [] };
    }

    // ✅ SECURITY: Prevent path traversal
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('..')) {
      securityLog.warn('Blocked path traversal attempt');
      return { error: 'Invalid file path', changes: [] };
    }

    // ✅ SECURITY: Ensure path is absolute
    if (!path.isAbsolute(normalizedPath)) {
      securityLog.warn('Blocked relative path');
      return { error: 'Invalid file path', changes: [] };
    }

    // Check if file exists
    if (!fs.existsSync(normalizedPath)) {
      ipcLog.warn('Mapping file not found');
      return { error: 'Mapping file not found', changes: [] };
    }

    // Read and parse JSON
    const content = fs.readFileSync(normalizedPath, 'utf-8');
    const data = JSON.parse(content);
    ipcLog.debug('JSON file read successfully');
    return data;
  } catch (error) {
    const err = error as Error;
    ipcLog.error('Error reading JSON file', { error: err.message });
    // ✅ SECURITY: Sanitize error message (remove paths)
    const sanitizedError = err.message.replace(/\/[\w/.-]+/g, '[REDACTED_PATH]');
    return { error: sanitizedError, changes: [] };
  }
});

/**
 * IPC Handler: Open folder or URL with validation
 */
ipcMain.handle('open-folder', async (_event: IpcMainInvokeEvent, folderPath: unknown): Promise<void> => {
  if (!folderPath || typeof folderPath !== 'string') {
    securityLog.warn('Invalid folder path provided');
    return;
  }

  // Handle URLs
  if (folderPath.startsWith('http://') || folderPath.startsWith('https://')) {
    try {
      const url = new URL(folderPath);

      // Only allow http and https protocols (block javascript:, data:, file:, etc.)
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        await shell.openExternal(folderPath);
        ipcLog.info('Opened external URL', { protocol: url.protocol });
      } else {
        securityLog.warn('Blocked unsafe URL protocol', { protocol: url.protocol });
      }
    } catch (error) {
      securityLog.error('Invalid URL', { error: (error as Error).message });
    }
  } else {
    // Handle local paths with validation
    try {
      // Normalize and resolve path to prevent traversal
      const normalizedPath = path.normalize(folderPath);
      const resolvedPath = path.resolve(normalizedPath);

      // Prevent path traversal
      if (resolvedPath.includes('..')) {
        securityLog.warn('Blocked path traversal attempt');
        return;
      }

      // Ensure path is absolute
      if (!path.isAbsolute(resolvedPath)) {
        securityLog.warn('Blocked relative path');
        return;
      }

      // Define allowed base directories (user directories only)
      const allowedBaseDirs = [
        app.getPath('home'),
        app.getPath('documents'),
        app.getPath('downloads'),
        app.getPath('desktop'),
        app.getPath('temp'),
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
          ipcLog.info('Opened local path');
        } else {
          ipcLog.warn('Path does not exist');
        }
      } else {
        securityLog.warn('Blocked access to path outside allowed directories');
      }
    } catch (error) {
      ipcLog.error('Error opening path', { error: (error as Error).message });
    }
  }
});
