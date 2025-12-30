import { cn } from '../utils/cn.js';

/**
 * Checkbox props interface
 */
export interface CheckboxProps {
  /** Checkbox ID */
  id?: string;
  /** Checkbox name */
  name?: string;
  /** Checked state */
  checked?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Change event handler */
  onChange?: (checked: boolean, event: Event) => void;
  /** Test ID for testing */
  testId?: string;
  /** Accessible label */
  ariaLabel?: string;
}

/**
 * Creates a styled Checkbox element.
 *
 * @param props - Checkbox configuration
 * @returns HTMLInputElement
 */
export function Checkbox(props: CheckboxProps = {}): HTMLInputElement {
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

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = cn(
    'h-4',
    'w-4',
    'rounded',
    'border',
    'border-input',
    'bg-background',
    'text-primary',
    'focus:ring-2',
    'focus:ring-ring',
    'focus:ring-offset-2',
    'disabled:cursor-not-allowed',
    'disabled:opacity-50',
    'cursor-pointer',
    className
  );

  if (id) checkbox.id = id;
  if (name) checkbox.name = name;
  checkbox.checked = checked;
  checkbox.disabled = disabled;
  if (ariaLabel) checkbox.setAttribute('aria-label', ariaLabel);
  if (testId) checkbox.setAttribute('data-testid', testId);

  if (onChange) {
    checkbox.addEventListener('change', (event) => {
      onChange(checkbox.checked, event);
    });
  }

  return checkbox;
}

/**
 * Checkbox with label props
 */
export interface CheckboxFieldProps extends CheckboxProps {
  /** Label text */
  label: string;
  /** Description text shown below label */
  description?: string;
}

/**
 * Creates a Checkbox with an associated label.
 *
 * @param props - Checkbox field configuration
 * @returns HTMLDivElement containing checkbox and label
 *
 * @example
 * ```typescript
 * const checkbox = CheckboxField({
 *   label: 'Accept terms',
 *   description: 'You agree to our Terms of Service',
 *   onChange: (checked) => console.log('Checked:', checked),
 * });
 * ```
 */
export function CheckboxField(props: CheckboxFieldProps): HTMLDivElement {
  const { label, description, id, ...checkboxProps } = props;

  const fieldId = id || `checkbox-${Math.random().toString(36).substring(7)}`;
  const container = document.createElement('div');
  container.className = 'flex items-start gap-3';

  // Checkbox
  const checkbox = Checkbox({ ...checkboxProps, id: fieldId });
  checkbox.classList.add('mt-0.5');
  container.appendChild(checkbox);

  // Label and description
  const labelContainer = document.createElement('div');
  labelContainer.className = 'flex flex-col';

  const labelEl = document.createElement('label');
  labelEl.htmlFor = fieldId;
  labelEl.className = cn(
    'text-sm font-medium text-foreground cursor-pointer',
    checkboxProps.disabled && 'cursor-not-allowed opacity-50'
  );
  labelEl.textContent = label;
  labelContainer.appendChild(labelEl);

  if (description) {
    const descEl = document.createElement('p');
    descEl.className = 'text-sm text-muted-foreground';
    descEl.textContent = description;
    labelContainer.appendChild(descEl);
  }

  container.appendChild(labelContainer);

  return container;
}
