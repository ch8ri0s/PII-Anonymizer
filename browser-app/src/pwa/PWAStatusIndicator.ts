/**
 * PWA Status Indicator Component
 *
 * Shows current offline/online status and model caching state.
 * Displays in the header area when app is offline-ready or offline.
 *
 * Story 7.6: PWA & Deployment Readiness
 */

import {
  getOfflineState,
  getUpdateState,
  onOfflineStateChange,
  onUpdateStateChange,
  applyUpdate,
  type PWAOfflineState,
  type PWAUpdateState,
} from './PWAManager';

// Module state
let indicatorElement: HTMLElement | null = null;
let updateBannerElement: HTMLElement | null = null;
let unsubscribeOffline: (() => void) | null = null;
let unsubscribeUpdate: (() => void) | null = null;

/**
 * CSS for the status indicator
 */
const STATUS_INDICATOR_CSS = `
  .pwa-status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    transition: all 0.3s ease;
  }

  .pwa-status-indicator.offline-ready {
    background: hsl(142.1 76.2% 36.3% / 0.1);
    color: hsl(142.1 70.6% 35.3%);
  }

  .pwa-status-indicator.offline {
    background: hsl(0 84.2% 60.2% / 0.1);
    color: hsl(0 72.2% 50.6%);
  }

  .pwa-status-indicator.online {
    background: hsl(217.2 91.2% 59.8% / 0.1);
    color: hsl(217.2 91.2% 50%);
  }

  .pwa-status-indicator.model-loading {
    background: hsl(45.4 93.4% 47.5% / 0.1);
    color: hsl(37.7 92.1% 40%);
  }

  .pwa-status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
  }

  .pwa-status-dot.pulse {
    animation: pwa-status-pulse 2s ease-in-out infinite;
  }

  @keyframes pwa-status-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* Update banner */
  .pwa-update-banner {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
    background: white;
    border: 1px solid hsl(0 0% 89.8%);
    border-radius: 0.75rem;
    padding: 1rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: 320px;
    animation: pwa-update-slide-in 0.3s ease-out;
  }

  @keyframes pwa-update-slide-in {
    from {
      opacity: 0;
      transform: translateX(20px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .pwa-update-icon {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    color: hsl(217.2 91.2% 59.8%);
  }

  .pwa-update-content {
    flex: 1;
    min-width: 0;
  }

  .pwa-update-title {
    font-weight: 500;
    font-size: 0.875rem;
    color: hsl(0 0% 20%);
  }

  .pwa-update-description {
    font-size: 0.75rem;
    color: hsl(0 0% 50%);
    margin-top: 0.125rem;
  }

  .pwa-update-btn {
    flex-shrink: 0;
    padding: 0.375rem 0.75rem;
    background: hsl(217.2 91.2% 59.8%);
    color: white;
    border: none;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .pwa-update-btn:hover {
    background: hsl(217.2 91.2% 50%);
  }

  .pwa-update-close {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    background: none;
    border: none;
    color: hsl(0 0% 60%);
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pwa-update-close:hover {
    color: hsl(0 0% 40%);
  }
`;

/**
 * Inject CSS styles
 */
function injectStyles(): void {
  if (document.getElementById('pwa-status-indicator-styles')) {
    return;
  }

  const styleElement = document.createElement('style');
  styleElement.id = 'pwa-status-indicator-styles';
  styleElement.textContent = STATUS_INDICATOR_CSS;
  document.head.appendChild(styleElement);
}

/**
 * Get status class and text based on state
 */
function getStatusInfo(state: PWAOfflineState): {
  className: string;
  text: string;
  pulse: boolean;
} {
  if (!state.isOnline) {
    return {
      className: 'offline',
      text: 'Offline',
      pulse: false,
    };
  }

  if (state.isOfflineReady && state.modelCached) {
    return {
      className: 'offline-ready',
      text: 'Offline Ready',
      pulse: false,
    };
  }

  if (!state.modelCached) {
    return {
      className: 'model-loading',
      text: 'Model Required',
      pulse: true,
    };
  }

  return {
    className: 'online',
    text: 'Online',
    pulse: false,
  };
}

/**
 * Create the indicator HTML
 */
