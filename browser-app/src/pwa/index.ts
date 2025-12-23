/**
 * PWA Module Exports
 *
 * Progressive Web App functionality for the PII Anonymizer browser app.
 *
 * Story 7.6: PWA & Deployment Readiness
 */

// Core PWA Manager
export {
  initPWAManager,
  destroyPWAManager,
  promptInstall,
  applyUpdate,
  requestPersistentStorage,
  getStorageEstimate,
  setModelCached,
  getInstallState,
  getOfflineState,
  getUpdateState,
  onInstallStateChange,
  onOfflineStateChange,
  onUpdateStateChange,
  isIOS,
  getIOSInstallInstructions,
  type PWAInstallState,
  type PWAOfflineState,
  type PWAUpdateState,
  type InstallStateCallback,
  type OfflineStateCallback,
  type UpdateStateCallback,
} from './PWAManager';

// UI Components
export {
  initInstallBanner,
  destroyInstallBanner,
  notifyFileProcessed,
} from './PWAInstallBanner';

export {
  initStatusIndicator,
  destroyStatusIndicator,
  mountIndicator,
  getIndicatorElement,
} from './PWAStatusIndicator';
