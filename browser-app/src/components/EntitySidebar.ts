/**
 * Entity Sidebar Component
 *
 * Displays detected PII entities with:
 * - Entity grouping by type with smooth expand/collapse
 * - Confidence scores with color indicators
 * - Detection source badges
 * - Per-entity selection for anonymization
 * - Click-to-scroll navigation
 *
 * Story 7.4: Entity Review UI Implementation
 * Updated with shadcn-inspired design
 */

import type { ExtendedPIIMatch } from '../processing/PIIDetector';

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
 * Entity type configuration
 */
interface EntityTypeConfig {
  label: string;
  color: string;
  bgColor: string;
}

/**
 * Entity type display configurations with shadcn-style colors
 */
const ENTITY_TYPE_CONFIG: Record<string, EntityTypeConfig> = {
  PERSON: { label: 'Person', color: 'hsl(217.2 91.2% 59.8%)', bgColor: 'hsl(217.2 91.2% 59.8% / 0.1)' },
  PERSON_NAME: { label: 'Person', color: 'hsl(217.2 91.2% 59.8%)', bgColor: 'hsl(217.2 91.2% 59.8% / 0.1)' },
  ORG: { label: 'Organization', color: 'hsl(263.4 70% 50.4%)', bgColor: 'hsl(263.4 70% 50.4% / 0.1)' },
  ORGANIZATION: { label: 'Organization', color: 'hsl(263.4 70% 50.4%)', bgColor: 'hsl(263.4 70% 50.4% / 0.1)' },
  ADDRESS: { label: 'Address', color: 'hsl(142.1 76.2% 36.3%)', bgColor: 'hsl(142.1 76.2% 36.3% / 0.1)' },
  STREET_ADDRESS: { label: 'Address', color: 'hsl(142.1 76.2% 36.3%)', bgColor: 'hsl(142.1 76.2% 36.3% / 0.1)' },
  EMAIL: { label: 'Email', color: 'hsl(189 94% 43%)', bgColor: 'hsl(189 94% 43% / 0.1)' },
  PHONE: { label: 'Phone', color: 'hsl(45.4 93.4% 47.5%)', bgColor: 'hsl(45.4 93.4% 47.5% / 0.1)' },
  DATE: { label: 'Date', color: 'hsl(24.6 95% 53.1%)', bgColor: 'hsl(24.6 95% 53.1% / 0.1)' },
  IBAN: { label: 'IBAN', color: 'hsl(226.2 72.9% 51.4%)', bgColor: 'hsl(226.2 72.9% 51.4% / 0.1)' },
  SWISS_AVS: { label: 'Swiss AVS', color: 'hsl(0 84.2% 60.2%)', bgColor: 'hsl(0 84.2% 60.2% / 0.1)' },
  AVS: { label: 'AVS', color: 'hsl(0 84.2% 60.2%)', bgColor: 'hsl(0 84.2% 60.2% / 0.1)' },
  ID_NUMBER: { label: 'ID Number', color: 'hsl(0 0% 45.1%)', bgColor: 'hsl(0 0% 45.1% / 0.1)' },
  LOCATION: { label: 'Location', color: 'hsl(172 66% 50%)', bgColor: 'hsl(172 66% 50% / 0.1)' },
  OTHER: { label: 'Other', color: 'hsl(0 0% 45.1%)', bgColor: 'hsl(0 0% 45.1% / 0.1)' },
};

/**
 * Detection source display info
 */
const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  ML: { label: 'ML', color: 'hsl(263.4 70% 50.4%)' },
  REGEX: { label: 'Rule', color: 'hsl(217.2 91.2% 59.8%)' },
  RULE: { label: 'Rule', color: 'hsl(217.2 91.2% 59.8%)' },
  BOTH: { label: 'ML+Rule', color: 'hsl(142.1 76.2% 36.3%)' },
  MANUAL: { label: 'Manual', color: 'hsl(24.6 95% 53.1%)' },
};

/**
 * Callbacks for entity sidebar events
 */
export interface EntitySidebarCallbacks {
  onEntityClick?: (entity: EntityWithSelection) => void;
  onSelectionChange?: (entities: EntityWithSelection[]) => void;
  onFilterChange?: (visibleTypes: Set<string>) => void;
  onManualMark?: (text: string, type: string, start: number, end: number) => void;
}

// Module state
let sidebarElement: HTMLElement | null = null;
let entities: EntityWithSelection[] = [];
let callbacks: EntitySidebarCallbacks = {};
let typeFilters: Map<string, boolean> = new Map();
const collapsedGroups: Set<string> = new Set();
let lastClickedIndex: number = -1;

/**
 * CSS for the entity sidebar
 */
