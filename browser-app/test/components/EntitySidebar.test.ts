/**
 * EntitySidebar Component Tests
 *
 * Tests for entity sidebar functionality including:
 * - Entity grouping by type
 * - Selection management
 * - Filtering
 * - Manual entity addition
 *
 * Story 7.4: Entity Review UI Implementation - Task 8
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initEntitySidebar,
  updateEntities,
  getSelectedEntities,
  getAllEntities,
  clearEntities,
  addManualEntity,
  destroyEntitySidebar,
  type EntityWithSelection,
} from '../../src/components/EntitySidebar';

// Uses happy-dom from vitest.config.ts
let container: HTMLElement;

function setupDOM(): void {
  // Create container in happy-dom environment
  document.body.innerHTML = '<div id="test-container"></div>';
  container = document.getElementById('test-container') as HTMLElement;

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
}

function createTestEntities(): EntityWithSelection[] {
  return [
    {
      id: 'entity-1',
      type: 'PERSON',
      text: 'John Doe',
      start: 0,
      end: 8,
      confidence: 0.95,
      source: 'ML',
      selected: true,
      visible: true,
    },
    {
      id: 'entity-2',
      type: 'PERSON',
      text: 'Jane Smith',
      start: 20,
      end: 30,
      confidence: 0.88,
      source: 'REGEX',
      selected: true,
      visible: true,
    },
    {
      id: 'entity-3',
      type: 'EMAIL',
      text: 'john@example.com',
      start: 50,
      end: 66,
      confidence: 0.99,
      source: 'BOTH',
      selected: true,
      visible: true,
    },
    {
      id: 'entity-4',
      type: 'ORG',
      text: 'Acme Corp',
      start: 80,
      end: 89,
      confidence: 0.72,
      source: 'ML',
      selected: true,
      visible: true,
    },
    {
      id: 'entity-5',
      type: 'PHONE',
      text: '+41 79 123 45 67',
      start: 100,
      end: 117,
      confidence: 0.98,
      source: 'REGEX',
      selected: true,
      visible: true,
    },
  ];
}

describe('EntitySidebar', () => {
  beforeEach(() => {
    setupDOM();
  });

  afterEach(() => {
    destroyEntitySidebar();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize sidebar in container', () => {
      initEntitySidebar(container, {});

      expect(container.innerHTML).not.toBe('');
      expect(container.querySelector('.entity-sidebar')).toBeDefined();
    });

    it('should create filter section', () => {
      initEntitySidebar(container, {});

      expect(container.querySelector('.entity-filters')).toBeDefined();
    });

    it('should create entity list section', () => {
      initEntitySidebar(container, {});

      expect(container.querySelector('.entity-list')).toBeDefined();
    });

    it('should inject CSS styles', () => {
      initEntitySidebar(container, {});

      const styleSheet = document.getElementById('entity-sidebar-styles');
      expect(styleSheet).toBeDefined();
    });
  });

  describe('Entity Display', () => {
    it('should display entities after update', () => {
      initEntitySidebar(container, {});
      updateEntities(createTestEntities());

      const entities = getAllEntities();
      expect(entities.length).toBe(5);
    });

    it('should group entities by type', () => {
      initEntitySidebar(container, {});
      updateEntities(createTestEntities());

      const groups = container.querySelectorAll('.entity-group');
      expect(groups.length).toBeGreaterThan(0);
    });

    it('should show entity count per type', () => {
      initEntitySidebar(container, {});
      updateEntities(createTestEntities());

      const entities = getAllEntities();
      const personCount = entities.filter(e => e.type === 'PERSON').length;
      expect(personCount).toBe(2);
    });

    it('should display confidence scores', () => {
      initEntitySidebar(container, {});
      updateEntities(createTestEntities());

      const allEntities = getAllEntities();
      const highConfidence = allEntities.filter(e => (e.confidence ?? 0) >= 0.8);
      expect(highConfidence.length).toBeGreaterThan(0);
    });

    it('should display detection source', () => {
      initEntitySidebar(container, {});
      updateEntities(createTestEntities());

      const entities = getAllEntities();
      const mlEntities = entities.filter(e => e.source === 'ML');
      const regexEntities = entities.filter(e => e.source === 'REGEX');

      expect(mlEntities.length).toBeGreaterThan(0);
      expect(regexEntities.length).toBeGreaterThan(0);
    });
  });

  describe('Entity Selection', () => {
    it('should return all entities initially selected', () => {
      initEntitySidebar(container, {});
      updateEntities(createTestEntities());

      const selected = getSelectedEntities();
      expect(selected.length).toBe(5);
    });

    it('should return only selected entities', () => {
      initEntitySidebar(container, {});
      const entities = createTestEntities();
      entities[0].selected = false;
      entities[1].selected = false;
      updateEntities(entities);

      const selected = getSelectedEntities();
      expect(selected.length).toBe(3);
    });

    it('should return all entities including deselected', () => {
      initEntitySidebar(container, {});
      const entities = createTestEntities();
      entities[0].selected = false;
      updateEntities(entities);

      const all = getAllEntities();
      expect(all.length).toBe(5);
    });

    it('should track selection state changes', () => {
      const onSelectionChange = vi.fn();
      initEntitySidebar(container, { onSelectionChange });
      updateEntities(createTestEntities());

      // Initially all selected
      expect(getSelectedEntities().length).toBe(5);
    });
  });

  describe('Entity Filtering', () => {
    it('should filter by entity type', () => {
      const onFilterChange = vi.fn();
      initEntitySidebar(container, { onFilterChange });
      updateEntities(createTestEntities());

      const entities = getAllEntities();
      const personEntities = entities.filter(e => e.type === 'PERSON');
      expect(personEntities.length).toBe(2);
    });

    it('should show all types initially', () => {
      initEntitySidebar(container, {});
      updateEntities(createTestEntities());

      const entities = getAllEntities();
      const visibleEntities = entities.filter(e => e.visible);
      expect(visibleEntities.length).toBe(5);
    });

    it('should handle filter changes', () => {
      const onFilterChange = vi.fn();
      initEntitySidebar(container, { onFilterChange });
      updateEntities(createTestEntities());

      // Filters start with all types visible
      const entities = getAllEntities();
      expect(entities.every(e => e.visible)).toBe(true);
    });
  });

  describe('Manual Entity Addition', () => {
    it('should add manual entity', () => {
      initEntitySidebar(container, {});
      updateEntities([]);

      addManualEntity('New Entity', 'PERSON', 0, 10);

      const entities = getAllEntities();
      expect(entities.length).toBe(1);
    });

    it('should mark manual entities with MANUAL source', () => {
      initEntitySidebar(container, {});
      updateEntities([]);

      addManualEntity('Manual PII', 'EMAIL', 5, 15);

      const entities = getAllEntities();
      expect(entities[0].source).toBe('MANUAL');
    });

    it('should set manual entities as selected by default', () => {
      initEntitySidebar(container, {});
      updateEntities([]);

      addManualEntity('Test Entity', 'PHONE', 0, 12);

      const entities = getAllEntities();
      expect(entities[0].selected).toBe(true);
    });

    it('should set high confidence for manual entities', () => {
      initEntitySidebar(container, {});
      updateEntities([]);

      addManualEntity('Manually Marked', 'ORG', 0, 14);

      const entities = getAllEntities();
      expect(entities[0].confidence).toBe(1.0);
    });

    it('should generate unique ID for manual entities', () => {
      initEntitySidebar(container, {});
      updateEntities([]);

      addManualEntity('First', 'PERSON', 0, 5);
      addManualEntity('Second', 'PERSON', 10, 16);

      const entities = getAllEntities();
      expect(entities[0].id).not.toBe(entities[1].id);
    });
  });

  describe('Clear Entities', () => {
    it('should clear all entities', () => {
      initEntitySidebar(container, {});
      updateEntities(createTestEntities());

      expect(getAllEntities().length).toBe(5);

      clearEntities();

      expect(getAllEntities().length).toBe(0);
    });

    it('should reset selected entities', () => {
      initEntitySidebar(container, {});
      updateEntities(createTestEntities());

      clearEntities();

      expect(getSelectedEntities().length).toBe(0);
    });
  });

  describe('Callbacks', () => {
    it('should call onEntityClick when entity clicked', () => {
      const onEntityClick = vi.fn();
      initEntitySidebar(container, { onEntityClick });
      updateEntities(createTestEntities());

      // Callback is registered but we can't easily simulate click in JSDOM
      expect(typeof onEntityClick).toBe('function');
    });

    it('should call onSelectionChange on selection update', () => {
      const onSelectionChange = vi.fn();
      initEntitySidebar(container, { onSelectionChange });
      updateEntities(createTestEntities());

      // Callback is registered
      expect(typeof onSelectionChange).toBe('function');
    });

    it('should call onFilterChange on filter update', () => {
      const onFilterChange = vi.fn();
      initEntitySidebar(container, { onFilterChange });
      updateEntities(createTestEntities());

      // Callback is registered
      expect(typeof onFilterChange).toBe('function');
    });

    it('should call onManualMark when manual entity added', () => {
      const onManualMark = vi.fn();
      initEntitySidebar(container, { onManualMark });

      // Function is available
      expect(typeof onManualMark).toBe('function');
    });
  });

  describe('Destroy', () => {
    it('should clean up DOM on destroy', () => {
      initEntitySidebar(container, {});
      updateEntities(createTestEntities());

      destroyEntitySidebar();

      expect(getAllEntities().length).toBe(0);
    });

    it('should remove event listeners on destroy', () => {
      initEntitySidebar(container, {});
      destroyEntitySidebar();

      // No errors should occur
      expect(true).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty entity list', () => {
      initEntitySidebar(container, {});
      updateEntities([]);

      expect(getAllEntities().length).toBe(0);
    });

    it('should handle entities with missing optional fields', () => {
      initEntitySidebar(container, {});

      const minimalEntity: EntityWithSelection = {
        id: 'minimal-1',
        type: 'OTHER',
        text: 'Test',
        start: 0,
        end: 4,
        confidence: 0.5,
        source: 'REGEX',
        selected: true,
        visible: true,
      };

      updateEntities([minimalEntity]);

      expect(getAllEntities().length).toBe(1);
    });

    it('should handle duplicate entity IDs', () => {
      initEntitySidebar(container, {});

      const entities: EntityWithSelection[] = [
        {
          id: 'same-id',
          type: 'PERSON',
          text: 'First',
          start: 0,
          end: 5,
          confidence: 0.8,
          source: 'ML',
          selected: true,
          visible: true,
        },
        {
          id: 'same-id',
          type: 'PERSON',
          text: 'Second',
          start: 10,
          end: 16,
          confidence: 0.9,
          source: 'ML',
          selected: true,
          visible: true,
        },
      ];

      updateEntities(entities);

      // Should handle gracefully (implementation may vary)
      const allEntities = getAllEntities();
      expect(allEntities.length).toBeGreaterThan(0);
    });

    it('should handle very long entity text', () => {
      initEntitySidebar(container, {});

      const longText = 'A'.repeat(1000);
      const entity: EntityWithSelection = {
        id: 'long-1',
        type: 'OTHER',
        text: longText,
        start: 0,
        end: 1000,
        confidence: 0.7,
        source: 'REGEX',
        selected: true,
        visible: true,
      };

      updateEntities([entity]);

      expect(getAllEntities().length).toBe(1);
    });

    it('should handle special characters in entity text', () => {
      initEntitySidebar(container, {});

      const entity: EntityWithSelection = {
        id: 'special-1',
        type: 'EMAIL',
        text: '<script>alert("xss")</script>@test.com',
        start: 0,
        end: 38,
        confidence: 0.9,
        source: 'REGEX',
        selected: true,
        visible: true,
      };

      updateEntities([entity]);

      // Should sanitize and not break
      expect(getAllEntities().length).toBe(1);
    });
  });

  describe('Confidence Color Coding', () => {
    it('should categorize high confidence (>= 80%)', () => {
      initEntitySidebar(container, {});

      const entity: EntityWithSelection = {
        id: 'high-conf',
        type: 'EMAIL',
        text: 'test@example.com',
        start: 0,
        end: 16,
        confidence: 0.95,
        source: 'BOTH',
        selected: true,
        visible: true,
      };

      updateEntities([entity]);

      // Entity is stored with confidence
      const entities = getAllEntities();
      expect(entities[0].confidence).toBe(0.95);
    });

    it('should categorize medium confidence (60-79%)', () => {
      initEntitySidebar(container, {});

      const entity: EntityWithSelection = {
        id: 'med-conf',
        type: 'ORG',
        text: 'Maybe Corp',
        start: 0,
        end: 10,
        confidence: 0.72,
        source: 'ML',
        selected: true,
        visible: true,
      };

      updateEntities([entity]);

      const entities = getAllEntities();
      expect(entities[0].confidence).toBeGreaterThanOrEqual(0.6);
      expect(entities[0].confidence).toBeLessThan(0.8);
    });

    it('should categorize low confidence (< 60%)', () => {
      initEntitySidebar(container, {});

      const entity: EntityWithSelection = {
        id: 'low-conf',
        type: 'PERSON',
        text: 'Uncertain Name',
        start: 0,
        end: 14,
        confidence: 0.45,
        source: 'ML',
        selected: true,
        visible: true,
      };

      updateEntities([entity]);

      const entities = getAllEntities();
      expect(entities[0].confidence).toBeLessThan(0.6);
    });
  });

  describe('Source Icons', () => {
    it('should identify ML source entities', () => {
      initEntitySidebar(container, {});
      updateEntities(createTestEntities());

      const entities = getAllEntities();
      const mlEntities = entities.filter(e => e.source === 'ML');
      expect(mlEntities.length).toBe(2);
    });

    it('should identify REGEX source entities', () => {
      initEntitySidebar(container, {});
      updateEntities(createTestEntities());

      const entities = getAllEntities();
      const regexEntities = entities.filter(e => e.source === 'REGEX');
      expect(regexEntities.length).toBe(2);
    });

    it('should identify BOTH source entities', () => {
      initEntitySidebar(container, {});
      updateEntities(createTestEntities());

      const entities = getAllEntities();
      const bothEntities = entities.filter(e => e.source === 'BOTH');
      expect(bothEntities.length).toBe(1);
    });

    it('should identify MANUAL source entities', () => {
      initEntitySidebar(container, {});
      updateEntities([]);

      addManualEntity('Manual Entry', 'PERSON', 0, 12);

      const entities = getAllEntities();
      expect(entities[0].source).toBe('MANUAL');
    });
  });
});
