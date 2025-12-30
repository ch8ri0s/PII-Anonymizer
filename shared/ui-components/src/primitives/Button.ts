import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn.js';

/**
 * Button component variants using Class Variance Authority.
 *
 * Base styles applied to all buttons, with variants for visual style and size.
 */
export const buttonVariants = cva(
  // Base styles - applied to all buttons
  [
    'inline-flex',
    'items-center',
    'justify-center',
    'gap-2',
    'whitespace-nowrap',
    'rounded-lg',
    'font-medium',
    'transition-all',
    'duration-200',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-offset-2',
    'disabled:pointer-events-none',
    'disabled:opacity-50',
    'disabled:cursor-not-allowed',
  ],
  {
    variants: {
      /**
       * Visual style variant
       */
      variant: {
        primary: [
          'bg-primary',
          'text-primary-foreground',
          'hover:bg-primary/90',
          'focus:ring-primary',
          'shadow-sm',
          'hover:shadow',
        ],
        secondary: [
          'bg-secondary',
          'text-secondary-foreground',
          'hover:bg-secondary/80',
          'focus:ring-secondary',
          'border',
          'border-border',
        ],
        destructive: [
          'bg-destructive',
          'text-destructive-foreground',
          'hover:bg-destructive/90',
          'focus:ring-destructive',
          'shadow-sm',
        ],
        outline: [
          'border',
          'border-input',
          'bg-background',
          'hover:bg-accent',
          'hover:text-accent-foreground',
          'focus:ring-ring',
        ],
        ghost: [
          'hover:bg-accent',
          'hover:text-accent-foreground',
          'focus:ring-ring',
        ],
        link: [
          'text-primary',
          'underline-offset-4',
          'hover:underline',
          'focus:ring-0',
        ],
      },
      /**
       * Size variant
       */
      size: {
        sm: ['h-8', 'px-3', 'text-sm'],
        md: ['h-10', 'px-4', 'text-sm'],
        lg: ['h-12', 'px-6', 'text-base'],
        icon: ['h-10', 'w-10', 'p-0'],
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

/**
 * Button props interface
 */
export interface ButtonProps extends VariantProps<typeof buttonVariants> {
  /** Button text content */
  label?: string;
  /** Icon element to display (optional) */
  icon?: HTMLElement | SVGElement;
  /** Icon position relative to label */
  iconPosition?: 'left' | 'right';
  /** Additional CSS classes */
  className?: string;
  /** Button type attribute */
  type?: 'button' | 'submit' | 'reset';
  /** Disabled state */
  disabled?: boolean;
  /** Click handler */
  onClick?: (event: MouseEvent) => void;
  /** Accessible label */
  ariaLabel?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Creates a Button element with the specified props.
 *
 * @param props - Button configuration
 * @returns HTMLButtonElement
 *
 * @example
 * ```typescript
 * // Primary button
 * const btn = Button({ label: 'Click me' });
 * container.appendChild(btn);
 *
 * // Secondary button with icon
 * const saveBtn = Button({
 *   variant: 'secondary',
 *   label: 'Save',
 *   icon: createSaveIcon(),
 *   onClick: handleSave,
 * });
 * ```
 */
export function Button(props: ButtonProps): HTMLButtonElement {
  const {
    label,
    icon,
    iconPosition = 'left',
    className,
    type = 'button',
    disabled = false,
    variant,
    size,
    onClick,
    ariaLabel,
    testId,
  } = props;

  const button = document.createElement('button');

  // Apply variant classes
  button.className = cn(buttonVariants({ variant, size }), className);

  // Set attributes
  button.type = type;
  button.disabled = disabled;

  if (ariaLabel) {
    button.setAttribute('aria-label', ariaLabel);
  }

  if (testId) {
    button.setAttribute('data-testid', testId);
  }

  // Add icon and label
  if (icon && iconPosition === 'left') {
    button.appendChild(icon.cloneNode(true));
  }

  if (label) {
    const span = document.createElement('span');
    span.textContent = label;
    button.appendChild(span);
  }

  if (icon && iconPosition === 'right') {
    button.appendChild(icon.cloneNode(true));
  }

  // Attach event handler
  if (onClick) {
    button.addEventListener('click', onClick);
  }

  return button;
}

/**
 * Update an existing button's properties
 */
export function updateButton(
  button: HTMLButtonElement,
  props: Partial<ButtonProps>
): void {
  const { label, disabled, className, variant, size } = props;

  if (typeof disabled === 'boolean') {
    button.disabled = disabled;
  }

  if (className !== undefined || variant !== undefined || size !== undefined) {
    button.className = cn(
      buttonVariants({ variant, size }),
      className
    );
  }

  if (label !== undefined) {
    // Find and update the label span
    const span = button.querySelector('span');
    if (span) {
      span.textContent = label;
    }
  }
}
