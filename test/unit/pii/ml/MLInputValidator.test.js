/**
 * MLInputValidator Tests (Story 8.12)
 *
 * Tests for the shared ML input validation utility that validates and
 * normalizes text before ML inference.
 */

import { expect } from 'chai';
import {
  validateMLInput,
  isValidMLInput,
  getValidationError,
  MLInputValidator,
  createMLInputValidator,
  DEFAULT_VALIDATION_CONFIG,
} from '../../../../shared/dist/pii/ml/MLInputValidator.js';

describe('MLInputValidator (Story 8.12)', function () {
  describe('validateMLInput', function () {
    describe('null/undefined handling', function () {
      it('should reject null input', function () {
        const result = validateMLInput(null);
        expect(result.valid).to.be.false;
        expect(result.error).to.equal('Input text is null or undefined');
      });

      it('should reject undefined input', function () {
        const result = validateMLInput(undefined);
        expect(result.valid).to.be.false;
        expect(result.error).to.equal('Input text is null or undefined');
      });

      it('should reject non-string types', function () {
        const result = validateMLInput(123);
        expect(result.valid).to.be.false;
        expect(result.error).to.include('must be a string');
        expect(result.error).to.include('number');
      });
    });

    describe('empty string handling', function () {
      it('should reject empty string by default', function () {
        const result = validateMLInput('');
        expect(result.valid).to.be.false;
        expect(result.error).to.equal('Input text is empty');
      });

      it('should reject whitespace-only string by default', function () {
        const result = validateMLInput('   \n\t  ');
        expect(result.valid).to.be.false;
        expect(result.error).to.equal('Input text is empty');
      });

      it('should accept empty string when allowEmpty is true', function () {
        const result = validateMLInput('', { allowEmpty: true });
        expect(result.valid).to.be.true;
        expect(result.text).to.equal('');
      });
    });

    describe('length validation', function () {
      it('should reject text below minimum length', function () {
        const result = validateMLInput('ab', { minLength: 3 });
        expect(result.valid).to.be.false;
        expect(result.error).to.include('too short');
        expect(result.error).to.include('2 < 3');
      });

      it('should accept text at minimum length', function () {
        const result = validateMLInput('abc', { minLength: 3 });
        expect(result.valid).to.be.true;
        expect(result.text).to.equal('abc');
      });

      it('should reject text exceeding maximum length', function () {
        const longText = 'a'.repeat(101);
        const result = validateMLInput(longText, { maxLength: 100 });
        expect(result.valid).to.be.false;
        expect(result.error).to.include('exceeds maximum length');
        expect(result.error).to.include('100');
      });

      it('should accept text at maximum length', function () {
        const text = 'a'.repeat(100);
        const result = validateMLInput(text, { maxLength: 100 });
        expect(result.valid).to.be.true;
      });
    });

    describe('whitespace trimming', function () {
      it('should trim whitespace by default', function () {
        const result = validateMLInput('  hello world  ');
        expect(result.valid).to.be.true;
        expect(result.text).to.equal('hello world');
      });

      it('should preserve whitespace when trimWhitespace is false', function () {
        const result = validateMLInput('  hello  ', { trimWhitespace: false });
        expect(result.valid).to.be.true;
        expect(result.text).to.equal('  hello  ');
      });
    });

    describe('encoding normalization', function () {
      it('should normalize Unicode text by default', function () {
        // Test with decomposed character (e + combining accent)
        const decomposed = 'cafe\u0301'; // café with combining acute
        const composed = 'café';
        const result = validateMLInput(decomposed);
        expect(result.valid).to.be.true;
        // NFC normalization should compose the character
        expect(result.text).to.equal(composed);
      });

      it('should add warning for encoding changes', function () {
        const decomposed = 'cafe\u0301';
        const result = validateMLInput(decomposed);
        expect(result.valid).to.be.true;
        expect(result.warnings).to.include('Text encoding was normalized');
      });

      it('should detect replacement characters as encoding issues', function () {
        const textWithReplacement = 'Hello \uFFFD World';
        const result = validateMLInput(textWithReplacement);
        expect(result.valid).to.be.true;
        expect(result.warnings).to.include('Invalid UTF-8 sequences were replaced');
      });

      it('should skip normalization when normalizeEncoding is false', function () {
        const decomposed = 'cafe\u0301';
        const result = validateMLInput(decomposed, { normalizeEncoding: false });
        expect(result.valid).to.be.true;
        expect(result.text).to.equal(decomposed);
      });
    });

    describe('control character detection', function () {
      it('should warn about control characters', function () {
        // Text with 15 control characters (above threshold of 10) in longer text
        // to avoid triggering "high ratio" warning
        const textWithControls = 'Hello World '.repeat(20) + '\x01'.repeat(15);
        const result = validateMLInput(textWithControls);
        expect(result.valid).to.be.true;
        expect(result.warnings).to.exist;
        expect(result.warnings.some((w) => w.includes('Control characters'))).to.be.true;
      });

      it('should warn about high ratio of control characters', function () {
        // Text with 50% control characters (above 10% threshold)
        const textWithControls = '\x01\x02\x03\x04\x05Hello';
        const result = validateMLInput(textWithControls);
        expect(result.valid).to.be.true;
        expect(result.warnings).to.exist;
        expect(result.warnings.some((w) => w.includes('High ratio'))).to.be.true;
      });

      it('should allow normal text without warnings', function () {
        const normalText = 'Hello World! This is normal text.';
        const result = validateMLInput(normalText);
        expect(result.valid).to.be.true;
        expect(result.warnings).to.be.undefined;
      });
    });

    describe('valid input handling', function () {
      it('should validate normal text', function () {
        const result = validateMLInput('Hello, World!');
        expect(result.valid).to.be.true;
        expect(result.text).to.equal('Hello, World!');
        expect(result.error).to.be.undefined;
      });

      it('should validate multiline text', function () {
        const text = 'Line 1\nLine 2\nLine 3';
        const result = validateMLInput(text);
        expect(result.valid).to.be.true;
        expect(result.text).to.equal(text);
      });

      it('should validate text with special characters', function () {
        const text = 'Price: €100, 50% off! @user #tag';
        const result = validateMLInput(text);
        expect(result.valid).to.be.true;
        expect(result.text).to.equal(text);
      });

      it('should validate text with PII-like content', function () {
        const text = 'Contact John Smith at john@example.com or +41 44 123 45 67';
        const result = validateMLInput(text);
        expect(result.valid).to.be.true;
        expect(result.text).to.equal(text);
      });
    });
  });

  describe('isValidMLInput', function () {
    it('should return true for valid input', function () {
      expect(isValidMLInput('Hello World')).to.be.true;
    });

    it('should return false for null input', function () {
      expect(isValidMLInput(null)).to.be.false;
    });

    it('should return false for undefined input', function () {
      expect(isValidMLInput(undefined)).to.be.false;
    });

    it('should return false for empty input', function () {
      expect(isValidMLInput('')).to.be.false;
    });
  });

  describe('getValidationError', function () {
    it('should return undefined for valid input', function () {
      expect(getValidationError('Hello World')).to.be.undefined;
    });

    it('should return error message for null input', function () {
      const error = getValidationError(null);
      expect(error).to.equal('Input text is null or undefined');
    });

    it('should return error message for empty input', function () {
      const error = getValidationError('');
      expect(error).to.equal('Input text is empty');
    });
  });

  describe('MLInputValidator class', function () {
    it('should validate with default config', function () {
      const validator = new MLInputValidator();
      const result = validator.validate('Hello World');
      expect(result.valid).to.be.true;
      expect(result.text).to.equal('Hello World');
    });

    it('should validate with custom config', function () {
      const validator = new MLInputValidator({ minLength: 10 });
      const result = validator.validate('Short');
      expect(result.valid).to.be.false;
      expect(result.error).to.include('too short');
    });

    it('should support isValid helper method', function () {
      const validator = new MLInputValidator();
      expect(validator.isValid('Hello World')).to.be.true;
      expect(validator.isValid(null)).to.be.false;
    });

    it('should expose config via getConfig', function () {
      const validator = new MLInputValidator({ maxLength: 500 });
      const config = validator.getConfig();
      expect(config.maxLength).to.equal(500);
      expect(config.minLength).to.equal(DEFAULT_VALIDATION_CONFIG.minLength);
    });

    it('should support config updates via configure', function () {
      const validator = new MLInputValidator();
      validator.configure({ allowEmpty: true });
      const result = validator.validate('');
      expect(result.valid).to.be.true;
    });
  });

  describe('createMLInputValidator factory', function () {
    it('should create validator with default config', function () {
      const validator = createMLInputValidator();
      const config = validator.getConfig();
      expect(config.maxLength).to.equal(DEFAULT_VALIDATION_CONFIG.maxLength);
      expect(config.minLength).to.equal(DEFAULT_VALIDATION_CONFIG.minLength);
    });

    it('should create validator with custom config', function () {
      const validator = createMLInputValidator({ maxLength: 1000 });
      const config = validator.getConfig();
      expect(config.maxLength).to.equal(1000);
    });
  });

  describe('DEFAULT_VALIDATION_CONFIG', function () {
    it('should have sensible default values', function () {
      expect(DEFAULT_VALIDATION_CONFIG.maxLength).to.equal(100_000);
      expect(DEFAULT_VALIDATION_CONFIG.minLength).to.equal(1);
      expect(DEFAULT_VALIDATION_CONFIG.allowEmpty).to.be.false;
      expect(DEFAULT_VALIDATION_CONFIG.normalizeEncoding).to.be.true;
      expect(DEFAULT_VALIDATION_CONFIG.trimWhitespace).to.be.true;
    });
  });

  describe('integration with detection pipeline', function () {
    it('should validate typical invoice text', function () {
      const invoiceText = `
        Invoice #12345
        Date: 2024-01-15

        Customer: Hans Müller
        Address: Bahnhofstrasse 42, 8001 Zürich

        Total: CHF 1,500.00
      `;
      const result = validateMLInput(invoiceText);
      expect(result.valid).to.be.true;
      expect(result.text).to.not.be.empty;
    });

    it('should validate text with multiple languages', function () {
      const multilangText = 'Hello World! Bonjour le monde! Grüezi Welt!';
      const result = validateMLInput(multilangText);
      expect(result.valid).to.be.true;
    });

    it('should handle markdown content', function () {
      const markdown = `
        # Document Title

        - Point 1
        - Point 2

        **Bold** and *italic* text

        \`\`\`code block\`\`\`
      `;
      const result = validateMLInput(markdown);
      expect(result.valid).to.be.true;
    });
  });
});
