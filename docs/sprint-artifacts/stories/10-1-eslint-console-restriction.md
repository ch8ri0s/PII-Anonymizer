# Story 10.1: ESLint Console Restriction Rule

## Story

As a **developer writing new code**,
I want **ESLint to flag any direct console.* usage**,
So that **all new logging goes through LoggerFactory and we don't regress**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 10.1 |
| **Epic** | 10 - Console-to-Logger Migration |
| **Status** | ready-for-dev |
| **Created** | 2025-12-28 |

## Acceptance Criteria

### AC-1: ESLint Rule Configuration
**Given** any TypeScript or JavaScript file in `src/` or `browser-app/src/`
**When** developer uses `console.log`, `console.warn`, `console.error`, `console.debug`, or `console.info`
**Then** ESLint reports an error with the no-console rule

### AC-2: Error Level Enforcement
**Given** the ESLint configuration
**When** a console.* call is detected in src/ directories
**Then** rule is configured as "error" (not warning)
**And** commit is blocked by husky pre-commit hook via lint-staged

### AC-3: Test File Exclusion (Temporary)
**Given** any file in `test/**` or `browser-app/test/**` directory
**When** console.* calls are present
**Then** no ESLint error is reported
**Note:** Test files will be migrated in Story 10.8

### AC-4: Build/Config File Exclusion
**Given** build scripts and configuration files
**When** console.* calls are necessary (e.g., `scripts/*.js`, `*.config.js`)
**Then** these files are excluded from the no-console rule

## Technical Design

### ESLint Configuration

The project uses ESLint 9.x flat config format. Add the no-console rule:

```javascript
// eslint.config.js
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';

export default [
  // ... existing config
  {
    rules: {
      'no-console': 'error',  // Block all console.* usage
      // ... other rules
    }
  },
  // Test file exclusion (temporary - Story 10.8)
  {
    files: ['test/**/*.js', 'test/**/*.ts', 'browser-app/test/**/*.ts'],
    rules: {
      'no-console': 'off'
    }
  },
  // Build/config exclusion
  {
    files: ['scripts/**/*.js', 'scripts/**/*.mjs', '*.config.js', '*.config.ts'],
    rules: {
      'no-console': 'off'
    }
  }
];
```

### Expected Baseline Violation Count

Before migration, `npm run lint` should report violations:
- `src/`: ~45 console.* calls (Stories 10.4-10.6)
- `browser-app/src/`: ~148 console.* calls (Stories 10.2-10.6)
- Total in src: ~193 violations (test files excluded)

### Integration with Existing Tooling

- **Pre-commit hook:** `.husky/pre-commit` runs lint-staged
- **lint-staged config:** In `package.json`, runs `eslint --fix`
- **CI check:** `npm run lint:check` has `--max-warnings 0`

## Tasks / Subtasks

- [ ] **Task 1: Add no-console rule to ESLint config** (AC: #1, #2)
  - [ ] Open `eslint.config.js`
  - [ ] Add `'no-console': 'error'` to the rules section
  - [ ] Test with `npm run lint -- src/i18n/i18nService.js`

- [ ] **Task 2: Add test file exclusion override** (AC: #3)
  - [ ] Add override block for `test/**/*.js` and `test/**/*.ts`
  - [ ] Add override for `browser-app/test/**/*.ts`
  - [ ] Verify with `npm run lint -- test/unit/pii/DetectionPipeline.test.js`

- [ ] **Task 3: Add build/config file exclusion** (AC: #4)
  - [ ] Add override for `scripts/**/*.js` and `scripts/**/*.mjs`
  - [ ] Add override for `*.config.js` and `*.config.ts`
  - [ ] Verify with `npm run lint -- scripts/patch-pdf-parse.js`

- [ ] **Task 4: Document baseline violation count** (AC: all)
  - [ ] Run `npm run lint 2>&1 | grep -c "no-console"`
  - [ ] Record count in Completion Notes
  - [ ] Verify violations are in expected files (src/, browser-app/src/)

- [ ] **Task 5: Verify pre-commit hook integration** (AC: #2)
  - [ ] Add test `console.log('test')` to `src/utils/pathValidator.ts`
  - [ ] Stage and attempt commit
  - [ ] Verify commit is blocked by lint-staged
  - [ ] Remove test line

## Dev Notes

### Architecture Alignment

This story establishes the enforcement layer for Epic 10. The ESLint rule prevents regression while subsequent stories migrate existing console.* calls to LoggerFactory.

[Source: docs/sprint-artifacts/tech-spec-epic-10.md#AC-10.1]

### Existing ESLint Configuration

The project uses:
- ESLint 9.x with flat config format
- `@typescript-eslint/eslint-plugin` for TypeScript
- Security plugins: `eslint-plugin-security`, `eslint-plugin-no-secrets`
- `lint:check` script with `--max-warnings 0`

### Project Structure Notes

| Path | Purpose |
|------|---------|
| `eslint.config.js` | ESLint flat config (not `.eslintrc.js`) |
| `.husky/pre-commit` | Runs `npx lint-staged` |
| `package.json` → `lint-staged` | Staged file linting config |

### References

- [Source: docs/epics.md#Story-10.1]
- [Source: docs/sprint-artifacts/tech-spec-epic-10.md#AC-10.1]
- ESLint no-console rule: https://eslint.org/docs/rules/no-console

## Definition of Done

- [ ] ESLint `no-console` rule added and configured as error
- [ ] Test files excluded from rule (temporary)
- [ ] Build/config files excluded from rule
- [ ] `npm run lint` runs without config errors
- [ ] Pre-commit hook blocks console.* additions to src/
- [ ] Baseline violation count documented in completion notes
- [ ] CI pipeline continues to pass (existing violations don't fail build yet)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/10-1-eslint-console-restriction.context.xml

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
