/**
 * Context Menu Component for Manual PII Marking
 *
 * Shows a context menu when text is selected in the preview,
 * allowing users to manually mark selected text as PII.
 *
 * Story 7.4: Entity Review UI Implementation - AC5
 */

/**
 * Entity types available for manual marking
 */
const ENTITY_TYPES = [
  { type: 'PERSON', label: 'Person', icon: '👤' },
  { type: 'ORG', label: 'Organization', icon: '🏢' },
  { type: 'ADDRESS', label: 'Address', icon: '📍' },
  { type: 'EMAIL', label: 'Email', icon: '📧' },
  { type: 'PHONE', label: 'Phone', icon: '📞' },
  { type: 'DATE', label: 'Date', icon: '📅' },
  { type: 'ID_NUMBER', label: 'ID Number', icon: '🔢' },
  { type: 'OTHER', label: 'Other', icon: '📄' },
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

// Module state
let menuElement: HTMLElement | null = null;
let currentSelection: { text: string; start: number; end: number } | null = null;
let onMarkCallback: OnMarkCallback | null = null;

/**
 * Initialize the context menu
 */
export function initContextMenu(callback: OnMarkCallback): void {
  onMarkCallback = callback;

  // Create menu element
  menuElement = document.createElement('div');
  menuElement.id = 'pii-context-menu';
  menuElement.className = 'fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-2 hidden';
  menuElement.setAttribute('role', 'menu');
  menuElement.setAttribute('aria-label', 'Mark as PII');

  // Build menu content
  menuElement.innerHTML = `
    <div class="px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 mb-1">
      Mark as PII
    </div>
    ${ENTITY_TYPES.map(({ type, label, icon }) => `
      <button
        class="context-menu-item w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2"
        data-type="${type}"
        role="menuitem"
      >
        <span>${icon}</span>
        <span class="text-sm text-gray-700">${label}</span>
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
  currentSelection = null;
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
 * Handle keyboard events
 */
function handleKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    hideContextMenu();
  }
}

/**
 * Setup text selection handler for a container
 */
export function setupTextSelectionHandler(
  container: HTMLElement,
  getTextOffset: (node: Node, offset: number) => number,
): void {
  container.addEventListener('mouseup', (e) => {
    const selection = window.getSelection();

    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return;
    }

    const text = selection.toString().trim();

    // Don't show for very short selections
    if (text.length < 2) {
      return;
    }

    // Calculate text offset within the container
    const range = selection.getRangeAt(0);
    const start = getTextOffset(range.startContainer, range.startOffset);
    const end = start + text.length;

    // Show context menu at mouse position
    showContextMenu(e.clientX, e.clientY, { text, start, end });
  });
}

/**
 * Create a text offset calculator for a container
 * Returns a function that calculates the offset of a node/offset pair
 * within the container's text content
 */
export function createTextOffsetCalculator(container: HTMLElement): (node: Node, offset: number) => number {
  return (node: Node, offset: number): number => {
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

  menuElement = null;
  currentSelection = null;
  onMarkCallback = null;
}
