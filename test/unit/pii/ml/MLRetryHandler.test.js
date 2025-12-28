/**
 * MLRetryHandler Unit Tests (Story 8.13)
 *
 * Tests for ML error recovery with retry logic.
 */

import { expect } from 'chai';
import {
  withRetry,
  isRetryableError,
  calculateDelay,
  MLRetryHandler,
  createMLRetryHandler,
  DEFAULT_RETRY_CONFIG,
} from '../../../../shared/dist/pii/ml/MLRetryHandler.js';

describe('MLRetryHandler (Story 8.13)', function () {
  // Allow time for retry delays in tests
  this.timeout(10000);

  describe('isRetryableError', function () {
    describe('retryable errors (transient)', function () {
      it('should return true for timeout errors', function () {
        expect(isRetryableError(new Error('Connection timeout'))).to.be.true;
        expect(isRetryableError(new Error('Request timed out'))).to.be.true;
        expect(isRetryableError(new Error('Operation timeout exceeded'))).to.be
          .true;
      });

      it('should return true for network errors', function () {
        expect(isRetryableError(new Error('Network error'))).to.be.true;
        expect(isRetryableError(new Error('ECONNREFUSED'))).to.be.true;
        expect(isRetryableError(new Error('ECONNRESET'))).to.be.true;
        expect(isRetryableError(new Error('ENOTFOUND'))).to.be.true;
        expect(isRetryableError(new Error('Connection refused'))).to.be.true;
      });

      it('should return true for model loading errors', function () {
        expect(isRetryableError(new Error('Model not ready'))).to.be.true;
        expect(isRetryableError(new Error('Model loading in progress'))).to.be
          .true;
      });

      it('should return true for rate limit errors', function () {
        expect(isRetryableError(new Error('Rate limit exceeded'))).to.be.true;
        expect(isRetryableError(new Error('Too many requests'))).to.be.true;
        expect(isRetryableError(new Error('HTTP 429'))).to.be.true;
      });

      it('should return true for server errors', function () {
        expect(isRetryableError(new Error('502 Bad Gateway'))).to.be.true;
        expect(isRetryableError(new Error('503 Service Unavailable'))).to.be
          .true;
        expect(isRetryableError(new Error('504 Gateway Timeout'))).to.be.true;
        expect(isRetryableError(new Error('Service unavailable'))).to.be.true;
        expect(isRetryableError(new Error('Bad gateway'))).to.be.true;
        expect(isRetryableError(new Error('Gateway timeout'))).to.be.true;
      });

      it('should return true for temporary errors', function () {
        expect(isRetryableError(new Error('Temporary failure'))).to.be.true;
        expect(isRetryableError(new Error('Temporarily unavailable'))).to.be
          .true;
      });
    });

    describe('fatal errors (non-retryable)', function () {
      it('should return false for invalid input errors', function () {
        expect(isRetryableError(new Error('Invalid input'))).to.be.false;
        expect(isRetryableError(new Error('Invalid configuration'))).to.be
          .false;
        expect(isRetryableError(new Error('Missing required field'))).to.be
          .false;
      });

      it('should return false for model errors', function () {
        expect(isRetryableError(new Error('Model not found'))).to.be.false;
        expect(isRetryableError(new Error('Model corrupted'))).to.be.false;
        expect(isRetryableError(new Error('Corrupted file'))).to.be.false;
      });

      it('should return false for memory errors', function () {
        expect(isRetryableError(new Error('Out of memory'))).to.be.false;
        expect(isRetryableError(new Error('OOM killed'))).to.be.false;
      });

      it('should return false for programming errors', function () {
        expect(isRetryableError(new Error('Syntax error'))).to.be.false;
        expect(isRetryableError(new Error('Type error'))).to.be.false;
        expect(isRetryableError(new Error('Reference error'))).to.be.false;
        expect(isRetryableError(new Error('Unsupported operation'))).to.be
          .false;
      });

      it('should return false for client errors', function () {
        expect(isRetryableError(new Error('400 Bad Request'))).to.be.false;
        expect(isRetryableError(new Error('401 Unauthorized'))).to.be.false;
        expect(isRetryableError(new Error('403 Forbidden'))).to.be.false;
        expect(isRetryableError(new Error('404 Not Found'))).to.be.false;
        expect(isRetryableError(new Error('405 Method Not Allowed'))).to.be
          .false;
        expect(isRetryableError(new Error('422 Unprocessable Entity'))).to.be
          .false;
      });
    });

    describe('edge cases', function () {
      it('should return false for non-Error objects', function () {
        expect(isRetryableError(null)).to.be.false;
        expect(isRetryableError(undefined)).to.be.false;
        expect(isRetryableError('string error')).to.be.false;
        expect(isRetryableError(123)).to.be.false;
        expect(isRetryableError({ message: 'object error' })).to.be.false;
      });

      it('should return false for unknown errors', function () {
        expect(isRetryableError(new Error('Something went wrong'))).to.be.false;
        expect(isRetryableError(new Error('Unknown error occurred'))).to.be
          .false;
      });

      it('should handle case-insensitive matching', function () {
        expect(isRetryableError(new Error('TIMEOUT'))).to.be.true;
        expect(isRetryableError(new Error('NETWORK ERROR'))).to.be.true;
        expect(isRetryableError(new Error('INVALID INPUT'))).to.be.false;
      });

      it('should check error name as well as message', function () {
        const err = new Error('Something failed');
        err.name = 'TimeoutError';
        expect(isRetryableError(err)).to.be.true;
      });
    });
  });

  describe('calculateDelay', function () {
    it('should use initial delay for first attempt', function () {
      const delay = calculateDelay(1, DEFAULT_RETRY_CONFIG);
      expect(delay).to.equal(100);
    });

    it('should use exponential backoff', function () {
      const config = { ...DEFAULT_RETRY_CONFIG, initialDelayMs: 100, backoffMultiplier: 2 };
      expect(calculateDelay(1, config)).to.equal(100);
      expect(calculateDelay(2, config)).to.equal(200);
      expect(calculateDelay(3, config)).to.equal(400);
      expect(calculateDelay(4, config)).to.equal(800);
    });

    it('should respect maxDelayMs', function () {
      const config = { ...DEFAULT_RETRY_CONFIG, initialDelayMs: 100, maxDelayMs: 300, backoffMultiplier: 2 };
      expect(calculateDelay(1, config)).to.equal(100);
      expect(calculateDelay(2, config)).to.equal(200);
      expect(calculateDelay(3, config)).to.equal(300); // Capped
      expect(calculateDelay(4, config)).to.equal(300); // Still capped
    });

    it('should use fixed delay when exponential backoff is disabled', function () {
      const config = { ...DEFAULT_RETRY_CONFIG, initialDelayMs: 100, useExponentialBackoff: false };
      expect(calculateDelay(1, config)).to.equal(100);
      expect(calculateDelay(2, config)).to.equal(100);
      expect(calculateDelay(3, config)).to.equal(100);
    });
  });

  describe('withRetry', function () {
    it('should succeed on first attempt when no error', async function () {
      let callCount = 0;
      const result = await withRetry(async () => {
        callCount++;
        return 'success';
      });

      expect(result.success).to.be.true;
      expect(result.result).to.equal('success');
      expect(result.attempts).to.equal(1);
      expect(callCount).to.equal(1);
      expect(result.totalDurationMs).to.be.at.least(0);
    });

    it('should retry on transient error and succeed', async function () {
      let callCount = 0;
      const result = await withRetry(
        async () => {
          callCount++;
          if (callCount < 2) {
            throw new Error('Connection timeout');
          }
          return 'success after retry';
        },
        { maxRetries: 3, initialDelayMs: 10 },
      );

      expect(result.success).to.be.true;
      expect(result.result).to.equal('success after retry');
      expect(result.attempts).to.equal(2);
      expect(callCount).to.equal(2);
    });

    it('should fail immediately on fatal error', async function () {
      let callCount = 0;
      const result = await withRetry(
        async () => {
          callCount++;
          throw new Error('Invalid input');
        },
        { maxRetries: 3, initialDelayMs: 10 },
      );

      expect(result.success).to.be.false;
      expect(result.error).to.be.instanceOf(Error);
      expect(result.error.message).to.equal('Invalid input');
      expect(result.attempts).to.equal(1);
      expect(callCount).to.equal(1);
    });

    it('should fail after max retries exhausted', async function () {
      let callCount = 0;
      const result = await withRetry(
        async () => {
          callCount++;
          throw new Error('Connection timeout');
        },
        { maxRetries: 2, initialDelayMs: 10 },
      );

      expect(result.success).to.be.false;
      expect(result.error).to.be.instanceOf(Error);
      expect(result.error.message).to.equal('Connection timeout');
      expect(result.attempts).to.equal(3); // Initial + 2 retries
      expect(callCount).to.equal(3);
    });

    it('should track total duration', async function () {
      const result = await withRetry(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 50));
          return 'done';
        },
        { maxRetries: 1 },
      );

      expect(result.success).to.be.true;
      expect(result.totalDurationMs).to.be.at.least(50);
    });

    it('should apply exponential backoff delays', async function () {
      let callCount = 0;
      const startTime = Date.now();

      const result = await withRetry(
        async () => {
          callCount++;
          if (callCount < 3) {
            throw new Error('Connection timeout');
          }
          return 'success';
        },
        { maxRetries: 3, initialDelayMs: 50, backoffMultiplier: 2 },
      );

      const elapsed = Date.now() - startTime;

      expect(result.success).to.be.true;
      expect(result.attempts).to.equal(3);
      // Should have waited at least 50ms + 100ms = 150ms between attempts
      expect(elapsed).to.be.at.least(140); // Allow some tolerance
    });

    it('should use default config when not specified', async function () {
      const result = await withRetry(async () => 'default config');
      expect(result.success).to.be.true;
      expect(result.result).to.equal('default config');
    });

    it('should convert non-Error throws to Error objects', async function () {
      const result = await withRetry(
        async () => {
          throw 'string error';
        },
        { maxRetries: 0 },
      );

      expect(result.success).to.be.false;
      expect(result.error).to.be.instanceOf(Error);
      expect(result.error.message).to.equal('string error');
    });
  });

  describe('MLRetryHandler class', function () {
    it('should create with default config', function () {
      const handler = new MLRetryHandler();
      const config = handler.getConfig();
      expect(config.maxRetries).to.equal(3);
      expect(config.initialDelayMs).to.equal(100);
      expect(config.maxDelayMs).to.equal(5000);
      expect(config.backoffMultiplier).to.equal(2);
      expect(config.useExponentialBackoff).to.be.true;
    });

    it('should create with custom config', function () {
      const handler = new MLRetryHandler({ maxRetries: 5, initialDelayMs: 200 });
      const config = handler.getConfig();
      expect(config.maxRetries).to.equal(5);
      expect(config.initialDelayMs).to.equal(200);
    });

    it('should execute with retry logic', async function () {
      const handler = new MLRetryHandler({ maxRetries: 2, initialDelayMs: 10 });
      let callCount = 0;

      const result = await handler.execute(async () => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Temporary failure');
        }
        return 42;
      });

      expect(result.success).to.be.true;
      expect(result.result).to.equal(42);
      expect(result.attempts).to.equal(2);
    });

    it('should check if error is retryable', function () {
      const handler = new MLRetryHandler();
      expect(handler.isRetryable(new Error('timeout'))).to.be.true;
      expect(handler.isRetryable(new Error('invalid input'))).to.be.false;
    });

    it('should allow configuration updates', function () {
      const handler = new MLRetryHandler({ maxRetries: 1 });
      expect(handler.getConfig().maxRetries).to.equal(1);

      handler.configure({ maxRetries: 5 });
      expect(handler.getConfig().maxRetries).to.equal(5);
    });
  });

  describe('createMLRetryHandler factory', function () {
    it('should create handler with default config', function () {
      const handler = createMLRetryHandler();
      expect(handler).to.be.instanceOf(MLRetryHandler);
      expect(handler.getConfig().maxRetries).to.equal(3);
    });

    it('should create handler with custom config', function () {
      const handler = createMLRetryHandler({ maxRetries: 10 });
      expect(handler.getConfig().maxRetries).to.equal(10);
    });
  });

  describe('DEFAULT_RETRY_CONFIG', function () {
    it('should have expected default values', function () {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).to.equal(3);
      expect(DEFAULT_RETRY_CONFIG.initialDelayMs).to.equal(100);
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).to.equal(5000);
      expect(DEFAULT_RETRY_CONFIG.backoffMultiplier).to.equal(2);
      expect(DEFAULT_RETRY_CONFIG.useExponentialBackoff).to.be.true;
    });
  });
});
