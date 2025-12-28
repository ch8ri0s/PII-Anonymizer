# Presidio Test Fixtures

Test data sourced from [Microsoft Presidio Research](https://github.com/microsoft/presidio-research) and [Presidio Analyzer Tests](https://github.com/microsoft/presidio/tree/main/presidio-analyzer/tests).

## License

Presidio is licensed under the MIT License. See the [original repository](https://github.com/microsoft/presidio) for full license terms.

## Files

| File | Source | Description |
|------|--------|-------------|
| `iban_test_cases.json` | Extracted from presidio-analyzer tests | 20+ valid IBANs, 8 invalid IBANs, formatted variants |

## Entity Type Mapping

Presidio uses different entity type names than our system. The mapping is:

| Presidio Type | Our Type |
|---------------|----------|
| `PERSON` | `PERSON_NAME` |
| `EMAIL_ADDRESS` | `EMAIL` |
| `PHONE_NUMBER` | `PHONE_NUMBER` |
| `IBAN_CODE` | `IBAN` |
| `CREDIT_CARD` | `CREDIT_CARD` |
| `IP_ADDRESS` | `IP_ADDRESS` |
| `DATE_TIME` | `DATE` |
| `LOCATION` | `ADDRESS` |
| `ORGANIZATION` | `ORGANIZATION` |

## Usage

```javascript
import { loadIbanTestCases } from '../../../shared/dist/test/presidioAdapter.js';

const ibanCases = loadIbanTestCases();
for (const testCase of ibanCases.valid_ibans) {
  const result = await pipeline.detect(`IBAN: ${testCase.iban}`);
  // Verify detection
}
```

## Modifications

- Entity types mapped to our naming convention
- Added Swiss/EU specific test cases not present in Presidio
- Formatted for our JSON schema structure

## Attribution

This test data is used for compatibility testing and quality validation.
Original data is Copyright Microsoft Corporation under MIT License.
