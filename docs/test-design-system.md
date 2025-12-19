# System-Level Test Design

**Project:** A5-PII-Anonymizer
**Date:** 2025-12-05
**Author:** Olivier
**Phase:** Phase 3 - Solutioning (Pre-Implementation)
**Status:** Draft

---

## Executive Summary

This document provides the system-level testability review for A5-PII-Anonymizer v3.0 enhancements. The architecture supports comprehensive testing with strong controllability and observability. Key testability concerns are addressed with mitigation strategies.

**Overall Assessment:** PASS with CONCERNS (minor adjustments needed)

---

## Testability Assessment

### Controllability: PASS

**Definition:** Can we control system state for testing?

| Aspect | Status | Details |
|--------|--------|---------|
| API seeding | PASS | File-based input, deterministic processing |
| Database reset | N/A | No database - file system only |
| Mock external deps | PASS | ML model can be stubbed, no external APIs |
| Fault injection | PASS | Can inject malformed files, timeout conditions |
| State isolation | PASS | Each file processed independently |

**Strengths:**
- Pure function architecture in converters
- No shared state between file processing
- ML model wrapped in service layer (mockable)
- IPC handlers isolated and testable

**Concerns:**
- ML model cold start affects timing tests → Mitigation: Pre-warm model in test setup

### Observability: PASS with CONCERNS

**Definition:** Can we inspect system state?

| Aspect | Status | Details |
|--------|--------|---------|
| Logging | PASS | Structured logging with levels |
| Metrics | CONCERNS | No built-in metrics collection |
| Traces | N/A | Single-process, no distributed tracing needed |
| Deterministic results | PASS | Same input → same output |
| NFR validation | CONCERNS | Performance metrics need explicit measurement |

**Strengths:**
- Comprehensive logging in src/config/logging.js
- Mapping file provides audit trail
- Error messages include context
- Entity detection results are deterministic

**Concerns:**
- No built-in performance metrics → Mitigation: Add timing instrumentation in pipeline
- No accuracy tracking in production → Mitigation: Epic 5 adds feedback logging

### Reliability: PASS

**Definition:** Are tests isolated and reproducible?

| Aspect | Status | Details |
|--------|--------|---------|
| Test isolation | PASS | Tests create/delete own fixtures |
| Parallel-safe | PASS | No shared resources between tests |
| Deterministic waits | PASS | Async operations have timeouts |
| Failure reproduction | PASS | Input files + config reproduce issues |
| Loose coupling | PASS | Dependency injection in new code |

**Strengths:**
- Mocha test framework with proper setup/teardown
- File-based fixtures easily versioned
- No external service dependencies
- Timeout protection on async operations

**Concerns:**
- ML model loading time varies → Mitigation: Increased timeouts in test config

---

## Architecturally Significant Requirements (ASRs)

Requirements that drive architecture and testability:

| ASR ID | Requirement | Category | Risk Score | Test Challenge |
|--------|-------------|----------|------------|----------------|
| ASR-1 | 98%+ PII detection accuracy | PERF | 9 (3×3) | Need golden test dataset |
| ASR-2 | <2% false positive rate | PERF | 6 (2×3) | Requires precision measurement |
| ASR-3 | <30s processing for 10-page PDF | PERF | 4 (2×2) | Performance regression tests |
| ASR-4 | 100% local processing | SEC | 9 (3×3) | Network isolation verification |
| ASR-5 | Zero PII in logs | SEC | 9 (3×3) | Log content validation |
| ASR-6 | Reversible anonymization | DATA | 6 (2×3) | Round-trip verification |
| ASR-7 | Cross-platform support | OPS | 4 (2×2) | Multi-platform CI |

### ASR-1: PII Detection Accuracy (Score: 9)

**Challenge:** Measuring accuracy requires ground truth dataset.

**Test Approach:**
- Create golden dataset: 100+ annotated documents with known PII
- Automate accuracy calculation: precision, recall, F1 per entity type
- Set regression threshold: fail if accuracy drops >1%

**Mitigation:**
- Store fixtures in `test/fixtures/piiAnnotated/`
- Include diverse document types (invoice, letter, form)
- Include multi-language content (EN, FR, DE)

### ASR-4: 100% Local Processing (Score: 9)

