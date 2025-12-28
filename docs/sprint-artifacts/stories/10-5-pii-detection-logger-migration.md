# Story 10.5: PII Detection Module Logger Migration

## Story

As a **developer debugging PII detection issues**,
I want **all PII detection modules to use LoggerFactory with 'pii' scope**,
So that **detection logging is filterable and PII is automatically redacted**.

## Status

- **Epic:** 10 - Console-to-Logger Migration
- **Priority:** Medium (post Epic 8 to avoid conflicts)
- **Estimate:** S
- **Dependencies:** Story 10.4 (migration pattern established)

## Acceptance Criteria

**Given** the PII detection modules
**When** migration is complete
**Then** all console.* calls are replaced with LoggerFactory usage:

| File | Logger Scope |
|------|--------------|
| `src/pii/DetectionPipeline.ts` | `pii:pipeline` |
| `src/pii/passes/HighRecallPass.ts` | `pii:pass:recall` |
| `src/pii/passes/DocumentTypePass.ts` | `pii:pass:doctype` |
| `src/pii/RuleEngine.ts` | `pii:rules` |
| Any other `src/pii/**/*.ts` files | `pii:<module>` |

**And** PII values in log messages are automatically redacted by LoggerFactory
**And** detection metrics logged at info level: `log.info('Detection complete', { entities: count, duration: ms })`
**And** pattern match details logged at debug level (disabled in production)
**And** validation failures logged at warn level

## Technical Notes

- CRITICAL: Verify PII redaction works - test with real Swiss AHV, IBAN, emails
- Detection can be verbose - use debug level for per-entity logs
- Add timing: `const start = Date.now(); ... log.debug('Pass done', { ms: Date.now() - start })`
- Run accuracy tests after migration to ensure no regressions
- Coordinate with Epic 8 to avoid merge conflicts in `src/pii/`

## Implementation Guidance

### Log Level Guidelines for PII Detection

| Scenario | Level | Example |
|----------|-------|---------|
| Pipeline start | info | `log.info('Starting detection', { docLength })` |
| Pipeline complete | info | `log.info('Detection complete', { entities: count, duration: ms })` |
| Pass start/end | debug | `log.debug('Pass complete', { pass: 'recall', entities: added })` |
| Entity detected | debug | `log.debug('Entity found', { type, confidence })` |
| Validation failed | warn | `log.warn('Validation failed', { type, reason })` |
| Pattern match | debug | `log.debug('Pattern matched', { pattern, text: '[REDACTED]' })` |
| Processing error | error | `log.error('Detection failed', { error: error.message })` |

### PII Redaction Verification

```typescript
// Test that PII is redacted in logs
const log = LoggerFactory.create('pii:test');

// These should show redacted values in logs:
log.info('Testing redaction', {
  email: 'test@example.com',      // Should become [EMAIL_REDACTED]
  phone: '+41 79 123 45 67',      // Should become [PHONE_REDACTED]
  iban: 'CH93 0076 2011 6238 5295 7', // Should become [IBAN_REDACTED]
  ahv: '756.1234.5678.90'         // Should become [AHV_REDACTED]
});
```

### Performance Logging Pattern

```typescript
const log = LoggerFactory.create('pii:pipeline');

async function runDetection(text: string): Promise<Entity[]> {
  const start = Date.now();
  log.info('Starting detection', { docLength: text.length });

  try {
    const entities = await detectEntities(text);
    log.info('Detection complete', {
      entityCount: entities.length,
      duration: Date.now() - start
    });
    return entities;
  } catch (error) {
    log.error('Detection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - start
    });
    throw error;
  }
}
```

## Definition of Done

- [ ] All console.* calls in `src/pii/` replaced with LoggerFactory
- [ ] Scopes follow convention: `pii:pipeline`, `pii:pass:*`, `pii:rules`
- [ ] PII redaction verified with test cases (email, phone, IBAN, AHV)
- [ ] Performance metrics (duration) included in info-level logs
- [ ] `npm run lint` passes (no console violations)
- [ ] `npm test` passes (all accuracy tests)
- [ ] Verbose mode works: `LoggerFactory.setScopeLevel('pii', 'debug')`

## Files to Modify

1. `src/pii/DetectionPipeline.ts`
2. `src/pii/passes/HighRecallPass.ts`
3. `src/pii/passes/DocumentTypePass.ts`
4. `src/pii/RuleEngine.ts`
5. Any other files in `src/pii/` with console.* calls

## Notes

- Schedule this story AFTER Epic 8 active work completes to avoid merge conflicts
- PII redaction is security-critical - verify thoroughly before marking complete
