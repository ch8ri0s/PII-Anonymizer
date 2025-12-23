/**
 * PWA Install Banner Tests
 *
 * Tests for the install banner component.
 *
 * Story 7.6: PWA & Deployment Readiness
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock virtual:pwa-register
vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(() => vi.fn()),
}));

// Mock PWAManager functions
vi.mock('../../src/pwa/PWAManager', () => ({
  getInstallState: vi.fn(() => ({
    isInstallable: false,
    isInstalled: false,
    platform: 'desktop',
  })),
  onInstallStateChange: vi.fn(() => vi.fn()),
  promptInstall: vi.fn(() => Promise.resolve(false)),
  isIOS: vi.fn(() => false),
  getIOSInstallInstructions: vi.fn(() => 'iOS instructions'),
}));

import {
  initInstallBanner,
  destroyInstallBanner,
  notifyFileProcessed,
} from '../../src/pwa/PWAInstallBanner';
import * as PWAManager from '../../src/pwa/PWAManager';

describe('PWAInstallBanner', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Reset DOM
    document.body.innerHTML = '';

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    destroyInstallBanner();
    vi.restoreAllMocks();
  });

  describe('initInstallBanner', () => {
    it('should subscribe to install state changes', () => {
      initInstallBanner();

      expect(PWAManager.onInstallStateChange).toHaveBeenCalled();
    });

    it('should not show banner when app is not installable', () => {
      vi.mocked(PWAManager.getInstallState).mockReturnValue({
        isInstallable: false,
        isInstalled: false,
        platform: 'desktop',
      });

      initInstallBanner();

      const banner = document.querySelector('.pwa-install-banner');
      expect(banner).toBeNull();
    });

    it('should not show banner when app is already installed', () => {
      vi.mocked(PWAManager.getInstallState).mockReturnValue({
        isInstallable: true,
        isInstalled: true,
        platform: 'desktop',
      });

      initInstallBanner();

      const banner = document.querySelector('.pwa-install-banner');
      expect(banner).toBeNull();
    });
  });

  describe('notifyFileProcessed', () => {
    it('should trigger banner display after file processing', async () => {
      vi.mocked(PWAManager.getInstallState).mockReturnValue({
        isInstallable: true,
        isInstalled: false,
        platform: 'desktop',
      });

      initInstallBanner();
      notifyFileProcessed();

      // Wait for delayed banner display
      await new Promise((resolve) => setTimeout(resolve, 2100));

      const banner = document.querySelector('.pwa-install-banner');
      expect(banner).not.toBeNull();
    });

    it('should not show banner if dismissed recently', async () => {
      // Set dismissed timestamp to now
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());

      vi.mocked(PWAManager.getInstallState).mockReturnValue({
        isInstallable: true,
        isInstalled: false,
        platform: 'desktop',
      });

      initInstallBanner();
      notifyFileProcessed();

      await new Promise((resolve) => setTimeout(resolve, 2100));

      const banner = document.querySelector('.pwa-install-banner');
      expect(banner).toBeNull();
    });
  });

  describe('Banner Interactions', () => {
    beforeEach(async () => {
      vi.mocked(PWAManager.getInstallState).mockReturnValue({
        isInstallable: true,
        isInstalled: false,
        platform: 'desktop',
      });

      initInstallBanner();
      notifyFileProcessed();

      await new Promise((resolve) => setTimeout(resolve, 2100));
    });

    it('should have install button', () => {
      const installBtn = document.querySelector('[data-action="install"]');
      expect(installBtn).not.toBeNull();
    });

    it('should have dismiss button', () => {
      const dismissBtn = document.querySelector('[data-action="dismiss"]');
      expect(dismissBtn).not.toBeNull();
    });

    it('should call promptInstall when install button clicked', async () => {
      const installBtn = document.querySelector('[data-action="install"]') as HTMLButtonElement;
      installBtn?.click();

      expect(PWAManager.promptInstall).toHaveBeenCalled();
    });

    it('should hide banner when dismiss clicked', async () => {
      const dismissBtn = document.querySelector('[data-action="dismiss"]') as HTMLButtonElement;
      dismissBtn?.click();

      // Wait for animation
      await new Promise((resolve) => setTimeout(resolve, 400));

      const banner = document.querySelector('.pwa-install-banner');
      expect(banner).toBeNull();
    });

    it('should save dismiss timestamp to localStorage', () => {
      const dismissBtn = document.querySelector('[data-action="dismiss"]') as HTMLButtonElement;
      dismissBtn?.click();

      const dismissed = localStorage.getItem('pwa-install-dismissed');
      expect(dismissed).not.toBeNull();
    });
  });

  describe('iOS Handling', () => {
    it('should show iOS instructions on iOS devices', async () => {
      vi.mocked(PWAManager.getInstallState).mockReturnValue({
        isInstallable: false, // iOS doesn't have beforeinstallprompt
        isInstalled: false,
        platform: 'ios',
      });
      vi.mocked(PWAManager.isIOS).mockReturnValue(true);

      initInstallBanner();
      notifyFileProcessed();

      await new Promise((resolve) => setTimeout(resolve, 2100));

      // Banner should appear for iOS even without isInstallable
      const banner = document.querySelector('.pwa-install-banner');
      expect(banner).not.toBeNull();
    });
  });

  describe('destroyInstallBanner', () => {
    it('should remove banner from DOM', async () => {
      vi.mocked(PWAManager.getInstallState).mockReturnValue({
        isInstallable: true,
        isInstalled: false,
        platform: 'desktop',
      });

      initInstallBanner();
      notifyFileProcessed();

      await new Promise((resolve) => setTimeout(resolve, 2100));

      destroyInstallBanner();

      const banner = document.querySelector('.pwa-install-banner');
      expect(banner).toBeNull();
    });
  });

  describe('CSS Injection', () => {
    it('should inject styles when banner is shown', async () => {
      vi.mocked(PWAManager.getInstallState).mockReturnValue({
        isInstallable: true,
        isInstalled: false,
        platform: 'desktop',
      });

      initInstallBanner();
      notifyFileProcessed();

      await new Promise((resolve) => setTimeout(resolve, 2100));

      const styleSheet = document.getElementById('pwa-install-banner-styles');
      expect(styleSheet).not.toBeNull();
    });

    it('should not inject styles multiple times', async () => {
      vi.mocked(PWAManager.getInstallState).mockReturnValue({
        isInstallable: true,
        isInstalled: false,
        platform: 'desktop',
      });

      initInstallBanner();
      notifyFileProcessed();
      notifyFileProcessed();

      await new Promise((resolve) => setTimeout(resolve, 2100));

      const styleSheets = document.querySelectorAll('#pwa-install-banner-styles');
      expect(styleSheets.length).toBe(1);
    });
  });

  describe('Accessibility', () => {
    beforeEach(async () => {
      vi.mocked(PWAManager.getInstallState).mockReturnValue({
        isInstallable: true,
        isInstalled: false,
        platform: 'desktop',
      });

      initInstallBanner();
      notifyFileProcessed();

      await new Promise((resolve) => setTimeout(resolve, 2100));
    });

    it('should have role="dialog"', () => {
      const banner = document.querySelector('.pwa-install-banner');
      expect(banner?.getAttribute('role')).toBe('dialog');
    });

    it('should have aria-labelledby', () => {
      const banner = document.querySelector('.pwa-install-banner');
      expect(banner?.getAttribute('aria-labelledby')).toBe('pwa-install-title');
    });

    it('should have visible title', () => {
      const title = document.getElementById('pwa-install-title');
      expect(title).not.toBeNull();
      expect(title?.textContent).toContain('Install');
    });
  });
});
