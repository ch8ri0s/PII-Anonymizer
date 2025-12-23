/**
 * Batch Controller
 *
 * Orchestrates batch file processing with PII detection, anonymization,
 * and download functionality. Integrates with EntityReviewController.
 *
 * Story 7.5: File Download & Batch Processing - AC #1-6
 */

import type { EntityWithSelection } from './EntitySidebar';
import type { BatchItem, BatchProgress, BatchQueueState } from '../batch/BatchQueueManager';
import { BatchQueueManager, getBatchQueueManager, resetBatchQueueManager } from '../batch/BatchQueueManager';
import { initBatchPanel, updateBatchPanel, destroyBatchPanel, type BatchPanelConfig } from './BatchPanel';
import {
  downloadAnonymizedWithMapping,
  downloadBatchZipFromItems,
} from '../download';
import { anonymizeMarkdown, FileProcessingSession } from '../processing/Anonymizer';
import { PIIDetector } from '../processing/PIIDetector';
import type { MappingEntry } from '../types';

/**
 * Batch controller configuration
 */
export interface BatchControllerConfig {
  /** Container element for the batch panel UI */
  panelContainer?: HTMLElement;
  /** Called when batch processing starts */
  onBatchStart?: () => void;
  /** Called when batch processing completes */
  onBatchComplete?: (results: BatchItem[]) => void;
  /** Called when a single file processing completes */
  onFileComplete?: (item: BatchItem) => void;
  /** Called when a file processing fails */
  onFileError?: (item: BatchItem, error: Error) => void;
  /** Called when overall progress updates */
  onProgress?: (progress: BatchProgress) => void;
}

/**
 * Batch controller state
 */
interface BatchControllerState {
  initialized: boolean;
  queueManager: BatchQueueManager | null;
  detector: PIIDetector | null;
  session: FileProcessingSession | null;
}

// Module state
let state: BatchControllerState = {
  initialized: false,
  queueManager: null,
  detector: null,
  session: null,
};

let config: BatchControllerConfig = {};

/**
 * Initialize the batch controller
 */
export function initBatchController(controllerConfig: BatchControllerConfig = {}): void {
  if (state.initialized) {
    destroyBatchController();
  }

  config = controllerConfig;

  // Initialize queue manager
  state.queueManager = getBatchQueueManager({
    onStateChange: handleStateChange,
    onProgress: handleProgress,
    onItemComplete: handleItemComplete,
    onItemError: handleItemError,
    onBatchComplete: handleBatchComplete,
  });

  // Set the file processor
  state.queueManager.setProcessor(processFile);

  // Initialize batch panel UI if container provided
  if (config.panelContainer) {
    const panelConfig: BatchPanelConfig = {
      onProcess: () => void startBatchProcessing(),
      onCancel: cancelBatchProcessing,
      onRetry: (itemId: string) => void retryFile(itemId),
      onRetryAll: () => void retryAllFailed(),
      onRemove: removeFile,
      onClear: clearQueue,
      onDownloadItem: downloadSingleFile,
      onDownloadAll: () => void downloadAllAsZip(),
    };

    initBatchPanel(config.panelContainer, panelConfig);
  }

  // Initialize detector
  state.detector = new PIIDetector();

  state.initialized = true;
}

/**
 * Add files to the batch queue
 */
export function addFilesToBatch(files: File[]): BatchItem[] {
  if (!state.queueManager) {
    throw new Error('Batch controller not initialized');
  }

  return state.queueManager.addToQueue(files);
}

/**
 * Start batch processing
 */
export async function startBatchProcessing(): Promise<BatchItem[]> {
  if (!state.queueManager) {
    throw new Error('Batch controller not initialized');
  }

  // Create a new processing session
  state.session = new FileProcessingSession();

  config.onBatchStart?.();

  return state.queueManager.processQueue();
}

/**
 * Cancel batch processing
 */
export function cancelBatchProcessing(): void {
  state.queueManager?.cancel();
}

/**
 * Retry a failed file
 */
export async function retryFile(itemId: string): Promise<BatchItem | null> {
  if (!state.queueManager) return null;
  return state.queueManager.retryItem(itemId);
}

/**
 * Retry all failed files
 */
export async function retryAllFailed(): Promise<BatchItem[]> {
  if (!state.queueManager) return [];
  return state.queueManager.retryAllFailed();
}

/**
 * Remove a file from the queue
 */
export function removeFile(itemId: string): boolean {
  if (!state.queueManager) return false;
  return state.queueManager.removeFromQueue(itemId);
}

