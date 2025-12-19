/**
 * Main Process Entry Point (TypeScript)
 *
 * Electron main process with full type safety, security features, and structured logging.
 */

import { app, BrowserWindow, ipcMain, dialog, shell, session, IpcMainInvokeEvent } from 'electron';
import path from 'path';
import fs from 'fs';
import { FileProcessor } from './core/fileProcessor.js';
import { fileURLToPath } from 'url';
import { registerFilePreviewHandlers } from './services/filePreviewHandlers.js';
import { registerI18nHandlers } from './services/i18nHandlers.js';
import { registerModelHandlers } from './services/modelHandlers.js';
import { registerFeedbackHandlers } from './services/feedbackHandlers.js';
import { registerAccuracyHandlers } from './services/accuracyHandlers.js';
import { LoggerFactory, createLogger } from './utils/LoggerFactory.js';
import type { Logger } from './utils/LoggerFactory.js';
import {
  setMainWindow,
  validateProcessFileInput,
  validateReadJsonInput,
  verifySender,
  validatePath,
} from './utils/ipcValidator.js';
import { sanitizeError, logError } from './utils/errorHandler.js';

// Create loggers (will use console fallback until initialized)
const log: Logger = createLogger('main');
const ipcLog: Logger = createLogger('ipc');
const securityLog: Logger = createLogger('security');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

// Type definitions for IPC data structures
// Story 6.3: Zod schemas now in src/utils/ipcValidator.ts

interface ProcessFileResult {
  success: boolean;
  error?: string;
  outputPath?: string;
  markdownContent?: string;
  mappingPath?: string;
  originalMarkdown?: string; // Story 4.3: For selective anonymization
}

/**
 * Result from reading JSON files - uses index signature for flexibility
 * since JSON content varies by file type (mapping files, configs, etc.)
 * eslint-disable-next-line @typescript-eslint/no-explicit-any - JSON parsing requires flexible typing
 */
interface ReadJsonResult {
  error?: string;
  changes?: unknown[];
  [key: string]: unknown;
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

  // ✅ SECURITY: Set main window reference for IPC sender verification
  setMainWindow(mainWindow);

  void mainWindow.loadFile('index.html');

  // Uncomment to debug:
  // mainWindow.webContents.openDevTools();
}

void app.whenReady().then(async () => {
  // Initialize logging system with LoggerFactory
  await LoggerFactory.initialize();
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
 *
 * Story 6.3: Uses Zod-based validation with sender verification
 */
ipcMain.handle('process-file', async (event: IpcMainInvokeEvent, data: unknown): Promise<ProcessFileResult> => {
  try {
    // ✅ SECURITY: Validate input with Zod schema and sender verification
    const validation = validateProcessFileInput(event, data);
    if (!validation.success) {
      securityLog.warn('process-file validation failed', { error: validation.error });
      return { success: false, error: validation.error };
    }

    const { filePath, outputDir } = validation.data!;

    // ✅ SECURITY: Validate outputDir if provided
    if (outputDir !== undefined && outputDir !== null) {
      const outputDirValidation = validatePath(outputDir, {
        mustExist: true,
        allowDirectory: true,
      });
      if (!outputDirValidation.success) {
        return { success: false, error: `Invalid output directory: ${outputDirValidation.error}` };
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
  } catch (error: unknown) {
    // ✅ SECURITY: Log error with standardized handler (Story 6.7)
    logError(error, { operation: 'process-file', fileType: 'unknown' });

    // ✅ SECURITY: Sanitize error message for UI (Story 6.7)
    const sanitizedMessage = sanitizeError(error);

    return { success: false, error: sanitizedMessage };
  }
});

/**
 * IPC Handler: Read JSON file (with security validation)
 *
 * Story 6.3: Uses Zod-based validation with sender verification
 */
ipcMain.handle('file:readJson', async (event: IpcMainInvokeEvent, filePath: unknown): Promise<ReadJsonResult> => {
  try {
    // ✅ SECURITY: Validate with Zod schema and sender verification
    const validation = validateReadJsonInput(event, filePath);
    if (!validation.success) {
      securityLog.warn('file:readJson validation failed', { error: validation.error });
      return { error: validation.error, changes: [] };
    }

    const normalizedPath = validation.data!;

    // Read and parse JSON
    const content = fs.readFileSync(normalizedPath, 'utf-8');
    const data = JSON.parse(content);
    ipcLog.debug('JSON file read successfully');
    return data;
  } catch (error: unknown) {
    // ✅ SECURITY: Log error with standardized handler (Story 6.7)
    logError(error, { operation: 'file:readJson', fileType: 'json' });

    // ✅ SECURITY: Sanitize error message (Story 6.7)
    const sanitizedMessage = sanitizeError(error);
    return { error: sanitizedMessage, changes: [] };
  }
});

/**
 * IPC Handler: Open folder or URL with validation
 *
 * Story 6.3: Uses sender verification
 */
ipcMain.handle('open-folder', async (event: IpcMainInvokeEvent, folderPath: unknown): Promise<void> => {
  // ✅ SECURITY: Verify sender
  if (!verifySender(event)) {
    securityLog.warn('open-folder: Unauthorized sender rejected');
    return;
  }

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
    } catch (error: unknown) {
      // ✅ SECURITY: Log error with standardized handler (Story 6.7)
      logError(error, { operation: 'open-folder:url' });
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
    } catch (error: unknown) {
      // ✅ SECURITY: Log error with standardized handler (Story 6.7)
      logError(error, { operation: 'open-folder' });
    }
  }
});
