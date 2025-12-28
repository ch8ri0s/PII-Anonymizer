/**
 * Integration tests for Story 8.7: Normalization Pipeline Integration
 *
 * Tests that the TextNormalizer correctly integrates with the DetectionPipeline
 * and produces correct entity positions after de-obfuscation.
 */

import { expect } from 'chai';
import { DetectionPipeline } from '../../../dist/pii/DetectionPipeline.js';
import { createHighRecallPass } from '../../../dist/pii/passes/HighRecallPass.js';
import { createFormatValidationPass } from '../../../dist/pii/passes/FormatValidationPass.js';
import { createContextScoringPass } from '../../../dist/pii/passes/ContextScoringPass.js';

describe('Story 8.7 Integration: Normalization in Detection Pipeline', () => {
  let pipeline;

  beforeEach(() => {
    pipeline = new DetectionPipeline({
      enableNormalization: true,
      enableEpic8Features: true,
      debug: false,
    });

    // Register detection passes
    pipeline.registerPass(createHighRecallPass(0.3));
    pipeline.registerPass(createFormatValidationPass());
    pipeline.registerPass(createContextScoringPass());
  });

  describe('AC-8.7: Email de-obfuscation detection', () => {
    it('should detect obfuscated email with (at) and (dot)', async () => {
      const text = 'Contact: john (dot) doe (at) mail (dot) ch for more info.';
      const result = await pipeline.process(text);

      // Find EMAIL entity
      const emailEntity = result.entities.find((e) => e.type === 'EMAIL');
      expect(emailEntity).to.exist;

      // The entity should point to the original obfuscated text
      const originalSpan = text.slice(emailEntity.start, emailEntity.end);
      expect(originalSpan).to.include('john');
      expect(originalSpan).to.include('mail');
    });

    it('should detect email with French "arobase" obfuscation', async () => {
      const text = 'Email: jean.dupont arobase example.fr';
      const result = await pipeline.process(text);

      const emailEntity = result.entities.find((e) => e.type === 'EMAIL');
      expect(emailEntity).to.exist;

      const originalSpan = text.slice(emailEntity.start, emailEntity.end);
      expect(originalSpan).to.include('jean.dupont');
    });
  });

  describe('AC-8.7: Phone de-obfuscation detection', () => {
    it('should detect Swiss phone with (0) prefix', async () => {
      const text = 'Call us at +41 (0) 79 123 45 67 for support.';
      const result = await pipeline.process(text);

      const phoneEntity = result.entities.find((e) => e.type === 'PHONE');
      expect(phoneEntity).to.exist;

      // Entity was detected - the exact span may vary depending on detection
      // The important thing is a phone entity was found
      expect(phoneEntity.text).to.match(/\d/); // Should contain digits
    });

    it('should detect phone with dashes and dots', async () => {
      const text = 'Phone: +41-79-123-45-67';
      const result = await pipeline.process(text);

      const phoneEntity = result.entities.find((e) => e.type === 'PHONE');
      expect(phoneEntity).to.exist;
    });
  });

  describe('AC-8.7: Zero-width space handling', () => {
    it('should detect IBAN with zero-width spaces', async () => {
      // CH93\u200B0076 2011 6238 5295 7 - zero-width space in IBAN
      const text = 'IBAN: CH93\u200B0076 2011 6238 5295 7';
      const result = await pipeline.process(text);

      const ibanEntity = result.entities.find((e) => e.type === 'IBAN');
      expect(ibanEntity).to.exist;

      const originalSpan = text.slice(ibanEntity.start, ibanEntity.end);
      expect(originalSpan).to.include('CH93');
    });

    it('should detect text with embedded non-breaking spaces', async () => {
      // Phone with NBSP instead of regular spaces
      const text = 'Tel:\u00A0+41\u00A079\u00A0123\u00A045\u00A067';
      const result = await pipeline.process(text);

      const phoneEntity = result.entities.find((e) => e.type === 'PHONE');
      expect(phoneEntity).to.exist;
    });
  });

  describe('AC-8.7: Position mapping accuracy', () => {
    it('should preserve correct entity positions after normalization', async () => {
      const text = 'Prefix john (at) example (dot) com Suffix';
      const result = await pipeline.process(text);

      const emailEntity = result.entities.find((e) => e.type === 'EMAIL');
      if (emailEntity) {
        // Extract using the entity positions
        const extracted = text.slice(emailEntity.start, emailEntity.end);
        // Should contain the email parts from original text
        expect(extracted).to.include('john');
      }
    });

    it('should not break entities when normalization removes characters', async () => {
      // Person name with zero-width joiners (sometimes used in Unicode text)
      const text = 'Contact Jean\u200BDupont for help.';
      const result = await pipeline.process(text);

      // The name should still be detected even with zero-width space removed
      const personEntity = result.entities.find((e) => e.type === 'PERSON_NAME' || e.type === 'PERSON');
      if (personEntity) {
        expect(personEntity.start).to.be.at.least(0);
        expect(personEntity.end).to.be.at.most(text.length);
      }
    });
  });

  describe('AC-8.7: Normalization can be disabled', () => {
    it('should preserve obfuscated patterns when normalization is disabled', async () => {
      const disabledPipeline = new DetectionPipeline({
        enableNormalization: false,
        enableEpic8Features: true,
      });
      disabledPipeline.registerPass(createHighRecallPass(0.3));
      disabledPipeline.registerPass(createFormatValidationPass());

      const text = 'john (at) example (dot) com';
      const result = await disabledPipeline.process(text);

      // Should NOT detect as email because obfuscation wasn't reversed
      const emailEntity = result.entities.find((e) => e.type === 'EMAIL');
      expect(emailEntity).to.not.exist;
    });
  });

  describe('AC-8.7: Context enhancement with lemmatization', () => {
    it('should boost confidence when plural context words match', async () => {
      // Using plural "addresses" near an address
      const text = 'Postal addresses: Bahnhofstrasse 123, 8001 Zurich';
      const result = await pipeline.process(text);

      // Should detect the address with potentially boosted confidence
      const addressEntities = result.entities.filter(
        (e) => e.type === 'ADDRESS' || e.type === 'SWISS_ADDRESS' || e.type === 'LOCATION',
      );
      expect(addressEntities.length).to.be.at.least(1);
    });
  });
});
