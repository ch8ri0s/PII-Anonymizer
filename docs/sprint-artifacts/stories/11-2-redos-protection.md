# Story 11.2: Add ReDoS Protection to Validators

**Epic:** 11 - Validator Module Improvements
**Priority:** High (Security)
**Effort:** 2 SP
**Status:** done

---

## Problem Statement

The `EmailValidator.ts` uses a complex regex with nested quantifiers that could cause exponential backtracking (ReDoS - Regular Expression Denial of Service) with crafted inputs:

```typescript
const EMAIL_PATTERN = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
```

The nested quantifiers `(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+` could cause exponential time complexity with inputs like:
```
"a@" + "a.".repeat(100) + "!"
```

## Security Risk

- **Attack Vector:** Malicious document with crafted strings
- **Impact:** Application freeze, CPU exhaustion
- **Affected Validators:** EmailValidator, potentially others with complex regex

## Acceptance Criteria

- [x] All validators enforce maximum input length
- [x] Length check occurs BEFORE regex matching
- [x] Validation fails fast with descriptive error
- [x] Unit tests verify length limits
- [x] Performance test confirms no exponential behavior

## Input Length Limits

| Validator | Max Length | Rationale |
|-----------|------------|-----------|
| EmailValidator | 254 | RFC 5321 maximum |
| PhoneValidator | 20 | E.164 max (15) + formatting |
| IbanValidator | 34 | Longest IBAN (Malta) |
| SwissAvsValidator | 20 | 13 digits + separators |
| SwissAddressValidator | 200 | Reasonable address length |
| VatNumberValidator | 20 | EU VAT max length |
| DateValidator | 50 | Longest date format |
| SwissPostalCodeValidator | 100 | Postal code + city |

## Technical Approach

### Pattern: Early Length Check
```typescript
export class EmailValidator implements ValidationRule {
  private static readonly MAX_LENGTH = 254;

  validate(entity: ValidatorEntity): ValidationResult {
    // SECURITY: Check length before regex to prevent ReDoS
    if (entity.text.length > EmailValidator.MAX_LENGTH) {
      return {
        isValid: false,
        confidence: 0.3,
        reason: `Input exceeds maximum length (${EmailValidator.MAX_LENGTH})`,
      };
    }

    const email = entity.text.toLowerCase();
    // ... rest of validation
  }
}
```

### Apply to All Validators
Each validator file needs:
1. Static `MAX_LENGTH` constant
2. Length check as first validation step
3. Appropriate error message

## Files to Modify

1. `shared/pii/validators/EmailValidator.ts`
2. `shared/pii/validators/PhoneValidator.ts`
3. `shared/pii/validators/IbanValidator.ts`
4. `shared/pii/validators/SwissAvsValidator.ts`
5. `shared/pii/validators/SwissAddressValidator.ts`
6. `shared/pii/validators/VatNumberValidator.ts`
7. `shared/pii/validators/DateValidator.ts`
8. `shared/pii/validators/SwissPostalCodeValidator.ts`

## Testing Requirements

### Unit Tests
```javascript
describe('EmailValidator', () => {
  it('should reject inputs exceeding max length', () => {
    const longInput = 'a'.repeat(300) + '@example.com';
    const result = validateEmailFull(longInput);
    expect(result.isValid).to.be.false;
    expect(result.reason).to.include('maximum length');
  });

  it('should accept inputs at max length', () => {
    const maxInput = 'a'.repeat(240) + '@example.com'; // 252 chars
    const result = validateEmailFull(maxInput);
    // May be invalid for other reasons, but not length
    expect(result.reason).to.not.include('maximum length');
  });
});
```

### Performance Test
```javascript
describe('ReDoS Protection', () => {
  it('should validate malicious input in < 100ms', () => {
    const maliciousInput = 'a@' + 'a.'.repeat(1000) + '!';
    const start = Date.now();
    validateEmailFull(maliciousInput);
    const elapsed = Date.now() - start;
    expect(elapsed).to.be.lessThan(100);
  });
});
```

## Dependencies

- None (can be implemented independently)

## Blocks

- None (security improvement)

## References

- [OWASP ReDoS Prevention](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)
- [RFC 5321 - SMTP](https://datatracker.ietf.org/doc/html/rfc5321)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/11-2-redos-protection.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

2025-12-28: Story 11.2 found already implemented. All 8 validators have MAX_LENGTH constants and length checks before regex matching:
- EmailValidator: MAX_LENGTH = 254 (RFC 5321)
- PhoneValidator: MAX_LENGTH = 20 (E.164 + formatting)
- IbanValidator: MAX_LENGTH = 34 (Malta longest)
- SwissAvsValidator: MAX_LENGTH = 20 (13 digits + separators)
- SwissAddressValidator: MAX_LENGTH = 200 (reasonable address)
- VatNumberValidator: MAX_LENGTH = 20 (EU VAT max)
- DateValidator: MAX_LENGTH = 50 (longest date format)
- SwissPostalCodeValidator: MAX_LENGTH = 100 (postal + city)

### Completion Notes List

1. All 8 validators already have MAX_LENGTH static constants implemented
2. Length check occurs as FIRST validation step in all validators (before regex)
3. Consistent error message format: "Input exceeds maximum length (N)"
4. Unit tests in test/unit/pii/validators/ReDoSProtection.test.js (38 tests):
   - MAX_LENGTH constant verification for all 8 validators
   - Length limit enforcement tests for all 8 validators
   - Performance tests (malicious input <100ms) for all 8 validators
   - Edge cases: empty string, exactly at limit, one over limit, Unicode
5. All 1862 tests passing
6. 100 ReDoS-related tests passing specifically

### File List

| File | Status | Description |
|------|--------|-------------|
| shared/pii/validators/EmailValidator.ts | Modified | MAX_LENGTH = 254, length check before regex |
| shared/pii/validators/PhoneValidator.ts | Modified | MAX_LENGTH = 20, length check before regex |
| shared/pii/validators/IbanValidator.ts | Modified | MAX_LENGTH = 34, length check before regex |
| shared/pii/validators/SwissAvsValidator.ts | Modified | MAX_LENGTH = 20, length check before regex |
| shared/pii/validators/SwissAddressValidator.ts | Modified | MAX_LENGTH = 200, length check before regex |
| shared/pii/validators/VatNumberValidator.ts | Modified | MAX_LENGTH = 20, length check before regex |
| shared/pii/validators/DateValidator.ts | Modified | MAX_LENGTH = 50, length check before regex |
| shared/pii/validators/SwissPostalCodeValidator.ts | Modified | MAX_LENGTH = 100, length check before regex |
| test/unit/pii/validators/ReDoSProtection.test.js | Created | 38 tests for ReDoS protection |

## Change Log

| Date | Version | Description |
|------|---------|-------------|
| 2025-12-28 | 1.0 | Story created |
| 2025-12-28 | 2.0 | Implementation verified complete, all tests passing |
