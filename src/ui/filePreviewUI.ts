/**
 * File Preview UI Module
 *
 * Handles the user interface for file preview and metadata display.
 * Integrates with the existing renderer.js
 */

import type { FileMetadata, FileMetadataError } from '../types/fileMetadata.js';
import type { FilePreview, FilePreviewError } from '../types/filePreview.js';
import type { BatchQueueItem } from '../types/batchQueue.js';

/**
 * File Preview UI Manager
 */
export class FilePreviewUI {
  private metadataPanel: HTMLElement | null = null;
  private previewPanel: HTMLElement | null = null;
  private queueList: HTMLElement | null = null;
  private selectedFiles: Map<string, BatchQueueItem> = new Map();

  /**
   * Initialize the UI
   */
  initialize(): void {
    this.createMetadataPanel();
    this.createPreviewPanel();
    this.createQueuePanel();
    this.setupEventListeners();
  }

  /**
   * Create metadata display panel
   */
  private createMetadataPanel(): void {
    const existingPanel = document.getElementById('file-metadata-panel');

    if (existingPanel) {
      this.metadataPanel = existingPanel;
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'file-metadata-panel';
    panel.className = 'card p-4 mb-4 hidden';
    panel.innerHTML = `
      <h3 class="text-lg font-semibold mb-3">File Information</h3>
      <div class="space-y-2">
        <div class="flex justify-between">
          <span class="metadata-label">Filename:</span>
          <span class="metadata-value" id="meta-filename">-</span>
        </div>
        <div class="flex justify-between">
          <span class="metadata-label">File Size:</span>
          <span class="metadata-value" id="meta-filesize">-</span>
        </div>
        <div class="flex justify-between">
          <span class="metadata-label">Last Modified:</span>
          <span class="metadata-value" id="meta-modified">-</span>
        </div>
        <div class="flex justify-between">
          <span class="metadata-label">Lines:</span>
          <span class="metadata-value" id="meta-lines">-</span>
        </div>
        <div class="flex justify-between">
          <span class="metadata-label">Words:</span>
          <span class="metadata-value" id="meta-words">-</span>
        </div>
        <div class="flex justify-between">
          <span class="metadata-label">Characters:</span>
          <span class="metadata-value" id="meta-chars">-</span>
        </div>
      </div>
    `;

    this.metadataPanel = panel;

    // Insert after drop zone
    const dropZone = document.getElementById('drop-zone');
    if (dropZone && dropZone.parentNode) {
      dropZone.parentNode.insertBefore(panel, dropZone.nextSibling);
    }
  }

  /**
   * Create preview display panel
   */
  private createPreviewPanel(): void {
    const existingPanel = document.getElementById('file-preview-panel');

    if (existingPanel) {
      this.previewPanel = existingPanel;
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'file-preview-panel';
    panel.className = 'card p-4 mb-4 hidden';
    panel.innerHTML = `
      <h3 class="text-lg font-semibold mb-3">Content Preview</h3>
      <div class="bg-gray-50 rounded p-3 font-mono text-sm whitespace-pre-wrap overflow-y-auto max-h-64" id="preview-content">
        No preview available
      </div>
      <div class="mt-2 text-xs text-gray-500" id="preview-info"></div>
    `;

    this.previewPanel = panel;

    // Insert after metadata panel
    if (this.metadataPanel && this.metadataPanel.parentNode) {
      this.metadataPanel.parentNode.insertBefore(
        panel,
        this.metadataPanel.nextSibling
      );
    }
  }

  /**
   * Create batch queue panel
   */
  private createQueuePanel(): void {
    const existingPanel = document.getElementById('batch-queue-panel');

    if (existingPanel) {
      this.queueList = existingPanel.querySelector('#queue-list');
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'batch-queue-panel';
    panel.className = 'card p-4 mb-4 hidden';
    panel.innerHTML = `
      <h3 class="text-lg font-semibold mb-3">Batch Queue (<span id="queue-count">0</span> files)</h3>
      <div id="queue-list" class="space-y-2 max-h-48 overflow-y-auto">
        <!-- Queue items will be added here -->
      </div>
      <div class="mt-3 flex gap-2">
        <button id="clear-queue-btn" class="btn-secondary text-sm">Clear Queue</button>
      </div>
    `;

    this.queueList = panel.querySelector('#queue-list');

    // Insert after preview panel
    if (this.previewPanel && this.previewPanel.parentNode) {
      this.previewPanel.parentNode.insertBefore(
        panel,
        this.previewPanel.nextSibling
      );
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    const clearQueueBtn = document.getElementById('clear-queue-btn');
    if (clearQueueBtn) {
      clearQueueBtn.addEventListener('click', () => this.clearQueue());
    }
  }

  /**
   * Display file metadata
   */
  displayMetadata(metadata: FileMetadata): void {
    if (!this.metadataPanel) return;

    document.getElementById('meta-filename')!.textContent = metadata.filename;
    document.getElementById('meta-filesize')!.textContent = metadata.fileSizeFormatted;
    document.getElementById('meta-modified')!.textContent = metadata.lastModifiedFormatted;
    document.getElementById('meta-lines')!.textContent = metadata.lineCount.toString();
    document.getElementById('meta-words')!.textContent = metadata.wordCount.toString();
    document.getElementById('meta-chars')!.textContent = metadata.charCount.toString();

    this.metadataPanel.classList.remove('hidden');
  }

  /**
   * Display file preview
   */
  displayPreview(preview: FilePreview): void {
    if (!this.previewPanel) return;

    const contentEl = document.getElementById('preview-content');
    const infoEl = document.getElementById('preview-info');

    if (contentEl) {
      contentEl.textContent = preview.content || '(Empty file)';
    }

    if (infoEl) {
      const info = preview.isTruncated
        ? `Showing first ${preview.previewLineCount} lines (${preview.previewCharCount} characters)`
        : `Full content (${preview.previewLineCount} lines, ${preview.previewCharCount} characters)`;

      infoEl.textContent = info;
    }

    this.previewPanel.classList.remove('hidden');
  }

  /**
   * Display error message
   */
  displayError(message: string): void {
    const statusDiv = document.getElementById('status');
    if (statusDiv) {
      statusDiv.innerHTML = `<p class="text-red-600">⚠️ ${message}</p>`;
      statusDiv.classList.remove('hidden');
    }
  }

  /**
   * Add file to batch queue UI
   */
  addToQueue(item: BatchQueueItem): void {
    if (!this.queueList) return;

    this.selectedFiles.set(item.id, item);

    const queueItem = document.createElement('div');
    queueItem.id = `queue-item-${item.id}`;
    queueItem.className = 'flex items-center justify-between p-2 rounded hover:bg-gray-100 cursor-pointer border border-transparent';
    queueItem.innerHTML = `
      <div class="flex-1">
        <div class="font-medium text-sm">${item.filename}</div>
        <div class="text-xs text-gray-500" id="queue-meta-${item.id}">Loading metadata...</div>
      </div>
      <button class="text-red-600 hover:text-red-800 text-sm" onclick="window.filePreviewUI.removeFromQueue('${item.id}')">
        ✕
      </button>
    `;

    queueItem.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).tagName !== 'BUTTON') {
        this.selectQueueItem(item.id);
      }
    });

    this.queueList.appendChild(queueItem);

    this.updateQueueCount();
    this.showQueuePanel();
  }

