# TypeScript Import Error Fix (TS6137)

## Problem

TypeScript 5.x was rejecting imports from `@types/detection` with error TS6137:
"Cannot import type declaration files. Consider importing 'detection' instead of '@types/detection'."

The issue affected 6 source files and 1 test file.

## Root Cause

The `tsconfig.json` had a path alias `@types/*` pointing to `../src/types/*` (the parent project's types directory). TypeScript 5.x doesn't allow importing from `.d.ts` declaration files directly when using path aliases.

## Solution

Created a local types re-export file at `/Users/olivier/Projects/A5-PII-Anonymizer/browser-app/src/types/detection.ts` that re-exports all types from the parent project's implementation file (`../../../src/types/detection.js`).

This follows TypeScript's module resolution rules: instead of importing declaration files, we import the actual implementation and let TypeScript infer the types.

## Files Modified

### 1. Created Local Type Re-export
- **File:** `src/types/detection.ts`
- **Purpose:** Re-exports all detection types from parent project
- **Re-exported Types:**
  - Entity, EntityType, EntitySource, ValidationStatus
  - AddressComponent, AddressComponentType, AddressPatternType
  - GroupedAddress, LinkedAddressGroup
  - ContextFactor, DetectionPass, PipelineContext, PassResult
  - DocumentType, PipelineConfig, DetectionResult
  - ValidationRule, ValidationResult, ContextRule
  - MappingEntry, MappingFile

### 2. Updated Source Files (6 files)
All imports changed from `@types/detection` to `../types/detection.js`:

1. **src/pii/BrowserHighRecallPass.ts** (line 15)
   - Changed: `import type { ... } from '@types/detection'`
   - To: `import type { ... } from '../types/detection.js'`

2. **src/pii/BrowserRuleEngine.ts** (line 10)
   - Changed: `import type { Entity } from '@types/detection'`
   - To: `import type { Entity } from '../types/detection.js'`

3. **src/pii/index.ts** (lines 38, 67)
   - Fixed non-existent export: `classifyDocument` → `createDocumentClassifier`
   - Changed: `export type { ... } from '@types/detection'`
   - To: `export type { ... } from '../types/detection.js'`

4. **src/processing/PIIDetector.ts** (line 18)
   - Changed: `import type { ... } from '@types/detection'`
   - To: `import type { ... } from '../types/detection.js'`

5. **src/workers/pii.worker.ts** (line 9)
   - Changed: `import type { ... } from '@types/detection'`
   - To: `import type { ... } from '../types/detection.js'`

6. **src/workers/types.ts** (line 7)
   - Changed: `import type { ... } from '@types/detection'`
   - To: `import type { ... } from '../types/detection.js'`

### 3. Updated Test Files (1 file)

**test/pii/BrowserHighRecallPass.test.ts** (line 9)
- Changed: `import type { ... } from '@types/detection'`
- To: `import type { ... } from '../../src/types/detection.js'`

## Additional Fix

Fixed incorrect export in `src/pii/index.ts`:
- **Before:** `export { DocumentClassifier, classifyDocument } from '@pii/DocumentClassifier'`
- **After:** `export { DocumentClassifier, createDocumentClassifier } from '@pii/DocumentClassifier'`

The `classifyDocument` function doesn't exist in the parent project's DocumentClassifier. The correct export is `createDocumentClassifier`.

## Verification

Before fix:
- 5 TS6137 errors ("Cannot import type declaration files")
- 1 TS2305 error ("Module has no exported member 'classifyDocument'")

After fix:
- 0 TS6137 errors
- 0 TS2305 errors
- All remaining errors are unrelated (unused variables, type mismatches, etc.)

```bash
# Verify no more @types/detection imports
grep -r "from ['\"]@types/detection['\"]" src/ test/
# Result: No matches found

# Verify TS6137 errors are gone
npm run typecheck 2>&1 | grep "TS6137"
# Result: No output (no errors)
```

## Best Practices Applied

1. **Type Re-exports:** Created a local re-export file instead of modifying tsconfig path aliases
2. **Consistent Import Paths:** Used `.js` extension in imports for ESM compatibility
3. **Relative Imports:** Used relative paths from the re-export file to the parent project
4. **Type-Only Imports:** Maintained `import type` for all type imports (no runtime overhead)

## Impact

- **Build:** No impact on build performance or bundle size
- **Development:** Faster TypeScript compilation (no more TS6137 errors)
- **Maintenance:** Easier to track type dependencies with local re-export file
- **Compatibility:** Fully compatible with TypeScript 5.x module resolution

## Related Files

- Parent types: `/Users/olivier/Projects/A5-PII-Anonymizer/src/types/detection.ts`
- Browser re-export: `/Users/olivier/Projects/A5-PII-Anonymizer/browser-app/src/types/detection.ts`
- TypeScript config: `/Users/olivier/Projects/A5-PII-Anonymizer/browser-app/tsconfig.json`
