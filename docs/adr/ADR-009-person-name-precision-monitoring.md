# ADR-009: PERSON_NAME Precision Monitoring Strategy

## Status

**Accepted** - 2025-12-27

## Context

After implementing Stories 8.18-8.22, PERSON_NAME precision improved from 37.5% to 42.9%, but remains below the 90% target. This is the single largest source of false positives in the PII detection system.

### Current PERSON_NAME Metrics

| Metric | Before 8.20 | After 8.20 | Target |
|--------|-------------|------------|--------|
| True Positives | 21 | 21 | - |
| False Positives | 35 | 28 | <3 |
| Precision | 37.5% | 42.9% | 90% |
| Recall | 91.3% | 91.3% | 90% |

### Remaining False Positive Categories

Based on analysis of test fixtures, remaining PERSON_NAME false positives fall into:

1. **Service/Product Names** (40%): "Consulting Services", "Premium Support", "Annual License"
2. **Partial Organization Names** (30%): Company names without legal suffixes
3. **Geographic Terms** (15%): City names, regions detected as person names
4. **Technical Terms** (15%): Document headers, form labels

## Decision

Implement a **production monitoring strategy** to identify and address PERSON_NAME false positives systematically.

### 1. Logging Strategy

Add telemetry for PERSON_NAME detections with low confidence:

```typescript
// Recommended implementation in ContextEnhancer or pipeline
interface PersonNameTelemetry {
  text: string;
  confidence: number;
  contextWords: string[];
  documentType: string;
  wasUserCorrected: boolean;
}
```

### 2. Feedback Loop Integration

Leverage the existing user correction logging (Story 5.2, 7.8) to identify false positives:

```typescript
// In correction logger
if (correction.type === 'remove' && correction.entityType === 'PERSON_NAME') {
  // Track as false positive pattern
  logFalsePositivePattern(correction.originalText, correction.context);
}
```

### 3. DenyList Auto-Expansion

Implement automatic DenyList suggestions based on user corrections:

```typescript
// After N user corrections of the same pattern
if (correctionCount[pattern] >= THRESHOLD) {
  suggestDenyListAddition(pattern, 'PERSON_NAME');
}
```

### 4. Confidence Threshold Tuning

Current approach uses static thresholds. Recommended:

| Source | Current Threshold | Recommended |
|--------|-------------------|-------------|
| Regex Pattern | 0.7 | 0.65 (lower, relies on context) |
| ML Model | 0.3 | 0.4 (higher, reduce noise) |
| Context-Enhanced | 0.85 | 0.8 |

### 5. Per-Document-Type Thresholds

Different document types have different false positive rates:

| Document Type | Recommended PERSON_NAME Threshold |
|---------------|-----------------------------------|
| Letter | 0.6 (names expected) |
| Invoice | 0.8 (mostly addresses/companies) |
| HR Document | 0.6 (names expected) |
| Contract | 0.7 |

## Implementation Recommendations

### Short-Term (Stories 8.23-8.24)

1. **Expand negative context words**: Add more service/product terms
2. **Two-word minimum enforcement**: Require at least 2 words for PERSON_NAME
3. **Capitalization validation**: Reject ALL_CAPS patterns (likely headings)

### Medium-Term (Epic 9+)

1. **ML model fine-tuning**: Train on Swiss/EU specific names
2. **Named entity disambiguation**: Cross-reference with organization patterns
3. **Document structure awareness**: Use position/formatting cues

### Long-Term

1. **Active learning pipeline**: User corrections improve model
2. **Organization/Person disambiguation model**: Separate ML classifier
3. **Cross-language name databases**: Known first/last names for validation

## Monitoring Metrics

Track these KPIs in production:

```yaml
PERSON_NAME:
  precision_daily: "Track 7-day rolling average"
  false_positive_patterns: "Top 10 repeated FPs"
  user_correction_rate: "% of PERSON_NAME entities removed by user"
  confidence_distribution: "Histogram of detection confidence"
```

### Dashboard Recommendations

Add to Accuracy Dashboard (Story 5.3):

1. **PERSON_NAME False Positive Trend**: Line chart over time
2. **Top False Positive Terms**: Table of most frequently removed
3. **Confidence vs Accuracy**: Scatter plot
4. **Per-Document-Type Breakdown**: Bar chart

## Consequences

### Positive

- Systematic identification of false positive patterns
- Data-driven DenyList expansion
- Visibility into production accuracy

### Negative

- Requires user feedback data collection
- May need privacy-preserving aggregation
- Dashboard complexity increases

### Trade-offs

- Higher threshold = fewer false positives but lower recall
- DenyList expansion = faster iteration but manual maintenance

## Related

- **Story 8.20**: PERSON_NAME Precision Improvement (current implementation)
- **Story 5.2**: User Correction Logging
- **Story 5.3**: Accuracy Dashboard
- **Story 7.8**: User Correction Feedback Logging
- **Story 8.9**: User Feedback Learning Loop (future)

## Appendix: Known False Positive Patterns

From test fixture analysis (2025-12-27):

```typescript
// High-confidence false positives to add to DenyList
const KNOWN_FALSE_POSITIVES = [
  // Service/product terms that look like names
  /^(Consulting|Premium|Annual|Monthly|Basic)\s+(Service|Support|Plan|License)/i,

  // Technical document terms
  /^(Case|Module|Section|Reference|Document)\s+\w+/i,

  // French/German document terms
  /^(Notre|Votre|Ihre|Unsere)\s+\w+/i,

  // Currency/quantity terms that get split wrong
  /^(Total|Subtotal|Grand)\s+\w+/i,
];
```

## References

- Ground truth: `test/fixtures/piiAnnotated/realistic-ground-truth.json`
- Accuracy utilities: `shared/test/accuracy.ts`
- Current metrics: `test/baselines/epic8-current.json`
