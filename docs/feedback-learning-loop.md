# Feedback Learning Loop (Story 8.9)

## Overview

The Feedback Learning Loop captures user corrections from the Entity Review UI and aggregates them into actionable patterns. This enables systematic improvement of PII detection without manual rule hunting.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Workflow                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User processes document                                      │
│  2. Entity Sidebar shows detected PII                            │
│  3. User corrects detections:                                    │
│     - Dismiss false positives (mark as NOT PII)                  │
│     - Add missed entities (mark as PII)                          │
│     - Change entity types                                        │
│  4. Corrections are logged locally (anonymized)                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Local Storage                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Desktop: userData/corrections-YYYY-MM.json                      │
│  Browser: IndexedDB (pii-anonymizer-feedback)                    │
│                                                                  │
│  - Anonymized context (no raw PII)                              │
│  - Entity type + position                                        │
│  - Detection source + confidence                                 │
│  - Document hash (privacy-preserving)                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                  Monthly Review (Manual)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Run export script: node scripts/export-feedback-dataset.mjs │
│  2. Review feedback-summary.json                                 │
│  3. Identify top false positive patterns                         │
│  4. Identify top missed PII patterns                             │
│  5. Update DenyList/ContextWords/recognizers                     │
│  6. Test changes with accuracy benchmark                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Privacy Guarantees

1. **No Network Calls**: All feedback data stays local
2. **No Raw PII**: Only entity type markers and limited context (max 200 chars)
3. **Document Hashing**: Filenames are SHA-256 hashed
4. **Retention Limits**: Max 10,000 events OR 90 days (configurable)
5. **Explicit Export**: Data export is a manual user action

## Monthly Review Workflow

### Step 1: Export Feedback Data

```bash
# Default: Anonymized export (safe for sharing patterns)
node scripts/export-feedback-dataset.mjs

# Raw export (internal training only)
node scripts/export-feedback-dataset.mjs --mode=raw --include-contexts

# Custom options
node scripts/export-feedback-dataset.mjs \
  --output=./analysis \
  --min-count=3 \
  --max-patterns=50
```

### Step 2: Review Summary

Open `feedback-export/feedback-summary.json`:

```json
{
  "exportedAt": "2025-01-15T10:00:00Z",
  "mode": "anonymised",
  "totalEvents": 1234,
  "dateRange": {
    "start": "2024-12-01T00:00:00Z",
    "end": "2025-01-15T10:00:00Z"
  },
  "falsePositives": [
    {
      "pattern": "[PERSON_NAME_PATTERN_abc123]",
      "entityType": "PERSON_NAME",
      "count": 45,
      "avgConfidence": 0.72,
      "sources": ["ML", "REGEX"]
    }
  ],
  "missedPii": [
    {
      "pattern": "[EMAIL_PATTERN_def456]",
      "entityType": "EMAIL",
      "count": 12
    }
  ]
}
```

### Step 3: Update Detection Rules

**For high-frequency false positives:**

1. Add to DenyList:
   ```typescript
   // shared/pii/context/DenyList.ts
   {
     pattern: /^Legal Services$/i,
     types: ['PERSON_NAME'],
     reason: 'Common service name, not a person',
   }
   ```

2. Add negative context words:
   ```typescript
   // shared/pii/context/ContextWords.ts
   {
     word: 'services',
     weight: -0.3,
     language: 'en',
     notes: 'Indicates service name, not person',
   }
   ```

**For high-frequency missed PII:**

1. Add recognizer patterns:
   ```typescript
   // shared/pii/recognizers/*.yaml
   patterns:
     - regex: "new-pattern-here"
       confidence: 0.8
   ```

2. Add positive context words for better detection

### Step 4: Test Changes

```bash
# Run accuracy benchmark
npm run test:accuracy

# Check specific entity types
npm test -- --grep "PERSON_NAME"
```

### Step 5: Update Baseline

After merging changes:
```bash
npm run test:accuracy -- --update-baseline
```

## Configuration

### Retention Settings

Desktop (Electron):
```typescript
const feedbackLogger = getFeedbackLogger();
feedbackLogger.setRetentionSettings({
  maxEvents: 10000,  // Maximum events to retain
  maxAgeDays: 90,    // Maximum age in days
  enabled: true,     // Enable automatic pruning
});
```

Browser:
```typescript
import { applyRetentionPolicy } from './services/FeedbackLogger';
await applyRetentionPolicy(10000, 90);
```

### Delete All Feedback

Desktop:
```typescript
const count = await feedbackLogger.deleteAllFeedbackData();
console.log(`Deleted ${count} entries`);
```

Browser:
```typescript
import { deleteAllFeedbackData } from './services/FeedbackLogger';
const count = await deleteAllFeedbackData();
```

## API Reference

### FeedbackAggregator

```typescript
import { FeedbackAggregator } from 'shared/pii/feedback/FeedbackAggregator';

const aggregator = new FeedbackAggregator(events, {
  maxPatterns: 20,      // Max patterns per category
  minCount: 1,          // Minimum count to include
  maxContexts: 3,       // Max context examples
  groupByDocumentType: false,
  normalizeCase: true,
});

const summary = aggregator.summarize();
const falsePositives = aggregator.getFalsePositivePatterns();
const missedPii = aggregator.getMissedPiiPatterns();
```

### FeedbackLogger (Desktop)

```typescript
import { getFeedbackLogger } from 'src/services/feedbackLogger';

const logger = getFeedbackLogger();

// Get all events as FeedbackEvents
const events = await logger.getAllFeedbackEvents();

// Get aggregated summary
const summary = await logger.getAggregatedSummary();

// Apply retention policy
const deleted = await logger.applyRetentionPolicy();

// Delete all data
const count = await logger.deleteAllFeedbackData();
```

### FeedbackLogger (Browser)

```typescript
import {
  getAllFeedbackEvents,
  getAggregatedSummary,
  deleteAllFeedbackData,
  applyRetentionPolicy,
} from './services/FeedbackLogger';

const events = await getAllFeedbackEvents();
const summary = await getAggregatedSummary();
const deleted = await deleteAllFeedbackData();
```

## Files

| File | Purpose |
|------|---------|
| `shared/pii/feedback/types.ts` | Type definitions |
| `shared/pii/feedback/FeedbackAggregator.ts` | Pattern aggregation |
| `src/services/feedbackLogger.ts` | Desktop logging + API |
| `browser-app/src/services/FeedbackLogger.ts` | Browser logging + API |
| `scripts/export-feedback-dataset.mjs` | Export script |
| `test/unit/pii/feedback/FeedbackAggregator.test.js` | Unit tests |

## Related Documentation

- [ADR-009: PERSON_NAME Precision Monitoring](adr/ADR-009-person-name-precision-monitoring.md)
- [Story 5.2: User Correction Logging](sprint-artifacts/stories/5-2-user-correction-logging.md)
- [Story 7.8: User Correction Feedback Logging](sprint-artifacts/stories/7-8-user-correction-feedback-logging.md)
