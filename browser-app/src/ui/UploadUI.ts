/**
 * Upload UI Module
 *
 * Handles file upload zone, file list display, and process button.
 */

import type { FileInfo } from '../types';
import { isSupported } from '../converters';
import { createLogger } from '../utils/logger';

// Logger for upload UI
const log = createLogger('ui:upload');

export interface UploadUIConfig {
  onFilesChange?: (files: Map<string, FileInfo>) => void;
  onProcess?: (files: Map<string, FileInfo>) => void;
}

// Module state
let config: UploadUIConfig = {};
const files = new Map<string, FileInfo>();

// DOM Elements
let uploadSection: HTMLElement | null = null;
let uploadZone: HTMLElement | null = null;
let fileInput: HTMLInputElement | null = null;
let fileList: HTMLElement | null = null;
let filesContainer: HTMLElement | null = null;
let processBtn: HTMLButtonElement | null = null;

/**
 * Initialize the upload UI
 */
export function initUploadUI(uploadConfig: UploadUIConfig = {}): void {
  config = uploadConfig;

  // Get DOM elements
  uploadSection = document.getElementById('upload-section');
  uploadZone = document.getElementById('upload-zone');
  fileInput = document.getElementById('file-input') as HTMLInputElement;
  fileList = document.getElementById('file-list');
  filesContainer = document.getElementById('files-container');
  processBtn = document.getElementById('process-btn') as HTMLButtonElement;

  if (!uploadZone || !fileInput) {
    log.error('Required elements not found');
    return;
  }

  setupEventHandlers();
}

/**
 * Setup event handlers for upload zone
 */
function setupEventHandlers(): void {
  if (!uploadZone || !fileInput || !processBtn) return;

  // Click to select files
  uploadZone.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    fileInput?.click();
  });

  // File input change
  fileInput.addEventListener('change', () => {
    if (fileInput?.files) {
      addFiles(Array.from(fileInput.files));
      fileInput.value = '';
    }
  });

  // Drag and drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone?.classList.add('upload-zone-active');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone?.classList.remove('upload-zone-active');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone?.classList.remove('upload-zone-active');

    if (e.dataTransfer?.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  });

  // Process button
  processBtn.addEventListener('click', () => {
    if (files.size > 0) {
      config.onProcess?.(files);
    }
  });
}

/**
 * Add files to the list
 */
function addFiles(newFiles: File[]): void {
  for (const file of newFiles) {
    if (!isSupported(file)) {
      log.warn('Unsupported file', { fileName: file.name });
      continue;
    }

    const id = `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const fileInfo: FileInfo = {
      id,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'pending',
      progress: 0,
    };

    files.set(id, fileInfo);
  }

  renderFileList();
  config.onFilesChange?.(files);
}

/**
 * Render the file list
 */
function renderFileList(): void {
  if (!fileList || !filesContainer) return;

  if (files.size === 0) {
    fileList.classList.add('hidden');
    return;
  }

  fileList.classList.remove('hidden');
  filesContainer.innerHTML = '';

  for (const [id, fileInfo] of files) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.setAttribute('data-testid', 'file-item');
    fileItem.setAttribute('role', 'listitem');
    fileItem.innerHTML = `
      <div class="file-item-icon" aria-hidden="true">
        ${getFileIcon(fileInfo.name)}
      </div>
      <div class="file-item-info">
        <div class="file-item-name" data-testid="file-item-name">${escapeHtml(fileInfo.name)}</div>
        <div class="file-item-size" data-testid="file-item-size">${formatFileSize(fileInfo.size)}</div>
      </div>
      <button class="file-item-remove" data-testid="file-item-remove" data-id="${id}" title="Remove file" aria-label="Remove ${escapeHtml(fileInfo.name)}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;

    // Remove button handler
    fileItem.querySelector('.file-item-remove')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = (e.currentTarget as HTMLElement).dataset.id;
      if (targetId) {
        files.delete(targetId);
        renderFileList();
        config.onFilesChange?.(files);
      }
    });

    filesContainer.appendChild(fileItem);
  }
}

/**
 * Get file icon based on extension
 */
function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const icons: Record<string, string> = {
    pdf: '<svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6h-4V2H4v16zm8-14h4l-4-4v4z"/></svg>',
    docx: '<svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6h-4V2H4v16zm8-14h4l-4-4v4z"/></svg>',
    xlsx: '<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6h-4V2H4v16zm8-14h4l-4-4v4z"/></svg>',
    xls: '<svg class="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6h-4V2H4v16zm8-14h4l-4-4v4z"/></svg>',
    csv: '<svg class="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6h-4V2H4v16zm8-14h4l-4-4v4z"/></svg>',
    txt: '<svg class="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6h-4V2H4v16zm8-14h4l-4-4v4z"/></svg>',
    md: '<svg class="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20"><path d="M4 18h12V6h-4V2H4v16zm8-14h4l-4-4v4z"/></svg>',
  };
  return icons[ext || ''] || icons.txt;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Escape HTML for safe display
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Update process button state
 */
export function updateProcessButton(options: {
  disabled?: boolean;
  text?: string;
}): void {
  if (!processBtn) return;

  if (options.disabled !== undefined) {
    processBtn.disabled = options.disabled;
  }
  if (options.text !== undefined) {
    processBtn.textContent = options.text;
  }
}

/**
 * Show the upload section
 */
export function showUploadSection(): void {
  uploadSection?.classList.remove('hidden');
}

/**
 * Hide the upload section
 */
export function hideUploadSection(): void {
  uploadSection?.classList.add('hidden');
}

/**
 * Get current files
 */
export function getFiles(): Map<string, FileInfo> {
  return files;
}

/**
 * Clear all files
 */
export function clearFiles(): void {
  files.clear();
  renderFileList();
  config.onFilesChange?.(files);
}

/**
 * Get file count
 */
export function getFileCount(): number {
  return files.size;
}
