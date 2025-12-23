/**
 * File Downloader Module
 *
 * Handles downloading anonymized files and mapping files using browser APIs.
 * Builds on existing download utilities with anonymization-specific functions.
 *
 * Story 7.5: File Download & Batch Processing - AC #1, #2
 */

import { downloadFile } from '../utils/download';
import type { MappingEntry } from '../types';

/**
 * Download result for a single file
 */
export interface DownloadResult {
  filename: string;
  anonymizedContent: string;
  mappingContent: string;
  success: boolean;
  error?: string;
}

/**
 * Mapping file structure for JSON export
 */
export interface MappingFileContent {
  version: string;
  generatedAt: string;
  sourceFile: string;
  totalReplacements: number;
  entries: MappingEntry[];
}

/**
 * Download an anonymized Markdown file
 *
 * @param content - The anonymized markdown content
 * @param filename - Original filename (will be prefixed with 'anonymized-')
 */
export function downloadAnonymizedFile(content: string, filename: string): void {
  const anonymizedFilename = createAnonymizedFilename(filename);
  downloadFile(content, anonymizedFilename, 'text/markdown');
}

/**
 * Download a mapping file as JSON
 *
 * @param mapping - Array of mapping entries
 * @param sourceFilename - Original source filename for reference
 */
export function downloadMappingFile(
  mapping: MappingEntry[],
  sourceFilename: string,
): void {
  const mappingContent: MappingFileContent = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    sourceFile: sourceFilename,
    totalReplacements: mapping.reduce((sum, entry) => sum + entry.occurrences, 0),
    entries: mapping,
  };

  const jsonContent = JSON.stringify(mappingContent, null, 2);
  const mappingFilename = createMappingFilename(sourceFilename);

  downloadFile(jsonContent, mappingFilename, 'application/json');
}

/**
 * Download both anonymized file and mapping file together
 *
 * @param anonymizedContent - The anonymized content
 * @param mapping - The PII mapping table
 * @param sourceFilename - Original source filename
 */
export function downloadAnonymizedWithMapping(
  anonymizedContent: string,
  mapping: MappingEntry[],
  sourceFilename: string,
): void {
  // Download anonymized file
  downloadAnonymizedFile(anonymizedContent, sourceFilename);

  // Small delay to prevent browser blocking multiple downloads
  setTimeout(() => {
    downloadMappingFile(mapping, sourceFilename);
  }, 100);
}

/**
 * Create the anonymized filename from the original
 *
 * @param originalFilename - Original file name
 * @returns Anonymized filename with .md extension
 */
export function createAnonymizedFilename(originalFilename: string): string {
  const baseName = getBaseFilename(originalFilename);
  return `anonymized-${baseName}.md`;
}

/**
 * Create the mapping filename from the original
 *
 * @param originalFilename - Original file name
 * @returns Mapping filename with .json extension
 */
export function createMappingFilename(originalFilename: string): string {
  const baseName = getBaseFilename(originalFilename);
  return `${baseName}-mapping.json`;
}

/**
 * Get base filename without extension
 *
 * @param filename - Full filename with extension
 * @returns Filename without extension
 */
export function getBaseFilename(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

/**
 * Generate a timestamped filename for downloads
 *
 * @param prefix - Filename prefix
 * @param extension - File extension (without dot)
 * @returns Timestamped filename
 */
export function generateTimestampedFilename(prefix: string, extension: string): string {
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15); // YYYYMMDD-HHMMSS

  return `${prefix}-${timestamp}.${extension}`;
}

/**
 * Prepare download result object from anonymization output
 *
 * @param sourceFilename - Original source filename
 * @param anonymizedContent - Anonymized content
 * @param mapping - Mapping entries
 * @returns Download result object
 */
export function prepareDownloadResult(
  sourceFilename: string,
  anonymizedContent: string,
  mapping: MappingEntry[],
): DownloadResult {
  const mappingContent: MappingFileContent = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    sourceFile: sourceFilename,
    totalReplacements: mapping.reduce((sum, entry) => sum + entry.occurrences, 0),
    entries: mapping,
  };

  return {
    filename: sourceFilename,
    anonymizedContent,
    mappingContent: JSON.stringify(mappingContent, null, 2),
    success: true,
  };
}

/**
 * Create a failed download result
 *
 * @param sourceFilename - Source filename that failed
 * @param error - Error message
 * @returns Failed download result
 */
export function createFailedDownloadResult(
  sourceFilename: string,
  error: string,
): DownloadResult {
  return {
    filename: sourceFilename,
    anonymizedContent: '',
    mappingContent: '',
    success: false,
    error,
  };
}
