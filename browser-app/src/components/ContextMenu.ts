/**
 * Context Menu Component for Manual PII Marking
 *
 * Shows a context menu when user right-clicks on selected text in the preview,
 * allowing users to manually mark selected text as PII.
 *
 * Story 7.4: Entity Review UI Implementation - AC5
 * Story 7.7: Manual PII Marking UI Polish - Fixed to use right-click (contextmenu event)
 */

import {
  type EntityForMapping,
  mapDomOffsetToOriginal,
  calculateDomOffset,
} from './utils/offsetMapper';

/**
 * Entity types available for manual marking
 * Each type has a keyboard shortcut key for quick selection
 */
const ENTITY_TYPES = [
  { type: 'PERSON', label: 'Person', icon: '👤', key: 'p' },
  { type: 'ORG', label: 'Organization', icon: '🏢', key: 'o' },
  { type: 'ADDRESS', label: 'Address', icon: '📍', key: 'a' },
  { type: 'EMAIL', label: 'Email', icon: '📧', key: 'e' },
  { type: 'PHONE', label: 'Phone', icon: '📞', key: 'h' },
  { type: 'DATE', label: 'Date', icon: '📅', key: 'd' },
  { type: 'ID_NUMBER', label: 'ID Number', icon: '🔢', key: 'i' },
  { type: 'OTHER', label: 'Other', icon: '📄', key: 't' },
];

/**
 * Callback for when a type is selected
 */
export type OnMarkCallback = (
  text: string,
  type: string,
  start: number,
  end: number
) => void;

/**
 * CSS for selection highlight and tooltip
 */
const SELECTION_CSS = `
  .pii-selection-tooltip {
    position: absolute;
    z-index: 40;
    padding: 0.25rem 0.5rem;
    background: hsl(217.2 91.2% 59.8%);
    color: white;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 0.25rem;
    box-shadow: 0 2px 4px rgb(0 0 0 / 0.1);
    pointer-events: none;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 0.15s ease, transform 0.15s ease;
    white-space: nowrap;
  }

  .pii-selection-tooltip.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .pii-selection-highlight {
    background-color: hsla(217.2, 91.2%, 59.8%, 0.2);
    border-radius: 2px;
  }

  /* Style for native browser selection when in marking mode */
  .pii-marking-mode ::selection {
    background-color: hsla(217.2, 91.2%, 59.8%, 0.3);
  }
`;

// Offset mapper state getters
let getEntitiesForMapping: (() => EntityForMapping[]) | null = null;
let getIsShowingAnonymized: (() => boolean) | null = null;

/**
 * Set state getters for offset mapping (called by PreviewPanel)
 */
export function setOffsetMapperState(
  getEntities: () => EntityForMapping[],
  isAnonymized: () => boolean,
): void {
  getEntitiesForMapping = getEntities;
  getIsShowingAnonymized = isAnonymized;
}

// Module state
let menuElement: HTMLElement | null = null;
let tooltipElement: HTMLElement | null = null;
let tooltipTimeout: ReturnType<typeof setTimeout> | null = null;
let currentSelection: { text: string; start: number; end: number } | null = null;
let pendingSelection: { text: string; start: number; end: number } | null = null;
let onMarkCallback: OnMarkCallback | null = null;
let focusedItemIndex: number = -1;
let selectionContainer: HTMLElement | null = null;

/**
 * Inject CSS styles for selection feedback
 */
function injectSelectionStyles(): void {
  if (!document.getElementById('pii-selection-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'pii-selection-styles';
    styleSheet.textContent = SELECTION_CSS;
    document.head.appendChild(styleSheet);
  }
}

/**
 * Create tooltip element
 */
function createTooltip(): HTMLElement {
  const tooltip = document.createElement('div');
  tooltip.id = 'pii-selection-tooltip';
  tooltip.className = 'pii-selection-tooltip';
  tooltip.textContent = 'Right-click to mark as PII';
  document.body.appendChild(tooltip);
  return tooltip;
}

/**
 * Show tooltip near the selection
 */
function showTooltip(): void {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !tooltipElement) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Position tooltip above the selection
  const tooltipRect = tooltipElement.getBoundingClientRect();
  let left = rect.left + (rect.width - tooltipRect.width) / 2;
  let top = rect.top - tooltipRect.height - 8;

  // Keep within viewport
  left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
  if (top < 8) {
    top = rect.bottom + 8; // Show below if no room above
  }

  tooltipElement.style.left = `${left}px`;
  tooltipElement.style.top = `${top}px`;
  tooltipElement.classList.add('visible');
}

