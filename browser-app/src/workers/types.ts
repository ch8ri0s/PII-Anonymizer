/**
 * PII Detection Worker Types (Story 7.3, Task 8)
 *
 * Message types for communication between main thread and PII detection worker.
 */

import type { Entity, DetectionResult, PipelineConfig } from '../types/detection.js';

/**
 * Message types from main thread to worker
 */
export type WorkerRequestType = 'detect' | 'init' | 'cancel' | 'status';

/**
 * Message types from worker to main thread
 */
export type WorkerResponseType = 'result' | 'progress' | 'error' | 'ready' | 'cancelled' | 'status';

/**
 * Request message to worker
 */
export interface WorkerRequest {
  id: string;
  type: WorkerRequestType;
  payload?: WorkerRequestPayload;
}

/**
 * Payload for different request types
 */
export interface WorkerRequestPayload {
  /** Text to process (for 'detect') */
  text?: string;
  /** Optional document ID */
  documentId?: string;
  /** Optional document language */
  language?: 'en' | 'fr' | 'de';
  /** Pipeline configuration overrides */
  config?: Partial<PipelineConfig>;
}

/**
 * Response message from worker
 */
export interface WorkerResponse {
  id: string;
  type: WorkerResponseType;
  payload?: WorkerResponsePayload;
}

/**
 * Payload for different response types
 */
export interface WorkerResponsePayload {
  /** Detection result (for 'result') */
  result?: DetectionResult;
  /** Detected entities */
  entities?: Entity[];
  /** Progress percentage 0-100 (for 'progress') */
  progress?: number;
  /** Current processing stage */
  stage?: string;
  /** Error message (for 'error') */
  error?: string;
  /** Error stack trace */
  stack?: string;
  /** Worker status info (for 'status') */
  status?: WorkerStatus;
}

/**
 * Worker status information
 */
export interface WorkerStatus {
  /** Whether worker is ready to process */
  ready: boolean;
  /** Whether worker is currently processing */
  processing: boolean;
  /** Current processing request ID if any */
  currentRequestId?: string;
  /** Number of requests processed */
  requestsProcessed: number;
  /** Average processing time in ms */
  avgProcessingTimeMs?: number;
}

/**
 * Progress callback type for external use
 */
export type ProgressCallback = (progress: number, stage: string) => void;

/**
 * Detection options for worker
 */
export interface WorkerDetectionOptions {
  /** Pipeline configuration */
  config?: Partial<PipelineConfig>;
  /** Progress callback */
  onProgress?: ProgressCallback;
  /** Timeout in milliseconds */
  timeout?: number;
}
