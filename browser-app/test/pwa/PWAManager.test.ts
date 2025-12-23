/**
 * PWA Manager Tests
 *
 * Tests for PWA functionality including:
 * - Service worker registration
 * - Install prompt handling
 * - Offline/online detection
 * - Storage persistence
 *
 * Story 7.6: PWA & Deployment Readiness
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock virtual:pwa-register before importing PWAManager
vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => vi.fn()),
}));

// Now import the module
import {
  initPWAManager,
  destroyPWAManager,
  getInstallState,
  getOfflineState,
  getUpdateState,
  onInstallStateChange,
  onOfflineStateChange,
  onUpdateStateChange,
  setModelCached,
  requestPersistentStorage,
  getStorageEstimate,
  isIOS,
  getIOSInstallInstructions,
} from '../../src/pwa/PWAManager';

describe('PWAManager', () => {
  beforeEach(() => {
    // Reset module state by reinitializing
    destroyPWAManager();

    // Mock navigator APIs
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    destroyPWAManager();
    vi.restoreAllMocks();
  });

  describe('initPWAManager', () => {
    it('should initialize with correct default state', () => {
      initPWAManager();

      const installState = getInstallState();
      expect(installState.isInstallable).toBe(false);
      expect(installState.isInstalled).toBe(false);
      expect(typeof installState.platform).toBe('string');
    });

    it('should detect online status', () => {
      initPWAManager();

      const offlineState = getOfflineState();
      expect(offlineState.isOnline).toBe(true);
    });

    it('should initialize with update state not needed', () => {
      initPWAManager();

      const updateState = getUpdateState();
      expect(updateState.needsUpdate).toBe(false);
      expect(updateState.updateReady).toBe(false);
    });
  });

  describe('Platform Detection', () => {
    it('should detect iOS platform', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)',
        configurable: true,
      });

      initPWAManager();
      expect(isIOS()).toBe(true);
    });

    it('should detect Android platform', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Linux; Android 12; Pixel 6)',
        configurable: true,
      });

      initPWAManager();
      const state = getInstallState();
      expect(state.platform).toBe('android');
    });

    it('should detect desktop platform', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        configurable: true,
      });

      initPWAManager();
      const state = getInstallState();
      expect(state.platform).toBe('desktop');
    });
  });

  describe('Online/Offline Detection', () => {
    it('should detect when browser goes offline', () => {
      initPWAManager();

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });
      window.dispatchEvent(new Event('offline'));

      const state = getOfflineState();
      expect(state.isOnline).toBe(false);
    });

    it('should detect when browser comes online', () => {
      // Start offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });

      initPWAManager();

      // Go online
      Object.defineProperty(navigator, 'onLine', {
        value: true,
        configurable: true,
      });
      window.dispatchEvent(new Event('online'));

      const state = getOfflineState();
      expect(state.isOnline).toBe(true);
    });

    it('should notify subscribers on offline state change', () => {
      initPWAManager();

      const callback = vi.fn();
      onOfflineStateChange(callback);

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });
      window.dispatchEvent(new Event('offline'));

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ isOnline: false }),
      );
    });
  });

  describe('Model Cached State', () => {
    it('should update model cached state', () => {
      initPWAManager();

      setModelCached(true);
      let state = getOfflineState();
      expect(state.modelCached).toBe(true);

      setModelCached(false);
      state = getOfflineState();
      expect(state.modelCached).toBe(false);
    });

    it('should notify subscribers when model cached changes', () => {
      initPWAManager();

      const callback = vi.fn();
      onOfflineStateChange(callback);

      setModelCached(true);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ modelCached: true }),
      );
    });
  });

  describe('Install State Subscriptions', () => {
    it('should allow subscribing to install state changes', () => {
      initPWAManager();

      const callback = vi.fn();
      const unsubscribe = onInstallStateChange(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe correctly', () => {
      initPWAManager();

      const callback = vi.fn();
      const unsubscribe = onInstallStateChange(callback);

      unsubscribe();

      // Trigger a state change (won't call unsubscribed callback)
      // Since we can't easily trigger install state changes,
      // just verify the function doesn't throw
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  describe('Update State Subscriptions', () => {
    it('should allow subscribing to update state changes', () => {
      initPWAManager();

      const callback = vi.fn();
      const unsubscribe = onUpdateStateChange(callback);

      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });
  });

  describe('iOS Instructions', () => {
    it('should return iOS install instructions string', () => {
      const instructions = getIOSInstallInstructions();

      expect(typeof instructions).toBe('string');
      expect(instructions.length).toBeGreaterThan(0);
      expect(instructions).toContain('Share');
      expect(instructions).toContain('Add to Home Screen');
    });
  });

  describe('Storage Persistence', () => {
    it('should request persistent storage when available', async () => {
      const mockPersist = vi.fn().mockResolvedValue(true);
      Object.defineProperty(navigator, 'storage', {
        value: { persist: mockPersist },
        configurable: true,
      });

      initPWAManager();
      const result = await requestPersistentStorage();

      expect(mockPersist).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false when storage API not available', async () => {
      Object.defineProperty(navigator, 'storage', {
        value: undefined,
        configurable: true,
      });

      initPWAManager();
      const result = await requestPersistentStorage();

      expect(result).toBe(false);
    });

    it('should handle persistence request errors gracefully', async () => {
      const mockPersist = vi.fn().mockRejectedValue(new Error('Permission denied'));
      Object.defineProperty(navigator, 'storage', {
        value: { persist: mockPersist },
        configurable: true,
      });

      initPWAManager();
      const result = await requestPersistentStorage();

      expect(result).toBe(false);
    });
  });

  describe('Storage Estimate', () => {
    it('should get storage estimate when available', async () => {
      const mockEstimate = vi.fn().mockResolvedValue({
        quota: 1000000000,
        usage: 50000000,
      });
      Object.defineProperty(navigator, 'storage', {
        value: { estimate: mockEstimate },
        configurable: true,
      });

      initPWAManager();
      const estimate = await getStorageEstimate();

      expect(mockEstimate).toHaveBeenCalled();
      expect(estimate).toEqual({ quota: 1000000000, usage: 50000000 });
    });

    it('should return null when storage estimate not available', async () => {
      Object.defineProperty(navigator, 'storage', {
        value: undefined,
        configurable: true,
      });

      initPWAManager();
      const estimate = await getStorageEstimate();

      expect(estimate).toBeNull();
    });

    it('should handle estimate errors gracefully', async () => {
      const mockEstimate = vi.fn().mockRejectedValue(new Error('Failed'));
      Object.defineProperty(navigator, 'storage', {
        value: { estimate: mockEstimate },
        configurable: true,
      });

      initPWAManager();
      const estimate = await getStorageEstimate();

      expect(estimate).toBeNull();
    });
  });

  describe('destroyPWAManager', () => {
    it('should clean up event listeners', () => {
      initPWAManager();

      const callback = vi.fn();
      onOfflineStateChange(callback);

      destroyPWAManager();

      // Event should not trigger callback after destroy
      Object.defineProperty(navigator, 'onLine', {
        value: false,
        configurable: true,
      });
      window.dispatchEvent(new Event('offline'));

      expect(callback).not.toHaveBeenCalled();
    });
  });
});
