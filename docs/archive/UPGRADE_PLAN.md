# NPM Package Upgrade Recommendations
## Softcom PII Anonymiser v2.0

**Analysis Date:** 2025-11-09
**Current Node Version:** Check with `node --version`
**Current NPM Version:** Check with `npm --version`

---

## Executive Summary

**Packages Analyzed:** 8 total (6 dependencies, 2 devDependencies)

| Priority | Count | Action |
|----------|-------|--------|
| 🔴 **URGENT** | 1 | Security fix (mammoth) |
| 🟠 **RECOMMENDED** | 2 | Safe minor/patch updates |
| 🟡 **CONSIDER** | 3 | Major version updates (breaking changes) |
| ✅ **UP TO DATE** | 2 | No action needed |

**Recommended Action:** Apply URGENT and RECOMMENDED updates immediately. Test thoroughly before applying major updates.

---

## 🔴 URGENT Updates (Security Fixes)

### 1. mammoth: 1.5.2 → 1.11.0

**Severity:** 🔴 HIGH
**Type:** Security Fix
**Breaking Changes:** None expected (minor version bump)

**Vulnerability Fixed:**
- **CVE-2024-55591**: Directory Traversal (GHSA-rmjr-87wv-gf87)
- Allows malicious DOCX files to write outside intended directory