function createIndicatorHTML(state: PWAOfflineState): string {
  const { className, text, pulse } = getStatusInfo(state);

  return `
    <span class="pwa-status-indicator ${className}">
      <span class="pwa-status-dot ${pulse ? 'pulse' : ''}"></span>
      <span class="pwa-status-text">${text}</span>
    </span>
  `;
}

/**
 * Create the update banner HTML
 */
function createUpdateBannerHTML(): string {
  return `
    <div class="pwa-update-banner" role="dialog" aria-labelledby="pwa-update-title">
      <svg class="pwa-update-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      <div class="pwa-update-content">
        <div class="pwa-update-title" id="pwa-update-title">Update Available</div>
        <div class="pwa-update-description">A new version is ready to install</div>
      </div>
      <button class="pwa-update-btn" data-action="update">Update</button>
      <button class="pwa-update-close" data-action="dismiss" aria-label="Dismiss">
        <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `;
}

/**
 * Update the indicator display
 */
function updateIndicator(state: PWAOfflineState): void {
  if (!indicatorElement) return;

  const { className, text, pulse } = getStatusInfo(state);
  const dotElement = indicatorElement.querySelector('.pwa-status-dot');
  const textElement = indicatorElement.querySelector('.pwa-status-text');

  // Update classes
  indicatorElement.className = `pwa-status-indicator ${className}`;

  // Update dot pulse
  if (dotElement) {
    dotElement.className = `pwa-status-dot ${pulse ? 'pulse' : ''}`;
  }

  // Update text
  if (textElement) {
    textElement.textContent = text;
  }
}

/**
 * Show the update banner
 */
function showUpdateBanner(): void {
  if (updateBannerElement) return;

  const container = document.createElement('div');
  container.innerHTML = createUpdateBannerHTML();
  updateBannerElement = container.firstElementChild as HTMLElement;

  updateBannerElement.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action || target.closest('[data-action]')?.getAttribute('data-action');

    if (action === 'update') {
      void applyUpdate();
    } else if (action === 'dismiss') {
      updateBannerElement?.remove();
      updateBannerElement = null;
    }
  });

  document.body.appendChild(updateBannerElement);
}

/**
 * Handle offline state changes
 */
function handleOfflineStateChange(state: PWAOfflineState): void {
  updateIndicator(state);
}

/**
 * Handle update state changes
 */
function handleUpdateStateChange(state: PWAUpdateState): void {
  if (state.needsUpdate && !updateBannerElement) {
    showUpdateBanner();
  }
}

/**
 * Initialize the status indicator
 *
 * @param containerSelector CSS selector for the container to mount the indicator
 */
export function initStatusIndicator(containerSelector: string = '.review-header-left'): void {
  injectStyles();

  // Create indicator element
  const state = getOfflineState();
  const container = document.createElement('span');
  container.innerHTML = createIndicatorHTML(state);
  indicatorElement = container.firstElementChild as HTMLElement;

  // Try to find container and append
  const containerElement = document.querySelector(containerSelector);
  if (containerElement) {
    containerElement.appendChild(indicatorElement);
  } else {
    // Store for later mounting
    console.log('[PWA] Status indicator created, waiting for container');
  }

  // Subscribe to state changes
  unsubscribeOffline = onOfflineStateChange(handleOfflineStateChange);
  unsubscribeUpdate = onUpdateStateChange(handleUpdateStateChange);

  // Check for pending updates
  const updateState = getUpdateState();
  if (updateState.needsUpdate) {
    showUpdateBanner();
  }

  console.log('[PWA] Status indicator initialized');
}

/**
 * Mount the indicator to a container
 */
export function mountIndicator(container: HTMLElement): void {
  if (indicatorElement && !indicatorElement.parentElement) {
    container.appendChild(indicatorElement);
  }
}

/**
 * Get the indicator element
 */
export function getIndicatorElement(): HTMLElement | null {
  return indicatorElement;
}

/**
 * Destroy the status indicator
 */
export function destroyStatusIndicator(): void {
  if (unsubscribeOffline) {
    unsubscribeOffline();
    unsubscribeOffline = null;
  }

  if (unsubscribeUpdate) {
    unsubscribeUpdate();
    unsubscribeUpdate = null;
  }

  if (indicatorElement) {
    indicatorElement.remove();
    indicatorElement = null;
  }

  if (updateBannerElement) {
    updateBannerElement.remove();
    updateBannerElement = null;
  }
}
