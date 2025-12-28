# Story 8.17: External/Remote Recognizer Support

## Story

As a **PII system architect**,
I want **an abstraction for calling external PII detection services**,
So that **we can integrate Azure AI Language, AWS Comprehend, or custom APIs as fallback or enhancement recognizers without modifying core detection logic**.

## Status

| Field | Value |
|-------|-------|
| **Story ID** | 8.17 |
| **Epic** | 8 - PII Detection Quality Improvement |
| **Status** | ready-for-dev |
| **Created** | 2025-12-25 |
| **Priority** | P3 - Low (Future Extensibility) |
| **Reference** | Microsoft Presidio `RemoteRecognizer` pattern |

## Acceptance Criteria

**Given** an external PII detection service is configured
**When** the detection pipeline runs
**Then** the external service is called and results are merged with local detection

**And** external recognizers implement the same interface as local recognizers
**And** external calls have configurable timeout and retry logic
**And** external recognizer failures don't break local detection (graceful degradation)
**And** external recognizers can be enabled/disabled via configuration
**And** no external calls are made by default (opt-in only, privacy-first)
**And** results from external services are clearly marked with source metadata

## Technical Design

### Architecture Decision

This story creates the **architecture and interface only**. Actual integrations (Azure AI Language, AWS Comprehend) are future work. The goal is extensibility without current implementation.

**Privacy Note:** This feature is opt-in only. By default, no external network calls are made, preserving the app's privacy-first architecture.

### Interface

```typescript
// shared/pii/recognizers/RemoteRecognizer.ts

import { RecognizerMatch } from './types';

/**
 * Configuration for remote recognizer
 */
export interface RemoteRecognizerConfig {
  /** Unique name for this recognizer */
  name: string;

  /** Service endpoint URL */
  endpoint: string;

  /** Supported entity types (empty = all types) */
  supportedEntities: string[];

  /** Supported languages (empty = all languages) */
  supportedLanguages: string[];

  /** Request timeout in milliseconds (default: 5000) */
  timeoutMs: number;

  /** Number of retry attempts (default: 1) */
  retryAttempts: number;

  /** Priority for conflict resolution (default: 40, lower than local) */
  priority: number;

  /** Whether this recognizer is enabled (default: false) */
  enabled: boolean;

  /** Authentication configuration */
  auth?: {
    type: 'api_key' | 'bearer' | 'oauth2';
    credentials: string;  // Key name in secure storage, not actual credentials
  };

  /** Rate limiting configuration */
  rateLimit?: {
    requestsPerMinute: number;
    burstLimit: number;
  };
}

/**
 * Abstract base class for remote recognizers
 * Presidio pattern: RemoteRecognizer
 */
export abstract class RemoteRecognizer {
  protected config: RemoteRecognizerConfig;

  constructor(config: RemoteRecognizerConfig) {
    this.config = config;
  }

  /**
   * Analyze text using remote service
   * @param text - Text to analyze
   * @param language - Language code
   * @returns Detected entities with source marked as 'REMOTE'
   */
  abstract analyze(text: string, language?: string): Promise<RecognizerMatch[]>;

  /**
   * Check if service is available
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Get recognizer name
   */
  getName(): string {
    return this.config.name;
  }

  /**
   * Check if recognizer supports entity type
   */
  supportsEntity(entityType: string): boolean {
    if (this.config.supportedEntities.length === 0) return true;
    return this.config.supportedEntities.includes(entityType);
  }

  /**
   * Check if recognizer supports language
   */
  supportsLanguage(language: string): boolean {
    if (this.config.supportedLanguages.length === 0) return true;
    return this.config.supportedLanguages.includes(language);
  }

  /**
   * Check if recognizer is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}
```

### Example: Azure AI Language Recognizer (Scaffold)

```typescript
// shared/pii/recognizers/remote/AzureAILanguageRecognizer.ts

import { RemoteRecognizer, RemoteRecognizerConfig } from '../RemoteRecognizer';
import { RecognizerMatch } from '../types';

/**
 * Azure AI Language PII detection recognizer
 * See: https://learn.microsoft.com/azure/ai-services/language-service/pii-detection/
 *
 * NOTE: This is a scaffold. Actual implementation requires Azure SDK.
 */
export class AzureAILanguageRecognizer extends RemoteRecognizer {
  constructor(config: Partial<RemoteRecognizerConfig> & { endpoint: string }) {
    super({
      name: 'AzureAILanguage',
      supportedEntities: [],  // Supports many entity types
      supportedLanguages: ['en', 'fr', 'de', 'es', 'it', 'pt', 'ja', 'ko', 'zh'],
      timeoutMs: 5000,
      retryAttempts: 2,
      priority: 40,
      enabled: false,  // Must be explicitly enabled
      ...config,
    });
  }

  async analyze(text: string, language?: string): Promise<RecognizerMatch[]> {
    if (!this.isEnabled()) {
      return [];
    }

    // TODO: Implement Azure AI Language API call
    // POST {endpoint}/language/:analyze-text?api-version=2023-04-01
    // Body: { "kind": "PiiEntityRecognition", "parameters": { "modelVersion": "latest" }, "analysisInput": { "documents": [{ "id": "1", "language": language, "text": text }] } }

    throw new Error('AzureAILanguageRecognizer not implemented - future work');
  }

  async healthCheck(): Promise<boolean> {
    // TODO: Implement health check
    return false;
  }

  /**
   * Map Azure entity categories to our entity types
   */
  private mapEntityType(azureCategory: string): string {
    const mapping: Record<string, string> = {
      'Person': 'PERSON_NAME',
      'PersonType': 'PERSON_NAME',
      'PhoneNumber': 'PHONE_NUMBER',
      'Email': 'EMAIL',
      'Address': 'ADDRESS',
      'Organization': 'ORGANIZATION',
      'DateTime': 'DATE',
      // Add more mappings as needed
    };
    return mapping[azureCategory] || 'UNKNOWN';
  }
}
```

