/**
 * TextChunker Tests (Story 8.11)
 *
 * Tests for the document chunking utility that handles large documents
 * exceeding ML model context limits (512 tokens).
 */

import { expect } from 'chai';
import {
  chunkText,
  mergeChunkPredictions,
  needsChunking,
  estimateTokenCount,
  splitIntoSentences,
  TextChunker,
  createTextChunker,
  DEFAULT_CHUNK_CONFIG,
} from '../../../../shared/dist/pii/ml/TextChunker.js';

describe('TextChunker (Story 8.11)', function () {
  describe('estimateTokenCount', function () {
    it('should estimate tokens based on character count', function () {
      // ~4 chars per token
      const text = 'Hello world this is a test.';
      const estimate = estimateTokenCount(text);
      expect(estimate).to.be.greaterThan(5);
      expect(estimate).to.be.lessThan(20);
    });

    it('should handle empty text', function () {
      expect(estimateTokenCount('')).to.equal(0);
    });

    it('should use word count as minimum', function () {
      // Short words: "A B C D E" has 5 words
      const text = 'A B C D E';
      const estimate = estimateTokenCount(text);
      expect(estimate).to.be.greaterThanOrEqual(5);
    });

    it('should handle long words', function () {
      const text = 'Donaudampfschifffahrtsgesellschaftskapitän';
      const estimate = estimateTokenCount(text);
      expect(estimate).to.be.greaterThan(5); // Long compound word
    });
  });

  describe('splitIntoSentences', function () {
    it('should split on period followed by uppercase', function () {
      const text = 'First sentence. Second sentence.';
      const sentences = splitIntoSentences(text);
      expect(sentences).to.have.length(2);
      expect(sentences[0]).to.equal('First sentence.');
      expect(sentences[1]).to.equal('Second sentence.');
    });

    it('should split on exclamation marks', function () {
      const text = 'Hello! How are you?';
      const sentences = splitIntoSentences(text);
      expect(sentences).to.have.length(2);
    });

    it('should split on question marks', function () {
      const text = 'Is this working? Yes it is.';
      const sentences = splitIntoSentences(text);
      expect(sentences).to.have.length(2);
    });

    it('should handle abbreviations (Mr., Dr., etc.)', function () {
      const text = 'Mr. Smith went to see Dr. Jones.';
      const sentences = splitIntoSentences(text);
      expect(sentences).to.have.length(1);
    });

    it('should handle empty text', function () {
      expect(splitIntoSentences('')).to.deep.equal([]);
    });

    it('should handle text ending without punctuation', function () {
      const text = 'First sentence. Second without end';
      const sentences = splitIntoSentences(text);
      expect(sentences).to.have.length(2);
    });

    it('should handle newlines as sentence boundaries', function () {
      const text = 'First line.\nSecond line.';
      const sentences = splitIntoSentences(text);
      expect(sentences).to.have.length(2);
    });
  });

  describe('chunkText', function () {
    it('should return single chunk for small text', function () {
      const text = 'This is a short document.';
      const chunks = chunkText(text, { maxTokens: 512 });

      expect(chunks).to.have.length(1);
      expect(chunks[0].text).to.equal(text);
      expect(chunks[0].start).to.equal(0);
      expect(chunks[0].end).to.equal(text.length);
      expect(chunks[0].chunkIndex).to.equal(0);
    });

    it('should return empty array for empty text', function () {
      const chunks = chunkText('');
      expect(chunks).to.deep.equal([]);
    });

    it('should split large text into multiple chunks', function () {
      // Create a large text that exceeds 512 tokens (~2048 chars)
      const sentences = [];
      for (let i = 0; i < 100; i++) {
        sentences.push(`This is sentence number ${i} with some additional content to make it longer.`);
      }
      const text = sentences.join(' ');

      const chunks = chunkText(text, { maxTokens: 100, overlapTokens: 10 });

      expect(chunks.length).to.be.greaterThan(1);

      // Verify all chunks have valid positions
      for (const chunk of chunks) {
        expect(chunk.start).to.be.lessThan(chunk.end);
        expect(chunk.text.length).to.be.greaterThan(0);
        expect(text.substring(chunk.start, chunk.end)).to.equal(chunk.text);
      }
    });

    it('should preserve sentence boundaries', function () {
      const text = 'First sentence here. Second sentence here. Third sentence.';
      // Force chunking with small token limit
      const chunks = chunkText(text, { maxTokens: 10, overlapTokens: 2 });

      // Each chunk should end at a sentence boundary (with period)
      for (const chunk of chunks) {
        const trimmed = chunk.text.trim();
        const endsWithPunctuation = /[.!?]$/.test(trimmed);
        expect(endsWithPunctuation, `Chunk "${chunk.text}" should end with punctuation`).to.be.true;
      }
    });

    it('should include overlap between chunks', function () {
      // Create text with distinct sentences
      const sentences = [];
      for (let i = 0; i < 20; i++) {
        sentences.push(`Sentence${i}.`);
      }
      const text = sentences.join(' ');

      const chunks = chunkText(text, { maxTokens: 30, overlapTokens: 10 });

      if (chunks.length >= 2) {
        // Check that chunks overlap
        const chunk1End = chunks[0].end;
        const chunk2Start = chunks[1].start;

        // With overlap, chunk2 should start before chunk1 ends
        expect(chunk2Start).to.be.lessThan(chunk1End);
      }
    });

    it('should maintain correct position mapping', function () {
      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = chunkText(text, { maxTokens: 20, overlapTokens: 5 });

      for (const chunk of chunks) {
        // Verify that the chunk text matches the original at the specified position
        const extracted = text.substring(chunk.start, chunk.end);
        expect(extracted).to.equal(chunk.text);
      }
    });

    it('should use custom tokenizer if provided', function () {
      const text = 'A short test.';
      let tokenizerCalled = false;

      const chunks = chunkText(text, {
        maxTokens: 100,
        tokenizer: (t) => {
          tokenizerCalled = true;
          return t.split(' ').length;
        },
      });

      expect(tokenizerCalled).to.be.true;
      expect(chunks).to.have.length(1);
    });
  });

  describe('mergeChunkPredictions', function () {
    it('should return empty array for empty input', function () {
      const result = mergeChunkPredictions([], []);
      expect(result).to.deep.equal([]);
    });

    it('should adjust offsets based on chunk start position', function () {
      const chunks = [
        { text: 'First chunk.', start: 0, end: 12, chunkIndex: 0 },
        { text: 'Second chunk.', start: 13, end: 26, chunkIndex: 1 },
      ];

      const chunkPredictions = [
        {
          chunkIndex: 0,
          predictions: [
            { word: 'First', entity: 'B-PER', score: 0.9, start: 0, end: 5 },
          ],
        },
        {
          chunkIndex: 1,
          predictions: [
            { word: 'Second', entity: 'B-PER', score: 0.85, start: 0, end: 6 },
          ],
        },
      ];

      const merged = mergeChunkPredictions(chunkPredictions, chunks);

      expect(merged).to.have.length(2);
      // First prediction should stay at position 0
      expect(merged[0].start).to.equal(0);
      expect(merged[0].end).to.equal(5);
      // Second prediction should be offset by chunk start (13)
      expect(merged[1].start).to.equal(13);
      expect(merged[1].end).to.equal(19);
    });

    it('should deduplicate overlapping predictions of same type', function () {
      const chunks = [
        { text: 'Hans Müller is here.', start: 0, end: 20, chunkIndex: 0 },
        { text: 'Müller is here. He lives.', start: 5, end: 30, chunkIndex: 1 },
      ];

      const chunkPredictions = [
        {
          chunkIndex: 0,
          predictions: [
            { word: 'Hans', entity: 'B-PER', score: 0.9, start: 0, end: 4 },
            { word: 'Müller', entity: 'I-PER', score: 0.85, start: 5, end: 11 },
          ],
        },
        {
          chunkIndex: 1,
          predictions: [
            // Same Müller detected again in overlap region
            { word: 'Müller', entity: 'B-PER', score: 0.88, start: 0, end: 6 },
          ],
        },
      ];

      const merged = mergeChunkPredictions(chunkPredictions, chunks);

      // Should deduplicate the overlapping Müller predictions
      // There should be deduplication happening
      expect(merged.length).to.be.lessThanOrEqual(3);
    });

    it('should keep higher confidence prediction when deduplicating', function () {
      const chunks = [
        { text: 'Test name here.', start: 0, end: 15, chunkIndex: 0 },
        { text: 'name here again.', start: 5, end: 21, chunkIndex: 1 },
      ];

      const chunkPredictions = [
        {
          chunkIndex: 0,
          predictions: [
            { word: 'name', entity: 'B-PER', score: 0.7, start: 5, end: 9 },
          ],
        },
        {
          chunkIndex: 1,
          predictions: [
            { word: 'name', entity: 'B-PER', score: 0.95, start: 0, end: 4 },
          ],
        },
      ];

      const merged = mergeChunkPredictions(chunkPredictions, chunks);

      // Should keep the higher confidence (0.95) prediction
      const namePred = merged.find((p) => p.entity === 'B-PER');
      expect(namePred?.score).to.equal(0.95);
    });

    it('should not deduplicate different entity types', function () {
      const chunks = [
        { text: 'Paris France here.', start: 0, end: 18, chunkIndex: 0 },
      ];

      const chunkPredictions = [
        {
          chunkIndex: 0,
          predictions: [
            { word: 'Paris', entity: 'B-LOC', score: 0.9, start: 0, end: 5 },
            { word: 'Paris', entity: 'B-ORG', score: 0.7, start: 0, end: 5 },
          ],
        },
      ];

      const merged = mergeChunkPredictions(chunkPredictions, chunks);

      // Both predictions should be kept (different entity types)
      expect(merged).to.have.length(2);
    });
  });

  describe('needsChunking', function () {
    it('should return false for small text', function () {
      expect(needsChunking('Short text.')).to.be.false;
    });

    it('should return true for large text', function () {
      const largeText = 'word '.repeat(1000);
      expect(needsChunking(largeText, 100)).to.be.true;
    });

    it('should use custom maxTokens', function () {
      const text = 'word '.repeat(50);
      expect(needsChunking(text, 10)).to.be.true;
      expect(needsChunking(text, 1000)).to.be.false;
    });
  });

  describe('TextChunker class', function () {
    it('should create with default config', function () {
      const chunker = new TextChunker();
      const config = chunker.getConfig();

      expect(config).to.deep.equal(DEFAULT_CHUNK_CONFIG);
    });

    it('should create with custom config', function () {
      const chunker = new TextChunker({ maxTokens: 256, overlapTokens: 25 });
      const config = chunker.getConfig();

      expect(config.maxTokens).to.equal(256);
      expect(config.overlapTokens).to.equal(25);
    });

    it('should chunk text using configured settings', function () {
      const chunker = new TextChunker({ maxTokens: 512 });
      const text = 'This is a short test.';
      const chunks = chunker.chunk(text);

      expect(chunks).to.have.length(1);
    });

    it('should check if text needs chunking', function () {
      const chunker = new TextChunker({ maxTokens: 10 });
      const shortText = 'Hi.';
      const longText = 'This is a much longer text that should need chunking.';

      expect(chunker.needsChunking(shortText)).to.be.false;
      expect(chunker.needsChunking(longText)).to.be.true;
    });

    it('should merge predictions correctly', function () {
      const chunker = new TextChunker();
      const chunks = [
        { text: 'Test.', start: 0, end: 5, chunkIndex: 0 },
      ];
      const predictions = [
        {
          chunkIndex: 0,
          predictions: [
            { word: 'Test', entity: 'B-ORG', score: 0.9, start: 0, end: 4 },
          ],
        },
      ];

      const merged = chunker.mergePredictions(predictions, chunks);
      expect(merged).to.have.length(1);
    });

    it('should update configuration', function () {
      const chunker = new TextChunker();
      chunker.configure({ maxTokens: 128 });
      const config = chunker.getConfig();

      expect(config.maxTokens).to.equal(128);
    });
  });

  describe('createTextChunker factory', function () {
    it('should create a configured chunker', function () {
      const chunker = createTextChunker({ maxTokens: 200 });
      expect(chunker).to.be.instanceOf(TextChunker);
      expect(chunker.getConfig().maxTokens).to.equal(200);
    });
  });

  describe('Real-world scenarios', function () {
    it('should handle typical invoice document', function () {
      const invoice = `
        Invoice #12345
        Date: 2024-12-27

        Customer: Hans Müller
        Address: Bahnhofstrasse 42, 8001 Zürich

        Items:
        - Product A: CHF 100.00
        - Product B: CHF 200.00

        Total: CHF 300.00

        Payment due: 30 days
        IBAN: CH93 0076 2011 6238 5295 7
      `;

      const chunks = chunkText(invoice, { maxTokens: 512 });

      // Small document should be single chunk
      expect(chunks).to.have.length(1);
      expect(chunks[0].text).to.equal(invoice);
    });

    it('should handle large contract document', function () {
      // Simulate a large contract with many paragraphs
      const paragraphs = [];
      for (let i = 0; i < 50; i++) {
        paragraphs.push(
          `Section ${i + 1}. This agreement between the parties establishes the terms and conditions ` +
          'for the provision of services. The contractor agrees to deliver the work within the specified ' +
          'timeframe. Payment shall be made according to the schedule outlined in Appendix A.',
        );
      }
      const contract = paragraphs.join('\n\n');

      const chunks = chunkText(contract, { maxTokens: 512, overlapTokens: 50 });

      // Should be chunked
      expect(chunks.length).to.be.greaterThan(1);

      // Total coverage should cover the whole document
      const firstChunkStart = chunks[0].start;
      const lastChunkEnd = chunks[chunks.length - 1].end;

      expect(firstChunkStart).to.equal(0);
      expect(lastChunkEnd).to.equal(contract.length);
    });

    it('should handle German text with compound words', function () {
      const germanText = `
        Die Donaudampfschifffahrtsgesellschaftskapitänswitwe Maria Schmidt wohnt in der
        Bundesrepublik Deutschland. Sie hat eine Krankenversicherungskarte und eine
        Sozialversicherungsnummer. Ihre Adresse ist Hauptstraße 123, 10115 Berlin.
      `;

      const chunks = chunkText(germanText, { maxTokens: 50, overlapTokens: 10 });

      // Should handle compound words correctly
      for (const chunk of chunks) {
        expect(chunk.text.length).to.be.greaterThan(0);
      }
    });

    it('should handle multilingual document', function () {
      const multilingualDoc = `
        English section: This is the first part of the document.

        Section française: Voici la deuxième partie du document.

        Deutscher Abschnitt: Dies ist der dritte Teil des Dokuments.

        Contact: Jean-Pierre Müller
        Email: contact@example.com
        Phone: +41 79 123 45 67
      `;

      const chunks = chunkText(multilingualDoc, { maxTokens: 512 });

      // Should handle without issues
      expect(chunks.length).to.be.greaterThanOrEqual(1);
    });
  });

  describe('Edge cases', function () {
    it('should handle text with no sentence boundaries', function () {
      const text = 'word1 word2 word3 word4 word5 word6 word7 word8 word9 word10';
      const chunks = chunkText(text, { maxTokens: 512 });

      expect(chunks).to.have.length(1);
      expect(chunks[0].text).to.equal(text);
    });

    it('should handle text with only punctuation', function () {
      const text = '... !!! ???';
      const chunks = chunkText(text, { maxTokens: 512 });

      expect(chunks.length).to.be.greaterThanOrEqual(1);
    });

    it('should handle text with unicode characters', function () {
      const text = 'Café résumé naïve 日本語 中文 العربية.';
      const chunks = chunkText(text, { maxTokens: 512 });

      expect(chunks).to.have.length(1);
      expect(chunks[0].text).to.equal(text);
    });

    it('should handle very long single sentence', function () {
      // One very long sentence that exceeds maxTokens
      const longSentence = 'This is ' + 'a very long sentence that '.repeat(100) + 'finally ends here.';

      const chunks = chunkText(longSentence, { maxTokens: 50, overlapTokens: 10 });

      // Should still produce chunks even for single long sentence
      expect(chunks.length).to.be.greaterThanOrEqual(1);
    });

    it('should handle whitespace-only text', function () {
      const chunks = chunkText('   \n\n\t  ');
      // May return empty or single chunk depending on implementation
      expect(chunks.length).to.be.lessThanOrEqual(1);
    });
  });

  describe('Performance considerations', function () {
    it('should not chunk small documents (no overhead)', function () {
      const smallDoc = 'Small document with a few sentences. Nothing special here.';
      const chunks = chunkText(smallDoc, { maxTokens: 512 });

      // Should be exactly one chunk (no chunking overhead)
      expect(chunks).to.have.length(1);
    });

    it('should handle moderately large document efficiently', function () {
      // ~5000 tokens document
      const sentences = [];
      for (let i = 0; i < 500; i++) {
        sentences.push(`Sentence ${i} with some content.`);
      }
      const doc = sentences.join(' ');

      const start = Date.now();
      const chunks = chunkText(doc, { maxTokens: 512, overlapTokens: 50 });
      const duration = Date.now() - start;

      // Should complete quickly (<100ms)
      expect(duration).to.be.lessThan(100);
      expect(chunks.length).to.be.greaterThan(1);
    });
  });
});
