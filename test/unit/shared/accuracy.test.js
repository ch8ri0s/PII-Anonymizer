/**
 * Tests for Shared Accuracy Calculation Utilities
 */

import { expect } from 'chai';
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
} from '../../../shared/dist/test/accuracy.js';

describe('Accuracy Utilities', () => {
  describe('calculateOverlap', () => {
    it('should return 1.0 for identical spans', () => {
      const entity1 = { text: 'test', type: 'PERSON_NAME', start: 0, end: 4 };
      const entity2 = { text: 'test', type: 'PERSON_NAME', start: 0, end: 4 };

      expect(calculateOverlap(entity1, entity2)).to.equal(1);
    });

    it('should return 0 for non-overlapping spans', () => {
      const entity1 = { text: 'first', type: 'PERSON_NAME', start: 0, end: 5 };
      const entity2 = { text: 'second', type: 'PERSON_NAME', start: 10, end: 16 };

      expect(calculateOverlap(entity1, entity2)).to.equal(0);
    });

    it('should calculate partial overlap correctly', () => {
      const entity1 = { text: 'Hans', type: 'PERSON_NAME', start: 0, end: 4 };
      const entity2 = { text: 'Hans Müller', type: 'PERSON_NAME', start: 0, end: 11 };

      // Overlap is 4 chars (Hans), entity1 is 4 chars, so 4/4 = 1.0
      expect(calculateOverlap(entity1, entity2)).to.equal(1);
    });

    it('should handle contained spans', () => {
      const entity1 = { text: 'full text', type: 'PERSON_NAME', start: 0, end: 9 };
      const entity2 = { text: 'text', type: 'PERSON_NAME', start: 5, end: 9 };

      // entity2 is fully contained, overlap = 4 chars, min length = 4
      expect(calculateOverlap(entity1, entity2)).to.equal(1);
    });

    it('should handle adjacent but non-overlapping spans', () => {
      const entity1 = { text: 'first', type: 'PERSON_NAME', start: 0, end: 5 };
      const entity2 = { text: 'second', type: 'PERSON_NAME', start: 5, end: 11 };

      expect(calculateOverlap(entity1, entity2)).to.equal(0);
    });
  });

  describe('textMatches', () => {
    it('should match identical text', () => {
      const entity1 = { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 };
      const entity2 = { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 };

      expect(textMatches(entity1, entity2)).to.be.true;
    });

    it('should match case-insensitively', () => {
      const entity1 = { text: 'JEAN DUPONT', type: 'PERSON_NAME', start: 0, end: 11 };
      const entity2 = { text: 'jean dupont', type: 'PERSON_NAME', start: 0, end: 11 };

      expect(textMatches(entity1, entity2)).to.be.true;
    });

    it('should trim whitespace for comparison', () => {
      const entity1 = { text: '  Jean Dupont  ', type: 'PERSON_NAME', start: 0, end: 15 };
      const entity2 = { text: 'Jean Dupont', type: 'PERSON_NAME', start: 2, end: 13 };

      expect(textMatches(entity1, entity2)).to.be.true;
    });

    it('should not match different text', () => {
      const entity1 = { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 };
      const entity2 = { text: 'Marie Laurent', type: 'PERSON_NAME', start: 0, end: 13 };

      expect(textMatches(entity1, entity2)).to.be.false;
    });
  });

  describe('typeMatches', () => {
    it('should match identical types', () => {
      const entity1 = { text: 'test', type: 'PERSON_NAME', start: 0, end: 4 };
      const entity2 = { text: 'test', type: 'PERSON_NAME', start: 0, end: 4 };

      expect(typeMatches(entity1, entity2)).to.be.true;
    });

    it('should normalize PER to PERSON_NAME', () => {
      const entity1 = { text: 'test', type: 'PER', start: 0, end: 4 };
      const entity2 = { text: 'test', type: 'PERSON_NAME', start: 0, end: 4 };

      expect(typeMatches(entity1, entity2)).to.be.true;
    });

    it('should normalize ORG to ORGANIZATION', () => {
      const entity1 = { text: 'test', type: 'ORG', start: 0, end: 4 };
      const entity2 = { text: 'test', type: 'ORGANIZATION', start: 0, end: 4 };

      expect(typeMatches(entity1, entity2)).to.be.true;
    });

    it('should match case-insensitively', () => {
      const entity1 = { text: 'test', type: 'person_name', start: 0, end: 4 };
      const entity2 = { text: 'test', type: 'PERSON_NAME', start: 0, end: 4 };

      expect(typeMatches(entity1, entity2)).to.be.true;
    });
  });

  describe('normalizeEntityType', () => {
    it('should normalize PERSON variations', () => {
      expect(normalizeEntityType('PER')).to.equal('PERSON_NAME');
      expect(normalizeEntityType('PERSON')).to.equal('PERSON_NAME');
      expect(normalizeEntityType('person_name')).to.equal('PERSON_NAME');
    });

    it('should normalize ORGANIZATION variations', () => {
      expect(normalizeEntityType('ORG')).to.equal('ORGANIZATION');
      expect(normalizeEntityType('COMPANY')).to.equal('ORGANIZATION');
    });

    it('should normalize PHONE variations', () => {
      expect(normalizeEntityType('PHONE')).to.equal('PHONE_NUMBER');
      expect(normalizeEntityType('TEL')).to.equal('PHONE_NUMBER');
      expect(normalizeEntityType('TELEPHONE')).to.equal('PHONE_NUMBER');
    });

    it('should normalize SWISS_AVS variations', () => {
      expect(normalizeEntityType('AVS')).to.equal('SWISS_AVS');
      expect(normalizeEntityType('AHV')).to.equal('SWISS_AVS');
      expect(normalizeEntityType('OASI')).to.equal('SWISS_AVS');
    });

    it('should pass through unknown types', () => {
      expect(normalizeEntityType('CUSTOM_TYPE')).to.equal('CUSTOM_TYPE');
    });
  });

  describe('matchEntities', () => {
    it('should match entities with exact text match', () => {
      const detected = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
      ];
      const expected = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
      ];

      const matches = matchEntities(detected, expected);

      expect(matches).to.have.length(1);
      expect(matches[0].matchType).to.equal('exact');
      expect(matches[0].overlapRatio).to.equal(1.0);
    });

    it('should identify false positives', () => {
      const detected = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'Montant', type: 'PERSON_NAME', start: 20, end: 27 }, // False positive
      ];
      const expected = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
      ];

      const matches = matchEntities(detected, expected);

      expect(matches).to.have.length(2);
      expect(matches.filter(m => m.matchType === 'exact')).to.have.length(1);
      expect(matches.filter(m => m.matchType === 'none')).to.have.length(1);
    });

    it('should handle fuzzy matching with span overlap', () => {
      const detected = [
        { text: 'Jean', type: 'PERSON_NAME', start: 0, end: 4 },
      ];
      const expected = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
      ];

      const matches = matchEntities(detected, expected, { fuzzyThreshold: 0.3 });

      expect(matches).to.have.length(1);
      expect(matches[0].matchType).to.equal('fuzzy');
      expect(matches[0].overlapRatio).to.be.greaterThan(0);
    });

    it('should require type match when configured', () => {
      const detected = [
        { text: 'Genève', type: 'LOCATION', start: 0, end: 6 },
      ];
      const expected = [
        { text: 'Genève', type: 'ORGANIZATION', start: 0, end: 6 },
      ];

      const matchesWithTypeReq = matchEntities(detected, expected, { requireTypeMatch: true });
      const matchesWithoutTypeReq = matchEntities(detected, expected, { requireTypeMatch: false });

      expect(matchesWithTypeReq[0].matchType).to.equal('none');
      expect(matchesWithoutTypeReq[0].matchType).to.equal('exact');
    });
  });

  describe('calculatePrecisionRecall', () => {
    it('should calculate perfect precision and recall', () => {
      const detected = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'CH12 3456 7890', type: 'IBAN', start: 20, end: 34 },
      ];
      const expected = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'CH12 3456 7890', type: 'IBAN', start: 20, end: 34 },
      ];

      const metrics = calculatePrecisionRecall(detected, expected);

      expect(metrics.precision).to.equal(1);
      expect(metrics.recall).to.equal(1);
      expect(metrics.f1).to.equal(1);
      expect(metrics.truePositives).to.equal(2);
      expect(metrics.falsePositives).to.equal(0);
      expect(metrics.falseNegatives).to.equal(0);
    });

    it('should calculate precision with false positives', () => {
      const detected = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'Montant', type: 'PERSON_NAME', start: 20, end: 27 }, // FP
        { text: 'Description', type: 'PERSON_NAME', start: 30, end: 41 }, // FP
      ];
      const expected = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
      ];

      const metrics = calculatePrecisionRecall(detected, expected);

      // Precision = 1 / 3 ≈ 0.333
      expect(metrics.precision).to.be.closeTo(0.333, 0.01);
      expect(metrics.recall).to.equal(1);
      expect(metrics.truePositives).to.equal(1);
      expect(metrics.falsePositives).to.equal(2);
    });

    it('should calculate recall with false negatives', () => {
      const detected = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
      ];
      const expected = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'Marie Laurent', type: 'PERSON_NAME', start: 20, end: 33 }, // FN
        { text: 'CH12 3456 7890', type: 'IBAN', start: 40, end: 54 }, // FN
      ];

      const metrics = calculatePrecisionRecall(detected, expected);

      expect(metrics.precision).to.equal(1);
      // Recall = 1 / 3 ≈ 0.333
      expect(metrics.recall).to.be.closeTo(0.333, 0.01);
      expect(metrics.falseNegatives).to.equal(2);
    });

    it('should calculate per-entity-type metrics', () => {
      const detected = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'Marie', type: 'PERSON_NAME', start: 15, end: 20 }, // FP
        { text: 'CH12 3456 7890', type: 'IBAN', start: 30, end: 44 },
      ];
      const expected = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'CH12 3456 7890', type: 'IBAN', start: 30, end: 44 },
      ];

      const metrics = calculatePrecisionRecall(detected, expected);

      expect(metrics.perEntityType['PERSON_NAME']).to.exist;
      expect(metrics.perEntityType['PERSON_NAME'].precision).to.equal(0.5); // 1 TP, 1 FP
      expect(metrics.perEntityType['PERSON_NAME'].recall).to.equal(1);

      expect(metrics.perEntityType['IBAN']).to.exist;
      expect(metrics.perEntityType['IBAN'].precision).to.equal(1);
      expect(metrics.perEntityType['IBAN'].recall).to.equal(1);
    });

    it('should handle empty arrays', () => {
      const metrics1 = calculatePrecisionRecall([], []);
      expect(metrics1.precision).to.equal(0);
      expect(metrics1.recall).to.equal(0);

      const detected = [
        { text: 'test', type: 'PERSON_NAME', start: 0, end: 4 },
      ];
      const metrics2 = calculatePrecisionRecall(detected, []);
      expect(metrics2.precision).to.equal(0);
      expect(metrics2.falsePositives).to.equal(1);

      const expected = [
        { text: 'test', type: 'PERSON_NAME', start: 0, end: 4 },
      ];
      const metrics3 = calculatePrecisionRecall([], expected);
      expect(metrics3.recall).to.equal(0);
      expect(metrics3.falseNegatives).to.equal(1);
    });
  });

  describe('compareWithGoldenSnapshot', () => {
    it('should match identical entities', () => {
      const actual = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11, confidence: 0.95 },
      ];
      const golden = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11, confidence: 0.95 },
      ];

      const result = compareWithGoldenSnapshot(actual, golden);

      expect(result.matches).to.be.true;
      expect(result.differences).to.have.length(0);
    });

    it('should detect extra entities', () => {
      const actual = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'Extra', type: 'PERSON_NAME', start: 20, end: 25 },
      ];
      const golden = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
      ];

      const result = compareWithGoldenSnapshot(actual, golden);

      expect(result.matches).to.be.false;
      expect(result.differences).to.have.length(1);
      expect(result.differences[0].type).to.equal('extra');
    });

    it('should detect missing entities', () => {
      const actual = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
      ];
      const golden = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11 },
        { text: 'Marie', type: 'PERSON_NAME', start: 20, end: 25 },
      ];

      const result = compareWithGoldenSnapshot(actual, golden);

      expect(result.matches).to.be.false;
      expect(result.differences).to.have.length(1);
      expect(result.differences[0].type).to.equal('missing');
    });

    it('should allow confidence within tolerance', () => {
      const actual = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11, confidence: 0.93 },
      ];
      const golden = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11, confidence: 0.95 },
      ];

      const result = compareWithGoldenSnapshot(actual, golden, { confidenceTolerance: 0.05 });

      expect(result.matches).to.be.true;
    });

    it('should detect confidence mismatch outside tolerance', () => {
      const actual = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11, confidence: 0.80 },
      ];
      const golden = [
        { text: 'Jean Dupont', type: 'PERSON_NAME', start: 0, end: 11, confidence: 0.95 },
      ];

      const result = compareWithGoldenSnapshot(actual, golden, { confidenceTolerance: 0.05 });

      expect(result.matches).to.be.false;
      expect(result.differences[0].type).to.equal('mismatch');
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
        IBAN: {
          precision: 0.98,
          recall: 0.96,
          f1: 0.97,
          truePositives: 24,
          falsePositives: 0,
          falseNegatives: 1,
        },
      },
    };

    it('should pass when all thresholds are met', () => {
      const result = meetsThresholds(baseMetrics, {
        precision: 0.90,
        recall: 0.85,
      });

      expect(result.passes).to.be.true;
      expect(result.failures).to.have.length(0);
    });

    it('should fail when precision is below threshold', () => {
      const result = meetsThresholds(baseMetrics, {
        precision: 0.95,
      });

      expect(result.passes).to.be.false;
      expect(result.failures[0]).to.include('Precision');
    });

    it('should check per-entity-type thresholds', () => {
      const result = meetsThresholds(baseMetrics, {
        perEntityType: {
          SWISS_AVS: { precision: 0.98 }, // Missing type
        },
      });

      expect(result.passes).to.be.false;
      expect(result.failures[0]).to.include('Missing metrics');
    });

    it('should fail when entity type precision is below threshold', () => {
      const result = meetsThresholds(baseMetrics, {
        perEntityType: {
          PERSON_NAME: { precision: 0.95 },
        },
      });

      expect(result.passes).to.be.false;
      expect(result.failures[0]).to.include('PERSON_NAME');
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
          perEntityType: {
            PERSON_NAME: {
              precision: 1,
              recall: 0.5,
              f1: 0.67,
              truePositives: 2,
              falsePositives: 0,
              falseNegatives: 2,
            },
          },
        },
        {
          precision: 0.5,
          recall: 1,
          f1: 0.67,
          truePositives: 2,
          falsePositives: 2,
          falseNegatives: 0,
          perEntityType: {
            PERSON_NAME: {
              precision: 0.5,
              recall: 1,
              f1: 0.67,
              truePositives: 2,
              falsePositives: 2,
              falseNegatives: 0,
            },
          },
        },
      ];

      const aggregated = aggregateMetrics(metricsArray);

      // Total: 4 TP, 2 FP, 2 FN
      expect(aggregated.truePositives).to.equal(4);
      expect(aggregated.falsePositives).to.equal(2);
      expect(aggregated.falseNegatives).to.equal(2);
      // Precision = 4 / (4 + 2) = 0.667
      expect(aggregated.precision).to.be.closeTo(0.667, 0.01);
      // Recall = 4 / (4 + 2) = 0.667
      expect(aggregated.recall).to.be.closeTo(0.667, 0.01);
    });

    it('should aggregate per-entity-type metrics', () => {
      const metricsArray = [
        {
          precision: 1,
          recall: 1,
          f1: 1,
          truePositives: 1,
          falsePositives: 0,
          falseNegatives: 0,
          perEntityType: {
            IBAN: {
              precision: 1,
              recall: 1,
              f1: 1,
              truePositives: 1,
              falsePositives: 0,
              falseNegatives: 0,
            },
          },
        },
        {
          precision: 1,
          recall: 1,
          f1: 1,
          truePositives: 1,
          falsePositives: 0,
          falseNegatives: 0,
          perEntityType: {
            PERSON_NAME: {
              precision: 1,
              recall: 1,
              f1: 1,
              truePositives: 1,
              falsePositives: 0,
              falseNegatives: 0,
            },
          },
        },
      ];

      const aggregated = aggregateMetrics(metricsArray);

      expect(aggregated.perEntityType['IBAN']).to.exist;
      expect(aggregated.perEntityType['PERSON_NAME']).to.exist;
    });

    it('should handle empty array', () => {
      const aggregated = aggregateMetrics([]);

      expect(aggregated.precision).to.equal(0);
      expect(aggregated.recall).to.equal(0);
      expect(aggregated.truePositives).to.equal(0);
    });
  });
});
