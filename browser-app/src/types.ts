/**
 * Types for Browser-based PII Anonymizer
 *
 * Re-exports shared types from @core and defines browser-specific types.
 */

// Re-export shared types from core
export type { PIIMatch, FormattedMatch } from '@core/index';
export type { PIIEntity, MappingFile } from '@core/index';
export type { AddressEntry, AddressEntityInput } from '@core/index';

// Browser-specific types

export interface FileInfo {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: FileStatus;
  progress: number;
  result?: ProcessingResult;
  error?: string;
}

export type FileStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface ProcessingResult {
  markdown: string;
  anonymizedMarkdown: string;
  piiMatches: import('@core/index').PIIMatch[];
  mappingTable: MappingEntry[];
  stats: Record<string, number>;
}

export interface MappingEntry {
  original: string;
  replacement: string;
  type: string;
  occurrences: number;
}

export type ModelLoadProgress = (progress: number, status: string) => void;
