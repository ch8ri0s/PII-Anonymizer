/**
 * IPC (Inter-Process Communication) Type Definitions
 *
 * Defines the type-safe API surface for Electron IPC communication
 * between renderer and main processes.
 */

import type { FileMetadata, FileMetadataError } from './fileMetadata';
import type { FilePreview, FilePreviewError, PreviewOptions } from './filePreview';

/**
 * Electron API exposed to renderer via contextBridge
 */
export interface ElectronAPI {
  /**
   * Get file metadata including stats and text analysis
   * @param filePath Absolute path to the file
   * @returns FileMetadata on success, FileMetadataError on failure
   */
  getFileMetadata(filePath: string): Promise<FileMetadata | FileMetadataError>;

  /**
   * Get content preview (first N lines or M characters)
   * @param filePath Absolute path to the file
   * @param limit Preview length limits
   * @returns FilePreview on success, FilePreviewError on failure
   */
  getFilePreview(
    filePath: string,
    limit: PreviewOptions
  ): Promise<FilePreview | FilePreviewError>;

  /**
   * Open file selection dialog
   * @param options Dialog configuration
   * @returns Array of selected file paths, or null if cancelled
   */
  selectFiles(options: FileDialogOptions): Promise<string[] | null>;
}

/**
 * File dialog options
 */
export interface FileDialogOptions {
  /** Allow multiple file selection */
  allowMultiple: boolean;

  /** File type filters */
  filters: Array<{
    name: string;
    extensions: string[];
  }>;
}

/**
 * Global type augmentation for window.electronAPI
 */
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
