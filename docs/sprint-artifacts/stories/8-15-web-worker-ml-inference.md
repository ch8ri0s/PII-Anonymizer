# Story 8.15: Web Worker ML Inference

## Story

As a **browser user**,
I want **ML inference to run in a Web Worker**,
So that **the UI remains responsive during PII detection processing**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.15 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Backlog |
| **Created** | 2025-12-24 |
| **Priority** | P1 - High |

## Acceptance Criteria

**Given** ML inference is triggered in the browser
**When** inference runs
**Then** processing happens in a Web Worker (not main thread)
**And** UI remains responsive during processing
**And** progress updates are communicated to main thread
**And** results are returned to main thread when complete

**And** worker is reused across multiple inference calls
**And** worker lifecycle is managed (create, reuse, terminate)
**And** error handling works across thread boundary
**And** performance is equivalent or better than main-thread inference

## Technical Design

### Files to Create/Modify

1. **Modify:** `browser-app/src/workers/pii.worker.ts` - Add ML inference capability
2. **Modify:** `browser-app/src/model/ModelManager.ts` - Support worker-based inference
3. **Modify:** `browser-app/src/pii/BrowserHighRecallPass.ts` - Use worker for inference
4. **Create:** `browser-app/src/workers/ml-inference.worker.ts` - Dedicated ML worker (optional)

### Current State

**Existing:** `browser-app/src/workers/pii.worker.ts` exists but may not handle ML inference.

**Option A:** Extend existing PII worker  
**Option B:** Create dedicated ML inference worker

**Recommendation:** Option A (extend existing worker) for simplicity.

### Worker Interface

```typescript
// browser-app/src/workers/pii.worker.ts (extended)

interface WorkerRequest {
  type: 'ML_INFERENCE' | 'REGEX_DETECTION' | 'FULL_PIPELINE';
  id: string;
  payload: {
    text: string;
    options?: {
      threshold?: number;
      language?: string;
    };
  };
}

interface WorkerResponse {
  type: 'ML_INFERENCE_RESULT' | 'ERROR' | 'PROGRESS';
  id: string;
  payload: {
    predictions?: MLPrediction[];
    error?: string;
    progress?: number;
  };
}

// Worker message handler
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, id, payload } = event.data;

  if (type === 'ML_INFERENCE') {
    try {
      // Load model in worker if not already loaded
      if (!workerModel) {
        workerModel = await loadModelInWorker();
      }

      // Run inference
      const predictions = await workerModel(payload.text);
      
      // Send result
      self.postMessage({
        type: 'ML_INFERENCE_RESULT',
        id,
        payload: { predictions },
      });
    } catch (error) {
      self.postMessage({
        type: 'ERROR',
        id,
        payload: { error: error.message },
      });
    }
  }
};
```

### Main Thread Integration

```typescript
// browser-app/src/model/ModelManager.ts

let worker: Worker | null = null;
let workerReady = false;

/**
 * Initialize Web Worker for ML inference
 */
function initWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(
    new URL('../workers/pii.worker.ts', import.meta.url),
    { type: 'module' }
  );

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const { type, id, payload } = event.data;
    
    if (type === 'ML_INFERENCE_RESULT') {
      // Resolve pending promise
      const resolver = pendingRequests.get(id);
      if (resolver) {
        resolver.resolve(payload.predictions!);
        pendingRequests.delete(id);
      }
    } else if (type === 'ERROR') {
      const resolver = pendingRequests.get(id);
      if (resolver) {
        resolver.reject(new Error(payload.error));
        pendingRequests.delete(id);
      }
    }
  };

  workerReady = true;
  return worker;
}

/**
 * Run inference using Web Worker
 */
export async function runInferenceInWorker(text: string): Promise<MLPrediction[]> {
  if (!workerReady) {
    initWorker();
  }

  const id = uuidv4();
  const promise = new Promise<MLPrediction[]>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
  });

  worker!.postMessage({
    type: 'ML_INFERENCE',
    id,
    payload: { text },
  });

  return promise;
}
```

### Configuration

```typescript
// browser-app/src/model/types.ts

export interface ModelManagerConfig {
  // ... existing config ...
  /** Use Web Worker for inference (default: true in browser) */
  useWorker: boolean;
}
```

