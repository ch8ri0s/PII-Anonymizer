/**
 * BatchQueueManager Tests
 *
 * Tests for batch queue management including:
 * - Queue operations (add, remove, clear)
 * - Processing flow
 * - Status management
 * - Error handling
 *
 * Story 7.5: File Download & Batch Processing - Task 7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  BatchQueueManager,
  getBatchQueueManager,
  resetBatchQueueManager,
  type FileProcessor,
} from '../../src/batch/BatchQueueManager';

// Helper to create mock File
function createMockFile(name: string, content = 'test content'): File {
  return new File([content], name, { type: 'text/plain' });
}

describe('BatchQueueManager', () => {
  let manager: BatchQueueManager;

  beforeEach(() => {
    manager = new BatchQueueManager();
  });

  afterEach(() => {
    manager.destroy();
    resetBatchQueueManager();
  });

  describe('Queue Operations', () => {
    it('should add files to queue', () => {
      const files = [
        createMockFile('doc1.pdf'),
        createMockFile('doc2.pdf'),
      ];

      const items = manager.addToQueue(files);

      expect(items).toHaveLength(2);
      expect(items[0].filename).toBe('doc1.pdf');
      expect(items[1].filename).toBe('doc2.pdf');
      expect(items[0].status).toBe('pending');
    });

    it('should generate unique IDs for items', () => {
      const files = [
        createMockFile('doc1.pdf'),
        createMockFile('doc2.pdf'),
      ];

      const items = manager.addToQueue(files);

      expect(items[0].id).not.toBe(items[1].id);
      expect(items[0].id.startsWith('batch-')).toBe(true);
    });

    it('should remove items from queue', () => {
      const files = [createMockFile('doc1.pdf')];
      const items = manager.addToQueue(files);

      const removed = manager.removeFromQueue(items[0].id);

      expect(removed).toBe(true);
      expect(manager.getItems()).toHaveLength(0);
    });

    it('should not remove non-existent items', () => {
      const removed = manager.removeFromQueue('non-existent-id');
      expect(removed).toBe(false);
    });

    it('should clear the queue', () => {
      const files = [
        createMockFile('doc1.pdf'),
        createMockFile('doc2.pdf'),
      ];
      manager.addToQueue(files);

      manager.clearQueue();

      expect(manager.getItems()).toHaveLength(0);
      expect(manager.isEmpty()).toBe(true);
    });

    it('should get item by ID', () => {
      const files = [createMockFile('doc1.pdf')];
      const items = manager.addToQueue(files);

      const item = manager.getItem(items[0].id);

      expect(item).toBeDefined();
      expect(item?.filename).toBe('doc1.pdf');
    });

    it('should return undefined for non-existent item', () => {
      const item = manager.getItem('non-existent');
      expect(item).toBeUndefined();
    });
  });

  describe('Processing', () => {
    it('should require processor to be set', async () => {
      const files = [createMockFile('doc1.pdf')];
      manager.addToQueue(files);

      await expect(manager.processQueue()).rejects.toThrow('No processor set');
    });

    it('should process files sequentially', async () => {
      const files = [
        createMockFile('doc1.pdf'),
        createMockFile('doc2.pdf'),
      ];
      manager.addToQueue(files);

      const processor: FileProcessor = vi.fn(async () => ({
        anonymizedContent: 'Anonymized',
        mapping: [],
      }));
      manager.setProcessor(processor);

      await manager.processQueue();

      expect(processor).toHaveBeenCalledTimes(2);
    });

    it('should update item status during processing', async () => {
      const files = [createMockFile('doc1.pdf')];
      manager.addToQueue(files);

      const statuses: string[] = [];
      manager['callbacks'].onStateChange = (state) => {
        if (state.items[0]) {
          statuses.push(state.items[0].status);
        }
      };

      manager.setProcessor(async () => ({
        anonymizedContent: 'Test',
        mapping: [],
      }));

      await manager.processQueue();

      expect(statuses).toContain('processing');
      expect(statuses).toContain('completed');
    });

    it('should handle processing errors', async () => {
      const files = [createMockFile('doc1.pdf')];
      manager.addToQueue(files);

      manager.setProcessor(async () => {
        throw new Error('Processing failed');
      });

      const results = await manager.processQueue();

      expect(results[0].status).toBe('failed');
      expect(results[0].error).toBe('Processing failed');
    });

    it('should isolate errors per file', async () => {
      const files = [
        createMockFile('doc1.pdf'),
        createMockFile('doc2.pdf'),
        createMockFile('doc3.pdf'),
      ];
      manager.addToQueue(files);

      let callCount = 0;
      manager.setProcessor(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Second file failed');
        }
        return { anonymizedContent: 'Test', mapping: [] };
      });

      const results = await manager.processQueue();

      expect(results[0].status).toBe('completed');
      expect(results[1].status).toBe('failed');
      expect(results[2].status).toBe('completed');
    });

    it('should call progress callback', async () => {
      const files = [createMockFile('doc1.pdf')];
      manager.addToQueue(files);

      const progressCallback = vi.fn();
      manager['callbacks'].onProgress = progressCallback;

      manager.setProcessor(async (_file, onProgress) => {
        onProgress?.(50);
        onProgress?.(100);
        return { anonymizedContent: 'Test', mapping: [] };
      });

      await manager.processQueue();

      expect(progressCallback).toHaveBeenCalled();
    });

    it('should call item complete callback', async () => {
      const files = [createMockFile('doc1.pdf')];
      manager.addToQueue(files);

      const completeCallback = vi.fn();
      manager['callbacks'].onItemComplete = completeCallback;

      manager.setProcessor(async () => ({
        anonymizedContent: 'Test',
        mapping: [],
      }));

      await manager.processQueue();

      expect(completeCallback).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'completed' }),
      );
    });

    it('should call item error callback', async () => {
      const files = [createMockFile('doc1.pdf')];
      manager.addToQueue(files);

      const errorCallback = vi.fn();
      manager['callbacks'].onItemError = errorCallback;

      manager.setProcessor(async () => {
        throw new Error('Test error');
      });

      await manager.processQueue();

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
        expect.any(Error),
      );
    });

    it('should call batch complete callback', async () => {
      const files = [createMockFile('doc1.pdf')];
      manager.addToQueue(files);

      const batchCompleteCallback = vi.fn();
      manager['callbacks'].onBatchComplete = batchCompleteCallback;

      manager.setProcessor(async () => ({
        anonymizedContent: 'Test',
        mapping: [],
      }));

      await manager.processQueue();

      expect(batchCompleteCallback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ status: 'completed' }),
        ]),
      );
    });
  });

  describe('Cancellation', () => {
    it('should cancel processing', async () => {
      const files = [
        createMockFile('doc1.pdf'),
        createMockFile('doc2.pdf'),
        createMockFile('doc3.pdf'),
      ];
      manager.addToQueue(files);

      let processedCount = 0;
      manager.setProcessor(async () => {
        processedCount++;
        if (processedCount === 1) {
          manager.cancel();
        }
        return { anonymizedContent: 'Test', mapping: [] };
      });

      await manager.processQueue();

      expect(manager.getState().status).toBe('cancelled');
    });

    it('should set status to cancelled', () => {
      const files = [createMockFile('doc1.pdf')];
      manager.addToQueue(files);

      manager.cancel();

      expect(manager.getState().status).toBe('cancelled');
    });
  });

  describe('Retry', () => {
    it('should retry failed item', async () => {
      const files = [createMockFile('doc1.pdf')];
      manager.addToQueue(files);

      let attempts = 0;
      manager.setProcessor(async () => {
        attempts++;
        if (attempts === 1) {
          throw new Error('First attempt failed');
        }
        return { anonymizedContent: 'Success', mapping: [] };
      });

      await manager.processQueue();
      expect(manager.getItems()[0].status).toBe('failed');

      const item = await manager.retryItem(manager.getItems()[0].id);

      expect(item?.status).toBe('completed');
      expect(attempts).toBe(2);
    });

    it('should retry all failed items', async () => {
      const files = [
        createMockFile('doc1.pdf'),
        createMockFile('doc2.pdf'),
      ];
      manager.addToQueue(files);

      let callCount = 0;
      manager.setProcessor(async () => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Failed');
        }
        return { anonymizedContent: 'Success', mapping: [] };
      });

      await manager.processQueue();
      expect(manager.getFailedItems()).toHaveLength(2);

      await manager.retryAllFailed();

      expect(manager.getCompletedItems()).toHaveLength(2);
    });

    it('should not retry non-failed item', async () => {
      const files = [createMockFile('doc1.pdf')];
      manager.addToQueue(files);

      manager.setProcessor(async () => ({
        anonymizedContent: 'Test',
        mapping: [],
      }));

      await manager.processQueue();

      const item = await manager.retryItem(manager.getItems()[0].id);

      expect(item).toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should track statistics', async () => {
      const files = [
        createMockFile('doc1.pdf'),
        createMockFile('doc2.pdf'),
        createMockFile('doc3.pdf'),
      ];
      manager.addToQueue(files);

      let callCount = 0;
      manager.setProcessor(async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Failed');
        }
        return { anonymizedContent: 'Test', mapping: [] };
      });

      await manager.processQueue();

      const stats = manager.getStats();
      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(0);
    });

    it('should check isEmpty', () => {
      expect(manager.isEmpty()).toBe(true);

      manager.addToQueue([createMockFile('doc.pdf')]);
      expect(manager.isEmpty()).toBe(false);
    });

    it('should check isProcessing', async () => {
      expect(manager.isProcessing()).toBe(false);

      manager.addToQueue([createMockFile('doc.pdf')]);
      manager.setProcessor(async () => {
        expect(manager.isProcessing()).toBe(true);
        return { anonymizedContent: 'Test', mapping: [] };
      });

      await manager.processQueue();
      expect(manager.isProcessing()).toBe(false);
    });

    it('should check isComplete', async () => {
      manager.addToQueue([createMockFile('doc.pdf')]);
      expect(manager.isComplete()).toBe(false);

      manager.setProcessor(async () => ({
        anonymizedContent: 'Test',
        mapping: [],
      }));

      await manager.processQueue();
      expect(manager.isComplete()).toBe(true);
    });

    it('should check hasFailures', async () => {
      manager.addToQueue([createMockFile('doc.pdf')]);

      manager.setProcessor(async () => {
        throw new Error('Failed');
      });

      await manager.processQueue();
      expect(manager.hasFailures()).toBe(true);
    });
  });

  describe('Singleton', () => {
    it('should return same instance', () => {
      const instance1 = getBatchQueueManager();
      const instance2 = getBatchQueueManager();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getBatchQueueManager();
      resetBatchQueueManager();
      const instance2 = getBatchQueueManager();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('getProgress', () => {
    it('should return null when not processing', () => {
      expect(manager.getProgress()).toBeNull();
    });

    it('should return progress during processing', async () => {
      manager.addToQueue([createMockFile('doc.pdf')]);

      let capturedProgress: any = null;
      manager.setProcessor(async () => {
        capturedProgress = manager.getProgress();
        return { anonymizedContent: 'Test', mapping: [] };
      });

      await manager.processQueue();

      expect(capturedProgress).not.toBeNull();
      expect(capturedProgress.totalFiles).toBe(1);
    });
  });

  describe('getCompletedItems and getFailedItems', () => {
    it('should return only completed items', async () => {
      manager.addToQueue([
        createMockFile('doc1.pdf'),
        createMockFile('doc2.pdf'),
      ]);

      let callCount = 0;
      manager.setProcessor(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Failed');
        }
        return { anonymizedContent: 'Test', mapping: [] };
      });

      await manager.processQueue();

      expect(manager.getCompletedItems()).toHaveLength(1);
      expect(manager.getFailedItems()).toHaveLength(1);
    });
  });
});
