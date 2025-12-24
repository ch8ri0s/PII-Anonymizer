/**
 * Review UI Module
 *
 * Handles the entity review section: header, status, download button,
 * and integration with EntityReviewController.
 */

import type { EntityWithSelection } from '../components/EntitySidebar';
import {
  initEntityReviewController,
  loadDocument,
  getPreviewSelectedEntities,
  getPreviewAllEntities,
  destroyEntityReviewController,
  type ReviewCallbacks,
} from '../components';
import { downloadZip } from '../utils/download';

export interface ReviewUIConfig {
  onBack?: () => void;
  onAnonymizeComplete?: (content: string, mapping: string) => void;
}

// Module state
let config: ReviewUIConfig = {};
let currentFileName = '';
let originalContent = '';
let isInitialized = false;

// DOM Elements
let reviewSection: HTMLElement | null = null;
let reviewContainer: HTMLElement | null = null;
let backButton: HTMLElement | null = null;
let fileNameEl: HTMLElement | null = null;
let detectionStatusEl: HTMLElement | null = null;
let downloadBtn: HTMLButtonElement | null = null;

/**
 * Initialize the review UI
 */
export function initReviewUI(reviewConfig: ReviewUIConfig = {}): void {
  config = reviewConfig;

  // Get DOM elements
  reviewSection = document.getElementById('review-section');
  reviewContainer = document.getElementById('review-container');
  backButton = document.getElementById('back-to-upload-btn');
  fileNameEl = document.getElementById('current-file-name');
  detectionStatusEl = document.getElementById('detection-status');
  downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;

  if (!reviewSection || !reviewContainer) {
    console.error('[ReviewUI] Required elements not found');
    return;
  }

  setupEventHandlers();
}

/**
 * Setup event handlers
 */
function setupEventHandlers(): void {
  // Back button
  backButton?.addEventListener('click', () => {
    hideReviewSection();
    config.onBack?.();
  });

  // Download button
  downloadBtn?.addEventListener('click', handleDownload);
}

/**
 * Show review section and start processing a file
 */
export async function startReview(
  fileName: string,
  content: string,
): Promise<void> {
  if (!reviewSection || !reviewContainer) return;

  currentFileName = fileName;
  originalContent = content;

  // Show review section
  reviewSection.classList.remove('hidden');

  // Update header
  if (fileNameEl) {
    fileNameEl.textContent = fileName;
  }

  // Reset status
  updateDetectionStatus('detecting', 'Initializing...');

  // Hide download button until detection completes
  if (downloadBtn) {
    downloadBtn.classList.add('hidden');
    downloadBtn.disabled = true;
  }

  // Initialize entity review controller
  const reviewCallbacks: ReviewCallbacks = {
    onDetectionStart: () => {
      updateDetectionStatus('detecting', 'Analyzing document...');
    },
    onDetectionProgress: (progress, stage) => {
      updateDetectionStatus('detecting', `${stage} (${Math.round(progress)}%)`);
    },
    onDetectionComplete: (entities) => {
      updateDetectionStatus('complete', `${entities.length} entities found`);
      if (downloadBtn) {
        downloadBtn.classList.remove('hidden');
        downloadBtn.disabled = false;
      }
    },
    onDetectionError: (error) => {
      updateDetectionStatus('error', error.message);
    },
    onAnonymize: (selectedEntities) => {
      performAnonymization(selectedEntities);
    },
  };

  // Destroy previous instance if exists
  if (isInitialized) {
    destroyEntityReviewController();
  }

  initEntityReviewController(reviewContainer, reviewCallbacks);
  isInitialized = true;

  // Load document for PII detection
  try {
    await loadDocument(content, {}, fileName);
  } catch (error) {
    console.error('[ReviewUI] Error loading document:', error);
    updateDetectionStatus('error', (error as Error).message);
  }
}

/**
 * Update detection status badge
 */
export function updateDetectionStatus(
  status: 'detecting' | 'complete' | 'error',
  message?: string,
): void {
  if (!detectionStatusEl) return;

  const spinner = `
    <svg class="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  `;

  const checkIcon = `
    <svg class="w-4 h-4 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
    </svg>
  `;

  const errorIcon = `
    <svg class="w-4 h-4 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
  `;

  switch (status) {
    case 'detecting':
      detectionStatusEl.className = 'detection-badge detecting';
      detectionStatusEl.innerHTML = `${spinner}${message || 'Detecting...'}`;
      break;
    case 'complete':
      detectionStatusEl.className = 'detection-badge complete';
      detectionStatusEl.innerHTML = `${checkIcon}${message || 'Complete'}`;
      break;
    case 'error':
      detectionStatusEl.className = 'detection-badge error';
      detectionStatusEl.innerHTML = `${errorIcon}${message || 'Error'}`;
      break;
  }
}

/**
 * Perform anonymization on selected entities
 */
