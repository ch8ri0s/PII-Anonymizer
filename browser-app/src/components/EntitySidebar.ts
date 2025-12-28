/**
 * Entity Sidebar Component
 *
 * Displays detected PII entities with:
 * - Entity grouping by type with smooth expand/collapse
 * - Confidence scores with color indicators
 * - Detection source badges
 * - Per-entity selection for anonymization
 * - Click-to-scroll navigation
 * - Exact match synchronization (selecting one entity selects all identical text)
 *
 * Story 7.4: Entity Review UI Implementation
 * Updated with shadcn-inspired design
 */

import type { ExtendedPIIMatch } from '../processing/PIIDetector';
import {
  EntityStateManager,
  type EntityWithSelection,
  getTypeConfig,
  getConfidenceLevel,
  formatConfidence,
  escapeHtml,
  injectSidebarStyles,
  SOURCE_CONFIG,
} from './sidebar';

// Re-export for external use
export type { EntityWithSelection } from './sidebar';

/**
 * Callbacks for entity sidebar events
 */
export interface EntitySidebarCallbacks {
  onEntityClick?: (entity: EntityWithSelection) => void;
  onSelectionChange?: (entities: EntityWithSelection[]) => void;
  onFilterChange?: (visibleTypes: Set<string>) => void;
  onManualMark?: (text: string, type: string, start: number, end: number) => void;
  onCollapse?: () => void;
}

// Module state
let sidebarElement: HTMLElement | null = null;
let callbacks: EntitySidebarCallbacks = {};
const collapsedGroups: Set<string> = new Set();
let lastClickedIndex: number = -1;
let stateManager: EntityStateManager | null = null;

/**
 * Initialize the entity sidebar
 */
export function initEntitySidebar(
  container: HTMLElement,
  eventCallbacks: EntitySidebarCallbacks = {},
): void {
  callbacks = eventCallbacks;
  sidebarElement = container;

  // Initialize state manager with callback
  stateManager = new EntityStateManager((selectedEntities) => {
    callbacks.onSelectionChange?.(selectedEntities);
  });

  injectSidebarStyles();
  stateManager.loadFilterState();
  render();
}

/**
 * Update entities in the sidebar
 */
export function updateEntities(newEntities: ExtendedPIIMatch[]): void {
  stateManager?.updateEntities(newEntities);
  render();
}

/**
 * Get currently selected entities
 */
export function getSelectedEntities(): EntityWithSelection[] {
  return stateManager?.getSelectedEntities() ?? [];
}

/**
 * Get all entities
 */
export function getAllEntities(): EntityWithSelection[] {
  return stateManager?.getAllEntities() ?? [];
}

/**
 * Clear all entities
 */
export function clearEntities(): void {
  stateManager?.clearEntities();
  render();
}

/**
 * Add a manually marked entity
 * Also finds and marks ALL exact matches of the same text in the document
 */
export function addManualEntity(
  text: string,
  type: string,
  start: number,
  end: number,
): EntityWithSelection {
  if (!stateManager) {
    throw new Error('EntitySidebar not initialized. Call initializeSidebar() first.');
  }
  const entity = stateManager.addManualEntity(text, type, start, end);
  render();
  return entity;
}

/**
 * Handle entity click for navigation
 */
function handleEntityClick(entity: EntityWithSelection): void {
  callbacks.onEntityClick?.(entity);
}

/**
 * Handle entity selection change
 * Syncs selection across all entities with identical text
 */
function handleSelectionChange(entityId: string, checked: boolean, shiftKey: boolean): void {
  if (!stateManager) return;

  lastClickedIndex = stateManager.handleSelectionChange(entityId, checked, shiftKey, lastClickedIndex);
  stateManager.saveFilterState();
  render();
}

/**
 * Toggle group collapse state
 */
function toggleGroupCollapse(type: string): void {
  if (collapsedGroups.has(type)) {
    collapsedGroups.delete(type);
  } else {
    collapsedGroups.add(type);
  }
  render();
}

/**
 * Render the sidebar
 */
function render(): void {
  if (!sidebarElement || !stateManager) return;

  const groups = stateManager.groupByType();
  const types = Array.from(groups.keys()).sort();
  const allEntities = stateManager.getAllEntities();
  const visibleEntities = allEntities.filter(e => e.visible);
  const selectedCount = visibleEntities.filter(e => e.selected).length;

  const collapseChevronSvg = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>';

  sidebarElement.innerHTML = `
    <div class="entity-sidebar">
      <div class="entity-sidebar-header">
        <div class="entity-sidebar-header-content">
          <h3 class="entity-sidebar-title">Detected Entities</h3>
          <p class="entity-sidebar-subtitle">
            ${selectedCount} of ${visibleEntities.length} selected for anonymization
          </p>
        </div>
        <button class="entity-sidebar-collapse-btn" id="sidebar-collapse-btn" title="Collapse sidebar" aria-label="Collapse sidebar">
          ${collapseChevronSvg}
        </button>
      </div>

      <div class="entity-sidebar-list">
        ${types.length === 0 ? renderEmpty() : types.map(type => renderGroup(type, groups.get(type) || [])).join('')}
      </div>
    </div>
  `;

  attachEventListeners();
}

