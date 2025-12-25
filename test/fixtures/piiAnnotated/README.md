# Golden Test Dataset

This directory contains annotated documents for PII detection accuracy measurement.

## Structure

```
piiAnnotated/
├── invoices/          # Invoice documents (Swiss/EU formats)
├── letters/           # Business letters, personal correspondence
├── forms/             # Application forms, registration documents
├── contracts/         # Employment contracts, service agreements
└── annotations.json   # Ground truth PII annotations
```

## Annotation Format

Each document has corresponding annotations in `annotations.json`:

```json
{
  "documents": [
    {
      "id": "invoice-001",
      "path": "invoices/invoice-001.pdf",
      "language": "de",
      "documentType": "invoice",
      "entities": [
        {
          "type": "PERSON",
          "text": "Max Mustermann",
          "start": 145,
          "end": 159,
          "confidence": 1.0
        },
        {
          "type": "SWISS_ADDRESS",
          "text": "Bahnhofstrasse 10, 8001 Zürich",
          "start": 161,
          "end": 191,
          "confidence": 1.0,
          "components": {
            "street": "Bahnhofstrasse 10",
            "postalCode": "8001",
            "city": "Zürich"
          }
        }
      ]
    }
  ]
}
```

## Entity Types

| Type | Description | Example |
|------|-------------|---------|
| PERSON | Person names | Max Mustermann |
| ORGANIZATION | Company names | Swisscom AG |
| SWISS_AVS | Swiss social security | 756.1234.5678.90 |
| IBAN | Bank account numbers | CH93 0076 2011 6238 5295 7 |
| SWISS_ADDRESS | Full Swiss addresses | Bahnhofstrasse 10, 8001 Zürich |
| EU_ADDRESS | Full EU addresses | Rue de la Paix 5, 75002 Paris |
| PHONE | Phone numbers | +41 44 123 45 67 |
| EMAIL | Email addresses | max@example.ch |
| DATE | Dates with context | 15. Januar 1985 |

## Coverage Requirements

- **Minimum:** 100 documents
- **Languages:** EN (30%), FR (30%), DE (40%)
- **Document types:** Invoices (30%), Letters (25%), Forms (25%), Contracts (20%)
- **Entity coverage:** Each entity type must appear at least 10 times

## Accuracy Calculation

```
Precision = True Positives / (True Positives + False Positives)
Recall = True Positives / (True Positives + False Negatives)
F1 = 2 * (Precision * Recall) / (Precision + Recall)
```

Target: F1 >= 0.98 (98%)

## Ground Truth Files

### realistic-ground-truth.json

Ground truth annotations for `test/fixtures/realistic/` documents, used by:
- **Story 8.6** - Integration tests & quality validation
- **Epic 8 ML stories** - Precision/recall regression testing

Current coverage:
- 12 fully annotated documents (invoices, letters, HR, support emails)
- 6 pending annotation (contracts, bills)
- 117 total annotated entities across 9 entity types

### Using with Accuracy Utilities

```javascript
import { calculatePrecisionRecall, meetsThresholds } from '../../shared/test/accuracy.js';
import groundTruth from './realistic-ground-truth.json';

// Get ground truth for a document
const doc = groundTruth.documents['invoice-fr.txt'];
const expected = doc.entities;

// Calculate metrics
const detected = await detectPII(documentText);
const metrics = calculatePrecisionRecall(detected, expected);

// Check against targets
const result = meetsThresholds(metrics, {
  precision: 0.90,
  recall: 0.90,
  perEntityType: {
    SWISS_AVS: { precision: 0.98 },
    IBAN: { precision: 0.95 }
  }
});
```

### Baseline Metrics

See `test/baselines/epic8-before.json` for pre-Epic 8 baseline metrics used in regression testing.
