/**
 * ZIP Download Module
 *
 * Creates and downloads ZIP archives for batch processing results.
 * Organizes files in folders (anonymized/, mappings/) with optional error log.
 *
 * Story 7.5: File Download & Batch Processing - AC #4
 */

import JSZip from 'jszip';
import type { BatchItem } from '../batch/BatchQueueManager';
import { createAnonymizedFilename, createMappingFilename, generateTimestampedFilename } from './FileDownloader';

/**
 * Batch result for ZIP creation
 */
export interface BatchResult {
  filename: string;
  anonymizedContent: string;
  mappingContent: string;
  success: boolean;
  error?: string;
}

/**
 * ZIP creation options
 */
export interface ZipOptions {
  includeErrorLog?: boolean;
  compressionLevel?: number; // 0-9
  folderStructure?: 'flat' | 'organized'; // flat = all files in root, organized = folders
}

/**
 * Create a ZIP archive from batch results
 *
 * @param results - Array of batch processing results
 * @param options - ZIP creation options
 * @returns Promise resolving to Blob containing the ZIP
 */
export async function createBatchZip(
  results: BatchResult[],
  options: ZipOptions = {},
): Promise<Blob> {
  const {
    includeErrorLog = true,
    compressionLevel = 6,
    folderStructure = 'organized',
  } = options;

  const zip = new JSZip();

  // Separate successful and failed results
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  // Add successful files
  for (const result of successful) {
    const anonymizedFilename = createAnonymizedFilename(result.filename);
    const mappingFilename = createMappingFilename(result.filename);

    if (folderStructure === 'organized') {
      // Organized folder structure
      zip.file(`anonymized/${anonymizedFilename}`, result.anonymizedContent);
      zip.file(`mappings/${mappingFilename}`, result.mappingContent);
    } else {
      // Flat structure
      zip.file(anonymizedFilename, result.anonymizedContent);
      zip.file(mappingFilename, result.mappingContent);
    }
  }

  // Add error log if there are failures
  if (includeErrorLog && failed.length > 0) {
    const errorLog = createErrorLog(failed);
    zip.file('errors.log', errorLog);
  }

  // Generate the ZIP blob
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: {
      level: compressionLevel,
    },
  });

  return blob;
}

/**
 * Create ZIP from batch items (BatchQueueManager format)
 *
 * @param items - Array of completed batch items
 * @param options - ZIP creation options
 * @returns Promise resolving to Blob containing the ZIP
 */
export async function createBatchZipFromItems(
  items: BatchItem[],
  options: ZipOptions = {},
): Promise<Blob> {
  const results: BatchResult[] = items.map(item => ({
    filename: item.filename,
    anonymizedContent: item.result?.anonymizedContent || '',
    mappingContent: item.result?.mapping
      ? JSON.stringify({
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        sourceFile: item.filename,
        totalReplacements: item.result.mapping.reduce((sum, e) => sum + e.occurrences, 0),
        entries: item.result.mapping,
      }, null, 2)
      : '',
    success: item.status === 'completed',
    error: item.error,
  }));

  return createBatchZip(results, options);
}

/**
 * Download a batch ZIP file
 *
 * @param results - Array of batch processing results
 * @param options - ZIP creation options
 */
export async function downloadBatchZip(
  results: BatchResult[],
  options: ZipOptions = {},
): Promise<void> {
  const blob = await createBatchZip(results, options);
  const filename = generateTimestampedFilename('pii-anonymized', 'zip');

  triggerBlobDownload(blob, filename);
}

/**
 * Download a batch ZIP from batch items
 *
 * @param items - Array of completed batch items
 * @param options - ZIP creation options
 */
export async function downloadBatchZipFromItems(
  items: BatchItem[],
  options: ZipOptions = {},
): Promise<void> {
  const blob = await createBatchZipFromItems(items, options);
  const filename = generateTimestampedFilename('pii-anonymized', 'zip');

  triggerBlobDownload(blob, filename);
}

/**
 * Create error log content
 *
 * @param failedResults - Array of failed results
 * @returns Error log content as string
 */
function createErrorLog(failedResults: BatchResult[]): string {
  const lines = [
    '# PII Anonymizer - Error Log',
    `# Generated: ${new Date().toISOString()}`,
    `# Total Failures: ${failedResults.length}`,
    '',
    '---',
    '',
  ];

  for (const result of failedResults) {
    lines.push(`File: ${result.filename}`);
    lines.push(`Error: ${result.error || 'Unknown error'}`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Trigger a blob download in the browser
 *
 * @param blob - The blob to download
 * @param filename - Download filename
 */
function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Cleanup
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

/**
 * Get the size of a ZIP blob
 *
 * @param blob - The ZIP blob
 * @returns Formatted size string
 */
export function getZipSize(blob: Blob): string {
  const bytes = blob.size;
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Count files in a ZIP without extracting
 *
 * @param results - Batch results
 * @param options - ZIP options
 * @returns Object with file counts
 */
export function countZipFiles(
  results: BatchResult[],
  options: ZipOptions = {},
): { total: number; anonymized: number; mappings: number; errors: number } {
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const includeErrorLog = options.includeErrorLog !== false && failed > 0;

  return {
    total: successful * 2 + (includeErrorLog ? 1 : 0),
    anonymized: successful,
    mappings: successful,
    errors: includeErrorLog ? 1 : 0,
  };
}
