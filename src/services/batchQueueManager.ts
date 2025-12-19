/**
 * Batch Queue Manager
 *
 * Manages a queue of files for batch processing with:
 * - Add/remove items
 * - Sequential processing
 * - Progress tracking
 * - State persistence
 */

import type {
  BatchQueueItem,
  BatchQueueState,
  BatchFileStatus,
  BatchProgress,
} from '../types/batchQueue.js';

/**
 * Batch Queue Manager Class
 */
export class BatchQueueManager {
  private state: BatchQueueState;
  private onStateChangeCallback?: (state: BatchQueueState) => void;

  constructor() {
    this.state = {
      items: [],
      selectedItemId: null,
      batchStatus: 'idle',
      currentFileIndex: -1,
      totalFiles: 0,
      completedFiles: 0,
      failedFiles: 0,
    };
  }

  /**
   * Add a file to the queue
   */
  addFile(filePath: string, filename: string): string {
    const id = this.generateId();

    const item: BatchQueueItem = {
      id,
      filePath,
      filename,
      status: 'pending',
      addedAt: new Date(),
    };

    this.state.items.push(item);
    this.state.totalFiles = this.state.items.length;

    this.notifyStateChange();

    return id;
  }

  /**
   * Add multiple files to the queue
   */
  addFiles(files: Array<{ filePath: string; filename: string }>): string[] {
    const ids: string[] = [];

    for (const file of files) {
      const id = this.addFile(file.filePath, file.filename);
      ids.push(id);
    }

    return ids;
  }

  /**
   * Remove a file from the queue
   */
  removeFile(id: string): boolean {
    const index = this.state.items.findIndex((item) => item.id === id);

    if (index === -1) {
      return false;
    }

    // Don't remove if currently processing
    if (this.state.items[index]?.status === 'processing') {
      return false;
    }

    this.state.items.splice(index, 1);
    this.state.totalFiles = this.state.items.length;

    // Update selected item if removed
    if (this.state.selectedItemId === id) {
      this.state.selectedItemId =
        this.state.items.length > 0 ? (this.state.items[0]?.id || null) : null;
    }

    this.recalculateStats();
    this.notifyStateChange();

    return true;
  }

  /**
   * Clear all files from the queue
   */
  clearQueue(): void {
    // Don't clear if processing
    if (this.state.batchStatus === 'processing') {
      return;
    }

    this.state.items = [];
    this.state.selectedItemId = null;
    this.state.totalFiles = 0;
    this.state.completedFiles = 0;
    this.state.failedFiles = 0;
    this.state.currentFileIndex = -1;

    this.notifyStateChange();
  }

  /**
   * Select a file in the queue
   */
  selectFile(id: string): boolean {
    const item = this.state.items.find((item) => item.id === id);

    if (!item) {
      return false;
    }

    this.state.selectedItemId = id;
    this.notifyStateChange();

    return true;
  }

  /**
   * Get a specific queue item
   */
  getItem(id: string): BatchQueueItem | undefined {
    return this.state.items.find((item) => item.id === id);
  }

  /**
   * Get currently selected item
   */
  getSelectedItem(): BatchQueueItem | undefined {
    if (!this.state.selectedItemId) {
      return undefined;
    }

    return this.getItem(this.state.selectedItemId);
  }

  /**
   * Update item status
   */
  updateItemStatus(id: string, status: BatchFileStatus, error?: string): void {
    const item = this.state.items.find((item) => item.id === id);

    if (!item) {
      return;
    }

    item.status = status;

    if (status === 'processing') {
      item.startedAt = new Date();
    } else if (status === 'completed' || status === 'failed') {
      item.completedAt = new Date();
    }

    if (error) {
      item.error = error;
    }

    this.recalculateStats();
    this.notifyStateChange();
  }

  /**
   * Update item metadata
   */
  updateItemMetadata(
    id: string,
    metadata: {
      fileSize: number;
      fileSizeFormatted: string;
      lineCount: number;
      wordCount: number;
    },
  ): void {
    const item = this.state.items.find((item) => item.id === id);

    if (!item) {
      return;
    }

    item.metadata = metadata;
    this.notifyStateChange();
  }

