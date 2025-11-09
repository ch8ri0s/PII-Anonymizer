# PII Anonymizer - Refactoring Plan

**Status:** Draft
**Created:** 2025-11-09
**Estimated Total Effort:** 4-6 weeks
**Priority:** CRITICAL (Security vulnerabilities present)

---

## Executive Summary

This document outlines a comprehensive refactoring plan to address critical security, quality, and maintainability issues identified in the PII Anonymizer codebase. The plan is structured in 4 phases with clear deliverables and success criteria.

**Current State:**
- 0% test coverage
- 3 critical security vulnerabilities
- Poor separation of concerns
- No error handling framework
- Unbounded resource usage
- Technical debt estimated at 4-6 weeks

**Target State:**
- 70%+ test coverage
- All security vulnerabilities resolved
- Clean architecture with dependency injection
- Comprehensive error handling
- Resource limits and cleanup
- Production-ready codebase

---

## Phase 1: CRITICAL SECURITY FIXES (Week 1)

**Priority:** P0 - BLOCK ALL OTHER WORK
**Estimated Effort:** 3-5 days
**Risk if skipped:** Data breaches, revenue loss, legal liability

### 1.1 Remove Hardcoded Pro Key
**File:** `renderer.js:437-441`

**Current Code:**
```javascript
function validateProKey(key) {
  return (key === 'MASTERTESTKEY');
}
```

**Action Items:**
- [ ] Remove hardcoded `MASTERTESTKEY`
- [ ] Design server-side license validation API
- [ ] Implement cryptographic license key system (consider using node-rsa or similar)
- [ ] Add license key signing/verification
- [ ] Update upgrade modal to use new validation endpoint
- [ ] Add offline grace period (7 days) for license validation failures

**Implementation Details:**
```javascript
// New approach
async function validateProKey(key, deviceID) {
  try {
    // Option 1: Server-side validation
    const response = await fetch('https://api.amicus5.com/validate-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, deviceID })
    });
    return response.ok;
  } catch (error) {
    // Option 2: Offline cryptographic validation
    return verifyLicenseKeySignature(key, deviceID);
  }
}

function verifyLicenseKeySignature(key, deviceID) {
  // Use public key crypto to verify signed license
  // Key format: DEVICE_ID|EXPIRY|SIGNATURE
  const parts = key.split('|');
  if (parts.length !== 3) return false;

  const [keyDeviceID, expiry, signature] = parts;
  if (keyDeviceID !== deviceID) return false;
  if (Date.now() > parseInt(expiry)) return false;

  // Verify signature using public key
  const publicKey = fs.readFileSync('./public_key.pem');
  // ... crypto verification
}
```

**Testing:**
- Valid license key activates Pro
- Invalid license key shows error
- Expired license key rejected
- Network failure falls back to offline validation
- Cannot bypass validation via localStorage editing

---

### 1.2 Enable Electron Security Features
**File:** `main.js:18-21`

**Current Code:**
```javascript
webPreferences: {
  nodeIntegration: true,
  contextIsolation: false,
}
```

**Action Items:**
- [ ] Set `contextIsolation: true`
- [ ] Set `nodeIntegration: false`
- [ ] Create preload script for safe IPC
- [ ] Migrate all `ipcRenderer` calls to use contextBridge API
- [ ] Enable `sandbox: true` if possible
- [ ] Add Content Security Policy headers

**Implementation:**

**New preload.js:**
```javascript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectOutputDirectory: () => ipcRenderer.invoke('select-output-directory'),
  selectInputDirectory: () => ipcRenderer.invoke('select-input-directory'),
  processFile: (args) => ipcRenderer.invoke('process-file', args),
  openFolder: (path) => ipcRenderer.invoke('open-folder', path),
  onLogMessage: (callback) => ipcRenderer.on('log-message', callback)
});
```

**Updated main.js:**
```javascript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  preload: path.join(__dirname, 'preload.js')
}
```

**Updated renderer.js:**
```javascript
// Replace all ipcRenderer calls with:
const outputDir = await window.electronAPI.selectOutputDirectory();
```

**Testing:**
- All IPC functionality still works
- Direct Node.js access from renderer blocked
- CSP prevents inline script execution

---

### 1.3 Add Input Validation Layer
**Files:** All

**Action Items:**
- [ ] Create validation utility module
- [ ] Add file size limits (e.g., 500MB max)
- [ ] Validate file paths (prevent directory traversal)
- [ ] Sanitize all user inputs
- [ ] Add allowlist for file extensions
- [ ] Validate deviceID format
- [ ] Validate license key format

**Implementation:**

**New file: `validation.js`**
```javascript
export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export const Validator = {
  // File validation
  validateFile(filePath) {
    const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
    const ALLOWED_EXTENSIONS = ['.txt', '.csv', '.xlsx', '.docx', '.pdf'];

    // Check existence
    if (!fs.existsSync(filePath)) {
      throw new ValidationError('File does not exist', 'filePath');
    }

    // Check size
    const stats = fs.statSync(filePath);
    if (stats.size > MAX_FILE_SIZE) {
      throw new ValidationError(`File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`, 'filePath');
    }

    // Check extension
    const ext = path.extname(filePath).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      throw new ValidationError(`Unsupported file type: ${ext}`, 'filePath');
    }

    // Check for directory traversal
    const normalized = path.normalize(filePath);
    if (normalized.includes('..')) {
      throw new ValidationError('Invalid file path', 'filePath');
    }

    return true;
  },

  // Path validation
  validateDirectory(dirPath) {
    if (!dirPath || typeof dirPath !== 'string') {
      throw new ValidationError('Invalid directory path', 'dirPath');
    }

    if (!path.isAbsolute(dirPath)) {
      throw new ValidationError('Directory path must be absolute', 'dirPath');
    }

    if (!fs.existsSync(dirPath)) {
      throw new ValidationError('Directory does not exist', 'dirPath');
    }

    const stats = fs.statSync(dirPath);
    if (!stats.isDirectory()) {
      throw new ValidationError('Path is not a directory', 'dirPath');
    }

    return true;
  },

  // Entity validation
  validateEntity(entityText, entityType) {
    if (!entityText || typeof entityText !== 'string') {
      throw new ValidationError('Invalid entity text', 'entityText');
    }

    if (entityText.length === 0) {
      throw new ValidationError('Entity text cannot be empty', 'entityText');
    }

    if (entityText.length > 1000) {
      throw new ValidationError('Entity text too long', 'entityText');
    }

    const VALID_ENTITY_TYPES = ['NAME', 'EMAIL', 'PHONE', 'ADDRESS', 'SSN', 'CREDIT_CARD'];
    if (!VALID_ENTITY_TYPES.includes(entityType)) {
      throw new ValidationError(`Invalid entity type: ${entityType}`, 'entityType');
    }

    return true;
  },

  // Device ID validation
  validateDeviceID(deviceID) {
    if (!deviceID || typeof deviceID !== 'string') {
      throw new ValidationError('Invalid device ID', 'deviceID');
    }

    if (!/^[A-Z0-9]{10}$/.test(deviceID)) {
      throw new ValidationError('Device ID must be 10 alphanumeric characters', 'deviceID');
    }

    return true;
  }
};
```

