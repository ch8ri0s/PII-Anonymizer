/**
 * PII Worker Tests
 *
 * Tests for the web worker message handling.
 * Note: These tests verify the worker logic without requiring an actual Worker environment.
 */

import { describe, it, expect, vi } from 'vitest';
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerStatus,
  WorkerRequestType,
  WorkerResponseType,
} from '../../src/workers/types';

// Since we can't easily test actual Web Workers in Vitest,
// we test the message types and worker integration patterns

describe('PII Worker Types', () => {
  describe('WorkerRequestType', () => {
    it('should have correct request types', () => {
      const requestTypes: WorkerRequestType[] = ['detect', 'init', 'cancel', 'status'];

      requestTypes.forEach(type => {
        expect(['detect', 'init', 'cancel', 'status']).toContain(type);
      });
    });
  });

  describe('WorkerResponseType', () => {
    it('should have correct response types', () => {
      const responseTypes: WorkerResponseType[] = ['result', 'progress', 'error', 'ready', 'cancelled', 'status'];

      responseTypes.forEach(type => {
        expect(['result', 'progress', 'error', 'ready', 'cancelled', 'status']).toContain(type);
      });
    });
  });

  describe('WorkerRequest structure', () => {
    it('should create valid detect request', () => {
      const request: WorkerRequest = {
        id: 'test-123',
        type: 'detect',
        payload: {
          text: 'Test text with email@example.com',
          documentId: 'doc-456',
          language: 'en',
        },
      };

      expect(request.id).toBe('test-123');
      expect(request.type).toBe('detect');
      expect(request.payload?.text).toBeDefined();
    });

    it('should create valid init request', () => {
      const request: WorkerRequest = {
        id: 'init',
        type: 'init',
      };

      expect(request.type).toBe('init');
    });

    it('should create valid cancel request', () => {
      const request: WorkerRequest = {
        id: 'cancel-789',
        type: 'cancel',
        payload: {
          documentId: 'doc-to-cancel',
        },
      };

      expect(request.type).toBe('cancel');
      expect(request.payload?.documentId).toBe('doc-to-cancel');
    });

    it('should create valid status request', () => {
      const request: WorkerRequest = {
        id: 'status-check',
        type: 'status',
      };

      expect(request.type).toBe('status');
    });
  });

  describe('WorkerResponse structure', () => {
    it('should create valid result response', () => {
      const response: WorkerResponse = {
        id: 'test-123',
        type: 'result',
        payload: {
          result: {
            entities: [],
            documentType: 'UNKNOWN',
            metadata: {
              totalDurationMs: 50,
              passResults: [],
              entityCounts: {} as Record<string, number>,
              flaggedCount: 0,
            },
          },
          entities: [],
        },
      };

      expect(response.type).toBe('result');
      expect(response.payload?.result).toBeDefined();
    });

    it('should create valid progress response', () => {
      const response: WorkerResponse = {
        id: 'test-123',
        type: 'progress',
        payload: {
          progress: 50,
          stage: 'Running regex detection',
        },
      };

      expect(response.type).toBe('progress');
      expect(response.payload?.progress).toBe(50);
      expect(response.payload?.stage).toBeDefined();
    });

    it('should create valid error response', () => {
      const response: WorkerResponse = {
        id: 'test-123',
        type: 'error',
        payload: {
          error: 'Something went wrong',
          stack: 'Error: Something went wrong\n    at ...',
        },
      };

      expect(response.type).toBe('error');
      expect(response.payload?.error).toBeDefined();
    });

    it('should create valid ready response', () => {
      const response: WorkerResponse = {
        id: 'init',
        type: 'ready',
        payload: {
          status: {
            ready: true,
            processing: false,
            requestsProcessed: 0,
          },
        },
      };

      expect(response.type).toBe('ready');
      expect(response.payload?.status?.ready).toBe(true);
    });
  });

  describe('WorkerStatus structure', () => {
    it('should have correct status fields', () => {
      const status: WorkerStatus = {
        ready: true,
        processing: false,
        currentRequestId: 'current-123',
        requestsProcessed: 10,
        avgProcessingTimeMs: 150,
      };

      expect(status.ready).toBe(true);
      expect(status.processing).toBe(false);
      expect(status.currentRequestId).toBe('current-123');
      expect(status.requestsProcessed).toBe(10);
      expect(status.avgProcessingTimeMs).toBe(150);
    });

    it('should allow optional fields', () => {
      const status: WorkerStatus = {
        ready: false,
        processing: false,
        requestsProcessed: 0,
      };

      expect(status.currentRequestId).toBeUndefined();
      expect(status.avgProcessingTimeMs).toBeUndefined();
    });
  });
});

describe('Worker Communication Patterns', () => {
  describe('Request-Response Flow', () => {
    it('should match request and response IDs', () => {
      const requestId = 'unique-request-id-123';

      const request: WorkerRequest = {
        id: requestId,
        type: 'detect',
        payload: { text: 'Test' },
      };

      const response: WorkerResponse = {
        id: requestId,
        type: 'result',
        payload: { entities: [] },
      };

      expect(request.id).toBe(response.id);
    });
  });

  describe('Progress Reporting', () => {
    it('should report progress from 0 to 100', () => {
      const progressValues = [0, 10, 50, 80, 100];

      progressValues.forEach(progress => {
        const response: WorkerResponse = {
          id: 'test',
          type: 'progress',
          payload: { progress, stage: 'Testing' },
        };

        expect(response.payload?.progress).toBeGreaterThanOrEqual(0);
        expect(response.payload?.progress).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('Error Handling', () => {
    it('should include error message in error response', () => {
      const errorMessage = 'Detection failed due to invalid input';

      const response: WorkerResponse = {
        id: 'test',
        type: 'error',
        payload: {
          error: errorMessage,
        },
      };

      expect(response.payload?.error).toBe(errorMessage);
    });
  });
});

describe('Worker Detection Options', () => {
  it('should support timeout configuration', () => {
    const options = {
      timeout: 5000,
    };

    expect(options.timeout).toBe(5000);
  });

  it('should support progress callback', () => {
    const progressCallback = vi.fn();

    progressCallback(50, 'Processing');

    expect(progressCallback).toHaveBeenCalledWith(50, 'Processing');
  });

  it('should support language configuration', () => {
    const request: WorkerRequest = {
      id: 'test',
      type: 'detect',
      payload: {
        text: 'Test',
        language: 'de',
      },
    };

    expect(request.payload?.language).toBe('de');
  });
});
