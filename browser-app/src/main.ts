/**
 * PII Anonymizer - Browser Edition
 *
 * Main entry point for the browser-based application.
 * No installation required - runs entirely in the browser.
 */

import type { FileInfo, ProcessingResult } from './types';
import { FileProcessor } from './processing/FileProcessor';
import { downloadFile, downloadZip, formatFileSize } from './utils/download';
import { isSupported } from './converters';
import {
  loadModel,
  cancelLoading,
  isModelReady,
  isFallbackMode,
  getModelStatus,
} from './model';
import {
  initModelLoaderUI,
  setOnCancel,
  showLoading,
  updateProgress,
  showSuccess,
  showError,
  showFallbackMode,
} from './ui';

// Application state
const state = {
  files: new Map<string, FileInfo>(),
  results: new Map<string, ProcessingResult>(),
  isProcessing: false,
  modelReady: false,
};

// DOM Elements
const uploadZone = document.getElementById('upload-zone')!;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const fileList = document.getElementById('file-list')!;
const filesContainer = document.getElementById('files-container')!;
const processBtn = document.getElementById('process-btn') as HTMLButtonElement;
const processingStatus = document.getElementById('processing-status')!;
const processingContainer = document.getElementById('processing-container')!;
const resultsSection = document.getElementById('results-section')!;
const resultsContainer = document.getElementById('results-container')!;
const downloadAllBtn = document.getElementById('download-all-btn')!;
const piiSummary = document.getElementById('pii-summary')!;
const piiStats = document.getElementById('pii-stats')!;

// File processor instance
const processor = new FileProcessor();

// Initialize
async function init() {
  // Initialize UI components
  initModelLoaderUI();
  setOnCancel(handleCancelModelLoad);

  // Setup event handlers
  setupUploadZone();
  setupProcessButton();
  setupDownloadButton();

  // Start loading the ML model in background
  await initializeModel();
}

// Initialize ML model
async function initializeModel(): Promise<void> {
  showLoading();

  try {
    const result = await loadModel((progress) => {
      updateProgress(progress);
    });

    if (result.success) {
      state.modelReady = true;
      showSuccess();
      console.log('[PII Anonymizer] ML model loaded successfully');
    } else if (result.fallbackMode) {
      state.modelReady = false;
      showFallbackMode();
      // Use log instead of warn to reduce console noise
      console.log('[PII Anonymizer] Using regex-only mode (ML model not available in this environment)');
    } else {
      state.modelReady = false;
      showError(result.error || 'Failed to load model');
      console.error('[PII Anonymizer] Model loading failed:', result.error);
    }
  } catch (error) {
    state.modelReady = false;
    const message = error instanceof Error ? error.message : 'Unknown error';
    showFallbackMode(); // Show fallback instead of error - app still works
    console.log('[PII Anonymizer] Using regex-only mode (ML model not available)');
  }

  updateProcessButton();
}

// Handle cancel model loading
function handleCancelModelLoad(): void {
  cancelLoading();
  state.modelReady = false;
  console.log('Model loading cancelled');
}

// Setup file upload zone
function setupUploadZone() {
  // Click to select files
  uploadZone.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput.click();
  });

  // File input change
  fileInput.addEventListener('change', () => {
    if (fileInput.files) {
      addFiles(Array.from(fileInput.files));
      fileInput.value = ''; // Reset for future selections
    }
  });

  // Drag and drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('upload-zone-active');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('upload-zone-active');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('upload-zone-active');

    if (e.dataTransfer?.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  });
}

// Add files to the list
function addFiles(files: File[]) {
  for (const file of files) {
    if (!isSupported(file)) {
      console.warn(`Unsupported file: ${file.name}`);
      continue;
    }

    const id = `${file.name}-${Date.now()}`;
    const fileInfo: FileInfo = {
      id,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending',
      progress: 0,
    };

    state.files.set(id, fileInfo);
  }

  renderFileList();
}

