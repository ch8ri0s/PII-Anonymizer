import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn.js';

/**
 * Input field variants
 */
export const inputVariants = cva(
  [
    'flex',
    'w-full',
    'rounded-lg',
    'border',
    'bg-background',
    'text-foreground',
    'transition-colors',
    'file:border-0',
    'file:bg-transparent',
    'file:text-sm',
    'file:font-medium',
    'placeholder:text-muted-foreground',
    'focus:outline-none',
    'focus:ring-2',
    'focus:ring-ring',
    'focus:ring-offset-2',
    'disabled:cursor-not-allowed',
    'disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        default: ['border-input'],
        error: ['border-destructive', 'focus:ring-destructive'],
        success: ['border-success', 'focus:ring-success'],
      },
      size: {
        sm: ['h-8', 'px-3', 'text-sm'],
        md: ['h-10', 'px-4', 'text-sm'],
        lg: ['h-12', 'px-4', 'text-base'],
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

/**
 * Input props interface
 */
export interface InputProps extends VariantProps<typeof inputVariants> {
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  /** Input name attribute */
  name?: string;
  /** Input ID */
  id?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Current value */
  value?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Required attribute */
  required?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Input event handler */
  onInput?: (event: Event) => void;
  /** Change event handler */
  onChange?: (event: Event) => void;
  /** Focus event handler */
  onFocus?: (event: FocusEvent) => void;
  /** Blur event handler */
  onBlur?: (event: FocusEvent) => void;
  /** Test ID for testing */
  testId?: string;
  /** Accessible label */
  ariaLabel?: string;
  /** Autocomplete attribute */
  autocomplete?: string;
}

/**
 * Creates an Input element.
 *
 * @param props - Input configuration
 * @returns HTMLInputElement
 */
export function Input(props: InputProps = {}): HTMLInputElement {
  const {
    type = 'text',
    name,
    id,
    placeholder,
    value,
    disabled = false,
    required = false,
    className,
    variant,
    size,
    onInput,
    onChange,
    onFocus,
    onBlur,
    testId,
    ariaLabel,
    autocomplete,
  } = props;

  const input = document.createElement('input');
  input.type = type;
  input.className = cn(inputVariants({ variant, size }), className);

  if (name) input.name = name;
  if (id) input.id = id;
  if (placeholder) input.placeholder = placeholder;
  if (value !== undefined) input.value = value;
  if (disabled) input.disabled = true;
  if (required) input.required = true;
  if (ariaLabel) input.setAttribute('aria-label', ariaLabel);
  if (testId) input.setAttribute('data-testid', testId);
  if (autocomplete) input.setAttribute('autocomplete', autocomplete);

  // Attach event handlers
  if (onInput) input.addEventListener('input', onInput);
  if (onChange) input.addEventListener('change', onChange);
  if (onFocus) input.addEventListener('focus', onFocus);
  if (onBlur) input.addEventListener('blur', onBlur);

  return input;
}

/**
 * Input field with label, helper text, and error message
 */
export interface InputFieldProps extends InputProps {
  /** Label text */
  label?: string;
  /** Helper text shown below input */
  helperText?: string;
  /** Error message (sets variant to error automatically) */
  error?: string;
  /** Icon element to display inside input */
  icon?: HTMLElement | SVGElement;
  /** Icon position */
  iconPosition?: 'left' | 'right';
  /** Test ID for the field container */
  fieldTestId?: string;
}

/**
 * Creates a complete input field with label, helper text, and error display.
 *
 * @param props - Input field configuration
 * @returns HTMLDivElement containing label, input, and helper/error text
 *
 * @example
 * ```typescript
 * const emailField = InputField({
 *   label: 'Email',
 *   type: 'email',
 *   placeholder: 'you@example.com',
 *   required: true,
 * });
 *
 * // With error
 * const errorField = InputField({
 *   label: 'Password',
 *   type: 'password',
 *   error: 'Password is required',
 * });
 * ```
 */
export function InputField(props: InputFieldProps): HTMLDivElement {
  const {
    label,
    helperText,
    error,
    icon,
    iconPosition = 'left',
    id,
    fieldTestId,
    ...inputProps
  } = props;

  const fieldId = id || `input-${Math.random().toString(36).substring(7)}`;
  const descriptionId = `${fieldId}-description`;
  const container = document.createElement('div');
  container.className = 'space-y-2';

  if (fieldTestId) {
    container.setAttribute('data-testid', fieldTestId);
  }

  // Label
  if (label) {
    const labelEl = document.createElement('label');
    labelEl.htmlFor = fieldId;
    labelEl.className = 'text-sm font-medium text-foreground block';
    labelEl.textContent = label;

    if (inputProps.required) {
      const asterisk = document.createElement('span');
      asterisk.className = 'text-destructive ml-1';
      asterisk.textContent = '*';
      labelEl.appendChild(asterisk);
    }

    container.appendChild(labelEl);
  }

  // Input wrapper (for icons)
  const inputWrapper = document.createElement('div');
  inputWrapper.className = 'relative';

  // Icon
  if (icon) {
    const iconWrapper = document.createElement('div');
    iconWrapper.className = cn(
      'absolute top-1/2 -translate-y-1/2 text-muted-foreground',
      iconPosition === 'left' ? 'left-3' : 'right-3'
    );
    const iconClone = icon.cloneNode(true) as HTMLElement;
    iconClone.classList.add('w-4', 'h-4');
    iconWrapper.appendChild(iconClone);
    inputWrapper.appendChild(iconWrapper);
  }

  // Input
  const input = Input({
    ...inputProps,
    id: fieldId,
    variant: error ? 'error' : inputProps.variant,
    className: cn(
      icon && iconPosition === 'left' && 'pl-10',
      icon && iconPosition === 'right' && 'pr-10',
      inputProps.className
    ),
  });

  // Add aria-describedby if there's helper text or error
  if (error || helperText) {
    input.setAttribute('aria-describedby', descriptionId);
  }

  // Add aria-invalid if there's an error
  if (error) {
    input.setAttribute('aria-invalid', 'true');
  }

  inputWrapper.appendChild(input);
  container.appendChild(inputWrapper);

  // Error or helper text
  if (error) {
    const errorEl = document.createElement('p');
    errorEl.id = descriptionId;
    errorEl.className = 'text-sm text-destructive';
    errorEl.setAttribute('role', 'alert');
    errorEl.textContent = error;
    container.appendChild(errorEl);
  } else if (helperText) {
    const helperEl = document.createElement('p');
    helperEl.id = descriptionId;
    helperEl.className = 'text-sm text-muted-foreground';
    helperEl.textContent = helperText;
    container.appendChild(helperEl);
  }

  return container;
}