## Prerequisites

- Story 8.10 (Subword Token Merging) - Worker uses merged tokens
- Story 8.11 (Document Chunking) - Worker handles chunked documents
- Story 8.12 (Input Validation) - Validation happens before worker call

## Integration Points

- Extends existing `pii.worker.ts`
- Used by `BrowserHighRecallPass` (Browser only)
- Model loading in worker (first call may be slower)
- Progress updates communicated to main thread

## Test Scenarios

1. **Worker initialization:** Worker created on first inference call
2. **Inference in worker:** ML inference runs in worker thread
3. **UI responsiveness:** Main thread remains responsive during inference
4. **Result communication:** Results correctly passed back to main thread
5. **Error handling:** Errors in worker are caught and communicated
6. **Worker reuse:** Same worker reused for multiple inferences
7. **Model loading:** Model loaded in worker (cached after first load)
8. **Performance:** Worker inference performance equivalent to main thread
9. **Memory:** Worker memory isolated from main thread
10. **Termination:** Worker can be terminated when not needed

## Definition of Done

- [ ] `pii.worker.ts` extended with ML inference capability
- [ ] `ModelManager.ts` updated with worker-based inference option
- [ ] `BrowserHighRecallPass.ts` uses worker inference
- [ ] Worker lifecycle management (create, reuse, terminate)
- [ ] Error handling across thread boundary
- [ ] Progress updates communicated to main thread
- [ ] Unit tests for worker message handling
- [ ] Integration tests verify UI remains responsive
- [ ] Performance tests verify no degradation vs main thread
- [ ] TypeScript compiles without errors
- [ ] Configuration option to enable/disable worker

## Impact

**Before:** ML inference blocks UI thread, poor user experience  
**After:** UI remains responsive, better user experience  
**Quality Improvement:** Enables processing of large documents without UI freezing

## Precision/Recall Impact Testing

### Baseline Comparison
Uses shared accuracy utilities from `shared/test/accuracy.ts`:

```typescript
import { calculatePrecisionRecall } from '@shared-test/accuracy';

// Worker inference should produce identical quality to main-thread
const workerMetrics = calculatePrecisionRecall(workerDetected, expected);
const mainThreadMetrics = calculatePrecisionRecall(mainThreadDetected, expected);

// Quality must be identical regardless of execution context
expect(workerMetrics.f1).toBe(mainThreadMetrics.f1);
```

### Regression Prevention
- **Baseline metrics:** See `test/baselines/epic8-before.json` (browser section)
- **Worker constraint:** Zero quality degradation vs main-thread inference
- **Serialization:** Entity positions preserved across worker boundary
- **Regression threshold:** Worker F1 === Main-thread F1

### ML-Specific Test Scenarios
| Scenario | Execution Context | Expected Result |
|----------|-------------------|-----------------|
| Simple text | Worker | Identical entities to main-thread |
| Large document | Worker (chunked) | Same entities, same positions |
| Unicode text | Worker | Correct entity offsets after serialization |
| Concurrent requests | Multiple worker calls | Each produces correct, isolated results |
| Worker restart | Worker terminated + recreated | Same quality as fresh worker |

### Cross-Platform Validation
- Browser (Worker) vs Browser (Main-thread): identical quality
- Browser (Worker) vs Electron: quality within platform tolerance (see baseline)
- Message serialization: No entity data loss across postMessage boundary

### Worker-Specific Quality Assertions
```typescript
// Verify worker serialization doesn't corrupt entity data
const workerResult = await runInferenceInWorker(text);
const mainResult = await runInference(text);

// Entity positions must match exactly
workerResult.forEach((entity, i) => {
  expect(entity.start).toBe(mainResult[i].start);
  expect(entity.end).toBe(mainResult[i].end);
  expect(entity.type).toBe(mainResult[i].type);
});
```

## Notes

- **Electron:** Not applicable (Node.js has worker threads but different API)
- **Browser only:** This story is browser-specific
- **Optional:** Can be disabled via config for debugging
- **Model loading:** First inference may be slower (model loads in worker)

