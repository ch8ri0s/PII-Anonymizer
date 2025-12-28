# Story 10.8: Aggressive Test File Logger Migration

## Story

As a **developer running tests**,
I want **test files to use a consistent logging strategy**,
So that **test output is clean in CI and verbose when debugging locally**.

## Status

- **Epic:** 10 - Console-to-Logger Migration
- **Priority:** Lower (final polish)
- **Estimate:** XL (consider splitting - see notes)
- **Dependencies:** Story 10.7 (src/ migration complete)

## Acceptance Criteria

**Given** test files in `test/` directory (783 console calls)
**When** aggressive migration is complete
**Then**:

1. **Test helper created:** `test/helpers/testLogger.ts`
   - Wraps LoggerFactory with test-friendly defaults
   - Respects `LOG_LEVEL` environment variable
   - Default level: `warn` (errors and warnings only)
   - `LOG_LEVEL=debug` enables verbose output

2. **Integration tests migrated:** `test/integration/**`
   - All console.log → `testLogger.debug()`
   - All console.warn → `testLogger.warn()`
   - All console.error → `testLogger.error()`
   - Progress/status messages → `testLogger.info()`

3. **Unit tests migrated:** `test/unit/**`
   - Same pattern as integration tests
   - Keep only essential debug output

4. **Fixture/expected output preserved:**
   - `console.log` for test fixture output comparisons is OK
   - Mark with comment: `// eslint-disable-next-line no-console -- test fixture output`

5. **ESLint updated:**
   - Remove test file exclusion from Story 10.1
   - Tests now follow same rules as src/

**And** CI runs with `LOG_LEVEL=error` (minimal output)
**And** Local dev can use `LOG_LEVEL=debug npm test` for verbose
**And** Test output is clean and readable

## Technical Notes

- ~783 calls is significant - may take multiple sessions
- Prioritize integration tests (highest value)
- Unit tests: Focus on noisy ones first (`test/unit/pii/`, `test/unit/fileProcessor`)
- Consider splitting into sub-stories during sprint planning

## Recommended Split (Bob's Suggestion)

| Sub-Story | Scope | Estimate |
|-----------|-------|----------|
| 10.8a | Create testLogger + migrate integration tests | M |
| 10.8b | Migrate unit tests | M |
| 10.8c | Update ESLint to enforce on tests | S |

## Implementation Guidance

### testLogger.ts

```typescript
// test/helpers/testLogger.ts
import { LoggerFactory } from '../../src/utils/LoggerFactory';

// Respect LOG_LEVEL environment variable
const level = process.env.LOG_LEVEL || 'warn';
LoggerFactory.setLevel(level as 'debug' | 'info' | 'warn' | 'error');

/**
 * Test logger for use in test files.
 *
 * @example
 * import { testLogger } from '../helpers/testLogger';
 *
 * testLogger.debug('Test setup details', { fixture: 'example' });
 * testLogger.info('Test milestone reached');
 * testLogger.warn('Unexpected condition in test');
 * testLogger.error('Test assertion context', { expected, actual });
 *
 * Usage:
 * - Normal: npm test (shows warn/error only)
 * - Verbose: LOG_LEVEL=debug npm test
 * - Quiet: LOG_LEVEL=error npm test
 */
export const testLogger = LoggerFactory.create('test');

/**
 * Create a scoped test logger for a specific test file.
 *
 * @example
 * const log = createTestLogger('pii/detection');
 * log.debug('Running detection test');
 */
export function createTestLogger(scope: string) {
  return LoggerFactory.create(`test:${scope}`);
}
```

### Migration Pattern

```typescript
// BEFORE
console.log('Running test for:', testCase);
console.log('Result:', result);
if (error) console.error('Test failed:', error);

// AFTER
import { testLogger } from '../helpers/testLogger';

testLogger.debug('Running test', { testCase });
testLogger.debug('Result', { result });
if (error) testLogger.error('Test failed', { error: error.message });
```

### Fixture Output Exception

```typescript
// For test fixtures that output expected values, keep console.log with comment
// eslint-disable-next-line no-console -- test fixture expected output
console.log(JSON.stringify(expectedOutput, null, 2));
```

### Measurement Baseline (Murat's Recommendation)

Before starting migration, document the baseline:

```bash
# Count console calls per test directory
echo "Integration tests:"
grep -r "console\." test/integration/ --include="*.js" --include="*.ts" | wc -l

echo "Unit tests:"
grep -r "console\." test/unit/ --include="*.js" --include="*.ts" | wc -l

echo "By file (top 10):"
grep -r "console\." test/ --include="*.js" --include="*.ts" -c | sort -t: -k2 -rn | head -10
```

Target: Reduce test console calls by 80%.

## Definition of Done

- [ ] `test/helpers/testLogger.ts` created
- [ ] All integration tests migrated to use testLogger
- [ ] All unit tests migrated to use testLogger
- [ ] Fixture output exceptions marked with eslint-disable comments
- [ ] ESLint now enforces no-console on test files
- [ ] `npm test` runs cleanly (warn level by default)
- [ ] `LOG_LEVEL=debug npm test` shows verbose output
- [ ] `LOG_LEVEL=error npm test` shows only errors
- [ ] Baseline vs final console call count documented

## Files to Modify

### New Files
- `test/helpers/testLogger.ts`

### Integration Tests (high priority)
- `test/integration/fullPipeline.test.js` (~30 calls)
- `test/integration/pii/QualityValidation.test.js` (~20 calls)
- `test/integration/converterComparison.test.js` (~13 calls)
- Other files in `test/integration/`

### Unit Tests
- `test/unit/pii/` - PII-related tests
- `test/unit/fileProcessor.session.test.js` (~16 calls)
- Other files in `test/unit/`

### ESLint Config
- `.eslintrc.js` or `eslint.config.js` - Remove test file override

## Notes

- This is an XL story - recommend splitting during sprint planning
- DX investment = marathon approach, no rush
- Track improvement metrics (before/after console call counts)
- Parallel test runs: testLogger singleton is fine for Mocha serial mode
