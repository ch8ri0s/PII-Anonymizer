/**
 * Text/Markdown Converter Tests
 *
 * Tests for browser-based text/markdown pass-through converter.
 * Simple converter that preserves content as-is.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TextConverter } from '../../src/converters/TextConverter';
import * as fs from 'fs';
import * as path from 'path';

// Test logger for consistent output
import { createTestLogger } from '../helpers/testLogger';
const log = createTestLogger('converter:text');

describe('TextConverter', () => {
  let converter: TextConverter;

  beforeAll(() => {
    converter = new TextConverter();
  });

  describe('supports()', () => {
    it('should support plain text files by MIME type', () => {
      const file = new File([], 'readme.txt', { type: 'text/plain' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should support markdown files by MIME type text/markdown', () => {
      const file = new File([], 'readme.md', { type: 'text/markdown' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should support markdown files by MIME type text/x-markdown', () => {
      const file = new File([], 'readme.md', { type: 'text/x-markdown' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should support markdown files by MIME type application/x-markdown', () => {
      const file = new File([], 'readme.md', { type: 'application/x-markdown' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should support .txt files by extension', () => {
      const file = new File([], 'notes.txt', { type: '' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should support .md files by extension', () => {
      const file = new File([], 'README.md', { type: '' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should support .markdown files by extension', () => {
      const file = new File([], 'docs.markdown', { type: '' });
      expect(converter.supports(file)).toBe(true);
    });

    it('should not support PDF files', () => {
      const file = new File([], 'document.pdf', { type: 'application/pdf' });
      expect(converter.supports(file)).toBe(false);
    });

    it('should not support CSV files', () => {
      const file = new File([], 'data.csv', { type: 'text/csv' });
      expect(converter.supports(file)).toBe(false);
    });

    it('should handle uppercase extension', () => {
      const file = new File([], 'README.TXT', { type: '' });
      expect(converter.supports(file)).toBe(true);

      const mdFile = new File([], 'NOTES.MD', { type: '' });
      expect(converter.supports(mdFile)).toBe(true);
    });

    it('should handle mixed case extension', () => {
      const file = new File([], 'Document.Txt', { type: '' });
      expect(converter.supports(file)).toBe(true);
    });
  });

  describe('convert()', () => {
    it('should convert text file to markdown with frontmatter', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.txt');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: sample.txt fixture not found');
        return;
      }

      const content = fs.readFileSync(fixturePath, 'utf-8');
      const file = new File([content], 'sample.txt', { type: 'text/plain' });

      const markdown = await converter.convert(file);

      expect(markdown).toBeDefined();
      expect(typeof markdown).toBe('string');
      // Should include frontmatter for txt files
      expect(markdown).toMatch(/^---\n/);
      expect(markdown).toContain('source: sample.txt');
      expect(markdown).toContain('sourceFormat: txt');
      expect(markdown).toContain('anonymised: true');
      // Should include the original content
      expect(markdown).toContain(content.trim());
    });

    it('should preserve all content unchanged', async () => {
      const content = '# Heading\n\nThis is **bold** and *italic* text.\n\n- List item 1\n- List item 2';
      const file = new File([content], 'test.md', { type: 'text/markdown' });

      const markdown = await converter.convert(file);

      expect(markdown).toBe(content);
    });

    it('should preserve PII content (no sanitization in converter)', async () => {
      const fixturePath = path.join(__dirname, '../fixtures/sample.txt');

      if (!fs.existsSync(fixturePath)) {
        log.debug('Skipping test: sample.txt fixture not found');
        return;
      }

      const content = fs.readFileSync(fixturePath, 'utf-8');
      const file = new File([content], 'sample.txt', { type: 'text/plain' });

      const markdown = await converter.convert(file);

      // Should preserve PII (conversion doesn't sanitize)
      expect(markdown).toContain('Hans Müller');
      expect(markdown).toContain('hans.mueller@example.ch');
      expect(markdown).toContain('+41 79 123 45 67');
    });

    it('should preserve special characters', async () => {
      const content = 'Special chars: äöü ß éèê çñ\nUnicode: 日本語 中文 한국어';
      const file = new File([content], 'special.txt', { type: 'text/plain' });

      const markdown = await converter.convert(file);

      expect(markdown).toContain('äöü');
      expect(markdown).toContain('日本語');
    });

    it('should preserve line endings in content', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const file = new File([content], 'lines.txt', { type: 'text/plain' });

      const markdown = await converter.convert(file);

      // Should have frontmatter plus original content lines
      expect(markdown).toMatch(/^---\n/);
      expect(markdown).toContain('Line 1');
      expect(markdown).toContain('Line 2');
      expect(markdown).toContain('Line 3');
    });

    it('should handle empty file with frontmatter only', async () => {
      const file = new File([''], 'empty.txt', { type: 'text/plain' });

      const markdown = await converter.convert(file);

      // Should at least have frontmatter
      expect(markdown).toMatch(/^---\n/);
      expect(markdown).toContain('source: empty.txt');
    });

    it('should handle file with only whitespace', async () => {
      const file = new File(['   \n\n   '], 'whitespace.txt', { type: 'text/plain' });

      const markdown = await converter.convert(file);

      // Should include frontmatter
      expect(markdown).toMatch(/^---\n/);
      expect(markdown).toContain('source: whitespace.txt');
    });
  });

  describe('markdown-specific content', () => {
    it('should preserve markdown headings', async () => {
      const content = '# H1\n## H2\n### H3\n#### H4';
      const file = new File([content], 'headings.md', { type: 'text/markdown' });

      const markdown = await converter.convert(file);

      expect(markdown).toContain('# H1');
      expect(markdown).toContain('## H2');
      expect(markdown).toContain('### H3');
      expect(markdown).toContain('#### H4');
    });

    it('should preserve markdown tables', async () => {
      const content = '| Name | Age |\n|------|-----|\n| John | 30 |';
      const file = new File([content], 'table.md', { type: 'text/markdown' });

      const markdown = await converter.convert(file);

      expect(markdown).toBe(content);
    });

    it('should preserve code blocks', async () => {
      const content = '```javascript\nconst x = 1;\n```';
      const file = new File([content], 'code.md', { type: 'text/markdown' });

      const markdown = await converter.convert(file);

      expect(markdown).toBe(content);
    });

    it('should preserve links and images', async () => {
      const content = '[Link](https://example.com)\n![Image](image.png)';
      const file = new File([content], 'links.md', { type: 'text/markdown' });

      const markdown = await converter.convert(file);

      expect(markdown).toContain('[Link](https://example.com)');
      expect(markdown).toContain('![Image](image.png)');
    });
  });

  describe('edge cases', () => {
    it('should handle very long content', async () => {
      const content = 'A'.repeat(100000);
      const file = new File([content], 'long.txt', { type: 'text/plain' });

      const markdown = await converter.convert(file);

      // Should have frontmatter plus original content
      expect(markdown).toMatch(/^---\n/);
      expect(markdown).toContain(content);
      expect(markdown.length).toBeGreaterThan(100000);
    });

    it('should handle binary-like content', async () => {
      const content = '\x00\x01\x02\x03';
      const file = new File([content], 'binary.txt', { type: 'text/plain' });

      const markdown = await converter.convert(file);

      // Should have frontmatter
      expect(markdown).toMatch(/^---\n/);
      // Content may be altered by text encoding
      expect(markdown).toContain('source: binary.txt');
    });

    it('should handle empty file name', () => {
      const file = new File([], '', { type: '' });
      expect(converter.supports(file)).toBe(false);
    });
  });
});
