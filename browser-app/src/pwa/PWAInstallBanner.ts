/**
 * PWA Install Banner Component
 *
 * Shows an install prompt after user has successfully processed a file.
 * Detects iOS and shows manual instructions since Safari lacks beforeinstallprompt.
 *
 * Story 7.6: PWA & Deployment Readiness
 */

import {
  getInstallState,
  onInstallStateChange,
  promptInstall,
  isIOS,
  type PWAInstallState,
} from './PWAManager';

// Module state
let bannerElement: HTMLElement | null = null;
let unsubscribe: (() => void) | null = null;
let hasProcessedFile = false;

/**
 * CSS for the install banner
 */
const INSTALL_BANNER_CSS = `
  .pwa-install-banner {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    background: linear-gradient(135deg, hsl(217.2 91.2% 59.8%) 0%, hsl(263.4 70% 50.4%) 100%);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 0.75rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    gap: 1rem;
    max-width: calc(100vw - 2rem);
    animation: pwa-banner-slide-up 0.3s ease-out;
  }

  @keyframes pwa-banner-slide-up {
    from {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
  }

  .pwa-install-banner.hiding {
    animation: pwa-banner-slide-down 0.3s ease-in forwards;
  }

  @keyframes pwa-banner-slide-down {
    from {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }
    to {
      opacity: 0;
      transform: translateX(-50%) translateY(20px);
    }
  }

  .pwa-install-icon {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
  }

  .pwa-install-content {
    flex: 1;
    min-width: 0;
  }

  .pwa-install-title {
    font-weight: 600;
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }

  .pwa-install-description {
    font-size: 0.875rem;
    opacity: 0.9;
    line-height: 1.4;
  }

  .pwa-install-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .pwa-install-btn {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
    border: none;
  }

  .pwa-install-btn-primary {
    background: white;
    color: hsl(217.2 91.2% 45%);
  }

  .pwa-install-btn-primary:hover {
    background: hsl(0 0% 95%);
  }

  .pwa-install-btn-dismiss {
    background: transparent;
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
  }

  .pwa-install-btn-dismiss:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  /* iOS instructions modal */
  .pwa-ios-instructions {
    position: fixed;
    inset: 0;
    z-index: 1001;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .pwa-ios-modal {
    background: white;
    border-radius: 1rem;
    padding: 1.5rem;
    max-width: 400px;
    width: 100%;
    text-align: center;
  }

  .pwa-ios-modal h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: hsl(0 0% 20%);
    margin-bottom: 1rem;
  }

  .pwa-ios-steps {
    text-align: left;
    margin: 1rem 0;
  }

  .pwa-ios-step {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    color: hsl(0 0% 40%);
  }

  .pwa-ios-step-num {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    background: hsl(217.2 91.2% 59.8%);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .pwa-ios-close {
    margin-top: 1rem;
    padding: 0.75rem 2rem;
    background: hsl(217.2 91.2% 59.8%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
  }

  .pwa-ios-close:hover {
    background: hsl(217.2 91.2% 50%);
  }

  @media (max-width: 480px) {
    .pwa-install-banner {
      flex-direction: column;
      text-align: center;
      bottom: 0;
      left: 0;
      right: 0;
      transform: none;
      border-radius: 0.75rem 0.75rem 0 0;
      max-width: none;
    }

    .pwa-install-actions {
      width: 100%;
      justify-content: center;
    }
  }
`;

/**
 * Inject CSS styles
 */
function injectStyles(): void {
  if (document.getElementById('pwa-install-banner-styles')) {
    return;
  }

  const styleElement = document.createElement('style');
  styleElement.id = 'pwa-install-banner-styles';
  styleElement.textContent = INSTALL_BANNER_CSS;
  document.head.appendChild(styleElement);
}

/**
 * Create the banner HTML
 */
function createBannerHTML(): string {
  return `
    <div class="pwa-install-banner" role="dialog" aria-labelledby="pwa-install-title">
      <img src="./icons/icon.svg" alt="" class="pwa-install-icon" aria-hidden="true">
      <div class="pwa-install-content">
        <div class="pwa-install-title" id="pwa-install-title">Install PII Anonymizer</div>
        <div class="pwa-install-description">
          Add to your home screen for quick access and offline use
        </div>
      </div>
      <div class="pwa-install-actions">
        <button class="pwa-install-btn pwa-install-btn-primary" data-action="install">
          Install
        </button>
        <button class="pwa-install-btn pwa-install-btn-dismiss" data-action="dismiss" aria-label="Dismiss">
          Later
        </button>
      </div>
    </div>
  `;
}

