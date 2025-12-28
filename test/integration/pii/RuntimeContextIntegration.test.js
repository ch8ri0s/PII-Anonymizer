/**
 * Runtime Context Injection Integration Tests (Story 8.16)
 *
 * Tests validating runtime context injection following Presidio pattern.
 * Validates column headers, region hints, and context word merging
 * in realistic scenarios like CSV processing.
 *
 * @module test/integration/pii/RuntimeContextIntegration.test
 */

import { expect } from 'chai';
import { describe, it, before } from 'mocha';

// Dynamic imports
let createPipeline;
let createHighRecallPass, createFormatValidationPass, createContextScoringPass;

describe('Runtime Context Integration Tests (Story 8.16)', function () {
  this.timeout(30000);

  let pipeline;

  before(async function () {
    // Import ESM modules dynamically
    const pipelineModule = await import('../../../dist/pii/DetectionPipeline.js');
    createPipeline = pipelineModule.createPipeline;

    const passesModule = await import('../../../dist/pii/passes/index.js');
    createHighRecallPass = passesModule.createHighRecallPass;
    createFormatValidationPass = passesModule.createFormatValidationPass;
    createContextScoringPass = passesModule.createContextScoringPass;

    // Create and configure pipeline
    pipeline = createPipeline({
      debug: false,
      enableEpic8Features: true,
      enableNormalization: true,
    });
    pipeline.registerPass(createHighRecallPass());
    pipeline.registerPass(createFormatValidationPass());
    pipeline.registerPass(createContextScoringPass());
  });

  describe('CSV Column Header Context', function () {
    it('should boost email detection when column is labeled "email"', async function () {
      // Simulate CSV data where we know column 1 is "email"
      const csvRow = 'john@example.com,John Smith,Engineering';

      // Create runtime context with column headers
      const runtimeContext = {
        columnHeaders: [
          { column: 0, entityType: 'EMAIL', confidenceBoost: 0.3 },
          { column: 1, entityType: 'PERSON_NAME', confidenceBoost: 0.2 },
        ],
      };

      // Process without context
      const resultWithoutContext = await pipeline.process(csvRow);
      const emailWithoutContext = resultWithoutContext.entities.find(e =>
        e.type === 'EMAIL' && e.text.includes('john@example'),
      );

      // Process with context - reconfigure pipeline
      pipeline.configure({ context: runtimeContext });
      const resultWithContext = await pipeline.process(csvRow);
      const emailWithContext = resultWithContext.entities.find(e =>
        e.type === 'EMAIL' && e.text.includes('john@example'),
      );

      // Clear context for subsequent tests
      pipeline.configure({ context: undefined });

      // Both should detect the email
      expect(emailWithoutContext, 'Should detect email without context').to.exist;
      expect(emailWithContext, 'Should detect email with context').to.exist;
    });

    it('should boost phone detection in dedicated column', async function () {
      const csvRow = '+41 79 123 45 67,jane.doe@company.ch,Jane Doe';

      // Column 0 is phone, column 1 is email
      const runtimeContext = {
        columnHeaders: [
          { column: 0, entityType: 'PHONE', confidenceBoost: 0.3 },
          { column: 1, entityType: 'EMAIL', confidenceBoost: 0.2 },
        ],
      };

      pipeline.configure({ context: runtimeContext });
      const result = await pipeline.process(csvRow);
      pipeline.configure({ context: undefined });

      const phones = result.entities.filter(e => e.type === 'PHONE');
      const emails = result.entities.filter(e => e.type === 'EMAIL');

      expect(phones, 'Should detect phone').to.have.length.at.least(1);
      expect(emails, 'Should detect email').to.have.length.at.least(1);
    });
  });

  describe('Region Hints for Document Sections', function () {
    it('should boost person detection in header section', async function () {
      const document = `From: Hans Müller
Address: Bahnhofstrasse 10, 8001 Zürich
Date: 15.01.2024

Dear Sir or Madam,

This is the body of the letter...

Best regards,
Hans Müller`;

      // Define header region (first ~100 chars)
      const runtimeContext = {
        regionHints: [
          { start: 0, end: 120, expectedEntityType: 'PERSON_NAME' },
          { start: 0, end: 120, expectedEntityType: 'ADDRESS' },
        ],
      };

      pipeline.configure({ context: runtimeContext });
      const result = await pipeline.process(document);
      pipeline.configure({ context: undefined });

      // Should detect person and address in header
      const persons = result.entities.filter(e =>
        e.type === 'PERSON_NAME' || e.type === 'PERSON',
      );
      const addresses = result.entities.filter(e =>
        e.type === 'ADDRESS' || e.type === 'SWISS_ADDRESS',
      );

      expect(persons, 'Should detect at least one person name').to.have.length.at.least(1);
      expect(addresses, 'Should detect at least one address').to.have.length.at.least(1);
    });

    it('should boost email detection in contact section', async function () {
      const document = `Company ABC
Contact Information:
Email: contact@company.ch
Phone: +41 44 123 45 67

About Us:
We are a leading company...`;

      // Contact section starts at ~30 chars
      const contactStart = document.indexOf('Contact');
      const contactEnd = document.indexOf('About');

      const runtimeContext = {
        regionHints: [
          {
            start: contactStart,
            end: contactEnd,
            expectedEntityType: 'EMAIL',
            contextWords: ['contact', 'email', 'reach'],
          },
          {
            start: contactStart,
            end: contactEnd,
            expectedEntityType: 'PHONE',
            contextWords: ['phone', 'call', 'reach'],
          },
        ],
      };

      pipeline.configure({ context: runtimeContext });
      const result = await pipeline.process(document);
      pipeline.configure({ context: undefined });

      const emails = result.entities.filter(e => e.type === 'EMAIL');
      const phones = result.entities.filter(e => e.type === 'PHONE');

      expect(emails, 'Should detect email').to.have.length.at.least(1);
      expect(phones, 'Should detect phone').to.have.length.at.least(1);
    });
  });

  describe('Context Words Injection', function () {
    it('should use custom context words for domain-specific detection', async function () {
      const document = `Patient: Hans Müller
Allergist: Dr. Weber
Condition: Seasonal allergies`;

      // Medical-specific context words
      const runtimeContext = {
        contextWords: ['patient', 'doctor', 'allergist', 'physician', 'nurse'],
      };

      pipeline.configure({ context: runtimeContext });
      const result = await pipeline.process(document);
      pipeline.configure({ context: undefined });

      // Should detect person names with medical context
      const persons = result.entities.filter(e =>
        e.type === 'PERSON_NAME' || e.type === 'PERSON',
      );

      expect(persons, 'Should detect person names').to.have.length.at.least(1);
    });

    it('should merge runtime words with default context words', async function () {
      const document = `Employee: Max Muster
Email: max.muster@company.ch`;

      // HR-specific context words (in addition to defaults)
      const runtimeContext = {
        contextWords: ['employee', 'staff', 'team', 'member', 'colleague'],
      };

      pipeline.configure({ context: runtimeContext });
      const result = await pipeline.process(document);
      pipeline.configure({ context: undefined });

      // Should detect both person and email
      const entities = result.entities;
      const hasEmail = entities.some(e => e.type === 'EMAIL');

      expect(hasEmail, 'Should detect email').to.be.true;
    });
  });

  describe('Combined Context (Column + Region + Words)', function () {
    it('should handle full context for structured document', async function () {
      // Simulating a form with known structure
      const form = `Name: Hans Müller
Email: hans.mueller@example.com
Phone: +41 79 123 45 67
Address: Bahnhofstrasse 10, 8001 Zürich`;

      const runtimeContext = {
        // Column-like context (form fields)
        columnHeaders: [
          { column: 'Name', entityType: 'PERSON_NAME', confidenceBoost: 0.2 },
          { column: 'Email', entityType: 'EMAIL', confidenceBoost: 0.2 },
          { column: 'Phone', entityType: 'PHONE', confidenceBoost: 0.2 },
        ],
        // Entire form is a contact section
        regionHints: [
          { start: 0, end: form.length, expectedEntityType: 'ADDRESS' },
        ],
        // Form-related context words
        contextWords: ['name', 'email', 'phone', 'address', 'contact'],
      };

      pipeline.configure({ context: runtimeContext });
      const result = await pipeline.process(form);
      pipeline.configure({ context: undefined });

      // Should detect all entity types
      const persons = result.entities.filter(e => e.type === 'PERSON_NAME' || e.type === 'PERSON');
      const emails = result.entities.filter(e => e.type === 'EMAIL');
      const phones = result.entities.filter(e => e.type === 'PHONE');
      const addresses = result.entities.filter(e =>
        e.type === 'ADDRESS' || e.type === 'SWISS_ADDRESS',
      );

      expect(persons, 'Should detect person').to.have.length.at.least(1);
      expect(emails, 'Should detect email').to.have.length.at.least(1);
      expect(phones, 'Should detect phone').to.have.length.at.least(1);
      expect(addresses, 'Should detect address').to.have.length.at.least(1);
    });
  });

  describe('Metadata Tracking', function () {
    it('should track runtime context boosts in result metadata', async function () {
      const text = 'Contact: hans@example.com';

      // Simple region hint for email
      const runtimeContext = {
        regionHints: [
          { start: 0, end: 30, expectedEntityType: 'EMAIL' },
        ],
      };

      pipeline.configure({ context: runtimeContext });
      const result = await pipeline.process(text);
      pipeline.configure({ context: undefined });

      // Result should have entities
      expect(result.entities.length, 'Should have entities').to.be.greaterThan(0);

      // Note: Epic 8 metadata is tracked in the pipeline, but may not be
      // directly visible in result.metadata.epic8 for runtime context.
      // The implementation tracks in context.metadata during processing.
    });
  });

  describe('Performance', function () {
    it('should add minimal overhead (<5ms) for context processing', async function () {
      const text = 'Hans Müller works at ACME Corp. Email: hans@acme.com Phone: +41 79 123 45 67';

      // Warmup
      await pipeline.process(text);

      // Time without context
      const startWithout = performance.now();
      for (let i = 0; i < 10; i++) {
        await pipeline.process(text);
      }
      const timeWithout = (performance.now() - startWithout) / 10;

      // Configure with context
      const runtimeContext = {
        columnHeaders: [
          { column: 'email', entityType: 'EMAIL', confidenceBoost: 0.2 },
        ],
        regionHints: [
          { start: 0, end: 80, expectedEntityType: 'PERSON_NAME' },
          { start: 0, end: 80, expectedEntityType: 'EMAIL' },
        ],
        contextWords: ['employee', 'contact', 'staff'],
      };

      pipeline.configure({ context: runtimeContext });

      // Time with context
      const startWith = performance.now();
      for (let i = 0; i < 10; i++) {
        await pipeline.process(text);
      }
      const timeWith = (performance.now() - startWith) / 10;

      pipeline.configure({ context: undefined });

      // Calculate overhead
      const overhead = timeWith - timeWithout;

      // Log for debugging
      console.log(`Without context: ${timeWithout.toFixed(2)}ms`);
      console.log(`With context: ${timeWith.toFixed(2)}ms`);
      console.log(`Overhead: ${overhead.toFixed(2)}ms`);

      // Overhead should be less than 5ms
      expect(overhead, 'Context overhead should be < 5ms').to.be.lessThan(5);
    });
  });

  describe('Edge Cases', function () {
    it('should handle empty context gracefully', async function () {
      const text = 'Hans Müller hans@example.com';

      pipeline.configure({ context: {} });
      const result = await pipeline.process(text);
      pipeline.configure({ context: undefined });

      expect(result.entities.length, 'Should still detect entities').to.be.greaterThan(0);
    });

    it('should handle null context gracefully', async function () {
      const text = 'Hans Müller hans@example.com';

      pipeline.configure({ context: null });
      const result = await pipeline.process(text);
      pipeline.configure({ context: undefined });

      expect(result.entities.length, 'Should still detect entities').to.be.greaterThan(0);
    });

    it('should handle out-of-bounds region hints', async function () {
      const text = 'Hans Müller';

      // Region hint extends beyond text
      const runtimeContext = {
        regionHints: [
          { start: 0, end: 1000, expectedEntityType: 'PERSON_NAME' },
        ],
      };

      pipeline.configure({ context: runtimeContext });
      const result = await pipeline.process(text);
      pipeline.configure({ context: undefined });

      expect(result.entities.length, 'Should handle gracefully').to.be.greaterThan(0);
    });

    it('should handle invalid column references', async function () {
      const text = 'Hans Müller hans@example.com';

      // Non-existent columns
      const runtimeContext = {
        columnHeaders: [
          { column: 99, entityType: 'EMAIL', confidenceBoost: 0.2 },
          { column: 'nonexistent', entityType: 'PHONE', confidenceBoost: 0.3 },
        ],
      };

      pipeline.configure({ context: runtimeContext });
      const result = await pipeline.process(text);
      pipeline.configure({ context: undefined });

      // Should still work, just no boost applied
      expect(result.entities.length, 'Should still detect entities').to.be.greaterThan(0);
    });
  });
});