  /**
   * Get current batch progress
   */
  getBatchProgress(): BatchProgress | null {
    if (this.state.currentFileIndex === -1) {
      return null;
    }

    const currentItem = this.state.items[this.state.currentFileIndex];

    if (!currentItem) {
      return null;
    }

    const overallProgress =
      this.state.totalFiles > 0
        ? Math.round((this.state.completedFiles / this.state.totalFiles) * 100)
        : 0;

    return {
      currentFile: this.state.currentFileIndex + 1, // 1-based
      totalFiles: this.state.totalFiles,
      currentFileProgress: 50, // Simplified - would be more granular in real implementation
      overallProgress,
      currentFilename: currentItem.filename,
    };
  }

  /**
   * Start batch processing
   */
  startBatchProcessing(): void {
    if (this.state.items.length === 0) {
      return;
    }

    if (this.state.batchStatus === 'processing') {
      return;
    }

    this.state.batchStatus = 'processing';
    this.state.currentFileIndex = 0;
    this.state.completedFiles = 0;
    this.state.failedFiles = 0;

    // Reset all item statuses
    this.state.items.forEach((item) => {
      item.status = 'pending';
      item.error = undefined;
      item.startedAt = undefined;
      item.completedAt = undefined;
    });

    this.notifyStateChange();
  }

  /**
   * Move to next file in batch
   */
  moveToNextFile(): boolean {
    if (this.state.currentFileIndex === -1) {
      return false;
    }

    this.state.currentFileIndex++;

    if (this.state.currentFileIndex >= this.state.totalFiles) {
      // Batch complete
      this.state.batchStatus = 'completed';
      this.state.currentFileIndex = -1;
      this.notifyStateChange();
      return false;
    }

    this.notifyStateChange();
    return true;
  }

  /**
   * Pause batch processing
   */
  pauseBatchProcessing(): void {
    if (this.state.batchStatus === 'processing') {
      this.state.batchStatus = 'paused';
      this.notifyStateChange();
    }
  }

  /**
   * Resume batch processing
   */
  resumeBatchProcessing(): void {
    if (this.state.batchStatus === 'paused') {
      this.state.batchStatus = 'processing';
      this.notifyStateChange();
    }
  }

  /**
   * Cancel batch processing
   */
  cancelBatchProcessing(): void {
    this.state.batchStatus = 'idle';
    this.state.currentFileIndex = -1;

    // Reset pending items
    this.state.items.forEach((item) => {
      if (item.status === 'pending' || item.status === 'processing') {
        item.status = 'pending';
      }
    });

    this.notifyStateChange();
  }

  /**
   * Get current queue state
   */
  getState(): BatchQueueState {
    return { ...this.state };
  }

  /**
   * Register state change callback
   */
  onStateChange(callback: (state: BatchQueueState) => void): void {
    this.onStateChangeCallback = callback;
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    } {
    return {
      total: this.state.totalFiles,
      pending: this.state.items.filter((item) => item.status === 'pending')
        .length,
      processing: this.state.items.filter(
        (item) => item.status === 'processing',
      ).length,
      completed: this.state.completedFiles,
      failed: this.state.failedFiles,
    };
  }

  /**
   * Generate unique ID for queue items
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Recalculate statistics
   */
  private recalculateStats(): void {
    this.state.completedFiles = this.state.items.filter(
      (item) => item.status === 'completed',
    ).length;

    this.state.failedFiles = this.state.items.filter(
      (item) => item.status === 'failed',
    ).length;
  }

  /**
   * Notify state change
   */
  private notifyStateChange(): void {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.getState());
    }
  }
}

/**
 * Singleton instance
 */
let batchQueueManager: BatchQueueManager | null = null;

/**
 * Get batch queue manager instance
 */
export function getBatchQueueManager(): BatchQueueManager {
  if (!batchQueueManager) {
    batchQueueManager = new BatchQueueManager();
  }

  return batchQueueManager;
}
