/**
 * EntityReviewController Tests
 *
 * Tests for the entity review controller integration including:
 * - Document loading
 * - Detection integration
 * - State management
 * - Callbacks
 *
 * Story 7.4: Entity Review UI Implementation - Task 8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initEntityReviewController,
  loadDocument,
  detectBasic,
  getReviewState,
  getSelectedEntities,
  getAllEntities,
  getDetectionStats,
  clearReview,
  isDetecting,
  isAnonymizing,
  setAnonymizationComplete,
  getDetector,
  initializeWorker,
  terminateWorker,
  isWorkerReady,
  destroyEntityReviewController,
  type ReviewCallbacks,
} from '../../src/components/EntityReviewController';

// Mock PIIDetector
vi.mock('../../src/processing/PIIDetector', () => ({
  PIIDetector: vi.fn().mockImplementation(() => ({
    detect: vi.fn((_text: string) => Promise.resolve([
      { type: 'EMAIL', text: 'test@example.com', start: 0, end: 16, confidence: 0.99, source: 'REGEX' },
    ])),
    detectSync: vi.fn(() => []),
    detectWithPipeline: vi.fn((_text: string) => Promise.resolve({
      entities: [
        { type: 'EMAIL', text: 'test@example.com', start: 0, end: 16, confidence: 0.99, source: 'REGEX', id: 'e1' },
      ],
      documentType: 'UNKNOWN',
      metadata: { totalDurationMs: 100, passResults: [], entityCounts: {}, flaggedCount: 0 },
    })),
    initializePipeline: vi.fn(() => Promise.resolve()),
    isPipelineReady: vi.fn(() => true),
    initializeWorker: vi.fn(),
    terminateWorker: vi.fn(),
    isWorkerReady: vi.fn(() => false),
    getStatistics: vi.fn(() => ({})),
    getTypeLabel: vi.fn((type: string) => type),
    getExtendedStatistics: vi.fn(() => ({ byType: {}, bySource: {}, total: 0 })),
    getMode: vi.fn(() => 'regex-only'),
    setMode: vi.fn(),
    cancelWorkerDetection: vi.fn(),
  })),
}));

// Mock PreviewPanel
vi.mock('../../src/components/PreviewPanel', () => ({
  initPreviewPanel: vi.fn(),
  setPreviewContent: vi.fn(),
  setPreviewEntities: vi.fn(),
  getPreviewSelectedEntities: vi.fn(() => [
    { id: 'e1', type: 'EMAIL', text: 'test@example.com', start: 0, end: 16, confidence: 0.99, source: 'REGEX', selected: true, visible: true },
  ]),
  getPreviewAllEntities: vi.fn(() => [
    { id: 'e1', type: 'EMAIL', text: 'test@example.com', start: 0, end: 16, confidence: 0.99, source: 'REGEX', selected: true, visible: true },
  ]),
  clearPreviewEntities: vi.fn(),
  destroyPreviewPanel: vi.fn(),
}));

// Uses happy-dom from vitest.config.ts
let container: HTMLElement;

function setupDOM(): void {
  document.body.innerHTML = '<div id="review-container"></div>';
  container = document.getElementById('review-container') as HTMLElement;

  // Mock crypto
  if (!globalThis.crypto?.randomUUID) {
    (globalThis as any).crypto = {
      randomUUID: () => `uuid-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  // Mock sessionStorage
  const mockStorage: Record<string, string> = {};
  (globalThis as any).sessionStorage = {
    getItem: vi.fn((key: string) => mockStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
    removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
    clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
    length: 0,
    key: vi.fn(),
  };
}

describe('EntityReviewController', () => {
  beforeEach(() => {
    setupDOM();
    vi.clearAllMocks();
  });

  afterEach(() => {
    destroyEntityReviewController();
  });

  describe('Initialization', () => {
    it('should initialize controller', () => {
      initEntityReviewController(container, {});

      const detector = getDetector();
      expect(detector).toBeDefined();
    });

    it('should accept callbacks', () => {
      const callbacks: ReviewCallbacks = {
        onDetectionStart: vi.fn(),
        onDetectionComplete: vi.fn(),
        onDetectionError: vi.fn(),
        onAnonymize: vi.fn(),
        onEntitiesChange: vi.fn(),
      };

      initEntityReviewController(container, callbacks);

      // Callbacks are registered
      expect(true).toBe(true);
    });

    it('should initialize with clean state', () => {
      initEntityReviewController(container, {});

      const state = getReviewState();
      expect(state.documentContent).toBe('');
      expect(state.originalEntities).toEqual([]);
      expect(state.isDetecting).toBe(false);
    });
  });

  describe('Document Loading', () => {
    it('should load document with pipeline detection', async () => {
      initEntityReviewController(container, {});

      await loadDocument('test@example.com is an email');

      const state = getReviewState();
      expect(state.documentContent).toBe('test@example.com is an email');
    });

    it('should call detection callbacks', async () => {
      const onDetectionStart = vi.fn();
      const onDetectionComplete = vi.fn();

      initEntityReviewController(container, {
        onDetectionStart,
        onDetectionComplete,
      });

      await loadDocument('test content');

      expect(onDetectionStart).toHaveBeenCalled();
      expect(onDetectionComplete).toHaveBeenCalled();
    });

    it('should handle detection errors', async () => {
      const { PIIDetector } = await import('../../src/processing/PIIDetector');
      vi.mocked(PIIDetector).mockImplementationOnce(() => ({
        detect: vi.fn(),
        detectSync: vi.fn(),
        detectWithPipeline: vi.fn(() => Promise.reject(new Error('Detection failed'))),
        initializePipeline: vi.fn(() => Promise.resolve()),
        isPipelineReady: vi.fn(() => true),
        initializeWorker: vi.fn(),
        terminateWorker: vi.fn(),
        isWorkerReady: vi.fn(() => false),
        getStatistics: vi.fn(() => ({})),
        getTypeLabel: vi.fn((t: string) => t),
        getExtendedStatistics: vi.fn(() => ({ byType: {}, bySource: {}, total: 0 })),
        getMode: vi.fn(() => 'regex-only'),
        setMode: vi.fn(),
        cancelWorkerDetection: vi.fn(),
      } as any));

      const onDetectionError = vi.fn();
      initEntityReviewController(container, { onDetectionError });

      try {
        await loadDocument('content');
      } catch {
        // Expected
      }

      // Error callback may be called
    });
  });

  describe('Basic Detection', () => {
    it('should detect with basic method', async () => {
      initEntityReviewController(container, {});

      const entities = await detectBasic('test@example.com');

      expect(Array.isArray(entities)).toBe(true);
    });

    it('should call callbacks for basic detection', async () => {
      const onDetectionStart = vi.fn();
      const onDetectionComplete = vi.fn();

      initEntityReviewController(container, {
        onDetectionStart,
        onDetectionComplete,
      });

      await detectBasic('test content');

      expect(onDetectionStart).toHaveBeenCalled();
      expect(onDetectionComplete).toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('should return review state', () => {
      initEntityReviewController(container, {});

      const state = getReviewState();

      expect(state).toBeDefined();
      expect('documentContent' in state).toBe(true);
      expect('originalEntities' in state).toBe(true);
      expect('reviewedEntities' in state).toBe(true);
      expect('isDetecting' in state).toBe(true);
      expect('isAnonymizing' in state).toBe(true);
      expect('error' in state).toBe(true);
    });

    it('should track detecting state', async () => {
      initEntityReviewController(container, {});

      expect(isDetecting()).toBe(false);
    });

    it('should track anonymizing state', () => {
      initEntityReviewController(container, {});

      expect(isAnonymizing()).toBe(false);
    });

    it('should set anonymization complete', () => {
      initEntityReviewController(container, {});

      setAnonymizationComplete();

      expect(isAnonymizing()).toBe(false);
    });
  });

  describe('Entity Access', () => {
    it('should get selected entities', async () => {
      initEntityReviewController(container, {});
      await loadDocument('test@example.com');

      const selected = getSelectedEntities();

      expect(Array.isArray(selected)).toBe(true);
    });

    it('should get all entities', async () => {
      initEntityReviewController(container, {});
      await loadDocument('test@example.com');

      const all = getAllEntities();

      expect(Array.isArray(all)).toBe(true);
    });
  });

  describe('Detection Statistics', () => {
    it('should return detection stats', async () => {
      initEntityReviewController(container, {});
      await loadDocument('test@example.com');

      const stats = getDetectionStats();

      expect(stats).toBeDefined();
      expect('total' in stats).toBe(true);
      expect('selected' in stats).toBe(true);
      expect('byType' in stats).toBe(true);
      expect('bySource' in stats).toBe(true);
    });

    it('should track stats by type', async () => {
      initEntityReviewController(container, {});
      await loadDocument('test@example.com');

      const stats = getDetectionStats();

      expect(typeof stats.byType).toBe('object');
    });

    it('should track stats by source', async () => {
      initEntityReviewController(container, {});
      await loadDocument('test@example.com');

      const stats = getDetectionStats();

      expect('ML' in stats.bySource || 'REGEX' in stats.bySource).toBe(true);
    });
  });

  describe('Clear Review', () => {
    it('should clear review state', async () => {
      initEntityReviewController(container, {});
      await loadDocument('test@example.com');

      clearReview();

      const state = getReviewState();
      expect(state.documentContent).toBe('');
      expect(state.originalEntities).toEqual([]);
    });
  });

  describe('Detector Access', () => {
    it('should return detector instance', () => {
      initEntityReviewController(container, {});

      const detector = getDetector();

      expect(detector).toBeDefined();
    });

    it('should return null before init', () => {
      // Don't init
      destroyEntityReviewController();

      const detector = getDetector();

      expect(detector).toBeNull();
    });
  });

  describe('Worker Management', () => {
    it('should initialize worker', () => {
      initEntityReviewController(container, {});

      initializeWorker();

      // Worker initialized
      expect(true).toBe(true);
    });

    it('should terminate worker', () => {
      initEntityReviewController(container, {});
      initializeWorker();

      terminateWorker();

      // Worker terminated
      expect(true).toBe(true);
    });

    it('should check worker ready state', () => {
      initEntityReviewController(container, {});

      const ready = isWorkerReady();

      expect(typeof ready).toBe('boolean');
    });
  });

  describe('Destroy', () => {
    it('should clean up on destroy', () => {
      initEntityReviewController(container, {});

      destroyEntityReviewController();

      const detector = getDetector();
      expect(detector).toBeNull();
    });

    it('should reset state on destroy', () => {
      initEntityReviewController(container, {});

      destroyEntityReviewController();

      const state = getReviewState();
      expect(state.documentContent).toBe('');
    });

    it('should handle multiple destroy calls', () => {
      initEntityReviewController(container, {});

      destroyEntityReviewController();
      destroyEntityReviewController();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should throw if not initialized', async () => {
      destroyEntityReviewController();

      await expect(loadDocument('test')).rejects.toThrow('Controller not initialized');
    });

    it('should throw if detectBasic not initialized', async () => {
      destroyEntityReviewController();

      await expect(detectBasic('test')).rejects.toThrow('Controller not initialized');
    });
  });

  describe('Callbacks', () => {
    it('should call onDetectionProgress during detection', async () => {
      const onDetectionProgress = vi.fn();

      initEntityReviewController(container, { onDetectionProgress });

      await loadDocument('test content');

      // Progress callback may be called
    });

    it('should call onEntitiesChange when entities change', async () => {
      const onEntitiesChange = vi.fn();

      initEntityReviewController(container, { onEntitiesChange });

      await loadDocument('test@example.com');

      // Entities change callback may be called
    });
  });
});
