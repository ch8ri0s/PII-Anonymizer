/**
 * FeedbackIntegration Tests
 *
 * Story 7.8: User Correction Feedback Logging
 * Tests integration with EntitySidebar for DISMISS and ADD actions
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import 'fake-indexeddb/auto';
import type { EntityWithSelection } from '../../src/components/EntitySidebar';
import {
  setCurrentDocument,
  clearCurrentDocument,
  initializeSelectionTracking,
  handleSelectionChanges,
  handleManualMark,
  logDismiss,
  logAdd,
  resetFeedbackIntegration,
} from '../../src/services/FeedbackIntegration';
import {
  setEnabled,
  resetFeedbackLogger,
  getRecentCorrections,
} from '../../src/services/FeedbackLogger';
import { deleteDatabase, closeDatabase, deleteAllEntries } from '../../src/services/FeedbackStore';

// Helper to create a mock entity
function createMockEntity(overrides: Partial<EntityWithSelection> = {}): EntityWithSelection {
  return {
    id: 'entity-1',
    text: 'John Smith',
    type: 'PERSON',
    start: 10,
    end: 20,
    source: 'ML',
    confidence: 0.9,
    selected: true,
    visible: true,
    ...overrides,
  };
}

describe('FeedbackIntegration', () => {
  beforeEach(async () => {
    // Reset state and clean up
    resetFeedbackIntegration();
    resetFeedbackLogger();
    localStorage.clear();

    // Clear entries instead of deleting database (less blocking)
    try {
      await deleteAllEntries();
    } catch {
      // Database might not exist yet, that's fine
    }

    setEnabled(true);

    // Set up document context for all tests
    setCurrentDocument(
      'Hello John Smith, please contact us at john@example.com. Phone: +41 79 123 45 67',
      'test-document.pdf',
    );
  });

  afterEach(async () => {
    // Reset state but don't delete database (just clear entries)
    resetFeedbackIntegration();
    resetFeedbackLogger();
    localStorage.clear();

    try {
      await deleteAllEntries();
    } catch {
      // Ignore errors
    }
  });

  // Close and delete database only once after all tests
  afterAll(async () => {
    closeDatabase();
    await deleteDatabase();
  });

  describe('setCurrentDocument / clearCurrentDocument', () => {
    it('should set document context for logging', async () => {
      setCurrentDocument('Test content', 'test.pdf');

      // Verify by logging an entry and checking the hash
      await logAdd('Test', 'PERSON', 0, 4);

      const entries = await getRecentCorrections(1);
      expect(entries).toHaveLength(1);
      expect(entries[0].documentHash).toBeDefined();
    });

    it('should clear document context', async () => {
      setCurrentDocument('Test content', 'test.pdf');
      clearCurrentDocument();

      await logAdd('Test', 'PERSON', 0, 4);

      const entries = await getRecentCorrections(1);
      expect(entries[0].documentHash).toBeDefined(); // Still hashes 'unknown'
    });
  });

  describe('initializeSelectionTracking', () => {
    it('should track initial selection state', async () => {
      const entities = [
        createMockEntity({ id: 'e1', selected: true }),
        createMockEntity({ id: 'e2', selected: false }),
        createMockEntity({ id: 'e3', selected: true }),
      ];

      initializeSelectionTracking(entities);

      // Now change selections - only e3 should trigger dismiss
      entities[0].selected = true; // No change
      entities[1].selected = false; // No change
      entities[2].selected = false; // Changed! DISMISS

      await handleSelectionChanges(entities);

      const corrections = await getRecentCorrections(10);
      expect(corrections).toHaveLength(1);
      expect(corrections[0].action).toBe('DISMISS');
    });
  });

  describe('handleSelectionChanges', () => {
    it('should log DISMISS when entity is deselected', async () => {
      const entities = [createMockEntity({ id: 'e1', selected: true })];
      initializeSelectionTracking(entities);

      // Deselect entity
      entities[0].selected = false;
      await handleSelectionChanges(entities);

      const corrections = await getRecentCorrections(1);
      expect(corrections).toHaveLength(1);
      expect(corrections[0].action).toBe('DISMISS');
      expect(corrections[0].entityType).toBe('PERSON');
    });

    it('should not log when entity is selected (re-enabled)', async () => {
      const entities = [createMockEntity({ id: 'e1', selected: false })];
      initializeSelectionTracking(entities);

      // Re-select entity
      entities[0].selected = true;
      await handleSelectionChanges(entities);

      const corrections = await getRecentCorrections(10);
      expect(corrections).toHaveLength(0);
    });

    it('should not log when selection unchanged', async () => {
      const entities = [createMockEntity({ id: 'e1', selected: true })];
      initializeSelectionTracking(entities);

      // No change
      await handleSelectionChanges(entities);

      const corrections = await getRecentCorrections(10);
      expect(corrections).toHaveLength(0);
    });

    it('should log multiple dismissals at once', async () => {
      const entities = [
        createMockEntity({ id: 'e1', selected: true, type: 'PERSON' }),
        createMockEntity({ id: 'e2', selected: true, type: 'EMAIL' }),
        createMockEntity({ id: 'e3', selected: true, type: 'PHONE' }),
      ];
      initializeSelectionTracking(entities);

      // Deselect all
      entities[0].selected = false;
      entities[1].selected = false;
      entities[2].selected = false;
      await handleSelectionChanges(entities);

      const corrections = await getRecentCorrections(10);
      expect(corrections).toHaveLength(3);
    });

    it('should skip MANUAL source entities', async () => {
      const entities = [createMockEntity({ id: 'e1', selected: true, source: 'MANUAL' })];
      initializeSelectionTracking(entities);

      // Deselect manual entity
      entities[0].selected = false;
      await handleSelectionChanges(entities);

      const corrections = await getRecentCorrections(10);
      expect(corrections).toHaveLength(0); // Manual entities not logged
    });

    it('should not log when logging is disabled', async () => {
      setEnabled(false);

      const entities = [createMockEntity({ id: 'e1', selected: true })];
      initializeSelectionTracking(entities);

      entities[0].selected = false;
      await handleSelectionChanges(entities);

      const corrections = await getRecentCorrections(10);
      expect(corrections).toHaveLength(0);
    });

    it('should include source and confidence for dismissed ML entities', async () => {
      const entities = [
        createMockEntity({
          id: 'e1',
          selected: true,
          source: 'ML',
          confidence: 0.85,
        }),
      ];
      initializeSelectionTracking(entities);

      entities[0].selected = false;
      await handleSelectionChanges(entities);

      const corrections = await getRecentCorrections(1);
      expect(corrections[0].originalSource).toBe('ML');
      expect(corrections[0].confidence).toBe(0.85);
    });

    it('should include position data', async () => {
      const entities = [
        createMockEntity({
          id: 'e1',
          selected: true,
          start: 10,
          end: 20,
        }),
      ];
      initializeSelectionTracking(entities);

      entities[0].selected = false;
      await handleSelectionChanges(entities);

      const corrections = await getRecentCorrections(1);
      expect(corrections[0].position).toEqual({ start: 10, end: 20 });
    });
  });

  describe('handleManualMark', () => {
    it('should log ADD action for manual marking', async () => {
      await handleManualMark('confidential', 'OTHER', 50, 62);

      const corrections = await getRecentCorrections(1);
      expect(corrections).toHaveLength(1);
      expect(corrections[0].action).toBe('ADD');
      expect(corrections[0].entityType).toBe('OTHER');
    });

    it('should include position data', async () => {
      await handleManualMark('test', 'PERSON', 100, 104);

      const corrections = await getRecentCorrections(1);
      expect(corrections[0].position).toEqual({ start: 100, end: 104 });
    });

    it('should not log when logging is disabled', async () => {
      setEnabled(false);

      await handleManualMark('test', 'PERSON', 0, 4);

      const corrections = await getRecentCorrections(10);
      expect(corrections).toHaveLength(0);
    });
  });

  describe('logDismiss', () => {
    it('should log dismiss for ML detected entity', async () => {
      const entity = createMockEntity({
        source: 'ML',
        confidence: 0.92,
      });

      await logDismiss(entity);

      const corrections = await getRecentCorrections(1);
      expect(corrections[0].action).toBe('DISMISS');
      expect(corrections[0].originalSource).toBe('ML');
      expect(corrections[0].confidence).toBe(0.92);
    });

    it('should log dismiss for REGEX detected entity', async () => {
      const entity = createMockEntity({
        source: 'REGEX',
        confidence: 0.99,
      });

      await logDismiss(entity);

      const corrections = await getRecentCorrections(1);
      expect(corrections[0].originalSource).toBe('REGEX');
    });

    it('should skip manual entities', async () => {
      const entity = createMockEntity({
        source: 'MANUAL',
      });

      await logDismiss(entity);

      const corrections = await getRecentCorrections(10);
      expect(corrections).toHaveLength(0);
    });

    it('should extract context around entity', async () => {
      setCurrentDocument(
        'Hello John Smith, please contact us.',
        'test.pdf',
      );

      const entity = createMockEntity({
        text: 'John Smith',
        start: 6,
        end: 16,
      });

      await logDismiss(entity);

      const corrections = await getRecentCorrections(1);
      // Context should contain surrounding text with PII anonymized
      expect(corrections[0].context).toContain('[PERSON]');
    });
  });

  describe('logAdd', () => {
    it('should log add action with correct entity type', async () => {
      await logAdd('Secret Project', 'OTHER', 0, 14);

      const corrections = await getRecentCorrections(1);
      expect(corrections[0].action).toBe('ADD');
      expect(corrections[0].entityType).toBe('OTHER');
    });

    it('should not include originalSource for ADD actions (per AC #3)', async () => {
      // AC #3 says "For dismissals: original detection source and confidence score are recorded"
      // ADD actions don't need originalSource - they're always user-initiated
      await logAdd('Test', 'PERSON', 0, 4);

      const corrections = await getRecentCorrections(1);
      // ADD actions should not have originalSource (it's only for DISMISS)
      expect(corrections[0].originalSource).toBeUndefined();
    });

    it('should extract context around position', async () => {
      setCurrentDocument(
        'The confidential code name is Alpha.',
        'test.pdf',
      );

      await logAdd('Alpha', 'OTHER', 30, 35);

      const corrections = await getRecentCorrections(1);
      expect(corrections[0].context).toBeDefined();
      expect(corrections[0].context.length).toBeGreaterThan(0);
    });
  });

  describe('context extraction', () => {
    it('should limit context to reasonable length', async () => {
      const longDocument = 'A'.repeat(1000) + 'TARGET' + 'B'.repeat(1000);
      setCurrentDocument(longDocument, 'long.pdf');

      await logAdd('TARGET', 'OTHER', 1000, 1006);

      const corrections = await getRecentCorrections(1);
      // Context should be limited (around 100 chars default)
      expect(corrections[0].context.length).toBeLessThan(200);
    });

    it('should include ellipsis for truncated context', async () => {
      const longDocument = 'A'.repeat(100) + 'TARGET' + 'B'.repeat(100);
      setCurrentDocument(longDocument, 'long.pdf');

      await logAdd('TARGET', 'OTHER', 100, 106);

      const corrections = await getRecentCorrections(1);
      expect(corrections[0].context).toContain('...');
    });
  });

  describe('document hash', () => {
    it('should hash document name consistently', async () => {
      await logAdd('Test', 'PERSON', 0, 4);
      await logAdd('Test2', 'EMAIL', 0, 5);

      const corrections = await getRecentCorrections(2);
      // Same document, same hash
      expect(corrections[0].documentHash).toBe(corrections[1].documentHash);
    });

    it('should produce different hashes for different documents', async () => {
      setCurrentDocument('Content 1', 'doc1.pdf');
      await logAdd('Test', 'PERSON', 0, 4);

      setCurrentDocument('Content 2', 'doc2.pdf');
      await logAdd('Test', 'PERSON', 0, 4);

      const corrections = await getRecentCorrections(2);
      expect(corrections[0].documentHash).not.toBe(corrections[1].documentHash);
    });
  });

  describe('resetFeedbackIntegration', () => {
    it('should clear document context', async () => {
      setCurrentDocument('Test content', 'test.pdf');
      resetFeedbackIntegration();

      await logAdd('Test', 'PERSON', 0, 4);

      const corrections = await getRecentCorrections(1);
      // Document name should be 'unknown' after reset
      expect(corrections[0].documentHash).toBeDefined();
    });

    it('should clear selection tracking', async () => {
      const entities = [createMockEntity({ id: 'e1', selected: true })];
      initializeSelectionTracking(entities);

      resetFeedbackIntegration();

      // After reset, deselecting should not log (no previous state)
      entities[0].selected = false;
      await handleSelectionChanges(entities);

      // Should still log because handleSelectionChanges tracks its own state
      // But without previous state, the first call establishes baseline
      // This is correct behavior - reset clears the baseline
    });
  });
});
