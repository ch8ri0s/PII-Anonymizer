/**
 * Entity Highlight Component for Preview Navigation
 *
 * Handles highlighting PII entities in the document preview,
 * scroll-to-entity navigation, and pulse animations.
 *
 * Story 7.4: Entity Review UI Implementation - AC6
 */

import type { EntityWithSelection } from './EntitySidebar';

/**
 * Highlight configuration per entity type
 */
const HIGHLIGHT_COLORS: Record<string, { bg: string; border: string; pulse: string }> = {
  PERSON: { bg: 'bg-blue-100', border: 'border-blue-400', pulse: 'animate-pulse-blue' },
  ORG: { bg: 'bg-purple-100', border: 'border-purple-400', pulse: 'animate-pulse-purple' },
  ORGANIZATION: { bg: 'bg-purple-100', border: 'border-purple-400', pulse: 'animate-pulse-purple' },
  ADDRESS: { bg: 'bg-green-100', border: 'border-green-400', pulse: 'animate-pulse-green' },
  STREET_ADDRESS: { bg: 'bg-green-100', border: 'border-green-400', pulse: 'animate-pulse-green' },
  EMAIL: { bg: 'bg-yellow-100', border: 'border-yellow-400', pulse: 'animate-pulse-yellow' },
  PHONE: { bg: 'bg-orange-100', border: 'border-orange-400', pulse: 'animate-pulse-orange' },
  DATE: { bg: 'bg-pink-100', border: 'border-pink-400', pulse: 'animate-pulse-pink' },
  ID_NUMBER: { bg: 'bg-red-100', border: 'border-red-400', pulse: 'animate-pulse-red' },
  OTHER: { bg: 'bg-gray-100', border: 'border-gray-400', pulse: 'animate-pulse-gray' },
};

/**
 * Default highlight colors
 */
const DEFAULT_COLORS = { bg: 'bg-gray-100', border: 'border-gray-400', pulse: 'animate-pulse-gray' };

// Module state
let previewContainer: HTMLElement | null = null;
let highlightOverlayContainer: HTMLElement | null = null;
const currentHighlights: Map<string, HTMLElement> = new Map();
let activeHighlightTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * CSS for pulse animations
 */
const PULSE_ANIMATION_CSS = `
  @keyframes entity-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.02); }
  }

  .entity-highlight-pulse {
    animation: entity-pulse 0.5s ease-in-out 4;
  }

  .entity-highlight {
    position: absolute;
    pointer-events: none;
    border-radius: 2px;
    border-width: 2px;
    border-style: solid;
    transition: opacity 0.3s ease;
  }

  .entity-highlight-clickable {
    pointer-events: auto;
    cursor: pointer;
  }

  .entity-highlight-clickable:hover {
    opacity: 0.9;
  }

  .entity-highlight-selected {
    border-width: 3px;
  }

  .entity-highlight-deselected {
    opacity: 0.4;
  }
`;

/**
 * Initialize the entity highlight system
 */
export function initEntityHighlight(container: HTMLElement): void {
  previewContainer = container;

  // Inject animation CSS
  if (!document.getElementById('entity-highlight-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'entity-highlight-styles';
    styleSheet.textContent = PULSE_ANIMATION_CSS;
    document.head.appendChild(styleSheet);
  }

  // Create overlay container for highlights
  highlightOverlayContainer = document.createElement('div');
  highlightOverlayContainer.id = 'entity-highlight-overlay';
  highlightOverlayContainer.className = 'absolute inset-0 pointer-events-none overflow-hidden';
  highlightOverlayContainer.style.position = 'absolute';
  highlightOverlayContainer.style.top = '0';
  highlightOverlayContainer.style.left = '0';
  highlightOverlayContainer.style.width = '100%';
  highlightOverlayContainer.style.height = '100%';

  // Ensure preview container has relative positioning
  const containerStyle = window.getComputedStyle(container);
  if (containerStyle.position === 'static') {
    container.style.position = 'relative';
  }

  container.appendChild(highlightOverlayContainer);
}

/**
 * Render highlights for all visible entities
 */
export function renderHighlights(
  entities: EntityWithSelection[],
  options: {
    clickable?: boolean;
    onClick?: (entity: EntityWithSelection) => void;
  } = {},
): void {
  if (!highlightOverlayContainer || !previewContainer) return;

  // Clear existing highlights
  clearHighlights();

  // Get text content positions
  const textPositions = calculateTextPositions(previewContainer);

  // Create highlights for visible entities
  entities
    .filter(entity => entity.visible)
    .forEach(entity => {
      const highlight = createHighlightElement(entity, textPositions, options);
      if (highlight && highlightOverlayContainer) {
        currentHighlights.set(entity.id, highlight);
        highlightOverlayContainer.appendChild(highlight);
      }
    });
}

/**
 * Calculate positions for text ranges in the container
 */
function calculateTextPositions(container: HTMLElement): Map<number, { x: number; y: number; width: number; height: number }> {
  const positions = new Map<number, { x: number; y: number; width: number; height: number }>();
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  const containerRect = container.getBoundingClientRect();

  let currentOffset = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const textNode = node as Text;
    const text = textNode.textContent || '';

    if (text.length === 0) continue;

    const range = document.createRange();

    for (let i = 0; i < text.length; i++) {
      range.setStart(textNode, i);
      range.setEnd(textNode, i + 1);

      const rect = range.getBoundingClientRect();
      positions.set(currentOffset + i, {
        x: rect.left - containerRect.left + container.scrollLeft,
        y: rect.top - containerRect.top + container.scrollTop,
        width: rect.width,
        height: rect.height,
      });
    }

    currentOffset += text.length;
  }

  return positions;
}

