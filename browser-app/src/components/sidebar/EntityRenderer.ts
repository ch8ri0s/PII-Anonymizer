/**
 * Entity Renderer Module
 *
 * Rendering functions for entity sidebar components.
 * Extracted from EntitySidebar.ts for better modularity.
 */

import type { EntityWithSelection } from '../EntitySidebar';
import {
  getTypeConfig,
  getConfidenceLevel,
  formatConfidence,
  escapeHtml,
  normalizeType,
} from './EntityTypeConfig';
import type { EntityFilterManager } from './EntityFilters';

/**
 * Render empty state
 */
export function renderEmpty(): string {
  return `
    <div class="entity-sidebar-empty">
      <svg class="entity-sidebar-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
      <p>No entities detected</p>
      <p class="text-xs text-muted-foreground mt-1">Load a document to see PII entities</p>
    </div>
  `;
}

/**
 * Render a group of entities
 */
export function renderGroup(
  type: string,
  groupEntities: EntityWithSelection[],
  filterManager: EntityFilterManager,
): string {
  const config = getTypeConfig(type);
  const isCollapsed = filterManager.isGroupCollapsed(type);
  const isEnabled = filterManager.isTypeEnabled(type);
  const selectedCount = groupEntities.filter(e => e.selected).length;

  return `
    <div class="entity-group" data-type="${type}">
      <div class="entity-group-header">
        <button class="entity-group-toggle ${isCollapsed ? 'collapsed' : ''}" data-action="toggle" aria-expanded="${!isCollapsed}">
          <svg class="entity-group-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
        <label class="entity-group-checkbox">
          <input type="checkbox"
            data-action="filter"
            ${isEnabled ? 'checked' : ''}
            aria-label="Filter ${config.label}"
          />
        </label>
        <span class="entity-type-badge" style="background-color: ${config.bgColor}; color: ${config.color};">
          ${config.label}
        </span>
        <span class="entity-group-count">${selectedCount}/${groupEntities.length}</span>
      </div>
      ${!isCollapsed ? `
        <div class="entity-group-content">
          ${groupEntities.map(entity => renderEntity(entity, config)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render a single entity
 */
export function renderEntity(
  entity: EntityWithSelection,
  config?: { color: string; bgColor: string },
): string {
  const typeConfig = config || getTypeConfig(entity.type);
  const confidenceLevel = getConfidenceLevel(entity.confidence);
  const confidenceText = formatConfidence(entity.confidence);
  const entityNum = entity.entityIndex ?? 0;
  const isManual = entity.source === 'MANUAL';

  return `
    <div class="entity-item ${entity.selected ? 'selected' : ''}"
         data-id="${entity.id}"
         role="listitem"
         tabindex="0">
      <label class="entity-checkbox">
        <input type="checkbox"
          data-action="select"
          ${entity.selected ? 'checked' : ''}
          aria-label="Include ${escapeHtml(entity.text)} in anonymization"
        />
      </label>
      <div class="entity-content" data-action="click">
        <div class="entity-text-row">
          ${entityNum > 0 ? `<span class="entity-number" style="background-color: ${typeConfig.bgColor}; color: ${typeConfig.color};">${entityNum}</span>` : ''}
          <span class="entity-text">${escapeHtml(entity.text)}</span>
        </div>
        <div class="entity-meta">
          ${isManual ? `
            <span class="entity-source-badge manual">Manual</span>
          ` : `
            <span class="entity-confidence ${confidenceLevel}" title="Confidence: ${confidenceText}">
              ${confidenceText}
            </span>
          `}
          <span class="entity-position">${entity.start}-${entity.end}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Group entities by normalized type
 */
export function groupByType(entities: EntityWithSelection[]): Map<string, EntityWithSelection[]> {
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
