/**
 * Entity Type Configuration
 *
 * Type definitions, color schemes, and helper functions for entity types.
 * Extracted from EntitySidebar.ts for better modularity.
 */

/**
 * Entity type display configuration
 */
export interface EntityTypeConfig {
  label: string;
  color: string;
  bgColor: string;
}

/**
 * Type configuration for all entity types
 */
export const ENTITY_TYPE_CONFIG: Record<string, EntityTypeConfig> = {
  PERSON: { label: 'Person', color: 'hsl(221.2 83.2% 53.3%)', bgColor: 'hsl(221.2 83.2% 53.3% / 0.1)' },
  ORG: { label: 'Organization', color: 'hsl(263.4 70% 50.4%)', bgColor: 'hsl(263.4 70% 50.4% / 0.1)' },
  ORGANIZATION: { label: 'Organization', color: 'hsl(263.4 70% 50.4%)', bgColor: 'hsl(263.4 70% 50.4% / 0.1)' },
  ADDRESS: { label: 'Address', color: 'hsl(142.1 76.2% 36.3%)', bgColor: 'hsl(142.1 76.2% 36.3% / 0.1)' },
  SWISS_ADDRESS: { label: 'Swiss Address', color: 'hsl(142.1 76.2% 36.3%)', bgColor: 'hsl(142.1 76.2% 36.3% / 0.1)' },
  EU_ADDRESS: { label: 'EU Address', color: 'hsl(142.1 76.2% 36.3%)', bgColor: 'hsl(142.1 76.2% 36.3% / 0.1)' },
  EMAIL: { label: 'Email', color: 'hsl(0 84.2% 60.2%)', bgColor: 'hsl(0 84.2% 60.2% / 0.1)' },
  PHONE: { label: 'Phone', color: 'hsl(24.6 95% 53.1%)', bgColor: 'hsl(24.6 95% 53.1% / 0.1)' },
  DATE: { label: 'Date', color: 'hsl(262.1 83.3% 57.8%)', bgColor: 'hsl(262.1 83.3% 57.8% / 0.1)' },
  AMOUNT: { label: 'Amount', color: 'hsl(142.1 70.6% 45.3%)', bgColor: 'hsl(142.1 70.6% 45.3% / 0.1)' },
  IBAN: { label: 'IBAN', color: 'hsl(199.4 89.3% 48.4%)', bgColor: 'hsl(199.4 89.3% 48.4% / 0.1)' },
  SWISS_AVS: { label: 'Swiss AVS', color: 'hsl(346.8 77.2% 49.8%)', bgColor: 'hsl(346.8 77.2% 49.8% / 0.1)' },
  VAT_NUMBER: { label: 'VAT Number', color: 'hsl(199.4 89.3% 48.4%)', bgColor: 'hsl(199.4 89.3% 48.4% / 0.1)' },
  INVOICE_NUMBER: { label: 'Invoice #', color: 'hsl(47.9 95.8% 53.1%)', bgColor: 'hsl(47.9 95.8% 53.1% / 0.1)' },
  PAYMENT_REF: { label: 'Payment Ref', color: 'hsl(47.9 95.8% 53.1%)', bgColor: 'hsl(47.9 95.8% 53.1% / 0.1)' },
  QR_REFERENCE: { label: 'QR Reference', color: 'hsl(47.9 95.8% 53.1%)', bgColor: 'hsl(47.9 95.8% 53.1% / 0.1)' },
  LOCATION: { label: 'Location', color: 'hsl(172.5 66.7% 50.4%)', bgColor: 'hsl(172.5 66.7% 50.4% / 0.1)' },
  OTHER: { label: 'Other', color: 'hsl(0 0% 45.1%)', bgColor: 'hsl(0 0% 45.1% / 0.1)' },
};

/**
 * Type normalization map
 */
const TYPE_NORMALIZATION_MAP: Record<string, string> = {
  'PERSON_NAME': 'PERSON',
  'ORGANIZATION': 'ORG',
  'STREET_ADDRESS': 'ADDRESS',
};

/**
 * Normalize entity type for grouping
 */
export function normalizeType(type: string): string {
  return TYPE_NORMALIZATION_MAP[type] || type;
}

/**
 * Get type configuration
 */
export function getTypeConfig(type: string): EntityTypeConfig {
  return ENTITY_TYPE_CONFIG[type] || ENTITY_TYPE_CONFIG[normalizeType(type)] || ENTITY_TYPE_CONFIG.OTHER;
}

/**
 * Get confidence level
 */
export function getConfidenceLevel(confidence: number | undefined): 'high' | 'medium' | 'low' {
  if (confidence === undefined) return 'medium';
  if (confidence >= 0.8) return 'high';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

/**
 * Format confidence as percentage
 */
export function formatConfidence(confidence: number | undefined): string {
  if (confidence === undefined) return '';
  return `${Math.round(confidence * 100)}%`;
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
