/**
 * Anonymization Engine
 *
 * Handles text replacement and mapping generation for PII anonymization.
 * Extracted from PreviewPanel for better separation of concerns.
 */

import type { EntityWithSelection } from '../EntitySidebar';

/**
 * Replacement token configuration by entity type
 */
const REPLACEMENT_TOKENS: Record<string, string> = {
  PERSON: '[PERSON]',
  PERSON_NAME: '[PERSON]',
  ORGANIZATION: '[ORG]',
  ORG: '[ORG]',
  ADDRESS: '[ADDRESS]',
  STREET_ADDRESS: '[ADDRESS]',
  EMAIL: '[EMAIL]',
  PHONE: '[PHONE]',
  DATE: '[DATE]',
  MONEY: '[MONEY]',
  IBAN: '[IBAN]',
  SSN: '[SSN]',
  AVS: '[AVS]',
  PASSPORT: '[PASSPORT]',
  LICENSE: '[LICENSE]',
  CREDIT_CARD: '[CC]',
  IP_ADDRESS: '[IP]',
  URL: '[URL]',
  OTHER: '[REDACTED]',
};

/**
 * Get replacement token for an entity type
 */
export function getReplacementToken(type: string): string {
  return REPLACEMENT_TOKENS[type.toUpperCase()] || '[REDACTED]';
}

/**
 * Apply anonymization to content by replacing selected entities
 * Entities are replaced from end to start to preserve position offsets
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
    const replacement = getReplacementToken(entity.type);
    result = result.slice(0, entity.start) + replacement + result.slice(entity.end);
  }

  return result;
}

/**
 * Generate mapping markdown document
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
      const replacement = getReplacementToken(entity.type);
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
