# Epic Technical Specification: UI Harmonization (Tailwind + shadcn)

Date: 2025-12-26
Author: Olivier
Epic ID: 9
Status: Draft

---

## Overview

Epic 9 unifies the UI component architecture across Electron and browser apps using Tailwind CSS and shadcn/ui patterns, creating a shared design system that reduces code duplication, improves consistency, and accelerates future UI development.

**User Value:** Consistent, polished user experience across both platforms with modern, accessible components. Developers benefit from a shared component library that reduces maintenance burden.

**Current State Analysis:**
- Browser-app: 20+ TypeScript components, custom CSS layer (~2500 lines), modular but app-specific
- Electron-app: 2 UI managers, pure Tailwind utilities, minimal component abstraction
- No shared component library
- Different color systems (HSL-based vs Tailwind defaults)
- Significant code duplication for buttons, badges, cards, modals

The solution creates a shared component library at `shared/ui-components/` using framework-agnostic vanilla TypeScript, following shadcn/ui patterns without React dependency.

## Objectives and Scope

**In Scope:**
- Shared Tailwind configuration with CSS variables for theming
- Core UI component library with CVA (class-variance-authority)
- Primitive components: Button, Badge, Card, Input, Checkbox, Toggle
- Composite components: Modal, Toast, Dropdown, Tooltip
- Entity-specific components: EntityBadge, EntityListItem, EntityGroup, EntitySidebar
- Migration of both apps to shared components
- Dark mode support
- Visual regression testing

**Out of Scope:**
- React or Vue migration (components stay vanilla TypeScript)
- Third-party component library adoption (we create our own)
- Animation library integration (basic CSS transitions only)
- Design system documentation site (Storybook optional)

## System Architecture Alignment

This epic creates a new shared layer for UI components:

**Primary Components (New):**
- `shared/ui-components/` - New shared component library
- `shared/tailwind-preset.js` - Shared Tailwind configuration
- `shared/ui-components/utils/cn.ts` - Class merging utility

**Modified Components:**
- `browser-app/src/components/` - Refactor to use shared components
- `src/ui/` - Refactor Electron UI to use shared components
- `tailwind.config.js` (both apps) - Extend shared preset

**Integration Points:**
- Both apps import shared components as ES modules
- CSS variables enable runtime theming
- Event delegation pattern maintained for performance

## Detailed Design

### Services and Modules

| Module | Responsibility | Inputs | Outputs | Owner |
|--------|---------------|--------|---------|-------|
| `tailwind-preset.js` | Shared design tokens | - | Tailwind preset | Story 9.1 |
| `cn.ts` | Class name merging | classNames | merged string | Story 9.2 |
| `Button.ts` | Button component | ButtonProps | HTMLButtonElement | Story 9.3 |
| `Badge.ts` | Badge component | BadgeProps | HTMLSpanElement | Story 9.3 |
| `Card.ts` | Card component | CardProps | HTMLDivElement | Story 9.3 |
| `Modal.ts` | Modal dialog | ModalProps | HTMLDialogElement | Story 9.4 |
| `Toast.ts` | Toast notifications | ToastProps | ToastManager | Story 9.4 |
| `EntityBadge.ts` | Entity type badge | EntityBadgeProps | HTMLSpanElement | Story 9.5 |
| `EntitySidebar.ts` | Entity review sidebar | EntitySidebarProps | HTMLElement | Story 9.5 |

### Data Models and Contracts

```typescript
// shared/ui-components/utils/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// shared/ui-components/Button.ts
import { cva, type VariantProps } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
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
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  iconLeft?: string;
  iconRight?: string;
  loading?: boolean;
  className?: string;
}

// shared/ui-components/Badge.ts
export const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
        error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
        outline: 'border border-current bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

// shared/ui-components/entity/EntityBadge.ts
export interface EntityBadgeProps {
  entityType: string;
  confidence?: number;
  source?: 'ML' | 'RULE' | 'BOTH' | 'MANUAL';
  compact?: boolean;
  className?: string;
}

export const ENTITY_TYPE_CONFIG: Record<string, { color: string; icon: string }> = {
  PERSON_NAME: { color: 'bg-purple-100 text-purple-800', icon: 'user' },
  ORGANIZATION: { color: 'bg-blue-100 text-blue-800', icon: 'building' },
  ADDRESS: { color: 'bg-green-100 text-green-800', icon: 'map-pin' },
  EMAIL: { color: 'bg-cyan-100 text-cyan-800', icon: 'mail' },
  PHONE: { color: 'bg-orange-100 text-orange-800', icon: 'phone' },
  DATE: { color: 'bg-yellow-100 text-yellow-800', icon: 'calendar' },
  IBAN: { color: 'bg-indigo-100 text-indigo-800', icon: 'credit-card' },
  SWISS_AVS: { color: 'bg-red-100 text-red-800', icon: 'id-card' },
};
```

### CSS Variables (Theming)

