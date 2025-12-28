/**
 * Unit tests for Recognizer Types
 *
 * Tests cover:
 * - Interface type exports
 * - Default configuration values
 * - Type validation
 *
 * @module test/unit/pii/recognizers/types.test
 */

import { expect } from 'chai';
import {
  DEFAULT_RECOGNIZER_CONFIG,
  DEFAULT_REGISTRY_CONFIG,
} from '../../../../shared/dist/pii/index.js';

describe('Recognizer Types', function () {
  describe('DEFAULT_RECOGNIZER_CONFIG', function () {
    it('should have default priority of 50 (AC-8.5.6)', function () {
      expect(DEFAULT_RECOGNIZER_CONFIG.priority).to.equal(50);
    });

    it('should have default specificity of "country"', function () {
      expect(DEFAULT_RECOGNIZER_CONFIG.specificity).to.equal('country');
    });

    it('should have empty contextWords by default', function () {
      expect(DEFAULT_RECOGNIZER_CONFIG.contextWords).to.deep.equal([]);
    });

    it('should have empty denyPatterns by default', function () {
      expect(DEFAULT_RECOGNIZER_CONFIG.denyPatterns).to.deep.equal([]);
    });

    it('should use global context by default', function () {
      expect(DEFAULT_RECOGNIZER_CONFIG.useGlobalContext).to.be.true;
    });

    it('should use global deny list by default', function () {
      expect(DEFAULT_RECOGNIZER_CONFIG.useGlobalDenyList).to.be.true;
    });
  });

  describe('DEFAULT_REGISTRY_CONFIG', function () {
    it('should have lowConfidenceMultiplier of 0.4 (AC-8.5.9)', function () {
      expect(DEFAULT_REGISTRY_CONFIG.lowConfidenceMultiplier).to.equal(0.4);
    });

    it('should have empty lowScoreEntityNames by default', function () {
      expect(DEFAULT_REGISTRY_CONFIG.lowScoreEntityNames).to.deep.equal([]);
    });

    it('should have empty enabledCountries by default (all enabled)', function () {
      expect(DEFAULT_REGISTRY_CONFIG.enabledCountries).to.deep.equal([]);
    });

    it('should have empty enabledLanguages by default (all enabled)', function () {
      expect(DEFAULT_REGISTRY_CONFIG.enabledLanguages).to.deep.equal([]);
    });

    it('should have empty enabledRecognizers by default (all enabled)', function () {
      expect(DEFAULT_REGISTRY_CONFIG.enabledRecognizers).to.deep.equal([]);
    });
  });
});
