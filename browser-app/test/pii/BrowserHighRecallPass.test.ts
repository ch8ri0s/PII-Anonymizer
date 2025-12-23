/**
 * BrowserHighRecallPass Tests
 *
 * Tests for the browser-compatible high-recall detection pass.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserHighRecallPass, createBrowserHighRecallPass } from '../../src/pii/BrowserHighRecallPass';
import type { PipelineContext, Entity } from '../../src/types/detection.js';

// Mock the model module
vi.mock('../../src/model', () => ({
  isModelReady: vi.fn(() => false),
  isFallbackMode: vi.fn(() => true),
  runInference: vi.fn(() => Promise.resolve([])),
}));

describe('BrowserHighRecallPass', () => {
  let pass: BrowserHighRecallPass;
  let context: PipelineContext;

  beforeEach(() => {
    pass = createBrowserHighRecallPass(0.3);
    context = {
      documentId: 'test-doc',
      language: 'en',
      metadata: {},
      passResults: new Map(),
      startTime: Date.now(),
    };
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create pass with correct name', () => {
      expect(pass.name).toBe('BrowserHighRecallPass');
    });

    it('should have order 10', () => {
      expect(pass.order).toBe(10);
    });

    it('should be enabled by default', () => {
      expect(pass.enabled).toBe(true);
    });

    it('should accept custom ML threshold', () => {
      const customPass = createBrowserHighRecallPass(0.5);
      expect(customPass).toBeInstanceOf(BrowserHighRecallPass);
    });
  });

  describe('Regex Detection', () => {
    it('should detect Swiss AVS numbers', async () => {
      const text = 'AVS: 756.1234.5678.90';
      const entities = await pass.execute(text, [], context);

      expect(entities.some(e => e.type === 'SWISS_AVS')).toBe(true);
    });

    it('should detect IBAN numbers', async () => {
      const text = 'IBAN: CH93 0076 2011 6238 5295 7';
      const entities = await pass.execute(text, [], context);

      expect(entities.some(e => e.type === 'IBAN')).toBe(true);
    });

    it('should detect email addresses', async () => {
      const text = 'Contact: john.doe@example.com';
      const entities = await pass.execute(text, [], context);

      const emailEntity = entities.find(e => e.type === 'EMAIL');
      expect(emailEntity).toBeDefined();
      expect(emailEntity?.text).toBe('john.doe@example.com');
    });

    it('should detect Swiss phone numbers', async () => {
      const text = 'Tel: +41 79 123 45 67';
      const entities = await pass.execute(text, [], context);

      expect(entities.some(e => e.type === 'PHONE')).toBe(true);
    });

    it('should detect German phone numbers', async () => {
      const text = 'Tel: +49 30 12345678';
      const entities = await pass.execute(text, [], context);

      expect(entities.some(e => e.type === 'PHONE')).toBe(true);
    });

    it('should detect Swiss postal codes with city', async () => {
      const text = 'Address: 8001 Zürich';
      const entities = await pass.execute(text, [], context);

      expect(entities.some(e => e.type === 'SWISS_ADDRESS')).toBe(true);
    });

    it('should detect German postal codes with city', async () => {
      const text = 'Address: 10115 Berlin';
      const entities = await pass.execute(text, [], context);

      expect(entities.some(e => e.type === 'EU_ADDRESS')).toBe(true);
    });

    it('should detect dates in European format', async () => {
      const text = 'Date: 25.12.2024';
      const entities = await pass.execute(text, [], context);

      expect(entities.some(e => e.type === 'DATE')).toBe(true);
    });

    it('should detect Swiss VAT numbers', async () => {
      const text = 'VAT: CHE-123.456.789 MWST';
      const entities = await pass.execute(text, [], context);

      expect(entities.some(e => e.type === 'VAT_NUMBER')).toBe(true);
    });

    it('should detect amounts in CHF', async () => {
      const text = 'Total: CHF 1\'234.50';
      const entities = await pass.execute(text, [], context);

      expect(entities.some(e => e.type === 'AMOUNT')).toBe(true);
    });

    it('should detect amounts in EUR', async () => {
      const text = 'Total: EUR 1.234,50';
      const entities = await pass.execute(text, [], context);

      expect(entities.some(e => e.type === 'AMOUNT')).toBe(true);
    });
  });

  describe('Entity Position Tracking', () => {
    it('should track correct start and end positions', async () => {
      const text = 'Email: test@example.com is valid';
      const entities = await pass.execute(text, [], context);

      const emailEntity = entities.find(e => e.type === 'EMAIL');
      expect(emailEntity).toBeDefined();
      if (emailEntity) {
        expect(emailEntity.start).toBe(7);
        expect(emailEntity.end).toBe(23);
        expect(text.substring(emailEntity.start, emailEntity.end)).toBe('test@example.com');
      }
    });
  });

  describe('Multiple Entities', () => {
    it('should detect multiple entities in same text', async () => {
      const text = 'Contact: john@example.com, Tel: +41 79 123 45 67';
      const entities = await pass.execute(text, [], context);

      expect(entities.some(e => e.type === 'EMAIL')).toBe(true);
      expect(entities.some(e => e.type === 'PHONE')).toBe(true);
    });

    it('should preserve existing entities', async () => {
      const existingEntity: Entity = {
        id: 'existing-1',
        type: 'PERSON',
        text: 'John Doe',
        start: 0,
        end: 8,
        confidence: 0.9,
        source: 'ML',
      };

      const text = 'John Doe, email: john@example.com';
      const entities = await pass.execute(text, [existingEntity], context);

      expect(entities.some(e => e.id === 'existing-1')).toBe(true);
      expect(entities.some(e => e.type === 'EMAIL')).toBe(true);
    });
  });

  describe('Entity Merging', () => {
    it('should merge overlapping entities from different sources', async () => {
      const existingEntity: Entity = {
        id: 'ml-1',
        type: 'EMAIL',
        text: 'john@example',
        start: 0,
        end: 12,
        confidence: 0.8,
        source: 'ML',
      };

      // This will detect the full email via regex
      const text = 'john@example.com';
      const entities = await pass.execute(text, [existingEntity], context);

      // Should have merged or have both
      const emailEntities = entities.filter(e => e.type === 'EMAIL');
      expect(emailEntities.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty text', async () => {
      const entities = await pass.execute('', [], context);
      expect(entities).toEqual([]);
    });

    it('should handle text with no PII', async () => {
      const text = 'This is a simple sentence without any PII.';
      const entities = await pass.execute(text, [], context);
      expect(entities.length).toBe(0);
    });

    it('should skip very short matches', async () => {
      // Very short strings that might match patterns shouldn't be detected
      const text = 'ab';
      const entities = await pass.execute(text, [], context);
      expect(entities.length).toBe(0);
    });
  });

  describe('Confidence Scoring', () => {
    it('should assign default confidence to rule-based entities', async () => {
      const text = 'Email: test@example.com';
      const entities = await pass.execute(text, [], context);

      const emailEntity = entities.find(e => e.type === 'EMAIL');
      expect(emailEntity?.confidence).toBe(0.7);
      expect(emailEntity?.source).toBe('RULE');
    });
  });
});
