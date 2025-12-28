/**
 * MLMetrics Unit Tests (Story 8.14)
 *
 * Tests for ML performance monitoring and metrics collection.
 */

import { expect } from 'chai';
import {
  MLMetricsCollector,
  createMLMetricsCollector,
  recordMLMetrics,
  getAggregatedMetrics,
  exportMetrics,
  clearMetrics,
  getMetricsCount,
  aggregateMetrics,
  createInferenceMetrics,
  getGlobalCollector,
  DEFAULT_METRICS_CONFIG,
} from '../../../../shared/dist/pii/ml/MLMetrics.js';

describe('MLMetrics (Story 8.14)', function () {
  // Reset global collector before each test
  beforeEach(function () {
    clearMetrics();
  });

  describe('MLInferenceMetrics creation', function () {
    it('should create metrics from inference parameters', function () {
      const startTime = Date.now() - 100;
      const endTime = Date.now();

      const metrics = createInferenceMetrics({
        startTime,
        endTime,
        textLength: 500,
        entitiesDetected: 5,
        platform: 'electron',
        modelName: 'xenova/bert-ner',
        chunked: false,
      });

      expect(metrics.durationMs).to.be.closeTo(100, 10);
      expect(metrics.textLength).to.equal(500);
      expect(metrics.entitiesDetected).to.equal(5);
      expect(metrics.platform).to.equal('electron');
      expect(metrics.modelName).to.equal('xenova/bert-ner');
      expect(metrics.chunked).to.be.false;
      expect(metrics.timestamp).to.be.a('number');
      expect(metrics.tokensProcessed).to.equal(125); // 500 / 4
    });

    it('should include optional parameters', function () {
      const metrics = createInferenceMetrics({
        startTime: Date.now() - 200,
        endTime: Date.now(),
        textLength: 2000,
        entitiesDetected: 10,
        platform: 'browser',
        modelName: 'xenova/bert-ner',
        chunked: true,
        chunkCount: 4,
        documentType: 'invoice',
        language: 'de',
        memoryUsageMB: 128.5,
        failed: false,
        retryAttempts: 2,
      });

      expect(metrics.chunkCount).to.equal(4);
      expect(metrics.documentType).to.equal('invoice');
      expect(metrics.language).to.equal('de');
      expect(metrics.memoryUsageMB).to.equal(128.5);
      expect(metrics.failed).to.be.false;
      expect(metrics.retryAttempts).to.equal(2);
    });

    it('should estimate token count from text length', function () {
      const metrics = createInferenceMetrics({
        startTime: Date.now(),
        endTime: Date.now(),
        textLength: 1000,
        entitiesDetected: 0,
        platform: 'electron',
        modelName: 'test',
        chunked: false,
      });

      // ~4 chars per token
      expect(metrics.tokensProcessed).to.equal(250);
    });
  });

  describe('MLMetricsCollector class', function () {
    it('should create with default config', function () {
      const collector = new MLMetricsCollector();
      const config = collector.getConfig();

      expect(config.maxRetention).to.equal(1000);
      expect(config.enabled).to.be.true;
    });

    it('should create with custom config', function () {
      const collector = new MLMetricsCollector({
        maxRetention: 500,
        enabled: false,
      });
      const config = collector.getConfig();

      expect(config.maxRetention).to.equal(500);
      expect(config.enabled).to.be.false;
    });

    it('should record metrics', function () {
      const collector = new MLMetricsCollector();

      collector.record(createInferenceMetrics({
        startTime: Date.now() - 100,
        endTime: Date.now(),
        textLength: 100,
        entitiesDetected: 2,
        platform: 'electron',
        modelName: 'test',
        chunked: false,
      }));

      expect(collector.getCount()).to.equal(1);
      expect(collector.getMetrics()).to.have.length(1);
    });

    it('should not record when disabled', function () {
      const collector = new MLMetricsCollector({ enabled: false });

      collector.record(createInferenceMetrics({
        startTime: Date.now(),
        endTime: Date.now(),
        textLength: 100,
        entitiesDetected: 0,
        platform: 'electron',
        modelName: 'test',
        chunked: false,
      }));

      expect(collector.getCount()).to.equal(0);
    });

    it('should enforce retention limit', function () {
      const collector = new MLMetricsCollector({ maxRetention: 5 });

      // Add 7 metrics
      for (let i = 0; i < 7; i++) {
        collector.record(createInferenceMetrics({
          startTime: Date.now() - (i * 10),
          endTime: Date.now() - (i * 10) + 5,
          textLength: i * 100,
          entitiesDetected: i,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
        }));
      }

      expect(collector.getCount()).to.equal(5);
      // Should keep the last 5 entries
      const metrics = collector.getMetrics();
      expect(metrics[0].textLength).to.equal(200);
      expect(metrics[4].textLength).to.equal(600);
    });

    it('should clear metrics', function () {
      const collector = new MLMetricsCollector();

      collector.record(createInferenceMetrics({
        startTime: Date.now(),
        endTime: Date.now(),
        textLength: 100,
        entitiesDetected: 0,
        platform: 'electron',
        modelName: 'test',
        chunked: false,
      }));

      expect(collector.getCount()).to.equal(1);
      collector.clear();
      expect(collector.getCount()).to.equal(0);
    });

    it('should update configuration', function () {
      const collector = new MLMetricsCollector();

      collector.configure({ maxRetention: 100 });
      expect(collector.getConfig().maxRetention).to.equal(100);

      collector.configure({ enabled: false });
      expect(collector.getConfig().enabled).to.be.false;
      expect(collector.getConfig().maxRetention).to.equal(100);
    });

    it('should return readonly metrics array', function () {
      const collector = new MLMetricsCollector();
      const metrics = collector.getMetrics();
      expect(metrics).to.be.an('array');
    });
  });

  describe('aggregateMetrics', function () {
    it('should return empty aggregation for empty array', function () {
      const agg = aggregateMetrics([]);

      expect(agg.totalInferences).to.equal(0);
      expect(agg.avgInferenceTimeMs).to.equal(0);
      expect(agg.p50InferenceTimeMs).to.equal(0);
      expect(agg.p95InferenceTimeMs).to.equal(0);
      expect(agg.totalEntitiesDetected).to.equal(0);
    });

    it('should calculate basic aggregations', function () {
      const metrics = [
        createInferenceMetrics({
          startTime: 0,
          endTime: 100,
          textLength: 500,
          entitiesDetected: 5,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
        }),
        createInferenceMetrics({
          startTime: 0,
          endTime: 200,
          textLength: 1000,
          entitiesDetected: 10,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
        }),
        createInferenceMetrics({
          startTime: 0,
          endTime: 300,
          textLength: 1500,
          entitiesDetected: 15,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
        }),
      ];

      const agg = aggregateMetrics(metrics);

      expect(agg.totalInferences).to.equal(3);
      expect(agg.avgInferenceTimeMs).to.equal(200);
      expect(agg.minInferenceTimeMs).to.equal(100);
      expect(agg.maxInferenceTimeMs).to.equal(300);
      expect(agg.avgTextLength).to.equal(1000);
      expect(agg.totalEntitiesDetected).to.equal(30);
      expect(agg.avgEntitiesPerDocument).to.equal(10);
    });

    it('should calculate percentiles correctly', function () {
      const metrics = [];
      // Create 100 metrics with durations 1-100
      for (let i = 1; i <= 100; i++) {
        metrics.push(createInferenceMetrics({
          startTime: 0,
          endTime: i,
          textLength: 100,
          entitiesDetected: 1,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
        }));
      }

      const agg = aggregateMetrics(metrics);

      expect(agg.p50InferenceTimeMs).to.equal(50);
      expect(agg.p95InferenceTimeMs).to.equal(95);
      expect(agg.p99InferenceTimeMs).to.equal(99);
    });

    it('should count failed inferences', function () {
      const metrics = [
        createInferenceMetrics({
          startTime: 0,
          endTime: 100,
          textLength: 100,
          entitiesDetected: 0,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
          failed: true,
        }),
        createInferenceMetrics({
          startTime: 0,
          endTime: 100,
          textLength: 100,
          entitiesDetected: 5,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
          failed: false,
        }),
        createInferenceMetrics({
          startTime: 0,
          endTime: 100,
          textLength: 100,
          entitiesDetected: 0,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
          failed: true,
        }),
      ];

      const agg = aggregateMetrics(metrics);

      expect(agg.totalInferences).to.equal(3);
      expect(agg.failedInferences).to.equal(2);
    });

    it('should group by document type', function () {
      const metrics = [
        createInferenceMetrics({
          startTime: 0,
          endTime: 100,
          textLength: 100,
          entitiesDetected: 2,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
          documentType: 'invoice',
        }),
        createInferenceMetrics({
          startTime: 0,
          endTime: 200,
          textLength: 200,
          entitiesDetected: 4,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
          documentType: 'invoice',
        }),
        createInferenceMetrics({
          startTime: 0,
          endTime: 150,
          textLength: 300,
          entitiesDetected: 6,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
          documentType: 'letter',
        }),
      ];

      const agg = aggregateMetrics(metrics);

      expect(agg.byDocumentType.invoice).to.exist;
      expect(agg.byDocumentType.invoice.totalInferences).to.equal(2);
      expect(agg.byDocumentType.invoice.avgInferenceTimeMs).to.equal(150);

      expect(agg.byDocumentType.letter).to.exist;
      expect(agg.byDocumentType.letter.totalInferences).to.equal(1);
    });

    it('should group by language', function () {
      const metrics = [
        createInferenceMetrics({
          startTime: 0,
          endTime: 100,
          textLength: 100,
          entitiesDetected: 2,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
          language: 'en',
        }),
        createInferenceMetrics({
          startTime: 0,
          endTime: 200,
          textLength: 200,
          entitiesDetected: 4,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
          language: 'de',
        }),
        createInferenceMetrics({
          startTime: 0,
          endTime: 150,
          textLength: 300,
          entitiesDetected: 6,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
          language: 'en',
        }),
      ];

      const agg = aggregateMetrics(metrics);

      expect(agg.byLanguage.en).to.exist;
      expect(agg.byLanguage.en.totalInferences).to.equal(2);

      expect(agg.byLanguage.de).to.exist;
      expect(agg.byLanguage.de.totalInferences).to.equal(1);
    });

    it('should handle unknown document type and language', function () {
      const metrics = [
        createInferenceMetrics({
          startTime: 0,
          endTime: 100,
          textLength: 100,
          entitiesDetected: 1,
          platform: 'electron',
          modelName: 'test',
          chunked: false,
          // No documentType or language
        }),
      ];

      const agg = aggregateMetrics(metrics);

      expect(agg.byDocumentType.unknown).to.exist;
      expect(agg.byLanguage.unknown).to.exist;
    });
  });

  describe('Global collector functions', function () {
    it('should return singleton collector', function () {
      const collector1 = getGlobalCollector();
      const collector2 = getGlobalCollector();

      expect(collector1).to.equal(collector2);
    });

    it('should record to global collector', function () {
      recordMLMetrics(createInferenceMetrics({
        startTime: Date.now() - 50,
        endTime: Date.now(),
        textLength: 100,
        entitiesDetected: 3,
        platform: 'browser',
        modelName: 'test',
        chunked: false,
      }));

      expect(getMetricsCount()).to.equal(1);
    });

    it('should get aggregated metrics from global collector', function () {
      recordMLMetrics(createInferenceMetrics({
        startTime: 0,
        endTime: 100,
        textLength: 500,
        entitiesDetected: 5,
        platform: 'electron',
        modelName: 'test',
        chunked: false,
      }));

      const agg = getAggregatedMetrics();

      expect(agg.totalInferences).to.equal(1);
      expect(agg.totalEntitiesDetected).to.equal(5);
    });

    it('should clear global collector', function () {
      recordMLMetrics(createInferenceMetrics({
        startTime: 0,
        endTime: 100,
        textLength: 100,
        entitiesDetected: 1,
        platform: 'electron',
        modelName: 'test',
        chunked: false,
      }));

      expect(getMetricsCount()).to.equal(1);

      clearMetrics();

      expect(getMetricsCount()).to.equal(0);
    });
  });

  describe('exportMetrics', function () {
    it('should export metrics as JSON string', function () {
      recordMLMetrics(createInferenceMetrics({
        startTime: 0,
        endTime: 100,
        textLength: 500,
        entitiesDetected: 5,
        platform: 'electron',
        modelName: 'xenova/bert-ner',
        chunked: false,
        documentType: 'invoice',
      }));

      const exported = exportMetrics();
      const parsed = JSON.parse(exported);

      expect(parsed.exportedAt).to.be.a('string');
      expect(parsed.config).to.deep.include({ maxRetention: 1000, enabled: true });
      expect(parsed.metricsCount).to.equal(1);
      expect(parsed.aggregated).to.exist;
      expect(parsed.aggregated.totalInferences).to.equal(1);
      expect(parsed.raw).to.be.an('array').with.length(1);
      expect(parsed.raw[0].textLength).to.equal(500);
    });

    it('should export empty metrics', function () {
      const exported = exportMetrics();
      const parsed = JSON.parse(exported);

      expect(parsed.metricsCount).to.equal(0);
      expect(parsed.raw).to.be.an('array').with.length(0);
      expect(parsed.aggregated.totalInferences).to.equal(0);
    });
  });

  describe('createMLMetricsCollector factory', function () {
    it('should create collector with default config', function () {
      const collector = createMLMetricsCollector();

      expect(collector).to.be.instanceOf(MLMetricsCollector);
      expect(collector.getConfig().maxRetention).to.equal(1000);
    });

    it('should create collector with custom config', function () {
      const collector = createMLMetricsCollector({ maxRetention: 200 });

      expect(collector.getConfig().maxRetention).to.equal(200);
    });
  });

  describe('DEFAULT_METRICS_CONFIG', function () {
    it('should have expected default values', function () {
      expect(DEFAULT_METRICS_CONFIG.maxRetention).to.equal(1000);
      expect(DEFAULT_METRICS_CONFIG.enabled).to.be.true;
    });
  });

  describe('Edge cases', function () {
    it('should handle single metric aggregation', function () {
      const metrics = [
        createInferenceMetrics({
          startTime: 0,
          endTime: 50,
          textLength: 250,
          entitiesDetected: 3,
          platform: 'browser',
          modelName: 'test',
          chunked: false,
        }),
      ];

      const agg = aggregateMetrics(metrics);

      expect(agg.totalInferences).to.equal(1);
      expect(agg.p50InferenceTimeMs).to.equal(50);
      expect(agg.p95InferenceTimeMs).to.equal(50);
      expect(agg.p99InferenceTimeMs).to.equal(50);
      expect(agg.minInferenceTimeMs).to.equal(50);
      expect(agg.maxInferenceTimeMs).to.equal(50);
    });

    it('should handle metrics with zero duration', function () {
      const metrics = createInferenceMetrics({
        startTime: 100,
        endTime: 100,
        textLength: 100,
        entitiesDetected: 0,
        platform: 'electron',
        modelName: 'test',
        chunked: false,
      });

      expect(metrics.durationMs).to.equal(0);
    });

    it('should handle very large text length', function () {
      const metrics = createInferenceMetrics({
        startTime: 0,
        endTime: 5000,
        textLength: 1000000, // 1MB of text
        entitiesDetected: 500,
        platform: 'browser',
        modelName: 'test',
        chunked: true,
        chunkCount: 500,
      });

      expect(metrics.tokensProcessed).to.equal(250000);
      expect(metrics.chunkCount).to.equal(500);
    });

    it('should preserve all platforms', function () {
      recordMLMetrics(createInferenceMetrics({
        startTime: 0,
        endTime: 100,
        textLength: 100,
        entitiesDetected: 1,
        platform: 'electron',
        modelName: 'test',
        chunked: false,
      }));

      recordMLMetrics(createInferenceMetrics({
        startTime: 0,
        endTime: 100,
        textLength: 100,
        entitiesDetected: 1,
        platform: 'browser',
        modelName: 'test',
        chunked: false,
      }));

      const exported = JSON.parse(exportMetrics());
      const platforms = exported.raw.map((m) => m.platform);

      expect(platforms).to.include('electron');
      expect(platforms).to.include('browser');
    });
  });
});
