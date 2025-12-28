# Story 9.1: Shared Tailwind Configuration & Design Tokens

## Story

As a **developer working on either Electron or browser app**,
I want **a unified Tailwind configuration with shared design tokens**,
So that **both apps use consistent colors, spacing, typography, and shadows without duplicating configuration**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 9.1 |
| **Epic** | 9 - UI Harmonization (Tailwind + shadcn) |
| **Status** | ready-for-dev |
| **Created** | 2025-12-26 |

## Acceptance Criteria

**Given** both Electron and browser-app projects
**When** I import the shared Tailwind preset
**Then** both apps use an identical color palette (primary, secondary, success, warning, error, neutral).

**And** CSS variables are defined for theme tokens (`--primary`, `--background`, `--foreground`, etc.) in `:root`
**And** dark mode support is configured using class-based toggle (`.dark` class)
**And** custom spacing scale matches across both apps
**And** typography scale is consistent (font sizes, line heights, font weights)
**And** border radius, shadows, and transitions are standardized
**And** existing Electron app styles continue to work after migration
**And** existing browser-app styles continue to work after migration

## Technical Design

### Files to Create

| File | Purpose |
|------|---------|
| `shared/tailwind-preset.js` | Shared Tailwind preset with design tokens |
| `shared/ui-components/styles/variables.css` | CSS variables for theming |

### Files to Modify

| File | Changes |
|------|---------|
| `tailwind.config.js` (root) | Extend shared preset |
| `browser-app/tailwind.config.js` | Create and extend shared preset |
| `browser-app/src/styles/base.css` | Import CSS variables, remove duplicates |

### Design Token Structure

```javascript
// shared/tailwind-preset.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Semantic colors using CSS variables (shadcn pattern)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        // Entity type colors (PII detection specific)
        entity: {
          person: 'hsl(var(--entity-person))',
          organization: 'hsl(var(--entity-organization))',
          address: 'hsl(var(--entity-address))',
          email: 'hsl(var(--entity-email))',
          phone: 'hsl(var(--entity-phone))',
          date: 'hsl(var(--entity-date))',
          iban: 'hsl(var(--entity-iban))',
          avs: 'hsl(var(--entity-avs))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['Monaco', 'Consolas', 'Courier New', 'monospace'],
      },
    },
  },
};
```

### CSS Variables Definition

```css
/* shared/ui-components/styles/variables.css */
:root {
  /* Light theme (default) */
  --background: 0 0% 100%;
  --foreground: 222.2 47.4% 11.2%;

  --muted: 210 40% 96.1%;
  --muted-foreground: 215.4 16.3% 46.9%;

  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;

  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;

  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;

  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;

  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 221.2 83.2% 53.3%;

  --radius: 0.5rem;

  /* Entity type colors */
  --entity-person: 271 91% 65%;
  --entity-organization: 217 91% 60%;
  --entity-address: 142 76% 36%;
  --entity-email: 189 94% 43%;
  --entity-phone: 24 95% 53%;
  --entity-date: 48 96% 53%;
  --entity-iban: 239 84% 67%;
  --entity-avs: 0 84% 60%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;

  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;

  --primary: 217.2 91.2% 59.8%;
  --primary-foreground: 222.2 47.4% 11.2%;

  --secondary: 217.2 32.6% 17.5%;
  --secondary-foreground: 210 40% 98%;

  --accent: 217.2 32.6% 17.5%;
  --accent-foreground: 210 40% 98%;

  --destructive: 0 62.8% 30.6%;
  --destructive-foreground: 210 40% 98%;

  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 224.3 76.3% 48%;
}
```

## Tasks / Subtasks

- [ ] **Task 1: Create shared directory structure** (AC: all)
  - [ ] Create `shared/` directory at project root
  - [ ] Create `shared/ui-components/` subdirectory
  - [ ] Create `shared/ui-components/styles/` subdirectory
  - [ ] Update `tsconfig.json` paths if needed for shared imports

- [ ] **Task 2: Create CSS variables file** (AC: CSS variables, dark mode)
  - [ ] Create `shared/ui-components/styles/variables.css`
  - [ ] Define all color tokens in HSL format (no commas, shadcn pattern)
  - [ ] Define entity type colors for PII badges
  - [ ] Define dark mode overrides in `.dark` class
  - [ ] Add radius, spacing tokens

