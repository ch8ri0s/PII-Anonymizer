/**
 * Batch Queue Manager (Browser Version)
 *
 * Manages a queue of files for batch processing with:
 * - Add/remove items
 * - Sequential/concurrent processing
 * - Progress tracking
 * - Error isolation
 *
 * Story 7.5: File Download & Batch Processing - AC #3, #5, #6
 */

import type { MappingEntry } from '../types';

/**
 * Batch file status
 */
export type BatchFileStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Batch item for queue management
 */
export interface BatchItem {
  id: string;
  file: File;
  filename: string;
  status: BatchFileStatus;
  progress: number; // 0-100
  addedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: {
    anonymizedContent: string;
    mapping: MappingEntry[];
  };
  error?: string;
}

/**
 * Batch progress event data
 */
export interface BatchProgress {
  currentIndex: number;
  totalFiles: number;
  currentFile: string;
  overallProgress: number; // 0-100
  currentFileProgress: number; // 0-100
}

/**
 * Batch queue state
 */
export interface BatchQueueState {
  items: BatchItem[];
  status: 'idle' | 'processing' | 'paused' | 'completed' | 'cancelled';
  currentIndex: number;
  totalFiles: number;
  completedCount: number;
  failedCount: number;
}

/**
 * Batch queue callbacks
 */
export interface BatchQueueCallbacks {
  onStateChange?: (state: BatchQueueState) => void;
  onProgress?: (progress: BatchProgress) => void;
  onItemComplete?: (item: BatchItem) => void;
  onItemError?: (item: BatchItem, error: Error) => void;
  onBatchComplete?: (results: BatchItem[]) => void;
}

/**
 * File processor function type
 */
export type FileProcessor = (
  file: File,
  onProgress?: (progress: number) => void
) => Promise<{ anonymizedContent: string; mapping: MappingEntry[] }>;

/**
 * Batch Queue Manager Class
 */
export class BatchQueueManager {
  private state: BatchQueueState;
  private callbacks: BatchQueueCallbacks;
  private processor: FileProcessor | null = null;
  private abortController: AbortController | null = null;
  // Future: configurable concurrency limit for parallel processing
  private _concurrencyLimit: number = 1;

  constructor(callbacks: BatchQueueCallbacks = {}) {
    this.callbacks = callbacks;
    this.state = this.createInitialState();
  }

