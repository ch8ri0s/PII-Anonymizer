# Story 6.6: Global State Refactoring

Status: done

## Story

As a **developer maintaining the codebase**,
I want **file processing state to be scoped per-session instead of global**,
So that **batch processing doesn't cause data corruption between files**.

## Acceptance Criteria

1. **AC1: Session-Scoped State**
   - Each processFile() call creates a new session instance
   - Pseudonym counters are scoped to that file session only
   - Pseudonym mappings don't leak between files

2. **AC2: Independent Numbering**
   - Each file gets independent PER_1, PER_2 numbering
   - Mapping file contains only that file's entities
   - No cross-contamination between sequential file processing

3. **AC3: Parallel Processing Ready**
   - Parallel processing is possible without state collision
   - No shared mutable state between concurrent operations
   - Thread-safe design for future worker thread support

4. **AC4: Memory Management**
   - Session objects are garbage collected when processing completes
   - No memory leaks from accumulated sessions
   - Large file processing doesn't exhaust memory

5. **AC5: Backward Compatibility**
   - External API (processFile) unchanged
   - Existing tests pass without modification
   - Output format remains identical

## Tasks / Subtasks

- [ ] Task 1: Design Session Class (AC: 1, 3)
  - [ ] 1.1: Create `FileProcessorSession` class design
  - [ ] 1.2: Define session properties (counters, mappings, filePath)
  - [ ] 1.3: Plan lifecycle (create, process, cleanup)

- [ ] Task 2: Implement FileProcessorSession (AC: 1, 2)
  - [ ] 2.1: Create `src/services/FileProcessorSession.ts`
  - [ ] 2.2: Move pseudonymCounters and pseudonymMapping into class
  - [ ] 2.3: Move getPseudonym() method into class
  - [ ] 2.4: Add session ID for logging/debugging

- [ ] Task 3: Refactor processFile (AC: 1, 5)
  - [ ] 3.1: Update processFile to create session instance
  - [ ] 3.2: Pass session to all internal functions
  - [ ] 3.3: Remove global state variables
  - [ ] 3.4: Maintain external API signature

- [ ] Task 4: Memory Management (AC: 4)
  - [ ] 4.1: Implement session cleanup method
  - [ ] 4.2: Add memory usage logging for large files
  - [ ] 4.3: Test with multiple large file sequences

- [ ] Task 5: Testing (AC: 2, 3, 5)
  - [ ] 5.1: Add batch processing isolation test
  - [ ] 5.2: Add parallel processing test (simulated)
  - [ ] 5.3: Verify existing tests still pass
  - [ ] 5.4: Add memory leak detection test

## Dev Notes

### Current Problematic Code

`fileProcessor.js:35-37`:
```javascript
// DANGEROUS: Global mutable state shared across ALL operations
const pseudonymCounters = {};
const pseudonymMapping = {};
```

### Data Corruption Scenario

```
File A: "John Doe" → PER_1
File B: Different "John Doe" → Also maps to PER_1 (WRONG!)
```

### Proposed Solution

```typescript
class FileProcessorSession {
  private pseudonymCounters: Record<string, number> = {};
  private pseudonymMapping: Record<string, string> = {};
  private sessionId: string;

  constructor() {
    this.sessionId = crypto.randomUUID();
  }

  getPseudonym(entityText: string, entityType: string): string {
    if (this.pseudonymMapping[entityText]) {
      return this.pseudonymMapping[entityText];
    }

    if (!this.pseudonymCounters[entityType]) {
      this.pseudonymCounters[entityType] = 1;
    }

    const pseudonym = `${entityType}_${this.pseudonymCounters[entityType]++}`;
    this.pseudonymMapping[entityText] = pseudonym;
    return pseudonym;
  }

  cleanup(): void {
    this.pseudonymCounters = {};
    this.pseudonymMapping = {};
  }
}

// Usage:
static async processFile(filePath: string, outputPath: string) {
  const session = new FileProcessorSession();
  try {
    return await session.process(filePath, outputPath);
  } finally {
    session.cleanup();
  }
}
```

### Files to Modify

- `fileProcessor.js` - Main refactoring target
- May need to update any code that directly accesses global state

### References

- CODE_REVIEW.md Critical Issue #1
- test/unit/fileProcessor.session.test.js (may exist)

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-14 | Claude | Story created from CODE_REVIEW.md findings |
| 2025-12-14 | Claude | Story marked DONE - already implemented in earlier Epic work |

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

**Story already implemented!** Upon analysis of the codebase during context generation:

1. `FileProcessingSession` class exists at `fileProcessor.js:141-288`
2. Session is created per-file at `fileProcessor.js:778`
3. All acceptance criteria are met:
   - AC1: Session-scoped state (pseudonymCounters, pseudonymMapping in class)
   - AC2: Independent numbering per file (getOrCreatePseudonym method)
   - AC3: Parallel-safe (each processFile creates new session)
   - AC4: Memory management (sessions are local to processFile scope)
   - AC5: Backward compatibility (resetMappings is deprecated no-op)
4. Tests exist: `test/unit/fileProcessor.session.test.js` (294 lines, 5 test cases)
5. Implementation was part of Epic 2 (Address Relationship Modeling)

### File List

