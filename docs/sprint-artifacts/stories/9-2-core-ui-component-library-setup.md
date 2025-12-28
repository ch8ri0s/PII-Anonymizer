# Story 9.2: Core UI Component Library Setup

## Story

As a **developer building UI features**,
I want **a shared component library based on shadcn/ui patterns**,
So that **I can use pre-built, accessible, typed components in both Electron and browser apps**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 9.2 |
| **Epic** | 9 - UI Harmonization (Tailwind + shadcn) |
| **Status** | ready-for-dev |
| **Created** | 2025-12-26 |

## Acceptance Criteria

**Given** the need for reusable UI components across both apps
**When** I set up the component library infrastructure
**Then** a component library exists at `shared/ui-components/`.

**And** the build system is configured (TypeScript compilation, exports for ESM)
**And** components use class-variance-authority (CVA) for variant handling
**And** components use clsx + tailwind-merge for class composition via a `cn()` utility
**And** all components are fully typed with TypeScript
**And** components export both the component function and its props type
**And** components are framework-agnostic (vanilla TypeScript, not React)
**And** the library can be imported by both Electron and browser-app projects

## Technical Design

### Files to Create

| File | Purpose |
|------|---------|
| `shared/ui-components/package.json` | Package definition with exports |
| `shared/ui-components/tsconfig.json` | TypeScript configuration |
| `shared/ui-components/src/index.ts` | Main export barrel |
| `shared/ui-components/src/utils/cn.ts` | Class name merging utility |
| `shared/ui-components/src/utils/index.ts` | Utils barrel export |

### Dependencies to Install

```json
{
  "dependencies": {
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

### Core Utility: `cn()` Function

```typescript
// shared/ui-components/src/utils/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind conflict resolution.
 * Combines clsx for conditional classes with tailwind-merge for deduplication.
 *
 * @example
 * cn('px-4 py-2', isActive && 'bg-primary', className)
 * cn('text-red-500', 'text-blue-500') // => 'text-blue-500' (last wins)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

### Package Structure

```
shared/ui-components/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Main exports
│   ├── utils/
│   │   ├── index.ts
│   │   └── cn.ts             # Class merge utility
│   ├── primitives/           # Story 9.3
│   │   └── index.ts
│   ├── composites/           # Story 9.4
│   │   └── index.ts
│   └── entity/               # Story 9.5
│       └── index.ts
└── styles/
    └── variables.css         # From Story 9.1
```

### TypeScript Configuration

