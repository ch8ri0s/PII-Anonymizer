# Story 7.2: ML Model Browser Integration

**Epic:** Epic 7 - Browser Migration
**Status:** done
**Started:** 2025-12-19
**Completed:** 2025-12-19
**Developer:** AI Assistant

---

## User Story

As a **user loading the browser app**,
I want **the PII detection ML model to load and cache efficiently**,
So that **subsequent visits don't require re-downloading the model**.

---

## Acceptance Criteria

**Given** the browser app on first load
**When** the app initializes
**Then**:
1. The ML model downloads from HuggingFace CDN (~129MB) with progress indicator
2. Model is cached in IndexedDB for offline use
3. Subsequent page loads use cached model (instant startup)
4. User can see download progress percentage
5. Model loading can be cancelled
6. Fallback to regex-only detection if model fails to load

---

## Prerequisites

- [x] Story 7.1 (converters working) - Completed 2025-12-19

---

## Technical Tasks

### Task 1: Create Model Types & Constants
- [x] Port `ModelStatus`, `DownloadProgress`, `DownloadResult` types
- [x] Port `MODEL_NAME`, `MODEL_SIZE_BYTES` constants
- [x] Create `browser-app/src/model/types.ts`

### Task 2: Implement ModelManager for Browser
- [x] Create `browser-app/src/model/ModelManager.ts`
- [x] Use `@xenova/transformers` browser caching (env.useBrowserCache)
- [x] Implement progress callback for download status
- [x] Handle IndexedDB storage (built-in to transformers.js)

### Task 3: Create ModelLoader UI Component
- [x] Create loading overlay/modal component
- [x] Show progress bar with percentage
- [x] Add cancel button functionality
- [x] Display file being downloaded

### Task 4: Implement Fallback Detection
- [x] Create detection mode flag (ML vs regex-only)
- [x] Implement graceful degradation when model fails
- [x] Update PIIDetector to handle both modes
- [x] Show user notification when using fallback

### Task 5: Integration with Main App
- [x] Initialize model on app load
- [x] Block processing until model ready (or fallback active)
- [x] Update process button to show model status
- [x] Add model status indicator in UI

### Task 6: Testing
- [x] Unit tests for ModelManager (14 tests)
- [x] Unit tests for ModelLoaderUI (18 tests)
- [x] Mock model loading for fast tests
- [x] Test fallback detection mode
- [x] Test progress callback

---

## Technical Notes

- Use `@xenova/transformers` browser build (already in package.json)
- Configure: `env.useBrowserCache = true` for IndexedDB caching
- Transformers.js handles IndexedDB storage automatically
- Progress callback receives status: 'initiate' | 'download' | 'progress' | 'done' | 'ready' | 'error'
- Model name: `Xenova/distilbert-base-multilingual-cased-ner-hrl`

---

## Definition of Done

- [x] Model downloads with progress indicator on first load
- [x] Subsequent loads use cached model (no network)
- [x] Fallback mode works when model unavailable
- [x] All tests passing (246 tests)
- [x] No console errors during load

---

## Notes

Porting from Electron `src/services/modelManager.ts` but adapting for browser:
- No `electron.app.getPath()` - use browser cache APIs
- No file system access - use IndexedDB via transformers.js
- No IPC messages - direct callbacks
