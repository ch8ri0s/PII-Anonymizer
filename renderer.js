/**
 * Renderer Process - New UI
 * Integrates with beautiful card-based design
 */

// Import accuracy dashboard module (Epic 5, Story 5.3)
import { initAccuracyDashboard } from './accuracyDashboard.js';

// ✅ SECURITY: Use contextBridge APIs
const ipcRenderer = window.electronAPI;
const fs = window.fsAPI;
const path = window.pathAPI;

// Get electron-log from preload script
const log = window.log;

// Initialize renderer logging
const rendererLog = log.scope('renderer');
const uiLog = log.scope('ui');
const i18nLog = log.scope('i18n');

// State
let currentFile = null;
let currentFilePath = null;
let processingResult = null;

// Entity Review State (Epic 4)
let entityReviewState = {
  entities: [],
  filters: {
    types: [],
    minConfidence: 0,
    showFlaggedOnly: false,
    statusFilter: 'all',
    searchText: '',
  },
  groupExpanded: {},
};

// ✅ SECURITY: Timeout configuration for async operations
// Story 6.5 AC5: Default 60s, Min 10s, Max 600s (10 min)
// Story 6.8: Use centralized constants from preload bridge
const { TIMEOUT, PREVIEW } = window.constants;
const TIMEOUT_CONFIG = {
  fileProcessing: TIMEOUT.FILE_PROCESSING_MS,
  filePreview: TIMEOUT.FILE_PREVIEW_MS,
  metadata: TIMEOUT.METADATA_MS,
  jsonRead: TIMEOUT.JSON_READ_MS,
  min: TIMEOUT.MIN_MS,
  max: TIMEOUT.MAX_MS,
};

// Story 6.5 AC2: AbortController for cancellation support
let processingAbortController = null;
let timeoutDialogResolve = null;
let processingStartTime = null;
let elapsedTimeInterval = null;

/**
 * ✅ SECURITY: Wraps a promise with timeout protection
 * Story 6.5 AC1, AC2: Timeout detection and cancellation support
 *
 * @param {Promise} promise - The promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operation - Human-readable operation name for error messages
 * @param {Object} options - Additional options
 * @param {AbortSignal} options.signal - AbortSignal for cancellation
 * @param {Function} options.onTimeout - Callback when timeout occurs (before rejection)
 * @returns {Promise} - Resolves/rejects with the original promise or timeout error
 */
async function withTimeout(promise, timeoutMs, operation = 'Operation', options = {}) {
  const { signal, onTimeout } = options;
  let timeoutHandle;
  let abortHandler;

  // Check if already aborted
  if (signal?.aborted) {
    throw new DOMException(`${operation} was cancelled`, 'AbortError');
  }

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      if (onTimeout) {
        onTimeout();
      }
      reject(new Error(`${operation} timed out after ${timeoutMs}ms. The file may be too large or corrupted.`));
    }, timeoutMs);
  });

  // Set up abort signal handler
  const abortPromise = signal
    ? new Promise((_, reject) => {
      abortHandler = () => {
        reject(new DOMException(`${operation} was cancelled`, 'AbortError'));
      };
      signal.addEventListener('abort', abortHandler);
    })
    : null;

  try {
    const racers = [promise, timeoutPromise];
    if (abortPromise) {
      racers.push(abortPromise);
    }

    const result = await Promise.race(racers);
    return result;
  } finally {
    // ✅ CRITICAL: Prevent memory leaks
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
    if (abortHandler && signal) {
      signal.removeEventListener('abort', abortHandler);
    }
  }
}

/**
 * Calculate timeout based on file size
 * Story 6.5 AC5: Larger files get proportionally longer timeouts, clamped to min/max
 *
 * @param {number} fileSizeBytes - File size in bytes
 * @returns {number} - Timeout in milliseconds
 */
function calculateFileTimeout(fileSizeBytes) {
  const BASE_TIMEOUT = 30000; // 30 seconds
  const PER_MB_TIMEOUT = 10000; // 10 seconds per MB

  const fileSizeMB = fileSizeBytes / (1024 * 1024);
  const calculatedTimeout = BASE_TIMEOUT + (fileSizeMB * PER_MB_TIMEOUT);

  // Story 6.5 AC5: Clamp to configurable min/max bounds
  return Math.max(TIMEOUT_CONFIG.min, Math.min(TIMEOUT_CONFIG.max, calculatedTimeout));
}

// DOM Elements
const uploadScreen = document.getElementById('upload-screen');
const processingScreen = document.getElementById('processing-screen');
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const resetBtn = document.getElementById('reset-btn');
const processButton = document.getElementById('process-button');

// Metadata elements
const metaFilename = document.getElementById('meta-filename');
const metaTypeBadge = document.getElementById('meta-type-badge');
const metaSize = document.getElementById('meta-size');
const metaModified = document.getElementById('meta-modified');
const previewContent = document.getElementById('preview-content');

// Processing elements
const initialState = document.getElementById('initial-state');
const processingSpinner = document.getElementById('processing-spinner');
const processingResultDiv = document.getElementById('processing-result');
const piiCountText = document.getElementById('pii-count-text');
const downloadButtons = document.getElementById('download-buttons');
const sanitizedMarkdown = document.getElementById('sanitized-markdown');
const changeList = document.getElementById('change-list');

// Download buttons
const downloadMarkdownBtn = document.getElementById('download-markdown');
const downloadMappingBtn = document.getElementById('download-mapping'); // May be null if removed from UI

// Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Entity Review elements (Epic 4)
const _entityReviewCard = document.getElementById('entity-review-card');
const entityReviewCount = document.getElementById('entity-review-count');
const entityReviewEmpty = document.getElementById('entity-review-empty');
const entityReviewPanel = document.getElementById('entity-review-panel');
const feedbackToggle = document.getElementById('feedback-toggle');

// Story 6.5: Timeout dialog and progress elements
const timeoutDialog = document.getElementById('timeout-dialog');
const timeoutCancelBtn = document.getElementById('timeout-cancel-btn');
const timeoutContinueBtn = document.getElementById('timeout-continue-btn');
const timeoutElapsedTime = document.getElementById('timeout-elapsed-time');
const cancelProcessingBtn = document.getElementById('cancel-processing-btn');
const processingMessage = document.getElementById('processing-message');
const processingProgressContainer = document.getElementById('processing-progress-container');
const processingProgressBar = document.getElementById('processing-progress-bar');
const processingProgressText = document.getElementById('processing-progress-text');

// Entity type labels and colors
const ENTITY_TYPE_LABELS = {
  PERSON: 'Person',
  ORGANIZATION: 'Organization',
  LOCATION: 'Location',
  ADDRESS: 'Address',
  SWISS_ADDRESS: 'Swiss Address',
  EU_ADDRESS: 'EU Address',
  SWISS_AVS: 'Swiss AVS',
  IBAN: 'IBAN',
  PHONE: 'Phone',
  EMAIL: 'Email',
  DATE: 'Date',
  AMOUNT: 'Amount',
  VAT_NUMBER: 'VAT Number',
  INVOICE_NUMBER: 'Invoice Number',
  PAYMENT_REF: 'Payment Ref',
  QR_REFERENCE: 'QR Reference',
  SENDER: 'Sender',
  RECIPIENT: 'Recipient',
  SALUTATION_NAME: 'Salutation',
  SIGNATURE: 'Signature',
  LETTER_DATE: 'Letter Date',
  REFERENCE_LINE: 'Reference',
  PARTY: 'Party',
  AUTHOR: 'Author',
  VENDOR_NAME: 'Vendor',
  UNKNOWN: 'Unknown',
};

const ENTITY_TYPE_COLORS = {
  PERSON: 'badge-blue',
  ORGANIZATION: 'badge-purple',
  LOCATION: 'badge-green',
  ADDRESS: 'badge-green',
  SWISS_ADDRESS: 'badge-green',
  EU_ADDRESS: 'badge-green',
  SWISS_AVS: 'badge-red',
  IBAN: 'badge-red',
  PHONE: 'badge-yellow',
  EMAIL: 'badge-yellow',
  DATE: 'badge-gray',
  AMOUNT: 'badge-orange',
  VAT_NUMBER: 'badge-purple',
  INVOICE_NUMBER: 'badge-gray',
  PAYMENT_REF: 'badge-orange',
  QR_REFERENCE: 'badge-orange',
  SENDER: 'badge-blue',
  RECIPIENT: 'badge-blue',
  SALUTATION_NAME: 'badge-blue',
  SIGNATURE: 'badge-blue',
  LETTER_DATE: 'badge-gray',
  REFERENCE_LINE: 'badge-gray',
  PARTY: 'badge-purple',
  AUTHOR: 'badge-blue',
  VENDOR_NAME: 'badge-purple',
  UNKNOWN: 'badge-gray',
};

// ====================
// Event Listeners
// ====================

// Upload zone drag & drop
uploadZone.addEventListener('click', async (e) => {
  // Don't trigger if clicking on the input itself or the browse button
  if (e.target === fileInput || e.target.closest('.browse-button')) {
    return;
  }
  // Use Electron dialog instead of file input
  await selectFileUsingDialog();
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('upload-zone-active');
});

uploadZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('upload-zone-active');
});

uploadZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  uploadZone.classList.remove('upload-zone-active');

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    await handleFileSelection(files[0]);
  }
});

// File input change - Use Electron dialog instead
fileInput.addEventListener('change', async (e) => {
  // Use Electron dialog for better path handling
  await selectFileUsingDialog();
  // Clear the input
  e.target.value = '';
});

// Reset button
resetBtn.addEventListener('click', reset);

