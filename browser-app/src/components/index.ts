/**
 * Browser App UI Components
 *
 * Exports all UI components for the browser-based PII anonymizer.
 */

export {
  initEntitySidebar,
  updateEntities,
  getSelectedEntities as getSidebarSelectedEntities,
  getAllEntities as getSidebarAllEntities,
  clearEntities,
  addManualEntity,
  destroyEntitySidebar,
  type EntityWithSelection,
  type EntitySidebarCallbacks,
} from './EntitySidebar';

export {
  initContextMenu,
  showContextMenu,
  hideContextMenu,
  isContextMenuVisible,
  destroyContextMenu,
  setupTextSelectionHandler,
  createTextOffsetCalculator,
  getPendingSelection,
  getEntityTypes,
  type OnMarkCallback,
} from './ContextMenu';

export {
  initEntityHighlight,
  renderHighlights,
  scrollToEntity,
  applyPulseAnimation,
  updateHighlight,
  clearHighlights,
  getHighlightElement,
  destroyEntityHighlight,
} from './EntityHighlight';

export {
  initPreviewPanel,
  setPreviewContent,
  setPreviewEntities,
  getPreviewSelectedEntities,
  getPreviewAllEntities,
  clearPreviewEntities,
  collapseSidebar,
  expandSidebar,
  isSidebarCollapsed,
  destroyPreviewPanel,
  type PreviewPanelConfig,
} from './PreviewPanel';

export {
  initEntityReviewController,
  loadDocument,
  detectBasic,
  getReviewState,
  getDetectionStats,
  clearReview,
  isDetecting,
  isAnonymizing,
  setAnonymizationComplete,
  getDetector,
  initializeWorker,
  terminateWorker,
  isWorkerReady,
  destroyEntityReviewController,
  type ReviewState,
  type ReviewCallbacks,
} from './EntityReviewController';

export {
  initBatchPanel,
  updateBatchPanel,
  updateBatchItem,
  setBatchProgress,
  getBatchPanelItems,
  isBatchPanelInitialized,
  destroyBatchPanel,
  type BatchPanelConfig,
} from './BatchPanel';

export {
  initBatchController,
  addFilesToBatch,
  startBatchProcessing,
  cancelBatchProcessing,
  retryFile,
  retryAllFailed,
  removeFile,
  clearQueue,
  downloadSingleFile,
  downloadAllAsZip,
  getBatchState,
  getCompletedItems,
  getFailedItems,
  isBatchProcessing,
  hasBatchFailures,
  downloadWithSelectedEntities,
  destroyBatchController,
  type BatchControllerConfig,
} from './BatchController';

// Preview sub-components
export {
  applyAnonymization,
  generateMappingMarkdown,
  copyToClipboard,
  getReplacementToken,
} from './preview/AnonymizationEngine';

export {
  initPreviewHeader,
  setHeaderFile,
  setHeaderEntities,
  getAnonymizedContent,
  destroyPreviewHeader,
  type PreviewHeaderConfig,
} from './preview/PreviewHeader';

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
} from './preview/PreviewBody';

export {
  showToast,
  showSuccess,
  showError,
  showInfo,
  dismissToast,
  dismissAllToasts,
  getToastCount,
  destroyToasts,
  type ToastType,
  type ToastOptions,
} from './Toast';

export {
  initKeyboardShortcuts,
  destroyKeyboardShortcuts,
  isKeyboardShortcutsInitialized,
} from './KeyboardShortcuts';

// Feedback logging settings panel (Story 7.8)
export {
  initFeedbackSettingsPanel,
  updateFeedbackSettingsPanel,
  destroyFeedbackSettingsPanel,
  createCompactFeedbackToggle,
} from './FeedbackSettingsPanel';
