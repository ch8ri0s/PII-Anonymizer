/**
 * Keyboard Shortcuts Component
 *
 * Handles global keyboard shortcuts for the PII marking workflow.
 * Story 7.7: Manual PII Marking UI Polish - AC5
 */

import {
  getPendingSelection,
  showContextMenu,
  isContextMenuVisible,
  hideContextMenu,
} from './ContextMenu';
import { showInfo } from './Toast';

// Module state
let keyboardHandler: ((e: KeyboardEvent) => void) | null = null;
let initialized = false;

/**
 * Initialize keyboard shortcuts
 */
export function initKeyboardShortcuts(): void {
  if (initialized) return;

  keyboardHandler = handleGlobalKeyDown;
  document.addEventListener('keydown', keyboardHandler);
  initialized = true;
}

/**
 * Handle global keyboard events
 */
function handleGlobalKeyDown(e: KeyboardEvent): void {
  // Cmd/Ctrl+M to show entity type picker
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'm') {
    e.preventDefault();
    handleMarkShortcut();
  }
}

/**
 * Handle Cmd/Ctrl+M shortcut
 */
function handleMarkShortcut(): void {
  // If context menu is already visible, hide it
  if (isContextMenuVisible()) {
    hideContextMenu();
    return;
  }

  const pendingSelection = getPendingSelection();

  if (!pendingSelection) {
    showInfo('Select text first, then press ⌘M to mark as PII');
    return;
  }

  // Get selection position
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) {
    showInfo('Select text first, then press ⌘M to mark as PII');
    return;
  }

  // Position menu near the selection
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.bottom + 8;

  showContextMenu(x, y, pendingSelection);
}

/**
 * Destroy keyboard shortcuts and clean up
 */
export function destroyKeyboardShortcuts(): void {
  if (keyboardHandler) {
    document.removeEventListener('keydown', keyboardHandler);
    keyboardHandler = null;
  }
  initialized = false;
}

/**
 * Check if keyboard shortcuts are initialized
 */
export function isKeyboardShortcutsInitialized(): boolean {
  return initialized;
}
