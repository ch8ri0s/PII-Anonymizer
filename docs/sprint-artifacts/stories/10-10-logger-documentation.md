# Story 10.10: Logger Documentation & Developer Guide

## Story

As a **developer joining the project**,
I want **clear documentation on how to use LoggerFactory**,
So that **I use logging correctly from day one**.

## Status

- **Epic:** 10 - Console-to-Logger Migration
- **Priority:** Lower (final polish)
- **Estimate:** S
- **Dependencies:** Stories 10.1-10.9 (all migrations complete)

## Acceptance Criteria

**Given** a new developer reading the docs
**When** they need to add logging
**Then** documentation covers:

1. **Quick start:** How to create a scoped logger
2. **Scope naming:** Convention for scope names (module:submodule)
3. **Log levels:** When to use debug/info/warn/error
4. **PII safety:** What gets auto-redacted, how to log safely
5. **Configuration:** How to change levels at runtime
6. **Contexts:** Main process vs renderer vs browser-app vs Web Workers vs tests
7. **Debugging:** How to enable verbose logging for a scope

**And** documentation added to `CLAUDE.md` under new "## Logging" section
**And** JSDoc comments complete in `LoggerFactory.ts`
**And** Example usage added to `README.md` or dedicated `docs/LOGGING.md`

## Technical Notes

- Add to CLAUDE.md so AI assistants know the logging patterns
- Include common mistakes / anti-patterns section
- Add troubleshooting: "logs not appearing" checklist

## Implementation Guidance

### CLAUDE.md Addition

Add under a new `## Logging` section:

```markdown
## Logging

### Quick Start

```typescript
import { LoggerFactory } from './utils/LoggerFactory';

const log = LoggerFactory.create('my-module');

log.debug('Detailed info for troubleshooting', { data: value });
log.info('Significant event occurred', { result: 'success' });
log.warn('Something unexpected but recoverable', { issue: 'details' });
log.error('Something failed', { error: error.message });
```

### Scope Naming Convention

Use `module:submodule` format matching the directory structure:

| Directory | Scope Pattern | Example |
|-----------|---------------|---------|
| `src/pii/` | `pii:<module>` | `pii:pipeline`, `pii:rules` |
| `src/i18n/` | `i18n:<module>` | `i18n:renderer`, `i18n:service` |
| `src/utils/` | `utils:<module>` | `utils:timeout`, `utils:error` |
| `src/ui/` | `ui:<module>` | `ui:review`, `ui:sidebar` |
| `test/` | `test:<suite>` | `test:pii`, `test:integration` |

### Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| `debug` | Detailed troubleshooting, disabled in production | Variable values, loop iterations |
| `info` | Significant events | Startup, completion, milestones |
| `warn` | Recoverable issues | Missing optional config, deprecations |
| `error` | Failures requiring attention | Exceptions, critical failures |

### PII Safety

LoggerFactory automatically redacts sensitive patterns:

- Email addresses → `[EMAIL_REDACTED]`
- Phone numbers → `[PHONE_REDACTED]`
- IBANs → `[IBAN_REDACTED]`
- Swiss AHV numbers → `[AHV_REDACTED]`
- File paths → `[PATH_REDACTED]`

**Best Practice:** Use structured logging, not string interpolation:

```typescript
// GOOD - PII in data object gets redacted
log.info('User registered', { email: user.email });

// BAD - PII in message string may not be redacted
log.info(`User registered: ${user.email}`);
```

### Context-Specific Usage

| Context | Transport | Notes |
|---------|-----------|-------|
| Electron main process | electron-log (file + console) | Full features |
| Electron renderer | Console with formatting | No file persistence |
| Browser-app | Console only | Detected automatically |
| Web Workers | postMessage to main thread | Batched for performance |
| Tests | testLogger from helpers | Respects LOG_LEVEL env |

### Configuration

```typescript
// Set global log level
LoggerFactory.setLevel('debug');

// Set level for specific scope
LoggerFactory.setScopeLevel('pii', 'debug');

// Environment variable
LOG_LEVEL=debug npm run dev
```

### Troubleshooting

**Logs not appearing?**
1. Check log level: `LoggerFactory.setLevel('debug')`
2. Check scope level: `LoggerFactory.setScopeLevel('your-scope', 'debug')`
3. Verify correct context (Electron vs browser)
4. Check browser DevTools console filters

**Too many logs?**
1. Set level to `warn` or `error`
2. Use scope-specific levels for noisy modules
```

### LoggerFactory.ts JSDoc

Ensure complete JSDoc documentation:

```typescript
/**
 * LoggerFactory - Centralized logging with scopes, levels, and PII redaction.
 *
 * @example
 * // Create a scoped logger
 * const log = LoggerFactory.create('my-module');
 * log.info('Hello', { data: 'value' });
 *
 * @example
 * // Configure log level
 * LoggerFactory.setLevel('debug');
 * LoggerFactory.setScopeLevel('pii', 'warn');
 *
 * @example
 * // PII is automatically redacted
 * log.info('User', { email: 'test@example.com' });
 * // Output: [INFO] [my-module] User { email: '[EMAIL_REDACTED]' }
 */
export class LoggerFactory {
  /**
   * Create a scoped logger instance.
   *
   * @param scope - Logger scope (e.g., 'pii:pipeline', 'i18n:renderer')
   * @returns Logger instance with debug, info, warn, error methods
   *
   * @example
   * const log = LoggerFactory.create('converter:pdf');
   * log.info('Converting document', { pages: 10 });
   */
  static create(scope: string): Logger { ... }

  /**
   * Set global log level.
   *
   * @param level - Minimum level to log: 'debug' | 'info' | 'warn' | 'error'
   */
  static setLevel(level: LogLevel): void { ... }

  /**
   * Set log level for a specific scope.
   *
   * @param scope - Scope to configure
   * @param level - Minimum level for this scope
   */
  static setScopeLevel(scope: string, level: LogLevel): void { ... }
}
```

## Definition of Done

- [ ] CLAUDE.md updated with "## Logging" section
- [ ] LoggerFactory.ts has complete JSDoc documentation
- [ ] README.md has logging quick start section
- [ ] Anti-patterns documented (string interpolation, etc.)
- [ ] Troubleshooting checklist included
- [ ] Context-specific guidance (Electron, browser, workers, tests)
- [ ] Documentation reviewed by another developer

## Files to Modify

1. `CLAUDE.md` - Add "## Logging" section
2. `src/utils/LoggerFactory.ts` - Complete JSDoc comments
3. `README.md` - Add logging quick start (or link to docs/LOGGING.md)
4. Optional: `docs/LOGGING.md` - Dedicated logging guide

## Notes

- This is the final story - ensures the DX investment is documented for future developers
- AI assistants (like Claude) will use CLAUDE.md for context
- Good documentation turns one-time cleanup into lasting team capability