- [ ] **Task 3: Create shared Tailwind preset** (AC: color palette, spacing, typography)
  - [ ] Create `shared/tailwind-preset.js`
  - [ ] Define semantic colors using CSS variables
  - [ ] Define border radius scale using CSS variables
  - [ ] Define font family stacks
  - [ ] Export as CommonJS module for Tailwind compatibility

- [ ] **Task 4: Integrate preset into Electron app** (AC: Electron styles work)
  - [ ] Update `tailwind.config.js` to extend shared preset
  - [ ] Import `variables.css` in `src/input.css`
  - [ ] Verify existing styles compile correctly
  - [ ] Run `npm run css:build` successfully

- [ ] **Task 5: Create browser-app Tailwind config** (AC: browser-app styles work)
  - [ ] Create `browser-app/tailwind.config.js` extending shared preset
  - [ ] Update `browser-app/vite.config.ts` if needed for CSS processing
  - [ ] Import `variables.css` in browser-app entry point
  - [ ] Migrate hardcoded colors in `base.css` to use CSS variables

- [ ] **Task 6: Add dark mode toggle support** (AC: dark mode)
  - [ ] Ensure `darkMode: 'class'` in preset
  - [ ] Test dark mode toggle in both apps
  - [ ] Verify entity colors work in dark mode

- [ ] **Task 7: Write tests and documentation** (AC: all)
  - [ ] Create `test/unit/ui/tailwind-preset.test.js` to verify preset structure
  - [ ] Verify CSS variables are correctly applied (visual inspection)
  - [ ] Document design tokens in inline comments
  - [ ] Update CLAUDE.md with shared UI section

## Dev Notes

### Architecture Alignment

This story establishes the foundation for the shared component library per the Epic 9 tech spec. The design follows shadcn/ui patterns:

- **HSL color format without commas**: `--primary: 221.2 83.2% 53.3%` (Tailwind 3.x requirement)
- **CSS variables for runtime theming**: Allows dark mode without rebuilding CSS
- **Semantic color naming**: `primary`, `secondary`, `destructive` instead of color names

[Source: docs/sprint-artifacts/tech-spec-epic-9.md#CSS-Variables]

### Current State Analysis

**Electron App (`tailwind.config.js`):**
- Uses `primary` color scale (50-900)
- Custom mono font family
- No dark mode support currently

**Browser App (`browser-app/src/styles/`):**
- Custom CSS layer (~2500 lines total)
- Hardcoded colors like `#2563eb`, `#f3f4f6`
- No Tailwind config (pure CSS)
- Typography utilities duplicated from Tailwind

### Migration Strategy

1. Create shared preset that **extends** existing Electron colors initially
2. Add CSS variables layer **alongside** existing colors for backward compatibility
3. Browser-app will get Tailwind + shared preset in this story
4. Gradual migration of hardcoded values to CSS variables in subsequent stories

### Entity Type Colors

The entity colors align with existing `EntityTypeConfig.ts` in browser-app:
- PERSON_NAME: Purple (#a855f7)
- ORGANIZATION: Blue (#3b82f6)
- ADDRESS: Green (#22c55e)
- EMAIL: Cyan (#06b6d4)
- PHONE: Orange (#f97316)
- DATE: Yellow (#eab308)
- IBAN: Indigo (#6366f1)
- SWISS_AVS: Red (#ef4444)

[Source: browser-app/src/components/sidebar/EntityTypeConfig.ts]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-9.md#Detailed-Design]
- [Source: docs/epics.md#Story-9.1]
- [Source: tailwind.config.js] - Current Electron Tailwind config
- [Source: browser-app/src/styles/base.css] - Current browser-app styles

## Definition of Done

- [ ] `shared/tailwind-preset.js` exists and exports valid Tailwind preset
- [ ] `shared/ui-components/styles/variables.css` defines all required CSS variables
- [ ] Electron `tailwind.config.js` extends shared preset
- [ ] Browser-app has `tailwind.config.js` extending shared preset
- [ ] Both apps compile CSS without errors
- [ ] Dark mode toggle works (`.dark` class application)
- [ ] Existing UI appearance unchanged in both apps
- [ ] Entity type colors defined for all PII types
- [ ] TypeScript compilation passes in both projects
- [ ] Unit test validates preset structure

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