/**
 * Create a highlight element for an entity
 */
function createHighlightElement(
  entity: EntityWithSelection,
  textPositions: Map<number, { x: number; y: number; width: number; height: number }>,
  options: {
    clickable?: boolean;
    onClick?: (entity: EntityWithSelection) => void;
  },
): HTMLElement | null {
  // Get position for entity range
  const startPos = textPositions.get(entity.start);
  const endPos = textPositions.get(Math.max(0, entity.end - 1));

  if (!startPos || !endPos) {
    // Fallback: try to find approximate position
    return createFallbackHighlight(entity, options);
  }

  const colors = HIGHLIGHT_COLORS[entity.type] || DEFAULT_COLORS;

  // Handle multi-line highlights
  if (startPos.y !== endPos.y) {
    // For multi-line, create a wrapper and use bounding box
    const highlight = document.createElement('div');
    highlight.className = `entity-highlight ${colors.bg} ${colors.border}`;
    highlight.dataset.entityId = entity.id;
    highlight.dataset.entityType = entity.type;

    // Calculate bounding box
    const minX = startPos.x;
    const maxX = endPos.x + endPos.width;
    const minY = startPos.y;
    const maxY = endPos.y + endPos.height;

    highlight.style.left = `${minX}px`;
    highlight.style.top = `${minY}px`;
    highlight.style.width = `${maxX - minX}px`;
    highlight.style.height = `${maxY - minY}px`;

    applySelectionStyle(highlight, entity, colors);
    attachClickHandler(highlight, entity, options);

    return highlight;
  }

  // Single line highlight
  const highlight = document.createElement('div');
  highlight.className = `entity-highlight ${colors.bg} ${colors.border}`;
  highlight.dataset.entityId = entity.id;
  highlight.dataset.entityType = entity.type;

  const width = (endPos.x + endPos.width) - startPos.x;

  highlight.style.left = `${startPos.x}px`;
  highlight.style.top = `${startPos.y}px`;
  highlight.style.width = `${width}px`;
  highlight.style.height = `${startPos.height}px`;

  applySelectionStyle(highlight, entity, colors);
  attachClickHandler(highlight, entity, options);

  return highlight;
}

/**
 * Create a fallback highlight when exact positions aren't available
 */
