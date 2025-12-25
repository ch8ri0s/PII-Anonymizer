# Story 8.12: ML Input Validation

## Story

As a **PII detection system**,
I want **input text to be validated before ML inference**,
So that **invalid inputs are rejected early and errors are prevented**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.12 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Backlog |
| **Created** | 2025-12-24 |
| **Priority** | P0 - Critical |

## Acceptance Criteria

**Given** empty or null text input
**When** ML detection is called
**Then** validation rejects input and returns empty array immediately

**And** text exceeding maximum length (100K characters) is rejected or chunked
**And** invalid encoding issues are detected and handled
**And** validation errors are logged with context (no PII content)
**And** validation works identically in Electron and Browser
**And** validation overhead is negligible (<1ms)

## Technical Design

### Files to Create/Modify

1. **Create:** `shared/pii/ml/MLInputValidator.ts` - Shared validation utility
2. **Modify:** `src/pii/passes/HighRecallPass.ts` - Add validation before inference
3. **Modify:** `browser-app/src/pii/BrowserHighRecallPass.ts` - Add validation
4. **Modify:** `browser-app/src/model/ModelManager.ts` - Add validation in `runInference`

### Interface

```typescript
// shared/pii/ml/MLInputValidator.ts

export interface ValidationConfig {
  /** Maximum text length in characters (default: 100,000) */
  maxLength: number;
  /** Minimum text length (default: 1) */
  minLength: number;
  /** Whether to allow empty strings (default: false) */
  allowEmpty: boolean;
  /** Whether to normalize encoding (default: true) */
  normalizeEncoding: boolean;
}

export interface ValidationResult {
  valid: boolean;
  text?: string;  // Normalized text if valid
  error?: string; // Error message if invalid
  warnings?: string[]; // Non-fatal warnings
}

/**
 * Validate and normalize text input for ML inference
 * 
 * @param text - Input text to validate
 * @param config - Validation configuration
 * @returns Validation result with normalized text or error
 */
export function validateMLInput(
  text: string | null | undefined,
  config?: Partial<ValidationConfig>
): ValidationResult;
```

### Validation Rules

1. **Null/Undefined Check:**
   - Reject if `text === null || text === undefined`
   - Error: "Input text is null or undefined"

2. **Empty String Check:**
   - Reject if `text.length === 0` (unless `allowEmpty: true`)
   - Error: "Input text is empty"

3. **Length Check:**
   - Reject if `text.length > maxLength`
   - Error: `"Input text exceeds maximum length of ${maxLength} characters"`
   - Option: Return warning and suggest chunking

4. **Encoding Normalization:**
   - Normalize to UTF-8
   - Remove invalid UTF-8 sequences
   - Warning if normalization changed text

5. **Control Characters:**
   - Warn about excessive control characters (may affect model)
   - Don't reject (some documents have legitimate control chars)

### Default Configuration

```typescript
const DEFAULT_CONFIG: ValidationConfig = {
  maxLength: 100_000,      // 100K characters (~25K tokens)
  minLength: 1,
  allowEmpty: false,
  normalizeEncoding: true,
};
```

### Integration Points

**HighRecallPass:**
```typescript
private async runMLDetection(text: string): Promise<Entity[]> {
  if (!this.nerPipeline) return [];

  // NEW: Validate input
  const validation = validateMLInput(text);
  if (!validation.valid) {
    logger.warn('ML input validation failed', { 
      error: validation.error,
      textLength: text.length 
    });
    return [];
  }

  // Use normalized text
  const normalizedText = validation.text!;
  
  // Log warnings if any
  if (validation.warnings?.length) {
    validation.warnings.forEach(w => logger.warn('ML input warning', { warning: w }));
  }

  try {
    const predictions = await this.nerPipeline(normalizedText);
    // ... rest of processing ...
  } catch (error) {
    console.error('ML detection error:', error);
    return [];
  }
}
```