/**
 * Clear the queue
 */
export function clearQueue(): void {
  state.queueManager?.clearQueue();
  state.session = null;
}

/**
 * Download a single completed file
 */
export function downloadSingleFile(item: BatchItem): void {
  if (item.status !== 'completed' || !item.result) {
    return;
  }

  downloadAnonymizedWithMapping(
    item.result.anonymizedContent,
    item.result.mapping,
    item.filename,
  );
}

/**
 * Download all completed files as ZIP
 */
export async function downloadAllAsZip(): Promise<void> {
  if (!state.queueManager) return;

  const items = state.queueManager.getItems();
  const completedItems = items.filter(i => i.status === 'completed' || i.status === 'failed');

  if (completedItems.length === 0) {
    return;
  }

  await downloadBatchZipFromItems(completedItems, {
    includeErrorLog: true,
    folderStructure: 'organized',
  });
}

/**
 * Process a single file
 */
async function processFile(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ anonymizedContent: string; mapping: MappingEntry[] }> {
  if (!state.detector) {
    throw new Error('Detector not initialized');
  }

  // Create session if not exists
  if (!state.session) {
    state.session = new FileProcessingSession();
  }

  onProgress?.(10);

  // Read file content
  const text = await readFileAsText(file);
  onProgress?.(20);

  // Detect PII
  const detectedMatches = await state.detector.detect(text);
  onProgress?.(60);

  // Convert to base PIIMatch type for anonymizer
  const matches = detectedMatches.map(m => ({
    text: m.text,
    type: m.type,
    start: m.start,
    end: m.end,
  }));

  // Anonymize
  const { anonymizedMarkdown, mappingTable } = anonymizeMarkdown(
    text,
    matches,
    state.session,
  );
  onProgress?.(90);

  onProgress?.(100);

  return {
    anonymizedContent: anonymizedMarkdown,
    mapping: mappingTable,
  };
}

/**
 * Read file as text
 */
function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Handle state change from queue manager
 */
function handleStateChange(queueState: BatchQueueState): void {
  if (config.panelContainer && state.queueManager) {
    updateBatchPanel(
      queueState.items,
      queueState.status,
      state.queueManager.getProgress(),
    );
  }
}

/**
 * Handle progress updates
 */
function handleProgress(progress: BatchProgress): void {
  config.onProgress?.(progress);
}

/**
 * Handle item completion
 */
function handleItemComplete(item: BatchItem): void {
  config.onFileComplete?.(item);
}

/**
 * Handle item error
 */
function handleItemError(item: BatchItem, error: Error): void {
  config.onFileError?.(item, error);
}

/**
 * Handle batch completion
 */
function handleBatchComplete(results: BatchItem[]): void {
  config.onBatchComplete?.(results);
}

/**
 * Get current queue state
 */
export function getBatchState(): BatchQueueState | null {
  return state.queueManager?.getState() || null;
}

/**
 * Get completed items
 */
export function getCompletedItems(): BatchItem[] {
  return state.queueManager?.getCompletedItems() || [];
}

/**
 * Get failed items
 */
export function getFailedItems(): BatchItem[] {
  return state.queueManager?.getFailedItems() || [];
}

/**
 * Check if batch is processing
 */
export function isBatchProcessing(): boolean {
  return state.queueManager?.isProcessing() || false;
}

/**
 * Check if batch has failures
 */
export function hasBatchFailures(): boolean {
  return state.queueManager?.hasFailures() || false;
}

/**
 * Download anonymized content with selected entities
 * (Integration with EntityReviewController)
 */
export function downloadWithSelectedEntities(
  documentContent: string,
  selectedEntities: EntityWithSelection[],
  sourceFilename: string,
): void {
  // Create session
  const session = new FileProcessingSession();

  // Convert entities to PIIMatch format
  const matches = selectedEntities.map(entity => ({
    type: entity.type,
    text: entity.text,
    start: entity.start,
    end: entity.end,
  }));

  // Anonymize
  const { anonymizedMarkdown, mappingTable } = anonymizeMarkdown(
    documentContent,
    matches,
    session,
  );

  // Download
  downloadAnonymizedWithMapping(anonymizedMarkdown, mappingTable, sourceFilename);
}

/**
 * Destroy the batch controller
 */
export function destroyBatchController(): void {
  resetBatchQueueManager();

  if (config.panelContainer) {
    destroyBatchPanel();
  }

  state = {
    initialized: false,
    queueManager: null,
    detector: null,
    session: null,
  };

  config = {};
}