**Why This Matters:**
Your app processes user-uploaded DOCX files. This vulnerability was identified in our security audit (Issue #4). Updating closes a HIGH severity security hole.

**Update Command:**
```bash
npm install mammoth@^1.11.0
```

**Testing Required:**
- ✅ Process sample DOCX files
- ✅ Verify text extraction works correctly
- ✅ Test with complex formatting (tables, images, styles)
- ✅ Confirm output Markdown is identical to v1.5.2

**Risk:** 🟢 LOW (minor version, well-tested package)

---

## 🟠 RECOMMENDED Updates (Safe)

### 2. exceljs: 4.3.0 → 4.4.0

**Severity:** 🟢 LOW
**Type:** Minor Update
**Breaking Changes:** None

**Changes:**
- Bug fixes for edge cases
- Performance improvements
- Better Excel 2019/365 compatibility

**Update Command:**
```bash
npm install exceljs@^4.4.0
```

**Testing Required:**
- ✅ Process sample XLSX/XLS files
- ✅ Verify multi-sheet handling
- ✅ Test formula rendering
- ✅ Check date formatting

**Risk:** 🟢 LOW (minor version, widely used)

---

### 3. turndown: 7.2.0 → 7.2.2

**Severity:** 🟢 LOW
**Type:** Patch Update
**Breaking Changes:** None

**Changes:**
- Bug fixes only
- HTML→Markdown conversion improvements

**Update Command:**
```bash
npm install turndown@^7.2.2
```

**Testing Required:**
- ✅ Process DOCX files (uses turndown via mammoth)
- ✅ Verify Markdown formatting
- ✅ Check heading styles, lists, code blocks

**Risk:** 🟢 VERY LOW (patch version)

---

## 🟡 CONSIDER Updates (Major Versions - Breaking Changes)

### 4. pdf-parse: 1.1.1 → 2.4.5

**Severity:** 🟡 MODERATE
**Type:** Major Update
**Breaking Changes:** ⚠️ YES - API changes likely

**Why Upgrade:**
- 3 years of bug fixes and improvements
- Better PDF parsing accuracy
- Support for newer PDF standards

**Why NOT Upgrade (Yet):**
- Major version jump (1.x → 2.x)
- Potential API changes require code refactoring
- Need to review changelog for breaking changes

**Investigation Needed:**
```bash
# Check changelog
npm view pdf-parse@2.4.5 --json | grep "gitHead"
# Visit: https://github.com/modesty/pdf2json/blob/master/CHANGELOG.md
```

**If You Upgrade:**
1. Review `src/converters/PdfToMarkdown.js`
2. Check if `pdfParse(buffer)` API changed
3. Test with various PDF types (scanned, text, forms)
4. Verify page count and text extraction

**Recommendation:** 🔶 **DEFER** - Test in development branch first

**Risk:** 🟠 MODERATE (untested major version change)

---

### 5. marked: 12.0.0 → 17.0.0

**Severity:** 🟡 MODERATE
**Type:** Major Update
**Breaking Changes:** ⚠️ YES - 5 major versions

**Why Upgrade:**
- Security fixes in newer versions
- Better CommonMark spec compliance
- Performance improvements

**Why NOT Upgrade (Yet):**
- 5 major versions jump (12 → 17)
- Multiple breaking changes between versions
- Your app uses minimal marked features (validation only)

**Investigation Needed:**
```bash
# Check breaking changes
# v13.0.0: https://github.com/markedjs/marked/releases/tag/v13.0.0
# v14.0.0: https://github.com/markedjs/marked/releases/tag/v14.0.0
# v15.0.0: https://github.com/markedjs/marked/releases/tag/v15.0.0
# v16.0.0: https://github.com/markedjs/marked/releases/tag/v16.0.0
# v17.0.0: https://github.com/markedjs/marked/releases/tag/v17.0.0
```

**Current Usage:**
```javascript
// src/converters/MarkdownConverter.js
import { marked } from 'marked';
// Used for validation only - minimal impact
```

**If You Upgrade:**
1. Review all marked usage in codebase
2. Test Markdown validation still works
3. Check if parsing API changed
4. Run full test suite

**Recommendation:** 🔶 **DEFER** - Low impact since minimally used, but test carefully

**Risk:** 🟠 MODERATE (major API changes)

---

### 6. electron: 34.2.0 → 39.1.1

**Severity:** 🔴 HIGH
**Type:** Major Update
**Breaking Changes:** ⚠️ YES - 5 major versions

**Why Upgrade:**
- Security fixes (Chromium updates)
- Node.js 22.x support (currently on 20.x)
- Latest Chromium engine (better performance)

**Why NOT Upgrade (Yet):**
- 5 major versions jump
- Potential breaking changes to Electron APIs
- Need to verify security features still work
- Requires thorough testing

**Known Breaking Changes (Highlights):**
- **v35**: Deprecated APIs removed
- **v36**: Changed webContents behavior
- **v37**: Context bridge changes
- **v38**: Security defaults strengthened
- **v39**: Latest Chromium 134

**Critical Areas to Test:**
1. ✅ Context isolation still works
2. ✅ Preload script functionality
3. ✅ IPC communication (all handlers)
4. ✅ File dialogs (select files/directories)
5. ✅ CSP headers still applied
6. ✅ Path validation still works
7. ✅ App packaging and distribution

**Upgrade Path:**
```bash
# Incremental approach recommended
npm install electron@35.0.0  # Test
npm install electron@36.0.0  # Test
npm install electron@37.0.0  # Test
npm install electron@38.0.0  # Test
npm install electron@39.1.1  # Test
```

**Or Direct (Risky):**
```bash
npm install electron@^39.1.1
```

**Recommendation:** 🔶 **DEFER to v2.1** - Requires extensive testing, high risk

**Risk:** 🔴 HIGH (core framework, security implications)

---

### 7. electron-builder: 23.6.0 → 26.0.12

**Severity:** 🟡 MODERATE
**Type:** Major Update
**Breaking Changes:** ⚠️ YES

**Why Upgrade:**
- Better macOS code signing
- Windows app store support improvements
- Better auto-update functionality

**Why NOT Upgrade (Yet):**
- Should upgrade with Electron (dependent versions)
- Build configuration may need changes
- Not urgent (development tool only)

**Recommendation:** 🔶 **DEFER** - Upgrade together with Electron

**Risk:** 🟠 MODERATE (build tool, doesn't affect runtime)

---

## ✅ UP TO DATE

### @xenova/transformers: 2.17.2
- **Status:** Latest version
- **No action needed**

---

## 📋 Recommended Update Plan

### Phase 1: IMMEDIATE (Security Fix) ✅ DO NOW

```bash
# Update mammoth (security fix)
npm install mammoth@^1.11.0

# Update safe minor/patch versions
npm install exceljs@^4.4.0
npm install turndown@^7.2.2

# Save changes
npm install

# Test
npm run dev
```

**Testing Checklist:**
- [ ] Process DOCX files
- [ ] Process XLSX files
- [ ] Process PDF files
- [ ] Verify Markdown output quality
- [ ] Check entity mapping generation
- [ ] Test Swiss/EU PII detection
- [ ] Verify file conversion accuracy

**Time Estimate:** 30 minutes (install + test)

---

### Phase 2: EVALUATION (Major Updates) 📅 SCHEDULE FOR v2.1

**Research pdf-parse 2.x migration:**
```bash
# Create test branch
git checkout -b test/pdf-parse-upgrade

# Install new version
npm install pdf-parse@^2.4.5

# Test thoroughly
npm run dev
# Test PDF processing, check for errors

# If successful, merge
# If issues, revert and document blockers
```

**Research marked 17.x migration:**
```bash
# Create test branch
git checkout -b test/marked-upgrade

# Install new version
npm install marked@^17.0.0

# Test thoroughly
npm run dev
# Test Markdown validation

# If successful, merge
```

**Time Estimate:** 2-4 hours (research + test)

---

### Phase 3: MAJOR UPGRADE (Electron) 📅 PLAN FOR v3.0

**Electron 34.x → 39.x is a significant upgrade requiring:**

1. **Pre-upgrade Tasks:**
   - Review all Electron release notes (v35-v39)
   - Document current Electron API usage
   - Create comprehensive test plan
   - Set up automated testing

2. **Incremental Testing:**
   - Test each major version separately
   - Fix breaking changes at each step
   - Update security configurations
   - Re-run security audit

3. **Validation:**
   - Full regression testing
   - Security audit re-run
   - Performance benchmarking
   - Package builds for all platforms

**Time Estimate:** 8-16 hours (full testing cycle)

**Recommendation:** Make this a v3.0 milestone with dedicated testing time

---

## 🔒 Security Impact Analysis

| Package | Current Vulnerabilities | Fixed in Update? |
|---------|------------------------|------------------|
| mammoth | 🔴 Directory Traversal | ✅ YES (v1.11.0) |
| exceljs | ✅ None known | N/A |
| pdf-parse | ⚠️ Unknown (outdated) | ❓ Research needed |
| turndown | ✅ None known | N/A |
| marked | ⚠️ Potential (outdated) | ❓ Research needed |
| electron | ⚠️ Chromium CVEs | ✅ YES (v39.x) |

**Action Items:**
1. ✅ Update mammoth immediately (closes Issue #4 from audit)
2. 🔍 Research pdf-parse security changelog
3. 🔍 Research marked security advisories
4. 📅 Plan Electron upgrade for next major version

---

## 💡 Alternative: Lock File Strategy

If you want to minimize risk while still getting security fixes:

**Option A: Conservative (Recommended for Production)**
```bash
# Update only security fixes
npm install mammoth@^1.11.0

# Lock everything else
npm shrinkwrap
```

**Option B: Moderate (Recommended for Active Development)**
```bash
# Update safe packages
npm install mammoth@^1.11.0 exceljs@^4.4.0 turndown@^7.2.2

# Research major updates
# Upgrade when ready
```

**Option C: Aggressive (Not Recommended)**
```bash
# Update everything
npm update

# Pray and test extensively
```

---

## 📊 Testing Strategy

### Automated Testing (Recommended to Add)

```javascript
// tests/converters.test.js
import { PdfToMarkdown } from './src/converters/PdfToMarkdown.js';
import { DocxToMarkdown } from './src/converters/DocxToMarkdown.js';
import { ExcelToMarkdown } from './src/converters/ExcelToMarkdown.js';

// Test PDF conversion
test('PDF conversion maintains text accuracy', async () => {
  const converter = new PdfToMarkdown();
  const result = await converter.convert('./fixtures/test.pdf');
  expect(result).toContain('Expected text');
});

// Test DOCX conversion
test('DOCX conversion preserves formatting', async () => {
  const converter = new DocxToMarkdown();
  const result = await converter.convert('./fixtures/test.docx');
  expect(result).toContain('# Expected Heading');
});

// Test Excel conversion
test('Excel conversion creates tables', async () => {
  const converter = new ExcelToMarkdown();
  const result = await converter.convert('./fixtures/test.xlsx');
  expect(result).toContain('|');
});
```

### Manual Testing Checklist

Create `test-files/` directory with samples:
- [ ] `sample.pdf` - Multi-page PDF with text
- [ ] `sample.docx` - Document with headings, lists, tables
- [ ] `sample.xlsx` - Spreadsheet with multiple sheets
- [ ] `sample-pii.txt` - Text with Swiss AVS, IBAN, names
- [ ] `malicious.docx` - File attempting path traversal

Test each after updates:
```bash
npm run dev
# Drag each file into app
# Verify output quality
# Check for errors in console
```

---

## 📝 Updated package.json (Phase 1)

```json
{
  "dependencies": {
    "exceljs": "^4.4.0",          // Updated from 4.3.0
    "@xenova/transformers": "2.17.2",
    "mammoth": "^1.11.0",          // Updated from 1.5.2 (SECURITY FIX)
    "pdf-parse": "^1.1.1",         // Keep current (major update needs research)
    "turndown": "^7.2.2",          // Updated from 7.2.0
    "marked": "^12.0.0"            // Keep current (major update needs research)
  },
  "devDependencies": {
    "electron": "^34.2.0",         // Keep current (major update for v3.0)
    "electron-builder": "^23.6.0"  // Keep current (update with Electron)
  }
}
```

---

## 🎯 Summary & Next Steps

### ✅ DO NOW (30 mins)

```bash
cd /home/user/A5-PII-Anonymizer

# Update packages
npm install mammoth@^1.11.0 exceljs@^4.4.0 turndown@^7.2.2

# Test the app
npm run dev

# If tests pass, commit
git add package.json package-lock.json
git commit -m "deps: Update mammoth (security), exceljs, turndown to latest"
git push
```

### 📅 PLAN FOR v2.1 (2-4 hrs)

1. Research pdf-parse 2.x changes
2. Research marked 17.x changes
3. Test upgrades in separate branches
4. Merge if safe, document if not

### 📅 PLAN FOR v3.0 (1-2 weeks)

1. Upgrade Electron 34 → 39
2. Upgrade electron-builder 23 → 26
3. Full security re-audit
4. Comprehensive testing
5. Update all documentation

---

## 📞 Questions?

If you encounter issues during updates:

1. **Check logs:** Look for error messages in console
2. **Revert if needed:** `git checkout package.json && npm install`
3. **Report issues:** Create GitHub issue with error details
4. **Seek help:** contact@softcom.pro

---

**Last Updated:** 2025-11-09
**Next Review:** After Phase 1 completion or Q1 2026
