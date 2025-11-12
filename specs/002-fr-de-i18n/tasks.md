# Tasks: French and German Internationalization Support

**Input**: Design documents from `/specs/002-fr-de-i18n/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are included per constitution requirement (Test-First Development)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single Electron project**: `locales/` at root, `src/i18n/`, `src/services/` for implementation
- **Tests**: `tests/unit/` and `tests/integration/`
- All paths relative to repository root: `/Users/olivier/Projects/A5-PII-Anonymizer/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create translation file structure and test framework setup

- [ ] T001 Create locales directory structure at repository root: `locales/`
- [ ] T002 [P] Create translation JSON schema file: `specs/002-fr-de-i18n/contracts/translation-schema.json` (already exists)
- [ ] T003 [P] Create test directory structure: `tests/unit/i18n/` and `tests/integration/i18n/`
- [ ] T004 [P] Configure Mocha to run i18n-specific tests: add `test:i18n` script to `package.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core i18n infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T005 Create i18n module directory: `src/i18n/`
- [ ] T006 [P] Implement language detector module: `src/i18n/languageDetector.js` (detect OS locale, extract language code, handle fallbacks)
- [ ] T007 [P] Implement locale formatter module: `src/i18n/localeFormatter.js` (date, time, number formatting using Intl API)
- [ ] T008 Implement i18n service core: `src/i18n/i18nService.js` (translation loading, key lookup, fallback logic)
- [ ] T009 Create IPC handlers file: `src/services/i18nHandlers.js` (empty stub, will be populated per story)
- [ ] T010 Create translation coverage test: `tests/unit/i18n/translationCoverage.test.js` (verify all keys exist in all languages, no empty values)
- [ ] T011 [P] Create language detector test: `tests/unit/i18n/languageDetector.test.js` (test locale detection and fallback)
- [ ] T012 [P] Create locale formatter test: `tests/unit/i18n/localeFormatter.test.js` (test date/time/number formatting for each locale)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - French User Interface (Priority: P1) 🎯 MVP

**Goal**: French-speaking users can use the entire application in French. All UI elements display in French when language preference is set to French.

**Independent Test**: Change language to French and verify all UI text appears in French. Complete workflow (upload → process → download) without seeing English text.

### Tests for User Story 1 ⚠️ TDD: Write FIRST, Ensure FAIL

- [ ] T013 [P] [US1] Write test for French translation file structure: `tests/unit/i18n/frenchTranslations.test.js` (verify fr.json has all sections and keys)
- [ ] T014 [P] [US1] Write test for IPC translation loading: `tests/integration/i18n/translationLoading.test.js` (verify getTranslations IPC handler returns French translations)
- [ ] T015 [P] [US1] Write test for i18n service French lookup: `tests/unit/i18n/i18nService.test.js` (verify t() function returns French strings for 'fr' locale)

**CHECKPOINT**: Run tests - ALL MUST FAIL before proceeding

### Implementation for User Story 1

- [ ] T016 [US1] Create English translation file (source of truth): `locales/en.json` with complete translation structure:
  - app.* (title, subtitle)
  - upload.* (title, browse, dragText, supportedFormats)
  - metadata.* (filename, type, size, modified)
  - processing.* (ready, processButton, processing, success)
  - download.* (markdown, mapping)
  - tabs.* (markdown, mapping)
  - fileTypes.* (pdfDocument, wordDocument, excelSpreadsheet, csvFile, textFile)
  - entityTypes.* (person, location, organization, phone, email, iban, ahv, passport, uidNumber)
  - errors.* (fileLoadFailed, processingFailed, invalidFile)
  - buttons.* (reset, process, ok, cancel)
  - footer.* (output, license, support)
- [ ] T017 [US1] Create French translation file: `locales/fr.json` with professional French translations for all keys from en.json
- [ ] T018 [US1] Register i18n IPC handler in main process: `main.js` - add `ipcMain.handle('i18n:getTranslations')` and `ipcMain.handle('i18n:getDetectedLocale')`
- [ ] T019 [US1] Expose i18n API via preload: `preload.cjs` - add `i18nAPI.getTranslations()` and `i18nAPI.getDetectedLocale()` to contextBridge
- [ ] T020 [US1] Initialize i18n in renderer on app load: `renderer.js` - detect/load French translations, initialize i18nService
- [ ] T021 [US1] Replace hardcoded upload zone text with translations: `renderer.js` - update upload zone title, browse button, drag text, supported formats
- [ ] T022 [US1] Replace hardcoded metadata labels with translations: `renderer.js` - update filename, type, size, modified labels in populateMetadata()
- [ ] T023 [US1] Replace hardcoded processing text with translations: `renderer.js` - update ready state, process button, spinner text, success message
- [ ] T024 [US1] Replace hardcoded tab labels with translations: `renderer.js` - update "Sanitized Markdown" and "Change Mapping" tab labels
- [ ] T025 [US1] Replace hardcoded file type badges with translations: `renderer.js` - update getFileTypeInfo() to use i18n.t() for type labels
- [ ] T026 [US1] Replace hardcoded entity type labels with translations: `renderer.js` - update populateMappingList() to use i18n.t() for entity types
- [ ] T027 [US1] Replace hardcoded error messages with translations: `renderer.js` - update showError() and error handling to use i18n.t()
- [ ] T028 [US1] Replace hardcoded button text with translations: `renderer.js` - update download buttons, reset button
- [ ] T029 [US1] Replace hardcoded footer text with translations: `index.html` - update output description, license, support email labels
- [ ] T030 [US1] Apply French date formatting: `renderer.js` - use localeFormatter.formatDate() in populateMetadata() for lastModified
- [ ] T031 [US1] Apply French number formatting: `renderer.js` - use localeFormatter.formatFileSize() in populateMetadata() for file sizes

**CHECKPOINT**: Run tests for US1 - ALL MUST PASS. Test manually by forcing locale to 'fr' and verifying entire UI is in French.

---

## Phase 4: User Story 2 - German User Interface (Priority: P2)

**Goal**: German-speaking users can use the entire application in German. All UI elements display in German when language preference is set to German.

**Independent Test**: Change language to German and verify all UI text appears in German. Complete workflow (upload → process → download) without seeing English text.

### Tests for User Story 2 ⚠️ TDD: Write FIRST, Ensure FAIL

- [ ] T032 [P] [US2] Write test for German translation file structure: `tests/unit/i18n/germanTranslations.test.js` (verify de.json has all sections and keys)
- [ ] T033 [P] [US2] Write test for German locale formatting: `tests/unit/i18n/germanFormatting.test.js` (verify DD.MM.YYYY date format, 1.234,56 number format)

**CHECKPOINT**: Run tests - ALL MUST FAIL before proceeding

### Implementation for User Story 2

- [ ] T034 [US2] Create German translation file: `locales/de.json` with professional German translations for all keys from en.json
- [ ] T035 [US2] Add German locale support to languageDetector: `src/i18n/languageDetector.js` - ensure 'de' is in supported languages array
- [ ] T036 [US2] Add German date formatting: `src/i18n/localeFormatter.js` - configure DD.MM.YYYY format for 'de' locale
- [ ] T037 [US2] Add German number formatting: `src/i18n/localeFormatter.js` - configure 1.234,56 format for 'de' locale
- [ ] T038 [US2] Update i18n service to load German translations: `src/i18n/i18nService.js` - add 'de' to locale whitelist
- [ ] T039 [US2] Test German locale end-to-end: manually set locale to 'de' and verify all UI text appears in German

**CHECKPOINT**: Run tests for US2 - ALL MUST PASS. Test manually by forcing locale to 'de' and verifying entire UI is in German.

---

## Phase 5: User Story 3 - Language Selection (Priority: P3)

**Goal**: Users can manually change the application language via a UI selector. Language preference persists across sessions.

**Independent Test**: Open language selector, switch between EN/FR/DE, verify UI updates immediately. Close and reopen app, verify language preference is remembered.

### Tests for User Story 3 ⚠️ TDD: Write FIRST, Ensure FAIL

- [ ] T040 [P] [US3] Write test for language preference persistence: `tests/integration/i18n/preferencePersis tence.test.js` (save to localStorage, reload, verify persisted)
- [ ] T041 [P] [US3] Write test for language switching: `tests/integration/i18n/languageSwitching.test.js` (call changeLanguage(), verify i18n service updates, verify UI re-renders)

**CHECKPOINT**: Run tests - ALL MUST FAIL before proceeding

### Implementation for User Story 3

- [ ] T042 [US3] Add language selector UI to header: `index.html` - create dropdown/selector component with EN/FR/DE options in app-header section
- [ ] T043 [US3] Style language selector: `ui-components.css` - add `.language-selector` styles matching design system
- [ ] T044 [US3] Implement changeLanguage() function: `renderer.js` - handle user selection, call i18nAPI.getTranslations(), update i18nService, save to localStorage
- [ ] T045 [US3] Add language preference persistence: `renderer.js` - in initializeI18n(), check localStorage for preferredLanguage before OS detection
- [ ] T046 [US3] Implement updateUIText() function: `renderer.js` - re-render all translated text elements when language changes
- [ ] T047 [US3] Add language selector event listener: `renderer.js` - listen for change event on language selector, call changeLanguage()
- [ ] T048 [US3] Add visual indicator for current language: `index.html` or `renderer.js` - highlight/mark currently selected language in selector
- [ ] T049 [US3] Ensure zero-flicker language switch: `renderer.js` - batch DOM updates to prevent UI flashing during language change
- [ ] T050 [US3] Test manual language switching: verify clicking each language option updates UI immediately and persists after app restart

**CHECKPOINT**: Run tests for US3 - ALL MUST PASS. User Stories 1, 2, AND 3 should all work independently and together.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and final validation

- [ ] T051 [P] Add keyboard navigation to language selector: `renderer.js` - ensure tab/arrow keys work, add aria-labels for accessibility
- [ ] T052 [P] Add translation string validation script: `scripts/validate-translations.js` - check for missing keys, empty values, invalid JSON
- [ ] T053 [P] Update README with i18n features: `README.md` - document language support, how to add translations
- [ ] T054 Run full translation coverage test: `npm run test:i18n:coverage` - verify 100% coverage for FR and DE
- [ ] T055 Verify all success criteria from spec.md:
  - [ ] SC-001: 100% translation coverage
  - [ ] SC-002: Language switching < 100ms
  - [ ] SC-003: Preference persists 100% of sessions
  - [ ] SC-004: Date/time formats correct per locale
  - [ ] SC-005: Complete workflow possible in FR/DE
  - [ ] SC-006: 95%+ correct language auto-detection
  - [ ] SC-007: Zero untranslated strings in production
- [ ] T056 [P] Performance optimization: lazy-load translation files only when needed (cache loaded translations)
- [ ] T057 [P] Add console warnings for missing translations in development: `src/i18n/i18nService.js` - DEBUG mode
- [ ] T058 Code cleanup: remove any hardcoded strings missed during implementation
- [ ] T059 Professional translation review: get native FR and DE speakers to review translations for accuracy and cultural appropriateness
- [ ] T060 Final integration test: complete full workflow (upload → process → download) in each language

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - US1 (French UI): Can start after Foundational - No dependencies on other stories
  - US2 (German UI): Can start after Foundational - No dependencies on other stories (can run parallel with US1)
  - US3 (Language Selector): Depends on US1 and US2 being complete (needs translations to switch between)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - Completely independent
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Completely independent (parallel with US1)
- **User Story 3 (P3)**: Requires US1 and US2 complete - Needs existing translations to switch between

### Within Each User Story

- Tests MUST be written FIRST and FAIL before implementation
- Translation files before renderer integration
- IPC handlers before preload exposure
- Preload exposure before renderer usage
- Core text replacement before formatting
- Story validation before moving to next priority

### Parallel Opportunities

- **Phase 1** (Setup): T002, T003, T004 can run in parallel
- **Phase 2** (Foundational): T006, T007 can run in parallel; T011, T012 can run in parallel
- **Phase 3** (US1): T013, T014, T015 tests can run in parallel
- **Phase 4** (US2): Can run in PARALLEL with Phase 3 (US1) if team capacity allows - completely different files
- **Phase 4** (US2): T032, T033 tests can run in parallel
- **Phase 5** (US3): T040, T041 tests can run in parallel
- **Phase 6** (Polish): T051, T052, T053 can run in parallel

---

## Parallel Example: User Story 1 (French UI)

```bash
# Launch all tests for User Story 1 together:
Task: "Write test for French translation file structure in tests/unit/i18n/frenchTranslations.test.js"
Task: "Write test for IPC translation loading in tests/integration/i18n/translationLoading.test.js"
Task: "Write test for i18n service French lookup in tests/unit/i18n/i18nService.test.js"