**Integration:**
```javascript
// In fileProcessor.js
import { Validator, ValidationError } from './validation.js';

function getPseudonym(entityText, entityType) {
  Validator.validateEntity(entityText, entityType);
  // ... rest of function
}

static async processFile(filePath, outputPath) {
  Validator.validateFile(filePath);
  Validator.validateDirectory(path.dirname(outputPath));
  // ... rest of function
}
```

**Testing:**
- Files over 500MB rejected with clear error
- Invalid extensions rejected
- Directory traversal attempts blocked
- Empty entity text rejected
- Invalid entity types rejected

---

### 1.4 Security Audit Checklist
- [ ] Run `npm audit` and fix all vulnerabilities
- [ ] Update all dependencies to latest secure versions
- [ ] Add `.env` file for secrets (API keys, etc.) - ensure gitignored
- [ ] Remove any sensitive data from git history
- [ ] Add rate limiting to license validation endpoint
- [ ] Implement brute force protection for Pro key validation
- [ ] Add logging for security events (failed validations, etc.)

**Success Criteria:**
- [ ] No hardcoded secrets in source code
- [ ] All Electron security best practices enabled
- [ ] All user inputs validated
- [ ] npm audit shows 0 high/critical vulnerabilities
- [ ] Security review passed by second developer

---

## Phase 2: TESTING INFRASTRUCTURE (Week 2)

**Priority:** P1
**Estimated Effort:** 5-7 days
**Goal:** Achieve 70% code coverage with meaningful tests

### 2.1 Setup Testing Framework

**Action Items:**
- [ ] Install Jest: `npm install --save-dev jest @types/jest`
- [ ] Install testing utilities: `npm install --save-dev @testing-library/jest-dom`
- [ ] Configure Jest in `package.json`
- [ ] Create test directory structure
- [ ] Setup test helpers and mocks
- [ ] Configure coverage reporting

**package.json updates:**
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  },
  "jest": {
    "testEnvironment": "node",
    "coverageThreshold": {
      "global": {
        "branches": 70,
        "functions": 70,
        "lines": 70,
        "statements": 70
      }
    },
    "collectCoverageFrom": [
      "*.js",
      "!*.test.js",
      "!coverage/**",
      "!node_modules/**"
    ]
  }
}
```

**Directory structure:**
```
test/
├── unit/
│   ├── fileProcessor.test.js
│   ├── validation.test.js
│   └── anonymization.test.js
├── integration/
│   ├── file-processing.test.js
│   └── ipc.test.js
├── e2e/
│   └── full-workflow.test.js
├── fixtures/
│   ├── sample.txt
│   ├── sample.csv
│   ├── sample.xlsx
│   ├── sample.docx
│   ├── sample.pdf
│   └── pii-samples/
│       ├── names.txt
│       ├── emails.txt
│       └── phones.txt
└── helpers/
    ├── mockModel.js
    └── testUtils.js
```

---

### 2.2 Unit Tests for Core Functions

**File: `test/unit/fileProcessor.test.js`**

```javascript
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  getPseudonym,
  aggressiveMergeTokens,
  buildFuzzyRegex,
  escapeRegexChars
} from '../../fileProcessor.js';

describe('getPseudonym', () => {
  beforeEach(() => {
    // Reset global state before each test
    jest.resetModules();
  });

  test('generates consistent pseudonyms for same entity', () => {
    const pseudo1 = getPseudonym('John Doe', 'NAME');
    const pseudo2 = getPseudonym('John Doe', 'NAME');
    expect(pseudo1).toBe(pseudo2);
    expect(pseudo1).toBe('NAME_1');
  });

  test('generates different pseudonyms for different entities', () => {
    const pseudo1 = getPseudonym('John Doe', 'NAME');
    const pseudo2 = getPseudonym('Jane Smith', 'NAME');
    expect(pseudo1).toBe('NAME_1');
    expect(pseudo2).toBe('NAME_2');
  });

  test('handles different entity types', () => {
    const name = getPseudonym('John', 'NAME');
    const email = getPseudonym('john@example.com', 'EMAIL');
    expect(name).toBe('NAME_1');
    expect(email).toBe('EMAIL_1');
  });

  test('throws on invalid input', () => {
    expect(() => getPseudonym('', 'NAME')).toThrow(ValidationError);
    expect(() => getPseudonym('John', '')).toThrow(ValidationError);
    expect(() => getPseudonym(null, 'NAME')).toThrow(ValidationError);
  });
});

describe('aggressiveMergeTokens', () => {
  test('merges consecutive tokens of same type', () => {
    const predictions = [
      { entity: 'B-NAME', word: 'John' },
      { entity: 'I-NAME', word: '##son' }
    ];
    const merged = aggressiveMergeTokens(predictions);
    expect(merged).toEqual([
      { type: 'NAME', text: 'Johnson' }
    ]);
  });

  test('separates different entity types', () => {
    const predictions = [
      { entity: 'B-NAME', word: 'John' },
      { entity: 'B-EMAIL', word: 'john@' },
      { entity: 'I-EMAIL', word: 'example.com' }
    ];
    const merged = aggressiveMergeTokens(predictions);
    expect(merged).toHaveLength(2);
    expect(merged[0].type).toBe('NAME');
    expect(merged[1].type).toBe('EMAIL');
  });

  test('handles empty input', () => {
    expect(aggressiveMergeTokens([])).toEqual([]);
    expect(aggressiveMergeTokens(null)).toEqual([]);
  });

  test('removes whitespace and special chars', () => {
    const predictions = [
      { entity: 'B-NAME', word: ' John ' },
      { entity: 'I-NAME', word: ', ' },
      { entity: 'I-NAME', word: 'Doe' }
    ];
    const merged = aggressiveMergeTokens(predictions);
    expect(merged[0].text).toBe('JohnDoe');
  });
});

describe('buildFuzzyRegex', () => {
  test('creates case-insensitive pattern', () => {
    const regex = buildFuzzyRegex('John');
    expect(regex.flags).toContain('i');
  });

  test('creates global pattern', () => {
    const regex = buildFuzzyRegex('John');
    expect(regex.flags).toContain('g');
  });

  test('matches with intervening punctuation', () => {
    const regex = buildFuzzyRegex('John');
    expect('J-o-h-n').toMatch(regex);
    expect('J.o.h.n').toMatch(regex);
  });

  test('handles special regex characters', () => {
    const regex = buildFuzzyRegex('AT&T');
    expect(regex).toBeTruthy();
    // Should not throw regex syntax error
  });

  test('returns null for empty string', () => {
    expect(buildFuzzyRegex('')).toBeNull();
    expect(buildFuzzyRegex('!!!')).toBeNull();
  });

  test('does not cause ReDoS', () => {
    const regex = buildFuzzyRegex('John');
    const malicious = 'J' + 'o'.repeat(100) + '!!!'.repeat(100);

    const start = Date.now();
    malicious.match(regex);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100); // Should complete in <100ms
  });

  test('does not over-match', () => {
    const regex = buildFuzzyRegex('ATT');
    const text = 'ATTORNEY went to AT&T';
    const matches = text.match(regex);

    // Current implementation bug: this will fail
    // After fix, should only match 'ATT' in 'AT&T', not 'ATTORNEY'
    // This test documents the bug
  });
});

