/**
 * UI Components - Primitives
 *
 * Basic building block components for building user interfaces.
 * All components use vanilla TypeScript and return DOM elements.
 */

// Button
export {
  Button,
  buttonVariants,
  updateButton,
  type ButtonProps,
} from './Button.js';

// Badge
export {
  Badge,
  badgeVariants,
  EntityTypeBadge,
  entityBadgeVariants,
  type BadgeProps,
  type EntityBadgeProps,
} from './Badge.js';

// Card
export {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  cardVariants,
  createCard,
  type CardProps,
  type CardHeaderProps,
  type CardContentProps,
  type CardFooterProps,
} from './Card.js';

// Input
export {
  Input,
  InputField,
  inputVariants,
  type InputProps,
  type InputFieldProps,
} from './Input.js';

// Checkbox
export {
  Checkbox,
  CheckboxField,
  type CheckboxProps,
  type CheckboxFieldProps,
} from './Checkbox.js';

// Toggle
export {
  Toggle,
  ToggleField,
  type ToggleProps,
  type ToggleFieldProps,
} from './Toggle.js';