function performAnonymization(selectedEntities: EntityWithSelection[]): void {
  const anonymized = applyAnonymization(originalContent, selectedEntities);
  const mapping = generateMappingMarkdown(currentFileName, selectedEntities);

  updateDetectionStatus('complete', `Anonymized ${selectedEntities.length} entities`);

  config.onAnonymizeComplete?.(anonymized, mapping);
}

/**
 * Handle download button click
 */
function handleDownload(): void {
  const selectedEntities = getPreviewSelectedEntities();
  const allEntities = getPreviewAllEntities();

  // Apply anonymization
  const anonymizedContent = applyAnonymization(originalContent, selectedEntities);
  const mappingContent = generateMappingMarkdown(currentFileName, selectedEntities, allEntities);

  // Generate filenames
  const baseName = currentFileName.replace(/\.[^.]+$/, '');
  const anonymizedFilename = `${baseName}_anonymized.md`;
  const mappingFilename = `${baseName}_mapping.md`;

  // Download files
  const files = new Map<string, string>();
  files.set(anonymizedFilename, anonymizedContent);
  files.set(mappingFilename, mappingContent);

  void downloadZip(files, `${baseName}_anonymized.zip`).catch((error: Error) => {
    console.error('[ReviewUI] Failed to download files:', error);
  });
}

/**
 * Apply anonymization to content
 */
function applyAnonymization(
  content: string,
  entities: EntityWithSelection[],
): string {
  // Sort entities by position (descending) to replace from end to start
  const sortedEntities = [...entities].sort((a, b) => b.start - a.start);

  let result = content;
  for (const entity of sortedEntities) {
    const replacement = generateReplacement(entity.type);
    result = result.slice(0, entity.start) + replacement + result.slice(entity.end);
  }

  return result;
}

/**
 * Generate replacement text for PII type
 */
function generateReplacement(type: string): string {
  const typeMap: Record<string, string> = {
    PERSON: '[PERSON]',
    ORGANIZATION: '[ORG]',
    ORG: '[ORG]',
    ADDRESS: '[ADDRESS]',
    EMAIL: '[EMAIL]',
    PHONE: '[PHONE]',
    DATE: '[DATE]',
    MONEY: '[MONEY]',
    IBAN: '[IBAN]',
    SSN: '[SSN]',
    PASSPORT: '[PASSPORT]',
    LICENSE: '[LICENSE]',
    CREDIT_CARD: '[CC]',
    IP_ADDRESS: '[IP]',
    URL: '[URL]',
  };

  return typeMap[type.toUpperCase()] || '[REDACTED]';
}

/**
 * Generate mapping markdown document
 */
function generateMappingMarkdown(
  filename: string,
  selectedEntities: EntityWithSelection[],
  allEntities?: EntityWithSelection[],
): string {
  const all = allEntities || selectedEntities;

  const lines = [
    `# PII Mapping: ${filename}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Anonymized PII',
    '',
  ];

  if (selectedEntities.length === 0) {
    lines.push('No PII was anonymized in this document.');
  } else {
    lines.push('| Original | Replacement | Type | Confidence |');
    lines.push('| -------- | ----------- | ---- | ---------- |');

    for (const entity of selectedEntities) {
      const escapedOriginal = entity.text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const replacement = generateReplacement(entity.type);
      const confidence = Math.round((entity.confidence || 0) * 100);
      lines.push(`| ${escapedOriginal} | ${replacement} | ${entity.type} | ${confidence}% |`);
    }
  }

  lines.push('');
  lines.push('## Statistics');
  lines.push('');
  lines.push(`- **Total entities detected**: ${all.length}`);
  lines.push(`- **Entities anonymized**: ${selectedEntities.length}`);
  lines.push(`- **Entities skipped**: ${all.length - selectedEntities.length}`);

  // Count by type
  const byType: Record<string, number> = {};
  for (const entity of selectedEntities) {
    byType[entity.type] = (byType[entity.type] || 0) + 1;
  }

  if (Object.keys(byType).length > 0) {
    lines.push('');
    lines.push('### By Type');
    for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
      lines.push(`- **${type}**: ${count}`);
    }
  }

  return lines.join('\n');
}

/**
 * Show the review section
 */
export function showReviewSection(): void {
  reviewSection?.classList.remove('hidden');
}

/**
 * Hide the review section
 */
export function hideReviewSection(): void {
  reviewSection?.classList.add('hidden');

  if (isInitialized) {
    destroyEntityReviewController();
    isInitialized = false;
  }
}

/**
 * Check if review is active
 */
export function isReviewActive(): boolean {
  return isInitialized && !reviewSection?.classList.contains('hidden');
}

/**
 * Clean up resources
 */
export function destroyReviewUI(): void {
  if (isInitialized) {
    destroyEntityReviewController();
    isInitialized = false;
  }
  currentFileName = '';
  originalContent = '';
}