/**
 * Hide tooltip
 */
function hideTooltip(): void {
  if (tooltipElement) {
    tooltipElement.classList.remove('visible');
  }
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
}

/**
 * Initialize the context menu
 */
export function initContextMenu(callback: OnMarkCallback): void {
  onMarkCallback = callback;
  injectSelectionStyles();

  // Create tooltip element
  tooltipElement = createTooltip();

  // Create menu element
  menuElement = document.createElement('div');
  menuElement.id = 'pii-context-menu';
  menuElement.className = 'fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-2 hidden';
  menuElement.setAttribute('role', 'menu');
  menuElement.setAttribute('aria-label', 'Mark as PII');

  // Build menu content with keyboard hints
  menuElement.innerHTML = `
    <div class="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 mb-1">
      Mark as PII
    </div>
    ${ENTITY_TYPES.map(({ type, label, icon, key }, index) => `
      <button
        class="context-menu-item w-full text-left px-3 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none flex items-center gap-2"
        data-type="${type}"
        data-key="${key}"
        data-index="${index}"
        role="menuitem"
        tabindex="-1"
      >
        <span>${icon}</span>
        <span class="text-sm text-gray-700 flex-1">${label}</span>
        <span class="text-xs text-gray-400 font-mono uppercase">${key}</span>
      </button>
    `).join('')}
  `;

  document.body.appendChild(menuElement);

  // Attach event listeners
  attachMenuEventListeners();

  // Close menu on outside click
  document.addEventListener('click', handleOutsideClick);
  document.addEventListener('keydown', handleKeyDown);
}

/**
 * Show the context menu at the given position
 */
export function showContextMenu(
  x: number,
  y: number,
  selection: { text: string; start: number; end: number },
): void {
  if (!menuElement) return;

  currentSelection = selection;
  focusedItemIndex = -1; // Reset focus when showing

  // Position the menu
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Adjust position to stay within viewport
  let posX = x;
  let posY = y;

  // Show temporarily to get dimensions
  menuElement.classList.remove('hidden');
  const menuRect = menuElement.getBoundingClientRect();

  if (posX + menuRect.width > viewportWidth - 10) {
    posX = viewportWidth - menuRect.width - 10;
  }

  if (posY + menuRect.height > viewportHeight - 10) {
    posY = viewportHeight - menuRect.height - 10;
  }

  menuElement.style.left = `${posX}px`;
  menuElement.style.top = `${posY}px`;
}

/**
 * Hide the context menu
 */
export function hideContextMenu(): void {
  if (menuElement) {
    menuElement.classList.add('hidden');
  }
  hideTooltip();
  currentSelection = null;
  focusedItemIndex = -1;
}

/**
 * Check if the context menu is visible
 */
export function isContextMenuVisible(): boolean {
  return menuElement !== null && !menuElement.classList.contains('hidden');
}

/**
 * Attach event listeners to menu items
 */
function attachMenuEventListeners(): void {
  if (!menuElement) return;

  menuElement.querySelectorAll('.context-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const type = (item as HTMLElement).dataset.type;
      if (!type) return;

      if (currentSelection && onMarkCallback) {
        onMarkCallback(
          currentSelection.text,
          type,
          currentSelection.start,
          currentSelection.end,
        );
      }

      hideContextMenu();
    });
  });
}

/**
 * Handle clicks outside the menu
 */
function handleOutsideClick(e: MouseEvent): void {
  if (menuElement && !menuElement.contains(e.target as Node)) {
    hideContextMenu();
  }
}

/**
 * Handle keyboard events for menu navigation and selection
 */
function handleKeyDown(e: KeyboardEvent): void {
  if (!isContextMenuVisible()) return;

  // Escape closes the menu
  if (e.key === 'Escape') {
    hideContextMenu();
    return;
  }

  // Arrow key navigation
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const items = menuElement?.querySelectorAll('.context-menu-item');
    if (!items || items.length === 0) return;

    if (e.key === 'ArrowDown') {
      focusedItemIndex = (focusedItemIndex + 1) % items.length;
    } else {
      focusedItemIndex = focusedItemIndex <= 0 ? items.length - 1 : focusedItemIndex - 1;
    }

    (items[focusedItemIndex] as HTMLElement).focus();
    return;
  }

  // Enter selects focused item
  if (e.key === 'Enter' && focusedItemIndex >= 0) {
    e.preventDefault();
    const items = menuElement?.querySelectorAll('.context-menu-item');
    if (items && items[focusedItemIndex]) {
      (items[focusedItemIndex] as HTMLElement).click();
    }
    return;
  }

  // Single-key shortcuts for entity types
  const pressedKey = e.key.toLowerCase();
  const matchingType = ENTITY_TYPES.find(t => t.key === pressedKey);
  if (matchingType && currentSelection && onMarkCallback) {
    e.preventDefault();
    onMarkCallback(
      currentSelection.text,
      matchingType.type,
      currentSelection.start,
      currentSelection.end,
    );
    hideContextMenu();
  }
}

