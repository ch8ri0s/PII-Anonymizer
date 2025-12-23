/**
 * Batch Panel Component
 *
 * Displays file queue with status indicators, progress bars,
 * and batch processing controls.
 *
 * Story 7.5: File Download & Batch Processing - AC #3, #5
 */

import type { BatchItem, BatchFileStatus, BatchProgress, BatchQueueState } from '../batch/BatchQueueManager';
import { formatFileSize } from '../utils/download';

/**
 * Status indicator icons
 */
const STATUS_ICONS: Record<BatchFileStatus, string> = {
  pending: '\u23F3', // Hourglass
  processing: '\u2699\uFE0F', // Gear
  completed: '\u2705', // Check
  failed: '\u274C', // X
};

/**
 * Status indicator colors (Tailwind classes)
 */
const STATUS_COLORS: Record<BatchFileStatus, string> = {
  pending: 'text-gray-500',
  processing: 'text-blue-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
};

/**
 * Batch panel configuration
 */
export interface BatchPanelConfig {
  onProcess?: () => void;
  onCancel?: () => void;
  onRetry?: (itemId: string) => void;
  onRetryAll?: () => void;
  onRemove?: (itemId: string) => void;
  onClear?: () => void;
  onDownloadItem?: (item: BatchItem) => void;
  onDownloadAll?: () => void;
}

/**
 * Batch panel state
 */
interface BatchPanelState {
  initialized: boolean;
  items: BatchItem[];
  queueStatus: BatchQueueState['status'];
  progress: BatchProgress | null;
}

// Module state
let state: BatchPanelState = {
  initialized: false,
  items: [],
  queueStatus: 'idle',
  progress: null,
};

let config: BatchPanelConfig = {};
let panelContainer: HTMLElement | null = null;

/**
 * CSS for batch panel
 */
const BATCH_PANEL_CSS = `
  .batch-panel {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .batch-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .batch-panel-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: #374151;
  }

  .batch-panel-count {
    font-size: 0.75rem;
    color: #6b7280;
    background: #e5e7eb;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
  }

  .batch-panel-list {
    max-height: 300px;
    overflow-y: auto;
  }

  .batch-panel-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    transition: background-color 0.15s;
  }

  .batch-panel-item:hover {
    background: #f9fafb;
  }

  .batch-panel-item:last-child {
    border-bottom: none;
  }

  .batch-item-status {
    font-size: 1rem;
    flex-shrink: 0;
  }

  .batch-item-info {
    flex: 1;
    min-width: 0;
  }

  .batch-item-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2937;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .batch-item-meta {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .batch-item-error {
    font-size: 0.75rem;
    color: #dc2626;
    margin-top: 0.25rem;
  }

  .batch-item-progress {
    width: 60px;
    height: 4px;
    background: #e5e7eb;
    border-radius: 2px;
    overflow: hidden;
  }

  .batch-item-progress-bar {
    height: 100%;
    background: #2563eb;
    transition: width 0.2s;
  }

  .batch-item-progress-bar.completed {
    background: #16a34a;
  }

  .batch-item-progress-bar.failed {
    background: #dc2626;
  }

  .batch-item-actions {
    display: flex;
    gap: 0.25rem;
    flex-shrink: 0;
  }

  .batch-item-actions button {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    background: white;
    color: #374151;
    cursor: pointer;
    transition: all 0.15s;
  }

  .batch-item-actions button:hover {
    background: #f3f4f6;
  }

  .batch-item-actions button.btn-danger {
    border-color: #fecaca;
    color: #dc2626;
  }

  .batch-item-actions button.btn-danger:hover {
    background: #fef2f2;
  }

  .batch-panel-progress {
    padding: 0.75rem 1rem;
    background: #f0f9ff;
    border-top: 1px solid #e0f2fe;
  }

  .batch-progress-text {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: #0369a1;
    margin-bottom: 0.5rem;
  }

  .batch-progress-bar {
    height: 6px;
    background: #bae6fd;
    border-radius: 3px;
    overflow: hidden;
  }

  .batch-progress-fill {
    height: 100%;
    background: #0284c7;
    transition: width 0.3s;
  }

  .batch-panel-footer {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border-top: 1px solid #e5e7eb;
  }

  .batch-panel-footer button {
    flex: 1;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.15s;
  }

  .batch-panel-footer .btn-primary {
    background: #2563eb;
    color: white;
    border: none;
  }

  .batch-panel-footer .btn-primary:hover:not(:disabled) {
    background: #1d4ed8;
  }

  .batch-panel-footer .btn-primary:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .batch-panel-footer .btn-secondary {
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .batch-panel-footer .btn-secondary:hover:not(:disabled) {
    background: #f3f4f6;
  }

  .batch-panel-footer .btn-danger {
    background: white;
    color: #dc2626;
    border: 1px solid #fecaca;
  }

  .batch-panel-footer .btn-danger:hover:not(:disabled) {
    background: #fef2f2;
  }

  .batch-panel-empty {
    padding: 2rem;
    text-align: center;
    color: #6b7280;
  }

  .batch-panel-empty-icon {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }
`;

