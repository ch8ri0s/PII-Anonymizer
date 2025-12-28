# Story 9.5: Entity UI Components (EntityBadge, EntityListItem, EntityGroup, EntitySidebar)

## Story

As a **user reviewing detected PII entities**,
I want **consistent, polished entity UI components**,
So that **I can easily identify, filter, and select entities for anonymization across both Electron and browser apps**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 9.5 |
| **Epic** | 9 - UI Harmonization (Tailwind + shadcn) |
| **Status** | ready-for-dev |
| **Created** | 2025-12-26 |

## Acceptance Criteria

### EntityBadge Component
**Given** the need to display entity type indicators
**When** I use the EntityBadge component
**Then** it shows the entity type with appropriate color coding
**And** it can display confidence level (high/medium/low visual indicator)
**And** it can display detection source (ML, RULE, MANUAL badge)
**And** it supports compact mode for inline use

### EntityListItem Component
**Given** the need to display individual entities
**When** I use the EntityListItem component
**Then** it shows the entity text (truncated if needed)
**And** it has a checkbox for selection
**And** it shows EntityBadge with type and confidence
**And** it is clickable for navigation/highlight
**And** it supports selected/hover states

### EntityGroup Component
**Given** the need to group entities by type
**When** I use the EntityGroup component
**Then** it has a collapsible header with type icon and count
**And** it supports bulk selection (select all in group)
**And** it renders EntityListItems for each entity
**And** collapse state persists

### EntitySidebar Component
**Given** the need for a complete entity review panel
**When** I use the EntitySidebar component
**Then** it has a filter panel to show/hide entity types
**And** it renders EntityGroups for each entity type
**And** it supports scrolling with sticky group headers
**And** it shows total count and selected count
**And** browser-app EntitySidebar is refactored to use shared components
**And** Electron EntityReviewUI is refactored to use shared components

### General Requirements
**And** all components use CSS variables from Story 9.1
**And** all components use primitives from Story 9.3
**And** entity type colors match existing ENTITY_TYPE_CONFIG
**And** all components have unit tests

## Technical Design

### Files to Create

| File | Purpose |
|------|---------|
| `shared/ui-components/src/entity/EntityBadge.ts` | Entity type badge with confidence |
| `shared/ui-components/src/entity/EntityListItem.ts` | Single entity row with checkbox |
| `shared/ui-components/src/entity/EntityGroup.ts` | Collapsible entity group |
| `shared/ui-components/src/entity/EntitySidebar.ts` | Complete sidebar panel |
| `shared/ui-components/src/entity/EntityTypeConfig.ts` | Shared type configuration |
| `shared/ui-components/src/entity/index.ts` | Barrel export |

### Entity Type Configuration

