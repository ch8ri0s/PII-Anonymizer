# ADR-008: Disable AMOUNT Detection in PII Pipeline

## Status

**Accepted** - 2025-12-27

## Context

The PII detection pipeline included AMOUNT detection (monetary values like "CHF 1'234.56", "EUR 500.00") as part of Story 3.2 (Invoice-Specific Detection Rules). However, during Epic 8 quality validation (Story 8.6), we discovered that:

1. **AMOUNT is not PII**: Financial amounts without associated account information are not personally identifiable information. A value like "CHF 500.00" cannot identify an individual.

2. **High false positive rate**: The AMOUNT pattern was generating 15 false positives with 0% precision against the ground truth dataset.

3. **Ground truth excludes AMOUNT**: The `realistic-ground-truth.json` test fixture correctly does not include amounts as PII entities.

### Metrics Before Story 8.18

| Entity Type | Precision | Recall | FPs |
|-------------|-----------|--------|-----|
| AMOUNT | 0% | N/A | 15 |
| Overall | 64.4% | 88.2% | - |

## Decision

**Disable AMOUNT detection by default** while preserving the capability for optional use.

### Implementation

1. **InvoiceRules.ts** (line 47-49):
   ```typescript
   const DEFAULT_CONFIG: InvoiceRulesConfig = {
     // Disabled: AMOUNT is not PII and causes false positives (Story 8.18)
     extractAmounts: false,
     // ...
   };
   ```

2. **HighRecallPatterns.ts** (lines 238-246):
   ```typescript
   // === Priority 5: Financial amounts ===
   // NOTE: AMOUNT detection disabled (Story 8.18) - financial amounts are not PII
   // and were causing 15 false positives with 0% precision.
   // Pattern kept as comment for reference:
   // {
   //   type: 'AMOUNT',
   //   pattern: /\b(?:CHF|EUR|€|Fr\.?)\s*\d{1,3}(?:['\s.,]\d{3})*(?:[.,]\d{2})?\b/gi,
   //   priority: 5,
   // },
   ```

### Preserved Capability

The AMOUNT pattern is preserved for:
- **Document analysis**: Users who want to extract amounts for non-PII purposes
- **Invoice processing**: Applications that need to parse financial documents
- **Future use cases**: If regulatory requirements change

To enable AMOUNT detection:
```typescript
import { createInvoiceRules } from './rules/InvoiceRules';

const invoiceRules = createInvoiceRules({ extractAmounts: true });
```

## Consequences

### Positive

- **Precision improvement**: Overall precision increased from 64.4% to ~70% (Story 8.18 alone)
- **Reduced noise**: Users no longer see monetary values flagged as PII
- **Accurate metrics**: Quality validation tests now reflect true PII detection accuracy

### Negative

- **Feature reduction**: Users cannot anonymize amounts out-of-the-box
- **Code complexity**: Pattern is commented rather than removed, adding maintenance burden

### Neutral

- Tests updated to explicitly enable `extractAmounts: true` when testing AMOUNT functionality
- No breaking changes for existing users (amounts were rarely useful)

## Alternatives Considered

### 1. Remove AMOUNT entirely

**Rejected**: Would lose the capability entirely. Some users may have legitimate use cases for amount extraction.

### 2. Make AMOUNT opt-in via UI toggle

**Rejected**: Adds UI complexity for a rarely-used feature. The programmatic option (`extractAmounts: true`) is sufficient.

### 3. Improve AMOUNT precision with context

**Rejected**: Amounts are fundamentally not PII. Improving precision would not change this classification.

## Related

- **Story 8.18**: Disable AMOUNT Detection
- **Story 3.2**: Invoice-Specific Detection Rules (original implementation)
- **Story 8.6**: Integration Tests & Quality Validation
- **ADR-006**: Lexical Normalization (referenced in Story 8.7)
- **ADR-007**: Obfuscation Handling (referenced in Story 8.7)

## References

- GDPR Article 4: Definition of Personal Data
- Swiss DPA (revDSG): What constitutes personal data
- Ground truth: `test/fixtures/piiAnnotated/realistic-ground-truth.json`
