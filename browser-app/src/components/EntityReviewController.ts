/**
 * Entity Review Controller
 *
 * Orchestrates the integration between PIIDetector and the Preview Panel.
 * Manages the complete entity review workflow including detection,
 * review, selection, and anonymization.
 *
 * Story 7.4: Entity Review UI Implementation - Task 7
 */

import { PIIDetector, type ExtendedPIIMatch, type PipelineDetectionOptions } from '../processing/PIIDetector';
import type { EntityWithSelection } from './EntitySidebar';
import {
  initPreviewPanel,
  setPreviewContent,
  setPreviewEntities,
  getPreviewSelectedEntities,
  getPreviewAllEntities,
  clearPreviewEntities,
  destroyPreviewPanel,
  type PreviewPanelConfig,
} from './PreviewPanel';

/**
 * Review state
 */
export interface ReviewState {
  documentContent: string;
  originalEntities: ExtendedPIIMatch[];
  reviewedEntities: EntityWithSelection[];
  isDetecting: boolean;
  isAnonymizing: boolean;
  error: string | null;
}

/**
 * Review callbacks
 */
export interface ReviewCallbacks {
  /** Called when detection starts */
  onDetectionStart?: () => void;
  /** Called during detection with progress */
  onDetectionProgress?: (progress: number, stage: string) => void;
  /** Called when detection completes */
  onDetectionComplete?: (entities: ExtendedPIIMatch[]) => void;
  /** Called when detection fails */
  onDetectionError?: (error: Error) => void;
  /** Called when user confirms anonymization */
  onAnonymize?: (selectedEntities: EntityWithSelection[]) => void;
  /** Called when entities change (selection, filter, manual add) */
  onEntitiesChange?: (entities: EntityWithSelection[]) => void;
}

// Module state
let detector: PIIDetector | null = null;
let state: ReviewState = {
  documentContent: '',
  originalEntities: [],
  reviewedEntities: [],
  isDetecting: false,
  isAnonymizing: false,
  error: null,
};
let callbacks: ReviewCallbacks = {};

/**
 * Initialize the entity review controller
 */
export function initEntityReviewController(
  container: HTMLElement,
  reviewCallbacks: ReviewCallbacks = {},
): void {
  callbacks = reviewCallbacks;

  // Create detector instance
  detector = new PIIDetector();

  // Initialize preview panel
  const panelConfig: PreviewPanelConfig = {
    onAnonymize: handleAnonymize,
    onEntityChange: handleEntityChange,
    sidebarPosition: 'right',
  };

  initPreviewPanel(container, panelConfig);

  // Reset state
  state = {
    documentContent: '',
    originalEntities: [],
    reviewedEntities: [],
    isDetecting: false,
    isAnonymizing: false,
    error: null,
  };
}

/**
 * Load and detect PII in document content
 */