# After foundation phase, US1 and US2 can proceed in parallel:
Team Member A works on US1 (French UI)
Team Member B works on US2 (German UI) - SIMULTANEOUSLY
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T004)
2. Complete Phase 2: Foundational (T005-T012) - **CRITICAL CHECKPOINT**
3. Complete Phase 3: User Story 1 (T013-T031) - French UI
4. **STOP and VALIDATE**:
   - Run all US1 tests
   - Manually test: Force locale to 'fr', complete full workflow
   - Verify: Zero English text visible, correct French formatting
5. **Deploy/Demo MVP**: Application works completely in French

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (French UI) → Test independently → **Deploy/Demo MVP!**
3. Add User Story 2 (German UI) → Test independently → Deploy/Demo (bilingual app)
4. Add User Story 3 (Language Selector) → Test independently → Deploy/Demo (full i18n)
5. Complete Polish phase → Production ready

### Parallel Team Strategy

With 2 developers:

1. Both complete Setup + Foundational together
2. Once Foundational is done:
   - **Developer A**: User Story 1 (French UI) - T013 through T031
   - **Developer B**: User Story 2 (German UI) - T032 through T039
3. After US1 and US2 complete:
   - Either developer: User Story 3 (Language Selector) - T040 through T050
4. Both: Polish & validation together