### Registry Integration

```typescript
// shared/pii/recognizers/index.ts (additions)

import { RemoteRecognizer } from './RemoteRecognizer';

// Separate registry for remote recognizers
const remoteRegistry: Map<string, RemoteRecognizer> = new Map();

export function registerRemoteRecognizer(recognizer: RemoteRecognizer): void {
  if (!recognizer.isEnabled()) {
    console.log(`Remote recognizer ${recognizer.getName()} registered but disabled`);
  }
  remoteRegistry.set(recognizer.getName(), recognizer);
}

export function getEnabledRemoteRecognizers(language?: string): RemoteRecognizer[] {
  return Array.from(remoteRegistry.values())
    .filter(r => r.isEnabled())
    .filter(r => !language || r.supportsLanguage(language));
}

export async function runRemoteRecognizers(
  text: string,
  language?: string,
  timeout?: number
): Promise<RecognizerMatch[]> {
  const recognizers = getEnabledRemoteRecognizers(language);
  if (recognizers.length === 0) {
    return [];
  }

  // Run all remote recognizers in parallel with timeout
  const results = await Promise.allSettled(
    recognizers.map(r =>
      Promise.race([
        r.analyze(text, language),
        new Promise<RecognizerMatch[]>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeout || 5000)
        )
      ])
    )
  );

  // Collect successful results, log failures
  const matches: RecognizerMatch[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      matches.push(...result.value);
    } else {
      console.warn(`Remote recognizer ${recognizers[index].getName()} failed:`, result.reason);
    }
  });

  return matches;
}
```

### Pipeline Integration (Optional Pass)

```typescript
// src/pii/passes/RemoteRecognizerPass.ts

import { DetectionPass, Entity, PipelineContext } from '../../types/detection';
import { runRemoteRecognizers } from '@shared/pii/recognizers';

/**
 * Optional pass that calls external PII detection services
 * Only runs if remote recognizers are configured and enabled
 */
export class RemoteRecognizerPass implements DetectionPass {
  readonly name = 'RemoteRecognizerPass';
  readonly order = 15;  // After HighRecallPass (10), before validation (20)
  enabled = false;  // Disabled by default

  async execute(
    text: string,
    entities: Entity[],
    context: PipelineContext
  ): Promise<Entity[]> {
    if (!this.enabled) {
      return entities;
    }

    try {
      const remoteMatches = await runRemoteRecognizers(text, context.language);

      // Convert to Entity format with REMOTE source
      const remoteEntities = remoteMatches.map(match => ({
        id: generateEntityId(),
        type: match.type,
        text: match.text,
        start: match.start,
        end: match.end,
        confidence: match.confidence,
        source: 'REMOTE' as const,
        metadata: {
          recognizer: match.recognizer,
          remoteService: true,
        }
      }));

      // Merge with existing entities (deduplication happens in ConsolidationPass)
      return [...entities, ...remoteEntities];
    } catch (error) {
      // Graceful degradation: log error but don't fail pipeline
      console.error('Remote recognizer pass failed:', error);
      return entities;
    }
  }
}
```

## Prerequisites

- Story 8.5 (Recognizer Architecture) - for registry pattern
- Story 8.8 (Entity Consolidation) - for merging remote results

## Integration Points

- `RecognizerRegistry` extended with remote recognizer support
- `RemoteRecognizerPass` optional in detection pipeline
- Configuration via `detectionRules.json` or environment variables
- Credentials stored in secure storage (Electron keychain, browser secure storage)

## Test Scenarios

1. **Disabled by default:** No external calls when not configured
2. **Registry integration:** Remote recognizers register correctly
3. **Graceful degradation:** Pipeline continues if remote call fails
4. **Timeout handling:** Slow services don't block detection
5. **Result merging:** Remote entities merge with local detection
6. **Source tracking:** Remote entities clearly marked as REMOTE
7. **Language filtering:** Only call services that support document language

## Definition of Done

- [ ] `RemoteRecognizer` abstract class created
- [ ] `RemoteRecognizerConfig` interface defined
- [ ] `AzureAILanguageRecognizer` scaffold created (not implemented)
- [ ] Remote registry functions added to recognizer index
- [ ] `RemoteRecognizerPass` created (disabled by default)
- [ ] Timeout and retry logic implemented
- [ ] Graceful degradation tested
- [ ] Unit tests for registry and pass
- [ ] Documentation with extension guide

## Future Work (Not in Scope)

- Azure AI Language full implementation
- AWS Comprehend integration
- Custom API adapter
- Credential management UI
- Usage metering and cost tracking

## Privacy Considerations

**IMPORTANT:** This feature is strictly opt-in.

1. **Default state:** All remote recognizers are disabled
2. **Explicit enablement:** User must actively configure and enable external services
3. **Consent tracking:** Consider logging when remote services are enabled
4. **Data minimization:** Only send text needed for detection, no metadata
5. **Secure credentials:** API keys stored in secure storage, never in config files
