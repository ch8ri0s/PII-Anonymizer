# Story 8.6: Integration Tests & Quality Validation

## Story

As a **QA engineer**,
I want **comprehensive tests validating quality improvements**,
So that **regression is prevented and targets are verified**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.6 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | Backlog |
| **Created** | 2025-12-23 |

## Acceptance Criteria

**Given** test suite execution
**When** DenyList tests run
**Then** table headers are correctly filtered

**And** ContextEnhancer tests verify confidence boosting
**And** integration tests process real documents with known PII
**And** precision metric improves from ~75% to >90%
**And** recall remains ≥90% (Electron), ≥85% (Browser)
**And** per-entity-type precision/recall targets are defined and tested (e.g. SWISS_AVS precision >98%, IBAN recall >95%)
**And** document-type-stratified tests exist (invoices, letters, HR docs, support emails)
**And** golden snapshots of expected entities are maintained for key fixtures (fail on any deviation)
**And** quality metrics are compatible with Accuracy Dashboard format for reporting

## Technical Design

### Test Files to Create

```
test/
├── unit/pii/context/
│   ├── DenyList.test.ts
│   ├── ContextWords.test.ts
│   └── ContextEnhancer.test.ts
├── unit/pii/recognizers/
│   └── BaseRecognizer.test.ts
└── integration/pii/
    └── QualityValidation.test.ts

browser-app/test/
├── unit/pii/context/
│   ├── DenyList.test.ts
│   ├── ContextWords.test.ts
│   └── ContextEnhancer.test.ts
└── integration/pii/
    └── QualityValidation.test.ts
```

### DenyList Unit Tests

```typescript
// test/unit/pii/context/DenyList.test.ts

import { expect } from 'chai';
import { DenyList } from '../../../shared/pii/context/DenyList';

describe('DenyList', () => {
  describe('isDenied', () => {
    it('should deny French table headers', () => {
      expect(DenyList.isDenied('Montant', 'PERSON_NAME')).to.be.true;
      expect(DenyList.isDenied('Libellé', 'PERSON_NAME')).to.be.true;
      expect(DenyList.isDenied('Description', 'PERSON_NAME')).to.be.true;
    });

    it('should deny German table headers', () => {
      expect(DenyList.isDenied('Beschreibung', 'PERSON_NAME')).to.be.true;
      expect(DenyList.isDenied('Betrag', 'PERSON_NAME')).to.be.true;
    });

    it('should deny English table headers', () => {
      expect(DenyList.isDenied('Amount', 'PERSON_NAME')).to.be.true;
      expect(DenyList.isDenied('Total', 'PERSON_NAME')).to.be.true;
    });

    it('should allow valid person names', () => {
      expect(DenyList.isDenied('Jean Dupont', 'PERSON_NAME')).to.be.false;
      expect(DenyList.isDenied('Marie Müller', 'PERSON_NAME')).to.be.false;
    });

    it('should be case-insensitive', () => {
      expect(DenyList.isDenied('MONTANT', 'PERSON_NAME')).to.be.true;
      expect(DenyList.isDenied('montant', 'PERSON_NAME')).to.be.true;
    });

    it('should deny acronyms from PERSON_NAME', () => {
      expect(DenyList.isDenied('TVA', 'PERSON_NAME')).to.be.true;
      expect(DenyList.isDenied('CHF', 'PERSON_NAME')).to.be.true;
    });

    it('should allow acronyms for other entity types', () => {
      expect(DenyList.isDenied('TVA', 'ORGANIZATION')).to.be.false;
    });
  });
});
```

### ContextWords Unit Tests

