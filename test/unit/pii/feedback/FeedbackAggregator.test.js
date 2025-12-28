/**
 * FeedbackAggregator Unit Tests (Story 8.9)
 *
 * Tests for the FeedbackAggregator class that aggregates user correction
 * events to identify patterns for DenyList/ContextWords improvements.
 *
 * AC-8.9.1: Show top false positive patterns by frequency
 * AC-8.9.2: Show top missed PII patterns by frequency
 * AC-8.9.9: Privacy guarantee - limited context window
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';

// Dynamic imports for ESM modules
let FeedbackAggregator, createAggregator;

describe('FeedbackAggregator (Story 8.9)', function () {
  this.timeout(10000);

  before(async function () {
    const module = await import('../../../../shared/dist/pii/feedback/FeedbackAggregator.js');
    FeedbackAggregator = module.FeedbackAggregator;
    createAggregator = module.createAggregator;
  });

  describe('Empty Events', function () {
    it('should return empty summary for no events', function () {
      const aggregator = new FeedbackAggregator([]);
      const summary = aggregator.summarize();

      expect(summary.totalEvents).to.equal(0);
      expect(summary.falsePositives).to.be.an('array').that.is.empty;
      expect(summary.missedPii).to.be.an('array').that.is.empty;
    });

    it('should handle empty arrays for getFalsePositivePatterns', function () {
      const aggregator = new FeedbackAggregator([]);
      const patterns = aggregator.getFalsePositivePatterns();
      expect(patterns).to.be.an('array').that.is.empty;
    });

    it('should handle empty arrays for getMissedPiiPatterns', function () {
      const aggregator = new FeedbackAggregator([]);
      const patterns = aggregator.getMissedPiiPatterns();
      expect(patterns).to.be.an('array').that.is.empty;
    });
  });

  describe('AC-8.9.1: False Positive Pattern Aggregation', function () {
    it('should group multiple mark_as_not_pii actions by same text/type', function () {
      const events = [
        createEvent('mark_as_not_pii', 'PERSON_NAME', 'John Smith'),
        createEvent('mark_as_not_pii', 'PERSON_NAME', 'John Smith'),
        createEvent('mark_as_not_pii', 'PERSON_NAME', 'John Smith'),
      ];

      const aggregator = new FeedbackAggregator(events);
      const patterns = aggregator.getFalsePositivePatterns();

      expect(patterns).to.have.length(1);
      expect(patterns[0].count).to.equal(3);
      expect(patterns[0].pattern).to.equal('john smith'); // normalized to lowercase
      expect(patterns[0].entityType).to.equal('PERSON_NAME');
    });

    it('should sort patterns by frequency (descending)', function () {
      const events = [
        ...Array(5).fill(null).map(() => createEvent('mark_as_not_pii', 'EMAIL', 'info@company.ch')),
        ...Array(3).fill(null).map(() => createEvent('mark_as_not_pii', 'PERSON_NAME', 'Legal Services')),
        ...Array(10).fill(null).map(() => createEvent('mark_as_not_pii', 'ORGANIZATION', 'Customer Support')),
      ];

      const aggregator = new FeedbackAggregator(events);
      const patterns = aggregator.getFalsePositivePatterns();

      expect(patterns[0].pattern).to.equal('customer support');
      expect(patterns[0].count).to.equal(10);
      expect(patterns[1].pattern).to.equal('info@company.ch');
      expect(patterns[1].count).to.equal(5);
      expect(patterns[2].pattern).to.equal('legal services');
      expect(patterns[2].count).to.equal(3);
    });

    it('should include average confidence for false positives', function () {
      const events = [
        createEvent('mark_as_not_pii', 'PERSON_NAME', 'Test Pattern', 0.8),
        createEvent('mark_as_not_pii', 'PERSON_NAME', 'Test Pattern', 0.6),
        createEvent('mark_as_not_pii', 'PERSON_NAME', 'Test Pattern', 0.7),
      ];

      const aggregator = new FeedbackAggregator(events);
      const patterns = aggregator.getFalsePositivePatterns();

      expect(patterns[0].avgConfidence).to.be.closeTo(0.7, 0.01);
    });

    it('should track detection sources', function () {
      const events = [
        createEventWithSource('mark_as_not_pii', 'PERSON_NAME', 'Test', 'ML'),
        createEventWithSource('mark_as_not_pii', 'PERSON_NAME', 'Test', 'REGEX'),
        createEventWithSource('mark_as_not_pii', 'PERSON_NAME', 'Test', 'ML'),
      ];

      const aggregator = new FeedbackAggregator(events);
      const patterns = aggregator.getFalsePositivePatterns();

      expect(patterns[0].sources).to.include('ML');
      expect(patterns[0].sources).to.include('REGEX');
    });
  });

  describe('AC-8.9.2: Missed PII Pattern Aggregation', function () {
    it('should group multiple mark_as_pii actions by same text/type', function () {
      const events = [
        createEvent('mark_as_pii', 'IBAN', 'CH93 0076 2011 6238 5295 7'),
        createEvent('mark_as_pii', 'IBAN', 'CH93 0076 2011 6238 5295 7'),
      ];

      const aggregator = new FeedbackAggregator(events);
      const patterns = aggregator.getMissedPiiPatterns();

      expect(patterns).to.have.length(1);
      expect(patterns[0].count).to.equal(2);
      expect(patterns[0].entityType).to.equal('IBAN');
    });

    it('should separate different entity types', function () {
      const events = [
        createEvent('mark_as_pii', 'EMAIL', 'test@example.com'),
        createEvent('mark_as_pii', 'PHONE', '+41 79 123 45 67'),
        createEvent('mark_as_pii', 'EMAIL', 'another@example.com'),
      ];

      const aggregator = new FeedbackAggregator(events);
      const patterns = aggregator.getMissedPiiPatterns();

      expect(patterns).to.have.length(3);
    });

    it('should track first and last seen timestamps', function () {
      const events = [
        createEventWithTimestamp('mark_as_pii', 'EMAIL', 'test@test.com', '2025-01-01T10:00:00Z'),
        createEventWithTimestamp('mark_as_pii', 'EMAIL', 'test@test.com', '2025-01-15T12:00:00Z'),
        createEventWithTimestamp('mark_as_pii', 'EMAIL', 'test@test.com', '2025-01-10T08:00:00Z'),
      ];

      const aggregator = new FeedbackAggregator(events);
      const patterns = aggregator.getMissedPiiPatterns();

      expect(patterns[0].firstSeen).to.equal('2025-01-01T10:00:00Z');
      expect(patterns[0].lastSeen).to.equal('2025-01-15T12:00:00Z');
    });
  });

  describe('Summarize', function () {
    it('should include date range', function () {
      const events = [
        createEventWithTimestamp('mark_as_not_pii', 'PERSON_NAME', 'A', '2025-01-01T00:00:00Z'),
        createEventWithTimestamp('mark_as_pii', 'EMAIL', 'B', '2025-01-31T23:59:59Z'),
      ];

      const aggregator = new FeedbackAggregator(events);
      const summary = aggregator.summarize();

      expect(summary.dateRange.start).to.equal('2025-01-01T00:00:00Z');
      expect(summary.dateRange.end).to.equal('2025-01-31T23:59:59Z');
    });

    it('should count events by source', function () {
      const events = [
        { ...createEvent('mark_as_not_pii', 'PERSON_NAME', 'A'), source: 'desktop' },
        { ...createEvent('mark_as_not_pii', 'PERSON_NAME', 'B'), source: 'desktop' },
        { ...createEvent('mark_as_pii', 'EMAIL', 'C'), source: 'browser' },
      ];

      const aggregator = new FeedbackAggregator(events);
      const summary = aggregator.summarize();

      expect(summary.bySource.desktop).to.equal(2);
      expect(summary.bySource.browser).to.equal(1);
    });

    it('should count events by action type', function () {
      const events = [
        createEvent('mark_as_not_pii', 'PERSON_NAME', 'A'),
        createEvent('mark_as_not_pii', 'PERSON_NAME', 'B'),
        createEvent('mark_as_pii', 'EMAIL', 'C'),
        createEvent('change_entity_type', 'ADDRESS', 'D'),
      ];

      const aggregator = new FeedbackAggregator(events);
      const summary = aggregator.summarize();

      expect(summary.byAction.mark_as_not_pii).to.equal(2);
      expect(summary.byAction.mark_as_pii).to.equal(1);
      expect(summary.byAction.change_entity_type).to.equal(1);
    });
  });

  describe('Options', function () {
    it('should respect maxPatterns option', function () {
      const events = [];
      for (let i = 0; i < 30; i++) {
        events.push(createEvent('mark_as_not_pii', 'PERSON_NAME', `Pattern ${i}`));
      }

      const aggregator = new FeedbackAggregator(events, { maxPatterns: 10 });
      const patterns = aggregator.getFalsePositivePatterns();

      expect(patterns).to.have.length(10);
    });

    it('should respect minCount option', function () {
      const events = [
        ...Array(5).fill(null).map(() => createEvent('mark_as_not_pii', 'PERSON_NAME', 'Frequent')),
        createEvent('mark_as_not_pii', 'PERSON_NAME', 'Rare'),
      ];

      const aggregator = new FeedbackAggregator(events, { minCount: 3 });
      const patterns = aggregator.getFalsePositivePatterns();

      expect(patterns).to.have.length(1);
      expect(patterns[0].pattern).to.equal('frequent');
    });

    it('should limit context examples per pattern', function () {
      const events = [];
      for (let i = 0; i < 10; i++) {
        events.push({
          ...createEvent('mark_as_not_pii', 'PERSON_NAME', 'Test'),
          contextWindow: `Context ${i}`,
        });
      }

      const aggregator = new FeedbackAggregator(events, { maxContexts: 3 });
      const patterns = aggregator.getFalsePositivePatterns();

      expect(patterns[0].exampleContexts).to.have.length.at.most(3);
    });

    it('should optionally group by document type', function () {
      const events = [
        { ...createEvent('mark_as_not_pii', 'PERSON_NAME', 'Test'), documentType: 'INVOICE' },
        { ...createEvent('mark_as_not_pii', 'PERSON_NAME', 'Test'), documentType: 'LETTER' },
        { ...createEvent('mark_as_not_pii', 'PERSON_NAME', 'Test'), documentType: 'INVOICE' },
      ];

      // Without grouping
      const aggregator1 = new FeedbackAggregator(events, { groupByDocumentType: false });
      const patterns1 = aggregator1.getFalsePositivePatterns();
      expect(patterns1).to.have.length(1);
      expect(patterns1[0].count).to.equal(3);

      // With grouping
      const aggregator2 = new FeedbackAggregator(events, { groupByDocumentType: true });
      const patterns2 = aggregator2.getFalsePositivePatterns();
      expect(patterns2).to.have.length(2);
    });

    it('should optionally preserve case', function () {
      const events = [
        createEvent('mark_as_not_pii', 'PERSON_NAME', 'John SMITH'),
        createEvent('mark_as_not_pii', 'PERSON_NAME', 'john smith'),
      ];

      // With normalization (default)
      const aggregator1 = new FeedbackAggregator(events, { normalizeCase: true });
      const patterns1 = aggregator1.getFalsePositivePatterns();
      expect(patterns1).to.have.length(1);
      expect(patterns1[0].count).to.equal(2);

      // Without normalization
      const aggregator2 = new FeedbackAggregator(events, { normalizeCase: false });
      const patterns2 = aggregator2.getFalsePositivePatterns();
      expect(patterns2).to.have.length(2);
    });
  });

  describe('createAggregator Factory', function () {
    it('should create aggregator with options', function () {
      const events = [createEvent('mark_as_not_pii', 'PERSON_NAME', 'Test')];
      const aggregator = createAggregator(events, { maxPatterns: 5 });

      expect(aggregator).to.be.instanceOf(FeedbackAggregator);
    });
  });

  describe('Legacy Entry Conversion', function () {
    it('should convert legacy entries using fromLegacyEntries', function () {
      const legacyEntries = [
        {
          id: 'test-1',
          timestamp: '2025-01-15T10:00:00Z',
          action: 'DISMISS',
          entityType: 'PERSON_NAME',
          context: 'Dismissed: [PERSON]',
          documentHash: 'abc123',
          originalSource: 'ML',
          confidence: 0.75,
        },
        {
          id: 'test-2',
          timestamp: '2025-01-15T11:00:00Z',
          action: 'ADD',
          entityType: 'EMAIL',
          context: 'Added: [EMAIL]',
          documentHash: 'abc123',
        },
      ];

      const aggregator = FeedbackAggregator.fromLegacyEntries(legacyEntries, 'desktop');
      const summary = aggregator.summarize();

      expect(summary.totalEvents).to.equal(2);
      expect(summary.byAction.mark_as_not_pii).to.equal(1);
      expect(summary.byAction.mark_as_pii).to.equal(1);
      expect(summary.bySource.desktop).to.equal(2);
    });
  });
});

// Helper functions to create test events

function createEvent(action, entityType, text, confidence) {
  const entity = {
    text,
    type: entityType,
    start: 0,
    end: text.length,
    confidence,
  };

  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    timestamp: new Date().toISOString(),
    source: 'desktop',
    documentId: 'test-doc-hash',
    action,
    originalEntity: action === 'mark_as_not_pii' ? entity : undefined,
    updatedEntity: action === 'mark_as_pii' ? entity : undefined,
  };
}

function createEventWithSource(action, entityType, text, source) {
  const event = createEvent(action, entityType, text);
  if (event.originalEntity) {
    event.originalEntity.source = source;
  }
  return event;
}

function createEventWithTimestamp(action, entityType, text, timestamp) {
  const event = createEvent(action, entityType, text);
  event.timestamp = timestamp;
  return event;
}
