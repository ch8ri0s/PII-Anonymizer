# Security Policy

## Supported Versions

We release security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| < 2.0   | :x:                |

## Security Posture

**Current Security Status:** 🟢 LOW RISK

As of the latest security audit (2025-11-09), Softcom PII Anonymiser has:
- ✅ **8 of 10** vulnerabilities FIXED
- ✅ All CRITICAL and HIGH severity issues resolved
- ⚠️ 2 low-impact issues remain (transitive dependencies)

See [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for detailed findings and remediation status.

### Recent Security Improvements

**Commit 0590b32** (2025-11-09):
- ✅ Fixed Electron security misconfiguration (CRITICAL)
- ✅ Added path traversal protection (HIGH)
- ✅ Implemented URL validation (HIGH)
- ✅ Removed PII from logs (MODERATE)
- ✅ Added Content Security Policy (MODERATE)
- ✅ Sanitized error messages (LOW)

### Security Features

- **Sandboxed Renderer**: Context isolation enabled, Node.js integration disabled
- **Secure IPC**: All renderer-main communication via validated contextBridge APIs
- **Path Validation**: Comprehensive validation prevents path traversal and arbitrary file access
- **URL Sanitization**: Only http:// and https:// protocols allowed, blocks javascript:, data:, file://
- **Content Security Policy**: Strict CSP headers prevent XSS attacks
- **PII Protection**: Personally Identifiable Information never logged to console
- **Error Sanitization**: File paths redacted from user-visible error messages
- **Local Processing**: All PII anonymization happens locally, no data sent to external servers

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in Softcom PII Anonymiser, please help us responsibly disclose it.

### How to Report

**Email:** contact@softcom.pro

**Subject Line:** `[SECURITY] <Brief Description>`

### What to Include

Please provide as much information as possible:

1. **Type of vulnerability** (e.g., XSS, path traversal, ReDoS)
2. **Attack scenario** - How can this be exploited?
3. **Impact assessment** - What's the potential damage?
4. **Steps to reproduce** - Detailed reproduction steps
5. **Proof of concept** - Code/screenshots if applicable
6. **Affected versions** - Which versions are vulnerable?
7. **Suggested fix** - If you have one (optional)

### Example Report

```
Subject: [SECURITY] Path Traversal in Output Directory Selection

Type: Path Traversal (CWE-22)

Attack Scenario:
An attacker could craft a malicious output path like "../../../etc/passwd"
to write files outside the intended directory.

Impact:
Arbitrary file write anywhere on the filesystem with user permissions.

Steps to Reproduce:
1. Open Softcom PII Anonymiser
2. Select output directory
3. Use browser dev tools to modify outputPath variable to "../../../tmp/evil.md"
4. Process a file
5. Observe file written to /tmp/evil.md instead of selected directory

Affected Versions: 1.0.0 - 1.9.x

Suggested Fix:
Implement path.normalize() and path.resolve() validation before
any fs.writeFile() operations. Check that resolved path starts
with an allowed base directory.
```

### Response Timeline

- **Initial Response:** Within 72 hours
- **Triage & Assessment:** Within 1 week
- **Fix Development:** Depends on severity
  - Critical: 1-3 days
  - High: 3-7 days
  - Medium: 1-2 weeks
  - Low: Next release cycle
- **Public Disclosure:** After fix is deployed

### Responsible Disclosure

We follow coordinated vulnerability disclosure:

1. **Report received** → We acknowledge within 72 hours
2. **Vulnerability validated** → We confirm and assess severity
3. **Fix developed** → We create a patch
4. **Private notification** → We notify you when fix is ready
5. **Fix deployed** → We release patched version
6. **Public disclosure** → We publish security advisory 7 days after release
7. **Credit** → We credit you in release notes (if desired)

### Security Researcher Recognition

We believe in recognizing security researchers who help improve Softcom PII Anonymiser:

- 🏆 **Hall of Fame** - Listed in SECURITY_AUDIT.md
- 📰 **Public Credit** - Mentioned in release notes and security advisories
- 🎁 **Swag** - Softcom merchandise for significant findings (when available)

### Out of Scope

The following are **not** considered security vulnerabilities:

- Theoretical vulnerabilities without proof of concept
- Vulnerabilities in dependencies (report to upstream projects)
- Social engineering attacks
- Physical access attacks
- Denial of Service via resource exhaustion (expected for large files)
- Vulnerabilities requiring compromised operating system
- Issues in EOL (End of Life) versions
- Issues already documented in SECURITY_AUDIT.md
- Logout/timing attacks
- Self-XSS

### Bug Bounty

We currently **do not** operate a paid bug bounty program. However:

- We deeply appreciate security research contributions
- Significant findings may be recognized with Softcom swag
- You will be credited publicly (if desired)
- You help make privacy tools safer for everyone

## Security Best Practices for Users

### For End Users

1. **Download from official sources only**
   - GitHub releases: https://github.com/ch8ri0s/A5-PII-Anonymizer/releases
   - Verify SHA-256 checksums

2. **Keep software updated**
   - Enable automatic updates in Electron
   - Check for updates monthly

3. **Secure your mapping files**
   - `-mapping.json` files contain original PII
   - Store in encrypted directories
   - Delete when no longer needed
   - Never share mapping files

4. **Review output before sharing**
   - Verify PII has been anonymized
   - Check for edge cases model might miss
   - Test with sample documents first

5. **Use appropriate file permissions**
   - Output directory: 700 (user-only)
   - Mapping files: 600 (user read/write only)

### For Developers/Contributors

1. **Run security checks**
   ```bash
   npm audit
   npm outdated
   ```

2. **Follow secure coding practices**
   - Never disable Electron security features
   - Validate all user input
   - Use parameterized queries (if DB added)
   - Avoid eval(), Function(), setTimeout(string)

3. **Test security controls**
   - Path traversal: Try `../../../etc/passwd`
   - XSS: Try `<script>alert(1)</script>` in file names
   - URL injection: Try `javascript:alert(1)` in paths

4. **Review pull requests carefully**
   - Check for introduced vulnerabilities
   - Ensure tests cover security scenarios
   - Validate dependencies

## GDPR & Privacy Compliance

Softcom PII Anonymiser is designed with privacy in mind:

### Data Minimization (Art. 5)
- Only processes files selected by user
- No telemetry or analytics
- No network connections for processing

### Storage Limitation (Art. 5)
- No persistent storage of PII
- Mapping files stored only where user specifies
- User controls retention period

### Security of Processing (Art. 32)
- Encryption recommended for mapping files
- Access controls on output directories
- Audit logs in console only (not persisted)

### Data Subject Rights (Art. 15-22)
- Users control all data
- Easy deletion of mapping files
- Transparent processing (see README.md)

## License & Commercial Use

**License:** CC BY-NC-SA 4.0 (Creative Commons Attribution-NonCommercial-ShareAlike)

- ✅ Free for personal and non-commercial use
- ✅ Educational and research use permitted
- ❌ Commercial use requires separate license
- 📧 Commercial inquiries: contact@softcom.pro

Commercial use includes:
- Using in profit-making businesses
- Processing client data for fee
- Embedding in commercial products
- SaaS offerings

## Contact

- **Security Issues:** contact@softcom.pro (Subject: [SECURITY])
- **General Support:** contact@softcom.pro
- **GitHub Issues:** https://github.com/ch8ri0s/A5-PII-Anonymizer/issues (non-security bugs only)

---

**Last Updated:** 2025-11-09
**Next Security Audit:** Q1 2026 (recommended)
