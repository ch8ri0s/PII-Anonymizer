/**
 * Shared Accuracy Calculation Utilities
 *
 * Precision, recall, and F1 score calculations for PII detection evaluation.
 * Used across both Electron and Browser test suites to ensure consistent
 * quality metrics across platforms.
 *
 * @module shared/test/accuracy
 */

/**
 * Detected or expected entity with position information
 */
export interface Entity {
  /** Entity text content */
  text: string;
  /** Entity type (e.g., PERSON_NAME, IBAN, SWISS_AVS) */
  type: string;
  /** Start position in document (character offset) */
  start: number;
  /** End position in document (character offset) */
  end: number;
  /** Detection confidence (0-1) */
  confidence?: number;
}

/**
 * Result of matching a detected entity against expected entities
 */
export interface EntityMatch {
  /** The detected entity */
  detected: Entity;
  /** The matched expected entity (undefined if false positive) */
  expected?: Entity;
  /** Match type: exact (text+type), fuzzy (overlap+type), or none */
  matchType: 'exact' | 'fuzzy' | 'none';
  /** Overlap ratio for fuzzy matches (0-1) */
  overlapRatio: number;
}

/**
 * Accuracy metrics for a detection run
 */
export interface AccuracyMetrics {
  /** Precision: TP / (TP + FP) */
  precision: number;
  /** Recall: TP / (TP + FN) */
  recall: number;
  /** F1 Score: 2 * (precision * recall) / (precision + recall) */
  f1: number;
  /** True positives count */
  truePositives: number;
  /** False positives count */
  falsePositives: number;
  /** False negatives count */
  falseNegatives: number;
  /** Breakdown by entity type */
  perEntityType: Record<string, EntityTypeMetrics>;
}

/**
 * Per-entity-type metrics
 */
