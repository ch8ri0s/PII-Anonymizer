import { cn } from '../utils/cn.js';

/**
 * Toggle/Switch props interface
 */
export interface ToggleProps {
  /** Toggle ID */
  id?: string;
  /** Toggle name */
  name?: string;
  /** Checked/on state */
  checked?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
  /** Change event handler */
  onChange?: (checked: boolean) => void;
  /** Test ID for testing */
  testId?: string;
  /** Accessible label */
  ariaLabel?: string;
}

/**
 * Creates a Toggle/Switch element.
 *
 * @param props - Toggle configuration
 * @returns HTMLButtonElement (button acting as toggle)
 *
 * @example
 * ```typescript
 * const toggle = Toggle({
 *   checked: true,
 *   onChange: (checked) => console.log('Toggle:', checked),
 * });
 * ```
 */
export function Toggle(props: ToggleProps = {}): HTMLButtonElement {
  const {
    id,
    name,
    checked = false,
    disabled = false,
    className,
    onChange,
    testId,
    ariaLabel,
  } = props;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(checked));

  if (id) toggle.id = id;
  if (name) toggle.setAttribute('data-name', name);
  if (ariaLabel) toggle.setAttribute('aria-label', ariaLabel);
  if (testId) toggle.setAttribute('data-testid', testId);
  toggle.disabled = disabled;

  // Track state
  let isChecked = checked;

  // Update classes based on state
  const updateStyles = () => {
    toggle.className = cn(
      // Base styles
      'relative',
      'inline-flex',
      'h-6',
      'w-11',
      'shrink-0',
      'cursor-pointer',
      'items-center',
      'rounded-full',
      'border-2',
      'border-transparent',
      'transition-colors',
      'duration-200',
      'ease-in-out',
      'focus:outline-none',
      'focus:ring-2',
      'focus:ring-ring',
      'focus:ring-offset-2',
      'disabled:cursor-not-allowed',
      'disabled:opacity-50',
      // State-based background
      isChecked ? 'bg-primary' : 'bg-input',
      className
    );
    toggle.setAttribute('aria-checked', String(isChecked));
  };

  updateStyles();

  // Create the thumb element
  const thumb = document.createElement('span');
  thumb.setAttribute('aria-hidden', 'true');
  thumb.className = cn(
    'pointer-events-none',
    'inline-block',
    'h-5',
    'w-5',
    'rounded-full',
    'bg-background',
    'shadow',
    'ring-0',
    'transition-transform',
    'duration-200',
    'ease-in-out',
    isChecked ? 'translate-x-5' : 'translate-x-0'
  );
  toggle.appendChild(thumb);

  // Handle click
  toggle.addEventListener('click', () => {
    if (disabled) return;

    isChecked = !isChecked;
    updateStyles();

    // Update thumb position
    thumb.className = cn(
      'pointer-events-none',
      'inline-block',
      'h-5',
      'w-5',
      'rounded-full',
      'bg-background',
      'shadow',
      'ring-0',
      'transition-transform',
      'duration-200',
      'ease-in-out',
      isChecked ? 'translate-x-5' : 'translate-x-0'
    );

    if (onChange) {
      onChange(isChecked);
    }
  });

  // Handle keyboard
  toggle.addEventListener('keydown', (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      toggle.click();
    }
  });

  return toggle;
}

/**
 * Toggle with label props
 */
export interface ToggleFieldProps extends ToggleProps {
  /** Label text */
  label: string;
  /** Description text shown below label */
  description?: string;
  /** Label position */
  labelPosition?: 'left' | 'right';
}

/**
 * Creates a Toggle with an associated label.
 *
 * @param props - Toggle field configuration
 * @returns HTMLDivElement containing toggle and label
 *
 * @example
 * ```typescript
 * const toggle = ToggleField({
 *   label: 'Enable notifications',
 *   description: 'Receive email updates',
 *   checked: true,
 *   onChange: (checked) => console.log('Notifications:', checked),
 * });
 * ```
 */
export function ToggleField(props: ToggleFieldProps): HTMLDivElement {
  const {
    label,
    description,
    labelPosition = 'left',
    id,
    ...toggleProps
  } = props;

  const fieldId = id || `toggle-${Math.random().toString(36).substring(7)}`;
  const container = document.createElement('div');
  container.className = cn(
    'flex items-center justify-between gap-4',
    labelPosition === 'right' && 'flex-row-reverse'
  );

  // Label and description
  const labelContainer = document.createElement('div');
  labelContainer.className = 'flex flex-col';

  const labelEl = document.createElement('label');
  labelEl.htmlFor = fieldId;
  labelEl.className = cn(
    'text-sm font-medium text-foreground cursor-pointer',
    toggleProps.disabled && 'cursor-not-allowed opacity-50'
  );
  labelEl.textContent = label;
  labelContainer.appendChild(labelEl);

  if (description) {
    const descEl = document.createElement('p');
    descEl.className = 'text-sm text-muted-foreground';
    descEl.textContent = description;
    labelContainer.appendChild(descEl);
  }

  // Toggle
  const toggle = Toggle({ ...toggleProps, id: fieldId });

  container.appendChild(labelContainer);
  container.appendChild(toggle);

  return container;
}