const ENTITY_SIDEBAR_CSS = `
  .entity-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: hsl(0 0% 100%);
  }

  .entity-sidebar-header {
    padding: 1rem;
    border-bottom: 1px solid hsl(0 0% 89.8%);
  }

  .entity-sidebar-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: hsl(0 0% 9%);
    margin: 0;
  }

  .entity-sidebar-subtitle {
    font-size: 0.75rem;
    color: hsl(0 0% 45.1%);
    margin-top: 0.25rem;
  }

  .entity-sidebar-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .entity-group {
    margin-bottom: 0.25rem;
  }

  .entity-group-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background: hsl(0 0% 98%);
    border: 1px solid hsl(0 0% 89.8%);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
  }

  .entity-group-header:hover {
    background: hsl(0 0% 96.1%);
    border-color: hsl(0 0% 79.8%);
  }

  .entity-group-header[aria-expanded="true"] {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border-bottom-color: transparent;
  }

  .entity-group-chevron {
    width: 1rem;
    height: 1rem;
    color: hsl(0 0% 45.1%);
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }

  .entity-group-header[aria-expanded="true"] .entity-group-chevron {
    transform: rotate(90deg);
  }

  .entity-group-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.025em;
  }

  .entity-group-count {
    margin-left: auto;
    font-size: 0.6875rem;
    font-weight: 500;
    color: hsl(0 0% 45.1%);
    background: hsl(0 0% 93%);
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
  }

  .entity-group-items {
    border: 1px solid hsl(0 0% 89.8%);
    border-top: none;
    border-bottom-left-radius: 0.375rem;
    border-bottom-right-radius: 0.375rem;
    overflow: hidden;
  }

  .entity-group-items.collapsed {
    display: none;
  }

  .entity-item {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.625rem 0.75rem;
    background: hsl(0 0% 100%);
    border-bottom: 1px solid hsl(0 0% 94.1%);
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .entity-item:last-child {
    border-bottom: none;
  }

  .entity-item:hover {
    background: hsl(0 0% 98%);
  }

  .entity-item-checkbox {
    width: 1rem;
    height: 1rem;
    margin-top: 0.125rem;
    accent-color: hsl(222.2 47.4% 11.2%);
    cursor: pointer;
    flex-shrink: 0;
  }

  .entity-item-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.375rem;
    height: 1.375rem;
    padding: 0 0.25rem;
    background: hsl(222.2 47.4% 11.2%);
    color: hsl(0 0% 98%);
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .entity-item-content {
    flex: 1;
    min-width: 0;
  }

  .entity-item-text {
    font-size: 0.8125rem;
    color: hsl(0 0% 9%);
    line-height: 1.4;
    word-break: break-word;
  }

  .entity-item-text.truncated {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entity-item-meta {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.25rem;
  }

  .entity-item-confidence {
    display: inline-flex;
    align-items: center;
    padding: 0.0625rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.625rem;
    font-weight: 600;
  }

  .entity-item-confidence.high {
    background: hsl(142.1 76.2% 36.3% / 0.15);
    color: hsl(142.1 76.2% 30%);
  }

  .entity-item-confidence.medium {
    background: hsl(45.4 93.4% 47.5% / 0.15);
    color: hsl(45.4 93.4% 35%);
  }

  .entity-item-confidence.low {
    background: hsl(0 84.2% 60.2% / 0.15);
    color: hsl(0 84.2% 50%);
  }

  .entity-item-source {
    display: inline-flex;
    align-items: center;
    padding: 0.0625rem 0.375rem;
    border-radius: 0.25rem;
    font-size: 0.625rem;
    font-weight: 500;
    background: hsl(0 0% 93%);
    color: hsl(0 0% 45.1%);
  }

  .entity-sidebar-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
    color: hsl(0 0% 45.1%);
  }

  .entity-sidebar-empty svg {
    width: 3rem;
    height: 3rem;
    margin-bottom: 0.75rem;
    opacity: 0.5;
  }

  .entity-sidebar-empty-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: hsl(0 0% 25%);
  }

  .entity-sidebar-empty-text {
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
`;

/**
 * Inject CSS styles
 */
