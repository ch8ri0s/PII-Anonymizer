# Story 10.9: CI/CD Log Level Configuration

## Story

As a **DevOps engineer managing CI pipelines**,
I want **log levels configurable in CI/CD**,
So that **pipeline logs are clean but debugging is possible when needed**.

## Status

- **Epic:** 10 - Console-to-Logger Migration
- **Priority:** Lower (final polish)
- **Estimate:** S
- **Dependencies:** Story 10.8 (test logging respects LOG_LEVEL)

## Acceptance Criteria

**Given** CI/CD pipeline (GitHub Actions or similar)
**When** pipeline runs
**Then**:

1. **Default CI log level:** `error` (minimal noise)
2. **Debug mode available:** Re-run with `LOG_LEVEL=debug` for troubleshooting
3. **Test runs:** Use `LOG_LEVEL=error` by default
4. **Build step:** Use `LOG_LEVEL=warn` (catch warnings)

**And** environment variable `LOG_LEVEL` is documented
**And** CI config updated (`.github/workflows/*.yml` or equivalent)
**And** README documents how to enable verbose CI logging
**And** Log level can be set per-job or per-step

## Technical Notes

- GitHub Actions: `env: LOG_LEVEL: error` at job level
- Allow manual workflow dispatch with log level input
- Consider: `LOG_LEVEL=debug` for nightly/scheduled runs
- Document in CI config with comments

## Implementation Guidance

### GitHub Actions Configuration

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      log_level:
        description: 'Log level for debugging'
        required: false
        default: 'error'
        type: choice
        options:
          - error
          - warn
          - info
          - debug

env:
  # Default log level for CI - minimal noise
  LOG_LEVEL: ${{ github.event.inputs.log_level || 'error' }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint
        env:
          LOG_LEVEL: warn  # Show warnings during lint

      - name: Run tests
        run: npm test
        env:
          LOG_LEVEL: ${{ env.LOG_LEVEL }}

      - name: Build
        run: npm run build
        env:
          LOG_LEVEL: warn  # Show warnings during build

  # Optional: Nightly build with verbose logging
  nightly:
    if: github.event_name == 'schedule'
    runs-on: ubuntu-latest
    env:
      LOG_LEVEL: debug  # Verbose for nightly diagnostics
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
```

### Per-Step Log Level Override

```yaml
steps:
  - name: Run tests (quiet)
    run: npm test
    env:
      LOG_LEVEL: error

  - name: Debug failing test
    if: failure()
    run: npm test -- --grep "failing-test"
    env:
      LOG_LEVEL: debug  # Verbose on retry
```

### README Documentation

Add to README.md:

```markdown
## Logging Configuration

### Log Levels

The application uses structured logging with configurable levels:

| Level | When to Use |
|-------|-------------|
| `error` | Critical failures only (default for CI) |
| `warn` | Warnings and errors |
| `info` | Significant events, startup, completion |
| `debug` | Detailed troubleshooting (verbose) |

### Local Development

```bash
# Normal operation (info level)
npm run dev

# Verbose debugging
LOG_LEVEL=debug npm run dev

# Quiet operation
LOG_LEVEL=error npm run dev
```

### CI/CD

By default, CI runs with `LOG_LEVEL=error` for clean logs.

To debug a failing CI run:
1. Go to Actions tab
2. Click "Run workflow"
3. Select `debug` from the log_level dropdown
4. Click "Run workflow"
```

## Definition of Done

- [ ] GitHub Actions workflow updated with LOG_LEVEL configuration
- [ ] Default log level set to `error` for test jobs
- [ ] Build step uses `warn` level
- [ ] Manual workflow dispatch allows log level selection
- [ ] README documents log level usage
- [ ] CI config has clear comments explaining log levels
- [ ] Test CI run with different log levels

## Files to Modify

1. `.github/workflows/ci.yml` (or equivalent CI config)
2. `README.md` - Add logging configuration section

## Notes

- This story is quick to implement but provides lasting value
- Debug log level should only be used for troubleshooting, not default runs
- Consider adding log level to PR template checklist if tests fail