```typescript
// shared/ui-components/src/entity/EntityTypeConfig.ts

export interface EntityTypeConfig {
  /** Display label */
  label: string;
  /** HSL color value (without hsl() wrapper) */
  hue: number;
  saturation: number;
  lightness: number;
  /** Icon name or SVG */
  icon: string;
}

/**
 * Shared entity type configuration
 * Colors use HSL for easy dark mode adjustment
 */
export const ENTITY_TYPES: Record<string, EntityTypeConfig> = {
  PERSON: {
    label: 'Person',
    hue: 221.2, saturation: 83.2, lightness: 53.3,
    icon: 'user',
  },
  PERSON_NAME: {
    label: 'Person',
    hue: 221.2, saturation: 83.2, lightness: 53.3,
    icon: 'user',
  },
  ORG: {
    label: 'Organization',
    hue: 263.4, saturation: 70, lightness: 50.4,
    icon: 'building',
  },
  ORGANIZATION: {
    label: 'Organization',
    hue: 263.4, saturation: 70, lightness: 50.4,
    icon: 'building',
  },
  ADDRESS: {
    label: 'Address',
    hue: 142.1, saturation: 76.2, lightness: 36.3,
    icon: 'map-pin',
  },
  SWISS_ADDRESS: {
    label: 'Swiss Address',
    hue: 142.1, saturation: 76.2, lightness: 36.3,
    icon: 'map-pin',
  },
  EMAIL: {
    label: 'Email',
    hue: 0, saturation: 84.2, lightness: 60.2,
    icon: 'mail',
  },
  PHONE: {
    label: 'Phone',
    hue: 24.6, saturation: 95, lightness: 53.1,
    icon: 'phone',
  },
  DATE: {
    label: 'Date',
    hue: 262.1, saturation: 83.3, lightness: 57.8,
    icon: 'calendar',
  },
  IBAN: {
    label: 'IBAN',
    hue: 199.4, saturation: 89.3, lightness: 48.4,
    icon: 'credit-card',
  },
  SWISS_AVS: {
    label: 'Swiss AVS',
    hue: 346.8, saturation: 77.2, lightness: 49.8,
    icon: 'id-card',
  },
  VAT_NUMBER: {
    label: 'VAT Number',
    hue: 199.4, saturation: 89.3, lightness: 48.4,
    icon: 'file-text',
  },
  OTHER: {
    label: 'Other',
    hue: 0, saturation: 0, lightness: 45.1,
    icon: 'tag',
  },
};

export type DetectionSource = 'ML' | 'RULE' | 'BOTH' | 'MANUAL';

export const SOURCE_CONFIG: Record<DetectionSource, { label: string; className: string }> = {
  ML: { label: 'ML', className: 'bg-purple-100 text-purple-700' },
  RULE: { label: 'Rule', className: 'bg-blue-100 text-blue-700' },
  BOTH: { label: 'ML+Rule', className: 'bg-indigo-100 text-indigo-700' },
  MANUAL: { label: 'Manual', className: 'bg-green-100 text-green-700' },
};

export function getTypeConfig(type: string): EntityTypeConfig {
  return ENTITY_TYPES[type] || ENTITY_TYPES.OTHER;
}

export function getTypeColor(type: string, opacity = 1): string {
  const config = getTypeConfig(type);
  return `hsl(${config.hue} ${config.saturation}% ${config.lightness}% / ${opacity})`;
}

export function getConfidenceLevel(confidence: number | undefined): 'high' | 'medium' | 'low' {
  if (confidence === undefined) return 'medium';
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}
```

### EntityBadge Component

```typescript
// shared/ui-components/src/entity/EntityBadge.ts
import { cn } from '../utils/cn';
import { getTypeConfig, getTypeColor, getConfidenceLevel, SOURCE_CONFIG, type DetectionSource } from './EntityTypeConfig';

export interface EntityBadgeProps {
  /** Entity type */
  type: string;
  /** Confidence score (0-1) */
  confidence?: number;
  /** Detection source */
  source?: DetectionSource;
  /** Compact mode (smaller) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function EntityBadge(props: EntityBadgeProps): HTMLSpanElement {
  const { type, confidence, source, compact = false, className } = props;
  const config = getTypeConfig(type);
  const level = getConfidenceLevel(confidence);

  const badge = document.createElement('span');
  badge.className = cn(
    'inline-flex items-center gap-1 rounded-full font-medium',
    compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
    className
  );
  badge.style.backgroundColor = getTypeColor(type, 0.1);
  badge.style.color = getTypeColor(type, 1);

  // Type label
  const label = document.createElement('span');
  label.textContent = config.label;
  badge.appendChild(label);

  // Confidence indicator (dot)
  if (confidence !== undefined) {
    const dot = document.createElement('span');
    dot.className = cn(
      'w-1.5 h-1.5 rounded-full',
      level === 'high' && 'bg-green-500',
      level === 'medium' && 'bg-yellow-500',
      level === 'low' && 'bg-red-500'
    );
    dot.title = `${Math.round(confidence * 100)}% confidence`;
    badge.appendChild(dot);
  }

  // Source badge
  if (source && !compact) {
    const sourceEl = document.createElement('span');
    sourceEl.className = cn(
      'ml-1 px-1.5 py-0.5 rounded text-xs font-medium',
      SOURCE_CONFIG[source].className
    );
    sourceEl.textContent = SOURCE_CONFIG[source].label;
    badge.appendChild(sourceEl);
  }

  return badge;
}
```

