/**
 * PII Anonymizer - Browser Edition
 *
 * Main entry point for the browser-based application.
 * Orchestrates the UI modules and processing pipeline.
 */

import type { FileInfo } from './types';
import { FileProcessor } from './processing/FileProcessor';
import {
  loadModel,
  cancelLoading,
  isFallbackMode,
  getModelStatus,
} from './model';
import {
  // Model loader UI
  initModelLoaderUI,
  setOnCancel,
  showLoading,
  updateProgress,
  showSuccess,
  showError,
  showFallbackMode,
  // Upload UI
  initUploadUI,
  updateProcessButton,
  showUploadSection,
  hideUploadSection,
  getFileCount,
  // Review UI
  initReviewUI,
  startReview,
  updateDetectionStatus,
} from './ui';
import {
  initPWAManager,
  initInstallBanner,
  initStatusIndicator,
  notifyFileProcessed,
  setModelCached,
  requestPersistentStorage,
} from './pwa';

// Application state
const state = {
  isProcessing: false,
  modelReady: false,
};

// File processor instance
const processor = new FileProcessor();

/**
 * Initialize the application
 */
async function init(): Promise<void> {
  // Initialize PWA functionality
  initPWAManager();
  initInstallBanner();
  initStatusIndicator();

  // Initialize model loader UI
  initModelLoaderUI();
  setOnCancel(handleCancelModelLoad);

  // Initialize upload UI
  initUploadUI({
    onFilesChange: handleFilesChange,
    onProcess: (files: Map<string, FileInfo>) => void handleProcessFiles(files),
  });

  // Initialize review UI
  initReviewUI({
    onBack: handleBackToUpload,
  });

  // Load the ML model
  await initializeModel();

  // Request persistent storage after model is loaded
  void requestPersistentStorage();
}

/**
 * Initialize the ML model
 */
async function initializeModel(): Promise<void> {
  showLoading();

  try {
    const result = await loadModel((progress) => {
      updateProgress(progress);
    });

    if (result.success) {
      state.modelReady = true;
      setModelCached(true);
      showSuccess();
      console.log('[PII Anonymizer] ML model loaded successfully');
    } else if (result.fallbackMode) {
      state.modelReady = false;
      showFallbackMode();
      console.log('[PII Anonymizer] Using regex-only mode');
    } else {
      state.modelReady = false;
      showError(result.error || 'Failed to load model');
      console.error('[PII Anonymizer] Model loading failed:', result.error);
    }
  } catch {
    state.modelReady = false;
    showFallbackMode();
    console.log('[PII Anonymizer] Using regex-only mode');
  }

  refreshProcessButton();
}

/**
 * Handle model loading cancellation
 */
function handleCancelModelLoad(): void {
  cancelLoading();
  state.modelReady = false;
  console.log('[PII Anonymizer] Model loading cancelled');
}

/**
 * Handle files change in upload UI
 */
function handleFilesChange(): void {
  refreshProcessButton();
}

/**
 * Refresh the process button state
 */
function refreshProcessButton(): void {
  const modelStatus = getModelStatus();
  const fileCount = getFileCount();
  const canProcess = fileCount > 0 && !state.isProcessing && !modelStatus.loading;

  let text = 'Process Files';
  if (state.isProcessing) {
    text = 'Processing...';
  } else if (modelStatus.loading) {
    text = 'Loading Model...';
  } else if (fileCount > 0) {
    const modeText = isFallbackMode() ? ' (Regex Only)' : '';
    text = `Process ${fileCount} File${fileCount !== 1 ? 's' : ''}${modeText}`;
  }

  updateProcessButton({ disabled: !canProcess, text });
}

/**
 * Handle process button click
 */
async function handleProcessFiles(files: Map<string, FileInfo>): Promise<void> {
  if (state.isProcessing || files.size === 0) return;

  state.isProcessing = true;
  refreshProcessButton();

  // Get first file (single file processing for now)
  const firstFile = Array.from(files.values())[0];
  if (!firstFile) {
    state.isProcessing = false;
    refreshProcessButton();
    return;
  }

  // Hide upload section, show review section
  hideUploadSection();

  try {
    // Convert file to markdown
    updateDetectionStatus('detecting', 'Converting document...');

    const result = await processor.processFile(firstFile.file, (progress, status) => {
      updateDetectionStatus('detecting', `${status} (${Math.round(progress)}%)`);
    });

    // Start review with converted content (use original markdown before anonymization)
    const content = result.markdown || result.anonymizedMarkdown;
    await startReview(firstFile.name, content);

    // Notify PWA that a file was processed (triggers install prompt after success)
    notifyFileProcessed();
  } catch (error) {
    console.error('[PII Anonymizer] Processing error:', error);
    updateDetectionStatus('error', (error as Error).message);
  }

  state.isProcessing = false;
  refreshProcessButton();
}

/**
 * Handle back button from review UI
 */
function handleBackToUpload(): void {
  showUploadSection();
}

// Start the application
void init();