export interface EntityTypeMetrics {
  precision: number;
  recall: number;
  f1: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

/**
 * Options for entity matching and accuracy calculation
 */
export interface AccuracyOptions {
  /**
   * Minimum overlap ratio for fuzzy matching (0-1).
   * Default: 0.5 (50% overlap required)
   */
  fuzzyThreshold?: number;
  /**
   * Whether to use span overlap for matching (vs exact text match).
   * Default: true
   */
  spanOverlap?: boolean;
  /**
   * Whether type must match for fuzzy matches.
   * Default: true
   */
  requireTypeMatch?: boolean;
  /**
   * Confidence tolerance for comparison (for golden snapshot tests).
   * Default: 0.05
   */
  confidenceTolerance?: number;
}

const DEFAULT_OPTIONS: Required<AccuracyOptions> = {
  fuzzyThreshold: 0.5,
  spanOverlap: true,
  requireTypeMatch: true,
  confidenceTolerance: 0.05,
};

/**
 * Calculate the overlap ratio between two entities based on character positions
 */
export function calculateOverlap(entity1: Entity, entity2: Entity): number {
  const start = Math.max(entity1.start, entity2.start);
  const end = Math.min(entity1.end, entity2.end);

  if (start >= end) {
    return 0; // No overlap
  }

  const overlapLength = end - start;
  const entity1Length = entity1.end - entity1.start;
  const entity2Length = entity2.end - entity2.start;

  // Use the smaller entity as the reference for overlap ratio
  const minLength = Math.min(entity1Length, entity2Length);

  return minLength > 0 ? overlapLength / minLength : 0;
}

/**
 * Check if two entities match based on text content
 */
export function textMatches(detected: Entity, expected: Entity): boolean {
  // Exact text match (case-insensitive, trimmed)
  const detectedText = detected.text.trim().toLowerCase();
  const expectedText = expected.text.trim().toLowerCase();
  return detectedText === expectedText;
}

/**
 * Check if entity types match (handles type normalization)
 */
export function typeMatches(detected: Entity, expected: Entity): boolean {
  const normalizedDetected = normalizeEntityType(detected.type);
  const normalizedExpected = normalizeEntityType(expected.type);
  return normalizedDetected === normalizedExpected;
}

/**
 * Normalize entity types for consistent comparison
 * Maps various type names to canonical forms
 */
export function normalizeEntityType(type: string): string {
  const normalized = type.toUpperCase().trim();

  // Map common variations to canonical types
  const typeMap: Record<string, string> = {
    PERSON: 'PERSON_NAME',
    PER: 'PERSON_NAME',
    PERSON_NAME: 'PERSON_NAME',
    NAME: 'PERSON_NAME',

    ORG: 'ORGANIZATION',
    ORGANIZATION: 'ORGANIZATION',
    COMPANY: 'ORGANIZATION',

    LOC: 'LOCATION',
    LOCATION: 'LOCATION',
    ADDRESS: 'ADDRESS',
    SWISS_ADDRESS: 'ADDRESS',
    EU_ADDRESS: 'ADDRESS',

    PHONE: 'PHONE_NUMBER',
    PHONE_NUMBER: 'PHONE_NUMBER',
    TEL: 'PHONE_NUMBER',
    TELEPHONE: 'PHONE_NUMBER',

    EMAIL: 'EMAIL',
    EMAIL_ADDRESS: 'EMAIL',

    IBAN: 'IBAN',
    BANK_ACCOUNT: 'IBAN',

    SWISS_AVS: 'SWISS_AVS',
    AVS: 'SWISS_AVS',
    AHV: 'SWISS_AVS',
    OASI: 'SWISS_AVS',

    DATE: 'DATE',
    DATETIME: 'DATE',

    SWISS_UID: 'SWISS_UID',
    UID: 'SWISS_UID',
    VAT_NUMBER: 'SWISS_UID',
  };

  return typeMap[normalized] || normalized;
}

/**
 * Match detected entities against expected entities
 *
 * Uses a greedy matching algorithm:
 * 1. First pass: exact matches (text + type)
 * 2. Second pass: fuzzy matches (overlap + type)
 *
 * @param detected - Array of detected entities
 * @param expected - Array of expected (ground truth) entities
 * @param options - Matching options
 * @returns Array of entity matches
 */
export function matchEntities(
  detected: Entity[],
  expected: Entity[],
  options?: AccuracyOptions,
): EntityMatch[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const matches: EntityMatch[] = [];
  const matchedExpected = new Set<number>();

  // First pass: exact text matches
  for (const det of detected) {
    let bestMatch: { index: number; expected: Entity } | null = null;

    for (let i = 0; i < expected.length; i++) {
      if (matchedExpected.has(i)) continue;

      const exp = expected[i];

      // Check type match if required
      if (opts.requireTypeMatch && !typeMatches(det, exp)) {
        continue;
      }

      // Check for exact text match
      if (textMatches(det, exp)) {
        bestMatch = { index: i, expected: exp };
        break; // Exact match found, no need to continue
      }
    }

    if (bestMatch) {
      matchedExpected.add(bestMatch.index);
      matches.push({
        detected: det,
        expected: bestMatch.expected,
        matchType: 'exact',
        overlapRatio: 1.0,
      });
    }
  }

  // Second pass: fuzzy matches for unmatched detected entities
  if (opts.spanOverlap) {
    for (const det of detected) {
      // Skip if already matched
      if (matches.some(m => m.detected === det)) continue;

      let bestMatch: { index: number; expected: Entity; overlap: number } | null = null;

      for (let i = 0; i < expected.length; i++) {
        if (matchedExpected.has(i)) continue;

        const exp = expected[i];

        // Check type match if required
        if (opts.requireTypeMatch && !typeMatches(det, exp)) {
          continue;
        }

        const overlap = calculateOverlap(det, exp);

        if (overlap >= opts.fuzzyThreshold) {
          if (!bestMatch || overlap > bestMatch.overlap) {
            bestMatch = { index: i, expected: exp, overlap };
          }
        }
      }

      if (bestMatch) {
        matchedExpected.add(bestMatch.index);
        matches.push({
          detected: det,
          expected: bestMatch.expected,
          matchType: 'fuzzy',
          overlapRatio: bestMatch.overlap,
        });
      } else {
        // False positive: detected but not in expected
        matches.push({
          detected: det,
          expected: undefined,
          matchType: 'none',
          overlapRatio: 0,
        });
      }
    }
  } else {
    // No fuzzy matching: mark remaining as false positives
    for (const det of detected) {
      if (!matches.some(m => m.detected === det)) {
        matches.push({
          detected: det,
          expected: undefined,
          matchType: 'none',
          overlapRatio: 0,
        });
      }
    }
  }

  return matches;
}

/**
 * Calculate precision, recall, and F1 score
 *
 * @param detected - Array of detected entities
 * @param expected - Array of expected (ground truth) entities
 * @param options - Calculation options
 * @returns Accuracy metrics including per-entity-type breakdown
 */
export function calculatePrecisionRecall(
  detected: Entity[],
  expected: Entity[],
  options?: AccuracyOptions,
): AccuracyMetrics {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const matches = matchEntities(detected, expected, opts);

  // Calculate overall metrics
  const truePositives = matches.filter(m => m.matchType !== 'none').length;
  const falsePositives = matches.filter(m => m.matchType === 'none').length;

  // False negatives: expected entities not matched
  const matchedExpectedTexts = new Set(
    matches.filter(m => m.expected).map(m => m.expected!.text.toLowerCase().trim()),
  );
  const falseNegatives = expected.filter(
    e => !matchedExpectedTexts.has(e.text.toLowerCase().trim()),
  ).length;

  const precision = truePositives + falsePositives > 0 ? truePositives / (truePositives + falsePositives) : 0;

  const recall = truePositives + falseNegatives > 0 ? truePositives / (truePositives + falseNegatives) : 0;

  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  // Calculate per-entity-type metrics
  const perEntityType: Record<string, EntityTypeMetrics> = {};

  // Get all unique entity types
  const allTypes = new Set<string>();
  detected.forEach(e => allTypes.add(normalizeEntityType(e.type)));
  expected.forEach(e => allTypes.add(normalizeEntityType(e.type)));

  for (const type of allTypes) {
    const typeDetected = detected.filter(e => normalizeEntityType(e.type) === type);
    const typeExpected = expected.filter(e => normalizeEntityType(e.type) === type);

    const typeMatches = matchEntities(typeDetected, typeExpected, opts);

    const tp = typeMatches.filter(m => m.matchType !== 'none').length;
    const fp = typeMatches.filter(m => m.matchType === 'none').length;

    const matchedTexts = new Set(
      typeMatches.filter(m => m.expected).map(m => m.expected!.text.toLowerCase().trim()),
    );
    const fn = typeExpected.filter(e => !matchedTexts.has(e.text.toLowerCase().trim())).length;

    const typePrecision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const typeRecall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const typeF1 = typePrecision + typeRecall > 0 ? (2 * typePrecision * typeRecall) / (typePrecision + typeRecall) : 0;

    perEntityType[type] = {
      precision: typePrecision,
      recall: typeRecall,
      f1: typeF1,
      truePositives: tp,
      falsePositives: fp,
      falseNegatives: fn,
    };
  }

  return {
    precision,
    recall,
    f1,
    truePositives,
    falsePositives,
    falseNegatives,
    perEntityType,
  };
}

/**
 * Compare two sets of entities for golden snapshot testing
 * Uses confidence tolerance for approximate matching
 */
export function compareWithGoldenSnapshot(
  actual: Entity[],
  golden: Entity[],
  options?: AccuracyOptions,
): {
  matches: boolean;
  differences: Array<{
    type: 'missing' | 'extra' | 'mismatch';
    actual?: Entity;
    expected?: Entity;
    reason?: string;
  }>;
} {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const differences: Array<{
    type: 'missing' | 'extra' | 'mismatch';
    actual?: Entity;
    expected?: Entity;
    reason?: string;
  }> = [];

  const matchedGolden = new Set<number>();

  // Check each actual entity against golden
  for (const act of actual) {
    let found = false;

    for (let i = 0; i < golden.length; i++) {
      if (matchedGolden.has(i)) continue;

      const gld = golden[i];

      // Check text, type, and position
      if (
        textMatches(act, gld) &&
        typeMatches(act, gld) &&
        act.start === gld.start &&
        act.end === gld.end
      ) {
        // Check confidence within tolerance
        if (
          act.confidence !== undefined &&
          gld.confidence !== undefined &&
          Math.abs(act.confidence - gld.confidence) > opts.confidenceTolerance
        ) {
          differences.push({
            type: 'mismatch',
            actual: act,
            expected: gld,
            reason: `Confidence differs: ${act.confidence.toFixed(2)} vs ${gld.confidence.toFixed(2)}`,
          });
        }
        matchedGolden.add(i);
        found = true;
        break;
      }
    }

    if (!found) {
      differences.push({
        type: 'extra',
        actual: act,
        reason: `Entity not in golden snapshot: "${act.text}" (${act.type})`,
      });
    }
  }

  // Check for missing golden entities
  for (let i = 0; i < golden.length; i++) {
    if (!matchedGolden.has(i)) {
      differences.push({
        type: 'missing',
        expected: golden[i],
        reason: `Missing from detection: "${golden[i].text}" (${golden[i].type})`,
      });
    }
  }

  return {
    matches: differences.length === 0,
    differences,
  };
}

/**
 * Format accuracy metrics for display
 */
export function formatMetrics(metrics: AccuracyMetrics): string {
  const lines: string[] = [
    `Overall Metrics:`,
    `  Precision: ${(metrics.precision * 100).toFixed(1)}%`,
    `  Recall:    ${(metrics.recall * 100).toFixed(1)}%`,
    `  F1 Score:  ${(metrics.f1 * 100).toFixed(1)}%`,
    `  TP: ${metrics.truePositives}, FP: ${metrics.falsePositives}, FN: ${metrics.falseNegatives}`,
    ``,
    `Per-Entity-Type:`,
  ];

  for (const [type, typeMetrics] of Object.entries(metrics.perEntityType)) {
    lines.push(
      `  ${type}:`,
      `    P: ${(typeMetrics.precision * 100).toFixed(1)}%, R: ${(typeMetrics.recall * 100).toFixed(1)}%, F1: ${(typeMetrics.f1 * 100).toFixed(1)}%`,
      `    TP: ${typeMetrics.truePositives}, FP: ${typeMetrics.falsePositives}, FN: ${typeMetrics.falseNegatives}`,
    );
  }

  return lines.join('\n');
}

/**
 * Check if metrics meet specified thresholds
 */
export function meetsThresholds(
  metrics: AccuracyMetrics,
  thresholds: {
    precision?: number;
    recall?: number;
    f1?: number;
    perEntityType?: Record<string, { precision?: number; recall?: number }>;
  },
): { passes: boolean; failures: string[] } {
  const failures: string[] = [];

  if (thresholds.precision !== undefined && metrics.precision < thresholds.precision) {
    failures.push(
      `Precision ${(metrics.precision * 100).toFixed(1)}% below threshold ${(thresholds.precision * 100).toFixed(1)}%`,
    );
  }

  if (thresholds.recall !== undefined && metrics.recall < thresholds.recall) {
    failures.push(
      `Recall ${(metrics.recall * 100).toFixed(1)}% below threshold ${(thresholds.recall * 100).toFixed(1)}%`,
    );
  }

  if (thresholds.f1 !== undefined && metrics.f1 < thresholds.f1) {
    failures.push(
      `F1 ${(metrics.f1 * 100).toFixed(1)}% below threshold ${(thresholds.f1 * 100).toFixed(1)}%`,
    );
  }

  if (thresholds.perEntityType) {
    for (const [type, typeThresholds] of Object.entries(thresholds.perEntityType)) {
      const typeMetrics = metrics.perEntityType[type];

      if (!typeMetrics) {
        failures.push(`Missing metrics for entity type: ${type}`);
        continue;
      }

      if (typeThresholds.precision !== undefined && typeMetrics.precision < typeThresholds.precision) {
        failures.push(
          `${type} precision ${(typeMetrics.precision * 100).toFixed(1)}% below threshold ${(typeThresholds.precision * 100).toFixed(1)}%`,
        );
      }

      if (typeThresholds.recall !== undefined && typeMetrics.recall < typeThresholds.recall) {
        failures.push(
          `${type} recall ${(typeMetrics.recall * 100).toFixed(1)}% below threshold ${(typeThresholds.recall * 100).toFixed(1)}%`,
        );
      }
    }
  }

  return {
    passes: failures.length === 0,
    failures,
  };
}

/**
 * Aggregate metrics from multiple documents
 */
export function aggregateMetrics(metricsArray: AccuracyMetrics[]): AccuracyMetrics {
  if (metricsArray.length === 0) {
    return {
      precision: 0,
      recall: 0,
      f1: 0,
      truePositives: 0,
      falsePositives: 0,
      falseNegatives: 0,
      perEntityType: {},
    };
  }

  // Aggregate totals
  let totalTP = 0;
  let totalFP = 0;
  let totalFN = 0;

  const perTypeAggregates: Record<string, { tp: number; fp: number; fn: number }> = {};

  for (const metrics of metricsArray) {
    totalTP += metrics.truePositives;
    totalFP += metrics.falsePositives;
    totalFN += metrics.falseNegatives;

    for (const [type, typeMetrics] of Object.entries(metrics.perEntityType)) {
      if (!perTypeAggregates[type]) {
        perTypeAggregates[type] = { tp: 0, fp: 0, fn: 0 };
      }
      perTypeAggregates[type].tp += typeMetrics.truePositives;
      perTypeAggregates[type].fp += typeMetrics.falsePositives;
      perTypeAggregates[type].fn += typeMetrics.falseNegatives;
    }
  }

  // Calculate aggregated metrics
  const precision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
  const recall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  const perEntityType: Record<string, EntityTypeMetrics> = {};
  for (const [type, agg] of Object.entries(perTypeAggregates)) {
    const typePrecision = agg.tp + agg.fp > 0 ? agg.tp / (agg.tp + agg.fp) : 0;
    const typeRecall = agg.tp + agg.fn > 0 ? agg.tp / (agg.tp + agg.fn) : 0;
    const typeF1 = typePrecision + typeRecall > 0 ? (2 * typePrecision * typeRecall) / (typePrecision + typeRecall) : 0;

    perEntityType[type] = {
      precision: typePrecision,
      recall: typeRecall,
      f1: typeF1,
      truePositives: agg.tp,
      falsePositives: agg.fp,
      falseNegatives: agg.fn,
    };
  }

  return {
    precision,
    recall,
    f1,
    truePositives: totalTP,
    falsePositives: totalFP,
    falseNegatives: totalFN,
    perEntityType,
  };
}