describe('escapeRegexChars', () => {
  test('escapes special characters', () => {
    expect(escapeRegexChars('.')).toBe('\\.');
    expect(escapeRegexChars('*')).toBe('\\*');
    expect(escapeRegexChars('[test]')).toBe('\\[test\\]');
  });
});
```

**File: `test/unit/validation.test.js`**

```javascript
import { describe, test, expect } from '@jest/globals';
import { Validator, ValidationError } from '../../validation.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Validator.validateFile', () => {
  let tempFile;

  beforeEach(() => {
    tempFile = path.join(os.tmpdir(), 'test-file.txt');
    fs.writeFileSync(tempFile, 'test content');
  });

  afterEach(() => {
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  });

  test('accepts valid file', () => {
    expect(() => Validator.validateFile(tempFile)).not.toThrow();
  });

  test('rejects non-existent file', () => {
    expect(() => Validator.validateFile('/nonexistent/file.txt'))
      .toThrow(ValidationError);
  });

  test('rejects unsupported extension', () => {
    const badFile = path.join(os.tmpdir(), 'test.exe');
    fs.writeFileSync(badFile, 'test');

    expect(() => Validator.validateFile(badFile))
      .toThrow(ValidationError);

    fs.unlinkSync(badFile);
  });

  test('rejects oversized file', () => {
    // Create 600MB file (exceeds 500MB limit)
    // Note: Skip in CI to save time
    if (!process.env.CI) {
      const bigFile = path.join(os.tmpdir(), 'big.txt');
      const stream = fs.createWriteStream(bigFile);
      const chunk = Buffer.alloc(1024 * 1024); // 1MB

      for (let i = 0; i < 600; i++) {
        stream.write(chunk);
      }
      stream.end();

      expect(() => Validator.validateFile(bigFile))
        .toThrow(ValidationError);

      fs.unlinkSync(bigFile);
    }
  });

  test('rejects directory traversal', () => {
    expect(() => Validator.validateFile('../../../etc/passwd'))
      .toThrow(ValidationError);
  });
});

describe('Validator.validateEntity', () => {
  test('accepts valid entity', () => {
    expect(() => Validator.validateEntity('John Doe', 'NAME'))
      .not.toThrow();
  });

  test('rejects empty text', () => {
    expect(() => Validator.validateEntity('', 'NAME'))
      .toThrow(ValidationError);
  });

  test('rejects invalid type', () => {
    expect(() => Validator.validateEntity('John', 'INVALID_TYPE'))
      .toThrow(ValidationError);
  });

  test('rejects null/undefined', () => {
    expect(() => Validator.validateEntity(null, 'NAME'))
      .toThrow(ValidationError);
    expect(() => Validator.validateEntity('John', null))
      .toThrow(ValidationError);
  });
});
```

**Action Items:**
- [ ] Write unit tests for all fileProcessor.js functions (target: 80% coverage)
- [ ] Write unit tests for validation.js (target: 100% coverage)
- [ ] Write unit tests for renderer.js utility functions
- [ ] Create mock for ML model to avoid loading in tests
- [ ] Add tests for edge cases documented in review

---

### 2.3 Integration Tests

**File: `test/integration/file-processing.test.js`**

```javascript
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { FileProcessor } from '../../fileProcessor.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('FileProcessor Integration Tests', () => {
  let testDir;
  let outputDir;

  beforeAll(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pii-test-'));
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pii-output-'));
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  test('processes text file with PII', async () => {
    const inputFile = path.join(testDir, 'input.txt');
    const outputFile = path.join(outputDir, 'output.txt');

    fs.writeFileSync(inputFile, 'My name is John Doe and my email is john@example.com');

    await FileProcessor.processFile(inputFile, outputFile);

    expect(fs.existsSync(outputFile)).toBe(true);

    const output = fs.readFileSync(outputFile, 'utf8');
    expect(output).not.toContain('John Doe');
    expect(output).not.toContain('john@example.com');
    expect(output).toMatch(/NAME_\d+/);
    expect(output).toMatch(/EMAIL_\d+/);
  });

  test('handles CSV with PII in multiple columns', async () => {
    const inputFile = path.join(testDir, 'input.csv');
    const outputFile = path.join(outputDir, 'output.csv');

    const csvContent = `Name,Email,Phone
John Doe,john@example.com,555-1234
Jane Smith,jane@example.com,555-5678`;

    fs.writeFileSync(inputFile, csvContent);

    await FileProcessor.processFile(inputFile, outputFile);

    const output = fs.readFileSync(outputFile, 'utf8');
    expect(output).not.toContain('John Doe');
    expect(output).not.toContain('john@example.com');
  });

  test('preserves non-PII content', async () => {
    const inputFile = path.join(testDir, 'input.txt');
    const outputFile = path.join(outputDir, 'output.txt');

    fs.writeFileSync(inputFile, 'The quick brown fox jumps over the lazy dog');

    await FileProcessor.processFile(inputFile, outputFile);

    const output = fs.readFileSync(outputFile, 'utf8');
    expect(output).toContain('quick brown fox');
  });

  test('handles empty file', async () => {
    const inputFile = path.join(testDir, 'empty.txt');
    const outputFile = path.join(outputDir, 'empty-output.txt');

    fs.writeFileSync(inputFile, '');

    await FileProcessor.processFile(inputFile, outputFile);

    expect(fs.existsSync(outputFile)).toBe(true);
  });

  test('handles corrupted file gracefully', async () => {
    const inputFile = path.join(testDir, 'corrupt.pdf');
    const outputFile = path.join(outputDir, 'corrupt-output.pdf');

    fs.writeFileSync(inputFile, 'This is not a valid PDF');

    await expect(FileProcessor.processFile(inputFile, outputFile))
      .rejects.toThrow();
  });

  test('consistent pseudonyms across multiple files', async () => {
    const input1 = path.join(testDir, 'file1.txt');
    const input2 = path.join(testDir, 'file2.txt');
    const output1 = path.join(outputDir, 'file1-out.txt');
    const output2 = path.join(outputDir, 'file2-out.txt');

    fs.writeFileSync(input1, 'Contact John Doe');
    fs.writeFileSync(input2, 'Email John Doe');

    await FileProcessor.processFile(input1, output1);
    await FileProcessor.processFile(input2, output2);

    const out1 = fs.readFileSync(output1, 'utf8');
    const out2 = fs.readFileSync(output2, 'utf8');

    // Extract pseudonym from both files
    const match1 = out1.match(/NAME_\d+/);
    const match2 = out2.match(/NAME_\d+/);

    expect(match1[0]).toBe(match2[0]); // Same person = same pseudonym
  });
});
```

**Action Items:**
- [ ] Write integration tests for all supported file formats
- [ ] Add tests for batch processing
- [ ] Test Pro vs Free tier logic
- [ ] Test daily limit enforcement
- [ ] Test IPC communication (Electron-specific)

---

### 2.4 End-to-End Tests

**File: `test/e2e/full-workflow.test.js`**

```javascript
import { test, expect, _electron as electron } from '@playwright/test';