**Challenge:** Verify no network calls during processing.

**Test Approach:**
- Network isolation test: process with network disabled
- Traffic monitoring: capture and verify zero outbound requests
- Code review: grep for fetch/http/axios usage

**Mitigation:**
- Add integration test that fails on any network activity
- Use network mocking to detect unexpected calls

### ASR-5: Zero PII in Logs (Score: 9)

**Challenge:** Ensure PII never appears in log output.

**Test Approach:**
- Pattern scanning: scan logs for PII patterns after processing
- Structured logging: validate log fields don't contain text content
- Test with real PII: process known PII, verify not in logs

**Mitigation:**
- Automated log scanning in CI pipeline
- Log field whitelist validation

---

## Test Levels Strategy

Based on architecture (Electron desktop app, ML-based processing):

| Level | Percentage | Rationale |
|-------|------------|-----------|
| Unit | 60% | Business logic in converters, validators, classifiers |
| Integration | 25% | Pipeline passes, IPC handlers, file processing |
| E2E | 15% | Critical user journeys, UI interactions |

### Unit Tests (60%)

**Focus Areas:**
- Converter logic (DocxToMarkdown, PdfToMarkdown, etc.)
- Validators (Swiss AVS, IBAN, Phone)
- Classifiers (Address, Document type)
- Context scorer
- Utility functions

**Framework:** Mocha + Chai
**Location:** `test/unit/`

### Integration Tests (25%)

**Focus Areas:**
- Detection pipeline (multi-pass orchestration)
- File processing end-to-end
- IPC communication
- Batch queue manager

**Framework:** Mocha + Chai
**Location:** `test/integration/`

### E2E Tests (15%)

**Focus Areas:**
- File upload → processing → download flow
- Batch processing workflow
- Language switching
- Entity review UI (Epic 4)

**Framework:** Playwright (recommended) or Spectron
**Location:** `test/e2e/`

---

## NFR Testing Approach

### Security Testing

| Requirement | Test Approach | Tools |
|-------------|---------------|-------|
| No network calls | Integration test with network mock | jest-fetch-mock |
| Path traversal prevention | Unit tests with malicious paths | Custom fixtures |
| IPC validation | Unit tests for each handler | Mocha + Chai |
| PII in logs | Log scanning after processing | grep/regex |

**Recommended Tests:**
```typescript
describe('Security: Path Validation', () => {
  it('should reject paths with directory traversal', async () => {
    await expect(processFile('../../../etc/passwd')).to.be.rejectedWith('SecurityError');
  });

  it('should reject paths outside allowed directories', async () => {
    await expect(processFile('/tmp/malicious.pdf')).to.be.rejectedWith('SecurityError');
  });
});
```

### Performance Testing

| Requirement | Test Approach | Tools |
|-------------|---------------|-------|
| <30s for 10-page PDF | Timing assertion in integration test | Built-in Date.now() |
| Memory <1GB | Memory profiling | process.memoryUsage() |
| Model load <30s | Timing assertion | Built-in |

**Recommended Tests:**
```typescript
describe('Performance: Processing Time', () => {
  it('should process 10-page PDF in under 30 seconds', async function() {
    this.timeout(35000);
    const start = Date.now();
    await processFile('test/fixtures/10-page-sample.pdf');
    expect(Date.now() - start).to.be.lessThan(30000);
  });
});
```

### Reliability Testing

| Requirement | Test Approach | Tools |
|-------------|---------------|-------|
| Graceful degradation | Process invalid files | Custom fixtures |
| Timeout protection | Async operation timeout tests | Mocha timeouts |
| Error recovery | Inject errors, verify handling | Stub/mock |

### Maintainability Testing

| Requirement | Test Approach | Tools |
|-------------|---------------|-------|
| 80%+ code coverage | Coverage report | nyc/istanbul |
| Type safety | TypeScript compilation | tsc |
| Lint compliance | ESLint | eslint |

---

## Test Environment Requirements

### Local Development

```bash
# Prerequisites
Node.js 18+
npm 8+

# Setup
npm install
npm run compile

# Run tests
npm test                    # All tests
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
```

### CI Environment

**GitHub Actions Workflow:**

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci
      - run: npm run compile
      - run: npm test
