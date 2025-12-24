/**
 * Preview Body Component
 *
 * Displays document content with entity highlights.
 * Shows anonymized content in real-time as entities are selected/deselected.
 */

import type { EntityWithSelection } from '../EntitySidebar';
import { getReplacementToken } from './AnonymizationEngine';

/**
 * Preview body configuration
 */
export interface PreviewBodyConfig {
  showAnonymized?: boolean;
  onTextSelect?: (text: string, start: number, end: number) => void;
}

/**
 * Preview body state
 */
interface PreviewBodyState {
  originalContent: string;
  entities: EntityWithSelection[];
  showAnonymized: boolean;
}

// Module state
let state: PreviewBodyState = {
  originalContent: '',
  entities: [],
  showAnonymized: true,
};

let config: PreviewBodyConfig = {};
let bodyElement: HTMLElement | null = null;
let contentElement: HTMLElement | null = null;

/**
 * CSS for the preview body
 */
const PREVIEW_BODY_CSS = `
  .preview-body {
    flex: 1;
    overflow: auto;
    background: hsl(0 0% 100%);
  }

  .preview-body-content {
    padding: 1.5rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.875rem;
    line-height: 1.7;
    color: hsl(0 0% 9%);
    white-space: pre-wrap;
    word-wrap: break-word;
  }

  .preview-body-content .entity-highlight {
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: background-color 0.15s, opacity 0.15s;
  }

  .preview-body-content .entity-highlight.selected {
    background: hsl(217.2 91.2% 59.8% / 0.2);
    border-bottom: 2px solid hsl(217.2 91.2% 59.8%);
  }

  .preview-body-content .entity-highlight.unselected {
    background: hsl(0 0% 89.8% / 0.3);
    text-decoration: line-through;
    opacity: 0.6;
  }

  .preview-body-content .entity-replacement {
    display: inline;
    padding: 0.125rem 0.375rem;
    background: hsl(222.2 47.4% 11.2%);
    color: hsl(0 0% 98%);
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.025em;
  }

  .preview-body-content .entity-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.125rem;
    height: 1.125rem;
    padding: 0 0.1875rem;
    margin-right: 0.125rem;
    background: hsl(222.2 47.4% 11.2%);
    color: hsl(0 0% 98%);
    border-radius: 0.1875rem;
    font-size: 0.625rem;
    font-weight: 700;
    vertical-align: baseline;
  }

  .preview-body-content .entity-highlight .entity-number {
    background: hsl(217.2 91.2% 45%);
  }

  .preview-body-content .entity-highlight.unselected .entity-number {
    background: hsl(0 0% 60%);
  }

  .preview-body-content .entity-highlight:hover {
    filter: brightness(0.95);
  }

  .preview-body-content .entity-highlight.pulse {
    animation: entity-pulse 0.5s ease-out;
  }

  @keyframes entity-pulse {
    0% { transform: scale(1); box-shadow: 0 0 0 0 hsl(217.2 91.2% 59.8% / 0.4); }
    50% { transform: scale(1.02); box-shadow: 0 0 0 4px hsl(217.2 91.2% 59.8% / 0.2); }
    100% { transform: scale(1); box-shadow: 0 0 0 0 hsl(217.2 91.2% 59.8% / 0); }
  }

  .preview-body-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: hsl(0 0% 45.1%);
    font-size: 0.875rem;
  }

  .preview-body-empty svg {
    width: 3rem;
    height: 3rem;
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .preview-body-toggle {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    background: hsl(0 0% 100%);
    border: 1px solid hsl(0 0% 89.8%);
    border-radius: 0.375rem;
    font-size: 0.75rem;
    color: hsl(0 0% 45.1%);
    cursor: pointer;
    transition: all 0.15s;
    z-index: 10;
  }

  .preview-body-toggle:hover {
    background: hsl(0 0% 96.1%);
    color: hsl(0 0% 9%);
  }

  .preview-body-toggle .toggle-switch {
    position: relative;
    width: 2rem;
    height: 1rem;
    background: hsl(0 0% 89.8%);
    border-radius: 0.5rem;
    transition: background-color 0.15s;
  }

  .preview-body-toggle.active .toggle-switch {
    background: hsl(222.2 47.4% 51.2%);
  }

  .preview-body-toggle .toggle-switch::after {
    content: '';
    position: absolute;
    top: 0.125rem;
    left: 0.125rem;
    width: 0.75rem;
    height: 0.75rem;
    background: white;
    border-radius: 50%;
    transition: transform 0.15s;
  }

  .preview-body-toggle.active .toggle-switch::after {
    transform: translateX(1rem);
  }
`;

/**
 * Inject CSS styles
 */
