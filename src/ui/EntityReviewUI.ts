/**
 * Entity Review UI Component (Epic 4)
 *
 * Provides interactive entity review functionality including:
 * - Story 4.1: Entity Sidebar Panel
 * - Story 4.2: Entity Type Filtering
 * - Story 4.3: Selective Anonymization
 * - Story 4.4: Manual PII Marking (partial - context menu)
 */

import type {
  ReviewableEntity,
  EntityFilterOptions,
  EntityGroup,
  ReviewStatistics,
  ReviewSession,
  ReviewResult,
  ReviewStatus,
  ManualMarkRequest,
} from '../types/entityReview.js';
import type { EntityType } from '../types/detection.js';
import {
  DEFAULT_FILTER_OPTIONS,
  ENTITY_TYPE_LABELS,
  ENTITY_TYPE_COLORS,
} from '../types/entityReview.js';

/**
 * Generate a unique ID for entities
 */
function generateId(): string {
  return `entity_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Entity Review UI Manager
 *
 * Handles all UI interactions for the entity review workflow.
 */
export class EntityReviewUI {
  private container: HTMLElement | null = null;
  private session: ReviewSession | null = null;
  private onEntityAction: ((entityId: string, action: string, data?: unknown) => void) | null = null;
  private onReviewComplete: ((result: ReviewResult) => void) | null = null;
  private onScrollToEntity: ((start: number, end: number) => void) | null = null;

  // UI Elements
  private entityList: HTMLElement | null = null;
  private statsPanel: HTMLElement | null = null;

  // Filter state
  private filters: EntityFilterOptions = { ...DEFAULT_FILTER_OPTIONS };

  // Collapsed groups state
  private collapsedGroups: Set<EntityType> = new Set();

  /**
   * Initialize the review UI
   */
  initialize(containerId: string): void {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error(`[EntityReviewUI] Container not found: ${containerId}`);
      return;
    }

    this.render();
  }

  /**
   * Set callback for entity actions
   */
  setOnEntityAction(callback: (entityId: string, action: string, data?: unknown) => void): void {
    this.onEntityAction = callback;
  }

  /**
   * Set callback for review completion
   */
  setOnReviewComplete(callback: (result: ReviewResult) => void): void {
    this.onReviewComplete = callback;
  }

  /**
   * Set callback for scroll-to-entity
   */
  setOnScrollToEntity(callback: (start: number, end: number) => void): void {
    this.onScrollToEntity = callback;
  }

  /**
   * Load entities into the review UI
   */
  loadEntities(
    entities: Record<string, string>,
    metadata?: {
      originalFile: string;
      entityDetails?: Array<{
        text: string;
        type: EntityType;
        confidence: number;
        source: 'ML' | 'RULE' | 'BOTH';
        start?: number;
        end?: number;
        flaggedForReview?: boolean;
      }>;
    },
  ): void {
    // Convert simple mapping to reviewable entities
    const reviewableEntities: ReviewableEntity[] = [];

    // If we have detailed entity info, use it
    if (metadata?.entityDetails) {
      for (const detail of metadata.entityDetails) {
        const replacement = entities[detail.text];
        if (replacement) {
          reviewableEntities.push({
            id: generateId(),
            originalText: detail.text,
            replacement,
            type: detail.type,
            confidence: detail.confidence,
            source: detail.source,
            status: 'pending',
            position: detail.start !== undefined && detail.end !== undefined
              ? { start: detail.start, end: detail.end }
              : undefined,
            flaggedForReview: detail.flaggedForReview || detail.confidence < 0.6,
          });
        }
      }
    } else {
      // Fallback: parse type from replacement prefix
      for (const [original, replacement] of Object.entries(entities)) {
        const typePrefix = replacement.split('_')[0] ?? 'UNKNOWN';
        const entityType = this.mapPrefixToType(typePrefix);

        reviewableEntities.push({
          id: generateId(),
          originalText: original,
          replacement,
          type: entityType,
          confidence: 0.8, // Default confidence when not provided
          source: 'BOTH',
          status: 'pending',
          flaggedForReview: false,
        });
      }
    }

    // Create session
    this.session = {
      originalFile: metadata?.originalFile || 'Unknown',
      entities: reviewableEntities,
      filters: { ...DEFAULT_FILTER_OPTIONS },
      statistics: this.calculateStatistics(reviewableEntities),
      actionHistory: [],
      reviewComplete: false,
      startedAt: new Date(),
    };

    this.filters = { ...DEFAULT_FILTER_OPTIONS };
    this.render();
  }

  /**
   * Map replacement prefix to EntityType
   */
  private mapPrefixToType(prefix: string): EntityType {
    const prefixMap: Record<string, EntityType> = {
      'PER': 'PERSON',
      'PERSON': 'PERSON',
      'ORG': 'ORGANIZATION',
      'ORGANIZATION': 'ORGANIZATION',
      'LOC': 'LOCATION',
      'LOCATION': 'LOCATION',
      'ADDRESS': 'ADDRESS',
      'SWISS_ADDRESS': 'SWISS_ADDRESS',
      'EU_ADDRESS': 'EU_ADDRESS',
      'SWISS_AVS': 'SWISS_AVS',
      'AVS': 'SWISS_AVS',
      'AHV': 'SWISS_AVS',
      'IBAN': 'IBAN',
      'PHONE': 'PHONE',
      'EMAIL': 'EMAIL',
      'DATE': 'DATE',
      'AMOUNT': 'AMOUNT',
      'VAT': 'VAT_NUMBER',
      'VAT_NUMBER': 'VAT_NUMBER',
      'INVOICE': 'INVOICE_NUMBER',
      'INVOICE_NUMBER': 'INVOICE_NUMBER',
      'PAYMENT': 'PAYMENT_REF',
      'PAYMENT_REF': 'PAYMENT_REF',
      'QR': 'QR_REFERENCE',
      'QR_REFERENCE': 'QR_REFERENCE',
      'SENDER': 'SENDER',
      'RECIPIENT': 'RECIPIENT',
      'SALUTATION': 'SALUTATION_NAME',
      'SIGNATURE': 'SIGNATURE',
      'VENDOR': 'VENDOR_NAME',
      'MISC': 'UNKNOWN',
    };

    return prefixMap[prefix.toUpperCase()] || 'UNKNOWN';
  }

  /**
   * Calculate statistics from entities
   */
  private calculateStatistics(entities: ReviewableEntity[]): ReviewStatistics {
    const stats: ReviewStatistics = {
      total: entities.length,
      pending: 0,
      approved: 0,
      rejected: 0,
      edited: 0,
      flagged: 0,
      manual: 0,
      byType: {} as Record<EntityType, number>,
    };

    for (const entity of entities) {
      // Count by status
      switch (entity.status) {
        case 'pending':
          stats.pending++;
          break;
        case 'approved':
          stats.approved++;
          break;
        case 'rejected':
          stats.rejected++;
          break;
        case 'edited':
          stats.edited++;
          break;
      }

      // Count flagged
      if (entity.flaggedForReview) {
        stats.flagged++;
      }

      // Count manual
      if (entity.source === 'MANUAL') {
        stats.manual++;
      }

      // Count by type
      stats.byType[entity.type] = (stats.byType[entity.type] || 0) + 1;
    }

    return stats;
  }

  /**
   * Main render function
   */
  private render(): void {
    if (!this.container) return;

    if (!this.session) {
      this.container.innerHTML = `
        <div class="entity-review-empty">
          <p class="text-gray-500 text-center py-8">Process a file to review detected entities</p>
        </div>
      `;
      return;
    }

    // Build the sidebar HTML
    this.container.innerHTML = `
      <div class="entity-review-sidebar">
        ${this.renderHeader()}
        ${this.renderStats()}
        ${this.renderFilters()}
        ${this.renderEntityList()}
        ${this.renderActions()}
      </div>
    `;

    // Cache elements
    this.entityList = this.container.querySelector('.entity-list');
    this.statsPanel = this.container.querySelector('.review-stats');

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Render header section
   */
  private renderHeader(): string {
    return `
      <div class="review-header">
        <h3 class="review-title">
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          Review Entities
        </h3>
        <button class="btn-ghost btn-xs review-collapse-btn" data-action="toggle-sidebar" title="Collapse sidebar">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>
    `;
  }

  /**
   * Render statistics panel
   */
  private renderStats(): string {
    if (!this.session) return '';

    const stats = this.session.statistics;

    return `
      <div class="review-stats">
        <div class="stats-row">
          <span class="stat-label">Total</span>
          <span class="stat-value">${stats.total}</span>
        </div>
        <div class="stats-row">
          <span class="stat-label stat-pending">Pending</span>
          <span class="stat-value">${stats.pending}</span>
        </div>
        <div class="stats-row">
          <span class="stat-label stat-approved">Approved</span>
          <span class="stat-value text-green-600">${stats.approved}</span>
        </div>
        <div class="stats-row">
          <span class="stat-label stat-rejected">Rejected</span>
          <span class="stat-value text-red-600">${stats.rejected}</span>
        </div>
        ${stats.flagged > 0 ? `
        <div class="stats-row">
          <span class="stat-label stat-flagged">
            <svg class="w-3 h-3 inline text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            Flagged
          </span>
          <span class="stat-value text-yellow-600">${stats.flagged}</span>
        </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Render filter controls
   */
  private renderFilters(): string {
    if (!this.session) return '';

    const allTypes = Object.keys(this.session.statistics.byType) as EntityType[];

    return `
      <div class="review-filters">
        <div class="filter-section">
          <label class="filter-label">
            <input type="checkbox" class="filter-checkbox" data-filter="flagged-only" ${this.filters.showFlaggedOnly ? 'checked' : ''}>
            <span>Show flagged only</span>
          </label>
        </div>

        <div class="filter-section">
          <label class="filter-label">
            <span>Min confidence:</span>
            <input type="range" class="filter-slider" data-filter="confidence" min="0" max="100" value="${this.filters.minConfidence * 100}">
            <span class="confidence-value">${Math.round(this.filters.minConfidence * 100)}%</span>
          </label>
        </div>

        <div class="filter-section filter-types">
          <div class="filter-types-header">
            <span class="filter-label">Entity Types</span>
            <button class="btn-link btn-xs" data-action="select-all-types">All</button>
            <button class="btn-link btn-xs" data-action="select-no-types">None</button>
          </div>
          <div class="type-checkboxes">
            ${allTypes.map(type => `
              <label class="type-checkbox">
                <input type="checkbox" data-filter="type" data-type="${type}" ${this.filters.types.length === 0 || this.filters.types.includes(type) ? 'checked' : ''}>
                <span class="badge ${ENTITY_TYPE_COLORS[type]}">${ENTITY_TYPE_LABELS[type]}</span>
                <span class="type-count">(${this.session?.statistics.byType[type] || 0})</span>
              </label>
            `).join('')}
          </div>
        </div>

        <div class="filter-section">
          <input type="text" class="filter-search" data-filter="search" placeholder="Search entities..." value="${this.filters.searchText}">
        </div>
      </div>
    `;
  }

  /**
   * Render entity list grouped by type
   */
  private renderEntityList(): string {
    if (!this.session) return '';

    const filteredEntities = this.getFilteredEntities();
    const groups = this.groupEntitiesByType(filteredEntities);

    if (groups.length === 0) {
      return `
        <div class="entity-list">
          <p class="text-gray-500 text-center py-4">No entities match the current filters</p>
        </div>
      `;
    }

    return `
      <div class="entity-list scroll-area">
        ${groups.map(group => this.renderEntityGroup(group)).join('')}
      </div>
    `;
  }

  /**
   * Render a single entity group
   */
  private renderEntityGroup(group: EntityGroup): string {
    const isCollapsed = this.collapsedGroups.has(group.type);

    return `
      <div class="entity-group" data-type="${group.type}">
        <button class="entity-group-header" data-action="toggle-group" data-type="${group.type}">
          <span class="group-toggle ${isCollapsed ? 'collapsed' : ''}">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
          <span class="badge ${ENTITY_TYPE_COLORS[group.type]}">${group.label}</span>
          <span class="group-count">${group.count}</span>
          <span class="group-status">
            ${group.approvedCount > 0 ? `<span class="text-green-600">${group.approvedCount}✓</span>` : ''}
            ${group.rejectedCount > 0 ? `<span class="text-red-600">${group.rejectedCount}✗</span>` : ''}
          </span>
        </button>
        <div class="entity-group-items ${isCollapsed ? 'hidden' : ''}">
          ${group.entities.map(entity => this.renderEntityItem(entity)).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render a single entity item
   */
  private renderEntityItem(entity: ReviewableEntity): string {
    const statusClasses: Record<ReviewStatus, string> = {
      pending: 'entity-pending',
      approved: 'entity-approved',
      rejected: 'entity-rejected',
      edited: 'entity-edited',
    };

    const confidenceClass = entity.confidence >= 0.8 ? 'confidence-high' :
      entity.confidence >= 0.6 ? 'confidence-medium' : 'confidence-low';

    return `
      <div class="entity-item ${statusClasses[entity.status]} ${entity.flaggedForReview ? 'entity-flagged' : ''}" data-entity-id="${entity.id}">
        <div class="entity-main" data-action="scroll-to" data-entity-id="${entity.id}">
          <div class="entity-text">
            <span class="entity-original" title="${escapeHtml(entity.originalText)}">${escapeHtml(this.truncateText(entity.originalText, 30))}</span>
            <span class="entity-arrow">→</span>
            <span class="entity-replacement">${escapeHtml(entity.editedReplacement || entity.replacement)}</span>
          </div>
          <div class="entity-meta">
            <span class="entity-confidence ${confidenceClass}" title="Confidence: ${Math.round(entity.confidence * 100)}%">
              ${Math.round(entity.confidence * 100)}%
            </span>
            <span class="entity-source" title="Source: ${entity.source}">${entity.source}</span>
            ${entity.flaggedForReview ? `
              <span class="entity-flag" title="Flagged for review">
                <svg class="w-3 h-3 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
              </span>
            ` : ''}
          </div>
        </div>
        <div class="entity-actions">
          <button class="entity-action-btn approve ${entity.status === 'approved' ? 'active' : ''}" data-action="approve" data-entity-id="${entity.id}" title="Approve">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button class="entity-action-btn reject ${entity.status === 'rejected' ? 'active' : ''}" data-action="reject" data-entity-id="${entity.id}" title="Reject">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <button class="entity-action-btn edit" data-action="edit" data-entity-id="${entity.id}" title="Edit">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Render bottom action buttons
   */
  private renderActions(): string {
    if (!this.session) return '';

    const hasChanges = this.session.statistics.approved > 0 ||
                       this.session.statistics.rejected > 0 ||
                       this.session.statistics.edited > 0;

    return `
      <div class="review-actions">
        <div class="bulk-actions">
          <button class="btn-secondary btn-sm" data-action="approve-all" title="Approve all pending">
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Approve All
          </button>
          <button class="btn-ghost btn-sm" data-action="reset-all" title="Reset all changes">
            Reset
          </button>
        </div>
        <button class="btn-primary btn-sm" data-action="complete-review" ${!hasChanges ? 'disabled' : ''}>
          Confirm Review
        </button>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.container) return;

    // Delegate all clicks
    this.container.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const actionEl = target.closest('[data-action]') as HTMLElement;

      if (!actionEl) return;

      const action = actionEl.dataset['action'];
      const entityId = actionEl.dataset['entityId'];

      switch (action) {
        case 'approve':
          if (entityId) this.handleApprove(entityId);
          break;
        case 'reject':
          if (entityId) this.handleReject(entityId);
          break;
        case 'edit':
          if (entityId) this.handleEdit(entityId);
          break;
        case 'scroll-to':
          if (entityId) this.handleScrollTo(entityId);
          break;
        case 'toggle-group':
          this.handleToggleGroup(actionEl.dataset['type'] as EntityType);
          break;
        case 'approve-all':
          this.handleApproveAll();
          break;
        case 'reset-all':
          this.handleResetAll();
          break;
        case 'complete-review':
          this.handleCompleteReview();
          break;
        case 'select-all-types':
          this.handleSelectAllTypes();
          break;
        case 'select-no-types':
          this.handleSelectNoTypes();
          break;
      }
    });

    // Filter change listeners
    this.container.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;

      if (target.dataset['filter'] === 'flagged-only') {
        this.filters.showFlaggedOnly = target.checked;
        this.updateEntityList();
      } else if (target.dataset['filter'] === 'type') {
        const type = target.dataset['type'] as EntityType;
        if (target.checked) {
          if (this.filters.types.length > 0) {
            this.filters.types.push(type);
          }
        } else {
          if (this.filters.types.length === 0) {
            // Initialize with all types except this one
            const allTypes = Object.keys(this.session?.statistics.byType || {}) as EntityType[];
            this.filters.types = allTypes.filter(t => t !== type);
          } else {
            this.filters.types = this.filters.types.filter(t => t !== type);
          }
        }
        this.updateEntityList();
      }
    });

    // Range slider for confidence
    this.container.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;

      if (target.dataset['filter'] === 'confidence') {
        this.filters.minConfidence = parseInt(target.value, 10) / 100;
        const valueDisplay = target.parentElement?.querySelector('.confidence-value');
        if (valueDisplay) {
          valueDisplay.textContent = `${target.value}%`;
        }
        this.updateEntityList();
      } else if (target.dataset['filter'] === 'search') {
        this.filters.searchText = target.value;
        this.updateEntityList();
      }
    });
  }

  /**
   * Get filtered entities based on current filter settings
   */
  private getFilteredEntities(): ReviewableEntity[] {
    if (!this.session) return [];

    return this.session.entities.filter(entity => {
      // Filter by flagged
      if (this.filters.showFlaggedOnly && !entity.flaggedForReview) {
        return false;
      }

      // Filter by confidence
      if (entity.confidence < this.filters.minConfidence) {
        return false;
      }

      // Filter by type
      if (this.filters.types.length > 0 && !this.filters.types.includes(entity.type)) {
        return false;
      }

      // Filter by status
      if (this.filters.statusFilter !== 'all' && entity.status !== this.filters.statusFilter) {
        return false;
      }

      // Filter by search text
      if (this.filters.searchText) {
        const search = this.filters.searchText.toLowerCase();
        if (!entity.originalText.toLowerCase().includes(search) &&
            !entity.replacement.toLowerCase().includes(search)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Group entities by type
   */
  private groupEntitiesByType(entities: ReviewableEntity[]): EntityGroup[] {
    const groups = new Map<EntityType, ReviewableEntity[]>();

    for (const entity of entities) {
      const existing = groups.get(entity.type) || [];
      existing.push(entity);
      groups.set(entity.type, existing);
    }

    return Array.from(groups.entries()).map(([type, groupEntities]) => ({
      type,
      label: ENTITY_TYPE_LABELS[type],
      entities: groupEntities,
      count: groupEntities.length,
      approvedCount: groupEntities.filter(e => e.status === 'approved').length,
      rejectedCount: groupEntities.filter(e => e.status === 'rejected').length,
      expanded: !this.collapsedGroups.has(type),
    })).sort((a, b) => b.count - a.count);
  }

  /**
   * Update entity list without full re-render
   */
  private updateEntityList(): void {
    if (!this.entityList) {
      this.render();
      return;
    }

    const filteredEntities = this.getFilteredEntities();
    const groups = this.groupEntitiesByType(filteredEntities);

    if (groups.length === 0) {
      this.entityList.innerHTML = '<p class="text-gray-500 text-center py-4">No entities match the current filters</p>';
      return;
    }

    this.entityList.innerHTML = groups.map(group => this.renderEntityGroup(group)).join('');
  }

  /**
   * Update statistics panel
   */
  private updateStats(): void {
    if (!this.session) return;

    this.session.statistics = this.calculateStatistics(this.session.entities);

    if (this.statsPanel) {
      this.statsPanel.outerHTML = this.renderStats();
      this.statsPanel = this.container?.querySelector('.review-stats') || null;
    }
  }

  /**
   * Handle approve action
   */
  private handleApprove(entityId: string): void {
    const entity = this.session?.entities.find(e => e.id === entityId);
    if (!entity) return;

    entity.status = entity.status === 'approved' ? 'pending' : 'approved';
    this.updateEntityItem(entityId);
    this.updateStats();
    this.onEntityAction?.(entityId, 'approve', { status: entity.status });
  }

  /**
   * Handle reject action
   */
  private handleReject(entityId: string): void {
    const entity = this.session?.entities.find(e => e.id === entityId);
    if (!entity) return;

    entity.status = entity.status === 'rejected' ? 'pending' : 'rejected';
    this.updateEntityItem(entityId);
    this.updateStats();
    this.onEntityAction?.(entityId, 'reject', { status: entity.status });
  }

  /**
   * Handle edit action
   */
  private handleEdit(entityId: string): void {
    const entity = this.session?.entities.find(e => e.id === entityId);
    if (!entity) return;

    const newReplacement = window.prompt('Edit replacement value:', entity.editedReplacement || entity.replacement);
    if (newReplacement && newReplacement !== entity.replacement) {
      entity.editedReplacement = newReplacement;
      entity.status = 'edited';
      this.updateEntityItem(entityId);
      this.updateStats();
      this.onEntityAction?.(entityId, 'edit', { newReplacement });
    }
  }

  /**
   * Handle scroll to entity
   */
  private handleScrollTo(entityId: string): void {
    const entity = this.session?.entities.find(e => e.id === entityId);
    if (!entity || !entity.position) return;

    this.onScrollToEntity?.(entity.position.start, entity.position.end);
  }

  /**
   * Handle group toggle
   */
  private handleToggleGroup(type: EntityType): void {
    if (this.collapsedGroups.has(type)) {
      this.collapsedGroups.delete(type);
    } else {
      this.collapsedGroups.add(type);
    }

    const groupEl = this.container?.querySelector(`[data-type="${type}"]`);
    if (groupEl) {
      const toggle = groupEl.querySelector('.group-toggle');
      const items = groupEl.querySelector('.entity-group-items');
      toggle?.classList.toggle('collapsed');
      items?.classList.toggle('hidden');
    }
  }

  /**
   * Handle approve all
   */
  private handleApproveAll(): void {
    if (!this.session) return;

    const filteredEntities = this.getFilteredEntities();
    for (const entity of filteredEntities) {
      if (entity.status === 'pending') {
        entity.status = 'approved';
      }
    }

    this.updateEntityList();
    this.updateStats();
  }

  /**
   * Handle reset all
   */
  private handleResetAll(): void {
    if (!this.session) return;

    for (const entity of this.session.entities) {
      entity.status = 'pending';
      entity.editedReplacement = undefined;
    }

    this.updateEntityList();
    this.updateStats();
  }

  /**
   * Handle select all types
   */
  private handleSelectAllTypes(): void {
    this.filters.types = [];
    this.updateEntityList();

    // Update checkboxes
    const checkboxes = this.container?.querySelectorAll('[data-filter="type"]') as NodeListOf<HTMLInputElement>;
    checkboxes?.forEach(cb => cb.checked = true);
  }

  /**
   * Handle select no types
   */
  private handleSelectNoTypes(): void {
    // Set types filter to show nothing (use a non-existent type)
    this.filters.types = ['UNKNOWN' as EntityType];
    this.updateEntityList();

    // Update checkboxes
    const checkboxes = this.container?.querySelectorAll('[data-filter="type"]') as NodeListOf<HTMLInputElement>;
    checkboxes?.forEach(cb => cb.checked = false);
  }

  /**
   * Handle complete review
   */
  private handleCompleteReview(): void {
    if (!this.session) return;

    const result: ReviewResult = {
      entitiesToAnonymize: [],
      rejectedEntities: [],
      manualEntities: [],
      metadata: {
        totalReviewed: this.session.entities.length,
        approved: 0,
        rejected: 0,
        edited: 0,
        manual: 0,
        reviewDuration: Date.now() - this.session.startedAt.getTime(),
      },
    };

    for (const entity of this.session.entities) {
      if (entity.status === 'approved' || entity.status === 'edited' || entity.status === 'pending') {
        // Include pending entities as approved by default
        result.entitiesToAnonymize.push({
          originalText: entity.originalText,
          replacement: entity.editedReplacement || entity.replacement,
          type: entity.type,
        });

        if (entity.status === 'approved') result.metadata.approved++;
        if (entity.status === 'edited') result.metadata.edited++;
      } else if (entity.status === 'rejected') {
        result.rejectedEntities.push({
          originalText: entity.originalText,
          type: entity.type,
        });
        result.metadata.rejected++;
      }

      if (entity.source === 'MANUAL') {
        result.metadata.manual++;
      }
    }

    this.session.reviewComplete = true;
    this.onReviewComplete?.(result);
  }

  /**
   * Update a single entity item in the DOM
   */
  private updateEntityItem(entityId: string): void {
    const entity = this.session?.entities.find(e => e.id === entityId);
    if (!entity) return;

    const itemEl = this.container?.querySelector(`[data-entity-id="${entityId}"].entity-item`) as HTMLElement;
    if (itemEl) {
      itemEl.outerHTML = this.renderEntityItem(entity);
    }
  }

  /**
   * Add a manually marked entity
   */
  addManualEntity(request: ManualMarkRequest): void {
    if (!this.session) return;

    const id = generateId();
    const replacement = `${request.type}_MANUAL_${this.session.entities.filter(e => e.source === 'MANUAL').length + 1}`;

    const entity: ReviewableEntity = {
      id,
      originalText: request.text,
      replacement,
      type: request.type,
      confidence: 1.0,
      source: 'MANUAL',
      status: 'approved',
      position: {
        start: request.start,
        end: request.end,
      },
      flaggedForReview: false,
      context: request.context,
    };

    this.session.entities.push(entity);
    this.updateEntityList();
    this.updateStats();
  }

  /**
   * Get current review result
   */
  getReviewResult(): ReviewResult | null {
    if (!this.session) return null;

    const result: ReviewResult = {
      entitiesToAnonymize: [],
      rejectedEntities: [],
      manualEntities: [],
      metadata: {
        totalReviewed: this.session.entities.length,
        approved: 0,
        rejected: 0,
        edited: 0,
        manual: 0,
        reviewDuration: Date.now() - this.session.startedAt.getTime(),
      },
    };

    for (const entity of this.session.entities) {
      if (entity.status !== 'rejected') {
        result.entitiesToAnonymize.push({
          originalText: entity.originalText,
          replacement: entity.editedReplacement || entity.replacement,
          type: entity.type,
        });

        if (entity.status === 'approved') result.metadata.approved++;
        if (entity.status === 'edited') result.metadata.edited++;
      } else {
        result.rejectedEntities.push({
          originalText: entity.originalText,
          type: entity.type,
        });
        result.metadata.rejected++;
      }

      if (entity.source === 'MANUAL') {
        result.manualEntities.push({
          text: entity.originalText,
          type: entity.type,
          replacement: entity.editedReplacement || entity.replacement,
        });
        result.metadata.manual++;
      }
    }

    return result;
  }

  /**
   * Truncate text with ellipsis
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Check if review is complete
   */
  isReviewComplete(): boolean {
    return this.session?.reviewComplete ?? false;
  }

  /**
   * Clear the review session
   */
  clear(): void {
    this.session = null;
    this.filters = { ...DEFAULT_FILTER_OPTIONS };
    this.collapsedGroups.clear();
    this.render();
  }
}

/**
 * Create EntityReviewUI instance
 */
export function createEntityReviewUI(): EntityReviewUI {
  return new EntityReviewUI();
}
