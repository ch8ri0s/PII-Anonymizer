# Linting and Type-Checking Configuration

This document describes the linting and type-checking setup for the A5-PII-Anonymizer project.

## Overview

The project uses:
- **ESLint 9** for JavaScript/TypeScript linting
- **TypeScript 5.x** with strict type-checking enabled
- **Automated fixes** for most style issues

## Quick Commands

```bash
# Type-checking (no file output)
npm run typecheck

# Linting
npm run lint              # Check all files
npm run lint:fix          # Auto-fix issues where possible
npm run lint:check        # Strict mode - fail on any warnings

# Pre-build validation (runs before production builds)
npm run prebuild          # Runs: typecheck + lint:check + compile + css:build
```

## ESLint Configuration

### Configuration File: `eslint.config.js`

Uses ESLint 9's flat config format with:
- **JavaScript rules** (ES2022, Node.js + Electron + Browser globals)
- **TypeScript rules** (@typescript-eslint)
- **Ignores** automatically handled in config

### Key Rules

**Error Prevention:**
- No unused variables (except those prefixed with `_`)
- No undefined variables
- Strict equality (`===`) required

**Best Practices:**
- No `eval()` or implied eval
- Prefer `const` over `let`
- No `var` declarations

**Code Style:**
- 2-space indentation
- Single quotes (with escape avoidance)
- Semicolons required
- Trailing commas in multiline

**TypeScript-Specific:**
- Warn on `any` types
- Warn on non-null assertions
- No unused parameters/variables

### Ignored Files

Automatically ignored (configured in `eslint.config.js`):
- `node_modules/**`
- `dist/**`
- `build/**`
- `models/**`
- `test/output/**`
- `*.config.js`
- `output.css`

## TypeScript Configuration

### Configuration File: `tsconfig.json`

Enhanced with strict type-checking options:

**Strict Type Checking (all enabled):**
- `strict: true` (master switch)
- `noImplicitAny: true`
- `strictNullChecks: true`
- `strictFunctionTypes: true`
- `strictBindCallApply: true`
- `strictPropertyInitialization: true`
- `noImplicitThis: true`
- `alwaysStrict: true`

**Additional Checks:**
- `noUnusedLocals: true` - Flag unused variables
- `noUnusedParameters: true` - Flag unused parameters
- `noImplicitReturns: true` - All code paths must return
- `noFallthroughCasesInSwitch: true` - Prevent fallthrough bugs
- `noUncheckedIndexedAccess: true` - Safer array/object access
- `noImplicitOverride: true` - Explicit override modifiers

**Compilation:**
- Target: ES2022
- Module: Node16 (ES modules)
- Output: `dist/` directory
- Source maps enabled
- Declaration files generated

## Current Status

### TypeScript Errors

The project currently has TypeScript errors that need to be addressed:

**Override modifiers missing:**
- Multiple converter classes need `override` keyword on methods

**Null safety issues:**
- Several places where objects could be `undefined`
- Need explicit null checks or non-null assertions

**Unused variables:**
- Some declared variables are never used
- Prefix with `_` or remove

**Total:** ~22 TypeScript errors (as of 2025-11-16)

### ESLint Issues

After running `npm run lint:fix`, remaining issues:

**Auto-fixable (already fixed):**
- Trailing commas
- Single vs double quotes
- Indentation

**Remaining (manual fix required):**
- ~66 warnings (mostly unused variables in tests)
- ~114 errors (URL global not defined, escape characters)

**Total:** ~180 linting issues (as of 2025-11-16)

## How to Fix Issues

### TypeScript Errors

**1. Add override modifiers:**
```typescript
// Before
class CsvToMarkdown extends MarkdownConverter {
  async convert(filePath: string): Promise<string> {
    // ...
  }
}

// After
class CsvToMarkdown extends MarkdownConverter {
  override async convert(filePath: string): Promise<string> {
    // ...
  }
}
```

**2. Handle null/undefined:**
```typescript
// Before
const value = obj.property;

// After (option 1: null check)
const value = obj?.property ?? 'default';

// After (option 2: non-null assertion if you're certain)
const value = obj!.property;
```

**3. Remove or prefix unused variables:**
```typescript
// Before
function handler(event, value) {
  return value;
}

// After
function handler(_event, value) {
  return value;
}
```

### ESLint Errors

**1. Fix URL undefined:**
```javascript
// Add to eslint.config.js globals
globals: {
  URL: 'readonly',
}
```

**2. Fix unnecessary escapes:**
```javascript
// Before
const regex = /\//;

// After
const regex = /\//;  // Keep backslash for regex
```

## Pre-Build Validation

The `prebuild` script runs before production builds:

```json
"prebuild": "npm run typecheck && npm run lint:check && npm run compile && npm run css:build"
```

This ensures:
1. ✅ No TypeScript errors
2. ✅ No linting errors or warnings
3. ✅ Successful compilation
4. ✅ CSS built

**If any step fails, the build is aborted.**

## VS Code Integration

For optimal developer experience, add to `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": false,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Continuous Integration

For CI/CD pipelines, add:

```yaml
# Example GitHub Actions
- name: Type Check
  run: npm run typecheck

- name: Lint Check
  run: npm run lint:check

- name: Build
  run: npm run build
```

## Recommended Workflow

**During development:**
1. Run `npm run lint:fix` periodically to auto-fix style issues
2. Run `npm run typecheck` to catch type errors early
3. Fix errors as you go

**Before committing:**
1. `npm run typecheck` - Ensure no type errors
2. `npm run lint:check` - Ensure no linting issues
3. `npm test` - Ensure tests pass

**Pre-build:**
- `npm run prebuild` runs automatically before builds
- Ensures production code quality

## Migration Notes

### From No Linting to ESLint 9

- Old `.eslintrc` files not supported (flat config only)
- `.eslintignore` deprecated (use `ignores` in config)
- All auto-fixable issues were fixed with `npm run lint:fix`

### TypeScript Strict Mode

- Enabled all strict flags for maximum type safety
- Some existing code may need updates
- Catch bugs at compile time instead of runtime

## Resources

- **ESLint 9 Docs:** https://eslint.org/docs/latest/
- **TypeScript Strict Guide:** https://www.typescriptlang.org/tsconfig#strict
- **Migration Guide:** https://eslint.org/docs/latest/use/configure/migration-guide

---

**Last Updated:** 2025-11-16
**Status:** Configured and partially fixed (manual fixes still needed)