// Render file list
function renderFileList() {
  if (state.files.size === 0) {
    fileList.classList.add('hidden');
    return;
  }

  fileList.classList.remove('hidden');
  filesContainer.innerHTML = '';

  for (const [id, fileInfo] of state.files) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.innerHTML = `
      <div class="file-item-icon">
        ${getFileIcon(fileInfo.name)}
      </div>
      <div class="file-item-info">
        <div class="file-item-name">${fileInfo.name}</div>
        <div class="file-item-size">${formatFileSize(fileInfo.size)}</div>
      </div>
      <button class="file-item-remove" data-id="${id}" title="Remove file">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;

    // Remove button handler
    fileItem.querySelector('.file-item-remove')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = (e.currentTarget as HTMLElement).dataset.id;
      if (targetId) {
        state.files.delete(targetId);
        renderFileList();
      }
    });

    filesContainer.appendChild(fileItem);
  }

  updateProcessButton();
}

// Get file icon based on extension
function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const icons: Record<string, string> = {
    pdf: '<svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6h-4V2H4v16zm8-14h4l-4-4v4z"/></svg>',
    docx: '<svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6h-4V2H4v16zm8-14h4l-4-4v4z"/></svg>',
    xlsx: '<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6h-4V2H4v16zm8-14h4l-4-4v4z"/></svg>',
    csv: '<svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6h-4V2H4v16zm8-14h4l-4-4v4z"/></svg>',
    txt: '<svg class="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6h-4V2H4v16zm8-14h4l-4-4v4z"/></svg>',
    md: '<svg class="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6h-4V2H4v16zm8-14h4l-4-4v4z"/></svg>',
  };
  return icons[ext || ''] || icons.txt;
}

// Setup process button
function setupProcessButton() {
  processBtn.addEventListener('click', processFiles);
}

// Update process button state
function updateProcessButton() {
  const modelStatus = getModelStatus();
  const canProcess = state.files.size > 0 && !state.isProcessing && !modelStatus.loading;

  processBtn.disabled = !canProcess;

  if (state.isProcessing) {
    processBtn.textContent = 'Processing...';
  } else if (modelStatus.loading) {
    processBtn.textContent = 'Loading Model...';
  } else {
    const modeText = isFallbackMode() ? ' (Regex Only)' : '';
    processBtn.textContent = `Process ${state.files.size} File${state.files.size !== 1 ? 's' : ''}${modeText}`;
  }
}

// Process all files
async function processFiles() {
  if (state.isProcessing || state.files.size === 0) return;

  state.isProcessing = true;
  state.results.clear();
  updateProcessButton();

  // Show processing status
  processingStatus.classList.remove('hidden');
  processingContainer.innerHTML = '';

  // Create progress elements for each file
  const progressElements = new Map<string, HTMLElement>();
  for (const [id, fileInfo] of state.files) {
    const progressItem = document.createElement('div');
    progressItem.className = 'bg-white p-3 rounded-lg border border-gray-200';
    progressItem.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <span class="text-sm font-medium text-gray-700 truncate flex-1">${fileInfo.name}</span>
        <span class="text-xs text-gray-500 ml-2 status-text">Waiting...</span>
      </div>
      <div class="progress-bar">
        <div class="progress-bar-fill" style="width: 0%"></div>
      </div>
    `;
    processingContainer.appendChild(progressItem);
    progressElements.set(id, progressItem);
  }

  // Process each file
  for (const [id, fileInfo] of state.files) {
    const progressElement = progressElements.get(id)!;
    const progressBar = progressElement.querySelector('.progress-bar-fill') as HTMLElement;
    const statusText = progressElement.querySelector('.status-text') as HTMLElement;

    try {
      const result = await processor.processFile(fileInfo.file, (progress, status) => {
        progressBar.style.width = `${progress}%`;
        statusText.textContent = status;
      });

      state.results.set(fileInfo.name, result);
      progressBar.classList.add('success');
      statusText.textContent = `Done - ${result.piiMatches.length} PII found`;
    } catch (error) {
      console.error(`Error processing ${fileInfo.name}:`, error);
      progressBar.classList.add('error');
      statusText.textContent = `Error: ${(error as Error).message}`;
    }
  }

  state.isProcessing = false;
  updateProcessButton();

  // Show results
  renderResults();
}

