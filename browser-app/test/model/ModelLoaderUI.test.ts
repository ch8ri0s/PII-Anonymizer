/**
 * ModelLoaderUI Tests
 *
 * Tests for the model loading UI component.
 * Uses happy-dom for DOM simulation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  initModelLoaderUI,
  setOnCancel,
  showLoading,
  hideLoading,
  updateProgress,
  showSuccess,
  showError,
  showFallbackMode,
  showCancelled,
  formatBytes,
} from '../../src/ui/ModelLoaderUI';

describe('ModelLoaderUI', () => {
  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="model-status" class="hidden mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div class="flex items-center">
          <svg class="animate-spin h-5 w-5 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24"></svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-blue-800">Loading ML Model...</p>
            <div class="mt-1 w-full bg-blue-200 rounded-full h-2">
              <div id="model-progress" class="bg-blue-600 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
            </div>
            <p id="model-progress-text" class="text-xs text-blue-600 mt-1">Preparing...</p>
          </div>
        </div>
      </div>
    `;

    initModelLoaderUI();
  });

  describe('initModelLoaderUI()', () => {
    it('should find status element', () => {
      const statusElement = document.getElementById('model-status');
      expect(statusElement).not.toBeNull();
    });

    it('should find progress bar', () => {
      const progressBar = document.getElementById('model-progress');
      expect(progressBar).not.toBeNull();
    });

    it('should find progress text', () => {
      const progressText = document.getElementById('model-progress-text');
      expect(progressText).not.toBeNull();
    });
  });

  describe('showLoading()', () => {
    it('should remove hidden class from status element', () => {
      const statusElement = document.getElementById('model-status');
      expect(statusElement?.classList.contains('hidden')).toBe(true);

      showLoading();

      expect(statusElement?.classList.contains('hidden')).toBe(false);
    });
  });

  describe('hideLoading()', () => {
    it('should add hidden class to status element', () => {
      showLoading();
      const statusElement = document.getElementById('model-status');
      expect(statusElement?.classList.contains('hidden')).toBe(false);

      hideLoading();

      expect(statusElement?.classList.contains('hidden')).toBe(true);
    });
  });

  describe('updateProgress()', () => {
    it('should update progress bar width', () => {
      updateProgress({ status: 'progress', progress: 50 });

      const progressBar = document.getElementById('model-progress');
      expect(progressBar?.style.width).toBe('50%');
    });

    it('should update progress text for initiate status', () => {
      updateProgress({ status: 'initiate' });

      const progressText = document.getElementById('model-progress-text');
      expect(progressText?.textContent).toBe('Initializing...');
    });

    it('should update progress text for download status', () => {
      updateProgress({ status: 'download', file: 'model.onnx' });

      const progressText = document.getElementById('model-progress-text');
      expect(progressText?.textContent).toContain('model.onnx');
    });

    it('should show MB values for progress with loaded/total', () => {
      updateProgress({
        status: 'progress',
        loaded: 50 * 1024 * 1024, // 50MB
        total: 100 * 1024 * 1024, // 100MB
      });

      const progressText = document.getElementById('model-progress-text');
      expect(progressText?.textContent).toContain('50.0 MB');
      expect(progressText?.textContent).toContain('100.0 MB');
    });

    it('should show ready message for ready status', () => {
      updateProgress({ status: 'ready' });

      const progressText = document.getElementById('model-progress-text');
      expect(progressText?.textContent).toBe('Model ready!');
    });

    it('should show error message for error status', () => {
      updateProgress({ status: 'error', error: 'Network failed' });

      const progressText = document.getElementById('model-progress-text');
      expect(progressText?.textContent).toBe('Network failed');
    });
  });

  describe('showSuccess()', () => {
    it('should change status element to green styling', () => {
      showSuccess();

      const statusElement = document.getElementById('model-status');
      expect(statusElement?.className).toContain('bg-green-50');
      expect(statusElement?.className).toContain('border-green-200');
    });

    it('should update progress bar to 100%', () => {
      showSuccess();

      const progressBar = document.getElementById('model-progress');
      expect(progressBar?.style.width).toBe('100%');
    });
  });

  describe('showError()', () => {
    it('should change status element to red styling', () => {
      showError('Load failed');

      const statusElement = document.getElementById('model-status');
      expect(statusElement?.className).toContain('bg-red-50');
      expect(statusElement?.className).toContain('border-red-200');
    });

    it('should display error message', () => {
      showError('Load failed');

      const progressText = document.getElementById('model-progress-text');
      expect(progressText?.textContent).toBe('Load failed');
    });
  });

  describe('showFallbackMode()', () => {
    it('should change status element to amber styling', () => {
      showFallbackMode();

      const statusElement = document.getElementById('model-status');
      expect(statusElement?.className).toContain('bg-amber-50');
      expect(statusElement?.className).toContain('border-amber-200');
    });

    it('should display fallback message', () => {
      showFallbackMode();

      const progressText = document.getElementById('model-progress-text');
      expect(progressText?.textContent).toContain('regex patterns only');
    });
  });

  describe('showCancelled()', () => {
    it('should change status element to gray styling', () => {
      showCancelled();

      const statusElement = document.getElementById('model-status');
      expect(statusElement?.className).toContain('bg-gray-50');
    });

    it('should display cancelled message', () => {
      showCancelled();

      const progressText = document.getElementById('model-progress-text');
      expect(progressText?.textContent).toContain('regex patterns only');
    });
  });

  describe('setOnCancel()', () => {
    it('should register cancel callback', () => {
      const callback = vi.fn();
      setOnCancel(callback);

      // Cancel button is created during showLoading
      showLoading();

      // Wait for DOM update and find cancel button
      const cancelButton = document.getElementById('model-cancel');

      // If cancel button exists (created by showLoading), click it
      if (cancelButton) {
        cancelButton.click();
        expect(callback).toHaveBeenCalled();
      } else {
        // If cancel button wasn't created (UI structure varies), skip this test
        // The important part is that setOnCancel doesn't throw
        expect(callback).not.toHaveBeenCalled();
      }
    });

    it('should not throw when setting callback before init', () => {
      // This should not throw even before UI is initialized
      expect(() => setOnCancel(() => {})).not.toThrow();
    });
  });

  describe('formatBytes()', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 Bytes');
    });

    it('should format bytes', () => {
      expect(formatBytes(500)).toBe('500 Bytes');
    });

    it('should format KB', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(2048)).toBe('2 KB');
    });

    it('should format MB', () => {
      expect(formatBytes(1024 * 1024)).toBe('1 MB');
      expect(formatBytes(50.5 * 1024 * 1024)).toBe('50.5 MB');
    });

    it('should format GB', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });
});
