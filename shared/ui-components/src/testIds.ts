/**
 * Shared test IDs for UI components and E2E tests.
 *
 * Using these constants ensures consistency between:
 * - UI component `testId` props
 * - E2E test selectors
 * - Manual data-testid attributes in HTML
 *
 * @example
 * ```typescript
 * // In UI component
 * import { TEST_IDS } from 'shared/ui-components';
 * Button({ testId: TEST_IDS.BUTTON.PROCESS });
 *
 * // In E2E test
 * import { TEST_IDS } from 'shared/ui-components';
 * page.locator(`[data-testid="${TEST_IDS.BUTTON.PROCESS}"]`);
 * ```
 */

/**
 * Header and navigation test IDs
 */
export const HEADER_TEST_IDS = {
  APP_HEADER: 'app-header',
  APP_TITLE: 'app-title',
  PRIVACY_BADGE: 'privacy-badge',
  REVIEW_HEADER: 'review-header',
  FEEDBACK_BTN: 'feedback-btn',
  FOOTER: 'footer',
  VERSION_INFO: 'version-info',
} as const;

/**
 * Model loading test IDs
 */
export const MODEL_TEST_IDS = {
  STATUS: 'model-status',
  PROGRESS: 'model-progress',
  PROGRESS_TEXT: 'model-progress-text',
} as const;

/**
 * Upload section test IDs
 */
export const UPLOAD_TEST_IDS = {
  SECTION: 'upload-section',
  ZONE: 'upload-zone',
  FILE_INPUT: 'file-input',
  FILE_LIST: 'file-list',
  FILES_CONTAINER: 'files-container',
  FILE_ITEM: 'file-item',
  FILE_ITEM_NAME: 'file-item-name',
  FILE_ITEM_SIZE: 'file-item-size',
  FILE_ITEM_REMOVE: 'file-item-remove',
} as const;

/**
 * Processing section test IDs
 */
export const PROCESSING_TEST_IDS = {
  STATUS: 'processing-status',
  CONTAINER: 'processing-container',
} as const;

/**
 * Results section test IDs (legacy batch mode)
 */
export const RESULTS_TEST_IDS = {
  SECTION: 'results-section',
  CONTAINER: 'results-container',
  DOWNLOAD_ALL_BTN: 'download-all-btn',
  PII_SUMMARY: 'pii-summary',
  PII_STATS: 'pii-stats',
} as const;

/**
 * Review section test IDs (entity review flow)
 */
export const REVIEW_TEST_IDS = {
  SECTION: 'review-section',
  CONTAINER: 'review-container',
  TITLE: 'review-title',
  CURRENT_FILE_NAME: 'current-file-name',
  DETECTION_STATUS: 'detection-status',
  BACK_BTN: 'back-btn',
  DOWNLOAD_BTN: 'download-btn',
} as const;

/**
 * Button test IDs
 */
export const BUTTON_TEST_IDS = {
  PROCESS: 'process-btn',
  BACK: 'back-btn',
  DOWNLOAD: 'download-btn',
  DOWNLOAD_ALL: 'download-all-btn',
  FEEDBACK: 'feedback-btn',
} as const;

/**
 * Entity type badge test IDs
 */
export const ENTITY_BADGE_TEST_IDS = {
  PERSON: 'entity-badge-person',
  ORGANIZATION: 'entity-badge-organization',
  ADDRESS: 'entity-badge-address',
  EMAIL: 'entity-badge-email',
  PHONE: 'entity-badge-phone',
  DATE: 'entity-badge-date',
  IBAN: 'entity-badge-iban',
  AVS: 'entity-badge-avs',
  POSTAL: 'entity-badge-postal',
  URL: 'entity-badge-url',
} as const;

/**
 * Card component test IDs
 */
export const CARD_TEST_IDS = {
  RESULT_CARD: 'result-card',
  ENTITY_CARD: 'entity-card',
  FILE_CARD: 'file-card',
  CARD_HEADER: 'card-header',
  CARD_CONTENT: 'card-content',
  CARD_FOOTER: 'card-footer',
} as const;

/**
 * Form field test IDs
 */
export const FORM_TEST_IDS = {
  INPUT_FIELD: 'input-field',
  CHECKBOX_FIELD: 'checkbox-field',
  TOGGLE_FIELD: 'toggle-field',
  SEARCH_INPUT: 'search-input',
  FILTER_INPUT: 'filter-input',
} as const;

/**
 * Modal test IDs
 */
export const MODAL_TEST_IDS = {
  ACCURACY_MODAL: 'accuracy-modal',
  DOWNLOAD_MODAL: 'download-modal',
  SETTINGS_MODAL: 'settings-modal',
  CONFIRM_MODAL: 'confirm-modal',
} as const;

/**
 * Combined test IDs object for convenient access
 */
export const TEST_IDS = {
  HEADER: HEADER_TEST_IDS,
  MODEL: MODEL_TEST_IDS,
  UPLOAD: UPLOAD_TEST_IDS,
  PROCESSING: PROCESSING_TEST_IDS,
  RESULTS: RESULTS_TEST_IDS,
  REVIEW: REVIEW_TEST_IDS,
  BUTTON: BUTTON_TEST_IDS,
  ENTITY_BADGE: ENTITY_BADGE_TEST_IDS,
  CARD: CARD_TEST_IDS,
  FORM: FORM_TEST_IDS,
  MODAL: MODAL_TEST_IDS,
} as const;

/**
 * Helper to create a data-testid selector string
 */
export function testIdSelector(testId: string): string {
  return `[data-testid="${testId}"]`;
}

/**
 * Type for all test IDs
 */
export type TestIdKey = keyof typeof TEST_IDS;
export type TestIdValue<K extends TestIdKey> = (typeof TEST_IDS)[K][keyof (typeof TEST_IDS)[K]];