**ModelManager (`runInference`):**
```typescript
export async function runInference(text: string): Promise<MLPrediction[]> {
  // NEW: Validate at API boundary
  const validation = validateMLInput(text);
  if (!validation.valid) {
    throw new Error(`Invalid input: ${validation.error}`);
  }

  if (!pipelineInstance) {
    if (currentStatus.fallbackMode) {
      return [];
    }
    throw new Error('Model not loaded. Call loadModel() first.');
  }

  // Use normalized text
  const normalizedText = validation.text!;
  const pipeline = pipelineInstance as (text: string) => Promise<MLPrediction[]>;
  return pipeline(normalizedText);
}
```

## Prerequisites

- None (can run independently)

## Integration Points

- Used by `HighRecallPass` (Electron)
- Used by `BrowserHighRecallPass` (Browser)
- Used by `ModelManager.runInference` (API boundary)
- Works with Story 8.11 (chunking) - validation happens before chunking

## Test Scenarios

1. **Null input:** Returns `{ valid: false, error: "Input text is null or undefined" }`
2. **Empty string:** Returns `{ valid: false, error: "Input text is empty" }`
3. **Valid text:** Returns `{ valid: true, text: normalizedText }`
4. **Text too long:** Returns `{ valid: false, error: "Input text exceeds maximum length..." }`
5. **Encoding issues:** Invalid UTF-8 sequences are normalized, warning logged
6. **Control characters:** Warning logged but text accepted
7. **Normalization:** Text with mixed encoding is normalized to UTF-8
8. **Performance:** Validation overhead <1ms for typical documents
9. **Cross-platform:** Electron and Browser produce identical results
10. **Logging:** Validation errors logged without PII content (only metadata)

## Definition of Done

- [ ] `shared/pii/ml/MLInputValidator.ts` created with comprehensive validation
- [ ] `HighRecallPass.ts` updated with validation
- [ ] `BrowserHighRecallPass.ts` updated with validation
- [ ] `ModelManager.runInference` updated with validation
- [ ] Unit tests in `test/unit/pii/ml/MLInputValidator.test.ts`
- [ ] All validation rules tested
- [ ] Error logging verified (no PII in logs)
- [ ] Performance tests verify <1ms overhead
- [ ] TypeScript compiles without errors
- [ ] Configuration is documented

## Precision/Recall Impact Testing

### Baseline Comparison
Uses shared accuracy utilities from `shared/test/accuracy.ts`:

```typescript
import { calculatePrecisionRecall } from '@shared-test/accuracy';

// Validation should not affect quality for valid inputs
const validatedMetrics = calculatePrecisionRecall(validatedDetected, expected);
const unvalidatedMetrics = calculatePrecisionRecall(unvalidatedDetected, expected);

// Quality should be identical for valid inputs
expect(validatedMetrics.f1).toBe(unvalidatedMetrics.f1);
```

### Regression Prevention
- **Baseline metrics:** See `test/baselines/epic8-before.json`
- **Validation constraint:** Zero false negatives due to over-aggressive validation
- **Normalization constraint:** Encoding normalization must not alter entity positions
- **Regression threshold:** Identical precision/recall for valid inputs

### ML-Specific Test Scenarios
| Scenario | Input | Expected Result |
|----------|-------|-----------------|
| Valid UTF-8 | Standard text | Passes, no changes |
| Mixed encoding | CP1252 + UTF-8 | Normalized to UTF-8, entities preserved |
| Control characters | Text with `\x00` | Warning logged, entities detected |
| Long valid doc | 50K chars | Passes to chunking (Story 8.11) |
| Empty after trim | "   \n  " | Rejected with clear error |
| Unicode names | "François Müller" | Validated, PII detected correctly |

### Cross-Platform Validation
- Identical validation rules in Electron and Browser
- Same normalized text produces same entity offsets
- Error messages are identical across platforms

## Impact

**Before:** Invalid inputs may cause crashes or unexpected behavior
**After:** Invalid inputs are caught early with clear error messages
**Quality Improvement:** Prevents runtime errors and improves reliability