**Time Savings**: US1 and US2 can be done simultaneously, cutting development time significantly.

---

## Task Count Summary

- **Phase 1 (Setup)**: 4 tasks
- **Phase 2 (Foundational)**: 8 tasks (blocks all stories)
- **Phase 3 (US1 - French UI)**: 19 tasks (3 tests + 16 implementation)
- **Phase 4 (US2 - German UI)**: 8 tasks (2 tests + 6 implementation)
- **Phase 5 (US3 - Language Selector)**: 11 tasks (2 tests + 9 implementation)
- **Phase 6 (Polish)**: 10 tasks

**Total**: 60 tasks

**Parallel Opportunities**: 15+ tasks can run in parallel
**Independent Stories**: US1 and US2 are completely independent and can be developed simultaneously

---

## Notes

- **[P] tasks** = different files, no dependencies, can run simultaneously
- **[Story] label** maps task to specific user story for traceability
- **TDD enforced**: Tests written first, must fail before implementation (per constitution)
- **Each user story independently testable**: Can validate French UI without German, etc.
- **Commit after each task** or logical group for clean history
- **Stop at any checkpoint** to validate story independently before proceeding
- **Professional translation review** (T059) critical before production release
- **Translation quality** affects user satisfaction - native speaker review mandatory

---

## Constitution Compliance

✓ **Test-First Development (II)**: All tests written before implementation, RED-GREEN-REFACTOR cycle enforced
✓ **Privacy-First (I)**: No network calls, local JSON only
✓ **Security (IV)**: Context isolation maintained, input validation on all locale parameters
✓ **No violations**: All tasks comply with constitution principles
