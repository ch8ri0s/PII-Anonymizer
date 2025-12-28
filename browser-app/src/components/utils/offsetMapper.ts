/**
 * Offset Mapper Utility
 *
 * Maps DOM text offsets back to original document offsets.
 * Required for manual PII marking when the preview shows
 * replacement tokens instead of original text.
 */

import { getReplacementToken } from '../preview/AnonymizationEngine';
import { createLogger } from '../../utils/logger';

// Logger for offset mapper - debug level for verbose trace logging
const log = createLogger('utils:offset');

/**
 * Debug logging - uses logger with debug level
 * To enable, set log level to 'debug' in LoggerFactory.setLevel('debug')
 * or via VITE_LOG_LEVEL=debug environment variable
 */
function debug(message: string, data?: Record<string, unknown>): void {
  log.debug(message, data);
}

/**
 * Entity info needed for offset mapping
 */
export interface EntityForMapping {
  start: number;
  end: number;
  text: string;
  type: string;
  selected?: boolean;
  entityIndex?: number;
}

/**
 * Map a DOM text offset back to the original document offset
 *
 * The DOM shows:
 *   - Plain text between entities
 *   - For selected entities: badge number + replacement token (e.g., "1[PERSON]")
 *   - For unselected entities: badge number + original text
 */
export function mapDomOffsetToOriginal(
  domOffset: number,
  entities: EntityForMapping[],
): number {
  // Sort entities by position
  const sortedEntities = [...entities].sort((a, b) => a.start - b.start);

  let domPos = 0;
  let originalPos = 0;

  debug('Mapping domOffset', { domOffset, entityCount: entities.length });

  for (let i = 0; i < sortedEntities.length; i++) {
    const entity = sortedEntities[i];
    // Text before this entity (same in both DOM and original)
    const textBeforeLength = entity.start - originalPos;

    debug(`Processing entity ${i}`, {
      text: entity.text,
      type: entity.type,
      start: entity.start,
      end: entity.end,
      textBeforeLength,
      domPos,
      originalPos,
    });

    if (domOffset < domPos + textBeforeLength) {
      // Selection is in plain text before this entity
      const result = originalPos + (domOffset - domPos);
      debug('In text before entity', { result });
      return result;
    }

    domPos += textBeforeLength;
    originalPos = entity.start;

    // Calculate DOM length for this entity
    const entityNum = entity.entityIndex ?? 0;
    const badgeLength = String(entityNum).length;

    let domEntityLength: number;
    if (entity.selected !== false) {
      // Selected: shows [TYPE] token - use same function as renderer
      const token = getReplacementToken(entity.type);
      domEntityLength = badgeLength + token.length;
      debug('Selected entity', { badge: entityNum, token, domEntityLength });
    } else {
      // Unselected: shows original text
      domEntityLength = badgeLength + entity.text.length;
      debug('Unselected entity', { domEntityLength });
    }

    debug('Boundary check', { domOffset, domPos, domEntityLength, threshold: domPos + domEntityLength, isWithin: domOffset < domPos + domEntityLength });

    if (domOffset < domPos + domEntityLength) {
      // Selection is within this entity - map to entity start
      debug('Within entity, returning entity.start', { entityStart: entity.start });
      return entity.start;
    }

    domPos += domEntityLength;
    originalPos = entity.end;
    debug('After entity', { domPos, originalPos });
  }

  // After all entities - remaining text
  const result = originalPos + (domOffset - domPos);
  debug('After all entities', { result });
  return result;
}

/**
 * Calculate simple DOM text offset by walking nodes
 */
export function calculateDomOffset(
  container: HTMLElement,
  node: Node,
  offset: number,
): number {
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_TEXT,
    null,
  );

  let totalOffset = 0;
  let currentNode: Node | null;

  while ((currentNode = walker.nextNode())) {
    if (currentNode === node) {
      return totalOffset + offset;
    }
    totalOffset += currentNode.textContent?.length || 0;
  }

  return offset;
}
