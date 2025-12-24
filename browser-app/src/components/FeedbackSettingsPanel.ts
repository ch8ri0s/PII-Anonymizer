/**
 * Feedback Settings Panel Component
 *
 * Story 7.8: User Correction Feedback Logging
 * AC #4: User can enable/disable feedback logging via settings toggle
 *
 * Displays a settings panel for controlling feedback logging with:
 * - Toggle switch for enabling/disabling logging
 * - Privacy information tooltip
 * - Optional correction count display
 */

import {
  isEnabled,
  setEnabled,
  isAvailable,
  getStatistics,
} from '../services/FeedbackLogger';
import type { FeedbackStatistics } from '../types/feedback';

// Module state
let panelElement: HTMLElement | null = null;
let onChangeCallback: ((enabled: boolean) => void) | null = null;

/**
 * CSS for the feedback settings panel
 */
const FEEDBACK_SETTINGS_CSS = `
  .feedback-settings-panel {
    padding: 1rem;
    background: hsl(0 0% 100%);
    border: 1px solid hsl(0 0% 89.8%);
    border-radius: 0.5rem;
  }

  .feedback-settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .feedback-settings-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: hsl(0 0% 9%);
  }

  .feedback-settings-title svg {
    width: 1rem;
    height: 1rem;
    color: hsl(0 0% 45.1%);
  }

  .feedback-settings-toggle {
    position: relative;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
  }

  .feedback-settings-toggle input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .feedback-settings-toggle-track {
    width: 2.5rem;
    height: 1.25rem;
    background: hsl(0 0% 79.8%);
    border-radius: 9999px;
    transition: background-color 0.2s ease;
  }

  .feedback-settings-toggle input:checked + .feedback-settings-toggle-track {
    background: hsl(142.1 76.2% 36.3%);
  }

  .feedback-settings-toggle input:disabled + .feedback-settings-toggle-track {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .feedback-settings-toggle-thumb {
    position: absolute;
    top: 0.125rem;
    left: 0.125rem;
    width: 1rem;
    height: 1rem;
    background: hsl(0 0% 100%);
    border-radius: 9999px;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
    transition: transform 0.2s ease;
  }

  .feedback-settings-toggle input:checked ~ .feedback-settings-toggle-thumb {
    transform: translateX(1.25rem);
  }

  .feedback-settings-description {
    font-size: 0.75rem;
    color: hsl(0 0% 45.1%);
    line-height: 1.5;
    margin-bottom: 0.75rem;
  }

  .feedback-settings-stats {
    display: flex;
    gap: 1rem;
    padding: 0.625rem 0.75rem;
    background: hsl(0 0% 98%);
    border-radius: 0.375rem;
    font-size: 0.75rem;
  }

  .feedback-settings-stat {
    display: flex;
    flex-direction: column;
  }

  .feedback-settings-stat-label {
    color: hsl(0 0% 45.1%);
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .feedback-settings-stat-value {
    font-weight: 600;
    color: hsl(0 0% 9%);
  }

  .feedback-settings-unavailable {
    padding: 0.625rem 0.75rem;
    background: hsl(45.4 93.4% 47.5% / 0.1);
    border: 1px solid hsl(45.4 93.4% 47.5% / 0.3);
    border-radius: 0.375rem;
    font-size: 0.75rem;
    color: hsl(45.4 93.4% 35%);
  }

  .feedback-settings-privacy {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    margin-top: 0.75rem;
    background: hsl(217.2 91.2% 59.8% / 0.1);
    border-radius: 0.375rem;
    font-size: 0.6875rem;
    color: hsl(217.2 91.2% 45%);
  }

  .feedback-settings-privacy svg {
    flex-shrink: 0;
    width: 0.875rem;
    height: 0.875rem;
    margin-top: 0.0625rem;
  }
`;

/**
 * Inject CSS styles
 */
