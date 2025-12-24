/**
 * Toast Notification Component
 *
 * Provides non-intrusive toast notifications for user feedback.
 * Supports success, error, and info variants with auto-dismiss.
 *
 * Story 7.7: Manual PII Marking UI Polish - AC6
 */

/**
 * Toast notification type variants
 */
export type ToastType = 'success' | 'error' | 'info';

/**
 * Toast options for creating a notification
 */
export interface ToastOptions {
  message: string;
  type: ToastType;
  duration?: number; // default 3000ms
}

/**
 * Internal toast item with ID for tracking
 */
interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  element: HTMLElement;
  timeoutId: ReturnType<typeof setTimeout>;
}

// Module state
let containerElement: HTMLElement | null = null;
let toasts: ToastItem[] = [];
let toastIdCounter = 0;

/**
 * Default toast duration in milliseconds
 */
const DEFAULT_DURATION = 3000;

/**
 * Maximum number of visible toasts
 */
const MAX_VISIBLE_TOASTS = 5;

/**
 * CSS styles for the toast container and items
 */
const TOAST_CSS = `
  .toast-container {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 9999;
    display: flex;
    flex-direction: column-reverse;
    gap: 0.5rem;
    pointer-events: none;
    max-width: 320px;
  }

  .toast-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    font-size: 0.875rem;
    font-weight: 500;
    pointer-events: auto;
    animation: toast-slide-in 0.2s ease-out;
    transition: opacity 0.15s ease-out, transform 0.15s ease-out;
  }

  .toast-item.toast-hiding {
    opacity: 0;
    transform: translateX(100%);
  }

  .toast-item.toast-success {
    background: hsl(142.1 76.2% 36.3%);
    color: white;
  }

  .toast-item.toast-error {
    background: hsl(0 84.2% 60.2%);
    color: white;
  }

  .toast-item.toast-info {
    background: hsl(217.2 91.2% 59.8%);
    color: white;
  }

  .toast-icon {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
  }

  .toast-message {
    flex: 1;
    line-height: 1.4;
  }

  .toast-close {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    padding: 0;
    margin: 0;
    border: none;
    background: transparent;
    color: currentColor;
    opacity: 0.7;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  .toast-close:hover {
    opacity: 1;
  }

  @keyframes toast-slide-in {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;

/**
 * Icon SVGs for different toast types
 */
const TOAST_ICONS: Record<ToastType, string> = {
  success: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
  </svg>`,
  error: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
  </svg>`,
  info: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>`,
};

/**
 * Close button SVG
 */
const CLOSE_ICON = `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
</svg>`;

/**
 * Inject CSS styles
 */
function injectStyles(): void {
  if (!document.getElementById('toast-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'toast-styles';
    styleSheet.textContent = TOAST_CSS;
    document.head.appendChild(styleSheet);
  }
}

/**
 * Ensure container exists
 */
function ensureContainer(): HTMLElement {
  if (!containerElement) {
    injectStyles();
    containerElement = document.createElement('div');
    containerElement.id = 'toast-container';
    containerElement.className = 'toast-container';
    containerElement.setAttribute('aria-live', 'polite');
    containerElement.setAttribute('aria-atomic', 'true');
    document.body.appendChild(containerElement);
  }
  return containerElement;
}

/**
 * Generate a unique toast ID
 */
function generateId(): string {
  return `toast-${++toastIdCounter}`;
}

/**
 * Remove a toast by ID
 */
function removeToast(id: string): void {
  const index = toasts.findIndex(t => t.id === id);
  if (index === -1) return;

  const toast = toasts[index];
  clearTimeout(toast.timeoutId);

  // Add hiding animation
  toast.element.classList.add('toast-hiding');

  // Remove after animation
  setTimeout(() => {
    if (toast.element.parentNode) {
      toast.element.parentNode.removeChild(toast.element);
    }
    toasts = toasts.filter(t => t.id !== id);
  }, 150);
}

/**
 * Show a toast notification
 */
export function showToast(options: ToastOptions): string {
  const container = ensureContainer();
  const id = generateId();
  const duration = options.duration ?? DEFAULT_DURATION;

  // Remove oldest toast if at max
  if (toasts.length >= MAX_VISIBLE_TOASTS) {
    const oldest = toasts[0];
    removeToast(oldest.id);
  }

  // Create toast element
  const element = document.createElement('div');
  element.id = id;
  element.className = `toast-item toast-${options.type}`;
  element.setAttribute('role', 'alert');
  element.innerHTML = `
    ${TOAST_ICONS[options.type]}
    <span class="toast-message">${escapeHtml(options.message)}</span>
    <button class="toast-close" aria-label="Close notification" type="button">
      ${CLOSE_ICON}
    </button>
  `;

  // Add close button handler
  const closeButton = element.querySelector('.toast-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => removeToast(id));
  }

  // Add to container
  container.appendChild(element);

  // Set auto-dismiss timeout
  const timeoutId = setTimeout(() => removeToast(id), duration);

  // Track toast
  const toast: ToastItem = {
    id,
    message: options.message,
    type: options.type,
    element,
    timeoutId,
  };
  toasts.push(toast);

  return id;
}

/**
 * Show a success toast
 */
export function showSuccess(message: string, duration?: number): string {
  return showToast({ message, type: 'success', duration });
}

/**
 * Show an error toast
 */
export function showError(message: string, duration?: number): string {
  return showToast({ message, type: 'error', duration });
}

/**
 * Show an info toast
 */
export function showInfo(message: string, duration?: number): string {
  return showToast({ message, type: 'info', duration });
}

/**
 * Dismiss a toast by ID
 */
export function dismissToast(id: string): void {
  removeToast(id);
}

/**
 * Dismiss all toasts
 */
export function dismissAllToasts(): void {
  const toastsCopy = [...toasts];
  toastsCopy.forEach(toast => removeToast(toast.id));
}

/**
 * Get the current number of visible toasts
 */
export function getToastCount(): number {
  return toasts.length;
}

/**
 * Destroy the toast system and clean up
 */
export function destroyToasts(): void {
  dismissAllToasts();

  if (containerElement && containerElement.parentNode) {
    containerElement.parentNode.removeChild(containerElement);
  }

  containerElement = null;
  toasts = [];
  toastIdCounter = 0;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
