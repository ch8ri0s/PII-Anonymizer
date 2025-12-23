/**
 * BatchPanel Tests
 *
 * Tests for batch panel UI component including:
 * - Panel initialization and rendering
 * - Item display and status indicators
 * - Event handling
 * - Progress display
 *
 * Story 7.5: File Download & Batch Processing - Task 7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initBatchPanel,
  updateBatchPanel,
  updateBatchItem,
  setBatchProgress,
  getBatchPanelItems,
  isBatchPanelInitialized,
  destroyBatchPanel,
} from '../../src/components/BatchPanel';
import type { BatchItem, BatchProgress } from '../../src/batch/BatchQueueManager';

// Helper to create mock BatchItem
function createMockBatchItem(
  id: string,
  filename: string,
  status: 'pending' | 'processing' | 'completed' | 'failed' = 'pending',
  options: Partial<BatchItem> = {},
): BatchItem {
  return {
    id,
    filename,
    file: new File(['test'], filename, { type: 'text/plain' }),
    status,
    progress: options.progress ?? 0,
    addedAt: new Date(),
    result: options.result,
    error: options.error,
    ...options,
  };
}

describe('BatchPanel', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    destroyBatchPanel();
    document.body.removeChild(container);
    // Remove injected styles
    const styles = document.getElementById('batch-panel-styles');
    if (styles) {
      styles.remove();
    }
  });

  describe('Initialization', () => {
    it('should initialize the panel', () => {
      initBatchPanel(container);

      expect(isBatchPanelInitialized()).toBe(true);
    });

    it('should render panel structure', () => {
      initBatchPanel(container);

      expect(container.querySelector('.batch-panel')).toBeTruthy();
      expect(container.querySelector('.batch-panel-header')).toBeTruthy();
      expect(container.querySelector('.batch-panel-list')).toBeTruthy();
      expect(container.querySelector('.batch-panel-footer')).toBeTruthy();
    });

    it('should inject CSS styles', () => {
      initBatchPanel(container);

      const styleElement = document.getElementById('batch-panel-styles');
      expect(styleElement).toBeTruthy();
      expect(styleElement?.tagName).toBe('STYLE');
    });

    it('should show empty state when no items', () => {
      initBatchPanel(container);

      expect(container.querySelector('.batch-panel-empty')).toBeTruthy();
      expect(container.textContent).toContain('No files in queue');
    });

    it('should reinitialize when called again', () => {
      initBatchPanel(container);
      initBatchPanel(container);

      expect(isBatchPanelInitialized()).toBe(true);
      expect(container.querySelectorAll('.batch-panel').length).toBe(1);
    });
  });

  describe('Item Display', () => {
    it('should display items', () => {
      initBatchPanel(container);
      const items = [
        createMockBatchItem('1', 'doc1.pdf', 'pending'),
        createMockBatchItem('2', 'doc2.pdf', 'pending'),
      ];

      updateBatchPanel(items, 'idle');

      const itemElements = container.querySelectorAll('.batch-panel-item');
      expect(itemElements.length).toBe(2);
    });

    it('should display filename', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'my-document.pdf')];

      updateBatchPanel(items, 'idle');

      expect(container.textContent).toContain('my-document.pdf');
    });

    it('should display file count in header', () => {
      initBatchPanel(container);
      const items = [
        createMockBatchItem('1', 'doc1.pdf'),
        createMockBatchItem('2', 'doc2.pdf'),
        createMockBatchItem('3', 'doc3.pdf'),
      ];

      updateBatchPanel(items, 'idle');

      expect(container.textContent).toContain('3 files');
    });

    it('should show singular "file" for single item', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc1.pdf')];

      updateBatchPanel(items, 'idle');

      expect(container.textContent).toContain('1 file');
    });

    it('should display status icons', () => {
      initBatchPanel(container);
      const items = [
        createMockBatchItem('1', 'pending.pdf', 'pending'),
        createMockBatchItem('2', 'processing.pdf', 'processing'),
        createMockBatchItem('3', 'completed.pdf', 'completed'),
        createMockBatchItem('4', 'failed.pdf', 'failed'),
      ];

      updateBatchPanel(items, 'idle');

      const statusElements = container.querySelectorAll('.batch-item-status');
      expect(statusElements.length).toBe(4);
    });

    it('should display error message for failed items', () => {
      initBatchPanel(container);
      const items = [
        createMockBatchItem('1', 'failed.pdf', 'failed', {
          error: 'File could not be processed',
        }),
      ];

      updateBatchPanel(items, 'idle');

      expect(container.querySelector('.batch-item-error')).toBeTruthy();
      expect(container.textContent).toContain('File could not be processed');
    });

    it('should display progress bar for processing items', () => {
      initBatchPanel(container);
      const items = [
        createMockBatchItem('1', 'processing.pdf', 'processing', {
          progress: 50,
        }),
      ];

      updateBatchPanel(items, 'processing');

      expect(container.querySelector('.batch-item-progress')).toBeTruthy();
    });

    it('should escape HTML in filenames', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', '<b>test</b>.pdf')];

      updateBatchPanel(items, 'idle');

      // The HTML should be escaped so the text is visible, not rendered as HTML
      const itemName = container.querySelector('.batch-item-name');
      expect(itemName?.textContent).toContain('<b>test</b>.pdf');
    });
  });

  describe('Event Handling', () => {
    it('should call onProcess when process button clicked', () => {
      const onProcess = vi.fn();
      initBatchPanel(container, { onProcess });
      const items = [createMockBatchItem('1', 'doc.pdf')];
      updateBatchPanel(items, 'idle');

      const processBtn = container.querySelector('#process-btn') as HTMLButtonElement;
      processBtn?.click();

      expect(onProcess).toHaveBeenCalled();
    });

    it('should call onCancel when cancel button clicked', () => {
      const onCancel = vi.fn();
      initBatchPanel(container, { onCancel });
      const items = [createMockBatchItem('1', 'doc.pdf', 'processing')];
      updateBatchPanel(items, 'processing');

      const cancelBtn = container.querySelector('#cancel-btn') as HTMLButtonElement;
      cancelBtn?.click();

      expect(onCancel).toHaveBeenCalled();
    });

    it('should call onClear when clear button clicked', () => {
      const onClear = vi.fn();
      initBatchPanel(container, { onClear });
      const items = [createMockBatchItem('1', 'doc.pdf')];
      updateBatchPanel(items, 'idle');

      const clearBtn = container.querySelector('#clear-btn') as HTMLButtonElement;
      clearBtn?.click();

      expect(onClear).toHaveBeenCalled();
    });

    it('should call onRetry when retry button clicked', () => {
      const onRetry = vi.fn();
      initBatchPanel(container, { onRetry });
      const items = [createMockBatchItem('1', 'failed.pdf', 'failed')];
      updateBatchPanel(items, 'idle');

      const retryBtn = container.querySelector('[data-action="retry"]') as HTMLButtonElement;
      retryBtn?.click();

      expect(onRetry).toHaveBeenCalledWith('1');
    });

    it('should call onRemove when remove button clicked', () => {
      const onRemove = vi.fn();
      initBatchPanel(container, { onRemove });
      const items = [createMockBatchItem('1', 'doc.pdf', 'pending')];
      updateBatchPanel(items, 'idle');

      const removeBtn = container.querySelector('[data-action="remove"]') as HTMLButtonElement;
      removeBtn?.click();

      expect(onRemove).toHaveBeenCalledWith('1');
    });

    it('should call onDownloadItem when download button clicked', () => {
      const onDownloadItem = vi.fn();
      initBatchPanel(container, { onDownloadItem });
      const items = [
        createMockBatchItem('1', 'doc.pdf', 'completed', {
          result: { anonymizedContent: 'test', mapping: [] },
        }),
      ];
      updateBatchPanel(items, 'completed');

      const downloadBtn = container.querySelector('[data-action="download"]') as HTMLButtonElement;
      downloadBtn?.click();

      expect(onDownloadItem).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    });

    it('should call onDownloadAll when download all button clicked', () => {
      const onDownloadAll = vi.fn();
      initBatchPanel(container, { onDownloadAll });
      const items = [
        createMockBatchItem('1', 'doc.pdf', 'completed', {
          result: { anonymizedContent: 'test', mapping: [] },
        }),
      ];
      updateBatchPanel(items, 'completed');

      const downloadAllBtn = container.querySelector('#download-all-btn') as HTMLButtonElement;
      downloadAllBtn?.click();

      expect(onDownloadAll).toHaveBeenCalled();
    });

    it('should call onRetryAll when retry all button clicked', () => {
      const onRetryAll = vi.fn();
      initBatchPanel(container, { onRetryAll });
      const items = [
        createMockBatchItem('1', 'doc1.pdf', 'completed', {
          result: { anonymizedContent: 'test', mapping: [] },
        }),
        createMockBatchItem('2', 'doc2.pdf', 'failed'),
      ];
      updateBatchPanel(items, 'completed');

      const retryAllBtn = container.querySelector('#retry-all-btn') as HTMLButtonElement;
      retryAllBtn?.click();

      expect(onRetryAll).toHaveBeenCalled();
    });
  });

  describe('Footer Buttons', () => {
    it('should show Process and Clear buttons when idle with items', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc.pdf')];
      updateBatchPanel(items, 'idle');

      expect(container.querySelector('#process-btn')).toBeTruthy();
      expect(container.querySelector('#clear-btn')).toBeTruthy();
    });

    it('should disable buttons when no items', () => {
      initBatchPanel(container);
      updateBatchPanel([], 'idle');

      const processBtn = container.querySelector('#process-btn') as HTMLButtonElement;
      const clearBtn = container.querySelector('#clear-btn') as HTMLButtonElement;

      expect(processBtn?.disabled).toBe(true);
      expect(clearBtn?.disabled).toBe(true);
    });

    it('should show Cancel button when processing', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc.pdf', 'processing')];
      updateBatchPanel(items, 'processing');

      expect(container.querySelector('#cancel-btn')).toBeTruthy();
      expect(container.querySelector('#process-btn')).toBeFalsy();
    });

    it('should show Download All button when complete', () => {
      initBatchPanel(container);
      const items = [
        createMockBatchItem('1', 'doc.pdf', 'completed', {
          result: { anonymizedContent: 'test', mapping: [] },
        }),
      ];
      updateBatchPanel(items, 'completed');

      expect(container.querySelector('#download-all-btn')).toBeTruthy();
    });

    it('should show Retry Failed button when there are failures', () => {
      initBatchPanel(container);
      const items = [
        createMockBatchItem('1', 'doc1.pdf', 'completed', {
          result: { anonymizedContent: 'test', mapping: [] },
        }),
        createMockBatchItem('2', 'doc2.pdf', 'failed'),
      ];
      updateBatchPanel(items, 'completed');

      expect(container.querySelector('#retry-all-btn')).toBeTruthy();
    });
  });

  describe('Progress Display', () => {
    it('should show overall progress bar when processing', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc.pdf', 'processing')];
      const progress: BatchProgress = {
        currentFile: 'doc.pdf',
        currentIndex: 0,
        totalFiles: 2,
        overallProgress: 50,
        currentFileProgress: 50,
      };
      updateBatchPanel(items, 'processing', progress);

      expect(container.querySelector('.batch-panel-progress')).toBeTruthy();
    });

    it('should display current file name in progress', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc.pdf', 'processing')];
      const progress: BatchProgress = {
        currentFile: 'processing-file.pdf',
        currentIndex: 0,
        totalFiles: 2,
        overallProgress: 50,
        currentFileProgress: 50,
      };
      updateBatchPanel(items, 'processing', progress);

      expect(container.textContent).toContain('processing-file.pdf');
    });

    it('should display progress count', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc.pdf', 'processing')];
      const progress: BatchProgress = {
        currentFile: 'doc.pdf',
        currentIndex: 1,
        totalFiles: 5,
        overallProgress: 40,
        currentFileProgress: 40,
      };
      updateBatchPanel(items, 'processing', progress);

      expect(container.textContent).toContain('2 of 5');
    });

    it('should not show progress bar when not processing', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc.pdf', 'pending')];
      updateBatchPanel(items, 'idle');

      expect(container.querySelector('.batch-panel-progress')).toBeFalsy();
    });
  });

  describe('Update Functions', () => {
    it('should update single item', () => {
      initBatchPanel(container);
      const items = [
        createMockBatchItem('1', 'doc1.pdf', 'pending'),
        createMockBatchItem('2', 'doc2.pdf', 'pending'),
      ];
      updateBatchPanel(items, 'idle');

      const updatedItem = createMockBatchItem('1', 'doc1.pdf', 'completed', {
        result: { anonymizedContent: 'test', mapping: [] },
      });
      updateBatchItem(updatedItem);

      // Panel should re-render with updated item
      const firstItem = container.querySelector('[data-item-id="1"]');
      expect(firstItem?.textContent).toContain('Done');
    });

    it('should set progress', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc.pdf', 'processing')];
      updateBatchPanel(items, 'processing');

      const progress: BatchProgress = {
        currentFile: 'doc.pdf',
        currentIndex: 0,
        totalFiles: 1,
        overallProgress: 75,
        currentFileProgress: 75,
      };
      setBatchProgress(progress);

      expect(container.querySelector('.batch-panel-progress')).toBeTruthy();
    });

    it('should get current items', () => {
      initBatchPanel(container);
      const items = [
        createMockBatchItem('1', 'doc1.pdf'),
        createMockBatchItem('2', 'doc2.pdf'),
      ];
      updateBatchPanel(items, 'idle');

      const panelItems = getBatchPanelItems();

      expect(panelItems).toHaveLength(2);
      expect(panelItems[0].filename).toBe('doc1.pdf');
    });

    it('should return copy of items, not reference', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc1.pdf')];
      updateBatchPanel(items, 'idle');

      const panelItems1 = getBatchPanelItems();
      const panelItems2 = getBatchPanelItems();

      expect(panelItems1).not.toBe(panelItems2);
    });
  });

  describe('Item Actions Visibility', () => {
    it('should show remove button for pending items', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc.pdf', 'pending')];
      updateBatchPanel(items, 'idle');

      expect(container.querySelector('[data-action="remove"]')).toBeTruthy();
    });

    it('should not show remove button for processing items', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc.pdf', 'processing')];
      updateBatchPanel(items, 'processing');

      expect(container.querySelector('[data-action="remove"]')).toBeFalsy();
    });

    it('should show retry button for failed items', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc.pdf', 'failed')];
      updateBatchPanel(items, 'idle');

      expect(container.querySelector('[data-action="retry"]')).toBeTruthy();
    });

    it('should not show retry button for pending items', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc.pdf', 'pending')];
      updateBatchPanel(items, 'idle');

      expect(container.querySelector('[data-action="retry"]')).toBeFalsy();
    });

    it('should show download button for completed items with result', () => {
      initBatchPanel(container);
      const items = [
        createMockBatchItem('1', 'doc.pdf', 'completed', {
          result: { anonymizedContent: 'test', mapping: [] },
        }),
      ];
      updateBatchPanel(items, 'completed');

      expect(container.querySelector('[data-action="download"]')).toBeTruthy();
    });

    it('should not show download button for completed items without result', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc.pdf', 'completed')];
      updateBatchPanel(items, 'completed');

      expect(container.querySelector('[data-action="download"]')).toBeFalsy();
    });
  });

  describe('Destroy', () => {
    it('should clear container on destroy', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc.pdf')];
      updateBatchPanel(items, 'idle');

      destroyBatchPanel();

      expect(container.innerHTML).toBe('');
    });

    it('should set initialized to false on destroy', () => {
      initBatchPanel(container);

      destroyBatchPanel();

      expect(isBatchPanelInitialized()).toBe(false);
    });

    it('should clear items on destroy', () => {
      initBatchPanel(container);
      const items = [createMockBatchItem('1', 'doc.pdf')];
      updateBatchPanel(items, 'idle');

      destroyBatchPanel();

      expect(getBatchPanelItems()).toHaveLength(0);
    });
  });
});
