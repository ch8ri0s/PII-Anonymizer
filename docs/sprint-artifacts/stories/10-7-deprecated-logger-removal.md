# Story 10.7: Deprecated Logger Files Removal

## Story

As a **developer maintaining the codebase**,
I want **deprecated logging files removed**,
So that **there's only one way to log (LoggerFactory) and no confusion**.

## Status

- **Epic:** 10 - Console-to-Logger Migration
- **Priority:** Medium (cleanup)
- **Estimate:** S
- **Dependencies:** Stories 10.4-10.6 (all src/ migrations complete)

## Acceptance Criteria

**Given** deprecated logging files exist
**When** removal is complete
**Then**:

1. `src/utils/logger.ts` is **deleted**
2. `src/config/logging.ts` is **deleted**
3. All imports of these files are updated to use LoggerFactory
4. No runtime errors occur
5. TypeScript compilation succeeds (`npm run typecheck`)
6. All tests pass (`npm test`)
7. ESLint passes (`npm run lint`)

**And** LoggerFactory.ts is the **single source of truth** for logging
**And** Any `createLogger()` calls migrated to `LoggerFactory.create()`
**And** CLAUDE.md updated to remove references to deprecated files

## Technical Notes

- Both files are already marked `@deprecated` in JSDoc
- Search: `grep -r "from.*logger" src/` and `grep -r "from.*logging" src/`
- Check for re-exports in `src/index.ts` or similar barrel files
- Update any imports in test files as well
- Git: Single commit with clear message about deprecation removal

## Implementation Guidance

### Step 1: Find All Imports

```bash
# Find all imports of deprecated files
grep -r "from.*\/logger" src/ --include="*.ts" --include="*.js"
grep -r "from.*\/logging" src/ --include="*.ts" --include="*.js"
grep -r "from.*\/logger" test/ --include="*.ts" --include="*.js"
grep -r "from.*\/logging" test/ --include="*.ts" --include="*.js"

# Find createLogger usage
grep -r "createLogger" src/ test/ --include="*.ts" --include="*.js"
```

### Step 2: Update Imports

```typescript
// BEFORE
import { createLogger } from '../utils/logger';
import { configureLogging } from '../config/logging';

const log = createLogger('my-module');

// AFTER
import { LoggerFactory } from '../utils/LoggerFactory';

const log = LoggerFactory.create('my-module');
```

### Step 3: Delete Files

```bash
rm src/utils/logger.ts
rm src/config/logging.ts
```

### Step 4: Verify

```bash
npm run typecheck  # TypeScript compilation
npm run lint       # ESLint
npm test           # All tests
npm run dev        # Manual smoke test
```

## Definition of Done

- [ ] All `createLogger` imports replaced with `LoggerFactory.create`
- [ ] All `configureLogging` imports removed (if any remain)
- [ ] `src/utils/logger.ts` deleted
- [ ] `src/config/logging.ts` deleted
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` passes
- [ ] Electron app starts and logs work
- [ ] Browser-app starts and logs work
- [ ] CLAUDE.md updated (remove deprecated file references)
- [ ] Git commit with clear deprecation removal message

## Files to Delete

1. `src/utils/logger.ts`
2. `src/config/logging.ts`

## Files to Update (imports)

Run the grep commands above to identify all files that import the deprecated modules.

## Notes

- This story should only be done AFTER all src/ migration stories are complete
- Single atomic commit makes it easy to revert if issues found
- Update CLAUDE.md to prevent AI assistants from referencing old files