// Process button
processButton.addEventListener('click', processFile);

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // Remove active from all tabs
    tabs.forEach(t => {
      t.classList.remove('tab-active');
      t.setAttribute('aria-selected', 'false');
    });
    tabContents.forEach(c => c.classList.remove('tab-content-active'));

    // Add active to clicked tab
    tab.classList.add('tab-active');
    tab.setAttribute('aria-selected', 'true');
    const targetId = 'tab-' + tab.dataset.tab;
    document.getElementById(targetId).classList.add('tab-content-active');
  });
});

// Download handlers
downloadMarkdownBtn.addEventListener('click', downloadMarkdown);
if (downloadMappingBtn) {
  downloadMappingBtn.addEventListener('click', downloadMapping);
}

// Story 6.5: Timeout dialog button handlers
if (timeoutCancelBtn) {
  timeoutCancelBtn.addEventListener('click', () => {
    if (timeoutDialogResolve) {
      timeoutDialogResolve('cancel');
    }
    cancelProcessing();
  });
}

if (timeoutContinueBtn) {
  timeoutContinueBtn.addEventListener('click', () => {
    if (timeoutDialogResolve) {
      timeoutDialogResolve('continue');
    }
    hideTimeoutDialog();
  });
}

// Story 6.5: Cancel processing button handler
if (cancelProcessingBtn) {
  cancelProcessingBtn.addEventListener('click', () => {
    cancelProcessing();
  });
}

// ====================
// File Handling
// ====================

