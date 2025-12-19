/**
 * Model Loader UI Component
 *
 * Manages the visual display of model loading progress.
 * Provides user feedback during download and initialization.
 */

import { DownloadProgress, MODEL_SIZE_BYTES } from '../model';

// DOM element references
let statusElement: HTMLElement | null = null;
let progressBar: HTMLElement | null = null;
let progressText: HTMLElement | null = null;
let cancelButton: HTMLElement | null = null;
let spinner: HTMLElement | null = null;

// Callback for cancel action
let onCancelCallback: (() => void) | null = null;

/**
 * Initialize the UI component
 * Finds DOM elements and sets up event listeners
 */
export function initModelLoaderUI(): void {
  statusElement = document.getElementById('model-status');
  progressBar = document.getElementById('model-progress');
  progressText = document.getElementById('model-progress-text');

  // Create cancel button if it doesn't exist
  if (statusElement && !cancelButton) {
    cancelButton = document.createElement('button');
    cancelButton.id = 'model-cancel';
    cancelButton.className = 'ml-2 text-sm text-blue-600 hover:text-blue-800 underline';
    cancelButton.textContent = 'Cancel';
    cancelButton.style.display = 'none';
    cancelButton.addEventListener('click', handleCancel);

    // Find the parent div and append cancel button
    const progressContainer = statusElement.querySelector('.flex-1');
    if (progressContainer) {
      progressContainer.appendChild(cancelButton);
    }
  }

  // Find spinner
  spinner = statusElement?.querySelector('svg.animate-spin') || null;
}

/**
 * Set the cancel callback
 */
export function setOnCancel(callback: () => void): void {
  onCancelCallback = callback;
}

/**
 * Handle cancel button click
 */
function handleCancel(): void {
  if (onCancelCallback) {
    onCancelCallback();
    showCancelled();
  }
}

/**
 * Show the model loading UI
 */
export function showLoading(): void {
  if (!statusElement) initModelLoaderUI();
  if (statusElement) {
    statusElement.classList.remove('hidden');
    statusElement.className = 'mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200';
  }
  if (cancelButton) {
    cancelButton.style.display = 'inline';
  }
  if (spinner) {
    spinner.classList.add('animate-spin');
  }
}

/**
 * Hide the model loading UI
 */
export function hideLoading(): void {
  if (statusElement) {
    statusElement.classList.add('hidden');
  }
}

/**
 * Update the progress display
 */
export function updateProgress(progress: DownloadProgress): void {
  if (!statusElement) initModelLoaderUI();

  // Ensure visible
  showLoading();

  // Update progress bar
  if (progressBar && typeof progress.progress === 'number') {
    progressBar.style.width = `${Math.round(progress.progress)}%`;
  }

  // Update progress text
  if (progressText) {
    let text = '';

    switch (progress.status) {
      case 'initiate':
        text = 'Initializing...';
        break;
      case 'download':
        if (progress.file) {
          const fileName = progress.file.split('/').pop() || progress.file;
          text = `Downloading ${fileName}...`;
        } else {
          text = 'Downloading model files...';
        }
        break;
      case 'progress':
        if (progress.loaded !== undefined && progress.total !== undefined) {
          const loadedMB = (progress.loaded / (1024 * 1024)).toFixed(1);
          const totalMB = (progress.total / (1024 * 1024)).toFixed(1);
          text = `${loadedMB} MB / ${totalMB} MB`;
        } else if (typeof progress.progress === 'number') {
          text = `${Math.round(progress.progress)}% complete`;
        } else {
          text = 'Loading...';
        }
        break;
      case 'done':
        text = 'Finalizing...';
        break;
      case 'ready':
        text = 'Model ready!';
        break;
      case 'error':
        text = progress.error || 'An error occurred';
        break;
      default:
        text = 'Processing...';
    }

    progressText.textContent = text;
  }
}

/**
 * Show success state
 */
export function showSuccess(): void {
  if (!statusElement) initModelLoaderUI();

  if (statusElement) {
    statusElement.className = 'mb-6 p-4 bg-green-50 rounded-lg border border-green-200';

    // Update inner content
    const titleElement = statusElement.querySelector('p.font-medium');
    if (titleElement) {
      titleElement.textContent = 'ML Model Ready';
      titleElement.className = 'text-sm font-medium text-green-800';
    }
  }

  if (progressBar) {
    progressBar.style.width = '100%';
    progressBar.className = 'bg-green-600 h-2 rounded-full transition-all duration-300';
  }

  if (progressText) {
    progressText.textContent = 'Model loaded successfully!';
    progressText.className = 'text-xs text-green-600 mt-1';
  }

  if (spinner) {
    spinner.classList.remove('animate-spin');
  }

  if (cancelButton) {
    cancelButton.style.display = 'none';
  }

  // Hide after a delay
  setTimeout(() => {
    hideLoading();
  }, 2000);
}

/**
 * Show error state
 */
export function showError(message: string): void {
  if (!statusElement) initModelLoaderUI();

  if (statusElement) {
    statusElement.className = 'mb-6 p-4 bg-red-50 rounded-lg border border-red-200';

    // Update inner content
    const titleElement = statusElement.querySelector('p.font-medium');
    if (titleElement) {
      titleElement.textContent = 'Model Loading Failed';
      titleElement.className = 'text-sm font-medium text-red-800';
    }
  }

  if (progressBar) {
    progressBar.style.width = '100%';
    progressBar.className = 'bg-red-600 h-2 rounded-full transition-all duration-300';
  }

  if (progressText) {
    progressText.textContent = message;
    progressText.className = 'text-xs text-red-600 mt-1';
  }

  if (spinner) {
    spinner.classList.remove('animate-spin');
  }

  if (cancelButton) {
    cancelButton.style.display = 'none';
  }
}

/**
 * Show fallback mode state
 */
export function showFallbackMode(): void {
  if (!statusElement) initModelLoaderUI();

  if (statusElement) {
    statusElement.className = 'mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200';

    // Update inner content
    const titleElement = statusElement.querySelector('p.font-medium');
    if (titleElement) {
      titleElement.textContent = 'Using Fallback Mode';
      titleElement.className = 'text-sm font-medium text-amber-800';
    }
  }

  if (progressBar) {
    progressBar.style.width = '100%';
    progressBar.className = 'bg-amber-500 h-2 rounded-full transition-all duration-300';
  }

  if (progressText) {
    progressText.textContent = 'ML model unavailable. Using regex patterns only (reduced accuracy).';
    progressText.className = 'text-xs text-amber-600 mt-1';
  }

  if (spinner) {
    spinner.classList.remove('animate-spin');
  }

  if (cancelButton) {
    cancelButton.style.display = 'none';
  }
}

/**
 * Show cancelled state
 */
export function showCancelled(): void {
  if (!statusElement) initModelLoaderUI();

  if (statusElement) {
    statusElement.className = 'mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200';

    const titleElement = statusElement.querySelector('p.font-medium');
    if (titleElement) {
      titleElement.textContent = 'Loading Cancelled';
      titleElement.className = 'text-sm font-medium text-gray-800';
    }
  }

  if (progressText) {
    progressText.textContent = 'Using regex patterns only (reduced accuracy).';
    progressText.className = 'text-xs text-gray-600 mt-1';
  }

  if (spinner) {
    spinner.classList.remove('animate-spin');
  }

  if (cancelButton) {
    cancelButton.style.display = 'none';
  }
}

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
