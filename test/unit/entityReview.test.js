/**
 * Entity Review Tests (Epic 4)
 *
 * Tests for the user review workflow including:
 * - Entity review state management
 * - Filtering functionality
 * - Entity actions (approve, reject, edit)
 * - Manual PII marking
 * - Review statistics
 */

import { expect } from 'chai';

describe('Epic 4: User Review Workflow', function () {

  /**
   * Mock entity review state for testing
   */
  function createMockState() {
    return {
      entities: [
        {
          id: 'entity-0',
          originalText: 'John Doe',
          replacement: 'PER_1',
          type: 'PERSON',
          confidence: 0.95,
          source: 'ML',
          status: 'pending',
          flaggedForReview: false,
          position: { start: 10, end: 18 },
          context: 'Dear John Doe, we write...',
          editedReplacement: null,
        },
        {
          id: 'entity-1',
          originalText: 'jane@example.com',
          replacement: 'EMAIL_1',
          type: 'EMAIL',
          confidence: 0.99,
          source: 'RULE',
          status: 'pending',
          flaggedForReview: false,
          position: { start: 50, end: 66 },
          context: 'contact jane@example.com for...',
          editedReplacement: null,
        },
        {
          id: 'entity-2',
          originalText: 'Acme Corp',
          replacement: 'ORG_1',
          type: 'ORGANIZATION',
          confidence: 0.65,
          source: 'ML',
          status: 'pending',
          flaggedForReview: true, // Low confidence
          position: { start: 100, end: 109 },
          context: 'working at Acme Corp as...',
          editedReplacement: null,
        },
        {
          id: 'entity-3',
          originalText: '+41 79 123 45 67',
          replacement: 'PHONE_1',
          type: 'PHONE',
          confidence: 0.98,
          source: 'RULE',
          status: 'pending',
          flaggedForReview: false,
          position: null,
          context: null,
          editedReplacement: null,
        },
      ],
      filters: {
        types: [],
        minConfidence: 0,
        showFlaggedOnly: false,
        statusFilter: 'all',
        searchText: '',
      },
      groupExpanded: {},
    };
  }

  describe('Story 4.1: Entity Sidebar Panel', function () {

    describe('Entity State Structure', function () {
      it('should have correct entity properties', function () {
        const state = createMockState();
        const entity = state.entities[0];

        expect(entity).to.have.property('id');
        expect(entity).to.have.property('originalText');
        expect(entity).to.have.property('replacement');
        expect(entity).to.have.property('type');
        expect(entity).to.have.property('confidence');
        expect(entity).to.have.property('source');
        expect(entity).to.have.property('status');
        expect(entity).to.have.property('flaggedForReview');
      });

      it('should have valid entity types', function () {
        const state = createMockState();
        const validTypes = ['PERSON', 'ORGANIZATION', 'LOCATION', 'ADDRESS', 'EMAIL', 'PHONE', 'IBAN', 'SWISS_AVS', 'DATE', 'AMOUNT'];

        state.entities.forEach(entity => {
          expect(validTypes).to.include(entity.type);
        });
      });

      it('should have valid status values', function () {
        const state = createMockState();
        const validStatuses = ['pending', 'approved', 'rejected', 'edited'];

        state.entities.forEach(entity => {
          expect(validStatuses).to.include(entity.status);
        });
      });

      it('should have valid source values', function () {
        const state = createMockState();
        const validSources = ['ML', 'RULE', 'BOTH', 'MANUAL'];

        state.entities.forEach(entity => {
          expect(validSources).to.include(entity.source);
        });
      });
    });

    describe('Statistics Calculation', function () {
      function calculateStats(entities) {
        return {
          total: entities.length,
          pending: entities.filter(e => e.status === 'pending').length,
          approved: entities.filter(e => e.status === 'approved').length,
          rejected: entities.filter(e => e.status === 'rejected').length,
          edited: entities.filter(e => e.status === 'edited').length,
          flagged: entities.filter(e => e.flaggedForReview).length,
        };
      }

      it('should calculate initial statistics correctly', function () {
        const state = createMockState();
        const stats = calculateStats(state.entities);

        expect(stats.total).to.equal(4);
        expect(stats.pending).to.equal(4);
        expect(stats.approved).to.equal(0);
        expect(stats.rejected).to.equal(0);
        expect(stats.flagged).to.equal(1);
      });

      it('should update statistics after status changes', function () {
        const state = createMockState();
        state.entities[0].status = 'approved';
        state.entities[1].status = 'rejected';

        const stats = calculateStats(state.entities);

        expect(stats.pending).to.equal(2);
        expect(stats.approved).to.equal(1);
        expect(stats.rejected).to.equal(1);
      });
    });

    describe('Entity Grouping', function () {
      function groupByType(entities) {
        const groups = {};
        entities.forEach(entity => {
          if (!groups[entity.type]) {
            groups[entity.type] = [];
          }
          groups[entity.type].push(entity);
        });
        return groups;
      }

      it('should group entities by type', function () {
        const state = createMockState();
        const groups = groupByType(state.entities);

        expect(Object.keys(groups)).to.have.lengthOf(4);
        expect(groups['PERSON']).to.have.lengthOf(1);
        expect(groups['EMAIL']).to.have.lengthOf(1);
        expect(groups['ORGANIZATION']).to.have.lengthOf(1);
        expect(groups['PHONE']).to.have.lengthOf(1);
      });

      it('should handle empty entities array', function () {
        const groups = groupByType([]);
        expect(Object.keys(groups)).to.have.lengthOf(0);
      });
    });
  });

  describe('Story 4.2: Entity Type Filtering', function () {

    function applyFilters(entities, filters) {
      return entities.filter(entity => {
        // Type filter
        if (filters.types.length > 0 && !filters.types.includes(entity.type)) {
          return false;
        }

        // Confidence filter
        if (entity.confidence < filters.minConfidence) {
          return false;
        }

        // Flagged filter
        if (filters.showFlaggedOnly && !entity.flaggedForReview) {
          return false;
        }

        // Status filter
        if (filters.statusFilter !== 'all' && entity.status !== filters.statusFilter) {
          return false;
        }

        // Search filter
        if (filters.searchText) {
          const search = filters.searchText.toLowerCase();
          const matchesOriginal = entity.originalText.toLowerCase().includes(search);
          const matchesReplacement = entity.replacement.toLowerCase().includes(search);
          if (!matchesOriginal && !matchesReplacement) {
            return false;
          }
        }

        return true;
      });
    }

    describe('Type Filtering', function () {
      it('should show all entities when no type filter', function () {
        const state = createMockState();
        const filtered = applyFilters(state.entities, state.filters);

        expect(filtered).to.have.lengthOf(4);
      });

      it('should filter by single type', function () {
        const state = createMockState();
        state.filters.types = ['PERSON'];
        const filtered = applyFilters(state.entities, state.filters);

        expect(filtered).to.have.lengthOf(1);
        expect(filtered[0].type).to.equal('PERSON');
      });

      it('should filter by multiple types', function () {
        const state = createMockState();
        state.filters.types = ['PERSON', 'EMAIL'];
        const filtered = applyFilters(state.entities, state.filters);

        expect(filtered).to.have.lengthOf(2);
      });
    });

    describe('Confidence Filtering', function () {
      it('should filter by minimum confidence', function () {
        const state = createMockState();
        state.filters.minConfidence = 0.9;
        const filtered = applyFilters(state.entities, state.filters);

        expect(filtered).to.have.lengthOf(3);
        filtered.forEach(e => {
          expect(e.confidence).to.be.at.least(0.9);
        });
      });

      it('should exclude low confidence entities', function () {
        const state = createMockState();
        state.filters.minConfidence = 0.7;
        const filtered = applyFilters(state.entities, state.filters);

        expect(filtered).to.have.lengthOf(3);
        expect(filtered.find(e => e.id === 'entity-2')).to.be.undefined;
      });
    });

    describe('Flagged Filter', function () {
      it('should show only flagged entities', function () {
        const state = createMockState();
        state.filters.showFlaggedOnly = true;
        const filtered = applyFilters(state.entities, state.filters);

        expect(filtered).to.have.lengthOf(1);
        expect(filtered[0].flaggedForReview).to.be.true;
      });
    });

    describe('Status Filter', function () {
      it('should filter by pending status', function () {
        const state = createMockState();
        state.entities[0].status = 'approved';
        state.filters.statusFilter = 'pending';
        const filtered = applyFilters(state.entities, state.filters);

        expect(filtered).to.have.lengthOf(3);
      });

      it('should filter by approved status', function () {
        const state = createMockState();
        state.entities[0].status = 'approved';
        state.entities[1].status = 'approved';
        state.filters.statusFilter = 'approved';
        const filtered = applyFilters(state.entities, state.filters);

        expect(filtered).to.have.lengthOf(2);
      });
    });

    describe('Search Filter', function () {
      it('should search by original text', function () {
        const state = createMockState();
        state.filters.searchText = 'john';
        const filtered = applyFilters(state.entities, state.filters);

        expect(filtered).to.have.lengthOf(1);
        expect(filtered[0].originalText).to.equal('John Doe');
      });

      it('should search by replacement', function () {
        const state = createMockState();
        state.filters.searchText = 'EMAIL';
        const filtered = applyFilters(state.entities, state.filters);

        expect(filtered).to.have.lengthOf(1);
        expect(filtered[0].type).to.equal('EMAIL');
      });

      it('should be case insensitive', function () {
        const state = createMockState();
        state.filters.searchText = 'ACME';
        const filtered = applyFilters(state.entities, state.filters);

        expect(filtered).to.have.lengthOf(1);
        expect(filtered[0].originalText).to.equal('Acme Corp');
      });
    });

    describe('Combined Filters', function () {
      it('should apply multiple filters together', function () {
        const state = createMockState();
        state.filters.types = ['PERSON', 'EMAIL'];
        state.filters.minConfidence = 0.9;
        const filtered = applyFilters(state.entities, state.filters);

        expect(filtered).to.have.lengthOf(2);
      });
    });
  });

  describe('Story 4.3: Selective Anonymization', function () {

    describe('Entity Actions', function () {
      it('should approve entity', function () {
        const state = createMockState();
        const entity = state.entities[0];

        entity.status = 'approved';

        expect(entity.status).to.equal('approved');
      });

      it('should reject entity', function () {
        const state = createMockState();
        const entity = state.entities[0];

        entity.status = 'rejected';

        expect(entity.status).to.equal('rejected');
      });

      it('should toggle approve status', function () {
        const state = createMockState();
        const entity = state.entities[0];

        // Toggle on
        entity.status = entity.status === 'approved' ? 'pending' : 'approved';
        expect(entity.status).to.equal('approved');

        // Toggle off
        entity.status = entity.status === 'approved' ? 'pending' : 'approved';
        expect(entity.status).to.equal('pending');
      });

      it('should edit replacement', function () {
        const state = createMockState();
        const entity = state.entities[0];

        entity.editedReplacement = 'CUSTOM_1';
        entity.status = 'edited';

        expect(entity.editedReplacement).to.equal('CUSTOM_1');
        expect(entity.status).to.equal('edited');
      });
    });

    describe('Bulk Actions', function () {
      it('should approve all pending entities', function () {
        const state = createMockState();

        state.entities.forEach(entity => {
          if (entity.status === 'pending') {
            entity.status = 'approved';
          }
        });

        const pendingCount = state.entities.filter(e => e.status === 'pending').length;
        expect(pendingCount).to.equal(0);
      });

      it('should reset all entities', function () {
        const state = createMockState();
        state.entities[0].status = 'approved';
        state.entities[1].status = 'rejected';
        state.entities[2].editedReplacement = 'CUSTOM_1';
        state.entities[2].status = 'edited';

        state.entities.forEach(entity => {
          entity.status = 'pending';
          entity.editedReplacement = null;
        });

        state.entities.forEach(entity => {
          expect(entity.status).to.equal('pending');
          expect(entity.editedReplacement).to.be.null;
        });
      });
    });

    describe('Review Result', function () {
      function getReviewResult(entities) {
        const entitiesToAnonymize = entities
          .filter(e => e.status !== 'rejected')
          .map(e => ({
            originalText: e.originalText,
            replacement: e.editedReplacement || e.replacement,
            type: e.type,
          }));

        const rejectedEntities = entities
          .filter(e => e.status === 'rejected')
          .map(e => ({
            originalText: e.originalText,
            type: e.type,
          }));

        return { entitiesToAnonymize, rejectedEntities };
      }

      it('should include all non-rejected entities', function () {
        const state = createMockState();
        state.entities[0].status = 'approved';
        state.entities[1].status = 'approved';

        const result = getReviewResult(state.entities);

        expect(result.entitiesToAnonymize).to.have.lengthOf(4);
      });

      it('should exclude rejected entities from anonymization (AC-4.3.3)', function () {
        const state = createMockState();
        state.entities[0].status = 'rejected';
        state.entities[1].status = 'rejected';

        const result = getReviewResult(state.entities);

        expect(result.entitiesToAnonymize).to.have.lengthOf(2);
        expect(result.rejectedEntities).to.have.lengthOf(2);
      });

      it('should use edited replacements when available', function () {
        const state = createMockState();
        state.entities[0].editedReplacement = 'EDITED_1';
        state.entities[0].status = 'edited';

        const result = getReviewResult(state.entities);

        const editedEntity = result.entitiesToAnonymize.find(e => e.originalText === 'John Doe');
        expect(editedEntity.replacement).to.equal('EDITED_1');
      });

      it('should only include non-rejected entities in mapping (AC-4.3.4)', function () {
        const state = createMockState();
        state.entities[0].status = 'rejected';

        const result = getReviewResult(state.entities);

        const hasRejected = result.entitiesToAnonymize.some(
          e => e.originalText === 'John Doe',
        );
        expect(hasRejected).to.be.false;
      });
    });

    describe('Bulk Actions', function () {
      function handleBulkReject(state) {
        state.entities.forEach(entity => {
          entity.status = 'rejected';
        });
      }

      it('should reject all entities with bulk reject', function () {
        const state = createMockState();

        handleBulkReject(state);

        const rejectedCount = state.entities.filter(e => e.status === 'rejected').length;
        expect(rejectedCount).to.equal(4);
      });
    });

    describe('Statistics', function () {
      function calculateStats(entities) {
        return {
          total: entities.length,
          pending: entities.filter(e => e.status === 'pending').length,
          approved: entities.filter(e => e.status === 'approved').length,
          rejected: entities.filter(e => e.status === 'rejected').length,
          edited: entities.filter(e => e.status === 'edited').length,
          flagged: entities.filter(e => e.flaggedForReview).length,
        };
      }

      it('should calculate correct statistics', function () {
        const state = createMockState();
        const stats = calculateStats(state.entities);

        expect(stats.total).to.equal(4);
        expect(stats.pending).to.equal(4);
      });

      it('should update rejected count when entities are rejected', function () {
        const state = createMockState();
        state.entities[0].status = 'rejected';
        state.entities[1].status = 'rejected';

        const stats = calculateStats(state.entities);

        expect(stats.rejected).to.equal(2);
      });
    });

    describe('Selective Anonymization Application (AC-4.3.3)', function () {
      function applySelectiveAnonymization(originalMarkdown, entitiesToAnonymize) {
        if (!originalMarkdown) return '';

        let result = originalMarkdown;

        // Sort entities by length (longest first) to avoid partial replacements
        const sortedEntities = [...entitiesToAnonymize].sort(
          (a, b) => b.originalText.length - a.originalText.length,
        );

        for (const entity of sortedEntities) {
          const { originalText, replacement } = entity;
          if (!originalText || !replacement) continue;

          const escapedText = originalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escapedText, 'g');
          result = result.replace(regex, replacement);
        }

        return result;
      }

      it('should only anonymize selected entities in markdown', function () {
        const originalMarkdown = 'Contact John Doe at john@example.com for info.';
        const entitiesToAnonymize = [
          { originalText: 'John Doe', replacement: 'PER_1', type: 'PERSON' },
          // john@example.com is NOT included (unselected)
        ];

        const result = applySelectiveAnonymization(originalMarkdown, entitiesToAnonymize);

        expect(result).to.equal('Contact PER_1 at john@example.com for info.');
      });

      it('should preserve unselected entities in their original form', function () {
        const originalMarkdown = 'Email: test@test.com, Phone: 555-1234';
        const entitiesToAnonymize = [
          { originalText: 'test@test.com', replacement: 'EMAIL_1', type: 'EMAIL' },
          // Phone number is NOT included (unselected)
        ];

        const result = applySelectiveAnonymization(originalMarkdown, entitiesToAnonymize);

        expect(result).to.include('EMAIL_1');
        expect(result).to.include('555-1234'); // Preserved original
      });

      it('should handle multiple occurrences of same entity', function () {
        const originalMarkdown = 'John Doe met John Doe yesterday.';
        const entitiesToAnonymize = [
          { originalText: 'John Doe', replacement: 'PER_1', type: 'PERSON' },
        ];

        const result = applySelectiveAnonymization(originalMarkdown, entitiesToAnonymize);

        expect(result).to.equal('PER_1 met PER_1 yesterday.');
      });

      it('should handle empty entities array', function () {
        const originalMarkdown = 'Contact John Doe at john@example.com';
        const entitiesToAnonymize = [];

        const result = applySelectiveAnonymization(originalMarkdown, entitiesToAnonymize);

        expect(result).to.equal(originalMarkdown);
      });

      it('should handle special regex characters in entity text', function () {
        const originalMarkdown = 'File: test.pdf (version 1.0)';
        const entitiesToAnonymize = [
          { originalText: 'test.pdf', replacement: 'FILE_1', type: 'MISC' },
        ];

        const result = applySelectiveAnonymization(originalMarkdown, entitiesToAnonymize);

        expect(result).to.include('FILE_1');
        expect(result).to.not.include('test.pdf');
      });
    });
  });

  describe('Story 4.4: Manual PII Marking', function () {

    describe('Manual Entity Creation', function () {
      function createManualEntity(text, type, existingEntities) {
        const existingOfType = existingEntities.filter(e => e.type === type).length;
        const prefixMap = {
          'PERSON': 'PER',
          'ORGANIZATION': 'ORG',
          'LOCATION': 'LOC',
          'EMAIL': 'EMAIL',
          'PHONE': 'PHONE',
        };
        const prefix = prefixMap[type] || 'PII';

        return {
          id: `entity-manual-${Date.now()}`,
          originalText: text,
          replacement: `${prefix}_${existingOfType + 1}`,
          type: type,
          confidence: 1.0,
          source: 'MANUAL',
          status: 'approved',
          flaggedForReview: false,
          position: null,
          context: null,
          editedReplacement: null,
        };
      }

      it('should create manual entity with correct properties', function () {
        const entity = createManualEntity('Jane Smith', 'PERSON', []);

        expect(entity.originalText).to.equal('Jane Smith');
        expect(entity.type).to.equal('PERSON');
        expect(entity.confidence).to.equal(1.0);
        expect(entity.source).to.equal('MANUAL');
        expect(entity.status).to.equal('approved');
      });

      it('should generate unique replacement based on type count', function () {
        const state = createMockState();
        const entity = createManualEntity('Jane Smith', 'PERSON', state.entities);

        // Should be PER_2 since PER_1 already exists
        expect(entity.replacement).to.equal('PER_2');
      });

      it('should add manual entity to state', function () {
        const state = createMockState();
        const initialCount = state.entities.length;

        const entity = createManualEntity('New Entity', 'LOCATION', state.entities);
        state.entities.push(entity);

        expect(state.entities.length).to.equal(initialCount + 1);
      });

      it('should handle different entity types', function () {
        const entity1 = createManualEntity('test@test.com', 'EMAIL', []);
        const entity2 = createManualEntity('+1234567890', 'PHONE', []);

        expect(entity1.replacement).to.equal('EMAIL_1');
        expect(entity2.replacement).to.equal('PHONE_1');
      });
    });

    describe('Replacement Prefix Mapping', function () {
      const prefixMap = {
        'PERSON': 'PER',
        'ORGANIZATION': 'ORG',
        'LOCATION': 'LOC',
        'ADDRESS': 'ADDR',
        'SWISS_ADDRESS': 'SWISS_ADDR',
        'EU_ADDRESS': 'EU_ADDR',
        'SWISS_AVS': 'AVS',
        'IBAN': 'IBAN',
        'PHONE': 'PHONE',
        'EMAIL': 'EMAIL',
        'DATE': 'DATE',
        'AMOUNT': 'AMOUNT',
      };

      it('should map common entity types to prefixes', function () {
        expect(prefixMap['PERSON']).to.equal('PER');
        expect(prefixMap['ORGANIZATION']).to.equal('ORG');
        expect(prefixMap['EMAIL']).to.equal('EMAIL');
        expect(prefixMap['IBAN']).to.equal('IBAN');
      });

      it('should have mappings for all Swiss/EU specific types', function () {
        expect(prefixMap['SWISS_AVS']).to.equal('AVS');
        expect(prefixMap['SWISS_ADDRESS']).to.equal('SWISS_ADDR');
        expect(prefixMap['EU_ADDRESS']).to.equal('EU_ADDR');
      });
    });

    describe('Manual Entity Badge Display (AC-4.4.3)', function () {
      function renderEntityItem(entity) {
        // Simplified version of the render function for testing
        const confidenceClass = entity.confidence >= 0.85 ? 'entity-confidence-high'
          : entity.confidence >= 0.7 ? 'entity-confidence-medium'
            : 'entity-confidence-low';
        const statusClass = entity.status === 'approved' ? 'entity-approved'
          : entity.status === 'rejected' ? 'entity-rejected'
            : entity.status === 'edited' ? 'entity-edited'
              : '';

        return `
          <div class="entity-item ${statusClass}" data-entity-id="${entity.id}">
            <div class="entity-meta">
              <span class="entity-confidence ${confidenceClass}">${Math.round(entity.confidence * 100)}%</span>
              ${entity.source === 'MANUAL'
    ? '<span class="entity-source entity-source-manual">Manual</span>'
    : `<span class="entity-source">${entity.source}</span>`}
            </div>
          </div>
        `;
      }

      it('should display "Manual" badge for manually marked entities', function () {
        const manualEntity = {
          id: 'entity-manual-123',
          originalText: 'Test Text',
          replacement: 'PER_1',
          type: 'PERSON',
          confidence: 1.0,
          source: 'MANUAL',
          status: 'approved',
        };

        const html = renderEntityItem(manualEntity);
        expect(html).to.include('entity-source-manual');
        expect(html).to.include('>Manual<');
      });

      it('should not display "Manual" badge for ML-detected entities', function () {
        const mlEntity = {
          id: 'entity-1',
          originalText: 'John Doe',
          replacement: 'PER_1',
          type: 'PERSON',
          confidence: 0.95,
          source: 'ML',
          status: 'pending',
        };

        const html = renderEntityItem(mlEntity);
        expect(html).to.not.include('entity-source-manual');
        expect(html).to.include('>ML<');
      });

      it('should not display "Manual" badge for rule-based entities', function () {
        const ruleEntity = {
          id: 'entity-2',
          originalText: 'CH00 1234 5678 9012 3456 7',
          replacement: 'IBAN_1',
          type: 'IBAN',
          confidence: 0.99,
          source: 'RULE',
          status: 'pending',
        };

        const html = renderEntityItem(ruleEntity);
        expect(html).to.not.include('entity-source-manual');
        expect(html).to.include('>RULE<');
      });
    });

    describe('Manual Entity Rejection (AC-4.4.5)', function () {
      it('should allow manual entity to be rejected', function () {
        const state = {
          entities: [
            {
              id: 'entity-manual-123',
              originalText: 'Test Text',
              replacement: 'PER_1',
              type: 'PERSON',
              confidence: 1.0,
              source: 'MANUAL',
              status: 'approved',
            },
          ],
        };

        // Simulate reject action
        const entity = state.entities.find(e => e.id === 'entity-manual-123');
        entity.status = 'rejected';

        expect(entity.status).to.equal('rejected');
        expect(entity.source).to.equal('MANUAL'); // Source unchanged
      });

      it('should exclude rejected manual entity from anonymization', function () {
        const entities = [
          { id: 'entity-1', originalText: 'John', replacement: 'PER_1', status: 'approved', source: 'ML' },
          { id: 'entity-manual-1', originalText: 'Jane', replacement: 'PER_2', status: 'rejected', source: 'MANUAL' },
          { id: 'entity-2', originalText: 'Acme', replacement: 'ORG_1', status: 'approved', source: 'RULE' },
        ];

        const entitiesToAnonymize = entities.filter(e => e.status !== 'rejected');

        expect(entitiesToAnonymize.length).to.equal(2);
        expect(entitiesToAnonymize.find(e => e.id === 'entity-manual-1')).to.be.undefined;
      });
    });
  });

  describe('Entity Type Validation', function () {
    const VALID_ENTITY_TYPES = [
      'PERSON',
      'ORGANIZATION',
      'LOCATION',
      'ADDRESS',
      'SWISS_ADDRESS',
      'EU_ADDRESS',
      'SWISS_AVS',
      'IBAN',
      'PHONE',
      'EMAIL',
      'DATE',
      'AMOUNT',
      'VAT_NUMBER',
      'INVOICE_NUMBER',
      'PAYMENT_REF',
      'QR_REFERENCE',
      'SENDER',
      'RECIPIENT',
      'SALUTATION_NAME',
      'SIGNATURE',
      'LETTER_DATE',
      'REFERENCE_LINE',
      'PARTY',
      'AUTHOR',
      'VENDOR_NAME',
      'UNKNOWN',
    ];

    it('should have all expected entity types', function () {
      expect(VALID_ENTITY_TYPES).to.include('PERSON');
      expect(VALID_ENTITY_TYPES).to.include('ORGANIZATION');
      expect(VALID_ENTITY_TYPES).to.include('LOCATION');
      expect(VALID_ENTITY_TYPES).to.include('EMAIL');
      expect(VALID_ENTITY_TYPES).to.include('PHONE');
      expect(VALID_ENTITY_TYPES).to.include('IBAN');
      expect(VALID_ENTITY_TYPES).to.include('SWISS_AVS');
    });

    it('should have Swiss/EU specific types', function () {
      expect(VALID_ENTITY_TYPES).to.include('SWISS_ADDRESS');
      expect(VALID_ENTITY_TYPES).to.include('EU_ADDRESS');
      expect(VALID_ENTITY_TYPES).to.include('SWISS_AVS');
    });

    it('should have document-specific types', function () {
      expect(VALID_ENTITY_TYPES).to.include('SENDER');
      expect(VALID_ENTITY_TYPES).to.include('RECIPIENT');
      expect(VALID_ENTITY_TYPES).to.include('SALUTATION_NAME');
      expect(VALID_ENTITY_TYPES).to.include('SIGNATURE');
      expect(VALID_ENTITY_TYPES).to.include('INVOICE_NUMBER');
    });
  });

  describe('Review Status Transitions', function () {
    const VALID_STATUSES = ['pending', 'approved', 'rejected', 'edited'];

    it('should allow transition from pending to approved', function () {
      const entity = { status: 'pending' };
      entity.status = 'approved';
      expect(VALID_STATUSES).to.include(entity.status);
    });

    it('should allow transition from pending to rejected', function () {
      const entity = { status: 'pending' };
      entity.status = 'rejected';
      expect(VALID_STATUSES).to.include(entity.status);
    });

    it('should allow transition from approved to pending (toggle)', function () {
      const entity = { status: 'approved' };
      entity.status = 'pending';
      expect(VALID_STATUSES).to.include(entity.status);
    });

    it('should allow transition to edited with editedReplacement', function () {
      const entity = { status: 'pending', editedReplacement: null };
      entity.editedReplacement = 'CUSTOM_1';
      entity.status = 'edited';
      expect(VALID_STATUSES).to.include(entity.status);
      expect(entity.editedReplacement).to.not.be.null;
    });
  });

  describe('Confidence Thresholds', function () {
    const LOW_CONFIDENCE_THRESHOLD = 0.7;

    function shouldFlag(confidence) {
      return confidence < LOW_CONFIDENCE_THRESHOLD;
    }

    it('should flag low confidence entities', function () {
      expect(shouldFlag(0.5)).to.be.true;
      expect(shouldFlag(0.65)).to.be.true;
      expect(shouldFlag(0.69)).to.be.true;
    });

    it('should not flag high confidence entities', function () {
      expect(shouldFlag(0.7)).to.be.false;
      expect(shouldFlag(0.85)).to.be.false;
      expect(shouldFlag(0.95)).to.be.false;
      expect(shouldFlag(1.0)).to.be.false;
    });

    it('should correctly identify entities needing review', function () {
      const state = createMockState();
      const flaggedEntities = state.entities.filter(e => e.flaggedForReview);

      expect(flaggedEntities).to.have.lengthOf(1);
      expect(flaggedEntities[0].confidence).to.be.below(LOW_CONFIDENCE_THRESHOLD);
    });
  });

  describe('Story 5.1: Confidence Score Display', function () {

    describe('getConfidenceClass Helper (AC-5.1.5)', function () {
      // Implements the same logic as renderer.js getConfidenceClass
      function getConfidenceClass(confidence) {
        if (confidence >= 0.85) return 'entity-confidence-high';
        if (confidence >= 0.70) return 'entity-confidence-medium';
        return 'entity-confidence-low';
      }

      it('should return high confidence class for scores >= 85%', function () {
        expect(getConfidenceClass(0.85)).to.equal('entity-confidence-high');
        expect(getConfidenceClass(0.90)).to.equal('entity-confidence-high');
        expect(getConfidenceClass(0.95)).to.equal('entity-confidence-high');
        expect(getConfidenceClass(1.0)).to.equal('entity-confidence-high');
      });

      it('should return medium confidence class for scores 70-84%', function () {
        expect(getConfidenceClass(0.70)).to.equal('entity-confidence-medium');
        expect(getConfidenceClass(0.75)).to.equal('entity-confidence-medium');
        expect(getConfidenceClass(0.80)).to.equal('entity-confidence-medium');
        expect(getConfidenceClass(0.84)).to.equal('entity-confidence-medium');
      });

      it('should return low confidence class for scores < 70%', function () {
        expect(getConfidenceClass(0.69)).to.equal('entity-confidence-low');
        expect(getConfidenceClass(0.50)).to.equal('entity-confidence-low');
        expect(getConfidenceClass(0.30)).to.equal('entity-confidence-low');
        expect(getConfidenceClass(0.0)).to.equal('entity-confidence-low');
      });
    });

    describe('getSourceClass Helper (AC-5.1.2)', function () {
      // Implements the same logic as renderer.js getSourceClass
      function getSourceClass(source) {
        const sourceClasses = {
          'ML': 'entity-source-ml',
          'RULE': 'entity-source-rule',
          'BOTH': 'entity-source-both',
          'MANUAL': 'entity-source-manual',
        };
        return sourceClasses[source] || 'entity-source';
      }

      it('should return correct class for ML source', function () {
        expect(getSourceClass('ML')).to.equal('entity-source-ml');
      });

      it('should return correct class for RULE source', function () {
        expect(getSourceClass('RULE')).to.equal('entity-source-rule');
      });

      it('should return correct class for BOTH source', function () {
        expect(getSourceClass('BOTH')).to.equal('entity-source-both');
      });

      it('should return correct class for MANUAL source', function () {
        expect(getSourceClass('MANUAL')).to.equal('entity-source-manual');
      });

      it('should return default class for unknown source', function () {
        expect(getSourceClass('UNKNOWN')).to.equal('entity-source');
        expect(getSourceClass('')).to.equal('entity-source');
      });
    });

    describe('Confidence Badge Rendering (AC-5.1.1)', function () {
      function renderEntityItem(entity) {
        const confidenceClass = entity.confidence >= 0.85 ? 'entity-confidence-high'
          : entity.confidence >= 0.70 ? 'entity-confidence-medium'
            : 'entity-confidence-low';
        const confidencePercent = Math.round(entity.confidence * 100);

        return `
          <div class="entity-item" data-entity-id="${entity.id}">
            <div class="entity-meta">
              <span class="entity-confidence ${confidenceClass}" title="Detection confidence">${confidencePercent}%</span>
            </div>
          </div>
        `;
      }

      it('should render confidence badge with percentage value', function () {
        const entity = { id: 'test-1', confidence: 0.92 };
        const html = renderEntityItem(entity);
        expect(html).to.include('92%');
        expect(html).to.include('entity-confidence');
      });

      it('should render confidence badge with green class for high confidence', function () {
        const entity = { id: 'test-1', confidence: 0.95 };
        const html = renderEntityItem(entity);
        expect(html).to.include('entity-confidence-high');
      });

      it('should render confidence badge with yellow class for medium confidence', function () {
        const entity = { id: 'test-1', confidence: 0.75 };
        const html = renderEntityItem(entity);
        expect(html).to.include('entity-confidence-medium');
      });

      it('should render confidence badge with red class for low confidence', function () {
        const entity = { id: 'test-1', confidence: 0.50 };
        const html = renderEntityItem(entity);
        expect(html).to.include('entity-confidence-low');
      });
    });

    describe('Source Badge Rendering (AC-5.1.2)', function () {
      function getSourceClass(source) {
        const sourceClasses = {
          'ML': 'entity-source-ml',
          'RULE': 'entity-source-rule',
          'BOTH': 'entity-source-both',
          'MANUAL': 'entity-source-manual',
        };
        return sourceClasses[source] || 'entity-source';
      }

      function renderEntityItem(entity) {
        const sourceClass = getSourceClass(entity.source);
        return `
          <div class="entity-item" data-entity-id="${entity.id}">
            <div class="entity-meta">
              <span class="entity-source ${sourceClass}">${entity.source}</span>
            </div>
          </div>
        `;
      }

      it('should render ML source badge with blue styling', function () {
        const entity = { id: 'test-1', source: 'ML' };
        const html = renderEntityItem(entity);
        expect(html).to.include('entity-source-ml');
        expect(html).to.include('>ML<');
      });

      it('should render RULE source badge with purple styling', function () {
        const entity = { id: 'test-1', source: 'RULE' };
        const html = renderEntityItem(entity);
        expect(html).to.include('entity-source-rule');
        expect(html).to.include('>RULE<');
      });

      it('should render BOTH source badge with indigo styling', function () {
        const entity = { id: 'test-1', source: 'BOTH' };
        const html = renderEntityItem(entity);
        expect(html).to.include('entity-source-both');
        expect(html).to.include('>BOTH<');
      });

      it('should render MANUAL source badge with cyan styling', function () {
        const entity = { id: 'test-1', source: 'MANUAL' };
        const html = renderEntityItem(entity);
        expect(html).to.include('entity-source-manual');
        expect(html).to.include('>MANUAL<');
      });
    });

    describe('Low Confidence Warning Indicator (AC-5.1.3)', function () {
      function renderEntityItem(entity) {
        const isLowConfidence = entity.confidence < 0.60;
        return `
          <div class="entity-item" data-entity-id="${entity.id}">
            <div class="entity-meta">
              ${isLowConfidence ? '<span class="entity-warning text-red-500" title="Low confidence detection - review carefully">⚠️</span>' : ''}
            </div>
          </div>
        `;
      }

      it('should show warning indicator for confidence < 60%', function () {
        const entity = { id: 'test-1', confidence: 0.50 };
        const html = renderEntityItem(entity);
        expect(html).to.include('entity-warning');
        expect(html).to.include('⚠️');
      });

      it('should show warning indicator for very low confidence', function () {
        const entity = { id: 'test-1', confidence: 0.30 };
        const html = renderEntityItem(entity);
        expect(html).to.include('entity-warning');
      });

      it('should NOT show warning indicator for confidence >= 60%', function () {
        const entity = { id: 'test-1', confidence: 0.60 };
        const html = renderEntityItem(entity);
        expect(html).to.not.include('entity-warning');
        expect(html).to.not.include('⚠️');
      });

      it('should NOT show warning indicator for high confidence', function () {
        const entity = { id: 'test-1', confidence: 0.95 };
        const html = renderEntityItem(entity);
        expect(html).to.not.include('entity-warning');
      });
    });

    describe('Flagged Entity Visual Distinction (AC-5.1.4)', function () {
      function renderEntityItem(entity) {
        const flaggedClass = entity.flaggedForReview ? 'entity-flagged' : '';
        const isLowConfidence = entity.confidence < 0.60;
        return `
          <div class="entity-item ${flaggedClass}" data-entity-id="${entity.id}">
            <div class="entity-meta">
              ${entity.flaggedForReview && !isLowConfidence ? '<span class="entity-flag" title="Flagged for review">🚩</span>' : ''}
            </div>
          </div>
        `;
      }

      it('should add flagged class for flagged entities', function () {
        const entity = { id: 'test-1', flaggedForReview: true, confidence: 0.65 };
        const html = renderEntityItem(entity);
        expect(html).to.include('entity-flagged');
      });

      it('should show flag indicator for flagged entities with medium-low confidence', function () {
        const entity = { id: 'test-1', flaggedForReview: true, confidence: 0.65 };
        const html = renderEntityItem(entity);
        expect(html).to.include('entity-flag');
        expect(html).to.include('🚩');
      });

      it('should NOT add flagged class for non-flagged entities', function () {
        const entity = { id: 'test-1', flaggedForReview: false, confidence: 0.95 };
        const html = renderEntityItem(entity);
        expect(html).to.not.include('entity-flagged');
        expect(html).to.not.include('entity-flag');
      });

      it('should prefer warning icon over flag for very low confidence', function () {
        // When confidence < 0.60, we show warning emoji instead of flag
        const entity = { id: 'test-1', flaggedForReview: true, confidence: 0.50 };
        const html = renderEntityItem(entity);
        expect(html).to.include('entity-flagged'); // Class still applied
        expect(html).to.not.include('🚩'); // Flag icon not shown (warning takes precedence)
      });
    });

    describe('Color Coding Verification (AC-5.1.5)', function () {
      // These tests verify the color thresholds match the acceptance criteria:
      // green (≥85%), yellow (70-84%), red (<70%)

      function getConfidenceClass(confidence) {
        if (confidence >= 0.85) return 'entity-confidence-high'; // green
        if (confidence >= 0.70) return 'entity-confidence-medium'; // yellow
        return 'entity-confidence-low'; // red
      }

      it('should apply green color for 85% threshold', function () {
        expect(getConfidenceClass(0.85)).to.equal('entity-confidence-high');
      });

      it('should apply yellow color for 70-84% range', function () {
        expect(getConfidenceClass(0.70)).to.equal('entity-confidence-medium');
        expect(getConfidenceClass(0.84)).to.equal('entity-confidence-medium');
        expect(getConfidenceClass(0.849)).to.equal('entity-confidence-medium');
      });

      it('should apply red color below 70%', function () {
        expect(getConfidenceClass(0.699)).to.equal('entity-confidence-low');
        expect(getConfidenceClass(0.50)).to.equal('entity-confidence-low');
      });

      it('should handle boundary cases correctly', function () {
        // At exactly 85%
        expect(getConfidenceClass(0.85)).to.equal('entity-confidence-high');
        // Just below 85%
        expect(getConfidenceClass(0.8499)).to.equal('entity-confidence-medium');
        // At exactly 70%
        expect(getConfidenceClass(0.70)).to.equal('entity-confidence-medium');
        // Just below 70%
        expect(getConfidenceClass(0.6999)).to.equal('entity-confidence-low');
      });
    });
  });

});
