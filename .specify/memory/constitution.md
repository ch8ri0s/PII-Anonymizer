<!--
Sync Impact Report:
- Version change: N/A (initial) → 1.0.0
- Modified principles: N/A (initial creation)
- Added sections: All core principles (5), Security Requirements, Development Workflow, Governance
- Removed sections: N/A
- Templates requiring updates:
  ✅ plan-template.md - reviewed, constitution check section compatible
  ✅ spec-template.md - reviewed, user story requirements align
  ✅ tasks-template.md - reviewed, task organization supports principles
  ⚠ Command files (.claude/commands/) - no agent-specific references to update (uses generic guidance)
- Follow-up TODOs: None - all placeholders filled with concrete values
-->

# Softcom PII Anonymiser Constitution

## Core Principles

### I. Privacy-First Architecture (NON-NEGOTIABLE)

All features MUST prioritize user privacy and data protection above convenience or performance. The application MUST operate with 100% local processing—no network calls, cloud services, or external API dependencies for PII processing. Original PII values MUST NEVER be written to logs, error messages, or any persistent storage except the mapping file under explicit user control.

**Rationale**: As a PII anonymisation tool, privacy is not a feature but the foundational promise. Any compromise breaks user trust and violates our core mission.

### II. Test-First Development (NON-NEGOTIABLE)

Tests MUST be written before implementation. The Red-Green-Refactor cycle is strictly enforced: (1) Write test → (2) Verify test fails → (3) User approves test → (4) Implement minimal code to pass → (5) Refactor. No feature or bug fix is complete without corresponding tests demonstrating the behavior.

**Rationale**: Per project constitution and user requirements, test-first ensures correctness, prevents regressions, and maintains confidence in PII detection accuracy (94%+ threshold).

### III. Comprehensive PII Detection

The system MUST maintain hybrid detection combining ML-based models (94%+ accuracy) with rule-based patterns for Swiss and EU-specific identifiers (AVS/AHV, IBAN, VAT, UID, etc.). Any new PII detection pattern MUST include validation logic, not just regex matching. Detection coverage MUST be documented and measurable.

**Rationale**: Single-method detection has gaps. Hybrid approach ensures both broad coverage (ML) and precision (rules) for European data protection requirements.

### IV. Security Hardening (NON-NEGOTIABLE)

All CRITICAL and HIGH severity security vulnerabilities MUST be remediated before release. The application MUST enforce Electron security best practices: context isolation enabled, node integration disabled, Content Security Policy configured, path traversal protection, URL sanitization. Security audits against OWASP Top 10 and Electron-specific threats are mandatory before major releases.

**Rationale**: A compromised PII tool becomes an attack vector for the very data it's meant to protect. Security is non-negotiable.

### V. LLM-Ready Output Quality

Conversion output MUST produce clean, structured Markdown suitable for direct LLM consumption. Document structure MUST be preserved (headings, tables, lists, code blocks) with format-specific fidelity targets: TXT (100%), CSV (100%), DOCX (90%+), Excel (90%+), PDF (60-80%). Each output file MUST include metadata (source format, processing timestamp, model version, anonymisation status).

**Rationale**: Poor conversion quality undermines the tool's purpose. LLM effectiveness depends on well-structured input; users rely on consistent, predictable output.

## Security Requirements

### Electron Hardening (Mandatory)

- `contextIsolation: true` - Isolate renderer from Node.js
- `nodeIntegration: false` - Prevent arbitrary code execution
- Preload script with `contextBridge` - Secure IPC only
- Content Security Policy - Block XSS attacks
- Path validation - Prevent directory traversal
- URL sanitization - Block javascript:, data:, file:// URIs

### File System Protection

- Path normalization and validation before all file operations
- Output files restricted to user-specified directories only
- Temporary files created with safe permissions (user-only)
- Mapping files MUST include warnings about secure storage and deletion

### Error Handling & Privacy

- File paths MUST be redacted from user-facing error messages
- Original PII MUST NEVER appear in logs or error messages
- Full error details logged to console for debugging (local only)
- Exception messages sanitized to remove sensitive data

## Development Workflow

### Code Quality

- All code MUST pass linter and formatter checks before commit
- Descriptive variable names required (per user's CLAUDE.md)
- No security anti-patterns (command injection, XSS, SQL injection, OWASP Top 10)
- Performance regressions (10x+ slowdown) require explicit justification

### Testing Requirements

- Unit tests for PII detection patterns with validation logic
- Integration tests for multi-format conversion pipelines
- Contract tests for file format outputs (metadata, structure)
- Security regression tests for patched vulnerabilities (CRITICAL/HIGH priority)
- Tests MUST be independently runnable and provide clear pass/fail

### Documentation Standards

- All new PII patterns documented with format, validation, and examples
- Security fixes documented in SECURITY_AUDIT.md with severity and remediation
- Breaking changes documented with migration path
- Performance improvements documented with benchmarks (before/after)

## Governance

### Constitution Authority

This constitution supersedes all other development practices and preferences. Any PR, code review, or architectural decision MUST demonstrate compliance with the principles above. Violations require explicit justification documented in the implementation plan's Complexity Tracking section.

### Amendment Process

1. Propose amendment with rationale and impact analysis
2. Update constitution following semantic versioning:
   - **MAJOR**: Backward-incompatible principle removals or redefinitions
   - **MINOR**: New principle/section or materially expanded guidance
   - **PATCH**: Clarifications, wording fixes, non-semantic refinements
3. Propagate changes to dependent templates (plan, spec, tasks, commands)
4. Document sync impact in HTML comment header
5. Commit with message: `docs: amend constitution to vX.Y.Z (description)`

### Compliance Review

All feature implementations MUST complete the Constitution Check gate before Phase 0 research (per plan-template.md). Re-check required after Phase 1 design. Any complexity introduced to satisfy a principle MUST be justified against simpler alternatives.

### Versioning Policy

Constitution changes trigger version increments. Version history MUST be traceable via git commits. Templates dependent on constitution principles MUST be reviewed and updated within the same commit or immediately following amendment.

**Version**: 1.0.0 | **Ratified**: 2025-11-09 | **Last Amended**: 2025-11-09