function createFallbackHighlight(
  entity: EntityWithSelection,
  options: {
    clickable?: boolean;
    onClick?: (entity: EntityWithSelection) => void;
  },
): HTMLElement | null {
  if (!previewContainer) return null;

  // Try to find the text in the container
  const text = previewContainer.textContent || '';
  const entityText = entity.text;

  // Search for the entity text starting from expected position
  const searchStart = Math.max(0, entity.start - 10);
  const foundIndex = text.indexOf(entityText, searchStart);

  if (foundIndex === -1) return null;

  // Use TreeWalker to find the text node
  const walker = document.createTreeWalker(previewContainer, NodeFilter.SHOW_TEXT, null);
  let currentOffset = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const nodeText = node.textContent || '';
    const nodeEnd = currentOffset + nodeText.length;

    if (foundIndex >= currentOffset && foundIndex < nodeEnd) {
      // Found the starting text node
      const range = document.createRange();
      const localStart = foundIndex - currentOffset;
      const localEnd = Math.min(localStart + entityText.length, nodeText.length);

      range.setStart(node, localStart);
      range.setEnd(node, localEnd);

      const rect = range.getBoundingClientRect();
      const containerRect = previewContainer.getBoundingClientRect();

      const colors = HIGHLIGHT_COLORS[entity.type] || DEFAULT_COLORS;
      const highlight = document.createElement('div');
      highlight.className = `entity-highlight ${colors.bg} ${colors.border}`;
      highlight.dataset.entityId = entity.id;
      highlight.dataset.entityType = entity.type;

      highlight.style.left = `${rect.left - containerRect.left + previewContainer.scrollLeft}px`;
      highlight.style.top = `${rect.top - containerRect.top + previewContainer.scrollTop}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;

      applySelectionStyle(highlight, entity, colors);
      attachClickHandler(highlight, entity, options);

      return highlight;
    }

    currentOffset = nodeEnd;
  }

  return null;
}

/**
 * Apply selection/deselection styling to highlight
 */
function applySelectionStyle(
  highlight: HTMLElement,
  entity: EntityWithSelection,
  _colors: { bg: string; border: string; pulse: string },
): void {
  if (entity.selected) {
    highlight.classList.add('entity-highlight-selected');
  } else {
    highlight.classList.add('entity-highlight-deselected');
  }
}

/**
 * Attach click handler to highlight
 */
function attachClickHandler(
  highlight: HTMLElement,
  entity: EntityWithSelection,
  options: {
    clickable?: boolean;
    onClick?: (entity: EntityWithSelection) => void;
  },
): void {
  if (options.clickable && options.onClick) {
    highlight.classList.add('entity-highlight-clickable');
    highlight.style.pointerEvents = 'auto';
    const onClick = options.onClick;
    highlight.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(entity);
    });
  }
}

/**
 * Scroll to an entity and apply pulse highlight
 */
export function scrollToEntity(entity: EntityWithSelection): void {
  if (!previewContainer) return;

  const highlight = currentHighlights.get(entity.id);

  if (highlight) {
    // Scroll the highlight into view
    highlight.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });

    // Apply pulse animation
    applyPulseAnimation(entity.id);
  } else {
    // Fallback: scroll to approximate position based on text offset
    scrollToTextOffset(entity.start);
    // Still try to find and pulse the entity
    setTimeout(() => {
      const newHighlight = currentHighlights.get(entity.id);
      if (newHighlight) {
        applyPulseAnimation(entity.id);
      }
    }, 300);
  }
}

/**
 * Scroll to a text offset in the preview
 */
function scrollToTextOffset(offset: number): void {
  if (!previewContainer) return;

  const walker = document.createTreeWalker(previewContainer, NodeFilter.SHOW_TEXT, null);
  let currentOffset = 0;
  let node: Node | null;

  while ((node = walker.nextNode())) {
    const text = node.textContent || '';
    const nodeEnd = currentOffset + text.length;

    if (offset >= currentOffset && offset < nodeEnd) {
      // Found the text node containing our offset
      const range = document.createRange();
      const localOffset = offset - currentOffset;
      range.setStart(node, Math.min(localOffset, text.length));
      range.setEnd(node, Math.min(localOffset + 1, text.length));

      const rect = range.getBoundingClientRect();
      const containerRect = previewContainer.getBoundingClientRect();

      // Calculate scroll position to center the target
      const targetY = rect.top - containerRect.top + previewContainer.scrollTop;
      const scrollTarget = targetY - (previewContainer.clientHeight / 2);

      previewContainer.scrollTo({
        top: Math.max(0, scrollTarget),
        behavior: 'smooth',
      });

      return;
    }

    currentOffset = nodeEnd;
  }
}

/**
 * Apply pulse animation to a highlight
 */
export function applyPulseAnimation(entityId: string): void {
  // Clear any existing animation timeout
  if (activeHighlightTimeout) {
    clearTimeout(activeHighlightTimeout);
  }

  // Remove pulse from all highlights
  currentHighlights.forEach(highlight => {
    highlight.classList.remove('entity-highlight-pulse');
  });

  // Apply pulse to target highlight
  const highlight = currentHighlights.get(entityId);
  if (highlight) {
    highlight.classList.add('entity-highlight-pulse');

    // Remove pulse after 2 seconds (4 pulses at 0.5s each)
    activeHighlightTimeout = setTimeout(() => {
      highlight.classList.remove('entity-highlight-pulse');
      activeHighlightTimeout = null;
    }, 2000);
  }
}

/**
 * Update highlight for a single entity (e.g., selection change)
 */
export function updateHighlight(entity: EntityWithSelection): void {
  const highlight = currentHighlights.get(entity.id);
  if (!highlight) return;

  const colors = HIGHLIGHT_COLORS[entity.type] || DEFAULT_COLORS;

  // Update selection styling
  highlight.classList.remove('entity-highlight-selected', 'entity-highlight-deselected');
  applySelectionStyle(highlight, entity, colors);

  // Update visibility
  if (!entity.visible) {
    highlight.style.display = 'none';
  } else {
    highlight.style.display = '';
  }
}

/**
 * Clear all highlights
 */
export function clearHighlights(): void {
  if (activeHighlightTimeout) {
    clearTimeout(activeHighlightTimeout);
    activeHighlightTimeout = null;
  }

  currentHighlights.forEach(highlight => {
    highlight.remove();
  });
  currentHighlights.clear();
}

/**
 * Get highlight element for an entity
 */
export function getHighlightElement(entityId: string): HTMLElement | undefined {
  return currentHighlights.get(entityId);
}

/**
 * Destroy the highlight system and clean up
 */
export function destroyEntityHighlight(): void {
  clearHighlights();

  if (highlightOverlayContainer && highlightOverlayContainer.parentNode) {
    highlightOverlayContainer.parentNode.removeChild(highlightOverlayContainer);
  }

  highlightOverlayContainer = null;
  previewContainer = null;

  // Remove style sheet
  const styleSheet = document.getElementById('entity-highlight-styles');
  if (styleSheet && styleSheet.parentNode) {
    styleSheet.parentNode.removeChild(styleSheet);
  }
}
