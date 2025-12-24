/**
 * Toast Component Tests
 *
 * Tests for the toast notification system.
 * Story 7.7: Manual PII Marking UI Polish - AC6
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  showToast,
  showSuccess,
  showError,
  showInfo,
  dismissToast,
  dismissAllToasts,
  getToastCount,
  destroyToasts,
} from '../../src/components/Toast';

describe('Toast Component', () => {
  beforeEach(() => {
    // Clean up any existing toasts
    destroyToasts();
    vi.useFakeTimers();
  });

  afterEach(() => {
    destroyToasts();
    vi.useRealTimers();
  });

  describe('showToast', () => {
    it('should show a toast notification', () => {
      const id = showToast({ message: 'Test message', type: 'success' });

      expect(id).toMatch(/^toast-\d+$/);
      expect(getToastCount()).toBe(1);

      const container = document.getElementById('toast-container');
      expect(container).not.toBeNull();

      const toast = document.getElementById(id);
      expect(toast).not.toBeNull();
      expect(toast?.textContent).toContain('Test message');
    });

    it('should create toast with success type styling', () => {
      const id = showToast({ message: 'Success!', type: 'success' });
      const toast = document.getElementById(id);

      expect(toast?.classList.contains('toast-success')).toBe(true);
    });

    it('should create toast with error type styling', () => {
      const id = showToast({ message: 'Error!', type: 'error' });
      const toast = document.getElementById(id);

      expect(toast?.classList.contains('toast-error')).toBe(true);
    });

    it('should create toast with info type styling', () => {
      const id = showToast({ message: 'Info', type: 'info' });
      const toast = document.getElementById(id);

      expect(toast?.classList.contains('toast-info')).toBe(true);
    });

    it('should have role="alert" for accessibility', () => {
      const id = showToast({ message: 'Accessible', type: 'info' });
      const toast = document.getElementById(id);

      expect(toast?.getAttribute('role')).toBe('alert');
    });

    it('should auto-dismiss after default duration (3000ms)', () => {
      showToast({ message: 'Auto dismiss', type: 'success' });
      expect(getToastCount()).toBe(1);

      // Fast-forward past the duration + animation time
      vi.advanceTimersByTime(3150);

      expect(getToastCount()).toBe(0);
    });

    it('should respect custom duration', () => {
      showToast({ message: 'Custom duration', type: 'success', duration: 5000 });
      expect(getToastCount()).toBe(1);

      vi.advanceTimersByTime(3000);
      expect(getToastCount()).toBe(1); // Still visible

      vi.advanceTimersByTime(2150);
      expect(getToastCount()).toBe(0); // Now dismissed
    });

    it('should limit visible toasts to max 5', () => {
      for (let i = 0; i < 7; i++) {
        showToast({ message: `Toast ${i}`, type: 'info' });
        // Allow time for removal animation of oldest toast
        vi.advanceTimersByTime(200);
      }

      expect(getToastCount()).toBeLessThanOrEqual(5);
    });

    it('should escape HTML in messages', () => {
      const id = showToast({ message: '<script>alert("xss")</script>', type: 'info' });
      const toast = document.getElementById(id);

      expect(toast?.innerHTML).not.toContain('<script>');
      expect(toast?.textContent).toContain('<script>');
    });
  });

  describe('showSuccess', () => {
    it('should show success toast with correct styling', () => {
      const id = showSuccess('Operation completed');

      const toast = document.getElementById(id);
      expect(toast?.classList.contains('toast-success')).toBe(true);
      expect(toast?.textContent).toContain('Operation completed');
    });

    it('should support custom duration', () => {
      showSuccess('Quick success', 1000);
      expect(getToastCount()).toBe(1);

      vi.advanceTimersByTime(1150);
      expect(getToastCount()).toBe(0);
    });
  });

  describe('showError', () => {
    it('should show error toast with correct styling', () => {
      const id = showError('Something went wrong');

      const toast = document.getElementById(id);
      expect(toast?.classList.contains('toast-error')).toBe(true);
      expect(toast?.textContent).toContain('Something went wrong');
    });
  });

  describe('showInfo', () => {
    it('should show info toast with correct styling', () => {
      const id = showInfo('Did you know?');

      const toast = document.getElementById(id);
      expect(toast?.classList.contains('toast-info')).toBe(true);
      expect(toast?.textContent).toContain('Did you know?');
    });
  });

  describe('dismissToast', () => {
    it('should dismiss a specific toast by ID', () => {
      const id1 = showToast({ message: 'First', type: 'info' });
      const id2 = showToast({ message: 'Second', type: 'info' });

      expect(getToastCount()).toBe(2);

      dismissToast(id1);
      vi.advanceTimersByTime(200); // Wait for animation

      expect(getToastCount()).toBe(1);
      expect(document.getElementById(id1)).toBeNull();
      expect(document.getElementById(id2)).not.toBeNull();
    });

    it('should handle dismissing non-existent toast gracefully', () => {
      expect(() => dismissToast('non-existent-id')).not.toThrow();
    });
  });

  describe('dismissAllToasts', () => {
    it('should dismiss all visible toasts', () => {
      showToast({ message: 'First', type: 'info' });
      showToast({ message: 'Second', type: 'success' });
      showToast({ message: 'Third', type: 'error' });

      expect(getToastCount()).toBe(3);

      dismissAllToasts();
      vi.advanceTimersByTime(200); // Wait for animation

      expect(getToastCount()).toBe(0);
    });
  });

  describe('getToastCount', () => {
    it('should return correct count of visible toasts', () => {
      expect(getToastCount()).toBe(0);

      showToast({ message: 'One', type: 'info' });
      expect(getToastCount()).toBe(1);

      showToast({ message: 'Two', type: 'info' });
      expect(getToastCount()).toBe(2);
    });
  });

  describe('destroyToasts', () => {
    it('should clean up all toasts and container', () => {
      showToast({ message: 'Test', type: 'info' });
      expect(document.getElementById('toast-container')).not.toBeNull();

      destroyToasts();
      vi.advanceTimersByTime(200);

      expect(document.getElementById('toast-container')).toBeNull();
      expect(getToastCount()).toBe(0);
    });

    it('should allow creating new toasts after destroy', () => {
      showToast({ message: 'First session', type: 'info' });
      destroyToasts();
      vi.advanceTimersByTime(200);

      const id = showToast({ message: 'New session', type: 'success' });

      expect(id).toMatch(/^toast-\d+$/);
      expect(getToastCount()).toBe(1);
    });
  });

  describe('close button', () => {
    it('should have a close button on each toast', () => {
      const id = showToast({ message: 'Closable', type: 'info' });
      const toast = document.getElementById(id);

      const closeButton = toast?.querySelector('.toast-close');
      expect(closeButton).not.toBeNull();
      expect(closeButton?.getAttribute('aria-label')).toBe('Close notification');
    });

    it('should dismiss toast when close button is clicked', () => {
      const id = showToast({ message: 'Click to close', type: 'info' });
      const toast = document.getElementById(id);
      const closeButton = toast?.querySelector('.toast-close') as HTMLButtonElement;

      expect(getToastCount()).toBe(1);

      closeButton?.click();
      vi.advanceTimersByTime(200);

      expect(getToastCount()).toBe(0);
    });
  });

  describe('container accessibility', () => {
    it('should have aria-live="polite" on container', () => {
      showToast({ message: 'Test', type: 'info' });
      const container = document.getElementById('toast-container');

      expect(container?.getAttribute('aria-live')).toBe('polite');
    });

    it('should have aria-atomic="true" on container', () => {
      showToast({ message: 'Test', type: 'info' });
      const container = document.getElementById('toast-container');

      expect(container?.getAttribute('aria-atomic')).toBe('true');
    });
  });

  describe('CSS injection', () => {
    it('should inject styles only once', () => {
      showToast({ message: 'First', type: 'info' });
      showToast({ message: 'Second', type: 'info' });

      const styleElements = document.querySelectorAll('#toast-styles');
      expect(styleElements.length).toBe(1);
    });
  });
});
