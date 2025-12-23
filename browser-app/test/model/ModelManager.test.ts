/**
 * ModelManager Tests
 *
 * Tests for ML model loading, caching, and fallback behavior.
 * Uses mocks to avoid actual model downloads during testing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getModelStatus,
  isModelReady,
  isFallbackMode,
  loadModel,
  cancelLoading,
  reset,
  runInference,
  getModelDisplayName,
} from '../../src/model/ModelManager';
import { MODEL_NAME, DEFAULT_MODEL_CONFIG } from '../../src/model/types';

// Mock @huggingface/transformers (v3)
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(),
  env: {
    useBrowserCache: false,
    allowRemoteModels: true,
    allowLocalModels: false,
  },
}));

describe('ModelManager', () => {
  beforeEach(() => {
    reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    reset();
  });

  describe('Initial State', () => {
    it('should start with model not ready', () => {
      expect(isModelReady()).toBe(false);
    });

    it('should start with fallback mode disabled', () => {
      expect(isFallbackMode()).toBe(false);
    });

    it('should have correct initial status', () => {
      const status = getModelStatus();
      expect(status.exists).toBe(false);
      expect(status.loading).toBe(false);
      expect(status.ready).toBe(false);
      expect(status.fallbackMode).toBe(false);
    });
  });

  describe('loadModel()', () => {
    it('should call progress callback during loading', async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const mockPipeline = vi.fn().mockResolvedValue(() => []);
      (pipeline as ReturnType<typeof vi.fn>).mockImplementation(mockPipeline);

      const progressCallback = vi.fn();
      await loadModel(progressCallback);

      // Should be called at least once (for initiate)
      expect(progressCallback).toHaveBeenCalled();
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'initiate',
        }),
      );
    });

    it('should set model ready on success', async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const mockPipeline = vi.fn().mockResolvedValue(() => []);
      (pipeline as ReturnType<typeof vi.fn>).mockImplementation(mockPipeline);

      const result = await loadModel();

      expect(result.success).toBe(true);
      expect(result.fallbackMode).toBe(false);
      expect(isModelReady()).toBe(true);
    });

    it('should enable fallback mode on error when allowed', async () => {
      const { pipeline } = await import('@huggingface/transformers');
      (pipeline as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const result = await loadModel(undefined, { allowFallback: true });

      expect(result.success).toBe(false);
      expect(result.fallbackMode).toBe(true);
      expect(isFallbackMode()).toBe(true);
      expect(result.error).toContain('Network error');
    });

    it('should not enable fallback mode when not allowed', async () => {
      const { pipeline } = await import('@huggingface/transformers');
      (pipeline as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

      const result = await loadModel(undefined, { allowFallback: false });

      expect(result.success).toBe(false);
      expect(result.fallbackMode).toBe(false);
      expect(isFallbackMode()).toBe(false);
    });

    it('should deduplicate concurrent load requests', async () => {
      const { pipeline } = await import('@huggingface/transformers');
      let callCount = 0;
      (pipeline as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        return Promise.resolve(() => []);
      });

      // Call loadModel twice concurrently
      const [result1, result2] = await Promise.all([loadModel(), loadModel()]);

      // Both should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Pipeline should only be called once due to deduplication
      expect(callCount).toBe(1);
    });

    it('should return success immediately if already loaded', async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const mockPipeline = vi.fn().mockResolvedValue(() => []);
      (pipeline as ReturnType<typeof vi.fn>).mockImplementation(mockPipeline);

      // First load
      await loadModel();
      expect(isModelReady()).toBe(true);

      // Second load should return immediately
      const result = await loadModel();
      expect(result.success).toBe(true);

      // Pipeline should only be called once
      expect(mockPipeline).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancelLoading()', () => {
    it('should enable fallback mode when cancelled during loading', async () => {
      const { pipeline } = await import('@huggingface/transformers');
      let resolveLoad: (() => void) | undefined;
      const slowPromise = new Promise<() => []>((resolve) => {
        resolveLoad = () => resolve(() => []);
      });
      (pipeline as ReturnType<typeof vi.fn>).mockReturnValue(slowPromise);

      // Start loading (don't await)
      const loadPromise = loadModel();

      // Cancel while loading
      cancelLoading();

      // Check status
      expect(isFallbackMode()).toBe(true);

      // Clean up
      if (resolveLoad) {
        resolveLoad();
      }
      try {
        await loadPromise;
      } catch {
        // Expected - cancelled
      }
    });
  });

  describe('runInference()', () => {
    it('should throw if model not loaded and not in fallback mode', async () => {
      reset();
      await expect(runInference('test text')).rejects.toThrow('Model not loaded');
    });

    it('should return empty array in fallback mode', async () => {
      const { pipeline } = await import('@huggingface/transformers');
      (pipeline as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Failed'));

      // Enable fallback mode
      await loadModel(undefined, { allowFallback: true });
      expect(isFallbackMode()).toBe(true);

      // Should return empty array
      const result = await runInference('John Smith lives in Zurich');
      expect(result).toEqual([]);
    });

    it('should return ML results when model is loaded', async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const mockResults = [
        { word: 'John', entity: 'B-PER', score: 0.95, start: 0, end: 4 },
        { word: 'Smith', entity: 'I-PER', score: 0.92, start: 5, end: 10 },
      ];
      const mockPipelineFn = vi.fn().mockResolvedValue(mockResults);
      (pipeline as ReturnType<typeof vi.fn>).mockResolvedValue(mockPipelineFn);

      await loadModel();
      const result = await runInference('John Smith');

      expect(mockPipelineFn).toHaveBeenCalledWith('John Smith');
      expect(result).toEqual(mockResults);
    });
  });

  describe('getModelDisplayName()', () => {
    it('should return the model name without org prefix', () => {
      const displayName = getModelDisplayName();
      expect(displayName).toBe('distilbert-base-multilingual-cased-ner-hrl');
    });
  });

  describe('reset()', () => {
    it('should reset all state to initial values', async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const mockPipeline = vi.fn().mockResolvedValue(() => []);
      (pipeline as ReturnType<typeof vi.fn>).mockImplementation(mockPipeline);

      // Load model
      await loadModel();
      expect(isModelReady()).toBe(true);

      // Reset
      reset();

      // Verify reset
      expect(isModelReady()).toBe(false);
      expect(isFallbackMode()).toBe(false);
      const status = getModelStatus();
      expect(status.exists).toBe(false);
      expect(status.loading).toBe(false);
    });
  });
});

describe('Model Types', () => {
  it('should have correct MODEL_NAME', () => {
    expect(MODEL_NAME).toBe('Xenova/distilbert-base-multilingual-cased-ner-hrl');
  });

  it('should have correct default config', () => {
    expect(DEFAULT_MODEL_CONFIG.useBrowserCache).toBe(true);
    expect(DEFAULT_MODEL_CONFIG.allowFallback).toBe(true);
    expect(DEFAULT_MODEL_CONFIG.loadTimeout).toBe(120_000);
  });
});
