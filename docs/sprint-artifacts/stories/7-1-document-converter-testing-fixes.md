# Story 7.1: Document Converter Testing & Fixes

Status: drafted

## Story

As a **user processing documents in the browser**,
I want **all document formats to convert correctly**,
So that **I can anonymize PDFs, DOCX, Excel, CSV, and text files without installation**.

## Acceptance Criteria

1. **AC1: PDF Conversion Works in Browser**
   - PDF files convert to Markdown using pdf.js
   - Text extraction maintains proper word spacing
   - Page breaks are preserved with horizontal rules
   - Basic heading detection works (font size heuristics)
   - Note: Table detection deferred to Story 7.3 (PII Pipeline port)

2. **AC2: DOCX Conversion Works in Browser**
   - DOCX files convert using mammoth browser build
   - Document structure preserved (headings, lists, tables)
   - Hyperlinks converted to Markdown format
   - Images handled gracefully (noted but not embedded)

3. **AC3: Excel Conversion Works in Browser**
   - Excel files (XLSX) convert using exceljs browser mode
   - Multiple sheets converted as separate sections
   - Tables rendered as GitHub Flavored Markdown
   - Formulas show calculated results (not formulas)

4. **AC4: CSV/Text Conversion Works in Browser**
   - CSV files convert to Markdown tables
   - Quoted fields with commas handled correctly
   - Text and Markdown files pass through unchanged
   - UTF-8 encoding preserved

5. **AC5: Output Matches Electron Version**
   - Conversion output comparable to Electron app quality
   - Test with identical fixtures produces similar output
   - Table detection in PDFs produces similar results
   - No regressions in text extraction quality

6. **AC6: Error Handling with i18n**
   - Unsupported file types show user-friendly error
   - Corrupted files handled gracefully (no crash)
   - Large file warnings displayed appropriately
   - Error messages are actionable
   - All error messages support EN/FR/DE localization (port i18n system)

7. **AC7: Comprehensive Tests Pass**
   - Unit tests created for all converters (happy path + edge cases)
   - Integration tests with fixture files pass
   - Comparison tests verify output matches Electron version
   - Performance benchmarks establish baseline metrics
   - TypeScript compilation succeeds
   - Vite build produces working bundle

## Tasks / Subtasks

- [ ] Task 1: Set Up Test Infrastructure (AC: 7)
  - [ ] 1.1: Add Vitest to browser-app devDependencies
  - [ ] 1.2: Create browser-app/test/ directory structure
  - [ ] 1.3: Configure Vitest for browser environment testing
  - [ ] 1.4: Copy relevant test fixtures from main app

- [ ] Task 2: PDF Converter Testing & Fixes (AC: 1, 5)
  - [ ] 2.1: Create test/converters/PdfConverter.test.ts
  - [ ] 2.2: Test basic text extraction from text-only.pdf
  - [ ] 2.3: Test heading detection from formatted PDF
  - [ ] 2.4: Compare output with Electron version
  - [ ] 2.5: Fix any spacing or line break issues found

- [ ] Task 3: DOCX Converter Testing & Fixes (AC: 2, 5)
  - [ ] 3.1: Create test/converters/DocxConverter.test.ts
  - [ ] 3.2: Create test-fixtures/sample.docx with headings, lists, tables
  - [ ] 3.3: Test structure preservation
  - [ ] 3.4: Verify mammoth browser API compatibility
  - [ ] 3.5: Fix any turndown conversion issues

- [ ] Task 4: Excel Converter Testing & Fixes (AC: 3, 5)
  - [ ] 4.1: Create test/converters/ExcelConverter.test.ts
  - [ ] 4.2: Create test-fixtures/sample.xlsx with multiple sheets
  - [ ] 4.3: Test multi-sheet handling
  - [ ] 4.4: Test formula result extraction
  - [ ] 4.5: Verify exceljs browser mode compatibility

- [ ] Task 5: CSV/Text Converter Testing (AC: 4, 5)
  - [ ] 5.1: Create test/converters/CsvConverter.test.ts
  - [ ] 5.2: Test CSV parsing with edge cases (quotes, commas, newlines)
  - [ ] 5.3: Create test/converters/TextConverter.test.ts
  - [ ] 5.4: Test UTF-8 handling with international characters

