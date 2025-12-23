/**
 * Shared Test Helpers
 *
 * Common utility functions used across both
 * Electron and browser-app integration tests.
 */

import { MIME_TYPES, EntityReviewState } from './constants';

/**
 * Get MIME type from filename extension
 */
export function getMimeType(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Get review result from entity review state
 * Entities are anonymized unless explicitly rejected
 */
export function getReviewResult(entityReviewState: EntityReviewState) {
  const entitiesToAnonymize = entityReviewState.entities
    .filter(e => e.status !== 'rejected')
    .map(e => ({
      originalText: e.originalText,
      replacement: e.editedReplacement || e.replacement,
      type: e.type,
    }));

  const rejectedEntities = entityReviewState.entities
    .filter(e => e.status === 'rejected')
    .map(e => ({
      originalText: e.originalText,
      type: e.type,
    }));

  return { entitiesToAnonymize, rejectedEntities };
}

/**
 * Apply selective anonymization to original markdown
 */
export function applySelectiveAnonymization(
  originalMarkdown: string,
  entitiesToAnonymize: Array<{ originalText: string; replacement: string }>,
): string {
  if (!originalMarkdown) return '';

  let result = originalMarkdown;

  // Sort entities by length (longest first) to avoid partial replacements
  const sortedEntities = [...entitiesToAnonymize].sort(
    (a, b) => b.originalText.length - a.originalText.length,
  );

  for (const entity of sortedEntities) {
    const { originalText, replacement } = entity;
    if (!originalText || !replacement) continue;

    const escapedText = originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedText, 'g');
    result = result.replace(regex, replacement);
  }

  return result;
}

/**
 * Generate markdown output from processing result and review state
 */
export function generateMarkdownOutput(
  processingResult: { originalMarkdown?: string | null },
  entityReviewState: EntityReviewState,
): string {
  const reviewResult = getReviewResult(entityReviewState);

  const originalMarkdown = processingResult.originalMarkdown;
  if (originalMarkdown === undefined || originalMarkdown === null) {
    throw new Error('originalMarkdown not available - IPC pipeline broken');
  }

  return applySelectiveAnonymization(originalMarkdown, reviewResult.entitiesToAnonymize);
}

/**
 * Generate mapping output from processing result and review state
 */
export function generateMappingOutput(
  processingResult: { metadata: { name: string } },
  entityReviewState: EntityReviewState,
) {
  const reviewResult = getReviewResult(entityReviewState);

  const entities: Record<string, string> = {};
  reviewResult.entitiesToAnonymize.forEach(entity => {
    entities[entity.originalText] = entity.replacement;
  });

  return {
    version: '2.0',
    originalFile: processingResult.metadata.name,
    timestamp: new Date().toISOString(),
    model: 'Xenova/distilbert-base-multilingual-cased-ner-hrl',
    detectionMethods: ['ML (transformers)', 'Rule-based (Swiss/EU)'],
    entities,
  };
}

/**
 * Group entities by type for reporting
 */
export function groupByType<T extends { type: string }>(items: T[]): Record<string, number> {
  const byType: Record<string, number> = {};
  for (const item of items) {
    byType[item.type] = (byType[item.type] || 0) + 1;
  }
  return byType;
}

/**
 * Calculate confidence statistics for entities
 */
export function calculateConfidenceStats(entities: Array<{ confidence: number }>) {
  if (entities.length === 0) {
    return { average: 0, high: 0, low: 0 };
  }

  const avgConfidence = entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length;
  const highConfidence = entities.filter(e => e.confidence >= 0.8).length;
  const lowConfidence = entities.filter(e => e.confidence < 0.5).length;

  return {
    average: avgConfidence,
    high: highConfidence,
    low: lowConfidence,
  };
}

/**
 * Check for overlapping entity spans
 */
export function findOverlappingEntities(entities: Array<{ start: number; end: number; text: string }>) {
  const sorted = [...entities].sort((a, b) => a.start - b.start);
  const overlaps: Array<{ current: typeof entities[0]; next: typeof entities[0] }> = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];

    if (current.end > next.start) {
      overlaps.push({ current, next });
    }
  }

  return overlaps;
}

/**
 * Validate entity structure has all required properties
 */
export function validateEntityStructure(
  entity: Record<string, unknown>,
  requiredProps: readonly string[],
): { valid: boolean; missing: string[] } {
  const missing = requiredProps.filter(prop => !(prop in entity));
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Validate pipeline result structure
 */
export function validatePipelineResultStructure(
  result: Record<string, unknown>,
  requiredRoot: readonly string[],
  requiredMetadata: readonly string[],
): { valid: boolean; missingRoot: string[]; missingMetadata: string[] } {
  const missingRoot = requiredRoot.filter(prop => !(prop in result));
  const metadata = result.metadata as Record<string, unknown> | undefined;
  const missingMetadata = metadata
    ? requiredMetadata.filter(prop => !(prop in metadata))
    : [...requiredMetadata];

  return {
    valid: missingRoot.length === 0 && missingMetadata.length === 0,
    missingRoot,
    missingMetadata,
  };
}

/**
 * Format test output for console logging
 */
export function formatTestOutput(filename: string, data: Record<string, unknown>): string {
  const lines = [`  ${filename}:`];
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'number') {
      lines.push(`    ${key}: ${value.toFixed ? value.toFixed(1) : value}`);
    } else if (typeof value === 'object') {
      lines.push(`    ${key}: ${JSON.stringify(value)}`);
    } else {
      lines.push(`    ${key}: ${value}`);
    }
  }
  return lines.join('\n');
}
