/**
 * Preview Panel Component (Orchestrator)
 *
 * Thin orchestrator that coordinates preview header, body, and sidebar.
 * The heavy lifting is delegated to sub-components.
 *
 * Story 7.4: Entity Review UI Implementation - AC7
 */

import type { ExtendedPIIMatch } from '../processing/PIIDetector';
import type { EntityWithSelection, EntitySidebarCallbacks } from './EntitySidebar';
import {
  initEntitySidebar,
  updateEntities,
  getSelectedEntities,
  getAllEntities,
  clearEntities,
  addManualEntity,
  destroyEntitySidebar,
} from './EntitySidebar';
import {
  initContextMenu,
  destroyContextMenu,
  setupTextSelectionHandler,
  createTextOffsetCalculator,
  setOffsetMapperState,
} from './ContextMenu';
import { showSuccess } from './Toast';
import { initKeyboardShortcuts, destroyKeyboardShortcuts } from './KeyboardShortcuts';
import {
  setCurrentDocument,
  clearCurrentDocument,
  initializeSelectionTracking,
  handleSelectionChanges,
  handleManualMark as logManualMark,
} from '../services/FeedbackIntegration';
import {
  initPreviewHeader,
  setHeaderFile,
  setHeaderEntities,
  destroyPreviewHeader,
} from './preview/PreviewHeader';
import {
  initPreviewBody,
  setBodyContent,
  setBodyEntities,
  scrollToBodyEntity,
  getContentElement,
  getBodyEntities,
  isShowingAnonymized,
  destroyPreviewBody,
} from './preview/PreviewBody';

/**
 * Preview panel state
 */
interface PreviewPanelState {
  initialized: boolean;
  documentContent: string;
  fileName: string;
  entities: EntityWithSelection[];
  sidebarCollapsed: boolean;
}

/**
 * Preview panel configuration
 */
export interface PreviewPanelConfig {
  onAnonymize?: (selectedEntities: EntityWithSelection[]) => void;
  onEntityChange?: (entities: EntityWithSelection[]) => void;
  sidebarPosition?: 'left' | 'right';
}

// Module state
let state: PreviewPanelState = {
  initialized: false,
  documentContent: '',
  fileName: '',
  entities: [],
  sidebarCollapsed: false,
};

let config: PreviewPanelConfig = {};
let panelContainer: HTMLElement | null = null;
let sidebarElement: HTMLElement | null = null;
let collapseButton: HTMLElement | null = null;

/**
 * CSS for the preview panel layout
 */
const PREVIEW_PANEL_CSS = `
  .preview-panel {
    display: flex;
    flex-direction: row;
    height: 100%;
    min-height: 500px;
    background: hsl(0 0% 100%);
    border: 1px solid hsl(0 0% 89.8%);
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .preview-panel.sidebar-left {
    flex-direction: row-reverse;
  }

  .preview-panel-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    position: relative;
  }

  .preview-panel-sidebar {
    width: 320px;
    border-left: 1px solid hsl(0 0% 89.8%);
    overflow-y: auto;
    flex-shrink: 0;
    transition: width 0.2s ease, opacity 0.2s ease;
    background: hsl(0 0% 98%);
  }

  .preview-panel.sidebar-left .preview-panel-sidebar {
    border-left: none;
    border-right: 1px solid hsl(0 0% 89.8%);
  }

  .preview-panel-sidebar.collapsed {
    width: 0;
    opacity: 0;
    padding: 0;
    overflow: hidden;
  }

  .preview-panel-toggle {
    position: absolute;
    bottom: 1rem;
    right: 1rem;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    background: hsl(0 0% 100%);
    border: 1px solid hsl(0 0% 89.8%);
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: hsl(0 0% 45.1%);
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  }

  .preview-panel.sidebar-left .preview-panel-toggle {
    right: auto;
    left: 1rem;
  }

  .preview-panel-toggle:hover {
    background: hsl(0 0% 96.1%);
    color: hsl(0 0% 9%);
    border-color: hsl(0 0% 79.8%);
  }

  .preview-panel-toggle svg {
    width: 1rem;
    height: 1rem;
    transition: transform 0.2s ease;
  }

  .preview-panel-toggle.collapsed svg {
    transform: rotate(180deg);
  }

  @media (max-width: 768px) {
    .preview-panel {
      flex-direction: column;
    }

    .preview-panel-sidebar {
      width: 100%;
      max-height: 300px;
      border-left: none;
      border-top: 1px solid hsl(0 0% 89.8%);
    }

    .preview-panel-sidebar.collapsed {
      max-height: 0;
    }

    .preview-panel.sidebar-left .preview-panel-sidebar {
      border-right: none;
      border-bottom: 1px solid hsl(0 0% 89.8%);
    }

    .preview-panel-toggle {
      bottom: auto;
      top: 0.5rem;
    }
  }
`;

