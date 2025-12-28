# Story 10.9: CI/CD Log Level Configuration

Status: done

## Story

As a **DevOps engineer managing CI pipelines**,
I want **log levels configurable in CI/CD workflows**,
So that **pipeline logs are clean by default but verbose debugging is possible when needed**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 10.9 |
| **Epic** | 10 - Console-to-Logger Migration |
| **Status** | done |
| **Created** | 2025-12-28 |
| **Priority** | Low (final configuration after all migrations) |
| **Estimate** | S |
| **Dependencies** | Story 10.8 (test file logger migration - done) |

## Acceptance Criteria

### AC-1: Default CI Log Level Set
**Given** GitHub Actions CI/CD workflows
**When** the pipeline runs (tests, builds, linting)
**Then** `LOG_LEVEL=error` is set as the default for test jobs
**And** only errors appear in test output (not debug/info/warn)
**And** test runs are clean and easily scannable

### AC-2: Build Step Log Level
**Given** the build step in CI workflows
**When** TypeScript compilation or bundling runs
**Then** `LOG_LEVEL=warn` is set for build steps
**And** warnings are visible but debug noise is suppressed

### AC-3: Debug Mode Via Workflow Dispatch
**Given** a CI workflow with workflow_dispatch trigger
**When** developer manually triggers the workflow
**Then** an optional `log_level` input is available
**And** developer can choose: `error`, `warn`, `info`, `debug`
**And** selected level applies to all jobs in the workflow

### AC-4: Per-Job Log Level Override
**Given** workflow environment configuration
**When** LOG_LEVEL is set at job level
**Then** all steps in that job inherit the log level
**And** individual steps can override if needed

### AC-5: Documentation in Workflow Files
**Given** CI workflow YAML files
**When** LOG_LEVEL is configured
**Then** comments explain the log level purpose
**And** comments explain how to enable verbose mode
**And** README or workflow documentation is updated

### AC-6: Electron App CI Coverage
**Given** the main CI workflow (likely `.github/workflows/ci.yml` or similar)
**When** running Electron app tests
**Then** LOG_LEVEL=error is set for test jobs
**And** build/compile steps use LOG_LEVEL=warn

### AC-7: Browser-App CI Coverage
**Given** browser-app E2E workflow (`.github/workflows/browser-app-e2e.yml`)
**When** running tests (already partially configured in Story 10.8)
**Then** LOG_LEVEL=error is verified/maintained
**And** consistent with Electron app configuration

## Technical Design

### Current CI Configuration Status

**Already configured (Story 10.8):**
- `.github/workflows/browser-app-e2e.yml` - Has LOG_LEVEL=error for E2E tests

**Needs configuration:**
- Main CI workflow for Electron app tests
- Any other workflow files with test/build steps

### GitHub Actions Configuration Pattern

**Job-level environment:**
```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      LOG_LEVEL: error  # Minimal output in CI
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
```

**Step-level override:**
```yaml
steps:
  - name: Build with warnings visible
    env:
      LOG_LEVEL: warn
    run: npm run build

  - name: Run tests quietly
    env:
      LOG_LEVEL: error
    run: npm test
```

**Workflow dispatch input:**
```yaml
on:
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

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      LOG_LEVEL: ${{ github.event.inputs.log_level || 'error' }}
```

### Log Level Guidelines

| Step Type | Recommended Level | Rationale |
|-----------|-------------------|-----------|
| `npm test` | `error` | Only show failures |
| `npm run build` | `warn` | Show build warnings |
| `npm run lint` | `warn` | Show linting issues |
| `npm run typecheck` | `warn` | Show type errors |
| Debug runs | `debug` | Full verbosity for troubleshooting |

## Tasks / Subtasks

