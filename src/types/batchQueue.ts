/**
 * Batch Queue Item
 *
 * Represents a single file in the batch processing queue.
 */
export interface BatchQueueItem {
  /** Unique identifier for queue item */
  id: string;

  /** Absolute file path */
  filePath: string;

  /** Base filename for display */
  filename: string;

  /** Current processing status */
  status: BatchFileStatus;

  /** File metadata (loaded after selection) */
  metadata?: {
    fileSize: number;
    fileSizeFormatted: string;
    lineCount: number;
    wordCount: number;
  };

  /** Error message if processing failed */
  error?: string;

  /** Timestamp when added to queue */
  addedAt: Date;

  /** Timestamp when processing started */
  startedAt?: Date;

  /** Timestamp when processing completed */
  completedAt?: Date;
}

/**
 * Batch file processing status
 */
export type BatchFileStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Batch Queue State
 *
 * Represents the overall state of the batch processing queue.
 */
export interface BatchQueueState {
  /** Array of queue items */
  items: BatchQueueItem[];

  /** Currently selected item ID */
  selectedItemId: string | null;

  /** Overall batch processing status */
  batchStatus: 'idle' | 'processing' | 'paused' | 'completed';

  /** Index of currently processing file (0-based) */
  currentFileIndex: number;

  /** Total number of files in queue */
  totalFiles: number;

  /** Number of completed files */
  completedFiles: number;

  /** Number of failed files */
  failedFiles: number;
}

/**
 * Batch Progress Information
 */
export interface BatchProgress {
  /** Current file index (1-based for display) */
  currentFile: number;

  /** Total files in batch */
  totalFiles: number;

  /** Current file progress (0-100) */
  currentFileProgress: number;

  /** Overall batch progress (0-100) */
  overallProgress: number;

  /** Current file being processed */
  currentFilename: string;

  /** Estimated time remaining (seconds, optional) */
  estimatedTimeRemaining?: number;
}
