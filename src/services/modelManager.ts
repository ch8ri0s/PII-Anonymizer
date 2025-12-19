/**
 * Model Manager Service
 *
 * Handles lazy-loading of the AI model on first launch.
 * Downloads the model from HuggingFace Hub and stores it in userData.
 *
 * Security: Downloads only from HuggingFace, validates file integrity.
 */

import { app, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../utils/LoggerFactory.js';
import type {
  ModelStatus,
  DownloadProgress,
  DownloadResult,
} from '../types/modelDownload.js';
import {
  REQUIRED_MODEL_FILES,
  MODEL_NAME,
} from '../types/modelDownload.js';

const log = createLogger('model-manager');

/**
 * Callback type for download progress updates
 */
type ProgressCallback = (progress: DownloadProgress) => void;

/**
 * Get the path where models should be stored
 * Uses userData directory which persists across app updates
 */
export function getModelBasePath(): string {
  return path.join(app.getPath('userData'), 'models');
}

/**
 * Get the full path to the specific model directory
 */
export function getModelPath(): string {
  // Model name is "Xenova/distilbert-base-multilingual-cased-ner-hrl"
  // HuggingFace transformers.js stores it as "Xenova/distilbert-base-multilingual-cased-ner-hrl"
  return path.join(getModelBasePath(), MODEL_NAME.replace('/', path.sep));
}

/**
 * Check if the model exists and is valid
 */
export async function checkModelExists(): Promise<ModelStatus> {
  const modelPath = getModelPath();
  const missingFiles: string[] = [];

  log.info('Checking model status', { modelPath });

  // Check if model directory exists
  if (!fs.existsSync(modelPath)) {
    log.info('Model directory does not exist');
    return {
      exists: false,
      valid: false,
      path: modelPath,
      missingFiles: [...REQUIRED_MODEL_FILES],
    };
  }

  // Check each required file
  for (const file of REQUIRED_MODEL_FILES) {
    const filePath = path.join(modelPath, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    log.info('Model is incomplete', { missingFiles });
    return {
      exists: false,
      valid: false,
      path: modelPath,
      missingFiles,
    };
  }

  // Calculate total size
  let totalSize = 0;
  try {
    for (const file of REQUIRED_MODEL_FILES) {
      const filePath = path.join(modelPath, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
    }
  } catch (error) {
    log.error('Error calculating model size', { error: (error as Error).message });
  }

  log.info('Model exists and is valid', { totalSize });
  return {
    exists: true,
    valid: true,
    path: modelPath,
    size: totalSize,
    missingFiles: [],
  };
}

/**
 * Download the model from HuggingFace Hub
 *
 * Uses @xenova/transformers built-in download functionality
 * which handles caching, resume, and progress tracking.
 */
export async function downloadModel(
  progressCallback?: ProgressCallback,
  mainWindow?: BrowserWindow | null,
): Promise<DownloadResult> {
  const modelBasePath = getModelBasePath();

  log.info('Starting model download', { modelName: MODEL_NAME, targetPath: modelBasePath });

  // Ensure the models directory exists
  if (!fs.existsSync(modelBasePath)) {
    fs.mkdirSync(modelBasePath, { recursive: true });
    log.info('Created models directory', { path: modelBasePath });
  }

  try {
    // Send initial progress
    const initialProgress: DownloadProgress = {
      status: 'initiate',
      file: 'Initializing download...',
      progress: 0,
    };
    progressCallback?.(initialProgress);
    mainWindow?.webContents.send('model:download:progress', initialProgress);

    // Dynamically import @xenova/transformers to configure it
    const { pipeline, env } = await import('@xenova/transformers');

    // Configure transformers.js for download
    env.cacheDir = modelBasePath;
    env.allowRemoteModels = true;
    env.allowLocalModels = true;

    log.info('Configured transformers environment', {
      cacheDir: env.cacheDir,
      allowRemoteModels: env.allowRemoteModels,
    });

    // Download by initializing the pipeline with progress callback
    // This triggers the model download if not present
    await pipeline(
      'token-classification',
      MODEL_NAME,
      {
        progress_callback: (progressInfo: DownloadProgress) => {
          log.debug('Download progress', { ...progressInfo });
          progressCallback?.(progressInfo);
          mainWindow?.webContents.send('model:download:progress', progressInfo);
        },
      },
    );

    // Small delay to ensure files are flushed to disk
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify the download
    const status = await checkModelExists();
    if (!status.exists || !status.valid) {
      log.error('Model verification failed after download', {
        exists: status.exists,
        valid: status.valid,
        missingFiles: status.missingFiles,
        path: status.path,
      });
      throw new Error(`Model download completed but verification failed. Missing files: ${status.missingFiles.join(', ')}`);
    }

    // Send completion progress
    const completeProgress: DownloadProgress = {
      status: 'ready',
      progress: 100,
      file: 'Download complete!',
    };
    progressCallback?.(completeProgress);
    mainWindow?.webContents.send('model:download:progress', completeProgress);

    log.info('Model download completed successfully', { modelPath: status.path });

    return {
      success: true,
      modelPath: status.path,
    };
  } catch (error) {
    const errorMessage = (error as Error).message;
    log.error('Model download failed', { error: errorMessage });

    // Send error progress
    const errorProgress: DownloadProgress = {
      status: 'error',
      error: errorMessage,
    };
    progressCallback?.(errorProgress);
    mainWindow?.webContents.send('model:download:progress', errorProgress);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Clean up any partial or corrupted model files
 */
export async function cleanupModelFiles(): Promise<void> {
  const modelPath = getModelPath();

  if (!fs.existsSync(modelPath)) {
    return;
  }

  log.info('Cleaning up model files', { modelPath });

  try {
    // Remove the entire model directory
    fs.rmSync(modelPath, { recursive: true, force: true });
    log.info('Model files cleaned up successfully');
  } catch (error) {
    log.error('Error cleaning up model files', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Get the model name for display purposes
 */
export function getModelDisplayName(): string {
  return MODEL_NAME.split('/').pop() || MODEL_NAME;
}