- [x] **Task 1: Audit Existing CI Workflows** (AC: #6, #7)
  - [x] List all workflow files in `.github/workflows/`
  - [x] Check which already have LOG_LEVEL configured
  - [x] Identify workflows needing configuration

- [x] **Task 2: Configure Deploy Workflow** (AC: #1, #2)
  - [x] Add LOG_LEVEL=error for test steps
  - [x] Add LOG_LEVEL=warn for build/typecheck steps
  - [x] Add documentation comments

- [x] **Task 3: Verify Browser-App E2E Config** (AC: #7)
  - [x] Review `.github/workflows/browser-app-e2e.yml`
  - [x] Ensure LOG_LEVEL=error is set consistently
  - [x] Updated to use workflow_dispatch input

- [x] **Task 4: Add Workflow Dispatch Debug Mode** (AC: #3)
  - [x] Add workflow_dispatch trigger with log_level input to both workflows
  - [x] Configure step-level environment to use input
  - [x] Default to 'error' when not manually triggered

- [x] **Task 5: Add Documentation Comments** (AC: #5)
  - [x] Add header comments explaining LOG_LEVEL usage
  - [x] Document how to trigger debug mode
  - [x] Inline comments on each LOG_LEVEL env var

- [x] **Task 6: Final Verification** (AC: #1-7)
  - [x] Local tests pass with LOG_LEVEL=error (1004 browser-app tests)
  - [x] Workflow files have consistent configuration
  - [x] Debug mode available via workflow_dispatch input

## Dev Notes

### Architecture Alignment

This story completes the CI/CD integration aspect of Epic 10's logging standardization. It ensures that:
1. CI pipelines benefit from the centralized logging strategy
2. Test output is clean and easily scannable in CI logs
3. Developers can enable verbose mode when debugging CI failures

[Source: docs/sprint-artifacts/tech-spec-epic-10.md#AC-10.9]

### Project Structure Notes

| Workflow | Purpose | LOG_LEVEL |
|----------|---------|-----------|
| Main CI | Tests, lint, build | error/warn |
| browser-app-e2e.yml | E2E tests | error |
| Any other workflows | As appropriate | error/warn |

### Learnings from Previous Story

**From Story 10.8 (Status: done)**

- **CI Configuration Started**: Already added LOG_LEVEL=error to `.github/workflows/browser-app-e2e.yml`
- **Pattern Established**: `env: LOG_LEVEL: error` at step level for E2E tests
- **Test Helper Ready**: testLogger and browser-app test helpers respect LOG_LEVEL environment variable
- **All Tests Passing**: 2751 tests (1747 Electron + 1004 browser-app)
- **Files Modified**:
  - `.github/workflows/browser-app-e2e.yml` - Added LOG_LEVEL=error

Use the same pattern for other workflow files. The browser-app E2E workflow serves as a reference implementation.

[Source: stories/10-8-test-file-logger-migration.md#Dev-Agent-Record]

### Implementation Notes

1. **Minimal Changes**: This is a configuration-only story, no code changes
2. **Idempotent**: Running multiple times should produce same result
3. **No Breaking Changes**: Existing CI behavior preserved, just cleaner output
4. **Testing**: Verify by checking CI run logs

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-10.md#AC-10.9]
- [Source: docs/epics.md#Story-10.9]
- [Source: stories/10-8-test-file-logger-migration.md] - Previous story patterns
- [Source: .github/workflows/browser-app-e2e.yml] - Existing LOG_LEVEL config

## Definition of Done

- [x] All CI workflow files audited for LOG_LEVEL configuration
- [x] Deploy workflow has LOG_LEVEL=error for tests, LOG_LEVEL=warn for build/typecheck
- [x] Build steps use LOG_LEVEL=warn
- [x] workflow_dispatch input for debug mode available on both workflows
- [x] Documentation comments added to workflow files
- [x] Local tests verified to pass with LOG_LEVEL=error
- [x] Debug mode available via dropdown when manually triggering workflows

## Dev Agent Record

### Context Reference

- [docs/sprint-artifacts/stories/10-9-cicd-log-configuration.context.xml](10-9-cicd-log-configuration.context.xml)

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Configuration-only story

### Completion Notes List

1. **Audited 2 workflow files** in `.github/workflows/`:
   - `browser-app-e2e.yml` - Already had LOG_LEVEL=error from Story 10.8
   - `deploy-browser-app.yml` - Needed LOG_LEVEL configuration

2. **Added workflow_dispatch debug mode** to both workflows with log_level input (error/warn/info/debug)

3. **Configured LOG_LEVEL** for deploy workflow:
   - Tests: LOG_LEVEL=error (minimal output)
   - Typecheck: LOG_LEVEL=warn (show type warnings)
   - Build: LOG_LEVEL=warn (show build warnings)

4. **Updated browser-app-e2e.yml** to use workflow_dispatch input instead of hardcoded value

5. **Added documentation comments** explaining LOG_LEVEL usage in both workflow files

6. **No main Electron CI workflow found** - project uses pre-commit hooks and local testing rather than Electron-specific CI

### File List

- `.github/workflows/browser-app-e2e.yml` - Added workflow_dispatch, header comments, dynamic LOG_LEVEL
- `.github/workflows/deploy-browser-app.yml` - Added workflow_dispatch, LOG_LEVEL for test/typecheck/build steps

## Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2025-12-28 | 1.0 | Initial story draft |
| 2025-12-28 | 2.0 | Enhanced with standard template, learnings from Story 10.8 |
| 2025-12-28 | 3.0 | Story completed - CI/CD LOG_LEVEL configuration done |
