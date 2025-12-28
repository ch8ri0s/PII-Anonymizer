# Story 10.4: i18n Module Logger Migration

## Story

As a **developer debugging internationalization issues**,
I want **all i18n modules to use LoggerFactory with 'i18n' scope**,
So that **i18n logging can be filtered and controlled independently**.

## Status

- **Epic:** 10 - Console-to-Logger Migration
- **Priority:** Medium (post Epic 8)
- **Estimate:** S
- **Dependencies:** Story 10.2 (browser/renderer LoggerFactory works)

## Acceptance Criteria

**Given** the i18n modules (4 files, 25 console calls)
**When** migration is complete
**Then** all console.* calls are replaced with LoggerFactory usage:

| File | Console Calls | Logger Scope |
|------|---------------|--------------|
| `src/i18n/rendererI18n.ts` | 11 | `i18n:renderer` |
| `src/i18n/i18nService.ts` | 8 | `i18n:service` |
| `src/i18n/localeFormatter.ts` | 4 | `i18n:formatter` |
| `src/i18n/languageDetector.ts` | 2 | `i18n:detector` |

**And** log levels are appropriate:
  - Initialization success → `log.info()`
  - Missing translation keys → `log.warn()`
  - Language detection results → `log.debug()`
  - Load/parse errors → `log.error()`

**And** renderer process logging works correctly
**And** existing functionality unchanged
**And** ESLint passes with no console violations

## Technical Notes

- rendererI18n.ts runs in renderer process - uses browser LoggerFactory
- Batch initialization logs to reduce noise: single info log with summary
- Test: `LoggerFactory.setScopeLevel('i18n', 'debug')` enables verbose mode
- Verify i18n works correctly after migration (run i18n tests)

## Implementation Guidance

### Before

```typescript
// src/i18n/rendererI18n.ts
console.log('Loading translations for:', locale);
console.log('Translation loaded successfully');
console.warn('Missing translation key:', key);
console.error('Failed to parse translation file:', error);
```

### After

```typescript
// src/i18n/rendererI18n.ts
import { LoggerFactory } from '../utils/LoggerFactory';

const log = LoggerFactory.create('i18n:renderer');

log.debug('Loading translations', { locale });
log.info('Translation loaded successfully', { locale, keyCount: Object.keys(translations).length });
log.warn('Missing translation key', { key, locale });
log.error('Failed to parse translation file', { error: error.message });
```

### Log Level Guidelines for i18n

| Scenario | Level | Example |
|----------|-------|---------|
| Translation file loading | debug | `log.debug('Loading translations', { locale })` |
| Successful initialization | info | `log.info('i18n initialized', { locale, keyCount })` |
| Missing translation key | warn | `log.warn('Missing key', { key })` |
| Language detection result | debug | `log.debug('Detected language', { detected, fallback })` |
| File parse error | error | `log.error('Parse failed', { file, error })` |
| Fallback to default | info | `log.info('Using fallback locale', { from, to })` |

## Definition of Done

- [ ] All 25 console.* calls in i18n modules replaced with LoggerFactory
- [ ] Scopes follow convention: `i18n:renderer`, `i18n:service`, `i18n:formatter`, `i18n:detector`
- [ ] Log levels appropriately assigned per message type
- [ ] `npm run lint` passes (no console violations in these files)
- [ ] `npm run test:i18n` passes
- [ ] Manual test: Verify i18n works in Electron app
- [ ] Manual test: Verify i18n works in browser-app
- [ ] Verbose mode works: `LoggerFactory.setScopeLevel('i18n', 'debug')`

## Files to Modify

1. `src/i18n/rendererI18n.ts` - 11 console calls
2. `src/i18n/i18nService.ts` - 8 console calls
3. `src/i18n/localeFormatter.ts` - 4 console calls
4. `src/i18n/languageDetector.ts` - 2 console calls

## Notes

- This is the first migration story - establishes patterns for subsequent migrations
- Batch verbose initialization logs into single summary log to reduce noise