```typescript
// test/unit/pii/context/ContextWords.test.ts

import { expect } from 'chai';
import { getContextWords, getAllContextWords } from '../../../shared/pii/context/ContextWords';

describe('ContextWords', () => {
  describe('getContextWords', () => {
    it('should return English PERSON_NAME words', () => {
      const words = getContextWords('PERSON_NAME', 'en');
      expect(words).to.include('name');
      expect(words).to.include('mr');
      expect(words).to.include('mrs');
    });

    it('should return French PERSON_NAME words', () => {
      const words = getContextWords('PERSON_NAME', 'fr');
      expect(words).to.include('nom');
      expect(words).to.include('m.');
      expect(words).to.include('mme');
    });

    it('should return German PERSON_NAME words', () => {
      const words = getContextWords('PERSON_NAME', 'de');
      expect(words).to.include('name');
      expect(words).to.include('herr');
      expect(words).to.include('frau');
    });

    it('should return PHONE_NUMBER context words', () => {
      const words = getContextWords('PHONE_NUMBER', 'en');
      expect(words).to.include('phone');
      expect(words).to.include('tel');
      expect(words).to.include('mobile');
    });

    it('should return empty array for unknown type', () => {
      const words = getContextWords('UNKNOWN_TYPE', 'en');
      expect(words).to.be.an('array').that.is.empty;
    });
  });

  describe('getAllContextWords', () => {
    it('should return all languages combined', () => {
      const words = getAllContextWords('PERSON_NAME');
      expect(words).to.include('name');   // English
      expect(words).to.include('nom');    // French
      expect(words).to.include('herr');   // German
    });
  });
});
```

### ContextEnhancer Unit Tests

```typescript
// test/unit/pii/context/ContextEnhancer.test.ts

import { expect } from 'chai';
import { ContextEnhancer } from '../../../shared/pii/context/ContextEnhancer';

describe('ContextEnhancer', () => {
  let enhancer: ContextEnhancer;

  beforeEach(() => {
    enhancer = new ContextEnhancer();
  });

  describe('enhance', () => {
    it('should boost confidence when context found', () => {
      const entity = {
        text: 'Jean Dupont',
        type: 'PERSON_NAME',
        start: 5,
        end: 16,
        confidence: 0.5
      };
      const text = 'Nom: Jean Dupont, Tel: ...';
      const contextWords = ['nom', 'name'];

      const result = enhancer.enhance(entity, text, contextWords);
      expect(result.confidence).to.be.greaterThan(0.5);
      expect(result.confidence).to.be.at.most(0.85); // 0.5 + 0.35
    });

    it('should keep original confidence without context', () => {
      const entity = {
        text: 'Jean',
        type: 'PERSON_NAME',
        start: 10,
        end: 14,
        confidence: 0.5
      };
      const text = 'Something Jean something else';
      const contextWords = ['nom', 'name'];

      const result = enhancer.enhance(entity, text, contextWords);
      expect(result.confidence).to.equal(0.5);
    });

    it('should cap confidence at 1.0', () => {
      const entity = {
        text: 'Jean Dupont',
        type: 'PERSON_NAME',
        start: 5,
        end: 16,
        confidence: 0.9
      };
      const text = 'Nom: Jean Dupont';
      const contextWords = ['nom'];

      const result = enhancer.enhance(entity, text, contextWords);
      expect(result.confidence).to.be.at.most(1.0);
    });

    it('should respect minimum score with context', () => {
      const entity = {
        text: 'J',
        type: 'PERSON_NAME',
        start: 5,
        end: 6,
        confidence: 0.2
      };
      const text = 'Nom: J something';
      const contextWords = ['nom'];

      const result = enhancer.enhance(entity, text, contextWords);
      expect(result.confidence).to.be.at.least(0.4); // minScoreWithContext
    });

    it('should respect window size', () => {
      const enhancer = new ContextEnhancer({ windowSize: 10 });
      const entity = {
        text: 'Jean',
        type: 'PERSON_NAME',
        start: 50,
        end: 54,
        confidence: 0.5
      };
      // "Nom:" is at position 0, outside 10-char window
      const text = 'Nom: ' + '.'.repeat(45) + 'Jean';
      const contextWords = ['nom'];

      const result = enhancer.enhance(entity, text, contextWords);
      expect(result.confidence).to.equal(0.5); // No boost, outside window
    });
  });
});
```

### Integration Quality Tests

