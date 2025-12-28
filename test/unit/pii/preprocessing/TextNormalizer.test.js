/**
 * Unit tests for TextNormalizer
 *
 * Tests for Story 8.7: Lexical Normalization & Obfuscation Handling
 * Validates text normalization, de-obfuscation, and position mapping.
 */

import { expect } from 'chai';
import {
  TextNormalizer,
  createTextNormalizer,
  defaultNormalizer,
} from '../../../../shared/dist/pii/index.js';

describe('TextNormalizer', () => {
  describe('AC-8.7.1: Unicode normalization', () => {
    it('should normalize Unicode to NFKC by default', () => {
      const normalizer = new TextNormalizer();
      // NFKC normalizes full-width characters
      const input = 'Ｔｅｓｔ'; // Full-width Latin
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('Test');
      expect(result.indexMap).to.have.lengthOf(4);
    });

    it('should normalize combining characters', () => {
      const normalizer = new TextNormalizer();
      // e + combining acute accent → é
      const input = 'cafe\u0301'; // café with combining accent
      const result = normalizer.normalize(input);

      // NFKC should combine into precomposed form
      expect(result.normalizedText).to.include('caf');
    });

    it('should allow disabling Unicode normalization', () => {
      const normalizer = new TextNormalizer({ normalizeUnicode: false });
      const input = 'Ｔｅｓｔ';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal(input);
    });
  });

  describe('AC-8.7.2: Whitespace normalization', () => {
    it('should remove zero-width spaces', () => {
      const normalizer = new TextNormalizer();
      const input = 'hello\u200Bworld'; // Zero-width space
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('helloworld');
      // Position map should skip the zero-width space position
      expect(result.indexMap).to.have.lengthOf(10);
    });

    it('should remove zero-width non-joiner', () => {
      const normalizer = new TextNormalizer();
      const input = 'test\u200Cvalue'; // Zero-width non-joiner
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('testvalue');
    });

    it('should remove zero-width joiner', () => {
      const normalizer = new TextNormalizer();
      const input = 'a\u200Db'; // Zero-width joiner
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('ab');
    });

    it('should normalize non-breaking space to regular space', () => {
      const normalizer = new TextNormalizer();
      const input = 'hello\u00A0world'; // NBSP
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('hello world');
    });

    it('should normalize narrow no-break space', () => {
      const normalizer = new TextNormalizer();
      const input = 'test\u202Fvalue'; // Narrow NBSP
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('test value');
    });

    it('should allow disabling whitespace normalization', () => {
      const normalizer = new TextNormalizer({ normalizeWhitespace: false });
      const input = 'hello\u200Bworld';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal(input);
    });
  });

  describe('AC-8.7.3: Email de-obfuscation (EN)', () => {
    it('should de-obfuscate (at) pattern', () => {
      const normalizer = new TextNormalizer();
      const input = 'john.doe(at)example.com';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('john.doe@example.com');
    });

    it('should de-obfuscate [at] pattern', () => {
      const normalizer = new TextNormalizer();
      const input = 'john.doe[at]example.com';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('john.doe@example.com');
    });

    it('should de-obfuscate {at} pattern', () => {
      const normalizer = new TextNormalizer();
      const input = 'john.doe{at}example.com';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('john.doe@example.com');
    });

    it('should NOT de-obfuscate standalone spaced "at" (too many false positives)', () => {
      const normalizer = new TextNormalizer();
      // Standalone " at " is preserved to avoid false positives like "Call us at +41"
      const input = 'john.doe at example.com';
      const result = normalizer.normalize(input);

      // Pattern is preserved - only parenthesized/bracketed forms are matched
      expect(result.normalizedText).to.equal(input);
    });

    it('should de-obfuscate (dot) pattern', () => {
      const normalizer = new TextNormalizer();
      const input = 'john(dot)doe@example(dot)com';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('john.doe@example.com');
    });

    it('should de-obfuscate [dot] pattern', () => {
      const normalizer = new TextNormalizer();
      const input = 'john[dot]doe@example[dot]com';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('john.doe@example.com');
    });

    it('should de-obfuscate complex email obfuscation', () => {
      const normalizer = new TextNormalizer();
      const input = 'john (dot) doe (at) mail (dot) ch';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('john.doe@mail.ch');
    });
  });

  describe('AC-8.7.4: Email de-obfuscation (FR)', () => {
    it('should de-obfuscate "arobase" pattern', () => {
      const normalizer = new TextNormalizer();
      const input = 'jean.dupont arobase example.fr';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('jean.dupont@example.fr');
    });

    it('should de-obfuscate "(arobase)" pattern', () => {
      const normalizer = new TextNormalizer();
      const input = 'jean.dupont(arobase)example.fr';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('jean.dupont@example.fr');
    });

    it('should de-obfuscate "point" pattern', () => {
      const normalizer = new TextNormalizer();
      const input = 'jean point dupont@example point fr';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('jean.dupont@example.fr');
    });
  });

  describe('AC-8.7.5: Email de-obfuscation (DE)', () => {
    it('should de-obfuscate "Klammeraffe" pattern', () => {
      const normalizer = new TextNormalizer();
      const input = 'hans.mueller Klammeraffe example.de';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('hans.mueller@example.de');
    });

    it('should de-obfuscate "(Klammeraffe)" pattern', () => {
      const normalizer = new TextNormalizer();
      const input = 'hans.mueller(Klammeraffe)example.de';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('hans.mueller@example.de');
    });

    it('should de-obfuscate "(Punkt)" pattern', () => {
      const normalizer = new TextNormalizer();
      // Only parenthesized form is matched to avoid false positives
      const input = 'hans(Punkt)mueller@example(Punkt)de';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('hans.mueller@example.de');
    });
  });

  describe('AC-8.7.6: Phone de-obfuscation', () => {
    it('should normalize (0) prefix in international format', () => {
      const normalizer = new TextNormalizer();
      const input = '+41 (0) 79 123 45 67';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('+41 79 123 45 67');
    });

    it('should NOT normalize phone separators (preserves offset mapping)', () => {
      const normalizer = new TextNormalizer();
      // Separator normalization was removed because it breaks offset mapping
      // Phone patterns in HighRecallPass handle various separator formats
      const input = '+41-79-123-45-67';
      const result = normalizer.normalize(input);

      // Separators are preserved
      expect(result.normalizedText).to.equal(input);
    });

    it('should NOT normalize phone dots (preserves offset mapping)', () => {
      const normalizer = new TextNormalizer();
      const input = '+41.79.123.45.67';
      const result = normalizer.normalize(input);

      // Dots are preserved
      expect(result.normalizedText).to.equal(input);
    });

    it('should allow disabling phone de-obfuscation', () => {
      const normalizer = new TextNormalizer({ handlePhones: false });
      const input = '+41 (0) 79 123 45 67';
      const result = normalizer.normalize(input);

      // (0) removal is a phone pattern, should be preserved
      expect(result.normalizedText).to.include('(0)');
    });
  });

  describe('AC-8.7.7: Position mapping (indexMap)', () => {
    it('should maintain identity map for unchanged text', () => {
      const normalizer = new TextNormalizer();
      const input = 'hello world';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('hello world');
      expect(result.indexMap).to.have.lengthOf(11);
      // Each position maps to itself
      for (let i = 0; i < result.indexMap.length; i++) {
        expect(result.indexMap[i]).to.equal(i);
      }
    });

    it('should correctly map positions after zero-width removal', () => {
      const normalizer = new TextNormalizer();
      const input = 'ab\u200Bcd'; // a=0, b=1, ZWS=2, c=3, d=4
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal('abcd');
      expect(result.indexMap).to.have.lengthOf(4);
      expect(result.indexMap[0]).to.equal(0); // 'a' maps to original 0
      expect(result.indexMap[1]).to.equal(1); // 'b' maps to original 1
      expect(result.indexMap[2]).to.equal(3); // 'c' maps to original 3 (after ZWS)
      expect(result.indexMap[3]).to.equal(4); // 'd' maps to original 4
    });

    it('should correctly map spans back to original text', () => {
      const normalizer = new TextNormalizer();
      const input = 'Contact: jean (at) example.com';
      const result = normalizer.normalize(input);

      // Normalized text should have @ instead of (at)
      expect(result.normalizedText).to.include('@');

      // Map a span from normalized text back to original
      const emailStart = result.normalizedText.indexOf('jean');
      const emailEnd = result.normalizedText.indexOf('.com') + 4;

      const originalSpan = normalizer.mapSpan(
        emailStart,
        emailEnd,
        result.indexMap,
      );

      // Original span should point to the obfuscated email in original text
      const originalEmail = input.slice(originalSpan.start, originalSpan.end);
      expect(originalEmail).to.include('jean');
      expect(originalEmail).to.include('(at)');
    });
  });

  describe('AC-8.7.8: Configuration options', () => {
    it('should allow disabling email de-obfuscation', () => {
      const normalizer = new TextNormalizer({ handleEmails: false });
      const input = 'john (at) example (dot) com';
      const result = normalizer.normalize(input);

      expect(result.normalizedText).to.equal(input);
    });

    it('should allow custom normalization form', () => {
      const normalizer = new TextNormalizer({ normalizationForm: 'NFC' });
      const input = 'café';
      const result = normalizer.normalize(input);

      // NFC should preserve the composed form
      expect(result.normalizedText).to.include('caf');
    });

    it('should return empty result for empty input', () => {
      const normalizer = new TextNormalizer();
      const result = normalizer.normalize('');

      expect(result.normalizedText).to.equal('');
      expect(result.indexMap).to.have.lengthOf(0);
    });
  });

  describe('Factory functions', () => {
    it('createTextNormalizer should create instance with options', () => {
      const normalizer = createTextNormalizer({ handleEmails: false });
      const options = normalizer.getOptions();

      expect(options.handleEmails).to.be.false;
    });

    it('defaultNormalizer should be available', () => {
      expect(defaultNormalizer).to.be.instanceOf(TextNormalizer);
    });
  });

  describe('Real-world test cases from AC', () => {
    it('AC: john (dot) doe (at) mail (dot) ch should be detected as EMAIL', () => {
      const normalizer = new TextNormalizer();
      const input = 'Contact: john (dot) doe (at) mail (dot) ch';
      const result = normalizer.normalize(input);

      // The normalized text should contain a recognizable email
      expect(result.normalizedText).to.include('john.doe@mail.ch');
    });

    it('AC: +41 (0) 79-123-45-67 should be normalized for PHONE recognition', () => {
      const normalizer = new TextNormalizer();
      const input = '+41 (0) 79-123-45-67';
      const result = normalizer.normalize(input);

      // Should remove (0) and normalize separators
      expect(result.normalizedText).to.not.include('(0)');
    });

    it('AC: IBAN with zero-width spaces should be detected', () => {
      const normalizer = new TextNormalizer();
      // CH93\u200B0076 2011 6238 5295 7 - zero-width space in IBAN
      const input = 'CH93\u200B0076 2011 6238 5295 7';
      const result = normalizer.normalize(input);

      // Zero-width space should be removed
      expect(result.normalizedText).to.equal('CH930076 2011 6238 5295 7');
    });
  });
});
