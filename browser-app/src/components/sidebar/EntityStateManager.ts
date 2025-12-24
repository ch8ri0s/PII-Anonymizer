/**
 * Entity State Manager
 *
 * Manages entity state including selection, filtering, and exact match synchronization.
 * Extracted from EntitySidebar.ts for better modularity.
 *
 * Story 7.4: Entity Review UI Implementation
 */

import type { ExtendedPIIMatch } from '../../processing/PIIDetector';
import { getOriginalContent } from '../preview/PreviewBody';
import { normalizeType } from './EntityTypeConfig';

/**
 * Entity with selection state for UI
 */
export interface EntityWithSelection extends ExtendedPIIMatch {
  id: string;
  selected: boolean;
  visible: boolean;
  confidence?: number;
  entityIndex?: number; // 1-based index for display
}

/**
 * State change callback type
 */
export type StateChangeCallback = (entities: EntityWithSelection[]) => void;

/**
 * Entity State Manager Class
 *
 * Handles all entity state operations including:
 * - Adding/removing entities
 * - Selection state management
 * - Exact match synchronization
 * - Type filtering
 */
export class EntityStateManager {
  private entities: EntityWithSelection[] = [];
  private typeFilters: Map<string, boolean> = new Map();
  private onStateChange?: StateChangeCallback;

  constructor(onStateChange?: StateChangeCallback) {
    this.onStateChange = onStateChange;
  }

  /**
   * Set the state change callback
   */
  setOnStateChange(callback: StateChangeCallback): void {
    this.onStateChange = callback;
  }

  /**
   * Update entities from external source
   */
  updateEntities(newEntities: ExtendedPIIMatch[]): void {
    // Sort by position first to assign consistent numbering
    const sorted = [...newEntities].sort((a, b) => a.start - b.start);

    this.entities = sorted.map((entity, index) => ({
      ...entity,
      id: entity.id || `entity-${index}-${entity.start}`,
      selected: (entity as EntityWithSelection).selected ?? true,
      visible: true,
      source: entity.source || 'REGEX',
      entityIndex: index + 1, // 1-based index for display
    }));

    // Initialize type filters for new types
    const types = new Set(this.entities.map(e => normalizeType(e.type)));
    types.forEach(type => {
      if (!this.typeFilters.has(type)) {
        this.typeFilters.set(type, true);
      }
    });

    this.applyFilters();
    this.notifyStateChange();
  }

  /**
   * Get all entities
   */
  getAllEntities(): EntityWithSelection[] {
    return [...this.entities];
  }

  /**
   * Get selected entities (selected AND visible)
   */
  getSelectedEntities(): EntityWithSelection[] {
    return this.entities.filter(e => e.selected && e.visible);
  }

  /**
   * Clear all entities
   */
  clearEntities(): void {
    this.entities = [];
    this.notifyStateChange();
  }

  /**
   * Find all exact matches of a text string in the document content
   */
  private findAllExactMatches(text: string): Array<{ start: number; end: number }> {
    const content = getOriginalContent();
    if (!content || !text) return [];

    const matches: Array<{ start: number; end: number }> = [];
    let searchStart = 0;

    while (searchStart < content.length) {
      const index = content.indexOf(text, searchStart);
      if (index === -1) break;

      matches.push({
        start: index,
        end: index + text.length,
      });

      searchStart = index + 1;
    }

    return matches;
  }

  /**
   * Check if an entity already exists at the given position
   */
  private entityExistsAtPosition(start: number, end: number): boolean {
    return this.entities.some(e => e.start === start && e.end === end);
  }

