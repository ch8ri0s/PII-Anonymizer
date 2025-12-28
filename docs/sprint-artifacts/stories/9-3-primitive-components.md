# Story 9.3: Primitive Components (Button, Badge, Card, Input, Checkbox)

## Story

As a **developer building UI features**,
I want **a set of primitive UI components with consistent styling and variants**,
So that **I can compose higher-level interfaces with predictable, accessible, and typed components**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 9.3 |
| **Epic** | 9 - UI Harmonization (Tailwind + shadcn) |
| **Status** | ready-for-dev |
| **Created** | 2025-12-26 |

## Acceptance Criteria

### Button Component
**Given** the need for interactive buttons
**When** I use the Button component
**Then** it supports variants: `primary`, `secondary`, `ghost`, `destructive`, `outline`, `link`
**And** it supports sizes: `sm`, `md`, `lg`
**And** it supports states: default, hover, active, disabled, loading
**And** it supports icon placement (left/right)

### Badge Component
**Given** the need for status indicators and labels
**When** I use the Badge component
**Then** it supports variants: `default`, `success`, `warning`, `error`, `info`, `outline`
**And** entity type badges are styled consistently (PERSON, ORG, ADDRESS, EMAIL, PHONE, DATE, etc.)

### Card Component
**Given** the need for content containers
**When** I use the Card component
**Then** it has `header`, `content`, `footer` slots
**And** it supports variants: `default`, `outlined`, `elevated`

### Input Component
**Given** the need for text input
**When** I use the Input component
**Then** it supports `label`, `error`, `helperText`, and icon props
**And** it supports types: `text`, `email`, `password`, `number`, `search`

### Checkbox & Toggle Components
**Given** the need for boolean controls
**When** I use Checkbox or Toggle components
**Then** they support label placement and disabled state

### General Requirements
**And** all components have unit tests
**And** all components are fully typed with exported props types
**And** all components work in both Electron and browser environments
**And** all components use the `cn()` utility for class composition
**And** all components use CVA for variant handling

## Technical Design

### Files to Create

| File | Purpose |
|------|---------|
| `shared/ui-components/src/primitives/Button.ts` | Button component with CVA variants |
| `shared/ui-components/src/primitives/Badge.ts` | Badge component with color variants |
| `shared/ui-components/src/primitives/Card.ts` | Card container with slots |
| `shared/ui-components/src/primitives/Input.ts` | Text input with label/error |
| `shared/ui-components/src/primitives/Checkbox.ts` | Checkbox with label |
| `shared/ui-components/src/primitives/Toggle.ts` | Toggle switch |
| `shared/ui-components/src/primitives/index.ts` | Barrel export |

### Button Component Design

```typescript
// shared/ui-components/src/primitives/Button.ts
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

export const buttonVariants = cva(
  // Base classes applied to all buttons
  'inline-flex items-center justify-center rounded-md font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps extends VariantProps<typeof buttonVariants> {
  /** Button label text */
  label: string;
  /** Click handler */
  onClick?: (event: MouseEvent) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Icon element to show on the left */
  iconLeft?: string | HTMLElement;
  /** Icon element to show on the right */
  iconRight?: string | HTMLElement;
  /** Loading state - shows spinner and disables */
  loading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Button type attribute */
  type?: 'button' | 'submit' | 'reset';
}

/**
 * Create a Button element with variant styling.
 *
 * @example
 * const btn = Button({ variant: 'primary', size: 'md', label: 'Save' });
 * container.appendChild(btn);
 */
export function Button(props: ButtonProps): HTMLButtonElement {
  const {
    label,
    variant,
    size,
    onClick,
    disabled = false,
    loading = false,
    iconLeft,
    iconRight,
    className,
    type = 'button',
  } = props;

  const button = document.createElement('button');
  button.type = type;
  button.className = cn(
    buttonVariants({ variant, size }),
    loading && 'cursor-wait',
    className
  );
  button.disabled = disabled || loading;

  // Build inner content
  if (loading) {
    const spinner = createSpinner();
    button.appendChild(spinner);
  } else if (iconLeft) {
    button.appendChild(typeof iconLeft === 'string' ? createIcon(iconLeft) : iconLeft);
  }

  const textSpan = document.createElement('span');
  textSpan.textContent = label;
  button.appendChild(textSpan);

  if (!loading && iconRight) {
    button.appendChild(typeof iconRight === 'string' ? createIcon(iconRight) : iconRight);
  }

  if (onClick) {
    button.addEventListener('click', onClick);
  }

  return button;
}

function createSpinner(): HTMLElement {
  const spinner = document.createElement('span');
  spinner.className = 'animate-spin h-4 w-4 mr-2';
  spinner.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
    <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
  </svg>`;
  return spinner;
}

