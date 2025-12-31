/**
 * Preview Module Exports
 *
 * Centralized exports for preview panel components.
 */

export {
  applyAnonymization,
  generateMappingMarkdown,
  copyToClipboard,
  getReplacementToken,
  resetAnonymizationSession,
  getAnonymizationSession,
  AnonymizationSession,
} from './AnonymizationEngine';

export {
  initPreviewHeader,
  setHeaderFile,
  setHeaderEntities,
  getAnonymizedContent,
  destroyPreviewHeader,
  type PreviewHeaderConfig,
} from './PreviewHeader';

export {
  initPreviewBody,
  setBodyContent,
  setBodyEntities,
  toggleAnonymizedView,
  scrollToBodyEntity,
  getContentElement,
  isShowingAnonymized,
  getOriginalContent,
  getBodyEntities,
  destroyPreviewBody,
  type PreviewBodyConfig,
} from './PreviewBody';