async function selectFileUsingDialog() {
  try {
    const filePaths = await window.electronAPI.selectFiles({
      allowMultiple: false,
      filters: [
        { name: 'Documents', extensions: ['pdf', 'docx', 'txt', 'md', 'csv', 'xlsx'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (filePaths && filePaths.length > 0) {
      const filePath = filePaths[0];
      // Create a minimal file object with the path
      const fileStats = await window.fsAPI.stat(filePath);
      const fileName = window.pathAPI.basename(filePath);

      // Create file-like object with path property
      const fileObj = {
        name: fileName,
        path: filePath,
        size: fileStats.size,
        type: getFileType(filePath),
      };

      await handleFileSelection(fileObj);
    }
  } catch (error) {
    rendererLog.error('Error selecting file', { error: error.message });
  }
}

function getFileType(filePath) {
  const ext = window.pathAPI.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.csv': 'text/csv',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

async function handleFileSelection(file) {
  uiLog.info('File selected', { fileName: file.name });

  // Check if file has path property (Electron)
  let filePath = file.path;

  if (!filePath) {
    rendererLog.warn('File has no path property, creating temp file');
    filePath = await createTempFile(file);
    if (!filePath) {
      alert('Failed to process file');
      return;
    }
  }

  // Store file info immediately
  currentFile = file;
  currentFilePath = filePath;

  // Show processing view FIRST so DOM elements exist
  showProcessingView();

  // Small delay to ensure DOM is rendered
  await new Promise(resolve => setTimeout(resolve, 50));

  // Load metadata and preview
  await loadFileData(filePath);

  // Auto-process file immediately after selection
  await processFile();
}

async function createTempFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      const uint8Array = new Uint8Array(arrayBuffer);
      const tempDir = window.osAPI.tmpdir();
      const tempPath = path.join(tempDir, file.name);

      fs.writeFile(tempPath, uint8Array, (err) => {
        if (err) {
          rendererLog.error('Error writing temp file', { error: err.message });
          resolve(null);
        } else {
          resolve(tempPath);
        }
      });
    };
    reader.onerror = () => {
      rendererLog.error('Error reading file');
      resolve(null);
    };
    reader.readAsArrayBuffer(file);
  });
}

async function loadFileData(filePath) {
  uiLog.debug('Loading file metadata');

  try {
    // Re-query DOM elements to ensure they exist
    const metaFilename = document.getElementById('meta-filename');
    const metaTypeBadge = document.getElementById('meta-type-badge');
    const metaSize = document.getElementById('meta-size');
    const metaModified = document.getElementById('meta-modified');
    const previewContent = document.getElementById('preview-content');

    if (!metaFilename || !metaTypeBadge || !metaSize || !metaModified || !previewContent) {
      rendererLog.error('Required DOM elements not found');
      return;
    }

    // ✅ SECURITY: Load metadata with timeout protection
    const metadata = await withTimeout(
      ipcRenderer.getFileMetadata(filePath),
      TIMEOUT_CONFIG.metadata,
      'Loading metadata',
    );

    if ('error' in metadata) {
      rendererLog.error('Metadata error', { error: metadata.error });
      showError(`Failed to load metadata: ${metadata.error}`);
      return;
    }

    uiLog.info('Metadata loaded');

    // Populate metadata panel directly
    metaFilename.textContent = metadata.filename;

    const typeInfo = getFileTypeInfo(metadata.extension);
    metaTypeBadge.textContent = typeInfo.label;
    metaTypeBadge.className = `badge ${typeInfo.badgeClass}`;

    // Use i18n formatting if available, otherwise fallback to metadata
    if (window.i18n && metadata.fileSize) {
      metaSize.textContent = window.i18n.formatFileSize(metadata.fileSize);
    } else {
      metaSize.textContent = metadata.fileSizeFormatted;
    }

    const date = new Date(metadata.lastModified);
    if (window.i18n) {
      metaModified.textContent = `${window.i18n.formatDate(date)} ${window.i18n.formatTime(date)}`;
    } else {
      metaModified.textContent = `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
    }

    // ✅ SECURITY: Load preview with timeout protection
    // Story 6.8: Use centralized constants for preview limits
    uiLog.debug('Loading file preview');
    const preview = await withTimeout(
      ipcRenderer.getFilePreview(filePath, {
        lines: PREVIEW.LINE_LIMIT,
        chars: PREVIEW.CHAR_LIMIT,
      }),
      TIMEOUT_CONFIG.filePreview,
      'Loading file preview',
    );

    if ('error' in preview) {
      rendererLog.error('Preview error', { error: preview.error });
      previewContent.textContent = 'Preview not available';
    } else {
      uiLog.info('Preview loaded');
      previewContent.textContent = preview.content;

      if (preview.isTruncated) {
        const truncatedMsg = document.createElement('div');
        truncatedMsg.style.cssText = 'margin-top: 1rem; padding: 0.5rem; background: var(--slate-100); border-radius: var(--radius-sm); color: var(--slate-600); font-style: italic;';
        truncatedMsg.textContent = `Preview truncated (showing first ${preview.previewLineCount} lines)`;
        previewContent.parentElement.appendChild(truncatedMsg);
      }
    }
  } catch (error) {
    rendererLog.error('Error loading file data', { error: error.message });
    showError('Failed to load file data');
  }
}

function _populateMetadata(metadata) {
  // Check if elements exist
  if (!metaFilename || !metaTypeBadge || !metaSize || !metaModified) {
    rendererLog.error('Metadata elements not found in DOM');
    return;
  }

  // Filename
  metaFilename.textContent = metadata.filename;

  // Type badge
  const typeInfo = getFileTypeInfo(metadata.extension);
  metaTypeBadge.textContent = typeInfo.label;
  metaTypeBadge.className = `badge ${typeInfo.badgeClass}`;

  // Size
  if (window.i18n && metadata.fileSize) {
    metaSize.textContent = window.i18n.formatFileSize(metadata.fileSize);
  } else {
    metaSize.textContent = metadata.fileSizeFormatted;
  }

  // Modified
  const date = new Date(metadata.lastModified);
  if (window.i18n) {
    metaModified.textContent = `${window.i18n.formatDate(date)} ${window.i18n.formatTime(date)}`;
  } else {
    metaModified.textContent = `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
  }
}

function _populatePreview(preview) {
  previewContent.textContent = preview.content;

  if (preview.isTruncated) {
    const truncatedMsg = document.createElement('div');
    truncatedMsg.style.cssText = 'margin-top: 1rem; padding: 0.5rem; background: var(--slate-100); border-radius: var(--radius-sm); color: var(--slate-600); font-style: italic;';
    truncatedMsg.textContent = `Preview truncated (showing first ${preview.previewLineCount} lines)`;
    previewContent.parentElement.appendChild(truncatedMsg);
  }
}

function getFileTypeInfo(extension) {
  const ext = extension.toLowerCase();

  // Use i18n if available for labels
  const getLabel = (key, fallback) => {
    return window.i18n ? window.i18n.t(key) : fallback;
  };

  const types = {
    '.pdf': { label: getLabel('fileTypes.pdfDocument', 'PDF Document'), badgeClass: 'badge-red' },
    '.doc': { label: getLabel('fileTypes.wordDocument', 'Word Document'), badgeClass: 'badge-blue' },
    '.docx': { label: getLabel('fileTypes.wordDocument', 'Word Document'), badgeClass: 'badge-blue' },
    '.xls': { label: getLabel('fileTypes.excelSpreadsheet', 'Excel Spreadsheet'), badgeClass: 'badge-green' },
    '.xlsx': { label: getLabel('fileTypes.excelSpreadsheet', 'Excel Spreadsheet'), badgeClass: 'badge-green' },
    '.csv': { label: getLabel('fileTypes.csvFile', 'CSV File'), badgeClass: 'badge-purple' },
    '.txt': { label: getLabel('fileTypes.textFile', 'Text File'), badgeClass: 'badge-gray' },
  };

  return types[ext] || { label: 'Document', badgeClass: 'badge-gray' };
}

// ====================
// Story 6.5: Timeout Dialog Functions
// ====================

/**
 * Show the timeout dialog and wait for user response
 * Story 6.5 AC1: User notification with Continue/Cancel options
 *
 * @returns {Promise<'continue' | 'cancel'>} User's choice
 */
function showTimeoutDialog() {
  return new Promise((resolve) => {
    timeoutDialogResolve = resolve;

    // Update elapsed time display
    const elapsedSeconds = Math.floor((Date.now() - processingStartTime) / 1000);
    if (timeoutElapsedTime) {
      timeoutElapsedTime.textContent = `Elapsed: ${elapsedSeconds}s`;
    }

    // Show the dialog
    if (timeoutDialog) {
      timeoutDialog.classList.remove('hidden');
      timeoutDialog.classList.add('flex');
    }
  });
}

/**
 * Hide the timeout dialog
 */
function hideTimeoutDialog() {
  if (timeoutDialog) {
    timeoutDialog.classList.add('hidden');
    timeoutDialog.classList.remove('flex');
  }
  timeoutDialogResolve = null;
}

/**
 * Cancel the current processing operation
 * Story 6.5 AC2: Cancellation support
 */
function cancelProcessing() {
  if (processingAbortController) {
    rendererLog.info('User cancelled processing');
    processingAbortController.abort();
  }
  hideTimeoutDialog();
  clearElapsedTimeInterval();
}

/**
 * Start elapsed time tracking
 */
function startElapsedTimeInterval() {
  processingStartTime = Date.now();
  elapsedTimeInterval = setInterval(() => {
    if (processingStartTime && timeoutElapsedTime) {
      const elapsedSeconds = Math.floor((Date.now() - processingStartTime) / 1000);
      timeoutElapsedTime.textContent = `Elapsed: ${elapsedSeconds}s`;
    }
  }, 1000);
}

/**
 * Clear elapsed time tracking
 */
function clearElapsedTimeInterval() {
  if (elapsedTimeInterval) {
    clearInterval(elapsedTimeInterval);
    elapsedTimeInterval = null;
  }
  processingStartTime = null;
}

/**
 * Update progress UI
 * Story 6.5 AC4: Progress reporting
 *
 * @param {Object} progress - Progress information
 * @param {string} progress.phase - Current phase
 * @param {number} progress.progress - Percentage (0-100)
 * @param {string} progress.message - Status message
 */
function updateProgress(progress) {
  if (processingMessage) {
    processingMessage.textContent = progress.message || 'Processing...';
  }

  if (progress.progress !== undefined && progress.progress >= 0) {
    // Show progress bar
    if (processingProgressContainer) {
      processingProgressContainer.classList.remove('hidden');
    }
    if (processingProgressBar) {
      processingProgressBar.style.width = `${progress.progress}%`;
    }
    if (processingProgressText) {
      processingProgressText.textContent = `${Math.round(progress.progress)}%`;
    }
  }
}

/**
 * Reset progress UI
 */
function resetProgress() {
  if (processingMessage) {
    processingMessage.textContent = 'Processing and sanitizing PII...';
  }
  if (processingProgressContainer) {
    processingProgressContainer.classList.add('hidden');
  }
  if (processingProgressBar) {
    processingProgressBar.style.width = '0%';
  }
  if (processingProgressText) {
    processingProgressText.textContent = '0%';
  }
}

// ====================
// Processing
// ====================

async function processFile() {
  if (!currentFilePath) return;

  uiLog.info('Processing file');

  // Show spinner and reset progress
  showProcessingState('loading');
  resetProgress();

  // Story 6.5 AC2: Create AbortController for cancellation
  processingAbortController = new AbortController();
  startElapsedTimeInterval();

  try {
    // ✅ SECURITY: Calculate timeout based on file size
    const fileSize = currentFile?.size || 0;
    const timeout = calculateFileTimeout(fileSize);
    rendererLog.debug('File processing timeout calculated', { timeoutMs: timeout, timeoutSec: (timeout / 1000).toFixed(1) });

    // Story 6.5 AC1: Show timeout dialog when threshold is exceeded
    let continueProcessing = true;
    const onTimeout = async () => {
      const choice = await showTimeoutDialog();
      if (choice === 'cancel') {
        continueProcessing = false;
        cancelProcessing();
      } else {
        hideTimeoutDialog();
        // Continue waiting - the promise will complete or timeout again
      }
    };

    // ✅ SECURITY: Wrap processFile with timeout and cancellation support
    const result = await withTimeout(
      ipcRenderer.processFile({
        filePath: currentFilePath,
        outputDir: null, // Will use same directory as input
      }),
      timeout,
      'File processing',
      {
        signal: processingAbortController.signal,
        onTimeout,
      },
    );

    // Clean up
    clearElapsedTimeInterval();
    hideTimeoutDialog();

    if (!result.success) {
      rendererLog.error('Processing error', { error: result.error });
      showError(`Processing failed: ${result.error}`);
      showProcessingState('initial');
      return;
    }

    uiLog.info('Processing complete', {
      outputPath: result.outputPath,
      hasOriginalMarkdown: !!result.originalMarkdown,
      originalMarkdownLength: result.originalMarkdown?.length || 0,
    });

    // Store result (includes originalMarkdown for selective anonymization)
    processingResult = result;

    // The result already contains markdownContent from main process
    const markdownContent = result.markdownContent || '';

    // Read mapping file if available
    let mapping = { entities: {} };
    if (result.mappingPath) {
      try {
        uiLog.debug('Reading mapping file', { path: result.mappingPath });

        // ✅ SECURITY: Wrap readJsonFile with timeout protection
        mapping = await withTimeout(
          ipcRenderer.readJsonFile(result.mappingPath),
          TIMEOUT_CONFIG.jsonRead,
          'Reading mapping file',
        );

        if (mapping.error) {
          rendererLog.warn('Mapping file error', { error: mapping.error });
          mapping = { entities: {} };
        } else {
          const entityCount = mapping.entities ? Object.keys(mapping.entities).length : 0;
          uiLog.info('Mapping loaded', { entityCount });
        }
      } catch (error) {
        rendererLog.error('Error reading mapping', { error: error.message });
        mapping = { entities: {} };
      }
    }

    // Show results
    showResults(markdownContent, mapping);
  } catch (error) {
    // Clean up on error
    clearElapsedTimeInterval();
    hideTimeoutDialog();

    rendererLog.error('Processing error', { error: error.message });

    // Story 6.5 AC2, AC3: Handle cancellation with partial result info
    if (error.name === 'AbortError' || error.message.includes('cancelled')) {
      // AC3: Inform user about cancellation - partial results not available in current implementation
      // The TypeScript PartialResult infrastructure is in place for future main process enhancement
      showError('Processing was cancelled. No partial results were saved because the file processing was interrupted before completion.');
    } else if (error.message.includes('timed out')) {
      // ✅ SECURITY: Show user-friendly timeout message
      showError('File processing is taking longer than expected. The file may be too large or corrupted. Please try a smaller file or contact support.');
    } else {
      showError('Processing failed: ' + error.message);
    }

    showProcessingState('initial');
  }
}

function showResults(markdown, mapping) {
  // Update PII count
  const piiCount = mapping.entities ? Object.keys(mapping.entities).length : 0;
  piiCountText.textContent = `${piiCount} PII instances detected and sanitized`;

  // Show markdown
  sanitizedMarkdown.textContent = markdown;

  // Show mapping
  populateMappingList(mapping.entities || {});

  // Initialize entity review panel (Epic 4)
  initializeEntityReview(mapping.entities || {}, mapping.metadata || {});

  // Show download buttons
  downloadButtons.style.display = 'flex';

  // Show success state
  showProcessingState('success');
}

function populateMappingList(entities) {
  changeList.innerHTML = '';

  // entities is an object like { "John Doe": "PER_1", "jane@example.com": "PER_2" }
  const entityEntries = Object.entries(entities);

  if (entityEntries.length === 0) {
    changeList.innerHTML = '<p style="color: var(--slate-500); text-align: center; padding: 2rem;">No PII changes detected</p>';
    return;
  }

  entityEntries.forEach(([original, replacement], index) => {
    const changeItem = document.createElement('div');
    changeItem.className = 'change-item';

    // Determine entity type from replacement (e.g., "PER_1" -> "PER")
    const entityType = replacement.split('_')[0] || 'PII';
    const typeLabels = {
      'PER': 'Person',
      'LOC': 'Location',
      'ORG': 'Organization',
      'MISC': 'Miscellaneous',
      'PHONE': 'Phone',
      'EMAIL': 'Email',
      'IBAN': 'IBAN',
      'AHV': 'AHV Number',
      'PASSPORT': 'Passport',
      'UIDNUMBER': 'UID Number',
    };
    const typeLabel = typeLabels[entityType] || entityType;

    changeItem.innerHTML = `
      <div class="change-header">
        <span class="badge badge-outline">${typeLabel}</span>
        <span class="change-location">Entity ${index + 1}</span>
      </div>
      <div class="change-details">
        <div class="change-row">
          <span class="change-row-label">Original:</span>
          <span class="change-original">${escapeHtml(original)}</span>
        </div>
        <div class="change-row">
          <span class="change-row-label">Replaced:</span>
          <span class="change-replacement">${escapeHtml(replacement)}</span>
        </div>
      </div>
    `;

    changeList.appendChild(changeItem);
  });
}

function showProcessingState(state) {
  // Hide all states
  initialState.classList.add('hidden');
  processingSpinner.classList.add('hidden');
  processingResultDiv.classList.add('hidden');

  // Show requested state
  if (state === 'initial') {
    initialState.classList.remove('hidden');
  } else if (state === 'loading') {
    processingSpinner.classList.remove('hidden');
  } else if (state === 'success') {
    processingResultDiv.classList.remove('hidden');
  }
}

// ====================
// Entity Review Functions (Epic 4)
// ====================

/**
 * Initialize the entity review panel with detected entities
 * @param {Object} entities - Entity mapping { "John Doe": "PER_1", ... }
 * @param {Object} metadata - Optional metadata with confidence scores, sources, etc.
 */
function initializeEntityReview(entities, metadata = {}) {
  // Convert entities object to reviewable entity array
  const entityEntries = Object.entries(entities);

  entityReviewState.entities = entityEntries.map(([original, replacement], index) => {
    // Parse entity type from replacement (e.g., "PER_1" -> "PERSON")
    const typePrefix = replacement.split('_')[0];
    const entityType = mapPrefixToType(typePrefix);

    // Get metadata if available
    const entityMeta = metadata[original] || {};

    return {
      id: `entity-${index}`,
      originalText: original,
      replacement: replacement,
      type: entityType,
      confidence: entityMeta.confidence || 0.85, // Default confidence
      source: entityMeta.source || 'BOTH',
      status: 'approved', // All entities approved by default
      flaggedForReview: (entityMeta.confidence || 0.85) < 0.7,
      position: entityMeta.position || null,
      context: entityMeta.context || null,
      editedReplacement: null,
    };
  });

  // Reset filters
  entityReviewState.filters = {
    types: [],
    minConfidence: 0,
    showFlaggedOnly: false,
    statusFilter: 'all',
    searchText: '',
  };

  // Update count badge
  entityReviewCount.textContent = `${entityReviewState.entities.length} entities`;

  // Show the review panel
  entityReviewEmpty.classList.add('hidden');
  entityReviewPanel.classList.remove('hidden');

  // Render the review UI
  renderEntityReviewPanel();
}

/**
 * Map entity prefix to full type name
 */
function mapPrefixToType(prefix) {
  const prefixMap = {
    'PER': 'PERSON',
    'ORG': 'ORGANIZATION',
    'LOC': 'LOCATION',
    'ADDR': 'ADDRESS',
    'SWISS_ADDR': 'SWISS_ADDRESS',
    'EU_ADDR': 'EU_ADDRESS',
    'AVS': 'SWISS_AVS',
    'IBAN': 'IBAN',
    'PHONE': 'PHONE',
    'EMAIL': 'EMAIL',
    'DATE': 'DATE',
    'AMOUNT': 'AMOUNT',
    'VAT': 'VAT_NUMBER',
    'INV': 'INVOICE_NUMBER',
    'PAY': 'PAYMENT_REF',
    'QR': 'QR_REFERENCE',
    'SEND': 'SENDER',
    'RECV': 'RECIPIENT',
    'SAL': 'SALUTATION_NAME',
    'SIG': 'SIGNATURE',
    'LDATE': 'LETTER_DATE',
    'REF': 'REFERENCE_LINE',
    'PARTY': 'PARTY',
    'AUTH': 'AUTHOR',
    'VEND': 'VENDOR_NAME',
  };
  return prefixMap[prefix] || 'UNKNOWN';
}

/**
 * Render the complete entity review panel
 */
function renderEntityReviewPanel() {
  const filteredEntities = getFilteredEntities();
  const groupedEntities = groupEntitiesByType(filteredEntities);
  const stats = calculateReviewStats();

  entityReviewPanel.innerHTML = `
    <div class="entity-review-sidebar">
      ${renderApplyButton(stats)}
      ${renderReviewStats(stats)}
      ${renderReviewFilters()}
      <div class="entity-list scroll-area" style="max-height: calc(100vh - 400px); overflow-y: auto;">
        ${Object.keys(groupedEntities).length > 0
    ? Object.entries(groupedEntities).map(([type, entities]) =>
      renderEntityGroup(type, entities),
    ).join('')
    : renderEmptyState()
}
      </div>
      ${renderBulkActions()}
    </div>
  `;

  // Attach event listeners
  attachEntityReviewListeners();
}

/**
 * Get filtered entities based on current filter state
 */
function getFilteredEntities() {
  const { types, minConfidence, showFlaggedOnly, statusFilter, searchText } = entityReviewState.filters;

  return entityReviewState.entities.filter(entity => {
    // Type filter
    if (types.length > 0 && !types.includes(entity.type)) {
      return false;
    }

    // Confidence filter
    if (entity.confidence < minConfidence) {
      return false;
    }

    // Flagged filter
    if (showFlaggedOnly && !entity.flaggedForReview) {
      return false;
    }

    // Status filter
    if (statusFilter !== 'all' && entity.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (searchText) {
      const search = searchText.toLowerCase();
      const matchesOriginal = entity.originalText.toLowerCase().includes(search);
      const matchesReplacement = entity.replacement.toLowerCase().includes(search);
      if (!matchesOriginal && !matchesReplacement) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Group entities by type
 */
function groupEntitiesByType(entities) {
  const groups = {};

  entities.forEach(entity => {
    if (!groups[entity.type]) {
      groups[entity.type] = [];
    }
    groups[entity.type].push(entity);
  });

  return groups;
}

/**
 * Calculate review statistics
 */
function calculateReviewStats() {
  const total = entityReviewState.entities.length;
  const approved = entityReviewState.entities.filter(e => e.status === 'approved').length;
  const rejected = entityReviewState.entities.filter(e => e.status === 'rejected').length;
  const pending = entityReviewState.entities.filter(e => e.status === 'pending').length;
  const edited = entityReviewState.entities.filter(e => e.status === 'edited').length;
  const flagged = entityReviewState.entities.filter(e => e.flaggedForReview).length;

  return { total, approved, rejected, pending, edited, flagged };
}

/**
 * Render review statistics
 */
function renderReviewStats(stats) {
  return `
    <div class="review-stats">
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">Total</div>
        </div>
        <div class="stat-item">
          <div class="stat-value stat-rejected">${stats.rejected}</div>
          <div class="stat-label">Excluded</div>
        </div>
        <div class="stat-item">
          <div class="stat-value stat-pending">${stats.pending}</div>
          <div class="stat-label">Pending</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render filter controls
 */
function renderReviewFilters() {
  const { filters } = entityReviewState;
  const uniqueTypes = [...new Set(entityReviewState.entities.map(e => e.type))];

  return `
    <div class="review-filters">
      <div class="filter-section">
        <label class="filter-label">Search</label>
        <input
          type="text"
          class="filter-search"
          placeholder="Search entities..."
          value="${escapeHtml(filters.searchText)}"
          data-filter="search"
        />
      </div>

      <div class="filter-section">
        <label class="filter-label">Entity Types</label>
        <div class="filter-group">
          ${uniqueTypes.map(type => `
            <label class="filter-checkbox ${filters.types.includes(type) ? 'filter-checkbox-checked' : 'filter-checkbox-unchecked'}">
              <input type="checkbox" data-filter="type" data-type="${type}" ${filters.types.includes(type) ? 'checked' : ''} />
              ${ENTITY_TYPE_LABELS[type] || type}
            </label>
          `).join('')}
        </div>
      </div>

      <div class="filter-section">
        <label class="filter-label">Confidence</label>
        <div class="filter-slider-container">
          <input
            type="range"
            class="filter-slider"
            min="0"
            max="100"
            value="${filters.minConfidence * 100}"
            data-filter="confidence"
          />
          <span class="filter-slider-value">${Math.round(filters.minConfidence * 100)}%</span>
        </div>
      </div>

      <div class="filter-section">
        <label class="filter-toggle">
          <div class="filter-toggle-switch ${filters.showFlaggedOnly ? 'active' : ''}" data-filter="flagged"></div>
          <span class="text-xs text-gray-600">Show flagged only</span>
        </label>
      </div>
    </div>
  `;
}

/**
 * Render an entity group
 */
function renderEntityGroup(type, entities) {
  const isExpanded = entityReviewState.groupExpanded[type] !== false;
  const label = ENTITY_TYPE_LABELS[type] || type;
  const _colorClass = ENTITY_TYPE_COLORS[type] || 'badge-gray';

  // Count rejected entities in this group
  const rejectedCount = entities.filter(e => e.status === 'rejected').length;

  return `
    <div class="entity-group" data-type="${type}">
      <div class="entity-group-header">
        <div class="entity-group-title" data-toggle-group="${type}">
          <svg class="entity-group-icon ${isExpanded ? 'expanded' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
          <span class="entity-group-name">${label}</span>
        </div>
        <div class="entity-group-actions">
          <span class="entity-group-count">${entities.length}${rejectedCount > 0 ? ` (${rejectedCount} excluded)` : ''}</span>
        </div>
      </div>
      <div class="entity-group-content ${isExpanded ? 'expanded' : ''}">
        ${entities.map(entity => renderEntityItem(entity)).join('')}
      </div>
    </div>
  `;
}

/**
 * Get CSS class for confidence score display
 * @param {number} confidence - Confidence score (0-1)
 * @returns {string} CSS class name
 */
function getConfidenceClass(confidence) {
  if (confidence >= 0.85) return 'entity-confidence-high';
  if (confidence >= 0.70) return 'entity-confidence-medium';
  return 'entity-confidence-low';
}

/**
 * Get CSS class for source badge display
 * @param {string} source - Detection source (ML, RULE, BOTH, MANUAL)
 * @returns {string} CSS class name
 */
function getSourceClass(source) {
  const sourceClasses = {
    'ML': 'entity-source-ml',
    'RULE': 'entity-source-rule',
    'BOTH': 'entity-source-both',
    'MANUAL': 'entity-source-manual',
  };
  return sourceClasses[source] || 'entity-source';
}

/**
 * Render a single entity item with checkbox for selection
 */
function renderEntityItem(entity) {
  const isSelected = entity.status !== 'rejected';
  const selectedClass = isSelected ? '' : 'entity-unselected opacity-50';
  const flaggedClass = entity.flaggedForReview ? 'entity-flagged' : '';
  const confidenceClass = getConfidenceClass(entity.confidence);
  const sourceClass = getSourceClass(entity.source);
  const confidencePercent = Math.round(entity.confidence * 100);
  const isLowConfidence = entity.confidence < 0.60;

  return `
    <div class="entity-item ${selectedClass} ${flaggedClass}" data-entity-id="${entity.id}">
      <div class="flex items-start gap-3">
        <input type="checkbox"
               class="entity-select-checkbox mt-1 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
               data-entity-checkbox="${entity.id}"
               ${isSelected ? 'checked' : ''}
               title="${isSelected ? 'Uncheck to exclude from anonymization' : 'Check to include in anonymization'}" />
        <div class="entity-item-content flex-1 min-w-0">
          <div class="entity-text text-sm font-medium text-gray-900 ${!isSelected ? 'line-through text-gray-400' : ''}">${escapeHtml(entity.originalText)}</div>
          <div class="entity-replacement text-xs text-gray-500 font-mono">${escapeHtml(entity.editedReplacement || entity.replacement)}</div>
          <div class="entity-meta mt-1 flex items-center gap-2 flex-wrap">
            <span class="entity-confidence ${confidenceClass}" title="Detection confidence">${confidencePercent}%</span>
            <span class="entity-source ${sourceClass}">${entity.source}</span>
            ${isLowConfidence ? '<span class="entity-warning text-red-500" title="Low confidence detection - review carefully">⚠️</span>' : ''}
            ${entity.flaggedForReview && !isLowConfidence ? '<span class="entity-flag" title="Flagged for review">🚩</span>' : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render empty state
 */
function renderEmptyState() {
  return `
    <div class="entity-list-empty">
      <svg class="entity-list-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p class="entity-list-empty-text">No entities match the current filters</p>
    </div>
  `;
}

/**
 * Render Download Mapping button (positioned at top, right-aligned)
 */
function renderApplyButton(_stats) {
  return `
    <div class="apply-button-container px-4 py-3 border-b border-gray-200 flex justify-end">
      <button class="complete-review-btn" data-action="download-mapping">
        <i class="fas fa-file-arrow-down mr-2"></i>
        Download Mapping
      </button>
    </div>
  `;
}

/**
 * Render bulk action buttons (at bottom) - simplified to Select All / Deselect All
 */
function renderBulkActions() {
  return `
    <div class="review-actions">
      <div class="bulk-actions">
        <button class="bulk-action-btn approve-all" data-bulk-action="approve-all">
          Select All
        </button>
        <button class="bulk-action-btn reject-all" data-bulk-action="reject-all">
          Deselect All
        </button>
      </div>
    </div>
  `;
}


/**
 * Attach event listeners for entity review interactions
 */
function attachEntityReviewListeners() {
  // Group toggle
  entityReviewPanel.querySelectorAll('[data-toggle-group]').forEach(header => {
    header.addEventListener('click', () => {
      const type = header.dataset.toggleGroup;
      entityReviewState.groupExpanded[type] = !entityReviewState.groupExpanded[type];
      renderEntityReviewPanel();
    });
  });

  // Entity actions (buttons)
  entityReviewPanel.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', (_e) => {
      const action = btn.dataset.action;
      const entityId = btn.dataset.entityId;

      if (action === 'approve') handleEntityApprove(entityId);
      else if (action === 'reject') handleEntityReject(entityId);
      else if (action === 'edit') handleEntityEdit(entityId);
      else if (action === 'scroll-to') handleEntityScrollTo(entityId);
      else if (action === 'complete-review') handleCompleteReview();
      else if (action === 'download-mapping') downloadMapping();
    });
  });

  // Bulk actions
  entityReviewPanel.querySelectorAll('[data-bulk-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.bulkAction;
      if (action === 'approve-all') handleBulkApprove();
      else if (action === 'reject-all') handleBulkReject();
      else if (action === 'reset-all') handleBulkReset();
    });
  });

  // Entity selection checkboxes - toggle selection and auto-apply
  entityReviewPanel.querySelectorAll('[data-entity-checkbox]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const entityId = e.target.dataset.entityCheckbox;
      handleEntitySelectionToggle(entityId, e.target.checked);
    });
  });

  // Filter: search
  const searchInput = entityReviewPanel.querySelector('[data-filter="search"]');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      entityReviewState.filters.searchText = e.target.value;
      renderEntityReviewPanel();
    });
  }

  // Filter: type checkboxes
  entityReviewPanel.querySelectorAll('[data-filter="type"]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const type = e.target.dataset.type;
      if (e.target.checked) {
        if (!entityReviewState.filters.types.includes(type)) {
          entityReviewState.filters.types.push(type);
        }
      } else {
        entityReviewState.filters.types = entityReviewState.filters.types.filter(t => t !== type);
      }
      renderEntityReviewPanel();
    });
  });

  // Filter: confidence slider
  const confidenceSlider = entityReviewPanel.querySelector('[data-filter="confidence"]');
  if (confidenceSlider) {
    confidenceSlider.addEventListener('input', (e) => {
      entityReviewState.filters.minConfidence = parseInt(e.target.value) / 100;
      renderEntityReviewPanel();
    });
  }

  // Filter: flagged toggle
  const flaggedToggle = entityReviewPanel.querySelector('[data-filter="flagged"]');
  if (flaggedToggle) {
    flaggedToggle.addEventListener('click', () => {
      entityReviewState.filters.showFlaggedOnly = !entityReviewState.filters.showFlaggedOnly;
      renderEntityReviewPanel();
    });
  }
}