### EntityListItem Component

```typescript
// shared/ui-components/src/entity/EntityListItem.ts
import { cn } from '../utils/cn';
import { EntityBadge } from './EntityBadge';
import type { DetectionSource } from './EntityTypeConfig';

export interface EntityListItemProps {
  /** Unique entity ID */
  id: string;
  /** Entity text */
  text: string;
  /** Entity type */
  type: string;
  /** Confidence score */
  confidence?: number;
  /** Detection source */
  source?: DetectionSource;
  /** Whether selected for anonymization */
  selected: boolean;
  /** Click handler for navigation */
  onClick?: () => void;
  /** Selection change handler */
  onSelectionChange?: (selected: boolean) => void;
  /** Additional CSS classes */
  className?: string;
}

export function EntityListItem(props: EntityListItemProps): HTMLDivElement {
  const {
    id,
    text,
    type,
    confidence,
    source,
    selected,
    onClick,
    onSelectionChange,
    className,
  } = props;

  const item = document.createElement('div');
  item.className = cn(
    'flex items-center gap-3 px-3 py-2 rounded-md',
    'hover:bg-muted/50 cursor-pointer transition-colors',
    selected && 'bg-primary/5',
    className
  );
  item.setAttribute('data-entity-id', id);

  // Checkbox
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = selected;
  checkbox.className = cn(
    'h-4 w-4 rounded border-gray-300',
    'text-primary focus:ring-primary'
  );
  checkbox.addEventListener('change', (e) => {
    e.stopPropagation();
    onSelectionChange?.(checkbox.checked);
  });
  checkbox.addEventListener('click', (e) => e.stopPropagation());
  item.appendChild(checkbox);

  // Content container
  const content = document.createElement('div');
  content.className = 'flex-1 min-w-0';

  // Text (truncated)
  const textEl = document.createElement('p');
  textEl.className = 'text-sm font-medium truncate';
  textEl.textContent = text;
  textEl.title = text;
  content.appendChild(textEl);

  // Badge row
  const badgeRow = document.createElement('div');
  badgeRow.className = 'flex items-center gap-2 mt-1';
  badgeRow.appendChild(EntityBadge({ type, confidence, source, compact: true }));
  content.appendChild(badgeRow);

  item.appendChild(content);

  // Click handler for navigation
  if (onClick) {
    item.addEventListener('click', onClick);
  }

  return item;
}
```

### EntityGroup Component

