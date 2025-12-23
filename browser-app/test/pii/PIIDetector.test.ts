/**
 * PIIDetector Tests
 *
 * Tests for the main PII detector with pipeline integration.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PIIDetector } from '../../src/processing/PIIDetector';

// Mock the model module
vi.mock('../../src/model', () => ({
  isModelReady: vi.fn(() => false),
  isFallbackMode: vi.fn(() => true),
  runInference: vi.fn(() => Promise.resolve([])),
}));

// Mock the pipeline
vi.mock('@pii/DetectionPipeline', () => ({
  createPipeline: vi.fn(() => ({
    registerPass: vi.fn(),
    process: vi.fn((_text: string) => Promise.resolve({
      entities: [],
      documentType: 'UNKNOWN',
      metadata: {
        totalDurationMs: 100,
        passResults: [],
        entityCounts: {},
        flaggedCount: 0,
      },
    })),
  })),
  DetectionPipeline: vi.fn(),
}));

// Mock passes
vi.mock('@pii/passes/FormatValidationPass', () => ({
  createFormatValidationPass: vi.fn(() => ({
    name: 'FormatValidationPass',
    order: 20,
    enabled: true,
    execute: vi.fn((_, entities) => Promise.resolve(entities)),
  })),
  FormatValidationPass: vi.fn(),
}));

vi.mock('@pii/passes/ContextScoringPass', () => ({
  createContextScoringPass: vi.fn(() => ({
    name: 'ContextScoringPass',
    order: 30,
    enabled: true,
    execute: vi.fn((_, entities) => Promise.resolve(entities)),
  })),
  ContextScoringPass: vi.fn(),
}));

vi.mock('../../src/pii/BrowserHighRecallPass', () => ({
  createBrowserHighRecallPass: vi.fn(() => ({
    name: 'BrowserHighRecallPass',
    order: 10,
    enabled: true,
    execute: vi.fn((_, entities) => Promise.resolve(entities)),
  })),
  BrowserHighRecallPass: vi.fn(),
}));

describe('PIIDetector', () => {
  let detector: PIIDetector;

  beforeEach(() => {
    detector = new PIIDetector();
    vi.clearAllMocks();
  });

  afterEach(() => {
    detector.terminateWorker();
  });

  describe('Basic Detection', () => {
    it('should detect email addresses', async () => {
      const text = 'Contact: john.doe@example.com';
      const matches = await detector.detect(text);

      expect(matches.some(m => m.type === 'EMAIL')).toBe(true);
    });

    it('should detect Swiss phone numbers', async () => {
      const text = 'Tel: +41 79 123 45 67';
      const matches = await detector.detect(text);

      expect(matches.some(m => m.type === 'PHONE')).toBe(true);
    });

    it('should detect IBAN numbers', async () => {
      const text = 'IBAN: CH93 0076 2011 6238 5295 7';
      const matches = await detector.detect(text);

      expect(matches.some(m => m.type === 'IBAN')).toBe(true);
    });

    it('should detect Swiss AVS numbers', async () => {
      const text = 'AVS: 756.1234.5678.90';
      const matches = await detector.detect(text);

      expect(matches.some(m => m.type === 'SWISS_AVS')).toBe(true);
    });
  });

  describe('Sync Detection', () => {
    it('should provide synchronous detection', () => {
      const text = 'Email: test@example.com';
      const matches = detector.detectSync(text);

      expect(matches.some(m => m.type === 'EMAIL')).toBe(true);
    });
  });

  describe('Detection Mode', () => {
    it('should start in regex-only mode when model not ready', () => {
      expect(detector.getMode()).toBe('regex-only');
    });

    it('should allow setting detection mode', () => {
      detector.setMode('full');
      // Mode is set, but getMode() checks model readiness
      // Since model is mocked as not ready, it returns 'regex-only'
      expect(detector.getMode()).toBe('regex-only');
    });
  });

  describe('Pipeline Integration', () => {
    it('should initialize pipeline on first use', async () => {
      expect(detector.isPipelineReady()).toBe(false);

      await detector.initializePipeline();

      expect(detector.isPipelineReady()).toBe(true);
    });

    it('should detect with pipeline', async () => {
      await detector.initializePipeline();

      const result = await detector.detectWithPipeline('Test text');

      expect(result).toBeDefined();
      expect(result.entities).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should support progress callback', async () => {
      await detector.initializePipeline();

      const progressCalls: Array<{ progress: number; stage: string }> = [];

      await detector.detectWithPipeline('Test text', {
        onProgress: (progress, stage) => {
          progressCalls.push({ progress, stage });
        },
      });

      expect(progressCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Worker Integration', () => {
    it('should report worker not ready initially', () => {
      expect(detector.isWorkerReady()).toBe(false);
    });

    // Note: Web Worker tests require proper browser/worker environment
    // These tests verify the API surface
    it('should have worker initialization method', () => {
      expect(typeof detector.initializeWorker).toBe('function');
    });

    it('should have worker termination method', () => {
      expect(typeof detector.terminateWorker).toBe('function');
    });

    it('should have worker detection cancel method', () => {
      expect(typeof detector.cancelWorkerDetection).toBe('function');
    });
  });

  describe('Statistics', () => {
    it('should provide statistics for matches', async () => {
      const text = 'Email: a@b.com, Phone: +41 79 123 45 67';
      const matches = await detector.detect(text);

      const stats = detector.getStatistics(matches as unknown as import('@core/index').PIIMatch[]);

      expect(stats).toBeDefined();
      expect(typeof stats).toBe('object');
    });

    it('should provide extended statistics', async () => {
      const text = 'Email: a@b.com';
      const matches = await detector.detect(text);

      const extendedStats = detector.getExtendedStatistics(matches);

      expect(extendedStats.byType).toBeDefined();
      expect(extendedStats.bySource).toBeDefined();
      expect(extendedStats.total).toBeDefined();
    });
  });

  describe('Type Labels', () => {
    it('should return human-readable labels for types', () => {
      const label = detector.getTypeLabel('EMAIL');

      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text', async () => {
      const matches = await detector.detect('');
      expect(matches).toEqual([]);
    });

    it('should handle text with no PII', async () => {
      const matches = await detector.detect('Hello world');
      expect(matches.length).toBe(0);
    });

    it('should handle very long text', async () => {
      const longText = 'test@example.com '.repeat(1000);
      const matches = await detector.detect(longText);

      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe('Match Source Tracking', () => {
    it('should track match source as REGEX in fallback mode', async () => {
      const text = 'Email: test@example.com';
      const matches = await detector.detect(text);

      const emailMatch = matches.find(m => m.type === 'EMAIL');
      expect(emailMatch?.source).toBe('REGEX');
    });
  });
});
