/**
 * FileDownloader Tests
 *
 * Tests for file download functionality including:
 * - Anonymized file downloads
 * - Mapping file downloads
 * - Filename utilities
 *
 * Story 7.5: File Download & Batch Processing - Task 7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  downloadAnonymizedFile,
  downloadMappingFile,
  downloadAnonymizedWithMapping,
  createAnonymizedFilename,
  createMappingFilename,
  getBaseFilename,
  generateTimestampedFilename,
  prepareDownloadResult,
  createFailedDownloadResult,
} from '../../src/download/FileDownloader';

// Mock the download utility
vi.mock('../../src/utils/download', () => ({
  downloadFile: vi.fn(),
}));

import { downloadFile } from '../../src/utils/download';

describe('FileDownloader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('downloadAnonymizedFile', () => {
    it('should download file with anonymized- prefix', () => {
      const content = '# Anonymized Document\n\nContent here...';
      const filename = 'document.pdf';

      downloadAnonymizedFile(content, filename);

      expect(downloadFile).toHaveBeenCalledWith(
        content,
        'anonymized-document.md',
        'text/markdown',
      );
    });

    it('should handle filenames without extension', () => {
      const content = 'Test content';
      const filename = 'document';

      downloadAnonymizedFile(content, filename);

      expect(downloadFile).toHaveBeenCalledWith(
        content,
        'anonymized-document.md',
        'text/markdown',
      );
    });

    it('should handle filenames with multiple dots', () => {
      const content = 'Test content';
      const filename = 'my.document.v2.pdf';

      downloadAnonymizedFile(content, filename);

      expect(downloadFile).toHaveBeenCalledWith(
        content,
        'anonymized-my.document.v2.md',
        'text/markdown',
      );
    });
  });

  describe('downloadMappingFile', () => {
    it('should download mapping as JSON', () => {
      const mapping = [
        { original: 'John Doe', replacement: '[PERSON-1]', type: 'PERSON', occurrences: 2 },
        { original: 'john@example.com', replacement: '[EMAIL-1]', type: 'EMAIL', occurrences: 1 },
      ];
      const sourceFilename = 'document.pdf';

      downloadMappingFile(mapping, sourceFilename);

      expect(downloadFile).toHaveBeenCalled();
      const call = vi.mocked(downloadFile).mock.calls[0];
      expect(call[1]).toBe('document-mapping.json');
      expect(call[2]).toBe('application/json');

      // Verify JSON structure
      const jsonContent = JSON.parse(call[0]);
      expect(jsonContent.version).toBe('1.0.0');
      expect(jsonContent.sourceFile).toBe('document.pdf');
      expect(jsonContent.totalReplacements).toBe(3);
      expect(jsonContent.entries).toHaveLength(2);
    });

    it('should include generated timestamp', () => {
      const mapping = [
        { original: 'Test', replacement: '[PERSON-1]', type: 'PERSON', occurrences: 1 },
      ];

      downloadMappingFile(mapping, 'test.pdf');

      const call = vi.mocked(downloadFile).mock.calls[0];
      const jsonContent = JSON.parse(call[0]);
      expect(jsonContent.generatedAt).toBe('2025-01-15T10:30:00.000Z');
    });

    it('should handle empty mapping', () => {
      const mapping: any[] = [];

      downloadMappingFile(mapping, 'empty.pdf');

      const call = vi.mocked(downloadFile).mock.calls[0];
      const jsonContent = JSON.parse(call[0]);
      expect(jsonContent.totalReplacements).toBe(0);
      expect(jsonContent.entries).toHaveLength(0);
    });
  });

  describe('downloadAnonymizedWithMapping', () => {
    it('should download both files', () => {
      const content = 'Anonymized content';
      const mapping = [
        { original: 'John', replacement: '[PERSON-1]', type: 'PERSON', occurrences: 1 },
      ];

      downloadAnonymizedWithMapping(content, mapping, 'doc.pdf');

      // First call is the anonymized file
      expect(downloadFile).toHaveBeenCalledWith(
        content,
        'anonymized-doc.md',
        'text/markdown',
      );

      // Advance timers for the delayed mapping download
      vi.advanceTimersByTime(100);

      // Second call is the mapping file
      expect(downloadFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('createAnonymizedFilename', () => {
    it('should create anonymized filename with .md extension', () => {
      expect(createAnonymizedFilename('document.pdf')).toBe('anonymized-document.md');
      expect(createAnonymizedFilename('file.docx')).toBe('anonymized-file.md');
      expect(createAnonymizedFilename('data.csv')).toBe('anonymized-data.md');
    });

    it('should handle files without extension', () => {
      expect(createAnonymizedFilename('README')).toBe('anonymized-README.md');
    });

    it('should handle dotfiles', () => {
      expect(createAnonymizedFilename('.gitignore')).toBe('anonymized-.gitignore.md');
    });
  });

  describe('createMappingFilename', () => {
    it('should create mapping filename with -mapping.json suffix', () => {
      expect(createMappingFilename('document.pdf')).toBe('document-mapping.json');
      expect(createMappingFilename('file.docx')).toBe('file-mapping.json');
    });

    it('should handle files without extension', () => {
      expect(createMappingFilename('README')).toBe('README-mapping.json');
    });
  });

  describe('getBaseFilename', () => {
    it('should remove extension', () => {
      expect(getBaseFilename('document.pdf')).toBe('document');
      expect(getBaseFilename('file.test.ts')).toBe('file.test');
    });

    it('should return full name if no extension', () => {
      expect(getBaseFilename('README')).toBe('README');
    });

    it('should handle dotfiles correctly', () => {
      expect(getBaseFilename('.gitignore')).toBe('.gitignore');
    });
  });

  describe('generateTimestampedFilename', () => {
    it('should generate timestamped filename', () => {
      const filename = generateTimestampedFilename('pii-anonymized', 'zip');
      expect(filename).toBe('pii-anonymized-20250115-103000.zip');
    });

    it('should work with different prefixes and extensions', () => {
      const filename = generateTimestampedFilename('backup', 'tar.gz');
      expect(filename).toBe('backup-20250115-103000.tar.gz');
    });
  });

  describe('prepareDownloadResult', () => {
    it('should prepare download result object', () => {
      const result = prepareDownloadResult(
        'test.pdf',
        'Anonymized content',
        [{ original: 'John', replacement: '[PERSON-1]', type: 'PERSON', occurrences: 1 }],
      );

      expect(result.filename).toBe('test.pdf');
      expect(result.anonymizedContent).toBe('Anonymized content');
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();

      const mappingJson = JSON.parse(result.mappingContent);
      expect(mappingJson.sourceFile).toBe('test.pdf');
      expect(mappingJson.entries).toHaveLength(1);
    });
  });

  describe('createFailedDownloadResult', () => {
    it('should create failed result with error', () => {
      const result = createFailedDownloadResult('test.pdf', 'File not found');

      expect(result.filename).toBe('test.pdf');
      expect(result.anonymizedContent).toBe('');
      expect(result.mappingContent).toBe('');
      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
    });
  });
});