export async function loadDocument(
  content: string,
  options: PipelineDetectionOptions = {},
  fileName?: string,
): Promise<void> {
  if (!detector) {
    throw new Error('Controller not initialized');
  }

  state.documentContent = content;
  state.isDetecting = true;
  state.error = null;

  callbacks.onDetectionStart?.();
  setPreviewContent(content, fileName);

  try {
    // Initialize pipeline if not already
    await detector.initializePipeline();

    // Run detection with progress callbacks
    const progressCallback = (progress: number, stage: string) => {
      callbacks.onDetectionProgress?.(progress, stage);
    };

    const result = await detector.detectWithPipeline(content, {
      ...options,
      onProgress: progressCallback,
    });

    // Convert detection result entities to ExtendedPIIMatch
    const entities: ExtendedPIIMatch[] = result.entities.map((entity) => ({
      type: entity.type,
      text: entity.text,
      start: entity.start,
      end: entity.end,
      confidence: entity.confidence,
      source: mapDetectionSource(entity.source),
      mlScore: entity.metadata?.mlScore as number | undefined,
      id: entity.id,
    }));

    state.originalEntities = entities;
    state.isDetecting = false;

    // Update preview panel with entities
    setPreviewEntities(entities);

    // Get reviewed entities (with selection state)
    state.reviewedEntities = getPreviewAllEntities();

    callbacks.onDetectionComplete?.(entities);
  } catch (error) {
    state.isDetecting = false;
    state.error = error instanceof Error ? error.message : 'Detection failed';
    callbacks.onDetectionError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Map entity source to ExtendedPIIMatch source
 */
function mapDetectionSource(source?: string): 'ML' | 'REGEX' | 'BOTH' | 'MANUAL' {
  switch (source?.toUpperCase()) {
    case 'ML':
      return 'ML';
    case 'REGEX':
    case 'RULE':
      return 'REGEX';
    case 'BOTH':
      return 'BOTH';
    case 'MANUAL':
      return 'MANUAL';
    default:
      return 'REGEX';
  }
}

/**
 * Detect PII using basic detection (faster, lower accuracy)
 */
export async function detectBasic(content: string): Promise<ExtendedPIIMatch[]> {
  if (!detector) {
    throw new Error('Controller not initialized');
  }

  state.documentContent = content;
  state.isDetecting = true;
  state.error = null;

  callbacks.onDetectionStart?.();
  setPreviewContent(content);

  try {
    const entities = await detector.detect(content);

    state.originalEntities = entities;
    state.isDetecting = false;

    // Update preview panel
    setPreviewEntities(entities);
    state.reviewedEntities = getPreviewAllEntities();

    callbacks.onDetectionComplete?.(entities);

    return entities;
  } catch (error) {
    state.isDetecting = false;
    state.error = error instanceof Error ? error.message : 'Detection failed';
    callbacks.onDetectionError?.(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

/**
 * Handle anonymization request from preview panel
 */
function handleAnonymize(selectedEntities: EntityWithSelection[]): void {
  state.isAnonymizing = true;
  callbacks.onAnonymize?.(selectedEntities);
}

/**
 * Handle entity changes from preview panel
 */
function handleEntityChange(entities: EntityWithSelection[]): void {
  state.reviewedEntities = entities;
  callbacks.onEntitiesChange?.(entities);
}

/**
 * Get current review state
 */
export function getReviewState(): Readonly<ReviewState> {
  return { ...state };
}

/**
 * Get selected entities for anonymization
 */
export function getSelectedEntities(): EntityWithSelection[] {
  return getPreviewSelectedEntities();
}

/**
 * Get all entities (including deselected)
 */
export function getAllEntities(): EntityWithSelection[] {
  return getPreviewAllEntities();
}

/**
 * Get detection statistics
 */
export function getDetectionStats(): {
  total: number;
  selected: number;
  byType: Record<string, { total: number; selected: number }>;
  bySource: Record<string, number>;
  } {
  const all = getPreviewAllEntities();
  const selected = getPreviewSelectedEntities();

  const byType: Record<string, { total: number; selected: number }> = {};
  const bySource: Record<string, number> = { ML: 0, REGEX: 0, BOTH: 0, MANUAL: 0 };

  for (const entity of all) {
    // Count by type
    if (!byType[entity.type]) {
      byType[entity.type] = { total: 0, selected: 0 };
    }
    byType[entity.type].total++;
    if (entity.selected) {
      byType[entity.type].selected++;
    }

    // Count by source
    const source = entity.source || 'REGEX';
    bySource[source] = (bySource[source] || 0) + 1;
  }

  return {
    total: all.length,
    selected: selected.length,
    byType,
    bySource,
  };
}

/**
 * Clear all entities and reset state
 */
export function clearReview(): void {
  clearPreviewEntities();
  state.documentContent = '';
  state.originalEntities = [];
  state.reviewedEntities = [];
  state.error = null;
}

/**
 * Check if detection is in progress
 */
export function isDetecting(): boolean {
  return state.isDetecting;
}

/**
 * Check if anonymization is in progress
 */
export function isAnonymizing(): boolean {
  return state.isAnonymizing;
}

/**
 * Set anonymization complete
 */
export function setAnonymizationComplete(): void {
  state.isAnonymizing = false;
}

/**
 * Get detector instance for advanced usage
 */
export function getDetector(): PIIDetector | null {
  return detector;
}

/**
 * Initialize worker for background processing
 */
export function initializeWorker(): void {
  detector?.initializeWorker();
}

/**
 * Terminate worker
 */
export function terminateWorker(): void {
  detector?.terminateWorker();
}

/**
 * Check if worker is ready
 */
export function isWorkerReady(): boolean {
  return detector?.isWorkerReady() ?? false;
}

/**
 * Destroy the controller and clean up
 */
export function destroyEntityReviewController(): void {
  destroyPreviewPanel();
  detector?.terminateWorker();
  detector = null;
  callbacks = {};
  state = {
    documentContent: '',
    originalEntities: [],
    reviewedEntities: [],
    isDetecting: false,
    isAnonymizing: false,
    error: null,
  };
}
