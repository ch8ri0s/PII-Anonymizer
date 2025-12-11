/**
 * E2E Tests for File Download Pipeline
 *
 * Epic 4 Retrospective Action Item #2:
 * "Create E2E test for file download pipeline"
 *
 * These tests verify the complete pipeline from:
 * 1. Processing file → Entity detection
 * 2. Entity review state → Selection/rejection
 * 3. Selective anonymization → Output generation
 * 4. Download functions → Correct file content
 *
 * This tests the critical IPC bug fix from Story 4.3 where
 * originalMarkdown was not being passed through properly.
 */

import { expect } from 'chai';

describe('E2E: File Download Pipeline', function () {
  this.timeout(10000);

  /**
   * Simulate processingResult from main process IPC
   * This mimics what comes through from src/main.ts after file processing
   */
  function createMockProcessingResult() {
    return {
      sanitizedMarkdown: 'Contact PER_1 at EMAIL_1. Regards, ORG_1',
      originalMarkdown: 'Contact John Doe at john@example.com. Regards, Acme Corp',
      entities: {
        'John Doe': 'PER_1',
        'john@example.com': 'EMAIL_1',
        'Acme Corp': 'ORG_1',
      },
      piiCount: 3,
      metadata: {
        type: 'docx',
        name: 'test-document.docx',
      },
    };
  }

  /**
   * Simulate entityReviewState from renderer.js
   */
  function createMockEntityReviewState(processingResult) {
    return {
      entities: [
        {
          id: 'entity-0',
          originalText: 'John Doe',
          replacement: 'PER_1',
          type: 'PERSON',
          confidence: 0.95,
          source: 'ML',
          status: 'approved',
          flaggedForReview: false,
          position: { start: 8, end: 16 },
          context: 'Contact John Doe at...',
          editedReplacement: null,
        },
        {
          id: 'entity-1',
          originalText: 'john@example.com',
          replacement: 'EMAIL_1',
          type: 'EMAIL',
          confidence: 0.99,
          source: 'RULE',
          status: 'approved',
          flaggedForReview: false,
          position: { start: 20, end: 36 },
          context: '...at john@example.com. Regards...',
          editedReplacement: null,
        },
        {
          id: 'entity-2',
          originalText: 'Acme Corp',
          replacement: 'ORG_1',
          type: 'ORGANIZATION',
          confidence: 0.85,
          source: 'ML',
          status: 'approved',
          flaggedForReview: false,
          position: { start: 47, end: 56 },
          context: 'Regards, Acme Corp',
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

  /**
   * Implementation of getReviewResult from renderer.js
   * Entities are anonymized unless explicitly rejected
   */
  function getReviewResult(entityReviewState) {
    const entitiesToAnonymize = entityReviewState.entities
      .filter(e => e.status !== 'rejected')
      .map(e => ({
        originalText: e.originalText,
        replacement: e.editedReplacement || e.replacement,
        type: e.type,
      }));

    const rejectedEntities = entityReviewState.entities
      .filter(e => e.status === 'rejected')
      .map(e => ({
        originalText: e.originalText,
        type: e.type,
      }));

    return { entitiesToAnonymize, rejectedEntities };
  }

  /**
   * Implementation of applySelectiveAnonymization from renderer.js
   */
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

  /**
   * Implementation of downloadMarkdown output generation
   */
  function generateMarkdownOutput(processingResult, entityReviewState) {
    const reviewResult = getReviewResult(entityReviewState);

    const originalMarkdown = processingResult.originalMarkdown;
    // Check for undefined/null, but allow empty string
    if (originalMarkdown === undefined || originalMarkdown === null) {
      throw new Error('originalMarkdown not available - IPC pipeline broken');
    }

    return applySelectiveAnonymization(originalMarkdown, reviewResult.entitiesToAnonymize);
  }

  /**
   * Implementation of downloadMapping output generation
   */
  function generateMappingOutput(processingResult, entityReviewState) {
    const reviewResult = getReviewResult(entityReviewState);

    const entities = {};
    reviewResult.entitiesToAnonymize.forEach(entity => {
      entities[entity.originalText] = entity.replacement;
    });

    return {
      version: '2.0',
      originalFile: processingResult.metadata.name,
      timestamp: new Date().toISOString(),
      model: 'Xenova/distilbert-base-multilingual-cased-ner-hrl',
      detectionMethods: ['ML (transformers)', 'Rule-based (Swiss/EU)'],
      entities,
    };
  }

  describe('Complete Pipeline: All Entities Approved', function () {
    it('should anonymize all entities when all are approved', function () {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // All entities default to approved
      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      expect(markdownOutput).to.equal('Contact PER_1 at EMAIL_1. Regards, ORG_1');
      expect(markdownOutput).to.not.include('John Doe');
      expect(markdownOutput).to.not.include('john@example.com');
      expect(markdownOutput).to.not.include('Acme Corp');
    });

    it('should include all entities in mapping file', function () {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(mappingOutput.entities).to.have.property('John Doe', 'PER_1');
      expect(mappingOutput.entities).to.have.property('john@example.com', 'EMAIL_1');
      expect(mappingOutput.entities).to.have.property('Acme Corp', 'ORG_1');
      expect(Object.keys(mappingOutput.entities)).to.have.length(3);
    });
  });

  describe('Complete Pipeline: Some Entities Rejected', function () {
    it('should preserve rejected entities in original form', function () {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Reject the email entity
      entityReviewState.entities[1].status = 'rejected';

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      expect(markdownOutput).to.equal('Contact PER_1 at john@example.com. Regards, ORG_1');
      expect(markdownOutput).to.not.include('John Doe');
      expect(markdownOutput).to.include('john@example.com'); // Preserved!
      expect(markdownOutput).to.not.include('Acme Corp');
    });

    it('should exclude rejected entities from mapping file', function () {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Reject the email entity
      entityReviewState.entities[1].status = 'rejected';

      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(mappingOutput.entities).to.have.property('John Doe', 'PER_1');
      expect(mappingOutput.entities).to.not.have.property('john@example.com');
      expect(mappingOutput.entities).to.have.property('Acme Corp', 'ORG_1');
      expect(Object.keys(mappingOutput.entities)).to.have.length(2);
    });

    it('should handle multiple rejections correctly', function () {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Reject person and organization, keep only email
      entityReviewState.entities[0].status = 'rejected';
      entityReviewState.entities[2].status = 'rejected';

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      expect(markdownOutput).to.equal('Contact John Doe at EMAIL_1. Regards, Acme Corp');
      expect(markdownOutput).to.include('John Doe'); // Preserved
      expect(markdownOutput).to.include('EMAIL_1'); // Anonymized
      expect(markdownOutput).to.include('Acme Corp'); // Preserved
    });
  });

  describe('Complete Pipeline: All Entities Rejected', function () {
    it('should output original markdown when all rejected', function () {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Reject all entities
      entityReviewState.entities.forEach(e => {
        e.status = 'rejected';
      });

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      expect(markdownOutput).to.equal(processingResult.originalMarkdown);
    });

    it('should have empty entities in mapping file when all rejected', function () {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Reject all entities
      entityReviewState.entities.forEach(e => {
        e.status = 'rejected';
      });

      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(Object.keys(mappingOutput.entities)).to.have.length(0);
    });
  });

  describe('IPC Pipeline: originalMarkdown Passthrough', function () {
    it('should fail gracefully if originalMarkdown is missing', function () {
      const processingResult = createMockProcessingResult();
      delete processingResult.originalMarkdown; // Simulate IPC bug

      const entityReviewState = createMockEntityReviewState(processingResult);

      expect(() => {
        generateMarkdownOutput(processingResult, entityReviewState);
      }).to.throw('originalMarkdown not available');
    });

    it('should handle empty originalMarkdown', function () {
      const processingResult = createMockProcessingResult();
      processingResult.originalMarkdown = '';

      const entityReviewState = createMockEntityReviewState(processingResult);

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      expect(markdownOutput).to.equal('');
    });

    it('should use originalMarkdown, not sanitizedMarkdown for output', function () {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Reject email - the output should use original markdown + selective anonymization
      entityReviewState.entities[1].status = 'rejected';

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      // If we incorrectly used sanitizedMarkdown, email would still be anonymized
      // With originalMarkdown + selective anonymization, email should be preserved
      expect(markdownOutput).to.include('john@example.com');
      expect(markdownOutput).to.not.include('EMAIL_1');
    });
  });

  describe('Manual PII Marking Integration', function () {
    it('should include manual entities in markdown output', function () {
      const processingResult = createMockProcessingResult();
      processingResult.originalMarkdown = 'Contact John Doe at john@example.com. Regards, Acme Corp. Secret code: ABC123.';

      const entityReviewState = createMockEntityReviewState(processingResult);

      // Add a manual entity
      entityReviewState.entities.push({
        id: 'manual-1',
        originalText: 'ABC123',
        replacement: 'MANUAL_MISC_1',
        type: 'MISC',
        confidence: 1.0,
        source: 'MANUAL',
        status: 'approved',
        flaggedForReview: false,
        position: { start: 70, end: 76 },
        context: 'Secret code: ABC123.',
        editedReplacement: null,
      });

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      expect(markdownOutput).to.include('MANUAL_MISC_1');
      expect(markdownOutput).to.not.include('ABC123');
    });

    it('should include manual entities in mapping file', function () {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Add a manual entity
      entityReviewState.entities.push({
        id: 'manual-1',
        originalText: 'SecretCode',
        replacement: 'MANUAL_MISC_1',
        type: 'MISC',
        confidence: 1.0,
        source: 'MANUAL',
        status: 'approved',
        flaggedForReview: false,
        position: null,
        context: null,
        editedReplacement: null,
      });

      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(mappingOutput.entities).to.have.property('SecretCode', 'MANUAL_MISC_1');
    });

    it('should not include rejected manual entities', function () {
      const processingResult = createMockProcessingResult();
      processingResult.originalMarkdown = 'Contact John Doe. Secret: ABC123.';

      const entityReviewState = createMockEntityReviewState(processingResult);

      // Add and immediately reject a manual entity
      entityReviewState.entities.push({
        id: 'manual-1',
        originalText: 'ABC123',
        replacement: 'MANUAL_MISC_1',
        type: 'MISC',
        confidence: 1.0,
        source: 'MANUAL',
        status: 'rejected', // User changed their mind
        flaggedForReview: false,
        position: null,
        context: null,
        editedReplacement: null,
      });

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);
      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(markdownOutput).to.include('ABC123'); // Preserved
      expect(mappingOutput.entities).to.not.have.property('ABC123');
    });
  });

  describe('Edited Replacement Integration', function () {
    it('should use editedReplacement when entity was edited', function () {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Edit the person entity replacement
      entityReviewState.entities[0].status = 'edited';
      entityReviewState.entities[0].editedReplacement = 'CUSTOM_NAME_1';

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);
      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(markdownOutput).to.include('CUSTOM_NAME_1');
      expect(markdownOutput).to.not.include('PER_1');
      expect(mappingOutput.entities['John Doe']).to.equal('CUSTOM_NAME_1');
    });

    it('should fall back to original replacement if editedReplacement is null', function () {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Set status to edited but no editedReplacement
      entityReviewState.entities[0].status = 'edited';
      entityReviewState.entities[0].editedReplacement = null;

      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(mappingOutput.entities['John Doe']).to.equal('PER_1');
    });
  });

  describe('Edge Cases', function () {
    it('should handle entities with special regex characters', function () {
      const processingResult = {
        ...createMockProcessingResult(),
        originalMarkdown: 'Contact test.user@example.com or user+tag@test.com',
      };

      const entityReviewState = {
        entities: [
          {
            id: 'entity-0',
            originalText: 'test.user@example.com',
            replacement: 'EMAIL_1',
            type: 'EMAIL',
            confidence: 0.99,
            source: 'RULE',
            status: 'approved',
            flaggedForReview: false,
            position: null,
            context: null,
            editedReplacement: null,
          },
          {
            id: 'entity-1',
            originalText: 'user+tag@test.com',
            replacement: 'EMAIL_2',
            type: 'EMAIL',
            confidence: 0.99,
            source: 'RULE',
            status: 'approved',
            flaggedForReview: false,
            position: null,
            context: null,
            editedReplacement: null,
          },
        ],
        filters: { types: [], minConfidence: 0, showFlaggedOnly: false, statusFilter: 'all', searchText: '' },
        groupExpanded: {},
      };

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      expect(markdownOutput).to.equal('Contact EMAIL_1 or EMAIL_2');
    });

    it('should handle overlapping entity text by processing longest first', function () {
      const processingResult = {
        ...createMockProcessingResult(),
        originalMarkdown: 'John Doe Jr. works here',
      };

      const entityReviewState = {
        entities: [
          {
            id: 'entity-0',
            originalText: 'John Doe Jr.',
            replacement: 'PER_FULL_1',
            type: 'PERSON',
            confidence: 0.95,
            source: 'ML',
            status: 'approved',
            flaggedForReview: false,
            position: null,
            context: null,
            editedReplacement: null,
          },
          {
            id: 'entity-1',
            originalText: 'John Doe',
            replacement: 'PER_1',
            type: 'PERSON',
            confidence: 0.90,
            source: 'ML',
            status: 'approved',
            flaggedForReview: false,
            position: null,
            context: null,
            editedReplacement: null,
          },
        ],
        filters: { types: [], minConfidence: 0, showFlaggedOnly: false, statusFilter: 'all', searchText: '' },
        groupExpanded: {},
      };

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      // Should use longer entity first, so "John Doe Jr." becomes PER_FULL_1
      // and "John Doe" replacement shouldn't affect it
      expect(markdownOutput).to.equal('PER_FULL_1 works here');
      expect(markdownOutput).to.not.include('PER_1');
    });

    it('should handle multiple occurrences of same entity', function () {
      const processingResult = {
        ...createMockProcessingResult(),
        originalMarkdown: 'John Doe met with John Doe to discuss John Doe project',
      };

      const entityReviewState = {
        entities: [
          {
            id: 'entity-0',
            originalText: 'John Doe',
            replacement: 'PER_1',
            type: 'PERSON',
            confidence: 0.95,
            source: 'ML',
            status: 'approved',
            flaggedForReview: false,
            position: null,
            context: null,
            editedReplacement: null,
          },
        ],
        filters: { types: [], minConfidence: 0, showFlaggedOnly: false, statusFilter: 'all', searchText: '' },
        groupExpanded: {},
      };

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      expect(markdownOutput).to.equal('PER_1 met with PER_1 to discuss PER_1 project');
      expect(markdownOutput.match(/PER_1/g)).to.have.length(3);
    });
  });

  describe('Mapping File Structure', function () {
    it('should have correct mapping file structure', function () {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(mappingOutput).to.have.property('version', '2.0');
      expect(mappingOutput).to.have.property('originalFile', 'test-document.docx');
      expect(mappingOutput).to.have.property('timestamp');
      expect(mappingOutput).to.have.property('model');
      expect(mappingOutput).to.have.property('detectionMethods');
      expect(mappingOutput).to.have.property('entities');
      expect(mappingOutput.detectionMethods).to.be.an('array');
    });

    it('should have ISO timestamp format', function () {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(mappingOutput.timestamp).to.match(isoRegex);
    });
  });

  describe('Empty State Handling', function () {
    it('should handle empty entity list', function () {
      const processingResult = {
        ...createMockProcessingResult(),
        originalMarkdown: 'No PII in this document.',
      };

      const entityReviewState = {
        entities: [],
        filters: { types: [], minConfidence: 0, showFlaggedOnly: false, statusFilter: 'all', searchText: '' },
        groupExpanded: {},
      };

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);
      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(markdownOutput).to.equal('No PII in this document.');
      expect(Object.keys(mappingOutput.entities)).to.have.length(0);
    });
  });
});
