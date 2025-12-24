/**
 * FeedbackIntegration - Integration Layer for Feedback Logging
 *
 * Story 7.8: User Correction Feedback Logging
 * AC #1: Correction is logged to IndexedDB with anonymized context
 * AC #2: Log entry includes: action type, entity type, anonymized context, document hash, timestamp
 * AC #3: For dismissals: original detection source and confidence score are recorded
 *
 * Provides integration hooks for EntitySidebar and ContextMenu to log
 * user corrections (DISMISS and ADD actions).
 */

import type { EntityWithSelection } from '../components/EntitySidebar';
import type { LogCorrectionInput, EntitySource } from '../types/feedback';
import { logCorrection, isEnabled, isAvailable } from './FeedbackLogger';

/**
 * Maximum context length to capture around an entity
 */
const MAX_CONTEXT_LENGTH = 100;

/**
 * Current document information for context
 */
let currentDocumentContent: string = '';
let currentDocumentName: string = '';

/**
 * Track previous selection state for detecting DISMISS actions
 */
const previousSelectionState: Map<string, boolean> = new Map();

/**
 * Set the current document for context in feedback logging
 *
 * @param content The document content (Markdown)
 * @param fileName The document filename
 */
export function setCurrentDocument(content: string, fileName: string): void {
  currentDocumentContent = content;
  currentDocumentName = fileName;
  previousSelectionState.clear();
}

/**
 * Clear the current document context
 */
export function clearCurrentDocument(): void {
  currentDocumentContent = '';
  currentDocumentName = '';
  previousSelectionState.clear();
}

/**
 * Extract context around an entity (surrounding text)
 *
 * @param start Entity start position
 * @param end Entity end position
 * @returns Context string with entity text and surrounding text
 */
function extractContext(start: number, end: number): string {
  if (!currentDocumentContent) {
    return '';
  }

  // Calculate context boundaries
  const contextStart = Math.max(0, start - MAX_CONTEXT_LENGTH / 2);
  const contextEnd = Math.min(currentDocumentContent.length, end + MAX_CONTEXT_LENGTH / 2);

  // Extract context
  let context = currentDocumentContent.substring(contextStart, contextEnd);

  // Add ellipsis if truncated
  if (contextStart > 0) {
    context = '...' + context;
  }
  if (contextEnd < currentDocumentContent.length) {
    context = context + '...';
  }

  return context;
}

/**
 * Map entity source to feedback source type
 */
function mapSource(source?: string): EntitySource | undefined {
  if (!source) return undefined;

  switch (source.toUpperCase()) {
    case 'ML':
      return 'ML';
    case 'REGEX':
    case 'RULE':
      return 'REGEX';
    case 'BOTH':
      return 'BOTH';
    case 'MANUAL':
      return 'MANUAL';
    default:
      return undefined;
  }
}

/**
 * Log a DISMISS action when user deselects an entity
 *
 * @param entity The entity that was deselected
 */
export async function logDismiss(entity: EntityWithSelection): Promise<void> {
  // Skip if logging is disabled or unavailable
  if (!isEnabled() || !isAvailable()) {
    return;
  }

  // Skip manual entities (user just added them)
  if (entity.source === 'MANUAL') {
    return;
  }

  try {
    const input: LogCorrectionInput = {
      action: 'DISMISS',
      entityType: entity.type,
      originalText: entity.text,
      contextText: extractContext(entity.start, entity.end),
      documentName: currentDocumentName || 'unknown',
      originalSource: mapSource(entity.source),
      confidence: entity.confidence,
      position: {
        start: entity.start,
        end: entity.end,
      },
    };

    const result = await logCorrection(input);
    if (!result.success && result.error !== 'Logging disabled') {
      console.warn('Failed to log dismiss:', result.error);
    }
  } catch (error) {
    console.warn('Error logging dismiss:', error);
  }
}

/**
 * Log an ADD action when user manually marks text as PII
 *
 * @param text The marked text
 * @param type The entity type selected by user
 * @param start Start position in document
 * @param end End position in document
 */
export async function logAdd(
  text: string,
  type: string,
  start: number,
  end: number,
): Promise<void> {
  // Skip if logging is disabled or unavailable
  if (!isEnabled() || !isAvailable()) {
    return;
  }

  try {
    const input: LogCorrectionInput = {
      action: 'ADD',
      entityType: type,
      originalText: text,
      contextText: extractContext(start, end),
      documentName: currentDocumentName || 'unknown',
      originalSource: 'MANUAL', // Mark as manual addition for logs
      position: { start, end },
    };

    const result = await logCorrection(input);
    if (!result.success && result.error !== 'Logging disabled') {
      console.warn('Failed to log add:', result.error);
    }
  } catch (error) {
    console.warn('Error logging add:', error);
  }
}

/**
 * Initialize selection tracking for a set of entities
 *
 * Call this when entities are first loaded to establish baseline state.
 *
 * @param entities The initial entities with selection state
 */
export function initializeSelectionTracking(entities: EntityWithSelection[]): void {
  previousSelectionState.clear();
  for (const entity of entities) {
    previousSelectionState.set(entity.id, entity.selected);
  }
}

/**
 * Handle selection changes and detect DISMISS actions
 *
 * Compares new selection state with previous state to detect
 * entities that were deselected (DISMISS action).
 *
 * @param entities The updated entities with selection state
 */
export async function handleSelectionChanges(entities: EntityWithSelection[]): Promise<void> {
  // Skip if logging is disabled
  if (!isEnabled() || !isAvailable()) {
    // Still update tracking state
    for (const entity of entities) {
      previousSelectionState.set(entity.id, entity.selected);
    }
    return;
  }

  // Find entities that changed from selected to deselected (DISMISS)
  const dismissPromises: Promise<void>[] = [];

  for (const entity of entities) {
    const wasSelected = previousSelectionState.get(entity.id);

    // If entity was selected before but now is not -> DISMISS
    if (wasSelected === true && entity.selected === false) {
      dismissPromises.push(logDismiss(entity));
    }

    // Update tracking state
    previousSelectionState.set(entity.id, entity.selected);
  }

  // Wait for all dismiss logs (but don't block UI)
  if (dismissPromises.length > 0) {
    try {
      await Promise.all(dismissPromises);
    } catch (error) {
      console.warn('Error logging dismissals:', error);
    }
  }
}

/**
 * Handle manual entity addition
 *
 * Called when user marks text as PII through context menu.
 *
 * @param text The marked text
 * @param type The entity type
 * @param start Start position
 * @param end End position
 */
export async function handleManualMark(
  text: string,
  type: string,
  start: number,
  end: number,
): Promise<void> {
  // Log the ADD action
  await logAdd(text, type, start, end);
}

/**
 * Reset the integration state (for testing)
 */
export function resetFeedbackIntegration(): void {
  clearCurrentDocument();
}
