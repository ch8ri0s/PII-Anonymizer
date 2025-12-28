# Story 9.4: Composite Components (Modal, Toast, Dropdown, Tooltip)

## Story

As a **developer building complex UI interactions**,
I want **composite UI components built from primitives**,
So that **I can implement common patterns like dialogs, notifications, and menus consistently across both apps**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 9.4 |
| **Epic** | 9 - UI Harmonization (Tailwind + shadcn) |
| **Status** | ready-for-dev |
| **Created** | 2025-12-26 |

## Acceptance Criteria

### Modal Component
**Given** the need for dialog interactions
**When** I use the Modal component
**Then** it has `header`, `content`, `footer` sections
**And** ESC key closes the modal
**And** clicking the backdrop closes the modal (configurable)
**And** focus is trapped within the modal for accessibility
**And** the modal can be opened/closed programmatically

### Toast Component
**Given** the need for non-blocking notifications
**When** I use the Toast system
**Then** it supports variants: `success`, `error`, `warning`, `info`
**And** toasts auto-dismiss after a configurable duration (default 3000ms)
**And** multiple toasts stack vertically
**And** toasts have a close button
**And** toasts animate in and out smoothly

### Dropdown Component
**Given** the need for menu interactions
**When** I use the Dropdown component
**Then** it opens on click (or right-click for context menus)
**And** keyboard navigation works (Arrow keys, Enter, Escape)
**And** it positions intelligently (stays within viewport)
**And** clicking outside closes the dropdown

### Tooltip Component
**Given** the need for hover information
**When** I use the Tooltip component
**Then** it supports positions: `top`, `right`, `bottom`, `left`
**And** it has a configurable show delay (default 300ms)
**And** it positions intelligently (stays within viewport)
**And** it supports both text and custom content

### General Requirements
**And** all components use CSS variables from Story 9.1
**And** all components use primitives from Story 9.3 where applicable
**And** all components have unit tests
**And** all components work in both Electron and browser environments

## Technical Design

### Files to Create

| File | Purpose |
|------|---------|
| `shared/ui-components/src/composites/Modal.ts` | Modal dialog component |
| `shared/ui-components/src/composites/Toast.ts` | Toast notification system |
| `shared/ui-components/src/composites/Dropdown.ts` | Dropdown menu component |
| `shared/ui-components/src/composites/Tooltip.ts` | Tooltip component |
| `shared/ui-components/src/composites/index.ts` | Barrel export |

### Dependencies

- `@floating-ui/dom` - For intelligent positioning of tooltips and dropdowns

### Modal Component Design