```json
// shared/ui-components/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Package.json Exports

```json
// shared/ui-components/package.json
{
  "name": "@a5-pii/ui-components",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./utils": {
      "import": "./dist/utils/index.js",
      "types": "./dist/utils/index.d.ts"
    },
    "./styles/*": "./styles/*"
  },
  "files": ["dist", "styles"],
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch",
    "typecheck": "tsc --noEmit"
  }
}
```

## Tasks / Subtasks

- [ ] **Task 1: Create package structure** (AC: library at shared/ui-components/)
  - [ ] Create `shared/ui-components/` directory
  - [ ] Create `shared/ui-components/src/` directory
  - [ ] Create `shared/ui-components/src/utils/` directory
  - [ ] Create placeholder directories for future stories (primitives/, composites/, entity/)

- [ ] **Task 2: Initialize package.json** (AC: build system configured)
  - [ ] Create `shared/ui-components/package.json` with name `@a5-pii/ui-components`
  - [ ] Define exports map for ESM imports
  - [ ] Add build scripts for TypeScript compilation
  - [ ] Configure `files` array for npm pack

- [ ] **Task 3: Install dependencies** (AC: CVA, clsx, tailwind-merge)
  - [ ] Run `npm install class-variance-authority clsx tailwind-merge` in shared/ui-components
  - [ ] Verify dependencies in package.json
  - [ ] Ensure TypeScript types are available (CVA includes types)

- [ ] **Task 4: Configure TypeScript** (AC: fully typed)
  - [ ] Create `shared/ui-components/tsconfig.json`
  - [ ] Enable strict mode and `noUncheckedIndexedAccess`
  - [ ] Configure declaration file generation
  - [ ] Set module resolution to "bundler" for modern imports

- [ ] **Task 5: Implement cn() utility** (AC: clsx + tailwind-merge)
  - [ ] Create `shared/ui-components/src/utils/cn.ts`
  - [ ] Implement `cn()` function combining clsx and twMerge
  - [ ] Add JSDoc documentation with examples
  - [ ] Export from `utils/index.ts`

- [ ] **Task 6: Create barrel exports** (AC: components export props type)
  - [ ] Create `shared/ui-components/src/utils/index.ts` exporting cn
  - [ ] Create `shared/ui-components/src/index.ts` re-exporting utils
  - [ ] Add placeholder exports for future component categories

- [ ] **Task 7: Configure project references** (AC: importable by both apps)
  - [ ] Update root `tsconfig.json` with path alias for `@a5-pii/ui-components`
  - [ ] Update `browser-app/tsconfig.json` with same path alias
  - [ ] Verify imports work in both projects
  - [ ] Add shared/ui-components to workspace (if using npm workspaces)

- [ ] **Task 8: Build and verify** (AC: build system configured)
  - [ ] Run `npm run build` in shared/ui-components
  - [ ] Verify `dist/` contains compiled JS and .d.ts files
  - [ ] Test import from Electron project
  - [ ] Test import from browser-app project

- [ ] **Task 9: Write unit tests** (AC: all)
  - [ ] Create `shared/ui-components/src/utils/cn.test.ts`
  - [ ] Test cn() with single class
  - [ ] Test cn() with multiple classes
  - [ ] Test cn() with conditional classes (false values filtered)
  - [ ] Test cn() conflict resolution (last Tailwind class wins)

## Dev Notes

### Architecture Alignment

This story establishes the infrastructure for the shared component library. Following stories will add:
- **Story 9.3**: Primitive components (Button, Badge, Card, Input)
- **Story 9.4**: Composite components (Modal, Toast, Dropdown)
- **Story 9.5**: Entity-specific components (EntityBadge, EntitySidebar)

[Source: docs/sprint-artifacts/tech-spec-epic-9.md#Services-and-Modules]

### Why Vanilla TypeScript (Not React)

The component library uses vanilla TypeScript instead of React because:
1. **Electron app uses vanilla JS** - No React framework currently
2. **Browser-app uses vanilla TS** - Components are class-based or functional
3. **No framework lock-in** - Can be used in any context
4. **Smaller bundle** - No React runtime overhead

Components will be factory functions that return DOM elements:

```typescript
// Example pattern (implemented in Story 9.3)
export function Button(props: ButtonProps): HTMLButtonElement {
  const button = document.createElement('button');
  button.className = cn(buttonVariants({ variant: props.variant, size: props.size }), props.className);
  button.textContent = props.label;
  return button;
}
```

### CVA Pattern Explanation

Class Variance Authority (CVA) provides type-safe variant handling:

```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'base-classes-here', // Applied to all variants
  {
    variants: {
      variant: {
        primary: 'bg-primary text-white',
        secondary: 'bg-secondary text-black',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-10 px-4',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

// Type-safe props derived from variants
type ButtonProps = VariantProps<typeof buttonVariants>;
```

### tailwind-merge Conflict Resolution

`tailwind-merge` intelligently resolves Tailwind class conflicts:

```typescript
cn('px-4', 'px-6')           // => 'px-6' (later wins)
cn('text-red-500', 'text-blue-500') // => 'text-blue-500'
cn('p-4', 'px-6')            // => 'p-4 px-6' (different axes, both kept)
```

### Workspace Integration Options

**Option A: npm workspaces** (Recommended)
```json
// root package.json
{
  "workspaces": ["shared/*", "browser-app"]
}
```

**Option B: Path aliases only**
```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@a5-pii/ui-components": ["./shared/ui-components/src"],
      "@a5-pii/ui-components/*": ["./shared/ui-components/src/*"]
    }
  }
}
```

### Prerequisites

- Story 9.1 must be complete (shared Tailwind preset and CSS variables)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-9.md#Data-Models-and-Contracts]
- [Source: docs/epics.md#Story-9.2]
- CVA Documentation: https://cva.style/docs
- tailwind-merge: https://github.com/dcastil/tailwind-merge

## Definition of Done

- [ ] `shared/ui-components/` directory structure created
- [ ] `package.json` with correct exports and dependencies
- [ ] `tsconfig.json` with strict TypeScript settings
- [ ] `cn()` utility implemented and exported
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] Declaration files (.d.ts) generated in `dist/`
- [ ] Import works from Electron project
- [ ] Import works from browser-app project
- [ ] Unit tests for `cn()` utility pass
- [ ] JSDoc documentation on exported functions

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
