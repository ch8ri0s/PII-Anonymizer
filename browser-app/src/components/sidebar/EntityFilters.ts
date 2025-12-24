/**
 * Entity Filters Module
 *
 * Manages filter state and localStorage persistence for entity sidebar.
 * Extracted from EntitySidebar.ts for better modularity.
 */

const FILTER_STORAGE_KEY = 'pii-entity-filters';

/**
 * Filter state management
 */
export class EntityFilterManager {
  private typeFilters: Map<string, boolean> = new Map();
  private collapsedGroups: Set<string> = new Set();

  /**
   * Get all type filters
   */
  getFilters(): Map<string, boolean> {
    return this.typeFilters;
  }

  /**
   * Check if a type is enabled
   */
  isTypeEnabled(type: string): boolean {
    return this.typeFilters.get(type) ?? true;
  }

  /**
   * Set filter for a type
   */
  setTypeFilter(type: string, enabled: boolean): void {
    this.typeFilters.set(type, enabled);
  }

  /**
   * Ensure type exists in filters
   */
  ensureType(type: string): void {
    if (!this.typeFilters.has(type)) {
      this.typeFilters.set(type, true);
    }
  }

  /**
   * Get enabled types
   */
  getEnabledTypes(): Set<string> {
    const enabled = new Set<string>();
    this.typeFilters.forEach((isEnabled, type) => {
      if (isEnabled) enabled.add(type);
    });
    return enabled;
  }

  /**
   * Check if group is collapsed
   */
  isGroupCollapsed(type: string): boolean {
    return this.collapsedGroups.has(type);
  }

  /**
   * Toggle group collapse state
   */
  toggleGroupCollapse(type: string): boolean {
    if (this.collapsedGroups.has(type)) {
      this.collapsedGroups.delete(type);
      return false;
    } else {
      this.collapsedGroups.add(type);
      return true;
    }
  }

  /**
   * Save filter state to localStorage
   */
  save(): void {
    try {
      const state = {
        filters: Object.fromEntries(this.typeFilters),
        collapsed: Array.from(this.collapsedGroups),
      };
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // localStorage not available
    }
  }

  /**
   * Load filter state from localStorage
   */
  load(): void {
    try {
      const stored = localStorage.getItem(FILTER_STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored);
        if (state.filters) {
          Object.entries(state.filters).forEach(([type, enabled]) => {
            this.typeFilters.set(type, enabled as boolean);
          });
        }
        if (state.collapsed) {
          this.collapsedGroups = new Set(state.collapsed);
        }
      }
    } catch {
      // localStorage not available or invalid data
    }
  }

  /**
   * Clear all state
   */
  clear(): void {
    this.typeFilters.clear();
    this.collapsedGroups.clear();
  }
}