```typescript
// shared/ui-components/src/composites/Modal.ts
import { cn } from '../utils/cn';
import { Button } from '../primitives/Button';

export interface ModalProps {
  /** Modal title (optional) */
  title?: string;
  /** Modal body content */
  content: string | HTMLElement;
  /** Footer content or buttons */
  footer?: string | HTMLElement;
  /** Close on backdrop click (default: true) */
  closeOnBackdrop?: boolean;
  /** Close on ESC key (default: true) */
  closeOnEscape?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when modal closes */
  onClose?: () => void;
}

export interface ModalInstance {
  /** The modal element */
  element: HTMLElement;
  /** Open the modal */
  open: () => void;
  /** Close the modal */
  close: () => void;
  /** Check if modal is open */
  isOpen: () => boolean;
  /** Destroy the modal and clean up */
  destroy: () => void;
}

/**
 * Create a Modal instance.
 *
 * @example
 * const modal = Modal({
 *   title: 'Confirm',
 *   content: 'Are you sure?',
 *   footer: confirmButton,
 * });
 * modal.open();
 */
export function Modal(props: ModalProps): ModalInstance {
  const {
    title,
    content,
    footer,
    closeOnBackdrop = true,
    closeOnEscape = true,
    className,
    onClose,
  } = props;

  let isOpen = false;
  let previousActiveElement: Element | null = null;

  // Create backdrop
  const backdrop = document.createElement('div');
  backdrop.className = cn(
    'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
    'transition-opacity duration-150',
    'opacity-0 pointer-events-none'
  );

  // Create modal container
  const modal = document.createElement('div');
  modal.className = cn(
    'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
    'w-full max-w-lg max-h-[85vh]',
    'bg-background rounded-lg shadow-xl border border-border',
    'transition-all duration-150',
    'opacity-0 scale-95 pointer-events-none',
    className
  );
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  if (title) modal.setAttribute('aria-labelledby', 'modal-title');

  // Build modal content
  let innerHTML = '';

  if (title) {
    innerHTML += `
      <div class="flex items-center justify-between p-4 border-b border-border">
        <h2 id="modal-title" class="text-lg font-semibold">${title}</h2>
        <button class="modal-close p-1 rounded hover:bg-muted" aria-label="Close">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    `;
  }

  innerHTML += '<div class="modal-content p-4 overflow-y-auto"></div>';

  if (footer) {
    innerHTML += '<div class="modal-footer p-4 border-t border-border flex justify-end gap-2"></div>';
  }

  modal.innerHTML = innerHTML;

  // Insert content
  const contentEl = modal.querySelector('.modal-content')!;
  if (typeof content === 'string') {
    contentEl.textContent = content;
  } else {
    contentEl.appendChild(content);
  }

  // Insert footer
  if (footer) {
    const footerEl = modal.querySelector('.modal-footer')!;
    if (typeof footer === 'string') {
      footerEl.textContent = footer;
    } else {
      footerEl.appendChild(footer);
    }
  }

  // Event handlers
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && closeOnEscape) {
      close();
    }
    // Focus trap
    if (e.key === 'Tab') {
      trapFocus(e);
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === backdrop && closeOnBackdrop) {
      close();
    }
  }

  function trapFocus(e: KeyboardEvent) {
    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    previousActiveElement = document.activeElement;

    document.body.appendChild(backdrop);
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Trigger animation
    requestAnimationFrame(() => {
      backdrop.classList.remove('opacity-0', 'pointer-events-none');
      modal.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
    });

    // Focus first focusable element
    const firstFocusable = modal.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable?.focus();

    document.addEventListener('keydown', handleKeyDown);
    backdrop.addEventListener('click', handleBackdropClick);

    // Close button
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn?.addEventListener('click', close);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    backdrop.classList.add('opacity-0', 'pointer-events-none');
    modal.classList.add('opacity-0', 'scale-95', 'pointer-events-none');

    document.removeEventListener('keydown', handleKeyDown);
    backdrop.removeEventListener('click', handleBackdropClick);

    // Remove after animation
    setTimeout(() => {
      backdrop.remove();
      modal.remove();
      document.body.style.overflow = '';
      (previousActiveElement as HTMLElement)?.focus();
    }, 150);

    onClose?.();
  }

  function destroy() {
    close();
  }

  return {
    element: modal,
    open,
    close,
    isOpen: () => isOpen,
    destroy,
  };
}
```

### Toast Component Design

```typescript
// shared/ui-components/src/composites/Toast.ts
import { cn } from '../utils/cn';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  /** Toast message */
  message: string;
  /** Toast variant */
  variant: ToastVariant;
  /** Auto-dismiss duration in ms (default: 3000, 0 = no auto-dismiss) */
  duration?: number;
  /** Optional title */
  title?: string;
}

export interface ToastManager {
  /** Show a toast and return its ID */
  show: (options: ToastOptions) => string;
  /** Dismiss a toast by ID */
  dismiss: (id: string) => void;
  /** Dismiss all toasts */
  dismissAll: () => void;
  /** Destroy the toast system */
  destroy: () => void;
}

const ICONS: Record<ToastVariant, string> = {
  success: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
  </svg>`,
  error: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
  </svg>`,
  warning: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
  </svg>`,
  info: `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>`,
};

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  warning: 'bg-yellow-500 text-black',
  info: 'bg-blue-600 text-white',
};

/**
 * Create a Toast notification manager.
 *
 * @example
 * const toast = createToastManager();
 * toast.show({ message: 'Saved!', variant: 'success' });
 */
