/**
 * PWA Manager
 *
 * Handles Progressive Web App functionality:
 * - Service worker registration and updates
 * - Install prompt handling
 * - Offline/online status detection
 * - Storage persistence requests
 *
 * Story 7.6: PWA & Deployment Readiness
 */

import { registerSW } from 'virtual:pwa-register';

/** BeforeInstallPromptEvent interface (not in standard TypeScript DOM lib) */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

/** PWA installation state */
export interface PWAInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  platform: 'android' | 'ios' | 'desktop' | 'unknown';
}

/** PWA offline state */
export interface PWAOfflineState {
  isOnline: boolean;
  isOfflineReady: boolean;
  modelCached: boolean;
}

/** PWA update state */
export interface PWAUpdateState {
  needsUpdate: boolean;
  updateReady: boolean;
}

/** Callback types */
export type InstallStateCallback = (state: PWAInstallState) => void;
export type OfflineStateCallback = (state: PWAOfflineState) => void;
export type UpdateStateCallback = (state: PWAUpdateState) => void;

// Module state
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
let installState: PWAInstallState = {
  isInstallable: false,
  isInstalled: false,
  platform: 'unknown',
};
let offlineState: PWAOfflineState = {
  isOnline: navigator.onLine,
  isOfflineReady: false,
  modelCached: false,
};
let updateState: PWAUpdateState = {
  needsUpdate: false,
  updateReady: false,
};

// Callbacks
let installStateCallbacks: InstallStateCallback[] = [];
let offlineStateCallbacks: OfflineStateCallback[] = [];
let updateStateCallbacks: UpdateStateCallback[] = [];

// Update function from service worker registration
let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;

/**
 * Detect platform for install instructions
 */
function detectPlatform(): 'android' | 'ios' | 'desktop' | 'unknown' {
  const ua = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(ua)) {
    return 'ios';
  }
  if (/android/.test(ua)) {
    return 'android';
  }
  if (/windows|macintosh|linux/.test(ua) && !/mobile/.test(ua)) {
    return 'desktop';
  }
  return 'unknown';
}

/**
 * Check if app is running in standalone mode (installed PWA)
 */
function isRunningStandalone(): boolean {
  // Check display-mode media query
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  // iOS Safari standalone mode
  if ((navigator as { standalone?: boolean }).standalone === true) {
    return true;
  }
  // Check if opened from home screen (Android)
  if (document.referrer.includes('android-app://')) {
    return true;
  }
  return false;
}

/**
 * Notify install state listeners
 */
function notifyInstallStateChange(): void {
  installStateCallbacks.forEach((cb) => cb({ ...installState }));
}

/**
 * Notify offline state listeners
 */
function notifyOfflineStateChange(): void {
  offlineStateCallbacks.forEach((cb) => cb({ ...offlineState }));
}

/**
 * Notify update state listeners
 */
function notifyUpdateStateChange(): void {
  updateStateCallbacks.forEach((cb) => cb({ ...updateState }));
}

/**
 * Handle beforeinstallprompt event
 */
function handleBeforeInstallPrompt(event: Event): void {
  // Prevent the mini-infobar from appearing on mobile
  event.preventDefault();

  // Store the event for later use
  deferredInstallPrompt = event as BeforeInstallPromptEvent;

  // Update state
  installState.isInstallable = true;
  notifyInstallStateChange();

  console.log('[PWA] Install prompt available');
}

/**
 * Handle appinstalled event
 */
function handleAppInstalled(): void {
  // Clear the deferred prompt
  deferredInstallPrompt = null;

  // Update state
  installState.isInstallable = false;
  installState.isInstalled = true;
  notifyInstallStateChange();

  console.log('[PWA] App installed successfully');
}

/**
 * Handle online/offline events
 */
function handleOnlineStatusChange(): void {
  offlineState.isOnline = navigator.onLine;
  notifyOfflineStateChange();

  console.log(`[PWA] Network status: ${offlineState.isOnline ? 'online' : 'offline'}`);
}

/**
 * Initialize PWA Manager
 */
export function initPWAManager(): void {
  // Detect platform
  installState.platform = detectPlatform();
  installState.isInstalled = isRunningStandalone();

  // Listen for install prompt
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

  // Listen for app installed
  window.addEventListener('appinstalled', handleAppInstalled);

  // Listen for online/offline events
  window.addEventListener('online', handleOnlineStatusChange);
  window.addEventListener('offline', handleOnlineStatusChange);

  // Register service worker with vite-plugin-pwa
  try {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        updateState.needsUpdate = true;
        notifyUpdateStateChange();
        console.log('[PWA] New content available, refresh needed');
      },
      onOfflineReady() {
        offlineState.isOfflineReady = true;
        notifyOfflineStateChange();
        console.log('[PWA] App ready to work offline');
      },
      onRegistered(registration) {
        console.log('[PWA] Service worker registered', registration);
      },
      onRegisterError(error) {
        console.error('[PWA] Service worker registration failed:', error);
      },
    });
  } catch (error) {
    console.warn('[PWA] Service worker registration skipped:', error);
  }

  console.log('[PWA] Manager initialized', {
    platform: installState.platform,
    isInstalled: installState.isInstalled,
    isOnline: offlineState.isOnline,
  });
}

