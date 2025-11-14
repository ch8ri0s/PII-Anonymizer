# Feature Specification: French and German Internationalization Support

**Feature Branch**: `002-fr-de-i18n`
**Created**: 2025-11-11
**Status**: Draft
**Input**: User description: "add FR / DE i18n support"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - French User Interface (Priority: P1)

A French-speaking user wants to use the PII Anonymiser application in their native language. They open the application and see all user interface elements (buttons, labels, messages, tooltips) displayed in French. They can upload documents, process files, and download results with all instructions and feedback in French.

**Why this priority**: This is the most critical story as it delivers immediate value to French-speaking users and validates the entire i18n infrastructure. Without this foundation, no other language support is possible.

**Independent Test**: Can be fully tested by changing the language preference to French and verifying all UI elements are translated. Delivers complete French language experience independently.

**Acceptance Scenarios**:

1. **Given** a user with French language preference, **When** they launch the application, **Then** all UI text (buttons, labels, headers, footer) appears in French
2. **Given** a French language user, **When** they upload a file, **Then** all status messages, errors, and processing feedback appear in French
3. **Given** a French language user, **When** they view file metadata, **Then** all labels (Type, Size, Last Modified, etc.) display in French
4. **Given** a French language user, **When** they view the results tabs, **Then** tab labels ("Sanitized Markdown", "Change Mapping") appear in French
5. **Given** a French language user, **When** an error occurs, **Then** error messages display in French with culturally appropriate phrasing

---

### User Story 2 - German User Interface (Priority: P2)

A German-speaking user wants to use the PII Anonymiser application in their native language. They open the application and see all user interface elements displayed in German. They can upload documents, process files, and download results with all instructions and feedback in German.

**Why this priority**: Extends language support to German-speaking users, leveraging the i18n infrastructure from P1. This validates the multi-language capability and serves a second major European market.

**Independent Test**: Can be fully tested by changing the language preference to German and verifying all UI elements are translated. Delivers complete German language experience independently.

**Acceptance Scenarios**:

1. **Given** a user with German language preference, **When** they launch the application, **Then** all UI text appears in German
2. **Given** a German language user, **When** they interact with the application, **Then** all messages and feedback appear in German
3. **Given** a German language user, **When** they view file type badges, **Then** document types display German labels (e.g., "PDF-Dokument", "Word-Dokument", "Excel-Tabelle")

---

### User Story 3 - Language Selection (Priority: P3)

A user wants to manually change the application language regardless of their system preferences. They access a language selector in the application interface and choose between English, French, or German. The application immediately updates all text to the selected language without requiring a restart.

**Why this priority**: Provides flexibility for users who want to override system defaults or need to switch languages (e.g., bilingual users, shared computers). This is lower priority as most users will rely on automatic language detection.

**Independent Test**: Can be tested by toggling the language selector and observing immediate UI updates. Delivers user control over language preference independently.

**Acceptance Scenarios**:

1. **Given** a user on the main screen, **When** they click the language selector, **Then** they see options for English, French, and German
2. **Given** a user viewing the application in English, **When** they select French from the language selector, **Then** all UI text immediately changes to French without page refresh
3. **Given** a user's selected language preference, **When** they close and reopen the application, **Then** the application remembers and displays their chosen language

---

### Edge Cases

- What happens when a translation string is missing for a specific language? (Fallback to English)
- How does the system handle language switching while a file is being processed? (Processing continues, UI updates immediately)
- What happens when user's system language is set to an unsupported language (e.g., Spanish)? (Default to English)
- How are file size units (KB, MB, GB) displayed in different languages? (Use localized number formatting and units)
- How are dates and times formatted in different languages? (Use locale-specific date/time formats - DD/MM/YYYY for FR/DE, MM/DD/YYYY for EN-US)
- What happens when the download file has a very long translated filename? (Truncate or sanitize while preserving meaning)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST detect user's operating system language preference at application launch
- **FR-002**: System MUST display all user interface text in the user's selected language (English, French, or German)
- **FR-003**: System MUST provide complete French translations for all UI elements including:
  - Application title and subtitle
  - File upload interface (drag & drop zone, browse button, supported formats)
  - File metadata panel (labels for filename, type, size, last modified)
  - Processing interface (status messages, buttons, tabs)
  - Download buttons and success messages
  - Error messages and warnings
  - Footer information
- **FR-004**: System MUST provide complete German translations for all UI elements (same scope as FR-003)
- **FR-005**: System MUST fall back to English for any missing translation strings
- **FR-006**: System MUST provide a language selector UI component allowing users to manually choose between English, French, and German
- **FR-007**: System MUST persist user's language preference across application sessions
- **FR-008**: System MUST update all visible UI text immediately when user changes language (no restart required)
- **FR-009**: System MUST format dates and times according to the selected language's locale conventions
- **FR-010**: System MUST format numbers (file sizes, counts) according to the selected language's locale conventions
- **FR-011**: System MUST translate file type badges (PDF Document, Word Document, Excel Spreadsheet, CSV File, Text File) into French and German
- **FR-012**: System MUST translate entity type labels in the change mapping (Person, Location, Organization, Phone, Email, etc.) into French and German
- **FR-013**: System MUST maintain English as the default language for unsupported system locales

### Key Entities

- **Translation String**: Represents a translatable text element with keys for English, French, and German text variants
- **Language Preference**: Represents user's chosen language (en, fr, de) stored persistently
- **Locale Configuration**: Represents language-specific formatting rules for dates, times, and numbers

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of user-visible text has translations for French and German (verified by translation coverage audit)
- **SC-002**: Language switching occurs instantly (under 100ms) without application restart or page reload
- **SC-003**: User's language preference persists correctly across 100% of application sessions (tested over 10+ session cycles)
- **SC-004**: Date and time formats display correctly for each language's locale conventions (verified against CLDR standards)
- **SC-005**: French and German-speaking users can complete the entire workflow (upload → process → download) without encountering English text (measured through user testing)
- **SC-006**: Application defaults to correct language based on system locale for 95% of users (verified through OS language detection testing)
- **SC-007**: No untranslated strings appear in production for supported languages (zero tolerance for missing translations)

## Assumptions

1. **Translation Quality**: Translations will be provided by native speakers or professional translation services to ensure accuracy and cultural appropriateness
2. **Language Detection**: Operating system language preference can be reliably detected using Electron's `app.getLocale()` API
3. **Storage**: Language preference can be stored in Electron's local storage or user preferences file
4. **Supported Locales**: Only French (fr-FR) and German (de-DE) variants are needed initially; Swiss French (fr-CH) and Swiss German (de-CH) can use the same translations
5. **Content Scope**: Only UI text needs translation; document content and PII entity types in processed files remain in their original language
6. **Fallback Strategy**: English is acceptable as fallback for any missing translations during development
7. **Right-to-Left Languages**: Not supported in this phase (Arabic, Hebrew excluded)
8. **Number Formatting**: Standard Unicode CLDR formatting rules apply (1.234,56 for FR/DE, 1,234.56 for EN)

## Dependencies

- User interface must be refactored to support dynamic text replacement (if not already implemented)
- All hardcoded UI strings must be extracted into a centralized translation management system
- No external translation services or APIs required (translations managed locally)

## Out of Scope

- Translation of document content being processed (only UI translation)
- Support for additional languages beyond French and German in this phase
- Automatic language detection from document content
- Translation of generated markdown or mapping JSON files
- Translation of error logs or console messages (developer-facing)
- Support for right-to-left (RTL) languages
- Pluralization rules for complex grammatical cases (can be added if needed)
- Translation of the application name "PII Anonymiser"