- [ ] Task 6: Port i18n System (AC: 6)
  - [ ] 6.1: Copy locales/ folder (en.json, fr.json, de.json) to browser-app/public/
  - [ ] 6.2: Create browser-app/src/i18n/i18nService.ts (browser-native version)
  - [ ] 6.3: Add converter error message keys to locale files
  - [ ] 6.4: Integrate i18n into converter error handling
  - [ ] 6.5: Test language switching (EN/FR/DE)

- [ ] Task 7: Error Handling Implementation (AC: 6)
  - [ ] 7.1: Add error boundary in converters/index.ts
  - [ ] 7.2: Implement user-friendly error messages with i18n keys
  - [ ] 7.3: Add file size validation with warning threshold
  - [ ] 7.4: Create test/converters/errors.test.ts for error scenarios

- [ ] Task 8: Comparison & Performance Testing (AC: 5, 7)
  - [ ] 8.1: Create test/comparison/ directory for Electron output comparison
  - [ ] 8.2: Generate reference outputs from Electron app
  - [ ] 8.3: Create comparison tests (diff-based)
  - [ ] 8.4: Add performance benchmarks (processing time per file type)
  - [ ] 8.5: Document baseline metrics in test output

- [ ] Task 9: Integration Testing & Verification (AC: 7)
  - [ ] 9.1: Create test/integration/conversion.test.ts
  - [ ] 9.2: Test full conversion pipeline with all file types
  - [ ] 9.3: Run npm run typecheck - zero errors
  - [ ] 9.4: Run npm run build - produces working bundle
  - [ ] 9.5: Manual verification in browser

## Dev Notes

### Current State Analysis

The browser-app already has all 5 converters implemented:

| Converter | File | Lines | Status | Notes |
|-----------|------|-------|--------|-------|
| PdfConverter | `src/converters/PdfConverter.ts` | 135 | Implemented | Uses pdf.js, basic text extraction |
| DocxConverter | `src/converters/DocxConverter.ts` | 62 | Implemented | Uses mammoth + turndown |
| ExcelConverter | `src/converters/ExcelConverter.ts` | 120 | Implemented | Uses exceljs |
| CsvConverter | `src/converters/CsvConverter.ts` | 89 | Implemented | Pure JS parser |
| TextConverter | `src/converters/TextConverter.ts` | 32 | Implemented | Pass-through |

**What's Missing:**
1. **No tests** - Zero test coverage currently
2. **No PDF table detection** - Main app has `pdfTableDetector.ts` (deferred to Story 7.3)
3. **No test fixtures** in browser-app folder
4. **No i18n system** - Need to port from main app for localized error messages

**Design Decisions (from Advanced Elicitation):**
- PDF table detection deferred to Story 7.3 (PII Pipeline port)
- Comprehensive test coverage required (edge cases + comparison + benchmarks)
- i18n system to be ported for error message localization (EN/FR/DE)

### Technical Approach

1. **Vitest Configuration:**
   ```typescript
   // browser-app/vitest.config.ts
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     test: {
       environment: 'happy-dom', // Browser-like environment
       include: ['test/**/*.test.ts'],
       globals: true,
     },
   });
   ```

2. **Test File Pattern:**
   ```typescript
   // test/converters/PdfConverter.test.ts
   import { describe, it, expect } from 'vitest';
   import { PdfConverter } from '../../src/converters/PdfConverter';

   describe('PdfConverter', () => {
     const converter = new PdfConverter();

     it('supports PDF files', () => {
       const file = new File([], 'test.pdf', { type: 'application/pdf' });
       expect(converter.supports(file)).toBe(true);
     });

     it('converts PDF to markdown', async () => {
       const buffer = await fetch('/fixtures/text-only.pdf').then(r => r.arrayBuffer());
       const file = new File([buffer], 'test.pdf', { type: 'application/pdf' });
       const markdown = await converter.convert(file);
       expect(markdown).toContain('expected text');
     });
   });
   ```

3. **PDF Table Detection (Deferred to Story 7.3):**
   - Will be ported with `pdfTableDetector.ts` when implementing PII pipeline
   - Current PdfConverter does basic text extraction only
   - Table detection requires position-based analysis from pdf.js