  /**
   * Update queue item metadata display
   */
  updateQueueItemMetadata(itemId: string, metadata: { lineCount: number; wordCount: number }): void {
    const metaEl = document.getElementById(`queue-meta-${itemId}`);
    if (metaEl) {
      metaEl.textContent = `${metadata.lineCount} lines, ${metadata.wordCount} words`;
    }
  }

  /**
   * Remove file from batch queue UI
   */
  removeFromQueue(itemId: string): void {
    const queueItem = document.getElementById(`queue-item-${itemId}`);
    if (queueItem) {
      queueItem.remove();
    }

    this.selectedFiles.delete(itemId);
    this.updateQueueCount();

    if (this.selectedFiles.size === 0) {
      this.hideQueuePanel();
    }
  }

  /**
   * Clear all files from queue
   */
  clearQueue(): void {
    if (!this.queueList) return;

    this.queueList.innerHTML = '';
    this.selectedFiles.clear();
    this.updateQueueCount();
    this.hideQueuePanel();
  }

  /**
   * Select a queue item
   */
  selectQueueItem(itemId: string): void {
    // Remove previous selection
    document.querySelectorAll('.queue-item-selected').forEach((el) => {
      el.classList.remove('queue-item-selected', 'border-primary-500', 'bg-primary-50');
    });

    // Add selection to clicked item
    const queueItem = document.getElementById(`queue-item-${itemId}`);
    if (queueItem) {
      queueItem.classList.add('queue-item-selected', 'border-primary-500', 'bg-primary-50');
    }

    // Trigger metadata/preview load for this item
    const item = this.selectedFiles.get(itemId);
    if (item) {
      this.loadFileInfo(item.filePath);
    }
  }

  /**
   * Load file information (metadata + preview)
   */
  async loadFileInfo(filePath: string): Promise<void> {
    try {
      // Load metadata
      const metadata = await window.electronAPI.getFileMetadata(filePath);

      if ('error' in metadata) {
        this.displayError(metadata.error);
        return;
      }

      this.displayMetadata(metadata);

      // Load preview
      const preview = await window.electronAPI.getFilePreview(filePath, {
        lines: 20,
        chars: 1000,
      });

      if ('error' in preview) {
        this.displayError(preview.error || 'Failed to generate preview');
        return;
      }

      this.displayPreview(preview);
    } catch (error: any) {
      this.displayError(error.message || 'Failed to load file information');
    }
  }

  /**
   * Update queue count display
   */
  private updateQueueCount(): void {
    const countEl = document.getElementById('queue-count');
    if (countEl) {
      countEl.textContent = this.selectedFiles.size.toString();
    }
  }

  /**
   * Show queue panel
   */
  private showQueuePanel(): void {
    const panel = document.getElementById('batch-queue-panel');
    if (panel) {
      panel.classList.remove('hidden');
    }
  }

  /**
   * Hide queue panel
   */
  private hideQueuePanel(): void {
    const panel = document.getElementById('batch-queue-panel');
    if (panel) {
      panel.classList.add('hidden');
    }
  }
}

// Export singleton instance
export const filePreviewUI = new FilePreviewUI();
