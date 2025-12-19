# Story 5.1: Confidence Score Display

Status: done

## Story

As a **user reviewing detected entities**,
I want **to see why each entity was detected and its confidence level**,
so that **I can make informed decisions about uncertain detections**.

## Acceptance Criteria

| AC ID | Criterion |
|-------|-----------|
| AC-5.1.1 | Given an entity in the sidebar, when entity is displayed, then confidence score (0-100%) is visible |
| AC-5.1.2 | Detection source (ML/RULE/BOTH/MANUAL) is displayed for each entity |
| AC-5.1.3 | Low-confidence entities (<60%) show warning indicator (yellow/red styling) |
| AC-5.1.4 | Entities flagged for review are visually distinct from auto-approved |
| AC-5.1.5 | Confidence color coding: green (>=85%), yellow (70-84%), red (<70%) |

## Tasks / Subtasks

- [x] **Task 1: Verify existing confidence infrastructure** (AC: all)
  - [x] Confirm `ReviewableEntity.confidence` in `src/types/entityReview.ts:33-34`
  - [x] Verify entity initialization sets confidence in `renderer.js:716`
  - [x] Confirm CSS classes `.entity-confidence-high/medium/low` in `src/input.css:436-450`
  - [x] Review existing confidence filter slider in `renderer.js:935-949`

- [x] **Task 2: Add confidence badge to entity items** (AC: 5.1.1, 5.1.5)
  - [x] Add `getConfidenceClass(confidence)` helper function to `renderer.js`
  - [x] Modify `renderEntityItem()` to include confidence percentage badge
  - [x] Apply color coding: `.entity-confidence-high` (>=0.85), `.entity-confidence-medium` (0.70-0.84), `.entity-confidence-low` (<0.70)
  - [x] Position badge in entity item header next to type/source badges

- [x] **Task 3: Add source badge display** (AC: 5.1.2)
  - [x] Verify source badge already displays for MANUAL entities (`renderer.js:1019-1021`)
  - [x] Add source badge for ML, RULE, BOTH sources
  - [x] Add CSS classes for source badges: `.entity-source-ml`, `.entity-source-rule`, `.entity-source-both`
  - [x] Use distinct colors: ML (blue), RULE (purple), BOTH (indigo), MANUAL (cyan - existing)

- [x] **Task 4: Add warning indicator for low confidence** (AC: 5.1.3)
  - [x] Add warning icon (warning emoji) for entities with confidence < 0.60
  - [x] Apply red styling for critical low confidence (<0.60)
  - [x] Add tooltip explaining why entity is flagged

- [x] **Task 5: Visual distinction for flagged entities** (AC: 5.1.4)
  - [x] Verify `flaggedForReview` property exists on entities
  - [x] Add flag indicator (flag emoji) for flagged entities
  - [x] Add left border highlight for flagged entities (`.entity-flagged` with `border-l-4 border-yellow-500`)

- [x] **Task 6: Add unit tests for confidence display** (AC: all)
  - [x] Add Story 5.1 test section to `entityReview.test.js`
  - [x] Test `getConfidenceClass()` returns correct class for all thresholds
  - [x] Test confidence badge renders with correct value
  - [x] Test source badges render for all source types
  - [x] Test warning indicator appears for low-confidence entities
  - [x] Test flagged entities have visual distinction

- [x] **Task 7: Run test suite and verify no regression** (AC: all)
  - [x] Run full test suite - 647 tests passing (up from 619)
  - [x] Run lint check - 0 warnings
  - [x] CSS rebuild completed successfully

## Dev Notes

### Architecture Alignment

Story 5.1 begins Epic 5 (Confidence Scoring & Feedback) by adding visual confidence indicators to the entity review UI. This builds on the Epic 4 infrastructure.

```
Epic 4 Complete:
Entity Sidebar (4.1) -> Filtering (4.2) -> Selective Anonymization (4.3) -> Manual PII (4.4)
    |
Epic 5 Starts:
Confidence Display (5.1) -> Correction Logging (5.2) -> Accuracy Dashboard (5.3)
```

**Component Location:**
- Primary: `renderer.js` (renderEntityItem function around line 1018-1051)
- Types: `src/types/entityReview.ts` (confidence already defined)
- CSS: `src/input.css` (confidence and source classes at lines 436-483)
- Tests: `test/unit/entityReview.test.js`

### Codebase Exploration Findings (from Epic 4 Retrospective)

**What Already Existed:**
- `ReviewableEntity.confidence: number` in `src/types/entityReview.ts:33-34`
- `EntityFilterOptions.minConfidence: number` in `src/types/entityReview.ts:65-66`
- CSS classes `.entity-confidence-high/medium/low` in `src/input.css:436-450` - **READY BUT NOT RENDERED**
- Confidence filter slider in `renderer.js:935-949`
- Low-confidence flagging (< 0.7) in `renderer.js:719`
- Default confidence set to 0.85 in `renderer.js:716`

**What Was Added:**
- `getConfidenceClass()` helper function (renderer.js:997-1001)
- `getSourceClass()` helper function (renderer.js:1008-1016)
- Confidence badge rendering in `renderEntityItem()` (renderer.js:1041-1046)
- Source badges for ML/RULE/BOTH with distinct colors
- Warning indicator for <0.60 confidence
- Flagged entity visual distinction with left border

### CSS Classes Added (src/input.css:452-483)

```css
.entity-source { @apply text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600; }
.entity-source-ml { @apply text-xs font-medium px-1.5 py-0.5 rounded bg-blue-100 text-blue-700; }
.entity-source-rule { @apply text-xs font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700; }
.entity-source-both { @apply text-xs font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700; }
.entity-source-manual { @apply text-xs font-medium px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700; }
.entity-warning { @apply text-xs; }
.entity-flagged { @apply border-l-4 border-yellow-500 pl-2; }
```

### References

- [Source: docs/epics.md#Story-5.1-Confidence-Score-Display]
- [Source: docs/architecture.md#Epic-5-Confidence-Feedback]
- [Source: src/types/entityReview.ts#ReviewableEntity]
- [Source: docs/sprint-artifacts/retrospectives/epic-4-retrospective.md#Action-Item-5]
- Dependencies: Epic 4 complete (Entity Review Workflow)

---

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

1. **Verification Complete**: Existing infrastructure was already in place (types, CSS classes, confidence in entity state)
2. **Implementation Minimal**: Only ~60 lines of code added across renderer.js and input.css
3. **Test Coverage Strong**: Added 28 new tests covering all acceptance criteria
4. **No Breaking Changes**: All 647 tests passing, 0 lint warnings

### File List

| File | Changes |
|------|---------|
| `renderer.js` | Added `getConfidenceClass()`, `getSourceClass()`, updated `renderEntityItem()` |
| `src/input.css` | Added source badge classes, warning class, flagged class |
| `test/unit/entityReview.test.js` | Added Story 5.1 test suite (28 tests) |
| `test/integration/downloadPipeline.test.js` | Fixed pre-existing lint warning (unused var) |

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-11 | SM Agent (Opus 4.5) | Initial story creation from epics.md via create-story workflow |
| 2025-12-11 | Dev Agent (Opus 4.5) | Implemented confidence display, source badges, warning indicators, flagged distinction, 28 tests |