function injectStyles(): void {
  if (!document.getElementById('entity-sidebar-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'entity-sidebar-styles';
    styleSheet.textContent = ENTITY_SIDEBAR_CSS;
    document.head.appendChild(styleSheet);
  }
}

/**
 * Initialize the entity sidebar
 */
export function initEntitySidebar(
  container: HTMLElement,
  eventCallbacks: EntitySidebarCallbacks = {},
): void {
  callbacks = eventCallbacks;
  sidebarElement = container;

  injectStyles();
  loadFilterState();
  render();
}

/**
 * Update entities in the sidebar
 */
export function updateEntities(newEntities: ExtendedPIIMatch[]): void {
  // Sort by position first to assign consistent numbering
  const sorted = [...newEntities].sort((a, b) => a.start - b.start);

  entities = sorted.map((entity, index) => ({
    ...entity,
    id: entity.id || `entity-${index}-${entity.start}`,
    selected: (entity as EntityWithSelection).selected ?? true,
    visible: true,
    source: entity.source || 'REGEX',
    entityIndex: index + 1, // 1-based index for display
  }));

  const types = new Set(entities.map(e => normalizeType(e.type)));
  types.forEach(type => {
    if (!typeFilters.has(type)) {
      typeFilters.set(type, true);
    }
  });

  applyFilters();
  render();
}

/**
 * Get currently selected entities
 */
export function getSelectedEntities(): EntityWithSelection[] {
  return entities.filter(e => e.selected && e.visible);
}

/**
 * Get all entities
 */
export function getAllEntities(): EntityWithSelection[] {
  return [...entities];
}

/**
 * Clear all entities
 */
export function clearEntities(): void {
  entities = [];
  render();
}

/**
 * Add a manually marked entity
 */
export function addManualEntity(
  text: string,
  type: string,
  start: number,
  end: number,
): EntityWithSelection {
  const newEntity: EntityWithSelection = {
    text,
    type,
    start,
    end,
    source: 'MANUAL',
    id: `manual-${Date.now()}-${start}`,
    selected: true,
    visible: true,
    confidence: 1.0, // Manual entities have 100% confidence
  };

  entities.push(newEntity);

  // Re-sort by position and assign entityIndex for consistent numbering
  entities.sort((a, b) => a.start - b.start);
  entities.forEach((entity, index) => {
    entity.entityIndex = index + 1;
  });

  const normalizedType = normalizeType(type);
  if (!typeFilters.has(normalizedType)) {
    typeFilters.set(normalizedType, true);
  }

  render();
  callbacks.onSelectionChange?.(getSelectedEntities());

  return newEntity;
}

/**
 * Normalize entity type for grouping
 */
function normalizeType(type: string): string {
  const typeMap: Record<string, string> = {
    'PERSON_NAME': 'PERSON',
    'ORGANIZATION': 'ORG',
    'STREET_ADDRESS': 'ADDRESS',
  };
  return typeMap[type] || type;
}

/**
 * Get type configuration
 */
function getTypeConfig(type: string): EntityTypeConfig {
  return ENTITY_TYPE_CONFIG[type] || ENTITY_TYPE_CONFIG[normalizeType(type)] || ENTITY_TYPE_CONFIG.OTHER;
}

/**
 * Get confidence level
 */
function getConfidenceLevel(confidence: number | undefined): 'high' | 'medium' | 'low' {
  if (confidence === undefined) return 'medium';
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

/**
 * Format confidence as percentage
 */
function formatConfidence(confidence: number | undefined): string {
  if (confidence === undefined) return '—';
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Apply type filters to entities
 */
function applyFilters(): void {
  entities.forEach(entity => {
    const type = normalizeType(entity.type);
    entity.visible = typeFilters.get(type) ?? true;
  });

  saveFilterState();

  if (callbacks.onFilterChange) {
    const visibleTypes = new Set<string>();
    typeFilters.forEach((visible, type) => {
      if (visible) visibleTypes.add(type);
    });
    callbacks.onFilterChange(visibleTypes);
  }
}

/**
 * Save filter state to sessionStorage
 */
function saveFilterState(): void {
  try {
    sessionStorage.setItem('entitySidebar.filters', JSON.stringify(Object.fromEntries(typeFilters)));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Load filter state from sessionStorage
 */
function loadFilterState(): void {
  try {
    const stored = sessionStorage.getItem('entitySidebar.filters');
    if (stored) {
      typeFilters = new Map(Object.entries(JSON.parse(stored)));
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Group entities by type
 */
function groupByType(): Map<string, EntityWithSelection[]> {
  const groups = new Map<string, EntityWithSelection[]>();

  entities.forEach(entity => {
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
 * Handle entity click for navigation
 */
function handleEntityClick(entity: EntityWithSelection): void {
  callbacks.onEntityClick?.(entity);
}

/**
 * Handle entity selection change
 */
function handleSelectionChange(entityId: string, checked: boolean, shiftKey: boolean): void {
  const currentIndex = entities.findIndex(e => e.id === entityId);

  if (shiftKey && lastClickedIndex >= 0 && currentIndex >= 0) {
    const start = Math.min(lastClickedIndex, currentIndex);
    const end = Math.max(lastClickedIndex, currentIndex);
    for (let i = start; i <= end; i++) {
      if (entities[i].visible) {
        entities[i].selected = checked;
      }
    }
  } else {
    const entity = entities.find(e => e.id === entityId);
    if (entity) {
      entity.selected = checked;
    }
  }

  lastClickedIndex = currentIndex;
  render();
  callbacks.onSelectionChange?.(getSelectedEntities());
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
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Render the sidebar
 */
function render(): void {
  if (!sidebarElement) return;

  const groups = groupByType();
  const types = Array.from(groups.keys()).sort();

  const visibleEntities = entities.filter(e => e.visible);
  const selectedCount = visibleEntities.filter(e => e.selected).length;

  sidebarElement.innerHTML = `
    <div class="entity-sidebar">
      <div class="entity-sidebar-header">
        <h3 class="entity-sidebar-title">Detected Entities</h3>
        <p class="entity-sidebar-subtitle">
          ${selectedCount} of ${visibleEntities.length} selected for anonymization
        </p>
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
        const entity = entities.find(e => e.id === entityId);
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
          const entity = entities.find(ent => ent.id === entityId);
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
  entities = [];
  callbacks = {};
  typeFilters.clear();
  collapsedGroups.clear();
  lastClickedIndex = -1;
  sidebarElement = null;
}
