/**
 * Anonymization Engine
 *
 * Handles text replacement and mapping generation for PII anonymization.
 * Extracted from PreviewPanel for better separation of concerns.
 *
 * Uses numbered entity tokens (e.g., [DATE_1], [DATE_2]) for consistent
 * anonymization across the document per Story 8.8 requirements.
 */

import type { EntityWithSelection } from '../EntitySidebar';

/**
 * Base type mapping for entity type normalization
 */
const TYPE_NORMALIZATION: Record<string, string> = {
  PERSON: 'PERSON',
  PERSON_NAME: 'PERSON',
  ORGANIZATION: 'ORG',
  ORG: 'ORG',
  ADDRESS: 'ADDRESS',
  STREET_ADDRESS: 'ADDRESS',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  DATE: 'DATE',
  MONEY: 'MONEY',
  IBAN: 'IBAN',
  SSN: 'SSN',
  AVS: 'AVS',
  PASSPORT: 'PASSPORT',
  LICENSE: 'LICENSE',
  CREDIT_CARD: 'CC',
  IP_ADDRESS: 'IP',
  URL: 'URL',
};

/**
 * Normalize entity type to standard base type
 */
function normalizeType(type: string): string {
  return TYPE_NORMALIZATION[type.toUpperCase()] || type.toUpperCase();
}

/**
 * Session for tracking entity → numbered token mappings
 * Creates consistent numbered tokens like [DATE_1], [DATE_2] for each unique entity value
 */
export class AnonymizationSession {
  private counters: Record<string, number> = {};
  private textToToken: Map<string, string> = new Map();

  /**
   * Get or create a numbered token for an entity
   * Same entity text always gets the same token within a session
   */
  getOrCreateToken(entityText: string, entityType: string): string {
    // Normalize text for comparison (case-insensitive, trimmed)
    const normalizedText = entityText.toLowerCase().trim();

    // Check if we already have a token for this text
    const existingToken = this.textToToken.get(normalizedText);
    if (existingToken) {
      return existingToken;
    }

    // Normalize the type
    const baseType = normalizeType(entityType);

    // Initialize counter for this type if needed
    if (!this.counters[baseType]) {
      this.counters[baseType] = 1;
    }

    // Generate numbered token
    const token = `[${baseType}_${this.counters[baseType]++}]`;
    this.textToToken.set(normalizedText, token);

    return token;
  }

  /**
   * Get the mapping of entity text to tokens
   */
  getMapping(): Map<string, string> {
    return new Map(this.textToToken);
  }

  /**
   * Reset the session state
   */
  reset(): void {
    this.counters = {};
    this.textToToken.clear();
  }
}

// Shared session instance for consistent numbering within a document
let currentSession: AnonymizationSession | null = null;

/**
 * Get or create the current anonymization session
 */
export function getAnonymizationSession(): AnonymizationSession {
  if (!currentSession) {
    currentSession = new AnonymizationSession();
  }
  return currentSession;
}

/**
 * Reset the anonymization session (call when loading a new document)
 */
export function resetAnonymizationSession(): void {
  if (currentSession) {
    currentSession.reset();
  }
  currentSession = null;
}

/**
 * Get replacement token for an entity
 * Uses the session to track and generate numbered tokens
 */
export function getReplacementToken(type: string, text?: string): string {
  if (!text) {
    // Fallback for backwards compatibility - generate unnumbered token
    const baseType = normalizeType(type);
    return `[${baseType}]`;
  }

  const session = getAnonymizationSession();
  return session.getOrCreateToken(text, type);
}

/**
 * Apply anonymization to content by replacing selected entities
 * Entities are replaced from end to start to preserve position offsets
 * Uses numbered tokens (e.g., [DATE_1], [DATE_2]) for consistent replacement
 */
export function applyAnonymization(
  content: string,
  entities: EntityWithSelection[],
): string {
  // Filter to selected entities only and sort by position descending
  const selectedEntities = entities
    .filter(e => e.selected)
    .sort((a, b) => b.start - a.start);

  let result = content;
  for (const entity of selectedEntities) {
    // Pass entity text to get numbered token
    const replacement = getReplacementToken(entity.type, entity.text);
    result = result.slice(0, entity.start) + replacement + result.slice(entity.end);
  }

  return result;
}

/**
 * Generate mapping markdown document
 * Uses numbered tokens consistent with applyAnonymization
 */
export function generateMappingMarkdown(
  filename: string,
  selectedEntities: EntityWithSelection[],
  allEntities?: EntityWithSelection[],
): string {
  const all = allEntities || selectedEntities;
  const selected = selectedEntities.filter(e => e.selected);

  const lines = [
    `# PII Mapping: ${filename}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Anonymized PII',
    '',
  ];

  if (selected.length === 0) {
    lines.push('No PII was anonymized in this document.');
  } else {
    lines.push('| Original | Replacement | Type | Source | Confidence |');
    lines.push('| -------- | ----------- | ---- | ------ | ---------- |');

    for (const entity of selected) {
      const escapedOriginal = entity.text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      // Use numbered token consistent with applyAnonymization
      const replacement = getReplacementToken(entity.type, entity.text);
      const source = entity.source || 'REGEX';
      const confidence = entity.source === 'MANUAL' ? '100%' : `${Math.round((entity.confidence || 0) * 100)}%`;
      lines.push(`| ${escapedOriginal} | ${replacement} | ${entity.type} | ${source} | ${confidence} |`);
    }
  }

  lines.push('');
  lines.push('## Statistics');
  lines.push('');
  lines.push(`- **Total entities detected**: ${all.length}`);
  lines.push(`- **Entities anonymized**: ${selected.length}`);
  lines.push(`- **Entities skipped**: ${all.length - selected.length}`);

  // Count by type
  const byType: Record<string, number> = {};
  for (const entity of selected) {
    byType[entity.type] = (byType[entity.type] || 0) + 1;
  }

  if (Object.keys(byType).length > 0) {
    lines.push('');
    lines.push('### By Type');
    for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      lines.push(`- **${type}**: ${count}`);
    }
  }

  // Count by source
  const bySource: Record<string, number> = {};
  for (const entity of selected) {
    const source = entity.source || 'REGEX';
    bySource[source] = (bySource[source] || 0) + 1;
  }

  if (Object.keys(bySource).length > 0) {
    lines.push('');
    lines.push('### By Source');
    for (const [source, count] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
      lines.push(`- **${source}**: ${count}`);
    }
  }

  return lines.join('\n');
}

/**
 * Copy text to clipboard
 * Returns true on success, false on failure
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      return false;
    }
  }
}
