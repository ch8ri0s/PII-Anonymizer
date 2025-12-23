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
  destroyPreviewBody,
  type PreviewBodyConfig,
} from './PreviewBody';