/**
 * Create iOS instructions modal HTML
 */
function createIOSInstructionsHTML(): string {
  return `
    <div class="pwa-ios-instructions" role="dialog" aria-labelledby="ios-install-title">
      <div class="pwa-ios-modal">
        <h3 id="ios-install-title">Install PII Anonymizer</h3>
        <p style="color: hsl(0 0% 50%); margin-bottom: 1rem;">
          Add this app to your home screen for quick access
        </p>
        <div class="pwa-ios-steps">
          <div class="pwa-ios-step">
            <span class="pwa-ios-step-num">1</span>
            <span>Tap the <strong>Share</strong> button (box with arrow) at the bottom of Safari</span>
          </div>
          <div class="pwa-ios-step">
            <span class="pwa-ios-step-num">2</span>
            <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
          </div>
          <div class="pwa-ios-step">
            <span class="pwa-ios-step-num">3</span>
            <span>Tap <strong>Add</strong> in the top right corner</span>
          </div>
        </div>
        <button class="pwa-ios-close" data-action="close-ios">Got it!</button>
      </div>
    </div>
  `;
}

/**
 * Handle install button click
 */
async function handleInstallClick(): Promise<void> {
  if (isIOS()) {
    showIOSInstructions();
  } else {
    const accepted = await promptInstall();
    if (accepted) {
      hideBanner();
    }
  }
}

/**
 * Show iOS installation instructions
 */
function showIOSInstructions(): void {
  const modal = document.createElement('div');
  modal.innerHTML = createIOSInstructionsHTML();
  const modalElement = modal.firstElementChild as HTMLElement;

  modalElement.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset.action === 'close-ios' || target === modalElement) {
      modalElement.remove();
    }
  });

  document.body.appendChild(modalElement);
  hideBanner();
}

/**
 * Hide the banner with animation
 */
function hideBanner(): void {
  if (!bannerElement) return;

  bannerElement.classList.add('hiding');
  setTimeout(() => {
    bannerElement?.remove();
    bannerElement = null;
  }, 300);

  // Remember user dismissed
  try {
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Check if banner should be shown
 */
function shouldShowBanner(state: PWAInstallState): boolean {
  // Don't show if already installed
  if (state.isInstalled) return false;

  // Don't show if not installable (and not iOS)
  if (!state.isInstallable && state.platform !== 'ios') return false;

  // Don't show if user hasn't processed a file yet
  if (!hasProcessedFile) return false;

  // Don't show if recently dismissed (within 7 days)
  try {
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < sevenDays) {
        return false;
      }
    }
  } catch {
    // Ignore localStorage errors
  }

  return true;
}

/**
 * Show the install banner
 */
function showBanner(): void {
  if (bannerElement) return;

  injectStyles();

  const container = document.createElement('div');
  container.innerHTML = createBannerHTML();
  bannerElement = container.firstElementChild as HTMLElement;

  // Event delegation
  bannerElement.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const action = target.dataset.action;

    if (action === 'install') {
      void handleInstallClick();
    } else if (action === 'dismiss') {
      hideBanner();
    }
  });

  document.body.appendChild(bannerElement);
}

/**
 * Handle install state changes
 */
function handleStateChange(state: PWAInstallState): void {
  if (shouldShowBanner(state)) {
    showBanner();
  } else if (bannerElement && state.isInstalled) {
    hideBanner();
  }
}

/**
 * Initialize the install banner
 */
export function initInstallBanner(): void {
  // Subscribe to state changes
  unsubscribe = onInstallStateChange(handleStateChange);

  // Check initial state
  const state = getInstallState();
  if (shouldShowBanner(state)) {
    showBanner();
  }

  console.log('[PWA] Install banner initialized');
}

/**
 * Destroy the install banner
 */
export function destroyInstallBanner(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  if (bannerElement) {
    bannerElement.remove();
    bannerElement = null;
  }
}

/**
 * Notify that user has processed a file (trigger for showing banner)
 */
export function notifyFileProcessed(): void {
  hasProcessedFile = true;

  // Check if we should show the banner now
  const state = getInstallState();
  if (shouldShowBanner(state)) {
    // Delay slightly so user can see their result first
    setTimeout(() => {
      const currentState = getInstallState();
      if (shouldShowBanner(currentState)) {
        showBanner();
      }
    }, 2000);
  }
}