```typescript
// test/integration/pii/QualityValidation.test.ts

import { expect } from 'chai';
import { DetectionPipeline } from '../../../src/pii/DetectionPipeline';
import * as fs from 'fs';
import * as path from 'path';

describe('PII Detection Quality Validation', () => {
  let pipeline: DetectionPipeline;

  before(() => {
    pipeline = new DetectionPipeline();
  });

  describe('False Positive Reduction', () => {
    it('should not detect table headers as PERSON_NAME', async () => {
      const text = `
        | Libellé | Montant | Quantité |
        |---------|---------|----------|
        | Article | 100.00  | 2        |
      `;

      const result = await pipeline.detect(text, { language: 'fr' });
      const personNames = result.entities.filter(e => e.type === 'PERSON_NAME');

      expect(personNames).to.have.length(0);
    });

    it('should detect real names in invoice context', async () => {
      const text = `
        Facture
        Client: Jean Dupont
        Adresse: Rue de Lausanne 12

        | Libellé | Montant |
        |---------|---------|
        | Service | 100.00  |
      `;

      const result = await pipeline.detect(text, { language: 'fr' });
      const personNames = result.entities.filter(e => e.type === 'PERSON_NAME');

      expect(personNames).to.have.length.at.least(1);
      expect(personNames[0].text).to.equal('Jean Dupont');
    });
  });

  describe('Context Enhancement', () => {
    it('should boost confidence for names with context', async () => {
      const textWithContext = 'Nom: Jean Dupont';
      const textWithoutContext = 'Jean Dupont';

      const resultWith = await pipeline.detect(textWithContext, { language: 'fr' });
      const resultWithout = await pipeline.detect(textWithoutContext, { language: 'fr' });

      const confWith = resultWith.entities[0]?.confidence || 0;
      const confWithout = resultWithout.entities[0]?.confidence || 0;

      expect(confWith).to.be.greaterThan(confWithout);
    });
  });

  describe('Quality Metrics', () => {
    it('should achieve precision >90% overall', async () => {
      // Load annotated test documents
      const fixtures = loadQualityFixtures();

      let truePositives = 0;
      let falsePositives = 0;

      for (const fixture of fixtures) {
        const result = await pipeline.detect(fixture.text, { language: fixture.language });

        for (const entity of result.entities) {
          if (fixture.expectedPII.some(e =>
            e.text === entity.text && e.type === entity.type
          )) {
            truePositives++;
          } else {
            falsePositives++;
          }
        }
      }

      const precision = truePositives / (truePositives + falsePositives);
      expect(precision).to.be.at.least(0.90);
    });

    it('should achieve per-entity-type precision targets', async () => {
      const fixtures = loadQualityFixtures();
      const targets: Record<string, number> = {
        SWISS_AVS: 0.98,
        IBAN: 0.95,
        PERSON_NAME: 0.90,
        EMAIL: 0.92,
        PHONE_NUMBER: 0.90
      };

      for (const [entityType, targetPrecision] of Object.entries(targets)) {
        let tp = 0, fp = 0;
        for (const fixture of fixtures) {
          const result = await pipeline.detect(fixture.text, { language: fixture.language });
          const entities = result.entities.filter(e => e.type === entityType);
          const expected = fixture.expectedPII.filter(e => e.type === entityType);

          for (const entity of entities) {
            if (expected.some(e => e.text === entity.text)) {
              tp++;
            } else {
              fp++;
            }
          }
        }
        const precision = tp / (tp + fp);
        expect(precision, `${entityType} precision`).to.be.at.least(targetPrecision);
      }
    });

    it('should match golden snapshots for key fixtures', async () => {
      const goldenFixtures = loadGoldenFixtures();
      
      for (const fixture of goldenFixtures) {
        const result = await pipeline.detect(fixture.text, { language: fixture.language });
        const actualEntities = result.entities.map(e => ({
          text: e.text,
          type: e.type,
          start: e.start,
          end: e.end,
          confidence: Math.round(e.confidence * 100) / 100 // Round for comparison
        }));
        
        // Compare with golden snapshot (fail on any difference)
        expect(actualEntities).to.deep.equal(fixture.goldenEntities);
      }
    });

    it('should maintain recall ≥90% (Electron)', async () => {
      const fixtures = loadQualityFixtures();

      let truePositives = 0;
      let falseNegatives = 0;

      for (const fixture of fixtures) {
        const result = await pipeline.detect(fixture.text, { language: fixture.language });

        for (const expected of fixture.expectedPII) {
          if (result.entities.some(e =>
            e.text === expected.text && e.type === expected.type
          )) {
            truePositives++;
          } else {
            falseNegatives++;
          }
        }
      }

      const recall = truePositives / (truePositives + falseNegatives);
      expect(recall).to.be.at.least(0.90);
    });
  });
});

function loadQualityFixtures() {
  // Load annotated test documents from fixtures
  const fixturesPath = path.join(__dirname, '../../fixtures/quality');
  // Return array of { text, language, expectedPII }
  return [];
}
```