```typescript
// shared/ui-components/src/entity/EntityGroup.ts
import { cn } from '../utils/cn';
import { EntityListItem, type EntityListItemProps } from './EntityListItem';
import { getTypeConfig, getTypeColor } from './EntityTypeConfig';

export interface EntityGroupProps {
  /** Entity type for this group */
  type: string;
  /** Entities in this group */
  entities: Omit<EntityListItemProps, 'type'>[];
  /** Whether group is collapsed */
  collapsed?: boolean;
  /** Toggle collapse handler */
  onToggleCollapse?: () => void;
  /** Select all handler */
  onSelectAll?: (selected: boolean) => void;
  /** Entity click handler */
  onEntityClick?: (entityId: string) => void;
  /** Entity selection change handler */
  onEntitySelectionChange?: (entityId: string, selected: boolean) => void;
  /** Additional CSS classes */
  className?: string;
}

export function EntityGroup(props: EntityGroupProps): HTMLDivElement {
  const {
    type,
    entities,
    collapsed = false,
    onToggleCollapse,
    onSelectAll,
    onEntityClick,
    onEntitySelectionChange,
    className,
  } = props;

  const config = getTypeConfig(type);
  const selectedCount = entities.filter(e => e.selected).length;
  const allSelected = selectedCount === entities.length;
  const someSelected = selectedCount > 0 && !allSelected;

  const group = document.createElement('div');
  group.className = cn('border-b border-border last:border-b-0', className);

  // Header
  const header = document.createElement('div');
  header.className = cn(
    'flex items-center gap-2 px-3 py-2 bg-muted/30',
    'cursor-pointer hover:bg-muted/50 transition-colors sticky top-0 z-10'
  );

  // Expand/collapse chevron
  const chevron = document.createElement('span');
  chevron.className = cn(
    'w-4 h-4 transition-transform',
    !collapsed && 'rotate-90'
  );
  chevron.innerHTML = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
  </svg>`;
  header.appendChild(chevron);

  // Select all checkbox
  const selectAll = document.createElement('input');
  selectAll.type = 'checkbox';
  selectAll.checked = allSelected;
  selectAll.indeterminate = someSelected;
  selectAll.className = 'h-4 w-4 rounded border-gray-300';
  selectAll.addEventListener('change', (e) => {
    e.stopPropagation();
    onSelectAll?.(!allSelected);
  });
  selectAll.addEventListener('click', (e) => e.stopPropagation());
  header.appendChild(selectAll);

  // Type indicator
  const typeIndicator = document.createElement('span');
  typeIndicator.className = 'w-3 h-3 rounded-full';
  typeIndicator.style.backgroundColor = getTypeColor(type);
  header.appendChild(typeIndicator);

  // Type label and count
  const labelEl = document.createElement('span');
  labelEl.className = 'flex-1 font-medium text-sm';
  labelEl.textContent = config.label;
  header.appendChild(labelEl);

  const countEl = document.createElement('span');
  countEl.className = 'text-xs text-muted-foreground';
  countEl.textContent = `${selectedCount}/${entities.length}`;
  header.appendChild(countEl);

  header.addEventListener('click', () => onToggleCollapse?.());
  group.appendChild(header);

  // Content (entity list)
  if (!collapsed) {
    const content = document.createElement('div');
    content.className = 'py-1';

    entities.forEach(entity => {
      const item = EntityListItem({
        ...entity,
        type,
        onClick: () => onEntityClick?.(entity.id),
        onSelectionChange: (selected) => onEntitySelectionChange?.(entity.id, selected),
      });
      content.appendChild(item);
    });

    group.appendChild(content);
  }

  return group;
}
```

## Tasks / Subtasks

- [ ] **Task 1: Create EntityTypeConfig** (AC: entity type colors)
  - [ ] Create `shared/ui-components/src/entity/EntityTypeConfig.ts`
  - [ ] Define all entity types with HSL colors
  - [ ] Define source configuration (ML, RULE, MANUAL)
  - [ ] Export helper functions (getTypeConfig, getTypeColor, getConfidenceLevel)

- [ ] **Task 2: Create EntityBadge component** (AC: EntityBadge)
  - [ ] Create `shared/ui-components/src/entity/EntityBadge.ts`
  - [ ] Implement type color coding
  - [ ] Implement confidence indicator (dot)
  - [ ] Implement source badge
  - [ ] Support compact mode

- [ ] **Task 3: Create EntityListItem component** (AC: EntityListItem)
  - [ ] Create `shared/ui-components/src/entity/EntityListItem.ts`
  - [ ] Implement checkbox selection
  - [ ] Implement text truncation
  - [ ] Implement click handling
  - [ ] Implement selected/hover states

- [ ] **Task 4: Create EntityGroup component** (AC: EntityGroup)
  - [ ] Create `shared/ui-components/src/entity/EntityGroup.ts`
  - [ ] Implement collapsible header
  - [ ] Implement bulk selection (select all)
  - [ ] Implement sticky header
  - [ ] Render EntityListItems

- [ ] **Task 5: Create EntitySidebar component** (AC: EntitySidebar)
  - [ ] Create `shared/ui-components/src/entity/EntitySidebar.ts`
  - [ ] Implement filter panel
  - [ ] Implement entity grouping
  - [ ] Implement scrolling with sticky headers
  - [ ] Show total/selected counts

- [ ] **Task 6: Create barrel export** (AC: General)
  - [ ] Create `shared/ui-components/src/entity/index.ts`
  - [ ] Export all components and types
  - [ ] Update main index.ts

- [ ] **Task 7: Refactor browser-app EntitySidebar** (AC: browser-app refactored)
  - [ ] Update `browser-app/src/components/EntitySidebar.ts` to use shared components
  - [ ] Keep app-specific logic (callbacks, state management)
  - [ ] Remove duplicate CSS (use Tailwind classes)
  - [ ] Verify all features work

- [ ] **Task 8: Refactor Electron EntityReviewUI** (AC: Electron refactored)
  - [ ] Update `src/ui/EntityReviewUI.ts` to use shared components
  - [ ] Keep IPC integration
  - [ ] Verify all features work

- [ ] **Task 9: Write unit tests** (AC: all have unit tests)
  - [ ] Test EntityBadge variants
  - [ ] Test EntityListItem selection
  - [ ] Test EntityGroup collapse/expand
  - [ ] Test EntitySidebar filtering

## Dev Notes

### Migration from Existing Components

**Current browser-app structure:**
```
browser-app/src/components/sidebar/
├── EntityFilters.ts       → Filter panel in EntitySidebar
├── EntityRenderer.ts      → EntityListItem + EntityGroup
├── EntitySidebarStyles.ts → Replaced by Tailwind classes
├── EntityStateManager.ts  → Keep in browser-app (app-specific)
├── EntityTypeConfig.ts    → Shared EntityTypeConfig
└── index.ts
```

**Migration approach:**
1. Move `EntityTypeConfig` to shared (this task)
2. Replace `EntityRenderer` with `EntityListItem` + `EntityGroup`
3. Replace injected CSS with Tailwind classes
4. Keep `EntityStateManager` in browser-app (manages app state)

[Source: browser-app/src/components/sidebar/EntityTypeConfig.ts]

### Color Consistency

The entity colors are defined in HSL to enable:
- Easy dark mode adjustments (increase lightness)
- Opacity variations for backgrounds
- Consistent palette across apps

Current colors from browser-app:
- PERSON: hsl(221.2 83.2% 53.3%) - Blue
- ORG: hsl(263.4 70% 50.4%) - Purple
- ADDRESS: hsl(142.1 76.2% 36.3%) - Green
- EMAIL: hsl(0 84.2% 60.2%) - Red
- PHONE: hsl(24.6 95% 53.1%) - Orange

### Prerequisites

- Story 9.1: Shared Tailwind Config
- Story 9.2: Core UI Library Setup
- Story 9.3: Primitive Components (Checkbox)

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-9.md#Entity-UI-Components]
- [Source: browser-app/src/components/sidebar/EntityTypeConfig.ts]
- [Source: browser-app/src/components/EntitySidebar.ts]

## Definition of Done

- [ ] EntityTypeConfig with all PII types and colors
- [ ] EntityBadge with type, confidence, and source
- [ ] EntityListItem with checkbox and click handling
- [ ] EntityGroup with collapse and bulk selection
- [ ] EntitySidebar with filter and grouping
- [ ] All components exported from entity/index.ts
- [ ] browser-app EntitySidebar refactored
- [ ] Electron EntityReviewUI refactored
- [ ] Unit tests for each component
- [ ] Entity colors match existing design
- [ ] TypeScript compiles without errors

## Dev Agent Record

### Context Reference

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
