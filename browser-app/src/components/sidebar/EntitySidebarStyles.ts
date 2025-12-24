/**
 * Entity Sidebar Styles
 *
 * CSS styles for the entity sidebar component.
 * Extracted from EntitySidebar.ts for better modularity.
 */

/**
 * CSS for the entity sidebar
 */
export const ENTITY_SIDEBAR_CSS = `
  .entity-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: hsl(0 0% 100%);
  }

  .entity-sidebar-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 1rem;
    border-bottom: 1px solid hsl(0 0% 89.8%);
  }

  .entity-sidebar-header-content {
    flex: 1;
    min-width: 0;
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

  .entity-sidebar-collapse-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 0.375rem;
    color: hsl(0 0% 45.1%);
    cursor: pointer;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }

  .entity-sidebar-collapse-btn:hover {
    background: hsl(0 0% 96.1%);
    border-color: hsl(0 0% 89.8%);
    color: hsl(0 0% 9%);
  }

  .entity-sidebar-collapse-btn svg {
    width: 1rem;
    height: 1rem;
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
 * Detection source display configuration
 */
export const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  ML: { label: 'ML', color: 'hsl(263.4 70% 50.4%)' },
  REGEX: { label: 'Rule', color: 'hsl(217.2 91.2% 59.8%)' },
  RULE: { label: 'Rule', color: 'hsl(217.2 91.2% 59.8%)' },
  BOTH: { label: 'ML+Rule', color: 'hsl(142.1 76.2% 36.3%)' },
  MANUAL: { label: 'Manual', color: 'hsl(24.6 95% 53.1%)' },
};

/**
 * Inject CSS styles into the document
 */
export function injectSidebarStyles(): void {
  if (!document.getElementById('entity-sidebar-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'entity-sidebar-styles';
    styleSheet.textContent = ENTITY_SIDEBAR_CSS;
    document.head.appendChild(styleSheet);
  }
}
