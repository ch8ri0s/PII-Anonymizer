# A5-PII-Anonymizer Testing Strategy

Comprehensive testing approach for the A5-PII-Anonymizer project covering both Electron desktop app and browser application.

## Testing Pyramid

```
                    /\
                   /  \
                  / E2E \          <- Browser App (Playwright)
                 /------\
                /        \
               / Integration \      <- Electron & Browser (Mocha + Vitest)
              /--------------\
             /                \
            /   Unit Tests     \   <- Core Logic (Mocha + Vitest)
           /--------------------\
```

## Project Structure

### Electron Desktop App
**Path**: `/` (root)
**Framework**: Mocha + Chai
**Test Files**: `test/` directory
**Coverage**: 101+ tests

**Test Types:**
- Unit Tests: Core converters, PII detection, utilities
- Integration Tests: File processing workflows
- i18n Tests: Translation coverage

### Browser App
**Path**: `/browser-app/`
**Frameworks**: Vitest (unit) + Playwright (e2e)
**Test Files**: `test/` (unit), `e2e/` (end-to-end)
**Coverage**: 130+ e2e tests, 20+ unit tests

**Test Types:**
- Unit Tests: Converters, models, utilities
- E2E Tests: Complete user workflows
- Accessibility Tests: WCAG compliance

## Test Coverage by Layer

### Layer 1: Unit Tests (80%+ Coverage)

**Electron Desktop**
```bash
cd /
npm test
```

**Browser App**
```bash
cd browser-app
npm test
```

**Coverage:**
- File converters (DOCX, PDF, Excel, CSV, Text)
- PII detection algorithms
- Anonymization logic
- Utilities (path validation, metadata extraction)
- i18n services

**Quality Standards:**
- Each function has 3+ test cases (happy path, edge case, error)
- Mock external dependencies (file system, models)
- Fast execution (< 100ms per test)
- Independent tests (no shared state)

### Layer 2: Integration Tests (70%+ Coverage)

**Electron Desktop**
```bash
npm test -- --grep "integration"
```

**Browser App**
```bash
cd browser-app
npm run test -- test/integration/
```

**Coverage:**
- End-to-end file processing (upload → conversion → download)
- Multi-format conversions
- IPC communication (Electron)
- Batch processing queues
- Error recovery

**Quality Standards:**
- Tests complete workflows, not individual functions
- Realistic test data (actual files, not mocks)
- Timeout: 10 seconds per test
- Verify side effects (files created, events emitted)

### Layer 3: E2E Tests (90%+ Coverage)

**Browser App Only**
```bash
cd browser-app
npm run test:e2e
```

**Coverage:**
- Complete user journeys
- UI interactions (click, drag, type)
- File upload workflows
- Processing pipeline
- Download functionality
- Accessibility
- Responsive design

**Quality Standards:**
- Tests from user perspective
- Real browser environment
- Visual validation
- Cross-browser compatibility
- Performance benchmarks

## Test Execution Commands

### Run All Tests (Entire Project)

```bash
# From root directory
npm test                           # Electron unit + integration
cd browser-app && npm test         # Browser unit tests
cd browser-app && npm run test:e2e # Browser e2e tests
```

### Continuous Integration

```bash
# Run everything in CI
npm run test:all                   # Root project
cd browser-app && npm run test:all # Browser app
```

### Development Workflow

**When developing Electron features:**
```bash
npm run test:watch                 # Auto-run on changes
```

**When developing Browser app:**
```bash
cd browser-app
npm run test:watch                 # Unit tests watch mode
npm run test:e2e:ui               # Interactive e2e
```

## Coverage Reports

### Electron App

```bash
npm test -- --coverage
```

Output: `coverage/` directory

### Browser App

**Unit Test Coverage:**
```bash
cd browser-app
npm run test:coverage
```

**E2E Test Report:**
```bash
cd browser-app
npm run test:e2e
npm run test:e2e:report
```

Output: `playwright-report/` directory

## Testing Best Practices

### 1. Test Naming Convention

**Format**: `should [expected behavior] when [condition]`

**Examples:**
```javascript
// Good
test('should detect email addresses in text file')
test('should preserve PII in code blocks')
test('should handle empty files without error')

// Bad
test('email detection')
test('test1')
test('works')
```

### 2. Test Structure (AAA Pattern)

```javascript
test('should anonymize email addresses', async () => {
  // Arrange - Set up test data
  const text = 'Contact: john@example.com';
  const detector = new PIIDetector();

  // Act - Execute the functionality
  const matches = await detector.detect(text);

  // Assert - Verify the results
  expect(matches).to.have.length(1);
  expect(matches[0].type).to.equal('EMAIL');
});
```

### 3. Test Data Management

**Use Fixtures:**
```javascript
// Good - Reusable fixtures
import { SAMPLE_PII_TEXT } from './fixtures/test-files';

// Bad - Inline magic strings
const text = 'some email: test@example.com';
```

**Isolate Test Data:**
```javascript
// Good - Each test creates own data
test('test 1', () => {
  const data = createTestData();
  // ...
});

test('test 2', () => {
  const data = createTestData();
  // ...
});

// Bad - Shared mutable state
const sharedData = createTestData();
test('test 1', () => { /* uses sharedData */ });
test('test 2', () => { /* uses sharedData */ });
```

### 4. Async/Await Usage

```javascript
// Good - Clear async handling
test('should process file', async () => {
  const result = await processFile(file);
  expect(result).to.exist;
});

// Bad - Missing await
test('should process file', async () => {
  const result = processFile(file); // Promise, not result!
  expect(result).to.exist; // Wrong
});
```

