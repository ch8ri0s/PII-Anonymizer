import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn.js';

/**
 * Badge component variants using Class Variance Authority.
 */
export const badgeVariants = cva(
  // Base styles
  [
    'inline-flex',
    'items-center',
    'gap-1',
    'rounded-md',
    'font-medium',
    'transition-colors',
  ],
  {
    variants: {
      /**
       * Visual style variant
       */
      variant: {
        default: ['bg-secondary', 'text-secondary-foreground'],
        primary: ['bg-primary', 'text-primary-foreground'],
        secondary: ['bg-secondary', 'text-secondary-foreground', 'border', 'border-border'],
        success: ['bg-success/10', 'text-success', 'border', 'border-success/20'],
        warning: ['bg-warning/10', 'text-warning', 'border', 'border-warning/20'],
        destructive: ['bg-destructive/10', 'text-destructive', 'border', 'border-destructive/20'],
        info: ['bg-info/10', 'text-info', 'border', 'border-info/20'],
        outline: ['border', 'border-border', 'bg-transparent'],
      },
      /**
       * Size variant
       */
      size: {
        sm: ['px-1.5', 'py-0.5', 'text-[10px]'],
        md: ['px-2.5', 'py-0.5', 'text-xs'],
        lg: ['px-3', 'py-1', 'text-sm'],
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

/**
 * Badge props interface
 */
export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  /** Badge text content */
  label: string;
  /** Icon element to display (optional) */
  icon?: HTMLElement | SVGElement;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label */
  ariaLabel?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Creates a Badge element with the specified props.
 *
 * @param props - Badge configuration
 * @returns HTMLSpanElement
 *
 * @example
 * ```typescript
 * // Success badge
 * const badge = Badge({ label: 'Active', variant: 'success' });
 *
 * // With icon
 * const entityBadge = Badge({
 *   label: 'Person',
 *   variant: 'primary',
 *   icon: personIcon,
 * });
 * ```
 */
export function Badge(props: BadgeProps): HTMLSpanElement {
  const {
    label,
    icon,
    className,
    variant,
    size,
    ariaLabel,
    testId,
  } = props;

  const badge = document.createElement('span');
  badge.className = cn(badgeVariants({ variant, size }), className);

  if (ariaLabel) {
    badge.setAttribute('aria-label', ariaLabel);
  }

  if (testId) {
    badge.setAttribute('data-testid', testId);
  }

  // Add icon if provided
  if (icon) {
    const iconClone = icon.cloneNode(true) as HTMLElement | SVGElement;
    iconClone.classList.add('w-3', 'h-3');
    badge.appendChild(iconClone);
  }

  // Add label
  const textNode = document.createTextNode(label);
  badge.appendChild(textNode);

  return badge;
}

/**
 * Entity type badge variants - specific to PII entity types
 */
export const entityBadgeVariants = cva(
  ['inline-flex', 'items-center', 'gap-1', 'rounded-md', 'font-medium', 'px-2', 'py-0.5', 'text-xs'],
  {
    variants: {
      entityType: {
        person: ['bg-entity-person-bg', 'text-entity-person'],
        organization: ['bg-entity-organization-bg', 'text-entity-organization'],
        address: ['bg-entity-address-bg', 'text-entity-address'],
        email: ['bg-entity-email-bg', 'text-entity-email'],
        phone: ['bg-entity-phone-bg', 'text-entity-phone'],
        date: ['bg-entity-date-bg', 'text-entity-date'],
        iban: ['bg-entity-iban-bg', 'text-entity-iban'],
        avs: ['bg-entity-avs-bg', 'text-entity-avs'],
        postal: ['bg-entity-postal-bg', 'text-entity-postal'],
        url: ['bg-entity-url-bg', 'text-entity-url'],
      },
    },
    defaultVariants: {
      entityType: 'person',
    },
  }
);

/**
 * Entity badge props
 */
export interface EntityBadgeProps extends VariantProps<typeof entityBadgeVariants> {
  label: string;
  icon?: HTMLElement | SVGElement;
  className?: string;
}

/**
 * Creates an entity type badge with PII-specific colors.
 */
export function EntityTypeBadge(props: EntityBadgeProps): HTMLSpanElement {
  const { label, icon, className, entityType } = props;

  const badge = document.createElement('span');
  badge.className = cn(entityBadgeVariants({ entityType }), className);

  if (icon) {
    const iconClone = icon.cloneNode(true) as HTMLElement | SVGElement;
    iconClone.classList.add('w-3', 'h-3');
    badge.appendChild(iconClone);
  }

  badge.appendChild(document.createTextNode(label));

  return badge;
}
