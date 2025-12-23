/**
 * ZipDownloader Tests
 *
 * Tests for ZIP download functionality including:
 * - ZIP creation with folder structure
 * - Batch results conversion
 * - Error log generation
 * - Utility functions
 *
 * Story 7.5: File Download & Batch Processing - Task 7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getZipSize,
  countZipFiles,
  type BatchResult,
} from '../../src/download/ZipDownloader';
import type { BatchItem } from '../../src/batch/BatchQueueManager';

// Mock JSZip since generateAsync hangs in happy-dom
vi.mock('jszip', () => {
  const mockFile = vi.fn();
  const mockGenerateAsync = vi.fn().mockResolvedValue(new Blob(['mock-zip-content'], { type: 'application/zip' }));
  const mockFolder = vi.fn();
  const mockLoadAsync = vi.fn().mockImplementation(() => ({
    file: (_path: string) => ({
      async: vi.fn().mockResolvedValue('mock content'),
    }),
    folder: vi.fn(),
  }));

  class MockJSZip {
    file = mockFile;
    generateAsync = mockGenerateAsync;
    folder = mockFolder;

    static loadAsync = mockLoadAsync;
  }

  return { default: MockJSZip };
});

// Re-import after mocking
import {
  createBatchZip,
  createBatchZipFromItems,
  downloadBatchZip,
  downloadBatchZipFromItems,
} from '../../src/download/ZipDownloader';

// Helper to create mock BatchResult
function createMockResult(
  filename: string,
  success: boolean = true,
  options: Partial<BatchResult> = {},
): BatchResult {
  return {
    filename,
    anonymizedContent: success ? '# Anonymized Content\n\nThis is anonymized.' : '',
    mappingContent: success ? JSON.stringify({ version: '1.0.0', entries: [] }) : '',
    success,
    error: success ? undefined : options.error || 'Processing failed',
    ...options,
  };
}

// Helper to create mock BatchItem
function createMockBatchItem(
  id: string,
  filename: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  options: Partial<BatchItem> = {},
): BatchItem {
  return {
    id,
    filename,
    file: new File(['test'], filename),
    status,
    progress: 0,
    addedAt: new Date(),
    result: status === 'completed'
      ? { anonymizedContent: 'Anonymized', mapping: [{ original: 'John', replacement: '[PERSON-1]', type: 'PERSON', occurrences: 1 }] }
      : undefined,
    error: status === 'failed' ? 'Processing failed' : undefined,
    ...options,
  };
}

describe('ZipDownloader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('createBatchZip', () => {
    it('should create a ZIP blob', async () => {
      const results = [createMockResult('doc1.pdf')];

      const blob = await createBatchZip(results);

      expect(blob).toBeInstanceOf(Blob);
    });

    it('should return blob from generateAsync', async () => {
      const results = [createMockResult('doc1.pdf')];

      const blob = await createBatchZip(results);

      expect(blob.size).toBeGreaterThan(0);
    });

    it('should handle empty results', async () => {
      const results: BatchResult[] = [];

      const blob = await createBatchZip(results);

      expect(blob).toBeInstanceOf(Blob);
    });

    it('should handle all failed results', async () => {
      const results = [
        createMockResult('doc1.pdf', false),
        createMockResult('doc2.pdf', false),
      ];

      const blob = await createBatchZip(results);

      expect(blob).toBeInstanceOf(Blob);
    });

    it('should handle mixed results', async () => {
      const results = [
        createMockResult('doc1.pdf', true),
        createMockResult('doc2.pdf', false),
        createMockResult('doc3.pdf', true),
      ];

      const blob = await createBatchZip(results);

      expect(blob).toBeInstanceOf(Blob);
    });
  });

  describe('createBatchZipFromItems', () => {
    it('should convert BatchItems to BatchResults and create ZIP', async () => {
      const items = [
        createMockBatchItem('1', 'doc1.pdf', 'completed'),
        createMockBatchItem('2', 'doc2.pdf', 'completed'),
      ];

      const blob = await createBatchZipFromItems(items);

      expect(blob).toBeInstanceOf(Blob);
    });

    it('should handle failed items', async () => {
      const items = [
        createMockBatchItem('1', 'doc1.pdf', 'completed'),
        createMockBatchItem('2', 'doc2.pdf', 'failed'),
      ];

      const blob = await createBatchZipFromItems(items, { includeErrorLog: true });

      expect(blob).toBeInstanceOf(Blob);
    });

    it('should handle items with mapping data', async () => {
      const items = [
        createMockBatchItem('1', 'doc1.pdf', 'completed', {
          result: {
            anonymizedContent: 'Test',
            mapping: [
              { original: 'John', replacement: '[PERSON-1]', type: 'PERSON', occurrences: 3 },
              { original: 'jane@example.com', replacement: '[EMAIL-1]', type: 'EMAIL', occurrences: 2 },
            ],
          },
        }),
      ];

      const blob = await createBatchZipFromItems(items);

      expect(blob).toBeInstanceOf(Blob);
    });

    it('should handle empty items array', async () => {
      const items: BatchItem[] = [];

      const blob = await createBatchZipFromItems(items);

      expect(blob).toBeInstanceOf(Blob);
    });
  });

  describe('downloadBatchZip', () => {
    it('should trigger download', async () => {
      const results = [createMockResult('doc1.pdf')];

      const mockClick = vi.fn();
      const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          el.click = mockClick;
        }
        return el;
      }) as typeof document.createElement);

      await downloadBatchZip(results);

      expect(mockClick).toHaveBeenCalled();
      expect(mockAppendChild).toHaveBeenCalled();

      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
    });
  });

  describe('downloadBatchZipFromItems', () => {
    it('should trigger download from batch items', async () => {
      const items = [createMockBatchItem('1', 'doc1.pdf', 'completed')];

      const mockClick = vi.fn();
      const mockAppendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
      const mockRemoveChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);

      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
        const el = originalCreateElement(tag);
        if (tag === 'a') {
          el.click = mockClick;
        }
        return el;
      }) as typeof document.createElement);

      await downloadBatchZipFromItems(items);

      expect(mockClick).toHaveBeenCalled();

      mockAppendChild.mockRestore();
      mockRemoveChild.mockRestore();
    });
  });

  describe('getZipSize', () => {
    it('should format bytes correctly', () => {
      const blob = new Blob(['test'], { type: 'application/zip' });
      const size = getZipSize(blob);

      expect(size).toMatch(/\d+(\.\d+)? (Bytes|KB|MB|GB)/);
    });

    it('should return "0 Bytes" for empty blob', () => {
      const blob = new Blob([], { type: 'application/zip' });
      const size = getZipSize(blob);

      expect(size).toBe('0 Bytes');
    });

    it('should format KB correctly', () => {
      const content = 'x'.repeat(2048); // ~2KB
      const blob = new Blob([content], { type: 'application/zip' });
      const size = getZipSize(blob);

      expect(size).toContain('KB');
    });

    it('should format MB correctly', () => {
      // Create a blob that will report as MB (not actually that size, but we test the formatting)
      const blob = new Blob(['x'], { type: 'application/zip' });
      // Override size for testing
      Object.defineProperty(blob, 'size', { value: 2 * 1024 * 1024 });
      const size = getZipSize(blob);

      expect(size).toContain('MB');
    });
  });

  describe('countZipFiles', () => {
    it('should count files in successful results', () => {
      const results = [
        createMockResult('doc1.pdf', true),
        createMockResult('doc2.pdf', true),
      ];

      const counts = countZipFiles(results);

      expect(counts.anonymized).toBe(2);
      expect(counts.mappings).toBe(2);
      expect(counts.total).toBe(4);
    });

    it('should include error log in count', () => {
      const results = [
        createMockResult('doc1.pdf', true),
        createMockResult('doc2.pdf', false),
      ];

      const counts = countZipFiles(results, { includeErrorLog: true });

      expect(counts.errors).toBe(1);
      expect(counts.total).toBe(3); // 1 anonymized + 1 mapping + 1 error log
    });

    it('should not count error log when disabled', () => {
      const results = [
        createMockResult('doc1.pdf', false),
      ];

      const counts = countZipFiles(results, { includeErrorLog: false });

      expect(counts.errors).toBe(0);
      expect(counts.total).toBe(0);
    });

    it('should not count failed files', () => {
      const results = [
        createMockResult('doc1.pdf', true),
        createMockResult('doc2.pdf', false),
        createMockResult('doc3.pdf', false),
      ];

      const counts = countZipFiles(results);

      expect(counts.anonymized).toBe(1);
      expect(counts.mappings).toBe(1);
    });

    it('should handle empty results', () => {
      const results: BatchResult[] = [];

      const counts = countZipFiles(results);

      expect(counts.total).toBe(0);
      expect(counts.anonymized).toBe(0);
      expect(counts.mappings).toBe(0);
      expect(counts.errors).toBe(0);
    });

    it('should handle all failures', () => {
      const results = [
        createMockResult('doc1.pdf', false),
        createMockResult('doc2.pdf', false),
      ];

      const counts = countZipFiles(results, { includeErrorLog: true });

      expect(counts.anonymized).toBe(0);
      expect(counts.mappings).toBe(0);
      expect(counts.errors).toBe(1);
      expect(counts.total).toBe(1);
    });

    it('should handle single successful file', () => {
      const results = [
        createMockResult('doc1.pdf', true),
      ];

      const counts = countZipFiles(results);

      expect(counts.anonymized).toBe(1);
      expect(counts.mappings).toBe(1);
      expect(counts.total).toBe(2);
      expect(counts.errors).toBe(0);
    });

    it('should count correctly with many files', () => {
      const results = Array.from({ length: 10 }, (_, i) =>
        createMockResult(`doc${i}.pdf`, true),
      );

      const counts = countZipFiles(results);

      expect(counts.anonymized).toBe(10);
      expect(counts.mappings).toBe(10);
      expect(counts.total).toBe(20);
    });
  });

  describe('BatchResult interface', () => {
    it('should create valid BatchResult with success', () => {
      const result = createMockResult('test.pdf', true);

      expect(result.filename).toBe('test.pdf');
      expect(result.success).toBe(true);
      expect(result.anonymizedContent).toBeTruthy();
      expect(result.mappingContent).toBeTruthy();
      expect(result.error).toBeUndefined();
    });

    it('should create valid BatchResult with failure', () => {
      const result = createMockResult('test.pdf', false, { error: 'Custom error' });

      expect(result.filename).toBe('test.pdf');
      expect(result.success).toBe(false);
      expect(result.anonymizedContent).toBe('');
      expect(result.mappingContent).toBe('');
      expect(result.error).toBe('Custom error');
    });
  });

  describe('ZipOptions', () => {
    it('should respect includeErrorLog option', () => {
      const results = [createMockResult('doc1.pdf', false)];

      const countsWithLog = countZipFiles(results, { includeErrorLog: true });
      const countsWithoutLog = countZipFiles(results, { includeErrorLog: false });

      expect(countsWithLog.errors).toBe(1);
      expect(countsWithoutLog.errors).toBe(0);
    });

    it('should default includeErrorLog to true', () => {
      const results = [createMockResult('doc1.pdf', false)];

      const counts = countZipFiles(results);

      expect(counts.errors).toBe(1);
    });
  });
});