/**
 * Initialize the batch panel
 */
export function initBatchPanel(
  container: HTMLElement,
  panelConfig: BatchPanelConfig = {},
): void {
  if (state.initialized) {
    destroyBatchPanel();
  }

  config = panelConfig;
  panelContainer = container;

  // Inject CSS
  if (!document.getElementById('batch-panel-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'batch-panel-styles';
    styleSheet.textContent = BATCH_PANEL_CSS;
    document.head.appendChild(styleSheet);
  }

  renderPanel();
  state.initialized = true;
}

/**
 * Render the complete panel
 */
function renderPanel(): void {
  if (!panelContainer) return;

  const { items, queueStatus, progress } = state;
  const hasItems = items.length > 0;
  const isProcessing = queueStatus === 'processing';
  const hasFailures = items.some(i => i.status === 'failed');
  const hasCompleted = items.some(i => i.status === 'completed');
  const allComplete = hasItems && items.every(i => i.status === 'completed' || i.status === 'failed');

  panelContainer.innerHTML = `
    <div class="batch-panel">
      <div class="batch-panel-header">
        <span class="batch-panel-title">Batch Queue</span>
        <span class="batch-panel-count">${items.length} file${items.length !== 1 ? 's' : ''}</span>
      </div>

      <div class="batch-panel-list" id="batch-list">
        ${hasItems ? renderItemList() : renderEmptyState()}
      </div>

      ${isProcessing && progress ? renderProgressBar() : ''}

      <div class="batch-panel-footer">
        ${renderFooterButtons(hasItems, isProcessing, hasFailures, hasCompleted, allComplete)}
      </div>
    </div>
  `;

  // Attach event handlers
  attachEventHandlers();
}

/**
 * Render the item list
 */
function renderItemList(): string {
  return state.items.map(item => renderItem(item)).join('');
}

/**
 * Render a single item
 */
function renderItem(item: BatchItem): string {
  const statusIcon = STATUS_ICONS[item.status];
  const statusColor = STATUS_COLORS[item.status];
  const showProgress = item.status === 'processing';
  const showError = item.status === 'failed' && item.error;
  const canRetry = item.status === 'failed';
  const canRemove = item.status !== 'processing';
  const canDownload = item.status === 'completed' && item.result;

  return `
    <div class="batch-panel-item" data-item-id="${item.id}">
      <span class="batch-item-status ${statusColor}">${statusIcon}</span>
      <div class="batch-item-info">
        <div class="batch-item-name" title="${escapeHtml(item.filename)}">${escapeHtml(item.filename)}</div>
        <div class="batch-item-meta">
          ${item.file.size ? formatFileSize(item.file.size) : ''}
          ${item.status === 'completed' ? ' - Done' : ''}
          ${item.status === 'processing' ? ` - ${item.progress}%` : ''}
        </div>
        ${showError ? `<div class="batch-item-error">${escapeHtml(item.error || '')}</div>` : ''}
      </div>
      ${showProgress ? `
        <div class="batch-item-progress">
          <div class="batch-item-progress-bar ${item.status}" style="width: ${item.progress}%"></div>
        </div>
      ` : ''}
      <div class="batch-item-actions">
        ${canDownload ? `<button class="btn-download" data-action="download" data-id="${item.id}">Download</button>` : ''}
        ${canRetry ? `<button class="btn-retry" data-action="retry" data-id="${item.id}">Retry</button>` : ''}
        ${canRemove ? `<button class="btn-danger btn-remove" data-action="remove" data-id="${item.id}">\u2715</button>` : ''}
      </div>
    </div>
  `;
}

/**
 * Render empty state
 */
function renderEmptyState(): string {
  return `
    <div class="batch-panel-empty">
      <div class="batch-panel-empty-icon">\uD83D\uDCC2</div>
      <div>No files in queue</div>
      <div style="font-size: 0.75rem; margin-top: 0.5rem;">Upload files to begin batch processing</div>
    </div>
  `;
}

/**
 * Render progress bar
 */
function renderProgressBar(): string {
  const { progress } = state;
  if (!progress) return '';

  return `
    <div class="batch-panel-progress">
      <div class="batch-progress-text">
        <span>Processing: ${escapeHtml(progress.currentFile)}</span>
        <span>${progress.currentIndex + 1} of ${progress.totalFiles}</span>
      </div>
      <div class="batch-progress-bar">
        <div class="batch-progress-fill" style="width: ${progress.overallProgress}%"></div>
      </div>
    </div>
  `;
}

/**
 * Render footer buttons
 */
function renderFooterButtons(
  hasItems: boolean,
  isProcessing: boolean,
  hasFailures: boolean,
  hasCompleted: boolean,
  allComplete: boolean,
): string {
  if (isProcessing) {
    return `
      <button class="btn-danger" id="cancel-btn">Cancel</button>
    `;
  }

  if (allComplete && hasCompleted) {
    return `
      ${hasFailures ? '<button class="btn-secondary" id="retry-all-btn">Retry Failed</button>' : ''}
      <button class="btn-primary" id="download-all-btn">Download All (ZIP)</button>
      <button class="btn-secondary" id="clear-btn">Clear</button>
    `;
  }

  return `
    <button class="btn-secondary" id="clear-btn" ${!hasItems ? 'disabled' : ''}>Clear</button>
    <button class="btn-primary" id="process-btn" ${!hasItems ? 'disabled' : ''}>Process All</button>
  `;
}

/**
 * Attach event handlers
 */
function attachEventHandlers(): void {
  if (!panelContainer) return;

  // Process button
  const processBtn = panelContainer.querySelector('#process-btn');
  processBtn?.addEventListener('click', () => config.onProcess?.());

  // Cancel button
  const cancelBtn = panelContainer.querySelector('#cancel-btn');
  cancelBtn?.addEventListener('click', () => config.onCancel?.());

  // Clear button
  const clearBtn = panelContainer.querySelector('#clear-btn');
  clearBtn?.addEventListener('click', () => config.onClear?.());

  // Download All button
  const downloadAllBtn = panelContainer.querySelector('#download-all-btn');
  downloadAllBtn?.addEventListener('click', () => config.onDownloadAll?.());

  // Retry All button
  const retryAllBtn = panelContainer.querySelector('#retry-all-btn');
  retryAllBtn?.addEventListener('click', () => config.onRetryAll?.());

  // Item action buttons (using event delegation)
  const batchList = panelContainer.querySelector('#batch-list');
  batchList?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;
    const id = target.dataset.id;

    if (!action || !id) return;

    switch (action) {
      case 'retry':
        config.onRetry?.(id);
        break;
      case 'remove':
        config.onRemove?.(id);
        break;
      case 'download': {
        const item = state.items.find(i => i.id === id);
        if (item) config.onDownloadItem?.(item);
        break;
      }
    }
  });
}

/**
 * Update the panel with new state
 */
export function updateBatchPanel(
  items: BatchItem[],
  queueStatus: BatchQueueState['status'],
  progress?: BatchProgress | null,
): void {
  state.items = items;
  state.queueStatus = queueStatus;
  state.progress = progress || null;

  renderPanel();
}

/**
 * Update a single item
 */
export function updateBatchItem(item: BatchItem): void {
  const index = state.items.findIndex(i => i.id === item.id);
  if (index !== -1) {
    state.items[index] = item;
    renderPanel();
  }
}

/**
 * Set progress
 */
export function setBatchProgress(progress: BatchProgress | null): void {
  state.progress = progress;
  renderPanel();
}

/**
 * Get current items
 */
export function getBatchPanelItems(): BatchItem[] {
  return [...state.items];
}

/**
 * Check if panel is initialized
 */
export function isBatchPanelInitialized(): boolean {
  return state.initialized;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Destroy the batch panel
 */
export function destroyBatchPanel(): void {
  if (panelContainer) {
    panelContainer.innerHTML = '';
  }

  state = {
    initialized: false,
    items: [],
    queueStatus: 'idle',
    progress: null,
  };

  config = {};
  panelContainer = null;
}