## Prerequisites

- Stories 8.1-8.5 completed

## Shared Test Infrastructure (Phase 1 Complete)

### Shared Accuracy Utilities

Located in `shared/test/accuracy.ts`, provides:

```typescript
import {
  calculatePrecisionRecall,
  matchEntities,
  compareWithGoldenSnapshot,
  meetsThresholds,
  aggregateMetrics,
  formatMetrics,
  normalizeEntityType,
  type Entity,
  type AccuracyMetrics,
} from '@shared-test/accuracy';
```

**Key Functions:**
- `calculatePrecisionRecall(detected, expected)` - Core metrics calculation
- `matchEntities(detected, expected, options)` - Entity matching with fuzzy support
- `compareWithGoldenSnapshot(actual, golden)` - Golden snapshot comparison
- `meetsThresholds(metrics, thresholds)` - Threshold validation for CI
- `aggregateMetrics(metricsArray)` - Multi-document aggregation

### Baseline Metrics

Located in `test/baselines/epic8-before.json`:

| Metric | Pre-Epic 8 (Rule-based) | Target (Post-Epic 8) |
|--------|-------------------------|----------------------|
| Overall Precision | 100% | >90% |
| Overall Recall | 54.2% | ≥90% (Electron), ≥85% (Browser) |
| SWISS_AVS | 100%/100% | >98% precision |
| IBAN | 100%/100% | >95% precision |
| PERSON_NAME | 0%/0% (ML needed) | >90% precision |
| ADDRESS | 0%/0% (ML needed) | >85% precision |

**Capture Script:** `node scripts/capture-baseline.mjs`

### Ground Truth Annotations

Located in `test/fixtures/piiAnnotated/realistic-ground-truth.json`:
- 12 annotated documents (invoice, letter, HR, support-email × 3 languages)
- 117 annotated entities across 9 entity types
- Used by both Electron (Mocha) and Browser (Vitest) tests

## Test Fixtures (Existing)

Using `test/fixtures/piiAnnotated/realistic-ground-truth.json` instead of separate quality fixtures.

**Document coverage:**
- `invoice-{en,fr,de}.txt` - Invoices with IBAN, AVS, addresses
- `letter-{en,fr,de}.txt` - Business letters with names, organizations
- `hr-{en,fr,de}.txt` - HR documents with sensitive PII
- `support-email-{en,fr,de}.txt` - Support emails with contact info

**Golden snapshots** are embedded in ground truth with exact positions and confidence values.

## Definition of Done

- [ ] All unit test files created
- [ ] All integration test files created
- [ ] Quality fixtures created with annotations (invoices, letters, HR docs, emails)
- [ ] Golden snapshots created for key fixtures
- [ ] Per-entity-type precision targets defined and tested
- [ ] Document-type-stratified tests implemented
- [ ] Tests pass on Electron platform
- [ ] Tests pass on Browser platform (Vitest)
- [ ] Precision metric verified >90% overall
- [ ] Per-entity-type precision targets met (SWISS_AVS >98%, IBAN >95%, etc.)
- [ ] Recall metric verified ≥90% (Electron), ≥85% (Browser)
- [ ] Golden snapshot tests fail on any deviation (regression detection)
- [ ] Quality metrics exportable in Accuracy Dashboard-compatible format
- [ ] No regressions in existing tests