/**
 * Inject CSS styles
 */
function injectStyles(): void {
  if (!document.getElementById('preview-panel-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'preview-panel-styles';
    styleSheet.textContent = PREVIEW_PANEL_CSS;
    document.head.appendChild(styleSheet);
  }
}

/**
 * Initialize the preview panel
 */
export function initPreviewPanel(
  container: HTMLElement,
  panelConfig: PreviewPanelConfig = {},
): void {
  if (state.initialized) {
    destroyPreviewPanel();
  }

  config = panelConfig;
  panelContainer = container;
  injectStyles();

  // Create panel structure
  const sidebarPositionClass = config.sidebarPosition === 'left' ? 'sidebar-left' : '';
  container.innerHTML = `
    <div class="preview-panel ${sidebarPositionClass}">
      <div class="preview-panel-main" id="preview-main">
        <button class="preview-panel-toggle" id="sidebar-toggle" title="Toggle sidebar">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
          <span>Entities</span>
        </button>
      </div>
      <div class="preview-panel-sidebar" id="preview-sidebar">
        <div id="entity-sidebar-mount"></div>
      </div>
    </div>
  `;

  // Get references
  const mainElement = container.querySelector('#preview-main') as HTMLElement;
  sidebarElement = container.querySelector('#preview-sidebar');
  collapseButton = container.querySelector('#sidebar-toggle');
  const sidebarMount = container.querySelector('#entity-sidebar-mount') as HTMLElement;

  // Initialize sub-components
  initPreviewHeader(mainElement, {
    onCopySuccess: () => console.log('Copied to clipboard'),
    onCopyError: () => console.error('Failed to copy'),
  });

  initPreviewBody(mainElement, {
    showAnonymized: true,
    onTextSelect: handleTextSelection,
  });

  const sidebarCallbacks: EntitySidebarCallbacks = {
    onEntityClick: handleEntityClick,
    onSelectionChange: handleSelectionChange,
    onFilterChange: handleFilterChange,
    onManualMark: handleManualMark,
  };

  initEntitySidebar(sidebarMount, sidebarCallbacks);

  // Setup context menu for manual marking
  const contentElement = getContentElement();
  if (contentElement) {
    // Set offset mapper state before initializing context menu
    // This enables proper offset mapping from rendered DOM to original content
    setOffsetMapperState(getBodyEntities, isShowingAnonymized);
    initContextMenu(handleManualMark);
    setupTextSelectionHandler(contentElement, createTextOffsetCalculator(contentElement));
  }

  // Setup keyboard shortcuts (Cmd/Ctrl+M)
  initKeyboardShortcuts();

  // Setup event handlers
  collapseButton?.addEventListener('click', toggleSidebar);

  state.initialized = true;
}

/**
 * Set document content for preview
 */
export function setPreviewContent(content: string, fileName?: string): void {
  state.documentContent = content;
  state.fileName = fileName || 'document.md';

  setBodyContent(content);
  setHeaderFile(state.fileName, content);

  // Set document context for feedback logging (Story 7.8)
  setCurrentDocument(content, state.fileName);
}

/**
 * Set entities to display
 */
export function setPreviewEntities(entities: ExtendedPIIMatch[]): void {
  // Sort by position first to assign consistent numbering
  const sorted = [...entities].sort((a, b) => a.start - b.start);

  // Convert to EntityWithSelection with 1-based index
  const entitiesWithSelection: EntityWithSelection[] = sorted.map((entity, index) => ({
    ...entity,
    id: entity.id || `entity-${index}-${entity.start}-${entity.end}`,
    selected: true,
    visible: true,
    source: entity.source || 'REGEX',
    entityIndex: index + 1, // 1-based index for display
  }));

  state.entities = entitiesWithSelection;

  // Update all sub-components with indexed entities
  updateEntities(entitiesWithSelection);
  setBodyEntities(entitiesWithSelection);
  setHeaderEntities(entitiesWithSelection);

  // Initialize selection tracking for feedback logging (Story 7.8)
  initializeSelectionTracking(entitiesWithSelection);
}

/**
 * Handle entity click in sidebar
 */
function handleEntityClick(entity: EntityWithSelection): void {
  scrollToBodyEntity(entity.id);
}

/**
 * Handle selection change
 */
function handleSelectionChange(entities: EntityWithSelection[]): void {
  state.entities = entities;

  // Update sub-components
  setBodyEntities(entities);
  setHeaderEntities(entities);

  // Log selection changes for feedback (Story 7.8 - AC1, AC3)
  void handleSelectionChanges(entities);

  // Notify parent
  config.onEntityChange?.(entities);
}

/**
 * Handle filter change
 */
function handleFilterChange(visibleTypes: Set<string>): void {
  state.entities = state.entities.map(entity => ({
    ...entity,
    visible: visibleTypes.has(entity.type),
  }));

  setBodyEntities(state.entities);
}

/**
 * Handle manual PII marking
 */
function handleManualMark(
  text: string,
  type: string,
  start: number,
  end: number,
): void {
  addManualEntity(text, type, start, end);
  state.entities = getAllEntities();

  setBodyEntities(state.entities);
  setHeaderEntities(state.entities);

  // Log manual marking for feedback (Story 7.8 - AC1, AC2)
  void logManualMark(text, type, start, end);

  // Show success toast notification (AC6)
  const truncatedText = text.length > 30 ? text.substring(0, 30) + '...' : text;
  showSuccess(`Marked "${truncatedText}" as ${type}`);

  config.onEntityChange?.(state.entities);
}

/**
 * Handle text selection for manual marking
 */
function handleTextSelection(text: string, start: number, end: number): void {
  // This will be handled by the context menu
  console.log('Text selected:', text, start, end);
}

/**
 * Toggle sidebar visibility
 */
function toggleSidebar(): void {
  state.sidebarCollapsed = !state.sidebarCollapsed;

  if (sidebarElement) {
    sidebarElement.classList.toggle('collapsed', state.sidebarCollapsed);
  }

  if (collapseButton) {
    collapseButton.classList.toggle('collapsed', state.sidebarCollapsed);
  }
}

/**
 * Get currently selected entities
 */
export function getPreviewSelectedEntities(): EntityWithSelection[] {
  return getSelectedEntities();
}

/**
 * Get all entities
 */
export function getPreviewAllEntities(): EntityWithSelection[] {
  return getAllEntities();
}

/**
 * Clear all entities
 */
export function clearPreviewEntities(): void {
  clearEntities();
  setBodyEntities([]);
  setHeaderEntities([]);
  state.entities = [];

  // Clear document context for feedback logging (Story 7.8)
  clearCurrentDocument();
}

/**
 * Collapse the sidebar
 */
export function collapseSidebar(): void {
  if (!state.sidebarCollapsed) {
    toggleSidebar();
  }
}

/**
 * Expand the sidebar
 */
export function expandSidebar(): void {
  if (state.sidebarCollapsed) {
    toggleSidebar();
  }
}

/**
 * Check if sidebar is collapsed
 */
export function isSidebarCollapsed(): boolean {
  return state.sidebarCollapsed;
}

/**
 * Destroy the preview panel and clean up
 */
export function destroyPreviewPanel(): void {
  destroyPreviewHeader();
  destroyPreviewBody();
  destroyEntitySidebar();
  destroyContextMenu();
  destroyKeyboardShortcuts();

  // Clear document context for feedback logging (Story 7.8)
  clearCurrentDocument();

  if (panelContainer) {
    panelContainer.innerHTML = '';
  }

  // Reset state
  state = {
    initialized: false,
    documentContent: '',
    fileName: '',
    entities: [],
    sidebarCollapsed: false,
  };

  config = {};
  panelContainer = null;
  sidebarElement = null;
  collapseButton = null;
}