test.describe('Full Application Workflow', () => {
  let app;
  let window;

  test.beforeAll(async () => {
    app = await electron.launch({ args: ['.'] });
    window = await app.firstWindow();
  });

  test.afterAll(async () => {
    await app.close();
  });

  test('launches successfully', async () => {
    const title = await window.title();
    expect(title).toBe('A5 PII Anonymizer');
  });

  test('processes single file via drag-drop', async () => {
    // Simulate drag-drop
    const dataTransfer = await window.evaluateHandle(() => {
      const dt = new DataTransfer();
      const file = new File(['John Doe'], 'test.txt', { type: 'text/plain' });
      dt.items.add(file);
      return dt;
    });

    const dropZone = await window.$('#drop-zone');
    await dropZone.dispatchEvent('drop', { dataTransfer });

    // Wait for file to appear in list
    await window.waitForSelector('#files-ul li');

    // Click anonymize
    await window.click('#process-button');

    // Wait for completion
    await window.waitForSelector('.status.success');

    const status = await window.textContent('.status');
    expect(status).toContain('processed successfully');
  });

  test('enforces daily limit for free users', async () => {
    // Set localStorage to 99 processed today
    await window.evaluate(() => {
      const state = {
        deviceID: 'TEST123456',
        isPro: false,
        dailyCount: 99,
        dailyDate: new Date().toLocaleDateString('en-CA')
      };
      localStorage.setItem('userState', JSON.stringify(state));
      location.reload();
    });

    // Try to process 2 files
    // ... add files
    await window.click('#process-button');

    // Should stop after 1 file
    const status = await window.textContent('.status');
    expect(status).toContain('daily limit');
  });

  test('Pro upgrade flow', async () => {
    await window.click('#pro-button');

    // Modal should appear
    await window.waitForSelector('#upgrade-modal.show');

    // Enter master key
    await window.fill('#pro-key-input', 'MASTERTESTKEY');
    await window.click('#validate-key-button');

    // Should show success
    await window.waitForSelector('.status.success');

    const proButton = await window.textContent('#pro-button');
    expect(proButton).toBe('Pro Version');
  });
});
```

**Action Items:**
- [ ] Setup Playwright for Electron testing
- [ ] Write E2E tests for main user flows
- [ ] Add screenshot comparison tests for UI
- [ ] Test error scenarios (disk full, etc.)

---

### 2.5 Test Fixtures and Mocks

**File: `test/helpers/mockModel.js`**

```javascript
// Mock ML model for testing without loading ONNX
export class MockNERModel {
  constructor(mockPredictions = {}) {
    this.mockPredictions = mockPredictions;
  }

  async predict(text) {
    // Return predefined predictions for test strings
    if (text.includes('John Doe')) {
      return [
        { entity: 'B-NAME', word: 'John' },
        { entity: 'I-NAME', word: 'Doe' }
      ];
    }

    if (text.includes('john@example.com')) {
      return [
        { entity: 'B-EMAIL', word: 'john@' },
        { entity: 'I-EMAIL', word: 'example.com' }
      ];
    }

    return [];
  }
}

export function mockTransformersPipeline() {
  jest.mock('@xenova/transformers', () => ({
    pipeline: jest.fn().mockResolvedValue(new MockNERModel()),
    env: {
      localModelPath: '',
      allowRemoteModels: false,
      quantized: false
    }
  }));
}
```

**Action Items:**
- [ ] Create test fixtures for all file types
- [ ] Add sample PII data sets (names, emails, phones, etc.)
- [ ] Create golden files for regression testing
- [ ] Mock external dependencies (Electron APIs, file system)

---

### 2.6 Coverage Reporting and CI Integration

**Action Items:**
- [ ] Configure Jest coverage reporting
- [ ] Add coverage badge to README
- [ ] Setup GitHub Actions for CI
- [ ] Run tests on every PR
- [ ] Block merge if coverage drops below 70%
- [ ] Add automated security scanning

**.github/workflows/test.yml:**
```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm run test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json

      - name: Check coverage threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 70" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 70% threshold"
            exit 1
          fi
```

**Success Criteria:**
- [ ] All tests pass
- [ ] 70%+ code coverage achieved
- [ ] CI pipeline runs on every commit
- [ ] Test execution time < 5 minutes

---

## Phase 3: ARCHITECTURAL REFACTORING (Weeks 3-4)

**Priority:** P2
**Estimated Effort:** 10-12 days
**Goal:** Clean architecture with proper separation of concerns

### 3.1 Extract Business Logic from UI

**Problem:** renderer.js has 484 lines mixing UI, business logic, and state management

**Action Items:**
- [ ] Create separate state management module
- [ ] Extract daily limit logic to service
- [ ] Extract Pro license logic to service
- [ ] Create event-driven architecture for UI updates
- [ ] Move all business logic to main process

**New file: `services/UserStateService.js`**

```javascript
import EventEmitter from 'events';

export class UserStateService extends EventEmitter {
  constructor() {
    super();
    this.state = {
      deviceID: null,
      isPro: false,
      dailyCount: 0,
      dailyDate: null
    };
  }

  load() {
    const saved = localStorage.getItem('userState');
    if (saved) {
      this.state = JSON.parse(saved);
    }

    if (!this.state.deviceID) {
      this.state.deviceID = this.generateDeviceID();
    }

    this.checkDailyReset();
    this.emit('loaded', this.state);
  }

  save() {
    localStorage.setItem('userState', JSON.stringify(this.state));
    this.emit('changed', this.state);
  }

  checkDailyReset() {
    const today = new Date().toLocaleDateString('en-CA');
    if (this.state.dailyDate !== today) {
      this.state.dailyDate = today;
      this.state.dailyCount = 0;
      this.save();
      this.emit('daily-reset');
    }
  }

  canProcessFile() {
    this.checkDailyReset();

    if (this.state.isPro) {
      return { allowed: true };
    }

    if (this.state.dailyCount >= 100) {
      return {
        allowed: false,
        reason: 'DAILY_LIMIT',
        message: 'You\'ve reached your 100-file daily limit.'
      };
    }

    return { allowed: true };
  }

  incrementUsage() {
    if (!this.state.isPro) {
      this.state.dailyCount++;
      this.save();
      this.emit('usage-incremented', this.state.dailyCount);
    }
  }

  activatePro() {
    this.state.isPro = true;
    this.save();
    this.emit('pro-activated');
  }

  deactivatePro() {
    this.state.isPro = false;
    this.save();
    this.emit('pro-deactivated');
  }

  generateDeviceID() {
    // Use crypto for better randomness
    const array = new Uint8Array(10);
    crypto.getRandomValues(array);

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from(array)
      .map(x => chars[x % chars.length])
      .join('');
  }

  getState() {
    return { ...this.state }; // Return copy
  }
}
```

**New file: `services/LicenseService.js`**

```javascript
export class LicenseService {
  constructor() {
    this.cache = new Map(); // Cache validation results
  }