### 5. Error Testing

```javascript
// Good - Explicit error checking
test('should throw error for invalid input', async () => {
  await expect(processFile(null)).to.be.rejected;
});

// Good - Check error message
test('should throw descriptive error', async () => {
  try {
    await processFile(null);
    expect.fail('Should have thrown');
  } catch (error) {
    expect(error.message).to.include('invalid');
  }
});
```

## CI/CD Integration

### GitHub Actions Workflows

**Electron Tests**
```yaml
# .github/workflows/test.yml
- name: Run Electron Tests
  run: npm test
```

**Browser App Tests**
```yaml
# .github/workflows/browser-app-e2e.yml
- name: Run E2E Tests
  run: |
    cd browser-app
    npm run test:e2e
```

### Pre-commit Hooks (Optional)

```bash
# .husky/pre-commit
npm test                           # Quick unit tests
cd browser-app && npm test         # Browser unit tests
```

### Quality Gates

**Required for Merge:**
- ✅ All unit tests pass
- ✅ All integration tests pass
- ✅ E2E smoke tests pass (Chromium)
- ✅ No new console errors
- ✅ Code coverage > 80%

**Optional for Merge:**
- E2E full suite (all browsers)
- Performance benchmarks
- Accessibility audits

## Test Maintenance

### Adding New Tests

1. **Determine Test Type**
   - Unit: Single function/method
   - Integration: Multi-component workflow
   - E2E: User-visible behavior

2. **Choose Location**
   - Electron: `test/unit/` or `test/integration/`
   - Browser: `browser-app/test/` or `browser-app/e2e/`

3. **Follow Pattern**
   - Use existing tests as templates
   - Maintain consistent naming
   - Add to appropriate describe block

4. **Verify Coverage**
   ```bash
   npm run test:coverage
   ```

### Updating Tests for Code Changes

**When changing function signature:**
1. Update all tests calling that function
2. Run tests to verify changes
3. Update documentation

**When adding new features:**
1. Write tests first (TDD)
2. Implement feature
3. Verify all tests pass

**When fixing bugs:**
1. Write test that reproduces bug
2. Fix bug
3. Verify test now passes
4. Ensure no regression

### Debugging Failing Tests

**Electron Tests:**
```bash
npm test -- --grep "specific test name"
```

**Browser Unit Tests:**
```bash
cd browser-app
npm run test:watch
```

**Browser E2E Tests:**
```bash
cd browser-app
npm run test:e2e:debug  # Step-by-step debugger
npm run test:e2e:headed # Watch browser
```

## Performance Testing

### Benchmarks

**File Processing:**
- Small file (< 10KB): < 2s
- Medium file (100KB): < 5s
- Large file (1MB): < 15s
- Batch (5 files): < 10s

**Model Loading:**
- First load: < 30s (download)
- Cached load: < 5s

**UI Responsiveness:**
- Initial render: < 1s
- File upload feedback: < 100ms
- Processing updates: < 500ms

### Running Performance Tests

```bash
cd browser-app
npm run test:e2e -- e2e/03-processing.spec.ts -g "performance"
```

## Security Testing

### PII Detection Validation

**Test Coverage:**
- Swiss PII (SSN, IBAN, AHV)
- EU PII (emails, phones, IBANs)
- Credit cards
- Tax IDs

**Validation:**
```bash
npm test -- --grep "PII detection"
```

### Code Block Preservation

Ensures PII in code blocks is NOT anonymized:

```bash
npm test -- --grep "code block"
```

### Path Traversal Prevention

```bash
npm test -- --grep "path validation"
```

## Accessibility Testing

### WCAG Compliance

**Automated:**
```bash
cd browser-app
npm run test:e2e -- e2e/06-accessibility.spec.ts
```

**Manual Checks:**
- Keyboard navigation
- Screen reader compatibility
- Color contrast ratios
- Focus indicators

## Test Data Privacy

**Important**: Never use real PII in tests!

✅ **Good Test Data:**
```javascript
const testEmail = 'test@example.com';
const testSSN = '756.1234.5678.97';
```

❌ **Bad Test Data:**
```javascript
const testEmail = 'john.smith@company.com'; // Real person
const testSSN = '756.9876.5432.10';         // Could be real
```

## Troubleshooting

### Common Issues

**Tests timeout:**
- Increase timeout in test config
- Check for infinite loops
- Verify async/await usage

**Flaky tests:**
- Add proper waits (not fixed delays)
- Check for race conditions
- Ensure test isolation

**CI fails but local passes:**
- Check environment differences
- Verify dependencies installed
- Review CI logs for specific errors

### Getting Help

- **Electron Tests**: Check `test/` directory README
- **Browser Unit**: See Vitest documentation
- **Browser E2E**: Read `browser-app/e2e/README.md`
- **Issues**: GitHub Issues with test failure logs

## Summary

### Test Statistics

| Project | Framework | Tests | Coverage | Runtime |
|---------|-----------|-------|----------|---------|
| Electron | Mocha | 101+ | 80%+ | ~30s |
| Browser (Unit) | Vitest | 20+ | 85%+ | ~5s |
| Browser (E2E) | Playwright | 130+ | 93% | ~60s |
| **Total** | - | **250+** | **85%+** | **~95s** |

### Quality Metrics

- ✅ Zero known flaky tests
- ✅ 100% pass rate on CI
- ✅ Comprehensive edge case coverage
- ✅ Cross-browser validation
- ✅ Accessibility compliance
- ✅ Performance benchmarks met

---

**Last Updated**: 2025-12-21
**Version**: 2.0.0
**Status**: Production Ready 🚀