/**
 * Render empty state
 */
function renderEmpty(): string {
  return `
    <div class="entity-sidebar-empty">
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
      </svg>
      <p class="entity-sidebar-empty-title">No entities detected</p>
      <p class="entity-sidebar-empty-text">Process a document to see detected PII</p>
    </div>
  `;
}

/**
 * Render an entity group
 */
function renderGroup(type: string, groupEntities: EntityWithSelection[]): string {
  const config = getTypeConfig(type);
  const isCollapsed = collapsedGroups.has(type);
  const visibleEntities = groupEntities.filter(e => e.visible);
  const selectedCount = visibleEntities.filter(e => e.selected).length;

  if (visibleEntities.length === 0) return '';

  const chevronSvg = '<svg class="entity-group-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>';

  return `
    <div class="entity-group" data-type="${type}">
      <div class="entity-group-header"
           data-type="${type}"
           role="button"
           aria-expanded="${!isCollapsed}"
           aria-label="Toggle ${config.label} group">
        ${chevronSvg}
        <span class="entity-group-badge" style="background: ${config.bgColor}; color: ${config.color};">
          ${config.label}
        </span>
        <span class="entity-group-count">${selectedCount}/${visibleEntities.length}</span>
      </div>

      <div class="entity-group-items ${isCollapsed ? 'collapsed' : ''}">
        ${visibleEntities.map(entity => renderEntity(entity)).join('')}
      </div>
    </div>
  `;
}

/**
 * Render an individual entity item
 */
function renderEntity(entity: EntityWithSelection): string {
  const sourceConfig = SOURCE_CONFIG[entity.source || 'REGEX'] || SOURCE_CONFIG.REGEX;
  const confidenceLevel = getConfidenceLevel(entity.confidence);
  const displayText = entity.text.length > 50 ? entity.text.substring(0, 47) + '...' : entity.text;
  const isLong = entity.text.length > 50;
  const entityNum = entity.entityIndex ?? 0;

  return `
    <div class="entity-item"
         data-entity-id="${entity.id}"
         data-entity-index="${entityNum}"
         role="button"
         tabindex="0"
         title="${escapeHtml(entity.text)}">
      <input type="checkbox"
             class="entity-item-checkbox"
             data-entity-id="${entity.id}"
             ${entity.selected ? 'checked' : ''}
             aria-label="Select entity for anonymization">
      <span class="entity-item-number">${entityNum}</span>
      <div class="entity-item-content">
        <div class="entity-item-text ${isLong ? 'truncated' : ''}">
          ${escapeHtml(displayText)}
        </div>
        <div class="entity-item-meta">
          <span class="entity-item-confidence ${confidenceLevel}">
            ${formatConfidence(entity.confidence)}
          </span>
          <span class="entity-item-source" style="color: ${sourceConfig.color};">
            ${sourceConfig.label}
          </span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Attach event listeners to rendered elements
 */
function attachEventListeners(): void {
  if (!sidebarElement) return;

  // Sidebar collapse button
  const collapseBtn = sidebarElement.querySelector('#sidebar-collapse-btn');
  collapseBtn?.addEventListener('click', () => {
    callbacks.onCollapse?.();
  });

  // Group headers (collapse toggle)
  sidebarElement.querySelectorAll('.entity-group-header').forEach(header => {
    header.addEventListener('click', () => {
      const type = (header as HTMLElement).dataset.type;
      if (type) {
        toggleGroupCollapse(type);
      }
    });
  });

  // Entity checkboxes
  sidebarElement.querySelectorAll('.entity-item-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const entityId = target.dataset.entityId;
      if (entityId) {
        handleSelectionChange(entityId, target.checked, (e as KeyboardEvent).shiftKey);
      }
    });

    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  // Entity items (click to navigate)
  sidebarElement.querySelectorAll('.entity-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.entity-item-checkbox')) return;

      const entityId = (item as HTMLElement).dataset.entityId;
      if (entityId) {
        const entity = stateManager?.getEntityById(entityId);
        if (entity) {
          handleEntityClick(entity);
        }
      }
    });

    // Keyboard support
    item.addEventListener('keydown', (ev) => {
      const keyEvent = ev as KeyboardEvent;
      if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
        ev.preventDefault();
        const entityId = (item as HTMLElement).dataset.entityId;
        if (entityId) {
          const entity = stateManager?.getEntityById(entityId);
          if (entity) {
            handleEntityClick(entity);
          }
        }
      }
    });
  });
}

/**
 * Destroy the sidebar and clean up
 */
export function destroyEntitySidebar(): void {
  if (sidebarElement) {
    sidebarElement.innerHTML = '';
  }
  stateManager = null;
  callbacks = {};
  collapsedGroups.clear();
  lastClickedIndex = -1;
  sidebarElement = null;
}