function injectStyles(): void {
  if (!document.getElementById('feedback-settings-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'feedback-settings-styles';
    styleSheet.textContent = FEEDBACK_SETTINGS_CSS;
    document.head.appendChild(styleSheet);
  }
}

/**
 * Render the settings panel
 */
async function render(): Promise<void> {
  if (!panelElement) return;

  const available = isAvailable();
  const enabled = isEnabled();
  let stats: FeedbackStatistics | null = null;

  if (available && enabled) {
    try {
      stats = await getStatistics();
    } catch {
      stats = null;
    }
  }

  const shieldIcon = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>';

  const infoIcon = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>';

  let statsHtml = '';
  if (stats && stats.totalCorrections > 0) {
    statsHtml = `
      <div class="feedback-settings-stats">
        <div class="feedback-settings-stat">
          <span class="feedback-settings-stat-label">Total</span>
          <span class="feedback-settings-stat-value">${stats.totalCorrections}</span>
        </div>
        <div class="feedback-settings-stat">
          <span class="feedback-settings-stat-label">Dismissed</span>
          <span class="feedback-settings-stat-value">${stats.byAction.DISMISS}</span>
        </div>
        <div class="feedback-settings-stat">
          <span class="feedback-settings-stat-label">Added</span>
          <span class="feedback-settings-stat-value">${stats.byAction.ADD}</span>
        </div>
      </div>
    `;
  }

  let unavailableHtml = '';
  if (!available) {
    unavailableHtml = `
      <div class="feedback-settings-unavailable">
        Storage unavailable in private browsing mode. Feedback logging will be skipped.
      </div>
    `;
  }

  panelElement.innerHTML = `
    <div class="feedback-settings-panel">
      <div class="feedback-settings-header">
        <span class="feedback-settings-title">
          ${shieldIcon}
          Feedback Logging
        </span>
        <label class="feedback-settings-toggle">
          <input type="checkbox"
                 id="feedback-toggle"
                 ${enabled ? 'checked' : ''}
                 ${!available ? 'disabled' : ''}>
          <div class="feedback-settings-toggle-track"></div>
          <div class="feedback-settings-toggle-thumb"></div>
        </label>
      </div>

      <p class="feedback-settings-description">
        When enabled, your corrections (dismissed and manually added entities)
        are stored locally to help improve detection accuracy. No data is
        sent to any server.
      </p>

      ${unavailableHtml}
      ${statsHtml}

      <div class="feedback-settings-privacy">
        ${infoIcon}
        <span>
          <strong>Privacy:</strong> All logged data is anonymized before storage.
          Actual PII text is replaced with type markers (e.g., "[PERSON]").
          Document filenames are hashed. Logs are automatically rotated monthly.
        </span>
      </div>
    </div>
  `;

  // Attach event listener
  const toggle = panelElement.querySelector('#feedback-toggle') as HTMLInputElement;
  if (toggle) {
    toggle.addEventListener('change', handleToggle);
  }
}

/**
 * Handle toggle change
 */
function handleToggle(event: Event): void {
  const target = event.target as HTMLInputElement;
  const newEnabled = target.checked;

  setEnabled(newEnabled);
  onChangeCallback?.(newEnabled);

  // Re-render to update stats display
  void render();
}

/**
 * Initialize the feedback settings panel
 *
 * @param container The container element to render the panel in
 * @param onChange Optional callback when settings change
 */
export function initFeedbackSettingsPanel(
  container: HTMLElement,
  onChange?: (enabled: boolean) => void,
): void {
  panelElement = container;
  onChangeCallback = onChange || null;

  injectStyles();
  void render();
}

/**
 * Update the panel (e.g., after external settings change)
 */
export function updateFeedbackSettingsPanel(): void {
  void render();
}

/**
 * Destroy the feedback settings panel
 */
export function destroyFeedbackSettingsPanel(): void {
  if (panelElement) {
    panelElement.innerHTML = '';
  }
  panelElement = null;
  onChangeCallback = null;
}

/**
 * Get a compact toggle for embedding in other UI
 *
 * @param onChange Callback when toggle changes
 * @returns HTML element containing the toggle
 */
export function createCompactFeedbackToggle(
  onChange?: (enabled: boolean) => void,
): HTMLElement {
  injectStyles();

  const available = isAvailable();
  const enabled = isEnabled();

  const container = document.createElement('div');
  container.innerHTML = `
    <label class="feedback-settings-toggle" title="${available ? 'Toggle feedback logging' : 'Unavailable in private browsing'}">
      <input type="checkbox"
             ${enabled ? 'checked' : ''}
             ${!available ? 'disabled' : ''}>
      <div class="feedback-settings-toggle-track"></div>
      <div class="feedback-settings-toggle-thumb"></div>
    </label>
  `;

  const input = container.querySelector('input') as HTMLInputElement;
  if (input) {
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      setEnabled(target.checked);
      onChange?.(target.checked);
    });
  }

  return container.firstElementChild as HTMLElement;
}