```

### Test Data Requirements

| Dataset | Purpose | Location |
|---------|---------|----------|
| Golden PII dataset | Accuracy measurement | `test/fixtures/piiAnnotated/` |
| Document samples | Format coverage | `test/fixtures/documents/` |
| Malformed files | Error handling | `test/fixtures/malformed/` |
| Large files | Performance testing | `test/fixtures/large/` |

---

## Testability Concerns

### Concern 1: ML Model Cold Start (MEDIUM)

**Issue:** First test loading ML model takes 15-30s, causing timing test failures.

**Impact:** Flaky tests, CI slowdown.

**Mitigation:**
- Pre-warm model in global test setup (`test/setup.js`)
- Increase timeout for first test (15s → 30s)
- Cache model in CI artifacts

**Status:** Partially addressed (increased timeouts in v2.0.0)

### Concern 2: Accuracy Measurement Infrastructure (HIGH)

**Issue:** No golden dataset exists for accuracy measurement.

**Impact:** Cannot verify ASR-1 (98%+ accuracy target).

**Mitigation:**
- Create annotated document corpus (100+ files)
- Define annotation schema for PII labels
- Build accuracy calculation tooling

**Status:** Planned for Epic 1 Story 1.5

### Concern 3: Performance Baseline Drift (MEDIUM)

**Issue:** No historical performance tracking.

**Impact:** Cannot detect gradual performance regression.

**Mitigation:**
- Store performance baselines in repo
- Compare against baseline in CI
- Alert on >20% regression

**Status:** Recommended for Sprint 0

### Concern 4: E2E Test Infrastructure (LOW)

**Issue:** No E2E test framework configured for Electron.

**Impact:** UI interactions not automatically tested.

**Mitigation:**
- Add Playwright with Electron support
- Create E2E test suite for critical paths
- Run in CI on each release

**Status:** Recommended for Epic 4

---

## Recommendations for Sprint 0

### High Priority

1. **Create Golden Test Dataset**
   - 100+ annotated documents
   - Multi-language (EN, FR, DE)
   - Multiple document types
   - Store in `test/fixtures/piiAnnotated/`

2. **Add Accuracy Measurement Tooling**
   - Precision, recall, F1 calculation
   - Per-entity-type breakdown
   - Regression threshold: fail if >1% drop

3. **Configure Performance Baselines**
   - Store baseline metrics in `test/baselines.json`
   - Compare in CI pipeline
   - Alert on significant regression

### Medium Priority

4. **Add E2E Test Framework**
   - Configure Playwright for Electron
   - Smoke tests for critical paths
   - Visual regression for UI

5. **Enhance CI Pipeline**
   - Multi-platform testing (macOS, Windows, Linux)
   - Coverage reporting
   - Performance benchmarking

### Low Priority

6. **Add Metrics Collection (Epic 5)**
   - Processing time per operation
   - Memory usage tracking
   - Accuracy feedback loop

---

## Test Coverage Targets

| Component | Target | Current | Notes |
|-----------|--------|---------|-------|
| Converters | 90% | ~85% | High business value |
| PII Detection | 95% | ~80% | Critical for accuracy |
| Validators | 100% | ~70% | Deterministic logic |
| IPC Handlers | 80% | ~75% | Security-critical |
| UI Components | 70% | ~50% | Planned for Epic 4 |
| Overall | 85% | ~75% | Current: 101 tests |

---

## Quality Gate Criteria

### Pre-Implementation Gate (Current)

- [x] Architecture document complete
- [x] Test design document complete
- [x] Testability concerns documented
- [x] Mitigation strategies defined

### Pre-Release Gate (Sprint End)

- [ ] All P0 tests pass (100%)
- [ ] P1 tests pass rate ≥95%
- [ ] No high-risk items unmitigated
- [ ] Code coverage ≥80%
- [ ] No security vulnerabilities
- [ ] Performance targets met

---

## Next Steps

1. **Review this document** with team
2. **Create golden dataset** before Epic 1 implementation
3. **Configure E2E framework** before Epic 4
4. **Set up accuracy tracking** in CI pipeline

---

**Generated by:** BMad TEA Agent - Test Architect Module
**Workflow:** `.bmad/bmm/testarch/test-design`
**Version:** 4.0 (BMad v6)
