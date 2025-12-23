/**
 * E2E Tests for File Download Pipeline (Browser)
 *
 * Tests the complete pipeline from:
 * 1. Processing file → Entity detection
 * 2. Entity review state → Selection/rejection
 * 3. Selective anonymization → Output generation
 * 4. Download functions → Correct file content
 *
 * Uses shared test utilities from @shared-test for consistency
 * with Electron tests in test/integration/downloadPipeline.test.js
 */

import { describe, it, expect } from 'vitest';
import {
  createMockProcessingResult,
  createMockEntityReviewState,
  getReviewResult,
  applySelectiveAnonymization,
  generateMarkdownOutput,
  generateMappingOutput,
  type EntityReviewState,
} from '@shared-test/index';

describe('E2E: File Download Pipeline (Browser)', () => {
  describe('Complete Pipeline: All Entities Approved', () => {
    it('should anonymize all entities when all are approved', () => {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      expect(markdownOutput).toBe('Contact PER_1 at EMAIL_1. Regards, ORG_1');
      expect(markdownOutput).not.toContain('John Doe');
      expect(markdownOutput).not.toContain('john@example.com');
      expect(markdownOutput).not.toContain('Acme Corp');
    });

    it('should include all entities in mapping file', () => {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(mappingOutput.entities).toHaveProperty('John Doe', 'PER_1');
      expect(mappingOutput.entities).toHaveProperty('john@example.com', 'EMAIL_1');
      expect(mappingOutput.entities).toHaveProperty('Acme Corp', 'ORG_1');
      expect(Object.keys(mappingOutput.entities)).toHaveLength(3);
    });
  });

  describe('Complete Pipeline: Some Entities Rejected', () => {
    it('should preserve rejected entities in original form', () => {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Reject the email entity
      entityReviewState.entities[1].status = 'rejected';

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      expect(markdownOutput).toBe('Contact PER_1 at john@example.com. Regards, ORG_1');
      expect(markdownOutput).not.toContain('John Doe');
      expect(markdownOutput).toContain('john@example.com'); // Preserved!
      expect(markdownOutput).not.toContain('Acme Corp');
    });

    it('should exclude rejected entities from mapping file', () => {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Reject the email entity
      entityReviewState.entities[1].status = 'rejected';

      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(mappingOutput.entities).toHaveProperty('John Doe', 'PER_1');
      expect(mappingOutput.entities).not.toHaveProperty('john@example.com');
      expect(mappingOutput.entities).toHaveProperty('Acme Corp', 'ORG_1');
      expect(Object.keys(mappingOutput.entities)).toHaveLength(2);
    });

    it('should handle multiple rejections correctly', () => {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Reject person and organization, keep only email
      entityReviewState.entities[0].status = 'rejected';
      entityReviewState.entities[2].status = 'rejected';

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      expect(markdownOutput).toBe('Contact John Doe at EMAIL_1. Regards, Acme Corp');
      expect(markdownOutput).toContain('John Doe'); // Preserved
      expect(markdownOutput).toContain('EMAIL_1'); // Anonymized
      expect(markdownOutput).toContain('Acme Corp'); // Preserved
    });
  });

  describe('Complete Pipeline: All Entities Rejected', () => {
    it('should output original markdown when all rejected', () => {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Reject all entities
      entityReviewState.entities.forEach(e => {
        e.status = 'rejected';
      });

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      expect(markdownOutput).toBe(processingResult.originalMarkdown);
    });

    it('should have empty entities in mapping file when all rejected', () => {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Reject all entities
      entityReviewState.entities.forEach(e => {
        e.status = 'rejected';
      });

      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(Object.keys(mappingOutput.entities)).toHaveLength(0);
    });
  });

  describe('IPC Pipeline: originalMarkdown Passthrough', () => {
    it('should fail gracefully if originalMarkdown is missing', () => {
      const processingResult = createMockProcessingResult();
      // @ts-expect-error - intentionally testing missing property
      delete processingResult.originalMarkdown;

      const entityReviewState = createMockEntityReviewState(processingResult);

      expect(() => {
        generateMarkdownOutput(processingResult, entityReviewState);
      }).toThrow('originalMarkdown not available');
    });

    it('should handle empty originalMarkdown', () => {
      const processingResult = createMockProcessingResult();
      processingResult.originalMarkdown = '';

      const entityReviewState = createMockEntityReviewState(processingResult);

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      expect(markdownOutput).toBe('');
    });

    it('should use originalMarkdown, not sanitizedMarkdown for output', () => {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Reject email - the output should use original markdown + selective anonymization
      entityReviewState.entities[1].status = 'rejected';

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);

      // If we incorrectly used sanitizedMarkdown, email would still be anonymized
      // With originalMarkdown + selective anonymization, email should be preserved
      expect(markdownOutput).toContain('john@example.com');
      expect(markdownOutput).not.toContain('EMAIL_1');
    });
  });

  describe('Manual PII Marking Integration', () => {
    it('should include manual entities in markdown output', () => {
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

      expect(markdownOutput).toContain('MANUAL_MISC_1');
      expect(markdownOutput).not.toContain('ABC123');
    });

    it('should include manual entities in mapping file', () => {
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

      expect(mappingOutput.entities).toHaveProperty('SecretCode', 'MANUAL_MISC_1');
    });

    it('should not include rejected manual entities', () => {
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
        status: 'rejected',
        flaggedForReview: false,
        position: null,
        context: null,
        editedReplacement: null,
      });

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);
      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(markdownOutput).toContain('ABC123'); // Preserved
      expect(mappingOutput.entities).not.toHaveProperty('ABC123');
    });
  });

  describe('Edited Replacement Integration', () => {
    it('should use editedReplacement when entity was edited', () => {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Edit the person entity replacement
      entityReviewState.entities[0].status = 'edited';
      entityReviewState.entities[0].editedReplacement = 'CUSTOM_NAME_1';

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);
      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(markdownOutput).toContain('CUSTOM_NAME_1');
      expect(markdownOutput).not.toContain('PER_1');
      expect(mappingOutput.entities['John Doe']).toBe('CUSTOM_NAME_1');
    });

    it('should fall back to original replacement if editedReplacement is null', () => {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      // Set status to edited but no editedReplacement
      entityReviewState.entities[0].status = 'edited';
      entityReviewState.entities[0].editedReplacement = null;

      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(mappingOutput.entities['John Doe']).toBe('PER_1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle entities with special regex characters', () => {
      const processingResult = {
        ...createMockProcessingResult(),
        originalMarkdown: 'Contact test.user@example.com or user+tag@test.com',
      };

      const entityReviewState: EntityReviewState = {
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

      expect(markdownOutput).toBe('Contact EMAIL_1 or EMAIL_2');
    });

    it('should handle overlapping entity text by processing longest first', () => {
      const processingResult = {
        ...createMockProcessingResult(),
        originalMarkdown: 'John Doe Jr. works here',
      };

      const entityReviewState: EntityReviewState = {
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

      // Should use longer entity first
      expect(markdownOutput).toBe('PER_FULL_1 works here');
      expect(markdownOutput).not.toContain('PER_1');
    });

    it('should handle multiple occurrences of same entity', () => {
      const processingResult = {
        ...createMockProcessingResult(),
        originalMarkdown: 'John Doe met with John Doe to discuss John Doe project',
      };

      const entityReviewState: EntityReviewState = {
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

      expect(markdownOutput).toBe('PER_1 met with PER_1 to discuss PER_1 project');
      expect(markdownOutput.match(/PER_1/g)).toHaveLength(3);
    });
  });

  describe('Mapping File Structure', () => {
    it('should have correct mapping file structure', () => {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(mappingOutput).toHaveProperty('version', '2.0');
      expect(mappingOutput).toHaveProperty('originalFile', 'test-document.docx');
      expect(mappingOutput).toHaveProperty('timestamp');
      expect(mappingOutput).toHaveProperty('model');
      expect(mappingOutput).toHaveProperty('detectionMethods');
      expect(mappingOutput).toHaveProperty('entities');
      expect(mappingOutput.detectionMethods).toBeInstanceOf(Array);
    });

    it('should have ISO timestamp format', () => {
      const processingResult = createMockProcessingResult();
      const entityReviewState = createMockEntityReviewState(processingResult);

      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/;
      expect(mappingOutput.timestamp).toMatch(isoRegex);
    });
  });

  describe('Empty State Handling', () => {
    it('should handle empty entity list', () => {
      const processingResult = {
        ...createMockProcessingResult(),
        originalMarkdown: 'No PII in this document.',
      };

      const entityReviewState: EntityReviewState = {
        entities: [],
        filters: { types: [], minConfidence: 0, showFlaggedOnly: false, statusFilter: 'all', searchText: '' },
        groupExpanded: {},
      };

      const markdownOutput = generateMarkdownOutput(processingResult, entityReviewState);
      const mappingOutput = generateMappingOutput(processingResult, entityReviewState);

      expect(markdownOutput).toBe('No PII in this document.');
      expect(Object.keys(mappingOutput.entities)).toHaveLength(0);
    });
  });
});
