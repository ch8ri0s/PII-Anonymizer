/**
 * Epic 8 Performance Benchmark Tests
 *
 * Verifies that Epic 8 features (DenyList + ContextEnhancer)
 * introduce less than 10% overhead to pipeline processing.
 *
 * @module test/unit/pii/Epic8PerformanceBenchmark.test.js
 */

import { expect } from 'chai';
import { describe, it } from 'mocha';

// Import detection pipeline
import { createPipeline } from '../../../dist/pii/DetectionPipeline.js';
import { HighRecallPass } from '../../../dist/pii/passes/HighRecallPass.js';
import { ContextScoringPass } from '../../../dist/pii/passes/ContextScoringPass.js';
import { FormatValidationPass } from '../../../dist/pii/passes/FormatValidationPass.js';

describe('Epic 8 Performance Benchmark', function () {
  this.timeout(30000);

  // Sample document with realistic PII content
  const sampleDocument = `
    INVOICE #12345
    Date: 25.12.2024

    From:
    ABC Company GmbH
    Bahnhofstrasse 123
    8001 Zürich
    Switzerland
    Tel: +41 44 123 45 67
    Email: info@abc-company.ch
    VAT: CHE-123.456.789 MWST

    To:
    Jean Dupont
    Rue de la Gare 45
    1003 Lausanne
    IBAN: CH93 0076 2011 6238 5295 7

    Items:
    - Product A: CHF 250.00
    - Product B: CHF 150.00
    - Shipping: CHF 12.50

    Subtotal: CHF 412.50
    VAT (7.7%): CHF 31.76
    Total: CHF 444.26

    Payment Terms: 30 days net
    Reference: QR-REF-2024-12345

    Thank you for your business!

    Contact: Jean Dupont
    Phone: +41 79 234 56 78
    AVS: 756.1234.5678.97
  `.repeat(3); // Repeat to get a reasonably sized document

  function createPipelineWithPasses(enableEpic8) {
    const pipeline = createPipeline({ enableEpic8Features: enableEpic8 });
    pipeline.registerPass(new HighRecallPass(0.3));
    pipeline.registerPass(new FormatValidationPass());
    pipeline.registerPass(new ContextScoringPass(50, 0.4));
    return pipeline;
  }

  it('AC-8.4.5: Epic 8 features should add less than 10% overhead', async function () {
    const iterations = 5;

    // Benchmark with Epic 8 disabled (baseline)
    const baselinePipeline = createPipelineWithPasses(false);
    const baselineTimes = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await baselinePipeline.process(sampleDocument, `baseline-${i}`, 'de');
      const end = performance.now();
      baselineTimes.push(end - start);
    }

    // Benchmark with Epic 8 enabled
    const epic8Pipeline = createPipelineWithPasses(true);
    const epic8Times = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await epic8Pipeline.process(sampleDocument, `epic8-${i}`, 'de');
      const end = performance.now();
      epic8Times.push(end - start);
    }

    // Calculate averages (excluding first run for warm-up)
    const baselineAvg =
      baselineTimes.slice(1).reduce((a, b) => a + b, 0) / (iterations - 1);
    const epic8Avg =
      epic8Times.slice(1).reduce((a, b) => a + b, 0) / (iterations - 1);

    const overhead = ((epic8Avg - baselineAvg) / baselineAvg) * 100;

    console.log('\nPerformance Benchmark Results:');
    console.log(`  Baseline (Epic 8 OFF): ${baselineAvg.toFixed(2)}ms avg`);
    console.log(`  Epic 8 (Epic 8 ON):    ${epic8Avg.toFixed(2)}ms avg`);
    console.log(`  Overhead:              ${overhead.toFixed(2)}%`);

    // Assert overhead is less than 10%
    expect(overhead).to.be.lessThan(
      10,
      `Epic 8 overhead (${overhead.toFixed(2)}%) should be less than 10%`,
    );
  });

  it('DenyList check should be sub-millisecond per entity', async function () {
    const { DenyList } = await import('../../../shared/dist/pii/index.js');

    const testEntities = [
      { text: 'Montant', type: 'AMOUNT' },
      { text: 'CHF 1,234.56', type: 'AMOUNT' },
      { text: 'Jean Dupont', type: 'PERSON_NAME' },
      { text: 'Total', type: 'AMOUNT' },
      { text: 'test@example.com', type: 'EMAIL' },
    ];

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      for (const entity of testEntities) {
        DenyList.isDenied(entity.text, entity.type, 'fr');
      }
    }

    const end = performance.now();
    const totalCalls = iterations * testEntities.length;
    const avgTimePerCall = (end - start) / totalCalls;

    console.log('\nDenyList Performance:');
    console.log(`  Total calls: ${totalCalls}`);
    console.log(`  Total time: ${(end - start).toFixed(2)}ms`);
    console.log(`  Avg per call: ${avgTimePerCall.toFixed(4)}ms`);

    // Each DenyList check should be <1ms
    expect(avgTimePerCall).to.be.lessThan(
      1,
      `DenyList check (${avgTimePerCall.toFixed(4)}ms) should be <1ms`,
    );
  });

  it('ContextEnhancer should be <5ms per entity on average', async function () {
    const { ContextEnhancer, getContextWords } = await import(
      '../../../shared/dist/pii/index.js'
    );

    const enhancer = new ContextEnhancer();
    const text = 'Nom: Jean Dupont, Email: jean@example.com, Tel: +41 79 123 45 67';

    const testEntities = [
      { text: 'Jean Dupont', type: 'PERSON_NAME', start: 5, end: 16, confidence: 0.5 },
      { text: 'jean@example.com', type: 'EMAIL', start: 25, end: 41, confidence: 0.6 },
      { text: '+41 79 123 45 67', type: 'PHONE', start: 48, end: 64, confidence: 0.7 },
    ];

    const iterations = 100;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      for (const entity of testEntities) {
        const contextWords = getContextWords(entity.type, 'fr');
        enhancer.enhance(entity, text, contextWords);
      }
    }

    const end = performance.now();
    const totalCalls = iterations * testEntities.length;
    const avgTimePerCall = (end - start) / totalCalls;

    console.log('\nContextEnhancer Performance:');
    console.log(`  Total calls: ${totalCalls}`);
    console.log(`  Total time: ${(end - start).toFixed(2)}ms`);
    console.log(`  Avg per call: ${avgTimePerCall.toFixed(4)}ms`);

    // Each ContextEnhancer call should be <5ms
    expect(avgTimePerCall).to.be.lessThan(
      5,
      `ContextEnhancer (${avgTimePerCall.toFixed(4)}ms) should be <5ms per entity`,
    );
  });
});
