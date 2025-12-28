/**
 * Preview Header Component
 *
 * Header bar for the preview panel with copy and download actions.
 * Uses shadcn-inspired design system.
 */

import { downloadFile } from '../../utils/download';
import { copyToClipboard, generateMappingMarkdown, applyAnonymization } from './AnonymizationEngine';
import type { EntityWithSelection } from '../EntitySidebar';

/**
 * Get anonymized base name from filename.
 * Shows first 2 chars + last 2 chars of the base name.
 * Example: "invoice_2024.pdf" -> "in24"
 *
 * @param fileName - Original filename
 * @returns Anonymized base name (without extension)
 */
function getAnonymizedBaseName(fileName: string): string {
  // Extract base name (without extension)
  const lastDotIndex = fileName.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0;
  const baseName = hasExtension ? fileName.slice(0, lastDotIndex) : fileName;

  // Handle very short base names - use as-is
  if (baseName.length <= 4) {
    return baseName;
  }

  // Get first 2 and last 2 characters
  const first = baseName.slice(0, 2);
  const last = baseName.slice(-2);

  return `${first}${last}`;
}

/**
 * Anonymize a filename for display while preserving recognizability.
 * Shows first 2 chars + "..." + last 2 chars + original extension + ".md"
 * Example: "invoice_2024.pdf" -> "in...24.pdf.md"
 *
 * @param fileName - Original filename
 * @returns Anonymized display name
 */
function anonymizeFileName(fileName: string): string {
  // Extract base name and extension
  const lastDotIndex = fileName.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0;
  const baseName = hasExtension ? fileName.slice(0, lastDotIndex) : fileName;
  const extension = hasExtension ? fileName.slice(lastDotIndex) : '';

  // Handle very short base names
  if (baseName.length <= 4) {
    return `${baseName}${extension}.md`;
  }

  // Get first 2 and last 2 characters
  const first = baseName.slice(0, 2);
  const last = baseName.slice(-2);

  return `${first}...${last}${extension}.md`;
}

/**
 * Header configuration
 */
export interface PreviewHeaderConfig {
  onCopySuccess?: () => void;
  onCopyError?: () => void;
  onDownloadMd?: () => void;
  onDownloadMapping?: () => void;
}

/**
 * Header state
 */
interface PreviewHeaderState {
  fileName: string;
  originalContent: string;
  entities: EntityWithSelection[];
}

// Module state
let state: PreviewHeaderState = {
  fileName: '',
  originalContent: '',
  entities: [],
};

let config: PreviewHeaderConfig = {};
let headerElement: HTMLElement | null = null;
let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * CSS for the preview header
 */
const PREVIEW_HEADER_CSS = `
  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: hsl(0 0% 98%);
    border-bottom: 1px solid hsl(0 0% 89.8%);
    gap: 0.5rem;
  }

  .preview-header-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: hsl(0 0% 9%);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    flex: 1;
  }

  .preview-header-title .file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .preview-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .preview-header-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 0.375rem;
    border: 1px solid hsl(0 0% 89.8%);
    background: hsl(0 0% 100%);
    color: hsl(0 0% 9%);
    cursor: pointer;
    transition: background-color 0.15s, border-color 0.15s, color 0.15s;
    white-space: nowrap;
  }

  .preview-header-btn:hover {
    background: hsl(0 0% 96.1%);
    border-color: hsl(0 0% 79.8%);
  }

  .preview-header-btn:active {
    background: hsl(0 0% 93%);
  }

  .preview-header-btn:focus-visible {
    outline: 2px solid hsl(222.2 47.4% 51.2%);
    outline-offset: 2px;
  }

  .preview-header-btn.primary {
    background: hsl(222.2 47.4% 11.2%);
    color: hsl(0 0% 98%);
    border-color: hsl(222.2 47.4% 11.2%);
  }

  .preview-header-btn.primary:hover {
    background: hsl(222.2 47.4% 20%);
  }

  .preview-header-btn .icon {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }

  .preview-header-btn.copy-success {
    background: hsl(142.1 76.2% 36.3%);
    border-color: hsl(142.1 76.2% 36.3%);
    color: white;
  }

  .preview-header-btn.copy-error {
    background: hsl(0 84.2% 60.2%);
    border-color: hsl(0 84.2% 60.2%);
    color: white;
  }

  .preview-header-divider {
    width: 1px;
    height: 1.5rem;
    background: hsl(0 0% 89.8%);
    margin: 0 0.25rem;
  }

  @media (max-width: 640px) {
    .preview-header {
      flex-wrap: wrap;
      gap: 0.75rem;
    }

    .preview-header-title {
      flex-basis: 100%;
    }

    .preview-header-actions {
      flex-basis: 100%;
      justify-content: flex-end;
    }

    .preview-header-btn .btn-text {
      display: none;
    }

    .preview-header-btn {
      padding: 0.5rem;
    }
  }
`;

/**
 * Icon SVGs
 */
