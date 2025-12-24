/**
 * Entity Sidebar Sub-modules
 *
 * Re-exports for sidebar components.
 */

export {
  type EntityTypeConfig,
  ENTITY_TYPE_CONFIG,
  normalizeType,
  getTypeConfig,
  getConfidenceLevel,
  formatConfidence,
  escapeHtml,
} from './EntityTypeConfig';

export { EntityFilterManager } from './EntityFilters';

export {
  renderEmpty,
  renderGroup,
  renderEntity,
  groupByType,
} from './EntityRenderer';

export {
  type EntityWithSelection,
  type StateChangeCallback,
  EntityStateManager,
} from './EntityStateManager';

export {
  ENTITY_SIDEBAR_CSS,
  SOURCE_CONFIG,
  injectSidebarStyles,
} from './EntitySidebarStyles';
