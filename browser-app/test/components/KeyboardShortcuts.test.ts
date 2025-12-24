/**
 * Keyboard Shortcuts Tests
 *
 * Tests for the keyboard shortcuts module.
 * Story 7.7: Manual PII Marking UI Polish - AC5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initKeyboardShortcuts,
  destroyKeyboardShortcuts,
  isKeyboardShortcutsInitialized,
} from '../../src/components/KeyboardShortcuts';
import {
  initContextMenu,
  destroyContextMenu,
  isContextMenuVisible,
} from '../../src/components/ContextMenu';
import { destroyToasts } from '../../src/components/Toast';

describe('KeyboardShortcuts', () => {
  beforeEach(() => {
    destroyKeyboardShortcuts();
    destroyContextMenu();
    destroyToasts();
  });

  afterEach(() => {
    destroyKeyboardShortcuts();
    destroyContextMenu();
    destroyToasts();
  });

  describe('initKeyboardShortcuts', () => {
    it('should initialize keyboard shortcuts', () => {
      expect(isKeyboardShortcutsInitialized()).toBe(false);

      initKeyboardShortcuts();

      expect(isKeyboardShortcutsInitialized()).toBe(true);
    });

    it('should not double-initialize', () => {
      initKeyboardShortcuts();
      initKeyboardShortcuts();

      expect(isKeyboardShortcutsInitialized()).toBe(true);
    });
  });

  describe('destroyKeyboardShortcuts', () => {
    it('should clean up keyboard shortcuts', () => {
      initKeyboardShortcuts();
      expect(isKeyboardShortcutsInitialized()).toBe(true);

      destroyKeyboardShortcuts();

      expect(isKeyboardShortcutsInitialized()).toBe(false);
    });
  });

  describe('Cmd/Ctrl+M shortcut', () => {
    it('should show info toast when no selection', () => {
      initKeyboardShortcuts();
      initContextMenu(() => {});

      // Simulate Cmd+M with no selection
      const event = new KeyboardEvent('keydown', {
        key: 'm',
        metaKey: true,
        bubbles: true,
      });

      document.dispatchEvent(event);

      // Toast should be shown (check container exists)
      const toastContainer = document.getElementById('toast-container');
      expect(toastContainer).not.toBeNull();
    });

    it('should respond to Ctrl+M on non-Mac', () => {
      initKeyboardShortcuts();
      initContextMenu(() => {});

      const event = new KeyboardEvent('keydown', {
        key: 'm',
        ctrlKey: true,
        bubbles: true,
      });

      document.dispatchEvent(event);

      // Toast should be shown for no selection
      const toastContainer = document.getElementById('toast-container');
      expect(toastContainer).not.toBeNull();
    });

    it('should not respond to M without modifier', () => {
      initKeyboardShortcuts();
      initContextMenu(() => {});

      const event = new KeyboardEvent('keydown', {
        key: 'm',
        bubbles: true,
      });

      document.dispatchEvent(event);

      // No toast should be shown
      const toastContainer = document.getElementById('toast-container');
      expect(toastContainer).toBeNull();
    });

    it('should hide context menu if already visible', () => {
      initKeyboardShortcuts();
      initContextMenu(() => {});

      // Mock a visible context menu scenario
      const menuElement = document.getElementById('pii-context-menu');
      if (menuElement) {
        menuElement.classList.remove('hidden');
      }

      // Verify menu is visible
      expect(isContextMenuVisible()).toBe(true);

      // Press Cmd+M
      const event = new KeyboardEvent('keydown', {
        key: 'm',
        metaKey: true,
        bubbles: true,
      });

      document.dispatchEvent(event);

      // Menu should be hidden
      expect(isContextMenuVisible()).toBe(false);
    });
  });

  describe('keyboard event prevention', () => {
    it('should prevent default on Cmd/Ctrl+M', () => {
      initKeyboardShortcuts();
      initContextMenu(() => {});

      const event = new KeyboardEvent('keydown', {
        key: 'm',
        metaKey: true,
        bubbles: true,
        cancelable: true,
      });

      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      document.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });
});
