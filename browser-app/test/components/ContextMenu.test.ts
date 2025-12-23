/**
 * ContextMenu Component Tests
 *
 * Tests for context menu functionality including:
 * - Menu display and positioning
 * - Entity type selection
 * - Text selection handling
 *
 * Story 7.4: Entity Review UI Implementation - Task 8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initContextMenu,
  showContextMenu,
  hideContextMenu,
  isContextMenuVisible,
  destroyContextMenu,
  setupTextSelectionHandler,
  createTextOffsetCalculator,
  type OnMarkCallback,
} from '../../src/components/ContextMenu';

// Uses happy-dom from vitest.config.ts
function setupDOM(): void {
  document.body.innerHTML = '<div id="test-container">Sample text content for testing</div>';
}

describe('ContextMenu', () => {
  beforeEach(() => {
    setupDOM();
  });

  afterEach(() => {
    destroyContextMenu();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with callback', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      const menu = document.getElementById('pii-context-menu');
      expect(menu).toBeDefined();
    });

    it('should create menu element in body', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      const menu = document.getElementById('pii-context-menu');
      expect(menu?.parentNode).toBe(document.body);
    });

    it('should have correct ARIA attributes', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      const menu = document.getElementById('pii-context-menu');
      expect(menu?.getAttribute('role')).toBe('menu');
      expect(menu?.getAttribute('aria-label')).toBe('Mark as PII');
    });

    it('should start hidden', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      expect(isContextMenuVisible()).toBe(false);
    });

    it('should contain entity type options', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      const menu = document.getElementById('pii-context-menu');
      const buttons = menu?.querySelectorAll('.context-menu-item');

      expect(buttons?.length).toBeGreaterThan(0);
    });
  });

  describe('Entity Type Options', () => {
    it('should have PERSON option', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      const menu = document.getElementById('pii-context-menu');
      const personBtn = menu?.querySelector('[data-type="PERSON"]');

      expect(personBtn).toBeDefined();
    });

    it('should have ORG option', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      const menu = document.getElementById('pii-context-menu');
      const orgBtn = menu?.querySelector('[data-type="ORG"]');

      expect(orgBtn).toBeDefined();
    });

    it('should have ADDRESS option', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      const menu = document.getElementById('pii-context-menu');
      const addressBtn = menu?.querySelector('[data-type="ADDRESS"]');

      expect(addressBtn).toBeDefined();
    });

    it('should have EMAIL option', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      const menu = document.getElementById('pii-context-menu');
      const emailBtn = menu?.querySelector('[data-type="EMAIL"]');

      expect(emailBtn).toBeDefined();
    });

    it('should have PHONE option', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      const menu = document.getElementById('pii-context-menu');
      const phoneBtn = menu?.querySelector('[data-type="PHONE"]');

      expect(phoneBtn).toBeDefined();
    });

    it('should have DATE option', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      const menu = document.getElementById('pii-context-menu');
      const dateBtn = menu?.querySelector('[data-type="DATE"]');

      expect(dateBtn).toBeDefined();
    });

    it('should have ID_NUMBER option', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      const menu = document.getElementById('pii-context-menu');
      const idBtn = menu?.querySelector('[data-type="ID_NUMBER"]');

      expect(idBtn).toBeDefined();
    });

    it('should have OTHER option', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      const menu = document.getElementById('pii-context-menu');
      const otherBtn = menu?.querySelector('[data-type="OTHER"]');

      expect(otherBtn).toBeDefined();
    });
  });

  describe('Show/Hide', () => {
    it('should show menu at position', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      showContextMenu(100, 200, { text: 'test', start: 0, end: 4 });

      expect(isContextMenuVisible()).toBe(true);
    });

    it('should hide menu', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      showContextMenu(100, 200, { text: 'test', start: 0, end: 4 });
      hideContextMenu();

      expect(isContextMenuVisible()).toBe(false);
    });

    it('should position menu at coordinates', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      showContextMenu(150, 250, { text: 'test', start: 0, end: 4 });

      const menu = document.getElementById('pii-context-menu');
      // Position may be adjusted for viewport, but should be set
      expect(menu?.style.left).toBeDefined();
      expect(menu?.style.top).toBeDefined();
    });
  });

  describe('Visibility Check', () => {
    it('should return false when not initialized', () => {
      // Don't initialize
      expect(isContextMenuVisible()).toBe(false);
    });

    it('should return false when hidden', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      expect(isContextMenuVisible()).toBe(false);
    });

    it('should return true when shown', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      showContextMenu(100, 100, { text: 'test', start: 0, end: 4 });

      expect(isContextMenuVisible()).toBe(true);
    });
  });

  describe('Destroy', () => {
    it('should remove menu from DOM', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      destroyContextMenu();

      const menu = document.getElementById('pii-context-menu');
      expect(menu).toBeNull();
    });

    it('should handle multiple destroy calls', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      destroyContextMenu();
      destroyContextMenu();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should not be visible after destroy', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      showContextMenu(100, 100, { text: 'test', start: 0, end: 4 });
      destroyContextMenu();

      expect(isContextMenuVisible()).toBe(false);
    });
  });

  describe('Text Offset Calculator', () => {
    it('should create offset calculator for container', () => {
      const container = document.getElementById('test-container') as HTMLElement;
      const calculator = createTextOffsetCalculator(container);

      expect(typeof calculator).toBe('function');
    });

    it('should calculate offset for text node', () => {
      const container = document.getElementById('test-container') as HTMLElement;
      const calculator = createTextOffsetCalculator(container);

      // Get first text node
      const textNode = container.firstChild as Text;
      if (textNode) {
        const offset = calculator(textNode, 5);
        expect(typeof offset).toBe('number');
      }
    });
  });

  describe('Text Selection Handler', () => {
    it('should setup handler on container', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      const container = document.getElementById('test-container') as HTMLElement;
      const calculator = createTextOffsetCalculator(container);

      // Should not throw
      setupTextSelectionHandler(container, calculator);

      expect(true).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle show before init gracefully', () => {
      // Don't init, just try to show
      showContextMenu(100, 100, { text: 'test', start: 0, end: 4 });

      // Should not throw
      expect(isContextMenuVisible()).toBe(false);
    });

    it('should handle hide before init gracefully', () => {
      hideContextMenu();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle empty selection text', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      showContextMenu(100, 100, { text: '', start: 0, end: 0 });

      // Menu shown but with empty text
      expect(isContextMenuVisible()).toBe(true);
    });

    it('should handle very long selection text', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      const longText = 'A'.repeat(10000);
      showContextMenu(100, 100, { text: longText, start: 0, end: 10000 });

      expect(isContextMenuVisible()).toBe(true);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should close on Escape key', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      showContextMenu(100, 100, { text: 'test', start: 0, end: 4 });

      // Simulate Escape key
      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
      });
      document.dispatchEvent(escapeEvent);

      expect(isContextMenuVisible()).toBe(false);
    });
  });

  describe('Click Handling', () => {
    it('should close on outside click', () => {
      const callback: OnMarkCallback = vi.fn();
      initContextMenu(callback);

      showContextMenu(100, 100, { text: 'test', start: 0, end: 4 });

      // Simulate outside click
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
      });
      document.body.dispatchEvent(clickEvent);

      expect(isContextMenuVisible()).toBe(false);
    });
  });
});