  /**
   * Create initial state
   */
  private createInitialState(): BatchQueueState {
    return {
      items: [],
      status: 'idle',
      currentIndex: -1,
      totalFiles: 0,
      completedCount: 0,
      failedCount: 0,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set the file processor function
   */
  setProcessor(processor: FileProcessor): void {
    this.processor = processor;
  }

  /**
   * Get concurrency limit
   */
  getConcurrencyLimit(): number {
    return this._concurrencyLimit;
  }

  /**
   * Set concurrency limit
   */
  setConcurrencyLimit(limit: number): void {
    this._concurrencyLimit = Math.max(1, limit);
  }

  /**
   * Add files to the queue
   */
  addToQueue(files: File[]): BatchItem[] {
    const newItems: BatchItem[] = files.map(file => ({
      id: this.generateId(),
      file,
      filename: file.name,
      status: 'pending' as BatchFileStatus,
      progress: 0,
      addedAt: new Date(),
    }));

    this.state.items.push(...newItems);
    this.state.totalFiles = this.state.items.length;

    this.notifyStateChange();

    return newItems;
  }

  /**
   * Remove an item from the queue
   */
  removeFromQueue(id: string): boolean {
    const index = this.state.items.findIndex(item => item.id === id);

    if (index === -1) {
      return false;
    }

    // Don't remove if currently processing
    if (this.state.items[index].status === 'processing') {
      return false;
    }

    this.state.items.splice(index, 1);
    this.state.totalFiles = this.state.items.length;
    this.recalculateStats();
    this.notifyStateChange();

    return true;
  }

  /**
   * Clear all items from the queue
   */
  clearQueue(): void {
    // Don't clear if processing
    if (this.state.status === 'processing') {
      return;
    }

    this.state = this.createInitialState();
    this.notifyStateChange();
  }

  /**
   * Get an item by ID
   */
  getItem(id: string): BatchItem | undefined {
    return this.state.items.find(item => item.id === id);
  }

  /**
   * Get all items
   */
  getItems(): BatchItem[] {
    return [...this.state.items];
  }

  /**
   * Get completed items only
   */
  getCompletedItems(): BatchItem[] {
    return this.state.items.filter(item => item.status === 'completed');
  }

  /**
   * Get failed items only
   */
  getFailedItems(): BatchItem[] {
    return this.state.items.filter(item => item.status === 'failed');
  }

  /**
   * Get current state
   */
  getState(): BatchQueueState {
    return { ...this.state };
  }

  /**
   * Get current progress
   */
  getProgress(): BatchProgress | null {
    if (this.state.currentIndex === -1) {
      return null;
    }

    const currentItem = this.state.items[this.state.currentIndex];
    if (!currentItem) {
      return null;
    }

    const overallProgress =
      this.state.totalFiles > 0
        ? Math.round(
          ((this.state.completedCount + this.state.failedCount) / this.state.totalFiles) * 100,
        )
        : 0;

    return {
      currentIndex: this.state.currentIndex,
      totalFiles: this.state.totalFiles,
      currentFile: currentItem.filename,
      overallProgress,
      currentFileProgress: currentItem.progress,
    };
  }

  /**
   * Start processing the queue
   */
  async processQueue(): Promise<BatchItem[]> {
    if (!this.processor) {
      throw new Error('No processor set. Call setProcessor() first.');
    }

    if (this.state.items.length === 0) {
      return [];
    }

    if (this.state.status === 'processing') {
      throw new Error('Queue is already processing.');
    }

    this.abortController = new AbortController();
    this.state.status = 'processing';
    this.state.currentIndex = 0;
    this.state.completedCount = 0;
    this.state.failedCount = 0;

    // Reset all item statuses
    this.state.items.forEach(item => {
      item.status = 'pending';
      item.progress = 0;
      item.error = undefined;
      item.result = undefined;
      item.startedAt = undefined;
      item.completedAt = undefined;
    });

    this.notifyStateChange();

    // Process items sequentially
    for (let i = 0; i < this.state.items.length; i++) {
      if (this.abortController.signal.aborted) {
        break;
      }

      this.state.currentIndex = i;
      const item = this.state.items[i];

      await this.processItem(item);

      // Notify progress
      const progress = this.getProgress();
      if (progress) {
        this.callbacks.onProgress?.(progress);
      }
    }

    // Complete
    this.state.status = this.abortController.signal.aborted ? 'cancelled' : 'completed';
    this.state.currentIndex = -1;
    this.notifyStateChange();

    this.callbacks.onBatchComplete?.(this.state.items);

    return this.state.items;
  }

  /**
   * Process a single item
   */
  private async processItem(item: BatchItem): Promise<void> {
    item.status = 'processing';
    item.startedAt = new Date();
    item.progress = 0;
    this.notifyStateChange();

    try {
      // Guard: processor should always be set when processItem is called
      if (!this.processor) {
        throw new Error('Processor not set');
      }

      const result = await this.processor(
        item.file,
        (progress) => {
          item.progress = progress;
          this.notifyStateChange();

          const batchProgress = this.getProgress();
          if (batchProgress) {
            this.callbacks.onProgress?.(batchProgress);
          }
        },
      );

      item.status = 'completed';
      item.progress = 100;
      item.completedAt = new Date();
      item.result = result;
      this.state.completedCount++;

      this.callbacks.onItemComplete?.(item);
    } catch (error) {
      item.status = 'failed';
      item.progress = 0;
      item.completedAt = new Date();
      item.error = error instanceof Error ? error.message : String(error);
      this.state.failedCount++;

      this.callbacks.onItemError?.(item, error instanceof Error ? error : new Error(String(error)));
    }

    this.notifyStateChange();
  }

  /**
   * Pause processing
   */
  pause(): void {
    if (this.state.status === 'processing') {
      this.state.status = 'paused';
      this.notifyStateChange();
    }
  }

  /**
   * Resume processing
   */
  resume(): void {
    if (this.state.status === 'paused') {
      this.state.status = 'processing';
      this.notifyStateChange();
    }
  }

  /**
   * Cancel processing
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }

    this.state.status = 'cancelled';

    // Mark pending items as failed
    this.state.items.forEach(item => {
      if (item.status === 'pending' || item.status === 'processing') {
        item.status = 'pending';
        item.progress = 0;
      }
    });

    this.state.currentIndex = -1;
    this.notifyStateChange();
  }

  /**
   * Retry a failed item
   */
  async retryItem(id: string): Promise<BatchItem | null> {
    if (!this.processor) {
      throw new Error('No processor set.');
    }

    const item = this.state.items.find(i => i.id === id);
    if (!item || item.status !== 'failed') {
      return null;
    }

    // Reset item state
    item.status = 'pending';
    item.progress = 0;
    item.error = undefined;
    item.result = undefined;

    // Process the single item
    await this.processItem(item);

    this.recalculateStats();
    this.notifyStateChange();

    return item;
  }

  /**
   * Retry all failed items
   */
  async retryAllFailed(): Promise<BatchItem[]> {
    const failedItems = this.getFailedItems();

    for (const item of failedItems) {
      item.status = 'pending';
      item.progress = 0;
      item.error = undefined;
      item.result = undefined;
    }

    // Process all failed items
    for (const item of failedItems) {
      await this.processItem(item);
    }

    this.recalculateStats();
    this.notifyStateChange();

    return failedItems;
  }

  /**
   * Recalculate statistics
   */
  private recalculateStats(): void {
    this.state.completedCount = this.state.items.filter(
      item => item.status === 'completed',
    ).length;

    this.state.failedCount = this.state.items.filter(
      item => item.status === 'failed',
    ).length;
  }

  /**
   * Notify state change
   */
  private notifyStateChange(): void {
    this.callbacks.onStateChange?.(this.getState());
  }

  /**
   * Get statistics
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
      pending: this.state.items.filter(item => item.status === 'pending').length,
      processing: this.state.items.filter(item => item.status === 'processing').length,
      completed: this.state.completedCount,
      failed: this.state.failedCount,
    };
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.state.items.length === 0;
  }

  /**
   * Check if queue is processing
   */
  isProcessing(): boolean {
    return this.state.status === 'processing';
  }

  /**
   * Check if all items are complete (success or failure)
   */
  isComplete(): boolean {
    return this.state.items.every(
      item => item.status === 'completed' || item.status === 'failed',
    );
  }

  /**
   * Check if any items failed
   */
  hasFailures(): boolean {
    return this.state.failedCount > 0;
  }

  /**
   * Destroy the queue manager
   */
  destroy(): void {
    this.cancel();
    this.state = this.createInitialState();
    this.processor = null;
    this.callbacks = {};
  }
}

// Singleton instance
let batchQueueManager: BatchQueueManager | null = null;

/**
 * Get batch queue manager singleton
 */
export function getBatchQueueManager(
  callbacks?: BatchQueueCallbacks,
): BatchQueueManager {
  if (!batchQueueManager) {
    batchQueueManager = new BatchQueueManager(callbacks);
  } else if (callbacks) {
    // Update callbacks if provided
    Object.assign(batchQueueManager['callbacks'], callbacks);
  }

  return batchQueueManager;
}

/**
 * Reset the batch queue manager singleton
 */
export function resetBatchQueueManager(): void {
  if (batchQueueManager) {
    batchQueueManager.destroy();
    batchQueueManager = null;
  }
}
