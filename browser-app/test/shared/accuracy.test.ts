/**
 * Tests for Shared Accuracy Calculation Utilities (Browser/Vitest)
 *
 * These tests verify that the shared accuracy utilities work correctly
 * in the browser environment with Vitest.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateOverlap,
  textMatches,
  typeMatches,
  normalizeEntityType,
  matchEntities,
  calculatePrecisionRecall,
  compareWithGoldenSnapshot,
  meetsThresholds,
  aggregateMetrics,
  type Entity,
} from '@shared-test/accuracy';

describe('Accuracy Utilities (Browser)', () => {
  describe('calculateOverlap', () => {
    it('should return 1.0 for identical spans', () => {
      const entity1: Entity = { text: 'test', type: 'PERSON_NAME', start: 0, end: 4 };
      const entity2: Entity = { text: 'test', type: 'PERSON_NAME', start: 0, end: 4 };

      expect(calculateOverlap(entity1, entity2)).toBe(1);
    });

    it('should return 0 for non-overlapping spans', () => {
      const entity1: Entity = { text: 'first', type: 'PERSON_NAME', start: 0, end: 5 };
      const entity2: Entity = { text: 'second', type: 'PERSON_NAME', start: 10, end: 16 };

      expect(calculateOverlap(entity1, entity2)).toBe(0);
    });

    it('should calculate partial overlap correctly', () => {
      const entity1: Entity = { text: 'Hans', type: 'PERSON_NAME', start: 0, end: 4 };
      const entity2: Entity = { text: 'Hans Müller', type: 'PERSON_NAME', start: 0, end: 11 };

      expect(calculateOverlap(entity1, entity2)).toBe(1);
    });
  });

  describe('textMatches', () => {
    it('should match identical text', () => {
      const entity1: Entity = { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 };
      const entity2: Entity = { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 };

      expect(textMatches(entity1, entity2)).toBe(true);
    });

    it('should match case-insensitively', () => {
      const entity1: Entity = { text: 'JEAN DUPONT', type: 'PERSON_NAME', start: 0, end: 11 };
      const entity2: Entity = { text: 'jean dupont', type: 'PERSON_NAME', start: 0, end: 11 };

      expect(textMatches(entity1, entity2)).toBe(true);
    });
  });

  describe('typeMatches', () => {
    it('should normalize PER to PERSON_NAME', () => {
      const entity1: Entity = { text: 'test', type: 'PER', start: 0, end: 4 };
      const entity2: Entity = { text: 'test', type: 'PERSON_NAME', start: 0, end: 4 };

      expect(typeMatches(entity1, entity2)).toBe(true);
    });

    it('should normalize ORG to ORGANIZATION', () => {
      const entity1: Entity = { text: 'test', type: 'ORG', start: 0, end: 4 };
      const entity2: Entity = { text: 'test', type: 'ORGANIZATION', start: 0, end: 4 };

      expect(typeMatches(entity1, entity2)).toBe(true);
    });
  });

  describe('normalizeEntityType', () => {
    it('should normalize PERSON variations', () => {
      expect(normalizeEntityType('PER')).toBe('PERSON_NAME');
      expect(normalizeEntityType('PERSON')).toBe('PERSON_NAME');
    });

    it('should normalize SWISS_AVS variations', () => {
      expect(normalizeEntityType('AVS')).toBe('SWISS_AVS');
      expect(normalizeEntityType('AHV')).toBe('SWISS_AVS');
    });
  });

  describe('matchEntities', () => {
    it('should match entities with exact text match', () => {
      const detected: Entity[] = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
      ];
      const expected: Entity[] = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
      ];

      const matches = matchEntities(detected, expected);

      expect(matches).toHaveLength(1);
      expect(matches[0].matchType).toBe('exact');
    });

    it('should identify false positives', () => {
      const detected: Entity[] = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'Montant', type: 'PERSON_NAME', start: 20, end: 27 },
      ];
      const expected: Entity[] = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
      ];

      const matches = matchEntities(detected, expected);

      expect(matches).toHaveLength(2);
      expect(matches.filter(m => m.matchType === 'exact')).toHaveLength(1);
      expect(matches.filter(m => m.matchType === 'none')).toHaveLength(1);
    });
  });

  describe('calculatePrecisionRecall', () => {
    it('should calculate perfect precision and recall', () => {
      const detected: Entity[] = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'CH12 3456 7890', type: 'IBAN', start: 20, end: 34 },
      ];
      const expected: Entity[] = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'CH12 3456 7890', type: 'IBAN', start: 20, end: 34 },
      ];

      const metrics = calculatePrecisionRecall(detected, expected);

      expect(metrics.precision).toBe(1);
      expect(metrics.recall).toBe(1);
      expect(metrics.f1).toBe(1);
    });

    it('should calculate per-entity-type metrics', () => {
      const detected: Entity[] = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'Marie', type: 'PERSON_NAME', start: 15, end: 20 },
        { text: 'CH12 3456 7890', type: 'IBAN', start: 30, end: 44 },
      ];
      const expected: Entity[] = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'CH12 3456 7890', type: 'IBAN', start: 30, end: 44 },
      ];

      const metrics = calculatePrecisionRecall(detected, expected);

      expect(metrics.perEntityType['PERSON_NAME']).toBeDefined();
      expect(metrics.perEntityType['PERSON_NAME'].precision).toBe(0.5);
      expect(metrics.perEntityType['IBAN'].precision).toBe(1);
    });
  });

  describe('compareWithGoldenSnapshot', () => {
    it('should match identical entities', () => {
      const actual: Entity[] = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11, confidence: 0.95 },
      ];
      const golden: Entity[] = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11, confidence: 0.95 },
      ];

      const result = compareWithGoldenSnapshot(actual, golden);

      expect(result.matches).toBe(true);
      expect(result.differences).toHaveLength(0);
    });

    it('should detect extra entities', () => {
      const actual: Entity[] = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'Extra', type: 'PERSON_NAME', start: 20, end: 25 },
      ];
      const golden: Entity[] = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
      ];

      const result = compareWithGoldenSnapshot(actual, golden);

      expect(result.matches).toBe(false);
      expect(result.differences[0].type).toBe('extra');
    });
  });

  describe('meetsThresholds', () => {
    const baseMetrics = {
      precision: 0.92,
      recall: 0.88,
      f1: 0.90,
      truePositives: 88,
      falsePositives: 8,
      falseNegatives: 12,
      perEntityType: {
        PERSON_NAME: {
          precision: 0.90,
          recall: 0.85,
          f1: 0.87,
          truePositives: 34,
          falsePositives: 4,
          falseNegatives: 6,
        },
      },
    };

    it('should pass when all thresholds are met', () => {
      const result = meetsThresholds(baseMetrics, {
        precision: 0.90,
        recall: 0.85,
      });

      expect(result.passes).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should fail when precision is below threshold', () => {
      const result = meetsThresholds(baseMetrics, {
        precision: 0.95,
      });

      expect(result.passes).toBe(false);
      expect(result.failures[0]).toContain('Precision');
    });
  });

  describe('aggregateMetrics', () => {
    it('should aggregate metrics from multiple documents', () => {
      const metricsArray = [
        {
          precision: 1,
          recall: 0.5,
          f1: 0.67,
          truePositives: 2,
          falsePositives: 0,
          falseNegatives: 2,
          perEntityType: {},
        },
        {
          precision: 0.5,
          recall: 1,
          f1: 0.67,
          truePositives: 2,
          falsePositives: 2,
          falseNegatives: 0,
          perEntityType: {},
        },
      ];

      const aggregated = aggregateMetrics(metricsArray);

      expect(aggregated.truePositives).toBe(4);
      expect(aggregated.falsePositives).toBe(2);
      expect(aggregated.falseNegatives).toBe(2);
      expect(aggregated.precision).toBeCloseTo(0.667, 2);
    });

    it('should handle empty array', () => {
      const aggregated = aggregateMetrics([]);

      expect(aggregated.precision).toBe(0);
      expect(aggregated.recall).toBe(0);
    });
  });
});
