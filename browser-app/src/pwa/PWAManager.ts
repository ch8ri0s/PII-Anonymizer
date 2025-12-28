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
import { createLogger } from '../utils/logger';

// Logger for PWA manager
const log = createLogger('pwa:manager');

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
const installState: PWAInstallState = {
  isInstallable: false,
  isInstalled: false,
  platform: 'unknown',
};
const offlineState: PWAOfflineState = {
  isOnline: navigator.onLine,
  isOfflineReady: false,
  modelCached: false,
};
const updateState: PWAUpdateState = {
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

  log.debug('Install prompt available');
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

  log.info('App installed successfully');
}

/**
 * Handle online/offline events
 */
function handleOnlineStatusChange(): void {
  offlineState.isOnline = navigator.onLine;
  notifyOfflineStateChange();

  log.info('Network status changed', { isOnline: offlineState.isOnline });
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
        log.info('New content available, refresh needed');
      },
      onOfflineReady() {
        offlineState.isOfflineReady = true;
        notifyOfflineStateChange();
        log.info('App ready to work offline');
      },
      onRegistered(registration) {
        log.debug('Service worker registered', { scope: registration?.scope });
      },
      onRegisterError(error) {
        log.error('Service worker registration failed', { error: String(error) });
      },
    });
  } catch (error) {
    log.warn('Service worker registration skipped', { error: String(error) });
  }

  log.info('Manager initialized', {
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

  log.debug('Manager destroyed');
}

/**
 * Trigger the install prompt
 * Should only be called after user interaction (e.g., button click)
 *
 * @returns Promise resolving to true if user accepted, false if dismissed
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferredInstallPrompt) {
    log.warn('No install prompt available');
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
    log.info('User accepted install prompt');
    return true;
  }

  log.info('User dismissed install prompt');
  return false;
}

/**
 * Apply pending update and reload the page
 */
export async function applyUpdate(): Promise<void> {
  if (!updateSW) {
    log.warn('No update function available');
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
    log.warn('Storage persistence API not available');
    return false;
  }

  try {
    const persisted = await navigator.storage.persist();
    log.info('Storage persistence result', { persisted });
    return persisted;
  } catch (error) {
    log.error('Failed to request storage persistence', { error: String(error) });
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
    log.error('Failed to get storage estimate', { error: String(error) });
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