```css
/* shared/ui-components/styles/variables.css */
:root {
  /* Primary */
  --primary: 221 83% 53%;
  --primary-foreground: 210 40% 98%;

  /* Secondary */
  --secondary: 210 40% 96%;
  --secondary-foreground: 222 47% 11%;

  /* Background/Foreground */
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;

  /* Muted */
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;

  /* Accent */
  --accent: 210 40% 96%;
  --accent-foreground: 222 47% 11%;

  /* Destructive */
  --destructive: 0 84% 60%;
  --destructive-foreground: 210 40% 98%;

  /* Border/Input/Ring */
  --border: 214 32% 91%;
  --input: 214 32% 91%;
  --ring: 221 83% 53%;

  /* Radius */
  --radius: 0.5rem;
}

.dark {
  --primary: 217 91% 60%;
  --primary-foreground: 222 47% 11%;
  --background: 222 47% 11%;
  --foreground: 210 40% 98%;
  --muted: 217 33% 17%;
  --muted-foreground: 215 20% 65%;
  --border: 217 33% 17%;
  --input: 217 33% 17%;
}
```

### Workflows and Sequencing

```
┌─────────────────────────────────────────────────────────────────┐
│                    COMPONENT USAGE FLOW                          │
└─────────────────────────────────────────────────────────────────┘

1. Import shared component:
   import { Button, buttonVariants } from 'shared/ui-components';

2. Use in template/render:
   const btn = Button({ variant: 'primary', size: 'md', label: 'Save' });
   container.appendChild(btn);

3. Apply additional classes if needed:
   const btn = Button({
     variant: 'primary',
     className: 'my-custom-class'
   });

4. Handle events:
   btn.addEventListener('click', handleClick);
```

## Non-Functional Requirements

### Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| Bundle size impact | <50KB | Tree-shaking, no framework overhead |
| Initial render | <16ms | No virtual DOM, direct DOM manipulation |
| Re-render | <5ms | Minimal DOM updates |
| Memory footprint | <5MB additional | Lightweight components |

### Accessibility

| Requirement | Implementation | Source |
|-------------|---------------|--------|
| Keyboard navigation | Focus management, tabindex | WCAG 2.1 |
| Screen reader support | ARIA labels, roles | WCAG 2.1 |
| Color contrast | 4.5:1 minimum | WCAG 2.1 AA |
| Focus indicators | Visible focus rings | WCAG 2.1 |

### Browser Support

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

## Dependencies and Integrations

### New Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `class-variance-authority` | Variant handling | ~3KB |
| `clsx` | Class composition | ~1KB |
| `tailwind-merge` | Class conflict resolution | ~5KB |
| `@floating-ui/dom` | Positioning (tooltips, dropdowns) | ~8KB |

### Internal Dependencies

| Component | Dependency Type | Integration Point |
|-----------|----------------|-------------------|
| `browser-app/src/components/` | Refactored | Import shared components |
| `src/ui/EntityReviewUI.ts` | Refactored | Import shared components |
| `tailwind.config.js` | Modified | Extend shared preset |

## Acceptance Criteria (Authoritative)

### Story 9.1: Shared Tailwind Configuration & Design Tokens

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-9.1.1 | Both apps use identical color palette | Yes |
| AC-9.1.2 | CSS variables defined for theme tokens | Yes |
| AC-9.1.3 | Dark mode toggle works (class-based) | Yes |
| AC-9.1.4 | Custom spacing scale matches | Yes |
| AC-9.1.5 | Typography scale consistent | Yes |
| AC-9.1.6 | Border radius, shadows standardized | Yes |

### Story 9.2: Core UI Component Library Setup

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-9.2.1 | Component library at `shared/ui-components/` | Yes |
| AC-9.2.2 | Build system configured (TypeScript exports) | Yes |
| AC-9.2.3 | CVA for variant handling | Yes |
| AC-9.2.4 | clsx + tailwind-merge for class composition | Yes |
| AC-9.2.5 | All components fully typed | Yes |
| AC-9.2.6 | Components export props type | Yes |

### Story 9.3: Primitive Components

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-9.3.1 | Button with variants: primary, secondary, ghost, destructive, outline, link | Yes |
| AC-9.3.2 | Button sizes: sm, md, lg | Yes |
| AC-9.3.3 | Button states: default, hover, active, disabled, loading | Yes |
| AC-9.3.4 | Badge with variants: default, success, warning, error, info, outline | Yes |
| AC-9.3.5 | Card with header, content, footer slots | Yes |
| AC-9.3.6 | Input with label, error, helper text, icons | Yes |
| AC-9.3.7 | Checkbox and Toggle with label support | Yes |

