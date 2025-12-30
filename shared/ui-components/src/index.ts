/**
 * @a5-pii/ui-components
 *
 * Shared UI component library for PII Anonymizer
 * Electron and Browser applications.
 *
 * Built with:
 * - Tailwind CSS for styling
 * - Class Variance Authority (CVA) for variant management
 * - tailwind-merge for class conflict resolution
 *
 * @example
 * // Import utilities
 * import { cn } from '@a5-pii/ui-components';
 *
 * @example
 * // Import primitives (Story 9.3)
 * import { Button, Badge, Card } from '@a5-pii/ui-components/primitives';
 *
 * @example
 * // Import entity components (Story 9.5)
 * import { EntityBadge, EntitySidebar } from '@a5-pii/ui-components/entity';
 *
 * @example
 * // Import test IDs for E2E tests
 * import { TEST_IDS, testIdSelector } from '@a5-pii/ui-components';
 */

// Core utilities
export * from './utils/index.js';

// Primitive components (Story 9.3)
export * from './primitives/index.js';

// Composite components (Story 9.4)
export * from './composites/index.js';

// Entity-specific components (Story 9.5)
export * from './entity/index.js';

// Test ID constants for E2E testing
export * from './testIds.js';