/**
 * Handle entity selection toggle (checkbox)
 * @param {string} entityId - Entity ID
 * @param {boolean} isSelected - Whether the entity is selected
 */
function handleEntitySelectionToggle(entityId, isSelected) {
  const entity = entityReviewState.entities.find(e => e.id === entityId);
  if (entity) {
    entity.status = isSelected ? 'approved' : 'rejected';
    renderEntityReviewPanel();
    // Auto-apply anonymization on selection change
    applyAnonymizationSilent();

    // Log DISMISS action when entity is deselected (Story 5.2)
    if (!isSelected) {
      logEntityDismissal(entity);
    }
  }
}

/**
 * Handle entity approve action
 */
function handleEntityApprove(entityId) {
  const entity = entityReviewState.entities.find(e => e.id === entityId);
  if (entity) {
    entity.status = entity.status === 'approved' ? 'pending' : 'approved';
    renderEntityReviewPanel();
  }
}

/**
 * Handle entity reject action
 */
function handleEntityReject(entityId) {
  const entity = entityReviewState.entities.find(e => e.id === entityId);
  if (entity) {
    entity.status = entity.status === 'rejected' ? 'pending' : 'rejected';
    renderEntityReviewPanel();
  }
}

/**
 * Handle entity edit action
 */
function handleEntityEdit(entityId) {
  const entity = entityReviewState.entities.find(e => e.id === entityId);
  if (!entity) return;

  // Create modal
  const modal = document.createElement('div');
  modal.className = 'entity-edit-modal';
  modal.innerHTML = `
    <div class="entity-edit-content">
      <div class="entity-edit-title">Edit Replacement</div>
      <div class="text-xs text-gray-500 mb-2">Original: ${escapeHtml(entity.originalText)}</div>
      <input type="text" class="entity-edit-input" value="${escapeHtml(entity.editedReplacement || entity.replacement)}" />
      <div class="entity-edit-actions">
        <button class="btn-ghost btn-sm" data-modal-action="cancel">Cancel</button>
        <button class="btn-primary btn-sm" data-modal-action="save">Save</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const input = modal.querySelector('.entity-edit-input');
  input.focus();
  input.select();

  // Handle actions
  modal.querySelector('[data-modal-action="cancel"]').addEventListener('click', () => {
    modal.remove();
  });

  modal.querySelector('[data-modal-action="save"]').addEventListener('click', () => {
    const newValue = input.value.trim();
    if (newValue && newValue !== entity.replacement) {
      entity.editedReplacement = newValue;
      entity.status = 'edited';
    }
    modal.remove();
    renderEntityReviewPanel();
  });

  // Close on background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });

  // Close on escape
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') modal.remove();
    if (e.key === 'Enter') modal.querySelector('[data-modal-action="save"]').click();
  });
}

/**
 * Handle scroll to entity in preview
 */
function handleEntityScrollTo(entityId) {
  const entity = entityReviewState.entities.find(e => e.id === entityId);
  if (!entity || !entity.position) return;

  // Highlight in markdown preview
  const _markdown = sanitizedMarkdown.textContent;
  const replacement = entity.editedReplacement || entity.replacement;

  // Find and scroll to the replacement in the preview
  // This is a simplified implementation - could be enhanced
  uiLog.info('Scroll to entity', { entityId, replacement });
}

/**
 * Handle bulk select all (approve all)
 */
function handleBulkApprove() {
  const filteredEntities = getFilteredEntities();
  filteredEntities.forEach(entity => {
    entity.status = 'approved';
  });
  renderEntityReviewPanel();
  applyAnonymizationSilent();
}

/**
 * Handle bulk deselect all (reject all)
 */
function handleBulkReject() {
  const filteredEntities = getFilteredEntities();
  filteredEntities.forEach(entity => {
    entity.status = 'rejected';
  });
  renderEntityReviewPanel();
  applyAnonymizationSilent();
}

/**
 * Handle bulk reset all - kept for compatibility but may not be used
 */
function handleBulkReset() {
  entityReviewState.entities.forEach(entity => {
    entity.status = 'approved';
    entity.editedReplacement = null;
  });
  renderEntityReviewPanel();
  applyAnonymizationSilent();
}

/**
 * Apply anonymization silently (without alert) - used for auto-apply on manual PII marking
 */
function applyAnonymizationSilent() {
  const reviewResult = getReviewResult();

  uiLog.info('Auto-applying anonymization', {
    toAnonymize: reviewResult.entitiesToAnonymize.length,
    rejected: reviewResult.rejectedEntities.length,
  });

  // Update the mapping with review decisions
  const finalEntities = {};
  reviewResult.entitiesToAnonymize.forEach(entity => {
    finalEntities[entity.originalText] = entity.replacement;
  });

  // Update the change list display
  populateMappingList(finalEntities);

  // Apply selective anonymization to the original markdown
  const originalMarkdown = processingResult?.originalMarkdown;
  if (originalMarkdown) {
    const selectivelyAnonymized = applySelectiveAnonymization(
      originalMarkdown,
      reviewResult.entitiesToAnonymize,
    );
    sanitizedMarkdown.textContent = selectivelyAnonymized;
  }

  // Update PII count to reflect final selection
  piiCountText.textContent = `${reviewResult.entitiesToAnonymize.length} PII instances anonymized`;
}

/**
 * Handle complete review action - applies selective anonymization
 */
function handleCompleteReview() {
  // Get the final entity mapping based on review
  const reviewResult = getReviewResult();
  const rejectedCount = reviewResult.rejectedEntities.length;

  uiLog.info('Review applied', {
    toAnonymize: reviewResult.entitiesToAnonymize.length,
    rejected: rejectedCount,
    hasOriginalMarkdown: !!processingResult?.originalMarkdown,
  });

  // Update the mapping with review decisions
  const finalEntities = {};
  reviewResult.entitiesToAnonymize.forEach(entity => {
    finalEntities[entity.originalText] = entity.replacement;
  });

  // Update the change list display
  populateMappingList(finalEntities);

  // Apply selective anonymization to the original markdown
  const originalMarkdown = processingResult?.originalMarkdown;
  if (originalMarkdown) {
    const selectivelyAnonymized = applySelectiveAnonymization(
      originalMarkdown,
      reviewResult.entitiesToAnonymize,
    );
    sanitizedMarkdown.textContent = selectivelyAnonymized;
    uiLog.info('Markdown updated with selective anonymization', {
      originalLength: originalMarkdown.length,
      resultLength: selectivelyAnonymized.length,
    });
  } else {
    uiLog.warn('Original markdown not available - cannot apply selective anonymization', {
      hasProcessingResult: !!processingResult,
      keys: processingResult ? Object.keys(processingResult) : [],
      originalMarkdownType: typeof processingResult?.originalMarkdown,
    });
  }

  // Update PII count to reflect final selection
  piiCountText.textContent = `${reviewResult.entitiesToAnonymize.length} PII instances anonymized`;

  let message = `Applied!\n\n${reviewResult.entitiesToAnonymize.length} entities anonymized.`;
  if (rejectedCount > 0) {
    message += `\n${rejectedCount} entities kept in original form.`;
  }
  alert(message);
}

/**
 * Get the final review result
 * Entities are anonymized unless explicitly rejected
 */
function getReviewResult() {
  const entitiesToAnonymize = entityReviewState.entities
    .filter(e => e.status !== 'rejected')
    .map(e => ({
      originalText: e.originalText,
      replacement: e.editedReplacement || e.replacement,
      type: e.type,
    }));

  const rejectedEntities = entityReviewState.entities
    .filter(e => e.status === 'rejected')
    .map(e => ({
      originalText: e.originalText,
      type: e.type,
    }));

  return { entitiesToAnonymize, rejectedEntities };
}

/**
 * Story 4.3: Apply selective anonymization to the original markdown
 * Only replaces entities that are selected AND not rejected
 * @param {string} originalMarkdown - The original un-anonymized markdown
 * @param {Array} entitiesToAnonymize - Entities to replace
 * @returns {string} - Markdown with selective anonymization applied
 */
function applySelectiveAnonymization(originalMarkdown, entitiesToAnonymize) {
  if (!originalMarkdown) {
    uiLog.warn('No original markdown available for selective anonymization');
    return sanitizedMarkdown.textContent || '';
  }

  let result = originalMarkdown;

  // Sort entities by length (longest first) to avoid partial replacements
  const sortedEntities = [...entitiesToAnonymize].sort(
    (a, b) => b.originalText.length - a.originalText.length,
  );

  // Replace each entity
  for (const entity of sortedEntities) {
    const { originalText, replacement } = entity;
    if (!originalText || !replacement) continue;

    // Create a global regex that matches the entity text
    // Escape special regex characters in the original text
    const escapedText = originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedText, 'g');

    result = result.replace(regex, replacement);
  }

  uiLog.info('Selective anonymization applied', {
    entitiesReplaced: entitiesToAnonymize.length,
  });

  return result;
}

/**
 * Reset entity review state
 */
function resetEntityReview() {
  entityReviewState = {
    entities: [],
    filters: {
      types: [],
      minConfidence: 0,
      showFlaggedOnly: false,
      statusFilter: 'all',
      searchText: '',
    },
    groupExpanded: {},
  };

  entityReviewCount.textContent = '0 entities';
  entityReviewEmpty.classList.remove('hidden');
  entityReviewPanel.classList.add('hidden');
  entityReviewPanel.innerHTML = '';
}

// ====================
// Manual PII Marking (Epic 4 - Story 4.4)
// ====================

/**
 * Show context menu for manual PII marking
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} selectedText - Selected text
 */
function showPiiContextMenu(x, y, selectedText) {
  // Remove any existing context menu
  hidePiiContextMenu();

  const menu = document.createElement('div');
  menu.className = 'pii-context-menu';
  menu.id = 'pii-context-menu';
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;

  menu.innerHTML = `
    <div class="pii-context-menu-item" data-action="mark-pii">
      <span class="pii-context-menu-item-icon">🏷️</span>
      <span>Mark as PII</span>
    </div>
    <div class="pii-context-menu-divider"></div>
    <div class="pii-context-menu-item" data-action="copy">
      <span class="pii-context-menu-item-icon">📋</span>
      <span>Copy</span>
    </div>
  `;

  document.body.appendChild(menu);

  // Ensure menu stays within viewport
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - menuRect.width - 10}px`;
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - menuRect.height - 10}px`;
  }

  // Handle mark as PII (simplified - no type selection)
  const markPiiItem = menu.querySelector('[data-action="mark-pii"]');
  if (markPiiItem) {
    markPiiItem.addEventListener('click', () => {
      handleManualPiiMark(selectedText, 'MANUAL');
      hidePiiContextMenu();
    });
  }

  // Handle copy
  const copyItem = menu.querySelector('[data-action="copy"]');
  if (copyItem) {
    copyItem.addEventListener('click', () => {
      window.navigator.clipboard.writeText(selectedText);
      hidePiiContextMenu();
    });
  }

  // Close menu on click outside
  setTimeout(() => {
    document.addEventListener('click', handleContextMenuClickOutside);
  }, 0);
}

/**
 * Hide context menu
 */
function hidePiiContextMenu() {
  const existingMenu = document.getElementById('pii-context-menu');
  if (existingMenu) {
    existingMenu.remove();
  }
  document.removeEventListener('click', handleContextMenuClickOutside);
}

/**
 * Handle click outside context menu
 */
function handleContextMenuClickOutside(e) {
  const menu = document.getElementById('pii-context-menu');
  if (menu && !menu.contains(e.target)) {
    hidePiiContextMenu();
  }
}

/**
 * Handle manual PII marking
 * @param {string} text - Selected text to mark
 * @param {string} type - Entity type
 */
function handleManualPiiMark(text, type) {
  if (!text || !type) return;

  // Generate replacement based on type and existing count
  const existingOfType = entityReviewState.entities.filter(e => e.type === type).length;
  const prefix = getReplacementPrefix(type);
  const replacement = `${prefix}_${existingOfType + 1}`;

  // Create new entity
  const newEntity = {
    id: `entity-manual-${Date.now()}`,
    originalText: text,
    replacement: replacement,
    type: type,
    confidence: 1.0, // Manual entries have 100% confidence
    source: 'MANUAL',
    status: 'approved', // Auto-approve manual entries
    flaggedForReview: false,
    position: null,
    context: null,
    editedReplacement: null,
  };

  // Add to state
  entityReviewState.entities.push(newEntity);

  // Update count badge
  entityReviewCount.textContent = `${entityReviewState.entities.length} entities`;

  // Re-render the review panel
  renderEntityReviewPanel();

  uiLog.info('Manual PII marked', { text, type, replacement });

  // Auto-apply anonymization when manually marking PII (silent - no alert)
  applyAnonymizationSilent();

  // Log ADD action for manual PII marking (Story 5.2)
  logManualPiiAddition(newEntity);
}

/**
 * Log entity dismissal for feedback analysis (Story 5.2)
 * @param {Object} entity - The dismissed entity
 */
async function logEntityDismissal(entity) {
  try {
    // Get context around the entity (50 chars before and after)
    const originalMarkdown = processingResult?.originalMarkdown || '';
    const contextText = extractEntityContext(entity, originalMarkdown);

    const input = {
      action: 'DISMISS',
      entityType: entity.type,
      originalText: entity.originalText,
      contextText: contextText,
      documentName: currentFile?.name || 'unknown',
      originalSource: entity.source || 'ML',
      confidence: entity.confidence,
      position: entity.position,
    };

    const result = await window.feedbackAPI.logCorrection(input);
    if (result.success && result.entryId) {
      uiLog.debug('Logged entity dismissal', { entityId: entity.id, entryId: result.entryId });
    }
  } catch (error) {
    // Silent failure - don't disrupt user workflow
    uiLog.warn('Failed to log entity dismissal', { error: error.message });
  }
}

/**
 * Log manual PII addition for feedback analysis (Story 5.2)
 * @param {Object} entity - The manually added entity
 */
async function logManualPiiAddition(entity) {
  try {
    // Get context around the entity (50 chars before and after)
    const originalMarkdown = processingResult?.originalMarkdown || '';
    const contextText = extractEntityContext(entity, originalMarkdown);

    const input = {
      action: 'ADD',
      entityType: entity.type,
      originalText: entity.originalText,
      contextText: contextText,
      documentName: currentFile?.name || 'unknown',
      originalSource: 'MANUAL',
      confidence: 1.0,
      position: entity.position,
    };

    const result = await window.feedbackAPI.logCorrection(input);
    if (result.success && result.entryId) {
      uiLog.debug('Logged manual PII addition', { entityId: entity.id, entryId: result.entryId });
    }
  } catch (error) {
    // Silent failure - don't disrupt user workflow
    uiLog.warn('Failed to log manual PII addition', { error: error.message });
  }
}

/**
 * Extract context around an entity for feedback logging
 * @param {Object} entity - The entity
 * @param {string} markdown - The original markdown content
 * @returns {string} Context text (up to 100 chars around entity)
 */
function extractEntityContext(entity, markdown) {
  if (!markdown || !entity.originalText) {
    return entity.originalText || '';
  }

  // Find the entity in the markdown
  const entityIndex = markdown.indexOf(entity.originalText);
  if (entityIndex === -1) {
    return entity.originalText;
  }

  // Extract 50 chars before and after
  const contextStart = Math.max(0, entityIndex - 50);
  const contextEnd = Math.min(markdown.length, entityIndex + entity.originalText.length + 50);

  let context = markdown.slice(contextStart, contextEnd);

  // Add ellipsis if truncated
  if (contextStart > 0) context = '...' + context;
  if (contextEnd < markdown.length) context = context + '...';

  return context;
}

/**
 * Get replacement prefix for entity type
 */
function getReplacementPrefix(type) {
  const prefixMap = {
    'PERSON': 'PER',
    'ORGANIZATION': 'ORG',
    'LOCATION': 'LOC',
    'ADDRESS': 'ADDR',
    'SWISS_ADDRESS': 'SWISS_ADDR',
    'EU_ADDRESS': 'EU_ADDR',
    'SWISS_AVS': 'AVS',
    'IBAN': 'IBAN',
    'PHONE': 'PHONE',
    'EMAIL': 'EMAIL',
    'DATE': 'DATE',
    'AMOUNT': 'AMOUNT',
    'VAT_NUMBER': 'VAT',
    'INVOICE_NUMBER': 'INV',
    'PAYMENT_REF': 'PAY',
    'QR_REFERENCE': 'QR',
    'SENDER': 'SEND',
    'RECIPIENT': 'RECV',
    'SALUTATION_NAME': 'SAL',
    'SIGNATURE': 'SIG',
    'LETTER_DATE': 'LDATE',
    'REFERENCE_LINE': 'REF',
    'PARTY': 'PARTY',
    'AUTHOR': 'AUTH',
    'VENDOR_NAME': 'VEND',
    'MANUAL': 'MANUAL',
  };
  return prefixMap[type] || 'PII';
}

/**
 * Set up context menu listener for markdown preview
 */
function setupManualPiiMarkingListeners() {
  // Listen for context menu on sanitized markdown preview
  if (sanitizedMarkdown) {
    sanitizedMarkdown.addEventListener('contextmenu', (e) => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();

      if (selectedText && selectedText.length > 0) {
        e.preventDefault();
        showPiiContextMenu(e.clientX, e.clientY, selectedText);
      }
    });
  }

  // Also listen on the preview content
  if (previewContent) {
    previewContent.addEventListener('contextmenu', (e) => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();

      if (selectedText && selectedText.length > 0 && processingResult) {
        e.preventDefault();
        showPiiContextMenu(e.clientX, e.clientY, selectedText);
      }
    });
  }
}

// Initialize manual PII marking on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setupManualPiiMarkingListeners();
  initFeedbackToggle();
  initAccuracyDashboard();
});

/**
 * Initialize feedback logging toggle (Story 5.2)
 * Loads saved preference and sets up toggle button
 */
async function initFeedbackToggle() {
  if (!feedbackToggle) return;

  try {
    // Load current setting
    const settings = await window.feedbackAPI.getSettings();
    updateFeedbackToggleUI(settings.enabled);

    // Add click handler
    feedbackToggle.addEventListener('click', async () => {
      const currentState = feedbackToggle.classList.contains('feedback-enabled');
      const newState = !currentState;

      try {
        await window.feedbackAPI.setEnabled(newState);
        updateFeedbackToggleUI(newState);
        uiLog.info('Feedback logging toggled', { enabled: newState });
      } catch (error) {
        uiLog.error('Failed to toggle feedback logging', { error: error.message });
      }
    });
  } catch (error) {
    uiLog.warn('Failed to initialize feedback toggle', { error: error.message });
  }
}

/**
 * Update feedback toggle button UI based on state
 * @param {boolean} enabled - Whether feedback logging is enabled
 */
function updateFeedbackToggleUI(enabled) {
  if (!feedbackToggle) return;

  if (enabled) {
    feedbackToggle.classList.add('feedback-enabled', 'text-blue-600');
    feedbackToggle.classList.remove('text-gray-400');
    feedbackToggle.title = 'Correction logging enabled (click to disable)';
  } else {
    feedbackToggle.classList.remove('feedback-enabled', 'text-blue-600');
    feedbackToggle.classList.add('text-gray-400');
    feedbackToggle.title = 'Correction logging disabled (click to enable)';
  }
}

// ====================
// Download Functions
// ====================

function downloadMarkdown() {
  if (!processingResult) return;

  const markdown = sanitizedMarkdown.textContent;
  const filename = currentFile.name.replace(/\.[^/.]+$/, '') + '_sanitized.md';

  downloadFile(markdown, filename, 'text/markdown');
}

function downloadMapping() {
  if (!processingResult) return;

  // Reconstruct mapping from UI
  const entities = {};
  Array.from(changeList.children).forEach(item => {
    const original = item.querySelector('.change-original')?.textContent || '';
    const replacement = item.querySelector('.change-replacement')?.textContent || '';
    if (original && replacement) {
      entities[original] = replacement;
    }
  });

  const mapping = {
    version: '2.0',
    originalFile: currentFile.name,
    timestamp: new Date().toISOString(),
    model: 'Xenova/distilbert-base-multilingual-cased-ner-hrl',
    detectionMethods: ['ML (transformers)', 'Rule-based (Swiss/EU)'],
    entities,
  };

  const filename = currentFile.name.replace(/\.[^/.]+$/, '') + '_mapping.json';
  downloadFile(JSON.stringify(mapping, null, 2), filename, 'application/json');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  uiLog.info('File downloaded', { filename });
}

// ====================
// UI State Management
// ====================

function showProcessingView() {
  uploadScreen.classList.add('hidden');
  processingScreen.classList.remove('hidden');
}

function showUploadZone() {
  processingScreen.classList.add('hidden');
  uploadScreen.classList.remove('hidden');
}

function reset() {
  currentFile = null;
  currentFilePath = null;
  processingResult = null;

  // Reset UI
  showUploadZone();
  showProcessingState('initial');
  if (downloadButtons) downloadButtons.style.display = 'none';
  if (processButton) processButton.disabled = true;

  // Clear file input
  if (fileInput) fileInput.value = '';

  // Clear metadata - re-query to ensure they exist
  const metaFilename = document.getElementById('meta-filename');
  const metaTypeBadge = document.getElementById('meta-type-badge');
  const metaSize = document.getElementById('meta-size');
  const metaModified = document.getElementById('meta-modified');
  const previewContent = document.getElementById('preview-content');

  if (metaFilename) metaFilename.textContent = '-';
  if (metaTypeBadge) {
    metaTypeBadge.textContent = '-';
    metaTypeBadge.className = 'badge-gray';
  }
  if (metaSize) metaSize.textContent = '-';
  if (metaModified) metaModified.textContent = '-';
  if (previewContent) previewContent.textContent = 'Select a file to preview...';

  // Clear processing results
  if (sanitizedMarkdown) sanitizedMarkdown.textContent = '';
  if (changeList) changeList.innerHTML = '';
  if (piiCountText) piiCountText.textContent = 'Click "Process File" to begin';

  // Reset entity review (Epic 4)
  resetEntityReview();

  // Reset tabs
  if (tabs) {
    tabs.forEach((tab, i) => {
      if (i === 0) {
        tab.classList.add('tab-active');
        tab.setAttribute('aria-selected', 'true');
      } else {
        tab.classList.remove('tab-active');
        tab.setAttribute('aria-selected', 'false');
      }
    });
  }

  if (tabContents) {
    tabContents.forEach((content, i) => {
      if (i === 0) {
        content.classList.add('tab-content-active');
      } else {
        content.classList.remove('tab-content-active');
      }
    });
  }

  uiLog.debug('Reset complete');
}

function showError(message) {
  rendererLog.error('Displaying error to user', { message });

  // Create error alert
  const alert = document.createElement('div');
  alert.className = 'alert alert-error';
  alert.innerHTML = `
    <i class="fas fa-exclamation-circle"></i>
    <p>${escapeHtml(message)}</p>
  `;

  // Insert at top of processing view or show as browser alert
  if (processingScreen && !processingScreen.classList.contains('hidden')) {
    const gridContainer = processingScreen.querySelector('.grid');
    if (gridContainer && gridContainer.parentElement === processingScreen) {
      processingScreen.insertBefore(alert, gridContainer);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        alert.remove();
      }, 5000);
    } else {
      // Fallback to browser alert
      uiLog.warn('Grid container not found, using browser alert');
      window.alert(message);
    }
  } else {
    // If processing view isn't visible, use browser alert
    window.alert(message);
  }
}

// ====================
// Utilities
// ====================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ====================
// Initialization
// ====================

rendererLog.info('Renderer initialized with new UI');
rendererLog.debug('electronAPI available', { available: !!window.electronAPI });

// ====================
// Model Download UI
// ====================

const modelDownloadModal = document.getElementById('model-download-modal');
const downloadProgressBar = document.getElementById('download-progress-bar');
const downloadFileName = document.getElementById('download-file-name');
const downloadPercentage = document.getElementById('download-percentage');
const downloadSizeInfo = document.getElementById('download-size-info');
const downloadErrorSection = document.getElementById('download-error-section');
const downloadErrorText = document.getElementById('download-error-text');
const downloadRetryBtn = document.getElementById('download-retry-btn');
const downloadProgressSection = document.getElementById('download-progress-section');

/**
 * Show the model download modal
 */
function showModelDownloadModal() {
  if (modelDownloadModal) {
    modelDownloadModal.classList.remove('hidden');
    // Disable background scrolling
    document.body.style.overflow = 'hidden';
  }
}

/**
 * Hide the model download modal
 */
function hideModelDownloadModal() {
  if (modelDownloadModal) {
    modelDownloadModal.classList.add('hidden');
    // Re-enable background scrolling
    document.body.style.overflow = '';
    // Clean up progress listener
    if (window.modelAPI && window.modelAPI.removeDownloadProgressListener) {
      window.modelAPI.removeDownloadProgressListener();
    }
  }
}

/**
 * Update the download progress UI
 * @param {Object} progress - Progress info from main process
 */
function updateDownloadProgress(progress) {
  if (!progress) return;

  uiLog.debug('Download progress update', progress);

  // Update progress bar
  if (typeof progress.progress === 'number') {
    const percent = Math.round(progress.progress);
    if (downloadProgressBar) {
      downloadProgressBar.style.width = `${percent}%`;
    }
    if (downloadPercentage) {
      downloadPercentage.textContent = `${percent}%`;
    }
  }

  // Update file name
  if (progress.file && downloadFileName) {
    // Extract just the filename from the path
    const fileName = progress.file.split('/').pop() || progress.file;
    downloadFileName.textContent = fileName;
  }

  // Update size info
  if (progress.loaded && progress.total && downloadSizeInfo) {
    const loadedMB = (progress.loaded / (1024 * 1024)).toFixed(1);
    const totalMB = (progress.total / (1024 * 1024)).toFixed(1);
    downloadSizeInfo.textContent = `${loadedMB} MB / ${totalMB} MB`;
  }

  // Handle status updates
  if (progress.status === 'initiate') {
    if (downloadFileName) downloadFileName.textContent = 'Initializing...';
    if (downloadProgressBar) downloadProgressBar.style.width = '0%';
  } else if (progress.status === 'ready' || progress.status === 'done') {
    if (downloadFileName) downloadFileName.textContent = 'Download complete!';
    if (downloadProgressBar) downloadProgressBar.style.width = '100%';
    if (downloadPercentage) downloadPercentage.textContent = '100%';
  } else if (progress.status === 'error') {
    showDownloadError(progress.error || 'Download failed');
  }
}

/**
 * Show download error in the modal
 * @param {string} errorMessage - Error message to display
 */
function showDownloadError(errorMessage) {
  if (downloadErrorSection) {
    downloadErrorSection.classList.remove('hidden');
  }
  if (downloadErrorText) {
    downloadErrorText.textContent = errorMessage;
  }
  if (downloadProgressSection) {
    downloadProgressSection.classList.add('hidden');
  }
  if (downloadRetryBtn) {
    downloadRetryBtn.classList.remove('hidden');
  }
}

/**
 * Reset error state and show progress section
 */
function resetDownloadError() {
  if (downloadErrorSection) {
    downloadErrorSection.classList.add('hidden');
  }
  if (downloadProgressSection) {
    downloadProgressSection.classList.remove('hidden');
  }
  if (downloadRetryBtn) {
    downloadRetryBtn.classList.add('hidden');
  }
  if (downloadProgressBar) {
    downloadProgressBar.style.width = '0%';
  }
  if (downloadPercentage) {
    downloadPercentage.textContent = '0%';
  }
  if (downloadFileName) {
    downloadFileName.textContent = 'Initializing...';
  }
  if (downloadSizeInfo) {
    downloadSizeInfo.textContent = '';
  }
}

/**
 * Start the model download process
 */
async function startModelDownload() {
  try {
    uiLog.info('Starting model download');
    resetDownloadError();

    // Set up progress listener
    if (window.modelAPI && window.modelAPI.onDownloadProgress) {
      window.modelAPI.onDownloadProgress(updateDownloadProgress);
    }

    // Start download
    const result = await window.modelAPI.downloadModel();

    if (result.success) {
      uiLog.info('Model download completed successfully');
      // Wait a moment to show completion, then hide modal
      setTimeout(() => {
        hideModelDownloadModal();
      }, 1000);
    } else {
      uiLog.error('Model download failed', { error: result.error });
      showDownloadError(result.error || 'Download failed. Please check your internet connection.');
    }
  } catch (error) {
    uiLog.error('Model download error', { error: error.message });
    showDownloadError(error.message || 'An unexpected error occurred.');
  }
}

// Retry button handler
if (downloadRetryBtn) {
  downloadRetryBtn.addEventListener('click', async () => {
    uiLog.info('Retrying model download');
    // Clean up any partial downloads first
    try {
      await window.modelAPI.cleanupModel();
    } catch (e) {
      uiLog.warn('Cleanup failed, continuing with retry', { error: e.message });
    }
    await startModelDownload();
  });
}

/**
 * Check if model exists and download if needed
 * This runs on app initialization before allowing file processing
 */
async function checkAndDownloadModel() {
  try {
    // Check if modelAPI is available
    if (!window.modelAPI || !window.modelAPI.checkModel) {
      uiLog.warn('Model API not available, skipping model check');
      return true; // Assume model is available in dev mode
    }

    uiLog.info('Checking if AI model is installed');
    const status = await window.modelAPI.checkModel();

    if (status.exists && status.valid) {
      uiLog.info('AI model is already installed', { path: status.path });
      return true;
    }

    uiLog.info('AI model not found, starting download', { missingFiles: status.missingFiles });

    // Show download modal
    showModelDownloadModal();

    // Start download
    await startModelDownload();

    // Verify download succeeded
    const newStatus = await window.modelAPI.checkModel();
    if (newStatus.exists && newStatus.valid) {
      uiLog.info('AI model installed successfully');
      return true;
    } else {
      uiLog.error('AI model installation failed');
      return false;
    }
  } catch (error) {
    uiLog.error('Error checking/downloading model', { error: error.message });
    return false;
  }
}

// Initialize model check on page load
(async function initializeModelCheck() {
  // Small delay to ensure DOM is ready
  await new Promise(resolve => setTimeout(resolve, 100));

  const modelReady = await checkAndDownloadModel();
  if (!modelReady) {
    uiLog.warn('Model not ready, some features may not work');
  }
})();

// Initialize i18n
(async function initializeI18n() {
  try {
    // Check if i18n API is available
    if (!window.i18nAPI || !window.i18nAPI.getDetectedLocale || !window.i18nAPI.getTranslations) {
      i18nLog.warn('i18n API not available, skipping initialization');
      return;
    }

    // Check for saved language preference first
    const storedLanguage = localStorage.getItem('preferredLanguage');
    const languageSource = localStorage.getItem('languageSource');

    let locale;
    if (storedLanguage && languageSource === 'manual' && ['en', 'fr', 'de'].includes(storedLanguage)) {
      // User explicitly set a language preference - respect it
      locale = storedLanguage;
      i18nLog.info('Using saved language preference', { locale, source: 'manual' });
    } else {
      // No manual preference - detect system language
      const localeResponse = await window.i18nAPI.getDetectedLocale();
      if (!localeResponse || !localeResponse.success) {
        i18nLog.warn('Failed to detect locale, using fallback');
        locale = 'en';
      } else {
        locale = localeResponse.language || 'en';
        i18nLog.info('Using system language', { locale, systemLocale: localeResponse.systemLocale });
      }
    }

    // Load translations for detected locale
    const translationsResponse = await window.i18nAPI.getTranslations(locale);
    if (!translationsResponse || !translationsResponse.success) {
      i18nLog.warn('Failed to load translations', { locale });
      return;
    }

    // Load English fallback
    const fallbackResponse = await window.i18nAPI.getTranslations('en');
    const fallbackTranslations = fallbackResponse && fallbackResponse.success ? fallbackResponse.translations : {};

    // Create simple i18n object for renderer
    window.i18n = {
      locale: locale,
      translations: translationsResponse.translations || {},
      fallback: fallbackTranslations,

      t: function(key) {
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
          if (value && typeof value === 'object' && k in value) {
            value = value[k];
          } else {
            // Try fallback
            value = this.fallback;
            for (const fk of keys) {
              if (value && typeof value === 'object' && fk in value) {
                value = value[fk];
              } else {
                return key; // Return key if not found
              }
            }
            break;
          }
        }

        return typeof value === 'string' ? value : key;
      },

      formatFileSize: function(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
      },

      formatDate: function(date) {
        return date.toLocaleDateString(this.locale);
      },

      formatTime: function(date) {
        return date.toLocaleTimeString(this.locale);
      },
    };

    i18nLog.info('i18n initialized successfully', { locale });
  } catch (error) {
    i18nLog.error('Error initializing i18n', { error: error.message });
  }
})();
