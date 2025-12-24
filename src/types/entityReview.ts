/**
 * Entity Review Types (Epic 4)
 *
 * Type definitions for the user review workflow including:
 * - Entity review state
 * - Filter options
 * - User actions (approve, reject, edit, manual mark)
 */

import type { EntityType } from './detection.js';

/**
 * Review status for an entity
 */
export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'edited';

/**
 * Entity with review metadata for UI display
 */
export interface ReviewableEntity {
  /** Unique identifier */
  id: string;

  /** Original text that was detected */
  originalText: string;

  /** Proposed replacement (e.g., "PERSON_1") */
  replacement: string;

  /** Entity type classification */
  type: EntityType;

  /** Confidence score (0-1) */
  confidence: number;

  /** Detection source */
  source: 'ML' | 'RULE' | 'BOTH' | 'MANUAL';

  /** Current review status */
  status: ReviewStatus;

  /** Character position in document (for scroll-to) */
  position?: {
    start: number;
    end: number;
  };

  /** Whether this entity is flagged for review (low confidence) */
  flaggedForReview: boolean;

  /** User-edited replacement value (if edited) */
  editedReplacement?: string;

  /** Context snippet (text around the entity) */
  context?: string;
}

/**
 * Filter options for entity list
 */
export interface EntityFilterOptions {
  /** Entity types to show (empty = all) */
  types: EntityType[];

  /** Minimum confidence threshold (0-1) */
  minConfidence: number;

  /** Show only flagged entities */
  showFlaggedOnly: boolean;

  /** Show only entities with specific status */
  statusFilter: ReviewStatus | 'all';

  /** Search text to filter by */
  searchText: string;
}

/**
 * Default filter options
 */
export const DEFAULT_FILTER_OPTIONS: EntityFilterOptions = {
  types: [],
  minConfidence: 0,
  showFlaggedOnly: false,
  statusFilter: 'all',
  searchText: '',
};

/**
 * Entity group for sidebar display
 */
export interface EntityGroup {
  /** Entity type */
  type: EntityType;

  /** Display label for the type */
  label: string;

  /** Entities in this group */
  entities: ReviewableEntity[];

  /** Count of entities */
  count: number;

  /** Count of approved entities */
  approvedCount: number;

  /** Count of rejected entities */
  rejectedCount: number;

  /** Whether this group is expanded in UI */
  expanded: boolean;
}

/**
 * Statistics for the review sidebar
 */
export interface ReviewStatistics {
  /** Total entities detected */
  total: number;

  /** Entities pending review */
  pending: number;

  /** Entities approved for anonymization */
  approved: number;

  /** Entities rejected (will not be anonymized) */
  rejected: number;

  /** Entities edited by user */
  edited: number;

  /** Entities flagged for review (low confidence) */
  flagged: number;

  /** Manually added entities */
  manual: number;

  /** Breakdown by type */
  byType: Record<EntityType, number>;
}

/**
 * User action on an entity
 */
export interface EntityAction {
  /** Entity ID */
  entityId: string;

  /** Action type */
  action: 'approve' | 'reject' | 'edit' | 'reset';

  /** New replacement value (for edit action) */
  newReplacement?: string;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Manual PII marking request
 */
export interface ManualMarkRequest {
  /** Selected text to mark as PII */
  text: string;

  /** Start position in document */
  start: number;

  /** End position in document */
  end: number;

  /** Entity type assigned by user */
  type: EntityType;

  /** Context around the selection */
  context?: string;
}

/**
 * Bulk action on multiple entities
 */
export interface BulkAction {
  /** Entity IDs to act on */
  entityIds: string[];

  /** Action to perform */
  action: 'approve' | 'reject' | 'reset';
}

/**
 * Review session state
 */
export interface ReviewSession {
  /** Original file being processed */
  originalFile: string;

  /** All reviewable entities */
  entities: ReviewableEntity[];

  /** Current filter options */
  filters: EntityFilterOptions;

  /** Statistics */
  statistics: ReviewStatistics;

  /** Action history for undo */
  actionHistory: EntityAction[];

  /** Whether review is complete */
  reviewComplete: boolean;

  /** Timestamp when review started */
  startedAt: Date;
}

/**
 * Final review result for processing
 */
export interface ReviewResult {
  /** Entities to include in anonymization */
  entitiesToAnonymize: Array<{
    originalText: string;
    replacement: string;
    type: EntityType;
  }>;

  /** Entities that were rejected */
  rejectedEntities: Array<{
    originalText: string;
    type: EntityType;
    reason?: string;
  }>;

  /** Manually added entities */
  manualEntities: Array<{
    text: string;
    type: EntityType;
    replacement: string;
  }>;

  /** Review metadata */
  metadata: {
    totalReviewed: number;
    approved: number;
    rejected: number;
    edited: number;
    manual: number;
    reviewDuration: number; // milliseconds
  };
}

/**
 * Type labels for display (multilingual support via i18n keys)
 */
export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  PERSON: 'Person',
  PERSON_NAME: 'Person Name',
  ORGANIZATION: 'Organization',
  LOCATION: 'Location',
  ADDRESS: 'Address',
  SWISS_ADDRESS: 'Swiss Address',
  EU_ADDRESS: 'EU Address',
  SWISS_AVS: 'Swiss AVS',
  IBAN: 'IBAN',
  PHONE: 'Phone',
  EMAIL: 'Email',
  DATE: 'Date',
  AMOUNT: 'Amount',
  VAT_NUMBER: 'VAT Number',
  INVOICE_NUMBER: 'Invoice Number',
  PAYMENT_REF: 'Payment Reference',
  QR_REFERENCE: 'QR Reference',
  SENDER: 'Sender',
  RECIPIENT: 'Recipient',
  SALUTATION_NAME: 'Salutation Name',
  SIGNATURE: 'Signature',
  LETTER_DATE: 'Letter Date',
  REFERENCE_LINE: 'Reference Line',
  PARTY: 'Party',
  AUTHOR: 'Author',
  VENDOR_NAME: 'Vendor Name',
  UNKNOWN: 'Unknown',
};

/**
 * Color classes for entity type badges
 */
export const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
  PERSON: 'badge-blue',
  PERSON_NAME: 'badge-blue',
  ORGANIZATION: 'badge-purple',
  LOCATION: 'badge-green',
  ADDRESS: 'badge-green',
  SWISS_ADDRESS: 'badge-green',
  EU_ADDRESS: 'badge-green',
  SWISS_AVS: 'badge-red',
  IBAN: 'badge-red',
  PHONE: 'badge-yellow',
  EMAIL: 'badge-yellow',
  DATE: 'badge-gray',
  AMOUNT: 'badge-orange',
  VAT_NUMBER: 'badge-purple',
  INVOICE_NUMBER: 'badge-gray',
  PAYMENT_REF: 'badge-orange',
  QR_REFERENCE: 'badge-orange',
  SENDER: 'badge-blue',
  RECIPIENT: 'badge-blue',
  SALUTATION_NAME: 'badge-blue',
  SIGNATURE: 'badge-blue',
  LETTER_DATE: 'badge-gray',
  REFERENCE_LINE: 'badge-gray',
  PARTY: 'badge-purple',
  AUTHOR: 'badge-blue',
  VENDOR_NAME: 'badge-purple',
  UNKNOWN: 'badge-gray',
};