/**
 * Destroy PWA Manager (cleanup)
 */
export function destroyPWAManager(): void {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.removeEventListener('appinstalled', handleAppInstalled);
  window.removeEventListener('online', handleOnlineStatusChange);
  window.removeEventListener('offline', handleOnlineStatusChange);

  // Clear callbacks
  installStateCallbacks = [];
  offlineStateCallbacks = [];
  updateStateCallbacks = [];

  console.log('[PWA] Manager destroyed');
}

/**
 * Trigger the install prompt
 * Should only be called after user interaction (e.g., button click)
 *
 * @returns Promise resolving to true if user accepted, false if dismissed
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) {
    console.warn('[PWA] No install prompt available');
    return false;
  }

  // Show the install prompt
  await deferredInstallPrompt.prompt();

  // Wait for user choice
  const { outcome } = await deferredInstallPrompt.userChoice;

  // Clear the saved prompt (can only be used once)
  deferredInstallPrompt = null;

  // Update state
  if (outcome === 'accepted') {
    installState.isInstallable = false;
    notifyInstallStateChange();
    console.log('[PWA] User accepted install prompt');
    return true;
  }

  console.log('[PWA] User dismissed install prompt');
  return false;
}

/**
 * Apply pending update and reload the page
 */
export async function applyUpdate(): Promise<void> {
  if (!updateSW) {
    console.warn('[PWA] No update function available');
    return;
  }

  updateState.updateReady = true;
  notifyUpdateStateChange();

  // This will reload the page with the new service worker
  await updateSW(true);
}

/**
 * Request persistent storage for IndexedDB (prevents eviction)
 *
 * @returns Promise resolving to true if persistence was granted
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) {
    console.warn('[PWA] Storage persistence API not available');
    return false;
  }

  try {
    const persisted = await navigator.storage.persist();
    console.log(`[PWA] Storage persistence ${persisted ? 'granted' : 'denied'}`);
    return persisted;
  } catch (error) {
    console.error('[PWA] Failed to request storage persistence:', error);
    return false;
  }
}

/**
 * Get storage estimate (quota and usage)
 */
export async function getStorageEstimate(): Promise<{ quota: number; usage: number } | null> {
  if (!navigator.storage?.estimate) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      quota: estimate.quota ?? 0,
      usage: estimate.usage ?? 0,
    };
  } catch (error) {
    console.error('[PWA] Failed to get storage estimate:', error);
    return null;
  }
}

/**
 * Update model cached state
 */
export function setModelCached(cached: boolean): void {
  offlineState.modelCached = cached;
  notifyOfflineStateChange();
}

/**
 * Get current install state
 */
export function getInstallState(): PWAInstallState {
  return { ...installState };
}

/**
 * Get current offline state
 */
export function getOfflineState(): PWAOfflineState {
  return { ...offlineState };
}

/**
 * Get current update state
 */
export function getUpdateState(): PWAUpdateState {
  return { ...updateState };
}

/**
 * Subscribe to install state changes
 */
export function onInstallStateChange(callback: InstallStateCallback): () => void {
  installStateCallbacks.push(callback);
  // Return unsubscribe function
  return () => {
    installStateCallbacks = installStateCallbacks.filter((cb) => cb !== callback);
  };
}

/**
 * Subscribe to offline state changes
 */
export function onOfflineStateChange(callback: OfflineStateCallback): () => void {
  offlineStateCallbacks.push(callback);
  return () => {
    offlineStateCallbacks = offlineStateCallbacks.filter((cb) => cb !== callback);
  };
}

/**
 * Subscribe to update state changes
 */
export function onUpdateStateChange(callback: UpdateStateCallback): () => void {
  updateStateCallbacks.push(callback);
  return () => {
    updateStateCallbacks = updateStateCallbacks.filter((cb) => cb !== callback);
  };
}

/**
 * Check if iOS (needs manual install instructions)
 */
export function isIOS(): boolean {
  return installState.platform === 'ios';
}

/**
 * Get iOS install instructions
 */
export function getIOSInstallInstructions(): string {
  return 'To install: tap the Share button (box with arrow), then "Add to Home Screen"';
}