/**
 * Setup text selection handler for a container
 * Tracks selection on mouseup and shows context menu on right-click
 */
export function setupTextSelectionHandler(
  container: HTMLElement,
  getTextOffset: (node: Node, offset: number) => number,
): void {
  selectionContainer = container;

  // Add marking mode class for selection styling
  container.classList.add('pii-marking-mode');

  // Track selection state on any selection change (mouseup)
  container.addEventListener('mouseup', () => {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      pendingSelection = null;
      hideTooltip();
      return;
    }

    const text = selection.toString().trim();

    // Don't track very short selections
    if (text.length < 2) {
      pendingSelection = null;
      hideTooltip();
      return;
    }

    // Calculate text offset within the container and store
    const range = selection.getRangeAt(0);
    const start = getTextOffset(range.startContainer, range.startOffset);
    const end = start + text.length;

    pendingSelection = { text, start, end };

    // Show tooltip hint after a brief delay (non-intrusive)
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
    }
    tooltipTimeout = setTimeout(() => {
      showTooltip();
    }, 300);
  });

  // Show context menu on right-click if text is selected
  container.addEventListener('contextmenu', (e) => {
    const selection = window.getSelection();

    // Re-check selection state in case it changed
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      pendingSelection = null;
      hideTooltip();
      return; // Allow default context menu if no selection
    }

    const text = selection.toString().trim();
    if (text.length < 2) {
      pendingSelection = null;
      hideTooltip();
      return; // Allow default context menu for very short selections
    }

    // Recalculate offset in case selection changed
    const range = selection.getRangeAt(0);
    const start = getTextOffset(range.startContainer, range.startOffset);
    const end = start + text.length;

    pendingSelection = { text, start, end };

    // Hide tooltip when context menu appears
    hideTooltip();

    // Prevent default browser context menu
    e.preventDefault();

    // Show our context menu at mouse position
    showContextMenu(e.clientX, e.clientY, pendingSelection);
  });
}

/**
 * Create a text offset calculator for a container
 * Returns a function that calculates the offset of a node/offset pair
 * within the ORIGINAL document content (not the rendered DOM)
 *
 * This is critical for manual marking: the DOM shows replacement tokens
 * like [PERSON] but we need the offset in the original markdown.
 */
export function createTextOffsetCalculator(container: HTMLElement): (node: Node, offset: number) => number {
  return (node: Node, offset: number): number => {
    // Calculate DOM offset first
    const domOffset = calculateDomOffset(container, node, offset);

    // If no state getters or not showing anonymized, return DOM offset
    if (!getEntitiesForMapping || !getIsShowingAnonymized) {
      return domOffset;
    }

    const entities = getEntitiesForMapping();
    const showingAnonymized = getIsShowingAnonymized();

    // If not showing anonymized view or no entities, use DOM offset
    if (!showingAnonymized || entities.length === 0) {
      return domOffset;
    }

    // Map DOM offset to original content offset
    return mapDomOffsetToOriginal(domOffset, entities);
  };
}

/**
 * Destroy the context menu and clean up
 */
export function destroyContextMenu(): void {
  document.removeEventListener('click', handleOutsideClick);
  document.removeEventListener('keydown', handleKeyDown);

  if (menuElement && menuElement.parentNode) {
    menuElement.parentNode.removeChild(menuElement);
  }

  if (tooltipElement && tooltipElement.parentNode) {
    tooltipElement.parentNode.removeChild(tooltipElement);
  }

  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
  }

  if (selectionContainer) {
    selectionContainer.classList.remove('pii-marking-mode');
  }

  menuElement = null;
  tooltipElement = null;
  tooltipTimeout = null;
  currentSelection = null;
  pendingSelection = null;
  onMarkCallback = null;
  focusedItemIndex = -1;
  selectionContainer = null;
}

/**
 * Get current pending selection (for external use like keyboard shortcuts)
 */
export function getPendingSelection(): { text: string; start: number; end: number } | null {
  return pendingSelection;
}

/**
 * Get the entity types available for marking
 */
export function getEntityTypes(): typeof ENTITY_TYPES {
  return ENTITY_TYPES;
}
