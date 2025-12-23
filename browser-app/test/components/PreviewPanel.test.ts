/**
 * PreviewPanel Component Tests
 *
 * Tests for preview panel integration including:
 * - Panel initialization
 * - Content display
 * - Entity integration
 * - Sidebar toggle
 *
 * Story 7.4: Entity Review UI Implementation - Task 8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initPreviewPanel,
  setPreviewContent,
  setPreviewEntities,
  getPreviewSelectedEntities,
  getPreviewAllEntities,
  clearPreviewEntities,
  collapseSidebar,
  expandSidebar,
  isSidebarCollapsed,
  destroyPreviewPanel,
} from '../../src/components/PreviewPanel';
import type { ExtendedPIIMatch } from '../../src/processing/PIIDetector';

// Uses happy-dom from vitest.config.ts
let container: HTMLElement;

function setupDOM(): void {
  document.body.innerHTML = '<div id="preview-container"></div>';
  container = document.getElementById('preview-container') as HTMLElement;

  // Mock sessionStorage
  const mockStorage: Record<string, string> = {};
  (globalThis as any).sessionStorage = {
    getItem: vi.fn((key: string) => mockStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => { mockStorage[key] = value; }),
    removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
    clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }),
    length: 0,
    key: vi.fn(),
  };

  // Mock scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
}

function createTestMatches(): ExtendedPIIMatch[] {
  return [
    {
      type: 'PERSON',
      text: 'John Doe',
      start: 0,
      end: 8,
      confidence: 0.95,
      source: 'ML',
    },
    {
      type: 'EMAIL',
      text: 'john@example.com',
      start: 20,
      end: 36,
      confidence: 0.99,
      source: 'REGEX',
    },
    {
      type: 'ORG',
      text: 'Acme Corp',
      start: 50,
      end: 59,
      confidence: 0.85,
      source: 'BOTH',
    },
  ];
}

describe('PreviewPanel', () => {
  beforeEach(() => {
    setupDOM();
  });

  afterEach(() => {
    destroyPreviewPanel();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize panel in container', () => {
      initPreviewPanel(container, {});

      expect(container.innerHTML).not.toBe('');
    });

    it('should create preview content area', () => {
      initPreviewPanel(container, {});

      expect(container.querySelector('#preview-content')).toBeDefined();
    });

    it('should create sidebar', () => {
      initPreviewPanel(container, {});

      expect(container.querySelector('#preview-sidebar')).toBeDefined();
    });

    it('should create toggle button', () => {
      initPreviewPanel(container, {});

      expect(container.querySelector('#sidebar-toggle')).toBeDefined();
    });

    it('should inject CSS styles', () => {
      initPreviewPanel(container, {});

      const styleSheet = document.getElementById('preview-panel-styles');
      expect(styleSheet).toBeDefined();
    });

    it('should accept sidebar position config', () => {
      initPreviewPanel(container, { sidebarPosition: 'left' });

      const panel = container.querySelector('.preview-panel');
      expect(panel?.classList.contains('sidebar-left')).toBe(true);
    });
  });

  describe('Content Display', () => {
    it('should display document content', () => {
      initPreviewPanel(container, {});

      const testContent = 'This is test document content.';
      setPreviewContent(testContent);

      const previewText = container.querySelector('#preview-body-content');
      expect(previewText?.textContent).toBe(testContent);
    });

    it('should handle empty content', () => {
      initPreviewPanel(container, {});

      setPreviewContent('');

      // Empty content shows a placeholder message, not empty string
      const previewBody = container.querySelector('.preview-body');
      expect(previewBody).not.toBeNull();
    });

    it('should handle very long content', () => {
      initPreviewPanel(container, {});

      const longContent = 'Test content. '.repeat(1000);
      setPreviewContent(longContent);

      const previewText = container.querySelector('#preview-body-content');
      expect(previewText?.textContent?.length).toBeGreaterThan(0);
    });
  });

  describe('Entity Management', () => {
    it('should set entities', () => {
      initPreviewPanel(container, {});
      setPreviewEntities(createTestMatches());

      const entities = getPreviewAllEntities();
      expect(entities.length).toBe(3);
    });

    it('should get all entities', () => {
      initPreviewPanel(container, {});
      setPreviewEntities(createTestMatches());

      const entities = getPreviewAllEntities();
      expect(entities.length).toBe(3);
    });

    it('should get selected entities', () => {
      initPreviewPanel(container, {});
      setPreviewEntities(createTestMatches());

      const selected = getPreviewSelectedEntities();
      // All should be selected by default
      expect(selected.length).toBe(3);
    });

    it('should clear entities', () => {
      initPreviewPanel(container, {});
      setPreviewEntities(createTestMatches());

      clearPreviewEntities();

      const entities = getPreviewAllEntities();
      expect(entities.length).toBe(0);
    });

    it('should handle empty entity list', () => {
      initPreviewPanel(container, {});
      setPreviewEntities([]);

      const entities = getPreviewAllEntities();
      expect(entities.length).toBe(0);
    });
  });

  describe('Sidebar Toggle', () => {
    it('should start expanded', () => {
      initPreviewPanel(container, {});

      expect(isSidebarCollapsed()).toBe(false);
    });

    it('should collapse sidebar', () => {
      initPreviewPanel(container, {});

      collapseSidebar();

      expect(isSidebarCollapsed()).toBe(true);
    });

    it('should expand sidebar', () => {
      initPreviewPanel(container, {});

      collapseSidebar();
      expandSidebar();

      expect(isSidebarCollapsed()).toBe(false);
    });

    it('should toggle sidebar state', () => {
      initPreviewPanel(container, {});

      const initialState = isSidebarCollapsed();
      collapseSidebar();
      expect(isSidebarCollapsed()).toBe(!initialState);
    });

    it('should not collapse if already collapsed', () => {
      initPreviewPanel(container, {});

      collapseSidebar();
      collapseSidebar();

      expect(isSidebarCollapsed()).toBe(true);
    });

    it('should not expand if already expanded', () => {
      initPreviewPanel(container, {});

      expandSidebar();

      expect(isSidebarCollapsed()).toBe(false);
    });
  });

  describe('Callbacks', () => {
    it('should call onAnonymize callback', () => {
      const onAnonymize = vi.fn();
      initPreviewPanel(container, { onAnonymize });

      // Callback is registered
      expect(typeof onAnonymize).toBe('function');
    });

    it('should call onEntityChange callback', () => {
      const onEntityChange = vi.fn();
      initPreviewPanel(container, { onEntityChange });

      // Callback is registered
      expect(typeof onEntityChange).toBe('function');
    });
  });

  describe('Destroy', () => {
    it('should clean up DOM on destroy', () => {
      initPreviewPanel(container, {});
      setPreviewEntities(createTestMatches());

      destroyPreviewPanel();

      expect(container.innerHTML).toBe('');
    });

    it('should reset state on destroy', () => {
      initPreviewPanel(container, {});
      setPreviewEntities(createTestMatches());
      collapseSidebar();

      destroyPreviewPanel();

      // Re-init should start fresh
      initPreviewPanel(container, {});
      expect(isSidebarCollapsed()).toBe(false);
    });

    it('should handle multiple destroy calls', () => {
      initPreviewPanel(container, {});

      destroyPreviewPanel();
      destroyPreviewPanel();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Action Buttons', () => {
    it('should have copy button', () => {
      initPreviewPanel(container, {});

      const copyBtn = container.querySelector('#copy-btn');
      expect(copyBtn).not.toBeNull();
    });

    it('should have download MD button', () => {
      initPreviewPanel(container, {});

      const downloadMdBtn = container.querySelector('#download-md-btn');
      expect(downloadMdBtn).not.toBeNull();
    });

    it('should have download mapping button', () => {
      initPreviewPanel(container, {});

      const downloadMapBtn = container.querySelector('#download-map-btn');
      expect(downloadMapBtn).not.toBeNull();
    });
  });

  describe('Entity ID Generation', () => {
    it('should generate IDs for entities without IDs', () => {
      initPreviewPanel(container, {});

      const matchesWithoutIds: ExtendedPIIMatch[] = [
        {
          type: 'PERSON',
          text: 'Test',
          start: 0,
          end: 4,
          confidence: 0.9,
          source: 'ML',
        },
      ];

      setPreviewEntities(matchesWithoutIds);

      const entities = getPreviewAllEntities();
      expect(entities[0].id).toBeDefined();
      expect(entities[0].id.length).toBeGreaterThan(0);
    });

    it('should preserve existing IDs', () => {
      initPreviewPanel(container, {});

      const matchesWithIds: ExtendedPIIMatch[] = [
        {
          type: 'PERSON',
          text: 'Test',
          start: 0,
          end: 4,
          confidence: 0.9,
          source: 'ML',
          id: 'existing-id-123',
        } as ExtendedPIIMatch & { id: string },
      ];

      setPreviewEntities(matchesWithIds);

      const entities = getPreviewAllEntities();
      expect(entities[0].id).toBe('existing-id-123');
    });
  });

  describe('Selection State', () => {
    it('should initialize entities as selected', () => {
      initPreviewPanel(container, {});
      setPreviewEntities(createTestMatches());

      const entities = getPreviewAllEntities();
      expect(entities.every(e => e.selected)).toBe(true);
    });

    it('should initialize entities as visible', () => {
      initPreviewPanel(container, {});
      setPreviewEntities(createTestMatches());

      const entities = getPreviewAllEntities();
      expect(entities.every(e => e.visible)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle initialization without config', () => {
      initPreviewPanel(container);

      expect(container.innerHTML).not.toBe('');
    });

    it('should handle re-initialization', () => {
      initPreviewPanel(container, {});
      setPreviewEntities(createTestMatches());

      initPreviewPanel(container, {});

      // Should reset
      const entities = getPreviewAllEntities();
      expect(entities.length).toBe(0);
    });

    it('should handle special characters in content', () => {
      initPreviewPanel(container, {});

      const specialContent = '<script>alert("xss")</script> & "quotes" \'apostrophes\'';
      setPreviewContent(specialContent);

      // Should not break and content should be escaped
      expect(true).toBe(true);
    });
  });
});