function injectStyles(): void {
  if (!document.getElementById('preview-body-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'preview-body-styles';
    styleSheet.textContent = PREVIEW_BODY_CSS;
    document.head.appendChild(styleSheet);
  }
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
 * Initialize the preview body
 */
export function initPreviewBody(
  container: HTMLElement,
  bodyConfig: PreviewBodyConfig = {},
): void {
  config = bodyConfig;
  state.showAnonymized = bodyConfig.showAnonymized ?? true;
  injectStyles();

  // Create body element
  bodyElement = document.createElement('div');
  bodyElement.className = 'preview-body';
  bodyElement.innerHTML = `
    <div class="preview-body-content" id="preview-body-content"></div>
  `;

  container.appendChild(bodyElement);

  contentElement = bodyElement.querySelector('#preview-body-content');

  // Setup text selection handler
  if (contentElement && config.onTextSelect) {
    contentElement.addEventListener('mouseup', handleTextSelection);
  }
}

/**
 * Handle text selection for manual marking
 */
function handleTextSelection(): void {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const text = selection.toString().trim();
  if (!text) return;

  // Calculate offset within original content
  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();

  if (contentElement) {
    preCaretRange.selectNodeContents(contentElement);
    preCaretRange.setEnd(range.startContainer, range.startOffset);

    // This is a simplified calculation - actual implementation
    // would need to account for HTML markup in the content
    const start = preCaretRange.toString().length;
    const end = start + text.length;

    config.onTextSelect?.(text, start, end);
  }
}

/**
 * Set content to display
 */
export function setBodyContent(content: string): void {
  state.originalContent = content;
  renderContent();
}

/**
 * Set entities and re-render
 */
export function setBodyEntities(entities: EntityWithSelection[]): void {
  state.entities = entities;
  renderContent();
}

/**
 * Toggle between original and anonymized view
 */
export function toggleAnonymizedView(show?: boolean): void {
  state.showAnonymized = show ?? !state.showAnonymized;
  renderContent();
}

/**
 * Render content with highlights
 */
function renderContent(): void {
  if (!contentElement) return;

  if (!state.originalContent) {
    contentElement.innerHTML = `
      <div class="preview-body-empty">
        <div>
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p>No document loaded</p>
        </div>
      </div>
    `;
    return;
  }

  if (state.showAnonymized) {
    renderAnonymizedContent();
  } else {
    renderOriginalWithHighlights();
  }
}

/**
 * Render content with inline replacement tokens for selected entities
 */
function renderAnonymizedContent(): void {
  if (!contentElement) return;

  // Sort entities by position
  const sortedEntities = [...state.entities].sort((a, b) => a.start - b.start);

  let result = '';
  let lastEnd = 0;

  for (const entity of sortedEntities) {
    // Add text before this entity
    if (entity.start > lastEnd) {
      result += escapeHtml(state.originalContent.slice(lastEnd, entity.start));
    }

    const entityNum = entity.entityIndex ?? 0;
    const numberBadge = `<span class="entity-number">${entityNum}</span>`;

    // Add entity (either replacement token or highlighted original)
    if (entity.selected) {
      const token = getReplacementToken(entity.type);
      result += `<span class="entity-replacement" data-entity-id="${entity.id}" data-entity-index="${entityNum}" title="${escapeHtml(entity.text)}">${numberBadge}${token}</span>`;
    } else {
      result += `<span class="entity-highlight unselected" data-entity-id="${entity.id}" data-entity-index="${entityNum}">${numberBadge}${escapeHtml(entity.text)}</span>`;
    }

    lastEnd = entity.end;
  }

  // Add remaining text
  if (lastEnd < state.originalContent.length) {
    result += escapeHtml(state.originalContent.slice(lastEnd));
  }

  contentElement.innerHTML = result;
}

/**
 * Render original content with highlight overlays
 */
function renderOriginalWithHighlights(): void {
  if (!contentElement) return;

  // Sort entities by position
  const sortedEntities = [...state.entities].sort((a, b) => a.start - b.start);

  let result = '';
  let lastEnd = 0;

  for (const entity of sortedEntities) {
    // Add text before this entity
    if (entity.start > lastEnd) {
      result += escapeHtml(state.originalContent.slice(lastEnd, entity.start));
    }

    const entityNum = entity.entityIndex ?? 0;
    const numberBadge = `<span class="entity-number">${entityNum}</span>`;

    // Add highlighted entity
    const selectedClass = entity.selected ? 'selected' : 'unselected';
    result += `<span class="entity-highlight ${selectedClass}" data-entity-id="${entity.id}" data-entity-index="${entityNum}">${numberBadge}${escapeHtml(entity.text)}</span>`;

    lastEnd = entity.end;
  }

  // Add remaining text
  if (lastEnd < state.originalContent.length) {
    result += escapeHtml(state.originalContent.slice(lastEnd));
  }

  contentElement.innerHTML = result;
}

/**
 * Scroll to a specific entity
 */
export function scrollToBodyEntity(entityId: string): void {
  if (!contentElement) return;

  const element = contentElement.querySelector(`[data-entity-id="${entityId}"]`);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Add pulse animation
    element.classList.add('pulse');
    setTimeout(() => element.classList.remove('pulse'), 500);
  }
}

/**
 * Get content element for external use
 */
export function getContentElement(): HTMLElement | null {
  return contentElement;
}

/**
 * Get whether showing anonymized view
 */
export function isShowingAnonymized(): boolean {
  return state.showAnonymized;
}

/**
 * Get original document content
 */
export function getOriginalContent(): string {
  return state.originalContent;
}

/**
 * Get current entities for offset mapping
 */
export function getBodyEntities(): EntityWithSelection[] {
  return [...state.entities];
}

/**
 * Destroy the preview body
 */
export function destroyPreviewBody(): void {
  if (contentElement) {
    contentElement.removeEventListener('mouseup', handleTextSelection);
  }

  if (bodyElement) {
    bodyElement.remove();
    bodyElement = null;
  }

  contentElement = null;

  state = {
    originalContent: '',
    entities: [],
    showAnonymized: true,
  };

  config = {};
}