function createIcon(name: string): HTMLElement {
  const icon = document.createElement('span');
  icon.className = 'w-4 h-4';
  icon.setAttribute('data-icon', name);
  return icon;
}
```

### Badge Component Design

```typescript
// shared/ui-components/src/primitives/Badge.ts
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

export const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary',
        success: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        outline: 'border border-current bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  /** Badge text content */
  text: string;
  /** Additional CSS classes */
  className?: string;
}

export function Badge(props: BadgeProps): HTMLSpanElement {
  const { text, variant, className } = props;

  const badge = document.createElement('span');
  badge.className = cn(badgeVariants({ variant }), className);
  badge.textContent = text;

  return badge;
}
```

### Card Component Design

```typescript
// shared/ui-components/src/primitives/Card.ts
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

export const cardVariants = cva(
  'rounded-lg bg-card text-card-foreground',
  {
    variants: {
      variant: {
        default: 'border border-border',
        outlined: 'border-2 border-border',
        elevated: 'shadow-lg border border-border/50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface CardProps extends VariantProps<typeof cardVariants> {
  /** Card header content (optional) */
  header?: string | HTMLElement;
  /** Card body content */
  content: string | HTMLElement;
  /** Card footer content (optional) */
  footer?: string | HTMLElement;
  /** Additional CSS classes */
  className?: string;
}

export function Card(props: CardProps): HTMLDivElement {
  const { header, content, footer, variant, className } = props;

  const card = document.createElement('div');
  card.className = cn(cardVariants({ variant }), className);

  if (header) {
    const headerEl = document.createElement('div');
    headerEl.className = 'px-4 py-3 border-b border-border bg-muted/50';
    if (typeof header === 'string') {
      headerEl.innerHTML = `<h3 class="font-semibold">${header}</h3>`;
    } else {
      headerEl.appendChild(header);
    }
    card.appendChild(headerEl);
  }

  const contentEl = document.createElement('div');
  contentEl.className = 'p-4';
  if (typeof content === 'string') {
    contentEl.textContent = content;
  } else {
    contentEl.appendChild(content);
  }
  card.appendChild(contentEl);

  if (footer) {
    const footerEl = document.createElement('div');
    footerEl.className = 'px-4 py-3 border-t border-border bg-muted/30';
    if (typeof footer === 'string') {
      footerEl.textContent = footer;
    } else {
      footerEl.appendChild(footer);
    }
    card.appendChild(footerEl);
  }

  return card;
}
```

### Input Component Design

```typescript
// shared/ui-components/src/primitives/Input.ts
import { cn } from '../utils/cn';

export interface InputProps {
  /** Input name attribute */
  name: string;
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'search';
  /** Label text (optional) */
  label?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Current value */
  value?: string;
  /** Error message (shows error state) */
  error?: string;
  /** Helper text below input */
  helperText?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required field */
  required?: boolean;
  /** Icon on the left */
  iconLeft?: string | HTMLElement;
  /** Icon on the right */
  iconRight?: string | HTMLElement;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Additional CSS classes for input */
  className?: string;
}

export function Input(props: InputProps): HTMLDivElement {
  const {
    name,
    type = 'text',
    label,
    placeholder,
    value = '',
    error,
    helperText,
    disabled = false,
    required = false,
    iconLeft,
    iconRight,
    onChange,
    className,
  } = props;

  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col gap-1.5';

  // Label
  if (label) {
    const labelEl = document.createElement('label');
    labelEl.htmlFor = name;
    labelEl.className = cn(
      'text-sm font-medium',
      error ? 'text-destructive' : 'text-foreground'
    );
    labelEl.textContent = label + (required ? ' *' : '');
    wrapper.appendChild(labelEl);
  }

  // Input container
  const inputContainer = document.createElement('div');
  inputContainer.className = 'relative';

  // Input element
  const input = document.createElement('input');
  input.type = type;
  input.name = name;
  input.id = name;
  input.value = value;
  input.placeholder = placeholder || '';
  input.disabled = disabled;
  input.required = required;
  input.className = cn(
    'flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm',
    'file:border-0 file:bg-transparent file:text-sm file:font-medium',
    'placeholder:text-muted-foreground',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:cursor-not-allowed disabled:opacity-50',
    error ? 'border-destructive' : 'border-input',
    iconLeft && 'pl-10',
    iconRight && 'pr-10',
    className
  );

  if (onChange) {
    input.addEventListener('input', () => onChange(input.value));
  }

  inputContainer.appendChild(input);

  // Icons
  if (iconLeft) {
    const leftIcon = document.createElement('span');
    leftIcon.className = 'absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground';
    if (typeof iconLeft === 'string') {
      leftIcon.setAttribute('data-icon', iconLeft);
    } else {
      leftIcon.appendChild(iconLeft);
    }
    inputContainer.appendChild(leftIcon);
  }

  if (iconRight) {
    const rightIcon = document.createElement('span');
    rightIcon.className = 'absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground';
    if (typeof iconRight === 'string') {
      rightIcon.setAttribute('data-icon', iconRight);
    } else {
      rightIcon.appendChild(iconRight);
    }
    inputContainer.appendChild(rightIcon);
  }

  wrapper.appendChild(inputContainer);

  // Error or helper text
  if (error || helperText) {
    const hint = document.createElement('p');
    hint.className = cn(
      'text-xs',
      error ? 'text-destructive' : 'text-muted-foreground'
    );
    hint.textContent = error || helperText || '';
    wrapper.appendChild(hint);
  }

  return wrapper;
}
```

## Tasks / Subtasks

- [ ] **Task 1: Create Button component** (AC: Button)
  - [ ] Create `shared/ui-components/src/primitives/Button.ts`
  - [ ] Implement `buttonVariants` with CVA (6 variants, 3 sizes)
  - [ ] Implement `Button()` factory function
  - [ ] Add loading spinner support
  - [ ] Add icon support (left/right)
  - [ ] Export `ButtonProps` type

- [ ] **Task 2: Create Badge component** (AC: Badge)
  - [ ] Create `shared/ui-components/src/primitives/Badge.ts`
  - [ ] Implement `badgeVariants` with CVA (6 variants)
  - [ ] Implement `Badge()` factory function
  - [ ] Export `BadgeProps` type

- [ ] **Task 3: Create Card component** (AC: Card)
  - [ ] Create `shared/ui-components/src/primitives/Card.ts`
  - [ ] Implement `cardVariants` with CVA (3 variants)
  - [ ] Implement `Card()` factory function with header/content/footer
  - [ ] Export `CardProps` type

- [ ] **Task 4: Create Input component** (AC: Input)
  - [ ] Create `shared/ui-components/src/primitives/Input.ts`
  - [ ] Implement `Input()` factory function
  - [ ] Support label, error, helperText
  - [ ] Support left/right icons
  - [ ] Support all input types (text, email, password, number, search)
  - [ ] Export `InputProps` type

- [ ] **Task 5: Create Checkbox component** (AC: Checkbox & Toggle)
  - [ ] Create `shared/ui-components/src/primitives/Checkbox.ts`
  - [ ] Implement checkbox with custom styling
  - [ ] Support label placement (left/right)
  - [ ] Export `CheckboxProps` type

- [ ] **Task 6: Create Toggle component** (AC: Checkbox & Toggle)
  - [ ] Create `shared/ui-components/src/primitives/Toggle.ts`
  - [ ] Implement toggle switch styling
  - [ ] Support label and disabled state
  - [ ] Export `ToggleProps` type

- [ ] **Task 7: Create barrel export** (AC: General)
  - [ ] Create `shared/ui-components/src/primitives/index.ts`
  - [ ] Export all components and their props types
  - [ ] Update `shared/ui-components/src/index.ts` to include primitives

- [ ] **Task 8: Write unit tests** (AC: all components have tests)
  - [ ] Create `shared/ui-components/src/primitives/__tests__/Button.test.ts`
  - [ ] Create `shared/ui-components/src/primitives/__tests__/Badge.test.ts`
  - [ ] Create `shared/ui-components/src/primitives/__tests__/Card.test.ts`
  - [ ] Create `shared/ui-components/src/primitives/__tests__/Input.test.ts`
  - [ ] Create `shared/ui-components/src/primitives/__tests__/Checkbox.test.ts`
  - [ ] Create `shared/ui-components/src/primitives/__tests__/Toggle.test.ts`
  - [ ] Test variant application
  - [ ] Test event handlers
  - [ ] Test disabled states

- [ ] **Task 9: Verify cross-environment compatibility** (AC: both environments)
  - [ ] Test import in Electron project
  - [ ] Test import in browser-app project
  - [ ] Verify DOM elements render correctly
  - [ ] Verify styling applies with Tailwind

## Dev Notes

### Component Pattern

All primitives follow the same factory function pattern:

```typescript
export function ComponentName(props: ComponentProps): HTMLElement {
  // 1. Create root element
  const element = document.createElement('tag');

  // 2. Apply classes using cn() + CVA variants
  element.className = cn(componentVariants({ variant }), props.className);

  // 3. Set attributes and content

  // 4. Attach event handlers

  // 5. Return element
  return element;
}
```

### Accessibility Checklist

- [ ] All interactive elements have focus states
- [ ] Buttons have proper `type` attribute
- [ ] Inputs have associated labels (via `htmlFor`)
- [ ] Disabled states prevent interaction
- [ ] Color contrast meets WCAG AA (4.5:1)

### Current Browser-App Components to Replace

| Current | New Component |
|---------|---------------|
| `.badge` class in `components.css` | `Badge()` |
| `.result-card` class in `components.css` | `Card()` |
| `.file-item-remove` button | `Button({ variant: 'ghost' })` |
| Inline button styles | `Button()` |

[Source: browser-app/src/styles/components.css]

### Prerequisites

- Story 9.1: Shared Tailwind Config (CSS variables)
- Story 9.2: Core UI Library Setup (cn() utility, CVA)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-9.md#Data-Models-and-Contracts]
- [Source: docs/epics.md#Story-9.3]
- [Source: browser-app/src/styles/components.css] - Current badge/card styles to migrate

## Definition of Done

- [ ] Button component with 6 variants and 3 sizes
- [ ] Badge component with 6 variants
- [ ] Card component with header/content/footer
- [ ] Input component with label/error/icons
- [ ] Checkbox component with label
- [ ] Toggle component with label
- [ ] All components exported from `primitives/index.ts`
- [ ] All props types exported
- [ ] Unit tests for each component
- [ ] TypeScript compiles without errors
- [ ] Components work in Electron project
- [ ] Components work in browser-app project
- [ ] Focus states visible on all interactive elements

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
