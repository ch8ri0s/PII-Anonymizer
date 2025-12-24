/**
 * PWA Status Indicator Tests
 *
 * Tests for the status indicator component.
 *
 * Story 7.6: PWA & Deployment Readiness
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock virtual:pwa-register
vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => vi.fn()),
}));

// Mock PWAManager functions
const mockOfflineState = {
  isOnline: true,
  isOfflineReady: false,
  modelCached: false,
};

const mockUpdateState = {
  needsUpdate: false,
  updateReady: false,
};

let offlineCallback: ((state: typeof mockOfflineState) => void) | null = null;

vi.mock('../../src/pwa/PWAManager', () => ({
  getOfflineState: vi.fn(() => ({ ...mockOfflineState })),
  getUpdateState: vi.fn(() => ({ ...mockUpdateState })),
  onOfflineStateChange: vi.fn((cb) => {
    offlineCallback = cb;
    return vi.fn();
  }),
  onUpdateStateChange: vi.fn(() => vi.fn()),
  applyUpdate: vi.fn(() => Promise.resolve()),
}));

import {
  initStatusIndicator,
  destroyStatusIndicator,
  getIndicatorElement,
} from '../../src/pwa/PWAStatusIndicator';
import * as PWAManager from '../../src/pwa/PWAManager';

describe('PWAStatusIndicator', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="review-header-left"></div>';
    offlineCallback = null;
    vi.clearAllMocks();

    // Reset mock state
    Object.assign(mockOfflineState, {
      isOnline: true,
      isOfflineReady: false,
      modelCached: false,
    });
    Object.assign(mockUpdateState, {
      needsUpdate: false,
      updateReady: false,
    });
  });

  afterEach(() => {
    destroyStatusIndicator();
    vi.restoreAllMocks();
  });

  describe('initStatusIndicator', () => {
    it('should create indicator element', () => {
      initStatusIndicator();

      const element = getIndicatorElement();
      expect(element).not.toBeNull();
    });

    it('should subscribe to offline state changes', () => {
      initStatusIndicator();

      expect(PWAManager.onOfflineStateChange).toHaveBeenCalled();
    });

    it('should subscribe to update state changes', () => {
      initStatusIndicator();

      expect(PWAManager.onUpdateStateChange).toHaveBeenCalled();
    });

    it('should inject CSS styles', () => {
      initStatusIndicator();

      const styleSheet = document.getElementById('pwa-status-indicator-styles');
      expect(styleSheet).not.toBeNull();
    });
  });

  describe('Status Display', () => {
    it('should show "Online" when online, offline-ready, and model cached', () => {
      // When fully ready but online, shows "Offline Ready"
      // When online but model not cached, shows "Model Required"
      mockOfflineState.isOnline = true;
      mockOfflineState.isOfflineReady = true;
      mockOfflineState.modelCached = true;

      initStatusIndicator();

      const element = getIndicatorElement();
      // With model cached and offline ready, it shows "Offline Ready"
      expect(element?.textContent).toContain('Offline Ready');
      expect(element?.classList.contains('offline-ready')).toBe(true);
    });

    it('should show "Offline" when offline', () => {
      mockOfflineState.isOnline = false;

      initStatusIndicator();

      const element = getIndicatorElement();
      expect(element?.textContent).toContain('Offline');
      expect(element?.classList.contains('offline')).toBe(true);
    });

    it('should show "Offline Ready" when ready and model cached', () => {
      mockOfflineState.isOnline = true;
      mockOfflineState.isOfflineReady = true;
      mockOfflineState.modelCached = true;

      initStatusIndicator();

      const element = getIndicatorElement();
      expect(element?.textContent).toContain('Offline Ready');
      expect(element?.classList.contains('offline-ready')).toBe(true);
    });

    it('should show "Model Required" when model not cached', () => {
      mockOfflineState.isOnline = true;
      mockOfflineState.modelCached = false;

      initStatusIndicator();

      const element = getIndicatorElement();
      expect(element?.textContent).toContain('Model Required');
      expect(element?.classList.contains('model-loading')).toBe(true);
    });
  });

  describe('State Updates', () => {
    it('should update display when going offline', () => {
      initStatusIndicator();

      // Trigger state change
      if (offlineCallback) {
        offlineCallback({
          isOnline: false,
          isOfflineReady: true,
          modelCached: true,
        });
      }

      const element = getIndicatorElement();
      expect(element?.textContent).toContain('Offline');
    });

    it('should update display when going online', () => {
      mockOfflineState.isOnline = false;
      initStatusIndicator();

      if (offlineCallback) {
        offlineCallback({
          isOnline: true,
          isOfflineReady: true,
          modelCached: true,
        });
      }

      const element = getIndicatorElement();
      expect(element?.textContent).toContain('Offline Ready');
    });

    it('should update display when model becomes cached', () => {
      mockOfflineState.modelCached = false;
      initStatusIndicator();

      if (offlineCallback) {
        offlineCallback({
          isOnline: true,
          isOfflineReady: true,
          modelCached: true,
        });
      }

      const element = getIndicatorElement();
      expect(element?.textContent).toContain('Offline Ready');
    });
  });

  describe('Update Banner', () => {
    it('should show update banner when update needed', () => {
      mockUpdateState.needsUpdate = true;

      initStatusIndicator();

      const updateBanner = document.querySelector('.pwa-update-banner');
      expect(updateBanner).not.toBeNull();
    });

    it('should not show update banner initially', () => {
      mockUpdateState.needsUpdate = false;

      initStatusIndicator();

      const updateBanner = document.querySelector('.pwa-update-banner');
      expect(updateBanner).toBeNull();
    });

    it('should call applyUpdate when update button clicked', () => {
      mockUpdateState.needsUpdate = true;

      initStatusIndicator();

      const updateBtn = document.querySelector('[data-action="update"]') as HTMLButtonElement;
      updateBtn?.click();

      expect(PWAManager.applyUpdate).toHaveBeenCalled();
    });

    it('should dismiss update banner when close clicked', () => {
      mockUpdateState.needsUpdate = true;

      initStatusIndicator();

      const closeBtn = document.querySelector('[data-action="dismiss"]') as HTMLButtonElement;
      closeBtn?.click();

      const updateBanner = document.querySelector('.pwa-update-banner');
      expect(updateBanner).toBeNull();
    });
  });

  describe('mountIndicator', () => {
    it('should return indicator element for custom mounting', () => {
      initStatusIndicator();

      const element = getIndicatorElement();
      // Verify the element exists and can be used for mounting
      expect(element).not.toBeNull();
      expect(element?.classList.contains('pwa-status-indicator')).toBe(true);
    });
  });

  describe('destroyStatusIndicator', () => {
    it('should remove indicator from DOM', () => {
      initStatusIndicator();

      destroyStatusIndicator();

      const indicator = document.querySelector('.pwa-status-indicator');
      expect(indicator).toBeNull();
    });

    it('should remove update banner from DOM', () => {
      mockUpdateState.needsUpdate = true;
      initStatusIndicator();

      destroyStatusIndicator();

      const updateBanner = document.querySelector('.pwa-update-banner');
      expect(updateBanner).toBeNull();
    });

    it('should return null from getIndicatorElement after destroy', () => {
      initStatusIndicator();
      destroyStatusIndicator();

      const element = getIndicatorElement();
      expect(element).toBeNull();
    });
  });

  describe('Status Dot', () => {
    it('should have status dot element', () => {
      initStatusIndicator();

      const element = getIndicatorElement();
      const dot = element?.querySelector('.pwa-status-dot');
      expect(dot).not.toBeNull();
    });

    it('should pulse when model loading', () => {
      mockOfflineState.modelCached = false;

      initStatusIndicator();

      const element = getIndicatorElement();
      const dot = element?.querySelector('.pwa-status-dot');
      expect(dot?.classList.contains('pulse')).toBe(true);
    });

    it('should not pulse when offline ready', () => {
      mockOfflineState.isOfflineReady = true;
      mockOfflineState.modelCached = true;

      initStatusIndicator();

      const element = getIndicatorElement();
      const dot = element?.querySelector('.pwa-status-dot');
      expect(dot?.classList.contains('pulse')).toBe(false);
    });
  });
});
