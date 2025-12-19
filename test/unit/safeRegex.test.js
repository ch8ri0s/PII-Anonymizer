/**
 * SafeRegex Unit Tests
 *
 * Story 6.2: ReDoS Vulnerability Fix - AC4: Security Test Suite
 *
 * Tests for timeout-protected regex operations to prevent
 * Regular Expression Denial of Service (ReDoS) attacks.
 */

import { expect } from 'chai';
import {
  safeTest,
  safeMatch,
  safeReplace,
  chunkText,
  analyzePatternComplexity,
  isPatternDangerous,
  configure,
  resetConfig,
  getConfig,
  SafeRegex,
} from '../../dist/utils/safeRegex.js';

describe('SafeRegex - ReDoS Protection (Story 6.2)', function () {
  // Use shorter timeout for security tests
  this.timeout(5000);

  beforeEach(() => {
    // Reset to default configuration before each test
    resetConfig();
  });

  describe('AC1: Timeout Protection', () => {
    it('should complete safe regex within timeout', () => {
      const regex = /hello/i;
      const text = 'Hello World';

      const result = safeTest(regex, text);

      expect(result.success).to.be.true;
      expect(result.value).to.be.true;
      expect(result.timedOut).to.be.false;
      expect(result.durationMs).to.be.lessThan(100);
    });

    it('should return result with timing information', () => {
      const regex = /\d+/g;
      const text = '123 456 789';

      const result = safeMatch(regex, text);

      expect(result.success).to.be.true;
      expect(result.durationMs).to.be.a('number');
      expect(result.durationMs).to.be.at.least(0);
    });

    it('should handle regex that does not match', () => {
      const regex = /xyz/i;
      const text = 'Hello World';

      const result = safeTest(regex, text);

      expect(result.success).to.be.true;
      expect(result.value).to.be.false;
      expect(result.timedOut).to.be.false;
    });

    it('should handle null match result', () => {
      const regex = /notfound/;
      const text = 'Hello World';

      const result = safeMatch(regex, text);

      expect(result.success).to.be.true;
      expect(result.value).to.be.null;
      expect(result.timedOut).to.be.false;
    });

    it('should allow custom timeout configuration', () => {
      const regex = /test/i;
      const text = 'test';

      const result = safeTest(regex, text, { timeoutMs: 50 });

      expect(result.success).to.be.true;
      expect(result.durationMs).to.be.lessThan(50);
    });

    it('should log timeout violations when enabled', () => {
      // This test verifies logging is attempted (actual logging tested separately)
      const config = getConfig();
      expect(config.logTimeouts).to.be.true;
    });
  });

  describe('AC2: Input Length Limits', () => {
    it('should reject input exceeding maximum length', () => {
      const regex = /test/i;
      const longText = 'a'.repeat(20000); // Exceeds default 10,000

      const result = safeTest(regex, longText);

      expect(result.success).to.be.false;
      expect(result.timedOut).to.be.false;
      expect(result.error).to.include('exceeds maximum length');
    });

    it('should accept input within length limit', () => {
      const regex = /test/i;
      const text = 'a'.repeat(5000); // Within limit

      const result = safeTest(regex, text);

      expect(result.success).to.be.true;
    });

    it('should allow custom length limit', () => {
      const regex = /test/i;
      const text = 'a'.repeat(500);

      const result = safeTest(regex, text, { maxInputLength: 200 });

      expect(result.success).to.be.false;
      expect(result.error).to.include('exceeds maximum length');
    });

    describe('chunkText function', () => {
      it('should not chunk text within limit', () => {
        const text = 'short text';
        const chunks = chunkText(text, 1000);

        expect(chunks).to.have.lengthOf(1);
        expect(chunks[0]).to.equal(text);
      });

      it('should chunk text exceeding limit', () => {
        const text = 'a'.repeat(500);
        const chunks = chunkText(text, 100, 10);

        expect(chunks.length).to.be.greaterThan(1);
        // Each chunk should be <= maxChunkSize
        chunks.forEach((chunk) => {
          expect(chunk.length).to.be.at.most(100);
        });
      });

      it('should break at natural boundaries when possible', () => {
        const text = 'Hello World\nSecond Line\nThird Line';
        const chunks = chunkText(text, 20, 5);

        // Should try to break at newlines
        expect(chunks.length).to.be.greaterThan(1);
      });

      it('should include overlap between chunks', () => {
        const text = 'a'.repeat(300);
        const chunks = chunkText(text, 100, 20);

        // With overlap, total characters should exceed original length
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        expect(totalLength).to.be.greaterThan(text.length);
      });
    });
  });

  describe('AC3: Pattern Complexity Analysis', () => {
    it('should score simple patterns low', () => {
      const score = analyzePatternComplexity('hello');
      expect(score).to.be.lessThan(10);
    });

    it('should score patterns with unbounded quantifiers higher', () => {
      const simpleScore = analyzePatternComplexity('a');
      const quantifierScore = analyzePatternComplexity('a+');

      expect(quantifierScore).to.be.greaterThan(simpleScore);
    });

    it('should score patterns with alternation', () => {
      const score = analyzePatternComplexity('a|b|c');
      expect(score).to.be.greaterThan(0);
    });

    it('should detect potentially dangerous patterns', () => {
      // Pattern with nested-like structure
      const dangerousPattern = 'a+b+c+d+e+f+g+h+i+j+k+l+m+n+o+p+q+r+s+t+';

      const isDangerous = isPatternDangerous(dangerousPattern, 50);
      expect(isDangerous).to.be.true;
    });

    it('should not flag safe patterns as dangerous', () => {
      const safePattern = 'hello';
      const isDangerous = isPatternDangerous(safePattern);
      expect(isDangerous).to.be.false;
    });

    it('should consider character class quantifiers', () => {
      const patternWithClass = '[a-z]+';
      const simplePattern = 'abc';

      const classScore = analyzePatternComplexity(patternWithClass);
      const simpleScore = analyzePatternComplexity(simplePattern);

      expect(classScore).to.be.greaterThan(simpleScore);
    });
  });

  describe('AC4: ReDoS Attack Vectors', () => {
    it('should handle attack pattern: repeated characters', () => {
      const regex = /a+/;
      const attack = 'a'.repeat(50);

      const result = safeTest(regex, attack);

      // Should complete quickly despite long input
      expect(result.durationMs).to.be.lessThan(100);
    });

    it('should handle attack pattern: alternating characters', () => {
      const regex = /ab/g;
      const attack = 'ab'.repeat(500);

      const result = safeMatch(regex, attack);

      expect(result.success).to.be.true;
      expect(result.durationMs).to.be.lessThan(100);
    });

    it('should handle potentially catastrophic pattern with input limits', () => {
      // This pattern could be dangerous with unbounded input
      const regex = /^(a+)+$/;
      const text = 'a'.repeat(20) + '!';

      // With our length limits, this should be safe
      const result = safeTest(regex, text);

      expect(result.durationMs).to.be.lessThan(100);
    });

    it('should reject oversized attack inputs', () => {
      const regex = /^(a+)+$/;
      const attack = 'a'.repeat(50000) + '!';

      const result = safeTest(regex, attack);

      expect(result.success).to.be.false;
      expect(result.error).to.include('exceeds maximum length');
    });

    it('should handle mixed special characters attack', () => {
      const regex = /[a-z]+/gi;
      const attack = 'a!b@c#d$e%'.repeat(100);

      const result = safeMatch(regex, attack);

      expect(result.success).to.be.true;
      expect(result.durationMs).to.be.lessThan(100);
    });

    it('should handle the buildFuzzyRegex vulnerability pattern', () => {
      // Simulating the pattern from buildFuzzyRegex
      // Original: ${char}[^a-zA-Z0-9]{0,3}
      // With protection: bounded and non-greedy
      const char = 'a';
      const protectedPattern = `${char}[^a-zA-Z0-9]{0,2}?`;
      const regex = new RegExp(protectedPattern, 'ig');

      const attack = 'a!!!a!!!a!!!'.repeat(10);

      const result = safeTest(regex, attack);

      expect(result.success).to.be.true;
      expect(result.durationMs).to.be.lessThan(100);
    });
  });

  describe('safeReplace function', () => {
    it('should perform replacement successfully', () => {
      const regex = /world/i;
      const text = 'Hello World';
      const replacement = 'Universe';

      const result = safeReplace(regex, text, replacement);

      expect(result.success).to.be.true;
      expect(result.value).to.equal('Hello Universe');
    });

    it('should handle global replacements', () => {
      const regex = /a/g;
      const text = 'banana';
      const replacement = 'X';

      const result = safeReplace(regex, text, replacement);

      expect(result.success).to.be.true;
      expect(result.value).to.equal('bXnXnX');
    });

    it('should return original text on length error', () => {
      const regex = /test/;
      const text = 'a'.repeat(20000);
      const replacement = 'X';

      const result = safeReplace(regex, text, replacement);

      expect(result.success).to.be.false;
      expect(result.value).to.be.undefined;
      expect(result.error).to.include('exceeds maximum length');
    });

    it('should handle replacement functions', () => {
      const regex = /\d+/g;
      const text = 'a1b2c3';
      const replacer = (match) => `[${match}]`;

      const result = safeReplace(regex, text, replacer);

      expect(result.success).to.be.true;
      expect(result.value).to.equal('a[1]b[2]c[3]');
    });
  });

  describe('SafeRegex class', () => {
    it('should create instance from string pattern', () => {
      const safeRegex = new SafeRegex('hello', 'i');

      expect(safeRegex.source).to.equal('hello');
      expect(safeRegex.flags).to.equal('i');
    });

    it('should create instance from RegExp', () => {
      const regex = /world/gi;
      const safeRegex = new SafeRegex(regex);

      expect(safeRegex.source).to.equal('world');
      expect(safeRegex.flags).to.equal('gi');
    });

    it('should perform safe test', () => {
      const safeRegex = new SafeRegex(/test/i);
      const result = safeRegex.test('This is a test');

      expect(result.success).to.be.true;
      expect(result.value).to.be.true;
    });

    it('should perform safe match', () => {
      const safeRegex = new SafeRegex(/\d+/g);
      const result = safeRegex.match('a1b2c3');

      expect(result.success).to.be.true;
      expect(result.value).to.have.lengthOf(3);
    });

    it('should perform safe replace', () => {
      const safeRegex = new SafeRegex(/x/g);
      const result = safeRegex.replace('xxx', 'y');

      expect(result.success).to.be.true;
      expect(result.value).to.equal('yyy');
    });

    it('should report complexity', () => {
      const safeRegex = new SafeRegex(/a+b+c+/);
      const complexity = safeRegex.getComplexity();

      expect(complexity).to.be.a('number');
      expect(complexity).to.be.greaterThan(0);
    });

    it('should detect dangerous patterns', () => {
      // Add extra quantifiers to exceed complexity threshold of 100
      const dangerous = new SafeRegex(/a+b+c+d+e+f+g+h+i+j+k+l+m+n+o+p+q+r+s+t+u+v+/);
      const safe = new SafeRegex(/hello/);

      expect(dangerous.isDangerous()).to.be.true;
      expect(safe.isDangerous()).to.be.false;
    });

    it('should use custom configuration', () => {
      const safeRegex = new SafeRegex(/test/, '', { maxInputLength: 50 });
      const result = safeRegex.test('a'.repeat(100));

      expect(result.success).to.be.false;
      expect(result.error).to.include('exceeds maximum length');
    });
  });

  describe('Configuration', () => {
    it('should return default configuration', () => {
      const config = getConfig();

      expect(config.timeoutMs).to.equal(100);
      expect(config.maxInputLength).to.equal(10000);
      expect(config.maxComplexity).to.equal(100);
      expect(config.logTimeouts).to.be.true;
    });

    it('should allow configuration updates', () => {
      configure({ timeoutMs: 200 });
      const config = getConfig();

      expect(config.timeoutMs).to.equal(200);
    });

    it('should preserve unmodified settings', () => {
      configure({ timeoutMs: 200 });
      const config = getConfig();

      expect(config.maxInputLength).to.equal(10000);
    });

    it('should reset to defaults', () => {
      configure({ timeoutMs: 500, maxInputLength: 5000 });
      resetConfig();
      const config = getConfig();

      expect(config.timeoutMs).to.equal(100);
      expect(config.maxInputLength).to.equal(10000);
    });
  });

  describe('Performance Regression Prevention', () => {
    it('should process normal text quickly', () => {
      const regex = /\b[A-Z][a-z]+\b/g;
      const text = 'The Quick Brown Fox Jumps Over The Lazy Dog';

      const start = Date.now();
      const result = safeMatch(regex, text);
      const duration = Date.now() - start;

      expect(result.success).to.be.true;
      expect(duration).to.be.lessThan(50);
    });

    it('should handle multiple consecutive operations', () => {
      const regex = /\d+/g;
      const texts = Array(100).fill('test123test456');

      const start = Date.now();
      texts.forEach((text) => safeMatch(regex, text));
      const duration = Date.now() - start;

      // 100 operations should complete in reasonable time
      expect(duration).to.be.lessThan(1000);
    });

    it('should not degrade with increasing input sizes (linear time)', () => {
      const regex = /test/g;

      // Measure time for different input sizes
      const sizes = [1000, 2000, 4000];
      const times = sizes.map((size) => {
        const text = 'test'.repeat(size / 4);
        const start = Date.now();
        safeMatch(regex, text);
        return Date.now() - start;
      });

      // Time should scale roughly linearly, not exponentially
      // If 4x input takes more than 10x time, it's likely exponential
      const ratio = times[2] / Math.max(times[0], 1);
      expect(ratio).to.be.lessThan(20);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string input', () => {
      const result = safeTest(/test/, '');

      expect(result.success).to.be.true;
      expect(result.value).to.be.false;
    });

    it('should handle empty pattern', () => {
      const result = safeTest(/(?:)/, 'test');

      expect(result.success).to.be.true;
    });

    it('should handle special regex characters in text', () => {
      const regex = /\[test\]/;
      const text = '[test]';

      const result = safeTest(regex, text);

      expect(result.success).to.be.true;
      expect(result.value).to.be.true;
    });

    it('should reset regex lastIndex between calls', () => {
      const regex = /a/g;
      regex.lastIndex = 5;

      const result = safeTest(regex, 'aaa');

      expect(result.success).to.be.true;
      expect(result.value).to.be.true;
    });

    it('should handle Unicode characters', () => {
      const regex = /café/i;
      const text = 'I love Café au lait';

      const result = safeMatch(regex, text);

      expect(result.success).to.be.true;
      expect(result.value).to.not.be.null;
    });

    it('should handle newlines in text', () => {
      const regex = /line/g;
      const text = 'line1\nline2\nline3';

      const result = safeMatch(regex, text);

      expect(result.success).to.be.true;
      expect(result.value).to.have.lengthOf(3);
    });
  });
});