// Render results
function renderResults() {
  if (state.results.size === 0) {
    resultsSection.classList.add('hidden');
    piiSummary.classList.add('hidden');
    return;
  }

  resultsSection.classList.remove('hidden');
  resultsContainer.innerHTML = '';

  // Aggregate PII stats
  const totalStats: Record<string, number> = {};

  for (const [filename, result] of state.results) {
    // Aggregate stats
    for (const [type, count] of Object.entries(result.stats)) {
      totalStats[type] = (totalStats[type] || 0) + count;
    }

    // Create result card
    const card = document.createElement('div');
    card.className = 'result-card';
    card.innerHTML = `
      <div class="result-card-header">
        <span class="font-medium text-gray-800">${filename}</span>
        <div class="flex gap-2">
          <button class="text-sm text-blue-600 hover:text-blue-800 download-md" data-filename="${filename}">
            Download MD
          </button>
          <button class="text-sm text-green-600 hover:text-green-800 download-mapping" data-filename="${filename}">
            Download Mapping
          </button>
        </div>
      </div>
      <div class="result-card-body">
        <div class="mb-3">
          <span class="text-xs font-semibold text-gray-500 uppercase">PII Detected</span>
          <div class="flex flex-wrap gap-2 mt-1">
            ${Object.entries(result.stats)
              .map(([type, count]) => `
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                  ${type}: ${count}
                </span>
              `)
              .join('')}
            ${Object.keys(result.stats).length === 0 ? '<span class="text-sm text-gray-500">None</span>' : ''}
          </div>
        </div>
        <details class="mt-2">
          <summary class="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
            Preview anonymized content
          </summary>
          <pre class="mt-2 text-xs max-h-48 overflow-auto bg-gray-50 p-2 rounded">${escapeHtml(result.anonymizedMarkdown.slice(0, 2000))}${result.anonymizedMarkdown.length > 2000 ? '...' : ''}</pre>
        </details>
      </div>
    `;

    // Download handlers
    card.querySelector('.download-md')?.addEventListener('click', () => {
      const anonymizedFilename = filename.replace(/\.[^.]+$/, '_anonymized.md');
      downloadFile(result.anonymizedMarkdown, anonymizedFilename);
    });

    card.querySelector('.download-mapping')?.addEventListener('click', () => {
      const mappingFilename = filename.replace(/\.[^.]+$/, '_mapping.md');
      const mappingContent = generateMappingMarkdown(filename, result);
      downloadFile(mappingContent, mappingFilename);
    });

    resultsContainer.appendChild(card);
  }

  // Show PII summary
  if (Object.keys(totalStats).length > 0) {
    piiSummary.classList.remove('hidden');
    piiStats.innerHTML = Object.entries(totalStats)
      .map(([type, count]) => `
        <div class="bg-white p-2 rounded border border-amber-200 text-center">
          <div class="text-lg font-bold text-amber-800">${count}</div>
          <div class="text-xs text-amber-600">${type}</div>
        </div>
      `)
      .join('');
  } else {
    piiSummary.classList.add('hidden');
  }
}

// Setup download all button
function setupDownloadButton() {
  downloadAllBtn.addEventListener('click', async () => {
    if (state.results.size === 0) return;

    const files = new Map<string, string>();

    for (const [filename, result] of state.results) {
      const anonymizedFilename = filename.replace(/\.[^.]+$/, '_anonymized.md');
      files.set(anonymizedFilename, result.anonymizedMarkdown);

      const mappingFilename = filename.replace(/\.[^.]+$/, '_mapping.md');
      files.set(mappingFilename, generateMappingMarkdown(filename, result));
    }

    await downloadZip(files, 'anonymized-documents.zip');
  });
}

// Generate mapping markdown for a single file
function generateMappingMarkdown(filename: string, result: ProcessingResult): string {
  const lines = [
    `# PII Mapping: ${filename}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Detected PII',
    '',
  ];

  if (result.mappingTable.length === 0) {
    lines.push('No PII detected in this document.');
  } else {
    lines.push('| Original | Replacement | Type | Occurrences |');
    lines.push('| -------- | ----------- | ---- | ----------- |');

    for (const entry of result.mappingTable) {
      const escapedOriginal = entry.original.replace(/\|/g, '\\|');
      lines.push(
        `| ${escapedOriginal} | ${entry.replacement} | ${entry.type} | ${entry.occurrences} |`
      );
    }
  }

  lines.push('');
  lines.push('## Statistics');
  lines.push('');

  for (const [type, count] of Object.entries(result.stats)) {
    lines.push(`- **${type}**: ${count}`);
  }

  return lines.join('\n');
}

// Escape HTML for display
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Start the application
init();
