/**
 * AnonymizationEngine Tests
 *
 * Tests for numbered entity token generation and consistent anonymization.
 * Story 8.8: Entity Consolidation and Span Repair - numbered tokens
 *
 * Key requirements tested:
 * - Entities get numbered tokens (e.g., [DATE_1], [DATE_2])
 * - Same entity text gets the same token
 * - Different entity texts of same type get different numbers
 * - Session reset creates fresh numbering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnonymizationSession,
  getReplacementToken,
  applyAnonymization,
  generateMappingMarkdown,
  resetAnonymizationSession,
} from '../../src/components/preview/AnonymizationEngine';
import type { EntityWithSelection } from '../../src/components/EntitySidebar';

/**
 * Helper to create test entity with required fields
 */
function createEntity(
  overrides: Partial<EntityWithSelection> & {
    type: string;
    text: string;
    start: number;
    end: number;
  },
): EntityWithSelection {
  return {
    id: `entity-${overrides.start}-${overrides.end}`,
    selected: true,
    visible: true,
    confidence: 0.95,
    source: 'REGEX',
    ...overrides,
  };
}

describe('AnonymizationEngine', () => {
  describe('AnonymizationSession', () => {
    let session: AnonymizationSession;

    beforeEach(() => {
      session = new AnonymizationSession();
    });

    it('should generate numbered tokens for entities', () => {
      const token1 = session.getOrCreateToken('2024-01-15', 'DATE');
      const token2 = session.getOrCreateToken('2024-02-20', 'DATE');

      expect(token1).toBe('[DATE_1]');
      expect(token2).toBe('[DATE_2]');
    });

    it('should return same token for same entity text', () => {
      const token1 = session.getOrCreateToken('John Doe', 'PERSON');
      const token2 = session.getOrCreateToken('John Doe', 'PERSON');
      const token3 = session.getOrCreateToken('john doe', 'PERSON'); // case insensitive

      expect(token1).toBe('[PERSON_1]');
      expect(token2).toBe('[PERSON_1]');
      expect(token3).toBe('[PERSON_1]');
    });

    it('should generate different tokens for different entity texts', () => {
      const token1 = session.getOrCreateToken('John Doe', 'PERSON');
      const token2 = session.getOrCreateToken('Jane Smith', 'PERSON');

      expect(token1).toBe('[PERSON_1]');
      expect(token2).toBe('[PERSON_2]');
    });

    it('should handle multiple entity types independently', () => {
      const person1 = session.getOrCreateToken('John Doe', 'PERSON');
      const date1 = session.getOrCreateToken('2024-01-15', 'DATE');
      const person2 = session.getOrCreateToken('Jane Smith', 'PERSON');
      const date2 = session.getOrCreateToken('2024-02-20', 'DATE');

      expect(person1).toBe('[PERSON_1]');
      expect(date1).toBe('[DATE_1]');
      expect(person2).toBe('[PERSON_2]');
      expect(date2).toBe('[DATE_2]');
    });

    it('should normalize entity types', () => {
      const token1 = session.getOrCreateToken('John Doe', 'PERSON_NAME');
      const token2 = session.getOrCreateToken('Jane Smith', 'PERSON');

      // Both should use normalized 'PERSON' type
      expect(token1).toBe('[PERSON_1]');
      expect(token2).toBe('[PERSON_2]');
    });

    it('should reset counters and mappings on reset()', () => {
      session.getOrCreateToken('John Doe', 'PERSON');
      session.getOrCreateToken('2024-01-15', 'DATE');

      session.reset();

      const newPerson = session.getOrCreateToken('Jane Smith', 'PERSON');
      const newDate = session.getOrCreateToken('2024-02-20', 'DATE');

      expect(newPerson).toBe('[PERSON_1]');
      expect(newDate).toBe('[DATE_1]');
    });

    it('should handle whitespace normalization', () => {
      const token1 = session.getOrCreateToken('  John Doe  ', 'PERSON');
      const token2 = session.getOrCreateToken('John Doe', 'PERSON');

      expect(token1).toBe('[PERSON_1]');
      expect(token2).toBe('[PERSON_1]');
    });
  });

  describe('getReplacementToken', () => {
    beforeEach(() => {
      resetAnonymizationSession();
    });

    it('should generate numbered token when text is provided', () => {
      const token = getReplacementToken('DATE', '2024-01-15');
      expect(token).toBe('[DATE_1]');
    });

    it('should generate unnumbered token when text is not provided', () => {
      const token = getReplacementToken('DATE');
      expect(token).toBe('[DATE]');
    });

    it('should use global session for consistent numbering', () => {
      const token1 = getReplacementToken('DATE', '2024-01-15');
      const token2 = getReplacementToken('DATE', '2024-02-20');
      const token3 = getReplacementToken('DATE', '2024-01-15'); // same as first

      expect(token1).toBe('[DATE_1]');
      expect(token2).toBe('[DATE_2]');
      expect(token3).toBe('[DATE_1]');
    });
  });

  describe('applyAnonymization', () => {
    beforeEach(() => {
      resetAnonymizationSession();
    });

    function createTestEntities(): EntityWithSelection[] {
      return [
        createEntity({ type: 'DATE', text: '2024-01-15', start: 10, end: 20, confidence: 0.95 }),
        createEntity({ type: 'DATE', text: '2024-02-20', start: 30, end: 40, confidence: 0.90 }),
        createEntity({ type: 'DATE', text: '2024-01-15', start: 50, end: 60, confidence: 0.95 }), // Same as first
      ];
    }

    it('should replace entities with numbered tokens', () => {
      const content = 'Date is 2024-01-15 and also 2024-02-20 and again 2024-01-15';
      const entities = createTestEntities();

      const result = applyAnonymization(content, entities);

      // Same date text should get same token
      expect(result).toContain('[DATE_1]');
      expect(result).toContain('[DATE_2]');

      // Count occurrences - DATE_1 should appear twice (same text)
      const date1Count = (result.match(/\[DATE_1\]/g) || []).length;
      const date2Count = (result.match(/\[DATE_2\]/g) || []).length;

      expect(date1Count).toBe(2);
      expect(date2Count).toBe(1);
    });

    it('should only replace selected entities', () => {
      const content = 'Date is 2024-01-15 and also 2024-02-20';
      const entities: EntityWithSelection[] = [
        createEntity({ type: 'DATE', text: '2024-01-15', start: 8, end: 18, confidence: 0.95 }),
        createEntity({ type: 'DATE', text: '2024-02-20', start: 28, end: 38, confidence: 0.90, selected: false }),
      ];

      const result = applyAnonymization(content, entities);

      expect(result).toContain('[DATE_1]');
      expect(result).toContain('2024-02-20'); // Not replaced
    });

    it('should handle multiple entity types', () => {
      const content = 'John Doe was born on 2024-01-15 and Jane Smith on 2024-02-20';
      const entities: EntityWithSelection[] = [
        createEntity({ type: 'PERSON', text: 'John Doe', start: 0, end: 8, confidence: 0.95 }),
        createEntity({ type: 'DATE', text: '2024-01-15', start: 21, end: 31, confidence: 0.90 }),
        createEntity({ type: 'PERSON', text: 'Jane Smith', start: 36, end: 46, confidence: 0.95 }),
        createEntity({ type: 'DATE', text: '2024-02-20', start: 50, end: 60, confidence: 0.90 }),
      ];

      const result = applyAnonymization(content, entities);

      expect(result).toContain('[PERSON_1]');
      expect(result).toContain('[PERSON_2]');
      expect(result).toContain('[DATE_1]');
      expect(result).toContain('[DATE_2]');
    });
  });

  describe('generateMappingMarkdown', () => {
    beforeEach(() => {
      resetAnonymizationSession();
    });

    it('should generate mapping with numbered tokens', () => {
      const entities: EntityWithSelection[] = [
        createEntity({ type: 'DATE', text: '2024-01-15', start: 0, end: 10, confidence: 0.95 }),
        createEntity({ type: 'DATE', text: '2024-02-20', start: 20, end: 30, confidence: 0.90 }),
      ];

      const mapping = generateMappingMarkdown('test.pdf', entities);

      expect(mapping).toContain('[DATE_1]');
      expect(mapping).toContain('[DATE_2]');
      expect(mapping).toContain('2024-01-15');
      expect(mapping).toContain('2024-02-20');
    });

    it('should show consistent tokens for repeated entities', () => {
      const entities: EntityWithSelection[] = [
        createEntity({ type: 'PERSON', text: 'John Doe', start: 0, end: 8, confidence: 0.95 }),
        createEntity({ type: 'PERSON', text: 'John Doe', start: 20, end: 28, confidence: 0.95 }),
      ];

      const mapping = generateMappingMarkdown('test.pdf', entities);

      // Both should map to PERSON_1
      const lines = mapping.split('\n');
      const personLines = lines.filter(line => line.includes('John Doe'));

      // Both John Doe entries should have [PERSON_1]
      personLines.forEach(line => {
        expect(line).toContain('[PERSON_1]');
      });
    });
  });

  describe('resetAnonymizationSession', () => {
    it('should reset global session state', () => {
      getReplacementToken('DATE', '2024-01-15');
      getReplacementToken('PERSON', 'John Doe');

      resetAnonymizationSession();

      // After reset, numbering should start fresh
      const newDate = getReplacementToken('DATE', '2024-02-20');
      const newPerson = getReplacementToken('PERSON', 'Jane Smith');

      expect(newDate).toBe('[DATE_1]');
      expect(newPerson).toBe('[PERSON_1]');
    });
  });
});