const ICONS = {
  download: '<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>',
  map: '<svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>',
};

/**
 * Inject CSS styles
 */
function injectStyles(): void {
  if (!document.getElementById('preview-header-styles')) {
    const styleSheet = document.createElement('style');
    styleSheet.id = 'preview-header-styles';
    styleSheet.textContent = PREVIEW_HEADER_CSS;
    document.head.appendChild(styleSheet);
  }
}

/**
 * Initialize the preview header
 */
export function initPreviewHeader(
  container: HTMLElement,
  headerConfig: PreviewHeaderConfig = {},
): void {
  config = headerConfig;
  injectStyles();

  // Create header element
  headerElement = document.createElement('div');
  headerElement.className = 'preview-header';
  headerElement.innerHTML = `
    <div class="preview-header-title">
      <span class="file-name">document.md</span>
    </div>
    <div class="preview-header-actions">
      <button class="preview-header-btn" id="copy-btn" title="Copy anonymized content">
        <span class="btn-text">Copy</span>
      </button>
      <div class="preview-header-divider"></div>
      <button class="preview-header-btn" id="download-md-btn" title="Download anonymized markdown">
        ${ICONS.download}
        <span class="btn-text">Download MD</span>
      </button>
      <button class="preview-header-btn" id="download-map-btn" title="Download mapping file">
        ${ICONS.map}
        <span class="btn-text">Mapping</span>
      </button>
    </div>
  `;

  container.prepend(headerElement);

  // Setup event handlers
  const copyBtn = headerElement.querySelector('#copy-btn');
  const downloadMdBtn = headerElement.querySelector('#download-md-btn');
  const downloadMapBtn = headerElement.querySelector('#download-map-btn');

  copyBtn?.addEventListener('click', () => void handleCopy());
  downloadMdBtn?.addEventListener('click', handleDownloadMd);
  downloadMapBtn?.addEventListener('click', handleDownloadMapping);
}

/**
 * Update header with file info
 */
export function setHeaderFile(fileName: string, content: string): void {
  state.fileName = fileName;
  state.originalContent = content;

  if (headerElement) {
    const fileNameEl = headerElement.querySelector('.file-name');
    if (fileNameEl) {
      // Display anonymized filename to avoid showing PII in the filename
      const displayName = anonymizeFileName(fileName);
      fileNameEl.textContent = displayName;
      // Store original name in title for reference on hover
      (fileNameEl as HTMLElement).title = `Output from: ${fileName}`;
    }
  }
}

/**
 * Update entities for anonymization
 */
export function setHeaderEntities(entities: EntityWithSelection[]): void {
  state.entities = entities;
}

/**
 * Handle copy button click
 */
async function handleCopy(): Promise<void> {
  const anonymizedContent = applyAnonymization(state.originalContent, state.entities);
  const success = await copyToClipboard(anonymizedContent);

  const copyBtn = headerElement?.querySelector('#copy-btn');
  if (copyBtn) {
    if (feedbackTimeout) {
      clearTimeout(feedbackTimeout);
    }

    if (success) {
      copyBtn.classList.add('copy-success');
      copyBtn.innerHTML = '<span class="btn-text">Copied!</span>';
      config.onCopySuccess?.();
    } else {
      copyBtn.classList.add('copy-error');
      copyBtn.innerHTML = '<span class="btn-text">Failed</span>';
      config.onCopyError?.();
    }

    feedbackTimeout = setTimeout(() => {
      copyBtn.classList.remove('copy-success', 'copy-error');
      copyBtn.innerHTML = '<span class="btn-text">Copy</span>';
    }, 2000);
  }
}

/**
 * Handle download MD button click
 */
function handleDownloadMd(): void {
  const anonymizedContent = applyAnonymization(state.originalContent, state.entities);
  const anonBaseName = getAnonymizedBaseName(state.fileName);
  downloadFile(anonymizedContent, `${anonBaseName}_anon.md`);
  config.onDownloadMd?.();
}

/**
 * Handle download mapping button click
 */
function handleDownloadMapping(): void {
  const mappingContent = generateMappingMarkdown(
    state.fileName,
    state.entities.filter(e => e.selected),
    state.entities,
  );
  const anonBaseName = getAnonymizedBaseName(state.fileName);
  downloadFile(mappingContent, `${anonBaseName}_mapping.md`);
  config.onDownloadMapping?.();
}

/**
 * Get the anonymized content
 */
export function getAnonymizedContent(): string {
  return applyAnonymization(state.originalContent, state.entities);
}

/**
 * Destroy the preview header
 */
export function destroyPreviewHeader(): void {
  if (feedbackTimeout) {
    clearTimeout(feedbackTimeout);
    feedbackTimeout = null;
  }

  if (headerElement) {
    headerElement.remove();
    headerElement = null;
  }

  state = {
    fileName: '',
    originalContent: '',
    entities: [],
  };

  config = {};
}