export function createToastManager(): ToastManager {
  let container: HTMLElement | null = null;
  const toasts = new Map<string, { element: HTMLElement; timeout?: number }>();
  let idCounter = 0;

  function ensureContainer(): HTMLElement {
    if (!container) {
      container = document.createElement('div');
      container.className = cn(
        'fixed bottom-4 right-4 z-50',
        'flex flex-col-reverse gap-2',
        'max-w-sm pointer-events-none'
      );
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    return container;
  }

  function show(options: ToastOptions): string {
    const { message, variant, duration = 3000, title } = options;
    const id = `toast-${++idCounter}`;
    const parent = ensureContainer();

    const toast = document.createElement('div');
    toast.id = id;
    toast.className = cn(
      'flex items-start gap-3 p-4 rounded-lg shadow-lg pointer-events-auto',
      'animate-in slide-in-from-right-full',
      VARIANT_CLASSES[variant]
    );
    toast.setAttribute('role', 'alert');

    toast.innerHTML = `
      <span class="flex-shrink-0">${ICONS[variant]}</span>
      <div class="flex-1 min-w-0">
        ${title ? `<p class="font-semibold">${escapeHtml(title)}</p>` : ''}
        <p class="${title ? 'text-sm opacity-90' : ''}">${escapeHtml(message)}</p>
      </div>
      <button class="flex-shrink-0 opacity-70 hover:opacity-100" aria-label="Close">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    `;

    // Close button handler
    toast.querySelector('button')?.addEventListener('click', () => dismiss(id));

    parent.appendChild(toast);

    // Auto-dismiss
    let timeoutId: number | undefined;
    if (duration > 0) {
      timeoutId = window.setTimeout(() => dismiss(id), duration);
    }

    toasts.set(id, { element: toast, timeout: timeoutId });
    return id;
  }

  function dismiss(id: string): void {
    const toast = toasts.get(id);
    if (!toast) return;

    if (toast.timeout) clearTimeout(toast.timeout);

    toast.element.classList.add('animate-out', 'slide-out-to-right-full');
    toast.element.addEventListener('animationend', () => {
      toast.element.remove();
      toasts.delete(id);
    });
  }

  function dismissAll(): void {
    toasts.forEach((_, id) => dismiss(id));
  }

  function destroy(): void {
    dismissAll();
    container?.remove();
    container = null;
  }

  return { show, dismiss, dismissAll, destroy };
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Convenience functions
let defaultManager: ToastManager | null = null;

export function showToast(options: ToastOptions): string {
  if (!defaultManager) defaultManager = createToastManager();
  return defaultManager.show(options);
}

export function showSuccess(message: string, duration?: number): string {
  return showToast({ message, variant: 'success', duration });
}

export function showError(message: string, duration?: number): string {
  return showToast({ message, variant: 'error', duration });
}

export function showWarning(message: string, duration?: number): string {
  return showToast({ message, variant: 'warning', duration });
}

export function showInfo(message: string, duration?: number): string {
  return showToast({ message, variant: 'info', duration });
}
```

### Dropdown Component Design

```typescript
// shared/ui-components/src/composites/Dropdown.ts
import { cn } from '../utils/cn';
import { computePosition, flip, shift, offset } from '@floating-ui/dom';

export interface DropdownItem {
  /** Unique ID */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon */
  icon?: string;
  /** Optional keyboard shortcut */
  shortcut?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Separator before this item */
  separator?: boolean;
}

export interface DropdownProps {
  /** Dropdown items */
  items: DropdownItem[];
  /** Trigger element */
  trigger: HTMLElement;
  /** Trigger on right-click (context menu mode) */
  contextMenu?: boolean;
  /** Callback when item selected */
  onSelect: (item: DropdownItem) => void;
  /** Additional CSS classes for menu */
  className?: string;
}

export interface DropdownInstance {
  /** Open the dropdown */
  open: (x?: number, y?: number) => void;
  /** Close the dropdown */
  close: () => void;
  /** Check if open */
  isOpen: () => boolean;
  /** Destroy and clean up */
  destroy: () => void;
}

/**
 * Create a Dropdown instance.
 */
export function Dropdown(props: DropdownProps): DropdownInstance {
  const { items, trigger, contextMenu = false, onSelect, className } = props;

  let menu: HTMLElement | null = null;
  let isOpen = false;
  let focusedIndex = -1;

  function createMenu(): HTMLElement {
    const el = document.createElement('div');
    el.className = cn(
      'fixed z-50 min-w-48 py-1',
      'bg-background border border-border rounded-lg shadow-lg',
      'animate-in fade-in-0 zoom-in-95',
      className
    );
    el.setAttribute('role', 'menu');

    items.forEach((item, index) => {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.className = 'h-px my-1 bg-border';
        el.appendChild(sep);
      }

      const button = document.createElement('button');
      button.className = cn(
        'w-full flex items-center gap-3 px-3 py-2 text-sm',
        'hover:bg-muted focus:bg-muted outline-none',
        item.disabled && 'opacity-50 cursor-not-allowed'
      );
      button.setAttribute('role', 'menuitem');
      button.setAttribute('data-index', String(index));
      button.disabled = item.disabled || false;

      button.innerHTML = `
        ${item.icon ? `<span class="w-4 h-4">${item.icon}</span>` : ''}
        <span class="flex-1 text-left">${item.label}</span>
        ${item.shortcut ? `<span class="text-xs text-muted-foreground">${item.shortcut}</span>` : ''}
      `;

      button.addEventListener('click', () => {
        if (!item.disabled) {
          onSelect(item);
          close();
        }
      });

      el.appendChild(button);
    });

    return el;
  }

  async function open(x?: number, y?: number) {
    if (isOpen) return;
    isOpen = true;
    focusedIndex = -1;

    menu = createMenu();
    document.body.appendChild(menu);

    if (contextMenu && x !== undefined && y !== undefined) {
      // Position at cursor for context menu
      menu.style.left = `${x}px`;
      menu.style.top = `${y}px`;

      // Adjust if outside viewport
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        menu.style.left = `${window.innerWidth - rect.width - 8}px`;
      }
      if (rect.bottom > window.innerHeight) {
        menu.style.top = `${window.innerHeight - rect.height - 8}px`;
      }
    } else {
      // Position relative to trigger
      const { x: posX, y: posY } = await computePosition(trigger, menu, {
        placement: 'bottom-start',
        middleware: [offset(4), flip(), shift({ padding: 8 })],
      });
      menu.style.left = `${posX}px`;
      menu.style.top = `${posY}px`;
    }

    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
  }

  function close() {
    if (!isOpen || !menu) return;
    isOpen = false;

    menu.classList.add('animate-out', 'fade-out-0', 'zoom-out-95');
    menu.addEventListener('animationend', () => menu?.remove());

    document.removeEventListener('click', handleOutsideClick);
    document.removeEventListener('keydown', handleKeyDown);
    menu = null;
  }

  function handleOutsideClick(e: MouseEvent) {
    if (menu && !menu.contains(e.target as Node) && !trigger.contains(e.target as Node)) {
      close();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!menu) return;

    const buttons = menu.querySelectorAll<HTMLButtonElement>('button:not([disabled])');

    switch (e.key) {
      case 'Escape':
        close();
        trigger.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        focusedIndex = (focusedIndex + 1) % buttons.length;
        buttons[focusedIndex]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusedIndex = focusedIndex <= 0 ? buttons.length - 1 : focusedIndex - 1;
        buttons[focusedIndex]?.focus();
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0) {
          buttons[focusedIndex]?.click();
        }
        break;
    }
  }

  // Attach trigger events
  if (contextMenu) {
    trigger.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      open(e.clientX, e.clientY);
    });
  } else {
    trigger.addEventListener('click', () => {
      isOpen ? close() : open();
    });
  }

  function destroy() {
    close();
  }

  return { open, close, isOpen: () => isOpen, destroy };
}
```

## Tasks / Subtasks

- [ ] **Task 1: Install @floating-ui/dom** (AC: positioning)
  - [ ] Add `@floating-ui/dom` to shared/ui-components/package.json
  - [ ] Run npm install
  - [ ] Verify TypeScript types available

- [ ] **Task 2: Create Modal component** (AC: Modal)
  - [ ] Create `shared/ui-components/src/composites/Modal.ts`
  - [ ] Implement header/content/footer sections
  - [ ] Implement ESC key handling
  - [ ] Implement backdrop click handling
  - [ ] Implement focus trap
  - [ ] Implement open/close/destroy methods
  - [ ] Export `ModalProps`, `ModalInstance`

- [ ] **Task 3: Create Toast component** (AC: Toast)
  - [ ] Create `shared/ui-components/src/composites/Toast.ts`
  - [ ] Implement 4 variants (success, error, warning, info)
  - [ ] Implement auto-dismiss with configurable duration
  - [ ] Implement toast stacking
  - [ ] Implement close button
  - [ ] Implement animations (slide in/out)
  - [ ] Export `ToastOptions`, `ToastManager`, convenience functions

- [ ] **Task 4: Create Dropdown component** (AC: Dropdown)
  - [ ] Create `shared/ui-components/src/composites/Dropdown.ts`
  - [ ] Implement click trigger mode
  - [ ] Implement context menu mode (right-click)
  - [ ] Implement keyboard navigation
  - [ ] Implement intelligent positioning with @floating-ui
  - [ ] Implement outside click closing
  - [ ] Export `DropdownProps`, `DropdownItem`, `DropdownInstance`

- [ ] **Task 5: Create Tooltip component** (AC: Tooltip)
  - [ ] Create `shared/ui-components/src/composites/Tooltip.ts`
  - [ ] Implement 4 positions (top, right, bottom, left)
  - [ ] Implement show delay
  - [ ] Implement intelligent positioning
  - [ ] Support text and custom content
  - [ ] Export `TooltipProps`, `TooltipInstance`

- [ ] **Task 6: Create barrel export** (AC: General)
  - [ ] Create `shared/ui-components/src/composites/index.ts`
  - [ ] Export all components and types
  - [ ] Update main index.ts to include composites

- [ ] **Task 7: Add animation utilities** (AC: Toast animations)
  - [ ] Add Tailwind animation config for slide-in/out
  - [ ] Add fade-in/out animations
  - [ ] Add zoom-in/out animations

- [ ] **Task 8: Write unit tests** (AC: all have unit tests)
  - [ ] Create `shared/ui-components/src/composites/__tests__/Modal.test.ts`
  - [ ] Create `shared/ui-components/src/composites/__tests__/Toast.test.ts`
  - [ ] Create `shared/ui-components/src/composites/__tests__/Dropdown.test.ts`
  - [ ] Create `shared/ui-components/src/composites/__tests__/Tooltip.test.ts`
  - [ ] Test keyboard interactions
  - [ ] Test accessibility attributes

- [ ] **Task 9: Verify cross-environment compatibility** (AC: both environments)
  - [ ] Test in Electron project
  - [ ] Test in browser-app project
  - [ ] Verify animations work
  - [ ] Verify positioning works

## Dev Notes

### Migration Path from Existing Components

**browser-app/src/components/Toast.ts** → **shared/ui-components/src/composites/Toast.ts**
- Current: Module-level state, injected CSS
- New: ToastManager pattern, Tailwind classes, CSS variables
- Migration: Replace `showToast()` imports with shared version

**browser-app/src/components/ContextMenu.ts** → **shared/ui-components/src/composites/Dropdown.ts**
- Current: PII-specific context menu with entity types
- New: Generic Dropdown with item configuration
- Migration: Keep PII-specific wrapper in browser-app that uses generic Dropdown

[Source: browser-app/src/components/Toast.ts]
[Source: browser-app/src/components/ContextMenu.ts]

### Accessibility Requirements

| Component | Requirement |
|-----------|-------------|
| Modal | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trap |
| Toast | `role="alert"`, `aria-live="polite"` |
| Dropdown | `role="menu"`, `role="menuitem"`, keyboard navigation |
| Tooltip | `role="tooltip"`, proper aria-describedby linking |

### Animation Classes (Tailwind Config)

```javascript
// Add to tailwind preset
{
  animation: {
    'in': 'in 0.2s ease-out',
    'out': 'out 0.15s ease-in forwards',
    'slide-in-from-right': 'slide-in-from-right 0.2s ease-out',
    'slide-out-to-right': 'slide-out-to-right 0.15s ease-in forwards',
  },
  keyframes: {
    'in': {
      from: { opacity: 0, transform: 'scale(0.95)' },
      to: { opacity: 1, transform: 'scale(1)' },
    },
    'slide-in-from-right': {
      from: { opacity: 0, transform: 'translateX(100%)' },
      to: { opacity: 1, transform: 'translateX(0)' },
    },
  },
}
```

### Prerequisites

- Story 9.1: Shared Tailwind Config (CSS variables)
- Story 9.2: Core UI Library Setup (cn() utility)
- Story 9.3: Primitive Components (Button for Modal footer)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-9.md#Composite-Components]
- [Source: docs/epics.md#Story-9.4]
- @floating-ui/dom: https://floating-ui.com/docs/getting-started
- [Source: browser-app/src/components/Toast.ts] - Existing toast to migrate
- [Source: browser-app/src/components/ContextMenu.ts] - Existing dropdown to migrate

## Definition of Done

- [ ] Modal component with focus trap and keyboard handling
- [ ] Toast system with 4 variants and stacking
- [ ] Dropdown with click and context menu modes
- [ ] Tooltip with 4 positions and delay
- [ ] @floating-ui/dom integrated for positioning
- [ ] Animation utilities added to Tailwind config
- [ ] All components exported from composites/index.ts
- [ ] Unit tests for each component
- [ ] Accessibility attributes on all components
- [ ] TypeScript compiles without errors
- [ ] Components work in Electron project
- [ ] Components work in browser-app project

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