  /**
   * Add a manually marked entity
   * Also finds and marks ALL exact matches of the same text in the document
   */
  addManualEntity(
    text: string,
    type: string,
    start: number,
    end: number,
  ): EntityWithSelection {
    // Find all exact matches of this text in the document
    const allMatches = this.findAllExactMatches(text);
    const timestamp = Date.now();
    const newEntities: EntityWithSelection[] = [];

    // Create entities for all matches that don't already exist
    for (let i = 0; i < allMatches.length; i++) {
      const match = allMatches[i];

      // Skip if an entity already exists at this position
      if (this.entityExistsAtPosition(match.start, match.end)) {
        continue;
      }

      const newEntity: EntityWithSelection = {
        text,
        type,
        start: match.start,
        end: match.end,
        source: 'MANUAL',
        id: `manual-${timestamp}-${match.start}`,
        selected: true,
        visible: true,
        confidence: 1.0, // Manual entities have 100% confidence
      };

      this.entities.push(newEntity);
      newEntities.push(newEntity);
    }

    // Re-sort by position and assign entityIndex for consistent numbering
    this.entities.sort((a, b) => a.start - b.start);
    this.entities.forEach((entity, index) => {
      entity.entityIndex = index + 1;
    });

    const normalizedType = normalizeType(type);
    if (!this.typeFilters.has(normalizedType)) {
      this.typeFilters.set(normalizedType, true);
    }

    this.notifyStateChange();

    // Return the entity at the original position, or the first new entity
    const originalEntity = newEntities.find(e => e.start === start && e.end === end);
    return originalEntity || newEntities[0] || this.entities.find(e => e.start === start && e.end === end)!;
  }

  /**
   * Sync selection state across all entities with identical text
   */
  private syncSelectionByText(text: string, selected: boolean): void {
    this.entities.forEach(entity => {
      if (entity.text === text && entity.visible) {
        entity.selected = selected;
      }
    });
  }

  /**
   * Handle selection change for a single entity
   * Syncs selection across all entities with identical text
   */
  handleSelectionChange(entityId: string, selected: boolean, shiftKey: boolean, lastClickedIndex: number): number {
    const currentIndex = this.entities.findIndex(e => e.id === entityId);
    const clickedEntity = this.entities.find(e => e.id === entityId);

    if (shiftKey && lastClickedIndex >= 0 && currentIndex >= 0) {
      // Shift-click: select range of entities
      const start = Math.min(lastClickedIndex, currentIndex);
      const end = Math.max(lastClickedIndex, currentIndex);
      for (let i = start; i <= end; i++) {
        if (this.entities[i].visible) {
          // Sync all entities with the same text
          this.syncSelectionByText(this.entities[i].text, selected);
        }
      }
    } else if (clickedEntity) {
      // Single click: sync all entities with the same text as the clicked entity
      this.syncSelectionByText(clickedEntity.text, selected);
    }

    this.notifyStateChange();
    return currentIndex;
  }

  /**
   * Set type filter
   */
  setTypeFilter(type: string, enabled: boolean): void {
    this.typeFilters.set(type, enabled);
    this.applyFilters();
    this.notifyStateChange();
  }

  /**
   * Get type filter state
   */
  isTypeEnabled(type: string): boolean {
    return this.typeFilters.get(type) ?? true;
  }

  /**
   * Get visible types
   */
  getVisibleTypes(): Set<string> {
    const visibleTypes = new Set<string>();
    this.typeFilters.forEach((visible, type) => {
      if (visible) visibleTypes.add(type);
    });
    return visibleTypes;
  }

  /**
   * Apply type filters to entities
   */
  private applyFilters(): void {
    this.entities.forEach(entity => {
      const type = normalizeType(entity.type);
      entity.visible = this.typeFilters.get(type) ?? true;
    });
  }

  /**
   * Save filter state to sessionStorage
   */
  saveFilterState(): void {
    try {
      sessionStorage.setItem('entitySidebar.filters', JSON.stringify(Object.fromEntries(this.typeFilters)));
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Load filter state from sessionStorage
   */
  loadFilterState(): void {
    try {
      const stored = sessionStorage.getItem('entitySidebar.filters');
      if (stored) {
        this.typeFilters = new Map(Object.entries(JSON.parse(stored)));
      }
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Group entities by normalized type
   */
  groupByType(): Map<string, EntityWithSelection[]> {
    const groups = new Map<string, EntityWithSelection[]>();

    this.entities.forEach(entity => {
      const type = normalizeType(entity.type);
      if (!groups.has(type)) {
        groups.set(type, []);
      }
      const group = groups.get(type);
      if (group) {
        group.push(entity);
      }
    });

    return groups;
  }

  /**
   * Get entity by ID
   */
  getEntityById(id: string): EntityWithSelection | undefined {
    return this.entities.find(e => e.id === id);
  }

  /**
   * Notify subscribers of state changes
   */
  private notifyStateChange(): void {
    this.onStateChange?.(this.getSelectedEntities());
  }
}