  async validateLicense(key, deviceID) {
    // Check cache first
    const cacheKey = `${key}:${deviceID}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < 3600000) { // 1 hour
        return cached.valid;
      }
    }

    try {
      // Try server validation first
      const valid = await this.validateWithServer(key, deviceID);
      this.cache.set(cacheKey, { valid, timestamp: Date.now() });
      return valid;
    } catch (error) {
      console.warn('Server validation failed, falling back to offline', error);

      // Fallback to offline cryptographic validation
      return this.validateOffline(key, deviceID);
    }
  }

  async validateWithServer(key, deviceID) {
    const response = await fetch('https://api.amicus5.com/v1/licenses/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, deviceID }),
      timeout: 5000
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    return data.valid === true;
  }

  validateOffline(key, deviceID) {
    // Parse license key format: DEVICEID|EXPIRY|SIGNATURE
    const parts = key.split('|');
    if (parts.length !== 3) return false;

    const [keyDeviceID, expiry, signature] = parts;

    // Check device ID match
    if (keyDeviceID !== deviceID) return false;

    // Check expiration
    if (Date.now() > parseInt(expiry)) return false;

    // Verify signature (implement crypto verification)
    return this.verifySignature(keyDeviceID, expiry, signature);
  }

  verifySignature(deviceID, expiry, signature) {
    // TODO: Implement RSA signature verification with public key
    // For now, return false to force server validation
    return false;
  }
}
```

**Updated renderer.js (simplified):**

```javascript
import { UserStateService } from './services/UserStateService.js';
import { LicenseService } from './services/LicenseService.js';

const userStateService = new UserStateService();
const licenseService = new LicenseService();

// Initialize
userStateService.load();
updateUI(userStateService.getState());

// Listen to state changes
userStateService.on('changed', (state) => {
  updateUI(state);
});

userStateService.on('daily-reset', () => {
  showNotification('Daily limit reset!');
});

// Process files
async function processFiles() {
  const canProcess = userStateService.canProcessFile();
  if (!canProcess.allowed) {
    showError(canProcess.message);
    return;
  }

  for (const file of selectedFiles) {
    await processFile(file);
    userStateService.incrementUsage();
  }
}

// Pro upgrade
async function validateProKey() {
  const key = proKeyInput.value.trim();
  const deviceID = userStateService.getState().deviceID;

  const valid = await licenseService.validateLicense(key, deviceID);

  if (valid) {
    userStateService.activatePro();
    showSuccess('Pro activated!');
  } else {
    showError('Invalid license key');
  }
}
```

**Action Items:**
- [ ] Implement UserStateService
- [ ] Implement LicenseService
- [ ] Implement FileProcessingService
- [ ] Refactor renderer.js to use services
- [ ] Add unit tests for all services
- [ ] Update IPC handlers to use services

---

### 3.2 Refactor FileProcessor into Smaller Classes

**Problem:** FileProcessor.processFile() is 104 lines handling 5 file formats

**New structure:**

```
src/
├── processors/
│   ├── BaseProcessor.js       (abstract base class)
│   ├── TextProcessor.js       (.txt, .csv)
│   ├── ExcelProcessor.js      (.xlsx)
│   ├── DocxProcessor.js       (.docx)
│   ├── PdfProcessor.js        (.pdf)
│   └── BinaryProcessor.js     (unsupported formats)
├── anonymization/
│   ├── AnonymizerEngine.js    (main anonymization logic)
│   ├── TokenMerger.js         (token merging)
│   ├── RegexBuilder.js        (fuzzy regex)
│   └── PseudonymGenerator.js  (pseudonym mapping)
└── models/
    └── ModelLoader.js         (ML model management)
```

**File: `src/processors/BaseProcessor.js`**

```javascript
export class BaseProcessor {
  constructor(anonymizer) {
    this.anonymizer = anonymizer;
  }

  async process(inputPath, outputPath) {
    throw new Error('Must implement process() method');
  }

  validateInput(filePath) {
    Validator.validateFile(filePath);
  }

  async extractText(filePath) {
    throw new Error('Must implement extractText() method');
  }

  async createOutput(anonymizedText, outputPath) {
    throw new Error('Must implement createOutput() method');
  }

  async processFile(inputPath, outputPath) {
    this.validateInput(inputPath);

    try {
      const text = await this.extractText(inputPath);
      const anonymized = await this.anonymizer.anonymize(text);
      await this.createOutput(anonymized, outputPath);

      return { success: true, outputPath };
    } catch (error) {
      console.error(`Error processing ${inputPath}:`, error);
      throw new ProcessingError(
        `Failed to process file: ${error.message}`,
        'PROCESSING_FAILED',
        { inputPath, cause: error }
      );
    }
  }
}
```

**File: `src/processors/TextProcessor.js`**

```javascript
import { BaseProcessor } from './BaseProcessor.js';
import fs from 'fs/promises';

export class TextProcessor extends BaseProcessor {
  async extractText(filePath) {
    return await fs.readFile(filePath, 'utf8');
  }

  async createOutput(anonymizedText, outputPath) {
    await fs.writeFile(outputPath, anonymizedText, 'utf8');
  }
}
```

**File: `src/anonymization/AnonymizerEngine.js`**

```javascript
import { TokenMerger } from './TokenMerger.js';
import { RegexBuilder } from './RegexBuilder.js';
import { PseudonymGenerator } from './PseudonymGenerator.js';

export class AnonymizerEngine {
  constructor(modelLoader) {
    this.modelLoader = modelLoader;
    this.tokenMerger = new TokenMerger();
    this.regexBuilder = new RegexBuilder();
    this.pseudonymGenerator = new PseudonymGenerator();
  }

  async anonymize(text, options = {}) {
    if (!text || typeof text !== 'string') {
      throw new ValidationError('Text must be non-empty string', 'text');
    }

    // Load model
    const model = await this.modelLoader.getModel();

    // Get predictions
    const predictions = await model.predict(text);
    console.debug(`Found ${predictions.length} entity tokens`);

    // Merge tokens
    const entities = this.tokenMerger.merge(predictions);
    console.debug(`Merged into ${entities.length} entities`);

    // Replace entities
    let result = text;
    for (const entity of entities) {
      const pseudonym = this.pseudonymGenerator.get(
        entity.text,
        entity.type
      );

      const regex = this.regexBuilder.build(entity.text);
      if (regex) {
        result = result.replace(regex, pseudonym);
      }
    }

    return result;
  }

  reset() {
    this.pseudonymGenerator.reset();
  }

  exportMapping() {
    return this.pseudonymGenerator.exportMapping();
  }

  importMapping(mapping) {
    this.pseudonymGenerator.importMapping(mapping);
  }
}
```

**Action Items:**
- [ ] Implement all processor classes
- [ ] Implement anonymization components
- [ ] Add dependency injection
- [ ] Update FileProcessor to use new architecture
- [ ] Maintain backward compatibility during transition
- [ ] Write tests for each component

---

### 3.3 Implement Proper Error Handling

**New file: `src/errors/ErrorTypes.js`**

```javascript
export class AppError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

export class ValidationError extends AppError {
  constructor(message, field, details = {}) {
    super(message, 'VALIDATION_ERROR', { field, ...details });
  }
}

export class ProcessingError extends AppError {
  constructor(message, code = 'PROCESSING_ERROR', details = {}) {
    super(message, code, details);
  }
}

export class ModelError extends AppError {
  constructor(message, details = {}) {
    super(message, 'MODEL_ERROR', details);
  }
}

export class LicenseError extends AppError {
  constructor(message, details = {}) {
    super(message, 'LICENSE_ERROR', details);
  }
}

export class FileSystemError extends AppError {
  constructor(message, details = {}) {
    super(message, 'FILESYSTEM_ERROR', details);
  }
}

// Error handler utility
export class ErrorHandler {
  static handle(error, context = {}) {
    // Log error with context
    console.error({
      error: error.toJSON ? error.toJSON() : error,
      context
    });

    // Determine user-friendly message
    const userMessage = this.getUserMessage(error);

    // Return structured error response
    return {
      success: false,
      error: {
        message: userMessage,
        code: error.code || 'UNKNOWN_ERROR',
        recoverable: this.isRecoverable(error)
      }
    };
  }

  static getUserMessage(error) {
    if (error instanceof ValidationError) {
      return `Invalid ${error.details.field}: ${error.message}`;
    }

    if (error instanceof LicenseError) {
      return 'License validation failed. Please check your Pro key.';
    }

    if (error instanceof ModelError) {
      return 'AI model error. Please restart the application.';
    }

    if (error instanceof FileSystemError) {
      if (error.message.includes('ENOSPC')) {
        return 'Disk full. Please free up space and try again.';
      }
      if (error.message.includes('EACCES')) {
        return 'Permission denied. Please check file permissions.';
      }
    }

    return 'An unexpected error occurred. Please try again.';
  }

  static isRecoverable(error) {
    // Some errors are recoverable (user can retry)
    if (error instanceof ValidationError) return true;
    if (error instanceof LicenseError) return true;

    // Others require app restart
    if (error instanceof ModelError) return false;

    return true;
  }
}
```

**Integration in main.js:**

```javascript
import { ErrorHandler } from './errors/ErrorTypes.js';

ipcMain.handle('process-file', async (event, { filePath, outputDir }) => {
  try {
    const fileName = path.basename(filePath);
    mainWindow.webContents.send('log-message', `Processing: ${fileName}`);

    const outputPath = path.join(outputDir, FileProcessor.generateOutputFileName(fileName));

    const result = await FileProcessor.processFile(filePath, outputPath);

    mainWindow.webContents.send('log-message', `Finished: ${fileName}`);
    return { success: true, outputPath };

  } catch (error) {
    return ErrorHandler.handle(error, { filePath, outputDir });
  }
});
```

**Action Items:**
- [ ] Implement error type hierarchy
- [ ] Add error handling to all async functions
- [ ] Create error recovery strategies
- [ ] Add error telemetry (optional)
- [ ] Update UI to display errors appropriately

---

### 3.4 Implement Logging Framework

**New file: `src/utils/Logger.js`**

```javascript
import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export class Logger {
  constructor(options = {}) {
    this.level = options.level || 'info';
    this.logToFile = options.logToFile !== false;
    this.logToConsole = options.logToConsole !== false;

    if (this.logToFile) {
      this.logDir = options.logDir || path.join(app.getPath('userData'), 'logs');
      this.ensureLogDir();
      this.logFile = this.getLogFilePath();
    }

    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getLogFilePath() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `app-${date}.log`);
  }

  shouldLog(level) {
    return this.levels[level] >= this.levels[this.level];
  }

  format(level, message, meta = {}) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...meta
    });
  }

  write(level, message, meta) {
    if (!this.shouldLog(level)) return;

    const formatted = this.format(level, message, meta);

    if (this.logToConsole) {
      console[level === 'debug' ? 'log' : level](formatted);
    }

    if (this.logToFile) {
      fs.appendFileSync(this.logFile, formatted + '\n');
    }
  }

  debug(message, meta = {}) {
    this.write('debug', message, meta);
  }

  info(message, meta = {}) {
    this.write('info', message, meta);
  }

  warn(message, meta = {}) {
    this.write('warn', message, meta);
  }

  error(message, meta = {}) {
    this.write('error', message, meta);
  }

  // Rotate old logs
  rotateLogs(maxAgeInDays = 7) {
    const files = fs.readdirSync(this.logDir);
    const now = Date.now();
    const maxAge = maxAgeInDays * 24 * 60 * 60 * 1000;

    for (const file of files) {
      const filePath = path.join(this.logDir, file);
      const stats = fs.statSync(filePath);

      if (now - stats.mtime.getTime() > maxAge) {
        fs.unlinkSync(filePath);
        this.info(`Deleted old log file: ${file}`);
      }
    }
  }
}

// Singleton instance
export const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  logToFile: true,
  logToConsole: true
});
```

**Usage:**

```javascript
import { logger } from './utils/Logger.js';

logger.info('Application started');
logger.debug('Processing file', { fileName: 'test.txt' });
logger.warn('Model load slow', { duration: 5000 });
logger.error('Processing failed', { error: error.message, stack: error.stack });
```

**Action Items:**
- [ ] Implement Logger class
- [ ] Replace all console.log with logger calls
- [ ] Add log rotation
- [ ] Add log viewer in UI (optional)
- [ ] Configure log levels per environment

---

### 3.5 Add Configuration Management

**New file: `config/default.json`**

```json
{
  "app": {
    "name": "A5 PII Anonymizer",
    "version": "0.0.1"
  },
  "processing": {
    "maxFileSize": 524288000,
    "supportedExtensions": [".txt", ".csv", ".xlsx", ".docx", ".pdf"],
    "batchSize": 10,
    "timeout": 300000
  },
  "model": {
    "name": "protectai/lakshyakh93-deberta_finetuned_pii-onnx",
    "localPath": "./models",
    "allowRemoteModels": false,
    "quantized": false,
    "cacheSize": 1
  },
  "anonymization": {
    "fuzzyMatching": true,
    "caseSensitive": false,
    "preserveFormatting": false
  },
  "limits": {
    "free": {
      "dailyFiles": 100
    },
    "pro": {
      "dailyFiles": -1
    }
  },
  "logging": {
    "level": "info",
    "toFile": true,
    "toConsole": true,
    "rotationDays": 7
  },
  "license": {
    "validationEndpoint": "https://api.amicus5.com/v1/licenses/validate",
    "timeout": 5000,
    "offlineGracePeriod": 604800000
  }
}
```

**New file: `config/production.json`**

```json
{
  "logging": {
    "level": "warn",
    "toConsole": false
  }
}
```

**New file: `src/config/ConfigLoader.js`**

```javascript
import fs from 'fs';
import path from 'path';

export class ConfigLoader {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.config = this.load();
  }

  load() {
    const defaultConfig = this.loadJSON('config/default.json');
    const envConfig = this.loadJSON(`config/${this.env}.json`);

    return this.merge(defaultConfig, envConfig);
  }

  loadJSON(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  merge(base, override) {
    const result = { ...base };

    for (const key in override) {
      if (typeof override[key] === 'object' && !Array.isArray(override[key])) {
        result[key] = this.merge(base[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }

    return result;
  }

  get(path) {
    const parts = path.split('.');
    let current = this.config;

    for (const part of parts) {
      if (current[part] === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }
}

export const config = new ConfigLoader();
```

**Usage:**

```javascript
import { config } from './config/ConfigLoader.js';

const maxSize = config.get('processing.maxFileSize');
const dailyLimit = config.get('limits.free.dailyFiles');
```

**Action Items:**
- [ ] Implement ConfigLoader
- [ ] Create config files for all environments
- [ ] Replace hardcoded values with config
- [ ] Add config validation
- [ ] Document all config options

---

### 3.6 Success Criteria for Phase 3

- [ ] Business logic separated from UI
- [ ] FileProcessor refactored into single-purpose classes
- [ ] All functions < 50 lines
- [ ] Cyclomatic complexity < 10 for all functions
- [ ] Proper error handling throughout
- [ ] Logging framework implemented
- [ ] Configuration externalized
- [ ] Dependency injection implemented
- [ ] All tests still passing
- [ ] Code coverage maintained at 70%+

---

## Phase 4: POLISH & PRODUCTION READINESS (Week 5-6)

**Priority:** P3-P4
**Estimated Effort:** 8-10 days
**Goal:** Production-ready application

### 4.1 Resource Management & Performance

**Action Items:**

**4.1.1 Fix Temp File Leaks**
- [ ] Implement temp file cleanup on app exit
- [ ] Add unique temp filenames (UUID-based)
- [ ] Implement temp file garbage collection
- [ ] Add temp file size limits

```javascript
// src/utils/TempFileManager.js
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export class TempFileManager {
  constructor() {
    this.tempFiles = new Set();
    this.tempDir = path.join(os.tmpdir(), 'a5-pii-anonymizer');
    this.ensureTempDir();
  }

  async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to create temp directory', { error });
    }
  }

  createTempPath(extension = '.tmp') {
    const filename = `${uuidv4()}${extension}`;
    const fullPath = path.join(this.tempDir, filename);
    this.tempFiles.add(fullPath);
    return fullPath;
  }

  async cleanup() {
    logger.info(`Cleaning up ${this.tempFiles.size} temp files`);

    for (const filePath of this.tempFiles) {
      try {
        await fs.unlink(filePath);
        this.tempFiles.delete(filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          logger.warn('Failed to delete temp file', { filePath, error });
        }
      }
    }
  }

  async cleanupOldFiles(maxAgeHours = 24) {
    try {
      const files = await fs.readdir(this.tempDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          await fs.unlink(filePath);
          logger.debug('Deleted old temp file', { file });
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old temp files', { error });
    }
  }
}

export const tempFileManager = new TempFileManager();

// In main.js
app.on('will-quit', async (event) => {
  event.preventDefault();
  await tempFileManager.cleanup();
  app.exit(0);
});
```

**4.1.2 Fix Recursive Directory Bomb**
- [ ] Add max depth limit (e.g., 5 levels)
- [ ] Add max file count limit (e.g., 1000 files)
- [ ] Detect and skip symlinks
- [ ] Use async directory traversal
- [ ] Show progress for large directories

```javascript
// src/utils/DirectoryScanner.js
import fs from 'fs/promises';
import path from 'path';

export class DirectoryScanner {
  constructor(options = {}) {
    this.maxDepth = options.maxDepth || 5;
    this.maxFiles = options.maxFiles || 1000;
    this.followSymlinks = options.followSymlinks || false;
    this.supportedExtensions = options.supportedExtensions || [];
  }

  async scan(dirPath, onProgress = null) {
    const results = [];
    await this._scanRecursive(dirPath, 0, results, onProgress);
    return results;
  }

  async _scanRecursive(dirPath, depth, results, onProgress) {
    // Check depth limit
    if (depth > this.maxDepth) {
      logger.warn('Max depth reached', { dirPath, depth });
      return;
    }

    // Check file count limit
    if (results.length >= this.maxFiles) {
      logger.warn('Max file count reached', { count: results.length });
      return;
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Handle symlinks
        if (entry.isSymbolicLink()) {
          if (!this.followSymlinks) {
            logger.debug('Skipping symlink', { path: fullPath });
            continue;
          }

          // Detect circular symlinks
          const realPath = await fs.realpath(fullPath);
          if (realPath.startsWith(dirPath)) {
            logger.warn('Circular symlink detected', { path: fullPath });
            continue;
          }
        }

        // Handle directories
        if (entry.isDirectory()) {
          await this._scanRecursive(fullPath, depth + 1, results, onProgress);
        }
        // Handle files
        else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();

          if (this.supportedExtensions.includes(ext)) {
            results.push({
              path: fullPath,
              name: entry.name
            });

            if (onProgress) {
              onProgress({
                filesFound: results.length,
                currentPath: fullPath
              });
            }
          }
        }

        // Stop if limit reached
        if (results.length >= this.maxFiles) {
          break;
        }
      }
    } catch (error) {
      // Handle permission errors gracefully
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        logger.warn('Permission denied', { dirPath });
      } else {
        logger.error('Error scanning directory', { dirPath, error });
      }
    }
  }
}
```

**4.1.3 Performance Optimizations**
- [ ] Cache compiled regexes
- [ ] Batch Excel cell processing
- [ ] Stream large files instead of loading into memory
- [ ] Add worker threads for ML inference
- [ ] Profile and optimize hot paths

```javascript
// src/utils/StreamingProcessor.js
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

export class StreamingTextProcessor extends Transform {
  constructor(anonymizer, options = {}) {
    super(options);
    this.anonymizer = anonymizer;
    this.buffer = '';
    this.chunkSize = options.chunkSize || 1024 * 1024; // 1MB
  }

  async _transform(chunk, encoding, callback) {
    try {
      this.buffer += chunk.toString();

      // Process complete lines
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        const anonymized = await this.anonymizer.anonymize(line);
        this.push(anonymized + '\n');
      }

      callback();
    } catch (error) {
      callback(error);
    }
  }

  async _flush(callback) {
    try {
      // Process remaining buffer
      if (this.buffer) {
        const anonymized = await this.anonymizer.anonymize(this.buffer);
        this.push(anonymized);
      }
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

// Usage
export async function processLargeFile(inputPath, outputPath, anonymizer) {
  const reader = createReadStream(inputPath, { encoding: 'utf8' });
  const processor = new StreamingTextProcessor(anonymizer);
  const writer = createWriteStream(outputPath, { encoding: 'utf8' });

  await pipeline(reader, processor, writer);
}
```

---

### 4.2 Documentation

**Action Items:**

**4.2.1 Code Documentation**
- [ ] Add JSDoc to all functions
- [ ] Document all classes
- [ ] Add inline comments for complex logic
- [ ] Create architecture diagram
- [ ] Document error codes

**Template:**
```javascript
/**
 * Anonymizes text by detecting and replacing PII entities with pseudonyms.
 *
 * Uses an ML model to detect entities, then replaces them with consistent
 * pseudonyms (e.g., "John Doe" -> "NAME_1"). The same entity text will
 * always map to the same pseudonym within a session.
 *
 * @param {string} text - The text to anonymize (must be non-empty)
 * @param {Object} options - Processing options
 * @param {boolean} options.fuzzyMatching - Enable fuzzy regex matching (default: true)
 * @param {number} options.timeout - Max processing time in ms (default: 30000)
 *
 * @returns {Promise<string>} The anonymized text
 *
 * @throws {ValidationError} If text is empty or invalid
 * @throws {ModelError} If ML model fails to load or predict
 * @throws {ProcessingError} If anonymization fails
 *
 * @example
 * const text = "Contact John Doe at john@example.com";
 * const anonymized = await anonymizer.anonymize(text);
 * // Result: "Contact NAME_1 at EMAIL_1"
 */
async function anonymizeText(text, options = {}) {
  // ...
}
```

**4.2.2 User Documentation**
- [ ] Update README with new features
- [ ] Create user guide
- [ ] Document Pro features
- [ ] Create troubleshooting guide
- [ ] Add FAQ

**4.2.3 Developer Documentation**
- [ ] Create CONTRIBUTING.md
- [ ] Document development setup
- [ ] Document testing strategy
- [ ] Create API reference
- [ ] Document architecture decisions (ADRs)

---

### 4.3 Additional Features

**4.3.1 Pseudonym Mapping Export (Pro Feature)**
```javascript
// In AnonymizerEngine
exportMapping() {
  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    mapping: this.pseudonymGenerator.getMapping()
  };
}

// In IPC handler
ipcMain.handle('export-mapping', async (event, { outputPath }) => {
  if (!userState.isPro) {
    return { success: false, error: 'Pro feature only' };
  }

  const mapping = anonymizerEngine.exportMapping();
  await fs.writeFile(outputPath, JSON.stringify(mapping, null, 2));

  return { success: true, outputPath };
});
```

**4.3.2 Batch Processing Progress**
```javascript
// Enhanced progress tracking
ipcMain.handle('process-files-batch', async (event, { files, outputDir }) => {
  const total = files.length;
  let processed = 0;

  for (const file of files) {
    try {
      await FileProcessor.processFile(file.path, outputDir);
      processed++;

      mainWindow.webContents.send('batch-progress', {
        total,
        processed,
        current: file.name,
        percentage: Math.floor((processed / total) * 100)
      });

    } catch (error) {
      mainWindow.webContents.send('batch-error', {
        file: file.name,
        error: error.message
      });
    }
  }

  return { success: true, processed, total };
});
```

**4.3.3 Settings Persistence**
```javascript
// User preferences
const DEFAULT_SETTINGS = {
  outputDirectory: null,
  autoOpenOutput: true,
  confirmBatchProcess: true,
  theme: 'dark'
};

export class SettingsService {
  constructor() {
    this.settings = this.load();
  }

  load() {
    const saved = localStorage.getItem('settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  }

  save() {
    localStorage.setItem('settings', JSON.stringify(this.settings));
  }

  get(key) {
    return this.settings[key];
  }

  set(key, value) {
    this.settings[key] = value;
    this.save();
  }
}
```

---

### 4.4 Final Quality Checks

**Action Items:**

**4.4.1 Code Quality**
- [ ] Run ESLint and fix all issues
- [ ] Run Prettier for code formatting
- [ ] Remove all dead code
- [ ] Remove all TODO comments
- [ ] Remove all console.log (use logger)
- [ ] Check for hardcoded strings (i18n preparation)

**4.4.2 Security**
- [ ] Run npm audit fix
- [ ] Review all dependencies for vulnerabilities
- [ ] Enable all Electron security features
- [ ] Add CSP headers
- [ ] Review file permissions
- [ ] Test license validation

**4.4.3 Performance**
- [ ] Profile application startup time
- [ ] Profile file processing time
- [ ] Test with large files (100MB+)
- [ ] Test with batch of 100 files
- [ ] Check memory usage
- [ ] Fix memory leaks

**4.4.4 Compatibility**
- [ ] Test on macOS
- [ ] Test on Windows
- [ ] Test on Linux
- [ ] Test with various file formats
- [ ] Test with non-English text
- [ ] Test with special characters in filenames

**4.4.5 User Experience**
- [ ] Test all error messages
- [ ] Verify all modals work correctly
- [ ] Test drag-and-drop
- [ ] Test folder selection
- [ ] Verify progress bars
- [ ] Test Pro upgrade flow

---

### 4.5 Build & Release

**Action Items:**
- [ ] Setup electron-builder configuration
- [ ] Create app icons for all platforms
- [ ] Add code signing certificates
- [ ] Configure auto-update
- [ ] Create installer/DMG
- [ ] Test installation on clean machines
- [ ] Create release notes template

**Updated package.json:**
```json
{
  "build": {
    "productName": "A5 PII Anonymizer",
    "appId": "com.a5.piiAnonymizer",
    "mac": {
      "category": "public.app-category.utilities",
      "hardenedRuntime": true,
      "gatekeeperAssess": false,
      "entitlements": "build/entitlements.mac.plist",
      "entitlementsInherit": "build/entitlements.mac.plist"
    },
    "win": {
      "target": ["nsis"],
      "certificateFile": "certs/windows.pfx"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Utility"
    },
    "files": [
      "**/*",
      "!test/**/*",
      "!coverage/**/*",
      "!*.test.js"
    ],
    "publish": {
      "provider": "github",
      "owner": "a5",
      "repo": "pii-anonymizer"
    }
  }
}
```

---

### 4.6 Success Criteria for Phase 4

- [ ] All resource leaks fixed
- [ ] Performance acceptable (< 5s for 10MB file)
- [ ] All code documented
- [ ] README updated
- [ ] All platforms tested
- [ ] Security audit passed
- [ ] Build artifacts created
- [ ] Release notes written
- [ ] User guide published

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| Phase 1: Security | 3-5 days | No hardcoded secrets, contextIsolation enabled, input validation |
| Phase 2: Testing | 5-7 days | 70% coverage, CI pipeline, comprehensive test suite |
| Phase 3: Architecture | 10-12 days | Clean architecture, error handling, logging, config |
| Phase 4: Polish | 8-10 days | Performance optimized, documented, production builds |
| **Total** | **4-6 weeks** | **Production-ready application** |

---

## Risk Management

### High-Risk Areas
1. **ML Model Integration** - Complex, hard to test
   - Mitigation: Create comprehensive mocks, test with real model sparingly

2. **Cross-Platform Compatibility** - Different OS behaviors
   - Mitigation: Test on all platforms early and often

3. **Performance with Large Files** - Memory issues
   - Mitigation: Implement streaming, add limits, profile early

### Rollback Plan
- Maintain separate branch for each phase
- Tag releases after each phase
- Can rollback to previous phase if issues arise
- Keep backward compatibility during transition

---

## Success Metrics

### Code Quality
- [ ] Test coverage ≥ 70%
- [ ] Cyclomatic complexity < 10
- [ ] Functions < 50 lines
- [ ] Files < 500 lines
- [ ] No ESLint errors
- [ ] No security vulnerabilities

### Performance
- [ ] Startup time < 3s
- [ ] 1MB file processed in < 2s
- [ ] 100MB file processed in < 60s
- [ ] Memory usage < 500MB for typical workload
- [ ] No memory leaks over 1000 file operations

### User Experience
- [ ] All errors have user-friendly messages
- [ ] Progress feedback on all long operations
- [ ] No UI freezes during processing
- [ ] Clear documentation for all features
- [ ] Support contact information available

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Prioritize phases** based on business needs
3. **Allocate resources** (developers, time, budget)
4. **Create detailed tickets** for each task
5. **Setup tracking** (Jira, GitHub Projects, etc.)
6. **Begin Phase 1** immediately (security is critical)

---

## Appendix: Quick Reference

### Commands
```bash
# Development
npm run dev

# Testing
npm test                  # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # With coverage
npm run test:ci          # CI mode

# Code Quality
npm run lint             # Run ESLint
npm run format           # Run Prettier
npm run audit            # Security audit

# Build
npm run build            # All platforms
npm run build:mac        # macOS only
npm run build:win        # Windows only
npm run build:linux      # Linux only
```

### File Structure After Refactor
```
A5-PII-Anonymizer/
├── src/
│   ├── main.js
│   ├── preload.js
│   ├── processors/
│   ├── anonymization/
│   ├── services/
│   ├── models/
│   ├── errors/
│   ├── utils/
│   └── config/
├── test/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/
├── config/
│   ├── default.json
│   ├── development.json
│   └── production.json
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   └── USER_GUIDE.md
├── index.html
├── renderer.js
├── styles.css
└── package.json
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-09
**Owner:** Development Team
**Status:** Ready for Review
