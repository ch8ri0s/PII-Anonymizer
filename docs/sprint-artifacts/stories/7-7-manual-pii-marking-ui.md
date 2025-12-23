# Story 7.7: Manual PII Marking UI Polish

**Epic:** Epic 7 - Browser Migration
**Status:** drafted
**Created:** 2025-12-23
**Developer:** TBD

---

## User Story

As a **user who found missed PII in the browser app**,
I want **to manually mark text as PII using an intuitive right-click context menu**,
So that **the system includes my corrections in the anonymization and I can confidently protect all sensitive data**.

---

## Acceptance Criteria

**Given** a document is loaded with detected PII in the browser preview
**When** user selects text and wants to mark it as PII
**Then**:

1. **AC1:** Right-click on selected text shows context menu with "Mark as PII" option and entity type submenu
2. **AC2:** Clicking entity type (Person, Organization, Address, etc.) adds the selection as a manual entity
3. **AC3:** Manual entities appear in sidebar with "Manual" badge and 100% confidence
4. **AC4:** Manual entities are highlighted in preview with consistent styling
5. **AC5:** Keyboard shortcut (Cmd/Ctrl+M) opens entity type selector for current selection
6. **AC6:** Toast notification confirms when entity is successfully added
7. **AC7:** Manual entity can be removed by deselecting in sidebar (same as auto-detected)

---

## Prerequisites

- [x] Story 7.1 (document converters working) - Completed 2025-12-19
- [x] Story 7.2 (ML model loading) - Completed 2025-12-19
- [x] Story 7.3 (PII detection pipeline) - Completed 2025-12-22
- [x] Story 7.4 (entity review UI) - Completed 2025-12-22

---

## Technical Tasks

### Task 1: Fix Context Menu Trigger (AC: #1, #2)
- [ ] Change context menu trigger from `mouseup` to `contextmenu` event (right-click)
- [ ] Maintain text selection when right-click occurs
- [ ] Prevent default browser context menu when text is selected
- [ ] Position context menu at mouse cursor location
- [ ] Ensure context menu closes on click outside or Escape key
- [ ] Update `ContextMenu.ts` event binding logic

### Task 2: Visual Selection Feedback (AC: #1)
- [ ] Add temporary highlight to selected text before marking
- [ ] Style: light blue background while selection is active
- [ ] Show "Mark as PII" tooltip hint on text selection (non-intrusive)
- [ ] Remove highlight when selection is cleared or menu is dismissed

### Task 3: Keyboard Shortcut Support (AC: #5)
- [ ] Add global keyboard listener for Cmd/Ctrl+M
- [ ] When triggered with active selection, show entity type quick-picker
- [ ] Quick-picker: floating dropdown near selection with entity types
- [ ] Allow keyboard navigation (arrow keys + Enter) in picker
- [ ] Cancel with Escape key
- [ ] Handle case when no text is selected (show hint message)

### Task 4: Toast Notification System (AC: #6)
- [ ] Create `browser-app/src/components/Toast.ts` component
- [ ] Implement `showToast(message: string, type: 'success' | 'error' | 'info')`
- [ ] Toast appears in bottom-right corner, auto-dismisses after 3 seconds
- [ ] Stack multiple toasts if triggered in quick succession
- [ ] Styling: success (green), error (red), info (blue) variants
- [ ] Accessible: role="alert" for screen readers

### Task 5: Entity Type Selector Improvements (AC: #2, #5)
- [ ] Add icons to entity type options (already in ContextMenu.ts, verify display)
- [ ] Add keyboard hints in menu (e.g., "P" for Person, "O" for Organization)
- [ ] Support single-key selection when menu is open (P → Person)
- [ ] Ensure consistent type list with detection pipeline types

### Task 6: Manual Entity Integration (AC: #3, #4, #7)
- [ ] Verify `addManualEntity()` in EntitySidebar.ts works correctly
- [ ] Ensure manual entities get proper `entityIndex` numbering
- [ ] Verify manual entities appear with "Manual" source badge (orange color)
- [ ] Confirm deselection workflow removes entity from anonymization
- [ ] Ensure manual entities persist during filter changes

### Task 7: Testing (AC: #1-7)
- [ ] Create `browser-app/test/components/ContextMenu.integration.test.ts`
- [ ] Test right-click triggers context menu with selection
- [ ] Test keyboard shortcut opens entity picker
- [ ] Test manual entity appears in sidebar after marking
- [ ] Test toast notification appears on success
- [ ] Test entity removal via deselection
- [ ] Create `browser-app/test/components/Toast.test.ts`
- [ ] Target: 25+ new tests

---

## Dev Notes

### Learnings from Previous Story

**From Story 7-5-file-download-batch-processing (Status: done)**

- **Component Pattern**: Use module-level state with init/destroy pattern (see BatchController.ts)
- **CSS Injection**: Components inject their own CSS via `document.head.appendChild(styleSheet)`
- **Event Delegation**: Use event delegation for dynamic elements (see BatchPanel.ts)
- **Test Pattern**: 120 tests added using vitest + happy-dom - follow same patterns
- **Singleton Pattern**: Use for shared state (see BatchQueueManager.ts)

[Source: docs/sprint-artifacts/stories/7-5-file-download-batch-processing.md#Dev-Agent-Record]

### Current Implementation Status

The context menu implementation exists but has a UX issue:

| Component | File | Status |
|-----------|------|--------|
| ContextMenu | `browser-app/src/components/ContextMenu.ts` | Exists, triggers on mouseup not right-click |
| EntitySidebar | `browser-app/src/components/EntitySidebar.ts` | Works, has `addManualEntity()` |
| PreviewPanel | `browser-app/src/components/PreviewPanel.ts` | Integrates context menu |
| PreviewBody | `browser-app/src/components/preview/PreviewBody.ts` | Has text selection handler |

### Key Code Locations to Modify

```typescript
// ContextMenu.ts - Change line 185-206
// Current: mouseup event shows menu immediately
// Target: contextmenu event shows menu on right-click

// PreviewPanel.ts - Line 267-268
// Current: initContextMenu(handleManualMark);
//          setupTextSelectionHandler(contentElement, createTextOffsetCalculator(contentElement));
// May need adjustment for right-click flow
```

### Toast Component Design

```typescript
interface ToastOptions {
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number; // default 3000ms
}

// Usage
showToast({ message: 'Entity added: Person', type: 'success' });
```

### Keyboard Shortcut Implementation

```typescript
// Global listener in PreviewPanel or separate module
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
    e.preventDefault();
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      showEntityTypePicker(selection);
    }
  }
});
```

### References

- [Source: browser-app/src/components/ContextMenu.ts] - Current implementation
- [Source: browser-app/src/components/EntitySidebar.ts:404-434] - addManualEntity function
- [Source: browser-app/src/components/PreviewPanel.ts:349-362] - handleManualMark integration
- [Source: docs/epics.md#Story-4.4] - Original manual PII marking requirements

---

## Definition of Done

- [ ] Right-click on selected text shows context menu
- [ ] Context menu entity types work and add manual entities
- [ ] Manual entities appear in sidebar with "Manual" badge
- [ ] Keyboard shortcut (Cmd/Ctrl+M) works
- [ ] Toast notifications confirm entity addition
- [ ] Deselecting manual entity removes it from anonymization
- [ ] All tests passing (target: 25+ new tests)
- [ ] No console errors during manual marking flow
- [ ] Works across Chrome, Firefox, Safari, Edge

---

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

TBD

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2025-12-23 | 1.0.0 | Story drafted via correct-course workflow |
