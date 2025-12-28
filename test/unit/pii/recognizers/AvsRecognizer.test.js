/**
 * Unit tests for AvsRecognizer
 *
 * Tests cover:
 * - AVS number detection (with/without dots)
 * - EAN-13 checksum validation
 * - Language/country support
 * - Static helper methods
 *
 * @module test/unit/pii/recognizers/AvsRecognizer.test
 */

import { expect } from 'chai';
import { AvsRecognizer, DenyList } from '../../../../shared/dist/pii/index.js';

describe('AvsRecognizer', function () {
  let recognizer;

  beforeEach(function () {
    recognizer = new AvsRecognizer();
    DenyList.reset();
  });

  describe('config', function () {
    it('should have name "SwissAVS"', function () {
      expect(recognizer.config.name).to.equal('SwissAVS');
    });

    it('should support DE, FR, IT, EN languages (AC-8.5.3)', function () {
      expect(recognizer.supportsLanguage('de')).to.be.true;
      expect(recognizer.supportsLanguage('fr')).to.be.true;
      expect(recognizer.supportsLanguage('it')).to.be.true;
      expect(recognizer.supportsLanguage('en')).to.be.true;
    });

    it('should support CH country only (AC-8.5.3)', function () {
      expect(recognizer.supportsCountry('CH')).to.be.true;
      expect(recognizer.supportsCountry('US')).to.be.false;
      expect(recognizer.supportsCountry('DE')).to.be.false;
    });

    it('should have priority 70 (high for country-specific)', function () {
      expect(recognizer.config.priority).to.equal(70);
    });

    it('should have specificity "country"', function () {
      expect(recognizer.config.specificity).to.equal('country');
    });

    it('should include context words (AC-8.5.4)', function () {
      const words = recognizer.config.contextWords;
      expect(words).to.include('ahv');
      expect(words).to.include('avs');
      expect(words).to.include('sozialversicherung');
    });
  });

  describe('analyze() - AVS with dots format', function () {
    it('should detect valid AVS with dots', function () {
      // Generate a valid AVS with checksum
      const validAvs = AvsRecognizer.format(AvsRecognizer.generateWithChecksum('756123456789'));
      const text = `My AVS is ${validAvs}`;
      const matches = recognizer.analyze(text);

      expect(matches).to.have.lengthOf(1);
      expect(matches[0].type).to.equal('SWISS_AVS');
      expect(matches[0].confidence).to.equal(0.7);
    });

    it('should NOT detect AVS with invalid checksum', function () {
      // 756.1234.5678.99 has invalid checksum
      const matches = recognizer.analyze('My AVS is 756.1234.5678.99');

      expect(matches).to.be.empty;
    });
  });

  describe('analyze() - AVS without dots format', function () {
    it('should detect valid AVS without dots', function () {
      const validAvs = AvsRecognizer.generateWithChecksum('756123456789');
      const text = `My AVS is ${validAvs}`;
      const matches = recognizer.analyze(text);

      expect(matches).to.have.lengthOf(1);
      expect(matches[0].type).to.equal('SWISS_AVS');
      expect(matches[0].confidence).to.equal(0.6); // Lower confidence for no-dots format
    });

    it('should NOT detect AVS without dots with invalid checksum', function () {
      const matches = recognizer.analyze('My AVS is 7561234567899');

      expect(matches).to.be.empty;
    });
  });

  describe('Checksum validation (AC-8.5.5)', function () {
    const _validNumbers = [
      '756.1234.5678.97', // Valid checksum
    ];

    const invalidNumbers = [
      '756.1234.5678.00', // Invalid checksum
      '756.1234.5678.99', // Invalid checksum
      '756.0000.0000.00', // Invalid checksum
    ];

    it('should accept valid checksums', function () {
      // Use generateWithChecksum to create valid numbers
      const valid = AvsRecognizer.generateWithChecksum('756123456789');
      const formatted = AvsRecognizer.format(valid);
      const matches = recognizer.analyze(`AVS: ${formatted}`);

      expect(matches.length).to.be.at.least(1);
    });

    for (const invalidAvs of invalidNumbers) {
      it(`should reject invalid checksum: ${invalidAvs}`, function () {
        const matches = recognizer.analyze(`AVS: ${invalidAvs}`);
        expect(matches).to.be.empty;
      });
    }

    it('should validate that 756 prefix is required', function () {
      // Even with valid EAN-13 checksum, wrong prefix should fail
      const matches = recognizer.analyze('123.4567.8901.23');

      expect(matches).to.be.empty;
    });
  });

  describe('Static helpers', function () {
    describe('format()', function () {
      it('should format AVS with dots', function () {
        expect(AvsRecognizer.format('7561234567897')).to.equal('756.1234.5678.97');
      });

      it('should handle already formatted AVS', function () {
        const result = AvsRecognizer.format('756.1234.5678.97');
        expect(result).to.equal('756.1234.5678.97');
      });

      it('should return as-is for invalid length', function () {
        expect(AvsRecognizer.format('756123')).to.equal('756123');
      });
    });

    describe('generateWithChecksum()', function () {
      it('should generate valid 13-digit AVS from 12-digit input', function () {
        const result = AvsRecognizer.generateWithChecksum('756123456789');

        expect(result).to.have.lengthOf(13);
        expect(result.startsWith('756')).to.be.true;
      });

      it('should generate AVS that passes checksum validation', function () {
        const result = AvsRecognizer.generateWithChecksum('756123456789');
        const formatted = AvsRecognizer.format(result);
        const matches = recognizer.analyze(formatted);

        expect(matches).to.have.lengthOf(1);
      });

      it('should throw for invalid partial input', function () {
        expect(() => AvsRecognizer.generateWithChecksum('12345')).to.throw();
        expect(() => AvsRecognizer.generateWithChecksum('123456789012')).to.throw(/756/);
      });
    });
  });

  describe('Known valid AVS numbers', function () {
    // These are publicly known test AVS numbers
    const knownValid = [
      AvsRecognizer.generateWithChecksum('756123456789'),
      AvsRecognizer.generateWithChecksum('756000000000'),
      AvsRecognizer.generateWithChecksum('756987654321'),
    ];

    for (const avs of knownValid) {
      it(`should detect generated valid AVS: ${avs}`, function () {
        const matches = recognizer.analyze(avs);
        expect(matches).to.have.lengthOf(1);
      });
    }
  });

  describe('Edge cases', function () {
    it('should not match partial AVS numbers', function () {
      const matches = recognizer.analyze('756.1234');
      expect(matches).to.be.empty;
    });

    it('should detect multiple AVS numbers', function () {
      const avs1 = AvsRecognizer.generateWithChecksum('756111111111');
      const avs2 = AvsRecognizer.generateWithChecksum('756222222222');
      const text = `AVS 1: ${AvsRecognizer.format(avs1)}, AVS 2: ${AvsRecognizer.format(avs2)}`;

      const matches = recognizer.analyze(text);
      expect(matches).to.have.lengthOf(2);
    });

    it('should handle empty text', function () {
      const matches = recognizer.analyze('');
      expect(matches).to.be.empty;
    });

    it('should handle text with no numbers', function () {
      const matches = recognizer.analyze('No numbers here at all');
      expect(matches).to.be.empty;
    });
  });
});
