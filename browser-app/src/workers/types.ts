/**
 * PII Detection Worker Types (Story 7.3, Task 8)
 *
 * Message types for communication between main thread and PII detection worker.
 */

import type { Entity, DetectionResult, PipelineConfig } from '../types/detection.js';

/**
 * Message types from main thread to worker
 * Story 8.15: Added 'ml_inference' for Web Worker ML inference
 */
export type WorkerRequestType = 'detect' | 'init' | 'cancel' | 'status' | 'ml_inference';

/**
 * Message types from worker to main thread
 * Story 8.15: Added 'ml_result' for ML inference results
 */
export type WorkerResponseType = 'result' | 'progress' | 'error' | 'ready' | 'cancelled' | 'status' | 'ml_result';

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
  /** Text to process (for 'detect' and 'ml_inference') */
  text?: string;
  /** Optional document ID */
  documentId?: string;
  /** Optional document language */
  language?: 'en' | 'fr' | 'de';
  /** Pipeline configuration overrides */
  config?: Partial<PipelineConfig>;
  /** ML inference threshold (Story 8.15) */
  threshold?: number;
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
 * ML prediction result from transformers.js (Story 8.15)
 */
export interface MLPrediction {
  word: string;
  entity: string;
  score: number;
  start: number;
  end: number;
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
  /** ML predictions (for 'ml_result', Story 8.15) */
  predictions?: MLPrediction[];
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
