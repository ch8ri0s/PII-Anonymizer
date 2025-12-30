import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn.js';

/**
 * Card container variants
 */
export const cardVariants = cva(
  ['rounded-xl', 'border', 'overflow-hidden'],
  {
    variants: {
      variant: {
        default: ['bg-card', 'border-border', 'shadow-sm'],
        outline: ['bg-transparent', 'border-border'],
        ghost: ['bg-transparent', 'border-transparent', 'shadow-none'],
        elevated: ['bg-card', 'border-border', 'shadow-md'],
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * Card props interface
 */
export interface CardProps extends VariantProps<typeof cardVariants> {
  /** Additional CSS classes */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Card header props
 */
export interface CardHeaderProps {
  /** Title text */
  title?: string;
  /** Subtitle text */
  subtitle?: string;
  /** Actions/buttons to display in header */
  actions?: HTMLElement;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Card content props
 */
export interface CardContentProps {
  /** Content to display */
  children?: HTMLElement | HTMLElement[] | string;
  /** Additional CSS classes */
  className?: string;
  /** Whether to apply padding */
  noPadding?: boolean;
}

/**
 * Card footer props
 */
export interface CardFooterProps {
  /** Content to display */
  children?: HTMLElement | HTMLElement[] | string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Creates a Card container element.
 *
 * @param props - Card configuration
 * @returns HTMLDivElement
 *
 * @example
 * ```typescript
 * const card = Card({ variant: 'elevated' });
 *
 * const header = CardHeader({
 *   title: 'File Details',
 *   subtitle: 'Document information',
 * });
 *
 * const content = CardContent({
 *   children: someContent,
 * });
 *
 * card.appendChild(header);
 * card.appendChild(content);
 * ```
 */
export function Card(props: CardProps = {}): HTMLDivElement {
  const { className, variant, testId } = props;

  const card = document.createElement('div');
  card.className = cn(cardVariants({ variant }), className);

  if (testId) {
    card.setAttribute('data-testid', testId);
  }

  return card;
}

/**
 * Creates a Card header element.
 */
export function CardHeader(props: CardHeaderProps = {}): HTMLDivElement {
  const { title, subtitle, actions, className } = props;

  const header = document.createElement('div');
  header.className = cn(
    'px-6',
    'py-4',
    'border-b',
    'border-border',
    'bg-muted/50',
    className
  );

  // Create flex container for title and actions
  const container = document.createElement('div');
  container.className = 'flex items-start justify-between gap-4';

  // Title section
  const titleSection = document.createElement('div');

  if (title) {
    const titleEl = document.createElement('h3');
    titleEl.className = 'text-lg font-semibold text-card-foreground';
    titleEl.textContent = title;
    titleSection.appendChild(titleEl);
  }

  if (subtitle) {
    const subtitleEl = document.createElement('p');
    subtitleEl.className = 'text-sm text-muted-foreground mt-1';
    subtitleEl.textContent = subtitle;
    titleSection.appendChild(subtitleEl);
  }

  container.appendChild(titleSection);

  // Actions section
  if (actions) {
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'flex items-center gap-2';
    actionsContainer.appendChild(actions);
    container.appendChild(actionsContainer);
  }

  header.appendChild(container);

  return header;
}

/**
 * Creates a Card content element.
 */
export function CardContent(props: CardContentProps = {}): HTMLDivElement {
  const { children, className, noPadding = false } = props;

  const content = document.createElement('div');
  content.className = cn(
    noPadding ? '' : 'px-6 py-5',
    className
  );

  if (children) {
    if (typeof children === 'string') {
      content.textContent = children;
    } else if (Array.isArray(children)) {
      children.forEach(child => content.appendChild(child));
    } else {
      content.appendChild(children);
    }
  }

  return content;
}

/**
 * Creates a Card footer element.
 */
export function CardFooter(props: CardFooterProps = {}): HTMLDivElement {
  const { children, className } = props;

  const footer = document.createElement('div');
  footer.className = cn(
    'px-6',
    'py-4',
    'border-t',
    'border-border',
    'bg-muted/30',
    className
  );

  if (children) {
    if (typeof children === 'string') {
      footer.textContent = children;
    } else if (Array.isArray(children)) {
      children.forEach(child => footer.appendChild(child));
    } else {
      footer.appendChild(children);
    }
  }

  return footer;
}

/**
 * Convenience function to create a complete card with header, content, and optional footer.
 */
export function createCard(options: {
  title?: string;
  subtitle?: string;
  headerActions?: HTMLElement;
  content: HTMLElement | HTMLElement[] | string;
  footer?: HTMLElement | HTMLElement[] | string;
  variant?: CardProps['variant'];
  className?: string;
  testId?: string;
}): HTMLDivElement {
  const { title, subtitle, headerActions, content, footer, variant, className, testId } = options;

  // Build card props, only including defined values
  const cardProps: CardProps = { variant };
  if (className) cardProps.className = className;
  if (testId) cardProps.testId = testId;

  const card = Card(cardProps);

  if (title || subtitle || headerActions) {
    const headerProps: CardHeaderProps = {};
    if (title) headerProps.title = title;
    if (subtitle) headerProps.subtitle = subtitle;
    if (headerActions) headerProps.actions = headerActions;
    card.appendChild(CardHeader(headerProps));
  }

  card.appendChild(CardContent({ children: content }));

  if (footer) {
    card.appendChild(CardFooter({ children: footer }));
  }

  return card;
}