4. **i18n Browser Implementation:**
   ```typescript
   // browser-app/src/i18n/i18nService.ts
   class I18nService {
     private translations: Record<string, Record<string, string>> = {};
     private currentLang = 'en';

     async loadLocale(lang: string): Promise<void> {
       const response = await fetch(`/locales/${lang}.json`);
       this.translations[lang] = await response.json();
       this.currentLang = lang;
     }

     t(key: string, params?: Record<string, string>): string {
       const template = this.translations[this.currentLang]?.[key] || key;
       return params
         ? template.replace(/\{(\w+)\}/g, (_, k) => params[k] || `{${k}}`)
         : template;
     }
   }
   ```

5. **Comparison Testing Approach:**
   ```typescript
   // test/comparison/conversion.comparison.test.ts
   describe('Electron Parity', () => {
     it('PDF output matches Electron reference', async () => {
       const browserOutput = await convertToMarkdown(testPdf);
       const electronReference = await readFile('reference/test.pdf.md');
       expect(browserOutput).toMatchSnapshot();
       // Allow minor whitespace differences
       expect(normalize(browserOutput)).toEqual(normalize(electronReference));
     });
   });
   ```

### Project Structure Notes

**Files to Create:**
```
browser-app/
├── src/
│   └── i18n/
│       └── i18nService.ts          # Browser-native i18n implementation
├── public/
│   └── locales/                    # Copy from main app
│       ├── en.json
│       ├── fr.json
│       └── de.json
├── test/
│   ├── converters/
│   │   ├── PdfConverter.test.ts
│   │   ├── DocxConverter.test.ts
│   │   ├── ExcelConverter.test.ts
│   │   ├── CsvConverter.test.ts
│   │   ├── TextConverter.test.ts
│   │   └── errors.test.ts
│   ├── comparison/
│   │   ├── reference/              # Electron output snapshots
│   │   └── conversion.comparison.test.ts
│   ├── performance/
│   │   └── benchmark.test.ts       # Performance baseline tests
│   ├── integration/
│   │   └── conversion.test.ts
│   └── fixtures/
│       ├── text-only.pdf           # Copy from main app
│       ├── simple-table.pdf        # Copy from main app
│       ├── sample.docx             # Create
│       ├── sample.xlsx             # Create
│       └── sample.csv              # Create
├── vitest.config.ts
└── package.json                    # Add vitest, @vitest/ui
```

**Files to Modify:**
- `browser-app/package.json` - Add vitest, @vitest/ui, happy-dom
- `browser-app/src/converters/index.ts` - Add i18n error handling
- `browser-app/src/main.ts` - Initialize i18n service
- Individual converters - Bug fixes as discovered in testing

**Files to Copy from Main App:**
- `locales/en.json` → `browser-app/public/locales/en.json`
- `locales/fr.json` → `browser-app/public/locales/fr.json`
- `locales/de.json` → `browser-app/public/locales/de.json`
- `test/fixtures/text-only.pdf` → `browser-app/test/fixtures/`
- `test/fixtures/simple-table.pdf` → `browser-app/test/fixtures/`

### References

- [Source: docs/epics.md#Story-7.1]
- [Source: specs/browser-migration/MIGRATION_PLAN.md#Phase-2]
- [Source: browser-app/src/converters/index.ts - Current unified API]
- [Source: src/utils/pdfTableDetector.ts - Table detection logic (not yet ported)]
- [Source: test/fixtures/ - Existing test fixtures to port]

### Learnings from Previous Story

**From Story 6-8-constants-magic-numbers (Status: done)**

- **Central Configuration**: Browser-app should define its own constants.ts for any magic numbers
- **Type Safety**: Use `as const` for constant objects (e.g., supported extensions)
- **Test Pattern**: 41 unit tests in main app shows thorough testing approach
- **JSDoc Documentation**: All exports should have JSDoc comments

[Source: stories/6-8-constants-magic-numbers.md#Dev-Agent-Record]

### Browser-Specific Considerations

1. **pdf.js Worker**: Already configured with worker URL in PdfConverter.ts:11-14
2. **ArrayBuffer API**: All converters use `file.arrayBuffer()` (browser-native)
3. **No fs module**: All file I/O via File API (browser-compatible)
4. **Vite Build**: Configuration at `vite.config.ts` handles bundling

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-18 | Claude | Story drafted from epics.md |

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

### File List
