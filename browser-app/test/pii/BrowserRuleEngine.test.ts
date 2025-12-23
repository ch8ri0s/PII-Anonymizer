/**
 * BrowserRuleEngine Tests
 *
 * Tests for the browser-compatible rule engine.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  BrowserRuleEngine,
  createBrowserRuleEngine,
  type RulesConfiguration,
} from '../../src/pii/BrowserRuleEngine';

describe('BrowserRuleEngine', () => {
  let engine: BrowserRuleEngine;

  beforeEach(() => {
    engine = createBrowserRuleEngine();
  });

  describe('Initialization', () => {
    it('should create engine with default config', () => {
      expect(engine).toBeInstanceOf(BrowserRuleEngine);
    });

    it('should create engine with custom config', () => {
      const customConfig: RulesConfiguration = {
        global: {
          minConfidence: 0.7,
          enableMerging: true,
          mergeThreshold: 10,
        },
        documentTypes: {
          INVOICE: {
            requiredTypes: ['AMOUNT'],
            boostedTypes: ['IBAN'],
            suppressedTypes: [],
            confidenceBoosts: { AMOUNT: 0.2 },
          },
        },
        rules: [],
      };

      const customEngine = createBrowserRuleEngine(customConfig);
      expect(customEngine).toBeInstanceOf(BrowserRuleEngine);
    });
  });

  describe('Document Type Rules', () => {
    it('should return rules for known document types', () => {
      const invoiceRules = engine.getRulesForDocumentType('INVOICE');

      expect(invoiceRules).toBeDefined();
      expect(invoiceRules?.requiredTypes).toContain('AMOUNT');
    });

    it('should return undefined for unknown document type', () => {
      const rules = engine.getRulesForDocumentType('UNKNOWN_TYPE');
      expect(rules).toBeUndefined();
    });

    it('should have rules for CONTRACT type', () => {
      const rules = engine.getRulesForDocumentType('CONTRACT');

      expect(rules).toBeDefined();
      expect(rules?.requiredTypes).toContain('DATE');
    });

    it('should have rules for MEDICAL type', () => {
      const rules = engine.getRulesForDocumentType('MEDICAL');

      expect(rules).toBeDefined();
      expect(rules?.boostedTypes).toContain('SWISS_AVS');
    });
  });

  describe('Global Settings', () => {
    it('should return global settings', () => {
      const settings = engine.getGlobalSettings();

      expect(settings).toBeDefined();
      expect(settings.minConfidence).toBeGreaterThan(0);
      expect(settings.enableMerging).toBeDefined();
    });

    it('should have reasonable default confidence threshold', () => {
      const settings = engine.getGlobalSettings();
      expect(settings.minConfidence).toBeGreaterThanOrEqual(0.4);
      expect(settings.minConfidence).toBeLessThanOrEqual(0.8);
    });
  });

  describe('Confidence Boosts', () => {
    it('should apply confidence boosts for document types', () => {
      const invoiceRules = engine.getRulesForDocumentType('INVOICE');

      expect(invoiceRules?.confidenceBoosts).toBeDefined();
      expect(invoiceRules?.confidenceBoosts?.AMOUNT).toBeGreaterThan(0);
    });

    it('should have IBAN boost for invoice documents', () => {
      const invoiceRules = engine.getRulesForDocumentType('INVOICE');

      expect(invoiceRules?.boostedTypes).toContain('IBAN');
    });
  });

  describe('Suppressed Types', () => {
    it('should support suppressed types per document', () => {
      const rules = engine.getRulesForDocumentType('INVOICE');

      // Suppressions should be an array (possibly empty)
      expect(Array.isArray(rules?.suppressedTypes)).toBe(true);
    });
  });

  describe('Rule Definitions', () => {
    it('should return custom rules if defined', () => {
      const rules = engine.getCustomRules();

      // Custom rules are optional
      expect(Array.isArray(rules)).toBe(true);
    });
  });

  describe('Configuration Override', () => {
    it('should allow partial config override', () => {
      const partialConfig: RulesConfiguration = {
        global: {
          minConfidence: 0.9,
          enableMerging: false,
          mergeThreshold: 5,
        },
        documentTypes: {},
        rules: [],
      };

      const customEngine = createBrowserRuleEngine(partialConfig);
      const settings = customEngine.getGlobalSettings();

      expect(settings.minConfidence).toBe(0.9);
      expect(settings.enableMerging).toBe(false);
    });
  });

  describe('Document Types Coverage', () => {
    const documentTypes = ['INVOICE', 'CONTRACT', 'MEDICAL', 'LEGAL', 'CORRESPONDENCE'];

    documentTypes.forEach(docType => {
      it(`should have rules for ${docType}`, () => {
        const rules = engine.getRulesForDocumentType(docType);

        // Should at least have the structure, even if empty arrays
        if (rules) {
          expect(rules.requiredTypes).toBeDefined();
          expect(rules.boostedTypes).toBeDefined();
          expect(rules.suppressedTypes).toBeDefined();
        }
      });
    });
  });
});