### Story 9.4: Composite Components

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-9.4.1 | Modal with header, content, footer sections | Yes |
| AC-9.4.2 | Modal ESC key and backdrop click handling | Yes |
| AC-9.4.3 | Modal focus trap for accessibility | Yes |
| AC-9.4.4 | Toast with variants and auto-dismiss | Yes |
| AC-9.4.5 | Toast stacking for multiple notifications | Yes |
| AC-9.4.6 | Dropdown with keyboard navigation | Yes |
| AC-9.4.7 | Tooltip with positions and delay | Yes |

### Story 9.5: Entity UI Components

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-9.5.1 | EntityBadge with type icon/color | Yes |
| AC-9.5.2 | EntityBadge confidence and source indicators | Yes |
| AC-9.5.3 | EntityListItem with checkbox and metadata | Yes |
| AC-9.5.4 | EntityGroup with collapsible header and bulk selection | Yes |
| AC-9.5.5 | EntitySidebar with filter panel and scrollable groups | Yes |
| AC-9.5.6 | Browser-app EntitySidebar refactored to shared | Yes |
| AC-9.5.7 | Electron EntityReviewUI refactored to shared | Yes |

### Story 9.6: Migration & Integration Testing

| AC ID | Acceptance Criterion | Testable |
|-------|---------------------|----------|
| AC-9.6.1 | Browser-app uses shared components | Yes |
| AC-9.6.2 | Electron-app uses shared components | Yes |
| AC-9.6.3 | Old CSS removed (no duplicates) | Yes |
| AC-9.6.4 | Visual regression tests pass | Yes |
| AC-9.6.5 | Lighthouse accessibility score 100 | Yes |
| AC-9.6.6 | Bundle size impact <50KB | Yes |
| AC-9.6.7 | Dark mode works in both apps | Yes |
| AC-9.6.8 | All existing tests pass | Yes |

## Risks, Assumptions, Open Questions

### Risks

| ID | Risk | Impact | Likelihood | Mitigation |
|----|------|--------|------------|------------|
| R1 | Breaking existing UI during migration | High | Medium | Feature flags, incremental migration |
| R2 | Bundle size increase | Medium | Low | Tree-shaking, code splitting |
| R3 | Framework lock-in | Medium | Low | Keep components vanilla TS |
| R4 | Migration effort underestimated | Medium | Medium | Story-by-story, clear boundaries |

### Assumptions

| ID | Assumption | Validation Approach |
|----|-----------|-------------------|
| A1 | Vanilla TS components sufficient | Test with existing app patterns |
| A2 | CVA patterns work without React | Verify with TypeScript implementation |
| A3 | Both apps can share same Tailwind config | Integration testing |

### Open Questions

| ID | Question | Owner | Target Resolution |
|----|----------|-------|-------------------|
| Q1 | Should we include Storybook for documentation? | Dev | Story 9.2 |
| Q2 | Include animation library or CSS-only? | Dev | Story 9.4 |

## Test Strategy Summary

### Test Levels

| Level | Coverage | Framework | Location |
|-------|----------|-----------|----------|
| Unit Tests | Component render, variants | Vitest | `shared/ui-components/__tests__/` |
| Integration Tests | App integration | Mocha + Vitest | `test/integration/ui/` |
| Visual Regression | Screenshot comparison | Playwright | `test/visual/` |

### Test Coverage Requirements

| Component | Minimum Coverage | Critical Paths |
|-----------|-----------------|----------------|
| Primitives | 90% | Variant application, event handling |
| Composites | 85% | Keyboard navigation, focus trap |
| Entity components | 90% | Type styling, selection state |

## Story Summary

| Story | Title | Prerequisites | Files |
|-------|-------|---------------|-------|
| 9.1 | Shared Tailwind Config & Design Tokens | None | `shared/tailwind-preset.js` |
| 9.2 | Core UI Component Library Setup | 9.1 | `shared/ui-components/` |
| 9.3 | Primitive Components | 9.2 | Button, Badge, Card, Input |
| 9.4 | Composite Components | 9.3 | Modal, Toast, Dropdown, Tooltip |
| 9.5 | Entity UI Components | 9.4 | EntityBadge, EntitySidebar |
| 9.6 | Migration & Integration Testing | 9.5 | Both apps, tests |

---

## Technical Stack

| Technology | Purpose | Notes |
|------------|---------|-------|
| Tailwind CSS 3.x | Utility-first styling | Already in use |
| shadcn/ui patterns | Component architecture | Patterns only, not React |
| class-variance-authority | Variant handling | Type-safe variants |
| clsx + tailwind-merge | Class composition | Conflict resolution |
| @floating-ui/dom | Positioning | Tooltips, dropdowns |
| TypeScript | Type safety | Full typing for all components |

## Success Metrics

| Metric | Target |
|--------|--------|
| Code duplication reduction | >60% less CSS |
| Component reuse | 100% shared across apps |
| Bundle size impact | <50KB added |
| Accessibility score | Maintain 100 |
| Developer satisfaction | Faster feature development |
| Visual consistency | Identical look across apps |

---

_This tech spec was generated as part of Epic 9 contexting. Ready for story drafting._
